#!/bin/bash

# ===========================================
# SCRIPT DE BACKUP DE BASE DE DATOS - JURIED
# ===========================================
# Este script crea backups automáticos de la base de datos MySQL
# Uso: ./scripts/backup-db.sh
# Cron: 0 3 * * * /home/juried/scripts/backup-db.sh

# Configuración
BACKUP_DIR="/home/juried/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Cargar variables de entorno
if [ -f "/home/juried/server/.env" ]; then
    export $(cat /home/juried/server/.env | grep -v '^#' | xargs)
fi

# Validar variables requeridas
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo "❌ Error: Variables DB_NAME y DB_USER no encontradas en .env"
    exit 1
fi

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Nombre del archivo de backup
BACKUP_FILE="$BACKUP_DIR/juried_${DATE}.sql.gz"

echo "🔄 Iniciando backup de base de datos..."
echo "   Base de datos: $DB_NAME"
echo "   Archivo: $BACKUP_FILE"

# Crear backup con mysqldump y comprimir
if [ -z "$DB_PASSWORD" ]; then
    # Sin contraseña
    mysqldump -u "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
else
    # Con contraseña
    mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" | gzip > "$BACKUP_FILE"
fi

# Verificar si el backup fue exitoso
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completado exitosamente"
    echo "   Tamaño: $BACKUP_SIZE"
    
    # Eliminar backups antiguos (mantener últimos N días)
    echo "🧹 Limpiando backups antiguos (más de $RETENTION_DAYS días)..."
    find "$BACKUP_DIR" -name "juried_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    REMAINING=$(ls -1 "$BACKUP_DIR"/juried_*.sql.gz 2>/dev/null | wc -l)
    echo "   Backups restantes: $REMAINING"
    
    # Opcional: Subir a almacenamiento externo (descomentar si usas S3, Dropbox, etc.)
    # echo "☁️  Subiendo a almacenamiento remoto..."
    # aws s3 cp "$BACKUP_FILE" s3://juried-backups/ || echo "⚠️  Error subiendo a S3"
    
else
    echo "❌ Error al crear backup"
    exit 1
fi

echo "✅ Proceso de backup finalizado"
