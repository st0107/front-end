import { FormEvent, useEffect, useState } from 'react';
import { LogIn, LogOut, RefreshCw, UserPlus } from 'lucide-react';
import { useBackendWorkbook } from '../hooks/useBackendWorkbook';
import styles from './BackendConnection.module.css';

export function BackendConnection() {
  const {
    clearError,
    error,
    renameActiveWorkbook,
    sheet,
    signIn,
    signOut,
    signUp,
    status,
    user,
    workbook,
  } = useBackendWorkbook();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [workbookName, setWorkbookName] = useState(workbook?.name ?? '');

  useEffect(() => {
    setWorkbookName(workbook?.name ?? '');
  }, [workbook?.id, workbook?.name]);

  const onSubmit = (event: FormEvent, mode: 'login' | 'register') => {
    event.preventDefault();
    clearError();
    const credentials = { email, password };

    if (mode === 'register') {
      void signUp(credentials);
    } else {
      void signIn(credentials);
    }
  };

  const submitWorkbookName = (event?: FormEvent) => {
    event?.preventDefault();
    const nextName = workbookName.trim();

    if (!workbook) {
      return;
    }

    if (!nextName) {
      setWorkbookName(workbook.name);
      return;
    }

    if (nextName !== workbook.name) {
      void renameActiveWorkbook(nextName);
    }
  };

  if (user && workbook && sheet) {
    return (
      <div className={styles.connectionBar}>
        <div className={styles.statusGroup}>
          <form className={styles.workbookNameForm} onSubmit={submitWorkbookName}>
            <input
              aria-label="Spreadsheet name"
              className={styles.workbookNameInput}
              maxLength={120}
              value={workbookName}
              onBlur={() => submitWorkbookName()}
              onChange={(event) => {
                clearError();
                setWorkbookName(event.target.value);
              }}
            />
          </form>
          <span className={styles.meta}>{sheet.name}</span>
          <span className={styles.meta}>{user.email}</span>
          <span className={status === 'error' ? styles.error : styles.status}>
            {status === 'error' ? error : status === 'saving' ? 'Saving' : 'Saved'}
          </span>
        </div>
        <button type="button" className={styles.actionButton} title="Sign out" aria-label="Sign out" onClick={signOut}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <form className={styles.connectionBar} onSubmit={(event) => onSubmit(event, 'login')}>
      <div className={styles.statusGroup}>
        <span className={styles.workbookName}>Backend</span>
        <span className={styles.meta}>{status === 'connecting' ? 'Connecting' : 'Not connected'}</span>
        {error ? <span className={styles.error}>{error}</span> : null}
      </div>
      <input
        className={styles.input}
        type="email"
        aria-label="Email"
        placeholder="Email"
        value={email}
        onChange={(event) => {
          clearError();
          setEmail(event.target.value);
        }}
      />
      <input
        className={styles.input}
        type="password"
        aria-label="Password"
        placeholder="Password"
        value={password}
        onChange={(event) => {
          clearError();
          setPassword(event.target.value);
        }}
      />
      <button
        type="submit"
        className={styles.actionButton}
        title="Sign in"
        aria-label="Sign in"
        disabled={status === 'connecting'}
      >
        {status === 'connecting' ? <RefreshCw size={16} /> : <LogIn size={16} />}
        <span>Sign in</span>
      </button>
      <button
        type="button"
        className={styles.secondaryButton}
        title="Register"
        aria-label="Register"
        disabled={status === 'connecting'}
        onClick={(event) => onSubmit(event, 'register')}
      >
        <UserPlus size={16} />
        <span>Create account</span>
      </button>
    </form>
  );
}
