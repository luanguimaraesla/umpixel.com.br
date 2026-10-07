import { MONTHS_PER_YEAR } from '../config';
import { fmtBRL, fmtBRLCompact, fmtBRLFull, fmtInt } from './scale';
import type { PageData } from './state';

export interface Checkpoint {
  id: string;
  atBRL: number;
  title: string;
  heading: string;
  moneyHeading: string;
  text: string;
  reference: string;
  budgetLabel: string;
  basis: 'checkpoint' | 'total';
  quantity?: number;
  unitBRL?: number;
  spentBRL?: number;
  balanceBRL?: number;
  valueBRL?: number;
  sourceId?: string;
}

function quantities(budget: number, unit: number, round = false) {
  const budgetCents = Math.round(budget * 100);
  const unitCents = Math.round(unit * 100);
  const capacity = Math.floor(budgetCents / unitCents);
  const step = capacity < 10 ? 1 : capacity < 100 ? 5 : 10 ** (Math.floor(Math.log10(capacity)) - 1);
  const quantity = round ? Math.floor(capacity / step) * step : capacity;
  const spentCents = quantity * unitCents;
  return { quantity, spentBRL: spentCents / 100, balanceBRL: (budgetCents - spentCents) / 100 };
}

function completeGenerations(budget: number, unit: number, family: PageData['checkpoints']['familia']) {
  const capacity = quantities(budget, unit).quantity;
  let nextGeneration = family.primeira_geracao;
  let students = 0;
  let generations = 0;
  while (nextGeneration <= capacity - students) {
    students += nextGeneration;
    generations += 1;
    nextGeneration *= family.filhos_por_descendente;
  }
  return { generations, students };
}

function budgetLabel(budget: number, spent: number): string {
  return `Marco: ${fmtBRL(budget)}. Total calculado: ${fmtBRL(spent)}.`;
}

export function buildCheckpoints(data: PageData): Checkpoint[] {
  const amount = data.filme.pedido_brl;
  const salary = data.salario.valor_brl;
  const { custos, bolsa_familia, educacao, mensalao, familia, ordem } = data.checkpoints;
  const costs = new Map(custos.map((cost) => [cost.id, cost]));
  const studies = data.checkpoints.estudos_herdeiros;
  const order = ordem.filter((id) => !costs.has(id) || costs.get(id)!.valor_brl <= amount);
  const ratio = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const checkpoints: Checkpoint[] = [{
    id: 'cafe', atBRL: 1, basis: 'checkpoint', quantity: 1, unitBRL: 1,
    spentBRL: 1, balanceBRL: 0, title: 'Um cafezinho na rodoviária',
    heading: '1 cafezinho', moneyHeading: 'R$ 1',
    text: 'Aqui começa a fortuna que Flávio pediu a Vorcaro. Um cafezinho na rodoviária. Esse é o caminho até os R$ 134 milhões.',
    budgetLabel: 'Começo do percurso: R$ 1.',
    reference: 'Referência adotada: R$ 1 por café. R$ 1 ÷ R$ 100 por pixel = 0,01 pixel de área.',
  }];

  const workPosition = order.indexOf('cinquenta-anos') + 1;
  const workBudget = Math.ceil(salary * MONTHS_PER_YEAR * 45 * 50 / 5_000_000) * 5_000_000;
  const anchorWork = workPosition > 0 && workBudget < amount;
  const rawStep = amount / (order.length + 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const roundStep = Math.round(rawStep / magnitude) * magnitude;
  const remaining = amount - roundStep * order.length;
  const uniformRoundStep = remaining > 0 && remaining <= roundStep * 1.5;
  const quantum = rawStep >= 4 * magnitude ? 2 * magnitude : magnitude;
  order.forEach((id, index) => {
    const position = index + 1;
    let target = rawStep * position;
    if (anchorWork) {
      target = position <= workPosition
        ? workBudget * position / workPosition
        : workBudget + (amount - workBudget) * (position - workPosition) / (order.length - workPosition + 1);
    }
    const rounding = anchorWork && position <= workPosition ? magnitude : quantum;
    const budget = anchorWork && position === workPosition
      ? workBudget
      : !anchorWork && uniformRoundStep ? roundStep * position : Math.round(target / rounding) * rounding;
    const totalLabel = `Comparação com o pedido inteiro: ${fmtBRLCompact(amount)}.`;
    const point = { id, atBRL: budget, budgetLabel: totalLabel, basis: 'total' as const };
    const cost = costs.get(id);
    if (cost) {
      const totals = quantities(budget, cost.valor_brl, true);
      if (totals.quantity === 0) return;
      const unitName = totals.quantity === 1 ? cost.unidade_singular : cost.unidade_plural;
      checkpoints.push({
        ...point, ...totals, basis: 'checkpoint', unitBRL: cost.valor_brl,
        title: cost.nome,
        heading: `${fmtInt(totals.quantity)} ${unitName}`,
        moneyHeading: fmtBRLCompact(budget),
        text: cost.contexto,
        budgetLabel: budgetLabel(budget, totals.spentBRL),
        reference: `${fmtBRL(budget)} ÷ ${fmtBRL(cost.valor_brl)}, arredondado para baixo: ${fmtInt(totals.quantity)} unidades, custo equivalente de ${fmtBRL(totals.spentBRL)} e saldo de ${fmtBRL(totals.balanceBRL)}. ${cost.referencia}`,
      });
      return;
    }
    if (id === 'escala') {
      checkpoints.push({
        ...point, basis: 'checkpoint', quantity: budget / 100, unitBRL: 100,
        spentBRL: budget, balanceBRL: 0, title: 'A escala da coluna',
        heading: `${fmtInt(budget / 100)} notas de R$ 100`, moneyHeading: fmtBRLCompact(budget),
        text: 'A coluna tem 12 pixels de largura: cada linha de 1 pixel de altura vale R$ 1.200,00. Cada traço da régua marca R$ 120 mil.',
        budgetLabel: budgetLabel(budget, budget), reference: '12 pixels × R$ 100 = R$ 1.200 por linha. 100 linhas × R$ 1.200 = R$ 120.000 por traço da régua.',
      });
    } else if (id === 'cinquenta-anos') {
      const unit = salary * MONTHS_PER_YEAR * 45;
      const totals = quantities(budget, unit, true);
      if (totals.quantity === 0) return;
      checkpoints.push({
        ...point, ...totals, basis: 'checkpoint', unitBRL: unit,
        title: 'Pessoas trabalhando por 45 anos',
        heading: `${fmtInt(totals.quantity)} pessoas trabalhando por 45 anos`,
        moneyHeading: fmtBRLCompact(budget),
        text: `Cada pessoa recebendo ${fmtBRL(salary)} por mês, durante 45 anos de trabalho.`,
        budgetLabel: budgetLabel(budget, totals.spentBRL),
        reference: `Por pessoa: 45 × ${MONTHS_PER_YEAR} × ${fmtBRL(salary)} = ${fmtBRL(unit)}. ${fmtInt(totals.quantity)} pessoas somam ${fmtBRL(totals.spentBRL)}; saldo: ${fmtBRL(totals.balanceBRL)}.`,
      });
    } else if (id === 'a-cada-cem' || id === 'moeda') {
      const referenceValue = id === 'moeda' ? 0.05 : 100;
      const equivalent = amount / salary * referenceValue;
      checkpoints.push({
        ...point, valueBRL: equivalent,
        title: id === 'moeda' ? 'Você se abaixaria por cinco centavos?' : 'Para cada R$ 100 do seu salário',
        heading: fmtBRL(equivalent),
        moneyHeading: fmtBRL(equivalent),
        text: id === 'moeda'
          ? `Para quem recebe um salário mínimo mensal, uma moeda de R$ 0,05 tem a mesma proporção que ${fmtBRL(equivalent)} no pedido de ${fmtBRLCompact(amount)} para o filme. Você se abaixaria para pegar esse valor?`
          : `Um mês de salário mínimo contra o pedido inteiro: para cada R$ 100 desse salário, são ${fmtBRLFull(equivalent)} na escala do pedido para o filme.`,
        reference: `${fmtBRL(amount)} ÷ ${fmtBRL(salary)} × ${fmtBRL(referenceValue)} = ${fmtBRL(equivalent)}. Base: um mês de salário mínimo e o pedido para o filme.`,
      });
    } else if (id === mensalao.id) {
      checkpoints.push({
        ...point, valueBRL: mensalao.valor_brl,
        title: mensalao.nome, heading: fmtBRLCompact(mensalao.valor_brl),
        moneyHeading: fmtBRLCompact(mensalao.valor_brl),
        text: `O acordo entre Flávio e Vorcaro é ${ratio.format(amount / mensalao.valor_brl)} vezes maior do que o Mensalão.`,
        reference: mensalao.referencia,
      });
    } else if (id === 'herdeiros') {
      const { generations, students } = completeGenerations(amount, studies.valor_brl, familia);
      checkpoints.push({
        ...point, quantity: generations, sourceId: studies.id,
        title: 'Graduação dos herdeiros',
        heading: `${fmtInt(generations)} ${generations === 1 ? 'geração completa' : 'gerações completas'}`,
        moneyHeading: fmtBRLCompact(students * studies.valor_brl),
        text: `O pedido inteiro bancaria quatro anos em Harvard para ${fmtInt(students)} descendentes: ${fmtInt(familia.primeira_geracao)} na primeira geração e ${fmtInt(familia.filhos_por_descendente)} filhos por pessoa.`,
        reference: `Somamos gerações completas de ${fmtInt(familia.primeira_geracao)} pessoas, multiplicando cada geração por ${fmtInt(familia.filhos_por_descendente)}. São ${fmtInt(students)} graduações × ${fmtBRL(studies.valor_brl)} = ${fmtBRL(students * studies.valor_brl)}. ${studies.referencia}`,
      });
    } else if (id === bolsa_familia.id || id === educacao.id) {
      const unit = id === bolsa_familia.id ? bolsa_familia : educacao;
      const totals = quantities(amount, unit.valor_brl);
      const benefit = unit.id === bolsa_familia.id;
      checkpoints.push({
        ...point, ...totals, unitBRL: unit.valor_brl,
        title: `Com ${fmtBRLCompact(amount)}: ${benefit ? 'Bolsa Família' : 'educação'}`,
        heading: `${fmtInt(totals.quantity)} ${benefit ? 'benefícios' : 'alunos'}`,
        moneyHeading: fmtBRLCompact(amount),
        text: benefit
          ? `Uma parcela mensal do Bolsa Família para cada família, pela média de ${fmtBRL(unit.valor_brl)} de setembro de 2026.`
          : `Um ano de educação básica para cada aluno, usando o gasto médio de ${fmtBRL(unit.valor_brl)} por aluno em 2024, segundo o Todos Pela Educação.`,
        budgetLabel: `Orçamento completo: ${fmtBRLCompact(amount)}.`,
        reference: `${fmtBRL(amount)} ÷ ${fmtBRL(unit.valor_brl)}, arredondado para baixo. Custo equivalente: ${fmtBRL(totals.spentBRL)}; saldo: ${fmtBRL(totals.balanceBRL)}. ${unit.referencia}`,
      });
    }
  });
  return checkpoints.sort((a, b) => a.atBRL - b.atBRL);
}
