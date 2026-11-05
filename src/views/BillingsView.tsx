import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Copy,
  MessageCircle,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
  Check,
  Filter,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Cobranca, MetodoPagamento, Partida } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency, parseCurrencyToCents } from '../utils/currency';
import { formatDatePtBr, getTodayDateString } from '../utils/date';
import { useToast } from '../context/ToastContext';

type CobrancaFilter = 'todas' | 'pendentes' | 'parcialmente_pagas' | 'pagas' | 'vencidas';

export const BillingsView: React.FC = () => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();

  const cobrancas = StorageService.getCobrancas();
  const contratantes = StorageService.getContratantes(false);
  const partidas = StorageService.getPartidas(false);
  const config = StorageService.getConfig();

  const [filterTab, setFilterTab] = useState<CobrancaFilter>('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCobranca, setEditingCobranca] = useState<Cobranca | null>(null);

  // Form State
  const [contratanteId, setContratanteId] = useState(contratantes[0]?.id || '');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mensagemContratante, setMensagemContratante] = useState('');
  const [dataEmissao, setDataEmissao] = useState(getTodayDateString());
  const [dataVencimento, setDataVencimento] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix');
  const [selectedPartidasIds, setSelectedPartidasIds] = useState<string[]>([]);
  const [ajustesInput, setAjustesInput] = useState('0.00');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Contratante selecionado no modal para listar partidas elegíveis
  const partidasDoContratante = useMemo(() => {
    if (!contratanteId) return [];
    return partidas.filter(
      p => p.contratanteId === contratanteId && p.statusOperacional !== 'cancelada'
    );
  }, [partidas, contratanteId]);

  // Lista filtrada de cobranças
  const filteredCobrancas = useMemo(() => {
    return cobrancas.filter(cob => {
      const isVencida = Boolean(cob.dataVencimento && cob.dataVencimento < todayStr && cob.status !== 'paga');
      
      if (filterTab === 'vencidas') return isVencida;
      if (filterTab === 'pagas') return cob.status === 'paga';
      if (filterTab === 'pendentes') return (cob.status === 'enviada' || cob.status === 'aberta') && !isVencida;
      
      if (filterTab === 'parcialmente_pagas') {
        // Verifica se as partidas vinculadas possuem pagamento parcial
        const partidasVinculadas = partidas.filter(p => cob.partidasIds.includes(p.id));
        const temParcial = partidasVinculadas.some(p => {
          const bal = BillingService.getPartidaBalance(p.id);
          return bal.statusCalculado === 'parcialmente_pago';
        });
        return temParcial;
      }

      return true;
    });
  }, [cobrancas, filterTab, todayStr, partidas]);

  const handleOpenCreate = () => {
    if (contratantes.length === 0) {
      showToast('Cadastre ao menos um contratante antes de emitir cobranças.', 'warning');
      return;
    }
    setEditingCobranca(null);
    const firstC = contratantes[0]?.id || '';
    setContratanteId(firstC);
    setTitulo('Fechamento de Partidas');
    setDescricao('Cobrança de partidas realizadas');
    setMensagemContratante('Fala parceiro, segue o demonstrativo das partidas disputadas para acerto. Chave Pix abaixo.');
    setDataEmissao(getTodayDateString());
    setDataVencimento('');
    setMetodoPagamento('pix');
    setSelectedPartidasIds([]);
    setAjustesInput('0.00');
    setMotivoAjuste('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cob: Cobranca) => {
    setEditingCobranca(cob);
    setContratanteId(cob.contratanteId);
    setTitulo(cob.titulo);
    setDescricao(cob.descricao);
    setMensagemContratante(cob.mensagemContratante);
    setDataEmissao(cob.dataEmissao);
    setDataVencimento(cob.dataVencimento || '');
    setMetodoPagamento(cob.metodoPagamento);
    setSelectedPartidasIds(cob.partidasIds || []);
    setAjustesInput(((cob.ajustesCentavos || 0) / 100).toFixed(2));
    setMotivoAjuste(cob.motivoAjuste || '');
    setModalOpen(true);
  };

  const handleTogglePartidaSelect = (pId: string) => {
    setSelectedPartidasIds(prev =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratanteId) {
      showToast('Selecione um contratante', 'error');
      return;
    }

    const ajustesCentavos = parseCurrencyToCents(ajustesInput);
    const numeroCobranca =
      editingCobranca?.numeroCobranca || `COB-${String(cobrancas.length + 1).padStart(4, '0')}`;

    const novaCobranca: Cobranca = {
      id: editingCobranca?.id || `cob-${Date.now()}`,
      numeroCobranca,
      contratanteId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      mensagemContratante: mensagemContratante.trim(),
      dataEmissao,
      dataVencimento: dataVencimento || undefined,
      metodoPagamento,
      partidasIds: selectedPartidasIds,
      ajustesCentavos,
      motivoAjuste: motivoAjuste.trim() || undefined,
      status: editingCobranca?.status || 'enviada',
      createdAt: editingCobranca?.createdAt || new Date().toISOString()
    };

    StorageService.saveCobranca(novaCobranca);
    showToast(
      editingCobranca ? 'Cobrança documental atualizada!' : 'Cobrança criada com sucesso!',
      'success'
    );
    setModalOpen(false);
  };

  const handleCopyMessage = (cob: Cobranca) => {
    const contratante = contratantes.find(c => c.id === cob.contratanteId);
    const partidasVinculadas = partidas.filter(p => cob.partidasIds.includes(p.id));
    const totalPartidas = partidasVinculadas.reduce((a, b) => a + b.valorFinalCentavos, 0);
    const totalFinal = totalPartidas + cob.ajustesCentavos;

    const textoFormatado = `⚽ *GOLEIRO PRO - COBRANÇA #${cob.numeroCobranca}*\n\nOlá ${
      contratante?.nome
    }!\n${cob.mensagemContratante}\n\n*Resumo das Partidas:*\n${partidasVinculadas
      .map(p => `• ${formatDatePtBr(p.data)} (${p.horaInicio}) - ${formatCurrency(p.valorFinalCentavos)}`)
      .join('\n')}\n\n*Total a pagar:* ${formatCurrency(totalFinal)}${
      cob.dataVencimento ? `\n*Vencimento:* ${formatDatePtBr(cob.dataVencimento)}` : ''
    }\n*Chave Pix (${config.chavePixTipo}):* ${
      config.chavePix
    }\n\nApós o pagamento, envie o comprovante por aqui. Obrigado!`;

    navigator.clipboard.writeText(textoFormatado);
    setCopiedId(cob.id);
    showToast('Mensagem de cobrança copiada para a área de transferência!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenWhatsApp = (cob: Cobranca) => {
    const contratante = contratantes.find(c => c.id === cob.contratanteId);
    if (!contratante?.whatsapp) {
      showToast('Contratante não possui número de WhatsApp cadastrado', 'warning');
      return;
    }
    const partidasVinculadas = partidas.filter(p => cob.partidasIds.includes(p.id));
    const totalPartidas = partidasVinculadas.reduce((a, b) => a + b.valorFinalCentavos, 0);
    const totalFinal = totalPartidas + cob.ajustesCentavos;

    const textoFormatado = `⚽ *GOLEIRO PRO - COBRANÇA #${cob.numeroCobranca}*\n\nOlá ${
      contratante?.nome
    }!\n${cob.mensagemContratante}\n\n*Resumo das Partidas:*\n${partidasVinculadas
      .map(p => `• ${formatDatePtBr(p.data)} (${p.horaInicio}) - ${formatCurrency(p.valorFinalCentavos)}`)
      .join('\n')}\n\n*Total a pagar:* ${formatCurrency(totalFinal)}${
      cob.dataVencimento ? `\n*Vencimento:* ${formatDatePtBr(cob.dataVencimento)}` : ''
    }\n*Chave Pix (${config.chavePixTipo}):* ${
      config.chavePix
    }\n\nApós o pagamento, envie o comprovante por aqui. Obrigado!`;

    const phone = contratante.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(textoFormatado)}`, '_blank');
  };

  const handleMarkAsPaid = (cob: Cobranca) => {
    cob.status = 'paga';
    StorageService.saveCobranca(cob);
    showToast(`Cobrança ${cob.numeroCobranca} marcada como paga!`, 'success');
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Comunicação & Inadimplência
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Gestão de Cobranças</h2>
          <p className="text-xs text-slate-400 mt-1">
            Faturamento, avisos de vencimento e mensagens profissionais pré-formatadas para WhatsApp.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Cobrança
        </button>
      </div>

      {/* Abas de Filtros de Cobrança (Section 7) */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-2.5 flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          onClick={() => setFilterTab('todas')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterTab === 'todas' ? 'bg-[#22C7E8] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Todas ({cobrancas.length})
        </button>
        <button
          onClick={() => setFilterTab('pendentes')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterTab === 'pendentes' ? 'bg-[#22C7E8] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setFilterTab('parcialmente_pagas')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterTab === 'parcialmente_pagas'
              ? 'bg-[#22C7E8] text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Parcialmente Pagas
        </button>
        <button
          onClick={() => setFilterTab('pagas')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterTab === 'pagas' ? 'bg-[#22C7E8] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Pagas
        </button>
        <button
          onClick={() => setFilterTab('vencidas')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterTab === 'vencidas'
              ? 'bg-rose-500 text-white shadow-md'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          Vencidas
        </button>
      </div>

      {/* Lista de Cobranças */}
      <div className="space-y-3">
        {filteredCobrancas.length === 0 ? (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
            Nenhuma cobrança encontrada com o filtro selecionado.
          </div>
        ) : (
          filteredCobrancas.map(cob => {
            const contratante = contratantes.find(c => c.id === cob.contratanteId);
            const partidasVinculadas = partidas.filter(p => cob.partidasIds.includes(p.id));
            const subtotal = partidasVinculadas.reduce((a, b) => a + b.valorFinalCentavos, 0);
            const total = subtotal + cob.ajustesCentavos;
            const isCopied = copiedId === cob.id;
            const isVencida = Boolean(cob.dataVencimento && cob.dataVencimento < todayStr && cob.status !== 'paga');

            return (
              <div
                key={cob.id}
                className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-[#22C7E8] font-bold">
                        {cob.numeroCobranca}
                      </span>
                      <h4 className="font-bold text-white text-base">{cob.titulo}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize font-semibold ${
                          cob.status === 'paga'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isVencida
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isVencida ? 'Vencida' : cob.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Contratante: <strong className="text-slate-200">{contratante?.nome}</strong></span>
                      <span>•</span>
                      <span>Emissão: <strong className="text-slate-200">{formatDatePtBr(cob.dataEmissao)}</strong></span>
                      {cob.dataVencimento && (
                        <>
                          <span>•</span>
                          <span className={isVencida ? 'text-rose-400 font-bold' : ''}>
                            Vencimento: {formatDatePtBr(cob.dataVencimento)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Valor Total</span>
                    <span className="text-xl font-black text-white">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Mensagem e Ajustes */}
                <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="italic text-slate-300">"{cob.mensagemContratante}"</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex-wrap gap-2">
                    <span>Partidas Vinculadas: {cob.partidasIds.length} jogo(s)</span>
                    {cob.ajustesCentavos !== 0 && (
                      <span className="text-amber-300">
                        Ajuste: {formatCurrency(cob.ajustesCentavos)} ({cob.motivoAjuste || 'Sem motivo'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações da Cobrança */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(cob)}
                      className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    {cob.status !== 'paga' && (
                      <button
                        onClick={() => handleMarkAsPaid(cob)}
                        className="p-1.5 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 transition-colors cursor-pointer flex items-center gap-1.5 font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" /> Marcar como Paga
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyMessage(cob)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'Copiado!' : 'Copiar Texto'}
                    </button>
                    <button
                      onClick={() => handleOpenWhatsApp(cob)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enviar no WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Criar / Editar Cobrança */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
              <h3 className="text-base font-bold text-white">
                {editingCobranca ? 'Editar Cobrança' : 'Nova Cobrança Documental'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-sm overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Contratante *
                </label>
                <select
                  required
                  value={contratanteId}
                  onChange={e => setContratanteId(e.target.value)}
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                >
                  {contratantes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipoRelacao})
                    </option>
                  ))}
                </select>
              </div>

              {/* Partidas Elegíveis do Contratante */}
              {partidasDoContratante.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Vincular Partidas ({selectedPartidasIds.length} selecionadas)
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-[#0B1220] p-2 space-y-1.5">
                    {partidasDoContratante.map(p => {
                      const isSelected = selectedPartidasIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePartidaSelect(p.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#22C7E8]/10 text-white border border-[#22C7E8]/40'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-[#22C7E8] pointer-events-none"
                            />
                            <span>
                              {formatDatePtBr(p.data)} ({p.horaInicio}) - {p.local || 'Local'}
                            </span>
                          </div>
                          <span className="font-bold text-[#22C7E8]">
                            {formatCurrency(p.valorFinalCentavos)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Título da Cobrança *
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Acerto de Jogos de Outubro"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Data de Emissão *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataEmissao}
                    onChange={e => setDataEmissao(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Vencimento (opcional)
                  </label>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={e => setDataVencimento(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Mensagem Personalizada ao Contratante
                </label>
                <textarea
                  rows={3}
                  value={mensagemContratante}
                  onChange={e => setMensagemContratante(e.target.value)}
                  placeholder="Ex: Segue o fechamento das partidas disputadas este mês..."
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none resize-none text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Ajuste Documental (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={ajustesInput}
                    onChange={e => setAjustesInput(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Motivo do Ajuste
                  </label>
                  <input
                    type="text"
                    value={motivoAjuste}
                    onChange={e => setMotivoAjuste(e.target.value)}
                    placeholder="Ex: Taxa de deslocamento extra"
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Salvar Cobrança
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
