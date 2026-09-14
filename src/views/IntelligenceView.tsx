import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CreditCard,
  Target,
  Clock,
  ShieldCheck,
  Zap,
  Repeat,
  Info,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  IntelligenceOverviewData,
  FinancialHealthScore,
  BalanceForecast,
  SmartInsight,
  AnomalyItem,
  RecurringCandidate,
  CardIntelligenceData,
  MonthlyCloseoutReport,
} from '../types';

type ActiveTab =
  | 'health'
  | 'forecast'
  | 'insights'
  | 'anomalies'
  | 'recurring'
  | 'cards'
  | 'closeout';

export const IntelligenceView: React.FC = () => {
  const { showToast, refreshAll, openEditTransaction } = useFinancial();

  const [activeTab, setActiveTab] = useState<ActiveTab>('health');
  const [data, setData] = useState<IntelligenceOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState<30 | 60 | 90>(60);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        const [overview, forecast] = await Promise.all([
          window.electronAPI.getIntelligenceOverview(),
          window.electronAPI.getBalanceForecast(forecastDays),
        ]);
        setData({
          ...overview,
          forecast,
        });
      }
    } catch (err) {
      console.error('Error loading intelligence data:', err);
      showToast('Erro ao calcular inteligência financeira local.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [forecastDays, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleForecastDaysChange = async (days: 30 | 60 | 90) => {
    setForecastDays(days);
    if (!window.electronAPI) return;
    try {
      const forecast = await window.electronAPI.getBalanceForecast(days);
      setData(prev => prev ? { ...prev, forecast } : null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConvertRecurring = async (candidate: RecurringCandidate) => {
    if (!window.electronAPI) return;
    setConvertingId(candidate.id);
    try {
      await window.electronAPI.convertCandidateToRecurring(candidate);
      showToast(`Regra recorrente criada para "${candidate.cleanDescription}"!`, 'success');
      await refreshAll();
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('Erro ao converter candidato para regra recorrente.', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Analisando dados financeiros locais com IA determinística...</span>
      </div>
    );
  }

  if (!data) return null;

  const {
    healthScore,
    forecast,
    insights,
    anomalies,
    recurringCandidates,
    cardsAnalysis,
    monthlyCloseout,
  } = data;

  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');

  return (
    <div className="h-full flex flex-col bg-slate-950/60 overflow-hidden">
      {/* Top Header */}
      <div className="p-6 pb-4 border-b border-slate-900 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600/30 to-violet-500/20 border border-brand-500/30 text-brand-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Inteligência Financeira
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                    100% Offline
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Análises estatísticas, projeções de saldo e diagnóstico da saúde financeira sem dependência de internet.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recalcular
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 mt-5 overflow-x-auto no-scrollbar border-b border-slate-900/60 pb-1">
          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'health'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Saúde Financeira
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-bold"
              style={{ backgroundColor: `${healthScore.color}20`, color: healthScore.color }}
            >
              {healthScore.score}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'forecast'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Previsão de Saldo
            {forecast.alertUnderZero && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'insights'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Zap className="w-4 h-4" />
            Insights & Desperdícios
            {insights.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                {insights.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'anomalies'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Anomalias Detectadas
            {anomalies.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                highSeverityAnomalies.length > 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {anomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recurring')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'recurring'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Repeat className="w-4 h-4" />
            Assinaturas Detectadas
            {recurringCandidates.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-brand-500/20 text-brand-300 font-bold">
                {recurringCandidates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'cards'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Cartões & Faturas
          </button>

          <button
            onClick={() => setActiveTab('closeout')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'closeout'
                ? 'bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Fechamento Mensal
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ================= TAB 1: SAÚDE FINANCEIRA ================= */}
        {activeTab === 'health' && (
          <div className="space-y-6 max-w-5xl">
            {/* Health Score Main Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
                <div className="flex items-center gap-6">
                  {/* Score Gauge Circle */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="#1e293b"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke={healthScore.color}
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - healthScore.score / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-white tracking-tight">
                        {healthScore.score}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        / 100
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${healthScore.color}20`, color: healthScore.color }}
                      >
                        Saúde {healthScore.classification}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">
                      Diagnóstico Geral
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl mt-1 leading-relaxed">
                      {healthScore.message}
                    </p>
                  </div>
                </div>

                {/* Quick Summary Metrics */}
                <div className="grid grid-cols-2 gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Taxa de Poupança</span>
                    <span className="text-base font-bold text-white">
                      {healthScore.metrics.savingsRate}%
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Cobertura de Reserva</span>
                    <span className="text-base font-bold text-white">
                      {healthScore.metrics.reserveCoverageMonths} meses
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Saldo Líquido</span>
                    <span className="text-base font-bold text-emerald-400">
                      {formatCurrency(healthScore.metrics.totalLiquidBalance)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Custos Fixos</span>
                    <span className="text-base font-bold text-slate-300">
                      {formatCurrency(healthScore.metrics.recurringTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* The 5 Pillars Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                Detalhamento dos 5 Pilares Fundamentais
              </h3>
              <div className="space-y-3">
                {healthScore.pillars.map((pillar) => {
                  const percent = Math.round((pillar.score / pillar.maxScore) * 100);
                  const isHigh = percent >= 80;
                  const isMid = percent >= 50 && percent < 80;

                  return (
                    <div
                      key={pillar.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 hover:border-slate-800 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{pillar.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isHigh ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            isMid ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {pillar.score} / {pillar.maxScore} pts
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {pillar.diagnostic}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full md:w-48 shrink-0">
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
                          <span>Aproveitamento</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHigh ? 'bg-emerald-500' : isMid ? 'bg-brand-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PREVISÃO DE SALDO ================= */}
        {activeTab === 'forecast' && (
          <div className="space-y-6 max-w-5xl">
            {/* Period Selector & Summary Cards */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Projeção de Fluxo de Caixa Futuro
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulação dia a dia considerando despesas recorrentes, faturas de cartões e receitas previstas.
                </p>
              </div>

              {/* Forecast Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 shrink-0">
                {([30, 60, 90] as const).map((days) => (
                  <button
                    key={days}
                    onClick={() => handleForecastDaysChange(days)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      forecastDays === days
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {days} dias
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block">Saldo Atual (Contas Líquidas)</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {formatCurrency(forecast.currentBalance)}
                </span>
              </div>

              <div className={`p-4 rounded-xl border ${
                forecast.minBalance < 0
                  ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                  : 'bg-slate-900/70 border-slate-850 text-white'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Saldo Mínimo Previsto</span>
                  {forecast.minBalance < 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                      Risco de Estouro
                    </span>
                  )}
                </div>
                <span className={`text-xl font-bold mt-1 block ${forecast.minBalance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatCurrency(forecast.minBalance)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Previsto para: {formatDate(forecast.minBalanceDate)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block">Saldo Final Previsto ({forecastDays}d)</span>
                <span className={`text-xl font-bold mt-1 block ${forecast.finalBalance >= forecast.currentBalance ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {formatCurrency(forecast.finalBalance)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Variação: {forecast.finalBalance >= forecast.currentBalance ? '+' : ''}
                  {formatCurrency(forecast.finalBalance - forecast.currentBalance)}
                </span>
              </div>
            </div>

            {/* Alert if balance goes negative */}
            {forecast.alertUnderZero && forecast.firstNegativeDate && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <div className="text-xs">
                  <span className="font-bold block text-sm text-rose-200">Alerta de Saldo Negativo Projetado!</span>
                  No dia <strong className="text-white">{formatDate(forecast.firstNegativeDate)}</strong> seu saldo previsto ficará abaixo de zero devido a compromissos financeiros agendados ou faturas de cartão. Considere renegociar despesas ou transferir fundos para evitar tarifas bancárias.
                </div>
              </div>
            )}

            {/* Forecast Chart */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-850">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" />
                Trajetória Projetada de Saldo ({forecastDays} Dias)
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.dailyTrajectory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => d.slice(8, 10) + '/' + d.slice(5, 7)}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$ ${(v / 100).toFixed(0)}`}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pt = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-750 p-3 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-white block">{formatDate(pt.date)}</span>
                              <span className="text-brand-400 font-semibold block">
                                Saldo Previsto: {formatCurrency(pt.balance)}
                              </span>
                              {pt.events && pt.events.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Eventos do dia:</span>
                                  {pt.events.map((ev: any, idx: number) => (
                                    <div key={idx} className="flex justify-between gap-3 text-[11px]">
                                      <span className="text-slate-300 truncate max-w-[160px]">{ev.title}</span>
                                      <span className={ev.amount >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                                        {formatCurrency(ev.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#balanceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: INSIGHTS & DESPERDÍCIOS ================= */}
        {activeTab === 'insights' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Insights Automáticos & Oportunidades
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Padrões detectados pela inteligência local cruzando o mês atual com sua média histórica dos últimos 3 meses.
              </p>
            </div>

            {insights.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-850 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-200">Seus gastos estão dentro dos padrões históricos!</p>
                <p className="text-xs text-slate-400 mt-1">Nenhum aumento atípico ou desperdício significativo foi detectado neste mês.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {insights.map((ins) => {
                  const isDanger = ins.type === 'danger';
                  const isWarning = ins.type === 'warning';
                  const isSuccess = ins.type === 'success';

                  return (
                    <div
                      key={ins.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isDanger
                          ? 'bg-rose-950/20 border-rose-800/40'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-800/40'
                          : isSuccess
                          ? 'bg-emerald-950/20 border-emerald-800/40'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            isDanger ? 'bg-rose-500/20 text-rose-400' :
                            isWarning ? 'bg-amber-500/20 text-amber-400' :
                            isSuccess ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-brand-500/20 text-brand-400'
                          }`}>
                            {isDanger || isWarning ? <AlertTriangle className="w-4 h-4" /> :
                             isSuccess ? <CheckCircle2 className="w-4 h-4" /> :
                             <Info className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                {ins.category}
                              </span>
                              {ins.metric && (
                                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                                  isDanger ? 'bg-rose-500/20 text-rose-300' :
                                  isWarning ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {ins.metric}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-white mt-1">{ins.title}</h3>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                              {ins.description}
                            </p>
                            {ins.actionSuggestion && (
                              <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                <span><strong>Recomendação:</strong> {ins.actionSuggestion}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: DETECÇÃO DE ANOMALIAS ================= */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Detecção Estatística de Anomalias (IQR & Z-Score)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Identificação de transações que fogem drasticamente da sua distribuição normal de gastos ou possíveis cobranças duplicadas.
              </p>
            </div>

            {anomalies.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-850 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-200">Nenhuma anomalia detectada!</p>
                <p className="text-xs text-slate-400 mt-1">Todas as despesas recentes estão estatisticamente alinhadas aos padrões habituais.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      anom.severity === 'high'
                        ? 'bg-rose-950/20 border-rose-800/40'
                        : 'bg-amber-950/20 border-amber-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        anom.severity === 'high' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{anom.description}</span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                            anom.anomalyType === 'duplicate_charge'
                              ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                              : 'bg-amber-500/30 text-amber-200'
                          }`}>
                            {anom.anomalyType === 'duplicate_charge' ? 'Cobrança Duplicada' : 'Outlier Estatístico'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {anom.reason}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                          <span>Data: {formatDate(anom.date)}</span>
                          <span>•</span>
                          <span>Categoria: {anom.categoryName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2">
                      <span className="text-base font-bold text-white">
                        {formatCurrency(anom.amount)}
                      </span>
                      <button
                        onClick={() => openEditTransaction({ id: anom.transactionId } as any)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-750 rounded-lg transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Ver Detalhes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: ASSINATURAS & RECORRÊNCIAS ================= */}
        {activeTab === 'recurring' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Repeat className="w-4 h-4 text-brand-400" />
                Assinaturas e Recorrências Detectadas Automaticamente
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Identificadas pelo algoritmo através da cadência de dias (~30 dias) e valores estáveis. Transforme em regra com 1 clique.
              </p>
            </div>

            {recurringCandidates.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-850 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-200">Nenhuma assinatura não cadastrada encontrada!</p>
                <p className="text-xs text-slate-400 mt-1">Todas as despesas periódicas identificadas já possuem regras cadastradas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recurringCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 hover:border-slate-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shrink-0">
                        <Repeat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{cand.cleanDescription}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                            {cand.suggestedFrequency === 'monthly' ? 'Mensal' : 'Semanal'}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium">
                            {cand.confidence}% confiança
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Detectado {cand.occurrencesCount} vezes no histórico • Dia de cobrança sugerido: dia {cand.suggestedBillingDay}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2">
                      <span className="text-base font-bold text-white">
                        {formatCurrency(cand.averageAmount)}
                      </span>
                      <button
                        disabled={convertingId === cand.id}
                        onClick={() => handleConvertRecurring(cand)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {convertingId === cand.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        Ativar Regra Recorrente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: CARTÕES & FATURAS FUTURAS ================= */}
        {activeTab === 'cards' && (
          <div className="space-y-6 max-w-5xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-400" />
                Comprometimento de Limites e Faturas Futuras
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Projeção do impacto financeiro das faturas abertas e parcelas vincendas para os próximos 6 meses.
              </p>
            </div>

            {cardsAnalysis.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-850 text-center text-slate-400">
                <CreditCard className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-200">Nenhum cartão de crédito ativo!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {cardsAnalysis.map((card) => (
                  <div
                    key={card.cardId}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-850 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold"
                          style={{ backgroundColor: card.color }}
                        >
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{card.cardName}</h3>
                          <span className="text-xs text-slate-400">
                            Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Limite Total</span>
                          <span className="text-sm font-bold text-white">{formatCurrency(card.creditLimit)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Fatura Atual</span>
                          <span className="text-sm font-bold text-amber-400">{formatCurrency(card.currentInvoice)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Utilização</span>
                          <span className={`text-sm font-bold ${card.currentUtilization > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {card.currentUtilization}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 6 Months Bar Chart Projection */}
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-2">
                        Projeção de Faturas nos Próximos 6 Meses
                      </span>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={card.monthlyProjections} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                              dataKey="monthKey"
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `R$ ${(v / 100).toFixed(0)}`}
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value: any) => [formatCurrency(Number(value)), 'Fatura Projetada']}
                              labelFormatter={(label) => `Mês de Referência: ${label}`}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 10 }}
                            />
                            <Bar dataKey="amount" fill={card.color} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Ending Installments */}
                    {card.endingInstallments.length > 0 && (
                      <div className="pt-2 border-t border-slate-850">
                        <span className="text-xs text-slate-400 font-semibold block mb-2">
                          Parcelamentos com Término Programado (Alívio de Limite):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {card.endingInstallments.map((inst, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex justify-between items-center">
                              <span className="text-slate-300 truncate max-w-[180px]">{inst.description}</span>
                              <span className="text-emerald-400 font-bold">
                                Libera {formatCurrency(inst.amount)} em {inst.endsInMonth}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 7: FECHAMENTO MENSAL ================= */}
        {activeTab === 'closeout' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Resumo Executivo de Fechamento Mensal
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidado do mês ({monthlyCloseout.monthKey}) com comparativos de desempenho e maiores despesas.
              </p>
            </div>

            {/* Main KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium">Receitas Totais</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">
                  {formatCurrency(monthlyCloseout.incomeTotal)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {monthlyCloseout.incomeCount} lançamentos
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium">Despesas Totais</span>
                <span className="text-lg font-bold text-rose-400 mt-1 block">
                  {formatCurrency(monthlyCloseout.expenseTotal)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {monthlyCloseout.expenseCount} lançamentos
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium">Saldo Poupado</span>
                <span className={`text-lg font-bold mt-1 block ${monthlyCloseout.savedAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(monthlyCloseout.savedAmount)}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {monthlyCloseout.savedAmount >= 0 ? 'Superávit' : 'Déficit'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium">Taxa de Poupança</span>
                <span className="text-lg font-bold text-brand-400 mt-1 block">
                  {monthlyCloseout.savingsRate}%
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Meta saudável: ≥ 20%
                </span>
              </div>
            </div>

            {/* Achievements */}
            {monthlyCloseout.achievements.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Conquistas do Mês</span>
                </div>
                <ul className="space-y-1 text-xs">
                  {monthlyCloseout.achievements.map((ach, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{ach}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top Categories of the Month */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-850">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Top 5 Categorias com Maior Gasto no Mês
              </h3>
              <div className="space-y-3">
                {monthlyCloseout.topCategories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                      <span className="text-slate-300 font-bold">
                        {formatCurrency(cat.total)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Highest Single Expense */}
            {monthlyCloseout.highestExpense && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Maior Despesa Individual do Mês</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">{monthlyCloseout.highestExpense.description}</span>
                  <span className="text-slate-400">{monthlyCloseout.highestExpense.categoryName} • {formatDate(monthlyCloseout.highestExpense.date)}</span>
                </div>
                <span className="text-base font-bold text-rose-400">
                  {formatCurrency(monthlyCloseout.highestExpense.amount)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
