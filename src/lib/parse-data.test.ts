import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { buildSankeyDataFromEditor, DataContractError, parseExcelData } from './parse-data';
import { buildWorkbookFromEditorData, type EditorData } from './build-workbook';

function makeWorkbook(stimulus = 'Visual'): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Level', 'Category', 'Primary Code'],
    ['Derived Primary Code', 'Overload', 'Visual Overload'],
  ]), 'Primary Code List');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Axis', 'Subcategory', 'Value'],
    ['Stimulus Input', 'Physical', 'Visual'],
    ['Process', '', 'Detection'],
    ['Outcome and Appraised Valence', '', 'ER_Negative'],
    ['Response', '', 'Withdraw'],
    ['Cognitive Disposition', '', 'Deep Thought'],
  ]), 'Axis Value List');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Row', 'Scale', 'Item ID', 'Item Text', 'Derived Primary Code', 'Outliner', 'Stimulus Input', 'Process', 'Outcome and Appraised Valence', 'Response', 'Cognitive Disposition', 'Original Primary Code'],
    [1, 'TEST', 'ITEM_1', 'Example item', 'Visual Overload', '', stimulus, 'Detection', 'ER_Negative', 'Withdraw', 'Deep Thought', 'Original label'],
  ]), 'Items × 5 Axes');
  return workbook;
}

test('parses the V3.14 five-axis workbook contract', () => {
  const data = parseExcelData(makeWorkbook());
  assert.equal(data.items.length, 1);
  assert.deepEqual(data.items[0].values.Stimulus, ['Visual']);
  assert.deepEqual(data.items[0].values.Process, ['Detection']);
  assert.equal(data.nodes.length, 6);
  assert.equal(data.itemLinks.length, 5);
  assert.deepEqual(data.categoryCodes.Overload, ['Visual Overload']);
});

test('fails fast when an item uses an undeclared axis value', () => {
  assert.throws(() => parseExcelData(makeWorkbook('Auditory')), (error) => {
    assert.ok(error instanceof DataContractError);
    assert.match(error.message, /Auditory.*Axis Value List/);
    return true;
  });
});

test('editing the shared model rebuilds nodes, links and item mapping together', () => {
  const editor: EditorData = {
    items: [{
      id: 'ITEM_1', sourceId: 'ITEM_1', scale: 'TEST', text: 'Example item', derivedPrimary: 'Visual Overload',
      stimulus: 'Auditory', process: 'Detection', outcome: 'ER_Negative', response: 'Withdraw', cognitiveDisp: 'Deep Thought',
      outliner: '', originalPrimaryCode: 'Original label',
    }],
    primaryCodeList: [{ category: 'Overload', code: 'Visual Overload' }],
    axisValueList: [
      { axis: 'Stimulus', subcategory: 'Physical', value: 'Auditory' },
      { axis: 'Process', subcategory: '', value: 'Detection' },
      { axis: 'Outcome', subcategory: '', value: 'ER_Negative' },
      { axis: 'Response', subcategory: '', value: 'Withdraw' },
      { axis: 'CognitiveDisp', subcategory: '', value: 'Deep Thought' },
    ],
  };
  const data = buildSankeyDataFromEditor(editor);
  const auditory = data.nodes.find(node => node.axis === 'Stimulus' && node.value === 'Auditory');
  assert.ok(auditory);
  assert.deepEqual(data.nodeItems[String(auditory.id)], ['ITEM_1']);
  assert.equal(data.itemLinks.length, 5);

  const roundTrip = parseExcelData(buildWorkbookFromEditorData(editor));
  assert.deepEqual(roundTrip.items[0].values, data.items[0].values);
  assert.equal(roundTrip.items[0].originalPrimaryCode, 'Original label');
});

test('editor validation rejects duplicate definitions and uncoded items', () => {
  const workbook = makeWorkbook();
  const parsed = parseExcelData(workbook);
  const editor: EditorData = {
    items: [{
      id: parsed.items[0].id,
      sourceId: parsed.items[0].sourceId,
      scale: parsed.items[0].scale,
      text: parsed.items[0].text,
      derivedPrimary: '',
      stimulus: 'Visual',
      process: 'Detection',
      outcome: 'ER_Negative',
      response: 'Withdraw',
      cognitiveDisp: 'Deep Thought',
      outliner: '',
      originalPrimaryCode: '',
    }],
    primaryCodeList: [
      { category: 'Overload', code: 'Visual Overload' },
      { category: 'Overload', code: 'Visual Overload' },
    ],
    axisValueList: [
      ...parsed.axisValueList,
      { axis: 'Stimulus', subcategory: 'Physical', value: 'Visual' },
    ],
  };

  assert.throws(() => buildSankeyDataFromEditor(editor), (error) => {
    assert.ok(error instanceof DataContractError);
    assert.match(error.message, /Primary Code.*重复/);
    assert.match(error.message, /Stimulus.*Visual.*重复/);
    assert.match(error.message, /缺少 Derived Primary Code/);
    return true;
  });
});
