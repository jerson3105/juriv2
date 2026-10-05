-- Consola escolar, Entrega 1.2 (2026-10-04): grados y secciones con tutoría.
-- Una sección es grado + nombre libre (letras, colores, países…) dentro de un nivel y un año. El nombre no se repite
-- en el mismo grado (la intercalación de la base no distingue mayúsculas ni tildes: «a» = «A», «Peru» = «Perú»).
CREATE TABLE IF NOT EXISTS school_sections (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NOT NULL,
  grade TINYINT NOT NULL,
  name VARCHAR(40) NOT NULL,
  shift ENUM('MORNING', 'AFTERNOON') NOT NULL DEFAULT 'MORNING',
  tutor_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_sections_name (year_id, school_level, grade, name),
  INDEX idx_school_sections_school (school_id),
  INDEX idx_school_sections_tutor (tutor_user_id)
);
