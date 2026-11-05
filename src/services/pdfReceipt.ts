import jsPDF from 'jspdf';
import { Recibo } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDatePtBr } from '../utils/date';
import { StorageService } from './storage';

export const PdfReceiptService = {
  /**
   * Gera um documento PDF formatado profissionalmente no padrão A4
   */
  generateReceiptDoc(recibo: Recibo): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const config = StorageService.getConfig();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header Background Accent Bar
    doc.setFillColor(11, 18, 32); // #0B1220
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Accent line in cyan (#22C7E8)
    doc.setDrawColor(34, 199, 232);
    doc.setLineWidth(1.5);
    doc.line(0, 35, pageWidth, 35);

    // Title & Logo Text
    doc.setTextColor(34, 199, 232); // Cyan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PROGESTOR • GOLEIRO PRO', 20, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(200, 210, 225);
    doc.text('Comprovante Oficial de Prestação de Serviços • Goleiro de Aluguel', 20, 24);

    // Document Number on Top Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`RECIBO Nº ${recibo.numeroRecibo}`, pageWidth - 20, 18, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(170, 190, 215);
    doc.text(`Emissão: ${formatDatePtBr(recibo.dataEmissao)}`, pageWidth - 20, 25, { align: 'right' });

    y = 48;

    // Card: Informações do Pagamento
    doc.setDrawColor(220, 225, 235);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, y, pageWidth - 40, 36, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('DADOS DO CONTRATANTE E PAGAMENTO', 25, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    doc.text(`Contratante: `, 25, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${recibo.contratanteNome}`, 52, y + 17);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data do Pagamento: `, 25, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatDatePtBr(recibo.dataRecebimento)}`, 62, y + 25);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Forma de Pagamento: `, 115, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${recibo.metodoPagamento.toUpperCase()}`, 155, y + 17);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Goleiro: `, 115, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${config.nomeGoleiro} (${config.apelido})`, 132, y + 25);

    y += 46;

    // Título da Tabela de Partidas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 18, 32);
    doc.text('RELAÇÃO DE PARTIDAS COBERTAS', 20, y);

    y += 4;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(20, y, pageWidth - 40, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DATA', 24, y + 5.5);
    doc.text('HORÁRIO', 48, y + 5.5);
    doc.text('LOCAL / SITUAÇÃO', 82, y + 5.5);
    doc.text('VALOR PAGO', pageWidth - 24, y + 5.5, { align: 'right' });

    y += 8;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let hasAdvance = false;

    recibo.partidas.forEach((item, index) => {
      if (y > 235) {
        doc.addPage();
        y = 20;
        doc.setFillColor(15, 23, 42);
        doc.rect(20, y, pageWidth - 40, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('DATA', 24, y + 5.5);
        doc.text('HORÁRIO', 48, y + 5.5);
        doc.text('LOCAL / SITUAÇÃO (CONT.)', 82, y + 5.5);
        doc.text('VALOR PAGO', pageWidth - 24, y + 5.5, { align: 'right' });
        y += 8;
        doc.setFont('helvetica', 'normal');
      }

      const isAlt = index % 2 === 1;
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(20, y, pageWidth - 40, 9, 'F');
      }

      doc.setTextColor(15, 23, 42);
      doc.text(formatDatePtBr(item.data), 24, y + 6);
      doc.text(`${item.horaInicio} às ${item.horaFim}`, 48, y + 6);

      let localTexto = item.local || 'Local a definir';
      if (item.ehAntecipado) {
        hasAdvance = true;
        localTexto += ' • [PAGO ANTECIPADO]';
      }
      if (item.ehCortesia) {
        localTexto += ' • [CORTESIA]';
      }

      // Truncate if too long
      if (localTexto.length > 40) {
        localTexto = localTexto.substring(0, 38) + '...';
      }
      doc.text(localTexto, 82, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(item.valorPagoCentavos), pageWidth - 24, y + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      // Thin separator
      doc.setDrawColor(235, 240, 245);
      doc.setLineWidth(0.2);
      doc.line(20, y + 9, pageWidth - 20, y + 9);

      y += 9;
    });

    if (y > 200) {
      doc.addPage();
      y = 20;
    }

    y += 6;

    // Resumo dos Totais
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pageWidth - 95, y, 75, 22, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Total Recebido:', pageWidth - 90, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 18, 32);
    doc.text(formatCurrency(recibo.valorTotalCentavos), pageWidth - 24, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Saldo Pendente Contratante:', pageWidth - 90, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(recibo.saldoPendenteContratanteCentavos > 0 ? 185 : 22, 28, 45);
    doc.text(formatCurrency(recibo.saldoPendenteContratanteCentavos), pageWidth - 24, y + 16, { align: 'right' });

    y += 28;

    // Valor por Extenso
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Valor por extenso: ${recibo.valorPorExtenso}.`, 20, y);

    y += 10;

    // Notas de Pagamento Antecipado se houver
    if (hasAdvance) {
      doc.setFillColor(236, 254, 255); // Cyan tinted info box
      doc.setDrawColor(34, 199, 232);
      doc.setLineWidth(0.5);
      doc.roundedRect(20, y, pageWidth - 40, 12, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(14, 116, 144);
      doc.text('• As partidas futuras identificadas foram quitadas antecipadamente.', 24, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('Quando realizadas, não gerarão cobranças adicionais.', 24, y + 9.5);
      y += 18;
    }

    // Declaração de quitação
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Este documento comprova o recebimento do valor especificado e sua respectiva quitação para as partidas listadas.',
      20,
      y
    );

    // Linha de assinatura / Rodapé
    const signatureY = Math.min(Math.max(y + 20, 245), 265);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 40, signatureY, pageWidth / 2 + 40, signatureY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(config.nomeGoleiro, pageWidth / 2, signatureY + 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Goleiro Profissional • WhatsApp: ${config.telefone}`, pageWidth / 2, signatureY + 11, { align: 'center' });

    // Footer em todas as páginas
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Gerado pelo ProGestor • Goleiro Pro • Página ${p} de ${totalPages}`,
        pageWidth / 2,
        287,
        { align: 'center' }
      );
    }

    return doc;
  },

  /**
   * Faz o download do arquivo PDF com nome seguro
   */
  downloadPdf(recibo: Recibo): void {
    const doc = this.generateReceiptDoc(recibo);
    const safeContractorName = recibo.contratanteNome.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Recibo_${recibo.numeroRecibo}_${safeContractorName}.pdf`;
    doc.save(filename);
  },

  /**
   * Retorna Data URI para renderização em iframe preview
   */
  getPdfDataUri(recibo: Recibo): string {
    const doc = this.generateReceiptDoc(recibo);
    return doc.output('datauristring');
  },

  /**
   * Tenta compartilhar o arquivo caso a Web Share API esteja disponível,
   * ou faz fallback para download direto
   */
  async shareOrDownload(recibo: Recibo): Promise<'shared' | 'downloaded'> {
    const doc = this.generateReceiptDoc(recibo);
    const safeContractorName = recibo.contratanteNome.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Recibo_${recibo.numeroRecibo}_${safeContractorName}.pdf`;

    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Recibo ${recibo.numeroRecibo}`,
          text: 'Olá! Estou enviando o recibo referente ao pagamento das partidas listadas no documento. Guarde este comprovante para sua consulta.',
          files: [file]
        });
        return 'shared';
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          doc.save(filename);
          return 'downloaded';
        }
        return 'downloaded';
      }
    } else {
      doc.save(filename);
      return 'downloaded';
    }
  },

  /**
   * Gera o link do WhatsApp com mensagem pronta
   */
  getWhatsAppShareUrl(recibo: Recibo, whatsappNumber?: string): string {
    const phone = (whatsappNumber || '').replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá! Estou enviando o comprovante referente ao recibo *${recibo.numeroRecibo}* no valor de *${formatCurrency(
        recibo.valorTotalCentavos
      )}* das partidas pagas.\nGuarde este comprovante para sua consulta!`
    );
    return `https://wa.me/55${phone}?text=${mensagem}`;
  }
};
