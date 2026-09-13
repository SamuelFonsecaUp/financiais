const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, strongly-typed APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App & Window
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Settings & Security
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data) => ipcRenderer.invoke('settings:update', data),
  setPin: (pin) => ipcRenderer.invoke('pin:set', pin),
  disablePin: (currentPin) => ipcRenderer.invoke('pin:disable', currentPin),
  verifyPin: (pin) => ipcRenderer.invoke('pin:verify', pin),
  isPinConfigured: () => ipcRenderer.invoke('pin:isConfigured'),

  // Accounts
  getAccounts: (includeArchived) => ipcRenderer.invoke('accounts:get', includeArchived),
  createAccount: (data) => ipcRenderer.invoke('accounts:create', data),
  updateAccount: (id, data) => ipcRenderer.invoke('accounts:update', id, data),
  deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:get'),
  createCategory: (data) => ipcRenderer.invoke('categories:create', data),
  updateCategory: (id, data) => ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Credit Cards
  getCreditCards: (includeArchived) => ipcRenderer.invoke('cards:get', includeArchived),
  createCreditCard: (data) => ipcRenderer.invoke('cards:create', data),
  updateCreditCard: (id, data) => ipcRenderer.invoke('cards:update', id, data),
  deleteCreditCard: (id) => ipcRenderer.invoke('cards:delete', id),
  getCardInvoices: (cardId) => ipcRenderer.invoke('cards:getInvoices', cardId),
  payCardInvoice: (data) => ipcRenderer.invoke('cards:payInvoice', data),

  // Transactions
  getTransactions: (filters) => ipcRenderer.invoke('transactions:get', filters),
  createTransaction: (data) => ipcRenderer.invoke('transactions:create', data),
  updateTransaction: (id, data) => ipcRenderer.invoke('transactions:update', id, data),
  deleteTransaction: (id, deleteGroup) => ipcRenderer.invoke('transactions:delete', id, deleteGroup),
  duplicateTransaction: (id) => ipcRenderer.invoke('transactions:duplicate', id),

  // Recurring Rules
  getRecurringRules: () => ipcRenderer.invoke('recurring:get'),
  createRecurringRule: (data) => ipcRenderer.invoke('recurring:create', data),
  updateRecurringRule: (id, data) => ipcRenderer.invoke('recurring:update', id, data),
  toggleRecurringRule: (id) => ipcRenderer.invoke('recurring:toggle', id),
  deleteRecurringRule: (id) => ipcRenderer.invoke('recurring:delete', id),
  executeRecurringNow: (id) => ipcRenderer.invoke('recurring:executeNow', id),
  processRecurringRules: () => ipcRenderer.invoke('recurring:process'),

  // Category Budgets
  getCategoryBudgets: (monthKey) => ipcRenderer.invoke('budgets:get', monthKey),
  setCategoryBudget: (data) => ipcRenderer.invoke('budgets:set', data),
  deleteCategoryBudget: (id) => ipcRenderer.invoke('budgets:delete', id),

  // Smart Notifications
  getNotifications: () => ipcRenderer.invoke('notifications:get'),
  markNotificationRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
  markAllNotificationsRead: () => ipcRenderer.invoke('notifications:markAllRead'),
  deleteNotification: (id) => ipcRenderer.invoke('notifications:delete', id),

  // Banking OFX & CSV Import & Vault
  openBankingFileDialog: () => ipcRenderer.invoke('banking:openFile'),
  parseOFX: (content) => ipcRenderer.invoke('banking:parseOFX', content),
  parseCSV: (content, customMapping) => ipcRenderer.invoke('banking:parseCSV', content, customMapping),
  reconcileImport: (data) => ipcRenderer.invoke('banking:reconcile', data),
  batchImportTransactions: (data) => ipcRenderer.invoke('banking:batchImport', data),
  getSavedStatements: () => ipcRenderer.invoke('banking:getSavedStatements'),
  openStatementsFolder: () => ipcRenderer.invoke('banking:openStatementsFolder'),
  updateStatementStats: (id, data) => ipcRenderer.invoke('banking:updateStatementStats', id, data),

  // Learned Auto-Categorization Import Rules
  getImportRules: () => ipcRenderer.invoke('importRules:get'),
  saveImportRule: (data) => ipcRenderer.invoke('importRules:save', data),
  deleteImportRule: (id) => ipcRenderer.invoke('importRules:delete', id),
  toggleImportRule: (id) => ipcRenderer.invoke('importRules:toggle', id),

  // Financial Calendar & Projections
  getCalendarData: (year, month) => ipcRenderer.invoke('calendar:get', year, month),

  // Goals
  getGoals: () => ipcRenderer.invoke('goals:get'),
  createGoal: (data) => ipcRenderer.invoke('goals:create', data),
  updateGoal: (id, data) => ipcRenderer.invoke('goals:update', id, data),
  deleteGoal: (id) => ipcRenderer.invoke('goals:delete', id),
  addFundsToGoal: (id, amount, accountId) => ipcRenderer.invoke('goals:addFunds', id, amount, accountId),

  // Dashboard & Reports
  getDashboardData: () => ipcRenderer.invoke('dashboard:get'),
  getReports: (filters) => ipcRenderer.invoke('reports:get', filters),

  // Backup, Restore & CSV Dialogs
  exportBackupDialog: () => ipcRenderer.invoke('backup:export'),
  restoreBackupDialog: () => ipcRenderer.invoke('backup:restore'),
  exportCsvDialog: (filters) => ipcRenderer.invoke('csv:export', filters),

  // Demo Data
  seedDemoData: () => ipcRenderer.invoke('demo:seed'),
  clearDemoData: () => ipcRenderer.invoke('demo:clear'),
});
