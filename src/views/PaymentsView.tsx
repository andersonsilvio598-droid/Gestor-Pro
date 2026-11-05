import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  CreditCard,
  Calendar
} from 'lucide-react';
import { Pagamento, Recibo } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';

interface PaymentsViewProps {
  onNewPayment: () => void;
  onViewReceipt: (recibo: Recibo) => void;
  onRequestReversal: (pagamento: Pagamento) => void;
  filterPaymentId?: string;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  onNewPayment,
  onViewReceipt,
  onRequestReversal,
  filterPaymentId
}) => {
  const [activeTab, setActiveTab] = useState<'pagamentos' | 'creditos'>('pagamentos');
  const [searchTerm, setSearchTerm] = useState('');

  const pagamentos = StorageService.getPagamentos();
  const contratantes = StorageService.getContratantes(true);
  const alocacoes = StorageService.getAlocacoes();
  const creditos = StorageService.getCreditos();
  const recibos = StorageService.getRecibos();

  const filteredPagamentos = useMemo(() => {
    return [...pagamentos]
      .filter(p => {
        if (filterPaymentId && p.id !== filterPaymentId) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const c = contratantes.find(item => item.id === p.contratanteId);
        return (
          (p.reciboNumero && p.reciboNumero.toLowerCase().includes(term)) ||
          (c && c.nome.toLowerCase().includes(term)) ||
          p.dataRecebimento.includes(term) ||
          p.metodoPagamento.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.dataRecebimento.localeCompare(a.dataRecebimento));
  }, [pagamentos, contratantes, filterPaymentId, searchTerm]);

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Gestão Financeira Central
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Pagamentos & Quitações</h2>
          <p className="text-xs text-slate-400 mt-1">
            Registro de recebimentos, emissão de recibos, alocação por partida e controle de estornos.
          </p>
        </div>

        <button
          onClick={onNewPayment}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <DollarSign className="w-4 h-4" />
          Registrar Pagamento
        </button>
      </div>

      {/* Alternador de Abas (Pagamentos / Créditos) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pagamentos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'pagamentos'
                ? 'bg-[#22C7E8] text-slate-950'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Pagamentos Recebidos ({pagamentos.length})
          </button>
          <button
            onClick={() => setActiveTab('creditos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'creditos'
                ? 'bg-[#22C7E8] text-slate-950'
                : 'text-slate-400 hover:text-white bg-slate-800/60'
            }`}
          >
            Créditos Antecipados ({creditos.length})
          </button>
        </div>

        {activeTab === 'pagamentos' && (
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por recibo ou contratante..."
            className="hidden sm:block bg-[#0B1220] border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white outline-none"
          />
        )}
      </div>

      {/* ABA 1: PAGAMENTOS */}
      {activeTab === 'pagamentos' && (
        <div className="space-y-3">
          {filteredPagamentos.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Nenhum pagamento registrado até o momento.
            </div>
          ) : (
            filteredPagamentos.map(pag => {
              const contratante = contratantes.find(c => c.id === pag.contratanteId);
              const alocs = alocacoes.filter(a => a.pagamentoId === pag.id);
              const recibo = recibos.find(r => r.pagamentoId === pag.id);

              return (
                <div
                  key={pag.id}
                  className={`bg-[#111A2E] border p-5 rounded-2xl shadow-sm transition-colors space-y-4 ${
                    pag.estornado
                      ? 'border-red-900/60 bg-red-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-[#22C7E8] font-bold">
                          {pag.reciboNumero || 'S/N'}
                        </span>
                        <h4 className="font-bold text-white text-base">{contratante?.nome}</h4>
                        {pag.estornado ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/60">
                            ESTORNADO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            CONFIRMADO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDatePtBr(pag.dataRecebimento)}
                        </span>
                        <span>•</span>
                        <span>Método: <strong className="uppercase text-slate-200">{pag.metodoPagamento}</strong></span>
                        <span>•</span>
                        <span>Partidas cobertas: <strong className="text-slate-200">{alocs.length}</strong></span>
                      </div>

                      {pag.observacoes && (
                        <div className="text-xs text-slate-400 italic pt-0.5">
                          Obs: {pag.observacoes}
                        </div>
                      )}

                      {pag.estornado && pag.estornadoMotivo && (
                        <div className="text-xs text-red-300/90 font-medium pt-1">
                          Motivo do estorno: {pag.estornadoMotivo}
                        </div>
                      )}
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Valor Recebido</span>
                      <span
                        className={`text-2xl font-black ${
                          pag.estornado ? 'text-red-400 line-through' : 'text-[#22C7E8]'
                        }`}
                      >
                        {formatCurrency(pag.valorRecebidoCentavos)}
                      </span>
                    </div>
                  </div>

                  {/* Ações: Ver Recibo & Estornar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <div>
                      {recibo && (
                        <button
                          onClick={() => onViewReceipt(recibo)}
                          className="px-3 py-1.5 rounded-lg bg-[#22C7E8]/10 hover:bg-[#22C7E8]/20 text-[#22C7E8] font-bold border border-[#22C7E8]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ver Recibo PDF
                        </button>
                      )}
                    </div>

                    <div>
                      {!pag.estornado && (
                        <button
                          onClick={() => onRequestReversal(pag)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 font-semibold border border-red-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Estornar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ABA 2: CRÉDITOS ANTECIPADOS */}
      {activeTab === 'creditos' && (
        <div className="space-y-3">
          {creditos.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Nenhum crédito antecipado registrado. Quando um pagamento excede o valor das partidas, o saldo restante fica disponível como crédito.
            </div>
          ) : (
            creditos.map(cred => {
              const contratante = contratantes.find(c => c.id === cred.contratanteId);
              const disponivel = cred.valorTotalCentavos - cred.valorUtilizadoCentavos;

              return (
                <div
                  key={cred.id}
                  className="bg-[#111A2E] border border-slate-800 p-5 rounded-2xl shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-white text-base">{contratante?.nome}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{cred.descricao}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Crédito Disponível</span>
                      <span className="text-xl font-black text-emerald-400">
                        {formatCurrency(disponivel)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        (Total original: {formatCurrency(cred.valorTotalCentavos)})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
