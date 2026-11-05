import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Filter,
  Download,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  TrendingUp,
  Award,
  Users,
  Activity,
  Layers
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr, getTodayDateString } from '../utils/date';
import { useToast } from '../context/ToastContext';

export const ReportsView: React.FC = () => {
  const { showToast } = useToast();
  const [periodPreset, setPeriodPreset] = useState<'mes' | 'ano' | 'tudo' | 'custom'>('mes');
  const [dataInicio, setDataInicio] = useState(getTodayDateString().slice(0, 8) + '01');
  const [dataFim, setDataFim] = useState(getTodayDateString());
  const [tipoPartidaFilter, setTipoPartidaFilter] = useState<string>('todos');
  const [copiedReport, setCopiedReport] = useState(false);

  const contratantes = StorageService.getContratantes(true);
  const partidas = StorageService.getPartidas(true);
  const pagamentos = StorageService.getPagamentos();

  // Filtragem e Métricas
  const reportData = useMemo(() => {
    let filteredPartidas = partidas;

    if (periodPreset !== 'tudo') {
      filteredPartidas = filteredPartidas.filter(p => p.data >= dataInicio && p.data <= dataFim);
    }

    if (tipoPartidaFilter !== 'todos') {
      filteredPartidas = filteredPartidas.filter(p => p.tipoPartida === tipoPartidaFilter);
    }

    const realizadas = filteredPartidas.filter(p => p.statusOperacional === 'realizada');
    const canceladas = filteredPartidas.filter(p => p.statusOperacional === 'cancelada');
    const cortesias = filteredPartidas.filter(p => p.ehCortesia);

    // Contagem por modalidade
    const societyCount = filteredPartidas.filter(p => p.modalidade === 'society').length;
    const campoCount = filteredPartidas.filter(p => p.modalidade === 'campo').length;
    const futsalCount = filteredPartidas.filter(p => p.modalidade === 'futsal').length;
    const torneioCount = filteredPartidas.filter(p => p.modalidade === 'torneio').length;
    const outroModalidadeCount = filteredPartidas.filter(
      p => !p.modalidade || p.modalidade === 'outro' || p.modalidade === 'amistoso'
    ).length;

    // Valores
    const partidasComValor = filteredPartidas.filter(
      p => p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'pulada' && !p.ehCortesia
    );
    const valorGeradoCentavos = partidasComValor.reduce((acc, p) => acc + p.valorFinalCentavos, 0);

    // Média por partida
    const mediaPorPartidaCentavos =
      partidasComValor.length > 0 ? Math.round(valorGeradoCentavos / partidasComValor.length) : 0;

    // Taxa de realização
    const taxaRealizacao =
      filteredPartidas.length > 0
        ? Math.round((realizadas.length / filteredPartidas.length) * 100)
        : 100;

    // Pagamentos no período
    let filteredPagamentos = pagamentos.filter(p => !p.estornado);
    if (periodPreset !== 'tudo') {
      filteredPagamentos = filteredPagamentos.filter(
        p => p.dataRecebimento >= dataInicio && p.dataRecebimento <= dataFim
      );
    }
    const valorRecebidoCentavos = filteredPagamentos.reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    // Estornos
    const estornos = pagamentos.filter(p => p.estornado);
    const valorEstornadoCentavos = estornos.reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    // Ranking de Contratantes por Faturamento no Período
    const contractorMap = new Map<string, { nome: string; valorCentavos: number; partidasCount: number }>();
    for (const p of partidasComValor) {
      const c = contratantes.find(item => item.id === p.contratanteId);
      const cName = c?.nome || 'Desconhecido';
      const existing = contractorMap.get(p.contratanteId) || {
        nome: cName,
        valorCentavos: 0,
        partidasCount: 0
      };
      existing.valorCentavos += p.valorFinalCentavos;
      existing.partidasCount++;
      contractorMap.set(p.contratanteId, existing);
    }

    const topContractors = Array.from(contractorMap.values())
      .sort((a, b) => b.valorCentavos - a.valorCentavos)
      .slice(0, 5);

    return {
      totalPartidas: filteredPartidas.length,
      realizadasCount: realizadas.length,
      canceladasCount: canceladas.length,
      cortesiasCount: cortesias.length,
      societyCount,
      campoCount,
      futsalCount,
      torneioCount,
      outroModalidadeCount,
      valorGeradoCentavos,
      valorRecebidoCentavos,
      valorEstornadoCentavos,
      mediaPorPartidaCentavos,
      taxaRealizacao,
      saldoPendenteEstimado: Math.max(0, valorGeradoCentavos - valorRecebidoCentavos),
      topContractors
    };
  }, [partidas, pagamentos, periodPreset, dataInicio, dataFim, tipoPartidaFilter, contratantes]);

  const handleCopySummary = () => {
    const texto = `📊 *GOLEIRO PRO - RELATÓRIO OPERACIONAL & FINANCEIRO*\nPeríodo: ${
      periodPreset === 'tudo' ? 'Todo o Histórico' : `${formatDatePtBr(dataInicio)} até ${formatDatePtBr(dataFim)}`
    }\n\n• Partidas Realizadas: ${reportData.realizadasCount}\n• Partidas Canceladas: ${
      reportData.canceladasCount
    }\n• Taxa de Realização: ${reportData.taxaRealizacao}%\n• Cortesias: ${reportData.cortesiasCount}\n\n*Financeiro:*\n• Total Gerado: ${formatCurrency(
      reportData.valorGeradoCentavos
    )}\n• Efetivamente Recebido: ${formatCurrency(
      reportData.valorRecebidoCentavos
    )}\n• Média por Partida: ${formatCurrency(
      reportData.mediaPorPartidaCentavos
    )}\n• Saldo Pendente Estimado: ${formatCurrency(
      reportData.saldoPendenteEstimado
    )}\n\n*Top Contratantes:*\n${reportData.topContractors
      .map((c, i) => `${i + 1}. ${c.nome} - ${formatCurrency(c.valorCentavos)} (${c.partidasCount} jogos)`)
      .join('\n')}\n\nGerado pelo Goleiro Pro.`;

    navigator.clipboard.writeText(texto);
    setCopiedReport(true);
    showToast('Resumo do relatório copiado com sucesso!', 'success');
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const maxContractorVal = reportData.topContractors[0]?.valorCentavos || 1;

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Análise & Métricas
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Relatórios & Estatísticas</h2>
          <p className="text-xs text-slate-400 mt-1">
            Consolidação por período, média por jogo, ranking de contratantes e taxas de presença.
          </p>
        </div>

        <button
          onClick={handleCopySummary}
          className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          {copiedReport ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          {copiedReport ? 'Resumo Copiado!' : 'Copiar Resumo em Texto'}
        </button>
      </div>

      {/* Barra de Filtros de Período */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Presets */}
          <div className="bg-[#0B1220] p-1 rounded-xl border border-slate-800 flex items-center gap-1 font-semibold">
            <button
              onClick={() => {
                setPeriodPreset('mes');
                setDataInicio(getTodayDateString().slice(0, 8) + '01');
                setDataFim(getTodayDateString());
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodPreset === 'mes' ? 'bg-[#22C7E8] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => {
                const year = new Date().getFullYear();
                setPeriodPreset('ano');
                setDataInicio(`${year}-01-01`);
                setDataFim(getTodayDateString());
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodPreset === 'ano' ? 'bg-[#22C7E8] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ano Atual
            </button>
            <button
              onClick={() => {
                setPeriodPreset('tudo');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodPreset === 'tudo' ? 'bg-[#22C7E8] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todo Histórico
            </button>
            <button
              onClick={() => setPeriodPreset('custom')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodPreset === 'custom' ? 'bg-[#22C7E8] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Modalidade */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tipo:</span>
            <select
              value={tipoPartidaFilter}
              onChange={e => setTipoPartidaFilter(e.target.value)}
              className="bg-[#0B1220] border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white outline-none"
            >
              <option value="todos">Todas as Relações</option>
              <option value="avulso">Avulsas</option>
              <option value="fixo">Fixas</option>
              <option value="pacote">Pacote</option>
              <option value="cortesia">Cortesia</option>
            </select>
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs max-w-sm">
            <div>
              <label className="text-slate-400 block mb-1">De:</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full bg-[#0B1220] border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Até:</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="w-full bg-[#0B1220] border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid de Resumo Financeiro & Operacional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
          <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Valor Gerado no Período</span>
          <div className="text-2xl font-black text-white">
            {formatCurrency(reportData.valorGeradoCentavos)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Sem contar cortesias integrais</span>
        </div>

        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
          <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Recebido Efetivamente</span>
          <div className="text-2xl font-black text-emerald-400">
            {formatCurrency(reportData.valorRecebidoCentavos)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Entradas em caixa liquidadas</span>
        </div>

        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
          <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Média por Partida</span>
          <div className="text-2xl font-black text-[#22C7E8]">
            {formatCurrency(reportData.mediaPorPartidaCentavos)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Ticket médio por compromisso</span>
        </div>

        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
          <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Taxa de Realização</span>
          <div className="text-2xl font-black text-white">{reportData.taxaRealizacao}%</div>
          <span className="text-[11px] text-slate-500 block mt-1">
            {reportData.realizadasCount} de {reportData.totalPartidas} jogos realizados
          </span>
        </div>
      </div>

      {/* Comparativo Visual SVG: Gerado vs Recebido */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#22C7E8]" /> Proporção Financeira do Período
        </h4>

        <div className="space-y-3">
          {/* Barra Gerado */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-semibold">Total Faturado / Gerado</span>
              <span className="font-bold text-white">{formatCurrency(reportData.valorGeradoCentavos)}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#0B1220] overflow-hidden">
              <div className="h-full bg-[#22C7E8] rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Barra Recebido */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-semibold">Total Efetivamente Recebido</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(reportData.valorRecebidoCentavos)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#0B1220] overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    reportData.valorGeradoCentavos > 0
                      ? Math.min(100, Math.round((reportData.valorRecebidoCentavos / reportData.valorGeradoCentavos) * 100))
                      : 0
                  }%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento: Ranking de Contratantes & Distribuição por Modalidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Ranking de Contratantes */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#22C7E8]" /> Top Contratantes por Faturamento
          </h4>

          {reportData.topContractors.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">Nenhum faturamento registrado no período.</div>
          ) : (
            <div className="space-y-3 text-xs">
              {reportData.topContractors.map((c, idx) => {
                const percent = Math.round((c.valorCentavos / maxContractorVal) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {c.nome}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">{formatCurrency(c.valorCentavos)}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5">({c.partidasCount} jogos)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#0B1220] overflow-hidden">
                      <div
                        className="h-full bg-[#22C7E8] rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribuição por Modalidade */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#22C7E8]" /> Distribuição por Categoria
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 rounded-xl bg-[#0B1220]">
              <span className="text-slate-400">Futebol Society:</span>
              <strong className="text-white text-sm">{reportData.societyCount}</strong>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-[#0B1220]">
              <span className="text-slate-400">Futebol de Campo:</span>
              <strong className="text-white text-sm">{reportData.campoCount}</strong>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-[#0B1220]">
              <span className="text-slate-400">Futsal:</span>
              <strong className="text-white text-sm">{reportData.futsalCount}</strong>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-[#0B1220]">
              <span className="text-slate-400">Torneios / Campeonatos:</span>
              <strong className="text-[#22C7E8] text-sm">{reportData.torneioCount}</strong>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-[#0B1220]">
              <span className="text-slate-400">Amistosos / Outros:</span>
              <strong className="text-slate-300 text-sm">{reportData.outroModalidadeCount}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
