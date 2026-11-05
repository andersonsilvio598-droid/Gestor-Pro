import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  Shield,
  ArrowRight,
  ExternalLink,
  Archive,
  ArchiveRestore,
  X,
  CreditCard,
  Gift,
  CheckCircle2,
  Clock,
  MapPin,
  Edit2,
  Star,
  Tag
} from 'lucide-react';
import { Contratante, TipoRelacao, MetodoPagamento, Partida, Recibo, Local } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency, parseCurrencyToCents } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface ContractorsViewProps {
  onOpenContractorPortal: (contratante: Contratante) => void;
  onPayContractor: (contratanteId: string) => void;
  onViewReceipt: (recibo: Recibo) => void;
  initialSelectedId?: string;
}

export const ContractorsView: React.FC<ContractorsViewProps> = ({
  onOpenContractorPortal,
  onPayContractor,
  onViewReceipt,
  initialSelectedId
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'contratantes' | 'locais'>('contratantes');

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(
    initialSelectedId || null
  );

  // Modal Contratante State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contratante | null>(null);

  // Form Contratante State
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipoRelacao, setTipoRelacao] = useState<TipoRelacao>('avulso');
  const [formaPagamentoPadrao, setFormaPagamentoPadrao] = useState<MetodoPagamento>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [preferenciaPrecoInput, setPreferenciaPrecoInput] = useState('');
  const [preferenciaDuracao, setPreferenciaDuracao] = useState<number>(60);

  // Modal Local State
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [editingLocal, setEditingLocal] = useState<Local | null>(null);
  const [localNome, setLocalNome] = useState('');
  const [localEndereco, setLocalEndereco] = useState('');
  const [localObservacoes, setLocalObservacoes] = useState('');
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  const contratantes = StorageService.getContratantes(showArchived);
  const partidas = StorageService.getPartidas(true);
  const pagamentos = StorageService.getPagamentos();
  const ciclos = StorageService.getCiclos();
  const pacotes = StorageService.getPacotes();
  const creditos = StorageService.getCreditos();
  const cobrancas = StorageService.getCobrancas();
  const recibos = StorageService.getRecibos();

  const filteredContratantes = useMemo(() => {
    return contratantes.filter(c => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.nome.toLowerCase().includes(term) ||
        c.whatsapp.includes(term) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(term))
      );
    });
  }, [contratantes, searchTerm]);

  const selectedContractor = useMemo(() => {
    return contratantes.find(c => c.id === selectedContractorId) || null;
  }, [contratantes, selectedContractorId]);

  const contractorSummary = useMemo(() => {
    if (!selectedContractor) return null;
    return BillingService.getContratanteFinancialSummary(selectedContractor.id);
  }, [selectedContractor]);

  const handleOpenCreate = () => {
    setEditingContractor(null);
    setNome('');
    setWhatsapp('');
    setTipoRelacao('avulso');
    setFormaPagamentoPadrao('pix');
    setObservacoes('');
    setPreferenciaPrecoInput('');
    setPreferenciaDuracao(60);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Contratante) => {
    setEditingContractor(c);
    setNome(c.nome);
    setWhatsapp(c.whatsapp);
    setTipoRelacao(c.tipoRelacao);
    setFormaPagamentoPadrao(c.formaPagamentoPadrao);
    setObservacoes(c.observacoes);
    setPreferenciaPrecoInput(
      c.preferenciaPrecoCentavos ? (c.preferenciaPrecoCentavos / 100).toFixed(2).replace('.', ',') : ''
    );
    setPreferenciaDuracao(c.preferenciaDuracaoMinutos || 60);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      showToast('O nome do contratante é obrigatório', 'error');
      return;
    }

    const token =
      editingContractor?.tokenAcessoPublico ||
      `token-${nome.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.random().toString(36).substr(2, 6)}`;

    const prefCentavos = preferenciaPrecoInput.trim() ? parseCurrencyToCents(preferenciaPrecoInput) : undefined;

    const saved: Contratante = {
      id: editingContractor?.id || `c-${Date.now()}`,
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      tipoRelacao,
      formaPagamentoPadrao,
      observacoes: observacoes.trim(),
      createdAt: editingContractor?.createdAt || new Date().toISOString(),
      arquivado: editingContractor?.arquivado || false,
      tokenAcessoPublico: token,
      preferenciaPrecoCentavos: prefCentavos && prefCentavos > 0 ? prefCentavos : undefined,
      preferenciaDuracaoMinutos: prefCentavos && prefCentavos > 0 ? preferenciaDuracao : undefined
    };

    StorageService.saveContratante(saved);
    showToast(
      editingContractor ? 'Contratante atualizado com sucesso!' : 'Contratante cadastrado com sucesso!',
      'success'
    );
    setSelectedContractorId(saved.id);
    setModalOpen(false);
  };

  const handleToggleArchive = (c: Contratante) => {
    const updated: Contratante = { ...c, arquivado: !c.arquivado };
    StorageService.saveContratante(updated);
    showToast(
      updated.arquivado
        ? 'Contratante arquivado. Histórico financeiro preservado!'
        : 'Contratante desarquivado!',
      'info'
    );
  };

  const locais = StorageService.getLocais(true);
  const filteredLocais = useMemo(() => {
    return locais.filter(l => {
      if (!localSearchTerm) return true;
      const term = localSearchTerm.toLowerCase();
      return (
        l.nome.toLowerCase().includes(term) ||
        (l.endereco && l.endereco.toLowerCase().includes(term)) ||
        (l.observacoes && l.observacoes.toLowerCase().includes(term))
      );
    });
  }, [locais, localSearchTerm]);

  const handleOpenCreateLocal = () => {
    setEditingLocal(null);
    setLocalNome('');
    setLocalEndereco('');
    setLocalObservacoes('');
    setLocalModalOpen(true);
  };

  const handleOpenEditLocal = (l: Local) => {
    setEditingLocal(l);
    setLocalNome(l.nome);
    setLocalEndereco(l.endereco || '');
    setLocalObservacoes(l.observacoes || '');
    setLocalModalOpen(true);
  };

  const handleSaveLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localNome.trim()) {
      showToast('O nome do local é obrigatório', 'error');
      return;
    }
    const saved: Local = {
      id: editingLocal?.id || `loc-${Date.now()}`,
      nome: localNome.trim(),
      endereco: localEndereco.trim(),
      observacoes: localObservacoes.trim(),
      ativo: editingLocal ? editingLocal.ativo : true,
      createdAt: editingLocal?.createdAt || new Date().toISOString()
    };
    StorageService.saveLocal(saved);
    showToast(editingLocal ? 'Local atualizado com sucesso!' : 'Local cadastrado com sucesso!', 'success');
    setLocalModalOpen(false);
  };

  const handleToggleLocalAtivo = (l: Local) => {
    const updated: Local = { ...l, ativo: !l.ativo };
    StorageService.saveLocal(updated);
    showToast(updated.ativo ? `Local "${l.nome}" reativado!` : `Local "${l.nome}" inativado!`, 'info');
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Cadastros & Relações
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">
            {activeTab === 'contratantes' ? 'Contratantes Autorizados' : 'Locais de Jogo'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'contratantes'
              ? 'Gestão dos contratantes autorizados, histórico de partidas, ciclos e saldos.'
              : 'Gerenciamento dos locais de jogo autorizados (Corinthians, Legionários, Ginásio São Lourenço, FAC, Seta).'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'contratantes' ? (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Contratante
            </button>
          ) : (
            <button
              onClick={handleOpenCreateLocal}
              className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Local
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('contratantes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'contratantes'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Contratantes ({contratantes.length})
        </button>
        <button
          onClick={() => setActiveTab('locais')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'locais'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Locais de Jogo ({locais.length})
        </button>
      </div>

      {/* Grid Principal de Contratantes */}
      {activeTab === 'contratantes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna 1: Lista de Contratantes (5 colunas) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou WhatsApp..."
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{filteredContratantes.length} contratante(s)</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={e => setShowArchived(e.target.checked)}
                  className="rounded text-[#22C7E8] bg-[#0B1220] border-slate-700"
                />
                Exibir arquivados
              </label>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredContratantes.length === 0 ? (
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                Nenhum contratante encontrado.
              </div>
            ) : (
              filteredContratantes.map(c => {
                const s = BillingService.getContratanteFinancialSummary(c.id);
                const isSelected = c.id === selectedContractorId;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedContractorId(c.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#162744] border-[#22C7E8]/60 shadow-md'
                        : 'bg-[#111A2E] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{c.nome}</h4>
                          {c.arquivado && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              ARQUIVADO
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{c.tipoRelacao}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.whatsapp || 'Sem Whats'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Saldo Devedor</span>
                        <span
                          className={`text-xs font-bold ${
                            s.saldoDevedorCentavos > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {formatCurrency(s.saldoDevedorCentavos)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna 2: Detalhe do Contratante Selecionado (7 colunas) */}
        <div className="lg:col-span-7">
          {!selectedContractor ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              Selecione um contratante para visualizar seu extrato completo, ciclos, recibos e partidas.
            </div>
          ) : (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 space-y-6">
              {/* Header do Contratante Selecionado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">{selectedContractor.nome}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
                      {selectedContractor.tipoRelacao}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                    <span>WhatsApp: <strong className="text-slate-200">{selectedContractor.whatsapp || 'Não cadastrado'}</strong></span>
                    <span>•</span>
                    <span>Método: <strong className="uppercase text-slate-200">{selectedContractor.formaPagamentoPadrao}</strong></span>
                    {selectedContractor.preferenciaPrecoCentavos && (
                      <>
                        <span>•</span>
                        <span className="text-[#22C7E8] font-bold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current text-[#22C7E8]" />
                          Preço Preferencial: {formatCurrency(selectedContractor.preferenciaPrecoCentavos)} ({selectedContractor.preferenciaDuracaoMinutos || 60}m)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedContractor)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Editar Contratante"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleArchive(selectedContractor)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title={selectedContractor.arquivado ? 'Desarquivar' : 'Arquivar'}
                  >
                    {selectedContractor.arquivado ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onOpenContractorPortal(selectedContractor)}
                    className="px-3 py-2 rounded-xl bg-[#22C7E8]/10 hover:bg-[#22C7E8]/20 text-[#22C7E8] font-bold text-xs border border-[#22C7E8]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir Extrato Pix
                  </button>
                </div>
              </div>

              {/* Balanço Financeiro do Contratante */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B1220] p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Devedor</span>
                  <div
                    className={`text-lg font-black ${
                      (contractorSummary?.saldoDevedorCentavos || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(contractorSummary?.saldoDevedorCentavos || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Pago</span>
                  <div className="text-lg font-black text-white">
                    {formatCurrency(contractorSummary?.totalRecebidoCentavos || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Faturado</span>
                  <div className="text-lg font-black text-white">
                    {formatCurrency(contractorSummary?.totalGeradoCentavos || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Créditos Disponíveis</span>
                  <div className="text-lg font-black text-[#22C7E8]">
                    {formatCurrency(contractorSummary?.creditoDisponivelCentavos || 0)}
                  </div>
                </div>
              </div>

              {/* Botão de Quitação Rápida */}
              {(contractorSummary?.saldoDevedorCentavos || 0) > 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-xs">
                  <div className="text-emerald-200">
                    Este contratante possui <strong>{formatCurrency(contractorSummary!.saldoDevedorCentavos)}</strong> em aberto.
                  </div>
                  <button
                    onClick={() => onPayContractor(selectedContractor.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Registrar Pagamento
                  </button>
                </div>
              )}

              {/* Seção de Ciclos de Cobrança deste Contratante */}
              {selectedContractor.tipoRelacao === 'fixo' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#22C7E8]" /> Ciclos de Cobrança
                  </h4>
                  {ciclos.filter(c => c.contratanteId === selectedContractor.id).length === 0 ? (
                    <div className="text-xs text-slate-500 bg-[#0B1220] p-3 rounded-xl border border-slate-800">
                      Nenhum ciclo ativo no momento.
                    </div>
                  ) : (
                    ciclos
                      .filter(c => c.contratanteId === selectedContractor.id)
                      .map(c => {
                        const sum = BillingService.getCicloSummary(c.id);
                        if (!sum) return null;

                        return (
                          <div
                            key={c.id}
                            className="bg-[#0B1220] p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>Ciclo de {c.quantidadeReferencia} Jogos</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                  Progresso: {sum.progressoContagem}/{sum.quantidadeReferencia}
                                </span>
                              </div>
                              <div className="text-slate-400 mt-0.5">
                                Gerado: {formatCurrency(sum.valorTotalCentavos)} • Pago:{' '}
                                {formatCurrency(sum.valorPagoCentavos)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`font-bold px-2 py-0.5 rounded ${
                                  sum.saldoCentavos === 0 ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                Saldo: {formatCurrency(sum.saldoCentavos)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {/* Seção de Recibos Emitidos */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> Recibos Emitidos (
                  {recibos.filter(r => r.contratanteId === selectedContractor.id).length})
                </h4>
                {recibos.filter(r => r.contratanteId === selectedContractor.id).length === 0 ? (
                  <div className="text-xs text-slate-500 bg-[#0B1220] p-3 rounded-xl border border-slate-800">
                    Nenhum recibo emitido ainda.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {recibos
                      .filter(r => r.contratanteId === selectedContractor.id)
                      .map(rec => (
                        <div
                          key={rec.id}
                          onClick={() => onViewReceipt(rec)}
                          className="bg-[#0B1220] hover:bg-[#16223B] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-white mr-2">{rec.numeroRecibo}</span>
                            <span className="text-slate-400">{formatDatePtBr(rec.dataRecebimento)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#22C7E8]">
                              {formatCurrency(rec.valorTotalCentavos)}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              {selectedContractor.observacoes && (
                <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="font-bold text-slate-400 block mb-0.5">Observações:</span>
                  {selectedContractor.observacoes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Grid de Locais de Jogo Autorizados */}
      {activeTab === 'locais' && (
        <div className="space-y-4">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={localSearchTerm}
                onChange={e => setLocalSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou endereço do local..."
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none"
              />
            </div>
            <div className="text-xs text-slate-400">
              {filteredLocais.length} local(is) cadastrado(s)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocais.map(loc => (
              <div
                key={loc.id}
                className={`bg-[#111A2E] border rounded-2xl p-5 shadow-sm space-y-3 transition-colors ${
                  loc.ativo !== false ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#22C7E8]/10 border border-[#22C7E8]/30 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#22C7E8]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base leading-tight">{loc.nome}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                        loc.ativo !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {loc.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditLocal(loc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    title="Editar local"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {loc.endereco && (
                  <p className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-slate-500 shrink-0 mt-0.5">Endereço:</span>
                    <span>{loc.endereco}</span>
                  </p>
                )}

                {loc.observacoes && (
                  <p className="text-xs text-slate-400 italic bg-[#0B1220] p-2.5 rounded-xl border border-slate-800/80">
                    "{loc.observacoes}"
                  </p>
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">
                    Cadastrado em {formatDatePtBr(loc.createdAt)}
                  </span>
                  <button
                    onClick={() => handleToggleLocalAtivo(loc)}
                    className={`font-semibold text-xs cursor-pointer ${
                      loc.ativo !== false ? 'text-slate-400 hover:text-red-400' : 'text-[#22C7E8] hover:underline'
                    }`}
                  >
                    {loc.ativo !== false ? 'Inativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Contratante */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
              <h3 className="text-base font-bold text-white">
                {editingContractor ? 'Editar Contratante' : 'Novo Contratante'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Contratante *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Pelada dos Amigos (Carlos)"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  WhatsApp (apenas números com DDD)
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="Ex: 11987654321"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tipo de Relação
                  </label>
                  <select
                    value={tipoRelacao}
                    onChange={e => setTipoRelacao(e.target.value as TipoRelacao)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none capitalize"
                  >
                    <option value="avulso">Avulso</option>
                    <option value="fixo">Fixo / Mensal</option>
                    <option value="pacote">Pacote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Pagamento Preferencial
                  </label>
                  <select
                    value={formaPagamentoPadrao}
                    onChange={e => setFormaPagamentoPadrao(e.target.value as MetodoPagamento)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none uppercase"
                  >
                    <option value="pix">Pix</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                    <option value="cartao">Cartão</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Preço Preferencial do Contratante (Seção 2.4) */}
              <div className="bg-[#0B1220] p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Star className="w-3.5 h-3.5 text-[#22C7E8]" />
                  <span>Preço Preferencial (Opcional - Seção 2.4)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Preço padrão acordado para este contratante. Será destacado e sugerido automaticamente ao registrar partidas.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Duração
                    </label>
                    <select
                      value={preferenciaDuracao}
                      onChange={e => setPreferenciaDuracao(Number(e.target.value))}
                      className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-1.5 text-white outline-none text-xs"
                    >
                      <option value={60}>60 minutos (1h)</option>
                      <option value={90}>90 minutos (1h30)</option>
                      <option value={120}>120 minutos (2h)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Preço Acordado (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={preferenciaPrecoInput}
                      onChange={e => setPreferenciaPrecoInput(e.target.value)}
                      placeholder="Ex: 40,00 ou 35,00"
                      className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-1.5 text-white outline-none text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: Jogam na quadra 2 da Playball, preferem Pix..."
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none resize-none text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Local de Jogo */}
      {localModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#22C7E8]" />
                <h3 className="text-base font-bold text-white">
                  {editingLocal ? 'Editar Local de Jogo' : 'Novo Local de Jogo'}
                </h3>
              </div>
              <button
                onClick={() => setLocalModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Local *
                </label>
                <input
                  type="text"
                  required
                  value={localNome}
                  onChange={e => setLocalNome(e.target.value)}
                  placeholder="Ex: Corinthians, Legionários, Ginásio São Lourenço, FAC, Seta..."
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Endereço / Referência
                </label>
                <input
                  type="text"
                  value={localEndereco}
                  onChange={e => setLocalEndereco(e.target.value)}
                  placeholder="Ex: Rua Esportiva, 100 - Bairro Central"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Observações (Tipo de grama/piso, vestiário, iluminação...)
                </label>
                <textarea
                  rows={2}
                  value={localObservacoes}
                  onChange={e => setLocalObservacoes(e.target.value)}
                  placeholder="Ex: Grama sintética alta, levar luva com proteção..."
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLocalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Salvar Local
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
