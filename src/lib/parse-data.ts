import * as XLSX from 'xlsx';
import type { EditorAxisValue, EditorData, EditorItemData, EditorPrimaryCode } from './build-workbook';

export interface SankeyNode { id: number; axis: string; value: string; column: number; category: string | null; subcategory: string | null; color: string }
export interface SankeyLink { source: number; target: number; value: number }
export interface ItemLink { itemId: string; source: number; target: number; category: string; color: string }
export interface SankeyItem {
  id: string; sourceId: string; text: string; scale: string; derivedPrimary: string[]; category: string;
  values: Record<string, string[]>; outliner: string; originalPrimaryCode: string;
}
export interface SankeyData {
  nodes: SankeyNode[]; links: SankeyLink[]; itemLinks: ItemLink[]; nodeItems: Record<string, string[]>;
  items: SankeyItem[]; axisOrder: string[]; axisLabels: Record<string, string>; axisItemCounts: Record<string, number>;
  categoryOrder: string[]; categoryCodes: Record<string, string[]>; categoryColors: Record<string, string>;
  stimulusSubcats: Record<string, string>; stimulusSubcatOrder: string[]; stimulusSubcatColors: Record<string, string>;
  axisValueList: EditorAxisValue[];
}

export class DataContractError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) { super(issues.join('\n')); this.name = 'DataContractError'; this.issues = issues; }
}

const AXIS_ORDER = ['Stimulus', 'Process', 'Outcome', 'Response', 'CognitiveDisp', 'DerivedPrimary'];
const EMPTY_VALUES = new Set(['', '-', 'nan', 'NaN']);

export const CATEGORY_COLORS: Record<string, string> = {
  Overload: '#C55A11', Aversion: '#ED7D31', Coping: '#FFC000', 'Perceptual Sensitivity': '#4472C4',
  'Affective and Aesthetic': '#7030A0', 'Social Cognition and Empathy': '#00B050',
  'Cognitive Processing': '#00B0F0', 'Other Descriptors': '#A5A5A5',
};
export const STIMULUS_SUBCAT_COLORS: Record<string, string> = {
  Physical: '#4472C4', Internal: '#70AD47', Social: '#ED7D31', Demand: '#A5A5A5',
  Configuration: '#FFC000', 'Missing / Unspecified': '#D9D9D9',
};

function clean(value: unknown): string { return String(value ?? '').trim(); }
function normalizeHeader(value: unknown): string { return clean(value).toLowerCase().replace(/[\s_&/()-]+/g, ''); }
function splitValues(value: unknown, derived = false): string[] {
  const text = clean(value); if (EMPTY_VALUES.has(text)) return [];
  const separator = derived ? /\s*(?:\/|,)\s*/ : /\s*,\s*/;
  return [...new Set(text.split(separator).map((part) => part.trim()).filter((part) => !EMPTY_VALUES.has(part)))];
}
function canonicalAxis(value: unknown): EditorAxisValue['axis'] | null {
  const normalized = normalizeHeader(value); if (!normalized) return null;
  if (normalized.includes('stimulus')) return 'Stimulus';
  if (normalized === 'process') return 'Process';
  if (normalized.includes('outcome') || normalized.includes('valence')) return 'Outcome';
  if (normalized === 'response') return 'Response';
  if (normalized.includes('cognitivedisposition') || normalized === 'cognitivedisp') return 'CognitiveDisp';
  return null;
}
function getRequiredSheet(workbook: XLSX.WorkBook, name: string, issues: string[]): XLSX.WorkSheet | null {
  const sheet = workbook.Sheets[name]; if (!sheet) issues.push(`缺少工作表“${name}”。`); return sheet ?? null;
}

function readPrimaryCodes(sheet: XLSX.WorkSheet, issues: string[]): EditorPrimaryCode[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const result: EditorPrimaryCode[] = []; const codeCategory = new Map<string, string>(); let currentCategory = '';
  for (const row of rows.slice(1)) {
    const category = clean(row[1]); const code = clean(row[2]); if (category) currentCategory = category;
    if (!code || normalizeHeader(code) === 'primarycode') continue;
    if (!currentCategory) { issues.push(`Primary Code“${code}”没有对应的 Category。`); continue; }
    const previous = codeCategory.get(code);
    if (previous && previous !== currentCategory) { issues.push(`Primary Code“${code}”同时属于“${previous}”和“${currentCategory}”。`); continue; }
    if (!previous) { codeCategory.set(code, currentCategory); result.push({ category: currentCategory, code }); }
  }
  if (result.length === 0) issues.push('Primary Code List 中没有可用的编码。');
  return result;
}

function readAxisValues(sheet: XLSX.WorkSheet, issues: string[]): EditorAxisValue[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const result: EditorAxisValue[] = []; const seen = new Set<string>();
  let currentAxis: EditorAxisValue['axis'] | null = null; let currentSubcategory = '';
  for (const row of rows.slice(1)) {
    const declaredAxis = canonicalAxis(row[0]);
    if (declaredAxis) { currentAxis = declaredAxis; currentSubcategory = ''; }
    const subcategory = clean(row[1]); if (subcategory) currentSubcategory = subcategory;
    const value = clean(row[2]); if (!value || normalizeHeader(value) === 'value') continue;
    if (!currentAxis) { issues.push(`Axis Value“${value}”没有可识别的 Axis。`); continue; }
    const key = `${currentAxis}::${value}`; if (seen.has(key)) continue; seen.add(key);
    result.push({ axis: currentAxis, subcategory: currentAxis === 'Stimulus' ? currentSubcategory : '', value });
  }
  for (const axis of AXIS_ORDER.slice(0, 5)) if (!result.some((entry) => entry.axis === axis)) issues.push(`Axis Value List 缺少“${axis}”轴的值。`);
  return result;
}

type ItemColumns = { scale: number; id: number; text: number; derivedPrimary: number; outliner: number; stimulus?: number; modality?: number; configuration?: number; process: number; outcome: number; response: number; cognitiveDisp: number; originalPrimaryCode: number };
function findItemHeaderRow(rows: unknown[][]): number { return rows.findIndex((row) => normalizeHeader(row[0]) === 'row' && normalizeHeader(row[1]) === 'scale'); }
function assertColumn(rows: unknown[][], headerRow: number, column: number, aliases: string[], label: string, issues: string[]) {
  const candidates = [rows[headerRow]?.[column], rows[headerRow - 1]?.[column], rows[headerRow - 2]?.[column]];
  if (!candidates.some((value) => aliases.includes(normalizeHeader(value)))) issues.push(`Items 工作表第 ${column + 1} 列应为“${label}”，实际表头无法识别。`);
}

function readItems(sheet: XLSX.WorkSheet, schema: '5' | '6', issues: string[]): EditorItemData[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }); const headerRow = findItemHeaderRow(rows);
  if (headerRow < 0) { issues.push('Items 工作表中找不到以 Row、Scale 开始的表头行。'); return []; }
  const columns: ItemColumns = schema === '5'
    ? { scale: 1, id: 2, text: 3, derivedPrimary: 4, outliner: 5, stimulus: 6, process: 7, outcome: 8, response: 9, cognitiveDisp: 10, originalPrimaryCode: 11 }
    : { scale: 1, id: 2, text: 3, derivedPrimary: 4, outliner: 5, modality: 6, configuration: 7, process: 8, outcome: 9, response: 10, cognitiveDisp: 11, originalPrimaryCode: 12 };
  assertColumn(rows, headerRow, 2, ['itemid', 'id'], 'Item ID', issues);
  assertColumn(rows, headerRow, 3, ['itemtext', 'text'], 'Item Text', issues);
  assertColumn(rows, headerRow, 4, ['derived', 'derivedprimary', 'derivedprimarycode'], 'Derived Primary Code', issues);
  assertColumn(rows, headerRow, 6, schema === '5' ? ['stimulusinput', 'stimulus'] : ['modality'], schema === '5' ? 'Stimulus Input' : 'Modality', issues);
  if (schema === '6') assertColumn(rows, headerRow, 7, ['configuration'], 'Configuration', issues);
  assertColumn(rows, headerRow, columns.process, ['process'], 'Process', issues);
  assertColumn(rows, headerRow, columns.outcome, ['outcome', 'outcomeandappraisedvalence'], 'Outcome and Appraised Valence', issues);
  assertColumn(rows, headerRow, columns.response, ['response'], 'Response', issues);
  assertColumn(rows, headerRow, columns.cognitiveDisp, ['cognitivedisposition', 'cognitivedisp'], 'Cognitive Disposition', issues);
  const parsed: EditorItemData[] = [];
  for (let index = headerRow + 1; index < rows.length; index++) {
    const row = rows[index]; const sourceId = clean(row[columns.id]); if (!sourceId) continue;
    const scale = clean(row[columns.scale]); const text = clean(row[columns.text]);
    if (!scale) issues.push(`Items 第 ${index + 1} 行缺少 Scale。`); if (!text) issues.push(`Items 第 ${index + 1} 行（${sourceId}）缺少 Item Text。`);
    const stimulus = schema === '5' ? clean(row[columns.stimulus!]) : [clean(row[columns.modality!]), clean(row[columns.configuration!])].filter((value) => !EMPTY_VALUES.has(value)).join(', ');
    parsed.push({ id: sourceId, sourceId, text, scale,
      derivedPrimary: splitValues(row[columns.derivedPrimary], true).join(' / '), stimulus: splitValues(stimulus).join(', '),
      process: splitValues(row[columns.process]).join(', '), outcome: splitValues(row[columns.outcome]).join(', '),
      response: splitValues(row[columns.response]).join(', '), cognitiveDisp: splitValues(row[columns.cognitiveDisp]).join(', '),
      outliner: clean(row[columns.outliner]), originalPrimaryCode: clean(row[columns.originalPrimaryCode]) });
  }
  if (parsed.length === 0) issues.push('Items 工作表中没有有效条目。'); return parsed;
}

function validateEditorData(editor: EditorData): string[] {
  const issues: string[] = []; const codeCategory = new Map<string, string>();
  for (const entry of editor.primaryCodeList) {
    const category = clean(entry.category); const code = clean(entry.code); if (!category && !code) continue;
    if (!category || !code) { issues.push('Primary Code List 存在未填写完整的 Category/Code 行。'); continue; }
    const previous = codeCategory.get(code);
    if (previous) issues.push(previous === category
      ? `Primary Code“${code}”重复出现。`
      : `Primary Code“${code}”被分配到多个 Category。`);
    else codeCategory.set(code, category);
  }
  const axisValues = new Map<string, Set<string>>(); for (const axis of AXIS_ORDER.slice(0, 5)) axisValues.set(axis, new Set());
  for (const entry of editor.axisValueList) if (entry.axis && entry.value) {
    const value = clean(entry.value); const values = axisValues.get(entry.axis);
    if (values?.has(value)) issues.push(`${entry.axis} 轴的值“${value}”重复出现。`);
    values?.add(value);
  }
  for (const axis of AXIS_ORDER.slice(0, 5)) if ((axisValues.get(axis)?.size ?? 0) === 0) issues.push(`Axis Value List 缺少“${axis}”轴的值。`);
  const rawCounts = new Map<string, number>(); for (const item of editor.items) { const sourceId = clean(item.sourceId || item.id); rawCounts.set(sourceId, (rawCounts.get(sourceId) ?? 0) + 1); }
  const uniqueIds = new Set<string>();
  for (const item of editor.items) {
    const sourceId = clean(item.sourceId || item.id); const scale = clean(item.scale);
    if (!sourceId || !scale || !clean(item.text)) { issues.push('每个 item 都必须有稳定的 Item ID、Scale 和 Item Text。'); continue; }
    const uniqueId = (rawCounts.get(sourceId) ?? 0) > 1 ? `${sourceId}__${scale.replace(/\s/g, '')}` : sourceId;
    if (uniqueIds.has(uniqueId)) issues.push(`Item 唯一标识冲突：“${uniqueId}”。`); uniqueIds.add(uniqueId);
    const derivedCodes = splitValues(item.derivedPrimary, true);
    if (derivedCodes.length === 0) issues.push(`${uniqueId} 缺少 Derived Primary Code。`);
    for (const code of derivedCodes) if (!codeCategory.has(code)) issues.push(`${uniqueId} 引用了 Primary Code List 中不存在的编码“${code}”。`);
    const fields: Array<[string, string, string]> = [['Stimulus', item.stimulus, 'Stimulus'], ['Process', item.process, 'Process'], ['Outcome', item.outcome, 'Outcome'], ['Response', item.response, 'Response'], ['CognitiveDisp', item.cognitiveDisp, 'Cognitive Disposition']];
    for (const [axis, value, label] of fields) for (const member of splitValues(value)) if (!axisValues.get(axis)?.has(member)) issues.push(`${uniqueId} 的 ${label} 值“${member}”不在 Axis Value List 中。`);
  }
  return [...new Set(issues)];
}

export function parseExcelData(file: ArrayBuffer | XLSX.WorkBook): SankeyData {
  const workbook = file instanceof ArrayBuffer ? XLSX.read(file, { type: 'array' }) : file; const issues: string[] = [];
  const primarySheet = getRequiredSheet(workbook, 'Primary Code List', issues); const axisSheet = getRequiredSheet(workbook, 'Axis Value List', issues);
  const hasFive = Boolean(workbook.Sheets['Items × 5 Axes']); const hasSix = Boolean(workbook.Sheets['Items × 6 Axes']);
  if (hasFive && hasSix) issues.push('同时存在“Items × 5 Axes”和“Items × 6 Axes”；请保留一个明确版本。');
  if (!hasFive && !hasSix) issues.push('缺少“Items × 5 Axes”工作表。');
  if (issues.length > 0 || !primarySheet || !axisSheet) throw new DataContractError(issues);
  const primaryCodeList = readPrimaryCodes(primarySheet, issues); const axisValueList = readAxisValues(axisSheet, issues);
  const items = readItems(workbook.Sheets[hasFive ? 'Items × 5 Axes' : 'Items × 6 Axes'], hasFive ? '5' : '6', issues);
  const editor: EditorData = { items, primaryCodeList, axisValueList }; issues.push(...validateEditorData(editor));
  if (issues.length > 0) throw new DataContractError([...new Set(issues)]); return buildSankeyDataFromEditor(editor);
}

export function buildSankeyDataFromEditor(editor: EditorData): SankeyData {
  const issues = validateEditorData(editor); if (issues.length > 0) throw new DataContractError(issues);
  const primaryCodeList = editor.primaryCodeList.map((entry) => ({ category: clean(entry.category), code: clean(entry.code) })).filter((entry) => entry.category && entry.code);
  const categoryOrder = [...new Set(primaryCodeList.map((entry) => entry.category))];
  const categoryCodes: Record<string, string[]> = Object.fromEntries(categoryOrder.map((category) => [category, []])); const categoryMap: Record<string, string> = {};
  for (const entry of primaryCodeList) { categoryCodes[entry.category].push(entry.code); categoryMap[entry.code] = entry.category; }
  const cleanAxisList = editor.axisValueList.map((entry) => ({ axis: entry.axis, subcategory: clean(entry.subcategory), value: clean(entry.value) })).filter((entry) => entry.axis && entry.value);
  const stimulusSubcats: Record<string, string> = {}; for (const entry of cleanAxisList) if (entry.axis === 'Stimulus') stimulusSubcats[entry.value] = entry.subcategory || 'Missing / Unspecified';
  const stimulusSubcatOrder = [...new Set(cleanAxisList.filter((entry) => entry.axis === 'Stimulus').map((entry) => entry.subcategory || 'Missing / Unspecified'))];
  const rawCounts = new Map<string, number>(); for (const item of editor.items) { const sourceId = clean(item.sourceId || item.id); rawCounts.set(sourceId, (rawCounts.get(sourceId) ?? 0) + 1); }
  const items: SankeyItem[] = editor.items.map((item) => {
    const sourceId = clean(item.sourceId || item.id); const scale = clean(item.scale); const id = (rawCounts.get(sourceId) ?? 0) > 1 ? `${sourceId}__${scale.replace(/\s/g, '')}` : sourceId;
    const derivedPrimary = splitValues(item.derivedPrimary, true); const values = { Stimulus: splitValues(item.stimulus), Process: splitValues(item.process), Outcome: splitValues(item.outcome), Response: splitValues(item.response), CognitiveDisp: splitValues(item.cognitiveDisp), DerivedPrimary: derivedPrimary };
    return { id, sourceId, text: clean(item.text), scale, derivedPrimary, category: categoryMap[derivedPrimary[0]] || 'Other Descriptors', values, outliner: clean(item.outliner), originalPrimaryCode: clean(item.originalPrimaryCode) };
  });
  const usedByAxis: Record<string, Set<string>> = Object.fromEntries(AXIS_ORDER.map((axis) => [axis, new Set<string>()]));
  for (const item of items) for (const axis of AXIS_ORDER) for (const value of item.values[axis] ?? []) usedByAxis[axis].add(value);
  const nodes: SankeyNode[] = []; const nodeIdMap = new Map<string, number>(); const axisItemCounts: Record<string, number> = {};
  for (let column = 0; column < AXIS_ORDER.length; column++) {
    const axis = AXIS_ORDER[column]; const definedOrder = axis === 'DerivedPrimary' ? primaryCodeList.map((entry) => entry.code) : cleanAxisList.filter((entry) => entry.axis === axis).map((entry) => entry.value);
    const orderedValues = [...definedOrder.filter((value) => usedByAxis[axis].has(value))]; for (const value of [...usedByAxis[axis]].sort()) if (!orderedValues.includes(value)) orderedValues.push(value);
    for (const value of orderedValues) {
      const id = nodes.length; const category = axis === 'DerivedPrimary' ? categoryMap[value] || 'Other Descriptors' : null; const subcategory = axis === 'Stimulus' ? stimulusSubcats[value] || 'Missing / Unspecified' : null;
      const color = axis === 'DerivedPrimary' ? CATEGORY_COLORS[category!] || '#A5A5A5' : axis === 'Stimulus' ? STIMULUS_SUBCAT_COLORS[subcategory!] || '#D9D9D9' : '#808080';
      nodes.push({ id, axis, value, column, category, subcategory, color }); nodeIdMap.set(`${axis}::${value}`, id);
    }
    axisItemCounts[axis] = items.filter((item) => (item.values[axis] ?? []).length > 0).length;
  }
  const itemLinks: ItemLink[] = [];
  for (const item of items) {
    let previousValues: string[] | null = null; let previousAxis: string | null = null;
    for (const axis of AXIS_ORDER) {
      const currentValues = item.values[axis] ?? []; if (currentValues.length === 0) continue;
      if (previousAxis && previousValues) for (const sourceValue of previousValues) for (const targetValue of currentValues) {
        const source = nodeIdMap.get(`${previousAxis}::${sourceValue}`); const target = nodeIdMap.get(`${axis}::${targetValue}`); if (source === undefined || target === undefined) continue;
        itemLinks.push({ itemId: item.id, source, target, category: item.category, color: CATEGORY_COLORS[item.category] || '#A5A5A5' });
      }
      previousAxis = axis; previousValues = currentValues;
    }
  }
  const aggregate = new Map<string, number>(); for (const link of itemLinks) { const key = `${link.source}-${link.target}`; aggregate.set(key, (aggregate.get(key) ?? 0) + 1); }
  const links = [...aggregate].map(([key, value]) => { const [source, target] = key.split('-').map(Number); return { source, target, value }; });
  const nodeItems: Record<string, string[]> = {}; for (const node of nodes) nodeItems[String(node.id)] = items.filter((item) => item.values[node.axis]?.includes(node.value)).map((item) => item.id).sort();
  return { nodes, links, itemLinks, nodeItems, items, axisOrder: AXIS_ORDER,
    axisLabels: { Stimulus: 'Stimulus', Process: 'Process', Outcome: 'Outcome &\nAppraised Valence', Response: 'Response', CognitiveDisp: 'Cognitive\nDisposition', DerivedPrimary: 'Primary Code' },
    axisItemCounts, categoryOrder, categoryCodes, categoryColors: CATEGORY_COLORS, stimulusSubcats, stimulusSubcatOrder, stimulusSubcatColors: STIMULUS_SUBCAT_COLORS, axisValueList: cleanAxisList };
}

export function normalizeSankeyData(input: SankeyData): SankeyData {
  const valuesByItem = new Map<string, Record<string, string[]>>();
  for (const item of input.items) valuesByItem.set(item.id, item.values && Object.keys(item.values).length > 0 ? Object.fromEntries(AXIS_ORDER.map((axis) => [axis, [...(item.values[axis] ?? [])]])) : Object.fromEntries(AXIS_ORDER.map((axis) => [axis, []])));
  for (const node of input.nodes) for (const itemId of input.nodeItems[String(node.id)] ?? []) { const values = valuesByItem.get(itemId); if (values && !values[node.axis].includes(node.value)) values[node.axis].push(node.value); }
  const items = input.items.map((item) => ({ ...item, sourceId: item.sourceId || item.id.replace(/__[^_]+$/, ''), values: valuesByItem.get(item.id) ?? {}, outliner: item.outliner || '', originalPrimaryCode: item.originalPrimaryCode || '' }));
  const axisValueList = input.axisValueList?.length ? input.axisValueList : input.nodes.filter((node) => node.axis !== 'DerivedPrimary').map((node) => ({ axis: node.axis as EditorAxisValue['axis'], subcategory: node.subcategory || '', value: node.value }));
  return { ...input, items, axisValueList };
}
