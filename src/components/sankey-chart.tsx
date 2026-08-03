'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

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
}

interface RawItemLink {
  itemId: string;
  source: number;
  target: number;
  category: string;
  color: string;
}

interface RawItem {
  id: string;
  text: string;
  scale: string;
  derivedPrimary: string[];
  category: string;
  values: Record<string, string[]>;
}

interface SankeyData {
  nodes: RawNode[];
  links: RawLink[];
  itemLinks: RawItemLink[];
  nodeItems: Record<string, string[]>;
  items: RawItem[];
  axisOrder: string[];
  axisLabels: Record<string, string>;
  axisItemCounts: Record<string, number>;
  categoryColors: Record<string, string>;
  stimulusSubcats: Record<string, string>;
  stimulusSubcatOrder: string[];
  stimulusSubcatColors: Record<string, string>;
}

interface LayoutNode extends RawNode {
  x: number;
  y: number;
  height: number;
  width: number;
}

interface LayoutLink extends RawLink {
  sy0: number;
  sy1: number;
  ty0: number;
  ty1: number;
  width: number;
}

interface LayoutItemLink extends RawItemLink {
  path: string;
  sy: number;
  ty: number;
  lineWidth: number;
  pathIndex: number;
}

type InteractionMode = 'single' | 'addition' | 'subtraction';

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_WIDTH = 12;
const NODE_GAP = 3;
const SUBCAT_BAR_WIDTH = 10;
const SUBCAT_BAR_GAP = 2;
const CHART_PADDING = { top: 50, bottom: 160, left: 200, right: 210 };
const ITEM_LINE_MIN_WIDTH = 1.5;

// ─── Layout Engine ───────────────────────────────────────────────────────────

function computeLayout(
  data: SankeyData,
  width: number,
  height: number,
): { nodes: LayoutNode[]; links: LayoutLink[]; nodeKeyToId: Map<string, number> } {
  const { nodes, links, axisOrder } = data;
  const chartW = width - CHART_PADDING.left - CHART_PADDING.right;
  const chartH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Group nodes by column (preserve order from JSON data)
  const columns: RawNode[][] = axisOrder.map(() => []);
  for (const node of nodes) {
    columns[node.column].push(node);
  }

  // Compute node heights based on aggregated link flow
  const nodeFlow = new Map<number, number>();
  for (const link of links) {
    nodeFlow.set(link.source, (nodeFlow.get(link.source) || 0) + link.value);
    nodeFlow.set(link.target, (nodeFlow.get(link.target) || 0) + link.value);
  }

  // Assign x positions
  const colSpacing = chartW / (axisOrder.length - 1);
  for (let col = 0; col < columns.length; col++) {
    for (const node of columns[col]) {
      (node as LayoutNode).x = CHART_PADDING.left + col * colSpacing - NODE_WIDTH / 2;
      (node as LayoutNode).width = NODE_WIDTH;
    }
  }

  // Assign y positions based on flow
  for (const col of columns) {
    const totalFlow = col.reduce((sum, n) => sum + (nodeFlow.get(n.id) || 0), 0);
    const totalGaps = (col.length - 1) * NODE_GAP;
    const availableH = chartH - totalGaps;
    const scale = totalFlow > 0 ? availableH / totalFlow : 0;

    let y = CHART_PADDING.top;
    for (const node of col) {
      const flow = nodeFlow.get(node.id) || 0;
      const h = Math.max(flow * scale, 4);
      (node as LayoutNode).y = y;
      (node as LayoutNode).height = h;
      y += h + NODE_GAP;
    }
  }

  // Compute link positions
  const sourceOffsets = new Map<number, number>();
  const targetOffsets = new Map<number, number>();
  const layoutLinks: LayoutLink[] = [];

  for (const link of links) {
    const src = nodes.find((n) => n.id === link.source) as LayoutNode;
    const tgt = nodes.find((n) => n.id === link.target) as LayoutNode;

    const srcOff = sourceOffsets.get(link.source) || 0;
    const tgtOff = targetOffsets.get(link.target) || 0;

    const srcFlow = nodeFlow.get(link.source) || 1;
    const tgtFlow = nodeFlow.get(link.target) || 1;
    const linkH_src = (link.value / srcFlow) * src.height;
    const linkH_tgt = (link.value / tgtFlow) * tgt.height;

    layoutLinks.push({
      ...link,
      sy0: src.y + srcOff,
      sy1: src.y + srcOff + linkH_src,
      ty0: tgt.y + tgtOff,
      ty1: tgt.y + tgtOff + linkH_tgt,
      width: Math.min(linkH_src, linkH_tgt),
    });

    sourceOffsets.set(link.source, srcOff + linkH_src);
    targetOffsets.set(link.target, tgtOff + linkH_tgt);
  }

  const nodeKeyToId = new Map<string, number>();
  for (const node of nodes) {
    nodeKeyToId.set(`${node.axis}::${node.value}`, node.id);
  }

  return { nodes: nodes as LayoutNode[], links: layoutLinks, nodeKeyToId };
}

// ─── Barycentric Reordering ──────────────────────────────────────────────────

function barycentricReorder(data: SankeyData, layout: { nodes: LayoutNode[]; links: LayoutLink[] }) {
  const { axisOrder } = data;
  const { nodes } = layout;

  // Build adjacency: for each node, which nodes in the next column does it connect to
  const forwardAdj = new Map<number, { nodeId: number; weight: number }[]>();
  const backwardAdj = new Map<number, { nodeId: number; weight: number }[]>();

  for (const link of layout.links) {
    if (!forwardAdj.has(link.source)) forwardAdj.set(link.source, []);
    forwardAdj.get(link.source)!.push({ nodeId: link.target, weight: link.value });
    if (!backwardAdj.has(link.target)) backwardAdj.set(link.target, []);
    backwardAdj.get(link.target)!.push({ nodeId: link.source, weight: link.value });
  }

  // Reorder columns 1 to n-2 (middle columns only) using barycentric heuristic
  // First column (Stimulus) and last column (Primary Code) preserve their order from data
  for (let iter = 0; iter < 4; iter++) {
    // Forward pass: reorder based on previous column
    for (let col = 1; col < axisOrder.length - 1; col++) {
      const colNodes = nodes.filter((n) => n.column === col);
      const prevColNodes = nodes.filter((n) => n.column === col - 1);

      for (const node of colNodes) {
        const adj = backwardAdj.get(node.id) || [];
        let barycenter = 0;
        let totalWeight = 0;
        for (const { nodeId, weight } of adj) {
          const prevNode = prevColNodes.find((n) => n.id === nodeId);
          if (prevNode) {
            barycenter += (prevNode.y + prevNode.height / 2) * weight;
            totalWeight += weight;
          }
        }
        (node as any)._barycenter = totalWeight > 0 ? barycenter / totalWeight : node.y;
      }

      colNodes.sort((a, b) => (a as any)._barycenter - (b as any)._barycenter);

      // Reassign y positions
      const totalGaps = (colNodes.length - 1) * NODE_GAP;
      const totalH = colNodes.reduce((sum, n) => sum + n.height, 0);
      const chartH = 800 - CHART_PADDING.top - CHART_PADDING.bottom;
      const scale = totalH > 0 ? (chartH - totalGaps) / totalH : 0;
      let y = CHART_PADDING.top;
      for (const node of colNodes) {
        node.y = y;
        y += node.height * scale + NODE_GAP;
      }
    }
  }

  // Recompute link positions after reordering
  const sourceOffsets = new Map<number, number>();
  const targetOffsets = new Map<number, number>();

  for (const link of layout.links) {
    const src = nodes.find((n) => n.id === link.source)!;
    const tgt = nodes.find((n) => n.id === link.target)!;

    const srcOff = sourceOffsets.get(link.source) || 0;
    const tgtOff = targetOffsets.get(link.target) || 0;

    const srcFlow = layout.links
      .filter((l) => l.source === link.source)
      .reduce((s, l) => s + l.value, 0);
    const tgtFlow = layout.links
      .filter((l) => l.target === link.target)
      .reduce((s, l) => s + l.value, 0);

    const linkH_src = (link.value / srcFlow) * src.height;
    const linkH_tgt = (link.value / tgtFlow) * tgt.height;

    link.sy0 = src.y + srcOff;
    link.sy1 = src.y + srcOff + linkH_src;
    link.ty0 = tgt.y + tgtOff;
    link.ty1 = tgt.y + tgtOff + linkH_tgt;
    link.width = Math.min(linkH_src, linkH_tgt);

    sourceOffsets.set(link.source, srcOff + linkH_src);
    targetOffsets.set(link.target, tgtOff + linkH_tgt);
  }
}

// ─── Build per-item link paths ──────────────────────────────────────────────

function buildItemLinkPaths(
  layout: { nodes: LayoutNode[]; links: LayoutLink[]; nodeKeyToId: Map<string, number> },
  itemLinks: RawItemLink[],
): LayoutItemLink[] {
  const { nodes, links } = layout;

  // Group itemLinks by (source, target) to calculate offsets within each aggregated link
  const linkGroups = new Map<string, RawItemLink[]>();
  for (const il of itemLinks) {
    const key = `${il.source}-${il.target}`;
    if (!linkGroups.has(key)) linkGroups.set(key, []);
    linkGroups.get(key)!.push(il);
  }

  const result: LayoutItemLink[] = [];
  let globalIdx = 0;

  for (const [key, group] of linkGroups) {
    const aggLink = links.find(
      (l) => l.source === group[0].source && l.target === group[0].target,
    );
    if (!aggLink) continue;

    const srcNode = nodes.find((n) => n.id === aggLink.source)!;
    const tgtNode = nodes.find((n) => n.id === aggLink.target)!;

    // Total height available for this link
    const totalH_src = aggLink.sy1 - aggLink.sy0;
    const totalH_tgt = aggLink.ty1 - aggLink.ty0;

    // Each item gets equal share
    const n = group.length;
    const itemH_src = totalH_src / n;
    const itemH_tgt = totalH_tgt / n;
    const lineWidth = Math.max(ITEM_LINE_MIN_WIDTH, Math.min(itemH_src, itemH_tgt));

    for (let i = 0; i < n; i++) {
      const il = group[i];
      const sy = aggLink.sy0 + i * itemH_src + itemH_src / 2;
      const ty = aggLink.ty0 + i * itemH_tgt + itemH_tgt / 2;

      // Bezier path
      const srcX = srcNode.x + NODE_WIDTH;
      const tgtX = tgtNode.x;
      const cpX = (srcX + tgtX) / 2;

      const path = `M${srcX},${sy} C${cpX},${sy} ${cpX},${ty} ${tgtX},${ty}`;

      result.push({
        ...il,
        path,
        sy,
        ty,
        lineWidth,
        pathIndex: globalIdx++,
      });
    }
  }

  return result;
}

// ─── Subcategory grouping for Stimulus ───────────────────────────────────────

function getStimulusSubcatOrder(
  nodes: LayoutNode[],
  subcatOrder: string[],
  subcats: Record<string, string>,
): { subcat: string; nodes: LayoutNode[] }[] {
  const stimulusNodes = nodes.filter((n) => n.axis === 'Stimulus');
  const groups: { subcat: string; nodes: LayoutNode[] }[] = [];

  for (const sc of subcatOrder) {
    const groupNodes = stimulusNodes.filter((n) => subcats[n.value] === sc);
    if (groupNodes.length > 0) {
      groups.push({ subcat: sc, nodes: groupNodes });
    }
  }

  return groups;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SankeyChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SankeyData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [layout, setLayout] = useState<{
    nodes: LayoutNode[];
    links: LayoutLink[];
    itemLinkPaths: LayoutItemLink[];
    nodeKeyToId: Map<string, number>;
  } | null>(null);
  const [mode, setMode] = useState<InteractionMode>('single');
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);
  const [linkTooltip, setLinkTooltip] = useState<{
    x: number;
    y: number;
    items: RawItem[];
  } | null>(null);

  // Load data
  useEffect(() => {
    fetch('/sankey-data.json')
      .then((r) => r.json())
      .then((d: SankeyData) => {
        setData(d);
      })
      .catch((err) => console.error('Failed to load sankey data:', err));
  }, []);

  // Compute layout when data changes
  useEffect(() => {
    if (!data) return;
    const w = dimensions.width;
    const h = dimensions.height;
    const result = computeLayout(data, w, h);
    barycentricReorder(data, result);
    const itemLinkPaths = buildItemLinkPaths(result, data.itemLinks);
    setLayout({ ...result, itemLinkPaths });
  }, [data, dimensions]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({
            width: Math.max(1000, width),
            height: Math.max(600, Math.min(900, width * 0.65)),
          });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build lookup maps
  const itemsMap = useMemo(() => {
    if (!data) return {};
    const map: Record<string, RawItem> = {};
    for (const item of data.items) {
      map[item.id] = item;
    }
    return map;
  }, [data]);

  const nodeIdToKey = useMemo(() => {
    if (!layout) return {};
    const map: Record<number, string> = {};
    for (const node of layout.nodes) {
      map[node.id] = `${node.axis}::${node.value}`;
    }
    return map;
  }, [layout]);

  // Pre-compute: for each node, which itemLinks pass through it
  const nodeItemLinks = useMemo(() => {
    if (!layout) return {};
    const map: Record<number, LayoutItemLink[]> = {};
    for (const il of layout.itemLinkPaths) {
      if (!il) continue;
      if (!map[il.source]) map[il.source] = [];
      map[il.source].push(il);
      if (!map[il.target]) map[il.target] = [];
      map[il.target].push(il);
    }
    return map;
  }, [layout]);

  // Determine which itemLinks are active based on selected nodes
  const activeItemLinkSet = useMemo(() => {
    if (!layout || !data || selectedNodes.length === 0) return null;
    const activeSet = new Set<number>();

    if (mode === 'subtraction') {
      // If a category is selected (no exclusions yet), show all items for that category
      if (selectedCategory && selectedNodes.length <= 1) {
        for (let i = 0; i < layout.itemLinkPaths.length; i++) {
          const il = layout.itemLinkPaths[i];
          if (il.category === selectedCategory) {
            activeSet.add(i);
          }
        }
        return activeSet.size > 0 ? activeSet : null;
      }

      // Determine base nodes vs exclusion nodes
      // Base nodes: nodes on the rightmost column (DerivedPrimary) or the first clicked node
      // Exclusion nodes: nodes on other columns
      const maxCol = layout.nodes.reduce((max, n) => Math.max(max, n.column), 0);
      const baseNodeIds = new Set<number>();
      const excludeNodeIds = new Set<number>();

      for (const nid of selectedNodes) {
        const node = layout.nodes.find(n => n.id === nid);
        if (!node) continue;
        if (node.column === maxCol) {
          baseNodeIds.add(nid);
        } else {
          excludeNodeIds.add(nid);
        }
      }

      // If no base nodes from rightmost column, use first node as base
      if (baseNodeIds.size === 0 && selectedNodes.length > 0) {
        baseNodeIds.add(selectedNodes[0]);
      }

      // Step 1: compute base paths from all base nodes
      const baseItemIds = new Set<string>();

      for (const baseNodeId of baseNodeIds) {
        const baseNode = layout.nodes.find((n) => n.id === baseNodeId);
        if (!baseNode) continue;

        const isBaseLeftmost = baseNode.column === 0;
        const isBaseRightmost = baseNode.column === maxCol;
        const baseLinks = nodeItemLinks[baseNodeId] || [];

        if (isBaseLeftmost) {
          for (const il of baseLinks) {
            if (il.source === baseNodeId) {
              activeSet.add(il.pathIndex);
              baseItemIds.add(il.itemId);
            }
          }
        } else if (isBaseRightmost) {
          for (const il of baseLinks) {
            if (il.target === baseNodeId) {
              activeSet.add(il.pathIndex);
              baseItemIds.add(il.itemId);
            }
          }
        } else {
          for (const il of baseLinks) {
            if (il.source === baseNodeId || il.target === baseNodeId) {
              activeSet.add(il.pathIndex);
              baseItemIds.add(il.itemId);
            }
          }
        }
      }

      // Show ALL links for base items across all columns
      for (let i = 0; i < layout.itemLinkPaths.length; i++) {
        const il = layout.itemLinkPaths[i];
        if (baseItemIds.has(il.itemId)) {
          activeSet.add(i);
        }
      }

      // Step 2: remove links directly connected to excluded nodes
      if (excludeNodeIds.size > 0) {
        const filteredSet = new Set<number>();
        for (const idx of activeSet) {
          if (idx < 0 || idx >= layout.itemLinkPaths.length) continue;
          const il = layout.itemLinkPaths[idx];
          if (il && !excludeNodeIds.has(il.source) && !excludeNodeIds.has(il.target)) {
            filteredSet.add(idx);
          }
        }
        return filteredSet.size > 0 ? filteredSet : null;
      }

      return activeSet.size > 0 ? activeSet : null;
    }

    // Addition / Single mode: union of paths through selected nodes
    for (const nodeId of selectedNodes) {
      const node = layout.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const isLeftmost = node.column === 0;
      const maxCol = layout.nodes.reduce((max, n) => Math.max(max, n.column), 0);
      const isRightmost = node.column === maxCol;

      const links = nodeItemLinks[nodeId] || [];

      if (isLeftmost) {
        const itemIdsFromNode = new Set<string>();
        for (const il of links) {
          if (il.source === nodeId) {
            activeSet.add(il.pathIndex);
            itemIdsFromNode.add(il.itemId);
          }
        }
        for (let i = 0; i < layout.itemLinkPaths.length; i++) {
          const il = layout.itemLinkPaths[i];
          if (itemIdsFromNode.has(il.itemId)) {
            const srcNode = layout.nodes.find(n => n.id === il.source);
            if (srcNode && srcNode.column > 0) {
              activeSet.add(i);
            }
          }
        }
      } else if (isRightmost) {
        const itemIdsToNode = new Set<string>();
        for (const il of links) {
          if (il.target === nodeId) {
            activeSet.add(il.pathIndex);
            itemIdsToNode.add(il.itemId);
          }
        }
        for (let i = 0; i < layout.itemLinkPaths.length; i++) {
          const il = layout.itemLinkPaths[i];
          if (itemIdsToNode.has(il.itemId)) {
            const tgtNode = layout.nodes.find(n => n.id === il.target);
            if (tgtNode && tgtNode.column < maxCol) {
              activeSet.add(i);
            }
          }
        }
      } else {
        // Middle column: find all items passing through this node, then show ALL their links
        const itemIdsThroughNode = new Set<string>();
        for (const il of links) {
          if (il.source === nodeId || il.target === nodeId) {
            itemIdsThroughNode.add(il.itemId);
          }
        }
        // Now find ALL links for those items across all columns
        for (let i = 0; i < layout.itemLinkPaths.length; i++) {
          const il = layout.itemLinkPaths[i];
          if (itemIdsThroughNode.has(il.itemId)) {
            activeSet.add(i);
          }
        }
      }
    }

    // Category selection: highlight all links belonging to the selected category
    if (selectedCategory) {
      for (let i = 0; i < layout.itemLinkPaths.length; i++) {
        const il = layout.itemLinkPaths[i];
        if (il.category === selectedCategory) {
          activeSet.add(i);
        }
      }
    }

    return activeSet.size > 0 ? activeSet : null;
  }, [layout, selectedNodes, nodeItemLinks, mode, data, selectedCategory]);

  // Determine which nodes are active - only selected nodes on the same axis
  const activeNodeSet = useMemo(() => {
    if (!layout || !activeItemLinkSet) return null;
    const nodeSet = new Set<number>();

    if (mode === 'subtraction') {
      // Only highlight the base node (first selected), not exclusion nodes
      if (selectedNodes.length > 0) nodeSet.add(selectedNodes[0]);
      const excludeNodeIds = new Set(selectedNodes.slice(1));
      // Include nodes on OTHER axes that active links connect to
      const baseNode = layout.nodes.find(n => n.id === selectedNodes[0]);
      const baseColumn = baseNode?.column ?? -1;
      for (const idx of activeItemLinkSet) {
        if (idx < 0 || idx >= layout.itemLinkPaths.length) continue;
        const il = layout.itemLinkPaths[idx];
        if (!il) continue;
        const srcNode = layout.nodes.find(n => n.id === il.source);
        const tgtNode = layout.nodes.find(n => n.id === il.target);
        if (srcNode && srcNode.column !== baseColumn && !excludeNodeIds.has(il.source)) nodeSet.add(il.source);
        if (tgtNode && tgtNode.column !== baseColumn && !excludeNodeIds.has(il.target)) nodeSet.add(il.target);
      }
    } else {
      // Always include selected nodes
      for (const nid of selectedNodes) nodeSet.add(nid);
      // Include nodes on OTHER axes that active links connect to
      const selectedAxes = new Set(selectedNodes.map(nid => {
        const n = layout.nodes.find(x => x.id === nid);
        return n?.column ?? -1;
      }));
      for (const idx of activeItemLinkSet) {
        if (idx < 0 || idx >= layout.itemLinkPaths.length) continue;
        const il = layout.itemLinkPaths[idx];
        if (!il) continue;
        const srcNode = layout.nodes.find(n => n.id === il.source);
        const tgtNode = layout.nodes.find(n => n.id === il.target);
        if (srcNode && !selectedAxes.has(srcNode.column)) nodeSet.add(il.source);
        if (tgtNode && !selectedAxes.has(tgtNode.column)) nodeSet.add(il.target);
      }
    }

    // Category selection: highlight all nodes belonging to the selected category
    if (selectedCategory) {
      for (const node of layout.nodes) {
        if (node.category === selectedCategory) nodeSet.add(node.id);
      }
    }

    return nodeSet;
  }, [layout, activeItemLinkSet, selectedNodes, mode, selectedCategory]);

  // Compute active item IDs from activeItemLinkSet (for bottom panel)
  const activeItemIds = useMemo(() => {
    if (!activeItemLinkSet || !layout) return null;
    const ids = new Set<string>();
    for (const idx of activeItemLinkSet) {
      if (idx < 0 || idx >= layout.itemLinkPaths.length) continue;
      const il = layout.itemLinkPaths[idx];
      if (il) ids.add(il.itemId);
    }
    return ids.size > 0 ? ids : null;
  }, [activeItemLinkSet, layout]);

  // Node click handler
  const handleNodeClick = useCallback(
    (nodeId: number) => {
      setSelectedCategory(null);
      if (mode === 'single') {
        setSelectedNodes([nodeId]);
      } else if (mode === 'addition') {
        setSelectedNodes((prev) => {
          if (prev.includes(nodeId)) return prev.filter((id) => id !== nodeId);
          return [...prev, nodeId];
        });
      } else if (mode === 'subtraction') {
        setSelectedNodes((prev) => {
          if (prev.length === 0) {
            // First click: set as base
            return [nodeId];
          }
          if (prev[0] === nodeId) {
            // Clicking the base node again: clear all
            return [];
          }
          if (prev.includes(nodeId)) {
            // Already in exclusion list: remove it
            return prev.filter((id) => id !== nodeId);
          }
          // Add to exclusion list
          return [...prev, nodeId];
        });
      }
      setLinkTooltip(null);
    },
    [mode, layout, data],
  );

  // Item link click handler
  const handleItemLinkClick = useCallback(
    (il: LayoutItemLink, event: React.MouseEvent) => {
      const item = itemsMap[il.itemId];
      if (!item || !data || !layout) return;
      // Highlight the full path of this item
      setSelectedCategory(null);
      const pathNodeIds = new Set<number>();
      for (const axis of data.axisOrder) {
        const vals = item.values[axis];
        if (!vals) continue;
        for (const val of vals) {
          const key = `${axis}::${val}`;
          const nid = layout.nodeKeyToId?.get(key);
          if (nid !== undefined) pathNodeIds.add(nid);
        }
      }
      setSelectedNodes(Array.from(pathNodeIds));
      setLinkTooltip({
        x: event.clientX,
        y: event.clientY,
        items: [item],
      });
    },
    [itemsMap, layout, data],
  );

  // Category click - highlight all links of that category
  const handleCategoryClick = useCallback(
    (category: string) => {
      setLinkTooltip(null);
      if (selectedCategory === category) {
        setSelectedCategory(null);
        setSelectedNodes([]);
        return;
      }
      setSelectedCategory(category);
      if (!layout) return;
      const catNodeIds = new Set<number>();
      for (const node of layout.nodes) {
        if (node.category === category) catNodeIds.add(node.id);
      }
      setSelectedNodes(Array.from(catNodeIds));
    },
    [layout, selectedCategory]
  );

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedNodes([]);
    setSelectedCategory(null);
    setLinkTooltip(null);
  }, []);

  // Get items for bottom panel
  const panelItems = useMemo(() => {
    if (!activeItemIds || activeItemIds.size === 0) return [];
    return Array.from(activeItemIds)
      .map((id) => itemsMap[id])
      .filter(Boolean);
  }, [activeItemIds, itemsMap]);

  if (!data || !layout) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const { width, height } = dimensions;
  const { nodes, links, itemLinkPaths } = layout;
  const maxColumn = Math.max(...nodes.map((n) => n.column));

  // Stimulus subcategory groups
  const stimulusGroups = getStimulusSubcatOrder(
    nodes,
    data.stimulusSubcatOrder,
    data.stimulusSubcats,
  );

  // Primary code category groups (for right-side bars)
  const primaryCodeNodes = nodes.filter((n) => n.axis === 'DerivedPrimary');
  const categoryGroups = new Map<string, LayoutNode[]>();
  for (const node of primaryCodeNodes) {
    const cat = node.category || 'Other Descriptors';
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(node);
  }

  const isAnySelected = selectedNodes.length > 0 || (activeItemIds?.size ?? 0) > 0;

  return (
    <div className="w-full" ref={containerRef}>
      {/* Title */}
      <div className="text-center mb-2">
        <h1 className="text-lg font-semibold text-foreground">
          SPS Items — Axis Composition of Each Derived Primary Code
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          6-axis schema: Stimulus | Process | Outcome & Appraised Valence | Response | Cognitive
          Disposition | Primary Code. &ldquo;—&rdquo; skipped per item. Ribbon color = primary-code
          category.
        </p>
      </div>

      {/* Mode buttons */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-xs text-muted-foreground mr-2">Mode:</span>
        {(['single', 'addition', 'subtraction'] as InteractionMode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              handleClear();
            }}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              mode === m
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        {isAnySelected && (
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs rounded border border-border bg-background text-foreground hover:bg-muted ml-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chart */}
      <svg width={width} height={height} className="block">
        {/* Axis labels */}
        {data.axisOrder.map((axis, i) => {
          const colNodes = nodes.filter((n) => n.column === i);
          if (colNodes.length === 0) return null;
          const x = colNodes[0].x + NODE_WIDTH / 2;
          const count = data.axisItemCounts[axis] || 0;
          return (
            <text
              key={axis}
              x={x}
              y={CHART_PADDING.top - 16}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-semibold"
            >
              {data.axisLabels[axis]} (n={count})
            </text>
          );
        })}

        {/* Stimulus subcategory bars (far left side) */}
        {stimulusGroups.map((group) => {
          if (group.nodes.length === 0) return null;
          const minY = Math.min(...group.nodes.map((n) => n.y));
          const maxY = Math.max(...group.nodes.map((n) => n.y + n.height));
          const barX = 95;
          const barH = maxY - minY;
          const color = data.stimulusSubcatColors[group.subcat] || '#D9D9D9';
          return (
            <g key={group.subcat}>
              <rect
                x={barX}
                y={minY}
                width={SUBCAT_BAR_WIDTH}
                height={barH}
                fill={color}
                rx={2}
              />
              <text
                x={8}
                y={minY + barH / 2}
                textAnchor="start"
                dominantBaseline="central"
                className="fill-foreground text-[9px] font-medium"
              >
                {group.subcat}
              </text>
            </g>
          );
        })}

        {/* Primary code category bars (right side) */}
        {Array.from(categoryGroups.entries()).map(([cat, catNodes]) => {
          if (catNodes.length === 0) return null;
          const minY = Math.min(...catNodes.map((n) => n.y));
          const maxY = Math.max(...catNodes.map((n) => n.y + n.height));
          const lastNode = catNodes[catNodes.length - 1];
          const barX = lastNode.x + NODE_WIDTH + 120;
          const barH = maxY - minY;
          const color = data.categoryColors[cat] || '#A5A5A5';
          const isActive = selectedCategory === cat;
          return (
            <g key={cat} style={{ cursor: 'pointer' }} onClick={() => handleCategoryClick(cat)}>
              <rect x={barX} y={minY} width={8} height={barH} fill={color} rx={1} opacity={selectedNodes.length === 0 && !selectedCategory ? 1 : isActive ? 1 : 0.15} />
              <text
                x={barX + 14}
                y={minY + barH / 2}
                dominantBaseline="central"
                className="fill-foreground text-[9.5px] font-semibold"
              >
                {cat}
              </text>
            </g>
          );
        })}

        {/* Item link lines (one per item) */}
        {itemLinkPaths.map((il, idx) => {
          const isActive = activeItemLinkSet?.has(idx) ?? false;
          const isDimmed = isAnySelected && !isActive;
          const isHovered =
            hoveredNode === il.source || hoveredNode === il.target;

          return (
            <path
              key={`${il.itemId}-${il.source}-${il.target}-${idx}`}
              d={il.path}
              fill="none"
              stroke={il.color}
              strokeWidth={il.lineWidth}
              opacity={isDimmed ? 0.06 : isActive ? 0.85 : isHovered ? 0.6 : 0.3}
              className="cursor-pointer transition-opacity duration-150"
              onClick={(e) => handleItemLinkClick(il, e)}
              onMouseEnter={(e) => {
                const item = itemsMap[il.itemId];
                if (item) {
                  setLinkTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    items: [item],
                  });
                }
              }}
              onMouseLeave={() => setLinkTooltip(null)}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isActive = activeNodeSet?.has(node.id) ?? false;
          const isDimmed = isAnySelected && !isActive;
          const isHovered = hoveredNode === node.id;
          const isSelected = selectedNodes.includes(node.id);

          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                fill={node.color}
                stroke={isSelected ? '#000' : isHovered ? '#333' : 'none'}
                strokeWidth={isSelected ? 1.5 : isHovered ? 1 : 0}
                opacity={isDimmed ? 0.15 : 1}
                className="cursor-pointer transition-opacity duration-150"
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={(e) => {
                  setHoveredNode(node.id);
                  const count = data.nodeItems[String(node.id)]?.length || 0;
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    content: `${node.value} (${count} items)`,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setTooltip(null);
                }}
              />
              {/* Node label */}
              {node.column === maxColumn && (
                <line
                  x1={node.x + node.width}
                  y1={node.y + node.height / 2}
                  x2={node.x + node.width + 4}
                  y2={node.y + node.height / 2}
                  stroke={node.color}
                  strokeWidth={1}
                  opacity={isDimmed ? 0.15 : 0.5}
                />
              )}
              <text
                x={
                  node.column === maxColumn
                    ? node.x + node.width + 6
                    : node.column === 0
                      ? node.x - 6
                      : node.x + node.width / 2
                }
                y={node.y + node.height / 2}
                textAnchor={
                  node.column === maxColumn
                    ? 'start'
                    : node.column === 0
                      ? 'end'
                      : 'middle'
                }
                dominantBaseline="central"
                className="fill-foreground text-[8px] pointer-events-none"
                opacity={isDimmed ? 0.2 : 1}
              >
                {node.value}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs bg-card border border-border rounded shadow-sm pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Link tooltip */}
      {linkTooltip && (
        <div
          className="fixed z-50 px-3 py-2 text-xs bg-card border border-border rounded shadow-lg max-w-xs"
          style={{ left: linkTooltip.x + 12, top: linkTooltip.y - 10 }}
        >
          {linkTooltip.items.map((item) => (
            <div key={item.id} className="mb-1">
              <span className="font-mono text-[10px] text-muted-foreground">{item.id}</span>
              <p className="text-[11px] text-foreground leading-tight">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom panel: item list */}
      {panelItems.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground">
              Items ({panelItems.length})
            </h3>
            <button
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {panelItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50"
              >
                <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-20">
                  {item.id}
                </span>
                <span className="text-foreground leading-snug">{item.text}</span>
                <span
                  className="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: data.categoryColors[item.category] || '#A5A5A5',
                    color: '#fff',
                  }}
                >
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground mb-1.5 text-center font-medium">
          Primary-code category
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {Object.entries(data.categoryColors).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-foreground">{cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
