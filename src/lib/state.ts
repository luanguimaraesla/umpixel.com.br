import { SALARY_MIN, SALARY_MAX } from '../config';

const STORAGE_KEY = 'umpixel.salario';

type Listener = (salary: number) => void;

let salary = 0;
const listeners = new Set<Listener>();

function clamp(value: number): number {
  return Math.min(SALARY_MAX, Math.max(SALARY_MIN, value));
}

/**
 * Initialize the salary from localStorage (falling back to the default minimum
 * wage passed in). Call once, before the first render.
 */
export function initSalary(defaultSalary: number): number {
  let start = defaultSalary;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (isFinite(parsed) && parsed > 0) start = parsed;
    }
  } catch {
    // localStorage may be unavailable (private mode); ignore.
  }
  salary = clamp(start);
  return salary;
}

export function getSalary(): number {
  return salary;
}

/** Set the salary (clamped), persist it, and notify subscribers if it changed. */
export function setSalary(value: number): void {
  if (!isFinite(value) || value <= 0) return;
  const next = clamp(value);
  if (next === salary) return;
  salary = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore persistence failures
  }
  for (const listener of listeners) listener(salary);
}

export function subscribe(listener: Listener): void {
  listeners.add(listener);
}
