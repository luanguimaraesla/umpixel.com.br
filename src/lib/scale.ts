import {
  MONTHS_PER_YEAR,
  MONTHS_PER_LIFE,
  BRL_PER_PIXEL,
  COLUMN_MIN_WIDTH,
  COLUMN_MAX_WIDTH,
  COLUMN_USABLE_CAP,
  COLUMN_SIDE_MARGIN,
  MAX_COLUMN_HEIGHT_PX,
} from '../config';

export function pixelsOf(valueBRL: number): number {
  return valueBRL / BRL_PER_PIXEL;
}

export function brlAtDepth(depth: number, width: number): number {
  return depth * width * BRL_PER_PIXEL;
}

export function pixelBlock(valueBRL: number): { width: number; fullRows: number; lastRowWidth: number } {
  const area = pixelsOf(valueBRL);
  const width = Math.max(1, Math.ceil(Math.sqrt(area)));
  const fullRows = Math.floor(area / width);
  return { width, fullRows, lastRowWidth: area - fullRows * width };
}

export function monthsOf(valueBRL: number, salary: number): number {
  return valueBRL / salary;
}

export function yearsOf(valueBRL: number, salary: number): number {
  return monthsOf(valueBRL, salary) / MONTHS_PER_YEAR;
}

/** Gross earnings over 47 years, not savings or accumulated wealth. */
export function lifeEarnings(salary: number): number {
  return salary * MONTHS_PER_LIFE;
}

export function livesOf(valueBRL: number, salary: number): number {
  return valueBRL / lifeEarnings(salary);
}

export function columnWidth(viewportWidth: number): number {
  const usable = Math.min(viewportWidth, COLUMN_USABLE_CAP) - COLUMN_SIDE_MARGIN;
  const width = Math.floor(usable);
  return Math.max(COLUMN_MIN_WIDTH, Math.min(COLUMN_MAX_WIDTH, width));
}

/** Widen only if the column would exceed the browser's element-height limit. */
export function metricColumnWidth(valueBRL: number, baseWidth: number): number {
  const area = pixelsOf(valueBRL);
  if (area / baseWidth > MAX_COLUMN_HEIGHT_PX) {
    return Math.ceil(area / MAX_COLUMN_HEIGHT_PX);
  }
  return baseWidth;
}

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtInt(value: number): string {
  return nf0.format(Math.round(value));
}

export function fmtBRL(value: number): string {
  return brl.format(value);
}

export function fmtBRLFull(value: number): string {
  return `R$ ${fmtInt(value)}`;
}

export function fmtBRLCompact(value: number): string {
  if (value >= 1e6) return `R$ ${nf1.format(value / 1e6)} milhões`;
  if (value >= 1e3) return `R$ ${nf1.format(value / 1e3)} mil`;
  return fmtBRL(value);
}

export function fmtYears(value: number): string {
  return `${fmtInt(value)} ${Math.round(value) === 1 ? 'ano' : 'anos'}`;
}

export function fmtLives(value: number): string {
  return `${fmtInt(value)} ${Math.round(value) === 1 ? 'vida' : 'vidas'}`;
}
