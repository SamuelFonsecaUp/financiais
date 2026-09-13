import React, { useState, useEffect } from 'react';
import { Target, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFinancial } from '../context/FinancialContext';
import { Goal } from '../types';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit: Goal | null;
}

const goalColors = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  goalToEdit,
}) => {
  const { refreshAll, showToast } = useFinancial();

  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [currentStr, setCurrentStr] = useState('0,00');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (goalToEdit) {
        setName(goalToEdit.name);
        setTargetStr(((goalToEdit.targetAmount || 0) / 100).toFixed(2).replace('.', ','));
        setCurrentStr(((goalToEdit.currentAmount || 0) / 100).toFixed(2).replace('.', ','));
        setTargetDate(goalToEdit.targetDate || '');
        setColor(goalToEdit.color || '#3b82f6');
        setNotes(goalToEdit.notes || '');
      } else {
        setName('');
        setTargetStr('');
        setCurrentStr('0,00');
        setTargetDate('');
        setColor('#3b82f6');
        setNotes('');
      }
    }
  }, [isOpen, goalToEdit]);

  const handleCurrencyFormat = (val: string, setter: (s: string) => void) => {
    let clean = val.replace(/\D/g, '');
    if (!clean) {
      setter('0,00');
      return;
    }
    const cents = parseInt(clean, 10);
    setter((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const parseCents = (s: string) => {
    if (!s) return 0;
    const clean = s.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da meta.');
      return;
    }
    const target = parseCents(targetStr);
    if (target <= 0) {
      setErrorMsg('Informe um valor alvo maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        targetAmount: target,
        currentAmount: parseCents(currentStr),
        targetDate: targetDate || null,
        color,
        notes: notes.trim() || null,
      };

      if (goalToEdit) {
        await window.electronAPI.updateGoal(goalToEdit.id, payload);
        showToast('Meta atualizada com sucesso!', 'success');
      } else {
        await window.electronAPI.createGoal(payload);
        showToast('Meta criada com sucesso!', 'success');
      }

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar meta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goalToEdit ? 'Editar Meta Financeira' : 'Nova Meta Financeira'}
      subtitle="Defina objetivos como reserva de emergência, viagens ou compras"
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
            Nome da Meta <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Viagem de Férias, Notebook Novo, Reserva..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Valor Alvo (R$) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                R$
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={targetStr}
                onChange={(e) => handleCurrencyFormat(e.target.value, setTargetStr)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Valor Inicial Guardado (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                R$
              </span>
              <input
                type="text"
                value={currentStr}
                onChange={(e) => handleCurrencyFormat(e.target.value, setCurrentStr)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Data Limite Desejada (opcional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Cor da Meta</label>
          <div className="flex items-center gap-2">
            {goalColors.map((c) => (
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

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Anotações (opcional)
          </label>
          <textarea
            rows={2}
            placeholder="Detalhes ou planos para atingir esta meta..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
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
            {isSubmitting ? 'Salvando...' : goalToEdit ? 'Salvar Alterações' : 'Criar Meta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
