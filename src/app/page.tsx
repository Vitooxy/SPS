'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DataManager from '@/components/data-manager';
import type { SankeyData } from '@/lib/parse-data';

const SankeyChart = dynamic(() => import('@/components/sankey-chart'), { ssr: false });
const PrimaryCodeMatrix = dynamic(() => import('@/components/primary-code-matrix'), { ssr: false });

const STORAGE_KEY = 'sps-saved-data';

export default function Home() {
  const [data, setData] = useState<SankeyData | null>(null);

  const handleDataLoaded = useCallback((parsed: SankeyData) => {
    setData(parsed);
    // Save to localStorage so save button can persist it
    localStorage.setItem('sps-uploaded-data', JSON.stringify(parsed));
  }, []);

  return (
    <div className="relative w-full min-h-screen flex flex-col">
      {/* Top bar with buttons */}
      <DataManager onDataLoaded={handleDataLoaded} />

      {/* Chart area */}
      <div className="flex-1">
        <SankeyChart externalData={data} />
      </div>

      {/* Primary Code × Scale Matrix */}
      {data && (
        <div className="border-t border-border">
          <PrimaryCodeMatrix data={data} />
        </div>
      )}
    </div>
  );
}