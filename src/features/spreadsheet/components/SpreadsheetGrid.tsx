import { ClipboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FormulaEngine } from '../formula/formulaEngine';
import { useClipboard } from '../hooks/useClipboard';
import { useSpreadsheetKeyboard } from '../hooks/useSpreadsheetKeyboard';
import { useVirtualGrid } from '../hooks/useVirtualGrid';
import { useSpreadsheetStore } from '../store/spreadsheetStore';
import type { CellPosition } from '../types';
import { columnIndexToName, positionToCellId } from '../utils/address';
import { isPositionInRange } from '../utils/range';
import styles from './SpreadsheetGrid.module.css';

export function SpreadsheetGrid() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cells = useSpreadsheetStore((state) => state.cells);
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const selection = useSpreadsheetStore((state) => state.selection);
  const editingCell = useSpreadsheetStore((state) => state.editingCell);
  const metrics = useSpreadsheetStore((state) => state.metrics);
  const setActiveCell = useSpreadsheetStore((state) => state.setActiveCell);
  const setEditingCell = useSpreadsheetStore((state) => state.setEditingCell);
  const setCellRaw = useSpreadsheetStore((state) => state.setCellRaw);
  const { pasteText } = useClipboard();
  const keyboard = useSpreadsheetKeyboard();
  const { scrollState, virtualWindow, onScroll } = useVirtualGrid(viewportRef, metrics);
  const [dragAnchor, setDragAnchor] = useState<CellPosition | null>(null);
  const editorDraftRef = useRef<{ position: CellPosition; value: string } | null>(null);
  const engine = useMemo(() => new FormulaEngine(cells), [cells]);

  const rows = range(virtualWindow.startRow, virtualWindow.endRow);
  const columns = range(virtualWindow.startCol, virtualWindow.endCol);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const cellTop = activeCell.row * metrics.rowHeight;
    const cellBottom = cellTop + metrics.rowHeight;
    const cellLeft = activeCell.col * metrics.columnWidth;
    const cellRight = cellLeft + metrics.columnWidth;

    if (cellTop < viewport.scrollTop) {
      viewport.scrollTop = cellTop;
    } else if (cellBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = cellBottom - viewport.clientHeight;
    }

    if (cellLeft < viewport.scrollLeft) {
      viewport.scrollLeft = cellLeft;
    } else if (cellRight > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = cellRight - viewport.clientWidth;
    }
  }, [activeCell, metrics.columnWidth, metrics.rowHeight]);

  const commitCell = (position: CellPosition, raw: string) => {
    setCellRaw(position, raw);
    setEditingCell(null);
  };

  const onCellMouseDown = (event: MouseEvent, position: CellPosition) => {
    if (editingCell && editorDraftRef.current) {
      setCellRaw(editorDraftRef.current.position, editorDraftRef.current.value);
      setEditingCell(null);
      editorDraftRef.current = null;
    }

    setDragAnchor(position);
    setActiveCell(position, event.shiftKey);
  };

  const onCellMouseEnter = (position: CellPosition) => {
    if (dragAnchor) {
      setActiveCell(position, true);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    pasteText(event.clipboardData.getData('text/plain'));
  };

  return (
    <div
      className={styles.gridShell}
      style={{
        '--row-header-width': `${metrics.rowHeaderWidth}px`,
        '--column-header-height': `${metrics.columnHeaderHeight}px`,
      } as CSSProperties}
      onMouseLeave={() => setDragAnchor(null)}
      onMouseUp={() => setDragAnchor(null)}
    >
      <div className={styles.corner} />
      <div className={styles.columnHeaders} aria-hidden="true">
        <div
          className={styles.headerCanvas}
          style={{
            width: metrics.columnCount * metrics.columnWidth,
            transform: `translateX(${-scrollState.scrollLeft}px)`,
          }}
        >
          {columns.map((col) => (
            <div
              key={col}
              className={styles.columnHeader}
              style={{
                left: col * metrics.columnWidth,
                width: metrics.columnWidth,
              }}
            >
              {columnIndexToName(col)}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.rowHeaders} aria-hidden="true">
        <div
          className={styles.headerCanvas}
          style={{
            height: metrics.rowCount * metrics.rowHeight,
            transform: `translateY(${-scrollState.scrollTop}px)`,
          }}
        >
          {rows.map((row) => (
            <div
              key={row}
              className={styles.rowHeader}
              style={{
                top: row * metrics.rowHeight,
                height: metrics.rowHeight,
              }}
            >
              {row + 1}
            </div>
          ))}
        </div>
      </div>
      <div
        ref={viewportRef}
        className={styles.viewport}
        role="grid"
        aria-rowcount={metrics.rowCount}
        aria-colcount={metrics.columnCount}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={keyboard.onKeyDown}
        onPaste={onPaste}
      >
        <div
          className={styles.canvas}
          style={{
            width: metrics.columnCount * metrics.columnWidth,
            height: metrics.rowCount * metrics.rowHeight,
          }}
        >
          <div
            className={styles.visibleCells}
            style={{
              transform: `translate(${virtualWindow.offsetLeft}px, ${virtualWindow.offsetTop}px)`,
            }}
          >
            {rows.flatMap((row) =>
              columns.map((col) => {
                const position = { row, col };
                const id = positionToCellId(position);
                const isActive = activeCell.row === row && activeCell.col === col;
                const isSelected = isPositionInRange(position, selection);
                const raw = cells[id]?.raw ?? '';
                const evaluated = engine.evaluateCell(id);
                const isEditing =
                  editingCell?.row === position.row && editingCell.col === position.col;

                return (
                  <CellView
                    key={id}
                    id={id}
                    raw={raw}
                    display={evaluated.display}
                    position={position}
                    left={(col - virtualWindow.startCol) * metrics.columnWidth}
                    top={(row - virtualWindow.startRow) * metrics.rowHeight}
                    width={metrics.columnWidth}
                    height={metrics.rowHeight}
                    isActive={isActive}
                    isSelected={isSelected}
                    isEditing={isEditing}
                    onMouseDown={onCellMouseDown}
                    onMouseEnter={onCellMouseEnter}
                    onDoubleClick={() => setEditingCell(position)}
                    onDraftChange={(value) => {
                      editorDraftRef.current = { position, value };
                    }}
                    onCommit={commitCell}
                    onCancel={() => setEditingCell(null)}
                  />
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CellViewProps {
  id: string;
  raw: string;
  display: string;
  position: CellPosition;
  left: number;
  top: number;
  width: number;
  height: number;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (event: MouseEvent, position: CellPosition) => void;
  onMouseEnter: (position: CellPosition) => void;
  onDoubleClick: () => void;
  onDraftChange: (raw: string) => void;
  onCommit: (position: CellPosition, raw: string) => void;
  onCancel: () => void;
}

function CellView({
  id,
  raw,
  display,
  position,
  left,
  top,
  width,
  height,
  isActive,
  isSelected,
  isEditing,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onDraftChange,
  onCommit,
  onCancel,
}: CellViewProps) {
  const className = [
    styles.cell,
    isSelected ? styles.selectedCell : '',
    isActive ? styles.activeCell : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="gridcell"
      aria-selected={isSelected}
      data-cell-id={id}
      style={{
        left,
        top,
        width,
        height,
      }}
      onMouseDown={(event) => onMouseDown(event, position)}
      onMouseEnter={() => onMouseEnter(position)}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        <CellEditor
          raw={raw}
          position={position}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : (
        <span className={styles.cellText}>{display}</span>
      )}
    </div>
  );
}

interface CellEditorProps {
  raw: string;
  position: CellPosition;
  onDraftChange: (raw: string) => void;
  onCommit: (position: CellPosition, raw: string) => void;
  onCancel: () => void;
}

function CellEditor({ raw, position, onDraftChange, onCommit, onCancel }: CellEditorProps) {
  const [value, setValue] = useState(raw);

  useEffect(() => {
    onDraftChange(raw);
  }, [onDraftChange, raw]);

  return (
    <input
      className={styles.cellEditor}
      aria-label={`Edit ${positionToCellId(position)}`}
      autoFocus
      value={value}
      spellCheck={false}
      onChange={(event) => {
        setValue(event.target.value);
        onDraftChange(event.target.value);
      }}
      onBlur={(event) => onCommit(position, event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(position, event.currentTarget.value);
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

function range(start: number, end: number): number[] {
  const values: number[] = [];

  for (let index = start; index <= end; index += 1) {
    values.push(index);
  }

  return values;
}
