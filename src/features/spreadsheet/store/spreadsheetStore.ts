import { create } from 'zustand';
import { FormulaEngine } from '../formula/formulaEngine';
import type { CellMap, CellPosition, CellRange, EvaluatedCell, GridMetrics } from '../types';
import { positionToCellId } from '../utils/address';
import { clampPosition, iterateRange, normalizeRange } from '../utils/range';

interface HistoryEntry {
  cells: CellMap;
}

interface SpreadsheetState {
  cells: CellMap;
  activeCell: CellPosition;
  selection: CellRange;
  editingCell: CellPosition | null;
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };
  metrics: GridMetrics;
  setActiveCell: (position: CellPosition, extendSelection?: boolean) => void;
  setEditingCell: (position: CellPosition | null) => void;
  setCellRaw: (position: CellPosition, raw: string) => void;
  deleteSelection: () => void;
  pasteMatrix: (origin: CellPosition, matrix: string[][]) => void;
  copySelectionAsTsv: () => string;
  cutSelectionAsTsv: () => string;
  moveActiveCell: (deltaRow: number, deltaCol: number, extendSelection?: boolean) => void;
  undo: () => void;
  redo: () => void;
  getEvaluatedCell: (position: CellPosition) => EvaluatedCell;
  reset: () => void;
}

export const DEFAULT_GRID_METRICS: GridMetrics = {
  rowCount: 100_000,
  columnCount: 10_000,
  rowHeight: 28,
  columnWidth: 112,
  rowHeaderWidth: 52,
  columnHeaderHeight: 28,
  overscan: 4,
};

const initialState = {
  cells: {} as CellMap,
  activeCell: { row: 0, col: 0 },
  selection: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
  editingCell: null,
  history: { past: [], future: [] },
  metrics: DEFAULT_GRID_METRICS,
};

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  ...initialState,
  setActiveCell: (position, extendSelection = false) => {
    const metrics = get().metrics;
    const next = clampPosition(position, metrics.rowCount, metrics.columnCount);

    set((state) => ({
      activeCell: next,
      selection: extendSelection ? { start: state.selection.start, end: next } : { start: next, end: next },
      editingCell: null,
    }));
  },
  setEditingCell: (position) => set({ editingCell: position }),
  setCellRaw: (position, raw) =>
    set((state) => {
      const nextCells = writeCell(state.cells, position, raw);
      return withHistory(state, nextCells);
    }),
  deleteSelection: () =>
    set((state) => {
      let nextCells = state.cells;

      for (const position of iterateRange(state.selection)) {
        nextCells = writeCell(nextCells, position, '');
      }

      return withHistory(state, nextCells);
    }),
  pasteMatrix: (origin, matrix) =>
    set((state) => {
      let nextCells = state.cells;

      matrix.forEach((rowValues, rowOffset) => {
        rowValues.forEach((value, colOffset) => {
          nextCells = writeCell(nextCells, {
            row: origin.row + rowOffset,
            col: origin.col + colOffset,
          }, value);
        });
      });

      const end = {
        row: origin.row + Math.max(0, matrix.length - 1),
        col: origin.col + Math.max(0, matrix[0]?.length ?? 1) - 1,
      };

      return {
        ...withHistory(state, nextCells),
        activeCell: origin,
        selection: { start: origin, end },
      };
    }),
  copySelectionAsTsv: () => {
    const { cells, selection } = get();
    const range = normalizeRange(selection);
    const rows: string[] = [];

    for (let row = range.start.row; row <= range.end.row; row += 1) {
      const values: string[] = [];

      for (let col = range.start.col; col <= range.end.col; col += 1) {
        values.push(cells[positionToCellId({ row, col })]?.raw ?? '');
      }

      rows.push(values.join('\t'));
    }

    return rows.join('\n');
  },
  cutSelectionAsTsv: () => {
    const tsv = get().copySelectionAsTsv();
    get().deleteSelection();
    return tsv;
  },
  moveActiveCell: (deltaRow, deltaCol, extendSelection = false) => {
    const { activeCell, setActiveCell } = get();
    setActiveCell({ row: activeCell.row + deltaRow, col: activeCell.col + deltaCol }, extendSelection);
  },
  undo: () =>
    set((state) => {
      const previous = state.history.past[state.history.past.length - 1];

      if (!previous) {
        return state;
      }

      return {
        cells: previous.cells,
        history: {
          past: state.history.past.slice(0, -1),
          future: [{ cells: state.cells }, ...state.history.future].slice(0, 100),
        },
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.history.future[0];

      if (!next) {
        return state;
      }

      return {
        cells: next.cells,
        history: {
          past: [...state.history.past, { cells: state.cells }].slice(-100),
          future: state.history.future.slice(1),
        },
      };
    }),
  getEvaluatedCell: (position) => new FormulaEngine(get().cells).evaluateCell(positionToCellId(position)),
  reset: () => set(initialState),
}));

function writeCell(cells: CellMap, position: CellPosition, raw: string): CellMap {
  const id = positionToCellId(position);
  const current = cells[id]?.raw ?? '';

  if (current === raw) {
    return cells;
  }

  if (raw === '') {
    const { [id]: _removed, ...rest } = cells;
    return rest;
  }

  return {
    ...cells,
    [id]: {
      id,
      raw,
      updatedAt: Date.now(),
    },
  };
}

function withHistory(
  state: Pick<SpreadsheetState, 'cells' | 'history'>,
  nextCells: CellMap,
): Partial<SpreadsheetState> {
  if (nextCells === state.cells) {
    return {};
  }

  return {
    cells: nextCells,
    history: {
      past: [...state.history.past, { cells: state.cells }].slice(-100),
      future: [],
    },
  };
}
