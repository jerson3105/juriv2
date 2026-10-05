-- Consola escolar, Entrega 2.2 (2026-10-05): promoción y cierre del año escolar.
-- IMPORTANTE: aplicar ANTES del deploy. El código nuevo lee school_enrollments.final_situation, final_situation_at y
-- next_section_id en cada consulta de matrículas. No es idempotente (ADD COLUMN simple): revisar information_schema antes.

-- 1) Situación final del estudiante en el año que cierra (Promovido, Permanece, Recuperación, No continúa, Egresa) y la
--    sección del año siguiente que se le eligió. Antes del cierre guarda lo que marca la administración (null = lo de su
--    sección); al cerrar queda la definitiva.
ALTER TABLE school_enrollments
  ADD COLUMN final_situation ENUM('PROMOTED', 'REPEATS', 'RECOVERY', 'LEAVES', 'GRADUATED') NULL,
  ADD COLUMN final_situation_at DATETIME NULL,
  ADD COLUMN next_section_id VARCHAR(36) NULL;

-- 2) Egresado: deja de ser estudiante del colegio (como un retiro) con su historia completa.
ALTER TABLE school_students
  MODIFY COLUMN student_status ENUM('ACTIVE', 'WITHDRAWN', 'GRADUATED') NOT NULL DEFAULT 'ACTIVE';

-- 3) Historial de la matrícula: la situación final al cerrar y su cambio (una recuperación que se resuelve).
ALTER TABLE school_enrollment_events
  MODIFY COLUMN event_type ENUM('ENROLLED', 'BUILT_FROM_CLASSES', 'DATA_UPDATED', 'SECTION_CHANGED', 'WITHDRAWN', 'REINSTATED', 'FINAL_SITUATION', 'SITUATION_CHANGED') NOT NULL;

-- 4) A qué sección del año siguiente pasa cada sección, o si egresa. Sin fila: la sección del grado siguiente con su
--    mismo nombre (o la única de ese grado).
CREATE TABLE IF NOT EXISTS school_section_promotions (
  section_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  target_section_id VARCHAR(36) NULL,
  graduates TINYINT(1) NOT NULL DEFAULT 0,
  updated_by VARCHAR(36) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (section_id),
  KEY idx_school_section_promotions_school (school_id)
);
