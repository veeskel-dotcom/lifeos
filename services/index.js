/**
 * src/services/index.js — Реэкспорт финансового сервисного слоя
 */

// Расходы
export {
  addExpense,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  getMonthlyStats,
  getTodayStats,
  getWeeklyStats,
  getCategoryBreakdown,
  getDailyTrend,
} from './expenses';

// Доходы
export {
  addIncome,
  getIncome,
  updateIncome,
  deleteIncome,
  getIncomes,
  getMonthlyIncome,
} from './incomes';

// Счета
export {
  addAccount,
  getAccount,
  getAccounts,
  getActiveAccounts,
  updateAccount,
  deleteAccount,
  getNetWorth,
  getAccountBalance,
} from './accounts';

// Кредиты
export {
  addCredit,
  getCredit,
  getCredits,
  getActiveCredits,
  updateCredit,
  deleteCredit,
  getUpcomingPayments,
  calculateEarlyPayoff,
} from './credits';

// Бюджеты
export {
  setBudgetLimit,
  deleteBudget,
  getBudgets,
  getOverallBudget,
  getUnallocated,
} from './budgets';

// Валюты
export {
  fetchRates,
  getRate,
  convert,
  getLastUpdate,
  getAvailableCurrencies,
} from './currencies';

// OCR
export {
  parseReceipt,
  parseBankStatement,
  parseCreditDoc,
} from './ocr';

// Экспорт
export {
  exportExpensesCSV,
  exportIncomesCSV,
} from './export';
