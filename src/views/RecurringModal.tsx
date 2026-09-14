import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarRepeat,
  Check,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  CreditCard as CardIcon,
  Sparkles,
  Search,
  History,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { RecurringRule, RecurringCandidate, Transaction } from '../types';
import { getTodayDateString, formatCurrency, formatDate } from '../utils/formatters';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleToEdit: RecurringRule | null;
  initialCandidate?: RecurringCandidate | null;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({
  isOpen,
  onClose,
  ruleToEdit,
  initialCandidate,
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

  // History matching & recurring pattern states
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
  const [matchingTransactions, setMatchingTransactions] = useState<Transaction[]>([]);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [allRecentTransactions, setAllRecentTransactions] = useState<Transaction[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  // Load smart recurring candidates & recent transactions on open
  useEffect(() => {
    if (isOpen && !ruleToEdit) {
      if (window.electronAPI?.detectRecurringPatterns) {
        window.electronAPI.detectRecurringPatterns()
          .then((pats) => {
            if (Array.isArray(pats)) setCandidates(pats.slice(0, 5));
          })
          .catch((err) => console.warn('Could not load recurring patterns:', err));
      }
      if (window.electronAPI?.getTransactions) {
        window.electronAPI.getTransactions({ limit: 25 })
          .then((txs) => {
            if (Array.isArray(txs)) setAllRecentTransactions(txs);
          })
          .catch((err) => console.warn('Could not load recent txs:', err));
      }
    }
  }, [isOpen, ruleToEdit]);

  // Handle initialization and candidate prefill
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setDismissedSuggestion(false);
      setMatchingTransactions([]);
      setShowHistoryPicker(false);

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
      } else if (initialCandidate) {
        // Pre-fill with selected candidate
        setType('expense');
        setDescription(initialCandidate.cleanDescription || initialCandidate.rawDescription);
        setAmountStr(((initialCandidate.averageAmount || 0) / 100).toFixed(2).replace('.', ','));
        setFrequency(initialCandidate.suggestedFrequency || 'monthly');
        setBillingDay(initialCandidate.suggestedBillingDay || 5);
        setStartDate(getTodayDateString());
        const defAcc = accounts.find(a => a.active);
        setAccountId(defAcc ? defAcc.id : '');
        setCreditCardId('');
        setPaymentMode('account');
        setCategoryId(initialCandidate.categoryId || '');
        setAutoGenerate(true);
        setNotes('Cadastrado automaticamente a partir do histórico.');
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
  }, [isOpen, ruleToEdit, initialCandidate, accounts, categories]);

  // Real-time history search when typing description
  useEffect(() => {
    if (!isOpen || ruleToEdit || dismissedSuggestion) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const query = description.trim();
    if (query.length < 3) {
      setMatchingTransactions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearchingHistory(true);
        if (window.electronAPI?.getTransactions) {
          const res = await window.electronAPI.getTransactions({
            search: query,
            type,
            limit: 4,
          });
          if (Array.isArray(res)) {
            // Keep unique by description/amount
            const seen = new Set<string>();
            const unique = res.filter((tx) => {
              const key = `${tx.description}-${tx.amount}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setMatchingTransactions(unique);
          }
        }
      } catch (err) {
        console.warn('Error searching history for recurring:', err);
      } finally {
        setIsSearchingHistory(false);
      }
    }, 280);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [description, type, isOpen, ruleToEdit, dismissedSuggestion]);

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

  const applyCandidate = (cand: RecurringCandidate) => {
    setDescription(cand.cleanDescription || cand.rawDescription);
    setAmountStr(((cand.averageAmount || 0) / 100).toFixed(2).replace('.', ','));
    setFrequency(cand.suggestedFrequency || 'monthly');
    setBillingDay(cand.suggestedBillingDay || 5);
    if (cand.categoryId) {
      setCategoryId(cand.categoryId);
    }
    setDismissedSuggestion(true);
    setMatchingTransactions([]);
    showToast(`Preenchido a partir de "${cand.cleanDescription}"!`, 'info');
  };

  const applyTransaction = (tx: Transaction) => {
    setDescription(tx.description);
    setAmountStr(((tx.amount || 0) / 100).toFixed(2).replace('.', ','));
    if (tx.type === 'expense' || tx.type === 'income') {
      setType(tx.type);
    }
    if (tx.categoryId) {
      setCategoryId(tx.categoryId);
    }
    if (tx.creditCardId) {
      setPaymentMode('card');
      setCreditCardId(tx.creditCardId);
      setAccountId('');
    } else if (tx.accountId) {
      setPaymentMode('account');
      setAccountId(tx.accountId);
      setCreditCardId('');
    }
    if (tx.transactionDate) {
      const parts = tx.transactionDate.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        if (d >= 1 && d <= 31) {
          setBillingDay(d);
        }
      }
    }
    setDismissedSuggestion(true);
    setMatchingTransactions([]);
    setShowHistoryPicker(false);
    showToast(`Dados preenchidos a partir de "${tx.description}"!`, 'info');
  };

  const filteredHistoryList = allRecentTransactions.filter((tx) => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(q) ||
      (tx.amount / 100).toFixed(2).includes(q)
    );
  });

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

        {/* Smart History Quick Suggestions Bar (when creating new) */}
        {!ruleToEdit && candidates.length > 0 && (
          <div className="p-3 bg-brand-500/10 border border-brand-500/25 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Sugestões detectadas no seu histórico:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => applyCandidate(cand)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-brand-600 border border-slate-800 hover:border-brand-500 text-slate-300 hover:text-white text-xs transition-all shadow-sm group"
                >
                  <span className="font-medium text-white group-hover:text-white">
                    {cand.cleanDescription}
                  </span>
                  <span className="text-[11px] text-brand-400 group-hover:text-brand-100 font-mono">
                    {formatCurrency(cand.averageAmount)}
                  </span>
                </button>
              ))}
            </div>
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

        {/* Description + Search from History Picker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">
              Descrição <span className="text-rose-400">*</span>
            </label>
            {!ruleToEdit && (
              <button
                type="button"
                onClick={() => setShowHistoryPicker(!showHistoryPicker)}
                className="text-[11px] text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1 transition-colors"
              >
                <History className="w-3 h-3" />
                {showHistoryPicker ? 'Ocultar histórico' : 'Puxar do Histórico...'}
              </button>
            )}
          </div>

          {/* History Search Popover */}
          {showHistoryPicker && (
            <div className="p-3 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2 mb-2 animate-fadeIn">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquise no seu histórico de lançamentos..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                {filteredHistoryList.slice(0, 10).map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => applyTransaction(tx)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800/70 hover:border-brand-500/40 cursor-pointer transition-all text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-white truncate">{tx.description}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-brand-400">{formatCurrency(tx.amount)}</span>
                        <span>•</span>
                        <span>{formatDate(tx.transactionDate)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-brand-400 font-semibold px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
                      Selecionar
                    </span>
                  </div>
                ))}
                {filteredHistoryList.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Nenhum lançamento encontrado no histórico.
                  </div>
                )}
              </div>
            </div>
          )}

          <input
            type="text"
            placeholder="Ex: Aluguel, Netflix, Salário, Internet..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDismissedSuggestion(false);
            }}
            autoFocus
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />

          {/* Real-time matched transactions suggestion box */}
          {!dismissedSuggestion && matchingTransactions.length > 0 && (
            <div className="mt-2 p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  Encontramos no seu histórico ({matchingTransactions.length}):
                </span>
                <button
                  type="button"
                  onClick={() => setDismissedSuggestion(true)}
                  className="text-slate-400 hover:text-white p-0.5 rounded"
                  title="Dispensar sugestão"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {matchingTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  const day = parseInt(tx.transactionDate.split('-')[2] || '1', 10);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-white truncate">{tx.description}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-emerald-400 font-semibold">
                            {formatCurrency(tx.amount)}
                          </span>
                          <span>•</span>
                          <span>Cobrança por volta do dia {day}</span>
                          {cat && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: cat.color || '#10b981' }}
                                />
                                {cat.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyTransaction(tx)}
                        className="shrink-0 px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[11px] font-medium transition-all shadow-sm"
                      >
                        ⚡ Preencher
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
