import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data arrays we can manipulate per-test
const mockAccountsData = [];
const mockCreditsData = [];

vi.mock('../../db/index', () => {
  return {
    default: {
      accounts: {
        filter: vi.fn().mockImplementation((fn) => ({
          toArray: vi.fn().mockImplementation(() =>
            Promise.resolve(mockAccountsData.filter(fn))
          ),
        })),
        get: vi.fn().mockResolvedValue(null),
        add: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(1),
        delete: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...mockAccountsData])),
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            toArray: vi.fn().mockResolvedValue([]),
            reverse: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      },
      credits: {
        filter: vi.fn().mockImplementation((fn) => ({
          toArray: vi.fn().mockImplementation(() =>
            Promise.resolve(mockCreditsData.filter(fn))
          ),
        })),
        toArray: vi.fn().mockImplementation(() => Promise.resolve([...mockCreditsData])),
      },
      expenses: {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            filter: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
            reverse: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      },
      incomes: {
        where: vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnValue({
            count: vi.fn().mockResolvedValue(0),
            filter: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
            reverse: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      },
      transaction: vi.fn(),
    },
  };
});

import { getNetWorth } from '../../services/accounts.js';
import db from '../../db/index';

describe('accounts service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountsData.length = 0;
    mockCreditsData.length = 0;

    // Re-setup the filter mock since clearAllMocks resets implementations
    db.accounts.filter.mockImplementation((fn) => ({
      toArray: vi.fn().mockImplementation(() =>
        Promise.resolve(mockAccountsData.filter(fn))
      ),
    }));

    db.credits.filter.mockImplementation((fn) => ({
      toArray: vi.fn().mockImplementation(() =>
        Promise.resolve(mockCreditsData.filter(fn))
      ),
    }));
  });

  describe('getNetWorth', () => {
    it('returns { assets, debt, net } with correct values', async () => {
      mockAccountsData.push(
        { id: 1, type: 'debit', balance: 50000, is_active: true },
        { id: 2, type: 'savings', balance: 100000, is_active: true },
        { id: 3, type: 'cash', balance: 5000, is_active: true },
      );
      mockCreditsData.push(
        { id: 1, remaining_amount: 20000, is_active: true },
      );

      const result = await getNetWorth();

      expect(result).toHaveProperty('assets');
      expect(result).toHaveProperty('debt');
      expect(result).toHaveProperty('net');
      expect(result.assets).toBe(155000);
      expect(result.debt).toBe(20000);
      expect(result.net).toBe(135000);
    });

    it('returns zeros when no accounts or credits exist', async () => {
      const result = await getNetWorth();

      expect(result).toEqual({
        assets: 0,
        debt: 0,
        net: 0,
      });
    });

    it('returns { assets: 0, debt: 0, net: 0 } on error', async () => {
      db.accounts.filter.mockImplementationOnce(() => {
        throw new Error('DB failure');
      });

      const result = await getNetWorth();

      expect(result).toEqual({
        assets: 0,
        debt: 0,
        net: 0,
      });
    });

    it('excludes inactive accounts', async () => {
      mockAccountsData.push(
        { id: 1, type: 'debit', balance: 50000, is_active: true },
        { id: 2, type: 'debit', balance: 30000, is_active: false },
      );

      const result = await getNetWorth();

      // The filter fn `a => a.is_active !== false` should exclude account 2
      expect(result.assets).toBe(50000);
    });

    it('only counts debit, savings, cash, investment as assets', async () => {
      mockAccountsData.push(
        { id: 1, type: 'debit', balance: 10000, is_active: true },
        { id: 2, type: 'savings', balance: 20000, is_active: true },
        { id: 3, type: 'cash', balance: 5000, is_active: true },
        { id: 4, type: 'investment', balance: 15000, is_active: true },
        { id: 5, type: 'credit', balance: 8000, is_active: true },
      );

      const result = await getNetWorth();

      // credit type account should NOT be counted as asset
      expect(result.assets).toBe(50000);
    });

    it('handles missing balance gracefully (defaults to 0)', async () => {
      mockAccountsData.push(
        { id: 1, type: 'debit', is_active: true },
      );
      mockCreditsData.push(
        { id: 1, is_active: true },
      );

      const result = await getNetWorth();

      expect(result.assets).toBe(0);
      expect(result.debt).toBe(0);
      expect(result.net).toBe(0);
    });

    it('rounds values to 2 decimal places', async () => {
      mockAccountsData.push(
        { id: 1, type: 'debit', balance: 100.555, is_active: true },
      );

      const result = await getNetWorth();

      expect(result.assets).toBe(100.56);
      expect(result.net).toBe(100.56);
    });
  });
});
