#!/bin/bash
set -e

PROJECT_DIR="/home/juried"
cd $PROJECT_DIR

echo "Obteniendo cambios..."
git stash
git pull origin main
git stash drop

echo "Construyendo frontend..."
cd client
npm ci
npm run build
cp -rf dist/* /home/wwplat/public_html/

echo "Instalando dependencias del servidor..."
cd ../server
npm ci && npm run build && npm ci --omit=dev

echo "Reiniciando servidor..."
pm2 reload ecosystem.config.cjs --env production

echo "Despliegue completado."