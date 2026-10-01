-- Observatorio de Jiro: partidas de actividades (reanudar, Bitácora y recompensa idempotente).
-- Aditiva. Ejecutar ANTES de desplegar el código.
CREATE TABLE activity_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  -- DESCANSO | ESTRELLAS | CONQUISTA | CORREO | ERROR
  activity_type VARCHAR(20) NOT NULL,
  -- ACTIVE | FINISHED | ABANDONED
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  title VARCHAR(120) NULL,
  -- estado para reanudar la partida (lo escribe el cliente con autoguardado)
  state JSON NULL,
  -- resumen para la Bitácora (logros, podio, constelación...)
  result JSON NULL,
  -- semáforo de autoevaluación: GREEN | YELLOW | RED
  self_assessment VARCHAR(8) NULL,
  -- { behaviorId?, xp, gp, studentIds, pointLogIds } de la recompensa entregada
  reward JSON NULL,
  rewarded_at DATETIME NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  INDEX idx_activity_sessions_classroom_status (classroom_id, status, updated_at),
  INDEX idx_activity_sessions_classroom_type (classroom_id, activity_type, created_at)
);
