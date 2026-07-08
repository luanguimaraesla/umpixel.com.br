import {
  MONTHS_PER_YEAR,
  YEARS_PER_LIFE,
  MONTHS_PER_LIFE,
  COLUMN_MIN_WIDTH,
  COLUMN_MAX_WIDTH,
  COLUMN_USABLE_CAP,
  COLUMN_SIDE_MARGIN,
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
 * Patrimônio accumulated by saving 100% of the salary across a whole working
 * life. With a real annual raise `realGrowth` (net of inflation) each year's
 * salary rises, so the total in today's reais is a growing annuity; a rate of 0
 * falls back to a flat salary. This is the ONLY figure that models real growth;
 * the pixel scale (months, years, columns) stays anchored to today's salary.
 */
export function lifeSavings(salary: number, realGrowth = 0): number {
  if (realGrowth <= 0) return salary * MONTHS_PER_LIFE;
  const annual = salary * MONTHS_PER_YEAR;
  return (annual * (Math.pow(1 + realGrowth, YEARS_PER_LIFE) - 1)) / realGrowth;
}

/**
 * How many whole working lives of accumulated patrimônio a BRL amount equals:
 * the fortune divided by one full career of savings. Uses the same real growth
 * as lifeSavings so the fortune/life comparison is fair.
 */
export function livesOf(valueBRL: number, salary: number, realGrowth = 0): number {
  return valueBRL / lifeSavings(salary, realGrowth);
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

/** Spelled-out large count, e.g. 301256891 -> "301,3 milhões". */
export function fmtCountShort(v: number): string {
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
