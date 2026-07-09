import {
  MONTHS_PER_YEAR,
  SPEED_BASE,
  BILLION_BRL,
  RULER_STEP,
  RAMP_STEPS,
} from '../config';
import {
  monthsOf,
  yearsOf,
  livesOf,
  lifeSavings,
  brlOf,
  columnWidth,
  metricColumnWidth,
  fmtBRL,
  fmtBRLCompact,
  fmtBRLFull,
  fmtInt,
  fmtYears,
  fmtLives,
  fmtCountShort,
  fmtDuration,
  parseBRL,
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
  fonte_riqueza_desde?: number;
}
interface RawBilionarios {
  top5: RawPerson[];
  total_top5_usd_bilhoes: number;
  data_referencia_valores: string;
  fontes: Source[];
  acessado_em: string;
}
interface RawGrowth {
  taxa_real_anual: number;
  fontes: Source[];
  acessado_em: string;
}
interface RawPatrimonio {
  valor_brl: number;
  faixa_brl: { min: number; max: number };
  fontes: Source[];
  acessado_em: string;
}
interface RawMundo {
  pessoa_mais_rica: {
    nome: string;
    patrimonio_usd_bilhoes: number;
    ranking_mundial: number;
    fonte_riqueza: string;
  };
  data_referencia_valores: string;
  fontes: Source[];
  acessado_em: string;
}
// Public-scale references for the mid-column phrases (D-V2-11). Optional: fetched
// like crescimento-real-salario, and anything that depends on it is skipped when
// it fails to load.
interface RawPais {
  id: string;
  nome: string;
  preposicao: string;
  pib_usd_bilhoes: number;
  ano_referencia: number;
}
interface RawCusto {
  id: string;
  nome: string;
  valor_brl?: number;
  componentes?: { valor_aluno_ano_brl: number; matriculas: number };
}
interface RawComparacoes {
  paises: RawPais[];
  custos: RawCusto[];
  fontes: Source[];
  acessado_em: string;
}

// --- Normalized model the UI renders from ---
interface Person {
  posicao: number;
  nome: string;
  usd: number;
  fonte: string;
  since?: number; // year the fortune's source began (for the time-rate phrase)
}
interface Country {
  id: string;
  nome: string;
  prep: string; // "de" / "do" / "da" for the GDP phrase
  usd: number;
}
interface Comparacoes {
  countries: Country[];
  hospitalBRL: number;
  crecheBRL: number;
  eduAlunoAno: number;
  eduMatriculas: number;
  analfabetismoBRL: number;
  casaMediaBRL: number;
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
  nowYear: number;
  realGrowth: number;
  family: number;
  familyRange: { min: number; max: number };
  musk: Person;
  muskRefDate: string;
  comparacoes: Comparacoes | null;
}

// A sticky beat that holds inside a column at a given BRL depth (D9). Informational
// beats keep the plaque look; 'phrase' cards are shouted display type (D-V2-9).
interface ColMilestone {
  atBRL: number;
  html: string;
  kind?: 'beat' | 'phrase';
}
// One metric-view column: a solid pixel area plus its in-column milestones.
interface ColumnDef {
  id: string;
  el: HTMLElement;
  valueBRL: number;
  milestones: ColMilestone[];
}
// Cached scroll geometry for a rendered column.
interface ColumnGeometry {
  id: string;
  top: number;
  height: number;
  // The column's actual rendered width, which the D10 guard may have widened past
  // the module-level colW. Depth-to-BRL math must use this, not colW.
  width: number;
}

// --- Module state ---
let data!: PageData;
let fx = 0;
let colW = 120;
let userMult = 1;
let lastRamp = 1;
let toastTimer = 0;
let scrollTicking = false;
let autoscroll: Autoscroll;
let columns: ColumnDef[] = [];
let geometry: ColumnGeometry[] = [];
// Measuring line + counter accent: recompute the accent only when the active
// column actually changes, so no per-frame style write.
let lastActiveId: string | null = null;

// A calendar year in seconds (365,25 days), for the time-rate phrase.
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

// --- Element references (assigned in boot) ---
let salaryInput!: HTMLInputElement;
let modeMin!: HTMLInputElement;
let modeCustom!: HTMLInputElement;
let customSalaryField!: HTMLElement;
let btnStart!: HTMLButtonElement;
let btnPlay!: HTMLButtonElement;
let speedSelect!: HTMLSelectElement;
let speedSelectStart!: HTMLSelectElement;
let speedReadout!: HTMLElement;
let progressEl!: HTMLElement;
let toastEl!: HTMLElement;
let controlsEl!: HTMLElement;
let measureLine!: HTMLElement;
let counterEl!: HTMLElement;
let posFull!: HTMLElement;
let posShort!: HTMLElement;
let colStartEl!: HTMLElement;
let colStartTop = 0;
let familyBlock!: HTMLElement;
let colBilhao!: HTMLElement;
let colRichest!: HTMLElement;
let colMusk!: HTMLElement;
let errorEl!: HTMLElement;

const decimalFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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

function usdLong(v: number): string {
  return `US$ ${usdFmt.format(v)} bilhões`;
}

// Normalize the optional comparacoes file, or return null so the phrases that
// depend on it are simply skipped. If any piece a phrase needs is missing, drop
// the whole set rather than render a broken number.
function toComparacoes(raw: RawComparacoes | null): Comparacoes | null {
  if (!raw || !Array.isArray(raw.paises) || !Array.isArray(raw.custos)) return null;
  const custo = (id: string): RawCusto | undefined => raw.custos.find((x) => x.id === id);
  const hospital = custo('hospital-publico-grande');
  const creche = custo('escola-publica-fnde');
  const educar = custo('educar-todos-alunos-um-ano');
  const analf = custo('erradicar-analfabetismo');
  const casa = custo('casa-media-brasil');
  const ok = (v: unknown): v is number => typeof v === 'number' && v > 0;
  if (!ok(hospital?.valor_brl) || !ok(creche?.valor_brl) || !ok(analf?.valor_brl) || !ok(casa?.valor_brl)) {
    return null;
  }
  if (!ok(educar?.componentes?.valor_aluno_ano_brl) || !ok(educar?.componentes?.matriculas)) {
    return null;
  }
  return {
    countries: raw.paises
      .filter((p) => ok(p.pib_usd_bilhoes))
      .map((p) => ({ id: p.id, nome: p.nome, prep: p.preposicao, usd: p.pib_usd_bilhoes })),
    hospitalBRL: hospital!.valor_brl!,
    crecheBRL: creche!.valor_brl!,
    eduAlunoAno: educar!.componentes!.valor_aluno_ano_brl,
    eduMatriculas: educar!.componentes!.matriculas,
    analfabetismoBRL: analf!.valor_brl!,
    casaMediaBRL: casa!.valor_brl!,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

function dataUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/${name}`;
}

// --- Autoscroll speed (base pixels per second × user multiplier × hidden ramp; D5/D5b) ---
function currentSpeed(): number {
  return SPEED_BASE * userMult * rampMult();
}

// The hidden progressive ramp factor for the current scroll depth (D5b). Returns 1
// outside a ramped column; inside, the largest step whose BRL depth has been passed.
function rampMult(): number {
  const salary = getSalary();
  const mid = window.scrollY + window.innerHeight / 2;
  for (const col of geometry) {
    if (mid < col.top || mid > col.top + col.height) continue;
    const steps = RAMP_STEPS[col.id];
    if (!steps || steps.length === 0) return 1;
    const depth = Math.min(Math.max(mid - col.top, 0), col.height);
    const value = depth * col.width * salary;
    let mult = 1;
    for (const step of steps) {
      if (step.atBRL <= value) mult = step.mult;
    }
    return mult;
  }
  return 1;
}

// --- Column building (metric view: solid area + CSS ruler + sticky beats; D6/D7/D9) ---
function buildWealthColumn(def: ColumnDef, salary: number, baseWidth: number): void {
  const months = monthsOf(def.valueBRL, salary);
  // D10: the column is widened (kept a multiple of 12) when it would otherwise be
  // taller than the browser's element-height limit; metricColumnWidth owns that
  // rule so depth math elsewhere (e.g. the ruler-step phrase) can reuse it.
  const w = metricColumnWidth(def.valueBRL, salary, baseWidth);
  const height = Math.max(1, Math.ceil(months / w));
  def.el.style.setProperty('--col-w', `${w}px`);
  def.el.style.height = `${height}px`;

  // Ruler key chip: what one ruler mark is worth, in money and in work-time.
  const rulerKey = document.createElement('div');
  rulerKey.className = 'ruler-key';
  rulerKey.setAttribute('aria-hidden', 'true'); // decorative scale annotation
  const keyLabel = document.createElement('span');
  keyLabel.className = 'ruler-key__label panel';
  keyLabel.textContent =
    `cada traço = ${fmtBRLCompact(RULER_STEP * w * salary)}` +
    ` · ${fmtYears((RULER_STEP * w) / MONTHS_PER_YEAR)} de trabalho`;
  rulerKey.append(keyLabel);

  const px = (v: number): number => Math.round(monthsOf(v, salary) / w);

  // Intro cards from the column's <template data-col-intro>. The intro run spans
  // [0, introEnd), where introEnd is the first milestone (or the column bottom).
  // That run is split evenly among the template's steps; after the D-V3-4 merge
  // there is one step per column, so its single card holds the whole run. A step
  // gets no card if its share is under 800px (D-V3-9).
  const introWrappers: HTMLElement[] = [];
  const section = def.el.closest('[data-col-section]');
  const tpl = section?.querySelector<HTMLTemplateElement>('template[data-col-intro]');
  if (tpl) {
    const steps = tpl.content.querySelectorAll<HTMLElement>('[data-intro-step]');
    const firstMilestonePx = def.milestones.length ? px(def.milestones[0].atBRL) : height;
    const introEnd = Math.min(firstMilestonePx, height);
    const slot = steps.length ? introEnd / steps.length : 0;
    steps.forEach((step, i) => {
      const top = Math.round(i * slot);
      const bottom = i + 1 < steps.length ? Math.round((i + 1) * slot) : introEnd;
      const wrapperHeight = bottom - top;
      if (wrapperHeight < 800) return; // no room to hold this step

      const wrapper = document.createElement('div');
      wrapper.className = 'col-note col-note--intro';
      wrapper.style.top = `${top}px`;
      wrapper.style.height = `${wrapperHeight}px`;
      const card = document.createElement('div');
      card.className = 'col-note__card col-note__card--intro panel';
      card.innerHTML = step.innerHTML; // authored here only; never user input
      wrapper.appendChild(card);
      introWrappers.push(wrapper);
    });
  }

  // Sticky in-column milestone cards positioned by BRL depth.
  const wrappers: HTMLElement[] = [];
  def.milestones.forEach((m, i) => {
    const nextBRL = i + 1 < def.milestones.length ? def.milestones[i + 1].atBRL : def.valueBRL;
    const top = px(m.atBRL);
    const wrapperHeight = px(nextBRL) - top;
    if (wrapperHeight < 800) return; // no room to hold this card, skip it

    const wrapper = document.createElement('div');
    wrapper.className = 'col-note';
    wrapper.style.top = `${top}px`;
    wrapper.style.height = `${wrapperHeight}px`;
    const card = document.createElement('div');
    card.className =
      m.kind === 'phrase'
        ? 'col-note__card col-note__card--phrase panel'
        : 'col-note__card panel';
    card.innerHTML = m.html; // authored here only; never user input
    wrapper.appendChild(card);
    wrappers.push(wrapper);
  });

  def.el.replaceChildren(rulerKey, ...introWrappers, ...wrappers);
}

// The three metric columns, with their in-column beats and phrases. Rebuilt on
// every salary change so all depths and derived numbers track the reference
// salary. Every number comes from live data (fortunes, PTAX, family patrimônio,
// life savings, comparacoes); nothing is hardcoded in the copy. Milestones are
// sorted by BRL depth at the end because buildWealthColumn derives each hold
// length from the next milestone (D-V2-9).
function buildColumnDefs(salary: number): ColumnDef[] {
  const richestBRL = brlOf(data.richest.usd, fx);
  const muskBRL = brlOf(data.musk.usd, fx);
  // Sum of the five richest Brazilians, reused as one narrative beat inside Musk (D3).
  const richBrazilSumBRL = brlOf(data.totalUsd, fx);
  const c = data.comparacoes;
  const country = (id: string): Country | undefined => c?.countries.find((x) => x.id === id);

  // --- Richest column: half-fortune beat, illiteracy beat, Saverin time phrase ---
  const richestMs: ColMilestone[] = [
    {
      atBRL: richestBRL / 2,
      html:
        `Metade da fortuna de ${data.richest.nome}. Você já rolou ` +
        `${fmtYears(yearsOf(richestBRL / 2, salary))} de trabalho.`,
    },
  ];
  if (c) {
    richestMs.push({
      atBRL: c.analfabetismoBRL,
      html:
        'Erradicar o analfabetismo no Brasil custaria isto. Você acabou de rolar. ' +
        '<span class="col-note__fine">estimativa · <a href="/referencias">/referencias</a></span>',
    });
  }
  if (data.richest.since) {
    // Rate = fortune ÷ seconds since the fortune's source began, using a fixed
    // "now" of the data's reference year (nowYear) so the number is stable and
    // citable. Time = how long the richest person would need, at that average
    // rate, to match a whole visitor lifetime of savings.
    const secondsSince = (data.nowYear - data.richest.since) * SECONDS_PER_YEAR;
    const rateBRLPerSec = richestBRL / secondsSince;
    const lifeSeconds = lifeSavings(salary, data.realGrowth) / rateBRLPerSec;
    richestMs.push({
      atBRL: 0.75 * richestBRL,
      kind: 'phrase',
      html:
        `${data.richest.nome} precisaria de cerca de <strong>${fmtDuration(lifeSeconds)}</strong> ` +
        'para juntar tudo o que você vai juntar na vida inteira.',
    });
  }

  // --- Musk column: existing beats interleaved with public-scale phrases ---
  const muskMs: ColMilestone[] = [
    {
      atBRL: richestBRL,
      html:
        `Você acabou de passar TODA a fortuna de ${data.richest.nome}, a pessoa mais rica ` +
        'do Brasil. Continua.',
    },
    { atBRL: 4e11, kind: 'phrase', html: 'Continue firme, você não está nem perto.' },
    { atBRL: richBrazilSumBRL, html: 'Os 5 brasileiros mais ricos, somados, terminam aqui.' },
    { atBRL: 1e12, html: 'R$ 1 trilhão. Um milhão de milhões.' },
    {
      atBRL: 1.3e12,
      kind: 'phrase',
      html:
        'Você se abaixaria para pegar 5 centavos do chão? Para o patrimônio de uma família ' +
        `típica, é isso que 5 centavos valem. Para ${data.musk.nome}, a mesma proporção seria ` +
        `<strong>${fmtBRLCompact((0.05 * muskBRL) / data.family)}</strong> no chão.`,
    },
    { atBRL: muskBRL / 2, kind: 'phrase', html: 'Estamos apenas na metade. Isso mesmo.' },
    { atBRL: 2.6e12, kind: 'phrase', html: 'É isso mesmo, está cansado?' },
    { atBRL: 3e12, html: 'R$ 3 trilhões. Última acelerada.' },
  ];
  if (c) {
    // GDP ladder: each country's PIB in BRL lands inside the column, well spread
    // (Honduras/Paraguai are skipped: too close to the richest-pass beat).
    for (const id of ['bolivia', 'portugal', 'chile', 'argentina']) {
      const co = country(id);
      if (!co) continue;
      muskMs.push({
        atBRL: brlOf(co.usd, fx),
        html: `Você acabou de passar o PIB ${co.prep} ${co.nome}. Tudo que o país produz num ano.`,
      });
    }
    muskMs.push({
      atBRL: c.eduAlunoAno * c.eduMatriculas,
      html:
        'Isto pagaria um ano de escola pública para todos os ' +
        `<strong>${fmtCountShort(c.eduMatriculas)}</strong> de alunos do Brasil.`,
    });
    muskMs.push({
      atBRL: 2.9e12,
      kind: 'phrase',
      html:
        `O que você já rolou construiria <strong>${fmtInt(2.9e12 / c.hospitalBRL)}</strong> ` +
        'hospitais públicos de grande porte.',
    });
    muskMs.push({
      atBRL: 3.4e12,
      kind: 'phrase',
      html: `Só o que você rolou até aqui paga <strong>${fmtCountShort(3.4e12 / c.crecheBRL)}</strong> creches novas.`,
    });
    // Uses the column's REAL width (D10 may widen it) so one ruler step is priced
    // at the same scale the ruler is actually drawn.
    const muskW = metricColumnWidth(muskBRL, salary, colW);
    muskMs.push({
      atBRL: 3.8e12,
      kind: 'phrase',
      html:
        'Cada traço da régua ao lado = ' +
        `<strong>${fmtInt((RULER_STEP * muskW * salary) / c.casaMediaBRL)}</strong> casas médias no Brasil.`,
    });
  }

  const defs: ColumnDef[] = [
    { id: 'bilhao', el: colBilhao, valueBRL: BILLION_BRL, milestones: [] },
    { id: 'richest', el: colRichest, valueBRL: richestBRL, milestones: richestMs },
    { id: 'musk', el: colMusk, valueBRL: muskBRL, milestones: muskMs },
  ];
  for (const def of defs) def.milestones.sort((a, b) => a.atBRL - b.atBRL);
  return defs;
}

// --- Dynamic text registry (data-driven + salary-driven, all keyed by data-dyn) ---
function applyDynamic(): void {
  const salary = getSalary();
  const richestBRL = brlOf(data.richest.usd, fx);
  const muskBRL = brlOf(data.musk.usd, fx);
  const life = lifeSavings(salary, data.realGrowth);
  const forbesSource = `Forbes · lista anual, valores de ${monthYearPt(data.forbesRefDate)}`;
  const worldForbesSource = `Forbes · lista anual, valores de ${monthYearPt(data.muskRefDate)}`;

  const values: Record<string, string> = {
    // salary-dependent
    salary: fmtBRL(salary),
    'year-value': fmtBRL(salary * 12),
    'family-worth': fmtBRLCompact(data.family),
    'family-range': `${fmtBRLCompact(data.familyRange.min)} e ${fmtBRLCompact(data.familyRange.max)}`,
    'life-value': fmtBRL(life),
    'life-vs-family': `${fmtInt(life / data.family)} vezes`,
    'billion-years': fmtYears(yearsOf(BILLION_BRL, salary)),
    'richest-years': fmtYears(yearsOf(richestBRL, salary)),
    'richest-lives': fmtLives(livesOf(richestBRL, salary, data.realGrowth)),
    'musk-years': fmtYears(yearsOf(muskBRL, salary)),
    'musk-lives': fmtLives(livesOf(muskBRL, salary, data.realGrowth)),
    'musk-area': fmtCountShort(monthsOf(muskBRL, salary)),
    // data-derived (independent of the visitor's salary)
    'min-wage': fmtBRL(data.minWage),
    'richest-name': data.richest.nome,
    'richest-usd': usdLong(data.richest.usd),
    'richest-brl': fmtBRLCompact(richestBRL),
    'richest-wealth-source': data.richest.fonte,
    'forbes-source': forbesSource,
    'musk-name': data.musk.nome,
    'musk-usd': usdLong(data.musk.usd),
    'musk-brl': fmtBRLCompact(muskBRL),
    'musk-wealth-source': data.musk.fonte,
    'world-forbes-source': worldForbesSource,
  };

  document.querySelectorAll<HTMLElement>('[data-dyn]').forEach((el) => {
    const key = el.dataset.dyn;
    if (!key) return;
    const text = values[key];
    if (text !== undefined) el.textContent = text;
  });

  // The family patrimônio block is shown in true CSS-pixel size (~12 × 10 px at
  // minimum wage): 12px wide (one year per row) by one row per year of savings.
  const rows = Math.max(1, Math.round(monthsOf(data.family, salary) / MONTHS_PER_YEAR));
  familyBlock.style.width = '12px';
  familyBlock.style.height = `${rows}px`;
}

// --- Scroll-driven UI (readouts + progress bar + hidden ramps) ---
function cacheGeometry(): void {
  const scrollTop = window.scrollY;
  // Where the fortunes begin: the cluster stays idle until the viewport reaches
  // this band, so the top of the page has no fixed chrome (D-V2-5).
  colStartTop = colStartEl.getBoundingClientRect().top + scrollTop;
  geometry = columns.map((def) => {
    const rect = def.el.getBoundingClientRect();
    return {
      id: def.id,
      top: rect.top + scrollTop,
      height: def.el.offsetHeight,
      width: def.el.offsetWidth,
    };
  });
}

// The active column's fill color, read from its section's --col-fill so the
// indicator label can adopt it without duplicating the palette (D-V2-8).
function accentForColumn(id: string): string {
  const def = columns.find((c) => c.id === id);
  const section = def?.el.closest('[data-col-section]');
  return section ? getComputedStyle(section).getPropertyValue('--col-fill').trim() : '';
}

function updateScrollUI(): void {
  const salary = getSalary();
  const mid = window.scrollY + window.innerHeight / 2;

  // Reveal the cluster once the viewport reaches the fortunes (one-way latch).
  if (window.scrollY + window.innerHeight >= colStartTop) {
    controlsEl.removeAttribute('data-idle');
  }

  let active: ColumnGeometry | null = null;
  for (const col of geometry) {
    if (mid >= col.top && mid <= col.top + col.height) {
      active = col;
      break;
    }
  }

  if (active) {
    const depth = Math.min(Math.max(mid - active.top, 0), active.height);
    const value = depth * active.width * salary;

    // Counter: the full value and the short form both track the mid-viewport line
    // every frame; the per-column accent changes only when the active column
    // changes, so no per-frame style write. The line and counter reveal together.
    posFull.textContent = fmtBRLFull(value);
    posShort.textContent = `${fmtCountShort(value)} · ${fmtLives(livesOf(value, salary, data.realGrowth))}`;
    if (active.id !== lastActiveId) {
      controlsEl.dataset.activeCol = active.id;
      controlsEl.style.setProperty('--pos-accent', accentForColumn(active.id));
      lastActiveId = active.id;
    }
    measureLine.classList.add('measure-line--on');
    counterEl.classList.add('pos-counter--on');

    const yearsPerSecond = Math.round((currentSpeed() * active.width) / MONTHS_PER_YEAR);
    speedReadout.textContent = `≈ ${fmtCountShort(yearsPerSecond)} anos de trabalho/s`;

    // Announce each hidden speed ramp as its BRL depth is crossed while playing (D5b).
    const steps = RAMP_STEPS[active.id] || [];
    let crossed: { atBRL: number; mult: number } | null = null;
    for (const step of steps) {
      if (step.atBRL <= value) crossed = step;
    }
    const mult = crossed ? crossed.mult : 1;
    if (crossed && mult > lastRamp && autoscroll.isPlaying()) {
      showToast(`Acelerando: ${mult}× · você passou ${fmtBRLCompact(crossed.atBRL)}`);
    }
    lastRamp = mult;
  } else {
    speedReadout.textContent = '';
    lastRamp = 1;
    // No column under the mid-viewport line: fade the line and counter out and
    // force a fresh accent recompute when the next column becomes active. The
    // cluster (legend + player) stays visible once revealed.
    measureLine.classList.remove('measure-line--on');
    counterEl.classList.remove('pos-counter--on');
    lastActiveId = null;
  }

  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progressEl.style.width = `${pct}%`;
}

// Ephemeral status toast (fired by the speed ramps). Restarts its own auto-hide
// timer on every call so rapid announcements do not stack.
function showToast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 4000);
}

// --- Full recompute (load / salary change / resize) ---
function recompute(): void {
  const salary = getSalary();
  colW = columnWidth(window.innerWidth);

  const docEl = document.documentElement;
  const prevMax = docEl.scrollHeight - window.innerHeight;
  const ratio = prevMax > 0 ? window.scrollY / prevMax : 0;

  columns = buildColumnDefs(salary);
  for (const def of columns) buildWealthColumn(def, salary, colW);

  applyDynamic();

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

function wireSalaryMode(): void {
  // Restore the mode implied by the persisted salary: a value that differs from
  // the minimum wage means the visitor previously typed a custom salary.
  if (Math.abs(getSalary() - data.minWage) > 0.005) {
    modeCustom.checked = true;
    customSalaryField.hidden = false;
    salaryInput.value = decimalFmt.format(getSalary());
  } else {
    modeMin.checked = true;
    customSalaryField.hidden = true;
  }

  modeMin.addEventListener('change', () => {
    if (!modeMin.checked) return;
    customSalaryField.hidden = true;
    setSalary(data.minWage);
  });
  modeCustom.addEventListener('change', () => {
    if (!modeCustom.checked) return;
    customSalaryField.hidden = false;
    salaryInput.focus();
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
  patrimonio: RawPatrimonio,
  mundo: RawMundo,
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
  if (
    !patrimonio ||
    !(Number(patrimonio.valor_brl) > 0) ||
    !patrimonio.faixa_brl ||
    !(Number(patrimonio.faixa_brl.min) > 0) ||
    !(Number(patrimonio.faixa_brl.max) > 0)
  ) {
    throw new Error('patrimonio-familia.json inválido');
  }
  if (!mundo || !mundo.pessoa_mais_rica || !(Number(mundo.pessoa_mais_rica.patrimonio_usd_bilhoes) > 0)) {
    throw new Error('bilionarios-mundo.json inválido');
  }
}

// The controls ship disabled so they cannot be used (or clobbered) before the
// data resolves; this enables them once the page is fully mounted.
function enableControls(): void {
  for (const el of [salaryInput, modeMin, modeCustom, btnStart, btnPlay, speedSelect, speedSelectStart]) {
    el.disabled = false;
  }
}

function wireControls(): void {
  // Two speed selects (col-start band + cluster). A change on either sets userMult
  // and mirrors its value into the other so they never disagree (D-V3-3).
  const selects = [speedSelect, speedSelectStart];
  const onSelectChange = (source: HTMLSelectElement): void => {
    const mult = Number(source.value);
    if (!isFinite(mult) || mult <= 0) return;
    userMult = mult;
    for (const other of selects) {
      if (other !== source) other.value = source.value;
    }
    updateScrollUI();
  };
  for (const select of selects) {
    select.addEventListener('change', () => onSelectChange(select));
  }
  btnPlay.addEventListener('click', () => autoscroll.toggle());
}

function wireStart(): void {
  btnStart.addEventListener('click', () => autoscroll.play());
}

// Wire the methodology info popover independently of the data fetch, so it
// works immediately. CSS handles hover; this handles tap/click (iOS Safari does
// not reliably focus buttons on tap, so :focus-within alone is not enough).
export function wireScaleInfo(): void {
  const info = document.querySelector<HTMLElement>('.scale-info');
  const btn = info?.querySelector<HTMLButtonElement>('.scale-info__btn');
  if (!info || !btn) return;

  const close = (): void => {
    info.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = info.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!info.contains(e.target as Node)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

export async function boot(): Promise<void> {
  salaryInput = must<HTMLInputElement>('#salario-input');
  modeMin = must<HTMLInputElement>('#mode-min');
  modeCustom = must<HTMLInputElement>('#mode-custom');
  customSalaryField = must<HTMLElement>('#custom-salary-field');
  btnStart = must<HTMLButtonElement>('#btn-start');
  btnPlay = must<HTMLButtonElement>('#btn-play');
  speedSelect = must<HTMLSelectElement>('#speed-select');
  speedSelectStart = must<HTMLSelectElement>('#speed-select-start');
  speedReadout = must<HTMLElement>('[data-speed-readout]');
  progressEl = must<HTMLElement>('[data-progress]');
  toastEl = must<HTMLElement>('#toast');
  controlsEl = must<HTMLElement>('[data-cluster]');
  measureLine = must<HTMLElement>('[data-measure-line]');
  counterEl = must<HTMLElement>('[data-pos-counter]');
  posFull = must<HTMLElement>('[data-pos-full]');
  posShort = must<HTMLElement>('[data-pos-short]');
  colStartEl = must<HTMLElement>('#col-start');
  familyBlock = must<HTMLElement>('[data-family-block]');
  colBilhao = must<HTMLElement>('[data-column="bilhao"]');
  colRichest = must<HTMLElement>('[data-column="richest"]');
  colMusk = must<HTMLElement>('[data-column="musk"]');
  errorEl = must<HTMLElement>('#load-error');

  try {
    // Fetch the data that drives the whole page. All five files are required;
    // real wage growth only refines the "vidas" comparison, so it stays optional.
    const [salario, cambio, bilionarios, patrimonio, mundo] = await Promise.all([
      fetchJson<RawSalario>(dataUrl('salario-minimo.json')),
      fetchJson<RawCambio>(dataUrl('cambio-usd-brl.json')),
      fetchJson<RawBilionarios>(dataUrl('bilionarios-brasil.json')),
      fetchJson<RawPatrimonio>(dataUrl('patrimonio-familia.json')),
      fetchJson<RawMundo>(dataUrl('bilionarios-mundo.json')),
    ]);
    validateData(salario, cambio, bilionarios, patrimonio, mundo);
    // Optional data: real wage growth refines the "vidas" comparison, and the
    // public-scale comparisons feed the mid-column phrases. Both are fetched with
    // a .catch so a missing file degrades gracefully instead of breaking the page.
    const growth = await fetchJson<RawGrowth>(
      dataUrl('crescimento-real-salario.json'),
    ).catch(() => null);
    const comparacoesRaw = await fetchJson<RawComparacoes>(
      dataUrl('comparacoes-publicas.json'),
    ).catch(() => null);

    const toPerson = (p: RawPerson): Person => ({
      posicao: p.posicao,
      nome: p.nome,
      usd: p.patrimonio_usd_bilhoes,
      fonte: p.fonte_riqueza,
      since: p.fonte_riqueza_desde,
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
      // Fixed "now" for the time-rate phrase: the year the data was captured.
      nowYear: Number((bilionarios.acessado_em || '').slice(0, 4)) || new Date().getFullYear(),
      realGrowth: growth && Number(growth.taxa_real_anual) > 0 ? growth.taxa_real_anual : 0,
      family: patrimonio.valor_brl,
      familyRange: patrimonio.faixa_brl,
      musk: {
        posicao: mundo.pessoa_mais_rica.ranking_mundial,
        nome: mundo.pessoa_mais_rica.nome,
        usd: mundo.pessoa_mais_rica.patrimonio_usd_bilhoes,
        fonte: mundo.pessoa_mais_rica.fonte_riqueza,
      },
      muskRefDate: mundo.data_referencia_valores,
      comparacoes: toComparacoes(comparacoesRaw),
    };
    fx = data.fx;

    initSalary(data.minWage);
    // The field ships empty and disabled; fill it once with the resolved salary.
    if (!salaryInput.value.trim()) salaryInput.value = decimalFmt.format(getSalary());

    autoscroll = createAutoscroll({ getSpeed: currentSpeed, onStateChange: updateControlsState });

    wireSalaryInput();
    wireSalaryMode();
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
