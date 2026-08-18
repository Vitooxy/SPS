import * as XLSX from 'xlsx';

export interface EditorItemData {
  id: string;
  text: string;
  scale: string;
  derivedPrimary: string;
  stimulus: string;
  process: string;
  outcome: string;
  response: string;
  cognitiveDisp: string;
}

export interface EditorPrimaryCode {
  category: string;
  code: string;
}

export interface EditorAxisValue {
  subcategory: string;
  value: string;
}

export interface EditorData {
  items: EditorItemData[];
  primaryCodeList: EditorPrimaryCode[];
  axisValueList: EditorAxisValue[];
}

/**
 * Extract editable data from SankeyData for the editor
 */
export function extractEditorData(data: {
  items: { id: string; text: string; scale: string; derivedPrimary: string[]; values: Record<string, string[]> }[];
  categoryCodes: Record<string, string[]>;
  stimulusSubcats: Record<string, string>;
}): EditorData {
  // Items
  const items: EditorItemData[] = data.items.map((item) => ({
    id: item.id,
    text: item.text,
    scale: item.scale,
    derivedPrimary: item.derivedPrimary.join(', '),
    stimulus: (item.values['Stimulus'] || []).join(', '),
    process: (item.values['Process'] || []).join(', '),
    outcome: (item.values['Outcome'] || []).join(', '),
    response: (item.values['Response'] || []).join(', '),
    cognitiveDisp: (item.values['CognitiveDisp'] || []).join(', '),
  }));

  // Primary Code List
  const primaryCodeList: EditorPrimaryCode[] = [];
  for (const [cat, codes] of Object.entries(data.categoryCodes)) {
    for (const code of codes) {
      primaryCodeList.push({ category: cat, code });
    }
  }

  // Axis Value List (Stimulus)
  const axisValueList: EditorAxisValue[] = [];
  for (const [value, subcat] of Object.entries(data.stimulusSubcats)) {
    axisValueList.push({ subcategory: subcat, value });
  }

  return { items, primaryCodeList, axisValueList };
}

/**
 * Build an XLSX.WorkBook from editor data, so it can be passed to parseExcelData
 */
export function buildWorkbookFromEditorData(editor: EditorData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Primary Code List ──
  const pcRows: (string | null)[][] = [['Level', 'Category', 'Primary Code']];
  // Group by category
  const catMap = new Map<string, string[]>();
  for (const pc of editor.primaryCodeList) {
    if (!catMap.has(pc.category)) catMap.set(pc.category, []);
    catMap.get(pc.category)!.push(pc.code);
  }
  let level = 1;
  for (const [cat, codes] of catMap) {
    for (let i = 0; i < codes.length; i++) {
      if (i === 0) {
        pcRows.push([String(level), cat, codes[i]]);
      } else {
        pcRows.push([null, null, codes[i]]);
      }
    }
    level++;
  }
  const pcSheet = XLSX.utils.aoa_to_sheet(pcRows);
  XLSX.utils.book_append_sheet(wb, pcSheet, 'Primary Code List');

  // ── Sheet 2: Axis Value List ──
  const avRows: (string | null)[][] = [
    ['Axis', 'Subcategory', 'Value'],
    [null, null, null],
    ['Stimulus (Modality and Configuration)', null, null],
  ];
  const subcatMap = new Map<string, string[]>();
  for (const av of editor.axisValueList) {
    if (!subcatMap.has(av.subcategory)) subcatMap.set(av.subcategory, []);
    subcatMap.get(av.subcategory)!.push(av.value);
  }
  for (const [subcat, values] of subcatMap) {
    avRows.push([null, subcat, null]);
    for (const val of values) {
      avRows.push([null, null, val]);
    }
  }
  const avSheet = XLSX.utils.aoa_to_sheet(avRows);
  XLSX.utils.book_append_sheet(wb, avSheet, 'Axis Value List');

  // ── Sheet 3: Items × 6 Axes ──
  const itemsRows: (string | null)[][] = [
    ['Row', 'Scale', 'Item ID', 'Item Text', 'Derived Primary Code', 'Outliner', 'Modality', 'Configuration', 'Process', 'Outcome', 'Response', 'Cognitive Disposition'],
  ];
  for (let i = 0; i < editor.items.length; i++) {
    const item = editor.items[i];
    itemsRows.push([
      String(i + 1),
      item.scale,
      item.id,
      item.text,
      item.derivedPrimary,
      '',  // Outliner
      item.stimulus,
      '',
      item.process,
      item.outcome,
      item.response,
      item.cognitiveDisp,
    ]);
  }
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsRows);
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items × 6 Axes');

  return wb;
}