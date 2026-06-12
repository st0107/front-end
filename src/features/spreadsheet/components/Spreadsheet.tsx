import { BackendConnection } from './BackendConnection';
import { FormulaBar } from './FormulaBar';
import { SheetTabs } from './SheetTabs';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { Toolbar } from './Toolbar';
import { BackendWorkbookProvider } from '../hooks/useBackendWorkbook';
import styles from './Spreadsheet.module.css';

export function Spreadsheet() {
  return (
    <BackendWorkbookProvider>
      <section className={styles.sheet} aria-label="Spreadsheet application">
        <BackendConnection />
        <Toolbar />
        <FormulaBar />
        <SpreadsheetGrid />
        <SheetTabs />
      </section>
    </BackendWorkbookProvider>
  );
}
