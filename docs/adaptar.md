# Adaptar ao seu caso

O código em `app/` é o caso Billions do Guilherme. Os IDs funcionam para essa gerência. Para outra coordenação ou outra gerência, troque os pontos abaixo e crie as suas variáveis na Vercel. Não commite valor de token nem senha.

Na Vercel, o **Root Directory** do projeto é `app/`.

## Variáveis

Só o nome. O valor fica na Vercel, encriptado, só no servidor.

| Variável | Para quê |
|---|---|
| `EKYTE_MCP_TOKEN` | MCP oficial do Ekyte. |
| `MCP_COCKPIT_JWT` | FLOW / Cockpit. |
| `MCP_GATEWAY_TOKEN` | Gateway do Cockpit. |
| `APP_PASSWORD` | Senha da Central. Todo endpoint exige o header `x-app-key`. |

## Onde trocar o recorte

| Arquivo | O que é do Guilherme |
|---|---|
| `app/api/_ekyte-scope.js` | Workspace de gerência `112006` e os projetos fixos (`297829`, `303719`, `303720`, `305096`, `314844`, `331912`). Workspaces de coordenação: Guilherme `145324`, Nayara `151417`, Gustavo `151418`. |
| `app/api/data.js` | Aba Tarefas. Gerência lê a lista de `_ekyte-scope.js`. Operação do Guilherme está fixa: workspace `145324`, projetos `312831` (Solicitação) e `329498` (Expansão da coordenação). |
| `app/api/_people.js` | Nomes, `MY_COORD_USERS` (recorte "Minha coord."), `CORE_COORDS`, `COORD_EXCLUIDOS`, `GUILHERME_EMAILS`. Quem saiu da coordenação ou é de outra squad entra em `COORD_EXCLUIDOS`. |
| `app/api/aliases.json` | Marca que o ticker sozinho não resolve. Só acrescente com evidência de match falso ou de ticker que não casou. |

A operação das outras coordenações não usa ID fixo de projeto: `discoverCoordProjects` em `_ekyte-scope.js` descobre os projetos a partir das tarefas do workspace. Expansão também não pode ser filtrada só por projeto, porque tarefa de diagnóstico nasce solta, com `[EXP]` no título.

## O que a API do Ekyte não devolve

Por isso o desenho do app é o que é. Não tente substituir por uma chamada só.

| | `list_tasks` | `get_detailed_task` | `list_project_tasks` |
|---|---|---|---|
| Filtra workspace, projeto, situação, squad | sim | — | só projeto |
| Filtra tag e data de criação / conclusão | sim | — | — |
| Devolve a descrição (onde mora o ticker) | não | sim | não |
| Devolve data de conclusão | não | — | sim (`resolvedAt`) |
| Teto | 200 | 1 tarefa | o projeto |

`list_tasks` dá o universo. `get_detailed_task` (em lote, com cache por id) dá a descrição. A Sprint Growth mede conclusão cruzando criadas na semana com concluídas na semana, porque `list_tasks` não devolve a data de conclusão.

## Deploy

```bash
cd app
npm test
vercel deploy --prod --yes
```

Trocar um token é `vercel env rm` e `vercel env add` na variável, com o valor no stdin. Não grave o valor neste repositório.
