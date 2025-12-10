# 🎮 JURIED - Plataforma de Gamificación Educativa

Sistema de gamificación para el aula inspirado en juegos de rol (RPG).

## 🚀 Stack Tecnológico

- **Frontend**: React 19 + TypeScript + TailwindCSS + Framer Motion
- **Backend**: Node.js 20+ + Express + TypeScript
- **Base de Datos**: MySQL 8 + Drizzle ORM
- **Autenticación**: JWT + Google OAuth
- **Tiempo Real**: Socket.io

## 📁 Estructura del Proyecto

```
juried/
├── client/          # Frontend React (Vite)
├── server/          # Backend Node.js (Express)
├── scripts/         # Scripts de utilidad
└── docs/            # Documentación
```

## 🛠️ Instalación Local

### Requisitos Previos
- Node.js 20+
- MySQL 8+
- npm

### 1. Clonar y configurar

```bash
# Clonar repositorio
git clone <repo-url>
cd juried

# Instalar dependencias
cd server && npm install
cd ../client && npm install
```

### 2. Configurar Base de Datos

```bash
# Crear base de datos
mysql -u root -p -e "CREATE DATABASE juried_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Configurar variables de entorno
cd server
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar migraciones
npm run db:push

# (Opcional) Crear índices para producción
mysql -u root -p juried_db < ../scripts/create-indexes.sql
```

### 3. Iniciar en Desarrollo

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

Acceder a: http://localhost:5173

## 🚀 Deployment a Producción

Ver [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md) para instrucciones detalladas.

```bash
# Build del cliente
cd client
npm run build

# Build del servidor
cd server
npm run build

# Iniciar con PM2
pm2 start ecosystem.config.cjs --env production
```

## 🎭 Características Principales

### Sistema de Clases
| Clase | Descripción |
|-------|-------------|
| **Guardián** | Defensor del equipo |
| **Arcano** | Maestro de la magia |
| **Explorador** | Aventurero ágil |
| **Alquimista** | Creador de pociones |

### Sistema de Puntos
- **XP** (Experiencia): Progreso y nivel del estudiante
- **HP** (Vida): Salud del personaje
- **GP** (Oro): Moneda para la tienda

### Funcionalidades
- ✅ Gestión de clases y estudiantes
- ✅ Sistema de comportamientos (+/- puntos)
- ✅ Tienda de avatares y items
- ✅ Sistema de insignias
- ✅ Clanes/Equipos con ranking
- ✅ Boss Battles cooperativas
- ✅ Eventos aleatorios
- ✅ Banco de preguntas

## 📝 Licencia

Proyecto privado - Todos los derechos reservados.
