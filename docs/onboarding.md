# Onboarding

Checklist para uma coordenação passar a acompanhar do mesmo jeito. O caso de referência é o do Guilherme na Billions. Cada item abaixo é uma troca, não uma cópia cega.

1. **MCP `ekyte` oficial** no cliente que você usa (Cursor, Claude ou Codex). Criar e editar tarefa passa por esse servidor. O legado `ekyte-colli` não serve para isso.
2. **Clonar** este repositório. O código está em `app/`.
3. **Ler** [abas-e-projetos.md](abas-e-projetos.md) para saber qual projeto guarda antecipação, retenção e expansão.
4. **Preencher as envs** na Vercel, com os seus tokens: `EKYTE_MCP_TOKEN`, `MCP_COCKPIT_JWT`, `MCP_GATEWAY_TOKEN`, `APP_PASSWORD`. Nomes e o que cada uma faz: [adaptar.md](adaptar.md). Root Directory = `app`.
5. **Adaptar os escopos** em `app/api/_ekyte-scope.js`, `app/api/data.js` e `app/api/_people.js`: workspace da sua gerência, workspaces das coordenações, projetos e quem entra no recorte. O mapa do que trocar está em [adaptar.md](adaptar.md).
6. **Instalar a skill operacional** a partir de [../skills/ekyte-acao-operacional/SKILL.md](../skills/ekyte-acao-operacional/SKILL.md), com o seu workspace, o seu projeto de solicitação e os executores do seu time. As skills de gerência e de expansão estão em `skills/` e pedem a mesma troca.
7. **Título da tarefa gerencial** no formato `[Gerência][Nome do coordenador]`, com o ticker do cliente no título — `(TICKER)` ou `[TICKER]`. Sem isso a Central não cruza a ação com o projeto.
8. **Etiqueta** `SEMANA XX` em todo lote. A Adoção e a Sprint Growth leem essa semana.
9. **Senha** da app (`APP_PASSWORD`) só para quem vai abrir a Central. A página tem nome de cliente e comentário interno.
10. **Daily** com [colar-no-docs.md](colar-no-docs.md): atrasada, sem task, sem subida na sprint.
