-- Consola escolar, Entrega 1.3b (2026-10-04): registro de cada «Armar desde clases», para poder deshacerlo.
-- data guarda los estudiantes creados, los perfiles vinculados, la sección que tenía antes cada clase y el borrador
-- (mapeo y decisiones) para restaurarlo. Solo ids y decisiones: ningún documento.
CREATE TABLE IF NOT EXISTS school_roster_builds (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  created_count INT NOT NULL,
  linked_count INT NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  undone_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  INDEX idx_school_roster_builds_school_year (school_id, year_id, created_at)
);
