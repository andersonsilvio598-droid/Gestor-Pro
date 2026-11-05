import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Filter,
  DollarSign,
  FileCheck,
  Ban,
  CheckCircle2,
  AlertCircle,
  Archive,
  Check,
  RefreshCw,
  Tag
} from 'lucide-react';
import { Partida, StatusOperacional, StatusFinanceiro, TipoPartida, ModalidadePartida } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface MatchesViewProps {
  onNewMatch: () => void;
  onEditMatch: (partida: Partida) => void;
  onPayMatch: (contratanteId: string) => void;
  onViewReceiptByPaymentId: (paymentId: string) => void;
}

const MODALIDADE_LABELS: Record<string, string> = {
  society: 'Society',
  campo: 'Campo',
  futsal: 'Futsal',
  torneio: 'Torneio',
  amistoso: 'Amistoso',
  outro: 'Outro'
};

export const MatchesView: React.FC<MatchesViewProps> = ({
  onNewMatch,
  onEditMatch,
  onPayMatch,
  onViewReceiptByPaymentId
}) => {
  const { showToast } = useToast();

  const [filterOperational, setFilterOperational] = useState<string>('todos');
  const [filterFinancial, setFilterFinancial] = useState<string>('todos');
  const [filterModalidade, setFilterModalidade] = useState<string>('todos');
  const [filterContractor, setFilterContractor] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const partidas = StorageService.getPartidas(false);
  const contratantes = StorageService.getContratantes(true);
  const alocacoes = StorageService.getAlocacoes();

  const filteredPartidas = useMemo(() => {
    return partidas
      .filter(p => {
        if (filterOperational !== 'todos' && p.statusOperacional !== filterOperational) return false;
        if (filterFinancial !== 'todos') {
          const bal = BillingService.getPartidaBalance(p.id);
          if (bal.statusCalculado !== filterFinancial) return false;
        }
        if (filterModalidade !== 'todos' && p.modalidade !== filterModalidade) return false;
        if (filterContractor !== 'todos' && p.contratanteId !== filterContractor) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const c = contratantes.find(item => item.id === p.contratanteId);
          const matchName = c?.nome.toLowerCase().includes(term);
          const matchLocal = p.local.toLowerCase().includes(term);
          const matchDate = p.data.includes(term) || formatDatePtBr(p.data).includes(term);
          if (!matchName && !matchLocal && !matchDate) return false;
        }

        return true;
      })
      .sort((a, b) => b.data.localeCompare(a.data) || b.horaInicio.localeCompare(a.horaInicio));
  }, [partidas, filterOperational, filterFinancial, filterModalidade, filterContractor, searchTerm, contratantes]);

  // Ações de alteração rápida de status operacional
  const handleQuickStatusChange = (partida: Partida, novoStatus: StatusOperacional) => {
    if (novoStatus === 'cancelada') {
      const motivo = window.prompt(
        'Informe o motivo do cancelamento (opcional):',
        partida.canceladoMotivo || ''
      );
      if (motivo === null) return; // cancelou o prompt
      partida.statusOperacional = 'cancelada';
      partida.canceladoMotivo = motivo.trim() || undefined;
      partida.statusFinanceiro = 'sem_cobranca';
      StorageService.savePartida(partida);
      showToast('Partida cancelada. Horário liberado na agenda!', 'info');
      return;
    }

    if (novoStatus === 'arquivada') {
      const confirma = window.confirm('Deseja realmente arquivar esta partida?');
      if (!confirma) return;
      partida.statusOperacional = 'arquivada';
      partida.arquivado = true;
      StorageService.savePartida(partida);
      showToast('Partida arquivada com sucesso.', 'info');
      return;
    }

    partida.statusOperacional = novoStatus;
    StorageService.savePartida(partida);
    showToast(`Status atualizado para "${novoStatus}".`, 'success');
  };

  const getStatusBadge = (status: StatusOperacional) => {
    switch (status) {
      case 'confirmada':
        return 'bg-[#22C7E8]/10 text-[#22C7E8] border-[#22C7E8]/30';
      case 'realizada':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'pendente':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'cancelada':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'arquivada':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Header & Ação */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Gestão Operacional
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Gestão de Partidas</h2>
          <p className="text-xs text-slate-400 mt-1">
            Controle completo de horários, categorias, confirmações, cancelamentos e valores.
          </p>
        </div>

        <button
          onClick={onNewMatch}
          className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Partida
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Busca Textual */}
          <div>
            <label className="block text-slate-400 uppercase font-semibold mb-1">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Contratante, local ou data..."
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          {/* Status Operacional */}
          <div>
            <label className="block text-slate-400 uppercase font-semibold mb-1">Status Operacional</label>
            <select
              value={filterOperational}
              onChange={e => setFilterOperational(e.target.value)}
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none capitalize"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente de Confirmação</option>
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>

          {/* Categoria / Modalidade */}
          <div>
            <label className="block text-slate-400 uppercase font-semibold mb-1">Modalidade</label>
            <select
              value={filterModalidade}
              onChange={e => setFilterModalidade(e.target.value)}
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
            >
              <option value="todos">Todas as Modalidades</option>
              <option value="society">Society</option>
              <option value="campo">Campo</option>
              <option value="futsal">Futsal</option>
              <option value="torneio">Torneio</option>
              <option value="amistoso">Amistoso</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* Status Financeiro */}
          <div>
            <label className="block text-slate-400 uppercase font-semibold mb-1">Situação Financeira</label>
            <select
              value={filterFinancial}
              onChange={e => setFilterFinancial(e.target.value)}
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none uppercase"
            >
              <option value="todos">Todos</option>
              <option value="em_aberto">Em Aberto</option>
              <option value="parcialmente_pago">Parcialmente Pago</option>
              <option value="pago">Pago</option>
              <option value="sem_cobranca">Sem Cobrança</option>
            </select>
          </div>

          {/* Contratante */}
          <div>
            <label className="block text-slate-400 uppercase font-semibold mb-1">Contratante</label>
            <select
              value={filterContractor}
              onChange={e => setFilterContractor(e.target.value)}
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
            >
              <option value="todos">Todos os contratantes</option>
              {contratantes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Partidas */}
      <div className="space-y-3">
        <div className="text-xs text-slate-400 flex items-center justify-between px-1">
          <span>Exibindo {filteredPartidas.length} partida(s)</span>
        </div>

        {filteredPartidas.length === 0 ? (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
            Nenhuma partida encontrada com os filtros selecionados.
          </div>
        ) : (
          filteredPartidas.map(partida => {
            const contratante = contratantes.find(c => c.id === partida.contratanteId);
            const bal = BillingService.getPartidaBalance(partida.id);
            const alocDaPartida = alocacoes.filter(a => a.partidaId === partida.id);

            return (
              <div
                key={partida.id}
                className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 p-4 md:p-5 rounded-2xl shadow-sm transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Informações da Partida */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-white">{contratante?.nome}</span>
                      
                      {/* Badge Operacional */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border capitalize font-semibold ${getStatusBadge(
                          partida.statusOperacional
                        )}`}
                      >
                        {partida.statusOperacional === 'pendente'
                          ? 'Pendente de Confirmação'
                          : partida.statusOperacional}
                      </span>

                      {/* Modalidade */}
                      {partida.modalidade && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold uppercase">
                          {MODALIDADE_LABELS[partida.modalidade] || partida.modalidade}
                        </span>
                      )}

                      {/* Cortesia / Fixo */}
                      {partida.ehCortesia && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          CORTESIA
                        </span>
                      )}
                      {partida.origemPartida === 'jogo_fixo' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                          FIXO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-[#22C7E8]" />
                        {formatDatePtBr(partida.data)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {partida.horaInicio} às {partida.horaFim} ({partida.duracaoMinutos} min)
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {partida.local || 'Local não informado'}
                      </span>
                    </div>

                    {partida.canceladoMotivo && (
                      <div className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 px-2.5 py-1 rounded-lg">
                        <strong>Motivo do Cancelamento:</strong> {partida.canceladoMotivo}
                      </div>
                    )}

                    {partida.motivoNaoRealizada && (
                      <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/40 px-2.5 py-1 rounded-lg">
                        <strong>Motivo Não Realizada:</strong> {partida.motivoNaoRealizada}
                      </div>
                    )}

                    {(partida.statusOperacional === 'cancelada' || partida.statusOperacional === 'nao_realizada') && (
                      <div className="text-xs text-slate-300 flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Receita Potencial Perdida:</span>
                        {partida.perdaApurada && partida.valorPerdaPotencialCentavos !== undefined ? (
                          <strong className="text-red-400 font-mono font-bold">
                            {formatCurrency(partida.valorPerdaPotencialCentavos)}
                          </strong>
                        ) : (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Não informado / A apurar
                          </span>
                        )}
                      </div>
                    )}

                    {partida.observacoes && (
                      <div className="text-xs text-slate-400 italic pt-0.5">
                        Obs: {partida.observacoes}
                      </div>
                    )}
                  </div>

                  {/* Informações Financeiras */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block">Valor Final:</span>
                      <strong className="text-base font-black text-white">
                        {formatCurrency(partida.valorFinalCentavos)}
                      </strong>
                      {partida.descontoCentavos > 0 && (
                        <span className="text-[10px] text-slate-400 block">
                          (Desc: {formatCurrency(partida.descontoCentavos)})
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border block ${
                          bal.saldoDevedorCentavos === 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : bal.totalPagoCentavos > 0
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {bal.saldoDevedorCentavos === 0
                          ? 'Quitado'
                          : bal.totalPagoCentavos > 0
                          ? `Saldo ${formatCurrency(bal.saldoDevedorCentavos)}`
                          : 'Em Aberto'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linha de Ações da Partida */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/80 gap-2 text-xs">
                  {/* Botões de Ação Rápida de Status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => onEditMatch(partida)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
                    >
                      Editar
                    </button>

                    {partida.statusOperacional !== 'confirmada' && partida.statusOperacional !== 'cancelada' && (
                      <button
                        onClick={() => handleQuickStatusChange(partida, 'confirmada')}
                        className="px-2.5 py-1.5 rounded-lg bg-[#22C7E8]/10 hover:bg-[#22C7E8]/20 text-[#22C7E8] font-semibold border border-[#22C7E8]/30 transition-colors cursor-pointer"
                        title="Confirmar presença nesta partida"
                      >
                        Confirmar
                      </button>
                    )}

                    {partida.statusOperacional !== 'realizada' && partida.statusOperacional !== 'cancelada' && (
                      <button
                        onClick={() => handleQuickStatusChange(partida, 'realizada')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 transition-colors cursor-pointer"
                        title="Marcar partida como realizada"
                      >
                        Marcar Realizada
                      </button>
                    )}

                    {partida.statusOperacional !== 'cancelada' && (
                      <button
                        onClick={() => handleQuickStatusChange(partida, 'cancelada')}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-300 font-medium transition-colors cursor-pointer"
                        title="Cancelar partida e liberar horário na agenda"
                      >
                        Cancelar
                      </button>
                    )}

                    {partida.statusOperacional !== 'arquivada' && (
                      <button
                        onClick={() => handleQuickStatusChange(partida, 'arquivada')}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Arquivar partida"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Se estiver pendente, botão de quitação rápida */}
                    {bal.saldoDevedorCentavos > 0 && partida.statusOperacional !== 'cancelada' && (
                      <button
                        onClick={() => onPayMatch(partida.contratanteId)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Receber Pagamento
                      </button>
                    )}

                    {/* Se tiver recibo vinculado a pagamento */}
                    {alocDaPartida.length > 0 && (
                      <button
                        onClick={() => onViewReceiptByPaymentId(alocDaPartida[0].pagamentoId)}
                        className="px-3 py-1.5 rounded-lg bg-[#22C7E8]/10 hover:bg-[#22C7E8]/20 text-[#22C7E8] font-semibold border border-[#22C7E8]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        Ver Recibo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
