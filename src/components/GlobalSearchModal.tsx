import React, { useState, useMemo } from 'react';
import { X, Search, User, Calendar, DollarSign, FileText, ArrowRight } from 'lucide-react';
import { StorageService } from '../services/storage';
import { formatDatePtBr } from '../utils/date';
import { formatCurrency } from '../utils/currency';

interface GlobalSearchModalProps {
  onClose: () => void;
  onNavigate: (module: string, entityId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  const contratantes = StorageService.getContratantes(true);
  const partidas = StorageService.getPartidas(true);
  const pagamentos = StorageService.getPagamentos();
  const cobrancas = StorageService.getCobrancas();
  const recibos = StorageService.getRecibos();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matchedContratantes = contratantes.filter(
      c => c.nome.toLowerCase().includes(q) || c.whatsapp.includes(q) || (c.observacoes && c.observacoes.toLowerCase().includes(q))
    );

    const matchedPartidas = partidas.filter(p => {
      const c = contratantes.find(item => item.id === p.contratanteId);
      return (
        p.local.toLowerCase().includes(q) ||
        p.data.includes(q) ||
        formatDatePtBr(p.data).includes(q) ||
        (c && c.nome.toLowerCase().includes(q))
      );
    });

    const matchedPagamentos = pagamentos.filter(pag => {
      const c = contratantes.find(item => item.id === pag.contratanteId);
      return (
        (pag.reciboNumero && pag.reciboNumero.toLowerCase().includes(q)) ||
        (c && c.nome.toLowerCase().includes(q)) ||
        pag.dataRecebimento.includes(q)
      );
    });

    const matchedCobrancas = cobrancas.filter(cob => {
      const c = contratantes.find(item => item.id === cob.contratanteId);
      return (
        cob.numeroCobranca.toLowerCase().includes(q) ||
        cob.titulo.toLowerCase().includes(q) ||
        (c && c.nome.toLowerCase().includes(q))
      );
    });

    return {
      contratantes: matchedContratantes,
      partidas: matchedPartidas,
      pagamentos: matchedPagamentos,
      cobrancas: matchedCobrancas
    };
  }, [query, contratantes, partidas, pagamentos, cobrancas]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111A2E] border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-[#0B1220]/80">
          <Search className="w-5 h-5 text-[#22C7E8] shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por contratante, WhatsApp, local, data, recibo..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!results ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Digite ao menos uma letra para buscar em todo o sistema.
            </div>
          ) : results.contratantes.length === 0 &&
            results.partidas.length === 0 &&
            results.pagamentos.length === 0 &&
            results.cobrancas.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <>
              {/* Contratantes */}
              {results.contratantes.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#22C7E8]" /> Contratantes ({results.contratantes.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.contratantes.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onNavigate('contratantes', c.id);
                          onClose();
                        }}
                        className="bg-[#0B1220] hover:bg-[#16223B] p-3 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-white text-xs">{c.nome}</div>
                          <div className="text-[11px] text-slate-400">WhatsApp: {c.whatsapp} • {c.tipoRelacao}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Partidas */}
              {results.partidas.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Partidas ({results.partidas.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.partidas.slice(0, 6).map(p => {
                      const c = contratantes.find(item => item.id === p.contratanteId);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            onNavigate('partidas', p.id);
                            onClose();
                          }}
                          className="bg-[#0B1220] hover:bg-[#16223B] p-3 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-white text-xs">
                              {formatDatePtBr(p.data)} ({p.horaInicio} - {p.horaFim})
                            </div>
                            <div className="text-[11px] text-slate-400">{c?.nome} • {p.local}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-white">{formatCurrency(p.valorFinalCentavos)}</div>
                            <div className="text-[10px] text-slate-400 uppercase">{p.statusFinanceiro}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pagamentos & Recibos */}
              {results.pagamentos.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Pagamentos ({results.pagamentos.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.pagamentos.map(pag => {
                      const c = contratantes.find(item => item.id === pag.contratanteId);
                      return (
                        <div
                          key={pag.id}
                          onClick={() => {
                            onNavigate('pagamentos', pag.id);
                            onClose();
                          }}
                          className="bg-[#0B1220] hover:bg-[#16223B] p-3 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-white text-xs flex items-center gap-2">
                              <span>Recibo {pag.reciboNumero || pag.id}</span>
                              {pag.estornado && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-800">
                                  ESTORNADO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {c?.nome} • {formatDatePtBr(pag.dataRecebimento)} • {pag.metodoPagamento}
                            </div>
                          </div>
                          <div className="text-xs font-black text-[#22C7E8]">
                            {formatCurrency(pag.valorRecebidoCentavos)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
