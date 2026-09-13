import React, { useState } from 'react';
import { Target, Plus, AlertTriangle, CheckCircle, Flame, Edit2, Trash2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { CategoryBudget } from '../types';
import { BudgetModal } from './BudgetModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const BudgetsView: React.FC = () => {
  const { budgets, refreshAll, showToast } = useFinancial();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<CategoryBudget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<CategoryBudget | null>(null);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalLimit = budgets.reduce((acc, b) => acc + (b.amountLimit || 0), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spentAmount || 0), 0);
  const totalRemaining = Math.max(0, totalLimit - totalSpent);
  const globalPercentage = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0;

  const handleEdit = (budget: CategoryBudget) => {
    setSelectedBudget(budget);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedBudget(null);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingBudget) return;
    try {
      await window.electronAPI.deleteCategoryBudget(deletingBudget.id);
      showToast('Teto orçamentário removido.', 'info');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir orçamento.', 'error');
    } finally {
      setDeletingBudget(null);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Target className="w-7 h-7 text-brand-400" />
            Orçamentos & Tetos de Gastos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Defina limites mensais para categorias e evite surpresas no final do mês.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          Novo Teto
        </button>
      </div>

      {/* Global Overview Card */}
      {budgets.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <div>
              <span className="text-xs font-medium text-slate-400">Total Planejado no Mês</span>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{formatCurrency(totalLimit)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400">Gasto Atual em Categorias com Teto</span>
              <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{formatCurrency(totalSpent)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400">Margem Restante Geral</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{formatCurrency(totalRemaining)}</p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-400 font-medium">Consumo Global do Orçamento</span>
              <span className={`font-bold ${globalPercentage > 100 ? 'text-rose-400' : globalPercentage >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {globalPercentage}% utilizado
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  globalPercentage >= 100
                    ? 'bg-rose-500'
                    : globalPercentage >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, globalPercentage)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">Nenhum teto orçamentário configurado</h3>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            Defina limites máximos de gastos para categorias como Alimentação, Lazer ou Transporte para manter suas finanças sob controle.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-600/20"
          >
            <Plus className="w-4 h-4" />
            Configurar Primeiro Teto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map((b) => {
            const isExceeded = b.status === 'exceeded' || b.percentage >= 100;
            const isWarning = b.status === 'warning' || (b.percentage >= (b.alertPercentage || 80) && !isExceeded);
            const clampedWidth = Math.min(100, b.percentage);

            return (
              <div
                key={b.id}
                className={`bg-slate-900/80 border rounded-2xl p-5 transition-all relative overflow-hidden flex flex-col justify-between ${
                  isExceeded
                    ? 'border-rose-500/40 shadow-lg shadow-rose-500/5'
                    : isWarning
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                        style={{ backgroundColor: b.categoryColor || '#6366f1' }}
                      >
                        {b.categoryName?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm tracking-tight">{b.categoryName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isExceeded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                              <Flame className="w-3 h-3" /> Limite Estourado
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Perto do Limite
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                              <CheckCircle className="w-3 h-3" /> Sob Controle
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(b)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar teto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingBudget(b)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Excluir teto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-400 font-medium">Gasto:</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {formatCurrency(b.spentAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-400 font-medium">Teto Máximo:</span>
                      <span className="font-mono font-medium text-slate-300">
                        {formatCurrency(b.amountLimit)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800/80 mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded
                          ? 'bg-rose-500'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${clampedWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{b.percentage}% gasto</span>
                    <span>
                      {isExceeded ? (
                        <strong className="text-rose-400">
                          Excedido em {formatCurrency(b.spentAmount - b.amountLimit)}
                        </strong>
                      ) : (
                        <span className="text-emerald-400">
                          Resta {formatCurrency(b.remainingAmount)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Alerta configurado para {b.alertPercentage}%</span>
                  <span className="uppercase tracking-wider font-mono">{b.monthKey}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <BudgetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        budgetToEdit={selectedBudget}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingBudget)}
        title="Remover Teto Orçamentário"
        message={`Deseja remover o limite de gastos para a categoria "${deletingBudget?.categoryName}"? Os lançamentos não serão afetados.`}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDeletingBudget(null)}
        isDestructive
      />
    </div>
  );
};
