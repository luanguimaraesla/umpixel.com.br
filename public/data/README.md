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

### `renda-brasil.json`
Indicadores de renda e desigualdade do Brasil (IBGE PNAD Contínua e OCDE): rendimento médio,
percentual de trabalhadores que ganham até um salário mínimo e coeficientes de Gini. Hoje só
alimenta a lista de fontes do rodapé; está reservado para a fase futura dos "fatos
intermediários".

**Como atualizar:** a PNAD Contínua é trimestral (IBGE); a OECD Income Distribution Database é
atualizada de forma irregular.

### `crescimento-real-salario.json`
Ganho real anual do salário mínimo (acima da inflação), usado **só** para projetar o patrimônio
acumulado numa vida inteira de trabalho — não afeta a escala de pixels, que segue o salário de
hoje. Padrão: **2,5% ao ano**, o teto da política de valorização vigente (arcabouço fiscal, até
2030); o reajuste de 2026 atingiu esse teto.

**Como atualizar:** revise `taxa_real_anual` se a regra do arcabouço fiscal mudar. Para um
cenário mais conservador, use a média histórica do rendimento real do trabalho (~0,9% ao ano).

### `patrimonio-familia.json`
Estimativa do patrimônio líquido mediano de uma família brasileira ao fim da vida de trabalho
(~65 anos): **R$ 200 mil**, dentro de uma faixa de R$ 150 mil a R$ 250 mil. Não existe estatística
oficial, então o valor é sintetizado a partir de blocos verificáveis (mediana UBS, casa própria dos
60+, benefícios do INSS no piso) e sempre apresentado como estimativa. A metodologia completa fica
em `/referencias`.

**Como atualizar:** este número é revisado manualmente, sem automação, quando a UBS ou a Anbima
publicam novas edições dos relatórios citados. Atualize `valor_brl`, `faixa_brl`, `metodologia`, as
`fontes` e `acessado_em`.

### `bilionarios-mundo.json`
A pessoa mais rica do mundo segundo a lista anual **Forbes World's Billionaires 2026** (divulgada em
10/03/2026, valores de 01/03/2026): Elon Musk, **US$ 839 bilhões**. Usamos a lista anual, e não a de
tempo real, porque ela é estável e citável; as observações registram a variação de tempo real.

**Como atualizar:** a lista anual da Forbes sai todo mês de março. Substitua `pessoa_mais_rica`,
`data_publicacao`, `data_referencia_valores` e `acessado_em`.

## Contrato

O front-end lê estes campos; mantenha os nomes ao atualizar:

- `salario-minimo.json`: `valor_brl`, `vigencia`, `instrumento_legal`, `fontes[].{nome,url}`, `acessado_em`
- `cambio-usd-brl.json`: `taxa_venda`, `data_cotacao`, `fontes[].{nome,url}`, `acessado_em`
- `bilionarios-brasil.json`: `top5[].{posicao,nome,patrimonio_usd_bilhoes,fonte_riqueza}`, `total_top5_usd_bilhoes`, `data_referencia_valores`, `fontes[].{nome,url}`, `acessado_em`
- `renda-brasil.json`: `fontes[].{nome,url}`, `acessado_em`
- `crescimento-real-salario.json`: `taxa_real_anual`, `fontes[].{nome,url}`, `acessado_em`
- `patrimonio-familia.json`: `valor_brl`, `faixa_brl.{min,max}`, `fontes[].{nome,url}`, `acessado_em`
- `bilionarios-mundo.json`: `pessoa_mais_rica.{nome,patrimonio_usd_bilhoes,ranking_mundial,fonte_riqueza}`, `data_referencia_valores`, `fontes[].{nome,url}`, `acessado_em`
