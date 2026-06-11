# Architecture Notes

## Architectural Principles

This implementation is feature-based. Spreadsheet-specific UI, domain state, formula logic, hooks, and tests live together under `src/features/spreadsheet`. App-level providers stay outside the feature so persistence, auth, routing, or remote sync can be introduced without changing spreadsheet internals.

## Component Diagram

```text
App
└── AppProviders
    └── Spreadsheet
        ├── Toolbar
        ├── FormulaBar
        └── SpreadsheetGrid
            ├── Column header layer
            ├── Row header layer
            └── Scroll viewport
                └── Virtualized cells
```

## Data Flow

```text
User input
  ↓
Component event handlers
  ↓
Zustand domain actions
  ↓
Sparse CellMap + selection/editing/history state
  ↓
Visible grid render
  ↓
FormulaEngine evaluates visible formula display values
```

## State Model

The app uses a sparse object keyed by normalized cell id:

```ts
{
  A1: { id: "A1", raw: "10", updatedAt: 1710000000000 },
  C4: { id: "C4", raw: "=SUM(A1:A3)", updatedAt: 1710000000100 }
}
```

This is the core scalability decision. A 100,000 by 10,000 grid has one billion possible cells, so the UI treats row and column coordinates as address space, not allocated data.

## Formula Engine

The formula engine follows this pipeline:

```text
raw cell value
  ↓
starts with "="?
  ↓
tokenize expression
  ↓
recursive-descent parse
  ↓
resolve references and ranges
  ↓
return display value or error marker
```

The parser supports arithmetic precedence, parenthesized expressions, unary signs, cell references, rectangular ranges, and aggregate function calls. It avoids JavaScript `eval` so user-entered formula text cannot execute arbitrary code.

## Virtualization

The grid uses fixed dimensions:

- Row height: `28px`
- Column width: `112px`
- Rows: `100,000`
- Columns: `10,000`

The virtual window is derived from `scrollTop`, `scrollLeft`, viewport size, and overscan. Only cells in that window are mounted. The canvas element still advertises the full scrollable size, so native browser scrolling remains smooth.

## Future Production Extensions

- Persist sparse cell maps through TanStack Query mutations
- Move formula recalculation to a Web Worker
- Track formula dependencies in a directed graph
- Store undo/redo as patches rather than sparse-map snapshots
- Add column resizing and row resizing
- Add multiple sheets and named ranges
- Add import/export for CSV and XLSX
