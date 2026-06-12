import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBackendWorkbook } from '../hooks/useBackendWorkbook';
import styles from './SheetTabs.module.css';

export function SheetTabs() {
  const { createNewSheet, renameExistingSheet, selectSheet, sheet, sheets, status, user, workbook } = useBackendWorkbook();
  const [draftName, setDraftName] = useState(sheet?.name ?? '');
  const isBusy = status === 'connecting';

  useEffect(() => {
    setDraftName(sheet?.name ?? '');
  }, [sheet?.id, sheet?.name]);

  if (!user || !workbook || !sheet) {
    return null;
  }

  const submitRename = (event?: FormEvent) => {
    event?.preventDefault();
    const nextName = draftName.trim();

    if (!nextName) {
      setDraftName(sheet.name);
      return;
    }

    if (nextName !== sheet.name) {
      void renameExistingSheet(sheet.id, nextName);
    }
  };

  return (
    <div className={styles.sheetTabs} aria-label="Workbook sheets">
      <div className={styles.tabs} role="tablist" aria-label="Sheets">
        {sheets.map((candidate) => {
          if (candidate.id === sheet.id) {
            return (
              <form
                key={candidate.id}
                className={`${styles.tab} ${styles.activeTab}`}
                onSubmit={submitRename}
                role="presentation"
              >
                <input
                  aria-label="Sheet name"
                  className={styles.tabInput}
                  disabled={isBusy}
                  maxLength={80}
                  value={draftName}
                  onBlur={() => submitRename()}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </form>
            );
          }

          return (
            <button
              key={candidate.id}
              type="button"
              className={styles.tab}
              role="tab"
              aria-selected={false}
              disabled={isBusy}
              title={candidate.name}
              onClick={() => void selectSheet(candidate.id)}
            >
              <span>{candidate.name}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.addButton}
        title="Add sheet"
        aria-label="Add sheet"
        disabled={isBusy}
        onClick={() => void createNewSheet()}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
