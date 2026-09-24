# Skills

Três skills sobem tarefa neste método. As três são o caso do Guilherme na Billions: workspace, projeto, tipo, fases e executores precisam ser trocados antes de usar na sua coordenação. O significado de cada projeto está em [abas-e-projetos.md](abas-e-projetos.md).

MCP oficial: servidor `ekyte`. Não use o servidor legado `ekyte-colli` para criar ou editar tarefa.

`ekyte-task` fica de fora. Ela sobe demanda de cliente no workspace do cliente, e este método não é isso.

## ekyte-acao-gerencial

Arquivo: [../skills/ekyte-acao-gerencial/SKILL.md](../skills/ekyte-acao-gerencial/SKILL.md).

Use para lote da gerência: 5W1H, Quality Check, recuperação, solicitação avulsa, People, Strategy Review.

Workspace `112006` — `[Billions] Gestão Gerencial`.

| Frente | Projeto | ID |
|---|---|---|
| Antecipação | Antecipação HS ≤ 21 | `297829` |
| Retenção | Recuperação | `303719` |
| Apoio | Solicitação Gerencial | `303720` |
| Apoio | People | `314844` |
| Apoio | Strategy Review Q4 | `331912` |

Expansão não passa por esta skill. Vai para `ekyte-expansao`.

Etiqueta obrigatória em todo lote: `SEMANA XX`. Quality Check leva também `QUALITY CONTROL`. Não crie etiqueta nova por semana.

## ekyte-acao-operacional

Arquivo: [../skills/ekyte-acao-operacional/SKILL.md](../skills/ekyte-acao-operacional/SKILL.md).

Use quando o coordenador sobe pedido avulso para o próprio time de operações. Não é ação de gerência e não é demanda de cliente.

No caso Guilherme: workspace `145324`, projeto `312831` (Solicitação Coord. Guilherme Duarte). O título leva `[Guilherme Duarte]`, não o nome do executor. O fluxo tem duas fases: análise do ops e validação do coordenador. O fluxo default do tipo aponta outra pessoa na validação; a skill sobrescreve.

Quem adaptar troca workspace, projeto, tipo, fases e a tabela de executores. Os GUIDs do arquivo são o time dele.

## ekyte-expansao

Arquivo: [../skills/ekyte-expansao/SKILL.md](../skills/ekyte-expansao/SKILL.md).

Use para oportunidade de expansão: Account Planning, pipeline, dor mapeada em call ou WhatsApp, 5W1H de expansão.

Workspace `112006`, projeto `305096`, tipo `[Billions] Expansão Gerência`. A fase inicial é Account Planning, salvo quando o card já está numa etapa posterior. O executor sai do coordenador do projeto no FLOW, não de uma lista fixa.
