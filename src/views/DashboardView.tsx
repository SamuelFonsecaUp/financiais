import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  CreditCard,
  CalendarClock,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';

export const DashboardView: React.FC = () => {
  const {
    dashboardData,
    settings,
    openNewTransaction,
    setCurrentView,
    openEditTransaction,
  } = useFinancial();

  if (!dashboardData) return null;

  const {
    totalBalance,
    monthIncome,
    monthExpense,
    monthResult,
    prevMonthIncome,
    prevMonthExpense,
    cardsSummary,
    upcomingBills,
    cashFlowHistory,
    categoryExpenses,
    recentTransactions,
  } = dashboardData;

  // Percentage calculations vs previous month
  const incomeDiffPercent = prevMonthIncome > 0
    ? Math.round(((monthIncome - prevMonthIncome) / prevMonthIncome) * 100)
    : 0;

  const expenseDiffPercent = prevMonthExpense > 0
    ? Math.round(((monthExpense - prevMonthExpense) / prevMonthExpense) * 100)
    : 0;

  const hasAnyData = recentTransactions.length > 0 || totalBalance !== 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Olá, {settings?.userName || 'Usuário'}! <span className="animate-wiggle">👋</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aqui está o resumo atualizado das suas finanças.
          </p>
        </div>

        <button
          onClick={() => openNewTransaction()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Novo lançamento
        </button>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma movimentação ainda"
          description="Adicione sua primeira receita, despesa ou configure suas contas bancárias para começar a controlar suas finanças."
          actionLabel="Novo lançamento"
          onAction={() => openNewTransaction()}
        />
      ) : (
        <>
          {/* Top 4 Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Saldo Total */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Saldo Total
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {formatCurrency(totalBalance)}
              </div>
              <p className="text-xs text-slate-400 mt-1">Em todas as contas ativas</p>
            </div>

            {/* Receitas do Mês */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Receitas do Mês
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                {formatCurrency(monthIncome)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                {incomeDiffPercent >= 0 ? (
                  <span className="text-emerald-400 flex items-center font-medium">
                    <ArrowUpRight className="w-3 h-3" /> +{incomeDiffPercent}%
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center font-medium">
                    <ArrowDownRight className="w-3 h-3" /> {incomeDiffPercent}%
                  </span>
                )}
                <span className="text-slate-400">vs mês anterior</span>
              </div>
            </div>

            {/* Despesas do Mês */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Despesas do Mês
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-400 tracking-tight">
                {formatCurrency(monthExpense)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                {expenseDiffPercent > 0 ? (
                  <span className="text-rose-400 flex items-center font-medium">
                    <ArrowUpRight className="w-3 h-3" /> +{expenseDiffPercent}%
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center font-medium">
                    <ArrowDownRight className="w-3 h-3" /> {expenseDiffPercent}%
                  </span>
                )}
                <span className="text-slate-400">vs mês anterior</span>
              </div>
            </div>

            {/* Resultado do Mês */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Resultado do Mês
                </span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  monthResult >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-2xl font-bold tracking-tight ${
                monthResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatCurrency(monthResult, true)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {monthResult >= 0 ? 'Economia positiva no período' : 'Despesas superaram as receitas'}
              </p>
            </div>
          </div>

          {/* Cards & Upcoming Bills Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cartões Overview */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Cartões de Crédito</h3>
                  </div>
                  <button
                    onClick={() => setCurrentView('cards')}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center"
                  >
                    Ver cartões <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {cardsSummary.cardCount === 0 ? (
                  <p className="text-xs text-slate-400 py-4">Nenhum cartão cadastrado ainda.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Limite Utilizado</span>
                        <span className="font-semibold text-white">
                          {formatCurrency(cardsSummary.usedLimit)} de {formatCurrency(cardsSummary.totalLimit)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-rose-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              cardsSummary.totalLimit > 0
                                ? Math.min(100, Math.round((cardsSummary.usedLimit / cardsSummary.totalLimit) * 100))
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                      <div>
                        <div className="text-[11px] text-slate-400">Limite Disponível</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {formatCurrency(cardsSummary.availableLimit)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Cartões Ativos</div>
                        <div className="text-sm font-bold text-white">{cardsSummary.cardCount}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Próximos Vencimentos (Next 15 days) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Próximos Vencimentos</h3>
                </div>
                <span className="text-xs text-slate-400">Próximos 15 dias</span>
              </div>

              {upcomingBills.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhuma conta com vencimento nos próximos 15 dias.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {upcomingBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {bill.description}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{formatDate(bill.transactionDate)}</span>
                          {bill.categoryName && (
                            <span className="truncate text-slate-400">• {bill.categoryName}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-rose-400 shrink-0">
                        {formatCurrency(bill.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row: Fluxo de Caixa + Gastos por Categoria */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Fluxo de Caixa (Últimos 6 meses) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Fluxo de Caixa Mensal</h3>
                  <p className="text-xs text-slate-400">Evolução de receitas e despesas nos últimos meses</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-slate-300">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                    <span className="text-slate-300">Despesas</span>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1e293b' }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1e293b' }}
                      tickFormatter={(val) => `R$ ${(val / 100).toFixed(0)}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-semibold text-white mb-1.5">{data.label}</p>
                              <p className="text-emerald-400">Receitas: {formatCurrency(data.receitas)}</p>
                              <p className="text-rose-400">Despesas: {formatCurrency(data.despesas)}</p>
                              <p className="text-slate-300 pt-1 border-t border-slate-800">
                                Saldo: {formatCurrency(data.resultado, true)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gastos por Categoria (Donut) */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Gastos por Categoria</h3>
                <p className="text-xs text-slate-400 mb-4">Distribuição das despesas do mês atual</p>

                {categoryExpenses.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                    Nenhuma despesa registrada neste mês.
                  </div>
                ) : (
                  <>
                    <div className="h-44 w-full relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryExpenses}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="total"
                          >
                            {categoryExpenses.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                                    <span className="font-semibold text-white">{data.name}</span>
                                    <div className="text-slate-300 mt-1">
                                      {formatCurrency(data.total)} ({data.percentage}%)
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Top Categories List */}
                    <div className="space-y-2 mt-2">
                      {categoryExpenses.slice(0, 4).map((cat) => (
                        <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-slate-300 truncate">{cat.name}</span>
                          </div>
                          <div className="font-semibold text-white shrink-0">
                            {formatCurrency(cat.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Últimos Lançamentos */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Últimos Lançamentos</h3>
                <p className="text-xs text-slate-400">Movimentações financeiras mais recentes</p>
              </div>
              <button
                onClick={() => setCurrentView('transactions')}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center"
              >
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Data</th>
                    <th className="pb-3">Descrição</th>
                    <th className="pb-3">Categoria</th>
                    <th className="pb-3">Conta / Cartão</th>
                    <th className="pb-3 pr-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {recentTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    const isTransfer = tx.type === 'transfer';

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => openEditTransaction(tx)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 pl-2 text-slate-400 font-mono">
                          {formatDate(tx.transactionDate)}
                        </td>
                        <td className="py-3 font-medium text-white group-hover:text-brand-400 transition-colors">
                          <div className="flex items-center gap-2">
                            {isIncome && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            {isExpense && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            {isTransfer && <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            <span className="truncate">{tx.description}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400">
                          {tx.categoryName || (isTransfer ? 'Transferência' : 'Geral')}
                        </td>
                        <td className="py-3 text-slate-400">
                          {tx.creditCardName
                            ? `Cartão ${tx.creditCardName}`
                            : tx.accountName || '-'}
                        </td>
                        <td
                          className={`py-3 pr-2 text-right font-semibold font-mono ${
                            isIncome
                              ? 'text-emerald-400'
                              : isExpense
                              ? 'text-rose-400'
                              : 'text-sky-400'
                          }`}
                        >
                          {isIncome
                            ? formatCurrency(tx.amount, true)
                            : isExpense
                            ? formatCurrency(-tx.amount)
                            : formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
