import React, { useState, useEffect } from 'react';
import { Scale, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Calendar, FileText } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFinancial } from '../context/FinancialContext';
import { Account } from '../types';
import { formatCurrency, getTodayDateString } from '../utils/formatters';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  isOpen,
  onClose,
  account,
}) => {
  const { refreshAll, showToast } = useFinancial();

  const [targetBalanceStr, setTargetBalanceStr] = useState('');
  const [isNegative, setIsNegative] = useState(false);
  const [adjustmentDate, setAdjustmentDate] = useState(getTodayDateString());
  const [mode, setMode] = useState<'transaction' | 'initial_balance'>('transaction');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && account) {
      setErrorMsg('');
      const current = account.currentBalance || 0;
      setIsNegative(current < 0);
      const absCents = Math.abs(current);
      const formatted = (absCents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setTargetBalanceStr(formatted);
      setAdjustmentDate(getTodayDateString());
      setMode('transaction');
      setNotes('Ajuste de reconciliação com saldo real bancário');
    }
  }, [isOpen, account]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setTargetBalanceStr('');
      return;
    }
    const cents = parseInt(val, 10);
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setTargetBalanceStr(formatted);
  };

  const getTargetBalanceCents = (): number => {
    if (!targetBalanceStr) return 0;
    const clean = targetBalanceStr.replace(/\./g, '').replace(',', '.');
    const cents = Math.round(parseFloat(clean) * 100);
    return isNegative ? -cents : cents;
  };

  const currentCents = account?.currentBalance || 0;
  const targetCents = getTargetBalanceCents();
  const diffCents = targetCents - currentCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setErrorMsg('');

    if (diffCents === 0) {
      setErrorMsg('O saldo informado já é idêntico ao saldo atual da conta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await window.electronAPI.adjustAccountBalance({
        accountId: account.id,
        targetBalance: targetCents,
        adjustmentDate,
        mode,
        notes: notes.trim() || undefined,
      });

      showToast(
        mode === 'transaction'
          ? `Lançamento de ajuste de ${formatCurrency(Math.abs(diffCents))} registrado com sucesso!`
          : 'Saldo inicial da conta ajustado com sucesso!',
        'success'
      );

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ajustar saldo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ajustar Saldo: ${account.name}`}
      subtitle="Acerte o saldo para coincidir com a realidade do seu banco a partir de hoje"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Current Balance Display */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: account.color || '#3b82f6' }}
            >
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Saldo Atual no App</p>
              <p className="text-sm font-bold text-white">{formatCurrency(currentCents)}</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
            {account.type === 'checking' ? 'Conta Corrente' : account.type === 'savings' ? 'Poupança' : 'Conta'}
          </span>
        </div>

        {/* Real Balance Input */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Qual é o Saldo Real no Banco Hoje? <span className="text-rose-400">*</span>
          </label>
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setIsNegative(!isNegative)}
              title="Clique para alternar entre saldo positivo ou negativo"
              className={`absolute left-2.5 z-10 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                isNegative
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {isNegative ? '-' : '+'}
            </button>
            <span className="absolute left-12 text-sm font-semibold text-slate-400">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={targetBalanceStr}
              onChange={handleAmountChange}
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-20 pr-4 py-3 text-lg font-bold text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Real-time Difference Preview */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            diffCents > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : diffCents < 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-slate-950/40 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {diffCents > 0 ? (
                <ArrowUpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : diffCents < 0 ? (
                <ArrowDownCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="text-xs font-semibold">
                {diffCents > 0
                  ? 'Diferença: Receita de Ajuste'
                  : diffCents < 0
                  ? 'Diferença: Despesa de Ajuste'
                  : 'Saldos já coincidem'}
              </span>
            </div>
            <span className="text-sm font-bold font-mono">
              {diffCents > 0 ? `+ ${formatCurrency(diffCents)}` : formatCurrency(diffCents)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            {diffCents > 0
              ? `Será criada uma entrada de ${formatCurrency(diffCents)} para equiparar o saldo a partir desta data.`
              : diffCents < 0
              ? `Será criada uma saída de ${formatCurrency(Math.abs(diffCents))} para equiparar o saldo a partir desta data.`
              : 'Nenhum lançamento é necessário, pois os valores já são iguais.'}
          </p>
        </div>

        {/* Date of Adjustment */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Data do Ajuste (Marco Zero)
          </label>
          <input
            type="date"
            value={adjustmentDate}
            onChange={(e) => setAdjustmentDate(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-300">Como aplicar o ajuste?</label>

          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            mode === 'transaction'
              ? 'bg-brand-500/10 border-brand-500/40'
              : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
          }`}>
            <input
              type="radio"
              name="adjustMode"
              checked={mode === 'transaction'}
              onChange={() => setMode('transaction')}
              className="mt-1 text-brand-600 focus:ring-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Criar Lançamento de Ajuste</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Gera uma transação transparente de reconciliação hoje. O histórico passado permanece intacto e auditável.
              </p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            mode === 'initial_balance'
              ? 'bg-brand-500/10 border-brand-500/40'
              : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
          }`}>
            <input
              type="radio"
              name="adjustMode"
              checked={mode === 'initial_balance'}
              onChange={() => setMode('initial_balance')}
              className="mt-1 text-brand-600 focus:ring-0"
            />
            <div>
              <span className="text-xs font-bold text-white">Recalcular Saldo Inicial da Conta</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Altera o saldo inicial sem adicionar uma nova linha ao extrato de transações.
              </p>
            </div>
          </label>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Observação (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Reconciliação bancária mensal"
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || diffCents === 0}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'Ajustando...' : 'Confirmar Ajuste de Saldo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
