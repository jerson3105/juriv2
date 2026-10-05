-- Consola escolar (2026-10-05): coordinadores de área y propuestas de su área en la Biblioteca.
-- IMPORTANTE: aplicar ANTES del deploy (los select de school_behaviors y school_badges leen las columnas nuevas). No es
-- idempotente: revisar information_schema antes.

-- 1) Coordinador de cada área por nivel y año (lo nombra la administración). Ve la información de las clases y talleres
--    de su área (sin entrar a ellas) y propone comportamientos e insignias para su área en la Biblioteca.
CREATE TABLE IF NOT EXISTS school_area_coordinators (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NOT NULL,
  area_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_area_coordinators (year_id, school_level, area_id),
  INDEX idx_school_area_coordinators_user (user_id),
  INDEX idx_school_area_coordinators_school (school_id)
);

-- 2) Propuestas de un área en la Biblioteca: sin área = del colegio (las crea la administración); con área y nivel = del
--    área (las crea su coordinador). Los docentes eligen cuáles importar a sus clases.
ALTER TABLE school_behaviors
  ADD COLUMN area_id VARCHAR(36) NULL,
  ADD COLUMN school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NULL;
ALTER TABLE school_badges
  ADD COLUMN area_id VARCHAR(36) NULL,
  ADD COLUMN school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NULL;
