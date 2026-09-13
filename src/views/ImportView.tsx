import React, { useState, useEffect, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sliders,
  Layers,
  List,
  Tag,
  Eye,
  Check,
  RefreshCw,
  X,
  FolderOpen,
  AlertCircle,
  FileText,
  Landmark,
  CreditCard as CreditCardIcon,
  ChevronDown,
  ChevronRight,
  Hash,
  Bookmark,
  Sparkles,
  Filter,
  ShieldCheck,
  HelpCircle,
  Save,
  Trash2,
  Clock,
  RotateCcw
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { CustomSelect } from '../components/CustomSelect';
import { ImportRulesModal } from './ImportRulesModal';
import {
  ImportReconciledItem,
  MerchantGroup,
  ImportSummaryStats,
  ParsedCsvResult,
  CsvColumnMapping,
  PendingImportSession,
} from '../types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ImportViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ImportView error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-8 bg-[#090d16] text-white">
          <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Ocorreu um erro ao carregar a tela de importação</h3>
            <p className="text-xs text-slate-400">
              {this.state.error?.message || 'Falha inesperada de renderização.'}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('meu_financeiro_import_draft');
                  } catch {}
                  window.location.reload();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all"
              >
                Limpar Rascunho e Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ImportViewContent: React.FC = () => {
  const {
    accounts,
    creditCards,
    categories,
    refreshAll,
    showToast,
    setCurrentView,
    pendingImportSession,
    saveImportSession,
    clearImportSession,
  } = useFinancial();

  // Navigation steps: 'upload' | 'mapping' | 'review'
  const [step, setStep] = useState<'upload' | 'mapping' | 'review'>('upload');
  const [fileInfo, setFileInfo] = useState<{
    fileName: string;
    fileType: 'ofx' | 'csv';
    content: string;
    savedStatementId?: string | null;
    savedPath?: string | null;
  } | null>(null);

  const [destType, setDestType] = useState<'account' | 'card'>('account');
  const [destinationId, setDestinationId] = useState<string>('');
  const [savedStatementId, setSavedStatementId] = useState<string | null>(null);
  const [savedVaultPath, setSavedVaultPath] = useState<string | null>(null);

  // CSV mapping state
  const [csvParsed, setCsvParsed] = useState<ParsedCsvResult | null>(null);
  const [customMapping, setCustomMapping] = useState<CsvColumnMapping>({
    delimiter: ';',
    dateIndex: 0,
    descIndex: 1,
    amountIndex: 2,
  });

  // Reconciled data
  const [items, setItems] = useState<ImportReconciledItem[]>([]);
  const [groups, setGroups] = useState<MerchantGroup[]>([]);
  const [expandedOrigins, setExpandedOrigins] = useState<Record<string, boolean>>({});

  // Review UI state
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'categorized' | 'duplicates'>('all');
  const [saveRulesChecked, setSaveRulesChecked] = useState(true);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeAccounts = useMemo(() => (accounts || []).filter(a => a && a.active !== false), [accounts]);
  const activeCards = useMemo(() => (creditCards || []).filter(c => c && c.active !== false), [creditCards]);

  // Ensure default destination selection
  useEffect(() => {
    if (!destinationId) {
      if (destType === 'account' && activeAccounts.length > 0) {
        setDestinationId(activeAccounts[0].id);
      } else if (destType === 'card' && activeCards.length > 0) {
        setDestinationId(activeCards[0].id);
      }
    }
  }, [destType, destinationId, activeAccounts, activeCards]);

  // Format currency
  const formatCurrency = useCallback((cents: number) => {
    const val = typeof cents === 'number' && !isNaN(cents) ? cents : 0;
    return (val / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, []);

  // Format date string
  const formatDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }, []);

  // Persist draft session whenever items or groups change in review step
  useEffect(() => {
    if (step === 'review' && fileInfo && items.length > 0) {
      const session: PendingImportSession = {
        fileInfo,
        destType,
        destinationId,
        items,
        groups,
        saveRulesChecked,
        step,
        timestamp: Date.now(),
      };
      saveImportSession(session);
    }
  }, [items, groups, step, fileInfo, destType, destinationId, saveRulesChecked, saveImportSession]);

  // Restore draft session
  const handleRestoreSession = () => {
    if (!pendingImportSession) return;
    setFileInfo(pendingImportSession.fileInfo);
    setSavedStatementId(pendingImportSession.fileInfo?.savedStatementId || null);
    setSavedVaultPath(pendingImportSession.fileInfo?.savedPath || null);
    setDestType(pendingImportSession.destType || 'account');
    setDestinationId(pendingImportSession.destinationId || '');
    setItems(Array.isArray(pendingImportSession.items) ? pendingImportSession.items : []);
    setGroups(Array.isArray(pendingImportSession.groups) ? pendingImportSession.groups : []);
    setSaveRulesChecked(pendingImportSession.saveRulesChecked ?? true);
    setStep(pendingImportSession.step || 'review');
    showToast('Importação pendente restaurada com sucesso!', 'info');
  };

  // Discard draft session
  const handleDiscardSession = () => {
    clearImportSession();
    setStep('upload');
    setFileInfo(null);
    setItems([]);
    setGroups([]);
    showToast('Rascunho de importação descartado.', 'info');
  };

  // Open file dialog and start reconciliation
  const handleSelectFile = async () => {
    setErrorMessage('');
    if (!window.electronAPI) {
      setErrorMessage('Ambiente desktop não detectado.');
      return;
    }

    try {
      const res = await window.electronAPI.openBankingFileDialog();
      if (res.canceled || !res.content) return;

      const fileType = res.fileType === 'ofx' ? 'ofx' : 'csv';
      const newFileInfo = {
        fileName: res.fileName || 'extrato',
        fileType,
        content: res.content,
        savedStatementId: res.savedStatementId || null,
        savedPath: res.savedPath || null,
      };

      setFileInfo(newFileInfo);
      setSavedStatementId(res.savedStatementId || null);
      setSavedVaultPath(res.savedPath || null);

      const defaultId = destType === 'account' ? activeAccounts[0]?.id : activeCards[0]?.id;
      const targetId = destinationId || defaultId || '';
      setDestinationId(targetId);

      setIsProcessing(true);

      if (fileType === 'ofx') {
        const parsedItems = await window.electronAPI.parseOFX(res.content);
        if (!parsedItems || parsedItems.length === 0) {
          setErrorMessage('Nenhum lançamento válido foi encontrado no arquivo OFX.');
          setIsProcessing(false);
          return;
        }
        await reconcileAndProceed(targetId, parsedItems, newFileInfo);
      } else {
        // CSV Parsing
        const parsed = await window.electronAPI.parseCSV(res.content);
        setCsvParsed(parsed);
        setCustomMapping({
          delimiter: parsed.delimiter,
          dateIndex: parsed.detectedMapping.dateIndex,
          descIndex: parsed.detectedMapping.descIndex,
          amountIndex: parsed.detectedMapping.amountIndex,
          typeIndex: parsed.detectedMapping.typeIndex,
        });

        if (!parsed.items || parsed.items.length === 0) {
          setStep('mapping');
          setIsProcessing(false);
          return;
        }

        await reconcileAndProceed(targetId, parsed.items, newFileInfo);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reconcile and transition to review step
  const reconcileAndProceed = async (targetId: string, rawItems: any[], currentFileInfo = fileInfo) => {
    if (!window.electronAPI) return;
    try {
      const reconciled = await window.electronAPI.reconcileImport({
        accountId: targetId,
        isCreditCard: destType === 'card',
        items: rawItems,
      });

      setItems(reconciled.items || []);
      setGroups(reconciled.groups || []);
      setStep('review');

      if (currentFileInfo) {
        saveImportSession({
          fileInfo: currentFileInfo,
          destType,
          destinationId: targetId,
          items: reconciled.items || [],
          groups: reconciled.groups || [],
          saveRulesChecked: true,
          step: 'review',
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conciliar transações.');
    }
  };

  // Apply CSV custom column mapping
  const handleApplyCustomMapping = async () => {
    if (!fileInfo?.content || !window.electronAPI) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const parsed = await window.electronAPI.parseCSV(fileInfo.content, customMapping);
      setCsvParsed(parsed);

      if (!parsed.items || parsed.items.length === 0) {
        setErrorMessage('Nenhum lançamento foi reconhecido com o mapeamento atual. Verifique as colunas de data e valor.');
        setIsProcessing(false);
        return;
      }

      const targetId = destinationId || (destType === 'account' ? activeAccounts[0]?.id : activeCards[0]?.id) || '';
      await reconcileAndProceed(targetId, parsed.items);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao aplicar mapeamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Switch destination account/card and recalculate duplicate matches
  const handleDestinationChange = async (type: 'account' | 'card', id: string) => {
    setDestType(type);
    setDestinationId(id);

    if (items.length > 0 && window.electronAPI) {
      try {
        const raw = items.map(i => ({
          id: i.id,
          fitId: i.fitId,
          transactionDate: i.transactionDate,
          description: i.description,
          originalDescription: i.originalDescription,
          origin: i.origin,
          amount: i.amount,
          type: i.type,
          categoryId: i.categoryId,
          memo: i.memo,
          name: i.name,
          checkNum: i.checkNum,
          refNum: i.refNum,
          trnType: i.trnType,
        }));
        const reconciled = await window.electronAPI.reconcileImport({
          accountId: id,
          isCreditCard: type === 'card',
          items: raw,
        });
        setItems(reconciled.items || []);
        setGroups(reconciled.groups || []);
      } catch (err) {
        console.error('Error re-reconciling destination:', err);
      }
    }
  };

  // Bulk Category Assignment to an Origin Group
  const handleGroupCategoryChange = (origin: string, categoryId: string) => {
    const cat = (categories || []).find(c => c.id === categoryId);
    const catName = cat ? cat.name : undefined;

    setGroups(prev =>
      prev.map(g =>
        g.origin === origin
          ? {
              ...g,
              suggestedCategoryId: categoryId || null,
              suggestedCategoryName: catName || null,
              items: g.items.map(i => ({ ...i, categoryId, categoryName: catName })),
            }
          : g
      )
    );

    setItems(prev =>
      prev.map(i =>
        i.origin === origin
          ? { ...i, categoryId: categoryId || undefined, categoryName: catName }
          : i
      )
    );
  };

  // Individual item category change
  const handleItemCategoryChange = (itemId: string, categoryId: string) => {
    const cat = (categories || []).find(c => c.id === categoryId);
    const catName = cat ? cat.name : undefined;

    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, categoryId: categoryId || undefined, categoryName: catName } : i))
    );

    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(i =>
          i.id === itemId ? { ...i, categoryId: categoryId || undefined, categoryName: catName } : i
        ),
      }))
    );
  };

  // Select/Deselect groups and items
  const toggleGroupSelected = (origin: string) => {
    const group = groups.find(g => g.origin === origin);
    if (!group) return;
    const allSelected = group.items.every(i => i.selected);

    setItems(prev =>
      prev.map(i => (i.origin === origin ? { ...i, selected: !allSelected } : i))
    );

    setGroups(prev =>
      prev.map(g =>
        g.origin === origin
          ? {
              ...g,
              items: g.items.map(i => ({ ...i, selected: !allSelected })),
            }
          : g
      )
    );
  };

  const toggleItem = (itemId: string) => {
    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, selected: !i.selected } : i))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = items.every(i => i.selected);
    setItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(i => ({ ...i, selected: !allSelected })),
      }))
    );
  };

  const deselectDuplicates = () => {
    setItems(prev => prev.map(i => ({ ...i, selected: !i.isDuplicate })));
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(i => ({ ...i, selected: !i.isDuplicate })),
      }))
    );
    showToast('Transações duplicadas desmarcadas.', 'info');
  };

  const toggleOriginExpand = (origin: string) => {
    setExpandedOrigins(prev => ({
      ...prev,
      [origin]: !prev[origin],
    }));
  };

  // Metrics calculation
  const stats: ImportSummaryStats = useMemo(() => {
    return {
      totalCount: items.length,
      categorizedCount: items.filter(i => Boolean(i.categoryId)).length,
      pendingCategoryCount: items.filter(i => !i.categoryId).length,
      duplicateCount: items.filter(i => i.isDuplicate).length,
      groupsCount: groups.length,
    };
  }, [items, groups]);

  const selectedCount = items.filter(i => i.selected).length;
  const progressPercent = stats.totalCount > 0 ? Math.round((stats.categorizedCount / stats.totalCount) * 100) : 0;

  // Filtered groups & items
  const filteredGroups = useMemo(() => {
    if (filterMode === 'all') return groups;
    if (filterMode === 'pending') {
      return groups.filter(g => g.items.some(i => !i.categoryId));
    }
    if (filterMode === 'categorized') {
      return groups.filter(g => g.items.every(i => Boolean(i.categoryId)));
    }
    if (filterMode === 'duplicates') {
      return groups.filter(g => g.items.some(i => i.isDuplicate));
    }
    return groups;
  }, [groups, filterMode]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'all') return items;
    if (filterMode === 'pending') return items.filter(i => !i.categoryId);
    if (filterMode === 'categorized') return items.filter(i => Boolean(i.categoryId));
    if (filterMode === 'duplicates') return items.filter(i => i.isDuplicate);
    return items;
  }, [items, filterMode]);

  // Execute batch import
  const handleConfirmImport = async () => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) {
      setErrorMessage('Selecione pelo menos um lançamento para importar.');
      return;
    }
    if (!destinationId) {
      setErrorMessage('Selecione a conta ou cartão de destino.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await window.electronAPI.batchImportTransactions({
        accountId: destinationId,
        isCreditCard: destType === 'card',
        items: selected,
        saveRules: saveRulesChecked,
        statementId: savedStatementId,
      });

      let msg = `${res.count} lançamentos importados com sucesso!`;
      if (res.learnedRulesCount && res.learnedRulesCount > 0) {
        msg += ` (${res.learnedRulesCount} novas regras inteligentes aprendidas).`;
      }

      if (savedStatementId && window.electronAPI.updateStatementStats) {
        try {
          await window.electronAPI.updateStatementStats(savedStatementId, {
            itemsCount: res.count,
            accountId: destType === 'account' ? destinationId : undefined,
            cardId: destType === 'card' ? destinationId : undefined,
          });
        } catch (e) {}
      }

      clearImportSession();
      showToast(msg, 'success');
      await refreshAll();
      setCurrentView('transactions');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao importar lançamentos.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Exit handlers
  const handleExitRequest = () => {
    if (step === 'review' && items.length > 0) {
      setExitConfirmOpen(true);
    } else {
      setCurrentView('transactions');
    }
  };

  const handleConfirmExitSave = () => {
    setExitConfirmOpen(false);
    showToast('Progresso salvo no rascunho! Você pode continuar a categorização a qualquer momento.', 'success');
    setCurrentView('dashboard');
  };

  const handleConfirmExitDiscard = () => {
    clearImportSession();
    setExitConfirmOpen(false);
    showToast('Importação descartada.', 'info');
    setCurrentView('transactions');
  };

  // Category select options
  const categoryOptions = useMemo(() => {
    return (categories || []).map(c => ({
      value: c.id,
      label: c.name,
      color: c.color,
      badge: c.type === 'expense' ? 'Despesa' : 'Receita',
    }));
  }, [categories]);

  // Account select options
  const accountOptions = useMemo(() => {
    return activeAccounts.map(a => {
      const bal = typeof a.currentBalance === 'number' ? a.currentBalance : (a.initialBalance || 0);
      return {
        value: a.id,
        label: a.name,
        badge: (bal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        icon: Landmark,
      };
    });
  }, [activeAccounts]);

  // Card select options
  const cardOptions = useMemo(() => {
    return activeCards.map(c => {
      const lim = typeof c.creditLimit === 'number' ? c.creditLimit : 0;
      return {
        value: c.id,
        label: c.name,
        badge: `Limite: ${(lim / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        icon: CreditCardIcon,
      };
    });
  }, [activeCards]);

  const hasValidDraft = Boolean(
    pendingImportSession &&
    Array.isArray(pendingImportSession.items) &&
    pendingImportSession.items.length > 0
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#090d16] text-slate-100">
      {/* Top Header */}
      <div className="p-6 pb-4 border-b border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={handleExitRequest}
            title="Voltar"
            className="p-2.5 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-brand-400" />
                Importar Extrato Bancário
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20">
                OFX / CSV Offline
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {step === 'upload' && 'Selecione o arquivo OFX ou CSV do seu banco para leitura, identificação e conciliação 100% offline.'}
              {step === 'mapping' && 'Ajuste e confirme o mapeamento das colunas do seu arquivo CSV.'}
              {step === 'review' && `Revise e categorize os lançamentos de ${fileInfo?.fileName || 'extrato'}.`}
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRulesModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center gap-2 transition-all hover:border-slate-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Regras Inteligentes</span>
          </button>

          {savedVaultPath && (
            <button
              onClick={() => window.electronAPI?.openStatementsFolder?.()}
              title="Abrir pasta de extratos salvos no Windows"
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-850 rounded-xl flex items-center gap-2 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cofre OFX</span>
            </button>
          )}

          {step === 'review' && (
            <button
              onClick={() => setExitConfirmOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl flex items-center gap-2 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Pausar e Salvar Rascunho</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-center justify-between gap-2 shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Body Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">

        {/* PROMPT: PENDING IMPORT SESSION RESUME */}
        {step === 'upload' && hasValidDraft && pendingImportSession && (
          <div className="p-5 bg-gradient-to-r from-amber-500/15 via-brand-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Deseja continuar a categorizar sua importação?
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 text-amber-300">
                      Rascunho Ativo
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Você possui uma sessão em andamento do arquivo{' '}
                    <strong className="text-white font-semibold">
                      {pendingImportSession.fileInfo?.fileName || 'extrato'}
                    </strong>{' '}
                    com{' '}
                    <strong className="text-amber-300">
                      {pendingImportSession.items.length} lançamentos
                    </strong>{' '}
                    ({pendingImportSession.items.filter(i => i && !i.categoryId).length} ainda pendentes de categorização).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDiscardSession}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 rounded-xl transition-all"
                >
                  Descartar Rascunho
                </button>
                <button
                  onClick={handleRestoreSession}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Continuar Categorização
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: UPLOAD SCREEN */}
        {step === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-3 text-xs text-slate-400 py-2">
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30">
                1. Destino & Seleção do Arquivo
              </span>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <span className="px-3 py-1 rounded-full bg-slate-900 text-slate-500 font-medium">
                2. Análise & Detecção
              </span>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <span className="px-3 py-1 rounded-full bg-slate-900 text-slate-500 font-medium">
                3. Categorização & Importação
              </span>
            </div>

            {/* Destination Selector Card */}
            <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Para qual conta ou cartão deseja importar?
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  As transações conciliadas serão associadas a este destino.
                </p>
              </div>

              {/* Toggle Account vs Card */}
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setDestType('account')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    destType === 'account'
                      ? 'border-brand-500/50 bg-brand-500/10 text-white shadow-md'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    destType === 'account' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Conta Bancária</p>
                    <p className="text-[11px] text-slate-400">Corrente, Poupança, Carteira</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDestType('card')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                    destType === 'card'
                      ? 'border-brand-500/50 bg-brand-500/10 text-white shadow-md'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    destType === 'card' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <CreditCardIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Cartão de Crédito</p>
                    <p className="text-[11px] text-slate-400">Faturas e Compras</p>
                  </div>
                </button>
              </div>

              {/* Destination Dropdown */}
              <div className="max-w-md space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">
                  {destType === 'account' ? 'Selecione a Conta:' : 'Selecione o Cartão:'}
                </label>
                {destType === 'account' ? (
                  <CustomSelect
                    options={accountOptions}
                    value={destinationId}
                    onChange={(val) => handleDestinationChange('account', val)}
                    placeholder="Selecione a conta..."
                    searchable
                  />
                ) : (
                  <CustomSelect
                    options={cardOptions}
                    value={destinationId}
                    onChange={(val) => handleDestinationChange('card', val)}
                    placeholder="Selecione o cartão..."
                    searchable
                  />
                )}
              </div>
            </div>

            {/* File Picker Drop Target */}
            <div className="p-8 bg-slate-900/60 border-2 border-dashed border-slate-850 hover:border-brand-500/50 rounded-2xl flex flex-col items-center justify-center text-center gap-4 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 group-hover:bg-brand-500/20 transition-all">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-white">
                  Selecione seu arquivo de extrato
                </h3>
                <p className="text-xs text-slate-400">
                  Compatível com <strong>.OFX</strong> de qualquer banco (Nubank, Itaú, Bradesco, Inter, Santander, BB, etc.) e planilhas <strong>.CSV</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSelectFile}
                disabled={isProcessing || !destinationId}
                className="mt-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all shadow-lg shadow-brand-600/25 disabled:opacity-50 disabled:pointer-events-none active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando e Conciliando...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Escolher Arquivo no Computador</span>
                  </>
                )}
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">100% Offline & Seguro</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Seu arquivo não é enviado para a internet ou nuvem. Tudo é lido localmente.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-start gap-3">
                <FolderOpen className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Cofre de Extratos</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Uma cópia do arquivo original é salva automaticamente no cofre local do app.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Identificação Inteligente</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Detecta estabelecimentos (iFood, Uber, Netflix) e aprende regras automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CSV MAPPING SCREEN */}
        {step === 'mapping' && csvParsed && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-brand-400" />
                    Mapeamento das Colunas do CSV
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Arquivo: {fileInfo?.fileName} • Verifique se as colunas identificadas correspondem aos dados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-850"
                >
                  Trocar Arquivo
                </button>
              </div>

              {/* Delimiter Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Separador de Campos</label>
                <div className="flex gap-3">
                  {[
                    { label: 'Ponto e vírgula (;)', val: ';' },
                    { label: 'Vírgula (,)', val: ',' },
                    { label: 'Tabulação (TAB)', val: '\t' },
                  ].map(d => (
                    <button
                      key={d.val}
                      type="button"
                      onClick={() => setCustomMapping(m => ({ ...m, delimiter: d.val }))}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                        customMapping.delimiter === d.val
                          ? 'bg-brand-500/10 border-brand-500/40 text-brand-300'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Coluna de Data *</label>
                  <CustomSelect
                    options={csvParsed.headers.map((h, idx) => ({ value: String(idx), label: `${idx + 1}. ${h}` }))}
                    value={String(customMapping.dateIndex ?? 0)}
                    onChange={(val) => setCustomMapping(m => ({ ...m, dateIndex: Number(val) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Coluna de Descrição / Histórico *</label>
                  <CustomSelect
                    options={csvParsed.headers.map((h, idx) => ({ value: String(idx), label: `${idx + 1}. ${h}` }))}
                    value={String(customMapping.descIndex ?? 1)}
                    onChange={(val) => setCustomMapping(m => ({ ...m, descIndex: Number(val) }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Coluna de Valor *</label>
                  <CustomSelect
                    options={csvParsed.headers.map((h, idx) => ({ value: String(idx), label: `${idx + 1}. ${h}` }))}
                    value={String(customMapping.amountIndex ?? 2)}
                    onChange={(val) => setCustomMapping(m => ({ ...m, amountIndex: Number(val) }))}
                  />
                </div>
              </div>

              {/* CSV Preview Table */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-slate-400">Prévia do Arquivo (primeiras linhas):</span>
                <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-48 bg-slate-950/60 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/80 text-slate-400">
                        {csvParsed.headers.map((h, idx) => (
                          <th key={idx} className="px-3 py-2 font-medium whitespace-nowrap">
                            {idx + 1}. {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 font-mono text-[11px]">
                      {csvParsed.previewRows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/30">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-300">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomMapping}
                  disabled={isProcessing}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-600/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Confirmar e Conciliar Lançamentos</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: MAIN REVIEW & RECONCILIATION WORKSPACE */}
        {step === 'review' && (
          <div className="space-y-6 animate-fade-in">
            {/* Destination Selector in Review Mode */}
            <div className="p-3.5 px-4 bg-slate-900/90 border border-brand-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
                  {destType === 'card' ? <CreditCardIcon className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Destino da Importação:
                  </span>
                  <span className="text-xs font-bold text-white">
                    {destType === 'card'
                      ? activeCards.find(c => c.id === destinationId)?.name || 'Cartão Selecionado'
                      : activeAccounts.find(a => a.id === destinationId)?.name || 'Conta Selecionada'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Alterar Destino:</span>
                <div className="w-56">
                  {destType === 'account' ? (
                    <CustomSelect
                      options={accountOptions}
                      value={destinationId}
                      onChange={(val) => handleDestinationChange('account', val)}
                      placeholder="Mudar conta..."
                    />
                  ) : (
                    <CustomSelect
                      options={cardOptions}
                      value={destinationId}
                      onChange={(val) => handleDestinationChange('card', val)}
                      placeholder="Mudar cartão..."
                    />
                  )}
                </div>
                {activeCards.length > 0 && activeAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (destType === 'account') {
                        const firstCard = activeCards[0]?.id || '';
                        handleDestinationChange('card', firstCard);
                      } else {
                        const firstAcc = activeAccounts[0]?.id || '';
                        handleDestinationChange('account', firstAcc);
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    {destType === 'account' ? 'Mudar p/ Cartão' : 'Mudar p/ Conta'}
                  </button>
                )}
              </div>
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                <span className="text-[11px] font-medium text-slate-400 block">Total de Transações</span>
                <span className="text-xl font-bold text-white mt-1 block">{stats.totalCount}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">{stats.groupsCount} estabelecimentos</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-emerald-400">Categorizados</span>
                  <span className="text-xs font-bold text-emerald-400">{progressPercent}%</span>
                </div>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">{stats.categorizedCount}</span>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                stats.pendingCategoryCount > 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-900/60 border-slate-850'
              }`}>
                <span className="text-[11px] font-medium text-amber-400 block">Pendentes de Categoria</span>
                <span className="text-xl font-bold text-amber-400 mt-1 block">{stats.pendingCategoryCount}</span>
                <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                  {stats.pendingCategoryCount > 0 ? 'Defina para organizar' : 'Tudo categorizado!'}
                </span>
              </div>

              <div className={`p-4 rounded-2xl border ${
                stats.duplicateCount > 0
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-slate-900/60 border-slate-850'
              }`}>
                <span className="text-[11px] font-medium text-rose-400 block">Duplicatas Detectadas</span>
                <span className="text-xl font-bold text-rose-400 mt-1 block">{stats.duplicateCount}</span>
                {stats.duplicateCount > 0 && (
                  <button
                    onClick={deselectDuplicates}
                    className="text-[10px] font-bold text-rose-300 hover:text-rose-100 underline mt-1 block text-left"
                  >
                    Desmarcar duplicatas
                  </button>
                )}
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
                <span className="text-[11px] font-medium text-brand-400 block">Selecionadas p/ Importar</span>
                <span className="text-xl font-bold text-brand-400 mt-1 block">{selectedCount}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">de {stats.totalCount} transações</span>
              </div>
            </div>

            {/* Control & Filter Toolbar */}
            <div className="p-4 bg-slate-900/70 border border-slate-850 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: View Mode Toggle & Filter Tabs */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'grouped'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Por Estabelecimento ({groups.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'list'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Lista Completa ({items.length})</span>
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'pending', label: `Pendentes (${stats.pendingCategoryCount})` },
                    { id: 'categorized', label: `Categorizados (${stats.categorizedCount})` },
                    { id: 'duplicates', label: `Duplicadas (${stats.duplicateCount})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilterMode(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        filterMode === f.id
                          ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Quick Selection Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
                >
                  {items.every(i => i.selected) ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>

                {stats.duplicateCount > 0 && (
                  <button
                    type="button"
                    onClick={deselectDuplicates}
                    className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all"
                  >
                    Desmarcar {stats.duplicateCount} Duplicadas
                  </button>
                )}
              </div>
            </div>

            {/* VIEW MODE 1: GROUPED BY ORIGIN / MERCHANT */}
            {viewMode === 'grouped' && (
              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <div className="p-12 text-center border border-slate-850 rounded-2xl bg-slate-900/30">
                    <p className="text-xs text-slate-400 font-medium">Nenhum grupo corresponde ao filtro selecionado.</p>
                  </div>
                ) : (
                  filteredGroups.map(group => {
                    const isExpanded = Boolean(expandedOrigins[group.origin]);
                    const allGroupSelected = group.items.every(i => i.selected);
                    const someGroupSelected = group.items.some(i => i.selected);

                    return (
                      <div
                        key={group.origin}
                        className={`border rounded-2xl overflow-hidden transition-all ${
                          group.isDuplicate
                            ? 'border-rose-500/30 bg-rose-500/5'
                            : 'border-slate-850 bg-slate-900/50 hover:border-slate-800'
                        }`}
                      >
                        {/* Group Header Card */}
                        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={allGroupSelected}
                              ref={el => {
                                if (el) el.indeterminate = someGroupSelected && !allGroupSelected;
                              }}
                              onChange={() => toggleGroupSelected(group.origin)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white tracking-wide">
                                  {group.origin}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                  {group.count} {group.count === 1 ? 'transação' : 'transações'}
                                </span>
                                {group.isAutoCategorized && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    Regra inteligente
                                  </span>
                                )}
                                {group.isDuplicate && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    Contém duplicatas
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-semibold mt-1 block ${
                                group.type === 'income' ? 'text-emerald-400' : 'text-slate-300'
                              }`}>
                                Total: {formatCurrency(group.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Group Actions: Bulk Category Selector & Expand */}
                          <div className="flex items-center gap-3">
                            <div className="w-56">
                              <CustomSelect
                                options={categoryOptions}
                                value={group.suggestedCategoryId || ''}
                                onChange={(val) => handleGroupCategoryChange(group.origin, val)}
                                placeholder="Definir p/ todo o grupo..."
                                searchable
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleOriginExpand(group.origin)}
                              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-850 border border-slate-800 flex items-center gap-1.5 transition-all"
                            >
                              <span>{isExpanded ? 'Recolher' : 'Ver Detalhes'}</span>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Group Expanded */}
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-slate-850/80 bg-slate-950/40 space-y-3">
                            <p className="text-[11px] font-medium text-slate-400 pt-3">
                              Transações individuais identificadas em <strong>{group.origin}</strong> com dados bancários completos:
                            </p>

                            <div className="space-y-3">
                              {group.items.map(item => (
                                <div
                                  key={item.id}
                                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                                    item.isDuplicate
                                      ? 'border-rose-500/30 bg-rose-500/5'
                                      : 'border-slate-850 bg-slate-900/70'
                                  }`}
                                >
                                  {/* Row 1: Checkbox, Date, Amount, Individual Category */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={() => toggleItem(item.id)}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                                      />
                                      <span className="text-xs font-mono text-slate-300">
                                        {formatDate(item.transactionDate)}
                                      </span>
                                      <span className={`text-xs font-bold ${
                                        item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                                      }`}>
                                        {item.type === 'income' ? '+' : '-'} {formatCurrency(item.amount)}
                                      </span>
                                      {item.trnType && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                          {item.trnType}
                                        </span>
                                      )}
                                    </div>

                                    <div className="w-52">
                                      <CustomSelect
                                        options={categoryOptions}
                                        value={item.categoryId || ''}
                                        onChange={(val) => handleItemCategoryChange(item.id, val)}
                                        placeholder="Categoria individual..."
                                        searchable
                                      />
                                    </div>
                                  </div>

                                  {/* Row 2: FULL TRANSACTION INFORMATION WITH NATURAL LINE BREAKS */}
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                      Informações Originais do Extrato Bancário (Completa):
                                    </span>
                                    <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words select-text">
                                      {item.originalDescription || item.description}
                                    </div>
                                  </div>

                                  {/* Row 3: Metadata Tags */}
                                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                    {item.fitId && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-mono border border-slate-750">
                                        ID Bancário (FITID): {item.fitId}
                                      </span>
                                    )}
                                    {(item.checkNum || item.refNum) && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-mono border border-slate-750">
                                        Doc/Cheque: {item.checkNum || item.refNum}
                                      </span>
                                    )}
                                    {item.name && item.name !== item.originalDescription && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-750">
                                        Favorecido/Nome: {item.name}
                                      </span>
                                    )}
                                    {item.isDuplicate && (
                                      <span className="px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-medium border border-rose-500/30 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                        Possível duplicata (já existe no sistema)
                                      </span>
                                    )}
                                    {item.isAutoCategorized && (
                                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        Auto-categorizado por regra
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW MODE 2: FLAT COMPLETE LIST */}
            {viewMode === 'list' && (
              <div className="space-y-3.5">
                {filteredItems.length === 0 ? (
                  <div className="p-12 text-center border border-slate-850 rounded-2xl bg-slate-900/30">
                    <p className="text-xs text-slate-400 font-medium">Nenhum lançamento corresponde ao filtro selecionado.</p>
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                        item.isDuplicate
                          ? 'border-rose-500/30 bg-rose-500/5'
                          : 'border-slate-850 bg-slate-900/50 hover:border-slate-800'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleItem(item.id)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                          />
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {formatDate(item.transactionDate)}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20">
                            {item.origin}
                          </span>
                          {item.trnType && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                              {item.trnType}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`text-base font-bold font-mono ${
                            item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {item.type === 'income' ? '+' : '-'} {formatCurrency(item.amount)}
                          </span>
                          <div className="w-56">
                            <CustomSelect
                              options={categoryOptions}
                              value={item.categoryId || ''}
                              onChange={(val) => handleItemCategoryChange(item.id, val)}
                              placeholder="Categoria..."
                              searchable
                            />
                          </div>
                        </div>
                      </div>

                      {/* FULL TRANSACTION INFORMATION */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Informações Originais da Transação Bancária (Completa com quebra de linha):
                        </span>
                        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words select-text">
                          {item.originalDescription || item.description}
                        </div>
                      </div>

                      {/* Metadata Chips */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        {item.fitId && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-mono border border-slate-750">
                            ID Bancário (FITID): {item.fitId}
                          </span>
                        )}
                        {(item.checkNum || item.refNum) && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-mono border border-slate-750">
                            Doc/Cheque: {item.checkNum || item.refNum}
                          </span>
                        )}
                        {item.name && item.name !== item.originalDescription && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-750">
                            Favorecido/Nome: {item.name}
                          </span>
                        )}
                        {item.isDuplicate && (
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-medium border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            Possível duplicata (já cadastrado nesta conta)
                          </span>
                        )}
                        {item.isAutoCategorized && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            Auto-categorizado
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      {step === 'review' && (
        <div className="p-4 px-6 border-t border-slate-850 bg-slate-950/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveRulesChecked}
                onChange={e => setSaveRulesChecked(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">
                Salvar alterações de categorias como <strong>regras inteligentes</strong> para próximas importações
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExitRequest}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-850 transition-all"
            >
              Cancelar / Pausar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isProcessing || selectedCount === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:pointer-events-none active:scale-98"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importando Lançamentos...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Importar {selectedCount} Lançamentos</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Exit Confirmation Guard */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Deseja pausar e continuar depois?
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Você possui <strong className="text-amber-300">{stats.pendingCategoryCount} lançamentos pendentes de categoria</strong>.
                  Podemos salvar seu progresso no aplicativo para você continuar quando desejar.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-[11px] text-slate-400 space-y-1">
              <p>• Arquivo: <span className="text-white font-semibold">{fileInfo?.fileName || 'extrato'}</span></p>
              <p>• Total conciliado: <span className="text-white font-semibold">{stats.totalCount} lançamentos</span></p>
              <p>• Já categorizados: <span className="text-emerald-400 font-semibold">{stats.categorizedCount} lançamentos</span></p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmExitSave}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Progresso e Continuar Depois</span>
              </button>

              <button
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all"
              >
                Continuar Categorizando Agora
              </button>

              <button
                type="button"
                onClick={handleConfirmExitDiscard}
                className="w-full py-2 px-4 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-all"
              >
                Descartar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <ImportRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </div>
  );
};

export const ImportView: React.FC = () => {
  return (
    <ImportViewErrorBoundary>
      <ImportViewContent />
    </ImportViewErrorBoundary>
  );
};
