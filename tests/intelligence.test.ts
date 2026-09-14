import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { FinancialIntelligenceEngine, tokenizeText, cleanMerchantName } from '../electron/intelligenceEngine.cjs';
import { getFinancialService } from '../electron/services.cjs';

describe('FinancialIntelligenceEngine (100% Offline Local AI)', () => {
  let db: any;
  let service: any;
  let engine: FinancialIntelligenceEngine;

  beforeEach(() => {
    db = initDatabase(':memory:');
    service = getFinancialService(db);
    engine = new FinancialIntelligenceEngine(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('tokenizes text and extracts clean merchant names properly', () => {
    const raw = 'PAG* IFOOD 1234 SP BRASIL';
    const tokens = tokenizeText(raw);
    expect(tokens).toContain('IFOOD');

    const clean = cleanMerchantName('COMPRA CARTAO NETFLIX COM BR');
    expect(clean).toContain('NETFLIX');
  });

  it('calculates financial health score with all 5 pillars', () => {
    const acc = service.createAccount({
      name: 'Conta Corrente',
      type: 'checking',
      initialBalance: 500000, // R$ 5.000,00
    });

    const catSalario = service.createCategory({ name: 'Salário', type: 'income' });
    const catAlimentacao = service.createCategory({ name: 'Alimentação', type: 'expense' });

    // Income: R$ 4.000,00
    service.createTransaction({
      accountId: acc.id,
      categoryId: catSalario.id,
      type: 'income',
      description: 'Salário Empresa',
      amount: 400000,
      transactionDate: '2026-09-05',
      status: 'completed',
    });

    // Expense: R$ 1.500,00
    service.createTransaction({
      accountId: acc.id,
      categoryId: catAlimentacao.id,
      type: 'expense',
      description: 'Supermercado',
      amount: 150000,
      transactionDate: '2026-09-10',
      status: 'completed',
    });

    const health = engine.getFinancialHealthScore('2026-09-14');
    expect(health.score).toBeGreaterThanOrEqual(60);
    expect(health.pillars).toHaveLength(5);
    expect(['Excelente', 'Boa']).toContain(health.classification);
  });

  it('projects balance forecast and identifies positive cash flow', () => {
    const acc = service.createAccount({
      name: 'Banco Digital',
      type: 'checking',
      initialBalance: 200000, // R$ 2.000,00
    });

    // Create recurring monthly income of R$ 3.000,00 on day 5
    service.createRecurringRule({
      accountId: acc.id,
      type: 'income',
      description: 'Salário Mensal',
      amount: 300000,
      frequency: 'monthly',
      billingDay: 5,
      startDate: '2026-09-01',
    });

    // Create recurring monthly rent of R$ 1.200,00 on day 10
    service.createRecurringRule({
      accountId: acc.id,
      type: 'expense',
      description: 'Aluguel',
      amount: 120000,
      frequency: 'monthly',
      billingDay: 10,
      startDate: '2026-09-01',
    });

    const forecast = engine.getBalanceForecast(60);
    expect(forecast.daysAhead).toBe(60);
    expect(forecast.currentBalance).toBe(200000);
    expect(forecast.dailyTrajectory.length).toBeGreaterThan(50);
    expect(forecast.finalBalance).toBeGreaterThan(forecast.currentBalance);
  });

  it('detects statistical anomalies and duplicate charges', () => {
    const acc = service.createAccount({ name: 'Conta Principal', type: 'checking', initialBalance: 1000000 });
    const cat = service.createCategory({ name: 'Farmácia', type: 'expense' });

    // Normal transactions: around R$ 40 - 60
    for (let i = 1; i <= 6; i++) {
      service.createTransaction({
        accountId: acc.id,
        categoryId: cat.id,
        type: 'expense',
        description: `Farmácia Compra ${i}`,
        amount: 4500 + i * 200,
        transactionDate: `2026-09-0${i}`,
        status: 'completed',
      });
    }

    // Extreme outlier: R$ 950,00 (95000 cents)
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Farmácia Compra Medicamento Especial',
      amount: 95000,
      transactionDate: '2026-09-12',
      status: 'completed',
    });

    // Duplicate charge within 24h: 2x R$ 39,90
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Drogaria Duplicada',
      amount: 3990,
      transactionDate: '2026-09-13',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Drogaria Duplicada',
      amount: 3990,
      transactionDate: '2026-09-14',
      status: 'completed',
    });

    const anomalies = engine.detectAnomalies(6);
    expect(anomalies.length).toBeGreaterThanOrEqual(2);

    const dup = anomalies.find(a => a.anomalyType === 'duplicate_charge');
    expect(dup).toBeDefined();

    const outlier = anomalies.find(a => a.anomalyType === 'statistical_outlier');
    expect(outlier).toBeDefined();
    expect(outlier?.amount).toBe(95000);
  });

  it('suggests category intelligently based on tokens and rules', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 100000 });
    const cat = service.createCategory({ name: 'Transporte', type: 'expense' });

    // Add historical transactions for UBER
    service.createTransaction({
      accountId: acc.id,
      type: 'expense',
      categoryId: cat.id,
      description: 'UBER *TRIP RIO',
      amount: 2500,
      transactionDate: '2026-09-01',
      status: 'completed',
    });

    const suggestion = engine.suggestCategory('UBER TRIP SÃO PAULO');
    expect(suggestion).not.toBeNull();
    expect(suggestion?.categoryName).toBe('Transporte');
    expect(suggestion?.confidence).toBeGreaterThan(60);
  });

  it('detects recurring subscription candidates automatically', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 500000 });
    const cat = service.createCategory({ name: 'Serviços Online', type: 'expense' });

    // Monthly subscription: Spotify R$ 21,90 for 3 consecutive months
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-07-10',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-08-10',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-09-10',
      status: 'completed',
    });

    const candidates = engine.detectRecurringPatterns();
    expect(candidates.length).toBeGreaterThanOrEqual(1);

    const spotify = candidates.find(c => c.cleanDescription.includes('SPOTIFY'));
    expect(spotify).toBeDefined();
    expect(spotify?.suggestedFrequency).toBe('monthly');
    expect(spotify?.averageAmount).toBe(2190);

    // Convert candidate to recurring rule
    const res = engine.convertCandidateToRecurring(spotify);
    expect(res.success).toBe(true);

    const rules = service.getRecurringRules();
    expect(rules.some((r: any) => r.id === res.id)).toBe(true);
  });

  it('generates monthly closeout summary with MoM comparisons', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 500000 });
    const catAluguel = service.createCategory({ name: 'Moradia', type: 'expense' });
    const catSalario = service.createCategory({ name: 'Salário', type: 'income' });

    service.createTransaction({
      accountId: acc.id,
      categoryId: catSalario.id,
      type: 'income',
      description: 'Salário',
      amount: 500000,
      transactionDate: '2026-09-05',
      status: 'completed',
    });

    service.createTransaction({
      accountId: acc.id,
      categoryId: catAluguel.id,
      type: 'expense',
      description: 'Aluguel Apartamento',
      amount: 180000,
      transactionDate: '2026-09-08',
      status: 'completed',
    });

    const closeout = engine.getMonthlyCloseout('2026-09');
    expect(closeout.incomeTotal).toBe(500000);
    expect(closeout.expenseTotal).toBe(180000);
    expect(closeout.savedAmount).toBe(320000);
    expect(closeout.savingsRate).toBe(64);
    expect(closeout.topCategories[0].name).toBe('Moradia');
    expect(closeout.achievements.length).toBeGreaterThan(0);
  });
});
