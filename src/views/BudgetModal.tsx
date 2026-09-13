import React, { useState, useEffect } from 'react';
import { Target, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { CategoryBudget } from '../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetToEdit: CategoryBudget | null;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgetToEdit,
}) => {
  const { categories, refreshAll, showToast } = useFinancial();

  const [categoryId, setCategoryId] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [alertPercentage, setAlertPercentage] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const expenseCategories = categories.filter(c => c.type === 'expense');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (budgetToEdit) {
        setCategoryId(budgetToEdit.categoryId);
        setLimitStr(((budgetToEdit.amountLimit || 0) / 100).toFixed(2).replace('.', ','));
        setAlertPercentage(budgetToEdit.alertPercentage || 80);
      } else {
        const first = expenseCategories[0];
        setCategoryId(first ? first.id : '');
        setLimitStr('');
        setAlertPercentage(80);
      }
    }
  }, [isOpen, budgetToEdit, expenseCategories]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setLimitStr('');
      return;
    }
    const cents = parseInt(val, 10);
    setLimitStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const getLimitCents = (): number => {
    if (!limitStr) return 0;
    const clean = limitStr.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg('Selecione uma categoria de despesa.');
      return;
    }
    const cents = getLimitCents();
    if (cents <= 0) {
      setErrorMsg('Informe um valor de teto maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await window.electronAPI.setCategoryBudget({
        categoryId,
        amountLimit: cents,
        alertPercentage,
      });

      showToast('Teto orçamentário configurado com sucesso!', 'success');
      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar orçamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={budgetToEdit ? 'Editar Teto Orçamentário' : 'Novo Teto por Categoria'}
      subtitle="Defina o valor máximo que você planeja gastar por mês nesta categoria"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Categoria de Despesa <span className="text-rose-400">*</span>
          </label>
          <CustomSelect
            value={categoryId}
            disabled={Boolean(budgetToEdit)}
            onChange={(val) => setCategoryId(val)}
            options={expenseCategories.map((c) => ({
              value: c.id,
              label: c.name,
              color: c.color,
            }))}
            placeholder="Selecione a categoria"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Limite Mensal Máximo (R$) <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              R$
            </span>
            <input
              type="text"
              placeholder="0,00"
              value={limitStr}
              onChange={handleLimitChange}
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Avisar ao atingir: <strong className="text-white">{alertPercentage}%</strong> do teto
          </label>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={alertPercentage}
            onChange={(e) => setAlertPercentage(parseInt(e.target.value, 10))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>50%</span>
            <span>70%</span>
            <span>80% (Padrão)</span>
            <span>90%</span>
            <span>95%</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Teto'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
