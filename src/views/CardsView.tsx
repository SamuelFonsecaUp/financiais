import React, { useState, useEffect } from 'react';
import {
  CreditCard as CardIcon,
  PlusCircle,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { CreditCard, CardInvoice } from '../types';
import { formatCurrency, formatMonthName, formatDate } from '../utils/formatters';
import { CardModal } from './CardModal';
import { PayInvoiceModal } from './PayInvoiceModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export const CardsView: React.FC = () => {
  const { creditCards, refreshAll, showToast } = useFinancial();

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CreditCard | null>(null);

  // Selected card for viewing detailed invoices
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [invoices, setInvoices] = useState<CardInvoice[]>([]);
  const [expandedInvoiceMonth, setExpandedInvoiceMonth] = useState<string | null>(null);

  // Pay invoice modal
  const [payingInvoice, setPayingInvoice] = useState<CardInvoice | null>(null);

  useEffect(() => {
    if (creditCards.length > 0 && (!selectedCardId || !creditCards.some(c => c.id === selectedCardId))) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [creditCards, selectedCardId]);

  const loadInvoices = async () => {
    if (!selectedCardId) return;
    try {
      const list = await window.electronAPI.getCardInvoices(selectedCardId);
      setInvoices(list);
      // Auto expand first open/unpaid invoice
      if (list.length > 0 && !expandedInvoiceMonth) {
        setExpandedInvoiceMonth(list[0].monthKey);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [selectedCardId, creditCards]);

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteCreditCard(deleteCandidate.id);
      showToast('Cartão excluído com sucesso!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir cartão', 'error');
    }
  };

  const selectedCard = creditCards.find(c => c.id === selectedCardId);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cartões de Crédito</h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle seus limites, faturas abertas, datas de vencimento e parcelamentos.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCard(null);
            setCardModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Novo cartão
        </button>
      </div>

      {creditCards.length === 0 ? (
        <EmptyState
          icon={CardIcon}
          title="Nenhum cartão cadastrado"
          description="Cadastre seus cartões de crédito para acompanhar faturas, limites e compras parceladas de forma 100% offline."
          actionLabel="Novo cartão"
          onAction={() => {
            setEditingCard(null);
            setCardModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Credit Cards Carousel / Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creditCards.map((card) => {
              const usedPercent = card.creditLimit > 0
                ? Math.min(100, Math.round((card.usedLimit / card.creditLimit) * 100))
                : 0;
              const isSelected = card.id === selectedCardId;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-purple-500/50 shadow-xl shadow-purple-500/5 ring-1 ring-purple-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Name and Actions */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                          style={{ backgroundColor: card.color || '#8b5cf6' }}
                        >
                          <CardIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white tracking-tight">
                            {card.name}
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingCard(card);
                            setCardModalOpen(true);
                          }}
                          title="Editar Cartão"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(card)}
                          title="Excluir Cartão"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar for Credit Limit */}
                    <div className="my-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Limite Utilizado</span>
                        <span className="font-bold text-white font-mono">
                          {formatCurrency(card.usedLimit)} ({usedPercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${usedPercent}%`,
                            backgroundColor: usedPercent > 80 ? '#ef4444' : card.color || '#8b5cf6',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Disponível: <strong className="text-emerald-400">{formatCurrency(card.availableLimit)}</strong></span>
                        <span>Total: {formatCurrency(card.creditLimit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Fatura highlight */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Fatura Atual</div>
                      <div className="font-bold text-white font-mono">
                        {formatCurrency(card.currentInvoiceAmount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase">Próxima Fatura</div>
                      <div className="font-bold text-slate-300 font-mono">
                        {formatCurrency(card.nextInvoiceAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoices Details Section for Selected Card */}
          {selectedCard && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Faturas de: <span className="text-purple-400">{selectedCard.name}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Histórico mensal de compras e lançamentos deste cartão
                  </p>
                </div>
              </div>

              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Nenhuma fatura com lançamentos neste cartão ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {invoices.map((inv) => {
                    const isExpanded = expandedInvoiceMonth === inv.monthKey;
                    const isPaid = inv.status === 'paid';
                    const isOpen = inv.status === 'open';

                    return (
                      <div
                        key={inv.monthKey}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/50 overflow-hidden transition-all"
                      >
                        {/* Invoice Header Bar */}
                        <div
                          onClick={() => setExpandedInvoiceMonth(isExpanded ? null : inv.monthKey)}
                          className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {formatMonthName(inv.monthKey)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Vencimento: {formatDate(inv.dueDate)} • {inv.itemCount} compras
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Status badge */}
                            {isPaid ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Fatura Paga
                              </span>
                            ) : isOpen ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Fatura Aberta
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Fatura Fechada
                              </span>
                            )}

                            {/* Total amount */}
                            <div className="text-right">
                              <div className="text-base font-bold text-white font-mono">
                                {formatCurrency(inv.totalAmount)}
                              </div>
                            </div>

                            {/* Pay button (if not paid and total > 0) */}
                            {!isPaid && inv.totalAmount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayingInvoice(inv);
                                }}
                                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-purple-600/20 active:scale-95 flex items-center gap-1.5"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Pagar Fatura
                              </button>
                            )}

                            <div className="text-slate-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Items List */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-900/30 border-t border-slate-800/60 space-y-2">
                            {inv.items.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-2">
                                Nenhuma compra lançada nesta fatura.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-800/40">
                                {inv.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="py-2.5 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-400 font-mono text-[11px]">
                                        {formatDate(item.transactionDate)}
                                      </span>
                                      <div>
                                        <span className="font-medium text-white">{item.description}</span>
                                        {item.categoryName && (
                                          <span className="text-slate-400 ml-2">• {item.categoryName}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="font-semibold font-mono text-rose-400">
                                      {formatCurrency(item.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Credit Card Modal */}
      <CardModal
        isOpen={cardModalOpen}
        onClose={() => {
          setCardModalOpen(false);
          setEditingCard(null);
        }}
        cardToEdit={editingCard}
      />

      {/* Pay Invoice Modal */}
      <PayInvoiceModal
        isOpen={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        invoice={payingInvoice}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Cartão de Crédito"
        message={`Deseja realmente excluir o cartão "${deleteCandidate?.name}"? Isso só será possível se não houver compras vinculadas a ele.`}
        confirmLabel="Sim, excluir"
      />
    </div>
  );
};
