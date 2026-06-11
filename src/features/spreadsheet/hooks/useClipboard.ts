import type { CellPosition } from '../types';
import { useSpreadsheetStore } from '../store/spreadsheetStore';

export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((row, index, rows) => row.length > 0 || index < rows.length - 1)
    .map((row) => row.split('\t'));
}

export function useClipboard() {
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const copySelectionAsTsv = useSpreadsheetStore((state) => state.copySelectionAsTsv);
  const cutSelectionAsTsv = useSpreadsheetStore((state) => state.cutSelectionAsTsv);
  const pasteMatrix = useSpreadsheetStore((state) => state.pasteMatrix);

  const writeText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  };

  return {
    copy: async () => writeText(copySelectionAsTsv()),
    cut: async () => writeText(cutSelectionAsTsv()),
    pasteText: (text: string, origin: CellPosition = activeCell) => {
      const matrix = parseTsv(text);

      if (matrix.length > 0) {
        pasteMatrix(origin, matrix);
      }
    },
  };
}
