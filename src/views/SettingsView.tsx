import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Download,
  Upload,
  Check,
  Wrench,
  Sparkles,
  Smartphone,
  Trash2,
  HardDrive,
  Database,
  ShieldCheck,
  Tag,
  Star,
  Edit2,
  Plus,
  X,
  Clock
} from 'lucide-react';
import { AppConfig, ConsistencyIssue, TestResultItem, ItemTabelaPreco } from '../types';
import { StorageService, StorageHealthInfo } from '../services/storage';
import { ConsistencyService } from '../services/consistency';
import { TestRunnerService } from '../services/testRunner';
import { parseCurrencyToCents, formatCurrency, formatCurrencyRaw } from '../utils/currency';
import { useToast } from '../context/ToastContext';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const currentConfig = StorageService.getConfig();

  // Config State
  const [nomeGoleiro, setNomeGoleiro] = useState(currentConfig.nomeGoleiro);
  const [apelido, setApelido] = useState(currentConfig.apelido);
  const [telefone, setTelefone] = useState(currentConfig.telefone);
  const [cidade, setCidade] = useState(currentConfig.cidade);
  const [chavePixTipo, setChavePixTipo] = useState(currentConfig.chavePixTipo);
  const [chavePix, setChavePix] = useState(currentConfig.chavePix);
  const [valorHoraInput, setValorHoraInput] = useState(
    ((currentConfig.valorPadraoHoraCentavos || 3500) / 100).toFixed(2).replace('.', ',')
  );

  // Tabela de Preços (Seção 2.3) State
  const [tabelaPrecos, setTabelaPrecos] = useState<ItemTabelaPreco[]>([]);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState<ItemTabelaPreco | null>(null);
  const [duracaoMinutosInput, setDuracaoMinutosInput] = useState<number>(60);
  const [precoCentavosInput, setPrecoCentavosInput] = useState<string>('40,00');
  const [precoAtivoInput, setPrecoAtivoInput] = useState<boolean>(true);
  const [precoPrincipalInput, setPrecoPrincipalInput] = useState<boolean>(false);

  // Verificação de Consistência State
  const [issues, setIssues] = useState<ConsistencyIssue[] | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Storage Health State
  const [storageHealth, setStorageHealth] = useState<StorageHealthInfo | null>(null);
  const [auditingStorage, setAuditingStorage] = useState(false);

  useEffect(() => {
    // Carrega saúde inicial do storage e tabela de preços
    setStorageHealth(StorageService.getStorageHealthInfo());
    setTabelaPrecos(StorageService.getTabelaPrecos(false));
  }, []);

  const refreshPrices = () => {
    setTabelaPrecos(StorageService.getTabelaPrecos(false));
  };

  const handleAuditStorage = () => {
    setAuditingStorage(true);
    setTimeout(() => {
      const info = StorageService.getStorageHealthInfo();
      setStorageHealth(info);
      setAuditingStorage(false);
      if (info.isPersistent) {
        showToast('Auditoria concluída: LocalStorage persistente no disco e operacional!', 'success');
      } else {
        showToast('Atenção: Sistema operando em memória volátil. Risco de perda ao fechar navegador.', 'warning');
      }
    }, 250);
  };

  // Test Runner State
  const [testResults, setTestResults] = useState<{
    passed: number;
    failed: number;
    total: number;
    results: TestResultItem[];
  } | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const valorPadraoHoraCentavos = parseCurrencyToCents(valorHoraInput);

    const updated: AppConfig = {
      ...currentConfig,
      nomeGoleiro: nomeGoleiro.trim(),
      apelido: apelido.trim(),
      telefone: telefone.trim(),
      cidade: cidade.trim(),
      chavePixTipo,
      chavePix: chavePix.trim(),
      valorPadraoHoraCentavos
    };

    StorageService.saveConfig(updated);
    showToast('Configurações salvas com sucesso!', 'success');
  };

  // Pricing Table Handlers (Seção 2.3)
  const handleOpenNewPrice = () => {
    setEditingPriceItem(null);
    setDuracaoMinutosInput(60);
    setPrecoCentavosInput('40,00');
    setPrecoAtivoInput(true);
    setPrecoPrincipalInput(false);
    setPriceModalOpen(true);
  };

  const handleOpenEditPrice = (item: ItemTabelaPreco) => {
    setEditingPriceItem(item);
    setDuracaoMinutosInput(item.duracaoMinutos);
    setPrecoCentavosInput((item.valorCentavos / 100).toFixed(2).replace('.', ','));
    setPrecoAtivoInput(item.ativo);
    setPrecoPrincipalInput(Boolean(item.principal));
    setPriceModalOpen(true);
  };

  const handleSavePriceItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCurrencyToCents(precoCentavosInput);
    if (cents <= 0) {
      showToast('Informe um valor válido maior que zero', 'error');
      return;
    }
    const id = editingPriceItem?.id || `preco-${duracaoMinutosInput}-${cents}-${Date.now()}`;
    const item: ItemTabelaPreco = {
      id,
      duracaoMinutos: Number(duracaoMinutosInput),
      valorCentavos: cents,
      ativo: precoAtivoInput,
      principal: precoPrincipalInput,
      createdAt: editingPriceItem?.createdAt || new Date().toISOString()
    };
    StorageService.saveItemTabelaPreco(item);
    refreshPrices();
    setPriceModalOpen(false);
    showToast('Opção de preço salva com sucesso!', 'success');
  };

  const handleTogglePrice = (id: string) => {
    StorageService.toggleItemTabelaPreco(id);
    refreshPrices();
    showToast('Status do preço atualizado', 'success');
  };

  const handleDeletePrice = (id: string) => {
    const res = StorageService.deleteItemTabelaPreco(id);
    refreshPrices();
    if (res.success) {
      showToast('Opção de preço excluída com sucesso!', 'success');
    } else {
      showToast(res.reason || 'Opção desativada para preservar histórico.', 'warning');
    }
  };

  const handleRunConsistency = () => {
    setVerifying(true);
    setTimeout(() => {
      const foundIssues = ConsistencyService.checkAll();
      setIssues(foundIssues);
      setVerifying(false);
      if (foundIssues.length === 0) {
        showToast('Excelente! Nenhuma inconsistência detectada no banco de dados.', 'success');
      } else {
        showToast(`${foundIssues.length} pendência(s) de integridade identificada(s).`, 'warning');
      }
    }, 300);
  };

  const handleAutoFix = (issueId: string) => {
    const success = ConsistencyService.autoFixIssue(issueId);
    if (success) {
      showToast('Problema corrigido com sucesso!', 'success');
      // Reexecuta a verificação
      const foundIssues = ConsistencyService.checkAll();
      setIssues(foundIssues);
    } else {
      showToast('Não foi possível corrigir este item automaticamente', 'error');
    }
  };

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await TestRunnerService.runAllTests();
      setTestResults(res);
      if (res.failed === 0) {
        showToast(`Todos os ${res.total} testes obrigatórios foram APROVADOS!`, 'success');
      } else {
        showToast(`${res.failed} teste(s) reprovado(s)`, 'error');
      }
    } catch (e) {
      showToast('Erro ao rodar suite de testes', 'error');
    } finally {
      setRunningTests(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const json = StorageService.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_goleiro_pro_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exportado com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao exportar backup', 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      const res = StorageService.importBackupWithDetails(text);
      if (res.success) {
        showToast(
          `Backup restaurado com sucesso! ${res.importedCounts.partidas || 0} partidas e ${res.importedCounts.contratantes || 0} clientes carregados.`,
          'success'
        );
        setTimeout(() => window.location.reload(), 900);
      } else {
        const primaryError = res.errors[0] || 'Arquivo de backup inválido';
        showToast(`Erro na restauração: ${primaryError}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    const confirma = window.confirm(
      'Atenção: Deseja realmente zerar todos os dados do aplicativo? Todas as partidas, clientes e registros serão apagados para deixar o app 100% limpo para seu uso real.'
    );
    if (!confirma) return;

    StorageService.clearAllData();
    localStorage.setItem('goleiro_pro_clean_state', 'true');
    showToast('Aplicativo zerado e limpo com sucesso!', 'success');
    setTimeout(() => window.location.reload(), 600);
  };

  const handleResetDemo = () => {
    const confirma = window.confirm(
      'Deseja carregar o banco de dados com os dados de demonstração (exemplo)? Isso substituirá os registros atuais.'
    );
    if (!confirma) return;

    StorageService.seedInitialData(true);
    showToast('Dados de demonstração carregados com sucesso!', 'success');
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Preferências do Sistema
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Configurações & Diagnósticos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Chave Pix, dados cadastrais, integridade de dados e execução dos 30 testes obrigatórios.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Dados do Goleiro, Backup e Tabela de Preços (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Settings className="w-5 h-5 text-[#22C7E8]" /> Dados do Goleiro & Chave Pix
          </h3>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nomeGoleiro}
                  onChange={e => setNomeGoleiro(e.target.value)}
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Apelido nos Jogos</label>
                <input
                  type="text"
                  value={apelido}
                  onChange={e => setApelido(e.target.value)}
                  placeholder="Ex: Muralha, Paredão..."
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1">Cidade / Região</label>
                <input
                  type="text"
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>
            </div>

            {/* Chave Pix */}
            <div className="bg-[#0B1220] p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#22C7E8] block">
                Chave Pix para Recebimento
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Tipo de Chave</label>
                  <select
                    value={chavePixTipo}
                    onChange={e => setChavePixTipo(e.target.value as any)}
                    className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none uppercase"
                  >
                    <option value="telefone">Telefone</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="aleatoria">Chave Aleatória</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 uppercase font-semibold mb-1">Chave Pix</label>
                  <input
                    type="text"
                    required
                    value={chavePix}
                    onChange={e => setChavePix(e.target.value)}
                    placeholder="Chave que aparecerá no extrato do contratante"
                    className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-semibold mb-1">
                Valor Padrão por Hora / Jogo (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorHoraInput}
                onChange={e => setValorHoraInput(e.target.value)}
                onBlur={() => {
                  const cents = parseCurrencyToCents(valorHoraInput);
                  setValorHoraInput(formatCurrencyRaw(cents));
                }}
                placeholder="Ex: 35,00"
                className="w-full max-w-xs bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white font-bold outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>

          {/* Backup e Restauração */}
          <div className="pt-5 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Backup & Restauração dos Dados
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <Download className="w-4 h-4" /> Exportar JSON
              </button>

              <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700">
                <Upload className="w-4 h-4" /> Importar Backup
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>

              <button
                onClick={handleClearAllData}
                className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-red-300 hover:text-red-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Apaga todos os dados e deixa o app 100% limpo"
              >
                <Trash2 className="w-3.5 h-3.5" /> Zerar App (Limpar Tudo)
              </button>

              <button
                onClick={handleResetDemo}
                className="px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                title="Carrega dados de teste para demonstração"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Carregar Demo
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Preços (Pricing Table - Seção 2.3) */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#22C7E8]" /> Tabela de Preços (Pricing Table)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Preços fixos selecionáveis por duração. O valor de <strong>R$ 40,00 para 60 min</strong> é a referência primária.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewPrice}
              className="px-3.5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Novo Preço
            </button>
          </div>

          {/* Lista Agrupada por Duração */}
          <div className="space-y-3">
            {[60, 90, 120].map(dur => {
              const itensDuracao = tabelaPrecos.filter(p => p.duracaoMinutos === dur);
              if (itensDuracao.length === 0) return null;

              return (
                <div key={dur} className="bg-[#0B1220] p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#22C7E8] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {dur} minutos ({dur === 60 ? '1 hora' : dur === 90 ? '1h30' : '2 horas'})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {itensDuracao.filter(i => i.ativo).length} ativo(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {itensDuracao.map(item => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                          item.ativo
                            ? 'bg-[#111A2E] border-slate-700/80'
                            : 'bg-slate-900/60 border-slate-800/80 opacity-60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-white">
                              {formatCurrency(item.valorCentavos)}
                            </span>
                            {item.principal && (
                              <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" /> Principal
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {item.ativo ? 'Disponível no agendamento' : 'Inativo (preservado)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePrice(item.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              item.ativo
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={item.ativo ? 'Desativar opção' : 'Ativar opção'}
                          >
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditPrice(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePrice(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
                            title="Excluir ou arquivar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Outras Durações */}
            {tabelaPrecos.some(p => p.duracaoMinutos !== 60 && p.duracaoMinutos !== 90 && p.duracaoMinutos !== 120) && (
              <div className="bg-[#0B1220] p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-[#22C7E8] uppercase tracking-wider block">
                  Outras Durações
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tabelaPrecos
                    .filter(p => p.duracaoMinutos !== 60 && p.duracaoMinutos !== 90 && p.duracaoMinutos !== 120)
                    .map(item => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border bg-[#111A2E] border-slate-700/80 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-sm font-black text-white">
                            {formatCurrency(item.valorCentavos)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{item.duracaoMinutos} minutos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePrice(item.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300"
                          >
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePrice(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Diagnósticos & Identidade: ProGestor, Verificação de Consistência e 30 Testes (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Caixa de Diagnóstico da Persistência de Dados (Storage Audit) */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#22C7E8]" /> Auditoria de Persistência & Storage
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifica gravação no disco, integridade do LocalStorage e proteção contra perda ao fechar a aba.
                </p>
              </div>

              <button
                onClick={handleAuditStorage}
                disabled={auditingStorage}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0 border border-slate-700"
              >
                <Database className="w-3.5 h-3.5 text-[#22C7E8]" />
                {auditingStorage ? 'Auditando...' : 'Auditar Agora'}
              </button>
            </div>

            {storageHealth && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">Driver de Armazenamento:</span>
                  <div className="flex items-center gap-2 font-bold">
                    {storageHealth.isPersistent ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> LocalStorage (Disco Local)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Memória Volátil
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">Sobrevivência a F5 / Fechamento:</span>
                  <div className="flex items-center gap-2 font-bold">
                    {storageHealth.isPersistent ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Garantido (Persistente)
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Não persistente (Perda em F5)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">Espaço Utilizado:</span>
                  <div className="font-bold text-slate-200">
                    {(storageHealth.totalBytesUsed / 1024).toFixed(1)} KB / 5.0 MB ({storageHealth.percentUsed}%)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400">Status de Gravação:</span>
                  <div className="font-bold">
                    {storageHealth.lastWriteSuccess ? (
                      <span className="text-emerald-400">100% Operacional</span>
                    ) : (
                      <span className="text-red-400">Falha: {storageHealth.lastErrorMessage}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cartão de Identidade Oficial ProGestor */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[#22C7E8]/50 shadow-lg shadow-[#22C7E8]/20 shrink-0 bg-[#0B1220]">
              <img
                src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
                alt="ProGestor"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white tracking-tight">
                  PRO<span className="text-[#22C7E8]">GESTOR</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#22C7E8]/15 text-[#22C7E8] border border-[#22C7E8]/30">
                  v2.0 • Pro
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Gestão Pessoal & Financeira de Goleiro de Aluguel
              </p>
              <p className="text-[11px] text-slate-500">
                Identidade oficial ativada • Tema em azul-marinho e grafite com realce turquesa
              </p>
            </div>
          </div>

          {/* Caixa 1: Verificação de Consistência (Requisito 18) */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#22C7E8]" /> Verificação de Consistência
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audita conflitos, status financeiros, integridade de ciclos e duplicatas (Item 18).
                </p>
              </div>

              <button
                onClick={handleRunConsistency}
                disabled={verifying}
                className="px-3.5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                <Wrench className="w-3.5 h-3.5" />
                {verifying ? 'Verificando...' : 'Verificar'}
              </button>
            </div>

            {issues !== null && (
              <div className="space-y-2 pt-2">
                {issues.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/40 flex items-center gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Nenhuma inconsistência detectada. O banco de dados está íntegro!</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {issues.map(iss => (
                      <div
                        key={iss.id}
                        className="bg-[#0B1220] border border-slate-800 p-3 rounded-xl text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{iss.titulo}</span>
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                              iss.severidade === 'alta'
                                ? 'bg-red-950 text-red-400'
                                : 'bg-amber-950 text-amber-400'
                            }`}
                          >
                            {iss.severidade}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">{iss.descricao}</p>
                        <div className="text-[10px] text-slate-400">Impacto: {iss.impacto}</div>

                        {iss.podeCorrigirAutomatico && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => handleAutoFix(iss.id)}
                              className="px-2.5 py-1 rounded bg-[#22C7E8]/10 hover:bg-[#22C7E8]/20 text-[#22C7E8] font-semibold border border-[#22C7E8]/30 transition-colors"
                            >
                              Corrigir Automaticamente
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Caixa 2: Suite Automatizada dos 30 Testes Obrigatórios (Requisito 21) */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> 30 Testes Obrigatórios (Seção 21)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Executa em tempo real a bateria completa de 30 regras financeiras e operacionais.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={runningTests}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {runningTests ? 'Executando...' : 'Executar Testes'}
              </button>
            </div>

            {testResults && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#0B1220] border border-slate-800">
                  <span className="font-bold text-white">Status dos Testes:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-black text-sm">
                      {testResults.passed} Aprovados
                    </span>
                    {testResults.failed > 0 && (
                      <span className="text-red-400 font-black text-sm">
                        {testResults.failed} Falhas
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {testResults.results.map(r => (
                    <div
                      key={r.id}
                      className="bg-[#0B1220] p-2.5 rounded-xl border border-slate-800 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">#{r.id}</span>
                          <span>{r.titulo}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">{r.detalhes}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                          r.sucesso
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {r.sucesso ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar / Editar Opção da Tabela de Preços (Seção 2.3) */}
      {priceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#22C7E8]" />
                {editingPriceItem ? 'Editar Opção de Preço' : 'Nova Opção de Preço'}
              </h3>
              <button
                type="button"
                onClick={() => setPriceModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePriceItem} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Duração da Partida *
                </label>
                <select
                  value={duracaoMinutosInput}
                  onChange={e => setDuracaoMinutosInput(Number(e.target.value))}
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value={60}>60 minutos (1 hora)</option>
                  <option value={90}>90 minutos (1 hora e meia)</option>
                  <option value={120}>120 minutos (2 horas)</option>
                  <option value={45}>45 minutos</option>
                  <option value={150}>150 minutos (2 horas e meia)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold uppercase mb-1">
                  Valor da Partida (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={precoCentavosInput}
                  onChange={e => setPrecoCentavosInput(e.target.value)}
                  onBlur={() => {
                    const c = parseCurrencyToCents(precoCentavosInput);
                    if (c > 0) setPrecoCentavosInput(formatCurrencyRaw(c));
                  }}
                  placeholder="Ex: 40,00"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white font-bold text-sm outline-none"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={precoAtivoInput}
                    onChange={e => setPrecoAtivoInput(e.target.checked)}
                    className="w-4 h-4 rounded text-[#22C7E8] bg-[#0B1220] border-slate-700"
                  />
                  <span>Opção ativa para seleção no agendamento</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={precoPrincipalInput}
                    onChange={e => setPrecoPrincipalInput(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-400 bg-[#0B1220] border-slate-700"
                  />
                  <span>Marcar como preço principal de referência</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPriceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold cursor-pointer"
                >
                  Salvar Preço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
