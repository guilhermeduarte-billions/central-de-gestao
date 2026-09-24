#!/usr/bin/env bash
# Percorre o onboarding um passo por vez. O clone não roda este arquivo sozinho.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

steps=(
  "onboarding/01-mcp.md"
  "onboarding/02-glossario.md"
  "onboarding/03-envs.md"
  "onboarding/04-escopos.md"
  "onboarding/05-skills.md"
  "onboarding/06-titulo-e-semana.md"
  "onboarding/07-senha-e-daily.md"
)

total="${#steps[@]}"

echo
echo "Central de Gestão — onboarding"
echo "Caso Billions do Guilherme Duarte. Cada passo é uma troca para o seu caso."
echo "São ${total} passos. Enter avança. q sai."
echo

i=1
for file in "${steps[@]}"; do
  echo "────────────────────────────────────────"
  echo "Passo ${i} de ${total}"
  echo "────────────────────────────────────────"
  echo
  cat "$file"
  echo
  if [[ -t 0 && "$i" -lt "$total" ]]; then
    read -r -p "Enter para o próximo passo, ou q para sair: " answer
    if [[ "${answer}" == "q" || "${answer}" == "Q" ]]; then
      echo "Parou no passo ${i}. Retome com ./onboarding/iniciar.sh"
      exit 0
    fi
  fi
  i=$((i + 1))
done

echo "────────────────────────────────────────"
echo "Passos concluídos."
echo "O mapa do que trocar no código continua em docs/adaptar.md."
echo
