import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  MessageCircle,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  UserCheck,
  CalendarRange,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CheckSquare,
  Square,
  MapPin,
  FileText,
  HelpCircle,
  ChevronRight,
  Calculator
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { BillingService, CoreFiveAnswers } from '../services/billing';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr, getTodayDateString, toDateString } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface FinancialViewProps {
  onPayContractor: (contratanteId: string, initialSelectedPartidasIds?: string[]) => void;
  onOpenContractorPortal: (contratante: any) => void;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  onPayContractor,
  onOpenContractorPortal
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'painel' | 'devedores' | 'perdidas' | 'previsoes'>('painel');
  const [devedoresSubView, setDevedoresSubView] = useState<'por_partida' | 'por_contratante'>('por_partida');
  
  // Seleção múltipla para "Pagar Selecionadas"
  const [selectedPartidaIds, setSelectedPartidaIds] = useState<string[]>([]);

  const todayStr = getTodayDateString();

  // 5 Perguntas Centrais calculadas pelo BillingService
  const coreAnswers: CoreFiveAnswers = useMemo(() => {
    return BillingService.getCoreFiveAnswers();
  }, [todayStr]);

  const contratantes = StorageService.getContratantes(false);
  const partidas = StorageService.getPartidas(false);
  const pagamentos = StorageService.getPagamentos();

  // Resumo agrupado por Contratante
  const devedoresList = useMemo(() => {
    return contratantes
      .map(c => BillingService.getContratanteFinancialSummary(c.id))
      .filter(s => s.saldoDevedorCentavos > 0)
      .sort((a, b) => b.saldoDevedorCentavos - a.saldoDevedorCentavos);
  }, [contratantes]);

  // Totais e Projeções
  const totais = useMemo(() => {
    const totalRecebido = pagamentos
      .filter(p => !p.estornado)
      .reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);
    const totalEstornado = pagamentos
      .filter(p => p.estornado)
      .reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    return {
      totalRecebido,
      totalEstornado
    };
  }, [pagamentos]);

  // Reconciliação Contábil
  const reconciliacao = useMemo(() => {
    const totalRealizadoGerado = coreAnswers.realizadas.valorGeradoCentavos;
    const totalEmCaixa = coreAnswers.recebidos.valorTotalCentavos;
    const saldoPendenteAcumulado = coreAnswers.aReceber.valorTotalCentavos;

    // Calcular antecipações (pagamentos alocados em partidas que ainda não foram realizadas)
    let pagamentosAntecipadosCentavos = 0;
    const alocacoes = StorageService.getAlocacoes();
    const pagamentosValidos = new Set(pagamentos.filter(p => !p.estornado).map(p => p.id));
    
    for (const aloc of alocacoes) {
      if (pagamentosValidos.has(aloc.pagamentoId)) {
        const p = StorageService.getPartidaById(aloc.partidaId);
        if (p && p.statusOperacional !== 'realizada') {
          pagamentosAntecipadosCentavos += aloc.valorAplicadoCentavos;
        }
      }
    }

    return {
      totalRealizadoGerado,
      totalEmCaixa,
      saldoPendenteAcumulado,
      pagamentosAntecipadosCentavos,
      balancoEquilibrado: totalEmCaixa + saldoPendenteAcumulado >= totalRealizadoGerado
    };
  }, [coreAnswers, pagamentos]);

  // Projeções por Janelas Temporais (7, 14, 30 dias)
  const projecoes = useMemo(() => {
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const d14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const s7 = toDateString(d7);
    const s14 = toDateString(d14);
    const s30 = toDateString(d30);

    const calcInterval = (startStr: string, endStr: string) => {
      const pList = partidas.filter(
        p =>
          p.data >= startStr &&
          p.data <= endStr &&
          p.statusOperacional !== 'cancelada' &&
          p.statusOperacional !== 'arquivada' &&
          p.statusOperacional !== 'nao_realizada' &&
          !p.ehCortesia
      );
      const totalPrevisto = pList.reduce((acc, p) => acc + p.valorFinalCentavos, 0);
      let quitadoAntecipado = 0;
      let saldoAReceber = 0;
      for (const p of pList) {
        const bal = BillingService.getPartidaBalance(p.id);
        quitadoAntecipado += bal.totalPagoCentavos;
        saldoAReceber += bal.saldoDevedorCentavos;
      }
      return {
        count: pList.length,
        totalPrevisto,
        quitadoAntecipado,
        saldoAReceber
      };
    };

    return {
      next7Days: calcInterval(todayStr, s7),
      next14Days: calcInterval(todayStr, s14),
      next30Days: calcInterval(todayStr, s30)
    };
  }, [partidas, todayStr]);

  // Manipulação de Seleção Múltipla ("Pagar Selecionadas")
  const pendentesList = coreAnswers.aReceber.itensDetalhados;

  const handleToggleSelectPartida = (partidaId: string) => {
    setSelectedPartidaIds(prev =>
      prev.includes(partidaId) ? prev.filter(id => id !== partidaId) : [...prev, partidaId]
    );
  };

  const handleSelectAllPartidas = () => {
    if (selectedPartidaIds.length === pendentesList.length) {
      setSelectedPartidaIds([]);
    } else {
      setSelectedPartidaIds(pendentesList.map(item => item.partidaId));
    }
  };

  const selectedTotalCentavos = useMemo(() => {
    return pendentesList
      .filter(item => selectedPartidaIds.includes(item.partidaId))
      .reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);
  }, [pendentesList, selectedPartidaIds]);

  const handlePagarSelecionadas = () => {
    if (selectedPartidaIds.length === 0) {
      showToast('Selecione pelo menos uma partida para pagar', 'error');
      return;
    }
    // Identifica o contratante das partidas selecionadas
    const firstItem = pendentesList.find(item => item.partidaId === selectedPartidaIds[0]);
    if (firstItem) {
      onPayContractor(firstItem.contratanteId, selectedPartidaIds);
    }
  };

  const handleOpenWhatsAppCobrar = (d: any) => {
    if (!d.contratante.whatsapp) return;
    const phone = d.contratante.whatsapp.replace(/\D/g, '');
    const config = StorageService.getConfig();
    const msg = encodeURIComponent(
      `Olá ${d.contratante.nome}! Passando para compartilhar o saldo em aberto das partidas de goleiro: *${formatCurrency(
        d.saldoDevedorCentavos
      )}* (${d.partidasEmAbertoCount} partida(s)).\nChave Pix (${config.chavePixTipo}): ${config.chavePix}\nObrigado!`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header com Descrição das 5 Perguntas */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider">
              Arquitetura Financeira
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Auditado & Conciliado
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">Painel Financeiro & 5 Perguntas</h2>
          <p className="text-xs text-slate-400 mt-1">
            Controle acumulativo de pendências, segregação de receita realizada, recebimentos reais e perdas potenciais.
          </p>
        </div>

        {/* Botão de Ação Direta */}
        {coreAnswers.aReceber.partidasPendentesCount > 0 && (
          <button
            onClick={() => {
              setActiveTab('devedores');
              setDevedoresSubView('por_partida');
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <AlertCircle className="w-4 h-4" />
            Ver {coreAnswers.aReceber.partidasPendentesCount} Pendências ({formatCurrency(coreAnswers.aReceber.valorTotalCentavos)})
          </button>
        )}
      </div>

      {/* OS 5 CARDS DAS PERGUNTAS CENTRAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Pergunta 1: Programadas */}
        <div className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">1. Programadas</span>
              <Calendar className="w-4 h-4 text-[#22C7E8]" />
            </div>
            <div className="text-xl font-black text-white">
              {coreAnswers.programadas.quantidade} <span className="text-xs font-normal text-slate-400">partida(s)</span>
            </div>
            <div className="text-sm font-bold text-[#22C7E8] mt-0.5">
              {formatCurrency(coreAnswers.programadas.valorEsperadoCentavos)}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
            Previstas e confirmadas
          </p>
        </div>

        {/* Pergunta 2: Realizadas & Valor Gerado */}
        <div className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">2. Realizadas</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white">
              {coreAnswers.realizadas.quantidade} <span className="text-xs font-normal text-slate-400">partida(s)</span>
            </div>
            <div className="text-sm font-bold text-cyan-400 mt-0.5">
              {formatCurrency(coreAnswers.realizadas.valorGeradoCentavos)}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
            Receita efetivamente gerada
          </p>
        </div>

        {/* Pergunta 3: Dinheiro Realmente Recebido */}
        <div className="bg-[#111A2E] border border-emerald-950/60 hover:border-emerald-600/40 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-sm bg-gradient-to-b from-[#111A2E] to-emerald-950/20">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">3. Recebido em Caixa</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              {formatCurrency(coreAnswers.recebidos.valorTotalCentavos)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {coreAnswers.recebidos.pagamentosCount} pagamento(s) confirmado(s)
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
            Dinheiro real (sem estornos)
          </p>
        </div>

        {/* Pergunta 4: Quanto Ainda Tenho para Receber? */}
        <div className="bg-[#111A2E] border border-amber-950/60 hover:border-amber-600/40 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-sm bg-gradient-to-b from-[#111A2E] to-amber-950/20">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">4. A Receber</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">
              {formatCurrency(coreAnswers.aReceber.valorTotalCentavos)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {coreAnswers.aReceber.partidasPendentesCount} partida(s) • {coreAnswers.aReceber.contratantesDevedoresCount} contratante(s)
            </div>
          </div>
          <p className="text-[10px] text-amber-400/80 font-medium mt-3 pt-2 border-t border-slate-800/80">
            Acumulado de todas as datas
          </p>
        </div>

        {/* Pergunta 5: Receita Potencial Perdida */}
        <div className="bg-[#111A2E] border border-red-950/60 hover:border-red-600/40 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-sm bg-gradient-to-b from-[#111A2E] to-red-950/20">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">5. Perda Potencial</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-xl font-black text-red-400">
              {formatCurrency(coreAnswers.perdaPotencial.valorPerdaApuradaCentavos)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {coreAnswers.perdaPotencial.quantidadeNaoRealizadas} partida(s) cancelada(s)
              {coreAnswers.perdaPotencial.quantidadeSemValorInformado > 0 && (
                <span className="block text-[10px] text-amber-400/90">
                  ({coreAnswers.perdaPotencial.quantidadeSemValorInformado} a apurar)
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
            Partidas não jogadas
          </p>
        </div>
      </div>

      {/* BOX DE RECONCILIAÇÃO MATEMÁTICA E COERÊNCIA */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#22C7E8]/10 border border-[#22C7E8]/30 flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4 text-[#22C7E8]" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Equação de Conciliação Contábil</h4>
            <p className="text-slate-400 text-xs">
              Recebido em Caixa ({formatCurrency(coreAnswers.recebidos.valorTotalCentavos)}) + Saldo a Receber ({formatCurrency(coreAnswers.aReceber.valorTotalCentavos)}) = {formatCurrency(coreAnswers.recebidos.valorTotalCentavos + coreAnswers.aReceber.valorTotalCentavos)} total em circulação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold text-[11px]">
            Estornos no histórico: <strong className="text-red-400">{formatCurrency(totais.totalEstornado)}</strong>
          </span>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('painel')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'painel'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Visão Geral & Indicadores
        </button>

        <button
          onClick={() => setActiveTab('devedores')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'devedores'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <span>Quem está devendo?</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === 'devedores' ? 'bg-slate-950 text-white' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {coreAnswers.aReceber.partidasPendentesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('perdidas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'perdidas'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <span>Receita Perdida</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === 'perdidas' ? 'bg-slate-950 text-white' : 'bg-red-500/20 text-red-400'
          }`}>
            {coreAnswers.perdaPotencial.quantidadeNaoRealizadas}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('previsoes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            activeTab === 'previsoes'
              ? 'bg-[#22C7E8] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          Previsões Futuras (7, 14, 30 dias)
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL DAS 5 PERGUNTAS */}
      {activeTab === 'painel' && (
        <div className="space-y-6">
          {/* Detalhamento das 5 Perguntas em Lista Didática */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#22C7E8]" />
              Resumo Executivo do Goleiro
            </h3>

            <div className="space-y-3 divide-y divide-slate-800/80 text-xs">
              {/* P1 */}
              <div className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">1. Partidas Programadas:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Você possui <strong className="text-white">{coreAnswers.programadas.quantidade}</strong> partidas agendadas (previstas ou confirmadas), com receita futura estimada em <strong className="text-[#22C7E8]">{formatCurrency(coreAnswers.programadas.valorEsperadoCentavos)}</strong>.
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-[#22C7E8]">
                  {formatCurrency(coreAnswers.programadas.valorEsperadoCentavos)}
                </span>
              </div>

              {/* P2 */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">2. Partidas Realizadas & Valor Gerado:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Foram jogadas <strong className="text-white">{coreAnswers.realizadas.quantidade}</strong> partidas, gerando um total bruto de <strong className="text-cyan-400">{formatCurrency(coreAnswers.realizadas.valorGeradoCentavos)}</strong> em serviços prestados.
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-cyan-400">
                  {formatCurrency(coreAnswers.realizadas.valorGeradoCentavos)}
                </span>
              </div>

              {/* P3 */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">3. Dinheiro Efetivamente Recebido:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Entraram efetivamente em sua conta <strong className="text-emerald-400">{formatCurrency(coreAnswers.recebidos.valorTotalCentavos)}</strong> através de {coreAnswers.recebidos.pagamentosCount} pagamento(s) confirmado(s) e auditados.
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-emerald-400">
                  {formatCurrency(coreAnswers.recebidos.valorTotalCentavos)}
                </span>
              </div>

              {/* P4 */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">4. Quanto Ainda Tenho para Receber:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Restam <strong className="text-amber-400">{formatCurrency(coreAnswers.aReceber.valorTotalCentavos)}</strong> pendentes distribuídos em {coreAnswers.aReceber.partidasPendentesCount} partida(s). A virada do mês não exclui nem altera a data original de nenhuma pendência.
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-amber-400">
                  {formatCurrency(coreAnswers.aReceber.valorTotalCentavos)}
                </span>
              </div>

              {/* P5 */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <strong className="text-white text-sm">5. Receita Potencial Perdida:</strong>
                  <p className="text-slate-400 mt-0.5">
                    {coreAnswers.perdaPotencial.quantidadeNaoRealizadas} partida(s) foram canceladas ou não realizadas, somando uma perda apurada de <strong className="text-red-400">{formatCurrency(coreAnswers.perdaPotencial.valorPerdaApuradaCentavos)}</strong>
                    {coreAnswers.perdaPotencial.quantidadeSemValorInformado > 0 && ` (${coreAnswers.perdaPotencial.quantidadeSemValorInformado} partida(s) marcada(s) como valor a apurar)`}.
                  </p>
                </div>
                <span className="font-mono font-bold text-sm text-red-400">
                  {formatCurrency(coreAnswers.perdaPotencial.valorPerdaApuradaCentavos)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: QUEM ESTÁ DEVENDO? (DETALHADO E COM PAGAR SELECIONADAS) */}
      {activeTab === 'devedores' && (
        <div className="space-y-4">
          {/* Sub-header com seletor de visão (Por Partida vs Por Contratante) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111A2E] border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Modo de Exibição:</span>
              <button
                onClick={() => setDevedoresSubView('por_partida')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  devedoresSubView === 'por_partida'
                    ? 'bg-[#22C7E8] text-slate-950'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                Por Partida Individual ({pendentesList.length})
              </button>
              <button
                onClick={() => setDevedoresSubView('por_contratante')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  devedoresSubView === 'por_contratante'
                    ? 'bg-[#22C7E8] text-slate-950'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                Agrupado por Contratante ({devedoresList.length})
              </button>
            </div>

            {/* Aviso de Preservação de Datas */}
            <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Controle acumulativo: datas históricas originais permanecem intactas.</span>
            </div>
          </div>

          {/* SUB-VISÃO A: POR PARTIDA INDIVIDUAL (COM MULTI-SELEÇÃO) */}
          {devedoresSubView === 'por_partida' && (
            <div className="space-y-3">
              {pendentesList.length === 0 ? (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-emerald-400 text-sm">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-80" />
                  Nenhuma pendência financeira encontrada! Todas as partidas elegíveis estão quitadas.
                </div>
              ) : (
                <>
                  {/* Barra de Ação de Seleção Múltipla */}
                  <div className="bg-[#0B1220] border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                    <button
                      onClick={handleSelectAllPartidas}
                      className="flex items-center gap-2 text-slate-300 hover:text-white font-semibold cursor-pointer"
                    >
                      {selectedPartidaIds.length === pendentesList.length ? (
                        <CheckSquare className="w-4 h-4 text-[#22C7E8]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                      <span>
                        {selectedPartidaIds.length === pendentesList.length
                          ? 'Desmarcar Todas'
                          : 'Selecionar Todas as Pendências'}
                      </span>
                    </button>

                    {selectedPartidaIds.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300">
                          {selectedPartidaIds.length} selecionada(s) • Total:{' '}
                          <strong className="text-amber-400 font-bold">
                            {formatCurrency(selectedTotalCentavos)}
                          </strong>
                        </span>
                        <button
                          onClick={handlePagarSelecionadas}
                          className="px-3.5 py-1.5 rounded-lg bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          Pagar Selecionadas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lista de Partidas Pendentes */}
                  <div className="space-y-2">
                    {pendentesList.map(item => {
                      const isSelected = selectedPartidaIds.includes(item.partidaId);

                      return (
                        <div
                          key={item.partidaId}
                          onClick={() => handleToggleSelectPartida(item.partidaId)}
                          className={`bg-[#111A2E] border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#22C7E8] bg-[#111A2E]/90'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 text-slate-400">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-[#22C7E8]" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-600" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">
                                  {item.contratanteNome}
                                </span>
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                                  {formatDatePtBr(item.dataOriginal)} ({item.horaInicio})
                                </span>
                                {item.diasEmAtraso > 0 ? (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      item.diasEmAtraso > 7
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {item.diasEmAtraso} dia(s) em atraso
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                                    Jogo Futuro
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                <span>{item.local || 'Local não informado'}</span>
                                <span>•</span>
                                <span>Valor original: {formatCurrency(item.valorOriginalCentavos)}</span>
                                {item.valorPagoCentavos > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-400">
                                      Já pago: {formatCurrency(item.valorPagoCentavos)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Saldo Devedor
                              </span>
                              <span className="text-lg font-black text-amber-400">
                                {formatCurrency(item.saldoDevedorCentavos)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onPayContractor(item.contratanteId, [item.partidaId]);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs cursor-pointer shadow-sm"
                            >
                              Receber
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SUB-VISÃO B: AGRUPADO POR CONTRATANTE */}
          {devedoresSubView === 'por_contratante' && (
            <div className="space-y-3">
              {devedoresList.length === 0 ? (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-emerald-400 text-sm">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-80" />
                  Nenhum contratante possui saldo devedor pendente.
                </div>
              ) : (
                devedoresList.map(d => (
                  <div
                    key={d.contratante.id}
                    className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-white">{d.contratante.nome}</h4>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            WhatsApp:{' '}
                            <strong className="text-slate-200">
                              {d.contratante.whatsapp || 'Não informado'}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Partidas em aberto:{' '}
                            <strong className="text-amber-400">{d.partidasEmAbertoCount}</strong>
                          </span>
                          {d.partidaMaisAntigaPendente && (
                            <>
                              <span>•</span>
                              <span>
                                Pendente mais antiga:{' '}
                                <strong className="text-slate-200">
                                  {formatDatePtBr(d.partidaMaisAntigaPendente.data)}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>

                        {d.ultimoPagamento && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Último pagamento recebido:{' '}
                            {formatCurrency(d.ultimoPagamento.valorRecebidoCentavos)} em{' '}
                            {formatDatePtBr(d.ultimoPagamento.dataRecebimento)}
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Saldo Total Devido
                        </span>
                        <span className="text-2xl font-black text-amber-400">
                          {formatCurrency(d.saldoDevedorCentavos)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <button
                        onClick={() => onOpenContractorPortal(d.contratante)}
                        className="text-[#22C7E8] hover:underline font-semibold cursor-pointer"
                      >
                        Ver Extrato do Contratante
                      </button>

                      <div className="flex items-center gap-2">
                        {d.contratante.whatsapp && (
                          <button
                            onClick={() => handleOpenWhatsAppCobrar(d)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Cobrar no WhatsApp
                          </button>
                        )}
                        <button
                          onClick={() => onPayContractor(d.contratante.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          Receber Pagamento
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: RECEITA POTENCIAL PERDIDA */}
      {activeTab === 'perdidas' && (
        <div className="space-y-4">
          <div className="bg-[#111A2E] border border-slate-800 p-4 rounded-xl text-xs space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              Detalhamento de Receita Potencial Perdida (Pergunta 5)
            </h4>
            <p className="text-slate-400">
              Controle de oportunidades e partidas canceladas ou não realizadas. Os valores não entram no caixa recebido nem nas cobranças ativas, permitindo que você avalie o impacto financeiro de cancelamentos.
            </p>
          </div>

          {coreAnswers.perdaPotencial.partidas.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-80" />
              Nenhuma partida cancelada ou não realizada registrada.
            </div>
          ) : (
            <div className="space-y-2">
              {coreAnswers.perdaPotencial.partidas.map(p => {
                const c = StorageService.getContratanteById(p.contratanteId);

                return (
                  <div
                    key={p.id}
                    className="bg-[#111A2E] border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {c?.nome || 'Contratante desconhecido'}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                          {formatDatePtBr(p.data)} • {p.horaInicio} às {p.horaFim}
                        </span>
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 font-bold px-2 py-0.5 rounded-full uppercase">
                          {p.statusOperacional}
                        </span>
                      </div>

                      <div className="text-slate-400 mt-1 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{p.local}</span>
                        {(p.canceladoMotivo || p.motivoNaoRealizada) && (
                          <>
                            <span>•</span>
                            <span className="text-slate-300 italic">
                              Motivo: {p.canceladoMotivo || p.motivoNaoRealizada}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Perda Estimada
                      </span>
                      {p.perdaApurada && p.valorPerdaPotencialCentavos !== undefined ? (
                        <span className="text-base font-black text-red-400">
                          {formatCurrency(p.valorPerdaPotencialCentavos)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Não informado / A apurar
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 4: PREVISÕES FUTURAS */}
      {activeTab === 'previsoes' && (
        <div className="space-y-5">
          {/* Cartões de Projeção em Janelas Temporais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Próximos 7 dias */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Próximos 7 Dias</span>
                <span className="text-[#22C7E8]">{projecoes.next7Days.count} jogos</span>
              </div>
              <div className="text-xl font-black text-white">
                {formatCurrency(projecoes.next7Days.totalPrevisto)}
              </div>
              <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Já pago antecipado:</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(projecoes.next7Days.quitadoAntecipado)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>A receber em aberto:</span>
                  <strong className="text-amber-400">
                    {formatCurrency(projecoes.next7Days.saldoAReceber)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Próximos 14 dias */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Próximos 14 Dias</span>
                <span className="text-[#22C7E8]">{projecoes.next14Days.count} jogos</span>
              </div>
              <div className="text-xl font-black text-white">
                {formatCurrency(projecoes.next14Days.totalPrevisto)}
              </div>
              <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Já pago antecipado:</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(projecoes.next14Days.quitadoAntecipado)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>A receber em aberto:</span>
                  <strong className="text-amber-400">
                    {formatCurrency(projecoes.next14Days.saldoAReceber)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Próximos 30 dias */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Próximos 30 Dias</span>
                <span className="text-[#22C7E8]">{projecoes.next30Days.count} jogos</span>
              </div>
              <div className="text-xl font-black text-white">
                {formatCurrency(projecoes.next30Days.totalPrevisto)}
              </div>
              <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Já pago antecipado:</span>
                  <strong className="text-emerald-400">
                    {formatCurrency(projecoes.next30Days.quitadoAntecipado)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>A receber em aberto:</span>
                  <strong className="text-amber-400">
                    {formatCurrency(projecoes.next30Days.saldoAReceber)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B1220] border border-slate-800 text-xs text-slate-300">
            * As previsões indicam receitas estimadas com base em partidas agendadas para datas posteriores a hoje. <strong>Elas não se misturam com pagamentos já efetivamente liquidados em caixa.</strong>
          </div>
        </div>
      )}
    </div>
  );
};
