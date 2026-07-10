export const YEARS_PER_LIFE = 47; // age 18 -> 65 (INSS retirement age for men)
export const MONTHS_PER_YEAR = 12;
export const MONTHS_PER_LIFE = YEARS_PER_LIFE * MONTHS_PER_YEAR; // 564

export const SALARY_MIN = 100; // input clamp, BRL
export const SALARY_MAX = 1_000_000;

export const COLUMN_MAX_WIDTH = MONTHS_PER_LIFE; // 564 px; one life per row at this width
export const COLUMN_MIN_WIDTH = 120;
export const COLUMN_USABLE_CAP = 720; // cap usable viewport width so columns stay tall
export const COLUMN_SIDE_MARGIN = 48; // 24px on each side

export const SPEED_BASE = 600; // pixels per second at 1x (D5); one working life per second on the desktop column
export const SPEED_MULTIPLIERS = [0.5, 1, 2, 4, 8, 16] as const;

export const BILLION_BRL = 1_000_000_000; // D1: definitional milestone, not sourced data
export const RULER_STEP = 100; // px between ruler marks on the metric columns
export const MAX_COLUMN_HEIGHT_PX = 16_000_000; // D10 guard (below Firefox's ~17.9M limit)

// Hidden progressive speed ramps by BRL depth inside each column (D5b). Empty for
// columns short enough that ramping never triggers (R$ 1 bi is ~1.100 px tall).
// Retuned for the 8× top speed (D-V4-12): the deepest step is 6, so the maximum
// effective speed 8 × 6 ≈ 48× matches the old 3 × 16 ceiling the deep musk cards
// were sized for, keeping every card ≥ ~4s readable at 8×. The cap now follows the
// 16× top speed, so hidden ramps can lift playback to 16× at most, with the D5b cap
// semantics unchanged: never past the fastest selectable speed.
export const RAMP_STEPS: Record<string, { atBRL: number; mult: number }[]> = {
  bilhao: [],
  richest: [{ atBRL: 100e9, mult: 2 }],
  musk: [
    { atBRL: 100e9, mult: 2 },
    { atBRL: 500e9, mult: 3 },
    { atBRL: 1_500e9, mult: 4 },
    { atBRL: 3_000e9, mult: 6 },
  ],
};
