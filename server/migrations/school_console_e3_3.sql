-- Consola escolar, Entrega 3.3 (2026-10-05): publicación de las libretas.
-- Aplicar ANTES del deploy: publicar, y la libreta de la familia y del estudiante, leen estas tablas. Idempotente.

-- Cada publicación de un bimestre (todo el colegio). Reabrir un bimestre publicado pide un motivo (queda en la versión
-- que se corrige); al publicarlo de nuevo sale la versión siguiente.
CREATE TABLE IF NOT EXISTS school_report_publications (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  period_code VARCHAR(4) NOT NULL,
  version INT NOT NULL,
  students INT NOT NULL,
  correction_reason VARCHAR(255) NULL,
  published_by VARCHAR(36) NOT NULL,
  published_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_report_publications_version (year_id, period_code, version),
  KEY idx_school_report_publications_school (school_id)
);

-- La libreta congelada de cada estudiante en una publicación (lo que ve su familia no cambia aunque después se edite la
-- asistencia o una conclusión). Sin el DNI: se lee al descargar, con las llaves del servidor.
CREATE TABLE IF NOT EXISTS school_report_snapshots (
  publication_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  section_id VARCHAR(36) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (publication_id, student_id),
  KEY idx_school_report_snapshots_student (student_id)
);
