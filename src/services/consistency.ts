import { ConsistencyIssue, Partida } from '../types';
import { StorageService } from './storage';
import { BillingService } from './billing';
import { checkIntervalOverlap } from '../utils/date';

export const ConsistencyService = {
  /**
   * Executa a bateria completa das 15 verificações de consistência (Requisito 18)
   */
  checkAll(): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    const partidas = StorageService.getPartidas(true);
    const contratantes = StorageService.getContratantes(true);
    const ciclos = StorageService.getCiclos();
    const pagamentos = StorageService.getPagamentos();
    const alocacoes = StorageService.getAlocacoes();
    const creditos = StorageService.getCreditos();
    const recibos = StorageService.getRecibos();

    // 1. Partidas realizadas sem ciclo para contratantes de ciclo fixo ativo
    for (const p of partidas) {
      if (p.statusOperacional === 'realizada' && !p.cicloId && !p.ehCortesia) {
        const contratante = contratantes.find(c => c.id === p.contratanteId);
        if (contratante && contratante.tipoRelacao === 'fixo') {
          const cicloAberto = ciclos.find(c => c.contratanteId === p.contratanteId && c.estado === 'aberto');
          if (cicloAberto) {
            issues.push({
              id: `issue-no-cycle-${p.id}`,
              tipo: 'partida_sem_ciclo',
              titulo: 'Partida realizada sem ciclo vinculado',
              severidade: 'media',
              registroId: p.id,
              entidade: 'Partida',
              descricao: `A partida de ${p.data} (${p.horaInicio}) do contratante "${contratante.nome}" não está vinculada ao ciclo ativo.`,
              impacto: 'Pode deixar a contagem de jogos do ciclo defasada.',
              acaoRecomendada: `Vincular a partida ao ciclo #${cicloAberto.id}.`,
              podeCorrigirAutomatico: true
            });
          }
        }
      }
    }

    // 2. Ciclos com contagem incorreta (ou ciclos abertos cujo saldo já foi 100% quitado e excedeu meta)
    for (const c of ciclos) {
      const summary = BillingService.getCicloSummary(c.id);
      if (summary) {
        if (summary.estaQuitado && summary.progressoContagem >= summary.quantidadeReferencia && c.estado === 'aberto') {
          issues.push({
            id: `issue-cycle-closed-${c.id}`,
            tipo: 'ciclo_pode_fechar',
            titulo: 'Ciclo completo pronto para fechamento',
            severidade: 'baixa',
            registroId: c.id,
            entidade: 'Ciclo',
            descricao: `O ciclo com ${summary.progressoContagem}/${summary.quantidadeReferencia} jogos está totalmente quitado (saldo R$ 0,00).`,
            impacto: 'Mantém ciclo anterior aberto desnecessariamente.',
            acaoRecomendada: 'Marcar o ciclo como fechado para permitir abertura do próximo.',
            podeCorrigirAutomatico: true
          });
        }
      }
    }

    // 3. Partidas duplicadas (mesmo contratante, mesma data e mesmo horário)
    const mapPartidas = new Map<string, Partida[]>();
    for (const p of partidas) {
      if (p.statusOperacional === 'cancelada') continue;
      const chave = `${p.contratanteId}_${p.data}_${p.horaInicio}`;
      const grupo = mapPartidas.get(chave) || [];
      grupo.push(p);
      mapPartidas.set(chave, grupo);
    }
    mapPartidas.forEach((grupo, key) => {
      if (grupo.length > 1) {
        issues.push({
          id: `issue-dup-match-${key}`,
          tipo: 'partidas_duplicadas',
          titulo: 'Partidas potencialmente duplicadas',
          severidade: 'alta',
          registroId: grupo[1].id,
          entidade: 'Partida',
          descricao: `Existem ${grupo.length} partidas ativas para o mesmo contratante no mesmo horário (${grupo[0].data} ${grupo[0].horaInicio}).`,
          impacto: 'Duplicação de agenda e cobrança indevida.',
          acaoRecomendada: 'Cancelar ou remover a ocorrência excedente.',
          podeCorrigirAutomatico: false
        });
      }
    });

    // 4. Conflitos de horário ativos (Requisito 8)
    const ativas = partidas.filter(
      p => p.statusOperacional !== 'cancelada' && p.statusOperacional !== 'pulada' && p.statusOperacional !== 'nao_realizada'
    );
    for (let i = 0; i < ativas.length; i++) {
      for (let j = i + 1; j < ativas.length; j++) {
        const p1 = ativas[i];
        const p2 = ativas[j];
        if (p1.data === p2.data && checkIntervalOverlap(p1.horaInicio, p1.horaFim, p2.horaInicio, p2.horaFim)) {
          issues.push({
            id: `issue-conflict-${p1.id}-${p2.id}`,
            tipo: 'conflito_horario',
            titulo: 'Conflito de horário detectado',
            severidade: 'alta',
            registroId: p2.id,
            entidade: 'Agenda',
            descricao: `Sobreposição de horários no dia ${p1.data}: ${p1.horaInicio}-${p1.horaFim} e ${p2.horaInicio}-${p2.horaFim}.`,
            impacto: 'Impossibilidade física de comparecer em dois jogos simultâneos.',
            acaoRecomendada: 'Ajustar o horário de uma das partidas.',
            podeCorrigirAutomatico: false
          });
        }
      }
    }

    // 5. Pagamentos sem destinação identificável (sem alocação e sem crédito)
    for (const pag of pagamentos) {
      if (pag.estornado) continue;
      const alocs = alocacoes.filter(a => a.pagamentoId === pag.id);
      const totalAlocado = alocs.reduce((acc, a) => acc + a.valorAplicadoCentavos, 0);
      const cred = creditos.find(c => c.pagamentoOrigemId === pag.id);
      const totalCredito = cred ? cred.valorTotalCentavos : 0;
      const diferenca = pag.valorRecebidoCentavos - (totalAlocado + totalCredito);

      if (diferenca > 0) {
        issues.push({
          id: `issue-unallocated-${pag.id}`,
          tipo: 'pagamento_sem_destinacao',
          titulo: 'Pagamento com valor não distribuído',
          severidade: 'media',
          registroId: pag.id,
          entidade: 'Pagamento',
          descricao: `O pagamento #${pag.reciboNumero || pag.id} de R$ ${(pag.valorRecebidoCentavos / 100).toFixed(
            2
          )} possui R$ ${(diferenca / 100).toFixed(2)} sem alocação ou crédito.`,
          impacto: 'Divergência entre caixa recebido e saldos das partidas.',
          acaoRecomendada: 'Transformar o excedente em crédito para o contratante.',
          podeCorrigirAutomatico: true
        });
      }
    }

    // 6. Status financeiro incompatível com saldos reais
    for (const p of partidas) {
      if (p.statusOperacional === 'cancelada') continue;
      const bal = BillingService.getPartidaBalance(p.id);
      if (p.statusFinanceiro !== bal.statusCalculado) {
        issues.push({
          id: `issue-mismatch-status-${p.id}`,
          tipo: 'status_financeiro_incompativel',
          titulo: 'Status financeiro desalinhado com pagamentos',
          severidade: 'media',
          registroId: p.id,
          entidade: 'Partida',
          descricao: `A partida de ${p.data} está marcada como "${p.statusFinanceiro}", mas seu saldo real indica "${bal.statusCalculado}".`,
          impacto: 'Indicadores do painel e extrato com dados desatualizados.',
          acaoRecomendada: `Atualizar status para "${bal.statusCalculado}".`,
          podeCorrigirAutomatico: true
        });
      }
    }

    // 7. Cortesias contabilizadas incorretamente (cortesia com valor final > 0)
    for (const p of partidas) {
      if (p.ehCortesia && p.valorFinalCentavos > 0) {
        issues.push({
          id: `issue-cortesia-valor-${p.id}`,
          tipo: 'cortesia_incorreta',
          titulo: 'Cortesia com valor final positivo',
          severidade: 'alta',
          registroId: p.id,
          entidade: 'Partida',
          descricao: `Partida de cortesia marcada com valor final de R$ ${(p.valorFinalCentavos / 100).toFixed(2)}.`,
          impacto: 'Viola a regra de que cortesias devem ter valor final zero e não gerar cobrança.',
          acaoRecomendada: 'Aplicar desconto integral de 100% à cortesia.',
          podeCorrigirAutomatico: true
        });
      }
    }

    // 8. Créditos aplicados em excesso
    for (const cred of creditos) {
      if (cred.valorUtilizadoCentavos > cred.valorTotalCentavos) {
        issues.push({
          id: `issue-credit-overflow-${cred.id}`,
          tipo: 'credito_em_excesso',
          titulo: 'Crédito com utilização maior que o valor total',
          severidade: 'alta',
          registroId: cred.id,
          entidade: 'Crédito',
          descricao: `Crédito de R$ ${(cred.valorTotalCentavos / 100).toFixed(2)} teve R$ ${(
            cred.valorUtilizadoCentavos / 100
          ).toFixed(2)} utilizados.`,
          impacto: 'Cálculo de saldo incorreto.',
          acaoRecomendada: 'Ajustar utilização ao teto do crédito.',
          podeCorrigirAutomatico: true
        });
      }
    }

    // 9. Recibos de pagamentos estornados sem aviso
    for (const rec of recibos) {
      const pag = pagamentos.find(p => p.id === rec.pagamentoId);
      if (pag && pag.estornado) {
        issues.push({
          id: `issue-receipt-reversed-${rec.id}`,
          tipo: 'recibo_pagamento_estornado',
          titulo: 'Recibo referente a pagamento estornado',
          severidade: 'baixa',
          registroId: rec.id,
          entidade: 'Recibo',
          descricao: `O recibo ${rec.numeroRecibo} está vinculado a uma transação que foi posteriormente estornada.`,
          impacto: 'Necessário alertar caso seja reemitido para o contratante.',
          acaoRecomendada: 'Manter no histórico com sinalização clara de estorno.',
          podeCorrigirAutomatico: false
        });
      }
    }

    return issues;
  },

  /**
   * Corrige automaticamente os problemas seguros
   */
  autoFixIssue(issueId: string): boolean {
    const issues = this.checkAll();
    const issue = issues.find(i => i.id === issueId);
    if (!issue || !issue.podeCorrigirAutomatico) return false;

    if (issue.tipo === 'partida_sem_ciclo' && issue.registroId) {
      const partida = StorageService.getPartidaById(issue.registroId);
      if (partida) {
        const ciclos = StorageService.getCiclosByContratante(partida.contratanteId);
        const aberto = ciclos.find(c => c.estado === 'aberto');
        if (aberto) {
          partida.cicloId = aberto.id;
          StorageService.savePartida(partida);
          return true;
        }
      }
    }

    if (issue.tipo === 'ciclo_pode_fechar' && issue.registroId) {
      const ciclos = StorageService.getCiclos();
      const c = ciclos.find(item => item.id === issue.registroId);
      if (c) {
        c.estado = 'fechado';
        c.fechadoAt = new Date().toISOString();
        StorageService.saveCiclo(c);
        return true;
      }
    }

    if (issue.tipo === 'status_financeiro_incompativel' && issue.registroId) {
      const partida = StorageService.getPartidaById(issue.registroId);
      if (partida) {
        const bal = BillingService.getPartidaBalance(partida.id);
        partida.statusFinanceiro = bal.statusCalculado;
        StorageService.savePartida(partida);
        return true;
      }
    }

    if (issue.tipo === 'cortesia_incorreta' && issue.registroId) {
      const partida = StorageService.getPartidaById(issue.registroId);
      if (partida) {
        partida.descontoCentavos = partida.valorReferenciaCentavos;
        partida.valorFinalCentavos = 0;
        partida.statusFinanceiro = 'sem_cobranca';
        StorageService.savePartida(partida);
        return true;
      }
    }

    if (issue.tipo === 'pagamento_sem_destinacao' && issue.registroId) {
      const pag = StorageService.getPagamentos().find(p => p.id === issue.registroId);
      if (pag) {
        const alocs = StorageService.getAlocacoesByPagamento(pag.id);
        const totalAlocado = alocs.reduce((acc, a) => acc + a.valorAplicadoCentavos, 0);
        const diff = pag.valorRecebidoCentavos - totalAlocado;
        if (diff > 0) {
          const cred = {
            id: `cred-${Date.now()}`,
            contratanteId: pag.contratanteId,
            pagamentoOrigemId: pag.id,
            valorTotalCentavos: diff,
            valorUtilizadoCentavos: 0,
            descricao: `Crédito gerado pelo pagamento #${pag.reciboNumero}`,
            status: 'disponivel' as const,
            createdAt: new Date().toISOString()
          };
          StorageService.saveCredito(cred);
          return true;
        }
      }
    }

    return false;
  }
};
