import type { CellMap } from '../types';

const API_BASE_URL = '/api/v1';
const TOKEN_STORAGE_KEY = 'spreadsheet.authToken';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface WorkbookSummary {
  id: string;
  name: string;
  updatedAt: string;
  lastSavedAt: string | null;
  version: number;
}

export interface SheetSummary {
  id: string;
  name: string;
  position: number;
  rowCount: number;
  columnCount: number;
}

export interface SheetResponse extends SheetSummary {
  workbookId: string;
  createdAt: string;
  updatedAt: string;
  lastSavedAt: string | null;
  version: number;
}

export interface WorkbookResponse extends WorkbookSummary {
  ownerId: string;
  createdAt: string;
  sheets: SheetSummary[];
}

export interface CellResponse {
  id: string;
  rowIndex: number;
  columnIndex: number;
  raw: string;
  formula: string | null;
  updatedAt: string;
}

export interface CellPageResponse {
  cells: CellResponse[];
  nextCursor: string | null;
}

interface PageResponse<T> {
  content: T[];
}

export interface WorkspaceContext {
  workbook: WorkbookResponse;
  sheet: SheetSummary;
}

let authToken = readStoredToken();

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export async function register(email: string, password: string) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export async function logout() {
  await request<void>('/auth/logout', { method: 'POST' });
  setAuthToken(null);
}

export function getCurrentUser() {
  return request<AuthUser>('/auth/me');
}

export async function ensureWorkspace(): Promise<WorkspaceContext> {
  const workbooks = await request<PageResponse<WorkbookSummary>>('/workbooks?page=0&size=1');
  const workbook =
    workbooks.content[0] ?
      await getWorkbook(workbooks.content[0].id) :
      await request<WorkbookResponse>('/workbooks', {
        method: 'POST',
        body: { name: 'Untitled spreadsheet' },
      });
  const sheet = workbook.sheets[0];

  if (!sheet) {
    throw new Error('Workbook does not contain a sheet.');
  }

  return { workbook, sheet };
}

export function getWorkbook(workbookId: string) {
  return request<WorkbookResponse>(`/workbooks/${workbookId}`);
}

export function renameWorkbook(workbookId: string, name: string) {
  return request<WorkbookResponse>(`/workbooks/${workbookId}`, {
    method: 'PATCH',
    body: { name },
  });
}

export function createSheet(workbookId: string, name: string) {
  return request<SheetResponse>(`/workbooks/${workbookId}/sheets`, {
    method: 'POST',
    body: { name },
  });
}

export function renameSheet(workbookId: string, sheetId: string, name: string) {
  return request<SheetResponse>(`/workbooks/${workbookId}/sheets/${sheetId}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function loadSheetCells(workbookId: string, sheetId: string): Promise<CellMap> {
  const cells: CellMap = {};
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ size: '1000' });

    if (cursor) {
      query.set('cursor', cursor);
    }

    const page = await request<CellPageResponse>(
      `/workbooks/${workbookId}/sheets/${sheetId}/cells/page?${query}`,
    );

    page.cells.forEach((cell) => {
      cells[cell.id] = {
        id: cell.id,
        raw: cell.raw,
        updatedAt: Date.parse(cell.updatedAt),
      };
    });

    cursor = page.nextCursor;
  } while (cursor);

  return cells;
}

export async function saveCells(workbookId: string, sheetId: string, cells: Array<{ id: string; raw: string }>) {
  if (cells.length === 0) {
    return;
  }

  for (let index = 0; index < cells.length; index += 1000) {
    const updates = cells.slice(index, index + 1000);

    await request<CellResponse[]>(`/workbooks/${workbookId}/sheets/${sheetId}/cells:batchUpdate`, {
      method: 'PATCH',
      body: { updates },
    });
  }
}

export function saveSheet(workbookId: string, sheetId: string) {
  return request(`/workbooks/${workbookId}/sheets/${sheetId}/save`, { method: 'POST' });
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  const fallback = `${response.status} ${response.statusText}`;

  try {
    const problem = await response.json();
    return problem.detail ?? problem.title ?? fallback;
  } catch {
    return fallback;
  }
}

function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
