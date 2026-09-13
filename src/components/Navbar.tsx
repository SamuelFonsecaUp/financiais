import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, RefreshCw, Bell, Printer, FileSpreadsheet } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    refreshAll,
    isLoading,
    unreadNotificationsCount,
    setNotificationsOpen,
    pendingImportSession,
  } = useFinancial();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    async function checkMax() {
      if (window.electronAPI?.isMaximized) {
        const max = await window.electronAPI.isMaximized();
        setIsMaximized(max);
      }
    }
    checkMax();
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleMaximize = async () => {
    if (window.electronAPI?.maximizeWindow) {
      const max = await window.electronAPI.maximizeWindow();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  const viewTitles: Record<string, string> = {
    dashboard: 'Visão Geral',
    transactions: 'Lançamentos',
    accounts: 'Minhas Contas',
    cards: 'Cartões de Crédito',
    recurring: 'Lançamentos Recorrentes & Cobranças',
    budgets: 'Orçamentos & Tetos de Gastos',
    calendar: 'Calendário & Projeção Financeira',
    categories: 'Categorias',
    goals: 'Metas Financeiras',
    reports: 'Relatórios & Gráficos',
    settings: 'Configurações do Sistema',
    import: 'Importar Extrato Bancário (OFX / CSV)',
  };

  return (
    <header className="h-12 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between px-4 select-none shrink-0 backdrop-blur-md">
      {/* Draggable Title Area */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {viewTitles[currentView] || 'Meu Financeiro'}
        </h2>
      </div>

      {/* Actions and Desktop Window Controls */}
      <div className="flex items-center gap-2">
        {pendingImportSession && currentView !== 'import' && (
          <button
            onClick={() => setCurrentView('import')}
            title="Você tem uma importação em andamento não finalizada"
            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all animate-pulse"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Continuar Importação</span>
          </button>
        )}

        <button
          onClick={() => window.print()}
          title="Imprimir / Salvar PDF"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setNotificationsOpen(true)}
          title="Central de Notificações"
          className="relative p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-1 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => refreshAll()}
          disabled={isLoading}
          title="Atualizar dados"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
        </button>

        {/* Window controls if running inside Electron */}
        <div className="flex items-center ml-2 border-l border-slate-800 pl-2">
          <button
            onClick={handleMinimize}
            title="Minimizar"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={handleClose}
            title="Fechar"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
