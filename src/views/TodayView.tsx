import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Plus,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Filter,
  Activity,
  Layers,
  ChevronRight,
  Shield,
  CalendarRange
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { ConsistencyService } from '../services/consistency';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr, getTodayDateString, toDateString, getWeekDates } from '../utils/date';
import { Partida, ModalidadePartida } from '../types';

interface TodayViewProps {
  onNavigate: (module: string, entityId?: string) => void;
  onNewMatch: () => void;
  onNewPayment: (contratanteId?: string) => void;
  onEditMatch?: (partida: Partida) => void;
}

type PeriodFilterType = 'hoje' | 'semana' | 'mes' | 'custom';

const MODALIDADE_LABELS: Record<string, string> = {
  society: 'Society',
  campo: 'Campo',
  futsal: 'Futsal',
  torneio: 'Torneio',
  amistoso: 'Amistoso',
  outro: 'Outro'
};

export const TodayView: React.FC<TodayViewProps> = ({
  onNavigate,
  onNewMatch,
  onNewPayment,
  onEditMatch
}) => {
  const todayStr = getTodayDateString();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('hoje');
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  const partidas = StorageService.getPartidas(false);
  const contratantes = StorageService.getContratantes(false);
  const pagamentos = StorageService.getPagamentos().filter(p => !p.estornado);
  const cobrancas = StorageService.getCobrancas();
  const jogosFixos = StorageService.getJogosFixos(false);

  // Calcula o intervalo de datas conforme o filtro de período selecionado
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (periodFilter === 'hoje') {
      return {
        startDate: todayStr,
        endDate: todayStr,
        periodLabel: 'Hoje'
      };
    }
    if (periodFilter === 'semana') {
      const dates = getWeekDates(now);
      const start = toDateString(dates[0]);
      const end = toDateString(dates[6]);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `Esta Semana (${formatDatePtBr(start).slice(0, 5)} a ${formatDatePtBr(end).slice(0, 5)})`
      };
    }
    if (periodFilter === 'mes') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const start = `${year}-${month}-01`;
      const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `Este Mês (${month}/${year})`
      };
    }
    // Custom
    return {
      startDate: customStart || todayStr,
      endDate: customEnd || todayStr,
      periodLabel: `${formatDatePtBr(customStart)} a ${formatDatePtBr(customEnd)}`
    };
  }, [periodFilter, todayStr, customStart, customEnd]);

  // Partidas do período selecionado
  const partidasPeriodo = useMemo(() => {
    return partidas
      .filter(p => p.data >= startDate && p.data <= endDate && p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'arquivada')
      .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
  }, [partidas, startDate, endDate]);

  // Indicadores do período calculados estritamente dos registros reais
  const metrics = useMemo(() => {
    const totalPartidas = partidasPeriodo.length;
    const confirmadas = partidasPeriodo.filter(p => p.statusOperacional === 'confirmada').length;
    const realizadas = partidasPeriodo.filter(p => p.statusOperacional === 'realizada').length;
    
    // Valor total previsto (agendado)
    const valorPrevistoCentavos = partidasPeriodo
      .filter(p => !p.ehCortesia)
      .reduce((acc, p) => acc + p.valorFinalCentavos, 0);

    // Valor efetivamente recebido no período (pagamentos reais com dataRecebimento no intervalo)
    const valorRecebidoCentavos = pagamentos
      .filter(p => p.dataRecebimento >= startDate && p.dataRecebimento <= endDate)
      .reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    // Valores em aberto das partidas do período
    let valoresEmAbertoCentavos = 0;
    for (const p of partidasPeriodo) {
      if (!p.ehCortesia) {
        const bal = BillingService.getPartidaBalance(p.id);
        valoresEmAbertoCentavos += bal.saldoDevedorCentavos;
      }
    }

    // Pendências financeiras gerais acumuladas de todos os clientes
    let pendenciasTotaisCentavos = 0;
    let contratantesComSaldoCount = 0;
    for (const c of contratantes) {
      const summary = BillingService.getContratanteFinancialSummary(c.id);
      if (summary.saldoDevedorCentavos > 0) {
        pendenciasTotaisCentavos += summary.saldoDevedorCentavos;
        contratantesComSaldoCount++;
      }
    }

    return {
      totalPartidas,
      confirmadas,
      realizadas,
      valorPrevistoCentavos,
      valorRecebidoCentavos,
      valoresEmAbertoCentavos,
      pendenciasTotaisCentavos,
      contratantesComSaldoCount
    };
  }, [partidasPeriodo, pagamentos, startDate, endDate, contratantes]);

  // Próximas partidas a partir de hoje
  const proximasPartidas = useMemo(() => {
    return partidas
      .filter(p => p.data >= todayStr && p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'arquivada')
      .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))
      .slice(0, 5);
  }, [partidas, todayStr]);

  // Alertas dinâmicos e clicáveis
  const dynamicAlerts = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      type: 'warning' | 'danger' | 'info';
      actionLabel: string;
      onClick: () => void;
    }> = [];

    // Conflitos de horário
    const issues = ConsistencyService.checkAll();
    const conflitos = issues.filter(i => i.tipo === 'conflito_horario');
    if (conflitos.length > 0) {
      list.push({
        id: 'alert-conflito',
        title: `${conflitos.length} Conflito(s) de Horário Detectado(s)!`,
        desc: conflitos[0].descricao,
        type: 'danger',
        actionLabel: 'Ver Agenda',
        onClick: () => onNavigate('agenda')
      });
    }

    // Cobranças vencidas
    const vencidas = cobrancas.filter(
      cob => cob.status === 'enviada' && cob.dataVencimento && cob.dataVencimento < todayStr
    );
    if (vencidas.length > 0) {
      list.push({
        id: 'alert-vencidas',
        title: `${vencidas.length} Cobrança(s) Vencida(s)`,
        desc: `Cobrança ${vencidas[0].numeroCobranca} venceu em ${formatDatePtBr(vencidas[0].dataVencimento!)}.`,
        type: 'warning',
        actionLabel: 'Ver Cobranças',
        onClick: () => onNavigate('cobrancas')
      });
    }

    // Contratantes com saldo em aberto
    if (metrics.contratantesComSaldoCount > 0) {
      list.push({
        id: 'alert-devedores',
        title: `${metrics.contratantesComSaldoCount} Contratante(s) com Saldo Pendente`,
        desc: `Total de ${formatCurrency(metrics.pendenciasTotaisCentavos)} pendente de recebimento.`,
        type: 'info',
        actionLabel: 'Quem está devendo',
        onClick: () => onNavigate('financeiro')
      });
    }

    return list;
  }, [cobrancas, todayStr, metrics, onNavigate]);

  // Pagamentos recentes
  const pagamentosRecentes = useMemo(() => {
    return [...pagamentos]
      .sort((a, b) => b.dataRecebimento.localeCompare(a.dataRecebimento))
      .slice(0, 4);
  }, [pagamentos]);

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Top Banner / Boas-vindas e Ações Rápidas */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-[#22C7E8]/40 shadow-lg shadow-[#22C7E8]/15 shrink-0 bg-[#0B1220]">
            <img
              src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
              alt="ProGestor"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider">
                ProGestor • Painel do Goleiro
              </span>
              <span className="text-[10px] bg-[#22C7E8]/10 text-[#22C7E8] font-bold px-2 py-0.5 rounded-full border border-[#22C7E8]/30">
                {periodLabel}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Hoje, {formatDatePtBr(todayStr)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {partidasPeriodo.length === 0
                ? `Nenhuma partida agendada para o período (${periodLabel.toLowerCase()}).`
                : `${partidasPeriodo.length} partida(s) encontrada(s) no período selecionado.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNewPayment()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <DollarSign className="w-4 h-4" />
            Receber Pagamento
          </button>
          <button
            onClick={onNewMatch}
            className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Partida
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Período */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#22C7E8]" /> Período:
          </span>
          <button
            onClick={() => setPeriodFilter('hoje')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === 'hoje'
                ? 'bg-[#22C7E8] text-slate-950 shadow-md shadow-[#22C7E8]/20'
                : 'bg-[#0B1220] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodFilter('semana')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === 'semana'
                ? 'bg-[#22C7E8] text-slate-950 shadow-md shadow-[#22C7E8]/20'
                : 'bg-[#0B1220] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setPeriodFilter('mes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === 'mes'
                ? 'bg-[#22C7E8] text-slate-950 shadow-md shadow-[#22C7E8]/20'
                : 'bg-[#0B1220] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => setPeriodFilter('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodFilter === 'custom'
                ? 'bg-[#22C7E8] text-slate-950 shadow-md shadow-[#22C7E8]/20'
                : 'bg-[#0B1220] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Personalizado
          </button>
        </div>

        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 text-xs">
            <span className="text-slate-400">De:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-[#0B1220] border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
            />
            <span className="text-slate-400">Até:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-[#0B1220] border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none"
            />
          </div>
        )}
      </div>

      {/* Alertas Dinâmicos e Clicáveis */}
      {dynamicAlerts.length > 0 && (
        <div className="space-y-2">
          {dynamicAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                alert.type === 'danger'
                  ? 'bg-red-950/40 border-red-800/60 text-red-200'
                  : alert.type === 'warning'
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : 'bg-[#0e2730] border-[#22C7E8]/30 text-slate-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {alert.type === 'danger' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : alert.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#22C7E8] shrink-0 mt-0.5" />
                )}
                <div>
                  <strong className="font-bold block text-white mb-0.5">{alert.title}</strong>
                  <span className="text-slate-300">{alert.desc}</span>
                </div>
              </div>
              <button
                onClick={alert.onClick}
                className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                {alert.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Grid de 8 Indicadores Principais do Período */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Partidas do Período */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Partidas do Período</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{metrics.totalPartidas}</div>
          <span className="text-[11px] text-slate-400 block mt-1">Jogos agendados no intervalo</span>
        </div>

        {/* 2. Partidas Confirmadas */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Confirmadas</span>
            <div className="w-7 h-7 rounded-lg bg-[#22C7E8]/10 text-[#22C7E8] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#22C7E8]">{metrics.confirmadas}</div>
          <span className="text-[11px] text-slate-400 block mt-1">Status confirmado no período</span>
        </div>

        {/* 3. Partidas Realizadas */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Realizadas</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics.realizadas}</div>
          <span className="text-[11px] text-slate-400 block mt-1">Jogos concluídos em campo</span>
        </div>

        {/* 4. Valor Total Previsto */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Total Previsto</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {formatCurrency(metrics.valorPrevistoCentavos)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Faturamento previsto no período</span>
        </div>

        {/* 5. Efetivamente Recebido */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Recebido</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {formatCurrency(metrics.valorRecebidoCentavos)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Efetivamente em caixa no período</span>
        </div>

        {/* 6. Valores em Aberto no Período */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Em Aberto (Período)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400">
            {formatCurrency(metrics.valoresEmAbertoCentavos)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Saldo a receber das partidas do período</span>
        </div>

        {/* 7. Próximas Partidas Geral */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Próximos Jogos</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{proximasPartidas.length}</div>
          <span className="text-[11px] text-slate-400 block mt-1">Agendadas a partir de hoje</span>
        </div>

        {/* 8. Pendências Financeiras Totais */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Total a Receber</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400">
            {formatCurrency(metrics.pendenciasTotaisCentavos)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {metrics.contratantesComSaldoCount} contratante(s) em aberto
          </span>
        </div>
      </div>

      {/* Seção Principal: Partidas do Período e Próximos Jogos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Partidas do Período Selecionado */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#22C7E8]" /> Partidas de {periodLabel} ({partidasPeriodo.length})
            </h3>
            <button
              onClick={() => onNavigate('agenda')}
              className="text-xs text-[#22C7E8] hover:underline flex items-center gap-1 font-semibold"
            >
              Ver Agenda <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {partidasPeriodo.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0B1220] border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <CalendarRange className="w-6 h-6 text-[#22C7E8]" />
              </div>
              <div>
                <h4 className="text-white font-bold text-base">Nenhuma partida para {periodLabel.toLowerCase()}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Cadastre uma nova partida com data, horário e contratante para iniciar a gestão e controle financeiro.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onNewMatch}
                  className="px-4 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Primeira Partida
                </button>
                {periodFilter !== 'mes' && (
                  <button
                    onClick={() => setPeriodFilter('mes')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Ver Este Mês
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {partidasPeriodo.map(p => {
                const c = contratantes.find(item => item.id === p.contratanteId);
                const bal = BillingService.getPartidaBalance(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => onEditMatch?.(p)}
                    className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-sm transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white">{c?.nome}</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize font-medium">
                            {p.statusOperacional}
                          </span>
                          {p.modalidade && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold uppercase">
                              {MODALIDADE_LABELS[p.modalidade] || p.modalidade}
                            </span>
                          )}
                          {p.ehCortesia && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                              CORTESIA
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-slate-200">
                            <Calendar className="w-3.5 h-3.5 text-[#22C7E8]" />
                            {formatDatePtBr(p.data)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {p.horaInicio} às {p.horaFim} ({p.duracaoMinutos} min)
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {p.local || 'Local não informado'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <div className="text-left sm:text-right">
                          <span className="text-xs text-slate-400 block">Valor:</span>
                          <strong className="text-base text-white font-bold">
                            {formatCurrency(p.valorFinalCentavos)}
                          </strong>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                              bal.saldoDevedorCentavos === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {bal.saldoDevedorCentavos === 0 ? 'Quitado' : 'Em Aberto'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Seção Próximas Partidas (Geral) */}
          {proximasPartidas.length > 0 && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#22C7E8]" /> Próximos Compromissos na Agenda
                </h4>
                <button
                  onClick={() => onNavigate('partidas')}
                  className="text-xs text-[#22C7E8] hover:underline font-semibold"
                >
                  Ver todas
                </button>
              </div>

              <div className="space-y-2">
                {proximasPartidas.map(p => {
                  const c = contratantes.find(item => item.id === p.contratanteId);
                  const bal = BillingService.getPartidaBalance(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => onEditMatch?.(p)}
                      className="bg-[#0B1220] border border-slate-800 hover:border-slate-700 p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center bg-[#111A2E] px-2.5 py-1 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {formatDatePtBr(p.data).slice(0, 5)}
                          </span>
                          <span className="text-xs font-black text-[#22C7E8]">{p.horaInicio}</span>
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{c?.nome}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{p.local || 'Local não informado'}</span>
                            {p.modalidade && (
                              <>
                                <span>•</span>
                                <span className="text-[#22C7E8]">{MODALIDADE_LABELS[p.modalidade]}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-white">{formatCurrency(p.valorFinalCentavos)}</div>
                        <span
                          className={`text-[10px] font-semibold ${
                            bal.saldoDevedorCentavos === 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {bal.saldoDevedorCentavos === 0 ? 'Quitado' : 'Em Aberto'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna 3: Pagamentos Recentes & Atalhos */}
        <div className="space-y-5">
          {/* Pagamentos Recentes */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Pagamentos Recentes
              </h4>
              <button
                onClick={() => onNavigate('pagamentos')}
                className="text-xs text-[#22C7E8] hover:underline font-semibold"
              >
                Ver todos
              </button>
            </div>

            {pagamentosRecentes.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">Nenhum pagamento registrado ainda.</div>
            ) : (
              <div className="space-y-2">
                {pagamentosRecentes.map(pag => {
                  const c = contratantes.find(item => item.id === pag.contratanteId);
                  return (
                    <div
                      key={pag.id}
                      onClick={() => onNavigate('pagamentos', pag.id)}
                      className="bg-[#0B1220] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{c?.nome}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatDatePtBr(pag.dataRecebimento)} • {pag.metodoPagamento.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-xs font-black text-emerald-400">
                        {formatCurrency(pag.valorRecebidoCentavos)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-[#0B1220] border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Acesso Rápido</h4>
            <button
              onClick={() => onNavigate('financeiro')}
              className="w-full text-left p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16223B] border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Quem está devendo?</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('cobrancas')}
              className="w-full text-left p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16223B] border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Gerar Cobrança WhatsApp</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('jogos_fixos')}
              className="w-full text-left p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16223B] border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Gerar Jogos Fixos (Idempotente)</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('configuracoes')}
              className="w-full text-left p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16223B] border border-slate-800 text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Verificar Consistência e Backups</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#22C7E8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
