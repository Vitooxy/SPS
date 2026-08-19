'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import DataManager from '@/components/data-manager';
import DataEditor from '@/components/data-editor';
import ProjectManager from '@/components/project-manager';
import { buildSankeyDataFromEditor, normalizeSankeyData, type SankeyData } from '@/lib/parse-data';
import { downloadEditorWorkbook, extractEditorData, type EditorData } from '@/lib/build-workbook';
import { createSnapshot, loadSnapshots, persistSnapshots, type ProjectSnapshot } from '@/lib/project-storage';

const SankeyChart = dynamic(() => import('@/components/sankey-chart'), { ssr: false });
const PrimaryCodeMatrix = dynamic(() => import('@/components/primary-code-matrix'), { ssr: false });
const ACTIVE_PROJECT_KEY = 'sps-active-project-id-v1';

export default function Home() {
  const [currentData, setCurrentData] = useState<SankeyData | null>(null);
  const [projectName, setProjectName] = useState('SPS V3.14');
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [editorValidationError, setEditorValidationError] = useState<string | null>(null);
  const editorOriginalData = useRef<SankeyData | null>(null);

  useEffect(() => {
    const savedSnapshots = loadSnapshots();
    setSnapshots(savedSnapshots);
    const savedActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY);
    const savedActive = savedSnapshots.find(snapshot => snapshot.id === savedActiveId);
    if (savedActive) {
      setCurrentData(normalizeSankeyData(savedActive.data));
      setProjectName(savedActive.name);
      setActiveId(savedActive.id);
      return;
    }
    fetch('/sankey-data.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: SankeyData) => setCurrentData(normalizeSankeyData(data)))
      .catch(error => console.error('Failed to load default data:', error));
  }, []);

  const handleDataLoaded = useCallback((data: SankeyData, sourceName: string) => {
    setCurrentData(normalizeSankeyData(data));
    setProjectName(sourceName || 'SPS Project');
    setActiveId(null);
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    setShowEditor(false);
  }, []);

  const handleOpenEditor = useCallback(() => {
    if (!currentData) return;
    editorOriginalData.current = currentData;
    setEditorData(extractEditorData(currentData));
    setEditorValidationError(null);
    setShowEditor(true);
  }, [currentData]);

  const handleEditorPreview = useCallback((edited: EditorData) => {
    try {
      setCurrentData(buildSankeyDataFromEditor(edited));
      setEditorValidationError(null);
    } catch (error) {
      setEditorValidationError(error instanceof Error ? error.message : '数据合同无效');
    }
  }, []);

  const handleEditorSave = useCallback((edited: EditorData) => {
    try {
      setCurrentData(buildSankeyDataFromEditor(edited));
      setShowEditor(false);
      setEditorData(null);
      setEditorValidationError(null);
      editorOriginalData.current = null;
    } catch (error) {
      setEditorValidationError(error instanceof Error ? error.message : '数据合同无效');
    }
  }, []);

  const handleEditorClose = useCallback(() => {
    if (editorOriginalData.current) setCurrentData(editorOriginalData.current);
    editorOriginalData.current = null;
    setShowEditor(false);
    setEditorData(null);
    setEditorValidationError(null);
  }, []);

  const commitSnapshots = useCallback((next: ProjectSnapshot[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    try {
      persistSnapshots(sorted);
      setSnapshots(sorted);
      return true;
    } catch {
      window.alert('浏览器存储空间不足，方案未保存。请先导出 Excel，并删除不再需要的本地方案。');
      return false;
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!currentData || !projectName.trim()) return;
    if (!activeId) {
      const snapshot = createSnapshot(projectName, currentData);
      if (commitSnapshots([snapshot, ...snapshots])) {
        setActiveId(snapshot.id);
        localStorage.setItem(ACTIVE_PROJECT_KEY, snapshot.id);
      }
      return;
    }
    commitSnapshots(snapshots.map(snapshot => snapshot.id === activeId
      ? { ...snapshot, name: projectName.trim(), updatedAt: new Date().toISOString(), data: currentData }
      : snapshot));
  }, [activeId, commitSnapshots, currentData, projectName, snapshots]);

  const handleSaveAs = useCallback(() => {
    if (!currentData || !projectName.trim()) return;
    const snapshot = createSnapshot(projectName, currentData);
    if (commitSnapshots([snapshot, ...snapshots])) {
      setActiveId(snapshot.id);
      localStorage.setItem(ACTIVE_PROJECT_KEY, snapshot.id);
    }
  }, [commitSnapshots, currentData, projectName, snapshots]);

  const handleLoad = useCallback((id: string) => {
    const snapshot = snapshots.find(entry => entry.id === id);
    if (!snapshot) return;
    setCurrentData(normalizeSankeyData(snapshot.data));
    setProjectName(snapshot.name);
    setActiveId(snapshot.id);
    localStorage.setItem(ACTIVE_PROJECT_KEY, snapshot.id);
    setShowEditor(false);
  }, [snapshots]);

  const handleRename = useCallback(() => {
    const nextName = projectName.trim();
    if (!activeId || !nextName) return;
    commitSnapshots(snapshots.map(snapshot => snapshot.id === activeId
      ? { ...snapshot, name: nextName, updatedAt: new Date().toISOString() }
      : snapshot));
  }, [activeId, commitSnapshots, projectName, snapshots]);

  const handleDelete = useCallback(() => {
    if (!activeId) return;
    const target = snapshots.find(snapshot => snapshot.id === activeId);
    if (!target || !window.confirm(`确定删除方案“${target.name}”？此操作只删除浏览器中的存档。`)) return;
    if (commitSnapshots(snapshots.filter(snapshot => snapshot.id !== activeId))) {
      setActiveId(null);
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, [activeId, commitSnapshots, snapshots]);

  const handleExport = useCallback(() => {
    if (!currentData) return;
    downloadEditorWorkbook(extractEditorData(currentData), projectName);
  }, [currentData, projectName]);

  return (
    <div className="relative w-full min-h-screen flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-background border-b border-border flex-wrap">
        <DataManager onDataLoaded={handleDataLoaded} />
        <ProjectManager
          name={projectName}
          onNameChange={setProjectName}
          snapshots={snapshots}
          activeId={activeId}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onLoad={handleLoad}
          onRename={handleRename}
          onDelete={handleDelete}
          onExport={handleExport}
          disabled={!currentData}
        />
      </div>

      {currentData && (
        <div className="flex justify-end px-4 py-1">
          <button onClick={handleOpenEditor} className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors">
            Edit Data
          </button>
        </div>
      )}

      <div className="flex-1">
        <SankeyChart externalData={currentData} />
      </div>

      {currentData && (
        <div className="border-t border-border mt-2">
          <PrimaryCodeMatrix data={currentData} />
        </div>
      )}

      {showEditor && editorData && (
        <DataEditor
          data={editorData}
          onPreview={handleEditorPreview}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
          validationError={editorValidationError}
        />
      )}
    </div>
  );
}
