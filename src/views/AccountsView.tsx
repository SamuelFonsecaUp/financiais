import React, { useState } from 'react';
import {
  PlusCircle,
  Landmark,
  Wallet,
  Coins,
  TrendingUp,
  MoreVertical,
  Edit2,
  Archive,
  Trash2,
  CheckCircle2,
  ArchiveRestore,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Account } from '../types';
import { formatCurrency } from '../utils/formatters';
import { AccountModal } from './AccountModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export const AccountsView: React.FC = () => {
  const { accounts, refreshAll, showToast } = useFinancial();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeAccounts = accounts.filter(a => a.active);
  const archivedAccounts = accounts.filter(a => !a.active);
  const displayedAccounts = showArchived ? accounts : activeAccounts;

  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return 'Conta Corrente';
      case 'savings': return 'Poupança';
      case 'cash': return 'Dinheiro em Espécie';
      case 'wallet': return 'Carteira Digital';
      case 'investment': return 'Investimento';
      default: return 'Outra';
    }
  };

  const handleArchive = async (account: Account) => {
    try {
      await window.electronAPI.updateAccount(account.id, { active: !account.active });
      showToast(account.active ? 'Conta arquivada com sucesso.' : 'Conta desarquivada com sucesso.', 'info');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao arquivar conta', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await window.electronAPI.deleteAccount(deleteCandidate.id);
      showToast('Conta excluída com sucesso!', 'success');
      setDeleteCandidate(null);
      await refreshAll();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir conta', 'error');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Minhas Contas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie suas contas bancárias, dinheiro em espécie e carteiras.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {archivedAccounts.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 transition-colors"
            >
              {showArchived ? 'Ocultar Arquivadas' : `Ver Arquivadas (${archivedAccounts.length})`}
            </button>
          )}

          <button
            onClick={() => {
              setEditingAccount(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-brand-600/20 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Nova conta
          </button>
        </div>
      </div>

      {/* Global Balance Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Patrimônio em Contas
          </span>
          <div className="text-3xl font-extrabold text-white tracking-tight mt-1">
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Soma do saldo disponível de todas as contas ativas
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
          <Landmark className="w-6 h-6" />
        </div>
      </div>

      {/* Accounts Cards Grid */}
      {displayedAccounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas do Nubank, Itaú, carteira física ou outras para iniciar o controle do seu saldo."
          actionLabel="Nova conta"
          onAction={() => {
            setEditingAccount(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedAccounts.map((account) => {
            return (
              <div
                key={account.id}
                className={`p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  account.active
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 shadow-sm'
                    : 'bg-slate-950/40 border-slate-850 opacity-60'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                        style={{ backgroundColor: account.color || '#3b82f6' }}
                      >
                        {account.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white tracking-tight">
                          {account.name}
                        </h3>
                        <span className="text-xs text-slate-400">
                          {getAccountTypeLabel(account.type)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAccount(account);
                          setModalOpen(true);
                        }}
                        title="Editar Conta"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleArchive(account)}
                        title={account.active ? 'Arquivar Conta' : 'Desarquivar Conta'}
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        {account.active ? (
                          <Archive className="w-3.5 h-3.5" />
                        ) : (
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => setDeleteCandidate(account)}
                        title="Excluir Conta"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Balances */}
                  <div className="my-4 pt-3 border-t border-slate-800/60">
                    <div className="text-xs text-slate-400 mb-1">Saldo Atual Calculado</div>
                    <div className={`text-2xl font-bold font-mono tracking-tight ${
                      account.currentBalance >= 0 ? 'text-white' : 'text-rose-400'
                    }`}>
                      {formatCurrency(account.currentBalance)}
                    </div>
                  </div>
                </div>

                {/* Footer details */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <span>Saldo inicial: {formatCurrency(account.initialBalance)}</span>
                  <span>{account.transactionCount || 0} lançamentos</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Account Create/Edit Modal */}
      <AccountModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        accountToEdit={editingAccount}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={confirmDelete}
        title="Excluir Conta Bancária"
        message={`Deseja realmente excluir a conta "${deleteCandidate?.name}"? Isso só será possível se não houver lançamentos vinculados a ela.`}
        confirmLabel="Sim, excluir"
      />
    </div>
  );
};
