import { Spreadsheet } from './features/spreadsheet/components/Spreadsheet';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.appShell}>
      <Spreadsheet />
    </main>
  );
}
