import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Filter,
  List,
  CalendarDays,
  DollarSign,
  X,
  CreditCard,
  ExternalLink,
  Info,
  Star,
  Tag
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import {
  formatDatePtBr,
  getTodayDateString,
  getWeekDates,
  getMonthDates,
  toDateString,
  DIAS_SEMANA_ABREV,
  DIAS_SEMANA_COMPLETO,
  MESES_COMPLETO
} from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { Partida, StatusFinanceiro, StatusOperacional } from '../types';

interface ScheduleViewProps {
  onNewMatch: (date?: string) => void;
  onEditMatch: (partida: Partida) => void;
  onPayMatch?: (contratanteId?: string, partidasIds?: string[]) => void;
}

type ViewMode = 'mes' | 'semana' | 'dia' | 'lista';

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onNewMatch,
  onEditMatch,
  onPayMatch
}) => {
  // O modo Mês é prioritário para uma visualização ampla de agendamentos e finanças
  const [viewMode, setViewMode] = useState<ViewMode>('mes');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  const partidas = StorageService.getPartidas(false);
  const contratantes = StorageService.getContratantes(true);

  const currentDateStr = toDateString(currentDate);

  // Navegação de Datas
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'dia') d.setDate(d.getDate() - 1);
    else if (viewMode === 'semana') d.setDate(d.getDate() - 7);
    else if (viewMode === 'mes') d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'dia') d.setDate(d.getDate() + 1);
    else if (viewMode === 'semana') d.setDate(d.getDate() + 7);
    else if (viewMode === 'mes') d.setMonth(d.getMonth() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 1. Visão Diária
  const partidasDoDia = useMemo(() => {
    return partidas
      .filter(p => p.data === currentDateStr && p.statusOperacional !== 'arquivada')
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [partidas, currentDateStr]);

  // 2. Visão Semanal
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  // 3. Visão Mensal
  const monthDates = useMemo(
    () => getMonthDates(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  // 4. Visão Lista de Partidas do Mês / Período
  const currentMonthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const partidasDoMes = useMemo(() => {
    return partidas
      .filter(p => p.data.startsWith(currentMonthPrefix) && p.statusOperacional !== 'arquivada')
      .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
  }, [partidas, currentMonthPrefix]);

  // Indicadores Financeiros Consolidados do Mês Selecionado (Seção 3.3)
  const monthFinancialSummary = useMemo(() => {
    let partidasTotal = 0;
    let partidasRealizadas = 0;
    let valorPrevistoCentavos = 0;
    let receitaGeradaCentavos = 0;
    let recebidoCentavos = 0;
    let saldoEmAbertoCentavos = 0;

    for (const p of partidasDoMes) {
      if (p.statusOperacional === 'cancelada' || p.statusOperacional === 'nao_realizada') {
        continue;
      }

      partidasTotal++;
      const bal = BillingService.getPartidaBalance(p.id);

      if (p.statusOperacional === 'realizada') {
        partidasRealizadas++;
        if (!p.ehCortesia) {
          receitaGeradaCentavos += p.valorFinalCentavos;
        }
      } else {
        // Agendada / Confirmada futura
        if (!p.ehCortesia) {
          valorPrevistoCentavos += p.valorFinalCentavos;
        }
      }

      recebidoCentavos += bal.totalPagoCentavos;
      saldoEmAbertoCentavos += bal.saldoDevedorCentavos;
    }

    return {
      partidasTotal,
      partidasRealizadas,
      valorPrevistoCentavos,
      receitaGeradaCentavos,
      recebidoCentavos,
      saldoEmAbertoCentavos
    };
  }, [partidasDoMes]);

  // Partidas do dia selecionado para o modal de detalhes
  const selectedDayMatches = useMemo(() => {
    if (!selectedDayDate) return [];
    return partidas
      .filter(p => p.data === selectedDayDate && p.statusOperacional !== 'arquivada')
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [partidas, selectedDayDate]);

  // Resumo financeiro estrito do dia selecionado (Seção 3.3)
  const selectedDaySummary = useMemo(() => {
    if (!selectedDayDate) return null;

    let totalJogos = 0;
    let jogosRealizados = 0;
    let valorAgendadoCentavos = 0;
    let receitaGeradaCentavos = 0;
    let recebidoCentavos = 0;
    let saldoPendenteCentavos = 0;

    for (const p of selectedDayMatches) {
      if (p.statusOperacional === 'cancelada' || p.statusOperacional === 'nao_realizada') {
        continue;
      }
      totalJogos++;
      const bal = BillingService.getPartidaBalance(p.id);

      if (p.statusOperacional === 'realizada') {
        jogosRealizados++;
        if (!p.ehCortesia) {
          receitaGeradaCentavos += p.valorFinalCentavos;
        }
      } else {
        if (!p.ehCortesia) {
          valorAgendadoCentavos += p.valorFinalCentavos;
        }
      }

      recebidoCentavos += bal.totalPagoCentavos;
      saldoPendenteCentavos += bal.saldoDevedorCentavos;
    }

    return {
      totalJogos,
      jogosRealizados,
      valorAgendadoCentavos,
      receitaGeradaCentavos,
      recebidoCentavos,
      saldoPendenteCentavos
    };
  }, [selectedDayMatches, selectedDayDate]);

  // Função auxiliar para calcular métricas financeiras de um dia específico do grid
  const getDayFinancials = (dateStr: string) => {
    const dayMatches = partidas.filter(
      p => p.data === dateStr && p.statusOperacional !== 'arquivada'
    );
    const activeMatches = dayMatches.filter(
      p => p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'nao_realizada'
    );

    let totalValorAtivoCentavos = 0;
    let totalPagoCentavos = 0;
    let saldoDevedorCentavos = 0;
    let hasCanceladas = dayMatches.some(p => p.statusOperacional === 'cancelada');

    for (const p of activeMatches) {
      totalValorAtivoCentavos += p.valorFinalCentavos;
      const bal = BillingService.getPartidaBalance(p.id);
      totalPagoCentavos += bal.totalPagoCentavos;
      saldoDevedorCentavos += bal.saldoDevedorCentavos;
    }

    const allPaid = activeMatches.length > 0 && saldoDevedorCentavos === 0 && !activeMatches.some(m => m.ehCortesia);
    const hasDebt = saldoDevedorCentavos > 0;
    const isCortesiaOnly = activeMatches.length > 0 && activeMatches.every(m => m.ehCortesia);

    return {
      allMatches: dayMatches,
      activeMatches,
      totalValorAtivoCentavos,
      totalPagoCentavos,
      saldoDevedorCentavos,
      hasCanceladas,
      allPaid,
      hasDebt,
      isCortesiaOnly
    };
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Top Controls: Modes & Date Navigator */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Alternador de Modo (Mês prioritário, Semana, Dia, Lista) */}
          <div className="bg-[#0B1220] p-1 rounded-xl border border-slate-800 flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('mes')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'mes' ? 'bg-[#22C7E8] text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Mês
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'semana' ? 'bg-[#22C7E8] text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'dia' ? 'bg-[#22C7E8] text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('lista')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'lista' ? 'bg-[#22C7E8] text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            Hoje
          </button>
        </div>

        {/* Date Navigator Header */}
        <div className="flex items-center justify-between md:justify-center gap-3">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-[#0B1220] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center min-w-[210px]">
            <h2 className="text-base md:text-lg font-black text-white capitalize">
              {viewMode === 'dia' && formatDatePtBr(currentDateStr)}
              {viewMode === 'semana' &&
                `${formatDatePtBr(toDateString(weekDates[0]))} a ${formatDatePtBr(toDateString(weekDates[6]))}`}
              {(viewMode === 'mes' || viewMode === 'lista') &&
                `${MESES_COMPLETO[currentDate.getMonth()]} de ${currentDate.getFullYear()}`}
            </h2>
          </div>

          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-[#0B1220] hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Botão Nova Partida */}
        <button
          onClick={() => onNewMatch(currentDateStr)}
          className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Jogo
        </button>
      </div>

      {/* Resumo Financeiro Mensal do Período (Seção 3.3) */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Partidas do Mês</span>
            <div className="text-base font-black text-white mt-0.5">
              {monthFinancialSummary.partidasTotal} <span className="text-xs text-slate-400 font-normal">({monthFinancialSummary.partidasRealizadas} feitas)</span>
            </div>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Previsto (Agendadas)</span>
            <div className="text-base font-black text-[#22C7E8] mt-0.5">
              {formatCurrency(monthFinancialSummary.valorPrevistoCentavos)}
            </div>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Receita Realizada</span>
            <div className="text-base font-black text-white mt-0.5">
              {formatCurrency(monthFinancialSummary.receitaGeradaCentavos)}
            </div>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Efetivamente Recebido</span>
            <div className="text-base font-black text-emerald-400 mt-0.5">
              {formatCurrency(monthFinancialSummary.recebidoCentavos)}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Saldo em Aberto</span>
            <div className={`text-base font-black mt-0.5 ${monthFinancialSummary.saldoEmAbertoCentavos > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {formatCurrency(monthFinancialSummary.saldoEmAbertoCentavos)}
            </div>
          </div>
        </div>
      </div>

      {/* 1. VISÃO MÊS (Espaçosa, Informações Financeiras Diretas nos Dias - Seção 3.1 & 3.2) */}
      {viewMode === 'mes' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-3 sm:p-4 md:p-5 shadow-xl space-y-3">
          {/* Header dos Dias da Semana */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center font-bold text-[11px] sm:text-xs text-slate-400 uppercase py-2 border-b border-slate-800">
            {DIAS_SEMANA_ABREV.map((dia, idx) => (
              <div key={idx} className={idx === 0 || idx === 6 ? 'text-slate-500' : 'text-slate-300'}>
                {dia}
              </div>
            ))}
          </div>

          {/* Grid de Dias Espaçoso e Mobile-First */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-2.5 pt-1">
            {monthDates.map((dayDate, idx) => {
              const dateStr = toDateString(dayDate);
              const isCurrentMonth = dayDate.getMonth() === currentDate.getMonth();
              const isToday = dateStr === getTodayDateString();
              const financials = getDayFinancials(dateStr);
              const matchCount = financials.allMatches.length;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayDate(dateStr)}
                  className={`min-h-[110px] sm:min-h-[135px] lg:min-h-[150px] p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                    !isCurrentMonth
                      ? 'bg-[#0B1220]/30 border-slate-900/60 opacity-35'
                      : isToday
                      ? 'bg-[#15233c] border-[#22C7E8] shadow-md shadow-[#22C7E8]/10'
                      : financials.activeMatches.length > 0
                      ? 'bg-[#0E172A] border-slate-700/80 hover:border-[#22C7E8]/70 hover:bg-[#121E36]'
                      : 'bg-[#0B1220] border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Cabeçalho da Célula do Dia */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-black transition-colors ${
                        isToday
                          ? 'bg-[#22C7E8] text-slate-950 px-1.5 py-0.2 rounded-md font-black shadow-sm'
                          : isCurrentMonth
                          ? 'text-white group-hover:text-[#22C7E8]'
                          : 'text-slate-500'
                      }`}
                    >
                      {dayDate.getDate()}
                    </span>

                    {/* Badge de Partidas no Dia */}
                    {matchCount > 0 && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded-full border ${
                          financials.hasDebt
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : financials.allPaid
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-[#22C7E8]/10 text-[#22C7E8] border-[#22C7E8]/30'
                        }`}
                      >
                        {matchCount} {matchCount === 1 ? 'jogo' : 'jogos'}
                      </span>
                    )}
                  </div>

                  {/* Corpo do Dia: Exibição Direta dos Preços e Partidas (Seção 3.2) */}
                  <div className="my-1.5 flex-1 flex flex-col justify-center space-y-1 overflow-hidden">
                    {matchCount === 0 ? (
                      <div className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors text-center py-2 sm:py-3">
                        <span className="hidden sm:inline">Disponível</span>
                      </div>
                    ) : matchCount === 1 ? (
                      // 1 Partida: Exibe Horário e Preço Completo
                      (() => {
                        const m = financials.allMatches[0];
                        const c = contratantes.find(item => item.id === m.contratanteId);
                        const isCancelada = m.statusOperacional === 'cancelada' || m.statusOperacional === 'nao_realizada';
                        const bal = BillingService.getPartidaBalance(m.id);

                        return (
                          <div className={`p-1 sm:p-1.5 rounded-lg border text-left ${
                            isCancelada
                              ? 'bg-rose-950/20 border-rose-900/40 text-slate-400 line-through'
                              : 'bg-[#111A2E] border-slate-700/60 text-slate-200'
                          }`}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] sm:text-[11px] font-black text-white truncate">
                                {m.ehCortesia ? 'Cortesia' : formatCurrency(m.valorFinalCentavos)}
                              </span>
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isCancelada
                                    ? 'bg-rose-500'
                                    : bal.saldoDevedorCentavos === 0
                                    ? 'bg-emerald-400'
                                    : 'bg-amber-400'
                                }`}
                              />
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5">
                              {m.horaInicio} • {c?.nome?.split(' ')[0] || 'Jogo'}
                            </div>
                          </div>
                        );
                      })()
                    ) : matchCount === 2 ? (
                      // 2 Partidas: Exibe individualmente os preços
                      <div className="space-y-1">
                        {financials.allMatches.slice(0, 2).map(m => {
                          const bal = BillingService.getPartidaBalance(m.id);
                          const isCancelada = m.statusOperacional === 'cancelada';
                          return (
                            <div
                              key={m.id}
                              className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#111A2E] border border-slate-800 flex items-center justify-between text-white truncate"
                            >
                              <span className={isCancelada ? 'line-through text-slate-400' : ''}>
                                {m.horaInicio} • {m.ehCortesia ? 'Grátis' : formatCurrency(m.valorFinalCentavos)}
                              </span>
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isCancelada ? 'bg-rose-500' : bal.saldoDevedorCentavos === 0 ? 'bg-emerald-400' : 'bg-amber-400'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // 3+ Partidas: Exibe primeira e indicador de mais
                      <div className="space-y-1">
                        <div className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#111A2E] border border-slate-800 text-white truncate">
                          {financials.allMatches[0].horaInicio} • {formatCurrency(financials.allMatches[0].valorFinalCentavos)}
                        </div>
                        <div className="text-[9px] text-[#22C7E8] font-bold px-1">
                          +{matchCount - 1} partidas
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Célula: Total Financeiro do Dia (Seção 3.2) */}
                  {financials.activeMatches.length > 0 && (
                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] sm:text-[10px]">
                      <span className="font-black text-[#22C7E8] truncate">
                        Total: {formatCurrency(financials.totalValorAtivoCentavos)}
                      </span>
                      {financials.hasDebt ? (
                        <span className="text-amber-400 font-bold shrink-0">Aberto</span>
                      ) : financials.allPaid ? (
                        <span className="text-emerald-400 font-bold shrink-0">Pago</span>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda Visual Explicativa dos Indicadores (Seção 4.3) */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Pago / Quitado</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-300">Saldo em Aberto</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C7E8]" />
                <span className="text-slate-300">Partida Confirmada</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-300">Cancelada (Sem cobrança)</span>
              </span>
            </div>

            <span className="text-[10px] text-slate-500 italic">
              Clique em qualquer dia para ver a discriminação detalhada e ações
            </span>
          </div>
        </div>
      )}

      {/* 2. VISÃO SEMANA (Espaçosa e com Preços Diretos) */}
      {viewMode === 'semana' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
          {weekDates.map((dayDate, idx) => {
            const dateStr = toDateString(dayDate);
            const isToday = dateStr === getTodayDateString();
            const financials = getDayFinancials(dateStr);

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDayDate(dateStr)}
                className={`rounded-2xl border p-3 flex flex-col min-h-[260px] transition-all cursor-pointer ${
                  isToday
                    ? 'bg-[#15233c] border-[#22C7E8] shadow-md shadow-[#22C7E8]/10'
                    : 'bg-[#111A2E] border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Cabeçalho do Dia */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                  <div className="text-left">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      {DIAS_SEMANA_ABREV[dayDate.getDay()]}
                    </span>
                    <span className={`text-base font-black ${isToday ? 'text-[#22C7E8]' : 'text-white'}`}>
                      {dayDate.getDate()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewMatch(dateStr);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    title="Adicionar jogo neste dia"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Lista de Jogos com Preços Exibidos */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px]">
                  {financials.allMatches.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-10">
                      Sem partidas
                    </div>
                  ) : (
                    financials.allMatches.map(m => {
                      const c = contratantes.find(item => item.id === m.contratanteId);
                      const bal = BillingService.getPartidaBalance(m.id);
                      const isCancelada = m.statusOperacional === 'cancelada';

                      return (
                        <div
                          key={m.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMatch(m);
                          }}
                          className={`p-2.5 rounded-xl border transition-colors space-y-1 ${
                            isCancelada
                              ? 'bg-rose-950/20 border-rose-900/40 opacity-70 line-through'
                              : 'bg-[#0B1220] hover:bg-[#16223B] border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#22C7E8]">{m.horaInicio}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCancelada
                                  ? 'bg-rose-500'
                                  : bal.saldoDevedorCentavos === 0
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                          </div>
                          <div className="font-bold text-white text-xs truncate">{c?.nome}</div>
                          <div className="flex items-center justify-between text-[11px] pt-0.5">
                            <span className="text-slate-400 truncate">{m.local || 'Local'}</span>
                            <span className="font-black text-white shrink-0">
                              {m.ehCortesia ? 'Grátis' : formatCurrency(m.valorFinalCentavos)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Total Financeiro da Data na Semana */}
                {financials.activeMatches.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs mt-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total do Dia</span>
                    <span className="font-black text-[#22C7E8]">
                      {formatCurrency(financials.totalValorAtivoCentavos)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. VISÃO DIA */}
      {viewMode === 'dia' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#22C7E8]" />
                Partidas em {formatDatePtBr(currentDateStr)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {partidasDoDia.length} partida(s) programada(s) para esta data.
              </p>
            </div>
            <button
              onClick={() => onNewMatch(currentDateStr)}
              className="px-3.5 py-1.5 rounded-xl bg-[#22C7E8] text-slate-950 font-bold text-xs"
            >
              + Adicionar Jogo
            </button>
          </div>

          {partidasDoDia.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm space-y-3">
              <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
              <div>Nenhuma partida agendada para este dia.</div>
              <button
                onClick={() => onNewMatch(currentDateStr)}
                className="text-xs text-[#22C7E8] font-bold hover:underline"
              >
                + Agendar partida agora
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {partidasDoDia.map(partida => {
                const c = contratantes.find(item => item.id === partida.contratanteId);
                const bal = BillingService.getPartidaBalance(partida.id);

                return (
                  <div
                    key={partida.id}
                    onClick={() => onEditMatch(partida)}
                    className="bg-[#0B1220] border border-slate-800 hover:border-[#22C7E8]/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{c?.nome}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
                          {partida.statusOperacional}
                        </span>
                        {partida.ehCortesia && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300">
                            Cortesia
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <span className="font-semibold text-[#22C7E8] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {partida.horaInicio} às {partida.horaFim} ({partida.duracaoMinutos}m)
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {partida.local || 'Local não informado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-left sm:text-right">
                        <div className="font-black text-white text-sm">
                          {partida.ehCortesia ? 'Grátis' : formatCurrency(partida.valorFinalCentavos)}
                        </div>
                        {bal.saldoDevedorCentavos > 0 && (
                          <div className="text-[10px] text-amber-400">
                            Falta: {formatCurrency(bal.saldoDevedorCentavos)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                          bal.saldoDevedorCentavos === 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {bal.saldoDevedorCentavos === 0 ? 'Quitado' : 'Em Aberto'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VISÃO LISTA */}
      {viewMode === 'lista' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <List className="w-4 h-4 text-[#22C7E8]" />
              Lista de Partidas ({partidasDoMes.length}) - {MESES_COMPLETO[currentDate.getMonth()]} de {currentDate.getFullYear()}
            </h3>
            <button
              onClick={() => onNewMatch()}
              className="text-xs text-[#22C7E8] font-bold hover:underline"
            >
              + Nova Partida
            </button>
          </div>

          {partidasDoMes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Nenhuma partida registrada neste mês.
            </div>
          ) : (
            <div className="space-y-2.5">
              {partidasDoMes.map(p => {
                const c = contratantes.find(item => item.id === p.contratanteId);
                const bal = BillingService.getPartidaBalance(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => onEditMatch(p)}
                    className="bg-[#0B1220] hover:bg-[#16223B] border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center bg-[#111A2E] px-2.5 py-1.5 rounded-lg border border-slate-800 min-w-[55px]">
                        <span className="text-[10px] text-slate-400 block uppercase">
                          {formatDatePtBr(p.data).slice(0, 5)}
                        </span>
                        <span className="text-xs font-black text-[#22C7E8]">{p.horaInicio}</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{c?.nome}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
                            {p.statusOperacional}
                          </span>
                        </div>
                        <div className="text-slate-400 flex items-center gap-2 text-[11px]">
                          <span>{p.horaInicio} às {p.horaFim} ({p.duracaoMinutos}m)</span>
                          <span>•</span>
                          <span>{p.local || 'Local não informado'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-left sm:text-right">
                        <div className="font-black text-white">{formatCurrency(p.valorFinalCentavos)}</div>
                        <span className="text-[10px] text-slate-400 uppercase">{p.tipoPartida}</span>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                          bal.saldoDevedorCentavos === 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {bal.saldoDevedorCentavos === 0 ? 'Quitado' : 'Em Aberto'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. MODAL DE DETALHES DO DIA SELECIONADO (Seção 5) */}
      {selectedDayDate && selectedDaySummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header do Dia */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/70">
              <div>
                <span className="text-[11px] text-[#22C7E8] font-bold uppercase tracking-wider block">
                  Discriminação do Dia
                </span>
                <h3 className="text-base sm:text-lg font-black text-white capitalize">
                  {formatDatePtBr(selectedDayDate)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDate(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo Financeiro da Data Selecionada (Seção 3.3) */}
            <div className="p-4 bg-[#0B1220] border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-[#111A2E] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total de Jogos</span>
                <span className="text-sm font-black text-white mt-0.5 block">
                  {selectedDaySummary.totalJogos} {selectedDaySummary.totalJogos === 1 ? 'partida' : 'partidas'}
                </span>
              </div>
              <div className="bg-[#111A2E] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Valor Agendado</span>
                <span className="text-sm font-black text-[#22C7E8] mt-0.5 block">
                  {formatCurrency(selectedDaySummary.valorAgendadoCentavos)}
                </span>
              </div>
              <div className="bg-[#111A2E] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Efetivamente Recebido</span>
                <span className="text-sm font-black text-emerald-400 mt-0.5 block">
                  {formatCurrency(selectedDaySummary.recebidoCentavos)}
                </span>
              </div>
              <div className="bg-[#111A2E] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Saldo Pendente</span>
                <span className={`text-sm font-black mt-0.5 block ${selectedDaySummary.saldoPendenteCentavos > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {formatCurrency(selectedDaySummary.saldoPendenteCentavos)}
                </span>
              </div>
            </div>

            {/* Lista Detalhada das Partidas do Dia (Seção 5) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {selectedDayMatches.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CalendarDays className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Nenhuma partida registrada nesta data.</p>
                </div>
              ) : (
                selectedDayMatches.map(m => {
                  const c = contratantes.find(item => item.id === m.contratanteId);
                  const bal = BillingService.getPartidaBalance(m.id);
                  const isCancelada = m.statusOperacional === 'cancelada';

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border space-y-3 transition-colors ${
                        isCancelada
                          ? 'bg-rose-950/20 border-rose-900/40 text-slate-400'
                          : 'bg-[#0B1220] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Topo do Card da Partida */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{c?.nome}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
                              {m.statusOperacional}
                            </span>
                            {m.ehCortesia && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300">
                                Cortesia (R$ 0,00)
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 flex items-center gap-2 mt-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-[#22C7E8]" />
                            <span>{m.horaInicio} às {m.horaFim} ({m.duracaoMinutos} min)</span>
                            <span>•</span>
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>{m.local || 'Local não informado'}</span>
                          </div>
                        </div>

                        {/* Badges de Status Financeiro */}
                        <div className="text-left sm:text-right">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-lg border inline-block ${
                              bal.saldoDevedorCentavos === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {bal.saldoDevedorCentavos === 0 ? 'Quitado' : 'Em Aberto'}
                          </span>
                        </div>
                      </div>

                      {/* Informações Financeiras da Partida */}
                      <div className="grid grid-cols-3 gap-2 bg-[#111A2E] p-2.5 rounded-xl border border-slate-800 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Preço Acordado</span>
                          <span className="font-bold text-white text-xs mt-0.5 block">
                            {m.ehCortesia ? 'R$ 0,00' : formatCurrency(m.valorFinalCentavos)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Valor Pago</span>
                          <span className="font-bold text-emerald-400 text-xs mt-0.5 block">
                            {formatCurrency(bal.totalPagoCentavos)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Saldo Restante</span>
                          <span className={`font-bold text-xs mt-0.5 block ${bal.saldoDevedorCentavos > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {formatCurrency(bal.saldoDevedorCentavos)}
                          </span>
                        </div>
                      </div>

                      {/* Ações da Partida */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {bal.saldoDevedorCentavos > 0 && onPayMatch && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDayDate(null);
                              onPayMatch(m.contratanteId, [m.id]);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40 text-[11px] cursor-pointer flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Quitar Pagamento
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayDate(null);
                            onEditMatch(m);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 text-[11px] cursor-pointer"
                        >
                          Editar Partida
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Botões do Rodapé do Modal */}
            <div className="p-4 border-t border-slate-800 bg-[#0B1220]/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const d = selectedDayDate;
                  setSelectedDayDate(null);
                  onNewMatch(d);
                }}
                className="px-4 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nova Partida nesta data
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayDate(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
