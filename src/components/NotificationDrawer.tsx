import React, { useEffect } from 'react';
import { Bell, CheckCheck, X, AlertTriangle, CalendarClock, CreditCard, Sparkles } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatDate } from '../utils/formatters';

export const NotificationDrawer: React.FC = () => {
  const {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    unreadNotificationsCount,
    refreshNotifications,
    showToast,
  } = useFinancial();

  useEffect(() => {
    if (notificationsOpen) {
      refreshNotifications();
    }
  }, [notificationsOpen, refreshNotifications]);

  if (!notificationsOpen) return null;

  const handleMarkAll = async () => {
    try {
      await window.electronAPI.markAllNotificationsRead();
      await refreshNotifications();
      showToast('Todas as notificações foram marcadas como lidas.', 'info');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkOne = async (id: string) => {
    try {
      await window.electronAPI.markNotificationRead(id);
      await refreshNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'bill_due':
        return <CalendarClock className="w-4 h-4 text-amber-400" />;
      case 'invoice_due':
        return <CreditCard className="w-4 h-4 text-purple-400" />;
      case 'budget_warning':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-brand-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setNotificationsOpen(false)}
    >
      <div
        className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Notificações Inteligentes</h3>
              <p className="text-[11px] text-slate-400">
                {unreadNotificationsCount} alerta(s) não lido(s)
              </p>
            </div>
          </div>

          <button
            onClick={() => setNotificationsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        {notifications.length > 0 && unreadNotificationsCount > 0 && (
          <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/40 flex justify-end">
            <button
              onClick={handleMarkAll}
              className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas como lidas
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60 p-2">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Bell className="w-5 h-5" />
              </div>
              <p className="font-medium text-slate-300">Tudo em dia!</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Nenhum alerta ou pendência financeira no momento.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleMarkOne(notif.id)}
                className={`p-4 rounded-xl transition-all cursor-pointer m-1 flex items-start gap-3 ${
                  notif.read
                    ? 'bg-transparent opacity-60 hover:opacity-100 hover:bg-slate-850'
                    : 'bg-slate-800/50 border border-slate-750 shadow-sm'
                }`}
              >
                <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                  <span className="text-[10px] text-slate-500 block mt-2">
                    {formatDate(notif.createdAt.slice(0, 10))} às {notif.createdAt.slice(11, 16)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
