---
name: ekyte-expansao
description: Use sempre que o usuário pedir para subir, criar, priorizar ou validar tarefas de expansão Billions no Ekyte a partir de oportunidades, Account Planning, pipeline Expansion, Calls/WhatsApp, dores mapeadas ou 5W1H. Cria tarefas no projeto [Billions] Expansão usando o workflow [Billions] Expansão Gerência via MCP oficial e resolve dinamicamente o executor pelo coordenador do projeto no FLOW/Cockpit.
---

> **Caso de uso do Guilherme Duarte (Billions).** Este arquivo é o exemplo que já funciona na coordenação dele. Antes de usar na sua coordenação ou gerência, troque workspace, projeto, tipo de tarefa, fases e executores. Os IDs abaixo são o exemplo concreto, não um padrão universal.

# Ekyte Expansão

Cria tarefas de expansão Billions no Ekyte via MCP oficial `ekyte`.

Não use `ekyte-colli` para criar ou editar tarefas.

## Escopo

Use esta skill para:
- Oportunidades de expansão geradas por Account Planning.
- 5W1H de expansão.
- Pipeline FLOW Expansion.
- Dores comerciais, CRM, site, mídia ou SDR IA mapeadas em Calls ou WhatsApp.
- Priorização de oportunidades para o canal gerencial de expansão.

Para ações gerenciais não ligadas a expansão, use `ekyte-acao-gerencial`.
Para ações operacionais, use `ekyte-acao-operacional`.

## Configuração Ekyte

- Workspace: `112006` - `[Billions] Gestão Gerencial`
- Projeto: `305096` - `[Billions] Expansão`
- Tipo: `84441` - `[Billions] Expansão Gerência (padrão)`
- Workflow: `22300` - `[Billions] Expansão Gerência`
- Fase inicial: `85504` - `Account Planning`
- Criador padrão: `analitico26.colli@v4company.com`
- `estimatedTime`: `360`
- `priorityGroup`: `100`
- `allocationType`: `10`

## Fases

| Seq | phaseId | Fase |
|-----|---------|------|
| 1 | `85504` | Account Planning |
| 2 | `85505` | Diagnóstico |
| 3 | `85506` | Reunião Marcada |
| 4 | `85507` | Construção da Proposta |
| 5 | `85508` | Reunião Realizada |
| 6 | `85509` | Follow UP |

Comece novas oportunidades em `Account Planning`, salvo se o usuário pedir outra etapa explicitamente ou se já houver card validado em etapa posterior.

## Executor dinâmico

O executor não é fixo.

Antes de criar a task, descubra o coordenador do projeto no FLOW/Cockpit:
- Se tiver `projectDocumentId`, use `cockpit_get_project` com `populate: ["projectTeam.user", "squad"]`.
- Se tiver só ticker/nome, use `cockpit_query_table` ou `cockpit_list_projects` com status ativo/Executar e filtro de busca.
- Se a origem for um card de Expansion, use `cockpit_expansion_cards_get` ou `cockpit_expansion_cards_query` e leia o projeto/coordenador associado.

Depois resolva o usuário no Ekyte com `list_admin_editors_users`:
- Faça match por e-mail quando o FLOW trouxer e-mail.
- Se não houver e-mail, faça match por nome do coordenador.
- Use o mesmo `executorId` na raiz da task e em todos os itens do `flow`.

Exemplo: se o projeto no FLOW está com Ariel, a task e todas as fases (`Account Planning` até `Follow UP`) devem ficar com Ariel como executora. Não use Guilherme como executor padrão salvo se o projeto for dele ou se o usuário pedir explicitamente.

Se não conseguir resolver o executor com confiança, pare antes de criar e reporte o projeto, o coordenador encontrado e os usuários Ekyte candidatos.

## Tags

Leia `Brain/Trabalho V4/Projetos/Tarefas Ekyte/pop-tags-ekyte.md`.

Sempre aplicar `SEMANA XX`:
- Se a fonte trouxer semana, use a semana da fonte.
- Se não trouxer, use a semana ISO atual ou a semana do `currentDueDate`.

Para expansão avulsa de Account Planning, aplique só `SEMANA XX`, a menos que o usuário peça rotina de Weekly Expansão. Nesse caso, aplique também `WEEKLY EXPANSÃO`.

## Antes de criar

1. Deduplicar com `list_tasks` no workspace `112006` e projeto `305096`, buscando por cliente, ticker e produto.
2. Resolver o coordenador do projeto no FLOW/Cockpit.
3. Resolver o executor Ekyte desse coordenador com `list_admin_editors_users`.
4. Resolver semana com `list_tags` (`type: 0`, nome exato `SEMANA XX`).
5. Consultar `get_task_type_flow` para `workspaceId: 112006`, `id: 84441` se precisar confirmar fases.
6. Montar briefing em HTML com 5W1H.

## Título

Use:

```text
[NN] [Billions] [Nome da Coordenação] Cliente - Account Planning Produto/Tese | Gerencial
```

Exemplo:

```text
[01] [Billions] [Guilherme Duarte] Outmat - Account Planning SDR IA + CRM | Gerencial
```

## Briefing

Inclua no `description`:
- Origem: Account Planning de expansão Billions e data.
- Cliente e ticker.
- Produto V4 sugerido.
- Gap.
- Coordenador FLOW e executor Ekyte resolvido.
- What, Why, Where, Who, When, How.
- Evidência datada.
- Fase inicial.
- Prazo geral.

## Criação

`create_task` exige `flow` como string JSON serializada.

Payload base:

```json
{
  "workspaceId": 112006,
  "ctcTaskProjectId": 305096,
  "ctcTaskTypeId": 84441,
  "title": "[01] [Billions] [Nome da Coordenação] Cliente - Account Planning Produto | Gerencial",
  "description": "<briefing 5W1H em HTML>",
  "currentDueDate": "YYYY-MM-DD",
  "originalDueDate": "YYYY-MM-DD",
  "phaseDueDate": "YYYY-MM-DD",
  "phaseStartDate": "YYYY-MM-DD",
  "estimatedTime": 360,
  "executorId": "<GUID executor resolvido pelo coordenador FLOW>",
  "phaseId": 85504,
  "situation": 10,
  "priorityGroup": 100,
  "allocationType": 10,
  "quantity": 1,
  "flow": "[{\"phaseId\":85504,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":1,\"effort\":360,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441},{\"phaseId\":85505,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":2,\"effort\":0,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441},{\"phaseId\":85506,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":3,\"effort\":0,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441},{\"phaseId\":85507,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":4,\"effort\":0,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441},{\"phaseId\":85508,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":5,\"effort\":0,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441},{\"phaseId\":85509,\"executorId\":\"<GUID executor resolvido pelo coordenador FLOW>\",\"sequential\":6,\"effort\":0,\"phaseStartDate\":\"YYYY-MM-DD\",\"phaseDueDate\":\"YYYY-MM-DD\",\"active\":1,\"taskTypeId\":84441}]"
}
```

## Pós-criação

1. `get_detailed_task` para validar projeto, tipo, fase, executor, prazo e tags atuais.
2. `list_task_flow_phases` para validar que as fases usam o executor resolvido pelo coordenador do projeto.
3. `update_task_tags` com a lista completa de tags atuais + `SEMANA XX`.
4. Validar novamente com `get_detailed_task`.
5. Se `phaseStartDate` divergir, use `update_task` com `patchDoc` como array de objetos JSON Patch, não strings:

```json
[
  {"op": "replace", "path": "/phaseStartDate", "value": "YYYY-MM-DDT00:00:00"},
  {"op": "replace", "path": "/currentDueDate", "value": "YYYY-MM-DDT00:00:00"}
]
```

No workflow `22300`, as fases podem ter duração 0. Nessa situação, o Ekyte pode manter `phaseDueDate` igual a `phaseStartDate`; priorize `currentDueDate` como prazo geral da tarefa.

## Log

Sempre registrar em `Brain/Trabalho V4/Projetos/Tarefas Ekyte/plano-execucao.md`:
- IDs e links.
- Projeto, tipo, workflow e fase.
- Executor e prazo.
- Tags aplicadas.
- Deduplicação.
- Divergências de datas ou tags.
