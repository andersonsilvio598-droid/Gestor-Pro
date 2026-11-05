/**
 * Helpers para formatação de datas e validação de conflitos de horários em pt-BR.
 */

export const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_COMPLETO = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export const MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDatePtBr(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatTimePtBr(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

export function calculateDurationMinutes(horaInicio: string, horaFim: string): number {
  if (!horaInicio || !horaFim) return 60;
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFim.split(':').map(Number);
  const startMins = h1 * 60 + m1;
  const endMins = h2 * 60 + m2;
  const diff = endMins - startMins;
  return diff > 0 ? diff : 60;
}

/**
 * Converte HH:mm para minutos do dia para facilitar comparação
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Regra de conflito de intervalo (requisito 8):
 * início_existente < fim_novo AND fim_existente > início_novo
 */
export function checkIntervalOverlap(
  inicioExistente: string,
  fimExistente: string,
  inicioNovo: string,
  fimNovo: string
): boolean {
  const iE = timeToMinutes(inicioExistente);
  const fE = timeToMinutes(fimExistente);
  const iN = timeToMinutes(inicioNovo);
  const fN = timeToMinutes(fimNovo);
  return iE < fN && fE > iN;
}

/**
 * Retorna os 7 dias da semana (Segunda a Domingo ou Domingo a Sábado) para uma data dada
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  // Começar no Domingo (0) ou Segunda (1)
  const diff = referenceDate.getDate() - day;
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(referenceDate);
    nextDate.setDate(diff + i);
    dates.push(nextDate);
  }
  return dates;
}

export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthDates(year: number, monthIndex: number): Date[] {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const dates: Date[] = [];
  
  // Preencher dias anteriores do calendário
  const startDayWeek = firstDay.getDay();
  for (let i = startDayWeek; i > 0; i--) {
    const prevDate = new Date(year, monthIndex, 1 - i);
    dates.push(prevDate);
  }
  
  // Dias do mês
  for (let i = 1; i <= lastDay.getDate(); i++) {
    dates.push(new Date(year, monthIndex, i));
  }
  
  // Preencher dias seguintes para fechar semanas completas (múltiplo de 7)
  while (dates.length % 7 !== 0) {
    const last = dates[dates.length - 1];
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    dates.push(next);
  }
  
  return dates;
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr) return '20:00';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = ((h * 60 + (m || 0)) + minutesToAdd) % (24 * 60);
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
