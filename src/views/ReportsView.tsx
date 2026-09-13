import React, { useState, useEffect } from 'react';
import {
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Scale,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { ReportsData } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { CustomSelect } from '../components/CustomSelect';

export const ReportsView: React.FC = () => {
  const { showToast } = useFinancial();

  const [periodFilter, setPeriodFilter] = useState<'month' | 'today' | 'week' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = '';
      let endDate = '';

      if (periodFilter === 'today') {
        const t = now.toISOString().slice(0, 10);
        startDate = t;
        endDate = t;
      } else if (periodFilter === 'week') {
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - now.getDay());
        startDate = firstDay.toISOString().slice(0, 10);
        endDate = now.toISOString().slice(0, 10);
      } else if (periodFilter === 'month') {
        const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        startDate = `${mKey}-01`;
        endDate = `${mKey}-31`;
      } else if (periodFilter === 'year') {
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-12-31`;
      } else if (periodFilter === 'custom') {
        startDate = customStart;
        endDate = customEnd;
      }

      const data = await window.electronAPI.getReports({ startDate, endDate });
      setReports(data);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao carregar relatórios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [periodFilter, customStart, customEnd]);

  const handleExportCsv = async () => {
    if (!reports) return;
    try {
      const res = await window.electronAPI.exportCsvDialog({
        startDate: reports.period.startDate,
        endDate: reports.period.endDate,
      });
      if (res.success) {
        showToast('Planilha de relatório exportada com sucesso!', 'success');
      }
    } catch (e) {
      showToast('Erro ao exportar CSV', 'error');
    }
  };

  if (!reports) return null;

  const { summary, expensesByCategory, incomeByCategory, expensesByAccount, expensesByCard, topExpenses } = reports;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-400 mt-1">
            Análises visuais de receitas, despesas por categoria e maiores gastos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="w-48">
            <CustomSelect
              size="sm"
              value={periodFilter}
              onChange={(val) => setPeriodFilter(val)}
              options={[
                { value: 'month', label: 'Este Mês' },
                { value: 'today', label: 'Hoje' },
                { value: 'week', label: 'Esta Semana' },
                { value: 'year', label: 'Este Ano' },
                { value: 'custom', label: 'Período Personalizado' },
              ]}
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Custom date range if active */}
      {periodFilter === 'custom' && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">De:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Até:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white"
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Receitas no Período</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {formatCurrency(summary.totalIncome)}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Despesas no Período</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {formatCurrency(summary.totalExpense)}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resultado Líquido</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              summary.netResult >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono ${
            summary.netResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {formatCurrency(summary.netResult, true)}
          </div>
        </div>
      </div>

      {/* Row 1: Gastos por Categoria (Donut) & Receitas por Categoria (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Despesas por Categoria */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Despesas por Categoria</h3>
            <p className="text-xs text-slate-400 mb-4">Percentual e volume de cada categoria de gasto</p>

            {expensesByCategory.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                Nenhuma despesa registrada no período selecionado.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="total"
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#f59e0b'} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                                <p className="font-semibold text-white">{data.name}</p>
                                <p className="text-rose-400 mt-1">{formatCurrency(data.total)} ({data.percentage}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-48 custom-scrollbar pr-2">
                  {expensesByCategory.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-300 truncate">{cat.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-white font-mono">{formatCurrency(cat.total)}</span>
                        <span className="text-slate-400 text-[10px] ml-1.5">({cat.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Receitas por Categoria */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Receitas por Categoria</h3>
            <p className="text-xs text-slate-400 mb-4">Origem dos ganhos no período</p>

            {incomeByCategory.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                Nenhuma receita registrada no período selecionado.
              </div>
            ) : (
              <div className="space-y-3">
                {incomeByCategory.map((inc) => (
                  <div key={inc.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: inc.color }} />
                        <span className="font-medium text-white">{inc.name}</span>
                      </div>
                      <span className="font-bold text-emerald-400 font-mono">
                        {formatCurrency(inc.total)} ({inc.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${inc.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Maiores Despesas do Período */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-white mb-1">Maiores Despesas no Período (Top 10)</h3>
        <p className="text-xs text-slate-400 mb-4">Identifique onde esteve a maior saída de dinheiro</p>

        {topExpenses.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Nenhuma despesa para listar no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 pl-2">Data</th>
                  <th className="py-2.5">Descrição</th>
                  <th className="py-2.5">Categoria</th>
                  <th className="py-2.5">Origem</th>
                  <th className="py-2.5 pr-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {topExpenses.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pl-2 text-slate-400 font-mono">{formatDate(t.transactionDate)}</td>
                    <td className="py-3 font-semibold text-white">{t.description}</td>
                    <td className="py-3 text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.categoryColor }} />
                        {t.categoryName}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{t.sourceName}</td>
                    <td className="py-3 pr-2 text-right font-bold text-rose-400 font-mono">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
