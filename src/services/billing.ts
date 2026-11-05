import {
  Partida,
  Contratante,
  JogoFixo,
  CicloCobranca,
  Pacote,
  Pagamento,
  AlocacaoPagamento,
  Credito,
  MovimentacaoCredito,
  StatusFinanceiro,
  StatusOperacional
} from '../types';
import { StorageService } from './storage';
import { checkIntervalOverlap, calculateDurationMinutes } from '../utils/date';
import { numberToWordsPtBr } from '../utils/currency';

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingMatch?: Partida;
  contractorName?: string;
  motivo?: string;
}

export interface ContratanteFinancialSummary {
  contratante: Contratante;
  totalGeradoCentavos: number;
  totalRecebidoCentavos: number;
  saldoDevedorCentavos: number;
  creditoDisponivelCentavos: number;
  partidasEmAbertoCount: number;
  partidasTotalCount: number;
  partidaMaisAntigaPendente?: Partida;
  ultimoPagamento?: Pagamento;
}

export interface CicloSummary {
  ciclo: CicloCobranca;
  partidas: Partida[];
  progressoContagem: number; // e.g. 3 ou 5
  quantidadeReferencia: number; // e.g. 4
  valorTotalCentavos: number;
  valorPagoCentavos: number;
  saldoCentavos: number;
  estaQuitado: boolean;
}

export const BillingService = {
  /**
   * Calcula saldo devido de uma partida com base nas alocações ativas
   */
  getPartidaBalance(partidaId: string): {
    valorFinalCentavos: number;
    totalPagoCentavos: number;
    saldoDevedorCentavos: number;
    statusCalculado: StatusFinanceiro;
  } {
    const partida = StorageService.getPartidaById(partidaId);
    if (!partida) {
      return { valorFinalCentavos: 0, totalPagoCentavos: 0, saldoDevedorCentavos: 0, statusCalculado: 'sem_cobranca' };
    }

    // Se for cortesia ou cancelada/pulada/não realizada sem cobrança
    if (
      partida.ehCortesia ||
      partida.valorFinalCentavos === 0 ||
      partida.statusOperacional === 'cancelada' ||
      partida.statusOperacional === 'pulada' ||
      partida.statusOperacional === 'nao_realizada'
    ) {
      return {
        valorFinalCentavos: partida.valorFinalCentavos,
        totalPagoCentavos: 0,
        saldoDevedorCentavos: 0,
        statusCalculado: 'sem_cobranca'
      };
    }

    const alocacoes = StorageService.getAlocacoesByPartida(partidaId);
    const pagamentos = StorageService.getPagamentos();
    const pagamentosValidosIds = new Set(pagamentos.filter(p => !p.estornado).map(p => p.id));

    let totalPago = 0;
    for (const aloc of alocacoes) {
      if (pagamentosValidosIds.has(aloc.pagamentoId)) {
        totalPago += aloc.valorAplicadoCentavos;
      }
    }

    // Incluir créditos aplicados diretamente a esta partida
    const movsCredito = StorageService.getMovimentacoesCredito().filter(
      m => m.partidaId === partidaId && m.tipo === 'aplicado'
    );
    for (const mov of movsCredito) {
      totalPago += mov.valorCentavos;
    }

    const saldo = Math.max(0, partida.valorFinalCentavos - totalPago);
    let status: StatusFinanceiro = 'em_aberto';

    if (totalPago >= partida.valorFinalCentavos) {
      status = 'pago';
    } else if (totalPago > 0) {
      status = 'parcialmente_pago';
    } else {
      status = 'em_aberto';
    }

    return {
      valorFinalCentavos: partida.valorFinalCentavos,
      totalPagoCentavos: totalPago,
      saldoDevedorCentavos: saldo,
      statusCalculado: status
    };
  },

  /**
   * Aplica crédito disponível de um contratante para quitar ou abater uma partida
   */
  applyCreditToMatch(
    creditoId: string,
    partidaId: string,
    valorCentavos?: number
  ): { sucesso: boolean; valorAplicadoCentavos: number; mensagem?: string } {
    const creditos = StorageService.getCreditos();
    const credito = creditos.find(c => c.id === creditoId);
    if (!credito || credito.status !== 'disponivel') {
      return { sucesso: false, valorAplicadoCentavos: 0, mensagem: 'Crédito não disponível ou não encontrado.' };
    }
    const partida = StorageService.getPartidaById(partidaId);
    if (!partida) {
      return { sucesso: false, valorAplicadoCentavos: 0, mensagem: 'Partida não encontrada.' };
    }
    if (partida.contratanteId !== credito.contratanteId) {
      return { sucesso: false, valorAplicadoCentavos: 0, mensagem: 'Partida pertence a outro contratante.' };
    }

    const bal = this.getPartidaBalance(partida.id);
    if (bal.saldoDevedorCentavos <= 0) {
      return { sucesso: false, valorAplicadoCentavos: 0, mensagem: 'Partida já está totalmente quitada.' };
    }

    const creditoRestante = credito.valorTotalCentavos - credito.valorUtilizadoCentavos;
    const desejado = valorCentavos !== undefined ? Math.min(valorCentavos, creditoRestante) : creditoRestante;
    const aAplicar = Math.min(desejado, bal.saldoDevedorCentavos);

    if (aAplicar <= 0) {
      return { sucesso: false, valorAplicadoCentavos: 0, mensagem: 'Nenhum valor a aplicar.' };
    }

    credito.valorUtilizadoCentavos += aAplicar;
    if (credito.valorUtilizadoCentavos >= credito.valorTotalCentavos) {
      credito.status = 'utilizado';
    }
    StorageService.saveCredito(credito);

    const mov: MovimentacaoCredito = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      creditoId: credito.id,
      partidaId: partida.id,
      valorCentavos: aAplicar,
      tipo: 'aplicado',
      data: new Date().toISOString().slice(0, 10),
      observacoes: `Crédito aplicado na partida de ${partida.data}`
    };
    StorageService.saveMovimentacaoCredito(mov);

    // Recalcular status da partida
    const novoSaldo = bal.saldoDevedorCentavos - aAplicar;
    partida.statusFinanceiro = novoSaldo === 0 ? 'pago' : 'parcialmente_pago';
    StorageService.savePartida(partida);

    return { sucesso: true, valorAplicadoCentavos: aAplicar };
  },

  /**
   * Verifica se há conflito de horário com outra partida ativa do mesmo goleiro
   * Regra 8: início_existente < fim_novo AND fim_existente > início_novo
   */
  checkConflict(
    data: string,
    horaInicio: string,
    horaFim: string,
    ignoreMatchId?: string
  ): ConflictCheckResult {
    const partidas = StorageService.getPartidas(false);

    for (const p of partidas) {
      if (ignoreMatchId && p.id === ignoreMatchId) continue;
      // Partidas canceladas, puladas, arquivadas ou não realizadas não bloqueiam horário
      if (
        p.statusOperacional === 'cancelada' ||
        p.statusOperacional === 'pulada' ||
        p.statusOperacional === 'nao_realizada' ||
        p.statusOperacional === 'arquivada'
      ) {
        continue;
      }

      if (p.data === data) {
        const overlap = checkIntervalOverlap(p.horaInicio, p.horaFim, horaInicio, horaFim);
        if (overlap) {
          const contratante = StorageService.getContratanteById(p.contratanteId);
          return {
            hasConflict: true,
            conflictingMatch: p,
            contractorName: contratante?.nome || 'Contratante desconhecido',
            motivo: `Conflito com partida de ${p.horaInicio} às ${p.horaFim} (${contratante?.nome || 'Outro'})`
          };
        }
      }
    }

    return { hasConflict: false };
  },

  /**
   * Resumo financeiro completo de um contratante
   */
  getContratanteFinancialSummary(contratanteId: string): ContratanteFinancialSummary {
    const contratante = StorageService.getContratanteById(contratanteId) || {
      id: contratanteId,
      nome: 'Desconhecido',
      whatsapp: '',
      observacoes: '',
      tipoRelacao: 'avulso',
      formaPagamentoPadrao: 'pix',
      createdAt: '',
      arquivado: false,
      tokenAcessoPublico: ''
    };

    const partidas = StorageService.getPartidas(true).filter(p => p.contratanteId === contratanteId);
    let totalGeradoCentavos = 0;
    let saldoDevedorCentavos = 0;
    let partidasEmAbertoCount = 0;
    let partidaMaisAntigaPendente: Partida | undefined;

    // Ordenar partidas por data
    const sortedPartidas = [...partidas].sort((a, b) => a.data.localeCompare(b.data));

    for (const p of sortedPartidas) {
      // Ignorar canceladas, puladas e não realizadas
      if (p.statusOperacional === 'cancelada' || p.statusOperacional === 'pulada' || p.statusOperacional === 'nao_realizada') {
        continue;
      }
      // Cortesias não contam como receita gerada
      if (p.ehCortesia) continue;

      totalGeradoCentavos += p.valorFinalCentavos;
      const bal = this.getPartidaBalance(p.id);

      if (bal.saldoDevedorCentavos > 0) {
        saldoDevedorCentavos += bal.saldoDevedorCentavos;
        partidasEmAbertoCount++;
        if (!partidaMaisAntigaPendente) {
          partidaMaisAntigaPendente = p;
        }
      }
    }

    // Pagamentos recebidos válidos
    const pagamentos = StorageService.getPagamentos().filter(
      p => p.contratanteId === contratanteId && !p.estornado
    );
    const totalRecebidoCentavos = pagamentos.reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    // Último pagamento
    const pagamentosOrdenados = [...pagamentos].sort((a, b) => b.dataRecebimento.localeCompare(a.dataRecebimento));
    const ultimoPagamento = pagamentosOrdenados[0];

    // Créditos disponíveis
    const creditos = StorageService.getCreditosByContratante(contratanteId).filter(c => c.status === 'disponivel');
    const creditoDisponivelCentavos = creditos.reduce(
      (acc, c) => acc + (c.valorTotalCentavos - c.valorUtilizadoCentavos),
      0
    );

    return {
      contratante,
      totalGeradoCentavos,
      totalRecebidoCentavos,
      saldoDevedorCentavos,
      creditoDisponivelCentavos,
      partidasEmAbertoCount,
      partidasTotalCount: partidas.length,
      partidaMaisAntigaPendente,
      ultimoPagamento
    };
  },

  /**
   * Resumo de Ciclo de Cobrança com partidas reais elegíveis
   * Requisito 10: partidas reais prevalecem sobre contadores salvos. Se tiver 5/4, mostra 5/4.
   */
  getCicloSummary(cicloId: string): CicloSummary | null {
    const ciclos = StorageService.getCiclos();
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo) return null;

    const partidas = StorageService.getPartidas(false)
      .filter(p => p.cicloId === cicloId && p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'pulada')
      .sort((a, b) => a.data.localeCompare(b.data));

    let valorTotal = 0;
    let valorPago = 0;
    let saldo = 0;

    for (const p of partidas) {
      if (!p.ehCortesia) {
        valorTotal += p.valorFinalCentavos;
        const bal = this.getPartidaBalance(p.id);
        valorPago += bal.totalPagoCentavos;
        saldo += bal.saldoDevedorCentavos;
      }
    }

    return {
      ciclo,
      partidas,
      progressoContagem: partidas.length,
      quantidadeReferencia: ciclo.quantidadeReferencia,
      valorTotalCentavos: valorTotal,
      valorPagoCentavos: valorPago,
      saldoCentavos: saldo,
      estaQuitado: partidas.length > 0 && saldo === 0
    };
  },

  /**
   * Geração idempotente de jogos fixos para um período (Requisito 9)
   * Garante que executar repetidamente NÃO duplica ocorrências.
   */
  generateFixedGameOccurrences(dataInicio: string, dataFim: string): {
    geradas: number;
    duplicatasIgnoradas: number;
    partidasGeradas: Partida[];
  } {
    const jogosFixos = StorageService.getJogosFixos(false); // apenas ativos
    const partidasExistentes = StorageService.getPartidas(true);
    const novasPartidas: Partida[] = [];
    let duplicatas = 0;

    const start = new Date(dataInicio + 'T12:00:00');
    const end = new Date(dataFim + 'T12:00:00');

    // Chaves existentes para garantia idempotente
    const chavesExistentes = new Set(
      partidasExistentes
        .filter(p => p.jogoFixoId)
        .map(p => `${p.jogoFixoId}_${p.data}_${p.horaInicio}`)
    );

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      for (const jf of jogosFixos) {
        if (jf.diaSemana === diaSemana) {
          const chaveIdempotente = `${jf.id}_${dateStr}_${jf.horaInicio}`;
          if (chavesExistentes.has(chaveIdempotente)) {
            duplicatas++;
            continue;
          }

          // Checar se o contratante tem ciclo ativo para vincular automaticamente
          const ciclosContratante = StorageService.getCiclosByContratante(jf.contratanteId);
          const cicloAberto = ciclosContratante.find(c => c.estado === 'aberto');

          const duracao = calculateDurationMinutes(jf.horaInicio, jf.horaFim);
          const novaPartida: Partida = {
            id: `p-fixo-${jf.id}-${dateStr}`,
            data: dateStr,
            horaInicio: jf.horaInicio,
            horaFim: jf.horaFim,
            duracaoMinutos: duracao,
            contratanteId: jf.contratanteId,
            local: jf.local,
            tipoPartida: 'fixo',
            valorReferenciaCentavos: jf.valorCentavos,
            descontoCentavos: 0,
            valorFinalCentavos: jf.valorCentavos,
            observacoes: `Gerado de jogo fixo: ${jf.nome}`,
            statusOperacional: 'prevista',
            statusFinanceiro: 'em_aberto',
            origemPartida: 'jogo_fixo',
            jogoFixoId: jf.id,
            cicloId: cicloAberto?.id,
            ehCortesia: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          novasPartidas.push(novaPartida);
          chavesExistentes.add(chaveIdempotente);
        }
      }
    }

    if (novasPartidas.length > 0) {
      StorageService.savePartidasBatch(novasPartidas);
    }

    return {
      geradas: novasPartidas.length,
      duplicatasIgnoradas: duplicatas,
      partidasGeradas: novasPartidas
    };
  },

  /**
   * Registro e alocação de pagamento com suporte a antecipações e distribuição manual ou FIFO
   * Requisitos 11.1, 11.2, 11.3, 11.4
   */
  processPayment(params: {
    contratanteId: string;
    valorRecebidoCentavos: number;
    metodoPagamento: any;
    dataRecebimento: string;
    observacoes: string;
    alocacoesManuais?: Array<{ partidaId: string; valorCentavos: number }>;
    usarCreditoDisponivel?: boolean;
    gerarExcedenteComoCredito?: boolean;
  }): {
    pagamento: Pagamento;
    alocacoes: AlocacaoPagamento[];
    creditoGerado?: Credito;
    recibo: any;
  } {
    const contratante = StorageService.getContratanteById(params.contratanteId);
    if (!contratante) {
      throw new Error('Contratante não encontrado');
    }

    const pagamentosExistentes = StorageService.getPagamentos();
    const numeroSequencial = pagamentosExistentes.length + 1;
    const reciboNumero = `GP-${String(numeroSequencial).padStart(6, '0')}`;

    const pagamentoId = `pag-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const novoPagamento: Pagamento = {
      id: pagamentoId,
      contratanteId: params.contratanteId,
      dataRecebimento: params.dataRecebimento,
      valorRecebidoCentavos: params.valorRecebidoCentavos,
      metodoPagamento: params.metodoPagamento,
      observacoes: params.observacoes,
      reciboNumero,
      estornado: false,
      createdAt: new Date().toISOString()
    };

    let valorRestanteParaAlocar = params.valorRecebidoCentavos;
    const novasAlocacoes: AlocacaoPagamento[] = [];
    const partidasAtualizadas: Partida[] = [];

    // Se foram fornecidas alocações manuais explícitas
    if (params.alocacoesManuais && params.alocacoesManuais.length > 0) {
      for (const item of params.alocacoesManuais) {
        if (item.valorCentavos <= 0) continue;
        const partida = StorageService.getPartidaById(item.partidaId);
        if (!partida) continue;

        const bal = this.getPartidaBalance(partida.id);
        const valorRealAlocado = Math.min(item.valorCentavos, valorRestanteParaAlocar, bal.saldoDevedorCentavos);

        if (valorRealAlocado > 0) {
          // Verifica se a partida é futura em relação à data do pagamento (pagamento antecipado)
          const ehAntecipado = partida.data > params.dataRecebimento;

          const aloc: AlocacaoPagamento = {
            id: `aloc-${Date.now()}-${partida.id}`,
            pagamentoId,
            partidaId: partida.id,
            valorAplicadoCentavos: valorRealAlocado,
            ehAntecipado,
            createdAt: new Date().toISOString()
          };
          novasAlocacoes.push(aloc);
          valorRestanteParaAlocar -= valorRealAlocado;

          // Atualiza status financeiro da partida
          const novoSaldo = bal.saldoDevedorCentavos - valorRealAlocado;
          const novoStatus: StatusFinanceiro = novoSaldo === 0 ? 'pago' : 'parcialmente_pago';
          partida.statusFinanceiro = novoStatus;
          partidasAtualizadas.push(partida);
        }
      }
    } else {
      // Distribuição automática FIFO nas partidas em aberto mais antigas
      const partidasEmAberto = StorageService.getPartidas(false)
        .filter(p => p.contratanteId === params.contratanteId && p.statusOperacional !== 'cancelada')
        .sort((a, b) => a.data.localeCompare(b.data));

      for (const partida of partidasEmAberto) {
        if (valorRestanteParaAlocar <= 0) break;
        const bal = this.getPartidaBalance(partida.id);
        if (bal.saldoDevedorCentavos <= 0) continue;

        const valorAlocar = Math.min(bal.saldoDevedorCentavos, valorRestanteParaAlocar);
        const ehAntecipado = partida.data > params.dataRecebimento;

        const aloc: AlocacaoPagamento = {
          id: `aloc-${Date.now()}-${partida.id}`,
          pagamentoId,
          partidaId: partida.id,
          valorAplicadoCentavos: valorAlocar,
          ehAntecipado,
          createdAt: new Date().toISOString()
        };
        novasAlocacoes.push(aloc);
        valorRestanteParaAlocar -= valorAlocar;

        const novoSaldo = bal.saldoDevedorCentavos - valorAlocar;
        partida.statusFinanceiro = novoSaldo === 0 ? 'pago' : 'parcialmente_pago';
        partidasAtualizadas.push(partida);
      }
    }

    // Se ainda sobrou dinheiro recebido, registra como crédito antecipado do contratante
    let creditoGerado: Credito | undefined;
    if (valorRestanteParaAlocar > 0 && params.gerarExcedenteComoCredito !== false) {
      creditoGerado = {
        id: `cred-${Date.now()}`,
        contratanteId: params.contratanteId,
        pagamentoOrigemId: pagamentoId,
        valorTotalCentavos: valorRestanteParaAlocar,
        valorUtilizadoCentavos: 0,
        descricao: `Crédito excedente do pagamento ${reciboNumero}`,
        status: 'disponivel',
        createdAt: new Date().toISOString()
      };
      StorageService.saveCredito(creditoGerado);

      const mov: MovimentacaoCredito = {
        id: `mov-${Date.now()}`,
        creditoId: creditoGerado.id,
        valorCentavos: valorRestanteParaAlocar,
        tipo: 'gerado',
        data: params.dataRecebimento,
        observacoes: `Crédito originado no pagamento ${reciboNumero}`
      };
      StorageService.saveMovimentacaoCredito(mov);
    }

    // Persistir pagamento, alocações e partidas atualizadas
    StorageService.savePagamento(novoPagamento);
    StorageService.saveAlocacoesBatch(novasAlocacoes);
    for (const p of partidasAtualizadas) {
      StorageService.savePartida(p);
    }

    // Montar recibo oficial
    const resumoContratante = this.getContratanteFinancialSummary(params.contratanteId);
    const partidasDetalhadas = novasAlocacoes.map(aloc => {
      const p = StorageService.getPartidaById(aloc.partidaId)!;
      return {
        partidaId: p.id,
        data: p.data,
        horaInicio: p.horaInicio,
        horaFim: p.horaFim,
        local: p.local,
        valorPagoCentavos: aloc.valorAplicadoCentavos,
        descontoCentavos: p.descontoCentavos,
        ehAntecipado: aloc.ehAntecipado,
        ehCortesia: p.ehCortesia
      };
    });

    const recibo = {
      id: `rec-${pagamentoId}`,
      numeroRecibo: reciboNumero,
      pagamentoId,
      contratanteId: contratante.id,
      contratanteNome: contratante.nome,
      dataRecebimento: params.dataRecebimento,
      metodoPagamento: params.metodoPagamento,
      valorTotalCentavos: params.valorRecebidoCentavos,
      valorPorExtenso: numberToWordsPtBr(params.valorRecebidoCentavos),
      partidas: partidasDetalhadas,
      saldoPendenteContratanteCentavos: resumoContratante.saldoDevedorCentavos,
      dataEmissao: params.dataRecebimento,
      createdAt: new Date().toISOString()
    };
    StorageService.saveRecibo(recibo);

    return {
      pagamento: novoPagamento,
      alocacoes: novasAlocacoes,
      creditoGerado,
      recibo
    };
  },

  /**
   * Estorno auditável de pagamento (Requisito 11.5)
   * Marca o pagamento como estornado, remove/reverte alocações, recalcula status de partidas
   * e preserva rastreabilidade e histórico do recibo.
   */
  reversePayment(pagamentoId: string, motivo: string): boolean {
    const pagamentos = StorageService.getPagamentos();
    const pagamento = pagamentos.find(p => p.id === pagamentoId);
    if (!pagamento || pagamento.estornado) return false;

    pagamento.estornado = true;
    pagamento.estornadoAt = new Date().toISOString();
    pagamento.estornadoMotivo = motivo;
    StorageService.savePagamento(pagamento);

    // Identificar partidas afetadas pelas alocações desse pagamento
    const alocacoes = StorageService.getAlocacoesByPagamento(pagamentoId);
    const partidasIdsAfetadas = Array.from(new Set(alocacoes.map(a => a.partidaId)));

    // Se houve crédito gerado por esse pagamento, estornar também
    const creditos = StorageService.getCreditos().filter(c => c.pagamentoOrigemId === pagamentoId);
    for (const c of creditos) {
      c.status = 'estornado';
      StorageService.saveCredito(c);
      StorageService.saveMovimentacaoCredito({
        id: `mov-estorno-${Date.now()}`,
        creditoId: c.id,
        valorCentavos: c.valorTotalCentavos,
        tipo: 'estornado',
        data: new Date().toISOString().slice(0, 10),
        observacoes: `Estornado pelo pagamento ${pagamento.reciboNumero}`
      });
    }

    // Recalcular status de cada partida afetada
    for (const partidaId of partidasIdsAfetadas) {
      const partida = StorageService.getPartidaById(partidaId);
      if (partida) {
        const bal = this.getPartidaBalance(partida.id);
        partida.statusFinanceiro = bal.statusCalculado;
        StorageService.savePartida(partida);
      }
    }

    return true;
  },

  /**
   * Responde com precisão às 5 Perguntas Centrais do Goleiro Pro:
   * 1. Quais partidas tenho programadas?
   * 2. Quais partidas realizei e quanto elas geraram?
   * 3. Quanto dinheiro realmente recebi?
   * 4. Quanto ainda tenho para receber? (Acumulado histórico sem sumir com virada de mês)
   * 5. Quanto deixei potencialmente de ganhar por partidas não realizadas?
   */
  getCoreFiveAnswers(startDate?: string, endDate?: string): CoreFiveAnswers {
    const partidas = StorageService.getPartidas(false);
    const pagamentos = StorageService.getPagamentos().filter(p => !p.estornado);
    const contratantes = StorageService.getContratantes(true);
    const contratanteMap = new Map(contratantes.map(c => [c.id, c.nome]));
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTimestamp = new Date(todayStr + 'T12:00:00').getTime();

    // 1. Programadas (prevista ou confirmada)
    const partidasProgramadas = partidas.filter(p => {
      const matchOp = p.statusOperacional === 'prevista' || p.statusOperacional === 'confirmada';
      if (!matchOp) return false;
      if (startDate && p.data < startDate) return false;
      if (endDate && p.data > endDate) return false;
      return true;
    }).sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));

    const valorProgramadasCentavos = partidasProgramadas
      .filter(p => !p.ehCortesia)
      .reduce((acc, p) => acc + p.valorFinalCentavos, 0);

    // 2. Realizadas (status realizada)
    const partidasRealizadas = partidas.filter(p => {
      if (p.statusOperacional !== 'realizada') return false;
      if (startDate && p.data < startDate) return false;
      if (endDate && p.data > endDate) return false;
      return true;
    }).sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));

    const valorRealizadasGeradoCentavos = partidasRealizadas
      .filter(p => !p.ehCortesia)
      .reduce((acc, p) => acc + p.valorFinalCentavos, 0);

    // 3. Recebimentos Efetivos (dinheiro real em caixa)
    const pagamentosFiltrados = pagamentos.filter(p => {
      if (startDate && p.dataRecebimento < startDate) return false;
      if (endDate && p.dataRecebimento > endDate) return false;
      return true;
    });

    const valorRecebidoCentavos = pagamentosFiltrados.reduce((acc, p) => acc + p.valorRecebidoCentavos, 0);

    // 4. Saldo a Receber (Controle Acumulativo de Pendências de TODAS as datas)
    // O encerramento do mês NÃO apaga pendências anteriores nem as projeta com novas datas
    const itensPendentes: Array<{
      partidaId: string;
      dataOriginal: string;
      horaInicio: string;
      contratanteId: string;
      contratanteNome: string;
      local: string;
      valorOriginalCentavos: number;
      valorPagoCentavos: number;
      saldoDevedorCentavos: number;
      diasEmAtraso: number;
      statusOperacional: StatusOperacional;
    }> = [];

    const devedoresIds = new Set<string>();

    for (const p of partidas) {
      if (
        p.statusOperacional === 'cancelada' ||
        p.statusOperacional === 'pulada' ||
        p.statusOperacional === 'arquivada' ||
        p.ehCortesia
      ) {
        continue;
      }

      const bal = this.getPartidaBalance(p.id);
      if (bal.saldoDevedorCentavos > 0) {
        const pDateTimestamp = new Date(p.data + 'T12:00:00').getTime();
        const diasEmAtraso = p.data < todayStr
          ? Math.max(1, Math.floor((todayTimestamp - pDateTimestamp) / (1000 * 60 * 60 * 24)))
          : 0;

        itensPendentes.push({
          partidaId: p.id,
          dataOriginal: p.data,
          horaInicio: p.horaInicio,
          contratanteId: p.contratanteId,
          contratanteNome: contratanteMap.get(p.contratanteId) || 'Não identificado',
          local: p.local,
          valorOriginalCentavos: p.valorFinalCentavos,
          valorPagoCentavos: bal.totalPagoCentavos,
          saldoDevedorCentavos: bal.saldoDevedorCentavos,
          diasEmAtraso,
          statusOperacional: p.statusOperacional
        });
        devedoresIds.add(p.contratanteId);
      }
    }

    // Ordenar itens pendentes pelos mais antigos primeiro (maior tempo de atraso)
    itensPendentes.sort((a, b) => a.dataOriginal.localeCompare(b.dataOriginal) || a.horaInicio.localeCompare(b.horaInicio));

    const totalAReceberCentavos = itensPendentes.reduce((acc, item) => acc + item.saldoDevedorCentavos, 0);

    // 5. Receita Potencial Perdida (canceladas e não realizadas)
    const partidasNaoRealizadas = partidas.filter(p => {
      const isPerdida = p.statusOperacional === 'cancelada' || p.statusOperacional === 'nao_realizada';
      if (!isPerdida) return false;
      if (startDate && p.data < startDate) return false;
      if (endDate && p.data > endDate) return false;
      return true;
    });

    let valorPerdaApuradaCentavos = 0;
    let quantidadeSemValorInformado = 0;

    for (const p of partidasNaoRealizadas) {
      if (p.perdaApurada && p.valorPerdaPotencialCentavos !== undefined && p.valorPerdaPotencialCentavos > 0) {
        valorPerdaApuradaCentavos += p.valorPerdaPotencialCentavos;
      } else if (p.valorPerdaPotencialCentavos !== undefined && p.valorPerdaPotencialCentavos > 0) {
        valorPerdaApuradaCentavos += p.valorPerdaPotencialCentavos;
      } else if (p.valorFinalCentavos > 0 && p.perdaApurada) {
        valorPerdaApuradaCentavos += p.valorFinalCentavos;
      } else {
        quantidadeSemValorInformado++;
      }
    }

    return {
      programadas: {
        quantidade: partidasProgramadas.length,
        valorEsperadoCentavos: valorProgramadasCentavos,
        partidas: partidasProgramadas
      },
      realizadas: {
        quantidade: partidasRealizadas.length,
        valorGeradoCentavos: valorRealizadasGeradoCentavos,
        partidas: partidasRealizadas
      },
      recebidos: {
        valorTotalCentavos: valorRecebidoCentavos,
        pagamentosCount: pagamentosFiltrados.length,
        pagamentos: pagamentosFiltrados
      },
      aReceber: {
        valorTotalCentavos: totalAReceberCentavos,
        partidasPendentesCount: itensPendentes.length,
        contratantesDevedoresCount: devedoresIds.size,
        itensDetalhados: itensPendentes
      },
      perdaPotencial: {
        quantidadeNaoRealizadas: partidasNaoRealizadas.length,
        valorPerdaApuradaCentavos,
        quantidadeSemValorInformado,
        partidas: partidasNaoRealizadas
      }
    };
  }
};

export interface CoreFiveAnswers {
  programadas: {
    quantidade: number;
    valorEsperadoCentavos: number;
    partidas: Partida[];
  };
  realizadas: {
    quantidade: number;
    valorGeradoCentavos: number;
    partidas: Partida[];
  };
  recebidos: {
    valorTotalCentavos: number;
    pagamentosCount: number;
    pagamentos: Pagamento[];
  };
  aReceber: {
    valorTotalCentavos: number;
    partidasPendentesCount: number;
    contratantesDevedoresCount: number;
    itensDetalhados: Array<{
      partidaId: string;
      dataOriginal: string;
      horaInicio: string;
      contratanteId: string;
      contratanteNome: string;
      local: string;
      valorOriginalCentavos: number;
      valorPagoCentavos: number;
      saldoDevedorCentavos: number;
      diasEmAtraso: number;
      statusOperacional: StatusOperacional;
    }>;
  };
  perdaPotencial: {
    quantidadeNaoRealizadas: number;
    valorPerdaApuradaCentavos: number;
    quantidadeSemValorInformado: number;
    partidas: Partida[];
  };
}
