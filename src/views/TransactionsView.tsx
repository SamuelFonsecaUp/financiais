import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Filter,
  Copy,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Receipt,
  FileSpreadsheet,
  Upload,
  Tag,
  X,
  Landmark,
  CreditCard as CardIcon,
  FolderInput,
  CheckCircle2,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Transaction } from '../types';
import { formatCurrency, formatDate, getCurrentMonthString } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CustomSelect } from '../components/CustomSelect';
import { Modal } from '../components/Modal';

export const TransactionsView: React.FC = () => {
  const {
    accounts,
    categories,
    creditCards,
    openNewTransaction,
    openEditTransaction,
    setImportModalOpen,
    setCurrentView,
    refreshAll,
    showToast,
  } = useFinancial();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [period, setPeriod] = useState<'current_month' | 'prev_month' | 'current_year' | 'all' | 'custom'>('current_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Delete modal state
  const [deleteCandidate, setDeleteCandidate] = useState<Transaction | null>(null);
  const [deleteEntireGroup, setDeleteEntireGroup] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchMoveModalOpen, setBatchMoveModalOpen] = useState(false);
  const [batchTargetType, setBatchTargetType] = useState<'account' | 'card'>('account');
  const [batchTargetId, setBatchTargetId] = useState('');
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  useEffect(() => {
    if (batchMoveModalOpen) {
      if (batchTargetType === 'account' && accounts.length > 0) {
        const def = accounts.find(a => a.active) || accounts[0];
        setBatchTargetId(def?.id || '');
      } else if (batchTargetType === 'card' && creditCards.length > 0) {
        const def = creditCards.find(c => c.active) || creditCards[0];
        setBatchTargetId(def?.id || '');
      }
    }
  }, [batchMoveModalOpen, batchTargetType, accounts, creditCards]);

  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchMove = async () => {
    if (!batchTargetId || selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      const res = await window.electronAPI.batchMoveTransactions({
        transactionIds: selectedIds,
        targetAccountId: batchTargetId,
        targetType: batchTargetType,
      });

      const targetName = batchTargetType === 'card'
        ? creditCards.find(c => c.id === batchTargetId)?.name
        : accounts.find(a => a.id === batchTargetId)?.name;

      showToast(`${res.updatedCount} lançamentos movidos com sucesso para "${targetName}"!`, 'success');
      setBatchMoveModalOpen(false);
      setSelectedIds([]);
      await refreshAll();
      loadTransactions();
    } catch (err: any) {
      showToast(err.message || 'Erro ao mover lançamentos', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        await window.electronAPI.deleteTransaction(id);
      }
      showToast(`${selectedIds.length} lançamentos excluídos com sucesso!`, 'success');
      setBatchDeleteConfirmOpen(false);
      setSelectedIds([]);
      await refreshAll();
      loadTransactions();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir lançamentos', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Load transactions based on filters
  const loadTransactions = async () => {
    setLoading(true);
    try {
      let startDate = undefined;
      let endDate = undefined;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (period === 'current_month') {
        const mKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        startDate = `${mKey}-01`;
        endDate = `${mKey}-31`;
      } else if (period === 'prev_month') {
        const prevDate = new Date(currentYear, currentMonth - 2, 1);
        const mKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        startDate = `${mKey}-01`;
        endDate = `${mKey}-31`;
      } else if (period === 'current_year') {
        startDate = `${currentYear}-01-01`;
        endDate = `${currentYear}-12-31`;
      } else if (period === 'custom') {
        startDate = customStartDate || undefined;
        endDate = customEndDate || undefined;
      }

      const filters: any = {
        startDate,
        endDate,
        accountId: selectedAccount || undefined,
        creditCardId: selectedCard || undefined,
        categoryId: selectedCategory || undefined,
        type: selectedType || undefined,
        status: selectedStatus || undefined,
        search: search || undefined,
        tag: selectedTag || undefined,
      };

      const list = await window.electronAPI.getTransactions(filters);
      setTransactions(list);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Erro ao carregar lançamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [
    period,
    customStartDate,
    customEndDate,
    selectedAccount,
    selectedCard,
    selectedCategory,
    selectedType,
    selectedStatus,
    search,
    selectedTag,
  ]);

  const handleDuplicate = async (tx: Transaction) => {
    try {
      await window.electronAPI.duplicateTransaction(tx.id);
      showToast('Lançamento duplicado com sucesso!', 'success');
      await refreshAll();
      loadTransactions();
    } catch (err: any) {
      showToast(err.message || 'Erro ao duplicar lançamento', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteTransaction(deleteCandidate.id, deleteEntireGroup);
      showToast('Lançamento excluído com sucesso!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
      loadTransactions();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir lançamento', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await window.electronAPI.exportCsvDialog({
        accountId: selectedAccount || undefined,
        creditCardId: selectedCard || undefined,
        categoryId: selectedCategory || undefined,
        type: selectedType || undefined,
        search: search || undefined,
      });
      if (res.success) {
        showToast('Planilha CSV exportada com sucesso!', 'success');
      }
    } catch (e: any) {
      showToast('Erro ao exportar CSV', 'error');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedTag('');
    setPeriod('current_month');
    setSelectedAccount('');
    setSelectedCard('');
    setSelectedCategory('');
    setSelectedType('');
    setSelectedStatus('');
  };

  // Aggregated totals for filtered view
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.status !== 'cancelled') {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense') expense += t.amount;
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  const hasActiveFilters = Boolean(
    search || selectedTag || selectedAccount || selectedCard || selectedCategory || selectedType || selectedStatus || period !== 'current_month'
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full flex flex-col justify-between">
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Lançamentos</h1>
            <p className="text-sm text-slate-400 mt-1">
              Visualize, filtre e gerencie todas as suas movimentações financeiras.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('import')}
              title="Importar extrato bancário (OFX ou CSV)"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-xl text-xs font-semibold text-brand-300 hover:text-brand-200 transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4 text-brand-400" />
              Importar Extrato
            </button>

            <button
              onClick={handleExportCsv}
              title="Exportar dados filtrados para CSV"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Exportar CSV
            </button>

            <button
              onClick={() => openNewTransaction()}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Novo lançamento
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          {/* Top Row: Search and Period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por descrição ou anotação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <CustomSelect
                size="sm"
                value={period}
                onChange={(val) => setPeriod(val)}
                options={[
                  { value: 'current_month', label: 'Mês Atual' },
                  { value: 'prev_month', label: 'Mês Anterior' },
                  { value: 'current_year', label: 'Este Ano' },
                  { value: 'all', label: 'Todo o Histórico' },
                  { value: 'custom', label: 'Período Personalizado' },
                ]}
              />
            </div>
          </div>

          {/* Custom Date Range if selected */}
          {period === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Data Inicial:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Data Final:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Dropdown Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-800/60">
            {/* Conta */}
            <CustomSelect
              size="sm"
              value={selectedAccount}
              onChange={(val) => setSelectedAccount(val)}
              options={[
                { value: '', label: 'Todas Contas' },
                ...accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  icon: Landmark,
                })),
              ]}
              placeholder="Todas as Contas"
            />

            {/* Cartão */}
            <CustomSelect
              size="sm"
              value={selectedCard}
              onChange={(val) => setSelectedCard(val)}
              options={[
                { value: '', label: 'Todos Cartões' },
                ...creditCards.map((c) => ({
                  value: c.id,
                  label: c.name,
                  icon: CardIcon,
                })),
              ]}
              placeholder="Todos os Cartões"
            />

            {/* Categoria */}
            <CustomSelect
              size="sm"
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={[
                { value: '', label: 'Todas Categorias' },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  color: c.color,
                })),
              ]}
              placeholder="Todas Categorias"
            />

            {/* Tipo */}
            <CustomSelect
              size="sm"
              value={selectedType}
              onChange={(val) => setSelectedType(val)}
              options={[
                { value: '', label: 'Todos os Tipos' },
                { value: 'income', label: 'Receitas' },
                { value: 'expense', label: 'Despesas' },
                { value: 'transfer', label: 'Transferências' },
                { value: 'card_payment', label: 'Pagamentos Fatura' },
              ]}
              placeholder="Todos Tipos"
            />

            {/* Tag Filter */}
            <div className="relative">
              <Tag className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por Tag..."
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-7 pr-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <CustomSelect
                size="sm"
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                options={[
                  { value: '', label: 'Todos Status' },
                  { value: 'completed', label: 'Concluídos' },
                  { value: 'pending', label: 'Pendentes' },
                  { value: 'paid', label: 'Pagos (Cartão)' },
                ]}
                placeholder="Todos Status"
              />

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  title="Limpar filtros"
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-sm">
          {transactions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Receipt}
                title="Nenhum lançamento encontrado"
                description={
                  hasActiveFilters
                    ? 'Nenhum lançamento corresponde aos filtros selecionados. Tente ajustar os filtros ou pesquisar outro termo.'
                    : 'Você ainda não registrou nenhum lançamento financeiro.'
                }
                actionLabel={hasActiveFilters ? 'Limpar Filtros' : 'Novo Lançamento'}
                onAction={hasActiveFilters ? resetFilters : () => openNewTransaction()}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 pl-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selectedIds.length === transactions.length}
                        onChange={toggleSelectAll}
                        title="Selecionar todos os lançamentos visíveis"
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3">Data</th>
                    <th className="py-3.5 px-3">Descrição</th>
                    <th className="py-3.5 px-3">Categoria</th>
                    <th className="py-3.5 px-3">Conta / Cartão</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3 text-right">Valor</th>
                    <th className="py-3.5 pr-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {transactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    const isTransfer = tx.type === 'transfer';
                    const isPayment = tx.type === 'card_payment';
                    const isSelected = selectedIds.includes(tx.id);

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors group ${
                          isSelected ? 'bg-brand-500/10 hover:bg-brand-500/15' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-3.5 pl-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTx(tx.id)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-3 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(tx.transactionDate)}
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isIncome
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : isExpense
                                ? 'bg-rose-500/10 text-rose-400'
                                : isTransfer
                                ? 'bg-sky-500/10 text-sky-400'
                                : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {isIncome && <ArrowUpRight className="w-4 h-4" />}
                              {isExpense && <ArrowDownRight className="w-4 h-4" />}
                              {isTransfer && <ArrowRightLeft className="w-4 h-4" />}
                              {isPayment && <Receipt className="w-4 h-4" />}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate max-w-xs group-hover:text-brand-400 transition-colors">
                                {tx.description}
                              </div>
                              {tx.notes && (
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {tx.notes}
                                </div>
                              )}
                              {tx.tags && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {tx.tags.split(',').map((tag, idx) => (
                                    <span
                                      key={idx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTag(tag.trim().replace(/^#/, ''));
                                      }}
                                      className="cursor-pointer px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700/60 text-brand-400 hover:text-brand-300 hover:border-brand-500/50 font-mono transition-colors"
                                    >
                                      #{tag.trim().replace(/^#/, '')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-300">
                          {tx.categoryName ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tx.categoryColor || '#10b981' }}
                              />
                              <span className="truncate">{tx.categoryName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-slate-300">
                          {tx.creditCardName ? (
                            <span className="text-purple-300 font-medium">
                              Cartão: {tx.creditCardName}
                            </span>
                          ) : tx.type === 'transfer' ? (
                            <span className="text-sky-300">
                              {tx.accountName} → {tx.destinationAccountName}
                            </span>
                          ) : (
                            <span>{tx.accountName || '-'}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {tx.status === 'completed' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Concluído
                            </span>
                          )}
                          {tx.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pendente
                            </span>
                          )}
                          {tx.status === 'paid' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              Pago
                            </span>
                          )}
                        </td>

                        <td
                          className={`py-3.5 px-3 text-right font-bold font-mono whitespace-nowrap ${
                            isIncome
                              ? 'text-emerald-400'
                              : isExpense
                              ? 'text-rose-400'
                              : isPayment
                              ? 'text-purple-400'
                              : 'text-sky-400'
                          }`}
                        >
                          {isIncome
                            ? formatCurrency(tx.amount, true)
                            : isExpense
                            ? formatCurrency(-tx.amount)
                            : formatCurrency(tx.amount)}
                        </td>

                        <td className="py-3.5 pr-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditTransaction(tx)}
                              title="Editar"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDuplicate(tx)}
                              title="Duplicar lançamento"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setDeleteEntireGroup(false);
                                setDeleteCandidate(tx);
                              }}
                              title="Excluir"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary Footer for filtered data */}
      {transactions.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="text-xs text-slate-400">
            Total filtrado: <span className="text-white font-semibold">{transactions.length}</span> lançamentos
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Receitas:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {formatCurrency(totals.income)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Despesas:</span>
              <span className="text-rose-400 font-bold font-mono">
                {formatCurrency(totals.expense)}
              </span>
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
              <span className="text-slate-400">Saldo Líquido:</span>
              <span className={`font-bold font-mono ${totals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(totals.balance, true)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Lançamento"
        message={
          deleteCandidate?.installmentId
            ? `Este lançamento faz parte de uma compra parcelada (${deleteCandidate.installmentNumber}/${deleteCandidate.totalInstallments}). O que deseja fazer?`
            : `Tem certeza que deseja excluir o lançamento "${deleteCandidate?.description}"? Essa ação não poderá ser desfeita.`
        }
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
      />

      {/* Floating Batch Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-brand-500/50 backdrop-blur-md rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 font-bold flex items-center justify-center text-xs">
              {selectedIds.length}
            </span>
            <span className="text-white font-medium whitespace-nowrap">
              {selectedIds.length === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-800" />

          <button
            onClick={() => setBatchMoveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-all shadow-md shadow-brand-600/20 whitespace-nowrap"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Mover p/ Outra Conta
          </button>

          <button
            onClick={() => setBatchDeleteConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition-all whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>

          <button
            onClick={() => setSelectedIds([])}
            className="text-slate-400 hover:text-white px-2 py-1 font-medium transition-colors whitespace-nowrap"
          >
            Desmarcar
          </button>
        </div>
      )}

      {/* Batch Move Modal */}
      <Modal
        isOpen={batchMoveModalOpen}
        onClose={() => setBatchMoveModalOpen(false)}
        title={`Mover ${selectedIds.length} Lançamentos`}
        subtitle="Escolha a conta bancária ou cartão de crédito para onde deseja transferir os lançamentos selecionados"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="batchTargetType"
                checked={batchTargetType === 'account'}
                onChange={() => {
                  setBatchTargetType('account');
                  const def = accounts.find(a => a.active) || accounts[0];
                  setBatchTargetId(def?.id || '');
                }}
                className="text-brand-600 focus:ring-0"
              />
              <span>Conta Bancária / Carteira</span>
            </label>

            {creditCards.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="batchTargetType"
                  checked={batchTargetType === 'card'}
                  onChange={() => {
                    setBatchTargetType('card');
                    const def = creditCards.find(c => c.active) || creditCards[0];
                    setBatchTargetId(def?.id || '');
                  }}
                  className="text-brand-600 focus:ring-0"
                />
                <span>Cartão de Crédito</span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {batchTargetType === 'account' ? 'Selecione a Nova Conta Destino:' : 'Selecione o Novo Cartão Destino:'}
            </label>
            {batchTargetType === 'account' ? (
              <CustomSelect
                value={batchTargetId}
                onChange={(val) => setBatchTargetId(val)}
                options={accounts.map(a => ({
                  value: a.id,
                  label: a.name,
                  subtitle: formatCurrency(a.currentBalance),
                  icon: Landmark,
                }))}
                placeholder="Selecione a conta..."
              />
            ) : (
              <CustomSelect
                value={batchTargetId}
                onChange={(val) => setBatchTargetId(val)}
                options={creditCards.map(c => ({
                  value: c.id,
                  label: c.name,
                  subtitle: `Disp: ${formatCurrency(c.availableLimit)}`,
                  icon: CardIcon,
                }))}
                placeholder="Selecione o cartão..."
              />
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            Todos os {selectedIds.length} lançamentos selecionados serão transferidos para esta conta/cartão e o saldo de ambas as contas será recalculado automaticamente.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setBatchMoveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBatchMove}
              disabled={isBatchProcessing || !batchTargetId}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isBatchProcessing ? 'Movendo...' : `Confirmar e Mover (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog for Batch Deletion */}
      <ConfirmDialog
        isOpen={batchDeleteConfirmOpen}
        onClose={() => setBatchDeleteConfirmOpen(false)}
        onConfirm={handleBatchDelete}
        title="Excluir Lançamentos em Lote"
        message={`Deseja realmente excluir todos os ${selectedIds.length} lançamentos selecionados? Essa ação não poderá ser desfeita.`}
        confirmLabel="Sim, excluir todos"
        cancelLabel="Cancelar"
      />
    </div>
  );
};
