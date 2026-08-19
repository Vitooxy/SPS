'use client';

import type { ProjectSnapshot } from '@/lib/project-storage';

interface ProjectManagerProps {
  name: string;
  onNameChange: (name: string) => void;
  snapshots: ProjectSnapshot[];
  activeId: string | null;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: (id: string) => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
  disabled?: boolean;
}

export default function ProjectManager({
  name, onNameChange, snapshots, activeId, onSave, onSaveAs, onLoad, onRename, onDelete, onExport, disabled,
}: ProjectManagerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={name}
        onChange={event => onNameChange(event.target.value)}
        placeholder="方案名称"
        className="w-40 px-2 py-1.5 text-xs border border-border rounded-md bg-card text-card-foreground"
      />
      <select
        value={activeId || ''}
        onChange={event => event.target.value && onLoad(event.target.value)}
        className="max-w-48 px-2 py-1.5 text-xs border border-border rounded-md bg-card text-card-foreground"
      >
        <option value="">已保存方案</option>
        {snapshots.map(snapshot => <option key={snapshot.id} value={snapshot.id}>{snapshot.name}</option>)}
      </select>
      <button disabled={disabled || !name.trim()} onClick={onSave} className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-card hover:bg-accent disabled:opacity-40">保存</button>
      <button disabled={disabled || !name.trim()} onClick={onSaveAs} className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-card hover:bg-accent disabled:opacity-40">另存为</button>
      <button disabled={!activeId || !name.trim()} onClick={onRename} className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-card hover:bg-accent disabled:opacity-40">重命名</button>
      <button disabled={!activeId} onClick={onDelete} className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-card hover:bg-accent disabled:opacity-40">删除</button>
      <button disabled={disabled} onClick={onExport} className="px-2.5 py-1.5 text-xs border border-border rounded-md bg-card hover:bg-accent disabled:opacity-40">导出 Excel</button>
    </div>
  );
}
