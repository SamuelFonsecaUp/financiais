import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Account,
  Category,
  CreditCard,
  Goal,
  Settings,
  DashboardData,
  Transaction,
  RecurringRule,
  CategoryBudget,
  NotificationItem,
  PendingImportSession,
} from '../types';

export type AppView =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'cards'
  | 'recurring'
  | 'budgets'
  | 'calendar'
  | 'categories'
  | 'goals'
  | 'reports'
  | 'settings'
  | 'import';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FinancialContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isLocked: boolean;
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  settings: Settings | null;
  accounts: Account[];
  categories: Category[];
  creditCards: CreditCard[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  budgets: CategoryBudget[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  refreshNotifications: () => Promise<void>;
  dashboardData: DashboardData | null;
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  // Global modals control
  transactionModalOpen: boolean;
  setTransactionModalOpen: (open: boolean) => void;
  editingTransaction: Transaction | null;
  openNewTransaction: (initial?: Partial<Transaction>) => void;
  openEditTransaction: (tx: Transaction) => void;
  closeTransactionModal: () => void;

  // Banking import modal & full-page view
  importModalOpen: boolean;
  setImportModalOpen: (open: boolean) => void;
  pendingImportSession: PendingImportSession | null;
  saveImportSession: (session: PendingImportSession) => void;
  clearImportSession: () => void;
  resumeImportSession: () => void;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Transaction Modal State
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Bank Import Modal & Draft State
  const [importModalOpen, setImportModalOpenState] = useState(false);

  // Pending import session draft state with localStorage caching
  const [pendingImportSession, setPendingImportSession] = useState<PendingImportSession | null>(() => {
    try {
      const saved = localStorage.getItem('meu_financeiro_import_draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveImportSession = useCallback((session: PendingImportSession) => {
    setPendingImportSession(session);
    try {
      localStorage.setItem('meu_financeiro_import_draft', JSON.stringify(session));
    } catch {}
  }, []);

  const clearImportSession = useCallback(() => {
    setPendingImportSession(null);
    try {
      localStorage.removeItem('meu_financeiro_import_draft');
    } catch {}
  }, []);

  const setImportModalOpen = useCallback((open: boolean) => {
    if (open) {
      setCurrentView('import');
    }
    setImportModalOpenState(false);
  }, []);

  const resumeImportSession = useCallback(() => {
    setCurrentView('import');
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.getNotifications();
      setNotifications(res.notifications);
      setUnreadNotificationsCount(res.unreadCount);
    } catch (e) {
      console.error('Error refreshing notifications:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      if (!window.electronAPI) return;

      const [s, accs, cats, cards, gls, recs, bdgs, notifs, dash] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.getAccounts(true),
        window.electronAPI.getCategories(),
        window.electronAPI.getCreditCards(true),
        window.electronAPI.getGoals(),
        window.electronAPI.getRecurringRules(),
        window.electronAPI.getCategoryBudgets(),
        window.electronAPI.getNotifications(),
        window.electronAPI.getDashboardData(),
      ]);

      setSettings(s);
      setAccounts(accs);
      setCategories(cats);
      setCreditCards(cards);
      setGoals(gls);
      setRecurringRules(recs);
      setBudgets(bdgs);
      setNotifications(notifs.notifications);
      setUnreadNotificationsCount(notifs.unreadCount);
      setDashboardData(dash);

      // Apply theme
      if (s?.theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      showToast(err.message || 'Erro ao carregar dados do banco local.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial load & PIN check
  useEffect(() => {
    async function init() {
      if (!window.electronAPI) {
        setIsLoading(false);
        return;
      }
      try {
        const pinConfigured = await window.electronAPI.isPinConfigured();
        if (pinConfigured) {
          setIsLocked(true);
        }
        await refreshAll();
      } catch (e: any) {
        console.error('Init error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshAll]);

  // Global Keyboard Shortcuts (Desktop Productivity)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N -> New Transaction
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTransaction(null);
        setTransactionModalOpen(true);
      }
      // Ctrl+F -> Search Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCurrentView('transactions');
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder*="Pesquisar"]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const unlockApp = async (pin: string): Promise<boolean> => {
    if (!window.electronAPI) return true;
    try {
      const valid = await window.electronAPI.verifyPin(pin);
      if (valid) {
        setIsLocked(false);
        showToast('Aplicativo desbloqueado.', 'info');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const lockApp = () => {
    if (settings?.pinEnabled) {
      setIsLocked(true);
    }
  };

  const openNewTransaction = (initial?: Partial<Transaction>) => {
    setEditingTransaction(initial as Transaction || null);
    setTransactionModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setEditingTransaction(null);
    setTransactionModalOpen(false);
  };

  return (
    <FinancialContext.Provider
      value={{
        currentView,
        setCurrentView,
        isLocked,
        unlockApp,
        lockApp,
        settings,
        accounts,
        categories,
        creditCards,
        goals,
        recurringRules,
        budgets,
        notifications,
        unreadNotificationsCount,
        notificationsOpen,
        setNotificationsOpen,
        refreshNotifications,
        dashboardData,
        isLoading,
        refreshAll,
        toasts,
        showToast,
        dismissToast,
        transactionModalOpen,
        setTransactionModalOpen,
        editingTransaction,
        openNewTransaction,
        openEditTransaction,
        closeTransactionModal,
        importModalOpen,
        setImportModalOpen,
        pendingImportSession,
        saveImportSession,
        clearImportSession,
        resumeImportSession,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
};
