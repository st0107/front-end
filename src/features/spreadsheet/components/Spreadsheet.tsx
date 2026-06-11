import { FormulaBar } from './FormulaBar';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { Toolbar } from './Toolbar';
import styles from './Spreadsheet.module.css';

export function Spreadsheet() {
  return (
    <section className={styles.sheet} aria-label="Spreadsheet application">
      <Toolbar />
      <FormulaBar />
      <SpreadsheetGrid />
    </section>
  );
}
