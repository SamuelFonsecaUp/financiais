import React, { useState, useEffect } from 'react';
import { CreditCard, Check, AlertCircle, Landmark } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { CardInvoice } from '../types';
import { formatCurrency, getTodayDateString, formatMonthName } from '../utils/formatters';

interface PayInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: CardInvoice | null;
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const { accounts, refreshAll, showToast } = useFinancial();

  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && invoice) {
      setErrorMsg('');
      const defaultAcc = accounts.find(a => a.active && a.currentBalance >= invoice.totalAmount) || accounts.find(a => a.active);
      setAccountId(defaultAcc ? defaultAcc.id : '');
      setPaymentDate(getTodayDateString());
      setAmountStr(((invoice.totalAmount || 0) / 100).toFixed(2).replace('.', ','));
    }
  }, [isOpen, invoice, accounts]);

  if (!invoice) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setAmountStr('0,00');
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
    if (!accountId) {
      setErrorMsg('Selecione uma conta bancária para debitar o pagamento.');
      return;
    }
    const cents = getAmountCents();
    if (cents <= 0) {
      setErrorMsg('Informe um valor de pagamento maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await window.electronAPI.payCardInvoice({
        creditCardId: invoice.cardId,
        invoiceMonth: invoice.monthKey,
        accountId,
        paymentDate,
        amount: cents,
      });

      showToast(`Fatura de ${formatMonthName(invoice.monthKey)} paga com sucesso!`, 'success');
      await refreshAll();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar pagamento da fatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pagar Fatura de Cartão"
      subtitle={`${invoice.cardName} • Fatura de ${formatMonthName(invoice.monthKey)}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Invoice Summary Box */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Valor Total da Fatura:</span>
            <span className="text-white font-semibold font-mono text-sm">
              {formatCurrency(invoice.totalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Vencimento:</span>
            <span className="text-slate-200">{invoice.dueDate.split('-').reverse().join('/')}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Itens na Fatura:</span>
            <span className="text-slate-200">{invoice.itemCount} compras</span>
          </div>
        </div>

        {/* Source Bank Account */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Debitar da Conta <span className="text-rose-400">*</span>
          </label>
          <CustomSelect
            value={accountId}
            onChange={(val) => setAccountId(val)}
            options={accounts.filter(a => a.active).map((acc) => ({
              value: acc.id,
              label: acc.name,
              subtitle: `Saldo: ${formatCurrency(acc.currentBalance)}`,
              icon: Landmark,
            }))}
            placeholder="Selecione a conta para pagamento"
          />
        </div>

        {/* Payment Amount & Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Valor a Pagar (R$) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                R$
              </span>
              <input
                type="text"
                value={amountStr}
                onChange={handleAmountChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Data do Pagamento <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 leading-relaxed">
          💡 <strong>Regra Financeira:</strong> O pagamento desta fatura debita da sua conta bancária sem duplicar as despesas, pois cada compra já foi contabilizada na categoria correspondente.
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
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-purple-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Processando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
