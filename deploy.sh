#!/bin/bash
set -e

PROJECT_DIR="/home/$(whoami)/juried"
cd $PROJECT_DIR

echo "Obteniendo cambios..."
git stash
git pull origin main
git stash drop

echo "Construyendo frontend..."
cd client
npm ci
npm run build
cp -r dist/* /home/$(whoami)/public_html/

echo "Instalando dependencias del servidor..."
cd ../server
npm ci --omit=dev && npm run build

echo "Reiniciando servidor..."
pm2 reload ecosystem.config.cjs --env production

echo "Despliegue completado."