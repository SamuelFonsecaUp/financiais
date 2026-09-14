import React, { useState, useEffect } from 'react';
import { Tag, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFinancial } from '../context/FinancialContext';
import { Category, CategoryType } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit: Category | null;
  defaultType?: CategoryType;
  onSuccess?: (created: Category) => void;
}

const categoryColors = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#6366f1',
  '#f97316', '#14b8a6', '#a855f7', '#94a3b8'
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categoryToEdit,
  defaultType = 'expense',
  onSuccess,
}) => {
  const { refreshAll, showToast } = useFinancial();

  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(defaultType);
  const [color, setColor] = useState('#10b981');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setType(categoryToEdit.type);
        setColor(categoryToEdit.color || '#10b981');
      } else {
        setName('');
        setType(defaultType);
        setColor(defaultType === 'income' ? '#10b981' : '#f59e0b');
      }
    }
  }, [isOpen, categoryToEdit, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da categoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (categoryToEdit) {
        await window.electronAPI.updateCategory(categoryToEdit.id, {
          name: name.trim(),
          color,
        });
        showToast('Categoria atualizada com sucesso!', 'success');
      } else {
        const created = await window.electronAPI.createCategory({
          name: name.trim(),
          type,
          color,
        });
        showToast('Categoria criada com sucesso!', 'success');
        if (onSuccess && created) {
          onSuccess(created);
        }
      }

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoryToEdit ? 'Editar Categoria' : 'Nova Categoria'}
      subtitle="Organize seus lançamentos por categorias de receita ou despesa"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        {!categoryToEdit && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setColor('#f59e0b');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setColor('#10b981');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Receita
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Nome da Categoria <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Farmácia, Cinema, Bônus..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Cor da Categoria</label>
          <div className="grid grid-cols-6 gap-2">
            {categoryColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                  color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Salvando...' : categoryToEdit ? 'Salvar' : 'Criar Categoria'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
