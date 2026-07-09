import {
  MONTHS_PER_YEAR,
  MONTHS_PER_LIFE,
  COLUMN_MIN_WIDTH,
  COLUMN_MAX_WIDTH,
  COLUMN_USABLE_CAP,
  COLUMN_SIDE_MARGIN,
  MAX_COLUMN_HEIGHT_PX,
} from '../config';

// --- Core scale math (pure; no DOM) ---
// The whole page runs on one rule: 1 px² = 1 month of the reference salary.

/** Months of work that a BRL amount represents. */
export function monthsOf(valueBRL: number, salary: number): number {
  return valueBRL / salary;
}

/** Years of work that a BRL amount represents. */
export function yearsOf(valueBRL: number, salary: number): number {
  return monthsOf(valueBRL, salary) / MONTHS_PER_YEAR;
}

/**
 * Lifetime EARNINGS of a working life: every real earned by receiving 100% of the
 * salary across a whole career, frozen at today's salary with no projections. This
 * matches the column geometry exactly (one 564px row = one working life of months),
 * feeding the "vidas inteiras de trabalho" counts; it is NOT the patrimônio estimate
 * (see lifeWealth).
 */
export function lifeEarnings(salary: number): number {
  return salary * MONTHS_PER_LIFE;
}

/**
 * How many whole working lives of earnings a BRL amount equals: the fortune divided
 * by one full career of lifeEarnings, frozen at today's salary. Stays anchored to
 * the pixel-column geometry (one 564px row = one working life).
 */
export function livesOf(valueBRL: number, salary: number): number {
  return valueBRL / lifeEarnings(salary);
}

/** One savings-rate bracket: the average rate for incomes up to `ateSm` minimum wages (null = the top, open-ended bracket). */
export interface PoupancaFaixa {
  ateSm: number | null;
  taxa: number;
}

/** Inputs for the realistic patrimônio model: the statutory minimum wage, the bracket table and the accumulation horizon. */
export interface PoupancaParams {
  minWage: number;
  faixas: PoupancaFaixa[];
  years: number;
  annualReturn: number;
}

/**
 * The average savings rate for `salary`, picked from the bracket table: the first
 * faixa (ascending order) whose `ateSm` is null or where salary/minWage <= ateSm.
 * Falls back to the last faixa's taxa if none matches.
 */
export function savingsRateOf(salary: number, minWage: number, faixas: PoupancaFaixa[]): number {
  const mult = salary / minWage;
  for (const f of faixas) {
    if (f.ateSm === null || mult <= f.ateSm) return f.taxa;
  }
  return faixas[faixas.length - 1].taxa;
}

/**
 * Future value of saving R$1/month for `years` at `annualReturn` real return: the
 * ordinary-annuity factor with a monthly rate compounded from the annual one. A
 * non-positive monthly rate degenerates to a plain sum of months.
 */
export function accumulationFactor(years: number, annualReturn: number): number {
  const monthly = Math.pow(1 + annualReturn, 1 / 12) - 1;
  if (monthly <= 0) return years * MONTHS_PER_YEAR;
  return (Math.pow(1 + monthly, years * MONTHS_PER_YEAR) - 1) / monthly;
}

/**
 * Realistic patrimônio accumulated over a working life: the salary times the
 * average savings rate of its income bracket times the accumulation factor. The
 * brackets are per-capita household income (Banco Central, POF), applied here to
 * the individual salary as an approximation. The horizon is the same 47-year working
 * life (age 18 to 65) used everywhere else on the site, so accumulationFactor(47,
 * 0.03) is about 1221: each R$1/month saved for 47 years at 3% real becomes about
 * R$1.221.
 */
export function lifeWealth(salary: number, p: PoupancaParams): number {
  return salary * savingsRateOf(salary, p.minWage, p.faixas) * accumulationFactor(p.years, p.annualReturn);
}

/** Convert a fortune given in USD billions to BRL, using the PTAX rate. */
export function brlOf(usdBillions: number, fx: number): number {
  return usdBillions * 1e9 * fx;
}

/**
 * Column width in px for the giant fortunes. Always a multiple of 12 so a
 * single row is a whole number of years. At the 564 cap, one 1px row equals
 * exactly one working life.
 */
export function columnWidth(viewportWidth: number): number {
  const usable = Math.min(viewportWidth, COLUMN_USABLE_CAP) - COLUMN_SIDE_MARGIN;
  const w = Math.floor(usable / MONTHS_PER_YEAR) * MONTHS_PER_YEAR;
  return Math.max(COLUMN_MIN_WIDTH, Math.min(COLUMN_MAX_WIDTH, w));
}

/**
 * A near-square integer block whose AREA (w × h px²) equals `months`: the site's
 * core proportion, one px² per month of salary. Height is the rounded square root
 * and width fills the rest, so the block reads a touch wider than tall when the
 * count is not a perfect square: 12 → 4×3, 132 → 12×11, ~1052 → 33×32. The double
 * rounding keeps the area within ~1% of the month count at these sizes, so the
 * pixel area still IS the number of months.
 */
export function squareishBlock(months: number): { w: number; h: number } {
  const h = Math.max(1, Math.round(Math.sqrt(months)));
  const w = Math.max(1, Math.round(months / h));
  return { w, h };
}

/**
 * The actual rendered width (px) of a metric column. It is `baseWidth` unless the
 * fortune is so tall that the column would exceed the browser's element-height
 * limit, in which case the D10 guard widens it (kept a multiple of 12 so a whole
 * row is a whole number of years). Shared by the renderer and any depth math that
 * needs the real width, such as the ruler-step comparisons.
 */
export function metricColumnWidth(valueBRL: number, salary: number, baseWidth: number): number {
  const months = monthsOf(valueBRL, salary);
  if (months / baseWidth > MAX_COLUMN_HEIGHT_PX) {
    return Math.ceil(months / MAX_COLUMN_HEIGHT_PX / MONTHS_PER_YEAR) * MONTHS_PER_YEAR;
  }
  return baseWidth;
}

// --- pt-BR formatters ---

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Grouped integer, e.g. 202063 -> "202.063". */
export function fmtInt(v: number): string {
  return nf0.format(Math.round(v));
}

/** One-decimal number, e.g. 184.73 -> "184,7". */
function n1(v: number): string {
  return nf1.format(v);
}

function plural(n: number, singular: string, plural: string): string {
  return `${fmtInt(n)} ${n === 1 ? singular : plural}`;
}

/** Full currency, e.g. "R$ 1.621,00". */
export function fmtBRL(v: number): string {
  return brl.format(v);
}

/** Full currency as a grouped integer, no cents, e.g. "R$ 2.912.345.678". */
export function fmtBRLFull(v: number): string {
  return `R$ ${fmtInt(v)}`;
}

/**
 * Compact currency with spelled-out magnitude, e.g. "R$ 184,7 bilhões".
 * Hand-written tiering (not Intl compact, which abbreviates to "bi"/"mi").
 */
export function fmtBRLCompact(v: number): string {
  if (v >= 1e12) return `R$ ${n1(v / 1e12)} ${n1(v / 1e12) === '1,0' ? 'trilhão' : 'trilhões'}`;
  if (v >= 1e9) return `R$ ${n1(v / 1e9)} ${n1(v / 1e9) === '1,0' ? 'bilhão' : 'bilhões'}`;
  if (v >= 1e6) return `R$ ${n1(v / 1e6)} ${n1(v / 1e6) === '1,0' ? 'milhão' : 'milhões'}`;
  if (v >= 1e3) return `R$ ${n1(v / 1e3)} mil`;
  return fmtBRL(v);
}

/** Spelled-out large count, e.g. 301256891 -> "301,3 milhões", 3.9e12 -> "3,9 trilhões". */
export function fmtCountShort(v: number): string {
  if (v >= 1e12) return `${n1(v / 1e12)} ${n1(v / 1e12) === '1,0' ? 'trilhão' : 'trilhões'}`;
  if (v >= 1e9) return `${n1(v / 1e9)} ${n1(v / 1e9) === '1,0' ? 'bilhão' : 'bilhões'}`;
  if (v >= 1e6) return `${n1(v / 1e6)} ${n1(v / 1e6) === '1,0' ? 'milhão' : 'milhões'}`;
  if (v >= 1e5) return `${fmtInt(v / 1e3)} mil`;
  return fmtInt(v);
}

/** Years with magnitude words, e.g. "9,5 milhões de anos", "633 mil anos", "1.234 anos". */
export function fmtYears(v: number): string {
  if (v >= 1e6) return `${n1(v / 1e6)} ${n1(v / 1e6) === '1,0' ? 'milhão' : 'milhões'} de anos`;
  if (v >= 1e5) return `${fmtInt(v / 1e3)} mil anos`;
  return plural(Math.round(v), 'ano', 'anos');
}

/** Working lives with magnitude words, e.g. "202 mil vidas", "13.470 vidas". */
export function fmtLives(v: number): string {
  if (v >= 1e6) return `${n1(v / 1e6)} ${n1(v / 1e6) === '1,0' ? 'milhão' : 'milhões'} de vidas`;
  if (v >= 1e5) return `${fmtInt(v / 1e3)} mil vidas`;
  return plural(Math.round(v), 'vida', 'vidas');
}

// One-unit duration tiers (pt-BR). A year is 365,25 days so the "anos" tier lines
// up with the calendar-year math used elsewhere.
const DURATION_TIERS = [
  { limit: 60, unit: 1, one: 'segundo', many: 'segundos' },
  { limit: 3600, unit: 60, one: 'minuto', many: 'minutos' },
  { limit: 86_400, unit: 3600, one: 'hora', many: 'horas' },
  { limit: 31_557_600, unit: 86_400, one: 'dia', many: 'dias' },
  { limit: Infinity, unit: 31_557_600, one: 'ano', many: 'anos' },
] as const;

/**
 * A duration in seconds spelled out in a single pt-BR unit, e.g. "45 segundos",
 * "12 minutos", "2 horas", "3 dias", "5 anos". Picks the largest unit whose count
 * is at least 1 and rounds to a whole number; callers add words like "cerca de".
 */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, seconds);
  for (const tier of DURATION_TIERS) {
    if (s < tier.limit) {
      const n = Math.max(1, Math.round(s / tier.unit));
      return `${fmtInt(n)} ${n === 1 ? tier.one : tier.many}`;
    }
  }
  return '';
}

/**
 * Parse a pt-BR currency string into a number. Accepts "3.500,00", "3500",
 * "R$ 3.500". Returns NaN for garbage so callers can keep the last valid value.
 */
export function parseBRL(str: string): number {
  const cleaned = str
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (cleaned === '') return NaN;
  return parseFloat(cleaned);
}
