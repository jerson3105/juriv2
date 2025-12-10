# 🔍 Auditoría de Producción - Juried

**Fecha:** Diciembre 2024  
**Versión:** 1.0.0  
**Capacidad objetivo:** 400 estudiantes

---

## 📊 Resumen Ejecutivo

| Categoría | Estado | Prioridad | Actualizado |
|-----------|--------|-----------|-------------|
| Seguridad | ⚠️ Requiere atención | ALTA | Pendiente: JWT secrets |
| Performance | ✅ Bueno | MEDIA | Pool BD optimizado |
| Base de Datos | ✅ Optimizado | MEDIA | Índices creados |
| Frontend | ✅ Bueno | BAJA | Logs eliminados |
| DevOps | ✅ Configurado | MEDIA | PM2 config creado |
| Monitoreo | ❌ No implementado | BAJA | Opcional |

---

## 🔐 1. SEGURIDAD

### 1.1 Problemas Críticos

#### ❌ JWT Secrets en desarrollo
```env
# Archivo: server/.env
JWT_SECRET=tu_jwt_secret_muy_seguro_cambiar_en_produccion_32chars
JWT_REFRESH_SECRET=tu_refresh_secret_muy_seguro_cambiar_produccion32
```
**Acción requerida:** Generar secrets seguros de 64+ caracteres aleatorios.

```bash
# Generar secrets seguros
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### ❌ Base de datos sin contraseña
```env
DB_PASSWORD=
```
**Acción requerida:** Configurar contraseña segura para MySQL en producción.

#### ❌ Google OAuth no configurado
```env
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
```
**Acción requerida:** Configurar credenciales reales de Google Cloud Console.

### 1.2 Configuración Correcta ✅

- ✅ Helmet configurado para headers de seguridad
- ✅ Rate limiting implementado (200 req/min general, 10 req/15min auth)
- ✅ CORS configurado correctamente
- ✅ Tokens JWT con expiración corta (15min access, 7d refresh)
- ✅ Refresh token rotation implementado
- ✅ Bcrypt para hash de contraseñas
- ✅ Validación con Zod en backend

### 1.3 Recomendaciones Adicionales

```typescript
// Agregar en server/src/middleware/security.ts

// Rate limiter más estricto para producción
export const productionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100, // Reducir en producción
  message: { success: false, message: 'Rate limit exceeded' },
});

// Agregar validación de origen más estricta
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.CLIENT_URL];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
};
```

---

## 🗄️ 2. BASE DE DATOS

### 2.1 Estructura Actual
- **33 tablas** definidas
- **ORM:** Drizzle + MySQL2
- **Pool:** 10 conexiones máximo

### 2.2 Problemas Detectados

#### ⚠️ Pool de conexiones insuficiente para 400 usuarios
```typescript
// Archivo: server/src/db/index.ts
connectionLimit: 10, // Muy bajo para producción
```

**Solución:**
```typescript
connectionLimit: 50, // Aumentar para producción
maxIdle: 10,
idleTimeout: 60000,
enableKeepAlive: true,
keepAliveInitialDelay: 0,
```

#### ⚠️ Sin índices optimizados
**Acción requerida:** Crear índices para consultas frecuentes.

```sql
-- Índices recomendados
CREATE INDEX idx_student_profiles_classroom ON student_profiles(classroom_id);
CREATE INDEX idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX idx_point_logs_student ON point_logs(student_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_battle_participants_battle ON battle_participants(battle_id);
CREATE INDEX idx_clan_logs_clan ON clan_logs(clan_id);
```

#### ⚠️ Sin backups configurados
**Acción requerida:** Configurar backups automáticos diarios.

```bash
# Script de backup (agregar a cron)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u juried_user -p juried_db > /backups/juried_$DATE.sql
# Mantener últimos 7 días
find /backups -name "juried_*.sql" -mtime +7 -delete
```

### 2.3 Migraciones
- ✅ Drizzle Kit configurado
- ✅ Migraciones versionadas
- ⚠️ Ejecutar `npm run db:push` antes de producción

---

## ⚡ 3. PERFORMANCE

### 3.1 Backend

#### ✅ Caché implementado
```typescript
// server/src/utils/cache.ts - Ya existe
cache.set(cacheKey, user, CACHE_TTL.SHORT); // 30 segundos
```

#### ⚠️ Sin caché de Redis (recomendado para escalar)
Para 400+ usuarios, considerar Redis:
```bash
npm install ioredis
```

#### ✅ Queries optimizadas con Drizzle
- Selección de columnas específicas
- Joins eficientes

### 3.2 Frontend

#### ✅ React Query para caché de datos
```typescript
// Configuración actual correcta
staleTime: 5 * 60 * 1000, // 5 minutos
```

#### ⚠️ Sin lazy loading de rutas
**Recomendación:**
```typescript
// client/src/App.tsx
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
```

#### ⚠️ Bundle no optimizado
**Agregar a vite.config.ts:**
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
```

---

## 🚀 4. DEVOPS & DEPLOYMENT

### 4.1 Archivos Necesarios para Producción

#### ❌ Falta: `.env.production` (servidor)
```env
# server/.env.production
NODE_ENV=production
PORT=3001

# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=juried_prod
DB_PASSWORD=<CONTRASEÑA_SEGURA_32_CHARS>
DB_NAME=juried_db

# JWT (generar nuevos!)
JWT_SECRET=<64_CHARS_RANDOM>
JWT_REFRESH_SECRET=<64_CHARS_RANDOM>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=<TU_CLIENT_ID_REAL>
GOOGLE_CLIENT_SECRET=<TU_CLIENT_SECRET_REAL>
GOOGLE_CALLBACK_URL=https://tudominio.com/api/auth/google/callback

# Frontend
CLIENT_URL=https://tudominio.com
```

#### ❌ Falta: `.env.production` (cliente)
```env
# client/.env.production
VITE_API_URL=https://tudominio.com/api
```

#### ❌ Falta: Configuración de PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'juried-api',
    script: 'dist/index.js',
    cwd: '/var/www/juried/server',
    instances: 2, // Para 4 vCPU
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    max_memory_restart: '1G',
    error_file: '/var/log/juried/error.log',
    out_file: '/var/log/juried/out.log',
    merge_logs: true,
  }]
};
```

#### ❌ Falta: Configuración de Nginx
```nginx
# /etc/nginx/sites-available/juried
server {
    listen 80;
    server_name tudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    # Frontend (archivos estáticos)
    location / {
        root /var/www/juried/client/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Archivos estáticos del servidor
    location /badges {
        alias /var/www/juried/server/public/badges;
        expires 30d;
    }

    location /avatars {
        alias /var/www/juried/server/uploads/avatars;
        expires 7d;
    }
}
```

---

## 📋 5. CHECKLIST DE DEPLOYMENT

### Antes del Deployment

- [ ] Generar JWT secrets seguros (64 chars)
- [ ] Configurar contraseña de MySQL
- [ ] Crear usuario MySQL dedicado (no root)
- [ ] Configurar Google OAuth con dominio real
- [ ] Crear archivos `.env.production`
- [ ] Ejecutar migraciones de BD
- [ ] Crear índices de BD
- [ ] Configurar backups automáticos

### En el VPS

```bash
# 1. Instalar dependencias del sistema
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server nodejs npm certbot python3-certbot-nginx

# 2. Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Instalar PM2
sudo npm install -g pm2

# 4. Crear usuario para la app
sudo useradd -m -s /bin/bash juried
sudo mkdir -p /var/www/juried
sudo chown -R juried:juried /var/www/juried

# 5. Clonar/subir proyecto
cd /var/www/juried
# git clone o scp de archivos

# 6. Instalar dependencias
cd server && npm ci --production
cd ../client && npm ci && npm run build

# 7. Configurar MySQL
sudo mysql_secure_installation
mysql -u root -p
> CREATE DATABASE juried_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'juried_prod'@'localhost' IDENTIFIED BY 'contraseña_segura';
> GRANT ALL PRIVILEGES ON juried_db.* TO 'juried_prod'@'localhost';
> FLUSH PRIVILEGES;

# 8. Ejecutar migraciones
cd /var/www/juried/server
npm run db:push

# 9. Configurar PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 10. Configurar Nginx
sudo nano /etc/nginx/sites-available/juried
sudo ln -s /etc/nginx/sites-available/juried /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 11. SSL con Let's Encrypt
sudo certbot --nginx -d tudominio.com

# 12. Firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Post-Deployment

- [ ] Verificar HTTPS funciona
- [ ] Probar login/registro
- [ ] Probar WebSocket (Boss Battle)
- [ ] Verificar subida de imágenes
- [ ] Configurar monitoreo (PM2 plus o similar)
- [ ] Configurar alertas de errores

---

## 📊 6. MONITOREO (Recomendado)

### Opción 1: PM2 Plus (Gratis hasta 4 servidores)
```bash
pm2 link <secret> <public>
```

### Opción 2: Agregar logging estructurado
```typescript
// server/src/utils/logger.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

---

## 🎯 7. PRIORIDADES DE ACCIÓN

### 🔴 CRÍTICO (Antes de producción)
1. Generar JWT secrets seguros
2. Configurar contraseña MySQL
3. Crear archivos .env.production
4. Configurar Google OAuth real
5. Aumentar pool de conexiones BD

### 🟡 IMPORTANTE (Primera semana)
1. Crear índices de BD
2. Configurar backups automáticos
3. Configurar Nginx + SSL
4. Implementar PM2 cluster mode

### 🟢 RECOMENDADO (Primer mes)
1. Implementar logging estructurado
2. Configurar monitoreo
3. Optimizar bundle del frontend
4. Implementar lazy loading de rutas

---

## 💰 Estimación de Recursos (400 estudiantes)

| Recurso | Mínimo | Recomendado | Tu VPS |
|---------|--------|-------------|--------|
| CPU | 2 vCPU | 4 vCPU | ✅ 4 vCPU |
| RAM | 4 GB | 8 GB | ✅ 12 GB |
| Disco | 40 GB | 100 GB | ✅ 300 GB |
| Conexiones BD | 20 | 50 | Configurar |

**Veredicto:** Tu VPS es más que suficiente para 400 estudiantes. Con la configuración correcta, podría manejar 1000+ usuarios concurrentes.

---

## 📝 Notas Finales

El proyecto está bien estructurado y tiene buenas prácticas implementadas. Los principales puntos a resolver son:

1. **Configuración de producción** - Secrets, contraseñas, OAuth
2. **Infraestructura** - Nginx, PM2, SSL
3. **Base de datos** - Pool, índices, backups

Una vez resueltos estos puntos, el proyecto estará listo para producción.

**Tiempo estimado de preparación:** 4-6 horas
