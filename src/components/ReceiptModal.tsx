import React, { useState } from 'react';
import { X, Download, Share2, MessageCircle, Printer, AlertTriangle, ShieldCheck, Calendar, Clock, MapPin } from 'lucide-react';
import { Recibo } from '../types';
import { PdfReceiptService } from '../services/pdfReceipt';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { StorageService } from '../services/storage';

interface ReceiptModalProps {
  recibo: Recibo | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ recibo, onClose }) => {
  const { showToast } = useToast();
  const [sharing, setSharing] = useState(false);

  if (!recibo) return null;

  const pagamento = StorageService.getPagamentos().find(p => p.id === recibo.pagamentoId);
  const contratante = StorageService.getContratanteById(recibo.contratanteId);
  const isEstornado = pagamento?.estornado || false;

  const handleDownload = () => {
    try {
      PdfReceiptService.downloadPdf(recibo);
      showToast('PDF do recibo baixado com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao gerar PDF', 'error');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await PdfReceiptService.shareOrDownload(recibo);
      if (res === 'shared') {
        showToast('Recibo compartilhado com sucesso!', 'success');
      } else {
        showToast('PDF baixado (compartilhamento não suportado neste navegador)', 'info');
      }
    } catch (err) {
      showToast('Erro ao compartilhar', 'error');
    } finally {
      setSharing(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const url = PdfReceiptService.getWhatsAppShareUrl(recibo, contratante?.whatsapp);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111A2E] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-[#22C7E8]/40 shadow-sm shrink-0 bg-[#0B1220]">
              <img
                src="/assets/aistudio/file_000000008db8820eb8b59ca6e312eb37_7088c206.png"
                alt="ProGestor"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Recibo ProGestor
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-[#22C7E8] border border-slate-700">
                  {recibo.numeroRecibo}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Comprovante oficial de quitação • Goleiro Pro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de Estorno se aplicável */}
        {isEstornado && (
          <div className="bg-red-950/60 border-b border-red-800/60 px-5 py-3 flex items-center gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <div>
              <strong className="font-semibold text-white">Transação Estornada:</strong> Este recibo é referente a um
              pagamento que foi cancelado/estornado. Os valores não têm mais validade ativa.
              {pagamento?.estornadoMotivo && (
                <span className="block text-xs mt-0.5 text-red-300/80">Motivo: {pagamento.estornadoMotivo}</span>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Visual do Recibo */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {/* Cartão de Resumo */}
          <div className="bg-[#0B1220] border border-slate-800 rounded-xl p-4 md:p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Contratante</span>
                <h4 className="text-lg font-bold text-white">{recibo.contratanteNome}</h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>Data: <strong className="text-slate-300">{formatDatePtBr(recibo.dataRecebimento)}</strong></span>
                  <span>•</span>
                  <span>Método: <strong className="text-slate-300 uppercase">{recibo.metodoPagamento}</strong></span>
                </div>
              </div>
              <div className="sm:text-right">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Recebido</span>
                <div className="text-2xl font-black text-[#22C7E8]">
                  {formatCurrency(recibo.valorTotalCentavos)}
                </div>
                <div className="text-xs text-slate-400 italic">
                  ({recibo.valorPorExtenso})
                </div>
              </div>
            </div>

            {/* Saldo pendente */}
            <div className="mt-3 flex justify-between items-center text-xs text-slate-400">
              <span>Saldo pendente do contratante após este pagamento:</span>
              <span className={`font-semibold ${recibo.saldoPendenteContratanteCentavos > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {recibo.saldoPendenteContratanteCentavos > 0
                  ? formatCurrency(recibo.saldoPendenteContratanteCentavos)
                  : 'Totalmente Quitado (R$ 0,00)'}
              </span>
            </div>
          </div>

          {/* Relação de Partidas Cobertas */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Partidas Vinculadas a este Pagamento ({recibo.partidas.length})
            </h5>
            <div className="space-y-2">
              {recibo.partidas.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#16223B] border border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#22C7E8]" />
                        {formatDatePtBr(item.data)}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {item.horaInicio} - {item.horaFim}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {item.local || 'Local não informado'}
                      </span>
                      {item.ehAntecipado && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#22C7E8]/10 text-[#22C7E8] border border-[#22C7E8]/30">
                          PAGO ANTECIPADO
                        </span>
                      )}
                      {item.ehCortesia && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          CORTESIA
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right sm:self-center">
                    <span className="text-xs text-slate-400 block sm:hidden">Valor Aplicado:</span>
                    <span className="font-bold text-white text-base">
                      {formatCurrency(item.valorPagoCentavos)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0B1220]/50 p-3 rounded-lg border border-slate-800">
            * Este recibo é gerado a partir do registro financeiro persistido. As partidas futuras listadas como pagas antecipadamente não gerarão cobranças adicionais quando forem realizadas.
          </p>
        </div>

        {/* Ações do Rodapé (Download, Share, WhatsApp, Print) */}
        <div className="p-4 border-t border-slate-800 bg-[#0B1220] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar PDF
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs md:text-sm flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs md:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
