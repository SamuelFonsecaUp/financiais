import React, { useState } from 'react';
import { Lock, Delete, KeyRound } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const PinLockModal: React.FC = () => {
  const { isLocked, unlockApp } = useFinancial();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin || loading) return;

    setLoading(true);
    const success = await unlockApp(pin);
    setLoading(false);
    if (!success) {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090d16] p-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-6 shadow-xl shadow-brand-500/5">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Meu Financeiro</h2>
        <p className="text-sm text-slate-400 mb-8">Digite seu PIN para desbloquear</p>

        {/* PIN Dots Indicator */}
        <div className="flex items-center gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > i
                  ? 'bg-brand-500 scale-110 shadow-lg shadow-brand-500/50'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-400 mb-6 animate-shake">
            PIN incorreto. Tente novamente.
          </p>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-xl font-semibold text-white transition-all active:scale-95 flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl hover:bg-slate-800 text-xs font-medium text-slate-400 transition-all flex items-center justify-center"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-xl font-semibold text-white transition-all active:scale-95 flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95 flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={pin.length < 4 || loading}
          className="w-full max-w-[280px] py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-brand-600/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          {loading ? 'Verificando...' : 'Desbloquear'}
        </button>
      </div>
    </div>
  );
};
