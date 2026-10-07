import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const configUrl = moduleUrl(await read('src/config.ts'));
const { SPEED_BASE, SPEED_MULTIPLIERS } = await import(configUrl);
const scaleUrl = moduleUrl((await read('src/lib/scale.ts')).replace("'../config'", JSON.stringify(configUrl)));
const scale = await import(scaleUrl);
const { buildCheckpoints } = await import(moduleUrl((await read('src/lib/checkpoints.ts'))
  .replace("'../config'", JSON.stringify(configUrl)).replace("'./scale'", JSON.stringify(scaleUrl))));
const { loadPageData } = await import(moduleUrl(await read('src/lib/state.ts')));
const salario = await readJson('public/data/salario-minimo.json');
const filme = await readJson('public/data/filme-bolsonaro.json');
const checkpoints = await readJson('public/data/checkpoints.json');

function mockData(context, wage = salario, funding = filme, comparisons = checkpoints) {
  return context.mock.method(globalThis, 'fetch', async (url) => {
    if (url === '/data/salario-minimo.json') return Response.json(wage);
    if (url === '/data/filme-bolsonaro.json') return Response.json(funding);
    if (url === '/data/checkpoints.json') return Response.json(comparisons);
    throw new Error(`Unexpected data request: ${url}`);
  });
}

test('minimum wage is the current statutory value', () => {
  assert.equal(salario.valor_brl, 1621);
  assert.equal(salario.vigencia, '2026-01-01');
  assert.match(salario.instrumento_legal, /12\.797/);
  assert.match(salario.contexto, /INPC de 4,18%.*ganho real limitado a 2,5%/);
  assert.equal(Math.ceil(1518 * 1.0418 * 1.025), salario.valor_brl);
});

test('source metadata distinguishes event dates and document identifiers', () => {
  const policeStation = checkpoints.custos.find(cost => cost.id === 'delegacias');
  assert.match(policeStation.referencia, /inauguração 17\/03\/2026/);
  const doctors = checkpoints.custos.find(cost => cost.id === 'medicos');
  assert.match(doctors.fontes[0].nome, /Edital nº 24\/2026, Chamamento Público nº 3\/2026/);
});

test('the requested amount and reported transfers stay separate', () => {
  assert.equal(filme.pedido_usd, 24_000_000);
  assert.equal(filme.pedido_brl, 134_000_000);
  assert.equal(filme.repassado_brl, 61_000_000);
  assert.ok(filme.repassado_brl < filme.pedido_brl);
  assert.ok(filme.fontes.length > 0);
  assert.match(filme.fontes[0].nome, /Opera Mundi/);
  assert.equal(new URL(filme.fontes[0].url).hostname, 'operamundi.uol.com.br');
  assert.equal(filme.resposta, undefined);
});

test('money uses minimum-wage months, years, and gross lifetime earnings', () => {
  assert.equal(scale.monthsOf(1621, 1621), 1);
  assert.equal(scale.yearsOf(1621 * 12, 1621), 1);
  assert.equal(scale.lifeEarnings(1621), 914_244);
  assert.equal(scale.livesOf(914_244, 1621), 1);
  assert.equal(scale.fmtInt(scale.monthsOf(filme.pedido_brl, 1621)), '82.665');
  assert.equal(scale.fmtYears(scale.yearsOf(filme.pedido_brl, 1621)), '6.889 anos');
  assert.equal(scale.fmtLives(scale.livesOf(filme.pedido_brl, 1621)), '147 vidas');
  assert.equal(scale.fmtBRLCompact(filme.pedido_brl), 'R$ 134 milhões');
});

test('autoscroll uses 480 pixels per second as its 1x base speed', () => {
  assert.equal(SPEED_BASE, 480);
  assert.deepEqual(SPEED_MULTIPLIERS, [1, 2, 3]);
  assert.deepEqual(SPEED_MULTIPLIERS.map(multiplier => SPEED_BASE * multiplier), [480, 960, 1440]);
});

for (const path of ['src/components/Hero.astro', 'src/components/PositionIndicator.astro']) {
  test(`speed selector in ${path} offers only 1x, 2x and 3x, defaulting to 1x`, async () => {
    const source = await read(path);
    const options = [...source.matchAll(/<option value="([^"]+)"( selected)?>([^<]+)<\/option>/g)]
      .map(([, value, selected, label]) => ({ value: Number(value), selected: Boolean(selected), label }));
    assert.deepEqual(options, [
      { value: 1, selected: true, label: '1×' },
      { value: 2, selected: false, label: '2×' },
      { value: 3, selected: false, label: '3×' },
    ]);
  });
}

test('each pixel represents one 100-real banknote, independently of salary', () => {
  assert.equal(scale.pixelsOf(100), 1);
  assert.equal(scale.pixelsOf(filme.pedido_brl), 1_340_000);
  assert.equal(scale.brlAtDepth(1, 1), 100);
  assert.equal(scale.brlAtDepth(1, 12), 1200);
  assert.equal(scale.brlAtDepth(100, 12), 120_000);
});

test('the movie column keeps the banknote scale on mobile and desktop', () => {
  for (const viewport of [320, 390, 768, 1440]) {
    const width = scale.metricColumnWidth(filme.pedido_brl, scale.columnWidth(viewport));
    assert.equal(width, 12);
    const area = scale.pixelsOf(filme.pedido_brl);
    const height = Math.ceil(area / width);
    assert.equal(height, 111_667);
    assert.ok(height * width >= area);
    assert.ok(height * width - area < width);
  }
});

test('comparison blocks preserve area, including a partial final row', () => {
  for (const value of [100, 1621, 1621 * 12, scale.lifeEarnings(1621)]) {
    const { width, fullRows, lastRowWidth } = scale.pixelBlock(value);
    assert.ok(lastRowWidth >= 0 && lastRowWidth < width);
    assert.ok(Math.abs(width * fullRows + lastRowWidth - scale.pixelsOf(value)) < 1e-9);
  }
});

test('very large columns stay within the browser height limit', () => {
  const amount = 20_000_000_000;
  const width = scale.metricColumnWidth(amount, 12);
  assert.ok(width > 12);
  assert.ok(Math.ceil(scale.pixelsOf(amount) / width) <= 16_000_000);
});

test('the banknote thumbnail is a local PNG with an alpha channel', async () => {
  const png = await readFile(new URL('public/images/nota-100-reais.png', root));
  assert.equal(png.readUInt32BE(16), 288);
  assert.equal(png.readUInt32BE(20), 134);
  assert.equal(png[25], 6);
  const key = await read('src/components/ScaleKey.astro');
  assert.match(key, /\/images\/nota-100-reais\.png/);
  assert.match(key, /<strong>1 pixel =<\/strong>/);
  assert.doesNotMatch(key, /uma nota de R\$ 100/);
});

test('loading reads the minimum wage, movie funding, and checkpoints', async (context) => {
  const fetch = mockData(context);
  const data = await loadPageData('/');
  assert.equal(data.salario.valor_brl, 1621);
  assert.equal(data.filme.pedido_brl, 134_000_000);
  assert.deepEqual(fetch.mock.calls.map((call) => call.arguments[0]).sort(), [
    '/data/checkpoints.json', '/data/filme-bolsonaro.json', '/data/salario-minimo.json',
  ]);
  assert.ok(fetch.mock.calls.every((call) => call.arguments[1].cache === 'no-cache'));
});

test('an old saved salary cannot change the reference', async (context) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('Saved salaries must not be read'); },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  mockData(context);
  assert.equal((await loadPageData('/')).salario.valor_brl, 1621);
});

for (const value of [0, -1, '1621', null]) {
  test(`invalid minimum wage ${JSON.stringify(value)} is rejected`, async (context) => {
    mockData(context, { ...salario, valor_brl: value });
    await assert.rejects(loadPageData('/'), /salario-minimo\.json inválido/);
  });
}

for (const invalid of [
  { pedido_brl: 0 },
  { pedido_usd: -1 },
  { repassado_brl: 0 },
  { repassado_brl: 135_000_000 },
  { fontes: [] },
  { fontes: [{ nome: 'Opera Mundi' }] },
]) {
  test(`invalid movie funding ${JSON.stringify(invalid)} is rejected`, async (context) => {
    mockData(context, salario, { ...filme, ...invalid });
    await assert.rejects(loadPageData('/'), /filme-bolsonaro\.json inválido/);
  });
}

test('a missing required file fails instead of inventing an amount', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url) => {
    return url.endsWith('filme-bolsonaro.json')
      ? new Response('Not found', { status: 404 })
      : Response.json(salario);
  });
  await assert.rejects(loadPageData('/'), /filme-bolsonaro\.json: 404/);
});

test('a network error remains visible to the caller', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
  await assert.rejects(loadPageData('/'), /Network unavailable/);
});

test('pages have no salary inputs, old stories, or salary persistence', async () => {
  const paths = ['src/components/Hero.astro', 'src/pages/index.astro', 'src/pages/referencias.astro'];
  for (const path of paths) {
    const source = await read(path);
    assert.doesNotMatch(source, /<input\b|salary-mode|salario-input|Saverin|Elon Musk|1 pixel de área = 1 mês/);
  }
  assert.doesNotMatch(await read('src/lib/state.ts'), /localStorage|setSalary|subscribe/);
  for (const path of paths) {
    assert.doesNotMatch(await read(path), /Não é o valor total repassado\.|Tangerina|movie-response|confirmou o pedido de patrocínio|transferred-brl|Pedido não é repasse|O pedido e os repasses são valores diferentes/);
  }
});

test('checkpoints are ordered by value and stay within the requested amount', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  assert.equal(points.length, 28);
  assert.equal(new Set(points.map((point) => point.id)).size, points.length);
  assert.ok(points.every((point, index) => point.atBRL > 0 && point.atBRL <= filme.pedido_brl &&
    (index === 0 || point.atBRL >= points[index - 1].atBRL)));
  assert.deepEqual(points.map((point) => point.id), ['cafe', ...checkpoints.ordem]);
  assert.ok(points.every((point) => point.title && point.heading && point.moneyHeading && point.text && point.reference));
});

test('fifty people work for 45 years and the per-100 comparison uses one monthly wage', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  const work = points.find((point) => point.id === 'cinquenta-anos');
  assert.equal(work.atBRL, 45_000_000);
  assert.equal(work.quantity, 50);
  assert.equal(work.unitBRL, 875_340);
  assert.equal(work.spentBRL, 43_767_000);
  assert.equal(work.heading, '50 pessoas trabalhando por 45 anos');
  const comparison = points.find((point) => point.id === 'a-cada-cem');
  assert.ok(Math.abs(comparison.valueBRL - 8_266_502.159161012) < 1e-8);
  assert.match(comparison.text, /salário mínimo.*pedido inteiro.*R\$ 8\.266\.502/);
  assert.doesNotMatch(comparison.text, /pagou|recebeu de Vorcaro/);
});

test('the full budget funds monthly benefits and one-year student equivalents', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  const benefit = points.find((point) => point.id === 'bolsa-familia');
  const education = points.find((point) => point.id === 'educacao');
  assert.equal(benefit.atBRL, 124_000_000);
  assert.equal(benefit.moneyHeading, 'R$ 134 milhões');
  assert.equal(benefit.basis, 'total');
  assert.equal(benefit.heading, '197.587 benefícios');
  assert.match(benefit.text, /parcela mensal.*678,18/);
  assert.equal(education.atBRL, 130_000_000);
  assert.equal(education.moneyHeading, 'R$ 134 milhões');
  assert.equal(education.basis, 'total');
  assert.equal(education.heading, '9.370 alunos');
  assert.match(education.text, /Um ano.*14\.300,00.*2024/);
  assert.ok(points.every(point => point.atBRL < filme.pedido_brl));
  assert.ok(benefit.atBRL < education.atBRL);
  for (const unitCost of [checkpoints.bolsa_familia.valor_brl, checkpoints.educacao.valor_brl]) {
    const count = Math.floor(filme.pedido_brl / unitCost);
    assert.ok(count * unitCost <= filme.pedido_brl);
    assert.ok((count + 1) * unitCost > filme.pedido_brl);
  }
});

test('changing the budget recalculates quantities and excludes unreachable prices', () => {
  const amount = 10_000_000;
  const points = buildCheckpoints({ salario, filme: { ...filme, pedido_brl: amount }, checkpoints });
  assert.ok(points.every((point) => point.atBRL <= amount));
  assert.ok(!points.some((point) => point.id === 'campus-universitario'));
  assert.equal(points.find((point) => point.id === 'bolsa-familia').heading, '14.745 benefícios');
  assert.equal(points.find((point) => point.id === 'educacao').heading, '699 alunos');
  assert.equal(points.find((point) => point.id === 'a-cada-cem').valueBRL, amount / salario.valor_brl * 100);
});

test('housing and nursery estimates can be reproduced from their components', () => {
  const house = checkpoints.custos.find((cost) => cost.id === 'casa');
  assert.equal(house.valor_brl, house.componentes.area_m2 * house.componentes.custo_m2_brl);
  const apartment = checkpoints.custos.find((cost) => cost.id === 'apartamento-capitais');
  const prices = Object.values(apartment.componentes.precos_m2_brl);
  assert.equal(prices.length, 22);
  assert.equal(apartment.valor_brl, Math.round(prices.reduce((a, b) => a + b) / prices.length * apartment.componentes.area_m2 * 100) / 100);
  const nurseries = checkpoints.custos.find((cost) => cost.id === 'dez-creches');
  assert.equal(nurseries.valor_brl, nurseries.componentes.valor_unidade_brl);
});

test('the mensalão comparison identifies its scope and nominal values', () => {
  const point = buildCheckpoints({ salario, filme, checkpoints }).find((entry) => entry.id === 'mensalao');
  assert.equal(point.valueBRL, 55_000_000);
  assert.ok(point.atBRL > 0 && point.atBRL < filme.pedido_brl);
  assert.match(point.text, /cooptação.*2012.*2,4 vezes/);
  assert.match(point.reference, /AP 470.*2012.*R\$ 55 milhões/);
  assert.match(checkpoints.mensalao.fontes[0].url, /noticias\.stf\.jus\.br/);
});

for (const invalid of [
  null,
  { ...checkpoints, custos: [] },
  { ...checkpoints, custos: [{ ...checkpoints.custos[0], valor_brl: 0 }] },
  { ...checkpoints, custos: [{ ...checkpoints.custos[0], valor_brl: '78690' }] },
  { ...checkpoints, custos: [{ ...checkpoints.custos[0], fontes: [] }] },
  { ...checkpoints, custos: [{ ...checkpoints.custos[0], fontes: [{ nome: 'Fonte' }] }] },
  { ...checkpoints, custos: [checkpoints.custos[0], checkpoints.custos[0]] },
  { ...checkpoints, bolsa_familia: { ...checkpoints.bolsa_familia, valor_brl: -1 } },
  { ...checkpoints, educacao: null },
  { ...checkpoints, mensalao: { ...checkpoints.mensalao, referencia: '' } },
]) {
  test(`invalid checkpoints ${JSON.stringify(invalid).slice(0, 90)} are rejected`, async (context) => {
    mockData(context, salario, filme, invalid);
    await assert.rejects(loadPageData('/'), /checkpoints\.json inválido/);
  });
}

test('missing checkpoint data fails instead of silently omitting the cards', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('checkpoints.json')) return new Response('Not found', { status: 404 });
    return Response.json(url.endsWith('salario-minimo.json') ? salario : filme);
  });
  await assert.rejects(loadPageData('/'), /checkpoints\.json: 404/);
});

test('coffee opens the journey and the second card explains the scale', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  assert.equal(points[0].id, 'cafe');
  assert.equal(points[0].moneyHeading, 'R$ 1');
  assert.equal(points[0].heading, '1 cafezinho');
  assert.equal(points[0].text, 'Aqui começa a fortuna que Flávio pediu a Vorcaro. Um cafezinho na rodoviária. Esse é o caminho até os R$ 134 milhões.');
  assert.equal(points[1].id, 'escala');
  assert.equal(points[1].text, 'A coluna tem 12 pixels de largura: cada linha de 1 pixel de altura vale R$ 1.200,00. Cada traço da régua marca R$ 120 mil.');
  assert.equal(points[1].quantity * 100, points[1].atBRL);
});

test('monetary milestones are round and nearly evenly spaced', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints }).slice(1);
  for (const [index, point] of points.entries()) {
    assert.equal(point.atBRL % 1_000_000, 0);
    if (!index) continue;
    const gap = point.atBRL - points[index - 1].atBRL;
    assert.ok(gap >= 4_000_000 && gap <= 6_000_000, point.id);
  }
  assert.equal(points.at(-1).atBRL, 130_000_000);
});

test('round purchase quantities fit their budget using integer cents', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  for (const cost of checkpoints.custos) {
    const point = points.find(point => point.id === cost.id);
    assert.ok(point, cost.id);
    const capacity = Math.floor(Math.round(point.atBRL * 100) / Math.round(cost.valor_brl * 100));
    const step = capacity < 10 ? 1 : capacity < 100 ? 5 : 10 ** (Math.floor(Math.log10(capacity)) - 1);
    assert.equal(point.quantity, Math.floor(capacity / step) * step, cost.id);
    const spent = Math.round(cost.valor_brl * 100) * point.quantity;
    assert.equal(Math.round(point.spentBRL * 100), spent, cost.id);
    assert.equal(Math.round(point.balanceBRL * 100) + spent, Math.round(point.atBRL * 100));
    assert.ok(point.spentBRL <= point.atBRL);
    assert.equal(point.moneyHeading, scale.fmtBRLCompact(point.atBRL));
  }
});

test('public vehicles, delegacias and municipal prevention replace the travel cards', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  for (const id of ['onibus-publicos', 'ambulancias', 'delegacias', 'viaturas', 'prevencao-drogas']) {
    assert.ok(points.some(point => point.id === id && point.quantity > 0), id);
  }
  assert.ok(!points.some(point => ['volta-ao-mundo', 'estudar-fora'].includes(point.id)));
  const buses = checkpoints.custos.find(cost => cost.id === 'onibus-publicos');
  assert.equal(buses.valor_brl, Math.round(85_000_000 / 96 * 100) / 100);
  assert.match(points.find(point => point.id === 'ambulancias').heading, /ambulâncias do SAMU/);
  assert.match(points.find(point => point.id === 'delegacias').heading, /delegacias de polícia/);
  assert.match(points.find(point => point.id === 'prevencao-drogas').heading, /programas anti-drogas/);
  assert.equal(points.filter(point => point.id === 'ambulancias').length, 1);
  assert.ok(!points.some(point => ['helicoptero','ferrari','mansao','aviao-virginia'].includes(point.id)));
  assert.match(points.find(point => point.id === 'prevencao-drogas').text, /prevenção à violência e drogas.*Fortaleza.*2025/);
  assert.equal(checkpoints.custos.find(cost => cost.id === 'viaturas').valor_brl, 152899);
});

test('the separate Harvard reference preserves five complete descendant generations', () => {
  const point = buildCheckpoints({ salario, filme, checkpoints }).find(point => point.id === 'herdeiros');
  const studies = checkpoints.estudos_herdeiros;
  assert.equal(studies.valor_brl, 4 * (100134 + 4954) * 5);
  assert.equal(point.quantity, 5);
  assert.equal(point.sourceId, studies.id);
  assert.match(point.text, /62 descendentes/);
  assert.equal(62 * studies.valor_brl, 130_309_120);
  assert.ok(126 * studies.valor_brl > filme.pedido_brl);
});

test('coin proportionality and annual social units stay explicit', () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  const coin = points.find(point => point.id === 'moeda');
  assert.equal(coin.valueBRL, filme.pedido_brl / salario.valor_brl * 0.05);
  assert.equal(coin.moneyHeading, scale.fmtBRL(4133.25));
  for (const id of ['medicos', 'professores', 'acolhimento']) {
    assert.match(points.find(point => point.id === id).heading, /por um ano/);
  }
  assert.match(points.find(point => point.id === 'covid').heading, /internações/);
  assert.equal(points.find(point => point.id === 'covid').text, 'R$ 4.864,26 por internação de Covid, valor médio aprovado pelo SUS em 2020. A CPI da Pandemia apontou ações e omissões do governo Bolsonaro e mortes evitáveis.');
  assert.equal(points.find(point => point.id === 'delegacias').heading, '7 delegacias de polícia');
  assert.equal(points.find(point => point.id === 'prevencao-drogas').heading, '9 programas anti-drogas');
  assert.doesNotMatch(points.find(point => point.id === 'upa').heading + points.find(point => point.id === 'upa').text, /porte/);
});

test('card copy contains data and sources instead of disclaimers', async () => {
  const points = buildCheckpoints({ salario, filme, checkpoints });
  for (const point of points) {
    assert.match(point.moneyHeading, /^R\$/);
    assert.doesNotMatch(point.text + point.reference, /não garante|vidas salvas|à parte|não inclui|ilustrativ|sem bolsa|Não é|não uma|Não há|Antes de|antes de pagar/i);
  }
  for (const path of ['src/components/Hero.astro', 'src/pages/index.astro', 'src/pages/referencias.astro']) {
    assert.doesNotMatch(await read(path), /Equipamentos e funcionamento à parte|conclusão sobre a legalidade|na conversão publicada pelo Opera Mundi|garante vidas salvas|sem 13º/);
  }
  assert.doesNotMatch(await read('src/lib/render.ts'), /col-note__budget/);
});

test('references explain the funding and salary scope without changing card copy', async () => {
  const references = (await read('src/pages/referencias.astro')).replace(/\s+/g, ' ');
  assert.match(references, /creches.*aporte médio de R\$ 3,5 milhões.*contrapartida municipal/);
  assert.match(references, /professores.*12 vencimentos mensais.*13º salário.*encargos patronais/);
  assert.match(references, /programas anti-drogas.*pacote de R\$ 8,5 milhões.*não um programa isolado/);
  const points = buildCheckpoints({ salario, filme, checkpoints });
  assert.equal(points.find(point => point.id === 'dez-creches').heading, '25 creches');
  assert.equal(points.find(point => point.id === 'professores').heading, '480 professores por um ano');
  assert.equal(points.find(point => point.id === 'prevencao-drogas').heading, '9 programas anti-drogas');
  for (const point of points) {
    assert.doesNotMatch(point.text, /contrapartida municipal|encargos patronais|não um programa isolado/);
  }
});

test('the opening leads directly to the column and preserves both controls', async () => {
  const page = await read('src/pages/index.astro');
  const hero = await read('src/components/Hero.astro');
  assert.match(page, /<Hero \/>\s*<WealthColumn/);
  assert.doesNotMatch(page, /id="key"|id="col-start"|Primeiro, a chave/);
  assert.match(hero, /id="btn-start"/);
  assert.match(hero, /id="speed-select-start"/);
  assert.match(hero, /<ScaleKey \/>/);
  assert.doesNotMatch(hero, /scale-info|ⓘ|Opera Mundi|para um filme sobre seu pai/);
  assert.doesNotMatch(page, /wireScaleInfo/);
  const scaleKey = await read('src/components/ScaleKey.astro');
  for (const kind of ['salary', 'year']) assert.ok(scaleKey.includes(`data-money-block="${kind}"`));
  assert.doesNotMatch(scaleKey, /1 vida de economia|data-money-block="life"|earnings-value|47 anos/);
  assert.doesNotMatch(scaleKey, /tooltip|<button|\shidden(?:[=\s>])/);
  assert.match(await read('src/lib/render.ts'), /de trabalho · \$\{fmtLives/);
});

test('the ruler has black minor ticks and a yellow major tick every five marks', async () => {
  const css = await read('src/styles/global.css');
  const svgUrl = css.match(/url\("(data:image\/svg\+xml[^\"]+)"\)/)[1];
  const svg = decodeURIComponent(svgUrl.split(',').slice(1).join(','));
  assert.match(svg, /height='500'/);
  assert.match(svg, /<g fill='#000000'>/);
  assert.match(svg, /<rect x='0' y='0' width='20' height='2' fill='#fbb216'/);
  for (const y of [100, 200, 300, 400]) {
    assert.ok(svg.includes(`<rect x='0' y='${y}' width='10' height='2'/>`));
  }
});

for (const [label, patch] of [
  ['missing order', { ordem: undefined }],
  ['repeated order', { ordem: [...checkpoints.ordem.slice(0, -1), checkpoints.ordem[0]] }],
  ['unknown milestone', { ordem: ['unknown', ...checkpoints.ordem.slice(1)] }],
  ['missing unit', { custos: checkpoints.custos.map((cost, index) => index ? cost : { ...cost, unidade_singular: '' }) }],
  ['fractional family', { familia: { primeira_geracao: 2.5, filhos_por_descendente: 2 } }],
  ['zero family', { familia: { primeira_geracao: 2, filhos_por_descendente: 0 } }],
  ['missing studies', { estudos_herdeiros: undefined }],
  ['invalid studies', { estudos_herdeiros: { ...checkpoints.estudos_herdeiros, valor_brl: 0 } }],
]) {
  test(`invalid checkpoint metadata: ${label}`, async context => {
    mockData(context, salario, filme, { ...checkpoints, ...patch });
    await assert.rejects(loadPageData('/'), /checkpoints\.json inválido/);
  });
}
