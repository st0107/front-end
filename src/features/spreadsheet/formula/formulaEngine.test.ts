import { FormulaEngine } from './formulaEngine';
import type { CellMap } from '../types';

function makeCells(values: Record<string, string>): CellMap {
  return Object.fromEntries(
    Object.entries(values).map(([id, raw]) => [id, { id, raw, updatedAt: 1 }]),
  );
}

describe('FormulaEngine', () => {
  it('evaluates arithmetic with operator precedence', () => {
    const engine = new FormulaEngine({});

    expect(engine.evaluateExpression('1 + 2 * 3')).toBe(7);
    expect(engine.evaluateExpression('(1 + 2) * 3')).toBe(9);
  });

  it('evaluates aggregate functions over ranges', () => {
    const engine = new FormulaEngine(
      makeCells({
        A1: '10',
        A2: '20',
        B1: '5',
        B2: '15',
      }),
    );

    expect(engine.evaluateExpression('SUM(A1:B2)')).toBe(50);
    expect(engine.evaluateExpression('AVERAGE(A1:B2)')).toBe(12.5);
    expect(engine.evaluateExpression('MIN(A1:B2)')).toBe(5);
    expect(engine.evaluateExpression('MAX(A1:B2)')).toBe(20);
    expect(engine.evaluateExpression('COUNT(A1:B2)')).toBe(4);
  });

  it('evaluates formulas that reference other formulas', () => {
    const engine = new FormulaEngine(
      makeCells({
        A1: '4',
        A2: '=A1*2',
        A3: '=SUM(A1:A2)',
      }),
    );

    expect(engine.evaluateCell('A3')).toMatchObject({
      display: '12',
      numericValue: 12,
    });
  });

  it('reports circular references', () => {
    const engine = new FormulaEngine(
      makeCells({
        A1: '=A2',
        A2: '=A1',
      }),
    );

    expect(engine.evaluateCell('A1')).toMatchObject({
      display: '#ERROR!',
      numericValue: null,
    });
  });
});
