import React, { useState, useEffect } from 'react';
import { PlusCircle, Check, Landmark } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { Goal } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
}

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  goal,
}) => {
  const { accounts, refreshAll, showToast } = useFinancial();

  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setAmountStr('');
      const defaultAcc = accounts.find(a => a.active);
      setAccountId(defaultAcc ? defaultAcc.id : '');
    }
  }, [isOpen, accounts]);

  if (!goal) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setAmountStr('');
      return;
    }
    const cents = parseInt(val, 10);
    setAmountStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const getAmountCents = (): number => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = getAmountCents();
    if (cents <= 0) {
      setErrorMsg('Informe um valor de aporte maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await window.electronAPI.addFundsToGoal(goal.id, cents, accountId || undefined);
      showToast(`Aporte de ${formatCurrency(cents)} adicionado à meta "${goal.name}"!`, 'success');
      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao adicionar aporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Aporte"
      subtitle={`Meta: ${goal.name}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Falta para atingir:</span>
          <span className="font-bold text-white font-mono">{formatCurrency(remaining)}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Valor do Aporte (R$) <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
              R$
            </span>
            <input
              type="text"
              placeholder="0,00"
              value={amountStr}
              onChange={handleAmountChange}
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Debitar da Conta Bancária (opcional)
          </label>
          <CustomSelect
            value={accountId}
            onChange={(val) => setAccountId(val)}
            options={[
              { value: '', label: 'Apenas somar na meta (sem debitar conta)' },
              ...accounts.filter(a => a.active).map((acc) => ({
                value: acc.id,
                label: acc.name,
                subtitle: `Saldo: ${formatCurrency(acc.currentBalance)}`,
                icon: Landmark,
              })),
            ]}
            placeholder="Selecione a conta (opcional)"
          />
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
            {isSubmitting ? 'Salvando...' : 'Adicionar Aporte'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
