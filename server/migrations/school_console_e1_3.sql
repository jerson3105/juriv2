-- Consola escolar, Entrega 1.3 (2026-10-04): padrón de estudiantes, matrícula del año con su historial, enlace de cada
-- clase a su sección y el borrador de «Armar desde clases».
-- IMPORTANTE: aplicar ANTES del deploy. El código nuevo lee classrooms.school_section_id en cada consulta de clases.

-- 1) Estudiante único de la escuela. El documento va cifrado (utils/piiCrypto, contexto school_student:<id>:document),
--    con un índice ciego por escuela para la unicidad y la búsqueda, y sus 3 últimos caracteres para mostrarlo
--    enmascarado (•••••678) sin descifrar.
CREATE TABLE IF NOT EXISTS school_students (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  first_names VARCHAR(100) NOT NULL,
  last_names VARCHAR(100) NOT NULL,
  document_type ENUM('DNI', 'CE', 'PTP', 'PASAPORTE') NULL,
  document_encrypted VARCHAR(255) NULL,
  document_index CHAR(64) NULL,
  document_hint VARCHAR(3) NULL,
  birth_date DATE NULL,
  institutional_email VARCHAR(255) NULL,
  siagie_code VARCHAR(20) NULL,
  user_id VARCHAR(36) NULL,
  student_status ENUM('ACTIVE', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_students_document (school_id, document_index),
  INDEX idx_school_students_school_name (school_id, last_names, first_names),
  INDEX idx_school_students_user (user_id)
);

-- 2) Matrícula: un estudiante por año, en una sección (o aún sin sección).
CREATE TABLE IF NOT EXISTS school_enrollments (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  section_id VARCHAR(36) NULL,
  enrollment_status ENUM('ACTIVE', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_enrollments_year_student (year_id, student_id),
  INDEX idx_school_enrollments_section (section_id),
  INDEX idx_school_enrollments_school (school_id)
);

-- 3) Historial de cada estudiante (lo que ve la ficha en «Movimientos»). metadata sin datos personales.
CREATE TABLE IF NOT EXISTS school_enrollment_events (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NULL,
  event_type ENUM('ENROLLED', 'BUILT_FROM_CLASSES', 'DATA_UPDATED', 'SECTION_CHANGED', 'WITHDRAWN', 'REINSTATED') NOT NULL,
  from_section_id VARCHAR(36) NULL,
  to_section_id VARCHAR(36) NULL,
  metadata JSON NULL,
  actor_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_school_enrollment_events_student (student_id, created_at),
  INDEX idx_school_enrollment_events_school (school_id, created_at)
);

-- 4) Cada clase de la escuela puede pertenecer a una sección del año (null = no es de una sección: taller, demo…).
ALTER TABLE classrooms
  ADD COLUMN school_section_id VARCHAR(36) NULL AFTER school_id,
  ADD INDEX idx_classrooms_school_section (school_section_id);

-- 5) Borrador de «Armar desde clases» (mapeo y decisiones), para seguir después. Uno por escuela y año.
CREATE TABLE IF NOT EXISTS school_roster_drafts (
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  data JSON NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (school_id, year_id)
);

-- student_profiles.school_student_id ya existe (con idx_student_profiles_school_student) en local y en producción.
