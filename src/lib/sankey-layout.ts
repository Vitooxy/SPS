/**
 * Custom Alluvial/Sankey layout engine for the SPS coding framework visualization.
 * Computes node positions and link paths for a strict-column alluvial diagram.
 */

export interface SankeyNode {
  id: number;
  axis: string;
  value: string;
  column: number;
  category: string | null;
  color: string;
  // Computed layout properties
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  height?: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
  itemIds: string[];
  // Computed layout properties
  sy0?: number; // source y start
  sy1?: number; // source y end
  ty0?: number; // target y start
  ty1?: number; // target y end
  width?: number;
  color?: string;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface LayoutConfig {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  nodeWidth: number;
  nodePadding: number;
  columnPadding: number;
}

/**
 * Compute the alluvial layout: assign x/y positions to nodes and compute link paths.
 */
export function computeLayout(
  data: SankeyData,
  config: LayoutConfig
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const { width, height, padding, nodeWidth, nodePadding } = config;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Group nodes by column
  const columns = new Map<number, SankeyNode[]>();
  for (const node of data.nodes) {
    if (!columns.has(node.column)) {
      columns.set(node.column, []);
    }
    columns.get(node.column)!.push(node);
  }

  const numColumns = columns.size;
  const columnSpacing = numColumns > 1 ? (innerWidth - nodeWidth * numColumns) / (numColumns - 1) : 0;

  // Compute node heights based on total flow
  // For each node, height = sum of link values passing through it
  const nodeFlows = new Map<number, number>();
  for (const node of data.nodes) {
    let totalFlow = 0;
    for (const link of data.links) {
      if (link.source === node.id || link.target === node.id) {
        totalFlow += link.value;
      }
    }
    // Avoid double counting for nodes that are both source and target
    // Use the max of incoming vs outgoing
    let inFlow = 0;
    let outFlow = 0;
    for (const link of data.links) {
      if (link.target === node.id) inFlow += link.value;
      if (link.source === node.id) outFlow += link.value;
    }
    nodeFlows.set(node.id, Math.max(inFlow, outFlow, 1));
  }

  // Assign x positions and compute y positions for each column
  const sortedColumnKeys = Array.from(columns.keys()).sort((a, b) => a - b);

  for (const colKey of sortedColumnKeys) {
    const colNodes = columns.get(colKey)!;
    const colIndex = sortedColumnKeys.indexOf(colKey);

    // X position
    const x = padding.left + colIndex * (nodeWidth + columnSpacing);

    // Compute total flow for this column to determine scale
    const totalColumnFlow = colNodes.reduce((sum, n) => sum + (nodeFlows.get(n.id) || 1), 0);
    const totalPadding = (colNodes.length - 1) * nodePadding;
    const availableHeight = innerHeight - totalPadding;
    const scale = availableHeight / Math.max(totalColumnFlow, 1);

    // Sort nodes within column by category (for DerivedPrimary) or by flow
    if (colKey === sortedColumnKeys[sortedColumnKeys.length - 1]) {
      // Last column (Primary Code): sort by category
      const categoryOrder = [
        'Overload', 'Aversion', 'Coping', 'Perceptual Sensitivity',
        'Affective and Aesthetic', 'Social Cognition and Empathy',
        'Cognitive Processing', 'Other Descriptors'
      ];
      colNodes.sort((a, b) => {
        const catA = categoryOrder.indexOf(a.category || '');
        const catB = categoryOrder.indexOf(b.category || '');
        if (catA !== catB) return catA - catB;
        return a.value.localeCompare(b.value);
      });
    } else {
      // Sort by flow (descending) for other columns
      colNodes.sort((a, b) => (nodeFlows.get(b.id) || 0) - (nodeFlows.get(a.id) || 0));
    }

    // Assign y positions
    let currentY = padding.top;
    for (const node of colNodes) {
      const flow = nodeFlows.get(node.id) || 1;
      const nodeHeight = Math.max(flow * scale, 4); // minimum height 4px

      node.x0 = x;
      node.x1 = x + nodeWidth;
      node.y0 = currentY;
      node.y1 = currentY + nodeHeight;
      node.height = nodeHeight;

      currentY += nodeHeight + nodePadding;
    }
  }

  // Compute link positions
  // For each node, track the current y offset for outgoing and incoming links
  const sourceOffsets = new Map<number, number>();
  const targetOffsets = new Map<number, number>();

  for (const node of data.nodes) {
    sourceOffsets.set(node.id, node.y0 || 0);
    targetOffsets.set(node.id, node.y0 || 0);
  }

  // Sort links by source then target position for cleaner layout
  const sortedLinks = [...data.links].sort((a, b) => {
    const sourceA = data.nodes.find(n => n.id === a.source);
    const sourceB = data.nodes.find(n => n.id === b.source);
    const targetA = data.nodes.find(n => n.id === a.target);
    const targetB = data.nodes.find(n => n.id === b.target);
    if (!sourceA || !sourceB || !targetA || !targetB) return 0;
    if (sourceA.y0 !== sourceB.y0) return (sourceA.y0 || 0) - (sourceB.y0 || 0);
    return (targetA.y0 || 0) - (targetB.y0 || 0);
  });

  for (const link of sortedLinks) {
    const sourceNode = data.nodes.find(n => n.id === link.source);
    const targetNode = data.nodes.find(n => n.id === link.target);
    if (!sourceNode || !targetNode) continue;

    // Compute link width proportional to flow
    const sourceTotalOut = data.links
      .filter(l => l.source === link.source)
      .reduce((sum, l) => sum + l.value, 0);
    const targetTotalIn = data.links
      .filter(l => l.target === link.target)
      .reduce((sum, l) => sum + l.value, 0);

    const sourceHeight = (sourceNode.y1 || 0) - (sourceNode.y0 || 0);
    const targetHeight = (targetNode.y1 || 0) - (targetNode.y0 || 0);

    const linkSourceHeight = (link.value / Math.max(sourceTotalOut, 1)) * sourceHeight;
    const linkTargetHeight = (link.value / Math.max(targetTotalIn, 1)) * targetHeight;

    const sy0 = sourceOffsets.get(link.source) || 0;
    const ty0 = targetOffsets.get(link.target) || 0;

    link.sy0 = sy0;
    link.sy1 = sy0 + linkSourceHeight;
    link.ty0 = ty0;
    link.ty1 = ty0 + linkTargetHeight;
    link.width = Math.max(linkSourceHeight, linkTargetHeight);

    sourceOffsets.set(link.source, sy0 + linkSourceHeight);
    targetOffsets.set(link.target, ty0 + linkTargetHeight);
  }

  return { nodes: data.nodes, links: sortedLinks };
}

/**
 * Generate SVG path for a Sankey link (cubic bezier).
 */
export function linkPath(link: SankeyLink, sourceNode: SankeyNode, targetNode: SankeyNode): string {
  const x0 = sourceNode.x1 || 0;
  const x1 = targetNode.x0 || 0;
  const xi = (x0 + x1) / 2;

  const y0Top = link.sy0 || 0;
  const y0Bottom = link.sy1 || 0;
  const y1Top = link.ty0 || 0;
  const y1Bottom = link.ty1 || 0;

  return [
    `M${x0},${y0Top}`,
    `C${xi},${y0Top} ${xi},${y1Top} ${x1},${y1Top}`,
    `L${x1},${y1Bottom}`,
    `C${xi},${y1Bottom} ${xi},${y0Bottom} ${x0},${y0Bottom}`,
    'Z'
  ].join(' ');
}

/**
 * Generate a simple link path string given raw coordinates.
 */
export function buildLinkPath(
  x0: number, y0Top: number, y0Bottom: number,
  x1: number, y1Top: number, y1Bottom: number
): string {
  const xi = (x0 + x1) / 2;
  return [
    `M${x0},${y0Top}`,
    `C${xi},${y0Top} ${xi},${y1Top} ${x1},${y1Top}`,
    `L${x1},${y1Bottom}`,
    `C${xi},${y1Bottom} ${xi},${y0Bottom} ${x0},${y0Bottom}`,
    'Z'
  ].join(' ');
}
