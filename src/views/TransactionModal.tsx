import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, CreditCard as CardIcon, Calendar, FileText, Check, Landmark } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect, SelectOption } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { Transaction, TransactionType } from '../types';
import { formatCurrency, getTodayDateString } from '../utils/formatters';

export const TransactionModal: React.FC = () => {
  const {
    transactionModalOpen,
    closeTransactionModal,
    editingTransaction,
    accounts,
    categories,
    creditCards,
    refreshAll,
    showToast,
  } = useFinancial();

  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'account' | 'card'>('account');
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(2);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'completed' | 'pending'>('completed');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (transactionModalOpen) {
      setErrorMsg('');
      if (editingTransaction) {
        setType(editingTransaction.type || 'expense');
        setDescription(editingTransaction.description || '');
        setAmountStr(((editingTransaction.amount || 0) / 100).toFixed(2).replace('.', ','));
        setTransactionDate(editingTransaction.transactionDate || getTodayDateString());
        setAccountId(editingTransaction.accountId || '');
        setDestinationAccountId(editingTransaction.destinationAccountId || '');
        setCreditCardId(editingTransaction.creditCardId || '');
        setCategoryId(editingTransaction.categoryId || '');
        setPaymentMode(editingTransaction.creditCardId ? 'card' : 'account');
        setIsInstallment(Boolean(editingTransaction.totalInstallments && editingTransaction.totalInstallments > 1));
        setTotalInstallments(editingTransaction.totalInstallments || 2);
        setNotes(editingTransaction.notes || '');
        setTags(editingTransaction.tags || '');
        setStatus(editingTransaction.status === 'pending' ? 'pending' : 'completed');
      } else {
        // Defaults
        setType('expense');
        setDescription('');
        setAmountStr('');
        setTransactionDate(getTodayDateString());
        const defaultAcc = accounts.find(a => a.active);
        setAccountId(defaultAcc ? defaultAcc.id : '');
        setDestinationAccountId('');
        const defaultCard = creditCards.find(c => c.active);
        setCreditCardId(defaultCard ? defaultCard.id : '');
        const defaultCat = categories.find(c => c.type === 'expense');
        setCategoryId(defaultCat ? defaultCat.id : '');
        setPaymentMode('account');
        setIsInstallment(false);
        setTotalInstallments(2);
        setNotes('');
        setTags('');
        setStatus('completed');
      }
    }
  }, [transactionModalOpen, editingTransaction, accounts, categories, creditCards]);

  // Handle amount input formatted in centavos
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setAmountStr('');
      return;
    }
    const cents = parseInt(val, 10);
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setAmountStr(formatted);
  };

  const getAmountInCents = (): number => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cents = getAmountInCents();
    if (cents <= 0) {
      setErrorMsg('Informe um valor maior que zero.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Informe uma descrição.');
      return;
    }

    if (type === 'transfer') {
      if (!accountId || !destinationAccountId) {
        setErrorMsg('Selecione a conta de origem e a conta de destino.');
        return;
      }
      if (accountId === destinationAccountId) {
        setErrorMsg('A conta de origem e destino devem ser diferentes.');
        return;
      }
    } else {
      if (paymentMode === 'card' && !creditCardId) {
        setErrorMsg('Selecione o cartão de crédito.');
        return;
      }
      if (paymentMode === 'account' && !accountId) {
        setErrorMsg('Selecione uma conta bancária.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        type,
        description: description.trim(),
        amount: cents,
        transactionDate,
        categoryId: type === 'transfer' ? null : categoryId || null,
        notes: notes.trim() || null,
        tags: tags.trim() || null,
        status,
      };

      if (type === 'transfer') {
        payload.accountId = accountId;
        payload.destinationAccountId = destinationAccountId;
        payload.creditCardId = null;
      } else if (paymentMode === 'card') {
        payload.creditCardId = creditCardId;
        payload.accountId = null;
        if (isInstallment && totalInstallments > 1 && !editingTransaction) {
          payload.totalInstallments = totalInstallments;
        }
      } else {
        payload.accountId = accountId;
        payload.creditCardId = null;
      }

      if (editingTransaction?.id) {
        await window.electronAPI.updateTransaction(editingTransaction.id, payload);
        showToast('Lançamento atualizado com sucesso!', 'success');
      } else {
        await window.electronAPI.createTransaction(payload);
        showToast(
          isInstallment && totalInstallments > 1
            ? `Compra parcelada em ${totalInstallments}x criada com sucesso!`
            : 'Lançamento registrado com sucesso!',
          'success'
        );
      }

      await refreshAll();
      closeTransactionModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar lançamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));

  return (
    <Modal
      isOpen={transactionModalOpen}
      onClose={closeTransactionModal}
      title={editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
      subtitle="Preencha os dados do lançamento financeiro"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Type Selector (Despesa / Receita / Transferência) */}
        {!editingTransaction && (
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                const defaultCat = categories.find(c => c.type === 'expense');
                if (defaultCat) setCategoryId(defaultCat.id);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              Despesa
            </button>

            <button
              type="button"
              onClick={() => {
                setType('income');
                setPaymentMode('account');
                const defaultCat = categories.find(c => c.type === 'income');
                if (defaultCat) setCategoryId(defaultCat.id);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Receita
            </button>

            <button
              type="button"
              onClick={() => {
                setType('transfer');
                setPaymentMode('account');
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                type === 'transfer'
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Transferência
            </button>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Valor (R$) <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
              R$
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={amountStr}
              onChange={handleAmountChange}
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-lg font-bold text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Description & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Descrição <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Supermercado, Salário..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Data <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Transfer Source & Destination Accounts */}
        {type === 'transfer' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Conta de Origem (Sai dinheiro) <span className="text-rose-400">*</span>
              </label>
              <CustomSelect
                value={accountId}
                onChange={(val) => setAccountId(val)}
                options={accounts.map((acc) => ({
                  value: acc.id,
                  label: acc.name,
                  subtitle: formatCurrency(acc.currentBalance),
                  icon: Landmark,
                }))}
                placeholder="Selecione a conta de origem"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Conta de Destino (Entra dinheiro) <span className="text-rose-400">*</span>
              </label>
              <CustomSelect
                value={destinationAccountId}
                onChange={(val) => setDestinationAccountId(val)}
                options={accounts.map((acc) => ({
                  value: acc.id,
                  label: acc.name,
                  subtitle: formatCurrency(acc.currentBalance),
                  icon: Landmark,
                  disabled: acc.id === accountId,
                }))}
                placeholder="Selecione a conta de destino"
              />
            </div>
          </div>
        ) : (
          /* Payment method: Account or Credit Card */
          <div className="space-y-4">
            {type === 'expense' && creditCards.length > 0 && !editingTransaction && (
              <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === 'account'}
                    onChange={() => setPaymentMode('account')}
                    className="text-brand-600 focus:ring-0"
                  />
                  <span>Conta Bancária / Dinheiro</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={paymentMode === 'card'}
                    onChange={() => setPaymentMode('card')}
                    className="text-brand-600 focus:ring-0"
                  />
                  <span className="flex items-center gap-1.5">
                    <CardIcon className="w-3.5 h-3.5 text-purple-400" />
                    Cartão de Crédito
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Account or Card select */}
              {paymentMode === 'card' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Cartão de Crédito <span className="text-rose-400">*</span>
                  </label>
                  <CustomSelect
                    value={creditCardId}
                    onChange={(val) => setCreditCardId(val)}
                    options={creditCards.map((card) => ({
                      value: card.id,
                      label: card.name,
                      subtitle: `Disp: ${formatCurrency(card.availableLimit)}`,
                      icon: CardIcon,
                    }))}
                    placeholder="Selecione o cartão"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Conta <span className="text-rose-400">*</span>
                  </label>
                  <CustomSelect
                    value={accountId}
                    onChange={(val) => setAccountId(val)}
                    options={accounts.map((acc) => ({
                      value: acc.id,
                      label: acc.name,
                      subtitle: formatCurrency(acc.currentBalance),
                      icon: Landmark,
                    }))}
                    placeholder="Selecione a conta"
                  />
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Categoria
                </label>
                <CustomSelect
                  value={categoryId}
                  onChange={(val) => setCategoryId(val)}
                  options={[
                    { value: '', label: 'Sem categoria' },
                    ...filteredCategories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                      color: cat.color,
                    })),
                  ]}
                  placeholder="Selecione a categoria"
                />
              </div>
            </div>

            {/* Installment options (if Card) */}
            {paymentMode === 'card' && !editingTransaction && (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Compra Parcelada?</span>
                  <button
                    type="button"
                    onClick={() => setIsInstallment(!isInstallment)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isInstallment ? 'bg-brand-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isInstallment ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isInstallment && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <label className="text-xs text-slate-400 shrink-0">Parcelas:</label>
                      <CustomSelect
                        size="sm"
                        value={totalInstallments}
                        onChange={(val) => setTotalInstallments(Number(val))}
                        options={Array.from({ length: 71 }, (_, i) => i + 2).map((n) => ({
                          value: n,
                          label: `${n}x`,
                          subtitle: getAmountInCents() > 0 ? `${formatCurrency(Math.floor(getAmountInCents() / n))}/mês` : undefined,
                        }))}
                      />
                    </div>

                    {getAmountInCents() > 0 && (
                      <span className="text-xs text-brand-400 font-medium">
                        {totalInstallments}x de {formatCurrency(Math.floor(getAmountInCents() / totalInstallments))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status & Notes */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400">Status:</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="completed"
                checked={status === 'completed'}
                onChange={() => setStatus('completed')}
                className="text-brand-600"
              />
              <span>Concluído / Pago</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="pending"
                checked={status === 'pending'}
                onChange={() => setStatus('pending')}
                className="text-brand-600"
              />
              <span>Pendente</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tags / Marcadores (opcional)
              </label>
              <input
                type="text"
                placeholder="ex: Viagem, Reforma, Carro"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Observações (opcional)
              </label>
              <input
                type="text"
                placeholder="Anotações adicionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={closeTransactionModal}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Salvando...' : editingTransaction ? 'Salvar Alterações' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
