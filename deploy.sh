#!/bin/bash
set -euo pipefail

PROJECT_DIR="/home/juried"
PUBLIC_DIR="/home/wwplat/public_html"
cd "$PROJECT_DIR"

echo "Obteniendo cambios..."
# Sin git stash: con "stash + pull + stash drop", si no había cambios el drop borraba un stash
# antiguo o fallaba y cortaba el despliegue tras el pull (código nuevo sin compilar).
# Si hay cambios locales en archivos rastreados, se detiene antes de tocar nada.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Hay cambios locales sin commitear en $PROJECT_DIR (revisa 'git status'). Despliegue cancelado." >&2
  exit 1
fi
git pull --ff-only origin main

echo "Construyendo frontend..."
cd client
npm ci
npm run build
cp -rf dist/* "$PUBLIC_DIR"/

echo "Instalando dependencias del servidor..."
cd ../server
npm ci
npm run build
npm prune --omit=dev

echo "Reiniciando servidor..."
cd "$PROJECT_DIR"
pm2 reload ecosystem.config.cjs --env production

echo "Despliegue completado."
