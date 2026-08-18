'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { parseExcelData, type SankeyData } from '@/lib/parse-data';
import { downloadTemplate } from '@/lib/template';

const SAVE_PASSWORD = 'xuyudabendan';
const STORAGE_KEY = 'sps-saved-data';

interface DataManagerProps {
  onDataLoaded: (data: SankeyData) => void;
}

export default function DataManager({ onDataLoaded }: DataManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Validate sheets
      const errors: string[] = [];
      const requiredSheets = ['Items × Axes', 'Primary Code List', 'Axis Value List'];
      // Also accept old sheet name
      const oldNames: Record<string, string> = { 'Items × 6 Axes': 'Items × Axes' };
      const missingSheets = requiredSheets.filter(s => {
        if (s === 'Items × Axes') {
          // Accept either 'Items × Axes' or 'Items × 6 Axes'
          return !wb.SheetNames.includes('Items × Axes') && !wb.SheetNames.includes('Items × 6 Axes');
        }
        return !wb.SheetNames.includes(s);
      });
      if (missingSheets.length > 0) {
        errors.push(`缺少工作表：${missingSheets.join('、')}。请下载模板查看正确格式。`);
      }

      // Find the items sheet name
      const itemsSheetName = wb.SheetNames.includes('Items × Axes') ? 'Items × Axes' : 'Items × 6 Axes';

      // Validate items sheet headers
      if (wb.SheetNames.includes(itemsSheetName)) {
        const sheet = wb.Sheets[itemsSheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        if (rows.length < 2) {
          errors.push(`${itemsSheetName} 工作表缺少数据行。`);
        } else {
          // Check for essential columns
          const row0 = rows[0] as string[];
          const hasRow = row0[0] === 'Row' || row0[0] === '1';
          if (!hasRow) {
            errors.push(`${itemsSheetName} 工作表第一行应包含"Row"或序号。`);
          }

          // Check for data rows
          const dataRows = rows.slice(1).filter((r: any) => r[2] && String(r[2]).trim());
          if (dataRows.length === 0) {
            errors.push(`${itemsSheetName} 工作表没有有效的数据行（ItemID 列为空）。`);
          } else {
            // Check for missing ItemText
            const missingText = dataRows.filter((r: any) => !r[3] || String(r[3]).trim() === '');
            if (missingText.length > 0) {
              errors.push(`有 ${missingText.length} 行数据缺少 ItemText（第4列）。`);
            }
          }
        }
      }

      // Validate Primary Code List
      if (wb.SheetNames.includes('Primary Code List')) {
        const sheet = wb.Sheets['Primary Code List'];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        if (rows.length < 2) {
          errors.push('Primary Code List 工作表缺少数据。');
        }
      }

      // Validate Axis Value List
      if (wb.SheetNames.includes('Axis Value List')) {
        const sheet = wb.Sheets['Axis Value List'];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        if (rows.length < 2) {
          errors.push('Axis Value List 工作表缺少数据。');
        }
      }

      if (errors.length > 0) {
        alert(`⚠️ 数据验证未通过，请检查以下问题：\n\n${errors.join('\n')}\n\n请点击"下载模板"查看正确格式。`);
        showMessage('error', '数据验证未通过，请检查弹窗提示。');
        setLoading(false);
        e.target.value = '';
        return;
      }

      // Parse the data
      const parsed = parseExcelData(wb);
      if (!parsed.nodes || parsed.nodes.length === 0) {
        alert('⚠️ 解析失败：未能从数据中提取到任何节点。请检查数据格式是否正确。');
        showMessage('error', '数据解析失败。');
        setLoading(false);
        e.target.value = '';
        return;
      }

      onDataLoaded(parsed);
      showMessage('success', `数据加载成功！共 ${parsed.items.length} 个条目，${parsed.nodes.length} 个节点。`);
    } catch (err) {
      console.error('Upload error:', err);
      alert('⚠️ 文件读取失败：' + (err instanceof Error ? err.message : '未知错误') + '\n\n请确保上传的是有效的 Excel 文件（.xlsx）。');
      showMessage('error', '文件读取失败。');
    }

    setLoading(false);
    e.target.value = '';
  }, [onDataLoaded, showMessage]);

  const handleSave = useCallback(() => {
    const password = prompt('请输入保存密码：');
    if (password === null) return; // User cancelled

    if (password !== SAVE_PASSWORD) {
      alert('❌ 密码错误，保存失败。');
      showMessage('error', '密码错误，保存失败。');
      return;
    }

    // Get current data from the chart
    const savedData = localStorage.getItem('sps-uploaded-data');
    if (!savedData) {
      alert('⚠️ 没有已上传的数据可保存。请先上传数据。');
      showMessage('error', '没有数据可保存。');
      return;
    }

    // Save to persistent storage
    localStorage.setItem(STORAGE_KEY, savedData);
    showMessage('success', '✅ 数据已成功保存！刷新页面后将显示已保存的数据。');
  }, [showMessage]);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SankeyData;
        if (parsed.nodes && parsed.nodes.length > 0) {
          onDataLoaded(parsed);
        }
      } catch {
        // Invalid saved data, ignore
      }
    }
  }, [onDataLoaded]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-background border-b border-border" suppressHydrationWarning>
      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        suppressHydrationWarning
      >
        {loading ? (
          <>
            <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
            <span suppressHydrationWarning>解析中...</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span suppressHydrationWarning>上传数据</span>
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Download template button */}
      <button
        onClick={downloadTemplate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-card-foreground hover:bg-accent transition-colors"
        suppressHydrationWarning
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span suppressHydrationWarning>下载模板</span>
      </button>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-card-foreground hover:bg-accent transition-colors"
        suppressHydrationWarning
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <span suppressHydrationWarning>保存</span>
      </button>

      {/* Status message */}
      {message && (
        <span className={`text-xs ml-2 ${
          message.type === 'success' ? 'text-green-600' :
          message.type === 'error' ? 'text-red-600' :
          'text-muted-foreground'
        }`} suppressHydrationWarning>
          {message.text}
        </span>
      )}
    </div>
  );
}