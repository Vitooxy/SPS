'use client';

import { useState, useCallback } from 'react';
import type { EditorData, EditorItemData, EditorPrimaryCode, EditorAxisValue } from '@/lib/build-workbook';

type Tab = 'items' | 'primaryCodes' | 'axisValues';

interface DataEditorProps {
  data: EditorData;
  onSave: (data: EditorData) => void;
  onClose: () => void;
}

export default function DataEditor({ data, onSave, onClose }: DataEditorProps) {
  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<EditorItemData[]>(() => data.items.map(i => ({ ...i })));
  const [primaryCodeList, setPrimaryCodeList] = useState<EditorPrimaryCode[]>(() => data.primaryCodeList.map(p => ({ ...p })));
  const [axisValueList, setAxisValueList] = useState<EditorAxisValue[]>(() => data.axisValueList.map(a => ({ ...a })));

  const handleSave = useCallback(() => {
    onSave({ items, primaryCodeList, axisValueList });
  }, [items, primaryCodeList, axisValueList, onSave]);

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
      text: '',
      scale: prev[0]?.scale || 'SPSQ',
      derivedPrimary: '',
      stimulus: '',
      process: '',
      outcome: '',
      response: '',
      cognitiveDisp: '',
    }]);
  };

  // ── Primary Code helpers ──
  const updatePC = (idx: number, field: keyof EditorPrimaryCode, value: string) => {
    setPrimaryCodeList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const deletePC = (idx: number) => {
    setPrimaryCodeList(prev => prev.filter((_, i) => i !== idx));
  };

  const addPC = () => {
    setPrimaryCodeList(prev => [...prev, { category: '', code: '' }]);
  };

  // ── Axis Value helpers ──
  const updateAV = (idx: number, field: keyof EditorAxisValue, value: string) => {
    setAxisValueList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const deleteAV = (idx: number) => {
    setAxisValueList(prev => prev.filter((_, i) => i !== idx));
  };

  const addAV = () => {
    setAxisValueList(prev => [...prev, { subcategory: '', value: '' }]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-6 pb-6 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-7xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Data Editor</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
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
                      <th className="p-1.5 border-b border-gray-200 text-left font-semibold text-gray-600 min-w-[100px]">Cog. Disp.</th>
                      <th className="p-1.5 border-b border-gray-200 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-blue-50/30">
                        <td className="p-1 border-b border-r border-gray-100 text-gray-400 text-center">{idx + 1}</td>
                        <td className="p-1 border-b border-r border-gray-100 text-gray-500 font-mono">{item.id}</td>
                        <td className="p-1 border-b border-r border-gray-100">
                          <input
                            value={item.text}
                            onChange={e => updateItem(idx, 'text', e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                        <td className="p-1 border-b border-r border-gray-100 text-gray-500">{item.scale}</td>
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
                        <td className="p-1 border-b border-gray-100">
                          <input
                            value={item.cognitiveDisp}
                            onChange={e => updateItem(idx, 'cognitiveDisp', e.target.value)}
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