export type CellId = string;

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export interface SpreadsheetCell {
  id: CellId;
  raw: string;
  updatedAt: number;
}

export type CellMap = Record<CellId, SpreadsheetCell>;

export interface EvaluatedCell {
  display: string;
  numericValue: number | null;
  error?: string;
}

export interface GridMetrics {
  rowCount: number;
  columnCount: number;
  rowHeight: number;
  columnWidth: number;
  rowHeaderWidth: number;
  columnHeaderHeight: number;
  overscan: number;
}

export interface VirtualWindow {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  offsetTop: number;
  offsetLeft: number;
}
