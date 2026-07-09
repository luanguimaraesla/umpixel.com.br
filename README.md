# UM PIXEL

Quanto tempo de trabalho custa a riqueza? [umpixel.com.br](https://umpixel.com.br) responde com
uma régua simples: **1 pixel = 1 mês do seu salário**. Doze pixels são um ano, 564 pixels são uma
vida inteira de trabalho. A página desce por marcos: 1 pixel, 12 pixels, o patrimônio de uma
família, R$ 1 bilhão, a pessoa mais rica do Brasil e, no fim, Elon Musk, a pessoa mais rica do
mundo, uma coluna gigante que você desce por minutos sentindo o tamanho da distância. Tudo em
pt-BR, em escala real, com os números ajustáveis pelo seu próprio salário.

## Metodologia

A ideia central é associar **volume a tempo**. Cada mês de salário ocupa um pixel de área; o
tempo de trabalho vira espaço na tela.

| Bloco            | Área      | Significado                          |
| ---------------- | --------- | ------------------------------------ |
| 1 mês (um PIX)   | 1 px²     | um salário mensal                    |
| 1 ano            | 12 px²    | doze salários                        |
| 10 anos          | 120 px²   | cento e vinte salários               |
| 1 vida (47 anos) | 564 px²   | dos 18 aos 65 anos                   |

Salário é **fluxo**; fortuna é **estoque**. Não dá para comparar um contracheque com o
patrimônio de um bilionário, então o site usa duas medidas de uma vida de trabalho. As
comparações em **vidas inteiras de trabalho** usam a renda de uma carreira, tudo o que você
ganharia recebendo 100% do salário ao longo da vida, que é o que a geometria dos pixels mede.
Já o **patrimônio que você realmente juntaria** vem de um modelo mais realista: o salário vezes
a taxa de poupança média da sua faixa de renda (Banco Central, Estudo Especial 107, dados da POF
2017-2018) vezes um fator de acumulação de 47 anos a 3% reais ao ano. Não há projeção de
salário em lugar nenhum: tudo fica congelado no salário de hoje. A metodologia detalhada vive
em `/referencias`. Uma vida de trabalho equivale a 47 anos, dos 18 aos 65 (idade de
aposentadoria masculina do INSS). Usamos 12 salários por ano para manter a metáfora dos 12
pixels; o 13º existe e só reforçaria o argumento. A escala é medida em pixels CSS.

As fortunas em dólar são convertidas para reais pela PTAX do Banco Central. Nas colunas
gigantes, cada linha de 1 pixel de altura vale, num monitor de desktop, uma vida inteira de
trabalho.

## Arquitetura

O site é estático (Astro), mas **não** tem números escritos à mão no HTML. Todos os dados vivem
em `public/data/*.json`, que o Astro serve em `/data/*.json`. No navegador, o JavaScript busca
esses arquivos em tempo de execução e **monta as views dinamicamente**: as fortunas, os nomes,
as conversões, os contadores e a lista de fontes são todos derivados do JSON. Para atualizar o
site, um script de ingestão só precisa sobrescrever os arquivos em `public/data/`, e o HTML não
muda. O front-end lê apenas alguns campos de cada arquivo; o contrato está em `public/data/README.md`.

A página `/referencias` reúne a metodologia, as fontes e as inspirações, e o rodapé aponta para
ela. A tipografia usa Metal Mania no título e Anton nos títulos de seção, ambas com licença SIL
OFL e servidas localmente via `@fontsource`.

## Dados

Todos os números vêm de `public/data/*.json`, a fonte única de verdade do site, com links e datas
de acesso. A pesquisa inicial foi feita em 08/07/2026.

| Dado                         | Valor                         | Fonte                              | Referência    |
| ---------------------------- | ----------------------------- | ---------------------------------- | ------------- |
| Salário mínimo 2026          | R$ 1.621,00                   | Decreto 12.797/2025 (Planalto)     | jan/2026      |
| Câmbio dólar (PTAX)          | R$ 5,1458                     | Banco Central do Brasil            | 07/07/2026    |
| Pessoa mais rica do Brasil   | Eduardo Saverin, US$ 35,9 bi  | Forbes World's Billionaires 2026   | mar/2026      |
| Pessoa mais rica do mundo    | Elon Musk, US$ 839 bi         | Forbes World's Billionaires 2026   | mar/2026      |
| Cinco mais ricos (soma)      | US$ 94,9 bi                   | Forbes World's Billionaires 2026   | mar/2026      |
| Patrimônio de uma família    | R$ 200 mil (estimativa)       | UBS, Anbima, INSS, gov.br, FipeZap | 08/07/2026    |
| Rendimento médio mensal      | R$ 3.726                      | IBGE, PNAD Contínua                | mar–mai/2026  |
| Gini (renda disponível)      | 0,451                         | OCDE, Income Distribution Database | 2022          |

O arquivo `public/data/README.md` explica cada JSON e como atualizá-lo. O `bilionarios-brasil.json`
alimenta a pessoa mais rica do Brasil no fluxo principal; a soma dos cinco maiores saiu do fluxo e
hoje aparece como um marco dentro da coluna de Elon Musk, citada também em `/referencias`. O
`renda-brasil.json` só alimenta a lista de fontes; fica reservado para uma fase futura de fatos
intermediários.

## Como rodar

Precisa de Node 20+ e npm.

```sh
make install   # instala as dependências
make dev       # servidor de desenvolvimento
make build     # gera o site estático em dist/
make preview   # serve o build de produção
make check     # verificação de tipos (astro check)
```

Rode `make` sem argumentos para ver todos os alvos.

## Inspirações

Este projeto foi inspirado por três trabalhos, apenas como referência:

- [Wealth, shown to scale](https://stanford.edu/~bonica/wealth-to-scale/musk-wealth-to-scale-2026.html)
  (Adam Bonica, Stanford): o scroll longo em escala real.
- [1 Pixel Wealth](https://eattherichtextformat.github.io/1-pixel-wealth/) (Matt Korostoff): a
  ideia de 1 pixel como unidade de dinheiro.
- [How Poor Am I?](https://howpoorami.org/pt): a calculadora pessoal e a comparação justa entre
  patrimônios.

**Nenhum código foi copiado das referências; tudo aqui foi escrito do zero.**

## Licença

[AGPL-3.0](LICENSE). Você pode usar, estudar, modificar e redistribuir, inclusive em serviços de
rede, desde que mantenha a mesma licença e disponibilize o código-fonte.
