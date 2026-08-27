import assert from 'node:assert/strict';
import test from 'node:test';
import type { EditorData } from './build-workbook';
import { buildSankeyDataFromEditor } from './parse-data';
import { buildPrimaryCodeMatrixCounts } from './primary-code-matrix';

test('Other Descriptors count matching Outliner annotations without double counting', () => {
  const editor: EditorData = {
    items: [
      {
        id: 'ITEM_1', sourceId: 'ITEM_1', scale: 'TEST', text: 'Conscientious item',
        derivedPrimary: 'Conscientious', stimulus: 'Visual', process: 'Detection', outcome: 'ER_Negative',
        response: 'Preventive Behavior', cognitiveDisp: 'Deep Thought', outliner: 'Conscientious', originalPrimaryCode: '',
      },
      {
        id: 'ITEM_2', sourceId: 'ITEM_2', scale: 'TEST', text: 'Comparative item',
        derivedPrimary: 'General Overload', stimulus: 'Visual', process: 'Detection', outcome: 'ER_Negative',
        response: 'Preventive Behavior', cognitiveDisp: 'Deep Thought', outliner: 'Comparative', originalPrimaryCode: '',
      },
    ],
    primaryCodeList: [
      { category: 'Overload', code: 'General Overload' },
      { category: 'Other Descriptors', code: 'Conscientious' },
      { category: 'Other Descriptors', code: 'Comparative' },
    ],
    axisValueList: [
      { axis: 'Stimulus', subcategory: 'Physical', value: 'Visual' },
      { axis: 'Process', subcategory: '', value: 'Detection' },
      { axis: 'Outcome', subcategory: '', value: 'ER_Negative' },
      { axis: 'Response', subcategory: '', value: 'Preventive Behavior' },
      { axis: 'CognitiveDisp', subcategory: '', value: 'Deep Thought' },
    ],
  };

  const counts = buildPrimaryCodeMatrixCounts(buildSankeyDataFromEditor(editor));
  assert.equal(counts.cnt.Conscientious.TEST, 1);
  assert.equal(counts.cnt.Comparative.TEST, 1);
  assert.deepEqual(counts.items.Comparative.TEST, ['Comparative item']);
});
