import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db/helpers module so loadCurrency doesn't hit Dexie
vi.mock('../../db/helpers', () => ({
  getSetting: vi.fn().mockResolvedValue(null),
}));

// Import AFTER mock is set up
import {
  getCurrencyCode,
  getCurrencySymbol,
  fmtMoney,
  fmtMoneyFrac,
  getSymbolForCode,
  loadCurrency,
} from '../../utils/currency.js';

describe('currency utils', () => {
  describe('getCurrencyCode', () => {
    it('returns "RUB" by default (before loadCurrency)', () => {
      expect(getCurrencyCode()).toBe('RUB');
    });
  });

  describe('getCurrencySymbol', () => {
    it('returns "₽" by default (before loadCurrency)', () => {
      expect(getCurrencySymbol()).toBe('₽');
    });
  });

  describe('fmtMoney', () => {
    it('formats a positive integer with default symbol', () => {
      const result = fmtMoney(15000);
      // toLocaleString('ru-RU') uses non-breaking space (U+00A0) as thousands separator
      expect(result).toMatch(/15\s*000₽/);
    });

    it('formats zero', () => {
      const result = fmtMoney(0);
      expect(result).toBe('0₽');
    });

    it('returns "0₽" for null', () => {
      expect(fmtMoney(null)).toBe('0₽');
    });

    it('returns "0₽" for undefined', () => {
      expect(fmtMoney(undefined)).toBe('0₽');
    });

    it('formats negative number', () => {
      const result = fmtMoney(-5000);
      // Should contain the negative sign and thousands separator
      expect(result).toMatch(/-5\s*000₽/);
    });

    it('rounds fractional values', () => {
      const result = fmtMoney(1234.56);
      // Math.round(1234.56) === 1235
      expect(result).toMatch(/1\s*235₽/);
    });

    it('uses custom symbol when provided', () => {
      const result = fmtMoney(100, '$');
      expect(result).toBe('100$');
    });
  });

  describe('fmtMoneyFrac', () => {
    it('formats with 2 decimal places by default', () => {
      const result = fmtMoneyFrac(1234.56);
      expect(result).toMatch(/1\s*234,56₽/);
    });

    it('formats with custom decimals', () => {
      const result = fmtMoneyFrac(1234.5678, 3);
      expect(result).toMatch(/1\s*234,568₽/);
    });

    it('returns "0₽" for null', () => {
      expect(fmtMoneyFrac(null)).toBe('0₽');
    });

    it('returns "0₽" for undefined', () => {
      expect(fmtMoneyFrac(undefined)).toBe('0₽');
    });

    it('uses custom symbol when provided', () => {
      const result = fmtMoneyFrac(100.5, 2, '$');
      expect(result).toMatch(/100,5\$$/);
    });
  });

  describe('getSymbolForCode', () => {
    it('returns ₸ for KZT', () => {
      expect(getSymbolForCode('KZT')).toBe('₸');
    });

    it('returns ₽ for RUB', () => {
      expect(getSymbolForCode('RUB')).toBe('₽');
    });

    it('returns $ for USD', () => {
      expect(getSymbolForCode('USD')).toBe('$');
    });

    it('returns the code itself for unknown currencies', () => {
      expect(getSymbolForCode('BTC')).toBe('BTC');
    });

    it('returns default symbol for null/undefined code', () => {
      expect(getSymbolForCode(null)).toBe('₽');
      expect(getSymbolForCode(undefined)).toBe('₽');
    });
  });

  describe('loadCurrency', () => {
    it('returns default code and symbol when getSetting returns null', async () => {
      const result = await loadCurrency();
      expect(result).toEqual({ code: 'RUB', symbol: '₽' });
    });
  });
});
