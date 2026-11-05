import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, DollarSign, Calendar, Clock, MapPin, AlertCircle, ArrowRight, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { Contratante, Partida, MetodoPagamento, Recibo } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency, parseCurrencyToCents } from '../utils/currency';
import { formatDatePtBr, getTodayDateString } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface PaymentModalProps {
  initialContratanteId?: string;
  initialSelectedPartidasIds?: string[];
  onClose: () => void;
  onSuccess: (reciboCriado: Recibo) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  initialContratanteId,
  initialSelectedPartidasIds,
  onClose,
  onSuccess
}) => {
  const { showToast } = useToast();
  const contratantes = StorageService.getContratantes(false);

  const [selectedContratanteId, setSelectedContratanteId] = useState(
    initialContratanteId || contratantes[0]?.id || ''
  );
  const [dataRecebimento, setDataRecebimento] = useState(getTodayDateString());
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [selectedPartidasIds, setSelectedPartidasIds] = useState<string[]>(
    initialSelectedPartidasIds || []
  );
  const [valorRecebidoInput, setValorRecebidoInput] = useState('');
  const [gerarCreditoExcedente, setGerarCreditoExcedente] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar partidas elegíveis (em aberto ou parcialmente pagas, tanto passadas quanto futuras)
  const contratante = StorageService.getContratanteById(selectedContratanteId);
  const todasPartidasContratante = useMemo(() => {
    if (!selectedContratanteId) return [];
    return StorageService.getPartidas(false)
      .filter(p => p.contratanteId === selectedContratanteId && p.statusOperacional !== 'cancelada')
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [selectedContratanteId]);

  // Filtra apenas as que têm saldo devedor > 0
  const partidasComSaldo = useMemo(() => {
    return todasPartidasContratante
      .map(p => {
        const bal = BillingService.getPartidaBalance(p.id);
        return {
          partida: p,
          saldoDevedorCentavos: bal.saldoDevedorCentavos,
          totalPagoCentavos: bal.totalPagoCentavos,
          ehFutura: p.data > dataRecebimento
        };
      })
      .filter(item => item.saldoDevedorCentavos > 0);
  }, [todasPartidasContratante, dataRecebimento]);

  // Se mudar de contratante, seleciona por padrão todas as partidas em aberto
  useEffect(() => {
    if (contratante?.formaPagamentoPadrao) {
      setMetodoPagamento(contratante.formaPagamentoPadrao);
    }
    const ids = partidasComSaldo.map(item => item.partida.id);
    setSelectedPartidasIds(ids);

    const totalSaldo = partidasComSaldo.reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);
    setValorRecebidoInput((totalSaldo / 100).toFixed(2).replace('.', ','));
  }, [selectedContratanteId]);

  // Total das partidas selecionadas
  const totalSelecionadoCentavos = useMemo(() => {
    return partidasComSaldo
      .filter(item => selectedPartidasIds.includes(item.partida.id))
      .reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);
  }, [partidasComSaldo, selectedPartidasIds]);

  // Atualizar input quando a seleção mudar
  const handleTogglePartida = (partidaId: string) => {
    setSelectedPartidasIds(prev => {
      const next = prev.includes(partidaId)
        ? prev.filter(id => id !== partidaId)
        : [...prev, partidaId];

      const novoTotal = partidasComSaldo
        .filter(item => next.includes(item.partida.id))
        .reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);
      setValorRecebidoInput((novoTotal / 100).toFixed(2).replace('.', ','));
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPartidasIds.length === partidasComSaldo.length) {
      setSelectedPartidasIds([]);
      setValorRecebidoInput('0,00');
    } else {
      const allIds = partidasComSaldo.map(item => item.partida.id);
      setSelectedPartidasIds(allIds);
      const total = partidasComSaldo.reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);
      setValorRecebidoInput((total / 100).toFixed(2).replace('.', ','));
    }
  };

  const valorRecebidoCentavos = parseCurrencyToCents(valorRecebidoInput);
  const diferencaCentavos = valorRecebidoCentavos - totalSelecionadoCentavos;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!selectedContratanteId) {
      showToast('Selecione o contratante', 'error');
      return;
    }

    if (valorRecebidoCentavos <= 0) {
      showToast('Informe um valor de recebimento válido maior que zero', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Monta alocações manuais com base nas partidas selecionadas
      let valorRestante = valorRecebidoCentavos;
      const alocacoesManuais: Array<{ partidaId: string; valorCentavos: number }> = [];

      // Prioriza as partidas selecionadas em ordem cronológica
      const selecionadasOrdenadas = partidasComSaldo
        .filter(item => selectedPartidasIds.includes(item.partida.id))
        .sort((a, b) => a.partida.data.localeCompare(b.partida.data));

      for (const item of selecionadasOrdenadas) {
        if (valorRestante <= 0) break;
        const alocar = Math.min(item.saldoDevedorCentavos, valorRestante);
        alocacoesManuais.push({
          partidaId: item.partida.id,
          valorCentavos: alocar
        });
        valorRestante -= alocar;
      }

      const resultado = BillingService.processPayment({
        contratanteId: selectedContratanteId,
        valorRecebidoCentavos,
        metodoPagamento,
        dataRecebimento,
        observacoes,
        alocacoesManuais: alocacoesManuais.length > 0 ? alocacoesManuais : undefined,
        gerarExcedenteComoCredito: gerarCreditoExcedente
      });

      showToast(`Pagamento de ${formatCurrency(valorRecebidoCentavos)} registrado com sucesso!`, 'success');
      onSuccess(resultado.recibo);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao processar pagamento', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111A2E] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Registrar Pagamento</h3>
              <p className="text-xs text-slate-400">Quitação de partidas e emissão de recibo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* Selecionar Contratante */}
          {contratantes.length === 0 ? (
            <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl text-center space-y-1.5">
              <p className="text-amber-200 text-xs font-bold">Nenhum contratante cadastrado ainda.</p>
              <p className="text-slate-400 text-xs">Cadastre um contratante para poder registrar pagamentos e emitir recibos.</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Contratante *
              </label>
              <select
                value={selectedContratanteId}
                onChange={e => setSelectedContratanteId(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2.5 text-white outline-none"
              >
                {contratantes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.tipoRelacao})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seleção de Partidas a Quitar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Partidas a Quitar ({selectedPartidasIds.length} selecionadas)
              </label>
              {partidasComSaldo.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-[#22C7E8] hover:underline font-medium"
                >
                  {selectedPartidasIds.length === partidasComSaldo.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              )}
            </div>

            {partidasComSaldo.length === 0 ? (
              <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
                Não há partidas pendentes para este contratante. O valor registrado será contabilizado como crédito antecipado.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {partidasComSaldo.map(({ partida, saldoDevedorCentavos, totalPagoCentavos, ehFutura }) => {
                  const isChecked = selectedPartidasIds.includes(partida.id);
                  return (
                    <div
                      key={partida.id}
                      onClick={() => handleTogglePartida(partida.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-[#162a47] border-[#22C7E8]/50 shadow-sm'
                          : 'bg-[#0B1220] border-slate-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[#22C7E8]">
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-500" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDatePtBr(partida.data)}
                            </span>
                            <span className="text-xs text-slate-400">{partida.horaInicio}-{partida.horaFim}</span>
                            {ehFutura && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#22C7E8]/10 text-[#22C7E8] font-bold border border-[#22C7E8]/20">
                                FUTURA
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {partida.local || 'Local não informado'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-white">
                          Saldo: {formatCurrency(saldoDevedorCentavos)}
                        </div>
                        {totalPagoCentavos > 0 && (
                          <div className="text-[10px] text-emerald-400">
                            (Já pago {formatCurrency(totalPagoCentavos)})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex justify-between items-center text-xs text-slate-400 bg-[#0B1220] px-3.5 py-2 rounded-xl border border-slate-800">
              <span>Total das partidas selecionadas:</span>
              <strong className="text-white text-sm font-bold">
                {formatCurrency(totalSelecionadoCentavos)}
              </strong>
            </div>
          </div>

          {/* Dados Financeiros do Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Valor Recebido (R$) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valorRecebidoInput}
                onChange={e => setValorRecebidoInput(e.target.value)}
                onBlur={() => {
                  if (valorRecebidoCentavos > 0) {
                    setValorRecebidoInput((valorRecebidoCentavos / 100).toFixed(2).replace('.', ','));
                  }
                }}
                required
                placeholder="Ex: 40,00"
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white font-bold outline-none text-base"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Total a quitar:</span>
                <span className="font-bold text-[#22C7E8]">
                  {formatCurrency(valorRecebidoCentavos)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Data do Recebimento *
              </label>
              <input
                type="date"
                value={dataRecebimento}
                onChange={e => setDataRecebimento(e.target.value)}
                required
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Método de Pagamento
              </label>
              <select
                value={metodoPagamento}
                onChange={e => setMetodoPagamento(e.target.value as MetodoPagamento)}
                className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none uppercase"
              >
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao">Cartão</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Aviso sobre Diferença (Excedente como Crédito ou Parcial) */}
          {diferencaCentavos > 0 && (
            <div className="bg-[#0e2730] border border-[#22C7E8]/40 p-3 rounded-xl flex items-center justify-between text-xs text-[#22C7E8]">
              <div>
                <strong>Excedente de {formatCurrency(diferencaCentavos)}:</strong> O valor recebido supera as partidas selecionadas.
              </div>
              <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={gerarCreditoExcedente}
                  onChange={e => setGerarCreditoExcedente(e.target.checked)}
                  className="rounded text-[#22C7E8] bg-[#0B1220] border-slate-700"
                />
                Salvar como crédito
              </label>
            </div>
          )}

          {diferencaCentavos < 0 && valorRecebidoCentavos > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/40 p-3 rounded-xl text-xs text-amber-300">
              <strong>Pagamento Parcial:</strong> O valor recebido quita parcialmente as partidas selecionadas. Restará um saldo devedor de {formatCurrency(Math.abs(diferencaCentavos))}.
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Observações do Pagamento
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Pix recebido após o jogo, comprovante no WhatsApp..."
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none text-xs"
            />
          </div>

          {/* Rodapé com Botões */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'Processando...' : 'Confirmar Pagamento & Gerar Recibo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
