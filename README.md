# Central de Gestão

A Central existe para três frentes: **antecipação**, **retenção** e **expansão**.

Ela junta o que está no Ekyte com o que está no FLOW e mostra, na daily, o que já tem ação, o que não tem e o que não andou. O app ao vivo deste caso está em [https://follow-tarefas-ekyte.vercel.app/](https://follow-tarefas-ekyte.vercel.app/).

Este repositório é o setup do **Guilherme Duarte na Billions**. Workspace, projeto, executor e recorte de coordenação são os dele. Antes de deployar ou de usar as skills na sua coordenação, leia [docs/adaptar.md](docs/adaptar.md).

O que cada aba responde e o que cada projeto do Ekyte guarda: [docs/abas-e-projetos.md](docs/abas-e-projetos.md).

## O que tem aqui

| Pasta | Para quê |
|---|---|
| [app/](app/) | Código da Central (HTML + funções na Vercel). |
| [skills/](skills/) | As três skills que sobem tarefa neste método. |
| [docs/](docs/) | Glossário, manual de adaptação, cola no Docs e onboarding. |

## Skills deste método

- [ekyte-acao-gerencial](skills/ekyte-acao-gerencial/SKILL.md) — ações da gerência (antecipação, retenção e o que é apoio).
- [ekyte-acao-operacional](skills/ekyte-acao-operacional/SKILL.md) — pedido do coordenador para o time de operações.
- [ekyte-expansao](skills/ekyte-expansao/SKILL.md) — oportunidade de expansão.

`ekyte-task` não entra: demanda de cliente no workspace do cliente não faz parte deste método.

## O que não entra

Token, senha e `.env` não estão neste repositório. O nome das variáveis está em [docs/adaptar.md](docs/adaptar.md). Quem for deployar cria as próprias na Vercel.
