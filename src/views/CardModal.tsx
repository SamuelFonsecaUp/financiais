import React, { useState, useEffect } from 'react';
import { CreditCard as CardIcon, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { CreditCard } from '../types';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit: CreditCard | null;
}

const cardColors = [
  '#8b5cf6', // purple (Nubank Ultravioleta)
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f97316', // orange
  '#ef4444', // red
  '#e11d48', // rose
  '#334155', // dark slate
];

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  cardToEdit,
}) => {
  const { refreshAll, showToast } = useFinancial();

  const [name, setName] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [closingDay, setClosingDay] = useState(25);
  const [dueDay, setDueDay] = useState(5);
  const [color, setColor] = useState('#8b5cf6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (cardToEdit) {
        setName(cardToEdit.name);
        setLimitStr(((cardToEdit.creditLimit || 0) / 100).toFixed(2).replace('.', ','));
        setClosingDay(cardToEdit.closingDay);
        setDueDay(cardToEdit.dueDay);
        setColor(cardToEdit.color || '#8b5cf6');
      } else {
        setName('');
        setLimitStr('');
        setClosingDay(25);
        setDueDay(5);
        setColor('#8b5cf6');
      }
    }
  }, [isOpen, cardToEdit]);

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
    if (!name.trim()) {
      setErrorMsg('Informe o nome do cartão.');
      return;
    }
    const limit = getLimitCents();
    if (limit <= 0) {
      setErrorMsg('Informe um limite de crédito maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        creditLimit: limit,
        closingDay,
        dueDay,
        color,
      };

      if (cardToEdit) {
        await window.electronAPI.updateCreditCard(cardToEdit.id, payload);
        showToast('Cartão de crédito atualizado com sucesso!', 'success');
      } else {
        await window.electronAPI.createCreditCard(payload);
        showToast('Cartão de crédito criado com sucesso!', 'success');
      }

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar cartão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cardToEdit ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
      subtitle="Cadastre o limite e as datas de fechamento e vencimento da fatura"
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
            Nome do Cartão <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Nubank Ultravioleta, C6 Carbon..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Limite Total (R$) <span className="text-rose-400">*</span>
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
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dia do Fechamento
            </label>
            <CustomSelect
              value={closingDay}
              onChange={(val) => setClosingDay(Number(val))}
              options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({
                value: d,
                label: `Dia ${d}`,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dia do Vencimento
            </label>
            <CustomSelect
              value={dueDay}
              onChange={(val) => setDueDay(Number(val))}
              options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({
                value: d,
                label: `Dia ${d}`,
              }))}
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Cor do Cartão</label>
          <div className="flex items-center gap-2">
            {cardColors.map((c) => (
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
            {isSubmitting ? 'Salvando...' : cardToEdit ? 'Salvar' : 'Criar Cartão'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
