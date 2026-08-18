import * as XLSX from 'xlsx';

export interface EditorItemData {
  id: string;
  text: string;
  scale: string;
  derivedPrimary: string;
  outliner: string;
  /** Axis name → comma-separated values */
  axisValues: Record<string, string>;
}

export interface EditorPrimaryCode {
  category: string;
  code: string;
}

export interface EditorAxisValue {
  axis: string;
  subcategory: string;
  value: string;
}

export interface EditorData {
  items: EditorItemData[];
  primaryCodeList: EditorPrimaryCode[];
  axisValueList: EditorAxisValue[];
  /** Order of axis columns in the Items × Axes sheet */
  axisOrder: string[];
}

/**
 * Extract editable data from SankeyData for the editor
 */
export function extractEditorData(data: {
  items: { id: string; text: string; scale: string; derivedPrimary: string[]; outliner?: string; values: Record<string, string[]> }[];
  categoryCodes: Record<string, string[]>;
  stimulusSubcats: Record<string, string>;
  axisOrder: string[];
  axisSubcats?: Record<string, Record<string, string[]>>;
}): EditorData {
  // Items
  const items: EditorItemData[] = data.items.map((item) => {
    const axisValues: Record<string, string> = {};
    for (const axis of data.axisOrder) {
      if (axis === 'Derived Primary Code') continue;
      const vals = item.values[axis] || [];
      axisValues[axis] = vals.join(', ');
    }
    return {
      id: item.id,
      text: item.text,
      scale: item.scale,
      derivedPrimary: item.derivedPrimary.join(', '),
      outliner: item.outliner || '',
      axisValues,
    };
  });

  // Primary Code List
  const primaryCodeList: EditorPrimaryCode[] = [];
  for (const [cat, codes] of Object.entries(data.categoryCodes)) {
    for (const code of codes) {
      primaryCodeList.push({ category: cat, code });
    }
  }

  // Axis Value List (all axes with subcategories)
  const axisValueList: EditorAxisValue[] = [];
  const subcats = data.axisSubcats || {};
  for (const [axis, subcatMap] of Object.entries(subcats)) {
    for (const [subcat, values] of Object.entries(subcatMap)) {
      for (const val of values) {
        axisValueList.push({ axis, subcategory: subcat, value: val });
      }
    }
  }

  // Axis order (exclude Derived Primary Code, it's not a chart axis)
  const axisOrder = data.axisOrder.filter(a => a !== 'Derived Primary Code');

  return { items, primaryCodeList, axisValueList, axisOrder };
}

/**
 * Build an XLSX.WorkBook from editor data, so it can be passed to parseExcelData
 */
export function buildWorkbookFromEditorData(editor: EditorData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Primary Code List ──
  const pcRows: (string | null)[][] = [['Level', 'Category', 'Primary Code']];
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
  const avRows: (string | null)[][] = [['Axis', 'Subcategory', 'Value']];
  // Group by axis then subcategory
  const axisSubcatMap = new Map<string, Map<string, string[]>>();
  for (const av of editor.axisValueList) {
    if (!axisSubcatMap.has(av.axis)) axisSubcatMap.set(av.axis, new Map());
    const subcatMap = axisSubcatMap.get(av.axis)!;
    if (!subcatMap.has(av.subcategory)) subcatMap.set(av.subcategory, []);
    subcatMap.get(av.subcategory)!.push(av.value);
  }
  for (const [axis, subcatMap] of axisSubcatMap) {
    let first = true;
    for (const [subcat, values] of subcatMap) {
      for (let i = 0; i < values.length; i++) {
        if (first && i === 0) {
          avRows.push([axis, subcat, values[i]]);
          first = false;
        } else if (i === 0) {
          avRows.push([null, subcat, values[i]]);
        } else {
          avRows.push([null, null, values[i]]);
        }
      }
    }
  }
  const avSheet = XLSX.utils.aoa_to_sheet(avRows);
  XLSX.utils.book_append_sheet(wb, avSheet, 'Axis Value List');

  // ── Sheet 3: Items × Axes ──
  // Build header: fixed columns + axis columns
  const axisCols = editor.axisOrder.filter(a => a !== 'Derived Primary Code');
  const headerRow = ['Row', 'Scale', 'Item ID', 'Item Text', 'Derived Primary Code', 'Outliner', ...axisCols, 'Original Primary Code'];
  const itemsRows: (string | null)[][] = [headerRow];

  for (let i = 0; i < editor.items.length; i++) {
    const item = editor.items[i];
    const row: (string | null)[] = [
      String(i + 1),
      item.scale,
      item.id,
      item.text,
      item.derivedPrimary,
      item.outliner || '',
    ];
    for (const axis of axisCols) {
      row.push(item.axisValues[axis] || '');
    }
    row.push(''); // Original Primary Code
    itemsRows.push(row);
  }
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsRows);
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items × Axes');

  return wb;
}