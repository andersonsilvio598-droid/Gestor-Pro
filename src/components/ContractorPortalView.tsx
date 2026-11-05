import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, MessageCircle, Shield, Calendar, Clock, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Contratante, Partida } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface ContractorPortalViewProps {
  contratante: Contratante;
  onBack?: () => void;
  isStandalone?: boolean;
}

export const ContractorPortalView: React.FC<ContractorPortalViewProps> = ({
  contratante,
  onBack,
  isStandalone = false
}) => {
  const { showToast } = useToast();
  const [copiedPix, setCopiedPix] = useState(false);

  const config = StorageService.getConfig();
  const summary = BillingService.getContratanteFinancialSummary(contratante.id);
  const partidas = StorageService.getPartidas(false)
    .filter(p => p.contratanteId === contratante.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  const handleCopyPix = () => {
    if (!config.chavePix) {
      showToast('Nenhuma chave Pix configurada', 'warning');
      return;
    }
    navigator.clipboard.writeText(config.chavePix);
    setCopiedPix(true);
    showToast('Chave Pix copiada com sucesso!', 'success');
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleSendProofWhatsApp = () => {
    const phone = config.telefone.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${config.apelido || config.nomeGoleiro}! Segue meu comprovante de pagamento referente aos jogos de goleiro de aluguel.`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className={`min-h-screen bg-[#0B1220] text-slate-100 ${isStandalone ? 'p-4 md:p-8 max-w-4xl mx-auto' : ''}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#22C7E8]/40 shadow-md shadow-[#22C7E8]/10 shrink-0 bg-[#0B1220]">
              <img
                src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
                alt="ProGestor"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight flex items-center gap-1.5">
                ProGestor <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#22C7E8]/15 text-[#22C7E8]">GP</span>
              </h1>
              <span className="text-xs text-slate-400">Portal do Contratante • Extrato & Pagamento</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          Goleiro: <strong className="text-slate-200">{config.apelido || config.nomeGoleiro}</strong>
        </div>
      </div>

      <div className="py-6 space-y-6">
        {/* Banner do Contratante */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase mb-2">
                Extrato Financeiro
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">{contratante.nome}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Tipo: <span className="capitalize text-slate-300">{contratante.tipoRelacao}</span> • Preferência:{' '}
                <span className="uppercase text-slate-300">{contratante.formaPagamentoPadrao}</span>
              </p>
            </div>

            {/* Balanço em destaque */}
            <div className="flex items-center gap-4 bg-[#0B1220] p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 block uppercase font-medium">Saldo em Aberto</span>
                <span
                  className={`text-2xl font-black ${
                    summary.saldoDevedorCentavos > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(summary.saldoDevedorCentavos)}
                </span>
              </div>
              {summary.creditoDisponivelCentavos > 0 && (
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-xs text-slate-400 block uppercase font-medium">Crédito a Favor</span>
                  <span className="text-xl font-bold text-[#22C7E8]">
                    {formatCurrency(summary.creditoDisponivelCentavos)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Mini estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Total de Jogos Contratados:</span>
              <div className="text-base font-bold text-white mt-0.5">{summary.partidasTotalCount}</div>
            </div>
            <div>
              <span className="text-slate-400">Total Faturado no Histórico:</span>
              <div className="text-base font-bold text-white mt-0.5">{formatCurrency(summary.totalGeradoCentavos)}</div>
            </div>
            <div>
              <span className="text-slate-400">Total Já Pago:</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {formatCurrency(summary.totalRecebidoCentavos)}
              </div>
            </div>
          </div>
        </div>

        {/* Card de Pagamento Pix com Copiar Chave */}
        {summary.saldoDevedorCentavos > 0 && (
          <div className="bg-[#0f1d33] border border-[#22C7E8]/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-[#22C7E8]">
              <Shield className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Dados para Pagamento via Pix</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Transfira o valor em aberto de <strong className="text-white">{formatCurrency(summary.saldoDevedorCentavos)}</strong> utilizando a chave Pix abaixo:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 bg-[#0B1220] border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-sm text-[#22C7E8] flex items-center justify-between">
                <span>{config.chavePix || 'Não informada'}</span>
                <span className="text-[10px] text-slate-400 uppercase ml-2 px-1.5 py-0.5 rounded bg-slate-800">
                  {config.chavePixTipo}
                </span>
              </div>
              <button
                onClick={handleCopyPix}
                className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                {copiedPix ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                {copiedPix ? 'Chave Copiada!' : 'Copiar Pix'}
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
              <div className="italic">
                "Após realizar o pagamento, envie o comprovante pelo WhatsApp."
              </div>
              <button
                onClick={handleSendProofWhatsApp}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar Comprovante no WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Lista Individualizada de Partidas */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Histórico Detalhado de Partidas ({partidas.length})
          </h3>

          {partidas.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
              Nenhuma partida registrada até o momento.
            </div>
          ) : (
            <div className="space-y-2">
              {partidas.map(partida => {
                const bal = BillingService.getPartidaBalance(partida.id);
                const isPaid = bal.saldoDevedorCentavos === 0;

                return (
                  <div
                    key={partida.id}
                    className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                            <Calendar className="w-4 h-4 text-[#22C7E8]" />
                            {formatDatePtBr(partida.data)}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {partida.horaInicio} - {partida.horaFim} ({partida.duracaoMinutos} min)
                          </span>
                          {/* Badge Operacional */}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium capitalize">
                            {partida.statusOperacional}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {partida.local || 'Local a combinar'}
                          </span>
                          {partida.ehCortesia && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              CORTESIA
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-400">Valor do Jogo</div>
                          <div className="font-bold text-white text-base">
                            {formatCurrency(partida.valorFinalCentavos)}
                          </div>
                          {partida.descontoCentavos > 0 && (
                            <div className="text-[10px] text-slate-500">
                              (Desc. {formatCurrency(partida.descontoCentavos)})
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400">Situação</div>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg border ${
                              isPaid
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : bal.totalPagoCentavos > 0
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Quitado
                              </>
                            ) : bal.totalPagoCentavos > 0 ? (
                              `Pago Parcial (${formatCurrency(bal.totalPagoCentavos)})`
                            ) : (
                              'Em Aberto'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
