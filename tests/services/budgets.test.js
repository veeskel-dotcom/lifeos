import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build mock db with chainable Dexie-like API
const mockBudgetsData = [];
const mockExpensesData = [];

function createChainableQuery(dataRef) {
  return {
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...dataRef])),
        filter: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...dataRef])),
      }),
    }),
    toArray: vi.fn().mockImplementation(() => Promise.resolve([...dataRef])),
  };
}

vi.mock('../../db/index', () => {
  return {
    default: {
      budgets: {
        where: vi.fn((field) => ({
          equals: vi.fn((val) => ({
            toArray: vi.fn().mockImplementation(() => Promise.resolve([...mockBudgetsData])),
            filter: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          })),
        })),
        add: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(1),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      expenses: {
        where: vi.fn((field) => ({
          equals: vi.fn().mockReturnValue({
            toArray: vi.fn().mockImplementation(() => Promise.resolve([...mockExpensesData])),
          }),
          between: vi.fn().mockReturnValue({
            toArray: vi.fn().mockImplementation(() => Promise.resolve([...mockExpensesData])),
          }),
        })),
      },
      categories: {
        get: vi.fn().mockResolvedValue(null),
      },
    },
  };
});

import { getOverallBudget, getUnallocated, getBudgets } from '../../services/budgets.js';
import db from '../../db/index';

describe('budgets service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBudgetsData.length = 0;
    mockExpensesData.length = 0;
  });

  describe('getOverallBudget', () => {
    it('returns correct shape with totals when budgets and expenses exist', async () => {
      // Set up mock data
      mockBudgetsData.push(
        { id: 1, month: '2026-02', category_id: null, limit: 100000 },
        { id: 2, month: '2026-02', category_id: 1, limit: 30000 },
      );
      mockExpensesData.push(
        { id: 1, category_id: 1, amount_base: 5000, date: '2026-02-10' },
        { id: 2, category_id: 2, amount_base: 3000, date: '2026-02-12' },
      );

      const result = await getOverallBudget('2026-02');

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('spent');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('dailyLimit');
      expect(typeof result.total).toBe('number');
      expect(typeof result.spent).toBe('number');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.dailyLimit).toBe('number');
      // total = 100000 + 30000 = 130000
      expect(result.total).toBe(130000);
    });

    it('returns zeros when no budgets exist', async () => {
      const result = await getOverallBudget('2026-02');

      expect(result).toEqual({
        total: 0,
        spent: 0,
        remaining: 0,
        dailyLimit: 0,
      });
    });

    it('returns { total: 0, spent: 0, remaining: 0, dailyLimit: 0 } on error', async () => {
      // Make the db call throw an error
      db.budgets.where.mockImplementationOnce(() => {
        throw new Error('DB failure');
      });

      const result = await getOverallBudget('2026-02');

      expect(result).toEqual({
        total: 0,
        spent: 0,
        remaining: 0,
        dailyLimit: 0,
      });
    });
  });

  describe('getUnallocated', () => {
    it('returns correct shape when overall and category budgets exist', async () => {
      mockBudgetsData.push(
        { id: 1, month: '2026-02', category_id: null, limit: 100000 },
        { id: 2, month: '2026-02', category_id: 1, limit: 30000 },
        { id: 3, month: '2026-02', category_id: 2, limit: 20000 },
      );

      const result = await getUnallocated('2026-02');

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('allocated');
      expect(result).toHaveProperty('unallocated');
      expect(result.total).toBe(100000);
      expect(result.allocated).toBe(50000);
      expect(result.unallocated).toBe(50000);
    });

    it('returns zeros when no budgets exist', async () => {
      const result = await getUnallocated('2026-02');

      expect(result).toEqual({
        total: 0,
        allocated: 0,
        unallocated: 0,
      });
    });

    it('returns { total: 0, allocated: 0, unallocated: 0 } on error', async () => {
      db.budgets.where.mockImplementationOnce(() => {
        throw new Error('DB failure');
      });

      const result = await getUnallocated('2026-02');

      expect(result).toEqual({
        total: 0,
        allocated: 0,
        unallocated: 0,
      });
    });

    it('returns 0 total when no overall budget (category_id: null) exists', async () => {
      mockBudgetsData.push(
        { id: 2, month: '2026-02', category_id: 1, limit: 30000 },
      );

      const result = await getUnallocated('2026-02');

      expect(result.total).toBe(0);
      expect(result.allocated).toBe(30000);
      expect(result.unallocated).toBe(-30000);
    });
  });
});
