const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./database.cjs');
const { hashPin, verifyPin, generateSalt } = require('./crypto.cjs');

// Helper to format ISO date to YYYY-MM
function getMonthKey(dateStr) {
  return dateStr.slice(0, 7);
}

// Add months to a date string YYYY-MM-DD
function addMonths(dateStr, monthsToAdd) {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-indexed
  let day = parseInt(dayStr, 10);

  month += monthsToAdd;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;

  // Handle month length overflow (e.g. Feb 30 -> Feb 28)
  const maxDays = new Date(year, month + 1, 0).getDate();
  const validDay = Math.min(day, maxDays);

  const formattedMonth = String(month + 1).padStart(2, '0');
  const formattedDay = String(validDay).padStart(2, '0');
  return `${year}-${formattedMonth}-${formattedDay}`;
}

// Calculate which invoice a credit card purchase belongs to
function calculateInvoiceMonth(transactionDate, closingDay) {
  const [yearStr, monthStr, dayStr] = transactionDate.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // If transaction day is strictly greater than closingDay, it moves to the next month's invoice
  if (day > closingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

class FinancialService {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  // --- SETTINGS ---
  getSettings() {
    const row = this.db.prepare(`SELECT * FROM settings WHERE id = 'app_config'`).get();
    if (!row) return null;
    return {
      userName: row.user_name,
      currency: row.currency,
      pinEnabled: Boolean(row.pin_enabled),
      theme: row.theme,
      onboardingCompleted: Boolean(row.onboarding_completed),
      firstDayOfWeek: row.first_day_of_week,
      dateFormat: row.date_format,
      autoBackupEnabled: Boolean(row.auto_backup_enabled),
      autoBackupDir: row.auto_backup_dir,
    };
  }

  updateSettings(data) {
    const fields = [];
    const values = [];

    if (data.userName !== undefined) { fields.push('user_name = ?'); values.push(data.userName); }
    if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
    if (data.theme !== undefined) { fields.push('theme = ?'); values.push(data.theme); }
    if (data.onboardingCompleted !== undefined) { fields.push('onboarding_completed = ?'); values.push(data.onboardingCompleted ? 1 : 0); }
    if (data.firstDayOfWeek !== undefined) { fields.push('first_day_of_week = ?'); values.push(data.firstDayOfWeek); }
    if (data.dateFormat !== undefined) { fields.push('date_format = ?'); values.push(data.dateFormat); }
    if (data.autoBackupEnabled !== undefined) { fields.push('auto_backup_enabled = ?'); values.push(data.autoBackupEnabled ? 1 : 0); }
    if (data.autoBackupDir !== undefined) { fields.push('auto_backup_dir = ?'); values.push(data.autoBackupDir); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      this.db.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE id = 'app_config'`).run(...values);
    }
    return this.getSettings();
  }

  // --- PIN SECURITY ---
  setPin(pin) {
    if (!pin || pin.length < 4) {
      throw new Error('O PIN deve ter pelo menos 4 dígitos.');
    }
    const salt = generateSalt();
    const hash = hashPin(pin, salt);
    this.db.prepare(`
      UPDATE settings
      SET pin_enabled = 1, pin_hash = ?, pin_salt = ?, updated_at = ?
      WHERE id = 'app_config'
    `).run(hash, salt, new Date().toISOString());
    return true;
  }

  disablePin(currentPin) {
    const row = this.db.prepare(`SELECT pin_hash, pin_salt FROM settings WHERE id = 'app_config'`).get();
    if (row && row.pin_hash) {
      const valid = verifyPin(currentPin, row.pin_hash, row.pin_salt);
      if (!valid) {
        throw new Error('PIN atual incorreto.');
      }
    }
    this.db.prepare(`
      UPDATE settings
      SET pin_enabled = 0, pin_hash = NULL, pin_salt = NULL, updated_at = ?
      WHERE id = 'app_config'
    `).run(new Date().toISOString());
    return true;
  }

  verifyAppPin(pin) {
    const row = this.db.prepare(`SELECT pin_enabled, pin_hash, pin_salt FROM settings WHERE id = 'app_config'`).get();
    if (!row || !row.pin_enabled) return true;
    return verifyPin(pin, row.pin_hash, row.pin_salt);
  }

  isPinConfigured() {
    const row = this.db.prepare(`SELECT pin_enabled FROM settings WHERE id = 'app_config'`).get();
    return Boolean(row && row.pin_enabled);
  }

  // --- ACCOUNTS ---
  getAccounts(includeArchived = false) {
    const query = `
      SELECT 
        a.*,
        (
          a.initial_balance
          + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income' AND status = 'completed'), 0)
          - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense' AND credit_card_id IS NULL AND status = 'completed'), 0)
          + COALESCE((SELECT SUM(amount) FROM transactions WHERE destination_account_id = a.id AND type = 'transfer' AND status = 'completed'), 0)
          - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer' AND status = 'completed'), 0)
          - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'card_payment' AND status = 'completed'), 0)
        ) AS current_balance,
        (SELECT COUNT(*) FROM transactions WHERE account_id = a.id OR destination_account_id = a.id) as transaction_count
      FROM accounts a
      ${includeArchived ? '' : 'WHERE a.active = 1'}
      ORDER BY a.name ASC
    `;
    const rows = this.db.prepare(query).all();
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      initialBalance: r.initial_balance,
      currentBalance: r.current_balance,
      color: r.color,
      icon: r.icon,
      active: Boolean(r.active),
      isDemo: Boolean(r.is_demo),
      transactionCount: r.transaction_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  createAccount(data) {
    if (!data.name || !data.name.trim()) throw new Error('Nome da conta é obrigatório.');
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const initialBalance = parseInt(data.initialBalance || 0, 10);

    this.db.prepare(`
      INSERT INTO accounts (id, name, type, initial_balance, color, icon, active, is_demo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.type || 'checking',
      initialBalance,
      data.color || '#3b82f6',
      data.icon || 'Landmark',
      data.isDemo ? 1 : 0,
      now,
      now
    );

    return this.getAccountById(id);
  }

  getAccountById(id) {
    const accounts = this.getAccounts(true);
    return accounts.find(a => a.id === id) || null;
  }

  updateAccount(id, data) {
    const existing = this.getAccountById(id);
    if (!existing) throw new Error('Conta não encontrada.');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const type = data.type !== undefined ? data.type : existing.type;
    const initialBalance = data.initialBalance !== undefined ? parseInt(data.initialBalance, 10) : existing.initialBalance;
    const color = data.color !== undefined ? data.color : existing.color;
    const icon = data.icon !== undefined ? data.icon : existing.icon;
    const active = data.active !== undefined ? (data.active ? 1 : 0) : (existing.active ? 1 : 0);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE accounts
      SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(name, type, initialBalance, color, icon, active, now, id);

    return this.getAccountById(id);
  }

  deleteAccount(id) {
    const txCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR destination_account_id = ?
    `).get(id, id).count;

    if (txCount > 0) {
      throw new Error(`Esta conta possui ${txCount} lançamentos vinculados. Para manter o histórico correto, você pode arquivá-la.`);
    }

    this.db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id);
    return true;
  }

  adjustAccountBalance({ accountId, targetBalance, adjustmentDate, mode = 'transaction', notes }) {
    const account = this.getAccountById(accountId);
    if (!account) throw new Error('Conta não encontrada.');

    const target = parseInt(targetBalance, 10);
    if (isNaN(target)) throw new Error('Saldo alvo inválido.');

    const current = account.currentBalance;
    const diff = target - current;

    if (diff === 0) {
      return { success: true, diff: 0, message: 'O saldo já está correto.', account: this.getAccountById(accountId) };
    }

    if (mode === 'initial_balance') {
      const newInitial = account.initialBalance + diff;
      this.updateAccount(accountId, { initialBalance: newInitial });
      return {
        success: true,
        diff,
        mode: 'initial_balance',
        account: this.getAccountById(accountId),
      };
    }

    // mode === 'transaction'
    const now = new Date().toISOString();
    const date = adjustmentDate || now.slice(0, 10);
    const type = diff > 0 ? 'income' : 'expense';
    const amount = Math.abs(diff);
    const desc = diff > 0 ? 'Ajuste de Saldo (+)' : 'Ajuste de Saldo (-)';

    // Find or create category "Ajuste de Saldo"
    let category = this.db.prepare(`SELECT id FROM categories WHERE name = 'Ajuste de Saldo' AND type = ?`).get(type);
    if (!category) {
      const existingOutros = this.db.prepare(`SELECT id FROM categories WHERE name LIKE '%Outr%' AND type = ?`).get(type);
      if (existingOutros) {
        category = existingOutros;
      } else {
        const newCatId = crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO categories (id, name, type, color, icon, active, is_system, created_at)
          VALUES (?, 'Ajuste de Saldo', ?, '#64748b', 'Scale', 1, 1, ?)
        `).run(newCatId, type, now);
        category = { id: newCatId };
      }
    }

    const tx = this.createTransaction({
      accountId,
      categoryId: category ? category.id : null,
      type,
      description: desc,
      amount,
      transactionDate: date,
      status: 'completed',
      notes: notes || 'Ajuste de reconciliação de saldo',
      tags: 'ajuste_saldo',
    });

    return {
      success: true,
      diff,
      mode: 'transaction',
      transaction: tx,
      account: this.getAccountById(accountId),
    };
  }

  // --- CATEGORIES ---
  getCategories() {
    const rows = this.db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM transactions WHERE category_id = c.id) as transaction_count
      FROM categories c
      WHERE c.active = 1
      ORDER BY c.type DESC, c.name ASC
    `).all();

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      color: r.color,
      icon: r.icon,
      active: Boolean(r.active),
      isSystem: Boolean(r.is_system),
      transactionCount: r.transaction_count,
      createdAt: r.created_at,
    }));
  }

  createCategory(data) {
    if (!data.name || !data.name.trim()) throw new Error('Nome da categoria é obrigatório.');
    if (!['income', 'expense'].includes(data.type)) throw new Error('Tipo de categoria inválido.');

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO categories (id, name, type, color, icon, active, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 0, ?)
    `).run(id, data.name.trim(), data.type, data.color || '#10b981', data.icon || 'Tag', now);

    return this.getCategories().find(c => c.id === id);
  }

  updateCategory(id, data) {
    const existing = this.getCategories().find(c => c.id === id);
    if (!existing) throw new Error('Categoria não encontrada.');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const color = data.color !== undefined ? data.color : existing.color;
    const icon = data.icon !== undefined ? data.icon : existing.icon;

    this.db.prepare(`
      UPDATE categories
      SET name = ?, color = ?, icon = ?
      WHERE id = ?
    `).run(name, color, icon, id);

    return this.getCategories().find(c => c.id === id);
  }

  deleteCategory(id) {
    const txCount = this.db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE category_id = ?`).get(id).count;
    if (txCount > 0) {
      throw new Error(`Esta categoria possui ${txCount} lançamentos vinculados e não pode ser excluída.`);
    }
    this.db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
    return true;
  }

  // --- CREDIT CARDS ---
  getCreditCards(includeArchived = false) {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const rows = this.db.prepare(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE credit_card_id = c.id 
            AND type = 'expense' 
            AND status != 'cancelled'
            AND status != 'paid'
        ), 0) as used_limit,
        COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE credit_card_id = c.id 
            AND type = 'expense' 
            AND invoice_month = '${currentMonthKey}'
            AND status != 'cancelled'
            AND status != 'paid'
        ), 0) as current_invoice_amount,
        COALESCE((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE credit_card_id = c.id 
            AND type = 'expense' 
            AND invoice_month = '${nextMonthKey}'
            AND status != 'cancelled'
            AND status != 'paid'
        ), 0) as next_invoice_amount
      FROM credit_cards c
      ${includeArchived ? '' : 'WHERE c.active = 1'}
      ORDER BY c.name ASC
    `).all();

    return rows.map(r => {
      const creditLimit = r.credit_limit;
      const usedLimit = r.used_limit;
      const availableLimit = Math.max(0, creditLimit - usedLimit);

      return {
        id: r.id,
        name: r.name,
        creditLimit,
        usedLimit,
        availableLimit,
        currentInvoiceAmount: r.current_invoice_amount,
        nextInvoiceAmount: r.next_invoice_amount,
        closingDay: r.closing_day,
        dueDay: r.due_day,
        color: r.color,
        active: Boolean(r.active),
        isDemo: Boolean(r.is_demo),
        currentMonthKey,
        nextMonthKey,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  getCreditCardById(id) {
    const cards = this.getCreditCards(true);
    return cards.find(c => c.id === id) || null;
  }

  createCreditCard(data) {
    if (!data.name || !data.name.trim()) throw new Error('Nome do cartão é obrigatório.');
    const creditLimit = parseInt(data.creditLimit, 10);
    if (isNaN(creditLimit) || creditLimit <= 0) throw new Error('Limite do cartão deve ser maior que zero.');

    const closingDay = parseInt(data.closingDay, 10);
    const dueDay = parseInt(data.dueDay, 10);
    if (isNaN(closingDay) || closingDay < 1 || closingDay > 31) throw new Error('Dia de fechamento inválido.');
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) throw new Error('Dia de vencimento inválido.');

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO credit_cards (id, name, credit_limit, closing_day, due_day, color, active, is_demo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      creditLimit,
      closingDay,
      dueDay,
      data.color || '#8b5cf6',
      data.isDemo ? 1 : 0,
      now,
      now
    );

    return this.getCreditCardById(id);
  }

  updateCreditCard(id, data) {
    const existing = this.getCreditCardById(id);
    if (!existing) throw new Error('Cartão de crédito não encontrado.');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const creditLimit = data.creditLimit !== undefined ? parseInt(data.creditLimit, 10) : existing.creditLimit;
    const closingDay = data.closingDay !== undefined ? parseInt(data.closingDay, 10) : existing.closingDay;
    const dueDay = data.dueDay !== undefined ? parseInt(data.dueDay, 10) : existing.dueDay;
    const color = data.color !== undefined ? data.color : existing.color;
    const active = data.active !== undefined ? (data.active ? 1 : 0) : (existing.active ? 1 : 0);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE credit_cards
      SET name = ?, credit_limit = ?, closing_day = ?, due_day = ?, color = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(name, creditLimit, closingDay, dueDay, color, active, now, id);

    return this.getCreditCardById(id);
  }

  deleteCreditCard(id) {
    const txCount = this.db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE credit_card_id = ?`).get(id).count;
    if (txCount > 0) {
      throw new Error(`Este cartão possui ${txCount} compras vinculadas. Desative o cartão para manter os registros.`);
    }
    this.db.prepare(`DELETE FROM credit_cards WHERE id = ?`).run(id);
    return true;
  }

  // Get Invoices for a credit card
  getCardInvoices(cardId) {
    const card = this.getCreditCardById(cardId);
    if (!card) throw new Error('Cartão não encontrado.');

    // Fetch distinct invoice months from transactions
    const invoiceMonths = this.db.prepare(`
      SELECT DISTINCT invoice_month 
      FROM transactions 
      WHERE credit_card_id = ? AND invoice_month IS NOT NULL
      ORDER BY invoice_month DESC
    `).all(cardId).map(r => r.invoice_month);

    // Make sure current month is in the list
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!invoiceMonths.includes(currentMonthKey)) {
      invoiceMonths.unshift(currentMonthKey);
    }
    invoiceMonths.sort((a, b) => b.localeCompare(a));

    return invoiceMonths.map(monthKey => {
      const items = this.db.prepare(`
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.credit_card_id = ? AND t.invoice_month = ? AND t.type = 'expense'
        ORDER BY t.transaction_date DESC
      `).all(cardId, monthKey);

      const totalAmount = items.reduce((sum, item) => sum + (item.status !== 'cancelled' ? item.amount : 0), 0);
      const isPaid = items.length > 0 && items.every(i => i.status === 'paid');
      const isCurrent = monthKey === currentMonthKey;
      const isFuture = monthKey > currentMonthKey;

      let status = 'open';
      if (isPaid) {
        status = 'paid';
      } else if (isFuture) {
        status = 'future';
      } else if (isCurrent) {
        status = 'open';
      } else {
        status = 'closed';
      }

      // Closing and due dates for this invoice
      const [yStr, mStr] = monthKey.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const closingDate = `${y}-${String(m).padStart(2, '0')}-${String(card.closingDay).padStart(2, '0')}`;
      const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(card.dueDay).padStart(2, '0')}`;

      return {
        monthKey,
        cardId,
        cardName: card.name,
        totalAmount,
        itemCount: items.length,
        status, // 'paid', 'open', 'closed', 'future'
        closingDate,
        dueDate,
        items: items.map(i => ({
          id: i.id,
          description: i.description,
          amount: i.amount,
          transactionDate: i.transaction_date,
          status: i.status,
          categoryName: i.category_name,
          categoryColor: i.category_color,
          categoryIcon: i.category_icon,
          installmentNumber: i.installment_number,
          totalInstallments: i.total_installments,
        })),
      };
    });
  }

  // Pay credit card invoice
  payCardInvoice({ creditCardId, invoiceMonth, accountId, paymentDate, amount }) {
    const card = this.getCreditCardById(creditCardId);
    if (!card) throw new Error('Cartão não encontrado.');
    const account = this.getAccountById(accountId);
    if (!account) throw new Error('Conta para débito não encontrada.');

    const paymentAmount = parseInt(amount, 10);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Valor do pagamento deve ser maior que zero.');
    }

    const txDate = paymentDate || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const runInTransaction = this.db.transaction(() => {
      // 1. Create payment transaction from bank account
      this.db.prepare(`
        INSERT INTO transactions (
          id, account_id, credit_card_id, type, description, amount, 
          transaction_date, invoice_month, status, created_at, updated_at
        )
        VALUES (?, ?, ?, 'card_payment', ?, ?, ?, ?, 'completed', ?, ?)
      `).run(
        id,
        accountId,
        creditCardId,
        `Pagamento Fatura ${card.name} (${invoiceMonth})`,
        paymentAmount,
        txDate,
        invoiceMonth,
        now,
        now
      );

      // 2. Mark credit card expense items of this invoice month as 'paid'
      this.db.prepare(`
        UPDATE transactions
        SET status = 'paid', updated_at = ?
        WHERE credit_card_id = ? AND invoice_month = ? AND type = 'expense' AND status != 'cancelled'
      `).run(now, creditCardId, invoiceMonth);
    });

    runInTransaction();
    return { success: true, transactionId: id };
  }

  // --- TRANSACTIONS ---
  getTransactions(filters = {}) {
    let whereClauses = [];
    let params = [];

    if (filters.startDate) {
      whereClauses.push(`t.transaction_date >= ?`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push(`t.transaction_date <= ?`);
      params.push(filters.endDate);
    }
    if (filters.accountId) {
      whereClauses.push(`(t.account_id = ? OR t.destination_account_id = ?)`);
      params.push(filters.accountId, filters.accountId);
    }
    if (filters.creditCardId) {
      whereClauses.push(`t.credit_card_id = ?`);
      params.push(filters.creditCardId);
    }
    if (filters.categoryId) {
      whereClauses.push(`t.category_id = ?`);
      params.push(filters.categoryId);
    }
    if (filters.type) {
      whereClauses.push(`t.type = ?`);
      params.push(filters.type);
    }
    if (filters.status) {
      whereClauses.push(`t.status = ?`);
      params.push(filters.status);
    }
    if (filters.search && filters.search.trim()) {
      whereClauses.push(`(t.description LIKE ? OR t.notes LIKE ? OR t.tags LIKE ?)`);
      const searchPattern = `%${filters.search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (filters.tag && filters.tag.trim()) {
      whereClauses.push(`t.tags LIKE ?`);
      params.push(`%${filters.tag.trim()}%`);
    }

    if (filters.statementId) {
      whereClauses.push(`t.statement_id = ?`);
      params.push(filters.statementId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        t.*,
        a.name as account_name,
        a.color as account_color,
        da.name as destination_account_name,
        da.color as destination_account_color,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        cc.name as credit_card_name,
        cc.color as credit_card_color,
        s.original_name as statement_original_name,
        s.file_name as statement_file_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN accounts da ON t.destination_account_id = da.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN credit_cards cc ON t.credit_card_id = cc.id
      LEFT JOIN imported_statements s ON t.statement_id = s.id
      ${where}
      ORDER BY t.transaction_date DESC, t.created_at DESC
      ${filters.limit ? `LIMIT ${parseInt(filters.limit, 10)}` : ''}
    `;

    const rows = this.db.prepare(query).all(...params);
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountName: r.account_name,
      accountColor: r.account_color,
      destinationAccountId: r.destination_account_id,
      destinationAccountName: r.destination_account_name,
      destinationAccountColor: r.destination_account_color,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      categoryIcon: r.category_icon,
      creditCardId: r.credit_card_id,
      creditCardName: r.credit_card_name,
      creditCardColor: r.credit_card_color,
      statementId: r.statement_id,
      statementOriginalName: r.statement_original_name,
      statementFileName: r.statement_file_name,
      type: r.type,
      description: r.description,
      amount: r.amount,
      transactionDate: r.transaction_date,
      invoiceMonth: r.invoice_month,
      status: r.status,
      notes: r.notes,
      tags: r.tags,
      recurringId: r.recurring_id,
      installmentId: r.installment_id,
      installmentNumber: r.installment_number,
      totalInstallments: r.total_installments,
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getTransactionById(id) {
    const list = this.getTransactions({ limit: 1 });
    const row = this.db.prepare(`SELECT id FROM transactions WHERE id = ?`).get(id);
    if (!row) return null;
    const singleList = this.getTransactions({ search: '' });
    return singleList.find(t => t.id === id) || null;
  }

  createTransaction(data) {
    const type = data.type;
    if (!['income', 'expense', 'transfer'].includes(type)) {
      throw new Error('Tipo de lançamento inválido.');
    }
    if (!data.description || !data.description.trim()) {
      throw new Error('Descrição é obrigatória.');
    }
    const totalAmount = parseInt(data.amount, 10);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      throw new Error('Valor deve ser maior que zero.');
    }
    if (!data.transactionDate) {
      throw new Error('Data é obrigatória.');
    }

    // Validation per type
    if (type === 'transfer') {
      if (!data.accountId || !data.destinationAccountId) {
        throw new Error('Conta de origem e conta de destino são obrigatórias na transferência.');
      }
      if (data.accountId === data.destinationAccountId) {
        throw new Error('A conta de origem e destino não podem ser iguais.');
      }
    } else {
      if (!data.creditCardId && !data.accountId) {
        throw new Error('Selecione uma conta ou cartão de crédito.');
      }
    }

    const totalInstallments = parseInt(data.totalInstallments || 1, 10);
    const now = new Date().toISOString();

    // Check if installment purchase
    if (totalInstallments > 1) {
      const installmentId = crypto.randomUUID();
      const baseAmount = Math.floor(totalAmount / totalInstallments);
      const remainder = totalAmount - (baseAmount * totalInstallments);
      const createdIds = [];

      let cardClosingDay = null;
      if (data.creditCardId) {
        const card = this.getCreditCardById(data.creditCardId);
        if (card) cardClosingDay = card.closingDay;
      }

      const insertStmt = this.db.prepare(`
        INSERT INTO transactions (
          id, account_id, destination_account_id, category_id, credit_card_id,
          type, description, amount, transaction_date, invoice_month,
          status, notes, tags, recurring_id, installment_id, installment_number, total_installments,
          is_demo, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const runBatch = this.db.transaction(() => {
        for (let i = 1; i <= totalInstallments; i++) {
          const installmentDate = addMonths(data.transactionDate, i - 1);
          const installmentAmount = (i === 1) ? baseAmount + remainder : baseAmount;
          const id = crypto.randomUUID();
          createdIds.push(id);

          let invoiceMonth = null;
          if (data.creditCardId && cardClosingDay) {
            invoiceMonth = calculateInvoiceMonth(installmentDate, cardClosingDay);
          }

          const desc = `${data.description.trim()} (${i}/${totalInstallments})`;

          insertStmt.run(
            id,
            data.accountId || null,
            null,
            data.categoryId || null,
            data.creditCardId || null,
            type,
            desc,
            installmentAmount,
            installmentDate,
            invoiceMonth,
            data.status || 'completed',
            data.notes || null,
            data.tags || null,
            null,
            installmentId,
            i,
            totalInstallments,
            data.isDemo ? 1 : 0,
            now,
            now
          );
        }
      });

      runBatch();
      return { success: true, count: totalInstallments, installmentId, firstId: createdIds[0] };
    }

    // Single transaction
    const id = data.id || crypto.randomUUID();
    let invoiceMonth = null;

    if (data.creditCardId) {
      const card = this.getCreditCardById(data.creditCardId);
      if (card) {
        invoiceMonth = calculateInvoiceMonth(data.transactionDate, card.closingDay);
      }
    }

    this.db.prepare(`
      INSERT INTO transactions (
        id, account_id, destination_account_id, category_id, credit_card_id,
        type, description, amount, transaction_date, invoice_month,
        status, notes, tags, recurring_id, installment_id, installment_number, total_installments,
        is_demo, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.accountId || null,
      data.destinationAccountId || null,
      data.categoryId || null,
      data.creditCardId || null,
      type,
      data.description.trim(),
      totalAmount,
      data.transactionDate,
      invoiceMonth,
      data.status || 'completed',
      data.notes || null,
      data.tags || null,
      data.recurringId || null,
      null,
      null,
      null,
      data.isDemo ? 1 : 0,
      now,
      now
    );

    return this.getTransactionById(id);
  }

  updateTransaction(id, data) {
    const existing = this.getTransactionById(id);
    if (!existing) throw new Error('Lançamento não encontrado.');

    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const amount = data.amount !== undefined ? parseInt(data.amount, 10) : existing.amount;
    const transactionDate = data.transactionDate !== undefined ? data.transactionDate : existing.transactionDate;
    const type = data.type !== undefined ? data.type : existing.type;
    const accountId = data.accountId !== undefined ? data.accountId : existing.accountId;
    const destinationAccountId = data.destinationAccountId !== undefined ? data.destinationAccountId : existing.destinationAccountId;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const creditCardId = data.creditCardId !== undefined ? data.creditCardId : existing.creditCardId;
    const status = data.status !== undefined ? data.status : existing.status;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const tags = data.tags !== undefined ? data.tags : existing.tags;
    const now = new Date().toISOString();

    let invoiceMonth = existing.invoiceMonth;
    if (creditCardId) {
      const card = this.getCreditCardById(creditCardId);
      if (card) {
        invoiceMonth = calculateInvoiceMonth(transactionDate, card.closingDay);
      }
    } else {
      invoiceMonth = null;
    }

    this.db.prepare(`
      UPDATE transactions
      SET description = ?, amount = ?, transaction_date = ?, type = ?,
          account_id = ?, destination_account_id = ?, category_id = ?,
          credit_card_id = ?, invoice_month = ?, status = ?, notes = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      description,
      amount,
      transactionDate,
      type,
      accountId || null,
      destinationAccountId || null,
      categoryId || null,
      creditCardId || null,
      invoiceMonth,
      status,
      notes || null,
      tags || null,
      now,
      id
    );

    return this.getTransactionById(id);
  }

  deleteTransaction(id, deleteInstallmentGroup = false) {
    const existing = this.getTransactionById(id);
    if (!existing) throw new Error('Lançamento não encontrado.');

    if (deleteInstallmentGroup && existing.installmentId) {
      this.db.prepare(`DELETE FROM transactions WHERE installment_id = ?`).run(existing.installmentId);
    } else {
      this.db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
    }
    return true;
  }

  duplicateTransaction(id) {
    const existing = this.getTransactionById(id);
    if (!existing) throw new Error('Lançamento não encontrado.');

    const newTx = {
      ...existing,
      id: crypto.randomUUID(),
      description: `${existing.description} (Cópia)`,
      transactionDate: new Date().toISOString().slice(0, 10),
      totalInstallments: 1,
      installmentId: null,
      installmentNumber: null,
    };

    return this.createTransaction(newTx);
  }

  batchMoveTransactions({ transactionIds, targetAccountId, targetType = 'account' }) {
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      throw new Error('Nenhum lançamento informado para mover.');
    }
    if (!targetAccountId) {
      throw new Error('Conta ou cartão de destino é obrigatório.');
    }

    let closingDay = null;
    if (targetType === 'card') {
      const card = this.getCreditCardById(targetAccountId);
      if (!card) throw new Error('Cartão de destino não encontrado.');
      closingDay = card.closingDay;
    } else {
      const acc = this.getAccountById(targetAccountId);
      if (!acc) throw new Error('Conta de destino não encontrada.');
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    const runBatch = this.db.transaction(() => {
      for (const id of transactionIds) {
        const tx = this.getTransactionById(id);
        if (!tx) continue;

        if (targetType === 'card') {
          const invoiceMonth = calculateInvoiceMonth(tx.transactionDate, closingDay);
          this.db.prepare(`
            UPDATE transactions
            SET credit_card_id = ?, account_id = NULL, destination_account_id = NULL, invoice_month = ?, updated_at = ?
            WHERE id = ?
          `).run(targetAccountId, invoiceMonth, now, id);
        } else {
          if (tx.type === 'transfer' && tx.destinationAccountId === targetAccountId) {
            continue;
          }
          this.db.prepare(`
            UPDATE transactions
            SET account_id = ?, credit_card_id = NULL, invoice_month = NULL, updated_at = ?
            WHERE id = ?
          `).run(targetAccountId, now, id);
        }
        updatedCount++;
      }
    });

    runBatch();
    return { success: true, updatedCount };
  }

  // --- RECURRING RULES ---
  getRecurringRules() {
    const rows = this.db.prepare(`
      SELECT 
        r.*, 
        a.name as account_name, 
        a.color as account_color,
        c.name as category_name,
        c.color as category_color,
        cc.name as credit_card_name,
        cc.color as credit_card_color
      FROM recurring_rules r
      LEFT JOIN accounts a ON r.account_id = a.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN credit_cards cc ON r.credit_card_id = cc.id
      ORDER BY r.active DESC, r.next_due_date ASC
    `).all();

    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountName: r.account_name,
      accountColor: r.account_color,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      creditCardId: r.credit_card_id,
      creditCardName: r.credit_card_name,
      creditCardColor: r.credit_card_color,
      type: r.type,
      description: r.description,
      amount: r.amount,
      frequency: r.frequency,
      billingDay: r.billing_day,
      startDate: r.start_date,
      nextDueDate: r.next_due_date,
      autoGenerate: Boolean(r.auto_generate),
      notes: r.notes,
      active: Boolean(r.active),
      createdAt: r.created_at,
    }));
  }

  createRecurringRule(data) {
    if (!data.description || !data.description.trim()) throw new Error('Descrição é obrigatória.');
    const amount = parseInt(data.amount, 10);
    if (isNaN(amount) || amount <= 0) throw new Error('Valor deve ser maior que zero.');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const billingDay = data.billingDay ? parseInt(data.billingDay, 10) : null;

    this.db.prepare(`
      INSERT INTO recurring_rules (
        id, account_id, category_id, credit_card_id, type, description, amount, 
        frequency, billing_day, start_date, next_due_date, auto_generate, notes, active, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      data.accountId || null,
      data.categoryId || null,
      data.creditCardId || null,
      data.type || 'expense',
      data.description.trim(),
      amount,
      data.frequency || 'monthly',
      billingDay,
      data.startDate || now.slice(0, 10),
      data.nextDueDate || data.startDate || now.slice(0, 10),
      data.autoGenerate !== undefined ? (data.autoGenerate ? 1 : 0) : 1,
      data.notes || null,
      now
    );

    return this.getRecurringRules().find(r => r.id === id);
  }

  updateRecurringRule(id, data) {
    const existing = this.getRecurringRules().find(r => r.id === id);
    if (!existing) throw new Error('Regra recorrente não encontrada.');

    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const amount = data.amount !== undefined ? parseInt(data.amount, 10) : existing.amount;
    const type = data.type !== undefined ? data.type : existing.type;
    const frequency = data.frequency !== undefined ? data.frequency : existing.frequency;
    const billingDay = data.billingDay !== undefined ? parseInt(data.billingDay, 10) : existing.billingDay;
    const nextDueDate = data.nextDueDate !== undefined ? data.nextDueDate : existing.nextDueDate;
    const accountId = data.accountId !== undefined ? data.accountId : existing.accountId;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const creditCardId = data.creditCardId !== undefined ? data.creditCardId : existing.creditCardId;
    const autoGenerate = data.autoGenerate !== undefined ? (data.autoGenerate ? 1 : 0) : (existing.autoGenerate ? 1 : 0);
    const active = data.active !== undefined ? (data.active ? 1 : 0) : (existing.active ? 1 : 0);
    const notes = data.notes !== undefined ? data.notes : existing.notes;

    this.db.prepare(`
      UPDATE recurring_rules
      SET description = ?, amount = ?, type = ?, frequency = ?, billing_day = ?,
          next_due_date = ?, account_id = ?, category_id = ?, credit_card_id = ?,
          auto_generate = ?, active = ?, notes = ?
      WHERE id = ?
    `).run(
      description,
      amount,
      type,
      frequency,
      billingDay || null,
      nextDueDate,
      accountId || null,
      categoryId || null,
      creditCardId || null,
      autoGenerate,
      active,
      notes || null,
      id
    );

    return this.getRecurringRules().find(r => r.id === id);
  }

  toggleRecurringRule(id) {
    const existing = this.getRecurringRules().find(r => r.id === id);
    if (!existing) throw new Error('Regra recorrente não encontrada.');
    const newActive = existing.active ? 0 : 1;
    this.db.prepare(`UPDATE recurring_rules SET active = ? WHERE id = ?`).run(newActive, id);
    return newActive === 1;
  }

  deleteRecurringRule(id) {
    this.db.prepare(`DELETE FROM recurring_rules WHERE id = ?`).run(id);
    return true;
  }

  // Execute recurring rule right now and advance next due date
  executeRecurringNow(id) {
    const rule = this.getRecurringRules().find(r => r.id === id);
    if (!rule) throw new Error('Regra recorrente não encontrada.');

    const tx = this.createTransaction({
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      creditCardId: rule.creditCardId,
      type: rule.type,
      description: rule.description,
      amount: rule.amount,
      transactionDate: rule.nextDueDate,
      status: 'completed',
      recurringId: rule.id,
    });

    let nextDate;
    if (rule.frequency === 'weekly') {
      const d = new Date(rule.nextDueDate);
      d.setDate(d.getDate() + 7);
      nextDate = d.toISOString().slice(0, 10);
    } else if (rule.frequency === 'yearly') {
      nextDate = addMonths(rule.nextDueDate, 12);
    } else {
      nextDate = addMonths(rule.nextDueDate, 1);
    }

    this.db.prepare(`UPDATE recurring_rules SET next_due_date = ? WHERE id = ?`).run(nextDate, rule.id);
    return tx;
  }

  // Process due recurring transactions
  processRecurringRules() {
    const today = new Date().toISOString().slice(0, 10);
    const dueRules = this.db.prepare(`
      SELECT * FROM recurring_rules WHERE active = 1 AND auto_generate = 1 AND next_due_date <= ?
    `).all(today);

    let generatedCount = 0;
    const runBatch = this.db.transaction(() => {
      for (const rule of dueRules) {
        this.createTransaction({
          accountId: rule.account_id,
          categoryId: rule.category_id,
          creditCardId: rule.credit_card_id,
          type: rule.type,
          description: rule.description,
          amount: rule.amount,
          transactionDate: rule.next_due_date,
          status: 'completed',
          recurringId: rule.id,
        });
        generatedCount++;

        let nextDate;
        if (rule.frequency === 'weekly') {
          const d = new Date(rule.next_due_date);
          d.setDate(d.getDate() + 7);
          nextDate = d.toISOString().slice(0, 10);
        } else if (rule.frequency === 'yearly') {
          nextDate = addMonths(rule.next_due_date, 12);
        } else {
          nextDate = addMonths(rule.next_due_date, 1);
        }

        this.db.prepare(`UPDATE recurring_rules SET next_due_date = ? WHERE id = ?`).run(nextDate, rule.id);
      }
    });

    if (dueRules.length > 0) {
      runBatch();
    }
    return generatedCount;
  }

  // --- GOALS ---
  getGoals() {
    const rows = this.db.prepare(`SELECT * FROM goals ORDER BY created_at DESC`).all();
    return rows.map(r => {
      const target = r.target_amount;
      const current = r.current_amount;
      const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      return {
        id: r.id,
        name: r.name,
        targetAmount: target,
        currentAmount: current,
        percentage,
        targetDate: r.target_date,
        color: r.color,
        icon: r.icon,
        notes: r.notes,
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  createGoal(data) {
    if (!data.name || !data.name.trim()) throw new Error('Nome da meta é obrigatório.');
    const targetAmount = parseInt(data.targetAmount, 10);
    if (isNaN(targetAmount) || targetAmount <= 0) throw new Error('Valor da meta deve ser maior que zero.');

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const currentAmount = parseInt(data.currentAmount || 0, 10);

    this.db.prepare(`
      INSERT INTO goals (id, name, target_amount, current_amount, target_date, color, icon, notes, is_demo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      targetAmount,
      currentAmount,
      data.targetDate || null,
      data.color || '#3b82f6',
      data.icon || 'Target',
      data.notes || null,
      data.isDemo ? 1 : 0,
      now,
      now
    );

    return this.getGoals().find(g => g.id === id);
  }

  updateGoal(id, data) {
    const existing = this.getGoals().find(g => g.id === id);
    if (!existing) throw new Error('Meta não encontrada.');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const targetAmount = data.targetAmount !== undefined ? parseInt(data.targetAmount, 10) : existing.targetAmount;
    const currentAmount = data.currentAmount !== undefined ? parseInt(data.currentAmount, 10) : existing.currentAmount;
    const targetDate = data.targetDate !== undefined ? data.targetDate : existing.targetDate;
    const color = data.color !== undefined ? data.color : existing.color;
    const icon = data.icon !== undefined ? data.icon : existing.icon;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE goals
      SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, color = ?, icon = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(name, targetAmount, currentAmount, targetDate, color, icon, notes, now, id);

    return this.getGoals().find(g => g.id === id);
  }

  addFundsToGoal(id, amount, accountId = null) {
    const goal = this.getGoals().find(g => g.id === id);
    if (!goal) throw new Error('Meta não encontrada.');

    const addCents = parseInt(amount, 10);
    if (isNaN(addCents) || addCents <= 0) throw new Error('Valor a adicionar deve ser maior que zero.');

    const runBatch = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE goals SET current_amount = current_amount + ?, updated_at = ? WHERE id = ?
      `).run(addCents, new Date().toISOString(), id);

      if (accountId) {
        this.createTransaction({
          accountId,
          type: 'expense',
          description: `Aporte para Meta: ${goal.name}`,
          amount: addCents,
          transactionDate: new Date().toISOString().slice(0, 10),
          status: 'completed',
        });
      }
    });

    runBatch();
    return this.getGoals().find(g => g.id === id);
  }

  deleteGoal(id) {
    this.db.prepare(`DELETE FROM goals WHERE id = ?`).run(id);
    return true;
  }

  // --- CATEGORY BUDGETS ---
  getCategoryBudgets(monthKey = null) {
    const targetMonth = monthKey || new Date().toISOString().slice(0, 7);
    const rows = this.db.prepare(`
      SELECT 
        b.id,
        b.category_id,
        b.amount_limit,
        b.alert_percentage,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COALESCE((
          SELECT SUM(t.amount)
          FROM transactions t
          WHERE t.category_id = b.category_id
            AND t.type = 'expense'
            AND t.status != 'cancelled'
            AND t.transaction_date >= '${targetMonth}-01'
            AND t.transaction_date <= '${targetMonth}-31'
        ), 0) as spent_amount
      FROM category_budgets b
      JOIN categories c ON b.category_id = c.id
      ORDER BY c.name ASC
    `).all();

    return rows.map(r => {
      const percentage = r.amount_limit > 0 ? Math.round((r.spent_amount / r.amount_limit) * 100) : 0;
      let status = 'ok';
      if (percentage >= 100) {
        status = 'exceeded';
      } else if (percentage >= (r.alert_percentage || 80)) {
        status = 'warning';
      }

      return {
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        categoryColor: r.category_color,
        categoryIcon: r.category_icon,
        amountLimit: r.amount_limit,
        spentAmount: r.spent_amount,
        remainingAmount: Math.max(0, r.amount_limit - r.spent_amount),
        percentage,
        alertPercentage: r.alert_percentage || 80,
        status,
        monthKey: targetMonth,
      };
    });
  }

  setCategoryBudget({ categoryId, amountLimit, alertPercentage = 80 }) {
    if (!categoryId) throw new Error('Categoria é obrigatória.');
    const limitCents = parseInt(amountLimit, 10);
    if (isNaN(limitCents) || limitCents <= 0) throw new Error('Limite deve ser maior que zero.');

    const existing = this.db.prepare(`SELECT id FROM category_budgets WHERE category_id = ?`).get(categoryId);
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare(`
        UPDATE category_budgets
        SET amount_limit = ?, alert_percentage = ?, updated_at = ?
        WHERE id = ?
      `).run(limitCents, parseInt(alertPercentage, 10) || 80, now, existing.id);
      return this.getCategoryBudgets().find(b => b.id === existing.id);
    } else {
      const id = crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO category_budgets (id, category_id, amount_limit, alert_percentage, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, categoryId, limitCents, parseInt(alertPercentage, 10) || 80, now, now);
      return this.getCategoryBudgets().find(b => b.id === id);
    }
  }

  deleteCategoryBudget(id) {
    this.db.prepare(`DELETE FROM category_budgets WHERE id = ?`).run(id);
    return true;
  }

  // --- NOTIFICATIONS ---
  getNotifications() {
    this.generateSmartNotifications();
    const rows = this.db.prepare(`
      SELECT * FROM notifications ORDER BY read ASC, created_at DESC LIMIT 50
    `).all();

    const unreadCount = this.db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`).get().count;

    return {
      unreadCount,
      notifications: rows.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        entityId: r.entity_id,
        read: Boolean(r.read),
        actionData: r.action_data,
        createdAt: r.created_at,
      })),
    };
  }

  markNotificationRead(id) {
    this.db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(id);
    return true;
  }

  markAllNotificationsRead() {
    this.db.prepare(`UPDATE notifications SET read = 1`).run();
    return true;
  }

  deleteNotification(id) {
    this.db.prepare(`DELETE FROM notifications WHERE id = ?`).run(id);
    return true;
  }

  generateSmartNotifications() {
    const today = new Date().toISOString().slice(0, 10);
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().slice(0, 10);

    const insertNotif = this.db.prepare(`
      INSERT INTO notifications (id, type, title, message, entity_id, read, action_data, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const hasNotifiedToday = (type, entityId) => {
      const exists = this.db.prepare(`
        SELECT id FROM notifications 
        WHERE type = ? AND entity_id = ? AND created_at >= '${today}T00:00:00'
      `).get(type, entityId);
      return Boolean(exists);
    };

    // 1. Pending bills due soon
    const pendingBills = this.db.prepare(`
      SELECT t.*, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status = 'pending'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
    `).all(today, in3DaysStr);

    for (const bill of pendingBills) {
      if (!hasNotifiedToday('bill_due', bill.id)) {
        const isToday = bill.transaction_date === today;
        const title = isToday ? '⚠️ Conta vencendo hoje!' : '⏰ Conta a vencer em breve';
        const msg = `"${bill.description}" no valor de R$ ${(bill.amount / 100).toFixed(2).replace('.', ',')} vence em ${bill.transaction_date.split('-').reverse().join('/')}.`;
        insertNotif.run(crypto.randomUUID(), 'bill_due', title, msg, bill.id, null, new Date().toISOString());
      }
    }

    // 2. Budget limits
    const budgets = this.getCategoryBudgets();
    for (const b of budgets) {
      if (b.status === 'exceeded' && !hasNotifiedToday('budget_warning', b.id)) {
        insertNotif.run(
          crypto.randomUUID(),
          'budget_warning',
          '🚨 Teto de Categoria Estourado!',
          `Você atingiu ${b.percentage}% do limite estipulado para ${b.categoryName}. Gasto atual: R$ ${(b.spentAmount / 100).toFixed(2).replace('.', ',')} de R$ ${(b.amountLimit / 100).toFixed(2).replace('.', ',')}.`,
          b.id,
          null,
          new Date().toISOString()
        );
      } else if (b.status === 'warning' && !hasNotifiedToday('budget_warning', b.id)) {
        insertNotif.run(
          crypto.randomUUID(),
          'budget_warning',
          '⚠️ Atenção ao Orçamento',
          `A categoria ${b.categoryName} consumiu ${b.percentage}% do seu teto mensal planejado.`,
          b.id,
          null,
          new Date().toISOString()
        );
      }
    }

    // 3. Credit cards due in next 3 days
    const cards = this.getCreditCards();
    const currentDay = new Date().getDate();
    for (const card of cards) {
      const diff = card.dueDay - currentDay;
      if (diff >= 0 && diff <= 3 && card.currentInvoiceAmount > 0) {
        if (!hasNotifiedToday('invoice_due', card.id)) {
          const title = diff === 0 ? `💳 Fatura do ${card.name} vence hoje!` : `💳 Fatura do ${card.name} vence em ${diff} dias`;
          const msg = `O valor atual da fatura é de R$ ${(card.currentInvoiceAmount / 100).toFixed(2).replace('.', ',')}. Não se esqueça de realizar o pagamento.`;
          insertNotif.run(crypto.randomUUID(), 'invoice_due', title, msg, card.id, null, new Date().toISOString());
        }
      }
    }
  }

  // --- BANKING OFX & CSV IMPORT, NORMALIZATION & RECONCILIATION ---
  normalizeMerchant(description) {
    if (!description || typeof description !== 'string') return 'OUTROS';
    let s = description.toUpperCase().trim();

    // Remove bank transaction prefixes
    const prefixes = [
      /^PIX\s+(ENVIADO|RECEBIDO|TRANSF|TRANSFERENCIA)\s*[-:]?\s*/i,
      /^TRANSF(ERENCIA)?\s+(PIX|TED|DOC|TEF|ENTRE\s+CONTAS)\s*[-:]?\s*/i,
      /^PAGAMENTO\s+(ELETRONICO|DE\s+TITULO|COBRANCA|FATURA|BOLETO|CONTA)\s*[-:]?\s*/i,
      /^PAGTO\s+(ELETRON|TITULO|COBRANCA|FATURA|BOLETO)?\s*[-:]?\s*/i,
      /^COMPRA\s+(CARTAO|CREDITO|DEBITO|ELO|VISA|MASTERCARD|MC)\s*[-:]?\s*/i,
      /^PAG\*\s*/i,
      /^PAGTO\*\s*/i,
      /^MP\*\s*/i,
      /^IOF\s*[-:]?\s*/i,
      /^TARIFA\s*[-:]?\s*/i,
    ];

    for (const p of prefixes) {
      s = s.replace(p, '');
    }

    // Strip dynamic identifiers like "PEDIDO 12345", "PED 9999", "#12345", "AUT 999", "NSU 999"
    s = s.replace(/\b(PEDIDO|PED|REF|DOC|AUT|NSU|SEQ|CUPOM|CHAVE|ID|TRANS|TERMINAL)\s*[:#]?\s*[A-Z0-9_-]+/gi, ' ');
    s = s.replace(/#\d+/g, ' ');

    // Well-known brands
    if (/^IFOOD\b/i.test(s)) return 'IFOOD';
    if (/^UBER\b/i.test(s)) return 'UBER';
    if (/^99APP\b|^99\s*\*/i.test(s)) return '99';
    if (/^NETFLIX\b/i.test(s)) return 'NETFLIX';
    if (/^SPOTIFY\b/i.test(s)) return 'SPOTIFY';
    if (/^AMAZON\b|^AMZN\b/i.test(s)) return 'AMAZON';
    if (/^CARREFOUR\b/i.test(s)) return 'CARREFOUR';
    if (/^PAO DE ACUCAR\b/i.test(s)) return 'PAO DE ACUCAR';
    if (/^DROGASIL\b/i.test(s)) return 'DROGASIL';
    if (/^RAIA\b/i.test(s)) return 'DROGA RAIA';
    if (/^ENEL\b/i.test(s)) return 'ENEL';
    if (/^SABESP\b/i.test(s)) return 'SABESP';

    // Remove dates and timestamps: 12/03, 12/03/2026, 14:32:10
    s = s.replace(/\b\d{1,2}[\/\.-]\d{1,2}([\/\.-]\d{2,4})?\b/g, ' ');
    s = s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ');

    // Remove long number sequences (>= 4 digits)
    s = s.replace(/\b\d{4,}\b/g, ' ');

    // Remove locations
    s = s.replace(/\b(SAO PAULO|RIO DE JANEIRO|CURITIBA|BELO HORIZONTE|BRASILIA|PORTO ALEGRE|RECIFE|SALVADOR|FORTALEZA)\s*(BR|BRA|BRL)?\b/gi, ' ');
    s = s.replace(/\s+(BR|BRA|BRL)$/i, '');

    // Clean special characters
    s = s.replace(/[*_#\/\\|]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    if (s.length < 2) {
      s = description.toUpperCase().replace(/\s+/g, ' ').trim();
    }

    const words = s.split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w));
    if (words.length > 0) {
      return words.slice(0, 3).join(' ');
    }

    return s || 'OUTROS';
  }

  parseOFX(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Conteúdo do arquivo OFX vazio ou inválido.');
    }

    const transactions = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    let blocks = [];
    if (content.includes('</STMTTRN>')) {
      while ((match = stmtTrnRegex.exec(content)) !== null) {
        blocks.push(match[1]);
      }
    } else {
      const parts = content.split(/<STMTTRN>/i);
      parts.shift();
      blocks = parts.map(p => p.split(/<\/STMTTRN>|<STMTTRN>/i)[0]);
    }

    const extractTag = (block, tag) => {
      const tagRegex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
      const m = block.match(tagRegex);
      return m ? m[1].trim() : '';
    };

    for (const block of blocks) {
      const trnType = extractTag(block, 'TRNTYPE');
      const dtPostedRaw = extractTag(block, 'DTPOSTED');
      const trnAmtRaw = extractTag(block, 'TRNAMT');
      const fitId = extractTag(block, 'FITID');
      const memoRaw = extractTag(block, 'MEMO');
      const nameRaw = extractTag(block, 'NAME');
      const checkNum = extractTag(block, 'CHECKNUM');
      const refNum = extractTag(block, 'REFNUM');

      if (!dtPostedRaw || !trnAmtRaw) continue;

      const year = dtPostedRaw.slice(0, 4);
      const month = dtPostedRaw.slice(4, 6);
      const day = dtPostedRaw.slice(6, 8);
      const transactionDate = `${year}-${month}-${day}`;

      const rawAmountFloat = parseFloat(trnAmtRaw.replace(',', '.'));
      if (isNaN(rawAmountFloat)) continue;

      const isExpense = rawAmountFloat < 0 || trnType.toUpperCase() === 'DEBIT';
      const amountCents = Math.round(Math.abs(rawAmountFloat) * 100);

      // Construct rich multi-line description combining Name and Memo if distinct
      let cleanDesc = '';
      if (nameRaw && memoRaw && nameRaw.trim().toLowerCase() !== memoRaw.trim().toLowerCase()) {
        cleanDesc = `${nameRaw.trim()}\n${memoRaw.trim()}`;
      } else {
        cleanDesc = (memoRaw || nameRaw || 'Lançamento Importado').trim();
      }

      const origin = this.normalizeMerchant(nameRaw || memoRaw || cleanDesc);

      transactions.push({
        id: crypto.randomUUID(),
        fitId: fitId || null,
        transactionDate,
        description: cleanDesc,
        originalDescription: cleanDesc,
        origin,
        amount: amountCents,
        type: isExpense ? 'expense' : 'income',
        memo: memoRaw || null,
        name: nameRaw || null,
        checkNum: checkNum || null,
        refNum: refNum || null,
        trnType: trnType || null,
      });
    }

    return transactions;
  }

  parseCSV(content, customMapping = null) {
    if (!content || typeof content !== 'string') {
      throw new Error('Conteúdo do arquivo CSV vazio ou inválido.');
    }

    const rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length < 2) {
      throw new Error('Arquivo CSV deve conter cabeçalho e pelo menos um registro.');
    }

    // Delimiter detection
    let delimiter = ';';
    if (customMapping && customMapping.delimiter) {
      delimiter = customMapping.delimiter;
    } else {
      const headerLine = rawLines[0];
      const counts = {
        ';': (headerLine.match(/;/g) || []).length,
        ',': (headerLine.match(/,/g) || []).length,
        '\t': (headerLine.match(/\t/g) || []).length,
        '|': (headerLine.match(/\|/g) || []).length,
      };
      let bestDelim = ';';
      let maxCount = -1;
      for (const [delim, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          bestDelim = delim;
        }
      }
      delimiter = bestDelim;
    }

    const splitLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result.map(c => c.replace(/^["']|["']$/g, '').trim());
    };

    const headers = splitLine(rawLines[0]);
    const previewRows = rawLines.slice(1, 6).map(l => splitLine(l));

    // Column detection if not provided
    let dateIdx = customMapping?.dateIndex !== undefined ? customMapping.dateIndex : -1;
    let descIdx = customMapping?.descIndex !== undefined ? customMapping.descIndex : -1;
    let amountIdx = customMapping?.amountIndex !== undefined ? customMapping.amountIndex : -1;
    let typeIdx = customMapping?.typeIndex !== undefined ? customMapping.typeIndex : -1;

    if (dateIdx === -1) {
      dateIdx = headers.findIndex(h => /^(data|date|dt|dt\.|lançamento|movimento)/i.test(h));
      if (dateIdx === -1) dateIdx = 0;
    }

    if (descIdx === -1) {
      descIdx = headers.findIndex(h => /^(descri|hist|memo|favorecido|estabelecimento|origem|detalhe)/i.test(h));
      if (descIdx === -1) descIdx = headers.length > 1 ? 1 : 0;
    }

    if (amountIdx === -1) {
      amountIdx = headers.findIndex(h => /^(valor|val|quantia|amount|montante)/i.test(h));
      if (amountIdx === -1) {
        amountIdx = headers.findIndex((h, idx) => idx !== dateIdx && idx !== descIdx);
      }
      if (amountIdx === -1) amountIdx = headers.length > 2 ? 2 : 1;
    }

    const transactions = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cols = splitLine(rawLines[i]);
      if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

      let dateRaw = cols[dateIdx];
      let descRaw = cols[descIdx] || 'Lançamento CSV';
      let amountRaw = cols[amountIdx];

      if (!dateRaw || !amountRaw) continue;

      // Parse date to YYYY-MM-DD
      let dateStr = dateRaw.trim();
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[0].length === 4) {
            dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            dateStr = `20${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Parse amount
      let cleanAmt = amountRaw.trim();
      let isNegative = false;
      if (cleanAmt.startsWith('(') && cleanAmt.endsWith(')')) {
        isNegative = true;
        cleanAmt = cleanAmt.slice(1, -1);
      } else if (cleanAmt.startsWith('-')) {
        isNegative = true;
        cleanAmt = cleanAmt.replace(/^-/, '');
      }

      let numVal = 0;
      if (cleanAmt.includes(',') && cleanAmt.includes('.')) {
        if (cleanAmt.indexOf('.') < cleanAmt.indexOf(',')) {
          numVal = parseFloat(cleanAmt.replace(/\./g, '').replace(',', '.'));
        } else {
          numVal = parseFloat(cleanAmt.replace(/,/g, ''));
        }
      } else if (cleanAmt.includes(',')) {
        numVal = parseFloat(cleanAmt.replace(',', '.'));
      } else {
        numVal = parseFloat(cleanAmt);
      }

      if (isNaN(numVal) || numVal === 0) continue;

      if (isNegative) numVal = -numVal;

      let isExpense = numVal < 0;
      if (typeIdx !== -1 && cols[typeIdx]) {
        const tVal = cols[typeIdx].toUpperCase();
        if (tVal.includes('D') || tVal.includes('DEBIT') || tVal.includes('SAIDA')) isExpense = true;
        if (tVal.includes('C') || tVal.includes('CREDIT') || tVal.includes('ENTRADA')) isExpense = false;
      }

      const amountCents = Math.round(Math.abs(numVal) * 100);
      const cleanDesc = descRaw.replace(/\s+/g, ' ').trim();
      const origin = this.normalizeMerchant(cleanDesc);

      transactions.push({
        id: crypto.randomUUID(),
        transactionDate: dateStr,
        description: cleanDesc,
        originalDescription: cleanDesc,
        origin,
        amount: amountCents,
        type: isExpense ? 'expense' : 'income',
      });
    }

    return {
      delimiter,
      headers,
      previewRows,
      detectedMapping: {
        dateIndex: dateIdx,
        descIndex: descIdx,
        amountIndex: amountIdx,
        typeIndex: typeIdx,
      },
      items: transactions,
    };
  }

  // --- IMPORT RULES & SMART RECONCILIATION ---
  getImportRules() {
    return this.db.prepare(`
      SELECT 
        r.*, 
        c.name as category_name, 
        c.color as category_color, 
        c.icon as category_icon
      FROM import_rules r
      LEFT JOIN categories c ON r.category_id = c.id
      ORDER BY r.match_count DESC, r.pattern ASC
    `).all().map(r => ({
      id: r.id,
      pattern: r.pattern,
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      categoryIcon: r.category_icon,
      active: Boolean(r.active),
      matchCount: r.match_count || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  saveImportRule({ id = null, pattern, categoryId, active = true }) {
    if (!pattern || !pattern.trim()) throw new Error('Padrão ou estabelecimento é obrigatório.');
    const cleanPattern = pattern.trim().toUpperCase();
    const now = new Date().toISOString();

    const existing = this.db.prepare(`SELECT id FROM import_rules WHERE pattern = ?`).get(cleanPattern);

    if (existing) {
      this.db.prepare(`
        UPDATE import_rules
        SET category_id = ?, active = ?, updated_at = ?
        WHERE id = ?
      `).run(categoryId || null, active ? 1 : 0, now, existing.id);
      return this.getImportRules().find(r => r.id === existing.id);
    } else {
      const ruleId = id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO import_rules (id, pattern, category_id, active, match_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(ruleId, cleanPattern, categoryId || null, active ? 1 : 0, now, now);
      return this.getImportRules().find(r => r.id === ruleId);
    }
  }

  deleteImportRule(id) {
    this.db.prepare(`DELETE FROM import_rules WHERE id = ?`).run(id);
    return true;
  }

  toggleImportRule(id) {
    this.db.prepare(`UPDATE import_rules SET active = 1 - active WHERE id = ?`).run(id);
    return true;
  }

  reconcileImport({ accountId, isCreditCard = false, items }) {
    const categories = this.getCategories();
    const rules = this.getImportRules().filter(r => r.active && r.categoryId);

    // Reconcile each individual item
    const reconciledItems = items.map(item => {
      const origin = item.origin || this.normalizeMerchant(item.description);
      const upperDesc = (item.description || '').toUpperCase();
      const upperOrigin = origin.toUpperCase();

      // 1. Duplicate detection
      let isDuplicate = false;
      if (item.fitId) {
        const matchFit = this.db.prepare(`
          SELECT id FROM transactions 
          WHERE fit_id = ? AND status != 'cancelled'
          LIMIT 1
        `).get(item.fitId);
        if (matchFit) isDuplicate = true;
      }

      if (!isDuplicate) {
        const matchComposite = this.db.prepare(`
          SELECT id FROM transactions
          WHERE (account_id = ? OR credit_card_id = ?)
            AND transaction_date = ?
            AND amount = ?
            AND status != 'cancelled'
          LIMIT 1
        `).get(accountId, accountId, item.transactionDate, item.amount);
        if (matchComposite) isDuplicate = true;
      }

      // 2. Rule and Category Matching
      let suggestedCatId = item.categoryId || null;
      let suggestedCatName = null;
      let matchedRule = null;
      let isAutoCategorized = false;

      // Check learned rules first
      for (const r of rules) {
        if (
          upperOrigin === r.pattern ||
          upperOrigin.includes(r.pattern) ||
          r.pattern.includes(upperOrigin) ||
          upperDesc.includes(r.pattern)
        ) {
          suggestedCatId = r.categoryId;
          suggestedCatName = r.categoryName;
          matchedRule = r;
          isAutoCategorized = true;
          break;
        }
      }

      if (suggestedCatId && !suggestedCatName) {
        const cat = categories.find(c => c.id === suggestedCatId);
        if (cat) suggestedCatName = cat.name;
      }

      return {
        ...item,
        originalDescription: item.originalDescription || item.description,
        origin,
        isDuplicate,
        selected: !isDuplicate,
        categoryId: suggestedCatId,
        categoryName: suggestedCatName,
        isAutoCategorized,
        matchedRuleId: matchedRule ? matchedRule.id : null,
      };
    });

    // 3. Group by Origin / Merchant for bulk categorization
    const groupsMap = new Map();
    for (const item of reconciledItems) {
      if (!groupsMap.has(item.origin)) {
        groupsMap.set(item.origin, {
          origin: item.origin,
          count: 0,
          totalAmount: 0,
          type: item.type,
          suggestedCategoryId: item.categoryId || null,
          suggestedCategoryName: item.categoryName || null,
          isAutoCategorized: Boolean(item.isAutoCategorized),
          isDuplicate: true,
          items: [],
        });
      }

      const g = groupsMap.get(item.origin);
      g.count += 1;
      g.totalAmount += item.amount;
      if (!g.suggestedCategoryId && item.categoryId) {
        g.suggestedCategoryId = item.categoryId;
        g.suggestedCategoryName = item.categoryName;
        g.isAutoCategorized = Boolean(item.isAutoCategorized);
      }
      if (!item.isDuplicate) {
        g.isDuplicate = false;
      }
      g.items.push(item);
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    // 4. Statistics
    const stats = {
      totalCount: reconciledItems.length,
      categorizedCount: reconciledItems.filter(i => Boolean(i.categoryId)).length,
      pendingCategoryCount: reconciledItems.filter(i => !i.categoryId).length,
      duplicateCount: reconciledItems.filter(i => i.isDuplicate).length,
      groupsCount: groups.length,
    };

    return {
      items: reconciledItems,
      groups,
      stats,
    };
  }

  batchImportTransactions({ accountId, isCreditCard = false, items, saveRules = true, statementId = null }) {
    if (!accountId) throw new Error('Conta ou cartão de destino é obrigatório.');
    if (!items || items.length === 0) throw new Error('Nenhum lançamento selecionado para importação.');

    let closingDay = null;
    if (isCreditCard) {
      const card = this.getCreditCardById(accountId);
      if (card) closingDay = card.closingDay;
    }

    const insertStmt = this.db.prepare(`
      INSERT INTO transactions (
        id, account_id, credit_card_id, category_id, type, description, amount, 
        transaction_date, invoice_month, status, tags, fit_id, origin, statement_id, is_demo, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'importado', ?, ?, ?, 0, ?, ?)
    `);

    const now = new Date().toISOString();
    let importedCount = 0;
    const learnedPatterns = new Map();

    const runBatch = this.db.transaction(() => {
      for (const item of items) {
        let invoiceMonth = null;
        if (isCreditCard && closingDay) {
          invoiceMonth = calculateInvoiceMonth(item.transactionDate, closingDay);
        }

        const origin = item.origin || this.normalizeMerchant(item.description);
        const finalDesc = (item.originalDescription || item.description || '').trim();

        insertStmt.run(
          item.id || crypto.randomUUID(),
          isCreditCard ? null : accountId,
          isCreditCard ? accountId : null,
          item.categoryId || null,
          item.type || 'expense',
          finalDesc,
          item.amount,
          item.transactionDate,
          invoiceMonth,
          item.fitId || null,
          origin,
          statementId || null,
          now,
          now
        );
        importedCount++;

        if (saveRules && origin && item.categoryId && origin !== 'OUTROS') {
          learnedPatterns.set(origin.toUpperCase(), item.categoryId);
        }
      }

      if (saveRules && learnedPatterns.size > 0) {
        for (const [pattern, categoryId] of learnedPatterns.entries()) {
          const existing = this.db.prepare(`SELECT id, match_count FROM import_rules WHERE pattern = ?`).get(pattern);
          if (existing) {
            this.db.prepare(`
              UPDATE import_rules 
              SET category_id = ?, match_count = match_count + 1, updated_at = ?
              WHERE id = ?
            `).run(categoryId, now, existing.id);
          } else {
            this.db.prepare(`
              INSERT INTO import_rules (id, pattern, category_id, active, match_count, created_at, updated_at)
              VALUES (?, ?, ?, 1, 1, ?, ?)
            `).run(crypto.randomUUID(), pattern, categoryId, now, now);
          }
        }
      }

      if (statementId) {
        this.updateImportedStatementStats(statementId, {
          itemsCount: importedCount,
          accountId: isCreditCard ? null : accountId,
          cardId: isCreditCard ? accountId : null,
        });
      }
    });

    runBatch();
    return { success: true, count: importedCount, learnedRulesCount: learnedPatterns.size };
  }

  reassignStatementAccount({ statementId, targetAccountId, targetType = 'account' }) {
    if (!statementId) throw new Error('Identificador do extrato é obrigatório.');
    if (!targetAccountId) throw new Error('Conta ou cartão de destino é obrigatório.');

    const statement = this.db.prepare(`SELECT * FROM imported_statements WHERE id = ?`).get(statementId);
    if (!statement) throw new Error('Extrato importado não encontrado.');

    const txRows = this.db.prepare(`SELECT id FROM transactions WHERE statement_id = ?`).all(statementId);
    const txIds = txRows.map(r => r.id);

    if (txIds.length > 0) {
      this.batchMoveTransactions({
        transactionIds: txIds,
        targetAccountId,
        targetType,
      });
    }

    if (targetType === 'card') {
      this.db.prepare(`UPDATE imported_statements SET card_id = ?, account_id = NULL WHERE id = ?`).run(targetAccountId, statementId);
    } else {
      this.db.prepare(`UPDATE imported_statements SET account_id = ?, card_id = NULL WHERE id = ?`).run(targetAccountId, statementId);
    }

    return {
      success: true,
      updatedCount: txIds.length,
      statementId,
    };
  }

  deleteStatementTransactions(statementId) {
    if (!statementId) throw new Error('Identificador do extrato é obrigatório.');

    const txRows = this.db.prepare(`SELECT id FROM transactions WHERE statement_id = ?`).all(statementId);
    const count = txRows.length;

    this.db.prepare(`DELETE FROM transactions WHERE statement_id = ?`).run(statementId);
    this.db.prepare(`UPDATE imported_statements SET items_count = 0 WHERE id = ?`).run(statementId);

    return {
      success: true,
      deletedCount: count,
    };
  }

  // --- BANK STATEMENT VAULT (OFX/CSV ARCHIVE) ---
  getStatementsFolderPath() {
    let userDataPath = process.cwd();
    try {
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        userDataPath = app.getPath('userData');
      }
    } catch (e) {}
    const folderPath = path.join(userDataPath, 'imported_statements');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return folderPath;
  }

  saveImportedStatement({ originalName, fileType, content, accountId = null, cardId = null, itemsCount = 0 }) {
    if (!content) return null;
    const folderPath = this.getStatementsFolderPath();
    const id = crypto.randomUUID();
    const now = new Date();
    const datePrefix = now.toISOString().replace(/[:.]/g, '-');
    const cleanOriginal = (originalName || `extrato.${fileType}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${datePrefix}_${cleanOriginal}`;
    const savedPath = path.join(folderPath, fileName);

    fs.writeFileSync(savedPath, content, 'utf8');
    const fileSize = Buffer.byteLength(content, 'utf8');
    const importedAt = now.toISOString();

    this.db.prepare(`
      INSERT INTO imported_statements (id, file_name, original_name, file_type, file_size, saved_path, imported_at, account_id, card_id, items_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, fileName, originalName || fileName, fileType, fileSize, savedPath, importedAt, accountId, cardId, itemsCount);

    return {
      id,
      fileName,
      originalName: originalName || fileName,
      fileType,
      fileSize,
      savedPath,
      importedAt,
      itemsCount,
    };
  }

  updateImportedStatementStats(id, { itemsCount = null, accountId = null, cardId = null }) {
    if (!id) return;
    const fields = [];
    const vals = [];
    if (itemsCount !== null) { fields.push('items_count = ?'); vals.push(itemsCount); }
    if (accountId !== null) { fields.push('account_id = ?'); vals.push(accountId); }
    if (cardId !== null) { fields.push('card_id = ?'); vals.push(cardId); }
    if (fields.length > 0) {
      vals.push(id);
      this.db.prepare(`UPDATE imported_statements SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    }
  }

  getImportedStatements() {
    const rows = this.db.prepare(`
      SELECT s.*, 
             a.name as account_name,
             c.name as card_name
      FROM imported_statements s
      LEFT JOIN accounts a ON s.account_id = a.id
      LEFT JOIN credit_cards c ON s.card_id = c.id
      ORDER BY s.imported_at DESC
    `).all();

    return rows.map(r => ({
      id: r.id,
      fileName: r.file_name,
      originalName: r.original_name,
      fileType: r.file_type,
      fileSize: r.file_size,
      savedPath: r.saved_path,
      importedAt: r.imported_at,
      accountId: r.account_id,
      accountName: r.account_name,
      cardId: r.card_id,
      cardName: r.card_name,
      itemsCount: r.items_count,
      fileExists: fs.existsSync(r.saved_path),
    }));
  }

  // --- FINANCIAL CALENDAR & PROJECTIONS ---
  getCalendarData(year, month) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(y, m, 0).getDate();

    const transactions = this.db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.transaction_date >= '${monthKey}-01' AND t.transaction_date <= '${monthKey}-${daysInMonth}'
        AND t.status != 'cancelled'
      ORDER BY t.transaction_date ASC
    `).all();

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      const dayTxs = transactions.filter(t => t.transaction_date === dateStr);

      const income = dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      days.push({
        day: d,
        date: dateStr,
        income,
        expense,
        count: dayTxs.length,
        items: dayTxs.map(t => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          type: t.type,
          status: t.status,
          categoryName: t.category_name,
          categoryColor: t.category_color,
        })),
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentBalance = this.getAccounts().reduce((sum, a) => sum + a.currentBalance, 0);

    const pendingFutureIncome = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'income' AND status = 'pending'
        AND transaction_date >= '${todayStr}' AND transaction_date <= '${monthKey}-${daysInMonth}'
    `).get().total;

    const pendingFutureExpense = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'expense' AND credit_card_id IS NULL AND status = 'pending'
        AND transaction_date >= '${todayStr}' AND transaction_date <= '${monthKey}-${daysInMonth}'
    `).get().total;

    const projectedBalance = currentBalance + pendingFutureIncome - pendingFutureExpense;

    return {
      year: y,
      month: m,
      monthKey,
      daysInMonth,
      days,
      currentBalance,
      pendingFutureIncome,
      pendingFutureExpense,
      projectedBalance,
    };
  }

  // --- DASHBOARD AGGREGATIONS ---
  getDashboardData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Prev month
    const prevDate = new Date(currentYear, currentMonth - 2, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // 1. Total Balance across active accounts
    const accounts = this.getAccounts();
    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // 2. Income and Expense this month (completed transactions)
    // Note: expenses on credit cards are included in the month of their invoice or transaction date!
    const monthIncome = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income'
        AND status = 'completed'
        AND transaction_date >= '${currentMonthKey}-01'
        AND transaction_date <= '${currentMonthKey}-31'
    `).get().total;

    // Expenses: includes regular bank expenses and card purchases, excludes transfer and card_payment
    const monthExpense = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense'
        AND status != 'cancelled'
        AND (
          (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= '${currentMonthKey}-01' AND transaction_date <= '${currentMonthKey}-31')
          OR
          (credit_card_id IS NOT NULL AND invoice_month = '${currentMonthKey}')
        )
    `).get().total;

    const monthResult = monthIncome - monthExpense;

    // Previous month stats for comparison
    const prevMonthIncome = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income'
        AND status = 'completed'
        AND transaction_date >= '${prevMonthKey}-01'
        AND transaction_date <= '${prevMonthKey}-31'
    `).get().total;

    const prevMonthExpense = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense'
        AND status != 'cancelled'
        AND (
          (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= '${prevMonthKey}-01' AND transaction_date <= '${prevMonthKey}-31')
          OR
          (credit_card_id IS NOT NULL AND invoice_month = '${prevMonthKey}')
        )
    `).get().total;

    const prevMonthResult = prevMonthIncome - prevMonthExpense;

    // 3. Cards summary
    const cards = this.getCreditCards();
    const totalCardLimit = cards.reduce((sum, c) => sum + c.creditLimit, 0);
    const totalCardUsed = cards.reduce((sum, c) => sum + c.usedLimit, 0);
    const totalCardAvailable = Math.max(0, totalCardLimit - totalCardUsed);

    // 4. Upcoming bills (next 15 days)
    const todayStr = now.toISOString().slice(0, 10);
    const fifteenDaysLater = new Date(now);
    fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);
    const fifteenDaysLaterStr = fifteenDaysLater.toISOString().slice(0, 10);

    const upcomingBills = this.db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.type = 'expense'
        AND t.status = 'pending'
        AND t.transaction_date >= ?
        AND t.transaction_date <= ?
      ORDER BY t.transaction_date ASC
      LIMIT 6
    `).all(todayStr, fifteenDaysLaterStr).map(r => ({
      id: r.id,
      description: r.description,
      amount: r.amount,
      transactionDate: r.transaction_date,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      accountName: r.account_name,
    }));

    // 5. Cash Flow history (last 6 months)
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const cashFlowHistory = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;

      const inc = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'income' AND status = 'completed'
          AND transaction_date >= '${mKey}-01' AND transaction_date <= '${mKey}-31'
      `).get().total;

      const exp = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'expense' AND status != 'cancelled'
          AND (
            (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= '${mKey}-01' AND transaction_date <= '${mKey}-31')
            OR
            (credit_card_id IS NOT NULL AND invoice_month = '${mKey}')
          )
      `).get().total;

      cashFlowHistory.push({
        monthKey: mKey,
        label,
        receitas: inc,
        despesas: exp,
        resultado: inc - exp,
      });
    }

    // 6. Expenses by Category (current month)
    const categoryExpensesRaw = this.db.prepare(`
      SELECT 
        COALESCE(c.id, 'outros') as category_id,
        COALESCE(c.name, 'Sem Categoria') as name,
        COALESCE(c.color, '#94a3b8') as color,
        COALESCE(c.icon, 'Tag') as icon,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense'
        AND t.status != 'cancelled'
        AND (
          (t.credit_card_id IS NULL AND t.status = 'completed' AND t.transaction_date >= '${currentMonthKey}-01' AND t.transaction_date <= '${currentMonthKey}-31')
          OR
          (t.credit_card_id IS NOT NULL AND t.invoice_month = '${currentMonthKey}')
        )
      GROUP BY c.id
      ORDER BY total DESC
    `).all();

    const totalExpForCat = categoryExpensesRaw.reduce((sum, item) => sum + item.total, 0);
    const categoryExpenses = categoryExpensesRaw.map(item => ({
      categoryId: item.category_id,
      name: item.name,
      color: item.color,
      icon: item.icon,
      total: item.total,
      percentage: totalExpForCat > 0 ? Math.round((item.total / totalExpForCat) * 100) : 0,
    }));

    // 7. Recent transactions (latest 8)
    const recentTransactions = this.getTransactions({ limit: 8 });

    return {
      totalBalance,
      monthIncome,
      monthExpense,
      monthResult,
      prevMonthIncome,
      prevMonthExpense,
      prevMonthResult,
      cardsSummary: {
        totalLimit: totalCardLimit,
        usedLimit: totalCardUsed,
        availableLimit: totalCardAvailable,
        cardCount: cards.length,
      },
      upcomingBills,
      cashFlowHistory,
      categoryExpenses,
      recentTransactions,
    };
  }

  // --- REPORTS ---
  getReports(filters = {}) {
    let startDate = filters.startDate;
    let endDate = filters.endDate;

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
    }

    // Expenses by Category in period
    const expensesByCategory = this.db.prepare(`
      SELECT 
        COALESCE(c.name, 'Outros') as name,
        COALESCE(c.color, '#94a3b8') as color,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense'
        AND t.status != 'cancelled'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
      GROUP BY c.id
      ORDER BY total DESC
    `).all(startDate, endDate);

    const totalExp = expensesByCategory.reduce((sum, item) => sum + item.total, 0);
    const expensesByCategoryFormatted = expensesByCategory.map(item => ({
      ...item,
      percentage: totalExp > 0 ? Math.round((item.total / totalExp) * 100) : 0,
    }));

    // Income by Category in period
    const incomeByCategory = this.db.prepare(`
      SELECT 
        COALESCE(c.name, 'Outros') as name,
        COALESCE(c.color, '#10b981') as color,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'income'
        AND t.status = 'completed'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
      GROUP BY c.id
      ORDER BY total DESC
    `).all(startDate, endDate);

    const totalInc = incomeByCategory.reduce((sum, item) => sum + item.total, 0);
    const incomeByCategoryFormatted = incomeByCategory.map(item => ({
      ...item,
      percentage: totalInc > 0 ? Math.round((item.total / totalInc) * 100) : 0,
    }));

    // Expenses by Account
    const expensesByAccount = this.db.prepare(`
      SELECT 
        COALESCE(a.name, 'Sem Conta') as name,
        COALESCE(a.color, '#3b82f6') as color,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.type = 'expense'
        AND t.credit_card_id IS NULL
        AND t.status != 'cancelled'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
      GROUP BY a.id
      ORDER BY total DESC
    `).all(startDate, endDate);

    // Expenses by Credit Card
    const expensesByCard = this.db.prepare(`
      SELECT 
        COALESCE(cc.name, 'Sem Cartão') as name,
        COALESCE(cc.color, '#8b5cf6') as color,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN credit_cards cc ON t.credit_card_id = cc.id
      WHERE t.type = 'expense'
        AND t.credit_card_id IS NOT NULL
        AND t.status != 'cancelled'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
      GROUP BY cc.id
      ORDER BY total DESC
    `).all(startDate, endDate);

    // Top 10 largest expenses in period
    const topExpenses = this.db.prepare(`
      SELECT 
        t.id, t.description, t.amount, t.transaction_date,
        COALESCE(c.name, 'Outros') as category_name,
        COALESCE(c.color, '#94a3b8') as category_color,
        COALESCE(a.name, cc.name, '-') as source_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN credit_cards cc ON t.credit_card_id = cc.id
      WHERE t.type = 'expense'
        AND t.status != 'cancelled'
        AND t.transaction_date >= ? AND t.transaction_date <= ?
      ORDER BY t.amount DESC
      LIMIT 10
    `).all(startDate, endDate);

    return {
      period: { startDate, endDate },
      summary: {
        totalIncome: totalInc,
        totalExpense: totalExp,
        netResult: totalInc - totalExp,
      },
      expensesByCategory: expensesByCategoryFormatted,
      incomeByCategory: incomeByCategoryFormatted,
      expensesByAccount,
      expensesByCard,
      topExpenses,
    };
  }

  // --- BACKUP & RESTORE ---
  exportBackup() {
    const settings = this.db.prepare(`SELECT * FROM settings WHERE id = 'app_config'`).get();
    const accounts = this.db.prepare(`SELECT * FROM accounts`).all();
    const categories = this.db.prepare(`SELECT * FROM categories`).all();
    const creditCards = this.db.prepare(`SELECT * FROM credit_cards`).all();
    const transactions = this.db.prepare(`SELECT * FROM transactions`).all();
    const recurringRules = this.db.prepare(`SELECT * FROM recurring_rules`).all();
    const goals = this.db.prepare(`SELECT * FROM goals`).all();

    const backupData = {
      version: '1.0',
      appName: 'Meu Financeiro',
      exportedAt: new Date().toISOString(),
      tables: {
        settings: settings ? [settings] : [],
        accounts,
        categories,
        creditCards,
        transactions,
        recurringRules,
        goals,
      },
    };

    return JSON.stringify(backupData, null, 2);
  }

  restoreBackup(jsonString) {
    let data;
    try {
      data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      throw new Error('Arquivo de backup corrompido ou formato JSON inválido.');
    }

    if (!data.tables) {
      throw new Error('Formato de backup inválido: tabela de dados não encontrada.');
    }

    const { tables } = data;
    const runRestore = this.db.transaction(() => {
      // Clear current data
      this.db.prepare(`DELETE FROM transactions`).run();
      this.db.prepare(`DELETE FROM recurring_rules`).run();
      this.db.prepare(`DELETE FROM goals`).run();
      this.db.prepare(`DELETE FROM credit_cards`).run();
      this.db.prepare(`DELETE FROM accounts`).run();
      this.db.prepare(`DELETE FROM categories`).run();

      // Restore categories
      if (tables.categories && tables.categories.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO categories (id, name, type, color, icon, active, is_system, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of tables.categories) {
          stmt.run(c.id, c.name, c.type, c.color, c.icon, c.active, c.is_system, c.created_at);
        }
      }

      // Restore accounts
      if (tables.accounts && tables.accounts.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO accounts (id, name, type, initial_balance, color, icon, active, is_demo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of tables.accounts) {
          stmt.run(a.id, a.name, a.type, a.initial_balance, a.color, a.icon, a.active, a.is_demo || 0, a.created_at, a.updated_at);
        }
      }

      // Restore credit cards
      if (tables.creditCards && tables.creditCards.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO credit_cards (id, name, credit_limit, closing_day, due_day, color, active, is_demo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cc of tables.creditCards) {
          stmt.run(cc.id, cc.name, cc.credit_limit, cc.closing_day, cc.due_day, cc.color, cc.active, cc.is_demo || 0, cc.created_at, cc.updated_at);
        }
      }

      // Restore transactions
      if (tables.transactions && tables.transactions.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO transactions (
            id, account_id, destination_account_id, category_id, credit_card_id,
            type, description, amount, transaction_date, invoice_month,
            status, notes, recurring_id, installment_id, installment_number, total_installments,
            is_demo, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of tables.transactions) {
          stmt.run(
            t.id, t.account_id, t.destination_account_id, t.category_id, t.credit_card_id,
            t.type, t.description, t.amount, t.transaction_date, t.invoice_month,
            t.status, t.notes, t.recurring_id, t.installment_id, t.installment_number, t.total_installments,
            t.is_demo || 0, t.created_at, t.updated_at
          );
        }
      }

      // Restore recurring rules
      if (tables.recurringRules && tables.recurringRules.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO recurring_rules (id, account_id, category_id, credit_card_id, type, description, amount, frequency, start_date, next_due_date, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of tables.recurringRules) {
          stmt.run(r.id, r.account_id, r.category_id, r.credit_card_id, r.type, r.description, r.amount, r.frequency, r.start_date, r.next_due_date, r.active, r.created_at);
        }
      }

      // Restore goals
      if (tables.goals && tables.goals.length > 0) {
        const stmt = this.db.prepare(`
          INSERT INTO goals (id, name, target_amount, current_amount, target_date, color, icon, notes, is_demo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const g of tables.goals) {
          stmt.run(g.id, g.name, g.target_amount, g.current_amount, g.target_date, g.color, g.icon, g.notes, g.is_demo || 0, g.created_at, g.updated_at);
        }
      }

      // Restore settings (optional)
      if (tables.settings && tables.settings.length > 0) {
        const s = tables.settings[0];
        this.db.prepare(`
          UPDATE settings
          SET user_name = ?, currency = ?, theme = ?, onboarding_completed = 1, updated_at = ?
          WHERE id = 'app_config'
        `).run(s.user_name || 'Usuário', s.currency || 'BRL', s.theme || 'dark', new Date().toISOString());
      }
    });

    runRestore();
    return true;
  }

  // --- CSV EXPORT ---
  exportTransactionsCSV(filters = {}) {
    const transactions = this.getTransactions(filters);
    const header = 'Data;Descrição;Tipo;Categoria;Conta / Cartão;Valor (R$);Status;Observações';

    const typeLabels = {
      income: 'Receita',
      expense: 'Despesa',
      transfer: 'Transferência',
      card_payment: 'Pagamento de Cartão',
    };

    const statusLabels = {
      completed: 'Concluído',
      pending: 'Pendente',
      cancelled: 'Cancelado',
      paid: 'Pago',
    };

    const rows = transactions.map(t => {
      const formattedDate = t.transactionDate.split('-').reverse().join('/');
      const typeLabel = typeLabels[t.type] || t.type;
      const source = t.creditCardName ? `Cartão: ${t.creditCardName}` : (t.accountName || '-');
      const category = t.categoryName || '-';
      const value = (t.amount / 100).toFixed(2).replace('.', ',');
      const statusLabel = statusLabels[t.status] || t.status;
      const notes = (t.notes || '').replace(/;/g, ',');
      const desc = t.description.replace(/;/g, ',');

      return `${formattedDate};"${desc}";${typeLabel};"${category}";"${source}";${value};${statusLabel};"${notes}"`;
    });

    // UTF-8 BOM (\uFEFF) ensures Excel on Windows displays accents correctly
    return '\uFEFF' + [header, ...rows].join('\r\n');
  }

  // --- DEMO DATA ---
  seedDemoData() {
    this.clearDemoData(); // Clean any previous demo data

    const runBatch = this.db.transaction(() => {
      // 1. Create demo accounts
      const nubank = this.createAccount({
        name: 'Nubank',
        type: 'checking',
        initialBalance: 350000, // R$ 3.500,00
        color: '#8b5cf6',
        icon: 'CreditCard',
        isDemo: true,
      });

      const itau = this.createAccount({
        name: 'Itaú Personalité',
        type: 'checking',
        initialBalance: 520000, // R$ 5.200,00
        color: '#f97316',
        icon: 'Landmark',
        isDemo: true,
      });

      const carteira = this.createAccount({
        name: 'Dinheiro em Espécie',
        type: 'cash',
        initialBalance: 35000, // R$ 350,00
        color: '#10b981',
        icon: 'Wallet',
        isDemo: true,
      });

      // 2. Create demo credit card
      const card = this.createCreditCard({
        name: 'Nubank Ultravioleta',
        creditLimit: 1200000, // R$ 12.000,00
        closingDay: 25,
        dueDay: 5,
        color: '#7c3aed',
        isDemo: true,
      });

      // 3. Transactions for current and recent dates
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Salário
      this.createTransaction({
        accountId: nubank.id,
        categoryId: 'cat_salario',
        type: 'income',
        description: 'Salário Mensal',
        amount: 850000, // R$ 8.500,00
        transactionDate: `${currentMonth}-05`,
        status: 'completed',
        isDemo: true,
      });

      // Freelance
      this.createTransaction({
        accountId: itau.id,
        categoryId: 'cat_freelance',
        type: 'income',
        description: 'Desenvolvimento Web Freelance',
        amount: 280000, // R$ 2.800,00
        transactionDate: `${currentMonth}-12`,
        status: 'completed',
        isDemo: true,
      });

      // Aluguel
      this.createTransaction({
        accountId: nubank.id,
        categoryId: 'cat_moradia',
        type: 'expense',
        description: 'Aluguel do Apartamento',
        amount: 220000, // R$ 2.200,00
        transactionDate: `${currentMonth}-10`,
        status: 'completed',
        isDemo: true,
      });

      // Supermercado
      this.createTransaction({
        accountId: nubank.id,
        categoryId: 'cat_alimentacao',
        type: 'expense',
        description: 'Compras Pão de Açúcar',
        amount: 64580, // R$ 645,80
        transactionDate: `${currentMonth}-08`,
        status: 'completed',
        isDemo: true,
      });

      // Restaurante no dinheiro
      this.createTransaction({
        accountId: carteira.id,
        categoryId: 'cat_alimentacao',
        type: 'expense',
        description: 'Almoço Restaurante Familiar',
        amount: 6850, // R$ 68,50
        transactionDate: `${currentMonth}-11`,
        status: 'completed',
        isDemo: true,
      });

      // Transferência Nubank -> Itaú
      this.createTransaction({
        accountId: nubank.id,
        destinationAccountId: itau.id,
        type: 'transfer',
        description: 'Transferência para Reserva',
        amount: 150000, // R$ 1.500,00
        transactionDate: `${currentMonth}-07`,
        status: 'completed',
        isDemo: true,
      });

      // Compra parcelada no cartão: Notebook Dell R$ 3.600 em 12x de R$ 300
      this.createTransaction({
        creditCardId: card.id,
        categoryId: 'cat_compras',
        type: 'expense',
        description: 'Notebook Dell XPS',
        amount: 360000, // R$ 3.600,00
        totalInstallments: 12,
        transactionDate: `${currentMonth}-02`,
        status: 'completed',
        isDemo: true,
      });

      // Outras compras no cartão
      this.createTransaction({
        creditCardId: card.id,
        categoryId: 'cat_assinaturas',
        type: 'expense',
        description: 'Netflix e Spotify',
        amount: 7990, // R$ 79,90
        transactionDate: `${currentMonth}-06`,
        status: 'completed',
        isDemo: true,
      });

      this.createTransaction({
        creditCardId: card.id,
        categoryId: 'cat_transporte',
        type: 'expense',
        description: 'Posto Shell Combustível',
        amount: 22000, // R$ 220,00
        transactionDate: `${currentMonth}-13`,
        status: 'completed',
        isDemo: true,
      });

      // 4. Goals
      this.createGoal({
        name: 'Reserva de Emergência',
        targetAmount: 3000000, // R$ 30.000,00
        currentAmount: 1850000, // R$ 18.500,00
        targetDate: `${now.getFullYear()}-12-31`,
        color: '#10b981',
        icon: 'ShieldCheck',
        notes: '6 meses de custo fixo guardados.',
        isDemo: true,
      });

      this.createGoal({
        name: 'Viagem de Férias',
        targetAmount: 800000, // R$ 8.000,00
        currentAmount: 420000, // R$ 4.200,00
        targetDate: `${now.getFullYear() + 1}-03-15`,
        color: '#3b82f6',
        icon: 'Plane',
        notes: 'Passagens e hotel em Florianópolis.',
        isDemo: true,
      });
    });

    runBatch();
    return true;
  }

  clearDemoData() {
    const runClear = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM transactions WHERE is_demo = 1`).run();
      this.db.prepare(`DELETE FROM goals WHERE is_demo = 1`).run();
      this.db.prepare(`DELETE FROM credit_cards WHERE is_demo = 1`).run();
      this.db.prepare(`DELETE FROM accounts WHERE is_demo = 1`).run();
    });
    runClear();
    return true;
  }
}

let serviceInstance = null;

function getFinancialService(customDb = null) {
  if (customDb) {
    return new FinancialService(customDb);
  }
  if (!serviceInstance) {
    serviceInstance = new FinancialService();
  }
  return serviceInstance;
}

module.exports = {
  FinancialService,
  getFinancialService,
  calculateInvoiceMonth,
  addMonths,
};
