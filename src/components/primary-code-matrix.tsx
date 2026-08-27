"use client";

import { useMemo, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import type { SankeyData } from "@/lib/parse-data";
import { buildPrimaryCodeMatrixCounts } from "@/lib/primary-code-matrix";

interface Props {
  data: SankeyData;
}

const COL_WIDTH = 70;
const ROW_HEIGHT = 36;
const DEFAULT_SCALE_ORDER = ["SPSQ", "HSP-27", "HSC-21", "DOES", "HSP-R", "HSC"];

export default function PrimaryCodeMatrix({ data }: Props) {
  const matrixRef = useRef<HTMLDivElement>(null);

  const categoryPrimaryCodes = useCallback((cat: string) => {
    return data.categoryCodes?.[cat] ?? [];
  }, [data]);
  const scaleNames = useMemo(() => {
    const present = new Set(data.items.map(item => item.scale));
    return [
      ...DEFAULT_SCALE_ORDER.filter(scale => present.has(scale)),
      ...[...present].filter(scale => !DEFAULT_SCALE_ORDER.includes(scale)).sort(),
    ];
  }, [data.items]);

  // Other Descriptors include matching Outliner annotations; a duplicated
  // Derived Primary Code + Outliner value is counted once per item.
  const counts = useMemo(() => buildPrimaryCodeMatrixCounts(data), [data]);

  const downloadImage = useCallback(async () => {
    if (!matrixRef.current) return;
    try {
      const dataUrl = await toPng(matrixRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = "sps-primary-coding-matrix.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image", err);
    }
  }, []);

  const renderMatrix = (cats: string[], side: "left" | "right") => {
    const categoryColors = data.categoryColors ?? {};

    return (
      <div className="inline-block">
        <table className="border-collapse" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ width: 10, height: 36, padding: 0, borderBottom: "1px solid #ddd" }} />
              <th style={{ width: 120, height: 36, textAlign: "center", padding: "0 6px", fontWeight: 600, color: "#666", fontSize: 10, borderBottom: "1px solid #ddd" }}>
                Category
              </th>
              <th style={{ width: 140, height: 36, textAlign: "left", padding: "0 6px", fontWeight: 600, color: "#666", fontSize: 10, borderBottom: "1px solid #ddd" }}>
                Primary Code
              </th>
              {scaleNames.map((s) => (
                <th
                  key={`${side}-${s}`}
                  style={{
                    width: COL_WIDTH,
                    height: 36,
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: 10,
                    color: "#555",
                    borderBottom: "1px solid #ddd",
                    padding: "0 2px",
                  }}
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => {
              const color = categoryColors[cat] ?? "#999";
              const codes = categoryPrimaryCodes(cat);
              return codes.map((code, idx) => {
                const rowCounts = counts.cnt[code] ?? {};
                const isFirst = idx === 0;
                return (
                  <tr key={`${side}-${code}`}>
                    {/* Color strip */}
                    {isFirst ? (
                      <td
                        rowSpan={codes.length}
                        style={{
                          width: 10,
                          padding: 0,
                          borderBottom: "1px solid #eee",
                          backgroundColor: color,
                        }}
                      />
                    ) : null}
                    {/* Category name (merged) */}
                    {isFirst ? (
                      <td
                        rowSpan={codes.length}
                        style={{
                          width: 120,
                          textAlign: "center",
                          padding: "0 6px",
                          borderBottom: "1px solid #eee",
                          fontSize: 10,
                          fontWeight: 700,
                          verticalAlign: "middle",
                          color: "#444",
                        }}
                      >
                        {cat}
                      </td>
                    ) : null}
                    {/* Primary Code */}
                    <td
                      style={{
                        width: 140,
                        height: ROW_HEIGHT,
                        padding: "0 6px",
                        borderBottom: "1px solid #eee",
                        fontSize: 10,
                        color: "#444",
                        verticalAlign: "middle",
                      }}
                    >
                      {code}
                    </td>
                    {scaleNames.map((scale) => {
                      const val = rowCounts[scale] ?? 0;
                      return (
                        <td
                          key={`${code}-${scale}`}
                          style={{
                            width: COL_WIDTH,
                            height: ROW_HEIGHT,
                            textAlign: "center",
                            borderBottom: "1px solid #eee",
                            padding: "0 2px",
                            verticalAlign: "middle",
                            fontSize: 11,
                            fontWeight: val > 0 ? 600 : 400,
                            color: val > 0 ? "#333" : "#ccc",
                          }}
                        >
                          {val > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  backgroundColor: color,
                                  opacity: 0.7,
                                }}
                              />
                              {val}
                            </span>
                          )}
                          {val === 0 && <span style={{ color: "#e0e0e0" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const cats = data.categoryOrder ?? [];
  const half = Math.ceil(cats.length / 2);
  const leftCats = cats.slice(0, half);
  const rightCats = cats.slice(half);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-700">
          SPS Coding Matrix: Primary Codes and Other Descriptors
        </h3>
        <button
          onClick={downloadImage}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          下载 PNG
        </button>
      </div>
      <div ref={matrixRef} className="inline-block bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-8">
          {renderMatrix(leftCats, "left")}
          {renderMatrix(rightCats, "right")}
        </div>
      </div>
    </div>
  );
}
