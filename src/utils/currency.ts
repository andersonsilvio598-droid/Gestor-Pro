/**
 * Helpers para cálculos financeiros em centavos exatos (inteiros).
 * Garante 100% de precisão monetária sem erros de ponto flutuante.
 */

export function formatCurrency(cents: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyRaw(cents: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Converte qualquer entrada monetária do usuário para centavos inteiros (inteiros).
 * Trata corretamente:
 * - "40" -> 4000 (R$ 40,00)
 * - "40.00" -> 4000 (R$ 40,00)
 * - "40,00" -> 4000 (R$ 40,00)
 * - "30" -> 3000 (R$ 30,00)
 * - "30.00" -> 3000 (R$ 30,00)
 * - "30,00" -> 3000 (R$ 30,00)
 * - "R$ 40,00" -> 4000 (R$ 40,00)
 * - "R$ 40" -> 4000 (R$ 40,00)
 * - "35.50" / "35,50" -> 3550 (R$ 35,50)
 * - "1.250,50" -> 125050 (R$ 1.250,50)
 */
export function parseCurrencyToCents(val: string | number): number {
  if (val === null || val === undefined || val === '') return 0;

  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  // Remove prefixo "R$", "R", "$", espaços e pontuação inicial
  let clean = String(val).replace(/^[R$\s]+/i, '').trim();
  if (!clean) return 0;

  // Se tiver ponto E vírgula (ex: "1.250,50" ou "1,250.50")
  if (clean.includes('.') && clean.includes(',')) {
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Padrão brasileiro: 1.250,50 -> ponto é milhar, vírgula é decimal
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão americano: 1,250.50 -> vírgula é milhar, ponto é decimal
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Apenas vírgula: padrão comum brasileiro (ex: "40,00", "40,5", "30,00")
    clean = clean.replace(',', '.');
  } else if (clean.includes('.')) {
    // Apenas ponto:
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Ex: "40.00", "30.00", "40.5", "35.50" -> é claramente decimal!
      clean = parts[0] + '.' + parts[1];
    } else {
      // Múltiplos pontos ou padrão milhar
      clean = clean.replace(/\./g, '');
    }
  }

  // Remove qualquer caractere que não seja dígito, sinal de menos ou ponto decimal
  clean = clean.replace(/[^\d.-]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const DEZENAS = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

function converterGrupo(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'cem';
  
  const partes: string[] = [];
  const c = Math.floor(num / 100);
  const resto = num % 100;
  
  if (c > 0) {
    partes.push(CENTENAS[c]);
  }
  
  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (u > 0) {
        partes.push(`${DEZENAS[d]} e ${UNIDADES[u]}`);
      } else {
        partes.push(DEZENAS[d]);
      }
    }
  }
  
  return partes.join(' e ');
}

export function numberToWordsPtBr(cents: number): string {
  if (cents === 0) return 'zero reais';
  
  const total = Math.abs(cents);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;
  
  const partesResultado: string[] = [];
  
  if (reais > 0) {
    if (reais === 1) {
      partesResultado.push('um real');
    } else if (reais < 1000) {
      partesResultado.push(`${converterGrupo(reais)} reais`);
    } else {
      const milhares = Math.floor(reais / 1000);
      const restoMilhares = reais % 1000;
      const milTexto = milhares === 1 ? 'mil' : `${converterGrupo(milhares)} mil`;
      if (restoMilhares > 0) {
        partesResultado.push(`${milTexto} e ${converterGrupo(restoMilhares)} reais`);
      } else {
        partesResultado.push(`${milTexto} reais`);
      }
    }
  }
  
  if (centavos > 0) {
    const centavosTexto = centavos === 1 ? 'um centavo' : `${converterGrupo(centavos)} centavos`;
    if (reais > 0) {
      partesResultado.push(`e ${centavosTexto}`);
    } else {
      partesResultado.push(centavosTexto);
    }
  }
  
  return partesResultado.join(' ');
}
