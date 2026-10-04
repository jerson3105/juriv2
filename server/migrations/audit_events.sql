-- Registro de auditoría (2026-10-04).
-- Quién hizo qué, cuándo y desde dónde en las acciones sensibles: cuentas y roles, verificación de docentes y
-- escuelas, dominios, gestión de la escuela, borrados de clases y alumnos, accesos con PIN y entradas de
-- administradores. La app solo agrega filas: nunca las edita ni las borra.
-- metadata sin datos personales (ids, estados, conteos); nunca nombres, DNI, correos ni contraseñas.
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NULL,
  actor_user_id VARCHAR(36) NULL,
  actor_role VARCHAR(16) NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id VARCHAR(36) NULL,
  metadata JSON NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_audit_events_school_date (school_id, created_at),
  INDEX idx_audit_events_actor_date (actor_user_id, created_at),
  INDEX idx_audit_events_action_date (action, created_at),
  INDEX idx_audit_events_target (target_type, target_id)
);
