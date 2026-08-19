'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { EditorData, EditorItemData, EditorPrimaryCode, EditorAxisValue } from '@/lib/build-workbook';

type Tab = 'items' | 'primaryCodes' | 'axisValues';

interface DataEditorProps {
  data: EditorData;
  onSave: (data: EditorData) => void;
  onPreview?: (data: EditorData) => void;
  onClose: () => void;
  validationError?: string | null;
}

const AXIS_OPTIONS: EditorAxisValue['axis'][] = ['Stimulus', 'Process', 'Outcome', 'Response', 'CognitiveDisp'];

function replaceListValue(input: string, oldValue: string, nextValue: string, derived = false): string {
  const delimiter = derived ? ' / ' : ', ';
  const parts = input.split(derived ? /\s*(?:\/|,)\s*/ : /\s*,\s*/).map(v => v.trim()).filter(Boolean);
  return [...new Set(parts.map(value => value === oldValue ? nextValue.trim() : value).filter(Boolean))].join(delimiter);
}

export default function DataEditor({ data, onSave, onPreview, onClose, validationError }: DataEditorProps) {
  const [tab, setTab] = useState<Tab>('items');
  const [previewMode, setPreviewMode] = useState(false);
  const [items, setItems] = useState<EditorItemData[]>(() => data.items.map(i => ({ ...i })));
  const [primaryCodeList, setPrimaryCodeList] = useState<EditorPrimaryCode[]>(() => data.primaryCodeList.map(p => ({ ...p })));
  const [axisValueList, setAxisValueList] = useState<EditorAxisValue[]>(() => data.axisValueList.map(a => ({ ...a })));
  const primaryCodeLastApplied = useRef<Record<number, string>>({});
  const axisValueLastApplied = useRef<Record<number, string>>({});

  const handleSave = useCallback(() => {
    onSave({ items, primaryCodeList, axisValueList });
  }, [items, primaryCodeList, axisValueList, onSave]);

  useEffect(() => {
    onPreview?.({ items, primaryCodeList, axisValueList });
  }, [items, primaryCodeList, axisValueList, onPreview]);

  // ── Item helpers ──
  const updateItem = (idx: number, field: keyof EditorItemData, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const deleteItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `NEW_${prev.length + 1}`,
      sourceId: `NEW_${prev.length + 1}`,
      text: '',
      scale: prev[0]?.scale || 'SPSQ',
      derivedPrimary: '',
      stimulus: '',
      process: '',
      outcome: '',
      response: '',
      cognitiveDisp: '',
      outliner: '',
      originalPrimaryCode: '',
    }]);
  };

  // ── Primary Code helpers ──
  const updatePC = (idx: number, field: keyof EditorPrimaryCode, value: string) => {
    const previousCode = primaryCodeList[idx]?.code || '';
    setPrimaryCodeList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    if (field === 'code') {
      const lastApplied = primaryCodeLastApplied.current[idx] || previousCode;
      if (value.trim() && lastApplied && lastApplied !== value) {
        setItems(prev => prev.map(item => ({ ...item, derivedPrimary: replaceListValue(item.derivedPrimary, lastApplied, value, true) })));
        primaryCodeLastApplied.current[idx] = value;
      }
    }
  };

  const deletePC = (idx: number) => {
    const code = primaryCodeList[idx]?.code || '';
    const usage = items.filter(item => replaceListValue(item.derivedPrimary, code, '', true) !== item.derivedPrimary).length;
    if (usage > 0 && !window.confirm(`“${code}”正在 ${usage} 个 item 中使用。删除后会同时从这些 item 中移除，是否继续？`)) return;
    setPrimaryCodeList(prev => prev.filter((_, i) => i !== idx));
    if (code) setItems(prev => prev.map(item => ({ ...item, derivedPrimary: replaceListValue(item.derivedPrimary, code, '', true) })));
  };

  const addPC = () => {
    setPrimaryCodeList(prev => [...prev, { category: prev[prev.length - 1]?.category || '', code: '' }]);
  };

  // ── Axis Value helpers ──
  const updateAV = (idx: number, field: keyof EditorAxisValue, value: string) => {
    const previous = axisValueList[idx];
    setAxisValueList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    if (field === 'value' && previous) {
      const itemField: Record<EditorAxisValue['axis'], keyof EditorItemData> = {
        Stimulus: 'stimulus', Process: 'process', Outcome: 'outcome', Response: 'response', CognitiveDisp: 'cognitiveDisp',
      };
      const target = itemField[previous.axis];
      const lastApplied = axisValueLastApplied.current[idx] || previous.value;
      if (value.trim() && lastApplied !== value) {
        setItems(prev => prev.map(item => ({ ...item, [target]: replaceListValue(String(item[target]), lastApplied, value) })));
        axisValueLastApplied.current[idx] = value;
      }
    }
  };

  const deleteAV = (idx: number) => {
    const entry = axisValueList[idx];
    if (entry?.value) {
      const itemField: Record<EditorAxisValue['axis'], keyof EditorItemData> = {
        Stimulus: 'stimulus', Process: 'process', Outcome: 'outcome', Response: 'response', CognitiveDisp: 'cognitiveDisp',
      };
      const target = itemField[entry.axis];
      const usage = items.filter(item => String(item[target]).split(/\s*,\s*/).includes(entry.value)).length;
      if (usage > 0 && !window.confirm(`“${entry.value}”正在 ${usage} 个 item 中使用。删除后会同时从这些 item 中移除，是否继续？`)) return;
      setItems(prev => prev.map(item => ({ ...item, [target]: replaceListValue(String(item[target]), entry.value, '') })));
    }
    setAxisValueList(prev => prev.filter((_, i) => i !== idx));
  };

  const addAV = () => {
    setAxisValueList(prev => [...prev, { axis: 'Stimulus', subcategory: '', value: '' }]);
  };

  if (previewMode) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-between gap-3 px-4 py-2 bg-white border-t border-gray-200 shadow-lg">
        <span className="text-xs text-gray-600">实时预览已开启：Sankey、矩阵和 item mapping 使用当前编辑值。</span>
        <div className="flex items-center gap-2">
          {validationError && <span className="max-w-md truncate text-xs text-red-600" title={validationError}>{validationError}</span>}
          <button onClick={() => setPreviewMode(false)} className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">返回编辑</button>
          <button disabled={Boolean(validationError)} onClick={handleSave} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40">Save &amp; Apply</button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-6 pb-6 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-7xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Data Editor</h2>
          <div className="flex items-center gap-2">
            {validationError && <span className="max-w-md truncate text-xs text-red-600" title={validationError}>{validationError}</span>}
            <button
              onClick={() => setPreviewMode(true)}
              className="px-4 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
            >
              查看实时图
            </button>
            <button
              onClick={handleSave}
              disabled={Boolean(validationError)}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Save &amp; Apply
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {([
            { key: 'items' as Tab, label: `Items (${items.length})` },
            { key: 'primaryCodes' as Tab, label: `Primary Codes (${primaryCodeList.length})` },
            { key: 'axisValues' as Tab, label: `Axis Values (${axisValueList.length})` },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {tab === 'items' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Editing item axis values and primary codes</span>
                <button onClick={addItem} className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                  + Add Row
                </button>
              </div>
              <div className="overflow-auto border border-gray-200 rounded" style={{ maxHeight: '55vh' }}>
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 w-8">#</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 w-20">ID</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[180px]">Text</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 w-16">Scale</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[160px]">Derived Primary</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[120px]">Stimulus</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Process</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Outcome</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Response</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Cog. Disp.</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Outliner</th>
                      <th className="p-1.5 border-b border-gray-200 text-left font-semibold text-gray-600 min-w-[150px]">Original Primary</th>
                      <th className="p-1.5 border-b border-gray-200 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-blue-50/30">
                        <td className="p-1 border-b border-r border-gray-100 text-gray-400 text-center">{idx + 1}</td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.sourceId || item.id}
                            onChange={e => updateItem(idx, 'sourceId', e.target.value)}
                            className="w-full px-1 py-0.5 font-mono border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.text}
                            onChange={e => updateItem(idx, 'text', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.scale}
                            onChange={e => updateItem(idx, 'scale', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.derivedPrimary}
                            onChange={e => updateItem(idx, 'derivedPrimary', e.target.value)}
                            placeholder="e.g. General Overload, Aversion"
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.stimulus}
                            onChange={e => updateItem(idx, 'stimulus', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.process}
                            onChange={e => updateItem(idx, 'process', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.outcome}
                            onChange={e => updateItem(idx, 'outcome', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.response}
                            onChange={e => updateItem(idx, 'response', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.cognitiveDisp}
                            onChange={e => updateItem(idx, 'cognitiveDisp', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.outliner}
                            onChange={e => updateItem(idx, 'outliner', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <input
                            value={item.originalPrimaryCode}
                            onChange={e => updateItem(idx, 'originalPrimaryCode', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <button
                            onClick={() => deleteItem(idx)}
                            className="text-red-400 hover:text-red-600 text-xs px-1"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'primaryCodes' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Category ↔ Primary Code mapping</span>
                <button onClick={addPC} className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                  + Add Row
                </button>
              </div>
              <div className="overflow-auto border border-gray-200 rounded" style={{ maxHeight: '55vh' }}>
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 w-8">#</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[160px]">Category</th>
                      <th className="p-1.5 border-b border-gray-200 text-left font-semibold text-gray-600 min-w-[200px]">Primary Code</th>
                      <th className="p-1.5 border-b border-gray-200 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryCodeList.map((pc, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="p-1 border-b border-r border-gray-100 text-gray-400 text-center">{idx + 1}</td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={pc.category}
                            onChange={e => updatePC(idx, 'category', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <input
                            value={pc.code}
                            onChange={e => updatePC(idx, 'code', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <button
                            onClick={() => deletePC(idx)}
                            className="text-red-400 hover:text-red-600 text-xs px-1"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'axisValues' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Stimulus subcategory ↔ value mapping</span>
                <button onClick={addAV} className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                  + Add Row
                </button>
              </div>
              <div className="overflow-auto border border-gray-200 rounded" style={{ maxHeight: '55vh' }}>
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 w-8">#</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[120px]">Axis</th>
                      <th className="p-1.5 border-b border-r border-gray-200 text-left font-semibold text-gray-600 min-w-[160px]">Subcategory</th>
                      <th className="p-1.5 border-b border-gray-200 text-left font-semibold text-gray-600 min-w-[200px]">Value</th>
                      <th className="p-1.5 border-b border-gray-200 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {axisValueList.map((av, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="p-1 border-b border-r border-gray-100 text-gray-400 text-center">{idx + 1}</td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <select
                            value={av.axis}
                            onChange={e => updateAV(idx, 'axis', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          >
                            {AXIS_OPTIONS.map(axis => <option key={axis} value={axis}>{axis}</option>)}
                          </select>
                        </td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={av.subcategory}
                            onChange={e => updateAV(idx, 'subcategory', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <input
                            value={av.value}
                            onChange={e => updateAV(idx, 'value', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-gray-100">
                          <button
                            onClick={() => deleteAV(idx)}
                            className="text-red-400 hover:text-red-600 text-xs px-1"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
