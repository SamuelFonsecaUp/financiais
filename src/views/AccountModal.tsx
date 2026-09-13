import React, { useState, useEffect } from 'react';
import { Landmark, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { Account, AccountType } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit: Account | null;
}

const colorOptions = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#eab308', // yellow
  '#64748b', // slate
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accountToEdit,
}) => {
  const { refreshAll, showToast } = useFinancial();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [initialBalanceStr, setInitialBalanceStr] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setInitialBalanceStr(((accountToEdit.initialBalance || 0) / 100).toFixed(2).replace('.', ','));
        setColor(accountToEdit.color || '#3b82f6');
      } else {
        setName('');
        setType('checking');
        setInitialBalanceStr('0,00');
        setColor('#3b82f6');
      }
    }
  }, [isOpen, accountToEdit]);

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setInitialBalanceStr('0,00');
      return;
    }
    const cents = parseInt(val, 10);
    setInitialBalanceStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const getBalanceCents = (): number => {
    if (!initialBalanceStr) return 0;
    const clean = initialBalanceStr.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da conta bancária ou carteira.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        initialBalance: getBalanceCents(),
        color,
      };

      if (accountToEdit) {
        await window.electronAPI.updateAccount(accountToEdit.id, payload);
        showToast('Conta atualizada com sucesso!', 'success');
      } else {
        await window.electronAPI.createAccount(payload);
        showToast('Conta criada com sucesso!', 'success');
      }

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={accountToEdit ? 'Editar Conta' : 'Nova Conta'}
      subtitle="Cadastre suas contas bancárias, carteiras ou investimentos"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Nome da Conta <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Nubank, Itaú, Carteira..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Tipo de Conta
            </label>
            <CustomSelect
              value={type}
              onChange={(val) => setType(val as AccountType)}
              options={[
                { value: 'checking', label: 'Conta Corrente' },
                { value: 'savings', label: 'Poupança' },
                { value: 'cash', label: 'Dinheiro em Espécie' },
                { value: 'wallet', label: 'Carteira Digital' },
                { value: 'investment', label: 'Investimento' },
                { value: 'other', label: 'Outro' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Saldo Inicial (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                R$
              </span>
              <input
                type="text"
                value={initialBalanceStr}
                onChange={handleBalanceChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Cor do Card</label>
          <div className="flex items-center gap-2">
            {colorOptions.map((c) => (
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
            {isSubmitting ? 'Salvando...' : accountToEdit ? 'Salvar' : 'Criar Conta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
