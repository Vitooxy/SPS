'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

interface RawNode {
  id: number;
  axis: string;
  value: string;
  column: number;
  category: string | null;
  subcategory: string | null;
  color: string;
}

interface RawLink {
  source: number;
  target: number;
  value: number;
  itemIds: string[];
  categories: string[];
}

interface SankeyData {
  nodes: RawNode[];
  links: RawLink[];
  nodeItems: Record<string, string[]>;
  items: { id: string; text: string; scale: string }[];
  axisOrder: string[];
  axisLabels: Record<string, string>;
  axisItemCounts: Record<string, number>;
  categoryMap: Record<string, string>;
  categoryColors: Record<string, string>;
  stimulusSubcats: Record<string, string>;
  stimulusSubcatOrder: string[];
  stimulusSubcatColors: Record<string, string>;
}

type Mode = 'single' | 'addition' | 'subtraction';

interface LNode extends RawNode {
  x0: number; x1: number; y0: number; y1: number;
}

interface LLink {
  source: number; target: number; value: number;
  itemIds: string[]; categories: string[];
  sy0: number; sy1: number; ty0: number; ty1: number;
  path: string; color: string;
}

/* ─── Layout with barycentric reordering ────────────────────────── */

const CAT_ORDER = [
  'Overload', 'Aversion', 'Coping', 'Perceptual Sensitivity',
  'Affective and Aesthetic', 'Social Cognition and Empathy',
  'Cognitive Processing', 'Other Descriptors',
];

function layout(data: SankeyData, W: number, H: number) {
  const PT = 52, PB = 60, PL = 80, PR = 160;
  const NW = 12, NP = 3;
  const iW = W - PL - PR, iH = H - PT - PB;

  // Group by column
  const cols = new Map<number, RawNode[]>();
  for (const n of data.nodes) {
    if (!cols.has(n.column)) cols.set(n.column, []);
    cols.get(n.column)!.push(n);
  }
  const ck = [...cols.keys()].sort((a, b) => a - b);
  const nc = ck.length;
  const gap = nc > 1 ? (iW - NW * nc) / (nc - 1) : 0;

  // Flow per node
  const flow = new Map<number, number>();
  for (const n of data.nodes) {
    let inf = 0, outf = 0;
    for (const l of data.links) {
      if (l.target === n.id) inf += l.value;
      if (l.source === n.id) outf += l.value;
    }
    flow.set(n.id, Math.max(inf, outf, 1));
  }

  const nm = new Map<number, LNode>();
  const lnodes: LNode[] = [];

  // Initial ordering for first and last columns
  // First column (Stimulus): sort by subcategory order, then by value
  // Last column (DerivedPrimary): sort by category order, then by value
  const subcatOrd = data.stimulusSubcatOrder;

  for (const c of ck) {
    const arr = cols.get(c)!;
    const ci = ck.indexOf(c);
    const x = PL + ci * (NW + gap);
    const tf = arr.reduce((s, n) => s + (flow.get(n.id) || 1), 0);
    const tp = (arr.length - 1) * NP;
    const sc = (iH - tp) / Math.max(tf, 1);

    if (c === ck[0]) {
      // Stimulus: sort by subcategory, then value
      arr.sort((a, b) => {
        const sa = subcatOrd.indexOf(a.subcategory || 'Missing');
        const sb = subcatOrd.indexOf(b.subcategory || 'Missing');
        if (sa !== sb) return sa - sb;
        return a.value.localeCompare(b.value);
      });
    } else if (c === ck[ck.length - 1]) {
      // Primary Code: sort by category
      arr.sort((a, b) => {
        const ca = CAT_ORDER.indexOf(a.category || '');
        const cb = CAT_ORDER.indexOf(b.category || '');
        if (ca !== cb) return ca - cb;
        return a.value.localeCompare(b.value);
      });
    } else {
      // Middle columns: sort by flow desc initially
      arr.sort((a, b) => (flow.get(b.id) || 0) - (flow.get(a.id) || 0));
    }

    let y = PT;
    for (const n of arr) {
      const h = Math.max((flow.get(n.id) || 1) * sc, 2);
      const ln: LNode = { ...n, x0: x, x1: x + NW, y0: y, y1: y + h };
      lnodes.push(ln);
      nm.set(n.id, ln);
      y += h + NP;
    }
  }

  // Barycentric reordering for middle columns
  const middleCols = ck.filter(c => c !== ck[0] && c !== ck[ck.length - 1]);

  for (let iter = 0; iter < 4; iter++) {
    for (const c of middleCols) {
      const arr = cols.get(c)!;

      // Compute barycenter for each node
      const bary: Map<number, number> = new Map();
      for (const n of arr) {
        let totalWeight = 0;
        let weightedPos = 0;

        // Look at links from previous column
        for (const l of data.links) {
          if (l.target === n.id) {
            const sn = nm.get(l.source);
            if (sn) {
              const center = (sn.y0 + sn.y1) / 2;
              weightedPos += center * l.value;
              totalWeight += l.value;
            }
          }
        }
        // Look at links to next column
        for (const l of data.links) {
          if (l.source === n.id) {
            const tn = nm.get(l.target);
            if (tn) {
              const center = (tn.y0 + tn.y1) / 2;
              weightedPos += center * l.value;
              totalWeight += l.value;
            }
          }
        }

        const curNode = nm.get(n.id);
        bary.set(n.id, totalWeight > 0 ? weightedPos / totalWeight : (curNode ? (curNode.y0 + curNode.y1) / 2 : 0));
      }

      // Sort by barycenter
      arr.sort((a, b) => (bary.get(a.id) || 0) - (bary.get(b.id) || 0));

      // Recompute y positions
      const tf = arr.reduce((s, n) => s + (flow.get(n.id) || 1), 0);
      const tp = (arr.length - 1) * NP;
      const sc = (iH - tp) / Math.max(tf, 1);

      let y = PT;
      for (const n of arr) {
        const h = Math.max((flow.get(n.id) || 1) * sc, 2);
        const prev = nm.get(n.id)!;
        const ln: LNode = { ...n, x0: prev.x0, x1: prev.x1, y0: y, y1: y + h };
        nm.set(n.id, ln);
        y += h + NP;
      }
    }
  }

  // Final layout nodes
  const finalNodes: LNode[] = [];
  for (const c of ck) {
    const arr = cols.get(c)!;
    for (const n of arr) {
      finalNodes.push(nm.get(n.id)!);
    }
  }

  // Compute link geometry
  // For links with multiple categories, split into sub-links
  const allLinks: LLink[] = [];
  const so = new Map<number, number>(), to = new Map<number, number>();
  for (const n of finalNodes) { so.set(n.id, n.y0); to.set(n.id, n.y0); }

  // Sort links
  const sortedLinks = [...data.links].sort((a, b) => {
    const sa = nm.get(a.source), sb = nm.get(b.source);
    const ta = nm.get(a.target), tb = nm.get(b.target);
    if (!sa || !sb || !ta || !tb) return 0;
    return sa.y0 !== sb.y0 ? sa.y0 - sb.y0 : ta.y0 - tb.y0;
  });

  for (const l of sortedLinks) {
    const sn = nm.get(l.source), tn = nm.get(l.target);
    if (!sn || !tn) continue;

    const stot = data.links.filter(x => x.source === l.source).reduce((s, x) => s + x.value, 0);
    const ttot = data.links.filter(x => x.target === l.target).reduce((s, x) => s + x.value, 0);
    const sH = sn.y1 - sn.y0, tH = tn.y1 - tn.y0;
    const lsh = (l.value / Math.max(stot, 1)) * sH;
    const lth = (l.value / Math.max(ttot, 1)) * tH;
    const sy0 = so.get(l.source)!, ty0 = to.get(l.target)!;

    // Determine link color: use the dominant category
    let linkColor = '#808080';
    if (l.categories.length > 0) {
      // Count items per category
      const catCounts: Record<string, number> = {};
      for (const cat of l.categories) catCounts[cat] = 0;
      for (const itemId of l.itemIds) {
        const item = data.items.find(it => it.id === itemId);
        if (item) {
          // Find which categories this item's primary codes belong to
          // We need to look at the nodeItems for the last column
        }
      }
      // Use first category color
      linkColor = data.categoryColors[l.categories[0]] || '#808080';
    }

    const xi = (sn.x1 + tn.x0) / 2;
    const path = [
      `M${sn.x1},${sy0}`,
      `C${xi},${sy0} ${xi},${ty0} ${tn.x0},${ty0}`,
      `L${tn.x0},${ty0 + lth}`,
      `C${xi},${ty0 + lth} ${xi},${sy0 + lsh} ${sn.x1},${sy0 + lsh}`,
      'Z'
    ].join(' ');

    allLinks.push({
      ...l, sy0, sy1: sy0 + lsh, ty0, ty1: ty0 + lth, path, color: linkColor,
    });

    so.set(l.source, sy0 + lsh);
    to.set(l.target, ty0 + lth);
  }

  return { nodes: finalNodes, links: allLinks, nm };
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function SankeyChart() {
  const [data, setData] = useState<SankeyData | null>(null);
  const [mode, setMode] = useState<Mode>('single');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [hovNode, setHovNode] = useState<number | null>(null);
  const [hovLink, setHovLink] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  const [dims, setDims] = useState({ w: 1600, h: 900 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/sankey-data.json').then(r => r.json()).then(setData).catch(console.error); }, []);

  useEffect(() => {
    const fn = () => {
      if (ref.current) setDims({ w: ref.current.clientWidth, h: Math.max(700, window.innerHeight) });
    };
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const L = useMemo(() => data ? layout(data, dims.w, dims.h) : null, [data, dims]);

  // Active set
  const active = useMemo(() => {
    if (!L || !data || sel.size === 0) return null;
    const ids = new Set<string>();
    for (const nid of sel) for (const id of data.nodeItems[String(nid)] || []) ids.add(id);
    const an = new Set<number>(), al = new Set<number>();
    for (const n of L.nodes) if ((data.nodeItems[String(n.id)] || []).some(id => ids.has(id))) an.add(n.id);
    for (let i = 0; i < L.links.length; i++) if (L.links[i].itemIds.some(id => ids.has(id))) al.add(i);
    return { an, al, ids };
  }, [L, sel, data]);

  const click = useCallback((nid: number) => {
    setSel(prev => {
      const s = new Set(prev);
      if (mode === 'single') { s.clear(); s.add(nid); }
      else { s.has(nid) ? s.delete(nid) : s.add(nid); }
      return s;
    });
  }, [mode]);

  const nOp = (id: number) => !active ? 1 : active.an.has(id) ? 1 : 0.08;
  const lOp = (i: number) => {
    if (hovLink === i) return 0.7;
    return !active ? 0.3 : active.al.has(i) ? 0.5 : 0.02;
  };

  const showTip = useCallback((e: React.MouseEvent, html: string) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTip({ x: e.clientX - r.left + 14, y: e.clientY - r.top - 8, html });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  // Axis labels with counts
  const axLbl = useMemo(() => {
    if (!L) return [];
    const seen = new Set<string>();
    const res: { axis: string; label: string; x: number; count: number }[] = [];
    for (const n of L.nodes) {
      if (!seen.has(n.axis)) {
        seen.add(n.axis);
        res.push({
          axis: n.axis,
          label: data?.axisLabels[n.axis] || n.axis,
          x: (n.x0 + n.x1) / 2,
          count: data?.axisItemCounts[n.axis] || 0,
        });
      }
    }
    return res;
  }, [L, data]);

  // Stimulus subcategory groups
  const stimGroups = useMemo(() => {
    if (!L || !data) return [];
    const stimNodes = L.nodes.filter(n => n.axis === 'Stimulus');
    const groups: { subcat: string; color: string; y0: number; y1: number }[] = [];
    let cc = '', st = 0;
    for (let i = 0; i < stimNodes.length; i++) {
      const sc = stimNodes[i].subcategory || 'Missing';
      if (sc !== cc) {
        if (cc) groups.push({ subcat: cc, color: data.stimulusSubcatColors[cc] || '#999', y0: stimNodes[st].y0 - 1, y1: stimNodes[i - 1].y1 + 1 });
        cc = sc; st = i;
      }
      if (i === stimNodes.length - 1) groups.push({ subcat: cc, color: data.stimulusSubcatColors[cc] || '#999', y0: stimNodes[st].y0 - 1, y1: stimNodes[i].y1 + 1 });
    }
    return groups;
  }, [L, data]);

  // Category groups (last column)
  const catGroups = useMemo(() => {
    if (!L || !data) return [];
    const last = L.nodes.filter(n => n.axis === 'DerivedPrimary');
    const gs: { cat: string; color: string; y0: number; y1: number }[] = [];
    let cc = '', st = 0;
    for (let i = 0; i < last.length; i++) {
      const c = last[i].category || 'Other';
      if (c !== cc) {
        if (cc) gs.push({ cat: cc, color: data.categoryColors[cc] || '#999', y0: last[st].y0 - 1, y1: last[i - 1].y1 + 1 });
        cc = c; st = i;
      }
      if (i === last.length - 1) gs.push({ cat: cc, color: data.categoryColors[cc] || '#999', y0: last[st].y0 - 1, y1: last[i].y1 + 1 });
    }
    return gs;
  }, [L, data]);

  const selItems = useMemo(() => {
    if (!data || !active) return [];
    return data.items.filter(it => active.ids.has(it.id));
  }, [data, active]);

  if (!data || !L) return <div className="flex items-center justify-center h-screen"><p className="text-muted-foreground animate-pulse">Loading...</p></div>;

  return (
    <div ref={ref} className="relative w-full h-screen bg-white overflow-auto select-none">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-gray-900 tracking-tight">
            SPS Items (v3.13) — axis composition of each Derived Primary Code
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5">
            6-axis schema: Stimulus | Process | Outcome &amp; Appraised Valence | Response | Cognitive Disposition | Primary Code. &ldquo;&mdash;&rdquo; skipped per item, middle axes barycentrically reordered. Ribbon color = primary-code category.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          {(['single', 'addition', 'subtraction'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setSel(new Set()); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-all ${
                mode === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}>
              {m === 'single' ? 'Single' : m === 'addition' ? 'Addition' : 'Subtraction'}
            </button>
          ))}
          {sel.size > 0 && (
            <button onClick={() => setSel(new Set())}
              className="ml-1 px-2.5 py-1 text-[11px] font-medium rounded border border-gray-300 text-gray-500 hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SVG */}
      <svg width={dims.w} height={dims.h} className="block">
        {/* Stimulus subcategory side bars */}
        {stimGroups.map((g, i) => {
          const firstStim = L.nodes.find(n => n.axis === 'Stimulus');
          const barX = (firstStim?.x0 || 0) - 18;
          const my = (g.y0 + g.y1) / 2;
          return (
            <g key={`sg${i}`}>
              <rect x={barX} y={g.y0} width={10} height={g.y1 - g.y0} fill={g.color} rx={2} opacity={0.85} />
              <text x={barX - 4} y={my} textAnchor="end" dominantBaseline="middle"
                fill={g.color} fontSize={10} fontWeight={600} fontFamily="system-ui,sans-serif"
                transform={`rotate(-90, ${barX - 4}, ${my})`}>
                {g.subcat}
              </text>
            </g>
          );
        })}

        {/* Axis headers with counts */}
        {axLbl.map(({ axis, label, x, count }) => (
          <g key={axis}>
            <text x={x} y={20} textAnchor="middle" fill="#374151"
              fontSize={12} fontWeight={700} fontFamily="system-ui,sans-serif">
              {label}
            </text>
            <text x={x} y={34} textAnchor="middle" fill="#6B7280"
              fontSize={10} fontFamily="system-ui,sans-serif">
              (n={count})
            </text>
          </g>
        ))}

        {/* Category side bars (right) */}
        {catGroups.map((g, i) => {
          const lastNode = L.nodes.find(n => n.axis === 'DerivedPrimary');
          const barX = (lastNode?.x1 || 0) + 8;
          const my = (g.y0 + g.y1) / 2;
          return (
            <g key={`cg${i}`}>
              <rect x={barX} y={g.y0} width={8} height={g.y1 - g.y0} fill={g.color} rx={1} opacity={0.85} />
              <text x={barX + 14} y={my} dominantBaseline="middle"
                fill={g.color} fontSize={9.5} fontWeight={600} fontFamily="system-ui,sans-serif"
                transform={`rotate(-90, ${barX + 14}, ${my})`}>
                {g.cat}
              </text>
            </g>
          );
        })}

        {/* Links */}
        <g>
          {L.links.map((l, i) => (
            <path key={i} d={l.path} fill={l.color} opacity={lOp(i)} stroke="none"
              className="transition-opacity duration-150 cursor-pointer"
              onMouseEnter={e => {
                setHovLink(i);
                const sn = L.nm.get(l.source), tn = L.nm.get(l.target);
                showTip(e, `<b>${sn?.value}</b> → <b>${tn?.value}</b><br/>${l.itemIds.length} item(s)<br/>Categories: ${l.categories.join(', ')}`);
              }}
              onMouseMove={e => {
                const sn = L.nm.get(l.source), tn = L.nm.get(l.target);
                showTip(e, `<b>${sn?.value}</b> → <b>${tn?.value}</b><br/>${l.itemIds.length} item(s)<br/>Categories: ${l.categories.join(', ')}`);
              }}
              onMouseLeave={() => { setHovLink(null); hideTip(); }}
            />
          ))}
        </g>

        {/* Nodes */}
        <g>
          {L.nodes.map(n => {
            const op = nOp(n.id);
            const isSel = sel.has(n.id);
            const isHov = hovNode === n.id;
            const h = n.y1 - n.y0;
            const isLast = n.axis === 'DerivedPrimary';
            const lx = isLast ? n.x1 + 5 : n.x0 - 4;
            const anch = isLast ? 'start' : 'end';

            return (
              <g key={n.id} className="cursor-pointer"
                onClick={() => click(n.id)}
                onMouseEnter={e => {
                  setHovNode(n.id);
                  const its = data.nodeItems[String(n.id)] || [];
                  showTip(e, `<b>${n.value}</b><br/>${data.axisLabels[n.axis] || n.axis}<br/>${its.length} item(s)`);
                }}
                onMouseMove={e => {
                  const its = data.nodeItems[String(n.id)] || [];
                  showTip(e, `<b>${n.value}</b><br/>${data.axisLabels[n.axis] || n.axis}<br/>${its.length} item(s)`);
                }}
                onMouseLeave={() => { setHovNode(null); hideTip(); }}
              >
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={h} fill={n.color}
                  opacity={op} rx={1}
                  stroke={isSel ? '#111' : isHov ? '#555' : 'none'}
                  strokeWidth={isSel ? 1.5 : 0.5}
                  className="transition-opacity duration-150" />
                {h > 6 && (
                  <text x={lx} y={(n.y0 + n.y1) / 2} textAnchor={anch} dominantBaseline="middle"
                    fill="#374151" fontSize={h > 14 ? 9 : 7} fontFamily="system-ui,sans-serif"
                    opacity={op < 0.3 ? 0.15 : 0.8} className="pointer-events-none">
                    {n.value.length > 22 ? n.value.slice(0, 20) + '…' : n.value}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tip && (
        <div className="absolute z-50 pointer-events-none px-2.5 py-1.5 rounded text-[11px] leading-relaxed shadow-lg border border-gray-200 bg-white"
          style={{ left: Math.min(tip.x, dims.w - 260), top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}

      {/* Bottom legend */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-5 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-700">Primary-code category:</span>
          {CAT_ORDER.map(cat => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: data.categoryColors[cat] || '#999' }} />
              <span className="text-[10px] text-gray-600">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom panel: selected items */}
      {sel.size > 0 && active && (
        <div className="fixed bottom-8 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 max-h-[160px] overflow-auto">
          <div className="px-5 py-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-900">{selItems.length} item(s)</span>
              {Array.from(sel).map(id => {
                const n = L.nm.get(id);
                return n ? <span key={id} className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: n.color }}>{n.value}</span> : null;
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5">
              {selItems.slice(0, 20).map(it => (
                <div key={it.id} className="text-[10px] text-gray-600 leading-snug truncate">
                  <span className="font-medium text-gray-800">{it.id}</span> {it.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
