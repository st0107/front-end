import { Clipboard, ClipboardCopy, Redo2, Scissors, Trash2, Undo2 } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import { useSpreadsheetStore } from '../store/spreadsheetStore';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const deleteSelection = useSpreadsheetStore((state) => state.deleteSelection);
  const undo = useSpreadsheetStore((state) => state.undo);
  const redo = useSpreadsheetStore((state) => state.redo);
  const clipboard = useClipboard();

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Spreadsheet toolbar">
      <button type="button" title="Undo" aria-label="Undo" onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button type="button" title="Redo" aria-label="Redo" onClick={redo}>
        <Redo2 size={16} />
      </button>
      <span className={styles.separator} />
      <button type="button" title="Copy" aria-label="Copy" onClick={() => void clipboard.copy()}>
        <ClipboardCopy size={16} />
      </button>
      <button type="button" title="Cut" aria-label="Cut" onClick={() => void clipboard.cut()}>
        <Scissors size={16} />
      </button>
      <button
        type="button"
        title="Paste from clipboard"
        aria-label="Paste from clipboard"
        onClick={() => {
          if (navigator.clipboard?.readText) {
            void navigator.clipboard.readText().then(clipboard.pasteText);
          }
        }}
      >
        <Clipboard size={16} />
      </button>
      <span className={styles.separator} />
      <button type="button" title="Delete selection" aria-label="Delete selection" onClick={deleteSelection}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
