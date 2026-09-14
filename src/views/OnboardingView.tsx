import React, { useState } from 'react';
import {
  WalletCards,
  Cloud,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const OnboardingView: React.FC = () => {
  const { refreshAll, showToast, refreshCloudSession } = useFinancial();

  const [mode, setMode] = useState<'choice' | 'cloud' | 'scratch'>('choice');
  const [cloudTab, setCloudTab] = useState<'signin' | 'signup'>('signin');

  // Cloud form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Scratch form state
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

  // 1. Cloud Authentication & Restore Flow
  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (!window.electronAPI) return;

      if (cloudTab === 'signin') {
        const res = await window.electronAPI.cloudSignIn(email, password);
        showToast(`Bem-vindo, ${res.user.email}! Restaurando seus dados da nuvem...`, 'info');
        await refreshCloudSession();

        // Pull remote data
        try {
          await window.electronAPI.cloudFullPull();
        } catch (pullErr) {
          console.warn('Initial fullPull error:', pullErr);
        }

        // Complete onboarding
        await window.electronAPI.updateSettings({
          userName: res.user.email.split('@')[0] || 'Usuário',
          currency: 'BRL',
          onboardingCompleted: true,
        });

        showToast('Dados restaurados com sucesso! Bem-vindo de volta.', 'success');
        await refreshAll();
      } else {
        // Sign up
        const res = await window.electronAPI.cloudSignUp(email, password);
        if (res.confirmed) {
          showToast('Conta criada com sucesso e conectada!', 'success');
          await refreshCloudSession();
          await window.electronAPI.updateSettings({
            userName: email.split('@')[0] || 'Usuário',
            currency: 'BRL',
            onboardingCompleted: true,
          });
          await refreshAll();
        } else {
          showToast('Conta criada! Faça login para restaurar ou conectar.', 'success');
          setCloudTab('signin');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar na nuvem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Scratch Flow
  const handleFinishScratch = async (e: React.FormEvent) => {
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
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
            <WalletCards className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Meu Financeiro</h1>
            <p className="text-xs text-slate-400">Controle financeiro pessoal 100% offline & na nuvem</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: INITIAL CHOICE */}
        {mode === 'choice' && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Como você deseja começar?</h2>
              <p className="text-xs text-slate-400 mt-1">
                Escolha uma das opções para configurar seu acesso:
              </p>
            </div>

            {/* Option A: Cloud Restore */}
            <button
              type="button"
              onClick={() => { setMode('cloud'); setErrorMsg(''); }}
              className="w-full p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-brand-500/50 text-left transition-all group flex items-start gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-brand-500/20">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                    Já tenho uma conta na Nuvem
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Para quem já usa em outro computador. Faça login para restaurar todas as suas contas, categorias e lançamentos instantaneamente.
                </p>
              </div>
            </button>

            {/* Option B: Scratch Setup */}
            <button
              type="button"
              onClick={() => { setMode('scratch'); setErrorMsg(''); }}
              className="w-full p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group flex items-start gap-4"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Começar do Zero (Novo Usuário)
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Primeira vez utilizando o Meu Financeiro. Crie sua primeira conta bancária para controle financeiro local 100% offline.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* STEP 2: CLOUD AUTH / RESTORE */}
        {mode === 'cloud' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => { setMode('choice'); setErrorMsg(''); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>

              <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-850">
                <button
                  type="button"
                  onClick={() => { setCloudTab('signin'); setErrorMsg(''); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    cloudTab === 'signin' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setCloudTab('signup'); setErrorMsg(''); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    cloudTab === 'signup' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">
                {cloudTab === 'signin' ? 'Restaurar Dados da Nuvem' : 'Criar Conta na Nuvem'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {cloudTab === 'signin'
                  ? 'Informe seu e-mail e senha cadastrados para carregar seus dados.'
                  : 'Crie sua conta para manter seus dados sincronizados entre seus computadores.'}
              </p>
            </div>

            <form onSubmit={handleCloudAuth} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 pt-0.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Conexão criptografada e segura com a nuvem</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-600/25 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>
                  {isSubmitting
                    ? 'Conectando e restaurando...'
                    : cloudTab === 'signin'
                    ? 'Entrar e Restaurar meus Dados'
                    : 'Criar Conta e Continuar'}
                </span>
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: SCRATCH SETUP */}
        {mode === 'scratch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => { setMode('choice'); setErrorMsg(''); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Criar Nova Base Local</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Leva menos de 1 minuto para deixar tudo pronto para o seu uso diário.
              </p>
            </div>

            <form onSubmit={handleFinishScratch} className="space-y-4 pt-1">
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
                    Saldo Inicial desta Conta (R$)
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

              <div className="pt-2">
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
        )}
      </div>
    </div>
  );
};
