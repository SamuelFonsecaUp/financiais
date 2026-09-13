const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database.cjs');
const { getFinancialService } = require('./services.cjs');

let mainWindow = null;
let service = null;

// Error logging helper
function logError(error, context = '') {
  try {
    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'app_errors.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${context}] ${error.stack || error.message || error}\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (e) {
    console.error('Failed to write to error log:', e);
  }
}

// Wrap IPC calls with safety and user-friendly error messages
function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(error, channel);
      // Return user-friendly error message, hiding raw technical details
      const message = error.message && !error.message.includes('SQLITE_')
        ? error.message
        : 'Não foi possível completar a operação. Verifique os dados e tente novamente.';
      throw new Error(message);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 820,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: '#090d16',
    title: 'Meu Financeiro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // Wait until ready-to-show to avoid white flicker
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Check if running in dev or production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = 'http://localhost:5173';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Fallback to built files if dev server not active
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize Database in user data dir with self-healing recovery
  try {
    initDatabase();
    service = getFinancialService();
    // Process any due recurring transactions upon launch
    service.processRecurringRules();
  } catch (err) {
    logError(err, 'Database Initialization - Attempt 1');
    try {
      // Auto-recovery attempt: backup existing corrupted/locked db and recreate cleanly
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'meu_financeiro.sqlite');
      if (fs.existsSync(dbPath)) {
        const backupPath = path.join(userDataPath, `meu_financeiro_recovery_${Date.now()}.sqlite`);
        try { fs.copyFileSync(dbPath, backupPath); } catch (e) {}
        try { fs.unlinkSync(dbPath); } catch (e) {}
        try { fs.unlinkSync(`${dbPath}-wal`); } catch (e) {}
        try { fs.unlinkSync(`${dbPath}-shm`); } catch (e) {}
      }
      initDatabase();
      service = getFinancialService();
      service.processRecurringRules();
    } catch (retryErr) {
      logError(retryErr, 'Database Initialization - Retry Failed');
      dialog.showErrorBox(
        'Erro ao inicializar Meu Financeiro',
        'Não foi possível inicializar o banco de dados local. Por favor, reinicie a aplicação.'
      );
      app.quit();
      return;
    }
  }

  // Register IPC Handlers

  // Window Controls
  handleIpc('window:minimize', () => mainWindow?.minimize());
  handleIpc('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
    return mainWindow?.isMaximized();
  });
  handleIpc('window:close', () => mainWindow?.close());
  handleIpc('window:isMaximized', () => mainWindow?.isMaximized());

  // Settings & Security
  handleIpc('settings:get', () => service.getSettings());
  handleIpc('settings:update', (data) => service.updateSettings(data));
  handleIpc('pin:set', (pin) => service.setPin(pin));
  handleIpc('pin:disable', (currentPin) => service.disablePin(currentPin));
  handleIpc('pin:verify', (pin) => service.verifyAppPin(pin));
  handleIpc('pin:isConfigured', () => service.isPinConfigured());

  // Accounts
  handleIpc('accounts:get', (includeArchived) => service.getAccounts(includeArchived));
  handleIpc('accounts:create', (data) => service.createAccount(data));
  handleIpc('accounts:update', (id, data) => service.updateAccount(id, data));
  handleIpc('accounts:delete', (id) => service.deleteAccount(id));

  // Categories
  handleIpc('categories:get', () => service.getCategories());
  handleIpc('categories:create', (data) => service.createCategory(data));
  handleIpc('categories:update', (id, data) => service.updateCategory(id, data));
  handleIpc('categories:delete', (id) => service.deleteCategory(id));

  // Credit Cards
  handleIpc('cards:get', (includeArchived) => service.getCreditCards(includeArchived));
  handleIpc('cards:create', (data) => service.createCreditCard(data));
  handleIpc('cards:update', (id, data) => service.updateCreditCard(id, data));
  handleIpc('cards:delete', (id) => service.deleteCreditCard(id));
  handleIpc('cards:getInvoices', (cardId) => service.getCardInvoices(cardId));
  handleIpc('cards:payInvoice', (data) => service.payCardInvoice(data));

  // Transactions
  handleIpc('transactions:get', (filters) => service.getTransactions(filters));
  handleIpc('transactions:create', (data) => service.createTransaction(data));
  handleIpc('transactions:update', (id, data) => service.updateTransaction(id, data));
  handleIpc('transactions:delete', (id, deleteGroup) => service.deleteTransaction(id, deleteGroup));
  handleIpc('transactions:duplicate', (id) => service.duplicateTransaction(id));

  // Recurring Rules
  handleIpc('recurring:get', () => service.getRecurringRules());
  handleIpc('recurring:create', (data) => service.createRecurringRule(data));
  handleIpc('recurring:update', (id, data) => service.updateRecurringRule(id, data));
  handleIpc('recurring:toggle', (id) => service.toggleRecurringRule(id));
  handleIpc('recurring:delete', (id) => service.deleteRecurringRule(id));
  handleIpc('recurring:executeNow', (id) => service.executeRecurringNow(id));
  handleIpc('recurring:process', () => service.processRecurringRules());

  // Category Budgets
  handleIpc('budgets:get', (monthKey) => service.getCategoryBudgets(monthKey));
  handleIpc('budgets:set', (data) => service.setCategoryBudget(data));
  handleIpc('budgets:delete', (id) => service.deleteCategoryBudget(id));

  // Smart Notifications
  handleIpc('notifications:get', () => service.getNotifications());
  handleIpc('notifications:markRead', (id) => service.markNotificationRead(id));
  handleIpc('notifications:markAllRead', () => service.markAllNotificationsRead());
  handleIpc('notifications:delete', (id) => service.deleteNotification(id));

  // Banking OFX & CSV Import & Vault
  handleIpc('banking:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Extrato Bancário (OFX ou CSV)',
      filters: [
        { name: 'Extratos Bancários (*.ofx, *.qfx, *.csv)', extensions: ['ofx', 'qfx', 'csv'] },
        { name: 'Arquivos OFX (*.ofx, *.qfx)', extensions: ['ofx', 'qfx'] },
        { name: 'Planilhas CSV (*.csv)', extensions: ['csv'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const isOfx = fileName.toLowerCase().endsWith('.ofx') || fileName.toLowerCase().endsWith('.qfx');
    const fileType = isOfx ? 'ofx' : 'csv';

    // Automatically store a permanent copy of the bank statement into the app's secure vault folder
    let savedStatement = null;
    try {
      savedStatement = service.saveImportedStatement({
        originalName: fileName,
        fileType,
        content,
      });
    } catch (err) {
      logError(err, 'banking:saveImportedStatement');
    }

    return { 
      canceled: false, 
      filePath, 
      fileName, 
      fileType, 
      content, 
      savedStatementId: savedStatement ? savedStatement.id : null,
      savedPath: savedStatement ? savedStatement.savedPath : null,
    };
  });
  handleIpc('banking:parseOFX', (content) => service.parseOFX(content));
  handleIpc('banking:parseCSV', (content, customMapping) => service.parseCSV(content, customMapping));
  handleIpc('banking:reconcile', (data) => service.reconcileImport(data));
  handleIpc('banking:batchImport', (data) => service.batchImportTransactions(data));
  handleIpc('banking:getSavedStatements', () => service.getImportedStatements());
  handleIpc('banking:updateStatementStats', (id, data) => service.updateImportedStatementStats(id, data));
  handleIpc('banking:openStatementsFolder', async () => {
    const folderPath = service.getStatementsFolderPath();
    await shell.openPath(folderPath);
    return folderPath;
  });

  // Learned Auto-Categorization Import Rules
  handleIpc('importRules:get', () => service.getImportRules());
  handleIpc('importRules:save', (data) => service.saveImportRule(data));
  handleIpc('importRules:delete', (id) => service.deleteImportRule(id));
  handleIpc('importRules:toggle', (id) => service.toggleImportRule(id));

  // Financial Calendar & Projections
  handleIpc('calendar:get', (year, month) => service.getCalendarData(year, month));

  // Goals
  handleIpc('goals:get', () => service.getGoals());
  handleIpc('goals:create', (data) => service.createGoal(data));
  handleIpc('goals:update', (id, data) => service.updateGoal(id, data));
  handleIpc('goals:delete', (id) => service.deleteGoal(id));
  handleIpc('goals:addFunds', (id, amount, accountId) => service.addFundsToGoal(id, amount, accountId));

  // Dashboard & Reports
  handleIpc('dashboard:get', () => service.getDashboardData());
  handleIpc('reports:get', (filters) => service.getReports(filters));

  // Backup & Restore Dialogs
  handleIpc('backup:export', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Backup Completo - Meu Financeiro',
      defaultPath: `meu_financeiro_backup_${today}.json`,
      filters: [{ name: 'Arquivo de Backup JSON (*.json)', extensions: ['json'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const backupJson = service.exportBackup();
    fs.writeFileSync(filePath, backupJson, 'utf8');
    return { success: true, filePath };
  });

  handleIpc('backup:restore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurar Backup - Meu Financeiro',
      filters: [{ name: 'Arquivo de Backup JSON (*.json)', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) return { success: false, canceled: true };

    const content = fs.readFileSync(filePaths[0], 'utf8');
    service.restoreBackup(content);
    return { success: true };
  });

  handleIpc('csv:export', async (filters) => {
    const today = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Lançamentos para CSV - Meu Financeiro',
      defaultPath: `meu_financeiro_lancamentos_${today}.csv`,
      filters: [{ name: 'Planilha CSV (*.csv)', extensions: ['csv'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const csvContent = service.exportTransactionsCSV(filters);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    return { success: true, filePath };
  });

  // Demo Data
  handleIpc('demo:seed', () => service.seedDemoData());
  handleIpc('demo:clear', () => service.clearDemoData());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
