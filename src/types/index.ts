export type AccountType = 'checking' | 'savings' | 'cash' | 'wallet' | 'investment' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'card_payment';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'paid';
export type CategoryType = 'income' | 'expense';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number; // in cents
  currentBalance: number; // in cents
  color: string;
  icon: string;
  active: boolean;
  isDemo?: boolean;
  transactionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  active: boolean;
  isSystem: boolean;
  transactionCount?: number;
  createdAt: string;
}

export interface CreditCard {
  id: string;
  name: string;
  creditLimit: number; // in cents
  usedLimit: number; // in cents
  availableLimit: number; // in cents
  currentInvoiceAmount: number; // in cents
  nextInvoiceAmount: number; // in cents
  closingDay: number;
  dueDay: number;
  color: string;
  active: boolean;
  isDemo?: boolean;
  currentMonthKey: string;
  nextMonthKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  status: TransactionStatus;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface CardInvoice {
  monthKey: string;
  cardId: string;
  cardName: string;
  totalAmount: number;
  itemCount: number;
  status: 'open' | 'closed' | 'paid' | 'future';
  closingDate: string;
  dueDate: string;
  items: InvoiceItem[];
}

export interface Transaction {
  id: string;
  accountId?: string;
  accountName?: string;
  accountColor?: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
  destinationAccountColor?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  creditCardId?: string;
  creditCardName?: string;
  creditCardColor?: string;
  type: TransactionType;
  description: string;
  amount: number; // in cents
  transactionDate: string; // YYYY-MM-DD
  invoiceMonth?: string;
  status: TransactionStatus;
  notes?: string;
  tags?: string;
  recurringId?: string;
  installmentId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  accountId?: string;
  accountName?: string;
  accountColor?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  creditCardId?: string;
  creditCardName?: string;
  creditCardColor?: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly';
  billingDay?: number;
  startDate: string;
  nextDueDate: string;
  autoGenerate: boolean;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface CategoryBudget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amountLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  alertPercentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  monthKey: string;
}

export interface NotificationItem {
  id: string;
  type: 'bill_due' | 'invoice_due' | 'budget_warning' | 'recurring_generated';
  title: string;
  message: string;
  entityId?: string;
  read: boolean;
  actionData?: string;
  createdAt: string;
}

export interface ImportReconciledItem {
  id: string;
  fitId?: string;
  transactionDate: string;
  description: string;
  originalDescription?: string;
  origin: string;
  amount: number;
  type: 'income' | 'expense';
  isDuplicate: boolean;
  selected: boolean;
  categoryId?: string;
  categoryName?: string;
  isAutoCategorized?: boolean;
  matchedRuleId?: string;
  memo?: string | null;
  name?: string | null;
  checkNum?: string | null;
  refNum?: string | null;
  trnType?: string | null;
}

export interface PendingImportSession {
  fileInfo: {
    fileName: string;
    fileType: 'ofx' | 'csv';
    content: string;
    savedStatementId?: string | null;
    savedPath?: string | null;
  };
  destType: 'account' | 'card';
  destinationId: string;
  items: ImportReconciledItem[];
  groups: MerchantGroup[];
  saveRulesChecked: boolean;
  step: 'upload' | 'mapping' | 'review';
  timestamp: number;
}

export interface MerchantGroup {
  origin: string;
  count: number;
  totalAmount: number;
  type: 'income' | 'expense';
  suggestedCategoryId?: string | null;
  suggestedCategoryName?: string | null;
  isAutoCategorized: boolean;
  isDuplicate: boolean;
  items: ImportReconciledItem[];
}

export interface ImportSummaryStats {
  totalCount: number;
  categorizedCount: number;
  pendingCategoryCount: number;
  duplicateCount: number;
  groupsCount: number;
}

export interface ReconciledImportResult {
  items: ImportReconciledItem[];
  groups: MerchantGroup[];
  stats: ImportSummaryStats;
}

export interface CsvColumnMapping {
  delimiter?: string;
  dateIndex?: number;
  descIndex?: number;
  amountIndex?: number;
  typeIndex?: number;
}

export interface ParsedCsvResult {
  delimiter: string;
  headers: string[];
  previewRows: string[][];
  detectedMapping: {
    dateIndex: number;
    descIndex: number;
    amountIndex: number;
    typeIndex: number;
  };
  items: ImportReconciledItem[];
}

export interface ImportedStatement {
  id: string;
  fileName: string;
  originalName: string;
  fileType: 'ofx' | 'csv';
  fileSize: number;
  savedPath: string;
  importedAt: string;
  accountId?: string | null;
  accountName?: string | null;
  cardId?: string | null;
  cardName?: string | null;
  itemsCount: number;
  fileExists: boolean;
}

export interface ImportRule {
  id: string;
  pattern: string;
  categoryId?: string | null;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  active: boolean;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarDayData {
  day: number;
  date: string;
  income: number;
  expense: number;
  count: number;
  items: {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    status: string;
    categoryName?: string;
    categoryColor?: string;
  }[];
}

export interface CalendarData {
  year: number;
  month: number;
  monthKey: string;
  daysInMonth: number;
  days: CalendarDayData[];
  currentBalance: number;
  pendingFutureIncome: number;
  pendingFutureExpense: number;
  projectedBalance: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number; // in cents
  currentAmount: number; // in cents
  percentage: number;
  targetDate?: string;
  color: string;
  icon: string;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  userName: string;
  currency: string;
  pinEnabled: boolean;
  theme: 'dark' | 'light';
  onboardingCompleted: boolean;
  firstDayOfWeek: number;
  dateFormat: string;
  autoBackupEnabled: boolean;
  autoBackupDir?: string;
}

export interface DashboardData {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthResult: number;
  prevMonthIncome: number;
  prevMonthExpense: number;
  prevMonthResult: number;
  cardsSummary: {
    totalLimit: number;
    usedLimit: number;
    availableLimit: number;
    cardCount: number;
  };
  upcomingBills: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    categoryName?: string;
    categoryColor?: string;
    accountName?: string;
  }[];
  cashFlowHistory: {
    monthKey: string;
    label: string;
    receitas: number;
    despesas: number;
    resultado: number;
  }[];
  categoryExpenses: {
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    total: number;
    percentage: number;
  }[];
  recentTransactions: Transaction[];
}

export interface ReportsData {
  period: { startDate: string; endDate: string };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netResult: number;
  };
  expensesByCategory: {
    name: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  incomeByCategory: {
    name: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  expensesByAccount: {
    name: string;
    color: string;
    total: number;
  }[];
  expensesByCard: {
    name: string;
    color: string;
    total: number;
  }[];
  topExpenses: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    categoryName: string;
    categoryColor: string;
    sourceName: string;
  }[];
}

export interface ElectronAPI {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  getSettings: () => Promise<Settings>;
  updateSettings: (data: Partial<Settings>) => Promise<Settings>;
  setPin: (pin: string) => Promise<boolean>;
  disablePin: (currentPin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  isPinConfigured: () => Promise<boolean>;

  getAccounts: (includeArchived?: boolean) => Promise<Account[]>;
  createAccount: (data: Partial<Account>) => Promise<Account>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<Account>;
  deleteAccount: (id: string) => Promise<boolean>;
  adjustAccountBalance: (data: {
    accountId: string;
    targetBalance: number;
    adjustmentDate?: string;
    mode?: 'transaction' | 'initial_balance';
    notes?: string;
  }) => Promise<{
    success: boolean;
    diff: number;
    mode?: string;
    message?: string;
    transaction?: any;
    account?: Account;
  }>;

  getCategories: () => Promise<Category[]>;
  createCategory: (data: Partial<Category>) => Promise<Category>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<boolean>;

  getCreditCards: (includeArchived?: boolean) => Promise<CreditCard[]>;
  createCreditCard: (data: Partial<CreditCard>) => Promise<CreditCard>;
  updateCreditCard: (id: string, data: Partial<CreditCard>) => Promise<CreditCard>;
  deleteCreditCard: (id: string) => Promise<boolean>;
  getCardInvoices: (cardId: string) => Promise<CardInvoice[]>;
  payCardInvoice: (data: {
    creditCardId: string;
    invoiceMonth: string;
    accountId: string;
    paymentDate: string;
    amount: number;
  }) => Promise<{ success: boolean; transactionId: string }>;

  getTransactions: (filters?: Record<string, any>) => Promise<Transaction[]>;
  createTransaction: (data: any) => Promise<any>;
  updateTransaction: (id: string, data: any) => Promise<Transaction>;
  deleteTransaction: (id: string, deleteGroup?: boolean) => Promise<boolean>;
  duplicateTransaction: (id: string) => Promise<any>;
  batchMoveTransactions: (data: {
    transactionIds: string[];
    targetAccountId: string;
    targetType?: 'account' | 'card';
  }) => Promise<{ success: boolean; updatedCount: number }>;

  // Recurring Rules
  getRecurringRules: () => Promise<RecurringRule[]>;
  createRecurringRule: (data: any) => Promise<RecurringRule>;
  updateRecurringRule: (id: string, data: any) => Promise<RecurringRule>;
  toggleRecurringRule: (id: string) => Promise<boolean>;
  deleteRecurringRule: (id: string) => Promise<boolean>;
  executeRecurringNow: (id: string) => Promise<any>;
  processRecurringRules: () => Promise<number>;

  // Category Budgets
  getCategoryBudgets: (monthKey?: string) => Promise<CategoryBudget[]>;
  setCategoryBudget: (data: { categoryId: string; amountLimit: number; alertPercentage?: number }) => Promise<CategoryBudget>;
  deleteCategoryBudget: (id: string) => Promise<boolean>;

  // Smart Notifications
  getNotifications: () => Promise<{ unreadCount: number; notifications: NotificationItem[] }>;
  markNotificationRead: (id: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;

  // Banking OFX / CSV & Vault
  openBankingFileDialog: () => Promise<{ canceled: boolean; filePath?: string; fileName?: string; fileType?: string; content?: string; savedStatementId?: string | null; savedPath?: string | null }>;
  parseOFX: (content: string) => Promise<ImportReconciledItem[]>;
  parseCSV: (content: string, customMapping?: CsvColumnMapping) => Promise<ParsedCsvResult>;
  reconcileImport: (data: { accountId: string; isCreditCard?: boolean; items: any[] }) => Promise<ReconciledImportResult>;
  batchImportTransactions: (data: { accountId: string; isCreditCard?: boolean; items: any[]; saveRules?: boolean }) => Promise<{ success: boolean; count: number; learnedRulesCount?: number }>;
  getSavedStatements: () => Promise<ImportedStatement[]>;
  openStatementsFolder: () => Promise<string>;
  updateStatementStats: (id: string, data: { itemsCount?: number; accountId?: string; cardId?: string }) => Promise<void>;

  // Learned Auto-Categorization Import Rules
  getImportRules: () => Promise<ImportRule[]>;
  saveImportRule: (data: { id?: string; pattern: string; categoryId?: string | null; active?: boolean }) => Promise<ImportRule>;
  deleteImportRule: (id: string) => Promise<boolean>;
  toggleImportRule: (id: string) => Promise<boolean>;

  // Financial Calendar & Projections
  getCalendarData: (year: number, month: number) => Promise<CalendarData>;

  getGoals: () => Promise<Goal[]>;
  createGoal: (data: Partial<Goal>) => Promise<Goal>;
  updateGoal: (id: string, data: Partial<Goal>) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<boolean>;
  addFundsToGoal: (id: string, amount: number, accountId?: string) => Promise<Goal>;

  getDashboardData: () => Promise<DashboardData>;
  getReports: (filters?: any) => Promise<ReportsData>;

  exportBackupDialog: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  restoreBackupDialog: () => Promise<{ success: boolean; canceled?: boolean }>;
  exportCsvDialog: (filters?: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;

  seedDemoData: () => Promise<boolean>;
  clearDemoData: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
