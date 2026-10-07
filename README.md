# UM PIXEL

Quanto representa o pedido de Flávio Bolsonaro a Daniel Vorcaro para financiar o filme sobre
Jair Bolsonaro? [umpixel.com.br](https://umpixel.com.br) mostra o valor em uma escala simples:
**1 pixel de área = uma nota de R$ 100**. O site está em pt-BR.

A [reportagem do Opera Mundi](https://operamundi.uol.com.br/brasil/flavio-bolsonaro-negociou-com-daniel-vorcaro-r-134-milhoes-para-bancar-filme-sobre-pai/)
informa um pedido de **US$ 24 milhões**, cerca de **R$ 134 milhões**, para *Dark Horse*.
A coluna representa esse pedido. As fontes e as contas ficam em `/referencias`.

## Metodologia

Cada pixel de área representa **R$ 100**. O salário mínimo nacional de **R$ 1.621,00**, vigente
desde 1º de janeiro de 2026 conforme o Decreto nº 12.797/2025, serve apenas para comparar tempo
de trabalho.

| Bloco | Área | Significado |
| --- | --- | --- |
| Uma nota de R$ 100 | 1 px² | cem reais |
| 1 mês | 16,21 px² | um salário mínimo |
| 1 ano | 194,52 px² | doze salários mínimos |
| 47 anos | 9.142,44 px² | renda bruta dos 18 aos 65 anos |

A coluna tem 12 pixels de largura, então cada linha de 1 pixel de altura representa R$ 1.200.
O pedido ocupa **1.340.000 pixels de área**, equivalentes a 1,34 milhão de notas de cem reais:
aproximadamente **6.889 anos**, ou **147 vidas de trabalho**, no salário mínimo. A coluna tem
111.667 pixels de altura; o último pixel de altura é arredondado para cima. Nos blocos menores,
uma última linha parcial mantém a proporção.

As contas usam o salário mínimo vigente, 12 pagamentos por ano e renda bruta.
O valor em reais do pedido é o publicado pela reportagem.

## Checkpoints

A abertura mostra o título, o pedido, o botão de rolagem e o quadro visível de proporções. O primeiro card é
**R$ 1**, um cafezinho na rodoviária. O segundo explica a coluna de 12 pixels e a régua.
São 27 marcos internos próximos de intervalos de **R$ 4 milhões a R$ 6 milhões**, com o
dinheiro como título e a quantidade logo abaixo. No marco de R$ 45 milhões, são 50 pessoas
trabalhando por 45 anos. Custo unitário, arredondamento e saldo aparecem nas referências.

As comparações incluem veículos, imóveis, creches, campus, hospital, UPAs, ambulâncias,
médicos, professores, livros, escolas, asfalto e vagas de acolhimento. Também há ônibus
urbanos, ambulâncias do SAMU, delegacias de polícia, viaturas policiais e programas
anti-drogas de prevenção à violência e drogas. Cada comparação é independente. Os custos identificam
projeto, período, modelo e unidade.

O cenário dos herdeiros começa com duas pessoas e dobra a cada geração. O pedido completo
bancaria quatro anos em Harvard para 62 descendentes, em cinco gerações completas,
com câmbio adotado de R$ 5 por dólar. A moeda de cinco centavos,
comparada com um salário mínimo mensal, equivale a R$ 4.133,25 na escala do pedido.

Na Covid, o card compara financiamento de internações. No acolhimento, compara vagas por ano.

O card do mensalão usa os **R$ 55 milhões destinados à cooptação de parlamentares**, segundo
o voto do relator da AP 470 noticiado pelo STF em 2012. A comparação usa valores nominais.

O pedido equivale a **R$ 8.266.502 para cada R$ 100** de um salário mínimo mensal.
Dentro do percurso, os R$ 134 milhões são comparados com **197.587 parcelas mensais do Bolsa
Família** ou **9.370 alunos por um ano de educação básica**. As quantidades usam o benefício
médio de setembro de 2026 e o gasto por aluno de 2024, arredondadas para baixo.

Um só card fica ativo dentro da coluna. Ele muda quando a linha de medição cruza o valor
do checkpoint, sem sobrepor os marcos menores nem alterar a área de dinheiro.

A rolagem automática começa em **1× (480 pixels por segundo)**. Os dois controles oferecem
apenas **1×, 2× e 3×**, equivalentes a 480, 960 e 1.440 pixels por segundo, e ficam sincronizados.

## Arquitetura e dados

O site é estático, feito com Astro. No navegador, o JavaScript carrega três arquivos:

- `public/data/salario-minimo.json`: salário mínimo vigente e sua fonte legal.
- `public/data/filme-bolsonaro.json`: pedido e fonte da reportagem.
- `public/data/checkpoints.json`: preços, orçamentos, custos unitários e suas fontes.

`src/lib/checkpoints.ts` monta os mesmos marcos e cálculos para as duas páginas.
`src/lib/state.ts` carrega e valida os dados para as duas páginas. A página principal monta a
coluna e seus marcos; `/referencias` explica as contas e lista as fontes. O contrato dos
arquivos fica em `public/data/README.md`.

A miniatura em `public/images/nota-100-reais.png` vem do Banco Central: frente da nota de R$ 100,
recortada, reduzida e com fundo transparente. A origem está em `public/images/README.md` e em
`/referencias`. A miniatura ilustra a unidade.

A tipografia usa Metal Mania no título e Anton nos títulos de seção, ambas com licença SIL OFL
e servidas localmente via `@fontsource`.

## Como rodar

Precisa de Node 20+ e npm.

```sh
make install   # instala as dependências
make dev       # servidor de desenvolvimento
make build     # gera o site estático em dist/
make preview   # serve o build de produção
make check     # verificação de tipos (astro check)
npm test       # testes da escala e do carregamento de dados
```

Rode `make` sem argumentos para ver todos os alvos.

## Inspiração

[1 Pixel Wealth](https://eattherichtextformat.github.io/1-pixel-wealth/), de Matt Korostoff:
a ideia de usar pixels para mostrar dinheiro em escala.

Nenhum código foi copiado da referência; este site foi escrito do zero.

## Licença

[AGPL-3.0](LICENSE). Você pode usar, estudar, modificar e redistribuir, inclusive em serviços de
rede, desde que mantenha a mesma licença e disponibilize o código-fonte.
