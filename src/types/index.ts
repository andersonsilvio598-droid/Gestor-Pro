export type TipoRelacao = 'avulso' | 'fixo' | 'pacote';
export type MetodoPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'cartao' | 'outro';

export type StatusOperacional = 
  | 'pendente'
  | 'prevista' 
  | 'confirmada' 
  | 'realizada' 
  | 'nao_realizada' 
  | 'cancelada' 
  | 'pulada'
  | 'arquivada';

export type ModalidadePartida =
  | 'society'
  | 'campo'
  | 'futsal'
  | 'torneio'
  | 'amistoso'
  | 'outro';

export type StatusFinanceiro = 
  | 'sem_cobranca' 
  | 'em_aberto' 
  | 'parcialmente_pago' 
  | 'pago';

export type TipoPartida = 'avulso' | 'fixo' | 'pacote' | 'cortesia';

export interface Local {
  id: string;
  nome: string;
  endereco?: string;
  observacoes?: string;
  ativo: boolean;
  createdAt: string;
}

export interface Contratante {
  id: string;
  nome: string;
  whatsapp: string;
  observacoes: string;
  tipoRelacao: TipoRelacao;
  formaPagamentoPadrao: MetodoPagamento;
  createdAt: string;
  arquivado: boolean;
  ativo?: boolean;
  tokenAcessoPublico: string; // token seguro para o recibo/extrato compartilhado
  preferenciaPrecoCentavos?: number; // Preço preferencial acordado
  preferenciaDuracaoMinutos?: number; // Duração preferencial (60, 90, 120 min)
}

export interface ItemTabelaPreco {
  id: string;
  duracaoMinutos: number; // 60, 90, 120, etc.
  valorCentavos: number; // 3000, 3500, 4000, 4500, 5500, 6000, 7000, etc.
  ativo: boolean;
  principal?: boolean; // Para destacar o R$ 40,00 de 60 min como referência primária
  ordem?: number;
  createdAt: string;
}

export interface Partida {
  id: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  duracaoMinutos: number;
  contratanteId: string;
  localId?: string;
  local: string;
  tipoPartida: TipoPartida;
  modalidade?: ModalidadePartida;
  valorReferenciaCentavos: number;
  descontoCentavos: number;
  valorFinalCentavos: number;
  valorPerdaPotencialCentavos?: number; // valor que deixou de ganhar em cancelada/nao_realizada
  perdaApurada?: boolean; // true = valor conhecido, false/undefined = a apurar / não informado
  motivoNaoRealizada?: string;
  observacoes: string;
  statusOperacional: StatusOperacional;
  statusFinanceiro: StatusFinanceiro;
  origemPartida: 'manual' | 'jogo_fixo' | 'pacote';
  jogoFixoId?: string;
  cicloId?: string;
  pacoteId?: string;
  ehCortesia: boolean;
  canceladoMotivo?: string;
  createdAt: string;
  updatedAt: string;
  arquivado?: boolean;
}

export interface JogoFixo {
  id: string;
  nome: string;
  contratanteId: string;
  diaSemana: number; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  local: string;
  valorCentavos: number;
  ativo: boolean;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CicloCobranca {
  id: string;
  contratanteId: string;
  quantidadeReferencia: number; // Ex: 4 jogos
  estado: 'aberto' | 'fechado';
  createdAt: string;
  fechadoAt?: string;
}

export type CondicaoLiberacaoCortesia = 'pagamento_integral' | 'completar_jogos' | 'ambos';

export interface Pacote {
  id: string;
  contratanteId: string;
  nome: string;
  quantidadeJogos: number;
  valorUnitarioReferenciaCentavos: number;
  precoFechadoCentavos: number;
  quantidadeCortesias: number;
  valorReferenciaCortesiaCentavos: number;
  descontoCortesiaCentavos: number;
  condicaoLiberacao: CondicaoLiberacaoCortesia;
  totalPagoCentavos: number;
  status: 'ativo' | 'concluido' | 'cancelado';
  createdAt: string;
}

export interface Pagamento {
  id: string;
  contratanteId: string;
  dataRecebimento: string; // YYYY-MM-DD
  valorRecebidoCentavos: number;
  metodoPagamento: MetodoPagamento;
  observacoes: string;
  reciboNumero?: string;
  estornado: boolean;
  estornadoAt?: string;
  estornadoMotivo?: string;
  createdAt: string;
}

export interface AlocacaoPagamento {
  id: string;
  pagamentoId: string;
  partidaId: string;
  valorAplicadoCentavos: number;
  ehAntecipado: boolean;
  createdAt: string;
}

export interface Credito {
  id: string;
  contratanteId: string;
  pagamentoOrigemId?: string;
  valorTotalCentavos: number;
  valorUtilizadoCentavos: number;
  descricao: string;
  status: 'disponivel' | 'utilizado' | 'estornado';
  createdAt: string;
}

export interface MovimentacaoCredito {
  id: string;
  creditoId: string;
  partidaId?: string;
  valorCentavos: number;
  tipo: 'gerado' | 'aplicado' | 'estornado';
  data: string;
  observacoes: string;
}

export interface Cobranca {
  id: string;
  numeroCobranca: string;
  contratanteId: string;
  titulo: string;
  descricao: string;
  mensagemContratante: string;
  dataEmissao: string;
  dataVencimento?: string;
  metodoPagamento: MetodoPagamento;
  partidasIds: string[];
  cicloId?: string;
  ajustesCentavos: number;
  motivoAjuste?: string;
  status: 'aberta' | 'enviada' | 'paga' | 'cancelada';
  createdAt: string;
}

export interface ReciboItem {
  partidaId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  valorPagoCentavos: number;
  descontoCentavos: number;
  ehAntecipado: boolean;
  ehCortesia: boolean;
}

export interface Recibo {
  id: string;
  numeroRecibo: string; // Ex: GP-000001
  pagamentoId: string;
  contratanteId: string;
  contratanteNome: string;
  dataRecebimento: string;
  metodoPagamento: MetodoPagamento;
  valorTotalCentavos: number;
  valorPorExtenso: string;
  partidas: ReciboItem[];
  saldoPendenteContratanteCentavos: number;
  dataEmissao: string;
  createdAt: string;
}

export interface RotinaHabitualItem {
  diaSemana: number; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  diaNome: string;
  jogosHabituais: number;
  horarioPadrao: string;
}

export interface AppConfig {
  nomeGoleiro: string;
  apelido: string;
  telefone: string;
  cidade: string;
  chavePixTipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  chavePix: string;
  metodosPagamento: string[];
  valorPadraoHoraCentavos: number;
  diasPrevisaoOcorrencias: number;
  rotinaHabitual?: RotinaHabitualItem[];
}

export interface ConsistencyIssue {
  id: string;
  tipo: string;
  titulo: string;
  severidade: 'alta' | 'media' | 'baixa';
  registroId?: string;
  entidade: string;
  descricao: string;
  impacto: string;
  acaoRecomendada: string;
  podeCorrigirAutomatico: boolean;
}

export interface TestResultItem {
  id: number;
  titulo: string;
  sucesso: boolean;
  detalhes: string;
  tempoMs: number;
}
