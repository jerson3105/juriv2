#!/bin/bash
# ===========================================
# SCRIPT DE DESPLIEGUE - JURIED
# ===========================================
# Ejecutar en el VPS: ./deploy.sh

set -e

echo "🚀 Iniciando despliegue de Juried..."

# Directorio del proyecto (ajustar según tu configuración)
PROJECT_DIR="/home/$(whoami)/juried"

cd $PROJECT_DIR

echo "📥 Obteniendo últimos cambios..."
git pull origin main

echo "📦 Instalando dependencias del servidor..."
cd server
npm install --production

echo "📦 Instalando dependencias del cliente..."
cd ../client
npm install

echo "🔨 Construyendo el frontend..."
npm run build

echo "📁 Copiando build a public_html..."
# Ajustar la ruta según tu configuración de cPanel
cp -r dist/* /home/$(whoami)/public_html/

echo "🔄 Reiniciando servidor Node.js..."
cd ../server
# Si usas PM2:
pm2 restart juried-api || pm2 start npm --name "juried-api" -- start

echo "✅ Despliegue completado!"
echo "🌐 Visita: https://plataformajuried.com"
