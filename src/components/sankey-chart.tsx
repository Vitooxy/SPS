'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { buildLinkPath } from '@/lib/sankey-layout';

/* ─── Types ─────────────────────────────────────────────────────── */

interface RawNode {
  id: number;
  axis: string;
  value: string;
  column: number;
  category: string | null;
  color: string;
}
interface RawLink {
  source: number;
  target: number;
  value: number;
  itemIds: string[];
}
interface SankeyData {
  nodes: RawNode[];
  links: RawLink[];
  nodeItems: Record<string, string[]>;
  items: { id: string; text: string; scale: string }[];
  axisOrder: string[];
  axisLabels: Record<string, string>;
  categoryMap: Record<string, string>;
  categoryColors: Record<string, string>;
}
type Mode = 'single' | 'addition' | 'subtraction';

interface LNode extends RawNode {
  x0: number; x1: number; y0: number; y1: number;
}
interface LLink extends RawLink {
  sy0: number; sy1: number; ty0: number; ty1: number; path: string;
}

/* ─── Layout ────────────────────────────────────────────────────── */

function layout(data: SankeyData, W: number, H: number) {
  const PT = 52, PB = 20, PL = 20, PR = 210;
  const NW = 14, NP = 4;
  const iW = W - PL - PR, iH = H - PT - PB;

  // group by column
  const cols = new Map<number, RawNode[]>();
  for (const n of data.nodes) {
    if (!cols.has(n.column)) cols.set(n.column, []);
    cols.get(n.column)!.push(n);
  }
  const ck = [...cols.keys()].sort((a, b) => a - b);
  const nc = ck.length;
  const gap = nc > 1 ? (iW - NW * nc) / (nc - 1) : 0;

  // flow per node
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

  for (const c of ck) {
    const arr = cols.get(c)!;
    const ci = ck.indexOf(c);
    const x = PL + ci * (NW + gap);
    const tf = arr.reduce((s, n) => s + (flow.get(n.id) || 1), 0);
    const tp = (arr.length - 1) * NP;
    const sc = (iH - tp) / Math.max(tf, 1);

    // sort
    if (c === ck[ck.length - 1]) {
      const co = ['Overload','Aversion','Coping','Perceptual Sensitivity','Affective and Aesthetic','Social Cognition and Empathy','Cognitive Processing','Other Descriptors'];
      arr.sort((a, b) => {
        const ca = co.indexOf(a.category || ''), cb = co.indexOf(b.category || '');
        return ca !== cb ? ca - cb : a.value.localeCompare(b.value);
      });
    } else {
      arr.sort((a, b) => (flow.get(b.id) || 0) - (flow.get(a.id) || 0));
    }

    let y = PT;
    for (const n of arr) {
      const h = Math.max((flow.get(n.id) || 1) * sc, 2.5);
      const ln: LNode = { ...n, x0: x, x1: x + NW, y0: y, y1: y + h };
      lnodes.push(ln);
      nm.set(n.id, ln);
      y += h + NP;
    }
  }

  // links
  const so = new Map<number, number>(), to = new Map<number, number>();
  for (const n of lnodes) { so.set(n.id, n.y0); to.set(n.id, n.y0); }

  const sl = [...data.links].sort((a, b) => {
    const sa = nm.get(a.source), sb = nm.get(b.source);
    const ta = nm.get(a.target), tb = nm.get(b.target);
    if (!sa || !sb || !ta || !tb) return 0;
    return sa.y0 !== sb.y0 ? sa.y0 - sb.y0 : ta.y0 - tb.y0;
  });

  const llinks: LLink[] = [];
  for (const l of sl) {
    const sn = nm.get(l.source), tn = nm.get(l.target);
    if (!sn || !tn) continue;
    const stot = data.links.filter(x => x.source === l.source).reduce((s, x) => s + x.value, 0);
    const ttot = data.links.filter(x => x.target === l.target).reduce((s, x) => s + x.value, 0);
    const sH = sn.y1 - sn.y0, tH = tn.y1 - tn.y0;
    const lsh = (l.value / Math.max(stot, 1)) * sH;
    const lth = (l.value / Math.max(ttot, 1)) * tH;
    const sy0 = so.get(l.source)!, ty0 = to.get(l.target)!;
    llinks.push({
      ...l, sy0, sy1: sy0 + lsh, ty0, ty1: ty0 + lth,
      path: buildLinkPath(sn.x1, sy0, sy0 + lsh, tn.x0, ty0, ty0 + lth),
    });
    so.set(l.source, sy0 + lsh);
    to.set(l.target, ty0 + lth);
  }

  return { nodes: lnodes, links: llinks, nm };
}

/* ─── Constants ─────────────────────────────────────────────────── */

const CAT_ORDER = ['Overload','Aversion','Coping','Perceptual Sensitivity','Affective and Aesthetic','Social Cognition and Empathy','Cognitive Processing','Other Descriptors'];

const CAT_LABEL: Record<string, string[]> = {
  'Overload': ['Overload'],
  'Aversion': ['Aversion'],
  'Coping': ['Coping'],
  'Perceptual Sensitivity': ['Perceptual', 'Sensitivity'],
  'Affective and Aesthetic': ['Affective &', 'Aesthetic'],
  'Social Cognition and Empathy': ['Social Cognition', '& Empathy'],
  'Cognitive Processing': ['Cognitive', 'Processing'],
  'Other Descriptors': ['Other'],
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function SankeyChart() {
  const [data, setData] = useState<SankeyData | null>(null);
  const [mode, setMode] = useState<Mode>('single');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [hovNode, setHovNode] = useState<number | null>(null);
  const [hovLink, setHovLink] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  const [dims, setDims] = useState({ w: 1400, h: 800 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/sankey-data.json').then(r => r.json()).then(setData).catch(console.error); }, []);

  useEffect(() => {
    const fn = () => {
      if (ref.current) setDims({ w: ref.current.clientWidth, h: Math.max(680, window.innerHeight) });
    };
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const L = useMemo(() => data ? layout(data, dims.w, dims.h) : null, [data, dims]);

  // active set
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
      if (mode === 'single') {
        s.clear(); s.add(nid);
      } else {
        s.has(nid) ? s.delete(nid) : s.add(nid);
      }
      return s;
    });
  }, [mode]);

  const nOp = (id: number) => !active ? 1 : active.an.has(id) ? 1 : 0.08;
  const lOp = (i: number) => {
    if (hovLink === i) return 0.65;
    return !active ? 0.22 : active.al.has(i) ? 0.42 : 0.02;
  };

  const showTip = useCallback((e: React.MouseEvent, html: string) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTip({ x: e.clientX - r.left + 14, y: e.clientY - r.top - 8, html });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  // axis labels
  const axLbl = useMemo(() => {
    if (!L) return [];
    const seen = new Set<string>();
    const res: { axis: string; label: string; x: number }[] = [];
    for (const n of L.nodes) {
      if (!seen.has(n.axis)) {
        seen.add(n.axis);
        res.push({ axis: n.axis, label: data?.axisLabels[n.axis] || n.axis, x: (n.x0 + n.x1) / 2 });
      }
    }
    return res;
  }, [L, data]);

  // category groups
  const cats = useMemo(() => {
    if (!L || !data) return [];
    const last = L.nodes.filter(n => n.axis === 'DerivedPrimary');
    const gs: { cat: string; color: string; y0: number; y1: number; x: number }[] = [];
    let cc = '', st = 0;
    const lx = last[0]?.x1 || 0;
    for (let i = 0; i < last.length; i++) {
      const c = last[i].category || 'Other';
      if (c !== cc) {
        if (cc) gs.push({ cat: cc, color: data.categoryColors[cc] || '#999', y0: last[st].y0 - 2, y1: last[i - 1].y1 + 2, x: lx });
        cc = c; st = i;
      }
      if (i === last.length - 1) gs.push({ cat: cc, color: data.categoryColors[cc] || '#999', y0: last[st].y0 - 2, y1: last[i].y1 + 2, x: lx });
    }
    return gs;
  }, [L, data]);

  // selected items
  const selItems = useMemo(() => {
    if (!data || !active) return [];
    return data.items.filter(it => active.ids.has(it.id));
  }, [data, active]);

  if (!data || !L) return <div className="flex items-center justify-center h-screen"><p className="text-muted-foreground animate-pulse">Loading...</p></div>;

  return (
    <div ref={ref} className="relative w-full h-screen bg-background overflow-auto select-none">
      {/* ── Header bar ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-2.5 bg-background/90 backdrop-blur-sm border-b border-border/40">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
            SPS Item Coding Framework — 6-Axis Alluvial Diagram
          </h1>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            141 items · Modality &amp; Configuration merged as Stimulus · &quot;-&quot; values removed
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          {(['single', 'addition', 'subtraction'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setSel(new Set()); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-all ${
                mode === m ? 'bg-foreground text-background border-foreground shadow-sm' : 'bg-card text-foreground border-border hover:bg-accent'
              }`}>
              {m === 'single' ? 'Single' : m === 'addition' ? 'Addition' : 'Subtraction'}
            </button>
          ))}
          {sel.size > 0 && (
            <button onClick={() => setSel(new Set())}
              className="ml-1 px-2.5 py-1 text-[11px] font-medium rounded border border-border text-muted-foreground hover:bg-accent transition-all">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── SVG ── */}
      <svg width={dims.w} height={dims.h} className="block">
        {/* axis headers */}
        {axLbl.map(({ axis, label, x }) => (
          <text key={axis} x={x} y={24} textAnchor="middle" fill="hsl(var(--foreground))"
            fontSize={11} fontWeight={600} fontFamily="system-ui,sans-serif" letterSpacing="0.03em" opacity={0.7}>
            {label}
          </text>
        ))}

        {/* category brackets */}
        {cats.map((g, i) => {
          const bx = g.x + 6;
          const my = (g.y0 + g.y1) / 2;
          const lines = CAT_LABEL[g.cat] || [g.cat];
          return (
            <g key={`cg${i}`}>
              <line x1={bx} y1={g.y0} x2={bx} y2={g.y1} stroke={g.color} strokeWidth={1.5} opacity={0.45} />
              <line x1={bx} y1={g.y0} x2={bx + 3} y2={g.y0} stroke={g.color} strokeWidth={1.5} opacity={0.45} />
              <line x1={bx} y1={g.y1} x2={bx + 3} y2={g.y1} stroke={g.color} strokeWidth={1.5} opacity={0.45} />
              <text x={bx + 8} y={my} dominantBaseline="middle" fill={g.color} fontSize={9.5} fontWeight={600} fontFamily="system-ui,sans-serif">
                {lines.map((ln, li) => (
                  <tspan key={li} x={bx + 8} dy={li === 0 ? -((lines.length - 1) * 5.5) : 11}>{ln}</tspan>
                ))}
              </text>
            </g>
          );
        })}

        {/* links */}
        <g>
          {L.links.map((l, i) => {
            const sn = L.nm.get(l.source);
            return (
              <path key={i} d={l.path} fill={sn?.color || '#999'} opacity={lOp(i)} stroke="none"
                className="transition-opacity duration-150 cursor-pointer"
                onMouseEnter={e => { setHovLink(i); const tn = L.nm.get(l.target); showTip(e, `<b>${sn?.value}</b> → <b>${tn?.value}</b><br/>${l.itemIds.length} item(s)`); }}
                onMouseMove={e => { const tn = L.nm.get(l.target); showTip(e, `<b>${sn?.value}</b> → <b>${tn?.value}</b><br/>${l.itemIds.length} item(s)`); }}
                onMouseLeave={() => { setHovLink(null); hideTip(); }}
              />
            );
          })}
        </g>

        {/* nodes */}
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
                onMouseEnter={e => { setHovNode(n.id); const its = data.nodeItems[String(n.id)] || []; showTip(e, `<b>${n.value}</b><br/>${data.axisLabels[n.axis] || n.axis}<br/>${its.length} item(s)`); }}
                onMouseMove={e => { const its = data.nodeItems[String(n.id)] || []; showTip(e, `<b>${n.value}</b><br/>${data.axisLabels[n.axis] || n.axis}<br/>${its.length} item(s)`); }}
                onMouseLeave={() => { setHovNode(null); hideTip(); }}
              >
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={h} fill={n.color}
                  opacity={op} rx={1.5}
                  stroke={isSel ? 'hsl(var(--foreground))' : isHov ? 'hsl(var(--foreground)/0.5)' : 'none'}
                  strokeWidth={isSel ? 1.5 : 0.5}
                  className="transition-opacity duration-150" />
                {h > 7 && (
                  <text x={lx} y={(n.y0 + n.y1) / 2} textAnchor={anch} dominantBaseline="middle"
                    fill="hsl(var(--foreground))" fontSize={h > 16 ? 9.5 : 7.5} fontFamily="system-ui,sans-serif"
                    opacity={op < 0.3 ? 0.15 : 0.75} className="pointer-events-none transition-opacity duration-150">
                    {n.value.length > 24 ? n.value.slice(0, 22) + '…' : n.value}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Tooltip ── */}
      {tip && (
        <div className="absolute z-50 pointer-events-none px-2.5 py-1.5 rounded text-[11px] leading-relaxed shadow-lg border border-border/40"
          style={{ left: Math.min(tip.x, dims.w - 240), top: tip.y, background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}

      {/* ── Bottom panel ── */}
      {sel.size > 0 && active && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t border-border max-h-[180px] overflow-auto">
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-foreground">{selItems.length} item(s)</span>
              {Array.from(sel).map(id => {
                const n = L.nm.get(id);
                return n ? <span key={id} className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: n.color }}>{n.value}</span> : null;
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5">
              {selItems.slice(0, 24).map(it => (
                <div key={it.id} className="text-[10px] text-muted-foreground leading-snug truncate">
                  <span className="font-medium text-foreground/60">{it.id}</span> {it.text}
                </div>
              ))}
            </div>
            {selItems.length > 24 && <p className="text-[9px] text-muted-foreground mt-1">+{selItems.length - 24} more…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
