import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Calendar,
  Clock,
  MapPin,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { JogoFixo } from '../types';
import { StorageService } from '../services/storage';
import { BillingService } from '../services/billing';
import { formatCurrency, formatCurrencyRaw, parseCurrencyToCents } from '../utils/currency';
import { DIAS_SEMANA_COMPLETO, getTodayDateString } from '../utils/date';
import { useToast } from '../context/ToastContext';

export const FixedGamesView: React.FC = () => {
  const { showToast } = useToast();
  const jogosFixos = StorageService.getJogosFixos(true);
  const contratantes = StorageService.getContratantes(false);
  const locais = StorageService.getLocais(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJogo, setEditingJogo] = useState<JogoFixo | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [contratanteId, setContratanteId] = useState('');
  const [diaSemana, setDiaSemana] = useState(2); // Terça padrão
  const [horaInicio, setHoraInicio] = useState('19:00');
  const [horaFim, setHoraFim] = useState('20:00');
  const [local, setLocal] = useState(locais[0]?.nome || 'Corinthians');
  const [valorInput, setValorInput] = useState('35,00');
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');

  // Gerador em Lote State
  const [diasGeracao, setDiasGeracao] = useState(30);
  const [gerando, setGerando] = useState(false);

  const handleOpenCreate = () => {
    setEditingJogo(null);
    setNome('');
    setContratanteId(contratantes[0]?.id || '');
    setDiaSemana(2);
    setHoraInicio('19:00');
    setHoraFim('20:00');
    setLocal(locais[0]?.nome || 'Corinthians');
    setValorInput('35,00');
    setAtivo(true);
    setObservacoes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (jogo: JogoFixo) => {
    setEditingJogo(jogo);
    setNome(jogo.nome);
    setContratanteId(jogo.contratanteId);
    setDiaSemana(jogo.diaSemana);
    setHoraInicio(jogo.horaInicio);
    setHoraFim(jogo.horaFim);
    setLocal(jogo.local);
    setValorInput((jogo.valorCentavos / 100).toFixed(2).replace('.', ','));
    setAtivo(jogo.ativo);
    setObservacoes(jogo.observacoes);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratanteId) {
      showToast('Selecione um contratante', 'error');
      return;
    }

    const valorCentavos = parseCurrencyToCents(valorInput);
    const novoJogo: JogoFixo = {
      id: editingJogo?.id || `jf-${Date.now()}`,
      nome: nome.trim() || `Jogo Fixo (${DIAS_SEMANA_COMPLETO[diaSemana]})`,
      contratanteId,
      diaSemana: Number(diaSemana),
      horaInicio,
      horaFim,
      local,
      valorCentavos,
      ativo,
      observacoes,
      createdAt: editingJogo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    StorageService.saveJogoFixo(novoJogo);
    showToast(
      editingJogo
        ? 'Modelo de jogo fixo atualizado (partidas antigas preservam preços históricos).'
        : 'Modelo de jogo fixo criado com sucesso!',
      'success'
    );
    setModalOpen(false);
  };

  const handleGenerateOccurrences = () => {
    setGerando(true);
    const today = new Date();
    const startDateStr = getTodayDateString();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + diasGeracao);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const res = BillingService.generateFixedGameOccurrences(startDateStr, endDateStr);
    setGerando(false);

    if (res.geradas > 0) {
      showToast(
        `Sucesso: ${res.geradas} partidas geradas para os próximos ${diasGeracao} dias (${res.duplicatasIgnoradas} duplicatas ignoradas).`,
        'success'
      );
    } else {
      showToast(
        `Nenhuma nova partida gerada: todas as ocorrências deste período já existem (${res.duplicatasIgnoradas} verificadas). Idempotência garantida!`,
        'info'
      );
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-16">
      {/* Top Banner & Gerador em Lote */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#22C7E8] uppercase tracking-wider block mb-1">
            Recorrência & Idempotência
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white">Modelos de Jogos Fixos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Defina modelos semanais recorrentes e gere as partidas em lote com proteção anti-duplicação.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Modelo Fixo
          </button>
        </div>
      </div>

      {/* Caixa de Geração Idempotente de Ocorrências */}
      <div className="bg-[#0f1d33] border border-[#22C7E8]/30 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#22C7E8] font-bold text-sm">
            <Repeat className="w-4 h-4" />
            Geração Automática de Ocorrências (Garantia de Idempotência)
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Gera as partidas na agenda para os próximos dias com base nos modelos ativos. Executar repetidamente é 100% seguro e <strong>nunca gera ocorrências duplicadas</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={diasGeracao}
            onChange={e => setDiasGeracao(Number(e.target.value))}
            className="bg-[#0B1220] border border-slate-700 text-xs rounded-xl px-3 py-2 text-white outline-none"
          >
            <option value={15}>Próximos 15 dias</option>
            <option value={30}>Próximos 30 dias</option>
            <option value={60}>Próximos 60 dias</option>
          </select>

          <button
            onClick={handleGenerateOccurrences}
            disabled={gerando}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {gerando ? 'Gerando...' : 'Gerar Ocorrências'}
          </button>
        </div>
      </div>

      {/* Lista de Jogos Fixos */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Modelos Configurados ({jogosFixos.length})
        </h3>

        {jogosFixos.length === 0 ? (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
            Nenhum modelo de jogo fixo cadastrado. Crie um modelo para agilizar a criação de partidas recorrentes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jogosFixos.map(jogo => {
              const contratante = contratantes.find(c => c.id === jogo.contratanteId);

              return (
                <div
                  key={jogo.id}
                  className="bg-[#111A2E] border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition-colors space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">{jogo.nome}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            jogo.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {jogo.ativo ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Contratante: <strong className="text-slate-200">{contratante?.nome}</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenEdit(jogo)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      title="Editar Modelo"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 bg-[#0B1220] p-3 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#22C7E8]" />
                      <span>{DIAS_SEMANA_COMPLETO[jogo.diaSemana]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {jogo.horaInicio} às {jogo.horaFim}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{jogo.local || 'Local a definir'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Preço atual do modelo:</span>
                    <strong className="text-base font-black text-[#22C7E8]">
                      {formatCurrency(jogo.valorCentavos)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Criar / Editar Modelo */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111A2E] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B1220]/60">
              <h3 className="text-base font-bold text-white">
                {editingJogo ? 'Editar Jogo Fixo' : 'Novo Jogo Fixo'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Jogo *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Pelada de Terça na Arena"
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Contratante Responsável *
                </label>
                <select
                  required
                  value={contratanteId}
                  onChange={e => setContratanteId(e.target.value)}
                  className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                >
                  {contratantes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipoRelacao})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Dia da Semana *
                  </label>
                  <select
                    value={diaSemana}
                    onChange={e => setDiaSemana(Number(e.target.value))}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {DIAS_SEMANA_COMPLETO.map((dia, idx) => (
                      <option key={idx} value={idx}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Início *
                  </label>
                  <input
                    type="time"
                    required
                    value={horaInicio}
                    onChange={e => setHoraInicio(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Fim *
                  </label>
                  <input
                    type="time"
                    required
                    value={horaFim}
                    onChange={e => setHoraFim(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Local *
                  </label>
                  <select
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white outline-none"
                  >
                    {locais.map(loc => (
                      <option key={loc.id} value={loc.nome}>
                        {loc.nome}
                      </option>
                    ))}
                    {!locais.some(l => l.nome === local) && local && (
                      <option value={local}>{local}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Valor da Partida (R$) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={valorInput}
                    onChange={e => setValorInput(e.target.value)}
                    onBlur={() => {
                      const cents = parseCurrencyToCents(valorInput);
                      setValorInput(formatCurrencyRaw(cents));
                    }}
                    placeholder="Ex: 35,00"
                    className="w-full bg-[#0B1220] border border-slate-700 focus:border-[#22C7E8] rounded-xl px-3.5 py-2 text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={e => setAtivo(e.target.checked)}
                    className="w-4 h-4 rounded text-[#22C7E8] bg-[#0B1220] border-slate-700"
                  />
                  Modelo ativo para geração de partidas
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#22C7E8] hover:bg-[#1fb5d3] text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Salvar Modelo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
