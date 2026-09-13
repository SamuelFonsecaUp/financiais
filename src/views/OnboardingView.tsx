import React, { useState } from 'react';
import { WalletCards, Landmark, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const OnboardingView: React.FC = () => {
  const { refreshAll, showToast } = useFinancial();

  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [accountName, setAccountName] = useState('Nubank');
  const [initialBalanceStr, setInitialBalanceStr] = useState('0,00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setInitialBalanceStr('0,00');
      return;
    }
    const cents = parseInt(val, 10);
    setInitialBalanceStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const getBalanceCents = (): number => {
    if (!initialBalanceStr) return 0;
    const clean = initialBalanceStr.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMsg('Por favor, informe seu nome.');
      return;
    }
    if (!accountName.trim()) {
      setErrorMsg('Por favor, informe o nome da sua primeira conta.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create first account
      await window.electronAPI.createAccount({
        name: accountName.trim(),
        type: 'checking',
        initialBalance: getBalanceCents(),
        color: '#3b82f6',
      });

      // 2. Update user settings and mark onboarding completed
      await window.electronAPI.updateSettings({
        userName: userName.trim(),
        currency: 'BRL',
        onboardingCompleted: true,
      });

      showToast('Bem-vindo ao Meu Financeiro! Configuração concluída.', 'success');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao finalizar configuração.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090d16] p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
            <WalletCards className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Meu Financeiro</h1>
            <p className="text-xs text-slate-400">Controle financeiro pessoal 100% offline</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight">Vamos configurar seu financeiro.</h2>
          <p className="text-xs text-slate-400 mt-1">
            Leva menos de 1 minuto para deixar tudo pronto para o seu uso diário.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleFinish} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Como você gostaria de ser chamado?
            </label>
            <input
              type="text"
              placeholder="Seu nome ou apelido"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Moeda Principal
            </label>
            <input
              type="text"
              disabled
              value="Real Brasileiro (R$)"
              className="w-full bg-slate-950/40 border border-slate-800/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Nome da sua primeira conta bancária ou carteira
              </label>
              <input
                type="text"
                placeholder="Ex: Nubank, Itaú, Carteira..."
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Saldo Atual desta Conta (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  R$
                </span>
                <input
                  type="text"
                  value={initialBalanceStr}
                  onChange={handleBalanceChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-600/25 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'Configurando...' : 'Começar a Usar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
