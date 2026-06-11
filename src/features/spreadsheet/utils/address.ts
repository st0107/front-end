import type { CellId, CellPosition } from '../types';

const CELL_REF_PATTERN = /^\$?([A-Z]+)\$?([1-9][0-9]*)$/i;

export function columnIndexToName(index: number): string {
  let value = index + 1;
  let name = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

export function columnNameToIndex(name: string): number {
  return name
    .replace(/\$/g, '')
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

export function positionToCellId(position: CellPosition): CellId {
  return `${columnIndexToName(position.col)}${position.row + 1}`;
}

export function cellIdToPosition(cellId: CellId): CellPosition {
  const match = cellId.match(CELL_REF_PATTERN);

  if (!match) {
    throw new Error(`Invalid cell reference: ${cellId}`);
  }

  return {
    col: columnNameToIndex(match[1]),
    row: Number(match[2]) - 1,
  };
}

export function normalizeCellId(cellId: CellId): CellId {
  return positionToCellId(cellIdToPosition(cellId));
}

export function isCellReference(value: string): boolean {
  return CELL_REF_PATTERN.test(value);
}
