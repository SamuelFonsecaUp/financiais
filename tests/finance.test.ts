import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { getFinancialService, calculateInvoiceMonth, addMonths } from '../electron/services.cjs';
import { hashPin, verifyPin, generateSalt } from '../electron/crypto.cjs';

describe('Financial Rules and Core Logic', () => {
  let db: any;
  let service: any;

  beforeEach(() => {
    // Run in-memory SQLite database for test isolation
    db = initDatabase(':memory:');
    service = getFinancialService(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('calculates account balance correctly with initial balance, income and expense', () => {
    // 1. Create account with initial balance R$ 1.000,00 (100.000 cents)
    const acc = service.createAccount({
      name: 'Banco Teste',
      type: 'checking',
      initialBalance: 100000,
    });
    expect(acc.currentBalance).toBe(100000);

    // 2. Add income R$ 500,00 (50.000 cents)
    service.createTransaction({
      accountId: acc.id,
      type: 'income',
      description: 'Salário Teste',
      amount: 50000,
      transactionDate: '2026-09-01',
      status: 'completed',
    });

    // 3. Add expense R$ 200,00 (20.000 cents)
    service.createTransaction({
      accountId: acc.id,
      type: 'expense',
      description: 'Mercado',
      amount: 20000,
      transactionDate: '2026-09-02',
      status: 'completed',
    });

    const updated = service.getAccountById(acc.id);
    // Saldo: 1000 + 500 - 200 = 1300 (130.000 cents)
    expect(updated.currentBalance).toBe(130000);

    // Dashboard check: Period result = +300 (30.000 cents), Total Balance = 1300 (130.000 cents)
    // Concept separation test: Account Balance vs Period Result!
    const txs = service.getTransactions({ accountId: acc.id });
    const inc = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
    const exp = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
    expect(inc - exp).toBe(30000);
  });

  it('transfers money between accounts without altering net worth or counting as income/expense', () => {
    const nubank = service.createAccount({ name: 'Nubank', initialBalance: 100000 });
    const itau = service.createAccount({ name: 'Itaú', initialBalance: 50000 });

    const totalBefore = nubank.currentBalance + itau.currentBalance;
    expect(totalBefore).toBe(150000);

    // Transfer R$ 300,00 (30.000 cents) from Nubank to Itaú
    service.createTransaction({
      accountId: nubank.id,
      destinationAccountId: itau.id,
      type: 'transfer',
      description: 'Transferência entre contas',
      amount: 30000,
      transactionDate: '2026-09-05',
      status: 'completed',
    });

    const updatedNubank = service.getAccountById(nubank.id);
    const updatedItau = service.getAccountById(itau.id);

    expect(updatedNubank.currentBalance).toBe(70000); // 1000 - 300 = 700
    expect(updatedItau.currentBalance).toBe(80000);  // 500 + 300 = 800

    const totalAfter = updatedNubank.currentBalance + updatedItau.currentBalance;
    expect(totalAfter).toBe(150000); // Patrimônio global inalterado!

    // Ensure transfer does NOT count as income or expense in reports
    const reports = service.getReports({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(reports.summary.totalIncome).toBe(0);
    expect(reports.summary.totalExpense).toBe(0);
  });

  it('handles installment purchases correctly without duplicating total in current month', () => {
    const card = service.createCreditCard({
      name: 'Nubank Card',
      creditLimit: 500000, // R$ 5.000,00
      closingDay: 25,
      dueDay: 5,
    });

    // Notebook R$ 3.600,00 in 12 installments of R$ 300,00
    const res = service.createTransaction({
      creditCardId: card.id,
      type: 'expense',
      description: 'Notebook',
      amount: 360000,
      totalInstallments: 12,
      transactionDate: '2026-09-10',
    });

    expect(res.count).toBe(12);

    const txs = service.getTransactions({ creditCardId: card.id });
    expect(txs.length).toBe(12);

    // Each installment is exactly R$ 300,00 (30.000 cents)
    for (let i = 0; i < 12; i++) {
      expect(txs[i].amount).toBe(30000);
      expect(txs[i].totalInstallments).toBe(12);
      expect(txs[i].installmentId).toBe(res.installmentId);
    }

    // Sum of all installments is exactly the initial amount
    const sumCents = txs.reduce((acc: number, t: any) => acc + t.amount, 0);
    expect(sumCents).toBe(360000);

    // In current month (2026-09), only 1 parcel exists!
    const sepTxs = txs.filter((t: any) => t.transactionDate.startsWith('2026-09'));
    expect(sepTxs.length).toBe(1);
    expect(sepTxs[0].amount).toBe(30000); // Only 300, NOT 3600!
  });

  it('calculates credit card closing day, invoice month, and limits properly', () => {
    // Closing day 25
    expect(calculateInvoiceMonth('2026-09-20', 25)).toBe('2026-09');
    expect(calculateInvoiceMonth('2026-09-25', 25)).toBe('2026-09');
    expect(calculateInvoiceMonth('2026-09-26', 25)).toBe('2026-10'); // Next month!

    const card = service.createCreditCard({
      name: 'Cartão Master',
      creditLimit: 500000, // R$ 5.000,00
      closingDay: 25,
      dueDay: 5,
    });

    service.createTransaction({
      creditCardId: card.id,
      type: 'expense',
      description: 'Restaurante',
      amount: 124000, // R$ 1.240,00
      transactionDate: '2026-09-15',
    });

    const cardData = service.getCreditCardById(card.id);
    expect(cardData.creditLimit).toBe(500000);
    expect(cardData.usedLimit).toBe(124000);
    expect(cardData.availableLimit).toBe(376000); // 5000 - 1240 = 3760
  });

  it('pays credit card invoice debiting bank account and clearing used limit without double counting expense', () => {
    const bank = service.createAccount({ name: 'Conta Corrente', initialBalance: 200000 });
    const card = service.createCreditCard({
      name: 'Cartão Visa',
      creditLimit: 300000,
      closingDay: 25,
      dueDay: 5,
    });

    // Expense on card
    service.createTransaction({
      creditCardId: card.id,
      type: 'expense',
      description: 'Supermercado',
      amount: 45000, // R$ 450,00
      transactionDate: '2026-09-10',
    });

    expect(service.getCreditCardById(card.id).usedLimit).toBe(45000);

    // Pay invoice
    service.payCardInvoice({
      creditCardId: card.id,
      invoiceMonth: '2026-09',
      accountId: bank.id,
      paymentDate: '2026-09-28',
      amount: 45000,
    });

    // Bank balance debited
    const updatedBank = service.getAccountById(bank.id);
    expect(updatedBank.currentBalance).toBe(155000); // 2000 - 450 = 1550

    // Card used limit cleared
    const updatedCard = service.getCreditCardById(card.id);
    expect(updatedCard.usedLimit).toBe(0);
    expect(updatedCard.availableLimit).toBe(300000);

    // Report for period should only count 1 expense (the supermarket), NOT another expense for invoice payment
    const reports = service.getReports({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(reports.summary.totalExpense).toBe(45000);
  });

  it('exports and restores complete database backup with exact integrity', () => {
    service.createAccount({ name: 'Carteira', initialBalance: 5000 });
    service.createCategory({ name: 'Games', type: 'expense' });
    service.createGoal({ name: 'Carro', targetAmount: 4000000 });

    const backupJson = service.exportBackup();
    expect(typeof backupJson).toBe('string');
    const parsed = JSON.parse(backupJson);
    expect(parsed.appName).toBe('Meu Financeiro');
    expect(parsed.tables.accounts.length).toBeGreaterThan(0);

    // Now clear data and restore
    service.restoreBackup(backupJson);

    const accounts = service.getAccounts();
    expect(accounts.some((a: any) => a.name === 'Carteira')).toBe(true);

    const goals = service.getGoals();
    expect(goals.some((g: any) => g.name === 'Carro')).toBe(true);
  });

  it('secures with PIN hashing using salt and pbkdf2', () => {
    const salt = generateSalt();
    const hash = hashPin('1234', salt);

    expect(verifyPin('1234', hash, salt)).toBe(true);
    expect(verifyPin('4321', hash, salt)).toBe(false);
    expect(verifyPin('0000', hash, salt)).toBe(false);
  });

  it('normalizes merchant names by removing dynamic order numbers, authorization codes and bank prefixes', () => {
    expect(service.normalizeMerchant('IFOOD PEDIDO 12345')).toBe('IFOOD');
    expect(service.normalizeMerchant('IFOOD PEDIDO 67891')).toBe('IFOOD');
    expect(service.normalizeMerchant('IFOOD PEDIDO 99999')).toBe('IFOOD');
    expect(service.normalizeMerchant('UBER *TRIP 98765 SAO PAULO BR')).toBe('UBER');
    expect(service.normalizeMerchant('COMPRA CARTAO - CARREFOUR HIPER 123')).toBe('CARREFOUR');
    expect(service.normalizeMerchant('NETFLIX.COM RIO DE JANEIRO')).toBe('NETFLIX');
    expect(service.normalizeMerchant('PIX ENVIADO - POSTO SHELL 4492')).toBe('POSTO SHELL');
  });

  it('parses CSV with custom delimiters and Brazilian currency formats', () => {
    const csvContent = `Data;Descricao;Valor
01/09/2026;IFOOD PEDIDO 111;-45,50
02/09/2026;UBER TRIP 222;-22,00
03/09/2026;SALARIO EMPRESA;5.200,00`;

    const parsed = service.parseCSV(csvContent);
    expect(parsed.delimiter).toBe(';');
    expect(parsed.items.length).toBe(3);

    expect(parsed.items[0].description).toBe('IFOOD PEDIDO 111');
    expect(parsed.items[0].origin).toBe('IFOOD');
    expect(parsed.items[0].amount).toBe(4550); // R$ 45,50 in cents
    expect(parsed.items[0].type).toBe('expense');

    expect(parsed.items[2].amount).toBe(520000); // R$ 5.200,00 in cents
    expect(parsed.items[2].type).toBe('income');
  });

  it('reconciles, groups by origin and learns auto-categorization rules', () => {
    const acc = service.createAccount({ name: 'Conta Corrente', initialBalance: 100000 });
    const catAlimentacao = service.createCategory({ name: 'Alimentação', type: 'expense' });

    // Raw items with variable order numbers from same merchant
    const rawItems = [
      {
        id: '1',
        transactionDate: '2026-09-10',
        description: 'IFOOD PEDIDO 12345',
        amount: 5000,
        type: 'expense',
      },
      {
        id: '2',
        transactionDate: '2026-09-11',
        description: 'IFOOD PEDIDO 67891',
        amount: 3500,
        type: 'expense',
      },
      {
        id: '3',
        transactionDate: '2026-09-12',
        description: 'CARREFOUR LOJA 09',
        amount: 15000,
        type: 'expense',
      },
    ];

    const reconciled = service.reconcileImport({ accountId: acc.id, items: rawItems });
    expect(reconciled.groups.length).toBe(2); // IFOOD and CARREFOUR

    const ifoodGroup = reconciled.groups.find((g: any) => g.origin === 'IFOOD');
    expect(ifoodGroup).toBeDefined();
    expect(ifoodGroup.count).toBe(2);
    expect(ifoodGroup.totalAmount).toBe(8500); // 50,00 + 35,00 = 85,00

    // Original descriptions preserved!
    expect(ifoodGroup.items[0].originalDescription).toBe('IFOOD PEDIDO 12345');
    expect(ifoodGroup.items[1].originalDescription).toBe('IFOOD PEDIDO 67891');

    // Simulate user applying category Alimentação to IFOOD group and importing
    const itemsToImport = reconciled.items.map((i: any) =>
      i.origin === 'IFOOD' ? { ...i, categoryId: catAlimentacao.id } : i
    );

    const importRes = service.batchImportTransactions({
      accountId: acc.id,
      items: itemsToImport,
      saveRules: true,
    });

    expect(importRes.count).toBe(3);

    // Verify learned rule is persisted in database
    const rules = service.getImportRules();
    const learnedRule = rules.find((r: any) => r.pattern === 'IFOOD');
    expect(learnedRule).toBeDefined();
    expect(learnedRule.categoryId).toBe(catAlimentacao.id);

    // On next import with a brand new iFood order number, it auto-categorizes with high confidence!
    const nextImport = [
      {
        id: '4',
        transactionDate: '2026-09-15',
        description: 'IFOOD PEDIDO 999999',
        amount: 6000,
        type: 'expense',
      },
    ];

    const nextReconciled = service.reconcileImport({ accountId: acc.id, items: nextImport });
    expect(nextReconciled.items[0].categoryId).toBe(catAlimentacao.id);
    expect(nextReconciled.items[0].isAutoCategorized).toBe(true);
  });

  it('detects duplicates accurately using FITID (OFX) and composite key (CSV)', () => {
    const acc = service.createAccount({ name: 'Conta Inter', initialBalance: 50000 });

    // 1. Insert an existing transaction with fit_id
    service.createTransaction({
      accountId: acc.id,
      type: 'expense',
      description: 'Compra Mercado Teste',
      amount: 4500,
      transactionDate: '2026-09-10',
      status: 'completed',
      fitId: 'FIT-123456789',
    });

    // 2. Reconcile OFX item with same FITID
    const ofxItems = [
      {
        id: 'item-1',
        fitId: 'FIT-123456789',
        transactionDate: '2026-09-10',
        description: 'Compra Mercado Teste',
        amount: 4500,
        type: 'expense',
      },
      {
        id: 'item-2',
        fitId: 'FIT-999999999',
        transactionDate: '2026-09-11',
        description: 'Nova Compra',
        amount: 2500,
        type: 'expense',
      },
    ];

    const res = service.reconcileImport({ accountId: acc.id, items: ofxItems });
    expect(res.stats.duplicateCount).toBe(1);
    expect(res.items[0].isDuplicate).toBe(true);
    expect(res.items[1].isDuplicate).toBe(false);
  });

  it('adjusts account balance correctly with positive and negative adjustment transactions', () => {
    // 1. Initial balance R$ 1.000,00 (100000 cents)
    const acc = service.createAccount({ name: 'Conta Ajuste Teste', initialBalance: 100000 });
    expect(acc.currentBalance).toBe(100000);

    // 2. Real balance is R$ 1.500,00 (150000 cents) -> diff = +50000 (Receita de Ajuste)
    const resPositive = service.adjustAccountBalance({
      accountId: acc.id,
      targetBalance: 150000,
      adjustmentDate: '2026-09-13',
      mode: 'transaction',
    });

    expect(resPositive.success).toBe(true);
    expect(resPositive.diff).toBe(50000);
    expect(resPositive.transaction.type).toBe('income');
    expect(resPositive.transaction.amount).toBe(50000);
    expect(resPositive.account.currentBalance).toBe(150000);

    // 3. Next day, real balance is R$ 1.200,00 (120000 cents) -> diff = -30000 (Despesa de Ajuste)
    const resNegative = service.adjustAccountBalance({
      accountId: acc.id,
      targetBalance: 120000,
      adjustmentDate: '2026-09-14',
      mode: 'transaction',
    });

    expect(resNegative.success).toBe(true);
    expect(resNegative.diff).toBe(-30000);
    expect(resNegative.transaction.type).toBe('expense');
    expect(resNegative.transaction.amount).toBe(30000);
    expect(resNegative.account.currentBalance).toBe(120000);

    // 4. Test adjust via initial_balance mode
    const resInitial = service.adjustAccountBalance({
      accountId: acc.id,
      targetBalance: 200000, // Wants 2.000,00
      mode: 'initial_balance',
    });
    expect(resInitial.success).toBe(true);
    expect(resInitial.account.currentBalance).toBe(200000);
  });

  it('moves transactions in batch from one account to another and updates balances', () => {
    const accA = service.createAccount({ name: 'Conta Origem A', initialBalance: 50000 });
    const accB = service.createAccount({ name: 'Conta Destino B', initialBalance: 10000 });

    const tx1 = service.createTransaction({
      accountId: accA.id,
      type: 'expense',
      description: 'Gasto 1',
      amount: 15000,
      transactionDate: '2026-09-10',
      status: 'completed',
    });
    const tx2 = service.createTransaction({
      accountId: accA.id,
      type: 'income',
      description: 'Receita 1',
      amount: 25000,
      transactionDate: '2026-09-11',
      status: 'completed',
    });

    // Before move:
    // accA: 50000 - 15000 + 25000 = 60000
    // accB: 10000
    expect(service.getAccountById(accA.id).currentBalance).toBe(60000);
    expect(service.getAccountById(accB.id).currentBalance).toBe(10000);

    // Move tx1 and tx2 from accA to accB
    const moveResult = service.batchMoveTransactions({
      transactionIds: [tx1.id, tx2.id],
      targetAccountId: accB.id,
      targetType: 'account',
    });

    expect(moveResult.success).toBe(true);
    expect(moveResult.updatedCount).toBe(2);

    // After move:
    // accA: 50000 (only initial balance remains)
    // accB: 10000 - 15000 + 25000 = 20000
    expect(service.getAccountById(accA.id).currentBalance).toBe(50000);
    expect(service.getAccountById(accB.id).currentBalance).toBe(20000);
  });

  it('tracks imported statements and allows reassigning destination account or deleting statement transactions', () => {
    const itau = service.createAccount({ name: 'Itaú Corrente', initialBalance: 100000 });
    const bradesco = service.createAccount({ name: 'Bradesco Corrente', initialBalance: 50000 });

    // 1. Save statement record
    const statement = service.saveImportedStatement({
      originalName: 'extrato_setembro.ofx',
      fileType: 'ofx',
      content: 'OFXHEADER:100\n<OFX>fake content</OFX>',
      accountId: itau.id,
      itemsCount: 2,
    });
    expect(statement.id).toBeDefined();

    // 2. Batch import transactions attached to this statement
    const importResult = service.batchImportTransactions({
      accountId: itau.id,
      isCreditCard: false,
      items: [
        {
          type: 'expense',
          description: 'Compra Mercado',
          amount: 20000,
          transactionDate: '2026-09-02',
          fitId: 'FITID-001',
        },
        {
          type: 'income',
          description: 'Recebimento Pix',
          amount: 30000,
          transactionDate: '2026-09-03',
          fitId: 'FITID-002',
        },
      ],
      statementId: statement.id,
    });

    expect(importResult.count).toBe(2);

    // Initial check: Itaú balance = 100000 - 20000 + 30000 = 110000
    expect(service.getAccountById(itau.id).currentBalance).toBe(110000);
    expect(service.getAccountById(bradesco.id).currentBalance).toBe(50000);

    // 3. Verify getTransactions returns statement info
    const statementTxs = service.getTransactions({ statementId: statement.id });
    expect(statementTxs.length).toBe(2);
    expect(statementTxs[0].statementOriginalName).toBe('extrato_setembro.ofx');

    // 4. Reassign statement from Itaú to Bradesco
    const reassignRes = service.reassignStatementAccount({
      statementId: statement.id,
      targetAccountId: bradesco.id,
      targetType: 'account',
    });
    expect(reassignRes.success).toBe(true);
    expect(reassignRes.updatedCount).toBe(2);

    // After reassign:
    // Itaú balance back to initial: 100000
    // Bradesco balance: 50000 - 20000 + 30000 = 60000
    expect(service.getAccountById(itau.id).currentBalance).toBe(100000);
    expect(service.getAccountById(bradesco.id).currentBalance).toBe(60000);

    // 5. Delete statement transactions (undo import)
    const deleteRes = service.deleteStatementTransactions(statement.id);
    expect(deleteRes.success).toBe(true);
    expect(deleteRes.deletedCount).toBe(2);

    // After deletion:
    // Bradesco balance back to initial: 50000
    expect(service.getAccountById(bradesco.id).currentBalance).toBe(50000);
    expect(service.getTransactions({ statementId: statement.id }).length).toBe(0);
  });
});
