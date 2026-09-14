import React from 'react';
import { useFinancial } from './context/FinancialContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { PinLockModal } from './components/PinLockModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { TransactionModal } from './views/TransactionModal';
import { ImportBankModal } from './views/ImportBankModal';
import { CloudAuthModal } from './views/CloudAuthModal';

import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { AccountsView } from './views/AccountsView';
import { CardsView } from './views/CardsView';
import { RecurringView } from './views/RecurringView';
import { BudgetsView } from './views/BudgetsView';
import { CalendarView } from './views/CalendarView';
import { CategoriesView } from './views/CategoriesView';
import { GoalsView } from './views/GoalsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { OnboardingView } from './views/OnboardingView';
import { ImportView } from './views/ImportView';
import { IntelligenceView } from './views/IntelligenceView';

export const App: React.FC = () => {
  const {
    currentView,
    settings,
    isLocked,
    isLoading,
    importModalOpen,
    setImportModalOpen,
    cloudAuthModalOpen,
    setCloudAuthModalOpen,
  } = useFinancial();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090d16] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Carregando Meu Financeiro...</span>
        </div>
      </div>
    );
  }

  // First run onboarding
  if (settings && !settings.onboardingCompleted) {
    return (
      <>
        <ToastContainer />
        <OnboardingView />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* PIN Security Modal */}
      {isLocked && <PinLockModal />}

      {/* Floating Notifications */}
      <ToastContainer />

      {/* Smart Notifications Drawer */}
      <NotificationDrawer />

      {/* Global Transaction Modal */}
      <TransactionModal />

      {/* Banking OFX / CSV Import Modal */}
      <ImportBankModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* Cloud Supabase Sync & Auth Modal */}
      <CloudAuthModal
        isOpen={cloudAuthModalOpen}
        onClose={() => setCloudAuthModalOpen(false)}
      />

      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-slate-950/40">
        <Navbar />

        <main className="flex-1 min-h-0 overflow-hidden relative">
          <div key={currentView} className="h-full w-full animate-fade-in">
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'transactions' && <TransactionsView />}
            {currentView === 'accounts' && <AccountsView />}
            {currentView === 'cards' && <CardsView />}
            {currentView === 'recurring' && <RecurringView />}
            {currentView === 'budgets' && <BudgetsView />}
            {currentView === 'calendar' && <CalendarView />}
            {currentView === 'categories' && <CategoriesView />}
            {currentView === 'goals' && <GoalsView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'import' && <ImportView />}
            {currentView === 'intelligence' && <IntelligenceView />}
          </div>
        </main>
      </div>
    </div>
  );
};
