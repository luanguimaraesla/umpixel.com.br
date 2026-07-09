# Dados

Esta pasta é a **fonte única de verdade** do site e fica em `public/data/`, então cada arquivo
é servido em `https://umpixel.com.br/data/<arquivo>.json`. O site **não** embute esses números
no HTML: o JavaScript busca (`fetch`) esses JSON em tempo de execução e monta as views
dinamicamente. Para atualizar o site, basta um script de ingestão sobrescrever estes arquivos.

Toda a pesquisa inicial foi feita em **08/07/2026**, sempre priorizando fontes oficiais. Cada
arquivo guarda os links e a data de acesso.

## Arquivos

### `salario-minimo.json`
Salário mínimo nacional de 2026: **R$ 1.621,00**, fixado pelo Decreto nº 12.797/2025 (Planalto),
com vigência a partir de 1º de janeiro de 2026. É o valor padrão da calculadora do site.

**Como atualizar:** um novo decreto é publicado todo mês de dezembro. Atualize `valor_brl`,
`instrumento_legal`, `vigencia`, `contexto` e `acessado_em`.

### `cambio-usd-brl.json`
Cotação PTAX de fechamento do dólar (Banco Central do Brasil), usada para converter as fortunas
em dólar para reais. Valor de referência: **R$ 5,1458** por US$ 1,00 em 07/07/2026.

**Como atualizar:** consulte a PTAX mais recente na API Olinda do BCB (a URL está no arquivo) e
atualize `taxa_venda`, `taxa_compra`, `data_cotacao` e `serie_recente`.

### `bilionarios-brasil.json`
Os cinco brasileiros mais ricos segundo a lista anual **Forbes World's Billionaires 2026**
(divulgada em 10/03/2026, valores de 01/03/2026). Usamos a lista anual, e não a de tempo real,
porque ela é estável e citável. As observações registram por que Vicky Safra não entra no
ranking brasileiro e a variação de tempo real de André Esteves.

**Como atualizar:** a lista anual da Forbes sai todo ano em março/abril. Substitua o `top5`, o
`total_top5_usd_bilhoes` e as datas. O primeiro item de `top5` é tratado como a pessoa mais rica;
mantenha a ordem por `posicao`.

O primeiro colocado carrega ainda `fonte_riqueza_desde` (ano em que a fonte de riqueza começou;
2004 para Eduardo Saverin, ano da fundação do Facebook). O site usa esse ano para estimar em quanto
tempo a pessoa mais rica juntaria o que você guarda numa vida inteira (ver `/referencias`). Só o 1º
colocado precisa do campo; preencha os demais apenas quando o ano de origem for inequívoco.

### `renda-brasil.json`
Indicadores de renda e desigualdade do Brasil (IBGE PNAD Contínua e OCDE): rendimento médio,
percentual de trabalhadores que ganham até um salário mínimo e coeficientes de Gini. Hoje só
alimenta a lista de fontes do rodapé; está reservado para a fase futura dos "fatos
intermediários".

**Como atualizar:** a PNAD Contínua é trimestral (IBGE); a OECD Income Distribution Database é
atualizada de forma irregular.

### `patrimonio-familia.json`
Estimativa do patrimônio líquido mediano de uma família brasileira ao fim da vida de trabalho
(~65 anos): **R$ 200 mil**, dentro de uma faixa de R$ 150 mil a R$ 250 mil. Não existe estatística
oficial, então o valor é sintetizado a partir de blocos verificáveis (mediana UBS, casa própria dos
60+, benefícios do INSS no piso) e sempre apresentado como estimativa. A metodologia completa fica
em `/referencias`.

**Como atualizar:** este número é revisado manualmente, sem automação, quando a UBS ou a Anbima
publicam novas edições dos relatórios citados. Atualize `valor_brl`, `faixa_brl`, `metodologia`, as
`fontes` e `acessado_em`.

### `poupanca-familias.json`
Taxa média de poupança por faixa de renda familiar per capita, medida em salários mínimos, do
**Estudo Especial 107 do Banco Central** com dados da POF 2017-2018 do IBGE. Alimenta o modelo
realista de patrimônio: quanto uma família de cada faixa consegue guardar e capitalizar ao longo da
vida de trabalho. O campo `horizonte_anos` é **47** (dos 18 aos 65 anos) e o `retorno_real_anual` é
**0,03** (3% ao ano, real). Cada item de `faixas` traz `ate_sm` (o teto da faixa em salários mínimos,
`null` na faixa mais alta) e `taxa` (a fração da renda poupada). Consumido por `src/lib/render.ts` e
`src/lib/referencias.ts`.

**Como atualizar:** revise as `faixas` e o `retorno_real_anual` quando o Banco Central publicar uma
nova edição do estudo ou quando sair uma nova POF. Atualize `faixas`, `horizonte_anos`,
`retorno_real_anual`, `fontes` e `acessado_em`.

### `bilionarios-mundo.json`
A pessoa mais rica do mundo, agora pelo valor de **tempo real** da Forbes (não mais a lista anual):
Elon Musk, **US$ 1.053 bilhões** (US$ 1,05 trilhão) em 01/07/2026. Em 12/06/2026 ele se tornou o
primeiro trilionário da história, no IPO da SpaceX, quando a Forbes calculou seu patrimônio em
~US$ 1,1 tri. O site passou a usar o tempo real (e não mais a lista anual de março de 2026, US$ 839
bi) justamente para registrar o marco do trilhão. O Brasil segue na lista anual estável
(`bilionarios-brasil.json`), porque o tempo real do ranking brasileiro é volátil; as duas fontes são
independentes.

**Como atualizar:** consulte o valor de tempo real no perfil da Forbes (a URL está no arquivo) e
atualize `pessoa_mais_rica.patrimonio_usd_bilhoes`, `data_referencia_valores` (a data do valor) e
`acessado_em`. O front lê `pessoa_mais_rica.{nome,patrimonio_usd_bilhoes,ranking_mundial,fonte_riqueza}`,
`data_referencia_valores`, `fontes[].{nome,url}` e `acessado_em`.

### `comparacoes-publicas.json`
Referências de escala pública para as frases que aparecem no meio das colunas: o PIB de alguns
países (em dólar, convertido pela PTAX em tempo de execução, como as fortunas) e o custo de algumas
políticas públicas em reais (hospital, creche, educar todos os alunos por um ano, erradicar o
analfabetismo, casa média). O front usa esses números para dizer coisas como "você acabou de passar
o PIB de Portugal" ou "isso construiria N hospitais". Cada `país` traz `pib_usd_bilhoes`,
`ano_referencia` e a `preposicao` correta da frase ("de", "do" ou "da"). Cada `custo` traz
`valor_brl` ou, no caso de educar todos os alunos, os dois componentes
`componentes.{valor_aluno_ano_brl,matriculas}`, multiplicados no site. As estimativas guardam uma
`nota` explicando a composição. Cada `país` e cada `custo` traz ainda sua própria `fonte`
(`nome`, `url`), citada direto no card.

Este arquivo é **opcional**: o site o busca com um `.catch` e, se ele faltar, as frases que dependem
dele simplesmente não aparecem, sem quebrar a página.

**Como atualizar:** o PIB vem do Banco Mundial (PIB nominal corrente); reveja quando sair um novo
ano-base. Os custos vêm de fontes setoriais (Novo PAC, FNDE, Todos Pela Educação, FipeZAP);
atualize `valor_brl` ou os `componentes`, revise as `notas` das estimativas e a `acessado_em`.

## Contrato

O front-end lê estes campos; mantenha os nomes ao atualizar:

- `salario-minimo.json`: `valor_brl`, `vigencia`, `instrumento_legal`, `fontes[].{nome,url}`, `acessado_em`
- `cambio-usd-brl.json`: `taxa_venda`, `data_cotacao`, `fontes[].{nome,url}`, `acessado_em`
- `bilionarios-brasil.json`: `top5[].{posicao,nome,patrimonio_usd_bilhoes,fonte_riqueza}`, `top5[0].fonte_riqueza_desde`, `total_top5_usd_bilhoes`, `data_referencia_valores`, `fontes[].{nome,url}`, `acessado_em`
- `renda-brasil.json`: `fontes[].{nome,url}`, `acessado_em`
- `patrimonio-familia.json`: `valor_brl`, `faixa_brl.{min,max}`, `fontes[].{nome,url}`, `acessado_em`
- `poupanca-familias.json`: `horizonte_anos`, `retorno_real_anual`, `faixas[].{ate_sm,taxa}`, `fontes[].{nome,url}`, `acessado_em`
- `bilionarios-mundo.json`: `pessoa_mais_rica.{nome,patrimonio_usd_bilhoes,ranking_mundial,fonte_riqueza}`, `data_referencia_valores`, `fontes[].{nome,url}`, `acessado_em`
- `comparacoes-publicas.json` (opcional): `paises[].{nome,preposicao,pib_usd_bilhoes,ano_referencia,fonte.{nome,url}}`, `custos[].{id,valor_brl,fonte.{nome,url}}` ou `custos[].componentes.{valor_aluno_ano_brl,matriculas}`, `custos[].nota` nas estimativas, `fontes[].{nome,url}`, `acessado_em`
