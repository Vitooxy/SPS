'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import DataManager from '@/components/data-manager';
import DataEditor from '@/components/data-editor';
import { parseExcelData } from '@/lib/parse-data';
import { extractEditorData, buildWorkbookFromEditorData } from '@/lib/build-workbook';
import type { SankeyData } from '@/lib/parse-data';
import type { EditorData } from '@/lib/build-workbook';

const SankeyChart = dynamic(() => import('@/components/sankey-chart'), { ssr: false });
const PrimaryCodeMatrix = dynamic(() => import('@/components/primary-code-matrix'), { ssr: false });

const STORAGE_KEY = 'sps-saved-data';

export default function Home() {
  const [data, setData] = useState<SankeyData | null>(null);
  const [chartData, setChartData] = useState<SankeyData | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  // Track if we have uploaded data (to show edit button)
  const [hasData, setHasData] = useState(false);

  const handleDataLoaded = useCallback((parsed: SankeyData) => {
    setData(parsed);
    setChartData(parsed);
    setHasData(true);
    localStorage.setItem('sps-uploaded-data', JSON.stringify(parsed));
  }, []);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SankeyData;
        setData(parsed);
        setChartData(parsed);
        setHasData(true);
      } catch {
        // ignore invalid saved data
      }
    }
  }, []);

  // Open editor
  const handleOpenEditor = useCallback(() => {
    const current = data || chartData;
    if (!current) return;
    const editor = extractEditorData(current);
    setEditorData(editor);
    setShowEditor(true);
  }, [data, chartData]);

  // Save from editor
  const handleEditorSave = useCallback((edited: EditorData) => {
    try {
      const wb = buildWorkbookFromEditorData(edited);
      const parsed = parseExcelData(wb);
      setData(parsed);
      setChartData(parsed);
      setShowEditor(false);
      setEditorData(null);
      localStorage.setItem('sps-uploaded-data', JSON.stringify(parsed));
    } catch (err) {
      console.error('Failed to rebuild data:', err);
      alert('Error saving edited data. Check console for details.');
    }
  }, []);

  const handleEditorClose = useCallback(() => {
    setShowEditor(false);
    setEditorData(null);
  }, []);

  return (
    <div className="relative w-full min-h-screen flex flex-col">
      {/* Top bar with buttons */}
      <DataManager onDataLoaded={handleDataLoaded} />

      {/* Edit Data button */}
      {hasData && (
        <div className="flex justify-end px-4 py-1">
          <button
            onClick={handleOpenEditor}
            className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
            suppressHydrationWarning
          >
            Edit Data
          </button>
        </div>
      )}

      {/* Chart area */}
      <div className="flex-1">
        <SankeyChart externalData={chartData} onDataLoaded={handleDataLoaded} />
      </div>

      {/* Primary Code × Scale Matrix */}
      {data && (
        <div className="border-t border-border mt-2">
          <PrimaryCodeMatrix data={data} />
        </div>
      )}

      {/* Data Editor Modal */}
      {showEditor && editorData && (
        <DataEditor
          data={editorData}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}