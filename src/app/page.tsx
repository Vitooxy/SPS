'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DataManager from '@/components/data-manager';
import type { SankeyData } from '@/lib/parse-data';

const SankeyChart = dynamic(() => import('@/components/sankey-chart'), { ssr: false });

const STORAGE_KEY = 'sps-saved-data';

export default function Home() {
  const [data, setData] = useState<SankeyData | null>(null);

  const handleDataLoaded = useCallback((parsed: SankeyData) => {
    setData(parsed);
    // Save to localStorage so save button can persist it
    localStorage.setItem('sps-uploaded-data', JSON.stringify(parsed));
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden">
      {/* Top bar with buttons */}
      <DataManager onDataLoaded={handleDataLoaded} />

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        <SankeyChart externalData={data} />
      </div>
    </div>
  );
}