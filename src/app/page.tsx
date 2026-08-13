'use client';

import { useState, useCallback } from 'react';
import SankeyChart from '@/components/sankey-chart';
import { parseExcelData, type SankeyData } from '@/lib/parse-data';

export default function Home() {
  const [data, setData] = useState<SankeyData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件扩展名
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('请上传 Excel 文件（.xlsx / .xls / .csv）');
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelData(buffer);
      setData(parsed);
      setLoaded(true);
    } catch (err) {
      console.error('数据解析失败:', err);
      alert('文件解析失败，请检查文件格式是否正确（需包含 "Items × 6 Axes"、"Primary Code List"、"Axis Value List" 三个工作表）');
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* 上传按钮 - 固定右上角 */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-3">
        {/* 加载状态提示 */}
        {loaded && data && (
          <span className="text-xs text-green-600 font-medium">
            ✓ 已加载 {data.items.length} 条条目
          </span>
        )}
        <label className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer
          transition-colors
          ${uploading
            ? 'bg-muted text-muted-foreground pointer-events-none'
            : 'bg-primary/10 text-primary hover:bg-primary/20'
          }
        `}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {uploading ? '解析中...' : '上传数据'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {/* 图表 */}
      <SankeyChart externalData={data} />
    </div>
  );
}