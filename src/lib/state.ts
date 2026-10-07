import type { Source } from './sources';

interface WithSources {
  fontes: Source[];
  acessado_em: string;
}

interface MinimumWage extends WithSources {
  valor_brl: number;
  vigencia: string;
  instrumento_legal: string;
}

interface MovieFunding extends WithSources {
  titulo: string;
  pedido_usd: number;
  pedido_brl: number;
  repassado_brl: number;
  nota_cambio: string;
}

export interface ComparisonReference extends WithSources {
  id: string;
  nome: string;
  valor_brl: number;
  contexto: string;
  referencia: string;
}

interface QuantityReference extends ComparisonReference {
  unidade_singular: string;
  unidade_plural: string;
}

interface CheckpointData {
  custos: QuantityReference[];
  bolsa_familia: ComparisonReference;
  educacao: ComparisonReference;
  mensalao: ComparisonReference;
  estudos_herdeiros: QuantityReference;
  ordem: string[];
  familia: { primeira_geracao: number; filhos_por_descendente: number };
}

export interface PageData {
  salario: MinimumWage;
  filme: MovieFunding;
  checkpoints: CheckpointData;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  return (await response.json()) as T;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isComparison(value: ComparisonReference): boolean {
  return Boolean(
    value && value.id && value.nome && isPositive(value.valor_brl) && value.valor_brl >= 0.01 &&
    value.contexto && value.referencia && value.acessado_em &&
    Array.isArray(value.fontes) && value.fontes.length > 0 &&
    value.fontes.every((source) => source?.nome && source?.url),
  );
}

function isQuantityReference(value: QuantityReference): boolean {
  return isComparison(value) && Boolean(value.unidade_singular && value.unidade_plural);
}

export async function loadPageData(baseUrl = import.meta.env.BASE_URL): Promise<PageData> {
  const [salario, filme, checkpoints] = await Promise.all([
    fetchJson<MinimumWage>(`${baseUrl}data/salario-minimo.json`),
    fetchJson<MovieFunding>(`${baseUrl}data/filme-bolsonaro.json`),
    fetchJson<CheckpointData>(`${baseUrl}data/checkpoints.json`),
  ]);

  if (
    !salario || !isPositive(salario.valor_brl) ||
    !salario.vigencia || !salario.instrumento_legal || !Array.isArray(salario.fontes)
  ) {
    throw new Error('salario-minimo.json inválido');
  }
  if (
    !filme || !isPositive(filme.pedido_brl) || !isPositive(filme.pedido_usd) ||
    !isPositive(filme.repassado_brl) || filme.repassado_brl > filme.pedido_brl ||
    !filme.titulo || !filme.nota_cambio || !Array.isArray(filme.fontes) ||
    filme.fontes.length === 0 || !filme.fontes.every((source) => source?.nome && source?.url)
  ) {
    throw new Error('filme-bolsonaro.json inválido');
  }

  if (
    !checkpoints || !Array.isArray(checkpoints.custos) || checkpoints.custos.length === 0 ||
    !checkpoints.custos.every(isQuantityReference) || !isComparison(checkpoints.bolsa_familia) ||
    !isComparison(checkpoints.educacao) || !isComparison(checkpoints.mensalao) ||
    !isQuantityReference(checkpoints.estudos_herdeiros)
  ) {
    throw new Error('checkpoints.json inválido');
  }
  const ids = [
    ...checkpoints.custos,
    checkpoints.bolsa_familia,
    checkpoints.educacao,
    checkpoints.mensalao,
    checkpoints.estudos_herdeiros,
  ].map((comparison) => comparison.id);
  if (new Set(ids).size !== ids.length) throw new Error('checkpoints.json inválido: IDs repetidos');
  const expectedOrder = new Set([
    ...checkpoints.custos.map((cost) => cost.id), checkpoints.mensalao.id,
    checkpoints.bolsa_familia.id, checkpoints.educacao.id,
    'escala', 'cinquenta-anos', 'a-cada-cem', 'moeda', 'herdeiros',
  ]);
  if (
    expectedOrder.size !== checkpoints.custos.length + 8 ||
    !Array.isArray(checkpoints.ordem) || checkpoints.ordem.length !== expectedOrder.size ||
    new Set(checkpoints.ordem).size !== expectedOrder.size ||
    !checkpoints.ordem.every((id) => expectedOrder.has(id))
  ) {
    throw new Error('checkpoints.json inválido: ordem dos marcos');
  }
  const family = checkpoints.familia;
  if (
    !family || !Number.isSafeInteger(family.primeira_geracao) || family.primeira_geracao < 1 ||
    !Number.isSafeInteger(family.filhos_por_descendente) || family.filhos_por_descendente < 2
  ) {
    throw new Error('checkpoints.json inválido: cenário familiar');
  }

  return { salario, filme, checkpoints };
}
