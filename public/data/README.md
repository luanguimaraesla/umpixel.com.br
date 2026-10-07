# Dados

As páginas carregam três arquivos desta pasta, servidos em `/data/<arquivo>.json`:
`salario-minimo.json`, `filme-bolsonaro.json` e `checkpoints.json`.
Os demais JSON são o histórico da versão anterior.

## `salario-minimo.json`

Salário mínimo nacional de 2026: **R$ 1.621,00**, Decreto nº 12.797/2025, vigente desde
1º de janeiro de 2026. É a referência salarial das duas páginas.

- `valor_brl`: valor mensal positivo e finito, em reais.
- `vigencia`: data no formato `AAAA-MM-DD`.
- `instrumento_legal`: decreto que fixa o valor.
- `fontes[].{nome,url}` e `acessado_em`: fontes e data de consulta.

## `filme-bolsonaro.json`

O Opera Mundi informa **US$ 24 milhões pedidos**, cerca de **R$ 134 milhões**, para
*Dark Horse*, filme sobre Jair Bolsonaro.

- `titulo`: nome do filme.
- `pedido_usd` e `pedido_brl`: valores em dólares e reais publicados na cobertura.
- `nota_cambio`: origem do equivalente em reais.
- `data_reportagem`: data da matéria.
- `repassado_brl`: registro histórico validado no carregamento.
- `fontes[].{nome,url}` e `acessado_em`: fontes e data de consulta.

## `checkpoints.json`

- `custos[]`: valores por veículo, imóvel, obra, livro, internação ou programa.
  Médicos, professores e vagas de acolhimento usam unidades anuais.
- `mensalao`: R$ 55 milhões destinados à cooptação de parlamentares, relator da AP 470,
  STF, 2012.
- `bolsa_familia`: parcela mensal média por família.
- `educacao`: gasto anual médio por aluno.
- `estudos_herdeiros`: graduação de quatro anos em Harvard para calcular as gerações.
- `ordem[]`: IDs dos custos e dos marcos `escala`, `cinquenta-anos`, `mensalao`,
  `a-cada-cem`, `moeda`, `herdeiros`, `bolsa-familia` e `educacao`.
- `familia`: duas pessoas na primeira geração, dois filhos por descendente.

Cada referência tem `id`, `nome`, `valor_brl`, `contexto`, `referencia`, `fontes` e
`acessado_em`. Os custos e estudos têm `unidade_singular` e `unidade_plural`.
Os IDs são únicos. `contexto` aparece no card; `referencia` detalha o cálculo,
o período e a unidade na metodologia. Os valores são nominais.

`componentes` registra contas reproduzíveis, como área × custo por metro quadrado,
média dos preços nas 22 capitais do FipeZAP e investimento de R$ 85 milhões ÷ 96 ônibus.

`src/lib/checkpoints.ts` gera os mesmos cards nas duas páginas:

- Café: R$ 1, antes dos marcos da lista.
- Escala: segundo card, com largura, valor por linha e régua.
- Compras: capacidade e custo em centavos; quantidades arredondadas para baixo.
- Trabalho: salário mínimo × 12 × 45, por pessoa.
- Para cada R$ 100 e moeda: proporção entre um salário mensal e o pedido inteiro.
- Herdeiros: soma de gerações completas que cabem no pedido.
- Bolsa Família e educação: parte inteira de pedido ÷ custo por unidade, dentro do percurso.
  A quantidade usa o pedido completo; a posição define quando o card aparece.

Os marcos distribuem a leitura em valores monetários redondos. O percurso atual tem
28 cards: café e 27 marcos internos. Um único card fica ativo
na coluna, selecionado pelo valor cruzado pela linha de medição.

## Atualização e validação

Confira cada valor na fonte, revise componentes, unidade, período e data de consulta.
Atualize `contexto` e `referencia` junto com os números.

`src/lib/state.ts` valida valores positivos, fontes completas, IDs únicos, a ordem dos
marcos e os parâmetros familiares. Uma falha de carregamento exibe um aviso e mantém
os controles desabilitados.
