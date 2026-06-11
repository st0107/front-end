import { useSpreadsheetStore } from './spreadsheetStore';

describe('spreadsheetStore', () => {
  beforeEach(() => {
    useSpreadsheetStore.getState().reset();
  });

  it('stores cells sparsely and removes empty cells', () => {
    const store = useSpreadsheetStore.getState();

    store.setCellRaw({ row: 0, col: 0 }, 'hello');
    expect(useSpreadsheetStore.getState().cells.A1?.raw).toBe('hello');

    useSpreadsheetStore.getState().setCellRaw({ row: 0, col: 0 }, '');
    expect(useSpreadsheetStore.getState().cells.A1).toBeUndefined();
  });

  it('supports undo and redo for edits', () => {
    const store = useSpreadsheetStore.getState();

    store.setCellRaw({ row: 0, col: 0 }, '10');
    useSpreadsheetStore.getState().setCellRaw({ row: 0, col: 0 }, '20');
    expect(useSpreadsheetStore.getState().cells.A1.raw).toBe('20');

    useSpreadsheetStore.getState().undo();
    expect(useSpreadsheetStore.getState().cells.A1.raw).toBe('10');

    useSpreadsheetStore.getState().redo();
    expect(useSpreadsheetStore.getState().cells.A1.raw).toBe('20');
  });

  it('copies and pastes tabular selections', () => {
    const store = useSpreadsheetStore.getState();

    store.pasteMatrix(
      { row: 0, col: 0 },
      [
        ['A', 'B'],
        ['C', 'D'],
      ],
    );

    expect(useSpreadsheetStore.getState().copySelectionAsTsv()).toBe('A\tB\nC\tD');
    useSpreadsheetStore.getState().pasteMatrix({ row: 4, col: 4 }, [['=SUM(A1:B2)']]);

    expect(useSpreadsheetStore.getState().getEvaluatedCell({ row: 4, col: 4 }).display).toBe('0');
  });
});
