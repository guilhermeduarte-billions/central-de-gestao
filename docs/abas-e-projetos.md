# Abas e projetos

Caso Billions do Guilherme Duarte. Outra gerência troca os IDs. O papel de cada aba e de cada projeto permanece.

A Central existe para três frentes.

## Antecipação

Ver a carteira antes de virar queda.

- **Healthscore** — média acumulada de 8 semanas (`algorithm_health_avg_score`), não o Score Operacional da semana. Cortes: HS ≤ 17, HS ≤ 21 e resultado ≤ 7. A coluna AÇÃO já vem com a ação aberta no Ekyte e o prazo. HS ≤ 17 sem task é projeto sem olho na bola.
- **Plano de Ação** — o PA da Coordenação escrito no FLOW contra as ações abertas no Ekyte. Três buracos: plano sem execução, execução sem plano, ou nenhum dos dois.
- **Projeto Antecipação HS ≤ 21** (`297829`) — 5W1H, Quality Check e comitê de carteira. É o projeto default da skill `ekyte-acao-gerencial`.

## Retenção

Segurar quem já está em risco.

- **Projeto Recuperação** (`303719`) — aviso prévio, churn e plano de recuperação. Skill `ekyte-acao-gerencial`.

## Expansão

Crescer a conta.

- **Aba Expansão** — cards de Diagnóstico a Follow-up, com a task de expansão da coordenação ao lado, e o bloco de task sem card.
- **Projeto Expansão** (`305096`) — oportunidade do Account Planning ao Follow-up. Skill `ekyte-expansao`. Parte das tarefas de diagnóstico nasce solta no workspace da coordenação, com `[EXP]` no título e sem projeto preenchido. A aba reconhece as duas formas.

## Follow de execução

Tarefas, Adoção e Sprint Growth não são uma quarta frente. São o acompanhamento do que subiu nas três.

- **Tarefas** — o que está atrasado, vence hoje ou em 48h, na Gerência e na Operação. O coordenador sai do título `[Billions][Nome]`, não do executor atual (na validação a tarefa volta para a gerência).
- **Adoção** — concluídas ÷ (subidas − canceladas), por semana (etiqueta `SEMANA XX`) e por mês, na Gerência e na Operação de cada coordenação.
- **Sprint Growth** — das ações com a tag `SPRINT GROWTH`, a porcentagem que sobe e fecha na mesma sprint. Primeiro por coordenação (Gustavo, Guilherme, Nayara); abaixo, por dupla GP/cientista do FLOW. Célula sem subida = nada novo naquela sprint. Abertas das sprints anteriores = o que subiu numa sprint já fechada e ainda não concluiu.

## Apoio

Não são a frente. Servem para o resto do trabalho de gestão.

No workspace de gerência `112006` (`[Billions] Gestão Gerencial`):

- **Solicitação Gerencial** (`303720`) — pedido avulso do gerente, fora do comitê.
- **People** (`314844`) — equipe, RH, carreira e plano de ação da direção sobre o time.
- **Strategy Review Q4** (`331912`) — backlog do ciclo Q4: gates, retrospectiva, breakeven, metas, sazonalidade, ROPRE.

Operação, um workspace por coordenação. O projeto nasce junto com a coordenação, então o ID não é fixo na gerência. É o canal do coordenador para o time executar as três frentes. No caso Guilherme: workspace `145324`, projeto **Solicitação Coord. Guilherme Duarte** (`312831`). Skill `ekyte-acao-operacional`.

## Como a tarefa acha o cliente

A ação gerencial no Ekyte não tem campo de cliente. O cruzamento é pelo texto, nesta ordem:

1. `(TICKER)` ou `[TICKER]` no título ou na descrição.
2. Rótulo de lista, como `GIG — Gigaclima`.
3. Token isolado em maiúsculas com 4 ou mais letras.
4. Marca, só no título (nome do workspace, razão social, `app/api/aliases.json`).
5. Workspace de cliente, como prova direta nas tarefas operacionais e na Sprint Growth.

Tarefa que não casa com ninguém não é erro: é ação de carteira (Black Friday, Strategy Review) e aparece em bloco separado.
