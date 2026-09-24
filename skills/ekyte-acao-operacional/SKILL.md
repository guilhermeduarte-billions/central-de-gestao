---
name: ekyte-acao-operacional
description: Use para criar/subir no Ekyte lotes de ações operacionais avulsas da coordenação Guilherme Duarte para o time de operações (Cientista, GP, GT, Social Media, Designer — inclui Stephanie Molina e David Dias) — workspace/projeto operacional, briefing, executor, prazos, links Ekyte e etiquetas por semana via MCP oficial.
---

> **Caso de uso do Guilherme Duarte (Billions).** Este arquivo é o exemplo que já funciona na coordenação dele. Antes de usar na sua coordenação ou gerência, troque workspace, projeto, tipo de tarefa, fases e executores. Os IDs abaixo são o exemplo concreto, não um padrão universal.

# Ekyte Ação Operacional

**Use esta skill** quando você (Guilherme, como coordenador) quiser subir tarefas avulsas para o **time de operações** — Fabio (Cientista), Nathan (GP), Stephanie (GP), Lucas (GT), David (GT), Bhrenda (Social Media) ou André (Designer). Esse é o objetivo principal.

Lotes operacionais avulsos da coordenação **Guilherme Duarte** via MCP **`ekyte`** (oficial). Etiquetas: **obrigatório** seguir `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md`.

Para outros contextos, use outra skill:
- Demandas de **cliente** → `ekyte-task`
- Ações **gerenciais** Billions (5W1H/QC/recuperação/expansão dos coords) → `ekyte-acao-gerencial`

## Workspace e projeto

**Workspace:** `145324` — `[BILLIONS] Coord. Guilherme Duarte`

| Projeto | ID | Quando |
|---------|-----|--------|
| Solicitação Coord. Guilherme Duarte | `312831` | Pedidos avulsos do coordenador para o time de operações (default e único) |

Sem roteamento multi-projeto — todo lote operacional vai para `312831`.

Links projeto: `#/projects/{id}/edit` · task: `#/tasks/list/{id}/edit` (sempre com `/list/.../edit`).

## Configuração validada

- Tipo: `83921` — workflow `[Coord] Billions` (`[Coord] Billions (padrão)`)
- `allocationType`: `10` (Agile → **exige `phaseDueDate`**) · `estimatedTime`: `120` · `priorityGroup`: `100` · `situation`: `10` (Active)
- Criador: `analitico26.colli@v4company.com` (Guilherme, id `9d6271b6-aa05-4aa8-ba50-d79f7778afa0`)

**Fases do fluxo (usar no `flow[]`):**

| Seq | phaseId | Fase | Executor |
|-----|---------|------|----------|
| 1 | `84977` | Análise OPS | **executor do pedido** (ops) |
| 2 | `84978` | Validação Coordenação / Gerência | **Guilherme** (`9d6271b6-aa05-4aa8-ba50-d79f7778afa0`) |

⚠️ O fluxo default traz **Vinícius Colli** como executor das duas fases. **Sempre** sobrescrever no `flow[]`: fase 1 = ops, fase 2 = Guilherme. Sem isso, a validação cai no Vinícius.

Antes de `create_task` (se em dúvida sobre fases/IDs): `get_task_type_flow` (`workspaceId` 145324, `id` 83921).

## Time operacional (FLOW)

`executorId` no `create_task` é **GUID**, não e-mail. IDs já resolvidos (validar com `list_admin_editors_users` se algum falhar):

| Papel | Nome | E-mail | executorId (GUID) |
|-------|------|--------|-------------------|
| Cientista | Fabio Junior | `fabiojose.aiello@v4company.com` | `a2f17bce-eed7-4ea6-beda-9efd449010ec` |
| GP | Nathan Nixon | `nathan.nixon@v4company.com` | `df6a2663-adca-4bd7-b40b-9e7612e9bab3` |
| GP | Stephanie Molina | `stephanie.molina@v4company.com` | `2e3d7c3c-235a-4420-a467-918db73b3624` |
| GT | Lucas Silva | `lucas.silva.santos@v4company.com` | `9317ef0f-ffa4-452c-a851-2f524dee9fd5` |
| GT | David Dias | `david.dias@v4company.com` | `756dec5a-4e14-419d-b286-f5ea948a3cc3` |
| Social Media | Bhrenda Silva (Cruz) | `bhrenda.cruz@v4company.com` | `88de0e30-f343-4ce4-a3bf-a5d2ff41edb0` |
| Designer | André Emanuel | `andre.emanuel@v4company.com` | `aadf78c4-e642-450b-9ba1-fde2a0cab489` |

⚠️ `list_admin_editors_users` com `textSearch: "Lucas"` retorna vários — um dos GTs é **Lucas Silva** (`lucas.silva.santos@v4company.com`). Prefira buscar por nome completo ou usar o GUID acima.

⚠️ Há **2 GPs** (Nathan, Stephanie) e **2 GTs** (Lucas, David). Se o pedido só disser o papel, perguntar qual pessoa.

⚠️ **Papel corrigido em ago/2026:** Nathan é **GP** e Fábio é **Cientista** — a tabela já está certa acima. O FLOW rotula `account_manager` como "GP", o que inverte as duas cadeiras se você confiar no label dele. Fonte viva de pessoas do time: `Brain/automations/chat_dm/roster.yaml`. GUIDs de Stephanie e David resolvidos em `list_admin_editors_users` em 2026-08-25.

Roteamento de executor:
- Vem do pedido do usuário (papel ou nome).
- Se ambíguo (ex.: só "GP" ou só "GT") → perguntar.

Título **sempre** com `[Guilherme Duarte]` (coordenação), **não** com nome do executor.

## MCP — tools (servidor `ekyte`)

| Uso | Tool |
|-----|------|
| Dedup / consulta | `list_tasks`, `get_detailed_task` |
| Criar | `create_task` |
| Etiqueta semanal | `list_tags` → `update_task_tags` |
| Ajuste fase/data | `update_task_phase`, `update_task` (se schema expuser campos) |

**Não** usar `ekyte_create_task` / `ekyte_get_task` (legado **`ekyte-colli`**).

## POP — etiquetas

**Leitura obrigatória:** `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md`

**Sempre** aplicar **`SEMANA XX`** em todo lote operacional — se a fonte não trouxer semana, usar a **semana ISO atual** (data de criação ou `currentDueDate` da task).

**Resolver o número da semana:**

1. Se o pedido trouxer semana explícita → usar essa (`Semana 20` → tag `SEMANA 20`).
2. Senão → semana ISO da data de criação ou do `currentDueDate` (ex.: `2026-07-07` → `SEMANA 28`). Resolver o ID em `list_tags` (`type: 0`, `textKey: 20`, `textSearch: "SEMANA XX"`).

**Tags por rotina:** ação operacional avulsa → só `SEMANA XX`.

**Como aplicar (aprendizado da 1ª rodada):**

- O projeto `312831` **não** aplica tag automática — a task nasce sem tags. Então basta setar `SEMANA XX`.
- **Preferir passar a tag direto no `create_task`** via `tags: [{"tagId": <id SEMANA XX>, "fromWorkspace": false}]`. Isso evita a chamada separada de `update_task_tags`, que o **auto-review do Cursor tende a bloquear** como "side-effect" (exige aprovação manual).
- Se precisar corrigir tags depois: `get_detailed_task` (param **`taskId`**) → `update_task_tags` com a lista **completa** (existentes + `SEMANA XX`). `update_task_tags` **substitui** todas as tags.
- Validar no fim: `get_detailed_task` → conferir `tags[]`.

## Entradas

Pedidos avulsos do coordenador — texto livre, lista de ações, ou CSV/XLSX simples sem planilha fixa.

Extrair por linha: título, executor (papel/nome), briefing, prazo, cliente/ticker opcional para contexto no briefing.

## Antes de criar: deduplicar

1. `list_tasks` — `limit: 200`, `workspaceId: "145324"`, `ctcTaskProjectId: "312831"`, palavra-chave em `textSearch` se preciso.
2. Checar `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao-operacional.md`.

## Prazo

- Se o pedido trouxer prazo → usar.
- Se **não** trouxer → confirmar com o usuário **ou** assumir `currentDueDate` = hoje e **sinalizar a suposição** no preview e no fechamento.

## Título

```
[NN] [Billions] [Guilherme Duarte] Nome da tarefa | Operacional
```

## Preview obrigatório

Incluir: projeto, **`SEMANA XX` resolvida** (fonte ou semana ISO atual), etiquetas planejadas, duplicatas puladas, tabela com executor e prazo. **Confirmação explícita antes de qualquer `create_task`.** Uma task por executor (cada ação × cada pessoa = uma task).

## Criação

`create_task` — **schema real validado** (2026-07-07). Campos obrigatórios: `title`, `description`, `phaseDueDate`, `currentDueDate`, `estimatedTime`, `workspaceId`, `executorId`, `phaseId`, `ctcTaskTypeId`, `situation`, `flow`.

```json
{
  "workspaceId": 145324,
  "ctcTaskProjectId": 312831,
  "ctcTaskTypeId": 83921,
  "title": "[01] [Billions] [Guilherme Duarte] Nome da tarefa | Operacional",
  "description": "<briefing 5W1H>",
  "currentDueDate": "2026-07-07",
  "originalDueDate": "2026-07-07",
  "phaseDueDate": "2026-07-07",
  "phaseStartDate": "2026-07-07",
  "estimatedTime": 120,
  "executorId": "<GUID do ops>",
  "phaseId": 84977,
  "situation": 10,
  "priorityGroup": 100,
  "allocationType": 10,
  "tags": [{"tagId": 250543, "fromWorkspace": false}],
  "flow": "[{\"phaseId\":84977,\"executorId\":\"<GUID ops>\",\"sequential\":1,\"effort\":120,\"phaseStartDate\":\"2026-07-07\",\"phaseDueDate\":\"2026-07-07\",\"active\":1,\"taskTypeId\":83921},{\"phaseId\":84978,\"executorId\":\"9d6271b6-aa05-4aa8-ba50-d79f7778afa0\",\"sequential\":2,\"effort\":0,\"phaseStartDate\":\"2026-07-07\",\"phaseDueDate\":\"2026-07-07\",\"active\":1,\"taskTypeId\":83921}]"
}
```

Notas:
- `flow` é enviado como **string JSON** (array serializado). `executorId` de nível de task = ops (fase 1); a fase 2 no `flow` = Guilherme.
- `tagId` `250543` = `SEMANA 28` — **trocar pela tag da semana vigente** (resolver via `list_tags`).
- `create_task` retorna só o **ID** da task (número).

## Validação

- `get_detailed_task` (param **`taskId`**): conferir projeto, executor (fase 1), responsável (fase 2 = Guilherme), prazo e **tags** (`SEMANA XX`).
- Erro de projeto/executor: `update_task` se disponível; senão criar a correta + cancelar a obsoleta na UI (informar IDs).

## Log e fechamento

**Sempre** bloco em `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao-operacional.md`:

- IDs, links, projeto, etiquetas **aplicadas / parciais / pendentes** por semana.
- Pulos e divergências de `phaseStartDate`.

Retorno: totais, tabela ID+link, status das tags por task, confirmação do log.

## Referências Brain

| Arquivo | Uso |
|---------|-----|
| `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md` | POP etiquetas (`SEMANA XX`) |
| `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao-operacional.md` | Log de execuções operacionais |
| `Brain/Trabalho V4/Projetos/Tarefas Ekyte/escopo-mcp-ekyte-tags.md` | Histórico e status da migração |
