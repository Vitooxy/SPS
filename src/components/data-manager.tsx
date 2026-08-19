'use client';

import { useRef, useState, useCallback } from 'react';
import { DataContractError, parseExcelData, type SankeyData } from '@/lib/parse-data';
import { downloadTemplate } from '@/lib/template';

interface DataManagerProps {
  onDataLoaded: (data: SankeyData, sourceName: string) => void;
}

export default function DataManager({ onDataLoaded }: DataManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const parsed = parseExcelData(await file.arrayBuffer());
      onDataLoaded(parsed, file.name.replace(/\.(xlsx|xls)$/i, ''));
      setMessage({ type: 'success', text: `已载入 ${parsed.items.length} 个条目、${parsed.nodes.length} 个节点。` });
    } catch (error) {
      const text = error instanceof DataContractError
        ? error.issues.join('\n')
        : error instanceof Error ? error.message : '未知错误';
      window.alert(`数据验证未通过：\n\n${text}`);
      setMessage({ type: 'error', text: '文件未载入；请按提示修正数据合同。' });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }, [onDataLoaded]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? '解析中...' : '上传 Excel'}
      </button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
      <button
        onClick={downloadTemplate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-card-foreground hover:bg-accent transition-colors"
      >
        下载模板
      </button>
      {message && (
        <span className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
