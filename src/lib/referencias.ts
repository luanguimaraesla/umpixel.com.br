import { fmtBRL, fmtBRLCompact, fmtCountShort } from './scale';
import { mountSources } from './sources';
import type { Source } from './sources';

// --- Shapes of the served /data/*.json files (fields this page reads) ---
interface WithSources {
  fontes: Source[];
  acessado_em: string;
}
interface RawSalario extends WithSources {
  valor_brl: number;
  vigencia: string;
  instrumento_legal: string;
}
interface RawCambio extends WithSources {
  taxa_venda: number;
  data_cotacao: string;
}
interface RawBilionarios extends WithSources {
  total_top5_usd_bilhoes: number;
  data_referencia_valores: string;
  top5?: { nome: string; fonte_riqueza_desde?: number }[];
}
interface RawGrowth extends WithSources {
  taxa_real_anual: number;
}
interface RawPatrimonio extends WithSources {
  valor_brl: number;
}
type RawRenda = WithSources;
interface RawMundo extends WithSources {
  data_referencia_valores: string;
}
interface RawCusto {
  id: string;
  valor_brl?: number;
  componentes?: { valor_aluno_ano_brl: number; matriculas: number };
}
interface RawComparacoes extends WithSources {
  custos: RawCusto[];
}

const usdFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fxFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const pctFmt = new Intl.NumberFormat('pt-BR', {
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

function fullDatePt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = d === 1 ? '1º' : String(d);
  return `${day} de ${MONTHS_PT[m - 1]} de ${y}`;
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

export async function bootReferencias(): Promise<void> {
  const sourcesEl = document.querySelector<HTMLElement>('[data-sources]');
  const errorEl = document.querySelector<HTMLElement>('#load-error');

  try {
    const [salario, cambio, bilionarios, renda, growth, patrimonio, mundo] = await Promise.all([
      fetchJson<RawSalario>(dataUrl('salario-minimo.json')),
      fetchJson<RawCambio>(dataUrl('cambio-usd-brl.json')),
      fetchJson<RawBilionarios>(dataUrl('bilionarios-brasil.json')),
      fetchJson<RawRenda>(dataUrl('renda-brasil.json')),
      fetchJson<RawGrowth>(dataUrl('crescimento-real-salario.json')),
      fetchJson<RawPatrimonio>(dataUrl('patrimonio-familia.json')),
      fetchJson<RawMundo>(dataUrl('bilionarios-mundo.json')),
    ]);
    // Optional, like on the home page: a missing file just drops its sources and
    // leaves the methodology figures as their placeholders.
    const comparacoes = await fetchJson<RawComparacoes>(
      dataUrl('comparacoes-publicas.json'),
    ).catch(() => null);

    const richest = bilionarios.top5 && bilionarios.top5[0];
    const values: Record<string, string> = {
      'fx-rate': fxFmt.format(cambio.taxa_venda),
      'fx-date': fullDatePt(cambio.data_cotacao),
      'min-wage': fmtBRL(salario.valor_brl),
      'min-wage-law': salario.instrumento_legal,
      'real-growth-pct': `${pctFmt.format(growth.taxa_real_anual * 100)}%`,
      'forbes-date': fullDatePt(bilionarios.data_referencia_valores),
      'family-worth': fmtBRLCompact(patrimonio.valor_brl),
      'top5-usd': usdLong(bilionarios.total_top5_usd_bilhoes),
    };
    if (richest) {
      values['richest-name'] = richest.nome;
      if (richest.fonte_riqueza_desde) values['richest-since'] = String(richest.fonte_riqueza_desde);
    }
    if (comparacoes) {
      const custo = (id: string): RawCusto | undefined =>
        comparacoes.custos.find((c) => c.id === id);
      const educar = custo('educar-todos-alunos-um-ano');
      const analf = custo('erradicar-analfabetismo');
      if (educar?.componentes) {
        values['edu-aluno-ano'] = fmtBRL(educar.componentes.valor_aluno_ano_brl);
        values['edu-matriculas'] = fmtCountShort(educar.componentes.matriculas);
        values['edu-total'] = fmtBRLCompact(
          educar.componentes.valor_aluno_ano_brl * educar.componentes.matriculas,
        );
      }
      if (analf?.valor_brl) values['analf-cost'] = fmtBRLCompact(analf.valor_brl);
    }

    document.querySelectorAll<HTMLElement>('[data-dyn]').forEach((el) => {
      const key = el.dataset.dyn;
      if (!key) return;
      const text = values[key];
      if (text !== undefined) el.textContent = text;
    });

    if (sourcesEl) {
      mountSources(sourcesEl, [
        { label: `Salário mínimo (${salario.vigencia.slice(0, 4)})`, raw: salario },
        { label: 'Valorização real do salário (teto do arcabouço fiscal)', raw: growth },
        { label: 'Câmbio do dólar (PTAX)', raw: cambio },
        { label: `Bilionários do Brasil (Forbes ${bilionarios.data_referencia_valores.slice(0, 4)})`, raw: bilionarios },
        { label: `Pessoa mais rica do mundo (Forbes ${mundo.data_referencia_valores.slice(0, 4)})`, raw: mundo },
        { label: 'Patrimônio de uma família (estimativa)', raw: patrimonio },
        { label: 'Comparações públicas (PIB e custos de políticas)', raw: comparacoes },
        { label: 'Renda e desigualdade (IBGE, OCDE)', raw: renda },
      ]);
    }
  } catch (err) {
    console.error('Falha ao carregar os dados:', err);
    if (errorEl) errorEl.hidden = false;
  }
}
