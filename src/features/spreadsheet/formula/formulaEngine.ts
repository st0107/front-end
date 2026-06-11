import type { CellMap, EvaluatedCell } from '../types';
import {
  cellIdToPosition,
  isCellReference,
  normalizeCellId,
  positionToCellId,
} from '../utils/address';

type TokenType = 'number' | 'identifier' | 'operator' | 'paren' | 'comma' | 'colon' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

type FormulaValue = number | number[];

const FUNCTIONS: Record<string, (values: number[]) => number> = {
  SUM: (values) => values.reduce((total, value) => total + value, 0),
  AVERAGE: (values) => (values.length ? FUNCTIONS.SUM(values) / values.length : 0),
  MIN: (values) => (values.length ? Math.min(...values) : 0),
  MAX: (values) => (values.length ? Math.max(...values) : 0),
  COUNT: (values) => values.length,
};

export class FormulaEngine {
  constructor(private readonly cells: CellMap) {}

  evaluateCell(cellId: string, visited = new Set<string>()): EvaluatedCell {
    const normalizedId = normalizeCellId(cellId);
    const raw = this.cells[normalizedId]?.raw ?? '';

    if (!raw.startsWith('=')) {
      const numeric = parseNumber(raw);

      return {
        display: raw,
        numericValue: numeric,
      };
    }

    if (visited.has(normalizedId)) {
      return { display: '#CYCLE!', numericValue: null, error: 'Circular reference' };
    }

    visited.add(normalizedId);

    try {
      const value = this.evaluateExpression(raw.slice(1), visited);
      const numeric = coerceNumber(value);

      return {
        display: formatNumber(numeric),
        numericValue: numeric,
      };
    } catch (error) {
      return {
        display: '#ERROR!',
        numericValue: null,
        error: error instanceof Error ? error.message : 'Invalid formula',
      };
    } finally {
      visited.delete(normalizedId);
    }
  }

  evaluateExpression(expression: string, visited = new Set<string>()): FormulaValue {
    const parser = new FormulaParser(tokenize(expression), (id) =>
      this.resolveReference(id, visited),
    );

    return parser.parse();
  }

  private resolveReference(cellId: string, visited: Set<string>): number {
    const evaluated = this.evaluateCell(cellId, visited);

    if (evaluated.error) {
      throw new Error(evaluated.error);
    }

    return evaluated.numericValue ?? 0;
  }
}

class FormulaParser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly resolveCell: (cellId: string) => number,
  ) {}

  parse(): FormulaValue {
    const value = this.parseExpression();
    this.expect('eof');
    return value;
  }

  private parseExpression(): FormulaValue {
    let left = this.parseTerm();

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      left =
        operator === '+'
          ? coerceNumber(left) + coerceNumber(right)
          : coerceNumber(left) - coerceNumber(right);
    }

    return left;
  }

  private parseTerm(): FormulaValue {
    let left = this.parseFactor();

    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value;
      const right = this.parseFactor();
      const divisor = coerceNumber(right);

      if (operator === '/' && divisor === 0) {
        throw new Error('Division by zero');
      }

      left = operator === '*' ? coerceNumber(left) * divisor : coerceNumber(left) / divisor;
    }

    return left;
  }

  private parseFactor(): FormulaValue {
    if (this.matchOperator('-')) {
      return -coerceNumber(this.parseFactor());
    }

    if (this.matchOperator('+')) {
      return coerceNumber(this.parseFactor());
    }

    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    if (this.match('number')) {
      return Number(this.previous().value);
    }

    if (this.match('identifier')) {
      const identifier = this.previous().value.toUpperCase();

      if (this.match('paren', '(')) {
        return this.parseFunction(identifier);
      }

      if (!isCellReference(identifier)) {
        throw new Error(`Unknown identifier ${identifier}`);
      }

      if (this.match('colon')) {
        const end = this.expect('identifier').value.toUpperCase();

        if (!isCellReference(end)) {
          throw new Error('Invalid range end');
        }

        return this.expandRange(identifier, end);
      }

      return this.resolveCell(identifier);
    }

    if (this.match('paren', '(')) {
      const value = this.parseExpression();
      this.expect('paren', ')');
      return value;
    }

    throw new Error(`Unexpected token ${this.peek().value}`);
  }

  private parseFunction(name: string): number {
    const fn = FUNCTIONS[name];

    if (!fn) {
      throw new Error(`Unsupported function ${name}`);
    }

    const args: FormulaValue[] = [];

    if (!this.check('paren', ')')) {
      do {
        args.push(this.parseExpression());
      } while (this.match('comma'));
    }

    this.expect('paren', ')');
    return fn(args.flatMap((value) => (Array.isArray(value) ? value : [value])));
  }

  private expandRange(startId: string, endId: string): number[] {
    const start = cellIdToPosition(startId);
    const end = cellIdToPosition(endId);
    const values: number[] = [];

    for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
      for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) {
        values.push(this.resolveCell(positionToCellId({ row, col })));
      }
    }

    return values;
  }

  private match(type: TokenType, value?: string): boolean {
    if (!this.check(type, value)) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private matchOperator(operator: string): boolean {
    return this.match('operator', operator);
  }

  private check(type: TokenType, value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private expect(type: TokenType, value?: string): Token {
    if (!this.check(type, value)) {
      throw new Error(`Expected ${value ?? type}`);
    }

    this.index += 1;
    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/\d|\./.test(char)) {
      const start = index;
      index += 1;

      while (index < expression.length && /[\d.]/.test(expression[index])) {
        index += 1;
      }

      tokens.push({ type: 'number', value: expression.slice(start, index) });
      continue;
    }

    if (/[A-Za-z$]/.test(char)) {
      const start = index;
      index += 1;

      while (index < expression.length && /[A-Za-z0-9$]/.test(expression[index])) {
        index += 1;
      }

      tokens.push({ type: 'identifier', value: expression.slice(start, index) });
      continue;
    }

    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: char });
      index += 1;
      continue;
    }

    if (char === ':') {
      tokens.push({ type: 'colon', value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character ${char}`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function coerceNumber(value: FormulaValue): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + item, 0);
  }

  return Number.isFinite(value) ? value : 0;
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
}
