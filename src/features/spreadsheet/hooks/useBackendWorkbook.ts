import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  createSheet,
  ensureWorkspace,
  getAuthToken,
  getCurrentUser,
  getWorkbook,
  loadSheetCells,
  login,
  logout,
  register,
  renameWorkbook,
  renameSheet,
  saveCells,
  saveSheet,
  setAuthToken,
  type AuthUser,
  type SheetSummary,
  type WorkspaceContext,
} from '../api/spreadsheetApi';
import { useSpreadsheetStore } from '../store/spreadsheetStore';
import type { CellMap } from '../types';

type ConnectionStatus = 'signed-out' | 'connecting' | 'connected' | 'saving' | 'error';

interface Credentials {
  email: string;
  password: string;
}

interface BackendWorkbookContextValue {
  clearError: () => void;
  createNewSheet: () => Promise<void>;
  error: string | null;
  renameActiveWorkbook: (name: string) => Promise<void>;
  renameExistingSheet: (sheetId: string, name: string) => Promise<void>;
  selectSheet: (sheetId: string) => Promise<void>;
  sheet: SheetSummary | null;
  sheets: SheetSummary[];
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: Credentials) => Promise<void>;
  status: ConnectionStatus;
  user: AuthUser | null;
  workbook: WorkspaceContext['workbook'] | null;
}

const BackendWorkbookContext = createContext<BackendWorkbookContextValue | null>(null);

export function BackendWorkbookProvider({ children }: { children: ReactNode }) {
  const value = useBackendWorkbookState();
  return createElement(BackendWorkbookContext.Provider, { value }, children);
}

export function useBackendWorkbook() {
  const context = useContext(BackendWorkbookContext);

  if (!context) {
    throw new Error('useBackendWorkbook must be used inside BackendWorkbookProvider');
  }

  return context;
}

function useBackendWorkbookState(): BackendWorkbookContextValue {
  const hydrateCells = useSpreadsheetStore((state) => state.hydrateCells);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(getAuthToken() ? 'connecting' : 'signed-out');
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingChangesRef = useRef(new Map<string, { id: string; raw: string }>());
  const previousCellsRef = useRef<CellMap>(useSpreadsheetStore.getState().cells);
  const latestWorkspaceRef = useRef<WorkspaceContext | null>(null);
  const loadingRef = useRef(false);

  const persistChanges = useCallback(async (
    activeWorkspace: WorkspaceContext,
    changes: Array<{ id: string; raw: string }>,
  ) => {
    await saveCells(activeWorkspace.workbook.id, activeWorkspace.sheet.id, changes);
    await saveSheet(activeWorkspace.workbook.id, activeWorkspace.sheet.id);
  }, []);

  const flushPendingChanges = useCallback(async () => {
    const activeWorkspace = latestWorkspaceRef.current;
    const pendingChanges = Array.from(pendingChangesRef.current.values());

    if (!activeWorkspace || pendingChanges.length === 0) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    pendingChangesRef.current.clear();
    setStatus('saving');

    try {
      await persistChanges(activeWorkspace, pendingChanges);
      setStatus('connected');
    } catch (nextError) {
      pendingChanges.forEach((cell) => {
        pendingChangesRef.current.set(cell.id, cell);
      });
      setError(getErrorMessage(nextError));
      setStatus('error');
      throw nextError;
    }
  }, [persistChanges]);

  const hydrateSheet = useCallback(async (workbook: WorkspaceContext['workbook'], sheet: SheetSummary) => {
    setStatus('connecting');
    setError(null);
    loadingRef.current = true;

    try {
      const cells = await loadSheetCells(workbook.id, sheet.id);

      hydrateCells(cells, {
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
      });
      previousCellsRef.current = cells;
      const nextWorkspace = { workbook, sheet };
      latestWorkspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      setStatus('connected');
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setStatus('error');
    } finally {
      loadingRef.current = false;
    }
  }, [hydrateCells]);

  const connect = useCallback(async (authUser: AuthUser) => {
    const nextWorkspace = await ensureWorkspace();
    setUser(authUser);
    await hydrateSheet(nextWorkspace.workbook, nextWorkspace.sheet);
  }, [hydrateSheet]);

  useEffect(() => {
    if (!getAuthToken()) {
      return;
    }

    void getCurrentUser()
      .then(connect)
      .catch(() => {
        setAuthToken(null);
        setError(null);
        setStatus('signed-out');
      });
  }, [connect]);

  useEffect(() => {
    const unsubscribe = useSpreadsheetStore.subscribe((state) => {
      const nextCells = state.cells;
      const activeWorkspace = latestWorkspaceRef.current;

      if (loadingRef.current || !activeWorkspace || nextCells === previousCellsRef.current) {
        previousCellsRef.current = nextCells;
        return;
      }

      const changedCells = diffCells(previousCellsRef.current, nextCells);
      previousCellsRef.current = nextCells;

      if (changedCells.length === 0) {
        return;
      }

      changedCells.forEach((cell) => {
        pendingChangesRef.current.set(cell.id, cell);
      });

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        const pendingChanges = Array.from(pendingChangesRef.current.values());
        pendingChangesRef.current.clear();
        setStatus('saving');
        void persistChanges(activeWorkspace, pendingChanges)
          .then(() => setStatus('connected'))
          .catch((nextError) => {
            pendingChanges.forEach((cell) => {
              pendingChangesRef.current.set(cell.id, cell);
            });
            setError(getErrorMessage(nextError));
            setStatus('error');
          });
      }, 300);
    });

    return () => {
      unsubscribe();

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistChanges]);

  const selectSheet = useCallback(async (sheetId: string) => {
    const activeWorkspace = latestWorkspaceRef.current;

    if (!activeWorkspace || activeWorkspace.sheet.id === sheetId) {
      return;
    }

    const nextSheet = activeWorkspace.workbook.sheets.find((candidate) => candidate.id === sheetId);

    if (!nextSheet) {
      return;
    }

    await flushPendingChanges();
    await hydrateSheet(activeWorkspace.workbook, nextSheet);
  }, [flushPendingChanges, hydrateSheet]);

  const createNewSheet = useCallback(async () => {
    const activeWorkspace = latestWorkspaceRef.current;

    if (!activeWorkspace) {
      return;
    }

    const name = nextSheetName(activeWorkspace.workbook.sheets);
    setStatus('connecting');
    setError(null);

    try {
      await flushPendingChanges();
      const createdSheet = await createSheet(activeWorkspace.workbook.id, name);
      const refreshedWorkbook = await getWorkbook(activeWorkspace.workbook.id);
      const nextSheet = refreshedWorkbook.sheets.find((candidate) => candidate.id === createdSheet.id) ?? createdSheet;
      await hydrateSheet(refreshedWorkbook, nextSheet);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setStatus('error');
    }
  }, [flushPendingChanges, hydrateSheet]);

  const renameExistingSheet = useCallback(async (sheetId: string, name: string) => {
    const activeWorkspace = latestWorkspaceRef.current;
    const normalizedName = name.trim();

    if (!activeWorkspace || !normalizedName) {
      return;
    }

    const currentSheet = activeWorkspace.workbook.sheets.find((candidate) => candidate.id === sheetId);

    if (!currentSheet || currentSheet.name === normalizedName) {
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      await renameSheet(activeWorkspace.workbook.id, sheetId, normalizedName);
      const refreshedWorkbook = await getWorkbook(activeWorkspace.workbook.id);
      const nextActiveSheet =
        refreshedWorkbook.sheets.find((candidate) => candidate.id === activeWorkspace.sheet.id) ?? activeWorkspace.sheet;
      const nextWorkspace = { workbook: refreshedWorkbook, sheet: nextActiveSheet };
      latestWorkspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      setStatus('connected');
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setStatus('error');
    }
  }, []);

  const renameActiveWorkbook = useCallback(async (name: string) => {
    const activeWorkspace = latestWorkspaceRef.current;
    const normalizedName = name.trim();

    if (!activeWorkspace || !normalizedName || activeWorkspace.workbook.name === normalizedName) {
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      const renamedWorkbook = await renameWorkbook(activeWorkspace.workbook.id, normalizedName);
      const nextActiveSheet =
        renamedWorkbook.sheets.find((candidate) => candidate.id === activeWorkspace.sheet.id) ?? activeWorkspace.sheet;
      const nextWorkspace = { workbook: renamedWorkbook, sheet: nextActiveSheet };
      latestWorkspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      setStatus('connected');
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setStatus('error');
    }
  }, []);

  const signIn = useCallback(async ({ email, password }: Credentials) => {
    setStatus('connecting');
    setError(null);

    try {
      const response = await login(email, password);
      setAuthToken(response.accessToken);
      await connect(response.user);
    } catch (nextError) {
      setAuthToken(null);
      setError(getAuthErrorMessage(nextError, 'login'));
      setStatus('signed-out');
    }
  }, [connect]);

  const signUp = useCallback(async ({ email, password }: Credentials) => {
    setStatus('connecting');
    setError(null);

    try {
      const response = await register(email, password);
      setAuthToken(response.accessToken);
      await connect(response.user);
    } catch (nextError) {
      setAuthToken(null);
      setError(getAuthErrorMessage(nextError, 'register'));
      setStatus('signed-out');
    }
  }, [connect]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      pendingChangesRef.current.clear();
      latestWorkspaceRef.current = null;
      previousCellsRef.current = {};
      setUser(null);
      setWorkspace(null);
      setStatus('signed-out');
      hydrateCells({});
    }
  }, [hydrateCells]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return useMemo(
    () => ({
      clearError,
      createNewSheet,
      error,
      renameActiveWorkbook,
      renameExistingSheet,
      selectSheet,
      signIn,
      signOut,
      signUp,
      status,
      user,
      workbook: workspace?.workbook ?? null,
      sheet: workspace?.sheet ?? null,
      sheets: workspace?.workbook.sheets ?? [],
    }),
    [
      clearError,
      createNewSheet,
      error,
      renameActiveWorkbook,
      renameExistingSheet,
      selectSheet,
      signIn,
      signOut,
      signUp,
      status,
      user,
      workspace,
    ],
  );
}

function diffCells(previous: CellMap, next: CellMap) {
  const ids = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changes: Array<{ id: string; raw: string }> = [];

  ids.forEach((id) => {
    const previousRaw = previous[id]?.raw ?? '';
    const nextRaw = next[id]?.raw ?? '';

    if (previousRaw !== nextRaw) {
      changes.push({ id, raw: nextRaw });
    }
  });

  return changes;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function getAuthErrorMessage(error: unknown, mode: 'login' | 'register') {
  if (error instanceof ApiError) {
    if (mode === 'login' && error.status === 401) {
      return 'Email or password is wrong.';
    }

    if (mode === 'register' && error.status === 409) {
      return 'Account already exists. Use Sign in.';
    }

    if (error.status === 403) {
      return 'Session expired. Try again.';
    }
  }

  return getErrorMessage(error);
}

function nextSheetName(sheets: SheetSummary[]) {
  const usedNames = new Set(sheets.map((sheet) => sheet.name.toLowerCase()));
  let index = sheets.length + 1;

  while (usedNames.has(`sheet${index}`.toLowerCase())) {
    index += 1;
  }

  return `Sheet${index}`;
}
