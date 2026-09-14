const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function initDatabase(customPath = null) {
  let dbPath;

  if (customPath) {
    dbPath = customPath;
  } else {
    // In Electron runtime
    let userDataPath = process.cwd();
    try {
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        userDataPath = app.getPath('userData');
      }
    } catch (e) {
      // Fallback to process.cwd() or local data
    }
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    dbPath = path.join(userDataPath, 'meu_financeiro.sqlite');
  }

  const db = new Database(dbPath);

  // High performance & safety PRAGMAs
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'app_config',
      user_name TEXT DEFAULT 'Usuário',
      currency TEXT DEFAULT 'BRL',
      pin_enabled INTEGER DEFAULT 0,
      pin_hash TEXT,
      pin_salt TEXT,
      theme TEXT DEFAULT 'dark',
      onboarding_completed INTEGER DEFAULT 0,
      first_day_of_week INTEGER DEFAULT 0,
      date_format TEXT DEFAULT 'DD/MM/YYYY',
      auto_backup_enabled INTEGER DEFAULT 0,
      auto_backup_dir TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- checking, savings, cash, wallet, investment, other
      initial_balance INTEGER NOT NULL DEFAULT 0, -- in cents
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'Landmark',
      active INTEGER DEFAULT 1,
      is_demo INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- income, expense
      color TEXT DEFAULT '#10b981',
      icon TEXT DEFAULT 'Tag',
      active INTEGER DEFAULT 1,
      is_system INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS credit_cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credit_limit INTEGER NOT NULL, -- in cents
      closing_day INTEGER NOT NULL, -- 1-31
      due_day INTEGER NOT NULL, -- 1-31
      color TEXT DEFAULT '#8b5cf6',
      active INTEGER DEFAULT 1,
      is_demo INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      destination_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- income, expense, transfer, card_payment
      description TEXT NOT NULL,
      amount INTEGER NOT NULL, -- in cents (positive value)
      transaction_date TEXT NOT NULL, -- YYYY-MM-DD
      invoice_month TEXT, -- YYYY-MM (for credit card transactions)
      status TEXT NOT NULL DEFAULT 'completed', -- pending, completed, cancelled
      notes TEXT,
      recurring_id TEXT,
      installment_id TEXT,
      installment_number INTEGER,
      total_installments INTEGER,
      is_demo INTEGER DEFAULT 0,
      tags TEXT,
      fit_id TEXT,
      origin TEXT,
      statement_id TEXT REFERENCES imported_statements(id) ON DELETE SET NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id TEXT PRIMARY KEY,
      account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- income, expense
      description TEXT NOT NULL,
      amount INTEGER NOT NULL, -- in cents
      frequency TEXT NOT NULL, -- monthly, weekly, yearly, custom
      billing_day INTEGER, -- e.g. 5, 10, 25
      start_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      auto_generate INTEGER DEFAULT 1,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
      amount_limit INTEGER NOT NULL, -- in cents
      alert_percentage INTEGER DEFAULT 80, -- e.g. 80%
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- bill_due, invoice_due, budget_warning, recurring_generated
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_id TEXT,
      read INTEGER DEFAULT 0,
      action_data TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount INTEGER NOT NULL, -- in cents
      current_amount INTEGER NOT NULL DEFAULT 0, -- in cents
      target_date TEXT,
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT 'Target',
      notes TEXT,
      is_demo INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL UNIQUE, -- e.g. "IFOOD", "UBER", "CARREFOUR"
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      active INTEGER DEFAULT 1,
      match_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS imported_statements (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL, -- ofx, csv
      file_size INTEGER NOT NULL DEFAULT 0,
      saved_path TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      account_id TEXT,
      card_id TEXT,
      items_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      table_name TEXT PRIMARY KEY,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cloud_session (
      id TEXT PRIMARY KEY DEFAULT 'current_session',
      user_id TEXT,
      email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      supabase_url TEXT,
      supabase_anon_key TEXT,
      last_sync_at TEXT,
      sync_enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 1. Migrations for existing DB instances (run BEFORE indexes that depend on them)
  const migrations = [
    `ALTER TABLE transactions ADD COLUMN tags TEXT`,
    `ALTER TABLE transactions ADD COLUMN fit_id TEXT`,
    `ALTER TABLE transactions ADD COLUMN origin TEXT`,
    `ALTER TABLE recurring_rules ADD COLUMN billing_day INTEGER`,
    `ALTER TABLE recurring_rules ADD COLUMN auto_generate INTEGER DEFAULT 1`,
    `ALTER TABLE recurring_rules ADD COLUMN notes TEXT`,
    `ALTER TABLE transactions ADD COLUMN statement_id TEXT`,

    // Offline-First / Cloud Sync Columns
    `ALTER TABLE accounts ADD COLUMN user_id TEXT`,
    `ALTER TABLE accounts ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE accounts ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE categories ADD COLUMN user_id TEXT`,
    `ALTER TABLE categories ADD COLUMN updated_at TEXT`,
    `ALTER TABLE categories ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE categories ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE credit_cards ADD COLUMN user_id TEXT`,
    `ALTER TABLE credit_cards ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE credit_cards ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE transactions ADD COLUMN user_id TEXT`,
    `ALTER TABLE transactions ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE transactions ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE recurring_rules ADD COLUMN user_id TEXT`,
    `ALTER TABLE recurring_rules ADD COLUMN updated_at TEXT`,
    `ALTER TABLE recurring_rules ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE recurring_rules ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE goals ADD COLUMN user_id TEXT`,
    `ALTER TABLE goals ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE goals ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE category_budgets ADD COLUMN user_id TEXT`,
    `ALTER TABLE category_budgets ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE category_budgets ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE import_rules ADD COLUMN user_id TEXT`,
    `ALTER TABLE import_rules ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE import_rules ADD COLUMN sync_status TEXT DEFAULT 'pending'`,

    `ALTER TABLE imported_statements ADD COLUMN created_at TEXT`,
    `ALTER TABLE imported_statements ADD COLUMN user_id TEXT`,
    `ALTER TABLE imported_statements ADD COLUMN updated_at TEXT`,
    `ALTER TABLE imported_statements ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE imported_statements ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
  ];
  for (const m of migrations) {
    try { db.exec(m); } catch (e) {}
  }

  // 2. Performance Indexes (safely created after columns exist)
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(transaction_date)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_acc ON transactions(account_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_dest_acc ON transactions(destination_account_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_card_inv ON transactions(credit_card_id, invoice_month)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_cat ON transactions(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_type ON transactions(type)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_status ON transactions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_installment ON transactions(installment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_fit_id ON transactions(fit_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_statement ON transactions(statement_id)`,
    `CREATE INDEX IF NOT EXISTS idx_budgets_cat ON category_budgets(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read)`,
    `CREATE INDEX IF NOT EXISTS idx_rules_pattern ON import_rules(pattern)`,
    `CREATE INDEX IF NOT EXISTS idx_imported_statements_date ON imported_statements(imported_at DESC)`,
  ];
  for (const idx of indexes) {
    try { db.exec(idx); } catch (e) {}
  }

  // Seed default settings if not existing
  const config = db.prepare(`SELECT id FROM settings WHERE id = 'app_config'`).get();
  if (!config) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO settings (id, user_name, currency, pin_enabled, theme, onboarding_completed, created_at, updated_at)
      VALUES ('app_config', 'Usuário', 'BRL', 0, 'dark', 0, ?, ?)
    `).run(now, now);
  }

  // Seed default categories if empty
  const categoryCount = db.prepare(`SELECT count(*) as count FROM categories`).get().count;
  if (categoryCount === 0) {
    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, type, color, icon, active, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `);

    const now = new Date().toISOString();
    const defaultCategories = [
      // Receitas
      { id: 'cat_salario', name: 'Salário', type: 'income', color: '#10b981', icon: 'Briefcase' },
      { id: 'cat_freelance', name: 'Freelance', type: 'income', color: '#06b6d4', icon: 'Laptop' },
      { id: 'cat_investimentos', name: 'Investimentos', type: 'income', color: '#8b5cf6', icon: 'TrendingUp' },
      { id: 'cat_outras_receitas', name: 'Outros', type: 'income', color: '#64748b', icon: 'PlusCircle' },
      // Despesas
      { id: 'cat_alimentacao', name: 'Alimentação', type: 'expense', color: '#f59e0b', icon: 'Utensils' },
      { id: 'cat_moradia', name: 'Moradia', type: 'expense', color: '#ef4444', icon: 'Home' },
      { id: 'cat_transporte', name: 'Transporte', type: 'expense', color: '#3b82f6', icon: 'Car' },
      { id: 'cat_saude', name: 'Saúde', type: 'expense', color: '#ec4899', icon: 'HeartPulse' },
      { id: 'cat_educacao', name: 'Educação', type: 'expense', color: '#6366f1', icon: 'GraduationCap' },
      { id: 'cat_lazer', name: 'Lazer', type: 'expense', color: '#14b8a6', icon: 'PartyPopper' },
      { id: 'cat_compras', name: 'Compras', type: 'expense', color: '#f97316', icon: 'ShoppingBag' },
      { id: 'cat_assinaturas', name: 'Assinaturas', type: 'expense', color: '#a855f7', icon: 'Tv' },
      { id: 'cat_contas', name: 'Contas', type: 'expense', color: '#eab308', icon: 'Receipt' },
      { id: 'cat_outras_despesas', name: 'Outros', type: 'expense', color: '#94a3b8', icon: 'HelpCircle' },
    ];

    const insertMany = db.transaction((categories) => {
      for (const cat of categories) {
        insertCat.run(cat.id, cat.name, cat.type, cat.color, cat.icon, now);
      }
    });
    insertMany(defaultCategories);
  }

  // Seed default import rules if empty
  const rulesCount = db.prepare(`SELECT count(*) as count FROM import_rules`).get().count;
  if (rulesCount === 0) {
    const insertRule = db.prepare(`
      INSERT INTO import_rules (id, pattern, category_id, active, match_count, created_at, updated_at)
      VALUES (?, ?, ?, 1, 0, ?, ?)
    `);

    const crypto = require('crypto');
    const now = new Date().toISOString();
    const defaultRules = [
      { pattern: 'IFOOD', categoryId: 'cat_alimentacao' },
      { pattern: 'UBER', categoryId: 'cat_transporte' },
      { pattern: '99APP', categoryId: 'cat_transporte' },
      { pattern: 'CARREFOUR', categoryId: 'cat_alimentacao' },
      { pattern: 'PAO DE ACUCAR', categoryId: 'cat_alimentacao' },
      { pattern: 'NETFLIX', categoryId: 'cat_assinaturas' },
      { pattern: 'SPOTIFY', categoryId: 'cat_assinaturas' },
      { pattern: 'AMAZON PRIME', categoryId: 'cat_assinaturas' },
      { pattern: 'DROGASIL', categoryId: 'cat_saude' },
      { pattern: 'RAIA', categoryId: 'cat_saude' },
      { pattern: 'POSTO', categoryId: 'cat_transporte' },
      { pattern: 'SHELL', categoryId: 'cat_transporte' },
      { pattern: 'IPIRANGA', categoryId: 'cat_transporte' },
      { pattern: 'ENEL', categoryId: 'cat_contas' },
      { pattern: 'SABESP', categoryId: 'cat_contas' },
      { pattern: 'SALARIO', categoryId: 'cat_salario' },
    ];

    const insertManyRules = db.transaction((rules) => {
      for (const r of rules) {
        insertRule.run(crypto.randomUUID(), r.pattern, r.categoryId, now, now);
      }
    });
    insertManyRules(defaultRules);
  }

  dbInstance = db;
  return db;
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {}
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
};
