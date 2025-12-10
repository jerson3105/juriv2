// PM2 Configuration for Juried
// Usar: pm2 start ecosystem.config.cjs --env production

module.exports = {
  apps: [{
    name: 'juried-api',
    script: 'dist/index.js',
    cwd: './server',
    instances: 'max', // Usar todos los CPUs disponibles
    exec_mode: 'cluster',
    
    // Variables de entorno para producción
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    // Variables de entorno para desarrollo
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    
    // Configuración de memoria y reinicio
    max_memory_restart: '1G',
    
    // Logs
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Reinicio automático
    watch: false, // No usar watch en producción
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
