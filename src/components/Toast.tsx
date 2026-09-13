import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useFinancial();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-top-3 duration-200 ${
              isSuccess
                ? 'bg-slate-900/95 border-emerald-500/30 text-emerald-300'
                : isError
                ? 'bg-slate-900/95 border-rose-500/30 text-rose-300'
                : 'bg-slate-900/95 border-slate-700/60 text-slate-200'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {!isSuccess && !isError && <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />}

            <p className="text-sm font-medium leading-tight flex-1 text-slate-100">{toast.message}</p>

            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
