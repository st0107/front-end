import { KeyboardEvent } from 'react';
import { useClipboard } from './useClipboard';
import { useSpreadsheetStore } from '../store/spreadsheetStore';

export function useSpreadsheetKeyboard() {
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const editingCell = useSpreadsheetStore((state) => state.editingCell);
  const moveActiveCell = useSpreadsheetStore((state) => state.moveActiveCell);
  const setEditingCell = useSpreadsheetStore((state) => state.setEditingCell);
  const setCellRaw = useSpreadsheetStore((state) => state.setCellRaw);
  const deleteSelection = useSpreadsheetStore((state) => state.deleteSelection);
  const undo = useSpreadsheetStore((state) => state.undo);
  const redo = useSpreadsheetStore((state) => state.redo);
  const clipboard = useClipboard();

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const isModifier = event.ctrlKey || event.metaKey;

    if (editingCell) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setEditingCell(null);
      }

      return;
    }

    if (isModifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (isModifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (isModifier && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void clipboard.copy();
      return;
    }

    if (isModifier && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      void clipboard.cut();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveCell(-1, 0, event.shiftKey);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      moveActiveCell(1, 0, event.shiftKey);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveActiveCell(0, -1, event.shiftKey);
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      moveActiveCell(0, 1, event.shiftKey);
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      deleteSelection();
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      setEditingCell(activeCell);
      return;
    }

    if (event.key.length === 1 && !isModifier) {
      event.preventDefault();
      setCellRaw(activeCell, event.key);
      setEditingCell(activeCell);
    }
  };

  return { onKeyDown };
}
