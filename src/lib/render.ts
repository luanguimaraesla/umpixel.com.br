import {
  MONTHS_PER_YEAR,
  MONTHS_PER_LIFE,
  MILESTONE_STEP,
  SPEED_MIN,
  SPEED_MAX,
  SPEED_DEFAULT,
} from '../config';
import {
  monthsOf,
  yearsOf,
  livesOf,
  lifeSavings,
  brlOf,
  columnWidth,
  fmtBRL,
  fmtBRLCompact,
  fmtInt,
  fmtYears,
  fmtLives,
  fmtCountShort,
  parseBRL,
  calcDuration,
} from './scale';
import { initSalary, getSalary, setSalary, subscribe } from './state';
import { createAutoscroll } from './autoscroll';
import type { Autoscroll } from './autoscroll';

// --- Shapes of the served /data/*.json files ---
interface Source {
  nome: string;
  url: string;
}
interface RawSalario {
  valor_brl: number;
  vigencia: string;
  instrumento_legal: string;
  fontes: Source[];
  acessado_em: string;
}
interface RawCambio {
  taxa_venda: number;
  data_cotacao: string;
  fontes: Source[];
  acessado_em: string;
}
interface RawPerson {
  posicao: number;
  nome: string;
  patrimonio_usd_bilhoes: number;
  fonte_riqueza: string;
}
interface RawBilionarios {
  top5: RawPerson[];
  total_top5_usd_bilhoes: number;
  data_referencia_valores: string;
  fontes: Source[];
  acessado_em: string;
}
interface RawRenda {
  fontes: Source[];
  acessado_em: string;
}

// --- Normalized model the UI renders from ---
interface Person {
  posicao: number;
  nome: string;
  usd: number;
  fonte: string;
}
interface PageData {
  minWage: number;
  minWageLaw: string;
  minWageYear: string;
  fx: number;
  fxDate: string;
  richest: Person;
  people: Person[];
  totalUsd: number;
  forbesRefDate: string;
}

interface Segment {
  name: string;
  top: number;
  bottom: number;
}
interface ColumnGeometry {
  top: number;
  height: number;
  name: string;
  hud: HTMLElement;
  segments: Segment[] | null;
}

// --- Module state ---
let data!: PageData;
let fx = 0;
let colW = 120;
let calcValue = NaN;
let scrollTicking = false;
let autoscroll: Autoscroll;
let geometry: ColumnGeometry[] = [];
let top5Segments: { name: string; topLocal: number; height: number }[] = [];

// --- Element references (assigned in boot) ---
let salaryInput!: HTMLInputElement;
let salaryBadge!: HTMLElement;
let calcInput!: HTMLInputElement;
let btnStart!: HTMLButtonElement;
let btnPlay!: HTMLButtonElement;
let speedInput!: HTMLInputElement;
let speedReadout!: HTMLElement;
let posReadout!: HTMLElement;
let colRichest!: HTMLElement;
let colTop5!: HTMLElement;
let hudRichest!: HTMLElement;
let hudTop5!: HTMLElement;
let sourcesEl!: HTMLElement;
let errorEl!: HTMLElement;

const decimalFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fxFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function monthYearPt(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS_PT[Number(m) - 1]} de ${y}`;
}
function fullDatePt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = d === 1 ? '1º' : String(d);
  return `${day} de ${MONTHS_PT[m - 1]} de ${y}`;
}

function must<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as unknown as T;
}

function debounce(fn: () => void, ms: number): () => void {
  let timer = 0;
  return () => {
    clearTimeout(timer);
    timer = window.setTimeout(fn, ms);
  };
}

function usdShort(v: number): string {
  return `US$ ${usdFmt.format(v)} bi`;
}
function usdLong(v: number): string {
  return `US$ ${usdFmt.format(v)} bilhões`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

function dataUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/${name}`;
}

// --- Autoscroll speed slider (logarithmic 50..6000 px/s) ---
function sliderToSpeed(slider: number): number {
  return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, slider / 100);
}
function speedToSlider(speed: number): number {
  return (100 * Math.log(speed / SPEED_MIN)) / Math.log(SPEED_MAX / SPEED_MIN);
}
function currentSpeed(): number {
  return sliderToSpeed(Number(speedInput.value));
}

// --- Column building ---
function addTicks(frag: DocumentFragment, height: number, w: number, salary: number): void {
  let i = 0;
  for (let y = MILESTONE_STEP; y < height; y += MILESTONE_STEP) {
    const months = y * w;
    const value = months * salary;
    const years = months / MONTHS_PER_YEAR;
    const lives = months / MONTHS_PER_LIFE;

    const tick = document.createElement('div');
    tick.className = `tick ${i % 2 === 0 ? 'tick--right' : 'tick--left'}`;
    tick.style.top = `${y}px`;
    tick.setAttribute('aria-hidden', 'true'); // decorative scale marker, not content

    const valueEl = document.createElement('span');
    valueEl.className = 'tick__value';
    valueEl.textContent = fmtBRLCompact(value);
    tick.append(
      valueEl,
      document.createTextNode(` · ${fmtYears(years)} de trabalho · ${fmtLives(lives)}`),
    );
    frag.appendChild(tick);
    i++;
  }
}

function buildSingleColumn(el: HTMLElement, valueBRL: number, salary: number, w: number): void {
  const height = Math.max(1, Math.ceil(monthsOf(valueBRL, salary) / w));
  el.style.setProperty('--col-w', `${w}px`);
  el.style.height = `${height}px`;
  const frag = document.createDocumentFragment();
  addTicks(frag, height, w, salary);
  el.replaceChildren(frag);
}

function buildTop5Column(el: HTMLElement, salary: number, w: number): void {
  const totalBRL = brlOf(data.totalUsd, fx);
  const totalHeight = Math.max(1, Math.ceil(monthsOf(totalBRL, salary) / w));
  el.style.setProperty('--col-w', `${w}px`);
  el.style.height = `${totalHeight}px`;

  const frag = document.createDocumentFragment();
  const people = data.people;
  top5Segments = [];
  let top = 0;

  people.forEach((person, index) => {
    let h = Math.round(monthsOf(brlOf(person.usd, fx), salary) / w);
    // Absorb rounding drift into the last segment so the parts fill the whole.
    if (index === people.length - 1) h = Math.max(1, totalHeight - top);

    const segment = document.createElement('div');
    segment.className = `segment segment--${index}`;
    segment.style.top = `${top}px`;
    segment.style.height = `${h}px`;
    frag.appendChild(segment);

    const boundary = document.createElement('div');
    boundary.className = 'boundary';
    boundary.style.top = `${top}px`;
    const pos = document.createElement('span');
    pos.className = 'boundary__pos';
    pos.textContent = `${person.posicao}º`;
    boundary.append(
      pos,
      document.createTextNode(` · ${person.nome} — ${usdShort(person.usd)} · ${person.fonte}`),
    );
    frag.appendChild(boundary);

    top5Segments.push({ name: person.nome, topLocal: top, height: h });
    top += h;
  });

  addTicks(frag, totalHeight, w, salary);
  el.replaceChildren(frag);
}

// --- Dynamic text registry (data-driven + salary-driven, all keyed by data-dyn) ---
function applyDynamic(): void {
  const salary = getSalary();
  const richestBRL = brlOf(data.richest.usd, fx);
  const top5BRL = brlOf(data.totalUsd, fx);
  const life = lifeSavings(salary);
  const yearsPerRow = colW / MONTHS_PER_YEAR;
  const forbesSource = `Forbes · lista anual, valores de ${monthYearPt(data.forbesRefDate)}`;

  const values: Record<string, string> = {
    // salary-dependent
    salary: fmtBRL(salary),
    'year-value': fmtBRL(salary * 12),
    'ten-years-value': fmtBRL(salary * 120),
    'life-value': fmtBRL(life),
    'life-value-2': fmtBRL(life),
    'years-per-row': `${fmtInt(yearsPerRow)} ${Math.round(yearsPerRow) === 1 ? 'ano' : 'anos'}`,
    'richest-years': fmtYears(yearsOf(richestBRL, salary)),
    'richest-lives': fmtLives(livesOf(richestBRL, salary)),
    'top5-years': fmtYears(yearsOf(top5BRL, salary)),
    'top5-lives': fmtLives(livesOf(top5BRL, salary)),
    'top5-lives-2': fmtLives(livesOf(top5BRL, salary)),
    'top5-area': fmtCountShort(monthsOf(top5BRL, salary)),
    'calc-time': isFinite(calcValue) ? calcDuration(calcValue, salary) : '—',
    // data-derived (independent of the visitor's salary)
    'richest-name': data.richest.nome,
    'richest-usd': usdLong(data.richest.usd),
    'richest-wealth-source': data.richest.fonte,
    'richest-brl': fmtBRLCompact(richestBRL),
    'top5-usd': usdLong(data.totalUsd),
    'top5-brl': fmtBRLCompact(top5BRL),
    'forbes-source': forbesSource,
    'forbes-date': fullDatePt(data.forbesRefDate),
    'fx-rate': fxFmt.format(data.fx),
    'fx-date': fullDatePt(data.fxDate),
    'min-wage': fmtBRL(data.minWage),
    'min-wage-law': data.minWageLaw,
    'min-wage-year': data.minWageYear,
  };

  document.querySelectorAll<HTMLElement>('[data-dyn]').forEach((el) => {
    const key = el.dataset.dyn;
    if (!key) return;
    if (key === 'life-under-million') {
      el.hidden = life >= 1e6;
      return;
    }
    const text = values[key];
    if (text !== undefined) el.textContent = text;
  });
}

function updateBadge(): void {
  salaryBadge.hidden = Math.abs(getSalary() - data.minWage) > 0.005;
}

// --- Footer source links, mounted from the fetched data ---
function mountSources(groups: { label: string; raw: { fontes: Source[]; acessado_em: string } | null }[]): void {
  const frag = document.createDocumentFragment();
  for (const group of groups) {
    if (!group.raw) continue;
    const wrap = document.createElement('div');
    const head = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = group.label;
    head.append(strong, document.createTextNode(` · acesso em ${group.raw.acessado_em}`));
    const ul = document.createElement('ul');
    for (const source of group.raw.fontes) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = source.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = source.nome;
      li.appendChild(a);
      ul.appendChild(li);
    }
    wrap.append(head, ul);
    frag.appendChild(wrap);
  }
  sourcesEl.replaceChildren(frag);
}

// --- Scroll-driven UI (HUD + readouts) ---
function cacheGeometry(): void {
  const scrollTop = window.scrollY;
  const richestRect = colRichest.getBoundingClientRect();
  const top5Rect = colTop5.getBoundingClientRect();
  const top5Top = top5Rect.top + scrollTop;

  geometry = [
    {
      top: richestRect.top + scrollTop,
      height: colRichest.offsetHeight,
      name: data.richest.nome,
      hud: hudRichest,
      segments: null,
    },
    {
      top: top5Top,
      height: colTop5.offsetHeight,
      name: data.people[0].nome,
      hud: hudTop5,
      segments: top5Segments.map((s) => ({
        name: s.name,
        top: top5Top + s.topLocal,
        bottom: top5Top + s.topLocal + s.height,
      })),
    },
  ];
}

function setHudName(hud: HTMLElement, name: string): void {
  const nameEl = hud.querySelector('[data-hud-name]');
  if (nameEl) nameEl.textContent = name;
}

function setHud(hud: HTMLElement, name: string, value: number, lives: number): void {
  const valueEl = hud.querySelector('[data-hud-value]');
  const livesEl = hud.querySelector('[data-hud-lives]');
  setHudName(hud, name);
  if (valueEl) valueEl.textContent = fmtBRLCompact(value);
  if (livesEl) livesEl.textContent = fmtLives(lives);
}

function updateScrollUI(): void {
  const salary = getSalary();
  const mid = window.scrollY + window.innerHeight / 2;
  let active: ColumnGeometry | null = null;

  for (const col of geometry) {
    if (mid < col.top || mid > col.top + col.height) continue;
    active = col;
    const depth = Math.min(Math.max(mid - col.top, 0), col.height);
    const months = depth * colW;
    const value = months * salary;
    const lives = months / MONTHS_PER_LIFE;

    let name = col.name;
    if (col.segments) {
      const seg = col.segments.find((s) => mid >= s.top && mid < s.bottom);
      if (seg) name = seg.name;
    }
    setHud(col.hud, name, value, lives);
    posReadout.textContent = `${fmtBRLCompact(value)} · ${fmtLives(lives)}`;
  }

  const speed = currentSpeed();
  if (active) {
    const yearsPerSecond = Math.round((speed * colW) / MONTHS_PER_YEAR);
    speedReadout.textContent = `≈ ${fmtInt(yearsPerSecond)} anos de trabalho por segundo`;
  } else {
    speedReadout.textContent = `${Math.round(speed)} px/s`;
    posReadout.textContent = '';
  }
}

// --- Full recompute (load / salary change / resize) ---
function recompute(): void {
  const salary = getSalary();
  colW = columnWidth(window.innerWidth);

  const docEl = document.documentElement;
  const prevMax = docEl.scrollHeight - window.innerHeight;
  const ratio = prevMax > 0 ? window.scrollY / prevMax : 0;

  buildSingleColumn(colRichest, brlOf(data.richest.usd, fx), salary, colW);
  buildTop5Column(colTop5, salary, colW);

  applyDynamic();
  updateBadge();

  const newMax = docEl.scrollHeight - window.innerHeight;
  const target = ratio * newMax;
  if (Math.abs(target - window.scrollY) > 2) window.scrollTo(0, target);
  // Resync the autoscroll baseline so this programmatic scroll is not mistaken
  // for a user interaction by the safety-net pause.
  autoscroll.sync();

  cacheGeometry();
  updateScrollUI();
}

// --- Wiring ---
function wireSalaryInput(): void {
  const commit = debounce(() => {
    const parsed = parseBRL(salaryInput.value);
    if (isFinite(parsed) && parsed > 0) setSalary(parsed);
  }, 300);
  salaryInput.addEventListener('input', commit);
  salaryInput.addEventListener('blur', () => {
    // Commit the current text before reformatting, so tabbing away within the
    // debounce window does not discard what the user just typed.
    const parsed = parseBRL(salaryInput.value);
    if (isFinite(parsed) && parsed > 0) setSalary(parsed);
    salaryInput.value = decimalFmt.format(getSalary());
  });
}

function wireCalculator(): void {
  calcInput.addEventListener('input', () => {
    const parsed = parseBRL(calcInput.value);
    calcValue = isFinite(parsed) && parsed > 0 ? parsed : NaN;
    const el = document.querySelector('[data-dyn="calc-time"]');
    if (el) {
      el.textContent = isFinite(calcValue) ? calcDuration(calcValue, getSalary()) : '—';
    }
  });
}

function updateControlsState(playing: boolean): void {
  btnPlay.textContent = playing ? '⏸' : '▶';
  btnPlay.setAttribute('aria-pressed', String(playing));
  btnPlay.setAttribute('aria-label', playing ? 'pausar rolagem' : 'rolar automaticamente');
}

function validateData(
  salario: RawSalario,
  cambio: RawCambio,
  bilionarios: RawBilionarios,
): void {
  if (!salario || !(Number(salario.valor_brl) > 0)) {
    throw new Error('salario-minimo.json inválido');
  }
  if (!cambio || !(Number(cambio.taxa_venda) > 0)) {
    throw new Error('cambio-usd-brl.json inválido');
  }
  if (
    !bilionarios ||
    !Array.isArray(bilionarios.top5) ||
    bilionarios.top5.length === 0 ||
    !(Number(bilionarios.total_top5_usd_bilhoes) > 0)
  ) {
    throw new Error('bilionarios-brasil.json inválido');
  }
}

// The controls ship disabled so they cannot be used (or clobbered) before the
// data resolves; this enables them once the page is fully mounted.
function enableControls(): void {
  for (const el of [salaryInput, calcInput, btnStart, btnPlay, speedInput]) {
    el.disabled = false;
  }
}

function wireControls(): void {
  speedInput.value = String(Math.round(speedToSlider(SPEED_DEFAULT)));
  speedInput.addEventListener('input', () => updateScrollUI());
  btnPlay.addEventListener('click', () => autoscroll.toggle());
}

function wireStart(): void {
  const reducedMotion =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  btnStart.addEventListener('click', () => {
    if (reducedMotion) {
      window.scrollBy({ top: window.innerHeight, behavior: 'auto' });
    } else {
      autoscroll.play();
    }
  });
}

export async function boot(): Promise<void> {
  salaryInput = must<HTMLInputElement>('#salario-input');
  salaryBadge = must<HTMLElement>('#salario-badge');
  calcInput = must<HTMLInputElement>('#calc-input');
  btnStart = must<HTMLButtonElement>('#btn-start');
  btnPlay = must<HTMLButtonElement>('#btn-play');
  speedInput = must<HTMLInputElement>('#speed');
  speedReadout = must<HTMLElement>('[data-speed-readout]');
  posReadout = must<HTMLElement>('[data-pos-readout]');
  colRichest = must<HTMLElement>('[data-column="richest"]');
  colTop5 = must<HTMLElement>('[data-column="top5"]');
  hudRichest = must<HTMLElement>('[data-hud="richest"]');
  hudTop5 = must<HTMLElement>('[data-hud="top5"]');
  sourcesEl = must<HTMLElement>('[data-sources]');
  errorEl = must<HTMLElement>('#load-error');

  try {
    // Fetch the data that drives the whole page. The three core files are
    // required; income data only feeds the footer sources, so it is optional.
    const [salario, cambio, bilionarios] = await Promise.all([
      fetchJson<RawSalario>(dataUrl('salario-minimo.json')),
      fetchJson<RawCambio>(dataUrl('cambio-usd-brl.json')),
      fetchJson<RawBilionarios>(dataUrl('bilionarios-brasil.json')),
    ]);
    validateData(salario, cambio, bilionarios);
    const renda = await fetchJson<RawRenda>(dataUrl('renda-brasil.json')).catch(() => null);

    const toPerson = (p: RawPerson): Person => ({
      posicao: p.posicao,
      nome: p.nome,
      usd: p.patrimonio_usd_bilhoes,
      fonte: p.fonte_riqueza,
    });

    data = {
      minWage: salario.valor_brl,
      minWageLaw: salario.instrumento_legal,
      minWageYear: (salario.vigencia || '').slice(0, 4),
      fx: cambio.taxa_venda,
      fxDate: cambio.data_cotacao,
      richest: toPerson(bilionarios.top5[0]),
      people: bilionarios.top5.map(toPerson),
      totalUsd: bilionarios.total_top5_usd_bilhoes,
      forbesRefDate: bilionarios.data_referencia_valores,
    };
    fx = data.fx;

    initSalary(data.minWage);
    // The field ships empty and disabled; fill it once with the resolved salary.
    if (!salaryInput.value.trim()) salaryInput.value = decimalFmt.format(getSalary());
    setHudName(hudRichest, data.richest.nome);
    setHudName(hudTop5, data.people[0].nome);
    mountSources([
      { label: `Salário mínimo (${data.minWageYear})`, raw: salario },
      { label: 'Câmbio do dólar (PTAX)', raw: cambio },
      { label: `Bilionários (Forbes ${data.forbesRefDate.slice(0, 4)})`, raw: bilionarios },
      { label: 'Renda e desigualdade (IBGE, OCDE)', raw: renda },
    ]);

    autoscroll = createAutoscroll({ getSpeed: currentSpeed, onStateChange: updateControlsState });

    wireSalaryInput();
    wireCalculator();
    wireControls();
    wireStart();

    subscribe(() => recompute());
    window.addEventListener('resize', debounce(recompute, 200));
    window.addEventListener(
      'scroll',
      () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          updateScrollUI();
          scrollTicking = false;
        });
      },
      { passive: true },
    );

    recompute();
    enableControls();
  } catch (err) {
    console.error('Falha ao carregar os dados:', err);
    errorEl.hidden = false;
  }
}
