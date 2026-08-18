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
  categoryCodes: Record<string, string[]>;
  categoryColors: Record<string, string>;
  stimulusSubcats: Record<string, string>;
  stimulusSubcatOrder: string[];
  stimulusSubcatColors: Record<string, string>;
  /** All axes' subcategory mappings from Axis Value List (not just Stimulus) */
  axisSubcats: Record<string, Record<string, string[]>>;
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

/** Clean an axis name for display in the chart */
function cleanAxisLabel(name: string): string {
  const map: Record<string, string> = {
    'Stimulus Input': 'Stimulus',
    'Outcome and Appraised Valence': 'Outcome &\nAppraised Valence',
    'Cognitive Disposition': 'Cognitive\nDisposition',
    'Derived Primary Code': 'Primary Code',
  };
  return map[name] || name;
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

  // ── Parse Axis Value List — extract all axes' values ──
  const avSheet = workbook.Sheets['Axis Value List'];
  const avRaw: (string | null)[][] = XLSX.utils.sheet_to_json(avSheet, { header: 1, defval: null });
  
  // Parse ALL axes from Axis Value List, not just Stimulus
  const axisSubcats: Record<string, Record<string, string[]>> = {}; // axisName -> { subcategory: [values] }
  let currentAxis: string | null = null;
  let currentSubcat: string | null = null;
  
  for (let i = 2; i < avRaw.length; i++) {
    const row = avRaw[i];
    if (!row) continue;
    const axis = trimCell(row[0]);
    const subcat = trimCell(row[1]);
    const value = trimCell(row[2]);
    
    if (axis && axis !== '') {
      currentAxis = axis;
      if (!axisSubcats[currentAxis]) {
        axisSubcats[currentAxis] = {};
      }
      currentSubcat = null;
    }
    if (!currentAxis || !value || value === '') continue;
    
    if (subcat && subcat !== '') currentSubcat = subcat;
    
    const subcatKey = currentSubcat || currentAxis; // Use axis name as fallback subcategory
    if (!axisSubcats[currentAxis][subcatKey]) {
      axisSubcats[currentAxis][subcatKey] = [];
    }
    axisSubcats[currentAxis][subcatKey].push(value);
  }

  // Build stimulus-specific mappings (for backwards compatibility)
  const stimulusSubcats: Record<string, string> = {};
  const stimulusSubcatOrder: string[] = [];
  const stimulusData = axisSubcats['Stimulus Input'] || {};
  for (const [subcat, values] of Object.entries(stimulusData)) {
    if (!stimulusSubcatOrder.includes(subcat)) stimulusSubcatOrder.push(subcat);
    for (const val of values) {
      stimulusSubcats[val] = subcat;
    }
  }

  // ── Parse Items × Axes (auto-detect sheet name) ──
  const itemsSheetName = workbook.Sheets['Items × Axes'] ? 'Items × Axes' : 'Items × 6 Axes';
  const itemsSheet = workbook.Sheets[itemsSheetName];
  const itemsRaw: (string | null)[][] = XLSX.utils.sheet_to_json(itemsSheet, { header: 1, defval: null });

  // Find data start
  let dataStart = -1;
  for (let i = 0; i < itemsRaw.length; i++) {
    if (trimCell(itemsRaw[i]?.[0]) === 'Row') {
      dataStart = i + 1;
      break;
    }
  }

  // ── Auto-detect column layout from header row ──
  const headerRow = itemsRaw[dataStart - 1] || [];
  const headers = headerRow.map((h: unknown) => trimCell(h));

  // Also check the row above for "Derived" and "Outliner" (new format has them there)
  const subHeaderRow = dataStart >= 2 ? (itemsRaw[dataStart - 2] || []).map((h: unknown) => trimCell(h)) : [];

  // Find fixed column indices by header name
  const findCol = (names: string[]): number => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
      const j = subHeaderRow.indexOf(n);
      if (j >= 0) return j;
    }
    return -1;
  };
  const fixedCols = {
    row: headers.indexOf('Row'),
    scale: headers.indexOf('Scale'),
    itemId: findCol(['Item ID', 'ItemID']),
    itemText: findCol(['Item Text', 'ItemText']),
    derived: findCol(['Derived Primary Code', 'DerivedPrimary', 'Derived']),
    outliner: findCol(['Outliner']),
  };

  // Detect axis columns: everything between the last fixed column and 'Original Primary Code'
  const lastFixedCol = Math.max(...Object.values(fixedCols).filter(i => i >= 0));
  const origPcCol = findCol(['Original Primary Code', 'Original']);
  const endCol = origPcCol >= 0 ? origPcCol : headers.length;

  // Detect if old format (Modality + Configuration) or new format (single Stimulus Input)
  const modalityCol = headers.indexOf('Modality');
  const configCol = headers.indexOf('Configuration');
  const isOldFormat = modalityCol >= 0 && configCol >= 0;

  // Build axis column definitions
  interface AxisColDef {
    name: string;      // Display/header name (e.g. 'Stimulus Input')
    colIdx: number;    // Column index in the raw data
    isMulti: boolean;  // Whether this axis can have multiple values (comma-separated)
  }

  const axisCols: AxisColDef[] = [];
  if (isOldFormat) {
    // Old format: merge Modality + Configuration into 'Stimulus Input'
    axisCols.push({ name: 'Stimulus Input', colIdx: modalityCol, isMulti: true });
    // Skip Configuration (already merged), then add remaining axis columns
    for (let i = configCol + 1; i < endCol; i++) {
      const h = headers[i];
      if (h && h !== '' && h !== 'Original Primary Code') {
        axisCols.push({ name: h, colIdx: i, isMulti: true });
      }
    }
  } else {
    // New format: each header is an axis column
    for (let i = lastFixedCol + 1; i < endCol; i++) {
      const h = headers[i];
      if (h && h !== '' && h !== 'Original Primary Code') {
        axisCols.push({ name: h, colIdx: i, isMulti: true });
      }
    }
  }

  // Build axis order: all axis columns + DerivedPrimary (always last)
  const axisOrder = [...axisCols.map(c => c.name), 'Derived Primary Code'];

  // ── Parse items ──
  const itemRows: any[] = [];
  for (let i = dataStart; i < itemsRaw.length; i++) {
    const row = itemsRaw[i];
    if (!row) continue;
    const itemId = trimCell(row[fixedCols.itemId]);
    if (!itemId || itemId === '' || itemId === 'Item ID' || itemId === 'ItemID') continue;
    
    const itemRow: any = {
      scale: trimCell(row[fixedCols.scale]),
      itemId: itemId,
      itemText: trimCell(row[fixedCols.itemText]),
      derivedPrimary: trimCell(row[fixedCols.derived]),
      outliner: trimCell(row[fixedCols.outliner]),
    };
    
    // Extract axis values dynamically
    for (const axisDef of axisCols) {
      if (isOldFormat && axisDef.name === 'Stimulus Input') {
        // Merge Modality + Configuration values
        const modalityVal = trimCell(row[modalityCol]);
        const configVal = trimCell(row[configCol]);
        itemRow['Stimulus Input'] = [modalityVal, configVal].filter(v => v && v !== '-').join(',');
      } else {
        itemRow[axisDef.name] = trimCell(row[axisDef.colIdx]);
      }
    }
    
    itemRows.push(itemRow);
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

  // Collect all axis values and build items
  const axisValues: Record<string, Set<string>> = {};
  for (const axis of axisOrder) axisValues[axis] = new Set();
  
  const items: SankeyItem[] = [];

  for (const row of itemRows) {
    const uid = makeUniqueId(row);
    const dpStr = row.derivedPrimary;
    const dpVals = dpStr ? dpStr.split('/').map((v: string) => v.trim()).filter((v: string) => v && !EXCLUDE_VALUES.has(v)) : [];
    for (const v of dpVals) axisValues['Derived Primary Code'].add(v);

    const itemValues: Record<string, string[]> = {};
    for (const axisDef of axisCols) {
      const rawVal = row[axisDef.name];
      let vals: string[];
      if (isOldFormat && axisDef.name === 'Stimulus Input') {
        // Already merged as comma-separated string
        vals = parseValues(rawVal);
      } else {
        vals = parseValues(rawVal);
      }
      itemValues[axisDef.name] = vals;
      for (const v of vals) axisValues[axisDef.name].add(v);
    }
    itemValues['Derived Primary Code'] = dpVals;

    const category = dpVals.length > 0 ? (categoryMap[dpVals[0]] || 'Other Descriptors') : 'Other Descriptors';

    items.push({
      id: uid,
      text: row.itemText,
      scale: row.scale,
      derivedPrimary: dpVals,
      category,
      values: itemValues,
    });
  }

  // ── Build nodes with proper ordering ──
  const nodes: SankeyNode[] = [];
  const nodeIdMap: Record<string, number> = {};
  const axisItemCounts: Record<string, number> = {};
  const axisLabels: Record<string, string> = {};

  for (let colIdx = 0; colIdx < axisOrder.length; colIdx++) {
    const axis = axisOrder[colIdx];
    axisLabels[axis] = cleanAxisLabel(axis);
    
    let orderedVals: string[];

    if (axis === 'Derived Primary Code') {
      // Order by category order from Primary Code List
      orderedVals = [];
      for (const cat of categoryOrder) {
        for (const code of categoryCodes[cat]) {
          if (axisValues[axis].has(code)) orderedVals.push(code);
        }
      }
      for (const val of [...axisValues[axis]].sort()) {
        if (!orderedVals.includes(val)) orderedVals.push(val);
      }
    } else if (axis === 'Stimulus Input') {
      // Order by Axis Value List order
      orderedVals = [];
      for (const [, values] of Object.entries(stimulusData)) {
        for (const val of values) {
          if (axisValues[axis].has(val)) orderedVals.push(val);
        }
      }
      for (const val of [...axisValues[axis]].sort()) {
        if (!orderedVals.includes(val)) orderedVals.push(val);
      }
    } else {
      // Order by Axis Value List if available, otherwise alphabetically
      const axisData = axisSubcats[axis];
      orderedVals = [];
      if (axisData) {
        for (const [, values] of Object.entries(axisData)) {
          for (const val of values) {
            if (axisValues[axis].has(val)) orderedVals.push(val);
          }
        }
      }
      for (const val of [...axisValues[axis]].sort()) {
        if (!orderedVals.includes(val)) orderedVals.push(val);
      }
    }

    for (const val of orderedVals) {
      const nodeKey = `${axis}::${val}`;
      const nodeId = nodes.length;
      nodeIdMap[nodeKey] = nodeId;

      let color = '#808080';
      let category: string | null = null;
      let subcategory: string | null = null;

      if (axis === 'Stimulus Input') {
        subcategory = stimulusSubcats[val] || 'Missing / Unspecified';
        color = STIMULUS_SUBCAT_COLORS[subcategory] || '#D9D9D9';
      } else if (axis === 'Derived Primary Code') {
        category = categoryMap[val] || 'Other Descriptors';
        color = CATEGORY_COLORS[category] || '#A5A5A5';
      }
      // Other axes: use default gray color (can be customized later)

      nodes.push({
        id: nodeId,
        axis,
        value: val,
        column: colIdx,
        category,
        subcategory,
        color,
      });
    }

    // Count items with values on this axis
    let count = 0;
    for (const item of items) {
      const vals = item.values[axis] || [];
      if (vals.length > 0) count++;
    }
    axisItemCounts[axis] = count;
  }

  // ── Build per-item links ──
  const itemLinks: ItemLink[] = [];
  for (const item of items) {
    let prevAxis: string | null = null;
    let prevVals: string[] | null = null;

    for (const axis of axisOrder) {
      const currVals = item.values[axis] || [];
      if (currVals.length === 0) continue;

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
      const vals = item.values[node.axis] || [];
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
    axisLabels,
    axisItemCounts,
    categoryOrder,
    categoryCodes,
    categoryColors: CATEGORY_COLORS,
    stimulusSubcats,
    stimulusSubcatOrder,
    stimulusSubcatColors: STIMULUS_SUBCAT_COLORS,
    axisSubcats,
  };
}