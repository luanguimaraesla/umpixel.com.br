import { MONTHS_PER_YEAR } from '../config';
import { fmtBRL, fmtBRLCompact, fmtInt, fmtYears, fmtLives, monthsOf, yearsOf, livesOf, lifeEarnings, pixelsOf } from './scale';
import { buildCheckpoints } from './checkpoints';
import { loadPageData } from './state';
import { mountSources } from './sources';

export async function bootReferencias(): Promise<void> {
  const errorEl = document.querySelector<HTMLElement>('#load-error');
  try {
    const data = await loadPageData();
    const { salario, filme, checkpoints } = data;
    const since = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });
    const area = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
    const values: Record<string, string> = {
      'min-wage': fmtBRL(salario.valor_brl),
      'min-wage-since': since.format(new Date(`${salario.vigencia}T00:00:00Z`)),
      'min-wage-law': salario.instrumento_legal,
      'year-value': fmtBRL(salario.valor_brl * MONTHS_PER_YEAR),
      'earnings-value': fmtBRL(lifeEarnings(salario.valor_brl)),
      'movie-title': filme.titulo,
      'requested-brl': fmtBRLCompact(filme.pedido_brl),
      'requested-usd': `US$ ${fmtInt(filme.pedido_usd / 1e6)} milhões`,
      'movie-area': fmtInt(pixelsOf(filme.pedido_brl)),
      'min-wage-area': area.format(pixelsOf(salario.valor_brl)),
      'year-area': area.format(pixelsOf(salario.valor_brl * MONTHS_PER_YEAR)),
      'earnings-area': area.format(pixelsOf(lifeEarnings(salario.valor_brl))),
      'movie-months': fmtInt(monthsOf(filme.pedido_brl, salario.valor_brl)),
      'movie-years': fmtYears(yearsOf(filme.pedido_brl, salario.valor_brl)),
      'movie-lives': fmtLives(livesOf(filme.pedido_brl, salario.valor_brl)),
      'exchange-note': filme.nota_cambio,
    };
    document.querySelectorAll<HTMLElement>('[data-dyn]').forEach((element) => {
      const value = values[element.dataset.dyn || ''];
      if (value !== undefined) element.textContent = value;
    });
    const comparisonReferences = [
      ...checkpoints.custos, checkpoints.mensalao, checkpoints.bolsa_familia, checkpoints.educacao,
      checkpoints.estudos_herdeiros,
    ];
    const checkpointsEl = document.querySelector<HTMLElement>('[data-checkpoints]');
    if (checkpointsEl) {
      const entries = buildCheckpoints(data).map((checkpoint) => {
        const entry = document.createElement('article');
        entry.id = `checkpoint-${checkpoint.id}`;
        entry.className = 'ref-checkpoint';
        const heading = document.createElement('h3');
        heading.textContent = `${checkpoint.title} · ${checkpoint.moneyHeading}${checkpoint.heading !== checkpoint.moneyHeading ? ` · ${checkpoint.heading}` : ''}`;
        const text = document.createElement('p');
        text.textContent = checkpoint.text;
        const reference = document.createElement('p');
        reference.textContent = checkpoint.reference;
        const budget = document.createElement('p');
        budget.textContent = checkpoint.budgetLabel;
        entry.append(heading, budget, text, reference);
        const source = comparisonReferences.find((comparison) => comparison.id === (checkpoint.sourceId || checkpoint.id));
        if (source) {
          const links = document.createElement('div');
          mountSources(links, [{ label: 'Fonte do checkpoint', raw: source }]);
          entry.appendChild(links);
        }
        return entry;
      });
      checkpointsEl.replaceChildren(...entries);
    }
    const sourcesEl = document.querySelector<HTMLElement>('[data-sources]');
    if (sourcesEl) {
      mountSources(sourcesEl, [
        { label: 'Pedido para o filme sobre Jair Bolsonaro', raw: filme },
        { label: `Salário mínimo (${salario.vigencia.slice(0, 4)})`, raw: salario },
        ...comparisonReferences.map((comparison) => ({ label: comparison.nome, raw: comparison })),
      ]);
    }
    await document.fonts.ready;
    if (location.hash.startsWith('#checkpoint-')) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  } catch (error) {
    console.error('Falha ao carregar os dados:', error);
    if (errorEl) errorEl.hidden = false;
  }
}
