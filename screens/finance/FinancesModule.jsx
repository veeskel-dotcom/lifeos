import { useState } from 'react';
import { addExpense, updateExpense, deleteExpense } from '../../services/expenses';
import { addIncome, updateIncome, deleteIncome } from '../../services/incomes';
import { addAccount, updateAccount, deleteAccount } from '../../services/accounts';
import { addCredit, updateCredit, deleteCredit } from '../../services/credits';
import FinancesOverview from './FinancesOverview';
import ExpensesList from './ExpensesList';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';
import IncomeList from './IncomeList';
import AccountsList from './AccountsList';
import AccountDetail from './AccountDetail';
import AccountForm from './AccountForm';
import CreditsList from './CreditsList';
import CreditDetail from './CreditDetail';
import CreditForm from './CreditForm';
import BudgetsList from './BudgetsList';
import BudgetCategoryDetail from './BudgetCategoryDetail';
import FinanceAnalytics from './FinanceAnalytics';
import FinanceTools from './FinanceTools';
import TransferForm from './TransferForm';
import UtilitiesScreen from './UtilitiesScreen';
import FadeIn from '../../components/FadeIn';

export default function FinancesModule({ theme, onBack, initialView, mode, editItem: editItemProp, filterCategoryId, filterMonth, filterCategoryName, onNavigate: parentNavigate, onToast }) {
  // mode prop from App.jsx maps to internal view names
  const modeToView = {
    'analytics': 'analytics',
    'expenses': 'expenses',
    'expense-form': 'expenseForm',
    'transfer': 'transfer',
  };
  const initialScreen = modeToView[mode] || initialView || 'overview';
  const [view, setView] = useState(initialScreen);
  const [editItem, setEditItem] = useState(editItemProp || null);
  const [detailId, setDetailId] = useState(null);
  const [params, setParams] = useState({ filterCategoryId, filterMonth, filterCategoryName });
  const [filterAccountId, setFilterAccountId] = useState(null);

  // Navigation
  const navigate = (targetView, navParams = {}) => {
    setView(targetView);
    setEditItem(navParams.edit || null);
    setDetailId(navParams.detailId || null);
    setParams(navParams);
    if (navParams.filterAccountId !== undefined) setFilterAccountId(navParams.filterAccountId);

    // Handle special actions
    if (targetView === 'deleteCredit' && navParams.deleteId) {
      deleteCredit(navParams.deleteId).then(() => setView('credits'));
      return;
    }
  };

  const goBack = () => {
    const backMap = {
      expenses: 'overview',
      expenseForm: editItem ? 'expenses' : 'overview',
      transfer: 'overview',
      incomes: 'overview',
      incomeForm: editItem ? 'incomes' : 'overview',
      accounts: 'overview',
      accountDetail: 'accounts',
      accountForm: editItem ? 'accountDetail' : 'accounts',
      credits: 'overview',
      creditDetail: 'credits',
      creditForm: 'credits',
      budgets: 'overview',
      utilities: 'overview',
    };
    const target = backMap[view] || 'overview';
    // If opened directly in a sub-view (e.g. mode='expenses') and going back
    // would reach 'overview', exit the module instead
    if (target === 'overview' && initialScreen !== 'overview') {
      onBack?.();
      return;
    }
    setView(target);
    setEditItem(null);
    setFilterAccountId(null);
  };

  // CRUD Handlers — через сервисный слой
  const handleSaveExpense = async (data) => {
    if (data.id) {
      await updateExpense(data.id, data);
    } else {
      await addExpense(data);
    }
    setView(editItem ? 'expenses' : 'overview');
    setEditItem(null);
  };

  const handleDeleteExpense = async (id) => {
    await deleteExpense(id);
    setView('expenses');
    setEditItem(null);
  };

  const handleSaveIncome = async (data) => {
    if (data.id) {
      await updateIncome(data.id, data);
    } else {
      await addIncome(data);
    }
    setView('overview');
    setEditItem(null);
  };

  const handleDeleteIncome = async (id) => {
    await deleteIncome(id);
    setView('overview');
    setEditItem(null);
  };

  const handleSaveAccount = async (data) => {
    if (data.id) {
      await updateAccount(data.id, data);
    } else {
      await addAccount(data);
    }
    setView('accounts');
    setEditItem(null);
  };

  const handleDeleteAccount = async (id) => {
    const result = await deleteAccount(id);
    if (result && !result.deleted) {
      onToast?.(result.reason || 'Не удалось удалить счёт');
      return;
    }
    setView('accounts');
    setEditItem(null);
  };

  const handleSaveCredit = async (data) => {
    if (data.id) {
      await updateCredit(data.id, data);
    } else {
      await addCredit(data);
    }
    setView('credits');
    setEditItem(null);
  };

  const handleDeleteCredit = async (id) => {
    await deleteCredit(id);
    setView('credits');
    setEditItem(null);
  };

  // Render by view
  const content = (() => {
    switch (view) {
    case 'overview':
      return <FinancesOverview theme={theme} onNavigate={navigate} onBack={onBack} />;

    case 'expenses':
      return (
        <ExpensesList
          theme={theme}
          onBack={goBack}
          onNavigate={navigate}
          filterAccountId={filterAccountId}
          filterCategoryId={params?.filterCategoryId}
          filterCategoryName={params?.filterCategoryName}
          filterMonth={params?.filterMonth}
        />
      );

    case 'expense-form':
    case 'expenseForm':
      return (
        <ExpenseForm
          theme={theme}
          expense={editItem}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
          onClose={goBack}
        />
      );

    case 'incomes':
      return <IncomeList theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'incomeForm':
      return (
        <IncomeForm
          theme={theme}
          income={editItem}
          onSave={handleSaveIncome}
          onDelete={handleDeleteIncome}
          onClose={goBack}
        />
      );

    case 'accounts':
      return <AccountsList theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'accountDetail':
      return <AccountDetail accountId={detailId} theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'accountForm':
      return (
        <AccountForm
          theme={theme}
          account={editItem}
          onSave={handleSaveAccount}
          onDelete={handleDeleteAccount}
          onClose={goBack}
        />
      );

    case 'credits':
      return <CreditsList theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'creditDetail':
      return <CreditDetail creditId={detailId} theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'creditForm':
      return (
        <CreditForm
          theme={theme}
          credit={editItem}
          onSave={handleSaveCredit}
          onDelete={handleDeleteCredit}
          onClose={goBack}
        />
      );

    case 'budgets':
      return <BudgetsList theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'budgetCategory':
      return <BudgetCategoryDetail categoryId={detailId} month={params?.month} theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'analytics':
      return <FinanceAnalytics theme={theme} onBack={goBack} />;
    case 'finance-tools':
      return <FinanceTools theme={theme} onBack={goBack} />;

    case 'transfer':
      return <TransferForm theme={theme} onBack={goBack} onToast={onToast} />;

    case 'utilities':
      return <UtilitiesScreen theme={theme} onClose={goBack} />;

    default:
      return <FinancesOverview theme={theme} onNavigate={navigate} onBack={onBack} />;
    }
  })();

  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      <FadeIn key={view}>{content}</FadeIn>
    </div>
  );
}
