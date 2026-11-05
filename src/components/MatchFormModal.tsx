import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, MapPin, DollarSign, AlertTriangle, Check, Shield, Tag, Star } from 'lucide-react';
import { Partida, StatusOperacional, StatusFinanceiro, TipoPartida, ModalidadePartida, ItemTabelaPreco } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { calculateDurationMinutes, getTodayDateString, addMinutesToTime } from '../utils/date';
import { formatCurrency, parseCurrencyToCents } from '../utils/currency';
import { useToast } from '../context/ToastContext';

interface MatchFormModalProps {
  partidaToEdit?: Partida | null;
  initialDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const MatchFormModal: React.FC<MatchFormModalProps> = ({
  partidaToEdit,
  initialDate,
  onClose,
  onSuccess
}) => {
  const { showToast } = useToast();
  const config = StorageService.getConfig();
  const contratantes = StorageService.getContratantes(false);
  const locais = StorageService.getLocais(false);

  const [contratanteId, setContratanteId] = useState(partidaToEdit?.contratanteId || (contratantes[0]?.id || ''));
  const [quickName, setQuickName] = useState('');
  const [data, setData] = useState(partidaToEdit?.data || initialDate || getTodayDateString());
  const [horaInicio, setHoraInicio] = useState(partidaToEdit?.horaInicio || '19:00');
  const [horaFim, setHoraFim] = useState(partidaToEdit?.horaFim || '20:00');
  
  // Locais
  const [localId, setLocalId] = useState(partidaToEdit?.localId || (locais[0]?.id || ''));
  const [local, setLocal] = useState(partidaToEdit?.local || (locais[0]?.nome || 'Corinthians'));
  const [isCustomLocal, setIsCustomLocal] = useState(!locais.some(l => l.nome === partidaToEdit?.local));
  const [newLocalNome, setNewLocalNome] = useState('');
  
  const [tipoPartida, setTipoPartida] = useState<TipoPartida>(partidaToEdit?.tipoPartida || 'avulso');
  const [modalidade, setModalidade] = useState<ModalidadePartida>(partidaToEdit?.modalidade || 'society');
  const [valorReferenciaInput, setValorReferenciaInput] = useState(
    ((partidaToEdit?.valorReferenciaCentavos || config.valorPadraoHoraCentavos) / 100).toFixed(2).replace('.', ',')
  );
  const [descontoInput, setDescontoInput] = useState(
    ((partidaToEdit?.descontoCentavos || 0) / 100).toFixed(2).replace('.', ',')
  );
  const [ehCortesia, setEhCortesia] = useState(partidaToEdit?.ehCortesia || false);
  const [observacoes, setObservacoes] = useState(partidaToEdit?.observacoes || '');
  const [statusOperacional, setStatusOperacional] = useState<StatusOperacional>(
    partidaToEdit?.statusOperacional || 'confirmada'
  );
  const [canceladoMotivo, setCanceladoMotivo] = useState(partidaToEdit?.canceladoMotivo || '');
  const [motivoNaoRealizada, setMotivoNaoRealizada] = useState(partidaToEdit?.motivoNaoRealizada || '');
  
  // Perda Potencial
  const [perdaApurada, setPerdaApurada] = useState<boolean>(partidaToEdit?.perdaApurada ?? false);
  const [valorPerdaInput, setValorPerdaInput] = useState<string>(
    partidaToEdit?.valorPerdaPotencialCentavos !== undefined
      ? (partidaToEdit.valorPerdaPotencialCentavos / 100).toFixed(2).replace('.', ',')
      : ((partidaToEdit?.valorReferenciaCentavos || config.valorPadraoHoraCentavos) / 100).toFixed(2).replace('.', ',')
  );
  
  const [statusFinanceiro, setStatusFinanceiro] = useState<StatusFinanceiro>(
    partidaToEdit?.statusFinanceiro || 'em_aberto'
  );

  // Duração calculada em minutos
  const duracaoMinutos = calculateDurationMinutes(horaInicio, horaFim);

  // Valores financeiros calculados
  const valorReferenciaCentavos = parseCurrencyToCents(valorReferenciaInput);
  const descontoCentavos = ehCortesia ? valorReferenciaCentavos : parseCurrencyToCents(descontoInput);
  const valorFinalCentavos = ehCortesia ? 0 : Math.max(0, valorReferenciaCentavos - descontoCentavos);

  // Tabela de Preços e Preferências (Seção 2)
  const tabelaPrecos = useMemo(() => StorageService.getTabelaPrecos(true), []);
  const selectedContractor = useMemo(
    () => contratantes.find(c => c.id === contratanteId),
    [contratantes, contratanteId]
  );
  const contratantePreferenciaCentavos = selectedContractor?.preferenciaPrecoCentavos;
  const contratantePreferenciaDuracao = selectedContractor?.preferenciaDuracaoMinutos;

  // Opções compatíveis com a duração calculada (Ex: 60 min -> 30, 35, 40, 45)
  const precosCompativeis = useMemo(() => {
    return tabelaPrecos.filter(p => p.duracaoMinutos === duracaoMinutos);
  }, [tabelaPrecos, duracaoMinutos]);

  const [modoPrecoCustom, setModoPrecoCustom] = useState<boolean>(() => {
    if (partidaToEdit) {
      const matchInTable = tabelaPrecos.some(
        p => p.duracaoMinutos === partidaToEdit.duracaoMinutos && p.valorCentavos === partidaToEdit.valorReferenciaCentavos
      );
      return !matchInTable;
    }
    return false;
  });

  const [lastDuracao, setLastDuracao] = useState<number>(duracaoMinutos);

  // Validação ao alterar a duração (Seção 2.2):
  // Se o usuário altera a duração, revalida. Se a opção atual existir na nova duração (ex: 45,00 em 60m e 90m), mantém.
  // Caso contrário, seleciona o padrão da nova duração ou preserva explicitamente como customizado.
  useEffect(() => {
    if (duracaoMinutos !== lastDuracao) {
      setLastDuracao(duracaoMinutos);
      if (ehCortesia) return;

      const precosNovos = tabelaPrecos.filter(p => p.duracaoMinutos === duracaoMinutos);

      // Se estava em modo customizado ou editando partida original preserva
      if (modoPrecoCustom) {
        return;
      }

      // Se o valor de referência atual existe na nova duração, preserva!
      const existeNaNova = precosNovos.some(p => p.valorCentavos === valorReferenciaCentavos);
      if (existeNaNova) {
        return;
      }

      // Se o contratante tiver preferência configurada compatível com a nova duração
      if (
        contratantePreferenciaCentavos &&
        (!contratantePreferenciaDuracao || contratantePreferenciaDuracao === duracaoMinutos) &&
        precosNovos.some(p => p.valorCentavos === contratantePreferenciaCentavos)
      ) {
        setValorReferenciaInput((contratantePreferenciaCentavos / 100).toFixed(2).replace('.', ','));
        setModoPrecoCustom(false);
        return;
      }

      // Se tiver preço principal de referência para a nova duração (ex: 60m -> 40,00)
      const principal = precosNovos.find(p => p.principal);
      if (principal) {
        setValorReferenciaInput((principal.valorCentavos / 100).toFixed(2).replace('.', ','));
        setModoPrecoCustom(false);
        return;
      }

      // Seleciona a primeira opção disponível para a nova duração
      if (precosNovos.length > 0) {
        setValorReferenciaInput((precosNovos[0].valorCentavos / 100).toFixed(2).replace('.', ','));
        setModoPrecoCustom(false);
      } else {
        // Duração atípica sem opções na tabela
        setModoPrecoCustom(true);
      }
    }
  }, [duracaoMinutos, lastDuracao, tabelaPrecos, modoPrecoCustom, valorReferenciaCentavos, contratantePreferenciaCentavos, contratantePreferenciaDuracao, ehCortesia]);

  // Se for nova partida e o contratante selecionado possuir preferência de preço
  useEffect(() => {
    if (!partidaToEdit && selectedContractor?.preferenciaPrecoCentavos) {
      if (!selectedContractor.preferenciaDuracaoMinutos || selectedContractor.preferenciaDuracaoMinutos === duracaoMinutos) {
        setValorReferenciaInput((selectedContractor.preferenciaPrecoCentavos / 100).toFixed(2).replace('.', ','));
        setModoPrecoCustom(false);
      }
    }
  }, [contratanteId]);

  // Validação de conflito de horário em tempo real
  const conflict = BillingService.checkConflict(data, horaInicio, horaFim, partidaToEdit?.id);

  // Se for cortesia, atualiza campos dependentes
  useEffect(() => {
    if (ehCortesia) {
      setDescontoInput((valorReferenciaCentavos / 100).toFixed(2));
      setStatusFinanceiro('sem_cobranca');
    }
  }, [ehCortesia, valorReferenciaCentavos]);

  const handleQuickCreateContractor = () => {
    if (!quickName.trim()) {
      showToast('Digite o nome do contratante', 'error');
      return;
    }
    const newId = `c-${Date.now()}`;
    const newContractor = {
      id: newId,
      nome: quickName.trim(),
      whatsapp: '',
      observacoes: 'Cadastrado rapidamente',
      tipoRelacao: 'avulso' as const,
      formaPagamentoPadrao: 'pix' as const,
      createdAt: new Date().toISOString(),
      arquivado: false,
      tokenAcessoPublico: `token-${Math.random().toString(36).substr(2, 8)}`
    };
    StorageService.saveContratante(newContractor);
    setContratanteId(newId);
    setQuickName('');
    showToast(`Contratante "${newContractor.nome}" cadastrado com sucesso!`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!contratanteId) {
      showToast('Selecione ou cadastre um contratante', 'error');
      return;
    }

    if (conflict.hasConflict && statusOperacional !== 'cancelada' && statusOperacional !== 'arquivada') {
      const confirma = window.confirm(
        `Atenção: Existe um conflito de horário com outra partida ativa (${conflict.motivo}). Deseja prosseguir mesmo assim?`
      );
      if (!confirma) return;
    }

    const contratante = StorageService.getContratanteById(contratanteId);
    const ciclos = StorageService.getCiclosByContratante(contratanteId);
    const cicloAberto = ciclos.find(c => c.estado === 'aberto');

    const partidaId = partidaToEdit?.id || `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const isPerdida = statusOperacional === 'cancelada' || statusOperacional === 'nao_realizada';
    const valorPerdaCentavos = isPerdida && perdaApurada ? parseCurrencyToCents(valorPerdaInput) : undefined;

    const novaPartida: Partida = {
      id: partidaId,
      data,
      horaInicio,
      horaFim,
      duracaoMinutos,
      contratanteId,
      localId: localId || undefined,
      local: local.trim() || 'Local não informado',
      tipoPartida: ehCortesia ? 'cortesia' : tipoPartida,
      modalidade,
      valorReferenciaCentavos,
      descontoCentavos,
      valorFinalCentavos,
      valorPerdaPotencialCentavos: valorPerdaCentavos,
      perdaApurada: isPerdida ? perdaApurada : undefined,
      motivoNaoRealizada: statusOperacional === 'nao_realizada' ? motivoNaoRealizada : undefined,
      observacoes,
      statusOperacional,
      canceladoMotivo: statusOperacional === 'cancelada' ? canceladoMotivo : undefined,
      statusFinanceiro: ehCortesia ? 'sem_cobranca' : isPerdida ? 'sem_cobranca' : partidaToEdit?.statusFinanceiro || 'em_aberto',
      origemPartida: partidaToEdit?.origemPartida || 'manual',
      jogoFixoId: partidaToEdit?.jogoFixoId,
      cicloId: partidaToEdit?.cicloId || (contratante?.tipoRelacao === 'fixo' ? cicloAberto?.id : undefined),
      pacoteId: partidaToEdit?.pacoteId,
      ehCortesia,
      createdAt: partidaToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    StorageService.savePartida(novaPartida);
    showToast(
      partidaToEdit ? 'Partida atualizada com sucesso!' : 'Partida cadastrada com sucesso!',
      'success'
    );
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111A2E] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#22C7E8]" />
            <h3 className="text-base font-bold text-white">
              {partidaToEdit ? 'Editar Partida' : 'Nova Partida'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* Alerta de Conflito de Horário */}
          {conflict.hasConflict && statusOperacional !== 'cancelada' && statusOperacional !== 'arquivada' && (
            <div className="bg-amber-950/50 border border-amber-600/50 p-3.5 rounded-xl flex items-start gap-3 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300 block mb-0.5">Aviso de Sobreposição de Horário!</strong>
                {conflict.motivo}
              </div>
            </div>
          )}

          {/* Contratante */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Contratante / Time *
            </label>
            {contratantes.length === 0 ? (
              <div className="bg-[#0B1220] border border-amber-500/40 p-3 rounded-xl space-y-2">
                <p className="text-xs text-amber-300">
                  Nenhum contratante cadastrado. Digite o nome do contratante ou time para cadastrar e vincular agora:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickName}
                    onChange={e => setQuickName(e.target.value)}
                    placeholder="Ex: Pelada dos Amigos / Carlos"
                    className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateContractor}
                    className="px-3 py-1.5 rounded-lg bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Cadastrar
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={contratanteId}
                onChange={e => setContratanteId(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2.5 text-white outline-none transition-colors"
              >
                {contratantes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.tipoRelacao})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Data e Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Data *
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Início *
              </label>
              <input
                type="time"
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Fim *
              </label>
              <input
                type="time"
                value={horaFim}
                onChange={e => setHoraFim(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Ajuste rápido:</span>
              {[60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    const novoFim = addMinutesToTime(horaInicio, mins);
                    setHoraFim(novoFim);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    duracaoMinutos === mins
                      ? 'bg-[#22C7E8] text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
            <div>
              Duração: <strong className="text-white font-bold">{duracaoMinutos} min</strong>
            </div>
          </div>

          {/* Local e Categoria / Modalidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Local do Jogo *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomLocal(!isCustomLocal)}
                  className="text-[10px] text-[#22C7E8] hover:underline cursor-pointer"
                >
                  {isCustomLocal ? 'Escolher da lista' : '+ Outro local'}
                </button>
              </div>

              {isCustomLocal ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={local}
                      onChange={e => setLocal(e.target.value)}
                      placeholder="Nome do local (ex: FAC, Seta...)"
                      className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl pl-9 pr-3 py-2 text-white outline-none text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (local.trim()) {
                        const newId = `loc-${Date.now()}`;
                        StorageService.saveLocal({
                          id: newId,
                          nome: local.trim(),
                          ativo: true,
                          createdAt: new Date().toISOString()
                        });
                        setLocalId(newId);
                        setIsCustomLocal(false);
                        showToast(`Local "${local.trim()}" salvo com sucesso!`, 'success');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl border border-slate-700 cursor-pointer"
                    title="Salvar local na lista"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <select
                    value={local}
                    onChange={e => {
                      if (e.target.value === '__novo__') {
                        setIsCustomLocal(true);
                        setLocal('');
                      } else {
                        setLocal(e.target.value);
                        const found = locais.find(l => l.nome === e.target.value);
                        if (found) setLocalId(found.id);
                      }
                    }}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl pl-9 pr-3.5 py-2 text-white outline-none text-xs"
                  >
                    {locais.map(loc => (
                      <option key={loc.id} value={loc.nome}>
                        {loc.nome}
                      </option>
                    ))}
                    <option value="__novo__">+ Novo Local...</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Categoria / Modalidade
              </label>
              <select
                value={modalidade}
                onChange={e => setModalidade(e.target.value as ModalidadePartida)}
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none text-xs"
              >
                <option value="society">Futebol Society</option>
                <option value="campo">Futebol de Campo</option>
                <option value="futsal">Futsal</option>
                <option value="torneio">Torneio / Campeonato</option>
                <option value="amistoso">Amistoso</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Tipo e Cortesia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tipo de Relação
              </label>
              <select
                value={tipoPartida}
                onChange={e => setTipoPartida(e.target.value as TipoPartida)}
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none text-xs"
              >
                <option value="avulso">Avulso</option>
                <option value="fixo">Fixo / Recorrente</option>
                <option value="pacote">Pacote</option>
                <option value="cortesia">Cortesia (Grátis)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={ehCortesia}
                  onChange={e => setEhCortesia(e.target.checked)}
                  className="w-4 h-4 rounded text-[#22C7E8] bg-[#0B1220] border-slate-700 focus:ring-0"
                />
                Marcar como Cortesia (R$ 0,00)
              </label>
            </div>
          </div>

          {/* Valores Financeiros e Seleção de Preços Fixos (Seção 2) */}
          <div className="bg-[#0B1220] p-4 rounded-xl border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                Preço da Partida ({duracaoMinutos} min)
              </label>
              {selectedContractor?.preferenciaPrecoCentavos && (
                <span className="text-[10px] text-[#22C7E8] bg-[#22C7E8]/10 px-2 py-0.5 rounded-lg border border-[#22C7E8]/20 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current text-[#22C7E8]" />
                  Preferência: {formatCurrency(selectedContractor.preferenciaPrecoCentavos)}
                </span>
              )}
            </div>

            {/* Chips de Preços Pré-definidos compatíveis com a Duração */}
            {!ehCortesia && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {precosCompativeis.map(op => {
                    const isSelected = !modoPrecoCustom && valorReferenciaCentavos === op.valorCentavos;
                    const isContractorPref = selectedContractor?.preferenciaPrecoCentavos === op.valorCentavos;

                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setModoPrecoCustom(false);
                          setValorReferenciaInput((op.valorCentavos / 100).toFixed(2).replace('.', ','));
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#22C7E8]/15 border-[#22C7E8] text-white shadow-sm ring-1 ring-[#22C7E8]'
                            : 'bg-[#111A2E] border-slate-700/80 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-black text-white">
                          {formatCurrency(op.valorCentavos)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                          <span>{op.duracaoMinutos}m</span>
                          {op.principal && (
                            <span className="text-[9px] font-bold text-amber-400">Padrão</span>
                          )}
                        </div>
                        {isContractorPref && (
                          <div className="text-[9px] text-[#22C7E8] font-bold mt-1 truncate">
                            ★ Preferido
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Opção Personalizada */}
                  <button
                    type="button"
                    onClick={() => setModoPrecoCustom(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      modoPrecoCustom
                        ? 'bg-[#22C7E8]/15 border-[#22C7E8] text-white shadow-sm ring-1 ring-[#22C7E8]'
                        : 'bg-[#111A2E] border-slate-700/80 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">Personalizado</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Outro valor...</div>
                  </button>
                </div>
              </div>
            )}

            {/* Inputs de Valor e Desconto */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {modoPrecoCustom ? 'Valor Personalizado (R$) *' : 'Valor de Ref. (R$)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={ehCortesia}
                  value={valorReferenciaInput}
                  onChange={e => {
                    setValorReferenciaInput(e.target.value);
                    setModoPrecoCustom(true);
                  }}
                  onBlur={() => {
                    if (valorReferenciaCentavos > 0) {
                      setValorReferenciaInput((valorReferenciaCentavos / 100).toFixed(2).replace('.', ','));
                    }
                  }}
                  placeholder="Ex: 40,00"
                  className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-lg px-3 py-1.5 text-white outline-none font-medium text-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Desconto (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={ehCortesia}
                  value={descontoInput}
                  onChange={e => setDescontoInput(e.target.value)}
                  onBlur={() => {
                    if (descontoCentavos > 0) {
                      setDescontoInput((descontoCentavos / 100).toFixed(2).replace('.', ','));
                    }
                  }}
                  placeholder="0,00"
                  className="w-full bg-[#111A2E] border border-slate-700 focus:border-[#22C7E8] rounded-lg px-3 py-1.5 text-white outline-none font-medium disabled:opacity-50 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 uppercase font-bold tracking-wider">
                {ehCortesia ? 'Status: Cortesia' : 'Valor Final a Cobrar:'}
              </span>
              <span className="text-base font-black text-[#22C7E8]">
                {ehCortesia ? 'R$ 0,00 (Grátis)' : formatCurrency(valorFinalCentavos)}
              </span>
            </div>
          </div>

          {/* Status Operacional & Status Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Status Operacional
              </label>
              <select
                value={statusOperacional}
                onChange={e => setStatusOperacional(e.target.value as StatusOperacional)}
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none text-xs"
              >
                <option value="pendente">Pendente de Confirmação</option>
                <option value="confirmada">Confirmada</option>
                <option value="realizada">Realizada</option>
                <option value="nao_realizada">Não Realizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Situação Financeira
              </label>
              <input
                type="text"
                disabled
                value={statusFinanceiro.replace('_', ' ').toUpperCase()}
                className="w-full bg-[#0B1220]/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 outline-none text-xs font-semibold uppercase"
              />
            </div>
          </div>

          {/* Se Cancelada ou Não Realizada: Seção de Receita Potencial Perdida & Motivo */}
          {(statusOperacional === 'cancelada' || statusOperacional === 'nao_realizada') && (
            <div className="bg-red-950/30 border border-red-800/50 p-3.5 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-red-400" />
                  Receita Potencial Perdida
                </span>
                <span className="text-[10px] text-slate-400">Pergunta 5 do Painel</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-4 text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPerda"
                      checked={!perdaApurada}
                      onChange={() => setPerdaApurada(false)}
                      className="text-[#22C7E8]"
                    />
                    <span>Não informado / A apurar</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPerda"
                      checked={perdaApurada}
                      onChange={() => setPerdaApurada(true)}
                      className="text-[#22C7E8]"
                    />
                    <span>Valor conhecido</span>
                  </label>
                </div>

                {perdaApurada && (
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Valor de perda estimado / combinado (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorPerdaInput}
                      onChange={e => setValorPerdaInput(e.target.value)}
                      onBlur={() => {
                        const cents = parseCurrencyToCents(valorPerdaInput);
                        if (cents > 0) {
                          setValorPerdaInput((cents / 100).toFixed(2).replace('.', ','));
                        }
                      }}
                      placeholder="Ex: 35,00"
                      className="w-full bg-[#111A2E] border border-red-700/60 focus:border-red-500 rounded-lg px-3 py-1.5 text-white outline-none font-medium text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {statusOperacional === 'cancelada' ? 'Motivo do Cancelamento' : 'Motivo da Não Realização'}
                </label>
                <input
                  type="text"
                  value={statusOperacional === 'cancelada' ? canceladoMotivo : motivoNaoRealizada}
                  onChange={e => {
                    if (statusOperacional === 'cancelada') {
                      setCanceladoMotivo(e.target.value);
                    } else {
                      setMotivoNaoRealizada(e.target.value);
                    }
                  }}
                  placeholder={statusOperacional === 'cancelada' ? 'Ex: Contratante cancelou por chuva' : 'Ex: Goleiro adoeceu, falta de quórum...'}
                  className="w-full bg-[#111A2E] border border-red-800/60 focus:border-red-500 rounded-lg px-3 py-1.5 text-white outline-none text-xs"
                />
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Observações
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Levar luva para society, camisa preta..."
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none resize-none text-xs"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {partidaToEdit ? 'Salvar Alterações' : 'Confirmar Partida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
