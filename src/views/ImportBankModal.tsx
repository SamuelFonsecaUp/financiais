import React, { useState, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  X,
  CreditCard as CardIcon,
  Building2,
  Sparkles,
  Sliders,
  Filter,
  Layers,
  List,
  BookOpen,
  Landmark,
  ShieldCheck,
  FolderArchive,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import {
  ImportReconciledItem,
  MerchantGroup,
  ImportSummaryStats,
  CsvColumnMapping,
  ParsedCsvResult,
} from '../types';
import { ImportRulesModal } from './ImportRulesModal';

interface ImportBankModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportBankModal: React.FC<ImportBankModalProps> = ({ isOpen, onClose }) => {
  const { accounts, creditCards, categories, refreshAll, showToast } = useFinancial();

  // Navigation steps: 'upload' | 'mapping' | 'review'
  const [step, setStep] = useState<'upload' | 'mapping' | 'review'>('upload');
  const [fileInfo, setFileInfo] = useState<{ fileName: string; fileType: 'ofx' | 'csv'; content: string } | null>(null);
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeAccounts = accounts.filter(a => a.active);
  const activeCards = creditCards.filter(c => c.active);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSelectFile = async () => {
    setErrorMessage('');
    if (!window.electronAPI) return;

    try {
      const res = await window.electronAPI.openBankingFileDialog();
      if (res.canceled || !res.content) return;

      const fileType = res.fileType === 'ofx' ? 'ofx' : 'csv';
      setFileInfo({ fileName: res.fileName || 'extrato', fileType, content: res.content });
      setSavedStatementId(res.savedStatementId || null);
      setSavedVaultPath(res.savedPath || null);

      const defaultId = destType === 'account' ? activeAccounts[0]?.id : activeCards[0]?.id;
      const targetId = destinationId || defaultId || '';
      setDestinationId(targetId);

      setIsProcessing(true);

      if (fileType === 'ofx') {
        const parsedItems = await window.electronAPI.parseOFX(res.content);
        if (parsedItems.length === 0) {
          setErrorMessage('Nenhum lançamento válido foi encontrado no arquivo OFX.');
          setIsProcessing(false);
          return;
        }
        await reconcileAndProceed(targetId, parsedItems);
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

        if (parsed.items.length === 0) {
          // Send to mapping step directly so user can configure columns
          setStep('mapping');
          setIsProcessing(false);
          return;
        }

        await reconcileAndProceed(targetId, parsed.items);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reconcileAndProceed = async (targetId: string, rawItems: any[]) => {
    if (!window.electronAPI) return;
    const reconciled = await window.electronAPI.reconcileImport({
      accountId: targetId,
      isCreditCard: destType === 'card',
      items: rawItems,
    });

    setItems(reconciled.items);
    setGroups(reconciled.groups);
    setStep('review');
  };

  const handleApplyCustomMapping = async () => {
    if (!fileInfo?.content || !window.electronAPI) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const parsed = await window.electronAPI.parseCSV(fileInfo.content, customMapping);
      setCsvParsed(parsed);

      if (parsed.items.length === 0) {
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
        }));
        const reconciled = await window.electronAPI.reconcileImport({
          accountId: id,
          isCreditCard: type === 'card',
          items: raw,
        });
        setItems(reconciled.items);
        setGroups(reconciled.groups);
      } catch (err) {
        console.error('Error re-reconciling destination:', err);
      }
    }
  };

  // Bulk Category Assignment to an Origin Group
  const handleGroupCategoryChange = (origin: string, categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    const catName = cat ? cat.name : undefined;

    // Update groups
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

    // Update flat items
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
    const cat = categories.find(c => c.id === categoryId);
    const catName = cat ? cat.name : undefined;

    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, categoryId: categoryId || undefined, categoryName: catName } : i))
    );

    // Update inside groups as well
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(i =>
          i.id === itemId ? { ...i, categoryId: categoryId || undefined, categoryName: catName } : i
        ),
      }))
    );
  };

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
  };

  const deselectDuplicates = () => {
    setItems(prev => prev.map(i => ({ ...i, selected: !i.isDuplicate })));
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        items: g.items.map(i => ({ ...i, selected: !i.isDuplicate })),
      }))
    );
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
      });

      let msg = `${res.count} lançamentos importados com sucesso!`;
      if (res.learnedRulesCount && res.learnedRulesCount > 0) {
        msg += ` (${res.learnedRulesCount} novas regras aprendidas).`;
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

      showToast(msg, 'success');
      await refreshAll();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao importar lançamentos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFileInfo(null);
    setCsvParsed(null);
    setItems([]);
    setGroups([]);
    setErrorMessage('');
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Importar Extrato Bancário (OFX / CSV)"
        subtitle="Importação inteligente com identificação de estabelecimentos, categorização em massa e regras automáticas"
        maxWidth={step === 'upload' ? 'md' : '2xl'}
      >
        <div className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD & DESTINATION */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Destination selector */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  1. Conta ou Cartão de Destino
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('account', activeAccounts[0]?.id || '')}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-sm font-medium transition-all ${
                      destType === 'account'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Conta Bancária
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('card', activeCards[0]?.id || '')}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-sm font-medium transition-all ${
                      destType === 'card'
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400 shadow-md shadow-brand-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <CardIcon className="w-4 h-4" />
                    Cartão de Crédito
                  </button>
                </div>

                <div>
                  <CustomSelect
                    value={destinationId}
                    onChange={(val) => setDestinationId(val)}
                    options={
                      destType === 'account'
                        ? activeAccounts.map(a => ({
                            value: a.id,
                            label: a.name,
                            subtitle: `Saldo: ${formatCurrency(a.currentBalance)}`,
                            icon: Landmark,
                          }))
                        : activeCards.map(c => ({
                            value: c.id,
                            label: c.name,
                            subtitle: `Limite: ${formatCurrency(c.creditLimit)}`,
                            icon: CardIcon,
                          }))
                    }
                    placeholder="Selecione a conta ou cartão de destino"
                  />
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  2. Selecionar Arquivo do Banco
                </label>

                <div
                  onClick={handleSelectFile}
                  className="group border-2 border-dashed border-slate-800 hover:border-brand-500/60 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/10 group-hover:bg-brand-500/20 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-3.5 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">
                    {isProcessing ? 'Lendo e analisando arquivo...' : 'Clique para selecionar arquivo OFX ou CSV'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Reconhece extratos padrão de qualquer banco (Nubank, Itaú, Bradesco, Inter, Santander, BB, C6, etc.).
                  </p>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" /> OFX / QFX
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> CSV com Auto-Detecção
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1.5: CSV COLUMN MAPPING ADJUSTMENT */}
          {step === 'mapping' && csvParsed && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-300 font-medium flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand-400" />
                  Mapeamento de Colunas da Planilha CSV
                </span>
                <span className="text-[11px] text-slate-400">{fileInfo?.fileName}</span>
              </div>

              {/* Mapping Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Coluna da Data</label>
                  <CustomSelect
                    size="sm"
                    value={customMapping.dateIndex ?? 0}
                    onChange={(val) =>
                      setCustomMapping(prev => ({ ...prev, dateIndex: Number(val) }))
                    }
                    options={csvParsed.headers.map((h, idx) => ({
                      value: idx,
                      label: h || `Coluna ${idx + 1}`,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Coluna da Descrição</label>
                  <CustomSelect
                    size="sm"
                    value={customMapping.descIndex ?? 1}
                    onChange={(val) =>
                      setCustomMapping(prev => ({ ...prev, descIndex: Number(val) }))
                    }
                    options={csvParsed.headers.map((h, idx) => ({
                      value: idx,
                      label: h || `Coluna ${idx + 1}`,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Coluna do Valor</label>
                  <CustomSelect
                    size="sm"
                    value={customMapping.amountIndex ?? 2}
                    onChange={(val) =>
                      setCustomMapping(prev => ({ ...prev, amountIndex: Number(val) }))
                    }
                    options={csvParsed.headers.map((h, idx) => ({
                      value: idx,
                      label: h || `Coluna ${idx + 1}`,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Separador (Delimitador)</label>
                  <CustomSelect
                    size="sm"
                    value={customMapping.delimiter ?? ';'}
                    onChange={(val) =>
                      setCustomMapping(prev => ({ ...prev, delimiter: val }))
                    }
                    options={[
                      { value: ';', label: 'Ponto e Vírgula (;)' },
                      { value: ',', label: 'Vírgula (,)' },
                      { value: '\t', label: 'Tabulação (TAB)' },
                      { value: '|', label: 'Barra (|)' },
                    ]}
                  />
                </div>
              </div>

              {/* Sample Rows Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pré-visualização dos Primeiros Registros:
                </span>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[11px]">
                        {csvParsed.headers.map((h, i) => (
                          <th key={i} className="py-2 px-3 whitespace-nowrap">
                            {h || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px] text-slate-300">
                      {csvParsed.previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/40">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomMapping}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20"
                >
                  {isProcessing ? 'Re-analisando...' : 'Avançar para Revisão'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COMPREHENSIVE REVIEW SCREEN */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Vault confirmation alert */}
              {savedVaultPath && (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Uma cópia original deste extrato (<strong>{fileInfo?.fileName}</strong>) foi arquivada automaticamente no Cofre do aplicativo.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.electronAPI.openStatementsFolder()}
                    className="shrink-0 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 ml-3"
                  >
                    <FolderArchive className="w-3.5 h-3.5" /> Abrir Pasta
                  </button>
                </div>
              )}

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-medium">Total Encontradas</span>
                  <p className="text-lg font-bold text-white font-mono mt-0.5">
                    {stats.totalCount} <span className="text-xs font-normal text-slate-500">em {stats.groupsCount} origens</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl">
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Categorizadas
                  </span>
                  <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {stats.categorizedCount}
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-amber-500/30 rounded-xl">
                  <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Precisam Categoria
                  </span>
                  <p className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                    {stats.pendingCategoryCount}
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-purple-400 font-medium">Duplicadas</span>
                  <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                    {stats.duplicateCount}
                  </p>
                </div>
              </div>

              {/* View toggle & Filters Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                {/* View Switch */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'grouped'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Por Origem ({groups.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'list'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    Lista Completa ({items.length})
                  </button>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterMode === 'all'
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('pending')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterMode === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    Sem Categoria ({stats.pendingCategoryCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('categorized')}
                    className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                      filterMode === 'categorized'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    Categorizadas ({stats.categorizedCount})
                  </button>
                  {stats.duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode('duplicates')}
                      className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                        filterMode === 'duplicates'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'text-slate-400 hover:text-purple-300'
                      }`}
                    >
                      Duplicadas ({stats.duplicateCount})
                    </button>
                  )}
                </div>

                {/* Quick actions: Deselect duplicates & Manage rules */}
                <div className="flex items-center gap-2">
                  {stats.duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={deselectDuplicates}
                      className="px-2.5 py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1"
                      title="Desmarcar todas as duplicadas da importação"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Ignorar Duplicatas
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setRulesModalOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Ver ou gerenciar regras automáticas aprendidas"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* VIEW 1: GROUPED BY ORIGIN / ESTABLISHMENT */}
              {viewMode === 'grouped' && (
                <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                  {filteredGroups.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Nenhum estabelecimento encontrado com o filtro selecionado.
                    </div>
                  ) : (
                    filteredGroups.map((group) => {
                      const isExpanded = Boolean(expandedOrigins[group.origin]);
                      const allGroupSelected = group.items.every(i => i.selected);

                      return (
                        <div
                          key={group.origin}
                          className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3 space-y-2 hover:border-slate-700/80 transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleGroupSelected(group.origin)}
                                className="text-slate-400 hover:text-white shrink-0"
                              >
                                {allGroupSelected ? (
                                  <CheckSquare className="w-4 h-4 text-brand-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-600" />
                                )}
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-sm text-white font-mono uppercase tracking-wide truncate">
                                    {group.origin}
                                  </h4>

                                  <span className="text-xs text-slate-400 font-sans">
                                    — {group.count} {group.count === 1 ? 'transação' : 'transações'} —
                                  </span>

                                  <span className="font-mono font-bold text-xs text-white">
                                    {formatCurrency(group.totalAmount)}
                                  </span>

                                  {group.isAutoCategorized && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 shrink-0">
                                      <Sparkles className="w-2.5 h-2.5" /> Regra Automática
                                    </span>
                                  )}

                                  {group.isDuplicate && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                      Duplicada
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Bulk category picker for this group */}
                              <div className="w-56">
                                <CustomSelect
                                  size="sm"
                                  value={group.suggestedCategoryId || ''}
                                  onChange={(val) => handleGroupCategoryChange(group.origin, val)}
                                  placeholder={`⚠️ Escolher Categoria (${group.count})`}
                                  options={[
                                    { value: '', label: `⚠️ Escolher Categoria (${group.count})` },
                                    ...categories
                                      .filter(c => c.type === group.type)
                                      .map(c => ({
                                        value: c.id,
                                        label: c.name,
                                        color: c.color,
                                      })),
                                  ]}
                                />
                              </div>

                              {/* Expand toggle */}
                              <button
                                type="button"
                                onClick={() => toggleOriginExpand(group.origin)}
                                className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors"
                                title="Ver transações individuais deste estabelecimento"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded individual transactions inside the group */}
                          {isExpanded && (
                            <div className="pt-2 mt-2 border-t border-slate-800/80 space-y-1.5 pl-6">
                              {group.items.map((item) => {
                                const isExp = item.type === 'expense';
                                const [y, m, d] = item.transactionDate.split('-');
                                const formattedDate = `${d}/${m}/${y}`;

                                return (
                                  <div
                                    key={item.id}
                                    className="p-2 bg-slate-900/70 border border-slate-800/70 rounded-lg flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => toggleItem(item.id)}
                                        className="text-slate-400 hover:text-white"
                                      >
                                        {item.selected ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-slate-600" />
                                        )}
                                      </button>

                                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                        {formattedDate}
                                      </span>

                                      <span className="text-slate-300 font-medium truncate" title={item.originalDescription || item.description}>
                                        {item.originalDescription || item.description}
                                      </span>

                                      {item.isDuplicate && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                          Duplicata
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className={`font-mono font-bold ${isExp ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {isExp ? '-' : '+'} {formatCurrency(item.amount)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* VIEW 2: FLAT LIST DETAIL */}
              {viewMode === 'list' && (
                <div className="max-h-[380px] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 text-slate-400">
                        <th className="py-2.5 px-3 w-10 text-center">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-slate-400 hover:text-white"
                          >
                            {items.every(i => i.selected) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3 w-24">Data</th>
                        <th className="py-2.5 px-3">Descrição Original</th>
                        <th className="py-2.5 px-3 w-32">Origem Limpa</th>
                        <th className="py-2.5 px-3 w-40">Categoria</th>
                        <th className="py-2.5 px-3 text-right w-28">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredItems.map((item) => {
                        const isExp = item.type === 'expense';
                        const [y, m, d] = item.transactionDate.split('-');
                        const formattedDate = `${d}/${m}/${y}`;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-900/40 transition-colors ${
                              item.isDuplicate ? 'bg-purple-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleItem(item.id)}
                                className="text-slate-400 hover:text-white"
                              >
                                {item.selected ? (
                                  <CheckSquare className="w-4 h-4 text-brand-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-600" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                              {formattedDate}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-white truncate max-w-[200px]" title={item.originalDescription || item.description}>
                                  {item.originalDescription || item.description}
                                </span>
                                {item.isDuplicate && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    Duplicata
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 font-bold uppercase truncate max-w-[120px] inline-block">
                                {item.origin}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 min-w-[190px]">
                              <CustomSelect
                                size="sm"
                                value={item.categoryId || ''}
                                onChange={(val) => handleItemCategoryChange(item.id, val)}
                                placeholder="Sem Categoria"
                                options={[
                                  { value: '', label: 'Sem Categoria' },
                                  ...categories
                                    .filter(c => c.type === item.type)
                                    .map(c => ({
                                      value: c.id,
                                      label: c.name,
                                      color: c.color,
                                    })),
                                ]}
                              />
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-medium ${isExp ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isExp ? '-' : '+'} {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Learned Rules Checkbox and Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveRulesChecked}
                    onChange={(e) => setSaveRulesChecked(e.target.checked)}
                    className="accent-brand-500 rounded w-4 h-4"
                  />
                  <span>
                    Salvar associações como <strong className="text-brand-400">regras automáticas</strong> para próximas importações
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(fileInfo?.fileType === 'csv' ? 'mapping' : 'upload')}
                    className="flex items-center gap-1 px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 rounded-xl"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isProcessing || selectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isProcessing ? 'Importando...' : `Confirmar Importação (${selectedCount})`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Rules Manager Modal */}
      <ImportRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
    </>
  );
};
