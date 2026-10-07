import { MONTHS_PER_YEAR, BRL_PER_PIXEL, SPEED_BASE, SPEED_MULTIPLIERS, RULER_STEP } from '../config';
import {
  pixelsOf,
  brlAtDepth,
  pixelBlock,
  yearsOf,
  livesOf,
  lifeEarnings,
  columnWidth,
  metricColumnWidth,
  fmtBRL,
  fmtBRLCompact,
  fmtBRLFull,
  fmtInt,
  fmtYears,
  fmtLives,
} from './scale';
import { buildCheckpoints } from './checkpoints';
import type { Checkpoint } from './checkpoints';
import { loadPageData } from './state';
import type { PageData } from './state';
import { createAutoscroll } from './autoscroll';
import type { Autoscroll } from './autoscroll';

let data: PageData;
let autoscroll: Autoscroll;
let userMult = 1;
let scrollTicking = false;
let geometry = { top: 0, height: 0, width: 0 };
let checkpointCards: { atBRL: number; element: HTMLElement }[] = [];
let activeCard: HTMLElement | undefined;
let column: HTMLElement;
let btnStart: HTMLButtonElement;
let btnPlay: HTMLButtonElement;
let btnTop: HTMLButtonElement;
let speedSelect: HTMLSelectElement;
let progressEl: HTMLElement;
let controlsEl: HTMLElement;
let measureLine: HTMLElement;
let counterEl: HTMLElement;
let posFull: HTMLElement;
let posShort: HTMLElement;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}

function applyDynamic(): void {
  const salary = data.salario.valor_brl;
  const amount = data.filme.pedido_brl;
  const values: Record<string, string> = {
    'min-wage': fmtBRLFull(salary),
    'min-wage-year': data.salario.vigencia.slice(0, 4),
    'year-value': fmtBRLFull(salary * MONTHS_PER_YEAR),
    'earnings-value': fmtBRLFull(lifeEarnings(salary)),
    'movie-title': data.filme.titulo,
    'requested-brl': fmtBRLCompact(amount),
    'requested-usd': `US$ ${fmtInt(data.filme.pedido_usd / 1e6)} milhões`,
    'movie-years': fmtYears(yearsOf(amount, salary)),
    'movie-lives': fmtLives(livesOf(amount, salary)),
    'movie-area': fmtInt(pixelsOf(amount)),
    'earnings-area': fmtInt(pixelsOf(lifeEarnings(salary))),
    'column-width': fmtInt(column.getBoundingClientRect().width),
    'row-value': fmtBRL(column.getBoundingClientRect().width * BRL_PER_PIXEL),
    'ruler-value': fmtBRLCompact(brlAtDepth(RULER_STEP, column.getBoundingClientRect().width)),
  };

  document.querySelectorAll<HTMLElement>('[data-dyn]').forEach((element) => {
    const value = values[element.dataset.dyn || ''];
    if (value !== undefined) element.textContent = value;
  });
}

function renderMoneyBlocks(): void {
  const salary = data.salario.valor_brl;
  const amounts: Record<string, number> = {
    salary,
    year: salary * MONTHS_PER_YEAR,
    life: lifeEarnings(salary),
  };
  document.querySelectorAll<HTMLElement>('[data-money-block]').forEach((element) => {
    const value = amounts[element.dataset.moneyBlock || ''];
    if (value === undefined) return;
    const { width, fullRows, lastRowWidth } = pixelBlock(value);
    element.style.width = `${width}px`;
    element.style.height = `${fullRows + (lastRowWidth > 0 ? 1 : 0)}px`;
    const fill = document.createElement('span');
    fill.className = 'money-block__fill';
    fill.style.width = `${width}px`;
    fill.style.height = `${fullRows}px`;
    const lastRow = document.createElement('span');
    lastRow.className = 'money-block__fill';
    lastRow.style.width = `${lastRowWidth}px`;
    lastRow.style.height = lastRowWidth > 0 ? '1px' : '0px';
    element.replaceChildren(fill, lastRow);
  });
}

function checkpointCard(checkpoint: Checkpoint): HTMLElement {
  const card = document.createElement('div');
  card.className = 'col-note__card panel';
  card.dataset.checkpoint = checkpoint.id;
  card.dataset.atBrl = String(checkpoint.atBRL);
  card.dataset.basis = checkpoint.basis;
  if (checkpoint.quantity !== undefined) card.dataset.quantity = String(checkpoint.quantity);
  const title = document.createElement('p');
  title.className = 'col__eyebrow';
  title.textContent = checkpoint.title;
  const heading = document.createElement('h3');
  heading.className = 'col-note__amount';
  heading.textContent = checkpoint.moneyHeading;
  const text = document.createElement('p');
  text.textContent = checkpoint.text;
  const source = document.createElement('a');
  source.className = 'col-note__fine';
  source.href = `${import.meta.env.BASE_URL}referencias#checkpoint-${checkpoint.id}`;
  source.textContent = 'como calculamos · fontes';
  card.appendChild(heading);
  if (checkpoint.heading !== checkpoint.moneyHeading) {
    const quantity = document.createElement('strong');
    quantity.className = 'col-note__quantity';
    quantity.textContent = checkpoint.heading;
    card.appendChild(quantity);
  }
  if (checkpoint.heading === checkpoint.moneyHeading) card.appendChild(title);
  card.append(text, source);
  return card;
}

function buildColumn(): void {
  const amount = data.filme.pedido_brl;
  const width = metricColumnWidth(amount, columnWidth(document.documentElement.clientWidth));
  const height = Math.ceil(pixelsOf(amount) / width);
  column.style.setProperty('--col-w', `${width}px`);
  column.style.height = `${height}px`;

  checkpointCards = buildCheckpoints(data).map((checkpoint) => ({ atBRL: checkpoint.atBRL, element: checkpointCard(checkpoint) }));
  activeCard = undefined;
  const wrapper = document.createElement('div');
  wrapper.className = 'col-note';
  wrapper.style.top = '0';
  wrapper.style.height = `${height}px`;
  for (const { element } of checkpointCards) {
    element.hidden = true;
    wrapper.appendChild(element);
  }
  column.replaceChildren(wrapper);

}

function updateCheckpoint(amount: number): void {
  const current = checkpointCards.reduce((selected, checkpoint) => (
    checkpoint.atBRL <= amount ? checkpoint : selected
  ), checkpointCards[0]);
  if (!current || current.element === activeCard) return;
  if (activeCard) activeCard.hidden = true;
  current.element.hidden = false;
  activeCard = current.element;
}

function cacheGeometry(): void {
  const rect = column.getBoundingClientRect();
  geometry = { top: rect.top + window.scrollY, height: rect.height, width: rect.width };
}

function updateScrollUI(): void {
  const mid = window.scrollY + window.innerHeight / 2;
  const active = mid >= geometry.top && mid <= geometry.top + geometry.height;
  controlsEl.toggleAttribute('data-idle', !active);
  measureLine.classList.toggle('measure-line--on', active);
  counterEl.classList.toggle('pos-counter--on', active);

  const amount = Math.max(0, Math.min(data.filme.pedido_brl, brlAtDepth(mid - geometry.top, geometry.width)));
  updateCheckpoint(amount);
  if (active) {
    posFull.textContent = fmtBRLFull(amount);
    posShort.textContent = `${fmtYears(yearsOf(amount, data.salario.valor_brl))} de trabalho · ${fmtLives(livesOf(amount, data.salario.valor_brl))}`;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressEl.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
}

function recompute(): void {
  buildColumn();
  applyDynamic();
  renderMoneyBlocks();
  cacheGeometry();
  autoscroll.sync();
  updateScrollUI();
}

const ICON_PLAY =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4.5 2.5v11L13 8z"/></svg>';
const ICON_PAUSE =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';

function updateControlsState(playing: boolean): void {
  btnPlay.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  btnPlay.setAttribute('aria-pressed', String(playing));
  btnPlay.setAttribute('aria-label', playing ? 'pausar rolagem' : 'rolar automaticamente');
}

function wireControls(): void {
  speedSelect.addEventListener('change', () => {
    const multiplier = Number(speedSelect.value);
    if (!SPEED_MULTIPLIERS.some((speed) => speed === multiplier)) return;
    userMult = multiplier;
  });

  // A Space press can pause the engine before click fires. Preserve the original intent.
  let playIntent: { wasPlaying: boolean; at: number } | null = null;
  const captureIntent = (): void => {
    playIntent = { wasPlaying: autoscroll.isPlaying(), at: performance.now() };
  };
  btnPlay.addEventListener('pointerdown', captureIntent);
  btnPlay.addEventListener('keydown', (event) => {
    if (!event.repeat) captureIntent();
  });
  btnPlay.addEventListener('click', () => {
    const fresh = playIntent && performance.now() - playIntent.at < 1000;
    const wasPlaying = fresh ? playIntent!.wasPlaying : autoscroll.isPlaying();
    playIntent = null;
    if (wasPlaying) autoscroll.pause();
    else autoscroll.play();
  });
  btnStart.addEventListener('click', () => autoscroll.play());
  btnTop.addEventListener('click', () => {
    autoscroll.pause();
    window.scrollTo({ top: 0, behavior: 'instant' });
    btnStart.focus({ preventScroll: true });
  });
}

export async function boot(): Promise<void> {
  const errorEl = must<HTMLElement>('#load-error');
  try {
    column = must<HTMLElement>('[data-column="filme"]');
    btnStart = must<HTMLButtonElement>('#btn-start');
    btnPlay = must<HTMLButtonElement>('#btn-play');
    btnTop = must<HTMLButtonElement>('#btn-top');
    speedSelect = must<HTMLSelectElement>('#speed-select');
    progressEl = must<HTMLElement>('[data-progress]');
    controlsEl = must<HTMLElement>('[data-cluster]');
    measureLine = must<HTMLElement>('[data-measure-line]');
    counterEl = must<HTMLElement>('[data-pos-counter]');
    posFull = must<HTMLElement>('[data-pos-full]');
    posShort = must<HTMLElement>('[data-pos-short]');

    data = await loadPageData();
    autoscroll = createAutoscroll({
      getSpeed: () => SPEED_BASE * userMult,
      onStateChange: updateControlsState,
    });
    wireControls();
    window.addEventListener('resize', () => {
      cacheGeometry();
      updateScrollUI();
    });
    new ResizeObserver(() => {
      cacheGeometry();
      updateScrollUI();
    }).observe(must<HTMLElement>('.hero'));
    window.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateScrollUI();
        scrollTicking = false;
      });
    }, { passive: true });

    recompute();
    await document.fonts.ready;
    cacheGeometry();
    updateScrollUI();
    for (const control of [btnStart, btnPlay, btnTop, speedSelect]) control.disabled = false;
  } catch (error) {
    console.error('Falha ao carregar os dados:', error);
    errorEl.hidden = false;
  }
}
