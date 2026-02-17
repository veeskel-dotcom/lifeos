/**
 * export.js — CSV экспорт с защитой от CSV injection
 *
 * BOM (\ufeff) добавляется для корректного открытия в Excel.
 * CSV injection: prefix "'" для значений начинающихся с =, +, -, @, \t, \r
 */

import { getExpenses } from './expenses';
import { getIncomes } from './incomes';

// ─── Sanitization ───────────────────────────────────────

/**
 * Защита от CSV injection.
 * Значения начинающиеся с =, +, -, @, tab, CR получают prefix "'".
 * Значения содержащие запятые или кавычки — экранируются кавычками.
 */
function sanitizeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // CSV injection prevention
  const sanitized = /^[=+\-@\t\r]/.test(str) ? "'" + str : str;
  // Экранирование: если содержит запятую, кавычку или перенос строки
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return '"' + sanitized.replace(/"/g, '""') + '"';
  }
  return sanitized;
}

function buildCSV(header, rows) {
  const headerLine = header.join(',');
  const dataLines = rows.map(row => row.map(sanitizeCSV).join(','));
  const csv = [headerLine, ...dataLines].join('\n');
  // BOM для Excel
  return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
}

// ─── Экспорт расходов ───────────────────────────────────

/**
 * Экспортировать расходы в CSV.
 * @param {object} filters - фильтры для getExpenses
 * @returns {Blob} CSV файл
 */
export async function exportExpensesCSV(filters = {}) {
  try {
    const expenses = await getExpenses({ ...filters, limit: 100000, offset: 0 });

    const header = ['Дата', 'Время', 'Сумма', 'Валюта', 'Сумма (KZT)', 'Категория', 'Описание', 'Счёт', 'Источник'];
    const rows = expenses.map(e => [
      e.date,
      e.time || '',
      e.amount,
      e.currency,
      e.amount_base,
      e.category_path_snapshot,
      e.description,
      e.account_name_snapshot,
      e.source,
    ]);

    return buildCSV(header, rows);

  } catch (e) {
    console.error('[export.exportExpensesCSV]', e);
    throw e;
  }
}

// ─── Экспорт доходов ────────────────────────────────────

/**
 * Экспортировать доходы в CSV.
 * @param {object} filters - фильтры для getIncomes
 * @returns {Blob} CSV файл
 */
export async function exportIncomesCSV(filters = {}) {
  try {
    const incomes = await getIncomes({ ...filters, limit: 100000, offset: 0 });

    const header = ['Дата', 'Сумма', 'Валюта', 'Сумма (KZT)', 'Источник', 'Описание', 'Счёт'];
    const rows = incomes.map(i => [
      i.date,
      i.amount,
      i.currency,
      i.amount_base,
      i.source,
      i.description,
      i.account_name_snapshot,
    ]);

    return buildCSV(header, rows);

  } catch (e) {
    console.error('[export.exportIncomesCSV]', e);
    throw e;
  }
}

// ─── Скачивание ─────────────────────────────────────────

/**
 * Триггер скачивания Blob как файла.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
