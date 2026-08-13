import * as XLSX from 'xlsx';

export interface SankeyNode {
  id: number;
  axis: string;
  value: string;
  column: number;
  category: string | null;
  subcategory: string | null;
  color: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface ItemLink {
  itemId: string;
  source: number;
  target: number;
  category: string;
  color: string;
}

export interface SankeyItem {
  id: string;
  text: string;
  scale: string;
  derivedPrimary: string[];
  category: string;
  values: Record<string, string[]>;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  itemLinks: ItemLink[];
  nodeItems: Record<string, string[]>;
  items: SankeyItem[];
  axisOrder: string[];
  axisLabels: Record<string, string>;
  axisItemCounts: Record<string, number>;
  categoryOrder: string[];
  categoryColors: Record<string, string>;
  stimulusSubcats: Record<string, string>;
  stimulusSubcatOrder: string[];
  stimulusSubcatColors: Record<string, string>;
}

const EXCLUDE_VALUES = new Set([
  'Modality', 'Configuration', 'Process', 'Response', 'Cognitive Disposition',
  'Outcome and Appraised Valence', 'Stimulus (Modality and Configuration)',
  'Derived', 'Outliner', 'nan', 'Stimulus', '-', '', 'NaN'
]);

const CATEGORY_COLORS: Record<string, string> = {
  'Overload': '#C55A11',
  'Aversion': '#ED7D31',
  'Coping': '#FFC000',
  'Perceptual Sensitivity': '#4472C4',
  'Affective and Aesthetic': '#7030A0',
  'Social Cognition and Empathy': '#00B050',
  'Cognitive Processing': '#00B0F0',
  'Other Descriptors': '#A5A5A5',
};

const STIMULUS_SUBCAT_COLORS: Record<string, string> = {
  'Physical': '#4472C4',
  'Internal': '#70AD47',
  'Social': '#ED7D31',
  'Demand': '#A5A5A5',
  'Configuration': '#FFC000',
  'Missing / Unspecified': '#D9D9D9',
};

function parseValues(val: unknown): string[] {
  const s = String(val ?? '').trim();
  if (!s || s === '-' || s === '' || s === 'nan' || s === 'NaN') return [];
  return s.split(',').map(v => v.trim()).filter(v => !EXCLUDE_VALUES.has(v) && v !== '');
}

function trimCell(val: unknown): string {
  return String(val ?? '').trim();
}

export function parseExcelData(file: ArrayBuffer | XLSX.WorkBook): SankeyData {
  const workbook = file instanceof ArrayBuffer ? XLSX.read(file, { type: 'array' }) : file;

  // ── Parse Primary Code List ──
  const pcSheet = workbook.Sheets['Primary Code List'];
  const pcRaw: (string | null)[][] = XLSX.utils.sheet_to_json(pcSheet, { header: 1, defval: null });
  const categoryOrder: string[] = [];
  const categoryCodes: Record<string, string[]> = {};
  let currentCategory: string | null = null;
  for (let i = 1; i < pcRaw.length; i++) {
    const row = pcRaw[i];
    if (!row) continue;
    const level = trimCell(row[0]);
    const cat = trimCell(row[1]);
    const code = trimCell(row[2]);
    if (code && code !== 'Primary Code') {
      if (cat && cat !== '') {
        currentCategory = cat;
        if (!categoryCodes[currentCategory]) {
          categoryOrder.push(currentCategory);
          categoryCodes[currentCategory] = [];
        }
      }
      if (currentCategory && code) {
        categoryCodes[currentCategory].push(code);
      }
    }
  }

  // Build category map
  const categoryMap: Record<string, string> = {};
  for (const [cat, codes] of Object.entries(categoryCodes)) {
    for (const code of codes) {
      categoryMap[code] = cat;
    }
  }

  // ── Parse Axis Value List ──
  const avSheet = workbook.Sheets['Axis Value List'];
  const avRaw: (string | null)[][] = XLSX.utils.sheet_to_json(avSheet, { header: 1, defval: null });
  const stimulusOrder: [string, string][] = [];
  let currentSubcat: string | null = null;
  let inStimulus = false;
  for (let i = 2; i < avRaw.length; i++) {
    const row = avRaw[i];
    if (!row) continue;
    const axis = trimCell(row[0]);
    const subcat = trimCell(row[1]);
    const value = trimCell(row[2]);
    if (axis && axis.includes('Stimulus')) {
      inStimulus = true;
    } else if (inStimulus && axis && !axis.includes('Stimulus')) {
      inStimulus = false;
      continue;
    }
    if (!inStimulus || !value || value === '') continue;
    if (subcat && subcat !== '') currentSubcat = subcat;
    if (currentSubcat && value) stimulusOrder.push([currentSubcat, value]);
  }

  const stimulusSubcats: Record<string, string> = {};
  for (const [subcat, val] of stimulusOrder) stimulusSubcats[val] = subcat;
  const stimulusSubcatOrder = [...new Set(stimulusOrder.map(([s]) => s))];

  // ── Parse Items × 6 Axes ──
  const itemsSheet = workbook.Sheets['Items × 6 Axes'];
  const itemsRaw: (string | null)[][] = XLSX.utils.sheet_to_json(itemsSheet, { header: 1, defval: null });

  // Find data start
  let dataStart = -1;
  for (let i = 0; i < itemsRaw.length; i++) {
    if (trimCell(itemsRaw[i]?.[0]) === 'Row') {
      dataStart = i + 1;
      break;
    }
  }

  // Parse items
  const itemRows: any[] = [];
  for (let i = dataStart; i < itemsRaw.length; i++) {
    const row = itemsRaw[i];
    if (!row) continue;
    const itemId = trimCell(row[2]);
    if (!itemId || itemId === '' || itemId === 'Item ID') continue;
    itemRows.push({
      scale: trimCell(row[1]),
      itemId: itemId,
      itemText: trimCell(row[3]),
      derivedPrimary: trimCell(row[4]),
      outliner: trimCell(row[5]),
      modality: trimCell(row[6]),
      configuration: trimCell(row[7]),
      process: trimCell(row[8]),
      outcome: trimCell(row[9]),
      response: trimCell(row[10]),
      cognitiveDisp: trimCell(row[11]),
    });
  }

  // Handle duplicate IDs
  const idCounts: Record<string, number> = {};
  for (const row of itemRows) {
    idCounts[row.itemId] = (idCounts[row.itemId] || 0) + 1;
  }
  const dupIds = new Set(Object.entries(idCounts).filter(([_, c]) => c > 1).map(([id]) => id));

  function makeUniqueId(row: any): string {
    if (dupIds.has(row.itemId)) {
      return `${row.itemId}__${row.scale.replace(/\s/g, '')}`;
    }
    return row.itemId;
  }

  // Axis order
  const axisOrder = ['Stimulus', 'Process', 'Outcome', 'Response', 'CognitiveDisp', 'DerivedPrimary'];

  // Collect all axis values
  const axisValues: Record<string, Set<string>> = { Stimulus: new Set(), Process: new Set(), Outcome: new Set(), Response: new Set(), CognitiveDisp: new Set(), DerivedPrimary: new Set() };
  const items: SankeyItem[] = [];

  for (const row of itemRows) {
    const uid = makeUniqueId(row);
    const dpStr = row.derivedPrimary;
    const dpVals = dpStr ? dpStr.split('/').map((v: string) => v.trim()).filter((v: string) => v && !EXCLUDE_VALUES.has(v)) : [];

    const stimulusVals = [...parseValues(row.modality), ...parseValues(row.configuration)];
    for (const v of stimulusVals) axisValues.Stimulus.add(v);
    for (const v of parseValues(row.process)) axisValues.Process.add(v);
    for (const v of parseValues(row.outcome)) axisValues.Outcome.add(v);
    for (const v of parseValues(row.response)) axisValues.Response.add(v);
    for (const v of parseValues(row.cognitiveDisp)) axisValues.CognitiveDisp.add(v);
    for (const v of dpVals) axisValues.DerivedPrimary.add(v);

    const category = dpVals.length > 0 ? (categoryMap[dpVals[0]] || 'Other Descriptors') : 'Other Descriptors';

    items.push({
      id: uid,
      text: row.itemText,
      scale: row.scale,
      derivedPrimary: dpVals,
      category,
      values: {
        Stimulus: stimulusVals,
        Process: parseValues(row.process),
        Outcome: parseValues(row.outcome),
        Response: parseValues(row.response),
        CognitiveDisp: parseValues(row.cognitiveDisp),
        DerivedPrimary: dpVals,
      },
    });
  }

  // ── Build nodes with proper ordering ──
  const nodes: SankeyNode[] = [];
  const nodeIdMap: Record<string, number> = {};
  const axisItemCounts: Record<string, number> = {};

  for (let colIdx = 0; colIdx < axisOrder.length; colIdx++) {
    const axis = axisOrder[colIdx];
    let orderedVals: string[];

    if (axis === 'DerivedPrimary') {
      orderedVals = [];
      for (const cat of categoryOrder) {
        for (const code of categoryCodes[cat]) {
          if (axisValues[axis].has(code)) orderedVals.push(code);
        }
      }
      for (const val of [...axisValues[axis]].sort()) {
        if (!orderedVals.includes(val)) orderedVals.push(val);
      }
    } else if (axis === 'Stimulus') {
      orderedVals = [];
      for (const [, val] of stimulusOrder) {
        if (axisValues[axis].has(val)) orderedVals.push(val);
      }
      for (const val of [...axisValues[axis]].sort()) {
        if (!orderedVals.includes(val)) orderedVals.push(val);
      }
    } else {
      orderedVals = [...axisValues[axis]].sort();
    }

    for (const val of orderedVals) {
      const nodeKey = `${axis}::${val}`;
      const nodeId = nodes.length;
      nodeIdMap[nodeKey] = nodeId;

      let color = '#808080';
      if (axis === 'Stimulus') {
        const subcat = stimulusSubcats[val] || 'Missing / Unspecified';
        color = STIMULUS_SUBCAT_COLORS[subcat] || '#D9D9D9';
      } else if (axis === 'DerivedPrimary') {
        const cat = categoryMap[val] || 'Other Descriptors';
        color = CATEGORY_COLORS[cat] || '#A5A5A5';
      }

      nodes.push({
        id: nodeId,
        axis,
        value: val,
        column: colIdx,
        category: axis === 'DerivedPrimary' ? (categoryMap[val] || null) : null,
        subcategory: axis === 'Stimulus' ? (stimulusSubcats[val] || null) : null,
        color,
      });
    }

    // Count items with values on this axis
    let count = 0;
    for (const row of itemRows) {
      const uid = makeUniqueId(row);
      if (axis === 'Stimulus') {
        const sv = [...parseValues(row.modality), ...parseValues(row.configuration)];
        if (sv.length > 0) count++;
      } else if (axis === 'DerivedPrimary') {
        const dp = row.derivedPrimary;
        const dv = dp ? dp.split('/').map((v: string) => v.trim()).filter((v: string) => v && !EXCLUDE_VALUES.has(v)) : [];
        if (dv.length > 0) count++;
      } else {
        const colMap: Record<string, string> = { 'Process': 'process', 'Outcome': 'outcome', 'Response': 'response', 'CognitiveDisp': 'cognitiveDisp' };
        const v = parseValues(row[colMap[axis]]);
        if (v.length > 0) count++;
      }
    }
    axisItemCounts[axis] = count;
  }

  // ── Build per-item links ──
  const itemLinks: ItemLink[] = [];
  for (const item of items) {
    const itemRow = itemRows.find(r => makeUniqueId(r) === item.id);
    if (!itemRow) continue;

    const axisVals: Record<string, string[]> = {
      Stimulus: [...parseValues(itemRow.modality), ...parseValues(itemRow.configuration)],
      Process: parseValues(itemRow.process),
      Outcome: parseValues(itemRow.outcome),
      Response: parseValues(itemRow.response),
      CognitiveDisp: parseValues(itemRow.cognitiveDisp),
      DerivedPrimary: item.derivedPrimary,
    };

    let prevAxis: string | null = null;
    let prevVals: string[] | null = null;

    for (const axis of axisOrder) {
      const currVals = axisVals[axis];
      if (!currVals || currVals.length === 0) continue;

      if (prevAxis !== null && prevVals && prevVals.length > 0) {
        for (const pv of prevVals) {
          for (const cv of currVals) {
            const sk = `${prevAxis}::${pv}`;
            const tk = `${axis}::${cv}`;
            if (sk in nodeIdMap && tk in nodeIdMap) {
              itemLinks.push({
                itemId: item.id,
                source: nodeIdMap[sk],
                target: nodeIdMap[tk],
                category: item.category,
                color: CATEGORY_COLORS[item.category] || '#A5A5A5',
              });
            }
          }
        }
      }
      prevAxis = axis;
      prevVals = currVals;
    }
  }

  // ── Aggregated links ──
  const linksMap = new Map<string, number>();
  for (const il of itemLinks) {
    const key = `${il.source}-${il.target}`;
    linksMap.set(key, (linksMap.get(key) || 0) + 1);
  }
  const links: SankeyLink[] = [];
  for (const [key, value] of linksMap) {
    const [s, t] = key.split('-').map(Number);
    links.push({ source: s, target: t, value });
  }

  // ── Node items ──
  const nodeItems: Record<string, string[]> = {};
  for (const node of nodes) {
    const ids: string[] = [];
    for (const item of items) {
      const itemRow = itemRows.find(r => makeUniqueId(r) === item.id);
      if (!itemRow) continue;
      const axisVals: Record<string, string[]> = {
        Stimulus: [...parseValues(itemRow.modality), ...parseValues(itemRow.configuration)],
        Process: parseValues(itemRow.process),
        Outcome: parseValues(itemRow.outcome),
        Response: parseValues(itemRow.response),
        CognitiveDisp: parseValues(itemRow.cognitiveDisp),
        DerivedPrimary: item.derivedPrimary,
      };
      const vals = axisVals[node.axis] || [];
      if (vals.includes(node.value)) ids.push(item.id);
    }
    nodeItems[String(node.id)] = ids.sort();
  }

  return {
    nodes,
    links,
    itemLinks,
    nodeItems,
    items,
    axisOrder,
    axisLabels: {
      Stimulus: 'Stimulus',
      Process: 'Process',
      Outcome: 'Outcome &\nAppraised Valence',
      Response: 'Response',
      CognitiveDisp: 'Cognitive\nDisposition',
      DerivedPrimary: 'Primary Code',
    },
    axisItemCounts,
    categoryOrder,
    categoryColors: CATEGORY_COLORS,
    stimulusSubcats,
    stimulusSubcatOrder,
    stimulusSubcatColors: STIMULUS_SUBCAT_COLORS,
  };
}