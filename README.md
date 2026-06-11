# Single User Sheets

A production-oriented spreadsheet web application inspired by the first version of Google Sheets. It is built with React, TypeScript, Vite, Zustand, TanStack Query, CSS Modules, Jest, and React Testing Library.

## Quick Start

```bash
npm install
npm run dev
npm test
npm run build
```

## Features

- Virtualized spreadsheet grid sized for 100,000 rows and 10,000 columns
- Sticky row and column headers
- Cell selection, shift-selection, drag selection, and keyboard navigation
- Cell editing through direct entry, double click, `F2`, and the formula bar
- Copy, cut, paste, delete, undo, and redo
- Formula support for `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, ranges, references, and arithmetic operators
- Sparse normalized state so empty cells do not consume memory
- Unit tests for formula and state behavior, plus React Testing Library integration tests

## Project Structure

```text
src/
  app/
    providers/              TanStack Query and future app-level providers
  features/
    spreadsheet/
      components/           Grid, toolbar, formula bar, spreadsheet shell
      formula/              Parser and formula evaluator
      hooks/                Virtualization, keyboard, clipboard hooks
      store/                Zustand spreadsheet store
      utils/                Address and range utilities
      types.ts              Shared spreadsheet domain types
  styles/                   Global CSS reset and tokens
```

## Component Architecture

```text
App
└── AppProviders
    └── Spreadsheet
        ├── Toolbar
        │   └── Zustand actions for undo, redo, clipboard, delete
        ├── FormulaBar
        │   └── Active cell raw value editing
        └── SpreadsheetGrid
            ├── useVirtualGrid
            ├── useSpreadsheetKeyboard
            ├── useClipboard
            ├── Sticky row headers
            ├── Sticky column headers
            └── Virtualized CellView list
```

## State Management Design

Spreadsheet data is normalized as a sparse map:

```ts
type CellMap = Record<CellId, { id: CellId; raw: string; updatedAt: number }>;
```

The app never allocates a full matrix. Empty cells are represented by absence from the map, which keeps memory proportional to edited cells rather than to the theoretical grid size. Zustand owns:

- `cells`: sparse cell data
- `activeCell`: keyboard anchor
- `selection`: normalized multi-cell range
- `editingCell`: currently edited cell
- `history`: bounded undo and redo cell snapshots
- `metrics`: row, column, and virtualization constants

Actions are intentionally domain-level: `setCellRaw`, `pasteMatrix`, `deleteSelection`, `moveActiveCell`, `undo`, and `redo`. Components call these actions rather than editing cell maps directly.

## Formula Engine Design

The formula engine is a small recursive-descent parser. It tokenizes formulas, parses arithmetic precedence, resolves cell references, expands ranges, and evaluates supported aggregate functions.

Supported examples:

```text
=A1+B1*2
=SUM(A1:B10)
=AVERAGE(A1:A5, B1)
=MIN(A1:B5)
=MAX(A1:B5)
=COUNT(A1:B5)
```

Design decisions:

- No `eval` or dynamic function construction
- Circular references are detected with a visited set
- Missing and non-numeric referenced cells coerce to `0` for arithmetic
- Ranges are first-class values for aggregate functions

## Performance Strategy

- Render only the visible rows and columns with overscan
- Keep headers in separate translated layers so they remain sticky while the viewport scrolls
- Use fixed row and column dimensions for constant-time virtual window calculation
- Store only edited cells in a normalized map
- Compute visible cell evaluation from the current sparse map instead of maintaining a huge derived matrix
- Keep toolbar, formula bar, and grid responsibilities separate so future memoization or worker-based formula recalculation can be added without rewriting UI components

For larger collaborative or multi-sheet versions, the next step would be a dependency graph for formulas, worker-backed recalculation, persisted document snapshots, and chunked undo patches instead of whole sparse-map snapshots.

## Testing

- `formulaEngine.test.ts`: arithmetic, ranges, aggregate functions, nested references, circular references
- `spreadsheetStore.test.ts`: sparse writes, delete behavior, undo/redo, paste/copy shape
- `Spreadsheet.integration.test.tsx`: user-level editing and keyboard selection

Run:

```bash
npm test
```
