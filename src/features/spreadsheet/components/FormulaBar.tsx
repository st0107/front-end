import { FormEvent, useEffect, useState } from 'react';
import { FunctionSquare } from 'lucide-react';
import { useSpreadsheetStore } from '../store/spreadsheetStore';
import { positionToCellId } from '../utils/address';
import styles from './FormulaBar.module.css';

export function FormulaBar() {
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const cells = useSpreadsheetStore((state) => state.cells);
  const setCellRaw = useSpreadsheetStore((state) => state.setCellRaw);
  const activeId = positionToCellId(activeCell);
  const [value, setValue] = useState(cells[activeId]?.raw ?? '');

  useEffect(() => {
    setValue(cells[activeId]?.raw ?? '');
  }, [activeId, cells]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setCellRaw(activeCell, value);
  };

  return (
    <form className={styles.formulaBar} onSubmit={onSubmit}>
      <div className={styles.nameBox}>{activeId}</div>
      <label className={styles.inputWrap}>
        <FunctionSquare size={16} aria-hidden="true" />
        <input
          aria-label="Formula bar"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setCellRaw(activeCell, value)}
          spellCheck={false}
        />
      </label>
    </form>
  );
}
