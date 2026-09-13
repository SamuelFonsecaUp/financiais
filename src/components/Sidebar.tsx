import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Landmark,
  CreditCard,
  CalendarClock,
  Target,
  Calendar,
  PiggyBank,
  PieChart,
  Settings as SettingsIcon,
  PlusCircle,
  Lock,
  WalletCards,
  WifiOff,
  Tag,
  FileSpreadsheet,
} from 'lucide-react';
import { useFinancial, AppView } from '../context/FinancialContext';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    openNewTransaction,
    settings,
    lockApp,
    pendingImportSession,
  } = useFinancial();

  const navItems: { id: AppView; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Lançamentos', icon: ReceiptText },
    { id: 'import', label: 'Importar Extrato', icon: FileSpreadsheet, badge: pendingImportSession ? 'Pendente' : undefined },
    { id: 'accounts', label: 'Contas', icon: Landmark },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    { id: 'categories', label: 'Categorias', icon: Tag },
    { id: 'recurring', label: 'Recorrentes', icon: CalendarClock },
    { id: 'budgets', label: 'Orçamentos', icon: Target },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'goals', label: 'Metas', icon: PiggyBank },
    { id: 'reports', label: 'Relatórios', icon: PieChart },
  ];

  return (
    <aside className="w-64 bg-slate-950/80 border-r border-slate-850 flex flex-col justify-between select-none shrink-0 h-full backdrop-blur-xl">
      {/* App Branding */}
      <div>
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                Meu Financeiro
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5 text-slate-500" />
                  100% Offline
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="p-4">
          <button
            onClick={() => openNewTransaction()}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            Novo lançamento
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-900 space-y-1">
        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            currentView === 'settings'
              ? 'bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Configurações</span>
        </button>

        {settings?.pinEnabled && (
          <button
            onClick={lockApp}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear Aplicativo</span>
          </button>
        )}
      </div>
    </aside>
  );
};
