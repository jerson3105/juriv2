-- HP con sentido: estado "Descansando" (HP en 0), misiones de recuperación y plantillas por clase.
-- Ejecutar ANTES de desplegar el código.

-- Desde cuándo descansa (null = tiene energía). Se fija al llegar a 0 y se limpia al recuperarse.
ALTER TABLE student_profiles ADD COLUMN resting_since DATETIME NULL AFTER celebrated_at;

-- Plantillas editables de misiones de recuperación (null = las de fábrica).
ALTER TABLE classrooms ADD COLUMN recovery_missions JSON NULL AFTER max_hp;

CREATE TABLE recovery_missions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  text VARCHAR(255) NOT NULL,
  -- ASSIGNED | COMPLETED | CANCELLED
  status VARCHAR(12) NOT NULL DEFAULT 'ASSIGNED',
  assigned_by VARCHAR(36) NULL,
  completed_by VARCHAR(36) NULL,
  -- registro de puntos de la recuperación (si se revierte, la misión vuelve a quedar pendiente)
  completion_point_log_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  INDEX idx_recovery_missions_student_status (student_profile_id, status),
  INDEX idx_recovery_missions_classroom (classroom_id, created_at)
);

-- El HP ya no baja de 0: quien estaba en negativo vuelve al 50 % (amnistía) y la opción se apaga.
UPDATE student_profiles sp
  JOIN classrooms c ON c.id = sp.classroom_id
  SET sp.hp = CEIL(c.max_hp * 0.5)
  WHERE sp.hp < 0;
UPDATE classrooms SET allow_negative_hp = 0 WHERE allow_negative_hp = 1;

-- Quien hoy está en 0 queda Descansando desde ahora.
UPDATE student_profiles SET resting_since = UTC_TIMESTAMP() WHERE hp <= 0 AND resting_since IS NULL;
