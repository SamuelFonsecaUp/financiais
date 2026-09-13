import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Power,
  Edit2,
  Check,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { CustomSelect } from '../components/CustomSelect';
import { useFinancial } from '../context/FinancialContext';
import { ImportRule } from '../types';

interface ImportRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportRulesModal: React.FC<ImportRulesModalProps> = ({ isOpen, onClose }) => {
  const { categories, showToast } = useFinancial();

  const [rules, setRules] = useState<ImportRule[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // New / Edit rule state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [patternInput, setPatternInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const loadRules = async () => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      const list = await window.electronAPI.getImportRules();
      setRules(list);
    } catch (err: any) {
      console.error('Error loading import rules:', err);
      showToast(err.message || 'Erro ao carregar regras de importação.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
      setShowAddForm(false);
      setEditingRuleId(null);
      setSearch('');
    }
  }, [isOpen]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternInput.trim()) {
      showToast('Informe o nome ou padrão do estabelecimento.', 'error');
      return;
    }
    try {
      await window.electronAPI.saveImportRule({
        id: editingRuleId || undefined,
        pattern: patternInput.trim(),
        categoryId: categoryInput || null,
        active: true,
      });

      showToast(
        editingRuleId ? 'Regra atualizada com sucesso!' : 'Nova regra de categorização criada!',
        'success'
      );
      setPatternInput('');
      setCategoryInput('');
      setEditingRuleId(null);
      setShowAddForm(false);
      await loadRules();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar regra.', 'error');
    }
  };

  const handleStartEdit = (rule: ImportRule) => {
    setEditingRuleId(rule.id);
    setPatternInput(rule.pattern);
    setCategoryInput(rule.categoryId || '');
    setShowAddForm(true);
  };

  const handleToggle = async (rule: ImportRule) => {
    try {
      await window.electronAPI.toggleImportRule(rule.id);
      await loadRules();
      showToast(rule.active ? `Regra "${rule.pattern}" pausada.` : `Regra "${rule.pattern}" reativada.`, 'info');
    } catch (err: any) {
      showToast('Erro ao alternar regra.', 'error');
    }
  };

  const handleDelete = async (id: string, pattern: string) => {
    try {
      await window.electronAPI.deleteImportRule(id);
      showToast(`Regra "${pattern}" excluída com sucesso.`, 'info');
      await loadRules();
    } catch (err: any) {
      showToast('Erro ao excluir regra.', 'error');
    }
  };

  const filteredRules = rules.filter(r => {
    const q = search.toLowerCase();
    return (
      r.pattern.toLowerCase().includes(q) ||
      (r.categoryName && r.categoryName.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Regras de Categorização Automática"
      subtitle="Regras aprendidas pelo sistema para categorizar extratos bancários instantaneamente"
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Top search & Add Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por estabelecimento ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingRuleId(null);
              setPatternInput('');
              setCategoryInput(categories[0]?.id || '');
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Regra
          </button>
        </div>

        {/* Add / Edit Inline Form */}
        {showAddForm && (
          <form onSubmit={handleSaveRule} className="p-4 bg-slate-950/80 border border-brand-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-brand-400">
              <span>{editingRuleId ? 'Editar Regra Automática' : 'Criar Nova Regra'}</span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Estabelecimento / Origem (ex: IFOOD, UBER)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome ou termo da descrição..."
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Categoria Automática
                </label>
                <CustomSelect
                  size="sm"
                  value={categoryInput}
                  onChange={(val) => setCategoryInput(val)}
                  options={[
                    { value: '', label: 'Sem Categoria' },
                    ...categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                      color: c.color,
                      subtitle: c.type === 'income' ? 'Receita' : 'Despesa',
                    })),
                  ]}
                  placeholder="Selecione a categoria"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg shadow-md"
              >
                {editingRuleId ? 'Salvar Alterações' : 'Salvar Regra'}
              </button>
            </div>
          </form>
        )}

        {/* Rules Table / List */}
        <div className="max-h-[360px] overflow-y-auto border border-slate-800/80 rounded-xl bg-slate-950/40 divide-y divide-slate-800/60">
          {filteredRules.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <Sparkles className="w-8 h-8 text-brand-400/50 mx-auto" />
              <p>Nenhuma regra de categorização encontrada.</p>
              <p className="text-[11px] text-slate-600">
                Ao importar arquivos OFX/CSV e escolher categorias para estabelecimentos, o sistema salvará automaticamente novas regras aqui.
              </p>
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors ${
                  !rule.active ? 'opacity-50 bg-slate-950/40' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule)}
                    title={rule.active ? 'Pausar regra' : 'Ativar regra'}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      rule.active
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white uppercase tracking-wide">
                        {rule.pattern}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="text-xs font-medium text-brand-400 flex items-center gap-1.5">
                        {rule.categoryColor && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: rule.categoryColor }}
                          />
                        )}
                        {rule.categoryName || 'Sem Categoria'}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500">
                      Aplicada {rule.matchCount} {rule.matchCount === 1 ? 'vez' : 'vezes'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(rule)}
                    title="Editar regra"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule.id, rule.pattern)}
                    title="Excluir regra"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
          <span>{rules.length} regras automáticas configuradas</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
