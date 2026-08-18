"use client";

import { SankeyData, SankeyItem } from "@/lib/parse-data";
import { useMemo, useState } from "react";

interface Props {
  data: SankeyData | null;
}

interface CellInfo {
  count: number;
  items: SankeyItem[];
}

export default function PrimaryCodeMatrix({ data }: Props) {
  const [selectedCell, setSelectedCell] = useState<{
    primaryCode: string;
    scale: string;
    items: SankeyItem[];
  } | null>(null);

  const scales = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const item of data.items) {
      if (item.scale) s.add(item.scale);
    }
    // Sort scales in a consistent order
    const order = ["HSP-27", "HSC", "HSC-21", "DOES", "HSP-R", "SPSQ"];
    return order.filter((o) => s.has(o)).concat(
      [...s].filter((x) => !order.includes(x)).sort()
    );
  }, [data]);

  // Build a map: (primaryCode, scale) → count + items
  const matrix = useMemo(() => {
    const map = new Map<string, CellInfo>();
    if (!data) return map;
    for (const item of data.items) {
      const dps = item.derivedPrimary;
      if (!dps || dps.length === 0) continue;
      for (const dp of dps) {
        const key = `${dp}||${item.scale}`;
        if (!map.has(key)) {
          map.set(key, { count: 0, items: [] });
        }
        const cell = map.get(key)!;
        cell.count++;
        cell.items.push(item);
      }
    }
    return map;
  }, [data]);

  // Build primary code list per category (preserving order from data)
  const categoryPrimaryCodes = useMemo(() => {
    if (!data) return [];
    return data.categoryOrder.map((cat) => {
      // Get all items with this category
      const codes = new Set<string>();
      for (const item of data.items) {
        if (item.category === cat) {
          for (const dp of item.derivedPrimary) {
            codes.add(dp);
          }
        }
      }
      // Sort codes by count (descending)
      const sorted = [...codes].sort((a, b) => {
        const countA = scales.reduce(
          (sum, s) => sum + (matrix.get(`${a}||${s}`)?.count ?? 0),
          0
        );
        const countB = scales.reduce(
          (sum, s) => sum + (matrix.get(`${b}||${s}`)?.count ?? 0),
          0
        );
        return countB - countA;
      });
      return { category: cat, codes: sorted };
    });
  }, [data, matrix, scales]);

  if (!data) return null;

  const rowHeight = 32;
  const catGap = 4;
  const colWidth = 56;
  const labelWidth = 180;
  const barWidth = 6;

  // Calculate total height
  let totalHeight = 0;
  for (const entry of categoryPrimaryCodes) {
    totalHeight += entry.codes.length * rowHeight + catGap;
  }
  totalHeight += 40; // header

  const totalWidth = labelWidth + barWidth + 12 + scales.length * colWidth + 20;

  return (
    <div className="w-full overflow-x-auto border-t border-border mt-8 pt-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        SPS Primary Coding Matrix: Sorted by Category Breadth
      </h3>
      <svg width={totalWidth} height={totalHeight} className="text-xs">
        {/* Column headers */}
        <text x={labelWidth + barWidth + 12} y={20} className="fill-muted-foreground" fontSize={11} fontWeight={600}>
          Scale
        </text>
        {scales.map((scale, i) => (
          <text
            key={scale}
            x={labelWidth + barWidth + 12 + i * colWidth + colWidth / 2}
            y={18}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={10}
            fontWeight={600}
          >
            {scale}
          </text>
        ))}
        {/* Horizontal line under header */}
        <line
          x1={0}
          y1={28}
          x2={totalWidth}
          y2={28}
          stroke="currentColor"
          className="stroke-border"
          strokeWidth={1}
        />

        {/* Rows */}
        {(() => {
          let y = 40;
          const rows: React.ReactNode[] = [];
          for (const entry of categoryPrimaryCodes) {
            const catColor = data.categoryColors[entry.category] ?? "#A5A5A5";
            const startY = y;
            const catHeight = entry.codes.length * rowHeight;

            // Category color bar
            rows.push(
              <rect
                key={`bar-${entry.category}`}
                x={0}
                y={startY}
                width={barWidth}
                height={catHeight}
                fill={catColor}
                rx={1}
              />
            );

            // Category label
            rows.push(
              <text
                key={`cat-${entry.category}`}
                x={barWidth + 8}
                y={startY + rowHeight / 2}
                dy="0.35em"
                fontSize={11}
                fontWeight={600}
                fill={catColor}
              >
                {entry.category}
              </text>
            );

            // Primary code rows
            for (let ci = 0; ci < entry.codes.length; ci++) {
              const code = entry.codes[ci];
              const ry = startY + ci * rowHeight;

              // Row background on hover
              rows.push(
                <rect
                  key={`bg-${code}`}
                  x={barWidth + 4}
                  y={ry}
                  width={labelWidth + 12 + scales.length * colWidth - barWidth - 4}
                  height={rowHeight}
                  fill="transparent"
                  className="hover:fill-muted/50"
                  rx={1}
                />
              );

              // Primary code label
              rows.push(
                <text
                  key={`code-${code}`}
                  x={barWidth + 16}
                  y={ry + rowHeight / 2}
                  dy="0.35em"
                  fontSize={10}
                  className="fill-muted-foreground"
                >
                  {code}
                </text>
              );

              // Cells
              for (let si = 0; si < scales.length; si++) {
                const scale = scales[si];
                const cell = matrix.get(`${code}||${scale}`);
                const cx =
                  labelWidth + barWidth + 12 + si * colWidth + colWidth / 2;
                const cy = ry + rowHeight / 2;

                if (cell && cell.count > 0) {
                  const isSelected =
                    selectedCell?.primaryCode === code &&
                    selectedCell?.scale === scale;

                  rows.push(
                    <g
                      key={`cell-${code}-${scale}`}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedCell(
                          isSelected
                            ? null
                            : { primaryCode: code, scale, items: cell.items }
                        )
                      }
                    >
                      <circle
                        cx={cx - 10}
                        cy={cy}
                        r={isSelected ? 7 : 5}
                        fill={catColor}
                        opacity={isSelected ? 1 : 0.85}
                      />
                      <text
                        x={cx + 4}
                        y={cy}
                        dy="0.35em"
                        fontSize={10}
                        fontWeight={isSelected ? 600 : 400}
                        className={
                          isSelected ? "fill-foreground" : "fill-muted-foreground"
                        }
                      >
                        {cell.count}
                      </text>
                    </g>
                  );
                }
              }
            }

            // Separator line between categories
            rows.push(
              <line
                key={`sep-${entry.category}`}
                x1={0}
                y1={startY + catHeight}
                x2={totalWidth}
                y2={startY + catHeight}
                stroke="currentColor"
                className="stroke-border/50"
                strokeWidth={0.5}
              />
            );

            y += catHeight + catGap;
          }
          return rows;
        })()}
      </svg>

      {/* Selected cell info */}
      {selectedCell && (
        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <div className="text-sm font-medium mb-2">
            <span className="text-muted-foreground">Primary Code:</span>{" "}
            {selectedCell.primaryCode}{" "}
            <span className="text-muted-foreground">| Scale:</span>{" "}
            {selectedCell.scale}{" "}
            <span className="text-muted-foreground">| Count:</span>{" "}
            {selectedCell.items.length}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {selectedCell.items.map((item) => (
              <div key={item.id} className="text-xs text-muted-foreground">
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}