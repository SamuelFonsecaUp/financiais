import React, { useState } from 'react';
import { Target, PlusCircle, Plus, Edit2, Trash2, Calendar, CheckCircle2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Goal } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { GoalModal } from './GoalModal';
import { AddFundsModal } from './AddFundsModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export const GoalsView: React.FC = () => {
  const { goals, refreshAll, showToast } = useFinancial();

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Goal | null>(null);
  const [fundingGoal, setFundingGoal] = useState<Goal | null>(null);

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteGoal(deleteCandidate.id);
      showToast('Meta excluída com sucesso!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir meta', 'error');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Metas Financeiras</h1>
          <p className="text-sm text-slate-400 mt-1">
            Defina e acompanhe seus objetivos de poupança, viagens e patrimônio.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingGoal(null);
            setGoalModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Nova meta
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta cadastrada"
          description="Crie metas para sua reserva de emergência, uma viagem ou um novo bem e acompanhe seu progresso mês a mês."
          actionLabel="Nova meta"
          onAction={() => {
            setEditingGoal(null);
            setGoalModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Progress Overview Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Progresso Total de Economia
                </span>
                <div className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
                  {formatCurrency(totalSaved)} de {formatCurrency(totalTarget)}
                </div>
              </div>

              <div className="text-right">
                <span className="text-3xl font-black text-brand-400 font-mono">
                  {overallPercentage}%
                </span>
              </div>
            </div>

            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>

          {/* Goals Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((goal) => {
              const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
              const isCompleted = goal.currentAmount >= goal.targetAmount;

              return (
                <div
                  key={goal.id}
                  className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 shadow-sm flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Goal Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                          style={{ backgroundColor: goal.color || '#3b82f6' }}
                        >
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white tracking-tight">
                            {goal.name}
                          </h3>
                          {goal.targetDate && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>Prazo: {formatDate(goal.targetDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingGoal(goal);
                            setGoalModalOpen(true);
                          }}
                          title="Editar Meta"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(goal)}
                          title="Excluir Meta"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Amounts */}
                    <div className="my-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Progresso</span>
                        <span className="font-bold text-white font-mono flex items-center gap-1">
                          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          {goal.percentage}%
                        </span>
                      </div>

                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${goal.percentage}%`,
                            backgroundColor: isCompleted ? '#10b981' : goal.color || '#3b82f6',
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Guardado</span>
                          <span className="font-bold text-white font-mono">{formatCurrency(goal.currentAmount)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">Meta</span>
                          <span className="font-bold text-slate-300 font-mono">{formatCurrency(goal.targetAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {goal.notes && (
                      <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 mt-2 line-clamp-2">
                        {goal.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {isCompleted ? (
                        <strong className="text-emerald-400">Meta Concluída! 🎉</strong>
                      ) : (
                        <span>Faltam {formatCurrency(remaining)}</span>
                      )}
                    </span>

                    <button
                      onClick={() => setFundingGoal(goal)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-brand-400" />
                      Aporte
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Goal Modal */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        goalToEdit={editingGoal}
      />

      {/* Add Funds Modal */}
      <AddFundsModal
        isOpen={Boolean(fundingGoal)}
        onClose={() => setFundingGoal(null)}
        goal={fundingGoal}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Meta Financeira"
        message={`Deseja realmente excluir a meta "${deleteCandidate?.name}"?`}
        confirmLabel="Sim, excluir"
      />
    </div>
  );
};
