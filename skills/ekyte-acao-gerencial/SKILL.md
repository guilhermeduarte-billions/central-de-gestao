---
name: ekyte-acao-gerencial
description: Use para criar/subir no Ekyte lotes de ações gerenciais Billions a partir de planilhas 5W1H, Quality Check, recuperação (aviso prévio), solicitações gerenciais, People (equipe/RH), Strategy Review Q4 ou CSV/XLSX semelhantes — com roteamento para os projetos gerenciais canônicos (incl. People `314844` e Strategy Review Q4 `331912`), responsáveis, conclusão, links Ekyte, prazos, briefing 5W1H e etiquetas por semana via MCP oficial. Para expansão, use a skill `ekyte-expansao`.
---

> **Caso de uso do Guilherme Duarte (Billions).** Este arquivo é o exemplo que já funciona na coordenação dele. Antes de usar na sua coordenação ou gerência, troque workspace, projeto, tipo de tarefa, fases e executores. Os IDs abaixo são o exemplo concreto, não um padrão universal.

# Ekyte Ação Gerencial

Lotes gerenciais Billions via MCP **`ekyte`** (oficial). Etiquetas: **obrigatório** seguir `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md` (merge com escopo tags + POP Sprint Growth para auditoria cruzada).

Demandas comuns de cliente → `ekyte-task`.

Demandas operacionais da coord. Guilherme → `ekyte-acao-operacional`.

Demandas de expansão Billions → `ekyte-expansao`.

## Workspace e projetos

**Workspace:** `112006` — `[Billions] Gestão Gerencial`

| Projeto | ID | Quando |
|---------|-----|--------|
| Antecipação HS <= 21 | `297829` | 5W1H, QC, comitê ops/carteira (default) |
| Recuperação | `303719` | Aviso prévio / recuperação |
| Solicitação Gerencial | `303720` | Pedido avulso do gerente |
| People | `314844` | People / equipe / RH / carreira / plano de ação de direção-gerência sobre time |
| Strategy Review Q4 | `331912` | Backlog do ciclo Q4 2026 (S38–S42): gates, retrospectiva, breakeven, metas, sazonalidade, ROPRE |

Roteamento:
- 5W1H/QC/comitê ops/carteira sem tema de expansão → `297829`.
- Aviso prévio, recuperação ou plano de churn → `303719`.
- Solicitação pontual avulsa do gerente → `303720`.
- People, equipe, RH, carreira, feedback de time ou PA de direção/gerência sobre pessoas → `314844` ([Billions] People).
- Strategy Review Q4 (backlog, gates, retrospectiva, breakeven, metas, sazonalidade, ROPRE, formalização) → `331912` ([Billions] Strategy Review Q4). Contrato: `Brain/Trabalho V4/Strategy Review/Q4 2026/`.
- Frente de expansão: use `ekyte-expansao` em vez desta skill.
- Comitê ≠ solicitação automática; lote misto deve ser classificado linha a linha.

Links projeto: `#/projects/{id}/edit` · task: `#/tasks/list/{id}/edit` (sempre com `/list/.../edit`).

## Configuração validada

- Tipo: `78753` — workflow `[GESTÃO] Billions`
- Criador padrão: `analitico26.colli@v4company.com`
- `plan_task`: `"1"` · `priority_group`: `"100"` · `estimated_time`: `"120"`

Responsáveis: Ariel, Nayara, Gustavo, Jhonatan — e-mails no histórico da skill (validar com `list_admin_editors_users` se dúvida).

## MCP — tools (servidor `ekyte`)

| Uso | Tool |
|-----|------|
| Dedup / consulta | `list_tasks`, `get_detailed_task` |
| Criar | `create_task` |
| Etiqueta semanal | `list_tags` → `update_task_tags` |
| Ajuste fase/data | `update_task_phase`, `update_task` (se schema expuser campos) |
| Tags QC | mesma sequência; deduplicar por `QUALITY CONTROL` + semana no título/tags |

**Não** usar `ekyte_create_task` / `ekyte_get_task` (legado **`ekyte-colli`**).

Antes de `create_task`: `list_task_types_create_task`, `get_task_type_flow` para tipo `78753` se prazo/fases forem críticos.

## POP — etiquetas (padrão único)

**Leitura obrigatória:** `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md`

**Não usar** `Ação Gerencial - Semana XX` — essa etiqueta **não existe** no padrão Colli (evita criar tag nova por semana/caso de uso).

**Sempre** aplicar **`SEMANA XX`** em todo lote gerencial Billions — inclusive **solicitação**, **recuperação**, **People**, **Strategy Review Q4** e pedidos avulsos **sem** coluna de semana na fonte.

**Resolver o número da semana:**

1. Se a aba/fonte/planilha trouxer semana explícita → usar essa (`Semana 20` → tag `SEMANA 20`).
2. **Strategy Review Q4** → semana do comitê (domingo a sábado), a do cronograma em `Brain/Trabalho V4/Strategy Review/Q4 2026/01-cronograma-s38-s42.md`. Não usar ISO: em 22/09/2026 a ISO é 39 e o comitê é **SEMANA 38**.
3. Senão → **semana atual** = semana ISO da data de criação ou do `currentDueDate` da task (ex.: `2026-07-01` → `SEMANA 27`). Confirmar ID em `list_tags` (tipo `0`, nome exato `SEMANA XX`).

**Tags por rotina** (além de `SEMANA XX` e das automáticas do tipo/projeto):

- **QC** → `QUALITY CONTROL`
- **5W1H / Comitê** → só `SEMANA XX` (+ ex. `[Billions] Ação Gerência & Coordenação`)
- **Recuperação / Solicitação Gerencial / People / Strategy Review Q4** → `SEMANA XX` (semana do comitê no SR Q4; semana atual ou da fonte nos demais); sem tag de rotina extra

Após cada `create_task`:

1. `get_detailed_task` → tags atuais.
2. `list_tags` → resolver `SEMANA XX` (semana atual ou da fonte) e tag de rotina (QC, se aplicável).
3. `update_task_tags` → lista completa (preservar tags já na task + `SEMANA XX` + rotina).
4. Validar com `get_detailed_task`.

Deduplicar QC: task existente com `QUALITY CONTROL` + mesma `SEMANA XX` → não recriar.

## Entradas e filtros

Planilhas 5W1H, QC, recuperação, solicitação, People, Strategy Review Q4 — regras de filtro inalteradas (concluída, link existente, responsável, overlap PA, etc.).

## Antes de criar: deduplicar

1. `list_tasks` — workspace `112006`, janela de datas, palavra-chave título/cliente.
2. Não recriar QC com tag `QUALITY CONTROL` + mesma semana.
3. PA existente → não duplicar PA genérico.
4. Checar `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao.md`.

## Quality Check

Só itens aprovados. Primeira linha do briefing: `Ação gerada a partir do Quality Check de DD/MM/AAAA.` Dependências entre tasks no briefing.

## Título

```
[NN] [Billions] [Nome da Coordenação] Nome da tarefa | Gerencial
```

## Preview obrigatório

Incluir: projeto, **`SEMANA XX` resolvida** (fonte, semana do comitê no Strategy Review Q4, ou semana ISO atual), **etiquetas planejadas** (semana + rotina + tipo/projeto), duplicatas puladas, tabela com executor e prazo. Confirmação explícita antes de qualquer `create_task`.

## Criação

`create_task` — exemplo de payload (adaptar ao schema ativo):

```json
{
  "workspaceId": 112006,
  "ctcTaskProjectId": 297829,
  "ctcTaskTypeId": 78753,
  "userEmail": "analitico26.colli@v4company.com",
  "title": "[01] [Billions] [Ariel Pinguelli] Nome da tarefa | Gerencial",
  "description": "<briefing 5W1H>",
  "currentDueDate": "YYYY-MM-DD",
  "phaseStartDate": "YYYY-MM-DD",
  "initialExecutorEmail": "ariel.pinguelli@v4company.com",
  "estimatedTime": 120,
  "planTask": 1,
  "priorityGroup": 100,
  "quantity": 1
}
```

Trocar `ctcTaskProjectId` para `303719` / `303720` / `314844` / `331912` conforme roteamento. No Strategy Review Q4 o projeto é sempre `331912`.

Em seguida, **para cada task:** fluxo `update_task_tags` do POP.

### Data de início da fase

Enviar `phaseStartDate` + registrar no 5W1H. Validar com `get_detailed_task`. Se divergir, tentar `update_task_phase` / `update_task`; senão reportar ajuste manual na UI.

## Validação

- `list_tasks` por projeto/responsável.
- `get_detailed_task`: projeto, executor vs título, fase, prazo, **tags** (semana + padrão Billions).
- Erro de projeto/executor: `update_task` se disponível; senão task correta + cancelar obsoleta na UI (informar IDs).

## Log e fechamento

**Sempre** bloco em `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao.md`:

- IDs, links, projeto, etiquetas **aplicadas / parciais / pendentes** por semana.
- Pulos e divergências de `phaseStartDate`.

Retorno: totais, tabela ID+link, status das tags por task, confirmação do log.

## Referências Brain

| Arquivo | Uso |
|---------|-----|
| `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md` | POP etiquetas (`SEMANA XX` + tag fixa da rotina) |
| `Brain/Trabalho V4/Projetos/Tarefas Ekyte/escopo-mcp-ekyte-tags.md` | Histórico e status da migração |
| `Brain/Trabalho V4/Projetos/Sprint Growth/pop-auditoria-report-diario-sprint-growth.md` | Tags `SEMANA XX` + `SPRINT GROWTH` na auditoria |
| `Brain/Trabalho V4/Strategy Review/Q4 2026/` | Contrato do ciclo: cronograma S38–S42, gates, escopo e tracker. Backlog sobe no projeto `331912` |
