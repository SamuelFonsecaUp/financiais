import React, { useState } from 'react';
import {
  CalendarClock,
  PlusCircle,
  Play,
  Pause,
  Zap,
  Edit2,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Landmark,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { RecurringRule } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { RecurringModal } from './RecurringModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export const RecurringView: React.FC = () => {
  const { recurringRules, refreshAll, showToast } = useFinancial();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<RecurringRule | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  const filteredRules = recurringRules.filter(r => filterType === 'all' || r.type === filterType);

  // Aggregations of monthly recurring amounts
  const totalMonthlyExpense = recurringRules
    .filter(r => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalMonthlyIncome = recurringRules
    .filter(r => r.active && r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const netFixed = totalMonthlyIncome - totalMonthlyExpense;

  const handleToggle = async (rule: RecurringRule) => {
    try {
      const active = await window.electronAPI.toggleRecurringRule(rule.id);
      showToast(active ? `"${rule.description}" reativado!` : `"${rule.description}" pausado.`, 'info');
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao alterar status', 'error');
    }
  };

  const handleExecuteNow = async (rule: RecurringRule) => {
    try {
      await window.electronAPI.executeRecurringNow(rule.id);
      showToast(`Lançamento "${rule.description}" registrado com sucesso!`, 'success');
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao lançar transação', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteRecurringRule(deleteCandidate.id);
      showToast('Lançamento recorrente excluído!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao excluir regra', 'error');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recorrentes & Cobranças</h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle suas despesas fixas, assinaturas, salários e vencimentos programados.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRule(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Novo recorrente
        </button>
      </div>

      {/* Monthly Commitment Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Despesas Fixas Mensais
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {formatCurrency(totalMonthlyExpense)}
          </div>
          <span className="text-[11px] text-slate-500">Compromisso fixo todo mês</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Receitas Fixas Mensais
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {formatCurrency(totalMonthlyIncome)}
          </div>
          <span className="text-[11px] text-slate-500">Salários e ganhos garantidos</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Balanço Fixo Líquido
            </span>
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono ${netFixed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netFixed, true)}
          </div>
          <span className="text-[11px] text-slate-500">Saldo restante antes de variáveis</span>
        </div>
      </div>

      {/* Rules List */}
      {recurringRules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhum lançamento recorrente cadastrado"
          description="Cadastre seus custos fixos mensais (como aluguel, condomínio, internet, assinaturas e salário) para previsão financeira automática."
          actionLabel="Novo recorrente"
          onAction={() => {
            setEditingRule(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({recurringRules.length})
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'expense' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                Despesas ({recurringRules.filter(r => r.type === 'expense').length})
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                Receitas ({recurringRules.filter(r => r.type === 'income').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule) => {
              const isIncome = rule.type === 'income';

              return (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    rule.active
                      ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 shadow-sm'
                      : 'bg-slate-950/40 border-slate-850 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {isIncome ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-tight">{rule.description}</h3>
                          <span className="text-[11px] text-slate-400">
                            {rule.categoryName || 'Geral'} • Todo dia {rule.billingDay || rule.nextDueDate.slice(-2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setModalOpen(true);
                          }}
                          title="Editar"
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(rule)}
                          title="Excluir"
                          className="p-1 text-slate-400 hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="my-3">
                      <div className={`text-xl font-bold font-mono ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(rule.amount)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Próxima cobrança: <strong className="text-slate-300">{formatDate(rule.nextDueDate)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-4">
                      {rule.creditCardName ? (
                        <span className="flex items-center gap-1 text-purple-300">
                          <CreditCard className="w-3 h-3" /> {rule.creditCardName}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Landmark className="w-3 h-3" /> {rule.accountName || 'Conta Padrão'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        rule.active
                          ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                          : 'text-emerald-400 bg-emerald-500/10'
                      }`}
                    >
                      {rule.active ? (
                        <>
                          <Pause className="w-3 h-3" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> Reativar
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleExecuteNow(rule)}
                      title="Registrar lançamento imediatamente agora"
                      className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-all shadow-sm active:scale-95 text-[11px]"
                    >
                      <Zap className="w-3 h-3" /> Lançar Agora
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring Modal */}
      <RecurringModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
        ruleToEdit={editingRule}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Regra Recorrente"
        message={`Deseja excluir o lançamento recorrente "${deleteCandidate?.description}"? Lançamentos já gerados no passado não serão alterados.`}
        confirmLabel="Sim, excluir"
      />
    </div>
  );
};
