-- Celebraciones: registro de subidas de nivel (todas las fuentes) y hasta dónde vio el alumno
-- sus celebraciones. Aditiva. Ejecutar ANTES de desplegar el código.
CREATE TABLE level_up_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  from_level INT NOT NULL,
  to_level INT NOT NULL,
  -- BEHAVIOR | POINTS | ATTENDANCE | BADGE | STORY | STREAK | EXPEDITION | TOURNAMENT | EVENT | ACTIVITY | OTHER
  source VARCHAR(20) NOT NULL DEFAULT 'OTHER',
  -- 1 si una reversión dejó al alumno por debajo de to_level
  is_reverted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  INDEX idx_level_up_logs_classroom_date (classroom_id, created_at),
  INDEX idx_level_up_logs_student_date (student_profile_id, created_at)
);

-- NULL = aún no se ha mirado (el primer acceso del alumno lo fija sin celebrar lo antiguo).
ALTER TABLE student_profiles ADD COLUMN celebrated_at DATETIME NULL AFTER is_demo;
