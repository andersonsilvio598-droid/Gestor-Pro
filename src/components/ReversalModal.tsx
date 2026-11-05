import React, { useState } from 'react';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';
import { Pagamento } from '../types';
import { BillingService } from '../services/billing';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { useToast } from '../context/ToastContext';

interface ReversalModalProps {
  pagamento: Pagamento | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReversalModal: React.FC<ReversalModalProps> = ({
  pagamento,
  onClose,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [motivo, setMotivo] = useState('');

  if (!pagamento) return null;

  const contratante = StorageService.getContratanteById(pagamento.contratanteId);

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      showToast('Por favor, informe o motivo do estorno', 'error');
      return;
    }

    const sucesso = BillingService.reversePayment(pagamento.id, motivo.trim());
    if (sucesso) {
      showToast(`Pagamento #${pagamento.reciboNumero || pagamento.id} estornado com sucesso.`, 'success');
      onSuccess();
      onClose();
    } else {
      showToast('Não foi possível estornar este pagamento', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111A2E] border border-red-800/60 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-950/80 bg-red-950/30">
          <div className="flex items-center gap-2.5 text-red-400">
            <RotateCcw className="w-5 h-5" />
            <h3 className="text-base font-bold text-white">Estornar Pagamento</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmReversal} className="p-5 space-y-4 text-sm">
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3.5 flex items-start gap-3 text-red-200 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white font-bold mb-0.5">Aviso de Operação Financeira Auditável</strong>
              O estorno não apagará o registro histórico. O pagamento será marcado como estornado, as quitações serão canceladas e o saldo em aberto das partidas será restabelecido.
            </div>
          </div>

          <div className="bg-[#0B1220] p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Contratante:</span>
              <strong className="text-white">{contratante?.nome || 'Desconhecido'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Recibo:</span>
              <span className="font-mono text-[#22C7E8]">{pagamento.reciboNumero || pagamento.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Data Original:</span>
              <span className="text-slate-300">{formatDatePtBr(pagamento.dataRecebimento)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-sm">
              <span className="text-slate-300">Valor Estornado:</span>
              <span className="text-red-400">{formatCurrency(pagamento.valorRecebidoCentavos)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Motivo do Estorno *
            </label>
            <textarea
              required
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Pagamento duplicado por engano, devolução autorizada via Pix..."
              className="w-full bg-[#0B1220] border border-slate-700 focus:border-red-500 rounded-xl px-3.5 py-2 text-white outline-none resize-none text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Confirmar Estorno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
