import React, { useState } from 'react';
import { Tag, PlusCircle, Edit2, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Category, CategoryType } from '../types';
import { CategoryModal } from './CategoryModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const CategoriesView: React.FC = () => {
  const { categories, refreshAll, showToast } = useFinancial();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [modalDefaultType, setModalDefaultType] = useState<CategoryType>('expense');
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteCategory(deleteCandidate.id);
      showToast('Categoria excluída com sucesso!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir categoria', 'error');
    }
  };

  const openNewCategory = (type: CategoryType) => {
    setEditingCategory(null);
    setModalDefaultType(type);
    setModalOpen(true);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Categorias</h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalize as categorias usadas para classificar receitas e despesas.
          </p>
        </div>

        <button
          onClick={() => openNewCategory('expense')}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Nova categoria
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Despesas Categories Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold text-white">Categorias de Despesa</h2>
              <span className="text-xs text-slate-500 font-mono">({expenseCategories.length})</span>
            </div>

            <button
              onClick={() => openNewCategory('expense')}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
            >
              + Adicionar
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 divide-y divide-slate-800/60 overflow-hidden shadow-sm">
            {expenseCategories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: cat.color || '#f59e0b' }}
                  />
                  <div>
                    <span className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {cat.transactionCount || 0} lançamentos
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setModalOpen(true);
                    }}
                    title="Editar"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteCandidate(cat)}
                    title="Excluir"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Receitas Categories Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Categorias de Receita</h2>
              <span className="text-xs text-slate-500 font-mono">({incomeCategories.length})</span>
            </div>

            <button
              onClick={() => openNewCategory('income')}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
            >
              + Adicionar
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 divide-y divide-slate-800/60 overflow-hidden shadow-sm">
            {incomeCategories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: cat.color || '#10b981' }}
                  />
                  <div>
                    <span className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {cat.transactionCount || 0} lançamentos
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setModalOpen(true);
                    }}
                    title="Editar"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteCandidate(cat)}
                    title="Excluir"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCategory(null);
        }}
        categoryToEdit={editingCategory}
        defaultType={modalDefaultType}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Categoria"
        message={`Deseja excluir a categoria "${deleteCandidate?.name}"? Isso só será possível se não houver nenhum lançamento associado a ela.`}
        confirmLabel="Sim, excluir"
      />
    </div>
  );
};
