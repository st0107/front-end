import type { CellPosition, CellRange } from '../types';

export function normalizeRange(range: CellRange): CellRange {
  return {
    start: {
      row: Math.min(range.start.row, range.end.row),
      col: Math.min(range.start.col, range.end.col),
    },
    end: {
      row: Math.max(range.start.row, range.end.row),
      col: Math.max(range.start.col, range.end.col),
    },
  };
}

export function isPositionInRange(position: CellPosition, range: CellRange): boolean {
  const normalized = normalizeRange(range);

  return (
    position.row >= normalized.start.row &&
    position.row <= normalized.end.row &&
    position.col >= normalized.start.col &&
    position.col <= normalized.end.col
  );
}

export function getRangeDimensions(range: CellRange) {
  const normalized = normalizeRange(range);

  return {
    rows: normalized.end.row - normalized.start.row + 1,
    columns: normalized.end.col - normalized.start.col + 1,
  };
}

export function clampPosition(
  position: CellPosition,
  rowCount: number,
  columnCount: number,
): CellPosition {
  return {
    row: Math.max(0, Math.min(rowCount - 1, position.row)),
    col: Math.max(0, Math.min(columnCount - 1, position.col)),
  };
}

export function* iterateRange(range: CellRange): Generator<CellPosition> {
  const normalized = normalizeRange(range);

  for (let row = normalized.start.row; row <= normalized.end.row; row += 1) {
    for (let col = normalized.start.col; col <= normalized.end.col; col += 1) {
      yield { row, col };
    }
  }
}
