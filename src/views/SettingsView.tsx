import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Download,
  Upload,
  FileSpreadsheet,
  Moon,
  Sun,
  Database,
  Sparkles,
  Trash,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  BookOpen,
  Tag,
  FolderArchive,
  FileText,
  ShieldCheck,
  ExternalLink,
  FolderInput,
  Trash2,
  Landmark,
  CreditCard as CardIcon,
  CheckCircle2,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CustomSelect } from '../components/CustomSelect';
import { ImportRulesModal } from './ImportRulesModal';
import { ImportedStatement } from '../types';
import { formatCurrency } from '../utils/formatters';

export const SettingsView: React.FC = () => {
  const { settings, accounts, creditCards, refreshAll, showToast, setCurrentView } = useFinancial();

  const [userName, setUserName] = useState(settings?.userName || '');
  const [theme, setTheme] = useState<'dark' | 'light'>(settings?.theme || 'dark');
  const [isSaving, setIsSaving] = useState(false);

  // PIN modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Import rules modal
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // Demo seed/clear confirmation
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  // Saved statements vault
  const [savedStatements, setSavedStatements] = useState<ImportedStatement[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);

  // Statement management modal states
  const [selectedStatementForMove, setSelectedStatementForMove] = useState<ImportedStatement | null>(null);
  const [selectedStatementForDelete, setSelectedStatementForDelete] = useState<ImportedStatement | null>(null);
  const [stmtTargetType, setStmtTargetType] = useState<'account' | 'card'>('account');
  const [stmtTargetId, setStmtTargetId] = useState('');
  const [isProcessingStmt, setIsProcessingStmt] = useState(false);

  const fetchSavedStatements = async () => {
    if (!window.electronAPI?.getSavedStatements) return;
    try {
      setLoadingStatements(true);
      const list = await window.electronAPI.getSavedStatements();
      setSavedStatements(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatements(false);
    }
  };

  useEffect(() => {
    fetchSavedStatements();
  }, []);

  const openMoveModal = (stmt: ImportedStatement) => {
    setSelectedStatementForMove(stmt);
    if (stmt.cardId) {
      setStmtTargetType('card');
      setStmtTargetId(stmt.cardId);
    } else if (stmt.accountId) {
      setStmtTargetType('account');
      setStmtTargetId(stmt.accountId);
    } else {
      setStmtTargetType('account');
      const defAcc = accounts.find(a => a.active) || accounts[0];
      setStmtTargetId(defAcc?.id || '');
    }
  };

  const handleReassign = async () => {
    if (!selectedStatementForMove || !stmtTargetId) return;
    try {
      setIsProcessingStmt(true);
      const res = await window.electronAPI.reassignStatementAccount({
        statementId: selectedStatementForMove.id,
        targetAccountId: stmtTargetId,
        targetType: stmtTargetType,
      });
      if (res.success) {
        showToast(res.message || 'Lançamentos movidos com sucesso!', 'success');
        setSelectedStatementForMove(null);
        await fetchSavedStatements();
        await refreshAll();
      } else {
        showToast(res.error || 'Erro ao mover lançamentos', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Erro ao mover lançamentos', 'error');
    } finally {
      setIsProcessingStmt(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStatementForDelete) return;
    try {
      setIsProcessingStmt(true);
      const res = await window.electronAPI.deleteStatementTransactions(selectedStatementForDelete.id);
      if (res.success) {
        showToast(res.message || 'Lançamentos excluídos com sucesso!', 'success');
        setSelectedStatementForDelete(null);
        await fetchSavedStatements();
        await refreshAll();
      } else {
        showToast(res.error || 'Erro ao desfazer importação', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Erro ao desfazer importação', 'error');
    } finally {
      setIsProcessingStmt(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await window.electronAPI.updateSettings({
        userName: userName.trim() || 'Usuário',
        theme,
      });
      showToast('Preferências atualizadas com sucesso!', 'success');
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar preferências', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pin.length < 4) {
      setPinError('O PIN deve ter pelo menos 4 dígitos.');
      return;
    }
    if (pin !== pinConfirm) {
      setPinError('Os PINs digitados não coincidem.');
      return;
    }

    try {
      await window.electronAPI.setPin(pin);
      showToast('Proteção por PIN ativada com sucesso!', 'success');
      setPinModalOpen(false);
      setPin('');
      setPinConfirm('');
      await refreshAll();
    } catch (e: any) {
      setPinError(e.message || 'Erro ao definir PIN');
    }
  };

  const handleDisablePin = async () => {
    const entered = prompt('Digite seu PIN atual para desativar a proteção:');
    if (!entered) return;

    try {
      await window.electronAPI.disablePin(entered);
      showToast('Proteção por PIN desativada.', 'info');
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'PIN incorreto', 'error');
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await window.electronAPI.exportBackupDialog();
      if (res.success) {
        showToast('Backup completo exportado com sucesso!', 'success');
      }
    } catch (e: any) {
      showToast('Erro ao exportar backup.', 'error');
    }
  };

  const handleRestoreBackup = async () => {
    const confirmed = confirm(
      'ATENÇÃO: A restauração de um backup substituirá os dados atuais pelos dados contidos no arquivo. Deseja continuar?'
    );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.restoreBackupDialog();
      if (res.success) {
        showToast('Backup restaurado com sucesso! Todos os dados foram atualizados.', 'success');
        await refreshAll();
      }
    } catch (e: any) {
      showToast(e.message || 'Erro ao restaurar backup.', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await window.electronAPI.exportCsvDialog();
      if (res.success) {
        showToast('Planilha CSV exportada com sucesso!', 'success');
      }
    } catch (e) {
      showToast('Erro ao exportar CSV.', 'error');
    }
  };

  const handleSeedDemo = async () => {
    try {
      await window.electronAPI.seedDemoData();
      showToast('Dados de demonstração carregados com sucesso!', 'success');
      await refreshAll();
    } catch (e: any) {
      showToast('Erro ao carregar dados de demonstração.', 'error');
    }
  };

  const handleClearDemo = async () => {
    try {
      await window.electronAPI.clearDemoData();
      showToast('Dados de demonstração removidos com sucesso!', 'info');
      await refreshAll();
    } catch (e: any) {
      showToast('Erro ao remover dados de demonstração.', 'error');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto overflow-y-auto custom-scrollbar h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações</h1>
        <p className="text-sm text-slate-400 mt-1">
          Personalização, segurança por PIN e gerenciamento seguro de backups.
        </p>
      </div>

      {/* 1. General Preferences Form */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-6">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brand-400" />
          Preferências Gerais
        </h2>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Seu Nome de Exibição
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Moeda do Sistema
              </label>
              <input
                type="text"
                disabled
                value="Real Brasileiro (R$)"
                className="w-full bg-slate-950/40 border border-slate-800/50 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Tema da Interface</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  theme === 'dark'
                    ? 'bg-brand-500/10 text-brand-400 border-brand-500/30'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                Tema Escuro (Recomendado)
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  theme === 'light'
                    ? 'bg-brand-500/10 text-brand-400 border-brand-500/30'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4" />
                Tema Claro
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-600/20 active:scale-95"
            >
              {isSaving ? 'Salvando...' : 'Salvar Preferências'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Security (Local PIN) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Segurança Local por PIN
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              Proteja seus dados financeiros exigindo um PIN numérico toda vez que o aplicativo for aberto. O PIN é criptografado localmente com SHA-256 e nunca enviado à internet.
            </p>
          </div>

          <div>
            {settings?.pinEnabled ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Ativado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Desativado
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          {settings?.pinEnabled ? (
            <button
              onClick={handleDisablePin}
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Unlock className="w-4 h-4" /> Desativar Proteção por PIN
            </button>
          ) : (
            <button
              onClick={() => {
                setPin('');
                setPinConfirm('');
                setPinError('');
                setPinModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" /> Configurar PIN de Acesso
            </button>
          )}
        </div>
      </div>

      {/* 3. Automatic Categorization Rules */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" />
              Regras de Categorização Automática
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Gerencie os estabelecimentos que o sistema aprendeu a categorizar automaticamente durante a importação de extratos OFX e CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentView('categories')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors shrink-0"
            >
              <Tag className="w-4 h-4 text-emerald-400" />
              Gerenciar Categorias
            </button>

            <button
              onClick={() => setRulesModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-brand-300 border border-slate-750 rounded-xl text-xs font-semibold transition-colors shrink-0"
            >
              <BookOpen className="w-4 h-4 text-brand-400" />
              Gerenciar Regras
            </button>
          </div>
        </div>
      </div>

      {/* 4. Backup & Data Management */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            Dados & Backup
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Seus dados são 100% locais. Exporte cópias de segurança completas ou restaure seus lançamentos a qualquer momento.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-left transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Download className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">Exportar Backup</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Gera arquivo JSON completo com todas as contas, lançamentos e metas.
            </p>
          </button>

          <button
            onClick={handleRestoreBackup}
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-left transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">Restaurar Backup</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Restaura seus dados a partir de um arquivo de backup salvo anteriormente.
            </p>
          </button>

          <button
            onClick={handleExportCsv}
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-left transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">Exportar para CSV</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Exporta planilha compatível com Excel com todos os lançamentos.
            </p>
          </button>
        </div>
      </div>

      {/* 5. Bank Statements Vault (OFX / CSV) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-emerald-400" />
              Cofre de Extratos Bancários (OFX / CSV)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Todos os arquivos OFX e extratos originais importados de seus bancos são arquivados automaticamente nesta máquina com segurança e privacidade total, garantindo um histórico auditável que nunca se perde.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                if (window.electronAPI?.openStatementsFolder) {
                  await window.electronAPI.openStatementsFolder();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Pasta no Windows
            </button>
          </div>
        </div>

        {savedStatements.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0" />
            <span>Nenhum extrato importado ainda. Assim que você importar um arquivo OFX ou CSV, uma cópia integral será preservada aqui.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Extratos Armazenados ({savedStatements.length})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Armazenamento 100% local em disco
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {savedStatements.map((stmt) => (
                <div
                  key={stmt.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">
                        {stmt.originalName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-brand-400">
                          {stmt.fileType}
                        </span>
                        <span>{(stmt.fileSize / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{new Date(stmt.importedAt).toLocaleString('pt-BR')}</span>
                        {stmt.accountName && <span>• Conta: {stmt.accountName}</span>}
                        {stmt.cardName && <span>• Cartão: {stmt.cardName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium mr-1">
                      {stmt.itemsCount > 0 ? `${stmt.itemsCount} itens` : 'Extrato arquivado'}
                    </span>

                    {stmt.itemsCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => openMoveModal(stmt)}
                          title="Mudar conta ou cartão de todos os lançamentos deste extrato"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[11px] font-semibold transition-colors"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                          Mudar Conta
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStatementForDelete(stmt)}
                          title="Excluir todos os lançamentos desta importação"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Desfazer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Demo Data */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Dados de Demonstração
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Carregue dados fictícios para testar e visualizar o comportamento dos gráficos, limites de cartões e metas. Os dados de demonstração podem ser removidos a qualquer momento sem afetar seus dados reais.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSeedDemo}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Carregar Dados de Demonstração
          </button>

          <button
            onClick={() => setConfirmClearDemo(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Trash className="w-4 h-4 text-rose-400" /> Limpar Dados de Demonstração
          </button>
        </div>
      </div>

      {/* PIN Configuration Modal */}
      <Modal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title="Definir PIN de Segurança"
        subtitle="Digite um PIN numérico de 4 a 6 dígitos"
        maxWidth="sm"
      >
        <form onSubmit={handleSetPin} className="space-y-4">
          {pinError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
              {pinError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Novo PIN (4 a 6 números)
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center text-lg tracking-widest text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Confirme o PIN
            </label>
            <input
              type="password"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center text-lg tracking-widest text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPinModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-600/20"
            >
              Confirmar e Ativar
            </button>
          </div>
        </form>
      </Modal>

      {/* Clear Demo Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmClearDemo}
        onClose={() => setConfirmClearDemo(false)}
        onConfirm={handleClearDemo}
        title="Limpar Dados de Demonstração"
        message="Tem certeza que deseja remover todos os dados de demonstração? Seus dados reais continuarão intactos."
        confirmLabel="Sim, remover demo"
      />

      {/* Statement Move Modal */}
      <Modal
        isOpen={!!selectedStatementForMove}
        onClose={() => setSelectedStatementForMove(null)}
        title={`Mudar Conta do Extrato: ${selectedStatementForMove?.originalName || ''}`}
        subtitle="Mova todos os lançamentos que vieram desta importação para a conta correta"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="settingsStatementTargetType"
                checked={stmtTargetType === 'account'}
                onChange={() => {
                  setStmtTargetType('account');
                  const def = accounts.find(a => a.active) || accounts[0];
                  setStmtTargetId(def?.id || '');
                }}
                className="text-brand-600 focus:ring-0"
              />
              <span>Conta Bancária / Carteira</span>
            </label>

            {creditCards.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="settingsStatementTargetType"
                  checked={stmtTargetType === 'card'}
                  onChange={() => {
                    setStmtTargetType('card');
                    const def = creditCards.find(c => c.active) || creditCards[0];
                    setStmtTargetId(def?.id || '');
                  }}
                  className="text-brand-600 focus:ring-0"
                />
                <span>Cartão de Crédito</span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {stmtTargetType === 'account' ? 'Selecione a Nova Conta Destino:' : 'Selecione o Novo Cartão Destino:'}
            </label>
            {stmtTargetType === 'account' ? (
              <CustomSelect
                value={stmtTargetId}
                onChange={(val) => setStmtTargetId(val)}
                options={accounts.map(a => ({
                  value: a.id,
                  label: a.name,
                  subtitle: formatCurrency(a.currentBalance),
                  icon: Landmark,
                }))}
                placeholder="Selecione a conta..."
              />
            ) : (
              <CustomSelect
                value={stmtTargetId}
                onChange={(val) => setStmtTargetId(val)}
                options={creditCards.map(c => ({
                  value: c.id,
                  label: c.name,
                  subtitle: `Disp: ${formatCurrency(c.availableLimit)}`,
                  icon: CardIcon,
                }))}
                placeholder="Selecione o cartão..."
              />
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            Todos os <strong>{selectedStatementForMove?.itemsCount || 0} lançamentos</strong> pertencentes a este extrato serão transferidos para esta conta/cartão e o saldo será ajustado automaticamente.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedStatementForMove(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleReassign}
              disabled={isProcessingStmt || !stmtTargetId}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isProcessingStmt ? 'Movendo...' : 'Confirmar e Mudar Conta do Extrato'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Statement Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!selectedStatementForDelete}
        onClose={() => setSelectedStatementForDelete(null)}
        onConfirm={handleDelete}
        title="Desfazer Importação do Extrato"
        message={`Deseja realmente excluir todos os ${selectedStatementForDelete?.itemsCount || 0} lançamentos importados do arquivo "${selectedStatementForDelete?.originalName}"? Essa ação removerá os lançamentos da conta e ajustará o saldo automaticamente.`}
        confirmLabel="Sim, desfazer importação"
        cancelLabel="Cancelar"
      />

      {/* Learned Rules Manager Modal */}
      <ImportRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </div>
  );
};
