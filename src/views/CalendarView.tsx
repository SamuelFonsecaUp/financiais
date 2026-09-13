import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { CalendarData, CalendarDayData } from '../types';

export const CalendarView: React.FC = () => {
  const { openNewTransaction } = useFinancial();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const loadCalendar = async (y: number, m: number) => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      const data = await window.electronAPI.getCalendarData(y, m);
      setCalendarData(data);

      // Auto-select today if in current month
      const todayDayNum = today.getDate();
      if (y === today.getFullYear() && m === today.getMonth() + 1) {
        const found = data.days.find((d: CalendarDayData) => d.day === todayDayNum);
        setSelectedDay(found || data.days[0] || null);
      } else {
        setSelectedDay(data.days[0] || null);
      }
    } catch (e) {
      console.error('Error fetching calendar data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Calculate day-of-week for the 1st day of the month
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun, 6 = Sat
  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-brand-400" />
            Calendário & Projeção Financeira
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acompanhe o fluxo diário de entradas e saídas e a projeção do seu saldo bancário futuro.
          </p>
        </div>

        {/* Month selector & Today button */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm text-white px-3 min-w-[140px] text-center">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-brand-400 rounded-xl transition-colors ml-1"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Projection Cards */}
      {calendarData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" /> Saldo Atual Total
            </span>
            <p className="text-xl font-bold text-white font-mono mt-1">
              {formatCurrency(calendarData.currentBalance)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Entradas Previstas
            </span>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
              + {formatCurrency(calendarData.pendingFutureIncome)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" /> Saídas Previstas
            </span>
            <p className="text-xl font-bold text-rose-400 font-mono mt-1">
              - {formatCurrency(calendarData.pendingFutureExpense)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-brand-500/30 p-4 rounded-2xl shadow-lg shadow-brand-500/5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-400 font-semibold uppercase tracking-wider">
                Projeção Fim do Mês
              </span>
              <TrendingUp className="w-4 h-4 text-brand-400" />
            </div>
            <p
              className={`text-xl font-bold font-mono mt-1 ${
                calendarData.projectedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(calendarData.projectedBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid + Selected Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols wide on desktop) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {weekDays.map((w, idx) => (
              <div key={idx} className={idx === 0 || idx === 6 ? 'text-slate-500' : ''}>
                {w}
              </div>
            ))}
          </div>

          {/* Month days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[72px] rounded-xl bg-slate-950/20 opacity-30" />
            ))}

            {calendarData?.days.map((day) => {
              const isToday = day.date === todayStr;
              const isSelected = selectedDay?.date === day.date;
              const hasActivity = day.income > 0 || day.expense > 0;

              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[72px] p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10'
                      : isToday
                      ? 'border-brand-500/40 bg-slate-800/80'
                      : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-brand-600 text-white shadow-sm'
                          : isSelected
                          ? 'text-brand-300 font-extrabold'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.day}
                    </span>
                    {day.count > 0 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {day.count} {day.count === 1 ? 'item' : 'itens'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 mt-1">
                    {day.income > 0 && (
                      <div className="text-[10px] font-mono font-bold text-emerald-400 truncate">
                        +{formatCurrency(day.income).replace('R$', '').trim()}
                      </div>
                    )}
                    {day.expense > 0 && (
                      <div className="text-[10px] font-mono font-bold text-rose-400 truncate">
                        -{formatCurrency(day.expense).replace('R$', '').trim()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedDay ? (
                    <>
                      {selectedDay.date.split('-').reverse().join('/')}
                    </>
                  ) : (
                    'Selecione um dia'
                  )}
                </h3>
                <span className="text-xs text-slate-400">
                  {selectedDay?.items.length || 0}{' '}
                  {(selectedDay?.items.length || 0) === 1 ? 'lançamento no dia' : 'lançamentos no dia'}
                </span>
              </div>

              {selectedDay && (
                <button
                  onClick={() => openNewTransaction({ transactionDate: selectedDay.date })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lançar
                </button>
              )}
            </div>

            {/* Daily balance summary */}
            {selectedDay && (selectedDay.income > 0 || selectedDay.expense > 0) && (
              <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px]">Entradas do dia</span>
                  <p className="font-mono font-bold text-emerald-400 mt-0.5">
                    +{formatCurrency(selectedDay.income)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Saídas do dia</span>
                  <p className="font-mono font-bold text-rose-400 mt-0.5">
                    -{formatCurrency(selectedDay.expense)}
                  </p>
                </div>
              </div>
            )}

            {/* List of items */}
            <div className="space-y-2.5 mt-4 max-h-[380px] overflow-y-auto pr-1">
              {!selectedDay || selectedDay.items.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum lançamento registrado nesta data.
                </div>
              ) : (
                selectedDay.items.map((item) => {
                  const isExp = item.type === 'expense';
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.categoryColor || (isExp ? '#f43f5e' : '#10b981') }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate" title={item.description}>
                            {item.description}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {item.categoryName || (isExp ? 'Despesa' : 'Receita')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-xs font-mono font-bold ${isExp ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isExp ? '-' : '+'} {formatCurrency(item.amount)}
                        </p>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                          {item.status === 'completed' ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Pago
                            </>
                          ) : (
                            <>
                              <Clock className="w-2.5 h-2.5 text-amber-400" /> Pendente
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
