// PM2 Configuration for Juried
// Usar: pm2 start ecosystem.config.cjs --env production
// Ver logs: pm2 logs juried-api
// Monitorear: pm2 monit

module.exports = {
  apps: [{
    name: 'juried-api',
    script: 'dist/index.js',
    cwd: './server',
    instances: 'max', // Usar todos los CPUs disponibles (cluster mode)
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
    max_memory_restart: '1G', // Reiniciar si excede 1GB
    min_uptime: '10s', // Tiempo mínimo antes de considerar iniciado
    max_restarts: 10, // Máximo 10 reinicios en 1 minuto
    autorestart: true,
    
    // Logs (Winston maneja logs de aplicación, PM2 maneja logs de proceso)
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Rotación de logs de PM2
    log_type: 'json',
    
    // Reinicio programado (opcional - reinicio semanal)
    cron_restart: '0 3 * * 0', // Domingo a las 3 AM
    
    // Graceful shutdown
    kill_timeout: 5000, // Esperar 5s antes de forzar cierre
    wait_ready: true, // Esperar señal de ready
    listen_timeout: 10000, // Timeout para listen
    
    // No usar watch en producción (consume recursos)
    watch: false,
    
    // Variables de entorno adicionales
    env: {
      NODE_ENV: 'production'
    },
    
    // Configuración de cluster
    instance_var: 'INSTANCE_ID',
    
    // Manejo de excepciones
    exp_backoff_restart_delay: 100, // Backoff exponencial en reinicios
  }]
};
