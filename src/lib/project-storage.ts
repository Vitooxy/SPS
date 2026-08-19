import { normalizeSankeyData, type SankeyData } from './parse-data';

export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: SankeyData;
}

const STORAGE_KEY = 'sps-project-snapshots-v1';

export function loadSnapshots(): ProjectSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ProjectSnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(snapshot => snapshot?.id && snapshot?.name && snapshot?.data)
      .map(snapshot => ({ ...snapshot, data: normalizeSankeyData(snapshot.data) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function persistSnapshots(snapshots: ProjectSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

export function createSnapshot(name: string, data: SankeyData): ProjectSnapshot {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    data,
  };
}
