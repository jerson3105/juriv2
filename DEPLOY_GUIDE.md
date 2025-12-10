# Guía de Despliegue - Juried

## Requisitos del VPS
- Node.js 18+ 
- MySQL 8+
- PM2 (gestor de procesos)
- Git

## Paso 1: Configurar el VPS (Hostinger con cPanel)

### 1.1 Acceder por SSH
```bash
ssh root@tu_ip_del_vps
```

### 1.2 Instalar Node.js (si no está instalado)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 1.3 Instalar PM2 (gestor de procesos)
```bash
npm install -g pm2
```

### 1.4 Crear base de datos en cPanel
1. Ir a cPanel → MySQL Databases
2. Crear base de datos: `juried_db`
3. Crear usuario con contraseña segura
4. Asignar usuario a la base de datos con todos los privilegios

## Paso 2: Clonar el repositorio

```bash
cd /home/tu_usuario
git clone https://github.com/jerson3105/juriv2.git juried
cd juried
```

## Paso 3: Configurar variables de entorno

### 3.1 Servidor (Backend)
```bash
cd server
cp .env.production.example .env
nano .env  # Editar con tus valores reales
```

### 3.2 Cliente (Frontend)
```bash
cd ../client
echo "VITE_API_URL=https://plataformajuried.com/api" > .env.production
```

## Paso 4: Instalar dependencias y construir

```bash
# Backend
cd /home/tu_usuario/juried/server
npm install

# Frontend
cd ../client
npm install
npm run build
```

## Paso 5: Copiar frontend a public_html

```bash
cp -r /home/tu_usuario/juried/client/dist/* /home/tu_usuario/public_html/
```

## Paso 6: Configurar proxy en Apache (.htaccess)

Crear/editar `/home/tu_usuario/public_html/.htaccess`:
```apache
RewriteEngine On

# Redirigir API al servidor Node.js
RewriteRule ^api/(.*)$ http://localhost:3001/api/$1 [P,L]

# SPA - redirigir todas las rutas al index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]
```

## Paso 7: Ejecutar migraciones de base de datos

```bash
cd /home/tu_usuario/juried/server
mysql -u usuario_db -p juried_db < migrations/add_schools_b2b.sql
mysql -u usuario_db -p juried_db < migrations/add_indexes.sql
# ... otras migraciones necesarias
```

## Paso 8: Iniciar el servidor con PM2

```bash
cd /home/tu_usuario/juried/server
pm2 start npm --name "juried-api" -- start
pm2 save
pm2 startup  # Para que inicie automáticamente al reiniciar el VPS
```

## Paso 9: Configurar SSL (Let's Encrypt)

En cPanel:
1. Ir a SSL/TLS Status
2. Seleccionar el dominio plataformajuried.com
3. Click en "Run AutoSSL"

## Comandos útiles

### Ver logs del servidor
```bash
pm2 logs juried-api
```

### Reiniciar servidor
```bash
pm2 restart juried-api
```

### Actualizar a nueva versión
```bash
cd /home/tu_usuario/juried
./deploy.sh
```

### Ver estado de PM2
```bash
pm2 status
```

## Estructura en el VPS

```
/home/tu_usuario/
├── juried/                 # Repositorio clonado
│   ├── client/            # Frontend (código fuente)
│   ├── server/            # Backend Node.js
│   └── deploy.sh          # Script de despliegue
├── public_html/           # Archivos públicos (frontend compilado)
│   ├── index.html
│   ├── assets/
│   └── .htaccess
```

## Solución de problemas

### El API no responde
```bash
pm2 logs juried-api --lines 100
```

### Error de conexión a MySQL
- Verificar credenciales en `.env`
- Verificar que el usuario tenga permisos

### Error 502 Bad Gateway
- El servidor Node.js no está corriendo
- Ejecutar: `pm2 restart juried-api`

### Cambios no se reflejan
```bash
cd /home/tu_usuario/juried
git pull
cd client && npm run build
cp -r dist/* /home/tu_usuario/public_html/
pm2 restart juried-api
```
