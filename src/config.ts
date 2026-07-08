export const YEARS_PER_LIFE = 47; // age 18 -> 65 (INSS retirement age for men)
export const MONTHS_PER_YEAR = 12;
export const MONTHS_PER_LIFE = YEARS_PER_LIFE * MONTHS_PER_YEAR; // 564

export const SALARY_MIN = 100; // input clamp, BRL
export const SALARY_MAX = 1_000_000;

export const COLUMN_MAX_WIDTH = MONTHS_PER_LIFE; // 564 px; one life per row at this width
export const COLUMN_MIN_WIDTH = 120;
export const COLUMN_USABLE_CAP = 720; // cap usable viewport width so columns stay tall
export const COLUMN_SIDE_MARGIN = 48; // 24px on each side

export const MILESTONE_STEP = 1200; // px between cumulative tick labels inside columns

export const SPEED_BASE = 600; // pixels per second at 1x (D5); one working life per second on the desktop column
export const SPEED_MULTIPLIERS = [0.5, 1, 2, 3] as const;
