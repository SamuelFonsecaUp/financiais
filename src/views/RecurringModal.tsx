import React, { useState, useEffect } from 'react';
import { CalendarRepeat, Check, ArrowDownCircle, ArrowUpCircle, Landmark, CreditCard as CardIcon } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { RecurringRule } from '../types';
import { getTodayDateString } from '../utils/formatters';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleToEdit: RecurringRule | null;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  ruleToEdit,
}) => {
  const { accounts, categories, creditCards, refreshAll, showToast } = useFinancial();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [billingDay, setBillingDay] = useState<number>(5);
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [accountId, setAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'account' | 'card'>('account');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (ruleToEdit) {
        setType(ruleToEdit.type);
        setDescription(ruleToEdit.description);
        setAmountStr(((ruleToEdit.amount || 0) / 100).toFixed(2).replace('.', ','));
        setFrequency(ruleToEdit.frequency);
        setBillingDay(ruleToEdit.billingDay || 5);
        setStartDate(ruleToEdit.startDate || getTodayDateString());
        setAccountId(ruleToEdit.accountId || '');
        setCreditCardId(ruleToEdit.creditCardId || '');
        setPaymentMode(ruleToEdit.creditCardId ? 'card' : 'account');
        setCategoryId(ruleToEdit.categoryId || '');
        setAutoGenerate(ruleToEdit.autoGenerate);
        setNotes(ruleToEdit.notes || '');
      } else {
        setType('expense');
        setDescription('');
        setAmountStr('');
        setFrequency('monthly');
        setBillingDay(5);
        setStartDate(getTodayDateString());
        const defAcc = accounts.find(a => a.active);
        setAccountId(defAcc ? defAcc.id : '');
        setCreditCardId('');
        setPaymentMode('account');
        const defCat = categories.find(c => c.type === 'expense');
        setCategoryId(defCat ? defCat.id : '');
        setAutoGenerate(true);
        setNotes('');
      }
    }
  }, [isOpen, ruleToEdit, accounts, categories]);

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
    if (!description.trim()) {
      setErrorMsg('Informe a descrição do lançamento fixo.');
      return;
    }
    const cents = getAmountCents();
    if (cents <= 0) {
      setErrorMsg('Informe um valor maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        type,
        description: description.trim(),
        amount: cents,
        frequency,
        billingDay,
        startDate,
        categoryId: categoryId || null,
        autoGenerate,
        notes: notes.trim() || null,
      };

      if (paymentMode === 'card') {
        payload.creditCardId = creditCardId || null;
        payload.accountId = null;
      } else {
        payload.accountId = accountId || null;
        payload.creditCardId = null;
      }

      if (ruleToEdit) {
        await window.electronAPI.updateRecurringRule(ruleToEdit.id, payload);
        showToast('Lançamento recorrente atualizado!', 'success');
      } else {
        await window.electronAPI.createRecurringRule(payload);
        showToast('Lançamento recorrente cadastrado com sucesso!', 'success');
      }

      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar lançamento recorrente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ruleToEdit ? 'Editar Recorrente' : 'Novo Lançamento Fixo / Recorrente'}
      subtitle="Configure despesas ou receitas automáticas com cobrança programada"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setType('expense');
              const def = categories.find(c => c.type === 'expense');
              if (def) setCategoryId(def.id);
            }}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              type === 'expense'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            Despesa Fixa
          </button>
          <button
            type="button"
            onClick={() => {
              setType('income');
              setPaymentMode('account');
              const def = categories.find(c => c.type === 'income');
              if (def) setCategoryId(def.id);
            }}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              type === 'income'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Receita Fixa
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Descrição <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Aluguel, Netflix, Salário, Internet..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Valor (R$) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                R$
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={amountStr}
                onChange={handleAmountChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Periodicidade
            </label>
            <CustomSelect
              value={frequency}
              onChange={(val) => setFrequency(val)}
              options={[
                { value: 'monthly', label: 'Mensal' },
                { value: 'weekly', label: 'Semanal' },
                { value: 'yearly', label: 'Anual' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dia Fixo de Cobrança / Vencimento
            </label>
            <CustomSelect
              value={billingDay}
              onChange={(val) => setBillingDay(Number(val))}
              options={Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({
                value: d,
                label: `Todo dia ${d}`,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Categoria
            </label>
            <CustomSelect
              value={categoryId}
              onChange={(val) => setCategoryId(val)}
              options={[
                { value: '', label: 'Sem Categoria' },
                ...filteredCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  color: c.color,
                })),
              ]}
              placeholder="Sem Categoria"
            />
          </div>
        </div>

        {/* Source Account or Card */}
        {type === 'expense' && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Forma de Pagamento</label>
            <CustomSelect
              value={paymentMode === 'card' ? `card_${creditCardId}` : `acc_${accountId}`}
              onChange={(val: string) => {
                if (val.startsWith('card_')) {
                  setPaymentMode('card');
                  setCreditCardId(val.replace('card_', ''));
                } else {
                  setPaymentMode('account');
                  setAccountId(val.replace('acc_', ''));
                }
              }}
              options={[
                ...accounts.map((a) => ({
                  value: `acc_${a.id}`,
                  label: `Conta: ${a.name}`,
                  icon: Landmark,
                })),
                ...creditCards.map((c) => ({
                  value: `card_${c.id}`,
                  label: `Cartão: ${c.name}`,
                  icon: CardIcon,
                })),
              ]}
              placeholder="Selecione a conta ou cartão"
            />
          </div>
        )}

        {/* Auto generate checkbox */}
        <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-white block">Lançamento Automático</span>
            <span className="text-[11px] text-slate-400">
              Registra a transação automaticamente quando chegar o dia de vencimento
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
            className="w-4 h-4 text-brand-600 rounded bg-slate-900 border-slate-700"
          />
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
            {isSubmitting ? 'Salvando...' : ruleToEdit ? 'Salvar Alterações' : 'Criar Recorrente'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
