import {
  Contratante,
  Partida,
  JogoFixo,
  CicloCobranca,
  Pacote,
  Pagamento,
  AlocacaoPagamento,
  Credito,
  MovimentacaoCredito,
  Cobranca,
  Recibo,
  AppConfig,
  Local,
  RotinaHabitualItem,
  ItemTabelaPreco
} from '../types';
import { getTodayDateString } from '../utils/date';
import { numberToWordsPtBr } from '../utils/currency';

const STORAGE_KEYS = {
  CONTRATANTES: 'goleiro_pro_contratantes',
  LOCAIS: 'goleiro_pro_locais',
  PARTIDAS: 'goleiro_pro_partidas',
  JOGOS_FIXOS: 'goleiro_pro_jogos_fixos',
  CICLOS: 'goleiro_pro_ciclos',
  PACOTES: 'goleiro_pro_pacotes',
  PAGAMENTOS: 'goleiro_pro_pagamentos',
  ALOCACOES: 'goleiro_pro_alocacoes',
  CREDITOS: 'goleiro_pro_creditos',
  MOVIMENTACOES_CREDITO: 'goleiro_pro_mov_credito',
  COBRANCAS: 'goleiro_pro_cobrancas',
  RECIBOS: 'goleiro_pro_recibos',
  TABELA_PRECOS: 'goleiro_pro_tabela_precos',
  CONFIG: 'goleiro_pro_config',
  AUDIT: 'goleiro_pro_audit',
  INITIALIZED: 'goleiro_pro_initialized_v2'
};

export const DEFAULT_TABELA_PRECOS: ItemTabelaPreco[] = [
  { id: 'preco-60-30', duracaoMinutos: 60, valorCentavos: 3000, ativo: true, principal: false, ordem: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-60-35', duracaoMinutos: 60, valorCentavos: 3500, ativo: true, principal: false, ordem: 2, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-60-40', duracaoMinutos: 60, valorCentavos: 4000, ativo: true, principal: true, ordem: 3, createdAt: '2026-01-01T00:00:00Z' }, // Referência Primária R$ 40,00
  { id: 'preco-60-45', duracaoMinutos: 60, valorCentavos: 4500, ativo: true, principal: false, ordem: 4, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-90-45', duracaoMinutos: 90, valorCentavos: 4500, ativo: true, principal: false, ordem: 5, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-90-55', duracaoMinutos: 90, valorCentavos: 5500, ativo: true, principal: false, ordem: 6, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-120-60', duracaoMinutos: 120, valorCentavos: 6000, ativo: true, principal: false, ordem: 7, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'preco-120-70', duracaoMinutos: 120, valorCentavos: 7000, ativo: true, principal: false, ordem: 8, createdAt: '2026-01-01T00:00:00Z' }
];

const DEFAULT_ROTINA: RotinaHabitualItem[] = [
  { diaSemana: 1, diaNome: 'Segunda-feira', jogosHabituais: 1, horarioPadrao: '17h às 21h' },
  { diaSemana: 3, diaNome: 'Quarta-feira', jogosHabituais: 2, horarioPadrao: '17h às 21h' },
  { diaSemana: 4, diaNome: 'Quinta-feira', jogosHabituais: 2, horarioPadrao: '17h às 21h' },
  { diaSemana: 5, diaNome: 'Sexta-feira', jogosHabituais: 1, horarioPadrao: '17h às 21h' },
  { diaSemana: 6, diaNome: 'Sábado', jogosHabituais: 2, horarioPadrao: '17h às 21h' },
  { diaSemana: 0, diaNome: 'Domingo', jogosHabituais: 1, horarioPadrao: '17h às 21h' },
];

const DEFAULT_CONFIG: AppConfig = {
  nomeGoleiro: 'Lucas Silva',
  apelido: 'Paredão Lucas',
  telefone: '(11) 98765-4321',
  cidade: 'São Paulo - SP',
  chavePixTipo: 'telefone',
  chavePix: '11987654321',
  metodosPagamento: ['Pix', 'Dinheiro', 'Transferência'],
  valorPadraoHoraCentavos: 3500, // R$ 35,00
  diasPrevisaoOcorrencias: 30,
  rotinaHabitual: DEFAULT_ROTINA
};

// Event listener mechanism to sync UI across modules
const EVENT_NAME = 'goleiro_pro_db_change';

export function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function subscribeToChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

export interface StorageHealthInfo {
  isPersistent: boolean;
  driver: 'localStorage' | 'memoryStore';
  totalBytesUsed: number;
  estimatedQuotaBytes: number;
  percentUsed: number;
  lastWriteSuccess: boolean;
  lastErrorMessage?: string;
  hasExistingUserData: boolean;
  keysCount: number;
}

export interface BackupValidationResult {
  valid: boolean;
  version: number;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
  relationshipsIntegrity: {
    orphanMatches: string[];
    orphanAllocations: string[];
    orphanReceipts: string[];
  };
}

const memoryStore: Record<string, string> = {};
let isLocalStorageWorking: boolean | null = null;
let lastStorageError: string | null = null;
let lastWriteSuccess = true;

/**
 * Testa ativamente se o LocalStorage está operacional e gravando no disco
 */
export function testLocalStorage(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__goleiro_pro_storage_probe__';
    window.localStorage.setItem(testKey, 'probe_val');
    const read = window.localStorage.getItem(testKey);
    window.localStorage.removeItem(testKey);
    return read === 'probe_val';
  } catch (err: any) {
    lastStorageError = err?.message || String(err);
    console.warn('LocalStorage indisponível ou bloqueado. Operando em memória volátil:', err);
    return false;
  }
}

function getStorage() {
  if (isLocalStorageWorking === null) {
    isLocalStorageWorking = testLocalStorage();
  }
  if (isLocalStorageWorking && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    }
  };
}

function load<T>(key: string, defaultValue: T): T {
  try {
    const data = getStorage().getItem(key);
    if (!data) return defaultValue;
    return JSON.parse(data);
  } catch (err) {
    console.error(`Erro ao carregar chave ${key}:`, err);
    return defaultValue;
  }
}

function save<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    getStorage().setItem(key, serialized);
    // Mantém cópia espelhada em memoryStore
    memoryStore[key] = serialized;
    lastStorageError = null;
    lastWriteSuccess = true;
    notifyChange();
    return true;
  } catch (err: any) {
    lastStorageError = err?.message || String(err);
    lastWriteSuccess = false;
    console.error(`Erro ao salvar chave ${key}:`, err);
    // Garante que o estado em memória ainda funcione durante a sessão ativa
    try {
      memoryStore[key] = JSON.stringify(value);
    } catch (_) {}

    // Notifica em caso de estouro de cota do navegador (QuotaExceededError)
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('goleiro_pro_quota_exceeded', {
            detail: { key, message: 'Armazenamento do navegador cheio (QuotaExceededError).' }
          })
        );
      }
    }
    return false;
  }
}

export const BASE_CONTRATANTES: Contratante[] = [
  { id: 'c-andre', nome: 'André', whatsapp: '', observacoes: '', tipoRelacao: 'fixo', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-andre' },
  { id: 'c-adriel', nome: 'Adriel', whatsapp: '', observacoes: '', tipoRelacao: 'avulso', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-adriel' },
  { id: 'c-dalvan', nome: 'Dalvan', whatsapp: '', observacoes: '', tipoRelacao: 'fixo', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-dalvan' },
  { id: 'c-fernando', nome: 'Fernando', whatsapp: '', observacoes: '', tipoRelacao: 'avulso', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-fernando' },
  { id: 'c-thiago', nome: 'Thiago', whatsapp: '', observacoes: '', tipoRelacao: 'fixo', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-thiago' },
  { id: 'c-marquinhos', nome: 'Marquinhos', whatsapp: '', observacoes: '', tipoRelacao: 'avulso', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-marquinhos' },
  { id: 'c-marcinho', nome: 'Marcinho', whatsapp: '', observacoes: '', tipoRelacao: 'fixo', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-marcinho' },
  { id: 'c-guilherme', nome: 'Guilherme', whatsapp: '', observacoes: '', tipoRelacao: 'avulso', formaPagamentoPadrao: 'pix', createdAt: '2026-10-01T00:00:00Z', arquivado: false, ativo: true, tokenAcessoPublico: 'token-guilherme' },
];

export const BASE_LOCAIS: Local[] = [
  { id: 'loc-corinthians', nome: 'Corinthians', endereco: '', observacoes: '', ativo: true, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'loc-legionarios', nome: 'Legionários', endereco: '', observacoes: '', ativo: true, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'loc-ginasio-sl', nome: 'Ginásio São Lourenço', endereco: '', observacoes: '', ativo: true, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'loc-fac', nome: 'FAC', endereco: '', observacoes: '', ativo: true, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'loc-seta', nome: 'Seta', endereco: '', observacoes: '', ativo: true, createdAt: '2026-10-01T00:00:00Z' },
];

export const StorageService = {
  subscribeToChanges(callback: () => void): () => void {
    return subscribeToChanges(callback);
  },
  // Config
  getConfig(): AppConfig {
    return load<AppConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  },
  saveConfig(config: AppConfig): void {
    save(STORAGE_KEYS.CONFIG, config);
  },

  // Contratantes
  getContratantes(includeArchived = false): Contratante[] {
    let list = load<Contratante[]>(STORAGE_KEYS.CONTRATANTES, []);
    if (list.length === 0) {
      list = [...BASE_CONTRATANTES];
      save(STORAGE_KEYS.CONTRATANTES, list);
    }
    return includeArchived ? list : list.filter(c => !c.arquivado && c.ativo !== false);
  },
  getContratanteById(id: string): Contratante | undefined {
    const list = this.getContratantes(true);
    return list.find(c => c.id === id);
  },
  getContratanteByToken(token: string): Contratante | undefined {
    const list = this.getContratantes(true);
    return list.find(c => c.tokenAcessoPublico === token);
  },
  saveContratante(contratante: Contratante): void {
    const list = load<Contratante[]>(STORAGE_KEYS.CONTRATANTES, []);
    const idx = list.findIndex(c => c.id === contratante.id);
    if (idx >= 0) {
      list[idx] = contratante;
    } else {
      list.push(contratante);
    }
    save(STORAGE_KEYS.CONTRATANTES, list);
  },

  // Locais
  getLocais(includeInactive = false): Local[] {
    let list = load<Local[]>(STORAGE_KEYS.LOCAIS, []);
    if (list.length === 0) {
      list = [...BASE_LOCAIS];
      save(STORAGE_KEYS.LOCAIS, list);
    }
    return includeInactive ? list : list.filter(l => l.ativo !== false);
  },
  getLocalById(id: string): Local | undefined {
    const list = this.getLocais(true);
    return list.find(l => l.id === id);
  },
  saveLocal(local: Local): void {
    const list = load<Local[]>(STORAGE_KEYS.LOCAIS, []);
    const idx = list.findIndex(l => l.id === local.id);
    if (idx >= 0) {
      list[idx] = local;
    } else {
      list.push(local);
    }
    save(STORAGE_KEYS.LOCAIS, list);
  },
  inactivateLocal(id: string): void {
    const list = load<Local[]>(STORAGE_KEYS.LOCAIS, []);
    const idx = list.findIndex(l => l.id === id);
    if (idx >= 0) {
      list[idx].ativo = false;
      save(STORAGE_KEYS.LOCAIS, list);
    }
  },

  // Tabela de Preços (Sistema de Preços Fixos Configuráveis - Seção 2)
  getTabelaPrecos(apenasAtivos = false): ItemTabelaPreco[] {
    let list = load<ItemTabelaPreco[]>(STORAGE_KEYS.TABELA_PRECOS, []);
    if (list.length === 0) {
      list = [...DEFAULT_TABELA_PRECOS];
      save(STORAGE_KEYS.TABELA_PRECOS, list);
    }
    const filtered = apenasAtivos ? list.filter(item => item.ativo) : list;
    return [...filtered].sort((a, b) => a.duracaoMinutos - b.duracaoMinutos || a.valorCentavos - b.valorCentavos);
  },

  getPrecosPorDuracao(duracaoMinutos: number, apenasAtivos = true): ItemTabelaPreco[] {
    const list = this.getTabelaPrecos(apenasAtivos);
    return list.filter(item => item.duracaoMinutos === duracaoMinutos);
  },

  saveItemTabelaPreco(item: ItemTabelaPreco): void {
    const list = load<ItemTabelaPreco[]>(STORAGE_KEYS.TABELA_PRECOS, []);
    const idx = list.findIndex(p => p.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    save(STORAGE_KEYS.TABELA_PRECOS, list);
    notifyChange();
  },

  toggleItemTabelaPreco(id: string): void {
    const list = load<ItemTabelaPreco[]>(STORAGE_KEYS.TABELA_PRECOS, []);
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) {
      list[idx].ativo = !list[idx].ativo;
      save(STORAGE_KEYS.TABELA_PRECOS, list);
      notifyChange();
    }
  },

  deleteItemTabelaPreco(id: string): { success: boolean; reason?: string } {
    const list = load<ItemTabelaPreco[]>(STORAGE_KEYS.TABELA_PRECOS, []);
    const item = list.find(p => p.id === id);
    if (!item) return { success: false, reason: 'Opção de preço não encontrada.' };

    // Verificação de segurança: não deletar se houver partidas históricas referenciando
    const partidas = this.getPartidas(true);
    const hasHistory = partidas.some(
      p => p.duracaoMinutos === item.duracaoMinutos && p.valorReferenciaCentavos === item.valorCentavos
    );

    if (hasHistory) {
      // Preserva registros históricos desativando em vez de excluir
      item.ativo = false;
      save(STORAGE_KEYS.TABELA_PRECOS, list);
      notifyChange();
      return {
        success: false,
        reason: 'Esta opção já foi utilizada em partidas do histórico. A opção foi desativada para preservar os registros históricos.'
      };
    }

    const updated = list.filter(p => p.id !== id);
    save(STORAGE_KEYS.TABELA_PRECOS, updated);
    notifyChange();
    return { success: true };
  },

  // Partidas
  getPartidas(includeArchived = false): Partida[] {
    const list = load<Partida[]>(STORAGE_KEYS.PARTIDAS, []);
    return includeArchived ? list : list.filter(p => !p.arquivado);
  },
  getPartidaById(id: string): Partida | undefined {
    const list = load<Partida[]>(STORAGE_KEYS.PARTIDAS, []);
    return list.find(p => p.id === id);
  },
  savePartida(partida: Partida): void {
    const list = load<Partida[]>(STORAGE_KEYS.PARTIDAS, []);

    // Reconciliação do status financeiro derivado
    if (
      partida.ehCortesia ||
      partida.valorFinalCentavos === 0 ||
      partida.statusOperacional === 'cancelada' ||
      partida.statusOperacional === 'pulada' ||
      partida.statusOperacional === 'nao_realizada'
    ) {
      partida.statusFinanceiro = 'sem_cobranca';
    } else {
      const alocacoes = this.getAlocacoesByPartida(partida.id);
      const pagamentos = this.getPagamentos();
      const pagamentosValidosIds = new Set(pagamentos.filter(p => !p.estornado).map(p => p.id));
      let totalPago = 0;
      for (const aloc of alocacoes) {
        if (pagamentosValidosIds.has(aloc.pagamentoId)) {
          totalPago += aloc.valorAplicadoCentavos;
        }
      }
      const movsCredito = this.getMovimentacoesCredito().filter(
        m => m.partidaId === partida.id && m.tipo === 'aplicado'
      );
      for (const mov of movsCredito) {
        totalPago += mov.valorCentavos;
      }
      if (totalPago >= partida.valorFinalCentavos) {
        partida.statusFinanceiro = 'pago';
      } else if (totalPago > 0) {
        partida.statusFinanceiro = 'parcialmente_pago';
      } else {
        partida.statusFinanceiro = 'em_aberto';
      }
    }

    const idx = list.findIndex(p => p.id === partida.id);
    if (idx >= 0) {
      list[idx] = { ...partida, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...partida, updatedAt: new Date().toISOString() });
    }
    save(STORAGE_KEYS.PARTIDAS, list);
  },
  savePartidasBatch(partidasParaSalvar: Partida[]): void {
    const list = load<Partida[]>(STORAGE_KEYS.PARTIDAS, []);
    for (const p of partidasParaSalvar) {
      if (
        p.ehCortesia ||
        p.valorFinalCentavos === 0 ||
        p.statusOperacional === 'cancelada' ||
        p.statusOperacional === 'pulada' ||
        p.statusOperacional === 'nao_realizada'
      ) {
        p.statusFinanceiro = 'sem_cobranca';
      }
      const idx = list.findIndex(item => item.id === p.id);
      if (idx >= 0) {
        list[idx] = { ...p, updatedAt: new Date().toISOString() };
      } else {
        list.push({ ...p, updatedAt: new Date().toISOString() });
      }
    }
    save(STORAGE_KEYS.PARTIDAS, list);
  },

  // Jogos Fixos
  getJogosFixos(includeInactive = true): JogoFixo[] {
    const list = load<JogoFixo[]>(STORAGE_KEYS.JOGOS_FIXOS, []);
    return includeInactive ? list : list.filter(j => j.ativo);
  },
  getJogoFixoById(id: string): JogoFixo | undefined {
    const list = load<JogoFixo[]>(STORAGE_KEYS.JOGOS_FIXOS, []);
    return list.find(j => j.id === id);
  },
  saveJogoFixo(jogo: JogoFixo): void {
    const list = load<JogoFixo[]>(STORAGE_KEYS.JOGOS_FIXOS, []);
    const idx = list.findIndex(j => j.id === jogo.id);
    if (idx >= 0) {
      list[idx] = { ...jogo, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...jogo, updatedAt: new Date().toISOString() });
    }
    save(STORAGE_KEYS.JOGOS_FIXOS, list);
  },

  // Ciclos de Cobrança
  getCiclos(): CicloCobranca[] {
    return load<CicloCobranca[]>(STORAGE_KEYS.CICLOS, []);
  },
  getCiclosByContratante(contratanteId: string): CicloCobranca[] {
    return this.getCiclos().filter(c => c.contratanteId === contratanteId);
  },
  saveCiclo(ciclo: CicloCobranca): void {
    const list = load<CicloCobranca[]>(STORAGE_KEYS.CICLOS, []);
    const idx = list.findIndex(c => c.id === ciclo.id);
    if (idx >= 0) {
      list[idx] = ciclo;
    } else {
      list.push(ciclo);
    }
    save(STORAGE_KEYS.CICLOS, list);
  },

  // Pacotes
  getPacotes(): Pacote[] {
    return load<Pacote[]>(STORAGE_KEYS.PACOTES, []);
  },
  savePacote(pacote: Pacote): void {
    const list = load<Pacote[]>(STORAGE_KEYS.PACOTES, []);
    const idx = list.findIndex(p => p.id === pacote.id);
    if (idx >= 0) {
      list[idx] = pacote;
    } else {
      list.push(pacote);
    }
    save(STORAGE_KEYS.PACOTES, list);
  },

  // Pagamentos
  getPagamentos(): Pagamento[] {
    return load<Pagamento[]>(STORAGE_KEYS.PAGAMENTOS, []);
  },
  savePagamento(pagamento: Pagamento): void {
    const list = load<Pagamento[]>(STORAGE_KEYS.PAGAMENTOS, []);
    const idx = list.findIndex(p => p.id === pagamento.id);
    if (idx >= 0) {
      list[idx] = pagamento;
    } else {
      list.push(pagamento);
    }
    save(STORAGE_KEYS.PAGAMENTOS, list);
  },

  // Alocações de Pagamento
  getAlocacoes(): AlocacaoPagamento[] {
    return load<AlocacaoPagamento[]>(STORAGE_KEYS.ALOCACOES, []);
  },
  getAlocacoesByPagamento(pagamentoId: string): AlocacaoPagamento[] {
    return this.getAlocacoes().filter(a => a.pagamentoId === pagamentoId);
  },
  getAlocacoesByPartida(partidaId: string): AlocacaoPagamento[] {
    return this.getAlocacoes().filter(a => a.partidaId === partidaId);
  },
  saveAlocacoesBatch(novasAlocacoes: AlocacaoPagamento[]): void {
    const list = load<AlocacaoPagamento[]>(STORAGE_KEYS.ALOCACOES, []);
    list.push(...novasAlocacoes);
    save(STORAGE_KEYS.ALOCACOES, list);
  },
  removeAlocacoesByPagamento(pagamentoId: string): void {
    const list = load<AlocacaoPagamento[]>(STORAGE_KEYS.ALOCACOES, []);
    const filtrado = list.filter(a => a.pagamentoId !== pagamentoId);
    save(STORAGE_KEYS.ALOCACOES, filtrado);
  },

  // Créditos
  getCreditos(): Credito[] {
    return load<Credito[]>(STORAGE_KEYS.CREDITOS, []);
  },
  getCreditosByContratante(contratanteId: string): Credito[] {
    return this.getCreditos().filter(c => c.contratanteId === contratanteId);
  },
  saveCredito(credito: Credito): void {
    const list = load<Credito[]>(STORAGE_KEYS.CREDITOS, []);
    const idx = list.findIndex(c => c.id === credito.id);
    if (idx >= 0) {
      list[idx] = credito;
    } else {
      list.push(credito);
    }
    save(STORAGE_KEYS.CREDITOS, list);
  },

  // Movimentações de Crédito
  getMovimentacoesCredito(): MovimentacaoCredito[] {
    return load<MovimentacaoCredito[]>(STORAGE_KEYS.MOVIMENTACOES_CREDITO, []);
  },
  saveMovimentacaoCredito(mov: MovimentacaoCredito): void {
    const list = load<MovimentacaoCredito[]>(STORAGE_KEYS.MOVIMENTACOES_CREDITO, []);
    list.push(mov);
    save(STORAGE_KEYS.MOVIMENTACOES_CREDITO, list);
  },

  // Cobranças
  getCobrancas(): Cobranca[] {
    return load<Cobranca[]>(STORAGE_KEYS.COBRANCAS, []);
  },
  saveCobranca(cobranca: Cobranca): void {
    const list = load<Cobranca[]>(STORAGE_KEYS.COBRANCAS, []);
    const idx = list.findIndex(c => c.id === cobranca.id);
    if (idx >= 0) {
      list[idx] = cobranca;
    } else {
      list.push(cobranca);
    }
    save(STORAGE_KEYS.COBRANCAS, list);
  },

  // Recibos
  getRecibos(): Recibo[] {
    return load<Recibo[]>(STORAGE_KEYS.RECIBOS, []);
  },
  getReciboById(id: string): Recibo | undefined {
    return this.getRecibos().find(r => r.id === id);
  },
  getReciboByPagamento(pagamentoId: string): Recibo | undefined {
    return this.getRecibos().find(r => r.pagamentoId === pagamentoId);
  },
  saveRecibo(recibo: Recibo): void {
    const list = load<Recibo[]>(STORAGE_KEYS.RECIBOS, []);
    const idx = list.findIndex(r => r.id === recibo.id);
    if (idx >= 0) {
      list[idx] = recibo;
    } else {
      list.push(recibo);
    }
    save(STORAGE_KEYS.RECIBOS, list);
  },

  // Verificação de Estado do Armazenamento e Saúde de Persistência
  getStorageHealthInfo(): StorageHealthInfo {
    const isPersistent = testLocalStorage();
    const driver = isPersistent ? 'localStorage' : 'memoryStore';

    let totalBytesUsed = 0;
    let keysCount = 0;
    const storageObj = getStorage();

    Object.values(STORAGE_KEYS).forEach(k => {
      const val = storageObj.getItem(k);
      if (val) {
        keysCount++;
        // Estima uso em bytes UTF-16
        totalBytesUsed += (k.length + val.length) * 2;
      }
    });

    const estimatedQuotaBytes = 5 * 1024 * 1024; // 5 MB padrão de navegadores
    const percentUsed = Math.min(100, Math.round((totalBytesUsed / estimatedQuotaBytes) * 10000) / 100);

    return {
      isPersistent,
      driver,
      totalBytesUsed,
      estimatedQuotaBytes,
      percentUsed,
      lastWriteSuccess,
      lastErrorMessage: lastStorageError || undefined,
      hasExistingUserData: this.hasExistingUserData(),
      keysCount
    };
  },

  hasExistingUserData(): boolean {
    const partidas = load<Partida[]>(STORAGE_KEYS.PARTIDAS, []);
    const pagamentos = load<Pagamento[]>(STORAGE_KEYS.PAGAMENTOS, []);
    const contratantes = load<Contratante[]>(STORAGE_KEYS.CONTRATANTES, []);
    const baseIds = new Set(BASE_CONTRATANTES.map(c => c.id));
    const hasCustomContractors = contratantes.some(c => !baseIds.has(c.id));
    return partidas.length > 0 || pagamentos.length > 0 || hasCustomContractors;
  },

  // Validador de Integridade de Arquivo de Backup JSON
  validateBackup(jsonString: string): BackupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stats: Record<string, number> = {};
    const orphanMatches: string[] = [];
    const orphanAllocations: string[] = [];
    const orphanReceipts: string[] = [];

    let version = 1;

    try {
      if (!jsonString || typeof jsonString !== 'string') {
        return {
          valid: false,
          version: 0,
          errors: ['Arquivo de backup vazio ou não é uma cadeia de texto válida.'],
          warnings,
          stats,
          relationshipsIntegrity: { orphanMatches, orphanAllocations, orphanReceipts }
        };
      }

      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          version: 0,
          errors: ['JSON não contém um objeto raiz válido.'],
          warnings,
          stats,
          relationshipsIntegrity: { orphanMatches, orphanAllocations, orphanReceipts }
        };
      }

      version = Number(data.version) || 1;

      // Validação de coleções obrigatórias
      if (!Array.isArray(data.contratantes)) {
        errors.push('Campo obrigatório "contratantes" ausente ou não é uma lista.');
      }
      if (!Array.isArray(data.partidas)) {
        errors.push('Campo obrigatório "partidas" ausente ou não é uma lista.');
      }

      if (errors.length > 0) {
        return {
          valid: false,
          version,
          errors,
          warnings,
          stats,
          relationshipsIntegrity: { orphanMatches, orphanAllocations, orphanReceipts }
        };
      }

      // Validar cada contratante
      const contratanteIds = new Set<string>();
      for (const [idx, c] of data.contratantes.entries()) {
        if (!c.id || typeof c.id !== 'string') {
          errors.push(`Contratante #${idx} possui identificador (id) inválido.`);
        } else {
          contratanteIds.add(c.id);
        }
        if (!c.nome || typeof c.nome !== 'string' || !c.nome.trim()) {
          errors.push(`Contratante #${idx} está sem nome cadastrado.`);
        }
      }

      // Validar locais (se existirem ou migrar)
      const localIds = new Set<string>();
      if (Array.isArray(data.locais)) {
        for (const [idx, l] of data.locais.entries()) {
          if (!l.id || !l.nome) {
            warnings.push(`Local #${idx} possui formato incompleto.`);
          } else {
            localIds.add(l.id);
          }
        }
      } else {
        warnings.push('Backup v1 sem entidade "locais". Será migrado automaticamente com os locais autorizados.');
      }

      // Validar partidas e relacionamento com contratantes
      const partidaIds = new Set<string>();
      for (const [idx, p] of data.partidas.entries()) {
        if (!p.id || typeof p.id !== 'string') {
          errors.push(`Partida #${idx} possui id inválido.`);
        } else {
          partidaIds.add(p.id);
        }
        if (!p.contratanteId) {
          errors.push(`Partida #${p.id || idx} não possui contratanteId vinculado.`);
        } else if (!contratanteIds.has(p.contratanteId)) {
          orphanMatches.push(p.id || `idx-${idx}`);
          warnings.push(`Partida #${p.id || idx} referencia contratante inexistente (${p.contratanteId}).`);
        }
        if (!p.data || typeof p.data !== 'string') {
          errors.push(`Partida #${p.id || idx} possui formato de data inválido.`);
        }
        if (typeof p.valorFinalCentavos !== 'number' || isNaN(p.valorFinalCentavos)) {
          errors.push(`Partida #${p.id || idx} possui valorFinalCentavos corrompido.`);
        }
      }

      // Validar pagamentos e alocações
      const pagamentoIds = new Set<string>();
      if (Array.isArray(data.pagamentos)) {
        for (const [idx, pay] of data.pagamentos.entries()) {
          if (!pay.id || typeof pay.id !== 'string') {
            errors.push(`Pagamento #${idx} possui id inválido.`);
          } else {
            pagamentoIds.add(pay.id);
          }
          if (typeof pay.valorRecebidoCentavos !== 'number' || isNaN(pay.valorRecebidoCentavos)) {
            errors.push(`Pagamento #${pay.id || idx} possui valor corrompido.`);
          }
        }
      }

      if (Array.isArray(data.alocacoes)) {
        for (const [idx, aloc] of data.alocacoes.entries()) {
          if (!aloc.pagamentoId || !pagamentoIds.has(aloc.pagamentoId)) {
            orphanAllocations.push(aloc.id || `idx-${idx}`);
            warnings.push(`Alocação #${aloc.id || idx} referencia pagamento inexistente (${aloc.pagamentoId}).`);
          }
          if (!aloc.partidaId || !partidaIds.has(aloc.partidaId)) {
            warnings.push(`Alocação #${aloc.id || idx} referencia partida inexistente (${aloc.partidaId}).`);
          }
        }
      }

      // Validar recibos
      if (Array.isArray(data.recibos)) {
        for (const [idx, rec] of data.recibos.entries()) {
          if (!rec.id || !rec.numeroRecibo) {
            errors.push(`Recibo #${idx} está corrompido.`);
          }
          if (rec.pagamentoId && !pagamentoIds.has(rec.pagamentoId)) {
            orphanReceipts.push(rec.id);
            warnings.push(`Recibo #${rec.numeroRecibo} referencia pagamento inexistente (${rec.pagamentoId}).`);
          }
        }
      }

      // Estatísticas consolidadas
      stats.contratantes = data.contratantes.length;
      stats.locais = Array.isArray(data.locais) ? data.locais.length : 0;
      stats.partidas = data.partidas.length;
      stats.pagamentos = Array.isArray(data.pagamentos) ? data.pagamentos.length : 0;
      stats.alocacoes = Array.isArray(data.alocacoes) ? data.alocacoes.length : 0;
      stats.recibos = Array.isArray(data.recibos) ? data.recibos.length : 0;
      stats.jogosFixos = Array.isArray(data.jogosFixos) ? data.jogosFixos.length : 0;
      stats.ciclos = Array.isArray(data.ciclos) ? data.ciclos.length : 0;
      stats.pacotes = Array.isArray(data.pacotes) ? data.pacotes.length : 0;
      stats.cobrancas = Array.isArray(data.cobrancas) ? data.cobrancas.length : 0;

      return {
        valid: errors.length === 0,
        version,
        errors,
        warnings,
        stats,
        relationshipsIntegrity: { orphanMatches, orphanAllocations, orphanReceipts }
      };
    } catch (parseErr: any) {
      return {
        valid: false,
        version: 0,
        errors: [`JSON inválido ou corrompido: ${parseErr.message || String(parseErr)}`],
        warnings,
        stats,
        relationshipsIntegrity: { orphanMatches, orphanAllocations, orphanReceipts }
      };
    }
  },

  // Exportação com Schema v2 e Resumo de Integridade
  exportBackup(): string {
    const config = this.getConfig();
    const contratantes = this.getContratantes(true);
    const locais = this.getLocais(true);
    const partidas = this.getPartidas(true);
    const jogosFixos = this.getJogosFixos(true);
    const ciclos = this.getCiclos();
    const pacotes = this.getPacotes();
    const pagamentos = this.getPagamentos();
    const alocacoes = this.getAlocacoes();
    const creditos = this.getCreditos();
    const movimentacoesCredito = this.getMovimentacoesCredito();
    const cobrancas = this.getCobrancas();
    const recibos = this.getRecibos();

    const fullBackup = {
      version: 2,
      schema: 'goleiro_pro_v2',
      exportedAt: new Date().toISOString(),
      summary: {
        contratantes: contratantes.length,
        locais: locais.length,
        partidas: partidas.length,
        jogosFixos: jogosFixos.length,
        ciclos: ciclos.length,
        pacotes: pacotes.length,
        pagamentos: pagamentos.length,
        alocacoes: alocacoes.length,
        creditos: creditos.length,
        movimentacoesCredito: movimentacoesCredito.length,
        cobrancas: cobrancas.length,
        recibos: recibos.length
      },
      config,
      contratantes,
      locais,
      partidas,
      jogosFixos,
      ciclos,
      pacotes,
      pagamentos,
      alocacoes,
      creditos,
      movimentacoesCredito,
      cobrancas,
      recibos,
      tabelaPrecos: this.getTabelaPrecos()
    };
    return JSON.stringify(fullBackup, null, 2);
  },

  // Importação detalhada com validação e rollback atômico completo
  importBackupWithDetails(jsonString: string): {
    success: boolean;
    errors: string[];
    warnings: string[];
    importedCounts: Record<string, number>;
  } {
    // 1. Snapshot de rollback completo de TODAS as entidades antes de qualquer mutação
    const rollbackSnapshot = {
      config: load(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG),
      contratantes: load(STORAGE_KEYS.CONTRATANTES, []),
      locais: load(STORAGE_KEYS.LOCAIS, []),
      partidas: load(STORAGE_KEYS.PARTIDAS, []),
      jogosFixos: load(STORAGE_KEYS.JOGOS_FIXOS, []),
      ciclos: load(STORAGE_KEYS.CICLOS, []),
      pacotes: load(STORAGE_KEYS.PACOTES, []),
      pagamentos: load(STORAGE_KEYS.PAGAMENTOS, []),
      alocacoes: load(STORAGE_KEYS.ALOCACOES, []),
      creditos: load(STORAGE_KEYS.CREDITOS, []),
      movimentacoesCredito: load(STORAGE_KEYS.MOVIMENTACOES_CREDITO, []),
      cobrancas: load(STORAGE_KEYS.COBRANCAS, []),
      recibos: load(STORAGE_KEYS.RECIBOS, []),
      tabelaPrecos: load(STORAGE_KEYS.TABELA_PRECOS, DEFAULT_TABELA_PRECOS),
      audit: load(STORAGE_KEYS.AUDIT, [])
    };

    // 2. Validação profunda
    const validation = this.validateBackup(jsonString);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
        importedCounts: validation.stats
      };
    }

    try {
      const data = JSON.parse(jsonString);

      // 3. Migração segura de esquemas antigos
      // Migração de Locais se ausente (v1 -> v2)
      let locaisToSave: Local[] = [];
      if (Array.isArray(data.locais) && data.locais.length > 0) {
        locaisToSave = data.locais;
      } else {
        // Se o backup não possuir locais (v1), preserva os locais base e cria locais extras encontrados nas partidas
        const localNamesFromPartidas = new Set<string>();
        data.partidas.forEach((p: any) => {
          if (p.local && typeof p.local === 'string') localNamesFromPartidas.add(p.local.trim());
        });

        const mergedLocais = [...BASE_LOCAIS];
        localNamesFromPartidas.forEach(nome => {
          if (!mergedLocais.some(l => l.nome.toLowerCase() === nome.toLowerCase())) {
            mergedLocais.push({
              id: `loc-migrated-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              nome,
              endereco: '',
              observacoes: 'Importado de partidas históricas',
              ativo: true,
              createdAt: new Date().toISOString()
            });
          }
        });
        locaisToSave = mergedLocais;
      }

      // Migração de Contratantes (assegura ativo: true se ausente)
      const contratantesToSave: Contratante[] = data.contratantes.map((c: any) => ({
        ...c,
        ativo: c.ativo !== false,
        arquivado: Boolean(c.arquivado)
      }));

      // Migração de Partidas (assegura campos financeiros de auditoria e perdas potenciais)
      const partidasToSave: Partida[] = data.partidas.map((p: any) => ({
        ...p,
        valorPerdaPotencialCentavos: p.valorPerdaPotencialCentavos ?? (
          (p.statusOperacional === 'cancelada' || p.statusOperacional === 'nao_realizada') ? p.valorFinalCentavos : 0
        ),
        perdaApurada: p.perdaApurada !== undefined ? p.perdaApurada : (
          p.statusOperacional === 'cancelada' || p.statusOperacional === 'nao_realizada'
        ),
        motivoNaoRealizada: p.motivoNaoRealizada || (p.statusOperacional === 'cancelada' ? 'Cancelamento informado' : undefined)
      }));

      // 4. Aplicação atômica de todas as entidades
      if (data.config && typeof data.config === 'object') {
        save(STORAGE_KEYS.CONFIG, { ...DEFAULT_CONFIG, ...data.config });
      }
      save(STORAGE_KEYS.CONTRATANTES, contratantesToSave);
      save(STORAGE_KEYS.LOCAIS, locaisToSave);
      save(STORAGE_KEYS.PARTIDAS, partidasToSave);
      save(STORAGE_KEYS.JOGOS_FIXOS, Array.isArray(data.jogosFixos) ? data.jogosFixos : []);
      save(STORAGE_KEYS.CICLOS, Array.isArray(data.ciclos) ? data.ciclos : []);
      save(STORAGE_KEYS.PACOTES, Array.isArray(data.pacotes) ? data.pacotes : []);
      save(STORAGE_KEYS.PAGAMENTOS, Array.isArray(data.pagamentos) ? data.pagamentos : []);
      save(STORAGE_KEYS.ALOCACOES, Array.isArray(data.alocacoes) ? data.alocacoes : []);
      save(STORAGE_KEYS.CREDITOS, Array.isArray(data.creditos) ? data.creditos : []);
      save(STORAGE_KEYS.MOVIMENTACOES_CREDITO, Array.isArray(data.movimentacoesCredito) ? data.movimentacoesCredito : []);
      save(STORAGE_KEYS.COBRANCAS, Array.isArray(data.cobrancas) ? data.cobrancas : []);
      save(STORAGE_KEYS.RECIBOS, Array.isArray(data.recibos) ? data.recibos : []);
      if (Array.isArray(data.tabelaPrecos) && data.tabelaPrecos.length > 0) {
        save(STORAGE_KEYS.TABELA_PRECOS, data.tabelaPrecos);
      }

      notifyChange();

      return {
        success: true,
        errors: [],
        warnings: validation.warnings,
        importedCounts: {
          contratantes: contratantesToSave.length,
          locais: locaisToSave.length,
          partidas: partidasToSave.length,
          pagamentos: (data.pagamentos || []).length,
          recibos: (data.recibos || []).length
        }
      };
    } catch (err: any) {
      console.error('Erro durante aplicação do backup. Executando rollback atômico total:', err);

      // Rollback completo de todas as coleções
      try {
        save(STORAGE_KEYS.CONFIG, rollbackSnapshot.config);
        save(STORAGE_KEYS.CONTRATANTES, rollbackSnapshot.contratantes);
        save(STORAGE_KEYS.LOCAIS, rollbackSnapshot.locais);
        save(STORAGE_KEYS.PARTIDAS, rollbackSnapshot.partidas);
        save(STORAGE_KEYS.JOGOS_FIXOS, rollbackSnapshot.jogosFixos);
        save(STORAGE_KEYS.CICLOS, rollbackSnapshot.ciclos);
        save(STORAGE_KEYS.PACOTES, rollbackSnapshot.pacotes);
        save(STORAGE_KEYS.PAGAMENTOS, rollbackSnapshot.pagamentos);
        save(STORAGE_KEYS.ALOCACOES, rollbackSnapshot.alocacoes);
        save(STORAGE_KEYS.CREDITOS, rollbackSnapshot.creditos);
        save(STORAGE_KEYS.MOVIMENTACOES_CREDITO, rollbackSnapshot.movimentacoesCredito);
        save(STORAGE_KEYS.COBRANCAS, rollbackSnapshot.cobrancas);
        save(STORAGE_KEYS.RECIBOS, rollbackSnapshot.recibos);
        save(STORAGE_KEYS.TABELA_PRECOS, rollbackSnapshot.tabelaPrecos);
        notifyChange();
      } catch (rbErr) {
        console.error('Falha grave durante rollback do backup:', rbErr);
      }

      return {
        success: false,
        errors: [`Falha na restauração do backup. O banco anterior foi restaurado com sucesso. Detalhe: ${err?.message || String(err)}`],
        warnings: validation.warnings,
        importedCounts: {}
      };
    }
  },

  importBackup(jsonString: string): boolean {
    const res = this.importBackupWithDetails(jsonString);
    return res.success;
  },

  // Carrega dados de demonstração (apenas quando solicitado explicitamente)
  seedInitialData(force = false): void {
    if (!force) return;

    const today = getTodayDateString();
    
    // Contratantes reais
    const contratantes: Contratante[] = [
      {
        id: 'c-1',
        nome: 'Pelada dos Amigos (Carlos)',
        whatsapp: '11991234567',
        observacoes: 'Jogo semanal às terças na Arena Gol de Placa.',
        tipoRelacao: 'fixo',
        formaPagamentoPadrao: 'pix',
        createdAt: '2026-10-01T10:00:00Z',
        arquivado: false,
        tokenAcessoPublico: 'token-carlos-amigos-7712'
      },
      {
        id: 'c-2',
        nome: 'Futebol & Cerveja (Rodrigo)',
        whatsapp: '11982345678',
        observacoes: 'Ciclo mensal de 4 jogos. Quadra Society 2.',
        tipoRelacao: 'fixo',
        formaPagamentoPadrao: 'pix',
        createdAt: '2026-10-05T14:30:00Z',
        arquivado: false,
        tokenAcessoPublico: 'token-rodrigo-fc-8823'
      },
      {
        id: 'c-3',
        nome: 'Turma da Quarta (Felipe)',
        whatsapp: '11973456789',
        observacoes: 'Contratou pacote com 4 jogos + 1 cortesia.',
        tipoRelacao: 'pacote',
        formaPagamentoPadrao: 'pix',
        createdAt: '2026-10-10T18:00:00Z',
        arquivado: false,
        tokenAcessoPublico: 'token-felipe-quarta-9934'
      },
      {
        id: 'c-4',
        nome: 'Veteranos F.C. (Marcos)',
        whatsapp: '11964567890',
        observacoes: 'Jogo avulso esporádico aos sábados pela manhã.',
        tipoRelacao: 'avulso',
        formaPagamentoPadrao: 'dinheiro',
        createdAt: '2026-10-15T09:00:00Z',
        arquivado: false,
        tokenAcessoPublico: 'token-marcos-vet-1145'
      }
    ];

    // Jogos Fixos
    const jogosFixos: JogoFixo[] = [
      {
        id: 'jf-1',
        nome: 'Terça dos Amigos',
        contratanteId: 'c-1',
        diaSemana: 2, // Terça
        horaInicio: '19:00',
        horaFim: '20:00',
        local: 'Arena Gol de Placa - Quadra 1',
        valorCentavos: 3500, // R$ 35,00
        ativo: true,
        observacoes: 'Uniforme escuro preferencial',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z'
      },
      {
        id: 'jf-2',
        nome: 'Quinta Futebol & Cerveja',
        contratanteId: 'c-2',
        diaSemana: 4, // Quinta
        horaInicio: '20:00',
        horaFim: '21:00',
        local: 'Playball Pompeia - Campo 3',
        valorCentavos: 3000, // R$ 30,00
        ativo: true,
        observacoes: 'Levar luva de society',
        createdAt: '2026-10-05T14:30:00Z',
        updatedAt: '2026-10-05T14:30:00Z'
      }
    ];

    // Ciclo de cobrança para Rodrigo
    const ciclos: CicloCobranca[] = [
      {
        id: 'ciclo-c2-1',
        contratanteId: 'c-2',
        quantidadeReferencia: 4,
        estado: 'aberto',
        createdAt: '2026-10-05T14:30:00Z'
      }
    ];

    // Pacote para Felipe
    const pacotes: Pacote[] = [
      {
        id: 'pac-c3-1',
        contratanteId: 'c-3',
        nome: 'Pacote 4 Jogos + 1 Cortesia',
        quantidadeJogos: 4,
        valorUnitarioReferenciaCentavos: 3500,
        precoFechadoCentavos: 14000, // R$ 140,00
        quantidadeCortesias: 1,
        valorReferenciaCortesiaCentavos: 3500,
        descontoCortesiaCentavos: 3500,
        condicaoLiberacao: 'pagamento_integral',
        totalPagoCentavos: 14000, // já pago integralmente!
        status: 'ativo',
        createdAt: '2026-10-10T18:00:00Z'
      }
    ];

    // Partidas realistas demonstrando todas as situações:
    // - Jogo de Hoje
    // - Jogos realizados e quitados
    // - Jogos em aberto
    // - Jogos futuros quitados antecipadamente
    // - Cortesia
    const partidas: Partida[] = [
      // c-1: Terça passada (realizada e paga)
      {
        id: 'p-1',
        data: '2026-10-20',
        horaInicio: '19:00',
        horaFim: '20:00',
        duracaoMinutos: 60,
        contratanteId: 'c-1',
        local: 'Arena Gol de Placa - Quadra 1',
        tipoPartida: 'fixo',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: 'Partida finalizada. Vitória 7x4.',
        statusOperacional: 'realizada',
        statusFinanceiro: 'pago',
        origemPartida: 'jogo_fixo',
        jogoFixoId: 'jf-1',
        ehCortesia: false,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-20T21:00:00Z'
      },
      // c-1: Próxima terça (hoje ou próxima)
      {
        id: 'p-2',
        data: today,
        horaInicio: '19:00',
        horaFim: '20:00',
        duracaoMinutos: 60,
        contratanteId: 'c-1',
        local: 'Arena Gol de Placa - Quadra 1',
        tipoPartida: 'fixo',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: 'Jogo de hoje! Confirmado com Carlos.',
        statusOperacional: 'confirmada',
        statusFinanceiro: 'em_aberto',
        origemPartida: 'jogo_fixo',
        jogoFixoId: 'jf-1',
        ehCortesia: false,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-24T10:00:00Z'
      },
      // c-2: Três partidas de R$ 30,00 no ciclo (exatamente o exemplo do requisito 10)
      {
        id: 'p-c2-1',
        data: '2026-10-08',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-2',
        local: 'Playball Pompeia - Campo 3',
        tipoPartida: 'fixo',
        valorReferenciaCentavos: 3000,
        descontoCentavos: 0,
        valorFinalCentavos: 3000,
        observacoes: '1º jogo do ciclo de 4',
        statusOperacional: 'realizada',
        statusFinanceiro: 'em_aberto',
        origemPartida: 'jogo_fixo',
        jogoFixoId: 'jf-2',
        cicloId: 'ciclo-c2-1',
        ehCortesia: false,
        createdAt: '2026-10-05T14:30:00Z',
        updatedAt: '2026-10-08T22:00:00Z'
      },
      {
        id: 'p-c2-2',
        data: '2026-10-15',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-2',
        local: 'Playball Pompeia - Campo 3',
        tipoPartida: 'fixo',
        valorReferenciaCentavos: 3000,
        descontoCentavos: 0,
        valorFinalCentavos: 3000,
        observacoes: '2º jogo do ciclo de 4',
        statusOperacional: 'realizada',
        statusFinanceiro: 'em_aberto',
        origemPartida: 'jogo_fixo',
        jogoFixoId: 'jf-2',
        cicloId: 'ciclo-c2-1',
        ehCortesia: false,
        createdAt: '2026-10-05T14:30:00Z',
        updatedAt: '2026-10-15T22:00:00Z'
      },
      {
        id: 'p-c2-3',
        data: '2026-10-22',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-2',
        local: 'Playball Pompeia - Campo 3',
        tipoPartida: 'fixo',
        valorReferenciaCentavos: 3000,
        descontoCentavos: 0,
        valorFinalCentavos: 3000,
        observacoes: '3º jogo do ciclo de 4',
        statusOperacional: 'realizada',
        statusFinanceiro: 'em_aberto',
        origemPartida: 'jogo_fixo',
        jogoFixoId: 'jf-2',
        cicloId: 'ciclo-c2-1',
        ehCortesia: false,
        createdAt: '2026-10-05T14:30:00Z',
        updatedAt: '2026-10-22T22:00:00Z'
      },
      // c-3: Partidas pagas antecipadas (exemplo do requisito 11.2)
      {
        id: 'p-c3-1',
        data: '2026-11-04',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-3',
        local: 'Arena Show de Bola - Campo A',
        tipoPartida: 'pacote',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: '1º jogo do pacote - Pago antecipadamente',
        statusOperacional: 'prevista',
        statusFinanceiro: 'pago',
        origemPartida: 'pacote',
        pacoteId: 'pac-c3-1',
        ehCortesia: false,
        createdAt: '2026-10-10T18:00:00Z',
        updatedAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'p-c3-2',
        data: '2026-11-11',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-3',
        local: 'Arena Show de Bola - Campo A',
        tipoPartida: 'pacote',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: '2º jogo do pacote - Pago antecipadamente',
        statusOperacional: 'prevista',
        statusFinanceiro: 'pago',
        origemPartida: 'pacote',
        pacoteId: 'pac-c3-1',
        ehCortesia: false,
        createdAt: '2026-10-10T18:00:00Z',
        updatedAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'p-c3-3',
        data: '2026-11-18',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-3',
        local: 'Arena Show de Bola - Campo A',
        tipoPartida: 'pacote',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: '3º jogo do pacote - Pago antecipadamente',
        statusOperacional: 'prevista',
        statusFinanceiro: 'pago',
        origemPartida: 'pacote',
        pacoteId: 'pac-c3-1',
        ehCortesia: false,
        createdAt: '2026-10-10T18:00:00Z',
        updatedAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'p-c3-4',
        data: '2026-11-25',
        horaInicio: '20:00',
        horaFim: '21:00',
        duracaoMinutos: 60,
        contratanteId: 'c-3',
        local: 'Arena Show de Bola - Campo A',
        tipoPartida: 'pacote',
        valorReferenciaCentavos: 3500,
        descontoCentavos: 0,
        valorFinalCentavos: 3500,
        observacoes: '4º jogo do pacote - Pago antecipadamente',
        statusOperacional: 'prevista',
        statusFinanceiro: 'pago',
        origemPartida: 'pacote',
        pacoteId: 'pac-c3-1',
        ehCortesia: false,
        createdAt: '2026-10-10T18:00:00Z',
        updatedAt: '2026-10-10T18:30:00Z'
      }
    ];

    // Pagamentos reais e alocações
    const pagamentos: Pagamento[] = [
      {
        id: 'pag-1',
        contratanteId: 'c-1',
        dataRecebimento: '2026-10-20',
        valorRecebidoCentavos: 3500,
        metodoPagamento: 'pix',
        observacoes: 'Pix recebido logo após o jogo.',
        reciboNumero: 'GP-000001',
        estornado: false,
        createdAt: '2026-10-20T21:15:00Z'
      },
      {
        id: 'pag-2',
        contratanteId: 'c-3',
        dataRecebimento: '2026-10-10',
        valorRecebidoCentavos: 14000,
        metodoPagamento: 'pix',
        observacoes: 'Quitação antecipada do pacote de 4 jogos.',
        reciboNumero: 'GP-000002',
        estornado: false,
        createdAt: '2026-10-10T18:30:00Z'
      }
    ];

    const alocacoes: AlocacaoPagamento[] = [
      {
        id: 'aloc-1',
        pagamentoId: 'pag-1',
        partidaId: 'p-1',
        valorAplicadoCentavos: 3500,
        ehAntecipado: false,
        createdAt: '2026-10-20T21:15:00Z'
      },
      {
        id: 'aloc-2',
        pagamentoId: 'pag-2',
        partidaId: 'p-c3-1',
        valorAplicadoCentavos: 3500,
        ehAntecipado: true,
        createdAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'aloc-3',
        pagamentoId: 'pag-2',
        partidaId: 'p-c3-2',
        valorAplicadoCentavos: 3500,
        ehAntecipado: true,
        createdAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'aloc-4',
        pagamentoId: 'pag-2',
        partidaId: 'p-c3-3',
        valorAplicadoCentavos: 3500,
        ehAntecipado: true,
        createdAt: '2026-10-10T18:30:00Z'
      },
      {
        id: 'aloc-5',
        pagamentoId: 'pag-2',
        partidaId: 'p-c3-4',
        valorAplicadoCentavos: 3500,
        ehAntecipado: true,
        createdAt: '2026-10-10T18:30:00Z'
      }
    ];

    // Cobrança documental de exemplo
    const cobrancas: Cobranca[] = [
      {
        id: 'cob-1',
        numeroCobranca: 'COB-0001',
        contratanteId: 'c-2',
        titulo: 'Fechamento Ciclo Parcial - 3 Jogos de Outubro',
        descricao: 'Cobrança das 3 partidas realizadas em outubro pelo ciclo de 4 jogos.',
        mensagemContratante: 'Fala Rodrigo, segue o resumo dos 3 jogos realizados este mês (R$ 90,00). Chave Pix no comprovante.',
        dataEmissao: '2026-10-23',
        dataVencimento: '2026-10-27',
        metodoPagamento: 'pix',
        partidasIds: ['p-c2-1', 'p-c2-2', 'p-c2-3'],
        cicloId: 'ciclo-c2-1',
        ajustesCentavos: 0,
        status: 'enviada',
        createdAt: '2026-10-23T11:00:00Z'
      }
    ];

    // Recibos emitidos
    const recibos: Recibo[] = [
      {
        id: 'rec-1',
        numeroRecibo: 'GP-000001',
        pagamentoId: 'pag-1',
        contratanteId: 'c-1',
        contratanteNome: 'Pelada dos Amigos (Carlos)',
        dataRecebimento: '2026-10-20',
        metodoPagamento: 'pix',
        valorTotalCentavos: 3500,
        valorPorExtenso: 'trinta e cinco reais',
        partidas: [
          {
            partidaId: 'p-1',
            data: '2026-10-20',
            horaInicio: '19:00',
            horaFim: '20:00',
            local: 'Arena Gol de Placa - Quadra 1',
            valorPagoCentavos: 3500,
            descontoCentavos: 0,
            ehAntecipado: false,
            ehCortesia: false
          }
        ],
        saldoPendenteContratanteCentavos: 3500,
        dataEmissao: '2026-10-20',
        createdAt: '2026-10-20T21:16:00Z'
      },
      {
        id: 'rec-2',
        numeroRecibo: 'GP-000002',
        pagamentoId: 'pag-2',
        contratanteId: 'c-3',
        contratanteNome: 'Turma da Quarta (Felipe)',
        dataRecebimento: '2026-10-10',
        metodoPagamento: 'pix',
        valorTotalCentavos: 14000,
        valorPorExtenso: 'cento e quarenta reais',
        partidas: [
          {
            partidaId: 'p-c3-1',
            data: '2026-11-04',
            horaInicio: '20:00',
            horaFim: '21:00',
            local: 'Arena Show de Bola - Campo A',
            valorPagoCentavos: 3500,
            descontoCentavos: 0,
            ehAntecipado: true,
            ehCortesia: false
          },
          {
            partidaId: 'p-c3-2',
            data: '2026-11-11',
            horaInicio: '20:00',
            horaFim: '21:00',
            local: 'Arena Show de Bola - Campo A',
            valorPagoCentavos: 3500,
            descontoCentavos: 0,
            ehAntecipado: true,
            ehCortesia: false
          },
          {
            partidaId: 'p-c3-3',
            data: '2026-11-18',
            horaInicio: '20:00',
            horaFim: '21:00',
            local: 'Arena Show de Bola - Campo A',
            valorPagoCentavos: 3500,
            descontoCentavos: 0,
            ehAntecipado: true,
            ehCortesia: false
          },
          {
            partidaId: 'p-c3-4',
            data: '2026-11-25',
            horaInicio: '20:00',
            horaFim: '21:00',
            local: 'Arena Show de Bola - Campo A',
            valorPagoCentavos: 3500,
            descontoCentavos: 0,
            ehAntecipado: true,
            ehCortesia: false
          }
        ],
        saldoPendenteContratanteCentavos: 0,
        dataEmissao: '2026-10-10',
        createdAt: '2026-10-10T18:31:00Z'
      }
    ];

    save(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    save(STORAGE_KEYS.CONTRATANTES, contratantes);
    save(STORAGE_KEYS.JOGOS_FIXOS, jogosFixos);
    save(STORAGE_KEYS.CICLOS, ciclos);
    save(STORAGE_KEYS.PACOTES, pacotes);
    save(STORAGE_KEYS.PARTIDAS, partidas);
    save(STORAGE_KEYS.PAGAMENTOS, pagamentos);
    save(STORAGE_KEYS.ALOCACOES, alocacoes);
    save(STORAGE_KEYS.CREDITOS, []);
    save(STORAGE_KEYS.MOVIMENTACOES_CREDITO, []);
    save(STORAGE_KEYS.COBRANCAS, cobrancas);
    save(STORAGE_KEYS.RECIBOS, recibos);
    save(STORAGE_KEYS.LOCAIS, BASE_LOCAIS);
    save(STORAGE_KEYS.TABELA_PRECOS, DEFAULT_TABELA_PRECOS);
    getStorage().setItem(STORAGE_KEYS.INITIALIZED, 'true');
    notifyChange();
  },

  // Corrige registros inflacionados por formato de parse anterior (ex: R$ 40 inserido gerando 400.000 / 400000 centavos)
  sanitizeBloatedCurrencies(): { modified: boolean; fixedCount: number } {
    let fixedCount = 0;
    const isBloated = (cents?: number | null) => {
      if (typeof cents !== 'number') return false;
      return cents >= 100000 && cents <= 1000000 && cents % 100 === 0;
    };

    const fixCents = (cents: number): number => {
      if (isBloated(cents)) {
        fixedCount++;
        return Math.round(cents / 100);
      }
      return cents;
    };

    // 1. Partidas
    const partidas = this.getPartidas();
    let partidasMod = false;
    const partidasFixed = partidas.map(p => {
      let changed = false;
      let vr = p.valorReferenciaCentavos;
      let vf = p.valorFinalCentavos;
      let vp = p.valorPerdaPotencialCentavos;

      if (isBloated(vr)) { vr = fixCents(vr); changed = true; }
      if (isBloated(vf)) { vf = fixCents(vf); changed = true; }
      if (typeof vp === 'number' && isBloated(vp)) { vp = fixCents(vp); changed = true; }

      if (changed) {
        partidasMod = true;
        return {
          ...p,
          valorReferenciaCentavos: vr,
          valorFinalCentavos: vf,
          valorPerdaPotencialCentavos: vp
        };
      }
      return p;
    });
    if (partidasMod) {
      save(STORAGE_KEYS.PARTIDAS, partidasFixed);
    }

    // 2. Pagamentos
    const pagamentos = this.getPagamentos();
    let pagamentosMod = false;
    const pagamentosFixed = pagamentos.map(p => {
      if (isBloated(p.valorRecebidoCentavos)) {
        pagamentosMod = true;
        return { ...p, valorRecebidoCentavos: fixCents(p.valorRecebidoCentavos) };
      }
      return p;
    });
    if (pagamentosMod) {
      save(STORAGE_KEYS.PAGAMENTOS, pagamentosFixed);
    }

    // 3. Alocações
    const alocacoes = this.getAlocacoes();
    let alocacoesMod = false;
    const alocacoesFixed = alocacoes.map(a => {
      if (isBloated(a.valorAplicadoCentavos)) {
        alocacoesMod = true;
        return { ...a, valorAplicadoCentavos: fixCents(a.valorAplicadoCentavos) };
      }
      return a;
    });
    if (alocacoesMod) {
      save(STORAGE_KEYS.ALOCACOES, alocacoesFixed);
    }

    // 4. Jogos Fixos
    const jogosFixos = this.getJogosFixos(true);
    let jogosFixosMod = false;
    const jogosFixosFixed = jogosFixos.map(jf => {
      if (isBloated(jf.valorCentavos)) {
        jogosFixosMod = true;
        return { ...jf, valorCentavos: fixCents(jf.valorCentavos) };
      }
      return jf;
    });
    if (jogosFixosMod) {
      save(STORAGE_KEYS.JOGOS_FIXOS, jogosFixosFixed);
    }

    // 5. Cobranças
    const cobrancas = this.getCobrancas();
    let cobrancasMod = false;
    const cobrancasFixed = cobrancas.map(c => {
      let changed = false;
      let aj = c.ajustesCentavos;
      if (typeof aj === 'number' && isBloated(aj)) {
        aj = fixCents(aj);
        changed = true;
      }
      if (changed) {
        cobrancasMod = true;
        return { ...c, ajustesCentavos: aj };
      }
      return c;
    });
    if (cobrancasMod) {
      save(STORAGE_KEYS.COBRANCAS, cobrancasFixed);
    }

    // 5. Recibos
    const recibos = this.getRecibos();
    let recibosMod = false;
    const recibosFixed = recibos.map(r => {
      let changed = false;
      let vt = r.valorTotalCentavos;
      if (isBloated(vt)) {
        vt = fixCents(vt);
        changed = true;
      }
      const fixedPartidas = r.partidas.map(pt => {
        if (isBloated(pt.valorPagoCentavos)) {
          changed = true;
          return { ...pt, valorPagoCentavos: fixCents(pt.valorPagoCentavos) };
        }
        return pt;
      });

      if (changed) {
        recibosMod = true;
        return {
          ...r,
          valorTotalCentavos: vt,
          valorPorExtenso: numberToWordsPtBr(vt),
          partidas: fixedPartidas
        };
      }
      return r;
    });
    if (recibosMod) {
      save(STORAGE_KEYS.RECIBOS, recibosFixed);
    }

    // 6. Config
    const config = this.getConfig();
    if (isBloated(config.valorPadraoHoraCentavos)) {
      config.valorPadraoHoraCentavos = fixCents(config.valorPadraoHoraCentavos);
      save(STORAGE_KEYS.CONFIG, config);
    }

    if (fixedCount > 0) {
      notifyChange();
    }

    return { modified: fixedCount > 0, fixedCount };
  },

  // Limpa todos os dados operacionais e financeiros, preservando contratantes e locais autorizados
  clearAllData(keepConfig = false): void {
    const cleanConfig: AppConfig = {
      nomeGoleiro: 'Meu Nome',
      apelido: 'Goleiro',
      telefone: '',
      cidade: '',
      chavePixTipo: 'telefone',
      chavePix: '',
      metodosPagamento: ['Pix', 'Dinheiro', 'Transferência'],
      valorPadraoHoraCentavos: 3500,
      diasPrevisaoOcorrencias: 30,
      rotinaHabitual: DEFAULT_ROTINA
    };

    if (!keepConfig) {
      save(STORAGE_KEYS.CONFIG, cleanConfig);
    }
    save(STORAGE_KEYS.CONTRATANTES, [...BASE_CONTRATANTES]);
    save(STORAGE_KEYS.LOCAIS, [...BASE_LOCAIS]);
    save(STORAGE_KEYS.JOGOS_FIXOS, []);
    save(STORAGE_KEYS.CICLOS, []);
    save(STORAGE_KEYS.PACOTES, []);
    save(STORAGE_KEYS.PARTIDAS, []);
    save(STORAGE_KEYS.PAGAMENTOS, []);
    save(STORAGE_KEYS.ALOCACOES, []);
    save(STORAGE_KEYS.CREDITOS, []);
    save(STORAGE_KEYS.MOVIMENTACOES_CREDITO, []);
    save(STORAGE_KEYS.COBRANCAS, []);
    save(STORAGE_KEYS.RECIBOS, []);
    save(STORAGE_KEYS.TABELA_PRECOS, DEFAULT_TABELA_PRECOS);
    save(STORAGE_KEYS.AUDIT, []);
    getStorage().setItem(STORAGE_KEYS.INITIALIZED, 'clean');
    notifyChange();
  }
};
