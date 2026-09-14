/**
 * Financial Intelligence Engine (100% Local & Offline)
 * 
 * Centraliza toda a modelagem matemática, estatística determinística (IQR, Z-Score,
 * médias móveis, análise de séries temporais) e mineração de padrões de texto
 * para fornecer inteligência financeira sem requisições externas ou APIs.
 */

// Helper functions for date arithmetic
function parseDate(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function addMonthsToKey(monthKey, deltaMonths) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Statistical helper functions
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

function stdDev(arr, arrMean = null) {
  if (!arr || arr.length <= 1) return 0;
  const m = arrMean !== null ? arrMean : mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function median(sortedArr) {
  return percentile(sortedArr, 50);
}

// Text normalization & tokenization for category prediction and merchant pattern matching
const STOP_WORDS = new Set([
  'LTDA', 'SA', 'S/A', 'ME', 'EPP', 'PAG', 'PG', 'PAGAMENTO', 'PAGTO', 'PAGAMENTOS',
  'COMPRA', 'DEB', 'CRE', 'DOC', 'TED', 'PIX', 'TRANSF', 'TRANSFERENCIA', 'ENVIO',
  'RECEBIMENTO', 'CARTAO', 'ELO', 'VISA', 'MASTERCARD', 'MASTER', 'HIPERCARD',
  'ESTABELECIMENTO', 'MERCADO', 'LOJA', 'COMERCIO', 'SERVICOS', 'BRASIL', 'BR',
  'ONLINE', 'APP', 'PAY', 'PAYMENT', 'INTERNET', 'AUTOMATICO', 'DEBITO', 'CREDITO',
  'BANCO', 'FINANCEIRA', 'OPERACAO', 'VALOR', 'REF', 'PARC', 'PARCELA'
]);

function tokenizeText(text) {
  if (!text) return [];
  // Remove accents and special characters
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ');

  // Split and filter tokens
  const rawTokens = normalized.split(/\s+/).filter(t => t.length >= 3 && !/^\d+$/.test(t));
  return rawTokens.filter(t => !STOP_WORDS.has(t));
}

function cleanMerchantName(rawText) {
  if (!rawText) return '';
  let cleaned = rawText
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(PIX|PAG\*|PG\*|COMPRA CARTAO|PAGTO|TED|DOC|PARC\s*\d+\/\d+)/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  // Compress multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Remove known stop words at boundaries
  const words = cleaned.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(' ') || rawText.trim().toUpperCase();
}

class FinancialIntelligenceEngine {
  constructor(db) {
    this.db = db;
  }

  // ==========================================
  // 1. SAÚDE FINANCEIRA (0 a 100)
  // ==========================================
  getFinancialHealthScore(targetDate = null) {
    const today = targetDate || new Date().toISOString().slice(0, 10);
    const currentMonthKey = getMonthKey(today);
    const prevMonthKey = addMonthsToKey(currentMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(currentMonthKey, -2);

    // 1.1 Income & Expense stats (last 3 months rolling average)
    const windowMonths = [currentMonthKey, prevMonthKey, prev2MonthKey];
    const placeholders = windowMonths.map(() => '?').join(',');

    const incomeRows = this.db.prepare(`
      SELECT strftime('%Y-%m', transaction_date) as month_key, SUM(amount) as total
      FROM transactions
      WHERE type = 'income' AND status = 'completed'
        AND strftime('%Y-%m', transaction_date) IN (${placeholders})
      GROUP BY strftime('%Y-%m', transaction_date)
    `).all(...windowMonths);

    const expenseRows = this.db.prepare(`
      SELECT 
        COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) as month_key,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) IN (${placeholders})
      GROUP BY month_key
    `).all(...windowMonths);

    const totalIncome3m = incomeRows.reduce((sum, r) => sum + r.total, 0);
    const totalExpense3m = expenseRows.reduce((sum, r) => sum + r.total, 0);
    const avgMonthlyIncome = Math.round(totalIncome3m / (incomeRows.length || 1));
    const avgMonthlyExpense = Math.round(totalExpense3m / (expenseRows.length || 1));

    // Current month specific
    const curIncome = incomeRows.find(r => r.month_key === currentMonthKey)?.total || 0;
    const curExpense = expenseRows.find(r => r.month_key === currentMonthKey)?.total || 0;
    const effectiveIncome = curIncome > 0 ? curIncome : avgMonthlyIncome;
    const effectiveExpense = curExpense > 0 ? curExpense : avgMonthlyExpense;

    // --- PILAR 1: Capacidade de Poupança (0 a 30 pts) ---
    let savingsScore = 15;
    let savingsRate = 0;
    let savingsDiagnostic = '';

    if (effectiveIncome > 0) {
      savingsRate = (effectiveIncome - effectiveExpense) / effectiveIncome;
      if (savingsRate >= 0.25) {
        savingsScore = 30;
        savingsDiagnostic = `Excelente taxa de poupança (${(savingsRate * 100).toFixed(0)}%). Você guarda mais de 25% da renda.`;
      } else if (savingsRate >= 0.15) {
        savingsScore = 24 + Math.round(((savingsRate - 0.15) / 0.10) * 5);
        savingsDiagnostic = `Boa capacidade de poupança (${(savingsRate * 100).toFixed(0)}%). Continue acumulando.`;
      } else if (savingsRate >= 0.05) {
        savingsScore = 16 + Math.round(((savingsRate - 0.05) / 0.10) * 7);
        savingsDiagnostic = `Taxa de economia moderada (${(savingsRate * 100).toFixed(0)}%). Tente cortar pequenos supérfluos para atingir 15%.`;
      } else if (savingsRate >= 0) {
        savingsScore = 10 + Math.round((savingsRate / 0.05) * 5);
        savingsDiagnostic = `Sua margem de economia está muito apertada (${(savingsRate * 100).toFixed(0)}%).`;
      } else {
        // Déficit
        const deficitPercent = Math.min(0.5, Math.abs(savingsRate));
        savingsScore = Math.max(0, Math.round(10 - (deficitPercent / 0.5) * 10));
        savingsDiagnostic = `Atenção: Gastos superaram a renda no período em ${(Math.abs(savingsRate) * 100).toFixed(0)}%. Risco de endividamento.`;
      }
    } else {
      savingsScore = effectiveExpense === 0 ? 15 : 5;
      savingsDiagnostic = 'Pouca movimentação de receitas registrada para cálculo preciso.';
    }

    // --- PILAR 2: Custos Fixos & Recorrentes (0 a 25 pts) ---
    const recurringExpenses = this.db.prepare(`
      SELECT SUM(amount) as total
      FROM recurring_rules
      WHERE type = 'expense' AND active = 1
    `).get().total || 0;

    let recurringScore = 20;
    let recurringDiagnostic = '';
    const referenceIncome = effectiveIncome > 0 ? effectiveIncome : 300000; // default 3k base if empty
    const recurringRatio = recurringExpenses / referenceIncome;

    if (recurringExpenses === 0) {
      recurringScore = 22;
      recurringDiagnostic = 'Sem despesas recorrentes cadastradas ou comprometimento mínimo.';
    } else if (recurringRatio <= 0.35) {
      recurringScore = 25;
      recurringDiagnostic = `Custos fixos sob controle (${(recurringRatio * 100).toFixed(0)}% da renda). Excelente flexibilidade orçamentária.`;
    } else if (recurringRatio <= 0.50) {
      recurringScore = 19 + Math.round(((0.50 - recurringRatio) / 0.15) * 5);
      recurringDiagnostic = `Custos fixos saudáveis (${(recurringRatio * 100).toFixed(0)}% da renda), dentro do limite recomendado de 50%.`;
    } else if (recurringRatio <= 0.70) {
      recurringScore = 10 + Math.round(((0.70 - recurringRatio) / 0.20) * 8);
      recurringDiagnostic = `Comprometimento alto (${(recurringRatio * 100).toFixed(0)}% da renda com fixos). Sobra pouco espaço para imprevistos.`;
    } else {
      recurringScore = Math.max(0, Math.round(10 - ((recurringRatio - 0.70) / 0.30) * 10));
      recurringDiagnostic = `Alerta Crítico: ${(recurringRatio * 100).toFixed(0)}% da sua renda está engessada em contas fixas e assinaturas.`;
    }

    // --- PILAR 3: Endividamento & Cartões de Crédito (0 a 20 pts) ---
    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();
    let debtScore = 20;
    let debtDiagnostic = '';

    if (cards.length === 0) {
      debtScore = 20;
      debtDiagnostic = 'Sem faturas de cartão de crédito ativas.';
    } else {
      const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
      const pendingInvoices = this.db.prepare(`
        SELECT SUM(amount) as total
        FROM transactions
        WHERE credit_card_id IS NOT NULL
          AND status != 'cancelled'
          AND status != 'paid'
      `).get().total || 0;

      const limitUtilization = totalLimit > 0 ? (pendingInvoices / totalLimit) : 0;

      if (limitUtilization <= 0.20) {
        debtScore = 20;
        debtDiagnostic = `Uso inteligente do crédito (${(limitUtilization * 100).toFixed(0)}% do limite utilizado).`;
      } else if (limitUtilization <= 0.40) {
        debtScore = 16 + Math.round(((0.40 - limitUtilization) / 0.20) * 3);
        debtDiagnostic = `Utilização equilibrada do cartão (${(limitUtilization * 100).toFixed(0)}% do limite).`;
      } else if (limitUtilization <= 0.65) {
        debtScore = 10 + Math.round(((0.65 - limitUtilization) / 0.25) * 5);
        debtDiagnostic = `Atenção: ${(limitUtilization * 100).toFixed(0)}% do limite do cartão está comprometido. Evite novos parcelamentos.`;
      } else {
        debtScore = Math.max(0, Math.round(9 - ((limitUtilization - 0.65) / 0.35) * 9));
        debtDiagnostic = `Alerta: ${(limitUtilization * 100).toFixed(0)}% do limite utilizado. Alto risco de juros e comprometimento de fluxo.`;
      }
    }

    // --- PILAR 4: Cobertura de Reserva de Emergência (0 a 15 pts) ---
    const accounts = this.db.prepare(`SELECT id, initial_balance, type FROM accounts WHERE active = 1`).all();
    let totalLiquidBalance = 0;

    for (const acc of accounts) {
      const inc = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'income' AND status = 'completed'
      `).get(acc.id).s;

      const exp = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type IN ('expense', 'card_payment') AND status = 'completed'
      `).get(acc.id).s;

      const transfOut = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      const transfIn = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE destination_account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      totalLiquidBalance += (acc.initial_balance + inc + transfIn - exp - transfOut);
    }

    let reserveScore = 8;
    let reserveMonths = 0;
    let reserveDiagnostic = '';
    const monthlyBurnRate = avgMonthlyExpense > 0 ? avgMonthlyExpense : (effectiveExpense > 0 ? effectiveExpense : 200000);

    if (totalLiquidBalance < 0) {
      reserveScore = 0;
      reserveMonths = 0;
      reserveDiagnostic = 'Saldo líquido total negativo. Priorize a regularização de saldos devedores.';
    } else {
      reserveMonths = totalLiquidBalance / monthlyBurnRate;
      if (reserveMonths >= 6) {
        reserveScore = 15;
        reserveDiagnostic = `Excelente reserva (${reserveMonths.toFixed(1)} meses de despesas cobertas). Você tem segurança financeira sólida.`;
      } else if (reserveMonths >= 3) {
        reserveScore = 11 + Math.round(((reserveMonths - 3) / 3) * 3);
        reserveDiagnostic = `Boa reserva (${reserveMonths.toFixed(1)} meses de custos). Continue aportando para chegar a 6 meses.`;
      } else if (reserveMonths >= 1) {
        reserveScore = 6 + Math.round(((reserveMonths - 1) / 2) * 4);
        reserveDiagnostic = `Reserva inicial (${reserveMonths.toFixed(1)} mês de cobertura). Recomenda-se aumentar a margem de segurança.`;
      } else {
        reserveScore = Math.max(1, Math.round(reserveMonths * 5));
        reserveDiagnostic = `Reserva crítica (cobre apenas ${(reserveMonths * 30).toFixed(0)} dias de despesas). Qualquer imprevisto exigirá crédito.`;
      }
    }

    // --- PILAR 5: Disciplina Orçamentária (0 a 10 pts) ---
    const budgets = this.db.prepare(`SELECT * FROM category_budgets`).all();
    let budgetScore = 8;
    let budgetDiagnostic = '';

    if (budgets.length === 0) {
      budgetScore = 8;
      budgetDiagnostic = 'Sem tetos de gastos cadastrados por categoria. Definir orçamentos ajuda a controlar despesas.';
    } else {
      let withinBudgetCount = 0;
      for (const b of budgets) {
        const spent = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE category_id = ? AND type = 'expense' AND status != 'cancelled'
            AND (
              (credit_card_id IS NULL AND transaction_date >= '${currentMonthKey}-01' AND transaction_date <= '${currentMonthKey}-31')
              OR (credit_card_id IS NOT NULL AND invoice_month = '${currentMonthKey}')
            )
        `).get(b.category_id).total;

        if (spent <= b.amount_limit) {
          withinBudgetCount++;
        }
      }

      const complianceRatio = withinBudgetCount / budgets.length;
      budgetScore = Math.round(complianceRatio * 10);
      budgetDiagnostic = `${withinBudgetCount} de ${budgets.length} categorias orçadas estão dentro do teto estipulado (${(complianceRatio * 100).toFixed(0)}%).`;
    }

    // Total Overall Score (0 to 100)
    const totalScore = Math.min(100, Math.max(0, savingsScore + recurringScore + debtScore + reserveScore + budgetScore));

    let classification = 'Atenção';
    let color = '#f59e0b';
    let message = 'Sua saúde financeira requer cuidados com despesas e reservas.';

    if (totalScore >= 80) {
      classification = 'Excelente';
      color = '#10b981';
      message = 'Parabéns! Suas finanças estão muito bem estruturadas, com poupança e reservas sólidas.';
    } else if (totalScore >= 65) {
      classification = 'Boa';
      color = '#3b82f6';
      message = 'Sua situação é estável e equilibrada. Pequenos ajustes podem acelerar a formação de patrimônio.';
    } else if (totalScore >= 45) {
      classification = 'Atenção';
      color = '#f59e0b';
      message = 'Alerta moderado: seus custos fixos ou gastos estão próximos da sua capacidade de renda.';
    } else {
      classification = 'Crítica';
      color = '#ef4444';
      message = 'Alerta máximo: há desequilíbrio entre receitas, despesas e faturas. Risco de endividamento.';
    }

    return {
      score: totalScore,
      classification,
      color,
      message,
      calculatedAt: today,
      metrics: {
        effectiveIncome,
        effectiveExpense,
        savingsRate: Math.round(savingsRate * 100),
        recurringTotal: recurringExpenses,
        totalLiquidBalance,
        reserveCoverageMonths: Number(reserveMonths.toFixed(1)),
      },
      pillars: [
        {
          id: 'savings',
          name: 'Capacidade de Poupança',
          score: savingsScore,
          maxScore: 30,
          weight: 30,
          status: savingsScore >= 24 ? 'excellent' : savingsScore >= 16 ? 'good' : 'warning',
          diagnostic: savingsDiagnostic,
        },
        {
          id: 'recurring',
          name: 'Custos Fixos & Recorrentes',
          score: recurringScore,
          maxScore: 25,
          weight: 25,
          status: recurringScore >= 20 ? 'excellent' : recurringScore >= 14 ? 'good' : 'warning',
          diagnostic: recurringDiagnostic,
        },
        {
          id: 'debt',
          name: 'Endividamento & Cartões',
          score: debtScore,
          maxScore: 20,
          weight: 20,
          status: debtScore >= 16 ? 'excellent' : debtScore >= 10 ? 'good' : 'warning',
          diagnostic: debtDiagnostic,
        },
        {
          id: 'reserve',
          name: 'Reserva de Emergência',
          score: reserveScore,
          maxScore: 15,
          weight: 15,
          status: reserveScore >= 12 ? 'excellent' : reserveScore >= 8 ? 'good' : 'warning',
          diagnostic: reserveDiagnostic,
        },
        {
          id: 'discipline',
          name: 'Disciplina Orçamentária',
          score: budgetScore,
          maxScore: 10,
          weight: 10,
          status: budgetScore >= 8 ? 'excellent' : budgetScore >= 5 ? 'good' : 'warning',
          diagnostic: budgetDiagnostic,
        },
      ],
    };
  }

  // ==========================================
  // 2. PREVISÃO DE SALDO (30, 60, 90 DIAS)
  // ==========================================
  getBalanceForecast(daysAhead = 90) {
    const today = new Date().toISOString().slice(0, 10);
    const endDate = addDays(today, daysAhead);

    // 2.1 Calculate current total liquid balance
    const accounts = this.db.prepare(`SELECT id, initial_balance FROM accounts WHERE active = 1`).all();
    let currentTotalBalance = 0;

    for (const acc of accounts) {
      const inc = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'income' AND status = 'completed'
      `).get(acc.id).s;

      const exp = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type IN ('expense', 'card_payment') AND status = 'completed'
      `).get(acc.id).s;

      const transfOut = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      const transfIn = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE destination_account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      currentTotalBalance += (acc.initial_balance + inc + transfIn - exp - transfOut);
    }

    // 2.2 Pending one-time transactions scheduled in accounts
    const scheduledTxs = this.db.prepare(`
      SELECT transaction_date, type, amount, description
      FROM transactions
      WHERE status = 'pending'
        AND transaction_date >= ?
        AND transaction_date <= ?
        AND account_id IS NOT NULL
        AND credit_card_id IS NULL
      ORDER BY transaction_date ASC
    `).all(today, endDate);

    // 2.3 Active recurring rules
    const recurringRules = this.db.prepare(`
      SELECT * FROM recurring_rules WHERE active = 1
    `).all();

    // 2.4 Credit cards with due dates and their projected invoice amounts
    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();

    // Map of events by date
    const eventsByDate = new Map();
    const addEvent = (dateStr, event) => {
      if (!eventsByDate.has(dateStr)) {
        eventsByDate.set(dateStr, []);
      }
      eventsByDate.get(dateStr).push(event);
    };

    // Populate scheduled transactions
    for (const tx of scheduledTxs) {
      addEvent(tx.transaction_date, {
        title: tx.description,
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
        type: tx.type,
      });
    }

    // Project recurring rules across the daysAhead window
    const todayParsed = parseDate(today);
    const endParsed = parseDate(endDate);

    for (const rule of recurringRules) {
      if (rule.frequency === 'monthly') {
        const billingDay = rule.billing_day || parseDate(rule.start_date).getDate();
        let cur = new Date(todayParsed.getFullYear(), todayParsed.getMonth(), billingDay);
        if (cur < todayParsed) {
          cur = new Date(todayParsed.getFullYear(), todayParsed.getMonth() + 1, billingDay);
        }

        while (cur <= endParsed) {
          const dStr = formatDate(cur);
          if (dStr >= today && dStr <= endDate) {
            addEvent(dStr, {
              title: `(Recorrente) ${rule.description}`,
              amount: rule.type === 'income' ? rule.amount : -rule.amount,
              type: rule.type === 'income' ? 'income' : 'expense',
            });
          }
          cur = new Date(cur.getFullYear(), cur.getMonth() + 1, billingDay);
        }
      } else if (rule.frequency === 'weekly') {
        let cur = parseDate(rule.next_due_date || rule.start_date);
        while (cur < todayParsed) {
          cur.setDate(cur.getDate() + 7);
        }
        while (cur <= endParsed) {
          const dStr = formatDate(cur);
          if (dStr >= today && dStr <= endDate) {
            addEvent(dStr, {
              title: `(Semanal) ${rule.description}`,
              amount: rule.type === 'income' ? rule.amount : -rule.amount,
              type: rule.type === 'income' ? 'income' : 'expense',
            });
          }
          cur.setDate(cur.getDate() + 7);
        }
      }
    }

    // Project credit card invoice payments on their due_days
    for (const card of cards) {
      const monthsSpan = Math.ceil(daysAhead / 30) + 1;
      let monthCursor = getMonthKey(today);

      for (let i = 0; i < monthsSpan; i++) {
        const invoiceTotal = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE credit_card_id = ?
            AND invoice_month = ?
            AND status != 'cancelled'
            AND status != 'paid'
        `).get(card.id, monthCursor).total;

        if (invoiceTotal > 0) {
          const [yr, mo] = monthCursor.split('-').map(Number);
          const maxDays = new Date(yr, mo, 0).getDate();
          const dueDayValid = Math.min(card.due_day, maxDays);
          const dueDateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(dueDayValid).padStart(2, '0')}`;

          if (dueDateStr >= today && dueDateStr <= endDate) {
            addEvent(dueDateStr, {
              title: `Fatura ${card.name} (${monthCursor})`,
              amount: -invoiceTotal,
              type: 'card_invoice',
            });
          }
        }

        monthCursor = addMonthsToKey(monthCursor, 1);
      }
    }

    // Construct day-by-day trajectory
    const dailyTrajectory = [];
    let runningBalance = currentTotalBalance;
    let minBalance = currentTotalBalance;
    let minBalanceDate = today;
    let maxBalance = currentTotalBalance;
    let alertUnderZero = false;
    let firstNegativeDate = null;

    let dayCursor = new Date(todayParsed);
    while (dayCursor <= endParsed) {
      const dStr = formatDate(dayCursor);
      const dayEvents = eventsByDate.get(dStr) || [];

      let dayDelta = 0;
      for (const ev of dayEvents) {
        dayDelta += ev.amount;
      }

      runningBalance += dayDelta;

      if (runningBalance < minBalance) {
        minBalance = runningBalance;
        minBalanceDate = dStr;
      }
      if (runningBalance > maxBalance) {
        maxBalance = runningBalance;
      }
      if (runningBalance < 0 && !alertUnderZero) {
        alertUnderZero = true;
        firstNegativeDate = dStr;
      }

      dailyTrajectory.push({
        date: dStr,
        balance: runningBalance,
        delta: dayDelta,
        eventsCount: dayEvents.length,
        events: dayEvents,
      });

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const finalBalance = dailyTrajectory[dailyTrajectory.length - 1]?.balance || runningBalance;

    return {
      daysAhead,
      startDate: today,
      endDate,
      currentBalance: currentTotalBalance,
      finalBalance,
      minBalance,
      minBalanceDate,
      maxBalance,
      alertUnderZero,
      firstNegativeDate,
      dailyTrajectory,
    };
  }

  // ==========================================
  // 3. INSIGHTS AUTOMÁTICOS & DESPERDÍCIOS
  // ==========================================
  getSmartInsights(targetMonthKey = null) {
    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = targetMonthKey || getMonthKey(today);
    const prevMonthKey = addMonthsToKey(curMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(curMonthKey, -2);
    const prev3MonthKey = addMonthsToKey(curMonthKey, -3);

    const insights = [];

    const categoryStats = this.db.prepare(`
      SELECT 
        c.id, c.name, c.color, c.icon,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) = '${curMonthKey}' THEN t.amount ELSE 0 END), 0) as current_month,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) = '${prevMonthKey}' THEN t.amount ELSE 0 END), 0) as prev_month,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) IN ('${prevMonthKey}', '${prev2MonthKey}', '${prev3MonthKey}') THEN t.amount ELSE 0 END), 0) as past_3m_sum
      FROM categories c
      JOIN transactions t ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
      GROUP BY c.id
    `).all();

    for (const cat of categoryStats) {
      const avg3m = Math.round(cat.past_3m_sum / 3);

      if (avg3m > 0 && cat.current_month > avg3m + 5000 && cat.current_month > avg3m * 1.25) {
        const percentIncrease = Math.round(((cat.current_month - avg3m) / avg3m) * 100);
        insights.push({
          id: `spike_${cat.id}`,
          type: 'warning',
          category: cat.name,
          title: `Aumento expressivo em ${cat.name}`,
          description: `Gastos atingiram ${(cat.current_month / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, um aumento de ${percentIncrease}% sobre sua média histórica trimestral de ${(avg3m / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          metric: `+${percentIncrease}%`,
          actionSuggestion: `Revise os lançamentos recentes de ${cat.name} para verificar se houve compras pontuais ou aumento recorrente de custos.`,
        });
      }

      if (avg3m > 10000 && cat.current_month < avg3m * 0.80 && (avg3m - cat.current_month) > 8000) {
        const percentSaved = Math.round(((avg3m - cat.current_month) / avg3m) * 100);
        insights.push({
          id: `saving_${cat.id}`,
          type: 'success',
          category: cat.name,
          title: `Economia notável em ${cat.name}`,
          description: `Você gastou ${percentSaved}% menos em ${cat.name} este mês comparado à sua média trimestral, economizando ${((avg3m - cat.current_month) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          metric: `-${percentSaved}%`,
          actionSuggestion: 'Excelente disciplina orçamentária mantida nessa categoria.',
        });
      }
    }

    const discretionaryCategories = ['Alimentação', 'Lazer', 'Restaurante', 'Delivery', 'Compras', 'Eletrônicos', 'Vestuário'];
    let discretionaryTotalCur = 0;
    let discretionaryTotalPrev = 0;

    for (const cat of categoryStats) {
      if (discretionaryCategories.some(d => cat.name.toLowerCase().includes(d.toLowerCase()))) {
        discretionaryTotalCur += cat.current_month;
        discretionaryTotalPrev += cat.prev_month;
      }
    }

    if (discretionaryTotalPrev > 0 && discretionaryTotalCur > discretionaryTotalPrev * 1.30 && (discretionaryTotalCur - discretionaryTotalPrev) > 10000) {
      const growth = Math.round(((discretionaryTotalCur - discretionaryTotalPrev) / discretionaryTotalPrev) * 100);
      insights.push({
        id: 'discretionary_waste',
        type: 'danger',
        category: 'Despesas Variáveis',
        title: 'Gastos discricionários em elevação',
        description: `Gastos em alimentação fora, compras e lazer subiram ${growth}% em relação ao mês anterior (total de ${(discretionaryTotalCur / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
        metric: `+${growth}%`,
        actionSuggestion: 'Estabeleça um teto semanal para delivery e saídas para evitar corrosão da sua capacidade de poupança.',
      });
    }

    const topCat = [...categoryStats].sort((a, b) => b.current_month - a.current_month)[0];
    if (topCat && topCat.current_month > 20000) {
      const potentialYearlySavings = Math.round(topCat.current_month * 0.15 * 12);
      insights.push({
        id: `opp_${topCat.id}`,
        type: 'tip',
        category: 'Oportunidade',
        title: `Potencial de poupança em ${topCat.name}`,
        description: `Se você otimizar apenas 15% dos gastos com ${topCat.name}, economizará aproximadamente ${(potentialYearlySavings / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ao longo de 1 ano.`,
        metric: '15% otimização',
        actionSuggestion: `Defina um orçamento mensal de ${((topCat.current_month * 0.85) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${topCat.name}.`,
      });
    }

    return insights;
  }

  // ==========================================
  // 4. DETECÇÃO DE ANOMALIAS (IQR / Z-SCORE)
  // ==========================================
  detectAnomalies(monthsBack = 6) {
    const today = new Date().toISOString().slice(0, 10);
    const startMonth = addMonthsToKey(getMonthKey(today), -monthsBack);

    const anomalies = [];

    const duplicateCandidates = this.db.prepare(`
      SELECT 
        t1.id as id1, t1.description, t1.amount, t1.transaction_date as date1,
        t2.id as id2, t2.transaction_date as date2,
        c.name as category_name
      FROM transactions t1
      JOIN transactions t2 ON t1.id < t2.id 
        AND t1.amount = t2.amount 
        AND t1.description = t2.description
        AND t1.type = t2.type
        AND t1.status != 'cancelled' AND t2.status != 'cancelled'
        AND abs(julianday(t1.transaction_date) - julianday(t2.transaction_date)) <= 2
      LEFT JOIN categories c ON t1.category_id = c.id
      WHERE t1.type = 'expense'
        AND t1.transaction_date >= '${startMonth}-01'
      ORDER BY t1.transaction_date DESC
      LIMIT 20
    `).all();

    for (const dup of duplicateCandidates) {
      anomalies.push({
        id: `dup_${dup.id1}_${dup.id2}`,
        transactionId: dup.id2,
        description: dup.description,
        amount: dup.amount,
        date: dup.date2,
        categoryName: dup.category_name || 'Sem categoria',
        anomalyType: 'duplicate_charge',
        severity: 'high',
        reason: `Possível cobrança duplicada: lançamento idêntico de ${(dup.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado em ${dup.date1} e ${dup.date2} (intervalo ≤ 48h).`,
      });
    }

    const categories = this.db.prepare(`
      SELECT DISTINCT c.id, c.name
      FROM categories c
      JOIN transactions t ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
    `).all();

    for (const cat of categories) {
      const rows = this.db.prepare(`
        SELECT id, description, amount, transaction_date
        FROM transactions
        WHERE category_id = ?
          AND type = 'expense'
          AND status != 'cancelled'
          AND transaction_date >= '${startMonth}-01'
        ORDER BY amount ASC
      `).all(cat.id);

      if (rows.length < 4) continue;

      const amounts = rows.map(r => r.amount);
      const q1 = percentile(amounts, 25);
      const med = median(amounts);
      const q3 = percentile(amounts, 75);
      const iqr = q3 - q1;

      const upperBound = Math.round(q3 + 2.0 * Math.max(iqr, med * 0.5));

      const outliers = rows.filter(r => r.amount > upperBound && r.amount > 5000);

      for (const out of outliers) {
        if (out.transaction_date >= addDays(today, -60)) {
          const ratio = (out.amount / (med || 1)).toFixed(1);
          anomalies.push({
            id: `outlier_${out.id}`,
            transactionId: out.id,
            description: out.description,
            amount: out.amount,
            date: out.transaction_date,
            categoryName: cat.name,
            anomalyType: 'statistical_outlier',
            severity: out.amount > upperBound * 1.5 ? 'high' : 'medium',
            reason: `Gasto incomum em ${cat.name}: ${(out.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} é ${ratio}x maior que o valor mediano habitual de ${(med / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          });
        }
      }
    }

    return anomalies.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0));
  }

  // ==========================================
  // 5. CATEGORIZAÇÃO INTELIGENTE PREDITIVA
  // ==========================================
  suggestCategory(description, amount = null) {
    if (!description || description.trim().length === 0) {
      return null;
    }

    const descUpper = description.trim().toUpperCase();

    const importRules = this.db.prepare(`
      SELECT r.pattern, r.category_id, c.name as category_name
      FROM import_rules r
      JOIN categories c ON r.category_id = c.id
      WHERE r.active = 1
    `).all();

    for (const rule of importRules) {
      if (descUpper.includes(rule.pattern.toUpperCase())) {
        return {
          categoryId: rule.category_id,
          categoryName: rule.category_name,
          confidence: 98,
          source: 'rule',
        };
      }
    }

    const tokens = tokenizeText(description);
    if (tokens.length === 0) return null;

    const categoryFrequency = new Map();
    let totalMatches = 0;

    for (const token of tokens) {
      const rows = this.db.prepare(`
        SELECT t.category_id, c.name as category_name, COUNT(*) as cnt
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.category_id IS NOT NULL
          AND UPPER(t.description) LIKE ?
        GROUP BY t.category_id
      `).all(`%${token}%`);

      for (const r of rows) {
        if (!categoryFrequency.has(r.category_id)) {
          categoryFrequency.set(r.category_id, {
            id: r.category_id,
            name: r.category_name,
            score: 0,
            count: 0,
          });
        }
        const item = categoryFrequency.get(r.category_id);
        item.score += r.cnt;
        item.count += r.cnt;
        totalMatches += r.cnt;
      }
    }

    if (totalMatches > 0 && categoryFrequency.size > 0) {
      const candidates = Array.from(categoryFrequency.values()).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const confidence = Math.min(95, Math.max(60, Math.round((best.score / totalMatches) * 100)));

      return {
        categoryId: best.id,
        categoryName: best.name,
        confidence,
        source: 'history',
      };
    }

    return null;
  }

  // ==========================================
  // 6. IDENTIFICAÇÃO DE RECORRÊNCIAS & ASSINATURAS
  // ==========================================
  detectRecurringPatterns() {
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = addMonthsToKey(getMonthKey(today), -8);

    const txs = this.db.prepare(`
      SELECT id, description, amount, transaction_date, category_id
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND transaction_date >= '${sixMonthsAgo}-01'
      ORDER BY transaction_date ASC
    `).all();

    const groups = new Map();
    for (const tx of txs) {
      const cleanName = cleanMerchantName(tx.description);
      if (!cleanName || cleanName.length < 3) continue;

      if (!groups.has(cleanName)) {
        groups.set(cleanName, []);
      }
      groups.get(cleanName).push(tx);
    }

    const registeredRules = this.db.prepare(`SELECT description FROM recurring_rules WHERE active = 1`).all();
    const registeredSet = new Set(registeredRules.map(r => cleanMerchantName(r.description)));

    const candidates = [];

    for (const [merchant, list] of groups.entries()) {
      if (list.length < 2) continue;
      if (registeredSet.has(merchant)) continue;

      const intervals = [];
      for (let i = 1; i < list.length; i++) {
        const d1 = parseDate(list[i - 1].transaction_date);
        const d2 = parseDate(list[i].transaction_date);
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) intervals.push(diffDays);
      }

      if (intervals.length === 0) continue;

      const avgInterval = mean(intervals);
      const intervalStdDev = stdDev(intervals, avgInterval);

      const amounts = list.map(l => l.amount);
      const avgAmount = Math.round(mean(amounts));
      const amountStdDev = stdDev(amounts, avgAmount);
      const amountCv = avgAmount > 0 ? (amountStdDev / avgAmount) : 1;

      let frequency = null;
      if (avgInterval >= 25 && avgInterval <= 35 && intervalStdDev <= 6) {
        frequency = 'monthly';
      } else if (avgInterval >= 6 && avgInterval <= 8 && intervalStdDev <= 2) {
        frequency = 'weekly';
      }

      if (frequency && amountCv <= 0.08) {
        const lastTx = list[list.length - 1];
        const lastDate = lastTx.transaction_date;
        const nextExpectedDate = frequency === 'monthly' ? addDays(lastDate, 30) : addDays(lastDate, 7);

        const catMap = new Map();
        for (const it of list) {
          if (it.category_id) {
            catMap.set(it.category_id, (catMap.get(it.category_id) || 0) + 1);
          }
        }
        let topCatId = null;
        let topCatCount = 0;
        for (const [cId, count] of catMap.entries()) {
          if (count > topCatCount) {
            topCatCount = count;
            topCatId = cId;
          }
        }

        candidates.push({
          id: `rec_${merchant.replace(/\s+/g, '_').toLowerCase()}`,
          rawDescription: lastTx.description,
          cleanDescription: merchant,
          averageAmount: avgAmount,
          suggestedFrequency: frequency,
          suggestedBillingDay: parseDate(lastDate).getDate(),
          occurrencesCount: list.length,
          lastDate,
          nextExpectedDate,
          categoryId: topCatId,
          confidence: Math.min(96, Math.max(70, Math.round((1 - amountCv) * 90))),
        });
      }
    }

    return candidates.sort((a, b) => b.occurrencesCount - a.occurrencesCount);
  }

  // ==========================================
  // 7. ANÁLISE DE CARTÕES & FATURAS FUTURAS
  // ==========================================
  getCreditCardIntelligence() {
    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = getMonthKey(today);

    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();
    const result = [];

    const projectionMonths = [];
    for (let i = 0; i < 6; i++) {
      projectionMonths.push(addMonthsToKey(curMonthKey, i));
    }

    for (const card of cards) {
      const totalLimit = card.credit_limit;

      const monthlyProjections = [];
      let totalUsedAcrossFuture = 0;

      for (const mKey of projectionMonths) {
        const invTotal = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
          FROM transactions
          WHERE credit_card_id = ?
            AND invoice_month = ?
            AND status != 'cancelled'
            AND status != 'paid'
        `).get(card.id, mKey);

        monthlyProjections.push({
          monthKey: mKey,
          amount: invTotal.total,
          itemCount: invTotal.count,
        });

        totalUsedAcrossFuture += invTotal.total;
      }

      const currentInvoice = monthlyProjections[0]?.amount || 0;
      const nextInvoice = monthlyProjections[1]?.amount || 0;
      const currentUtilization = totalLimit > 0 ? Math.round((currentInvoice / totalLimit) * 100) : 0;

      const activeInstallments = this.db.prepare(`
        SELECT description, amount, installment_number, total_installments, invoice_month
        FROM transactions
        WHERE credit_card_id = ?
          AND installment_id IS NOT NULL
          AND status != 'cancelled'
          AND installment_number = total_installments
          AND invoice_month >= '${curMonthKey}'
        ORDER BY invoice_month ASC
      `).all(card.id);

      result.push({
        cardId: card.id,
        cardName: card.name,
        color: card.color,
        creditLimit: totalLimit,
        currentInvoice,
        nextInvoice,
        currentUtilization,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        monthlyProjections,
        endingInstallments: activeInstallments.map(inst => ({
          description: inst.description,
          amount: inst.amount,
          endsInMonth: inst.invoice_month,
        })),
      });
    }

    return result;
  }

  // ==========================================
  // 8. METAS FINANCEIRAS COM PROJEÇÃO
  // ==========================================
  getGoalsIntelligence() {
    const goals = this.db.prepare(`SELECT * FROM goals`).all();
    if (goals.length === 0) return [];

    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = getMonthKey(today);
    const prevMonthKey = addMonthsToKey(curMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(curMonthKey, -2);

    const incomeAvg = this.db.prepare(`
      SELECT COALESCE(AVG(monthly_total), 0) as avg_inc
      FROM (
        SELECT SUM(amount) as monthly_total
        FROM transactions
        WHERE type = 'income' AND status = 'completed'
          AND strftime('%Y-%m', transaction_date) IN (?, ?, ?)
        GROUP BY strftime('%Y-%m', transaction_date)
      )
    `).get(curMonthKey, prevMonthKey, prev2MonthKey).avg_inc;

    const expenseAvg = this.db.prepare(`
      SELECT COALESCE(AVG(monthly_total), 0) as avg_exp
      FROM (
        SELECT SUM(amount) as monthly_total
        FROM transactions
        WHERE type = 'expense' AND status != 'cancelled'
          AND COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) IN (?, ?, ?)
        GROUP BY COALESCE(invoice_month, strftime('%Y-%m', transaction_date))
      )
    `).get(curMonthKey, prevMonthKey, prev2MonthKey).avg_exp;

    const avgMonthlySavings = Math.max(0, Math.round(incomeAvg - expenseAvg));

    return goals.map(goal => {
      const remainingAmount = Math.max(0, goal.target_amount - goal.current_amount);
      const progressPercent = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 100;

      let estimatedMonthsToFinish = null;
      let estimatedCompletionDate = null;
      let requiredMonthlyAporte = null;
      let status = 'on_track';

      if (remainingAmount === 0) {
        status = 'completed';
      } else if (avgMonthlySavings > 0) {
        const allocatedMonthly = Math.round(avgMonthlySavings / (goals.filter(g => g.current_amount < g.target_amount).length || 1));
        if (allocatedMonthly > 0) {
          estimatedMonthsToFinish = Math.ceil(remainingAmount / allocatedMonthly);
          estimatedCompletionDate = addMonthsToKey(curMonthKey, estimatedMonthsToFinish);
        }
      }

      if (goal.target_date && remainingAmount > 0) {
        const targetMonth = getMonthKey(goal.target_date);
        const monthsUntilTarget = Math.max(1, (parseDate(goal.target_date).getFullYear() - parseDate(today).getFullYear()) * 12 + (parseDate(goal.target_date).getMonth() - parseDate(today).getMonth()));

        requiredMonthlyAporte = Math.round(remainingAmount / monthsUntilTarget);

        if (estimatedCompletionDate && estimatedCompletionDate > targetMonth) {
          status = 'at_risk';
        }
      }

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.target_amount,
        currentAmount: goal.current_amount,
        remainingAmount,
        progressPercent,
        color: goal.color,
        icon: goal.icon,
        targetDate: goal.target_date,
        estimatedCompletionDate,
        estimatedMonthsToFinish,
        requiredMonthlyAporte,
        status,
      };
    });
  }

  // ==========================================
  // 9. FECHAMENTO MENSAL INTELIGENTE
  // ==========================================
  getMonthlyCloseout(yearMonth = null) {
    const today = new Date().toISOString().slice(0, 10);
    const mKey = yearMonth || getMonthKey(today);
    const prevKey = addMonthsToKey(mKey, -1);

    const income = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE type = 'income' AND status = 'completed'
        AND transaction_date >= '${mKey}-01' AND transaction_date <= '${mKey}-31'
    `).get();

    const expense = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND (
          (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= '${mKey}-01' AND transaction_date <= '${mKey}-31')
          OR (credit_card_id IS NOT NULL AND invoice_month = '${mKey}')
        )
    `).get();

    const prevIncome = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND status = 'completed'
        AND transaction_date >= '${prevKey}-01' AND transaction_date <= '${prevKey}-31'
    `).get().total;

    const prevExpense = this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND (
          (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= '${prevKey}-01' AND transaction_date <= '${prevKey}-31')
          OR (credit_card_id IS NOT NULL AND invoice_month = '${prevKey}')
        )
    `).get().total;

    const savedAmount = income.total - expense.total;
    const savingsRate = income.total > 0 ? Math.round((savedAmount / income.total) * 100) : 0;

    const incomeChangeMoM = prevIncome > 0 ? Math.round(((income.total - prevIncome) / prevIncome) * 100) : 0;
    const expenseChangeMoM = prevExpense > 0 ? Math.round(((expense.total - prevExpense) / prevExpense) * 100) : 0;

    const topCategories = this.db.prepare(`
      SELECT 
        c.id, c.name, c.color, c.icon,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
        AND (
          (t.credit_card_id IS NULL AND t.status = 'completed' AND t.transaction_date >= '${mKey}-01' AND t.transaction_date <= '${mKey}-31')
          OR (t.credit_card_id IS NOT NULL AND t.invoice_month = '${mKey}')
        )
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 5
    `).all().map(c => ({
      ...c,
      name: c.name || 'Sem categoria',
      color: c.color || '#94a3b8',
      icon: c.icon || 'Tag',
      percentage: expense.total > 0 ? Math.round((c.total / expense.total) * 100) : 0,
    }));

    const highestExpense = this.db.prepare(`
      SELECT t.id, t.description, t.amount, t.transaction_date, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
        AND (
          (t.credit_card_id IS NULL AND t.status = 'completed' AND t.transaction_date >= '${mKey}-01' AND t.transaction_date <= '${mKey}-31')
          OR (t.credit_card_id IS NOT NULL AND t.invoice_month = '${mKey}')
        )
      ORDER BY t.amount DESC
      LIMIT 1
    `).get();

    const achievements = [];
    if (savingsRate >= 20) {
      achievements.push(`Você poupou ${savingsRate}% de toda a sua renda este mês.`);
    }
    if (expenseChangeMoM < 0) {
      achievements.push(`Seus gastos caíram ${Math.abs(expenseChangeMoM)}% em relação ao mês anterior.`);
    }
    if (savedAmount > 0) {
      achievements.push(`Superávit acumulado de ${(savedAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
    }

    return {
      monthKey: mKey,
      incomeTotal: income.total,
      incomeCount: income.count,
      expenseTotal: expense.total,
      expenseCount: expense.count,
      savedAmount,
      savingsRate,
      incomeChangeMoM,
      expenseChangeMoM,
      topCategories,
      highestExpense: highestExpense ? {
        description: highestExpense.description,
        amount: highestExpense.amount,
        date: highestExpense.transaction_date,
        categoryName: highestExpense.category_name || 'Sem categoria',
      } : null,
      achievements,
    };
  }

  // ==========================================
  // 10. CONVERSÃO DE CANDIDATO RECORRENTE
  // ==========================================
  convertCandidateToRecurring(candidate) {
    const crypto = require('crypto');
    const id = `rec_${crypto.randomUUID()}`;
    const today = new Date().toISOString().slice(0, 10);

    const defaultAcc = this.db.prepare(`SELECT id FROM accounts WHERE active = 1 LIMIT 1`).get();
    const accountId = defaultAcc ? defaultAcc.id : null;

    this.db.prepare(`
      INSERT INTO recurring_rules (
        id, account_id, category_id, type, description, amount, frequency,
        billing_day, start_date, next_due_date, auto_generate, active, created_at
      ) VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      id,
      accountId,
      candidate.categoryId || null,
      candidate.cleanDescription || candidate.rawDescription,
      candidate.averageAmount,
      candidate.suggestedFrequency || 'monthly',
      candidate.suggestedBillingDay || 1,
      today,
      candidate.nextExpectedDate || today,
      new Date().toISOString()
    );

    return { success: true, id };
  }

  // Consolidated Overview for UI
  getIntelligenceOverview() {
    return {
      healthScore: this.getFinancialHealthScore(),
      forecast: this.getBalanceForecast(30),
      insights: this.getSmartInsights(),
      anomalies: this.detectAnomalies(),
      recurringCandidates: this.detectRecurringPatterns(),
      cardsAnalysis: this.getCreditCardIntelligence(),
      goals: this.getGoalsIntelligence(),
      monthlyCloseout: this.getMonthlyCloseout(),
    };
  }
}

module.exports = {
  FinancialIntelligenceEngine,
  tokenizeText,
  cleanMerchantName,
  mean,
  stdDev,
  percentile,
  median,
};
