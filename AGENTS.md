# AGENTS.md

## Project Overview

Interactive alluvial/Sankey diagram visualization for the **SPS (Sensory Processing Sensitivity) Item Coding Framework**. Displays 141 items coded across 6 axes as a flow diagram with interactive path tracing.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19, TypeScript 5
- **UI**: shadcn/ui, Tailwind CSS 4
- **Visualization**: Custom SVG-based alluvial layout engine (no external chart library)

## Build & Run

```bash
pnpm install
pnpm run dev      # dev server
pnpm run build    # production build
pnpm run start    # production server
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/sankey-chart.tsx` | Main alluvial visualization component with layout engine and interactions |
| `src/lib/sankey-layout.ts` | Utility for building SVG bezier link paths |
| `public/sankey-data.json` | Pre-processed data (nodes, links, items) parsed from Excel |
| `src/app/page.tsx` | Root page rendering the chart |
| `src/app/layout.tsx` | Root layout with metadata |

## Data Architecture

- **6 Axes** (left → right): Stimulus (Modality + Configuration merged) → Process → Outcome & Valence → Response → Cognitive Disposition → Derived Primary Code
- **Nodes**: Each unique value on each axis becomes a node
- **Links**: Connections between consecutive axes based on item codings; width = item count
- **Categories**: Primary Code nodes grouped by 8 upper-level categories (Overload, Aversion, Coping, etc.)

## Interaction Modes

1. **Single**: Click one node → show only its paths, dim everything else
2. **Addition**: Click multiple nodes → union of all their paths shown
3. **Subtraction**: Toggle nodes on/off to refine path selection

## Conventions

- pnpm only (no npm/yarn)
- All colors use CSS variables from `globals.css` theme
- No hardcoded ports — use `${DEPLOY_RUN_PORT}`
- No hardcoded domains — use `${COZE_PROJECT_DOMAIN_DEFAULT}`
