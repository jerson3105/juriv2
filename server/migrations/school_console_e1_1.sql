-- Consola escolar, Entrega 1.1 (2026-10-04): administradores de escuela, año escolar, periodos y niveles.

-- 1) El responsable puede nombrar administradores (dirección, secretaría). ADMIN va al final del ENUM: así el
--    cambio no reescribe la tabla.
ALTER TABLE school_members
  MODIFY COLUMN school_member_role ENUM('OWNER', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'TEACHER';

-- 2) Año escolar. Un solo año ACTIVE por escuela (lo asegura el servicio con la fila de la escuela bloqueada).
--    Fechas como DATE (AAAA-MM-DD, sin zona horaria).
CREATE TABLE IF NOT EXISTS school_years (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  name VARCHAR(20) NOT NULL,
  school_year_status ENUM('PLANNING', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'PLANNING',
  period_type ENUM('BIMESTER', 'TRIMESTER') NOT NULL DEFAULT 'BIMESTER',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_years_school_name (school_id, name),
  INDEX idx_school_years_school_status (school_id, school_year_status)
);

-- 3) Periodos del año (B1..B4 o T1..T3). El estado es para la libreta (Entrega 3): por ahora todos OPEN.
CREATE TABLE IF NOT EXISTS school_periods (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  code VARCHAR(4) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  period_status ENUM('OPEN', 'REVIEW', 'LOCKED', 'PUBLISHED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_periods_year_code (year_id, code),
  INDEX idx_school_periods_school (school_id)
);

-- 4) Niveles que ofrece la escuela ese año y su escala (AD–C literal o 0–20 vigesimal).
CREATE TABLE IF NOT EXISTS school_year_levels (
  year_id VARCHAR(36) NOT NULL,
  school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  grade_scale ENUM('LITERAL', 'VIGESIMAL') NOT NULL DEFAULT 'LITERAL',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (year_id, school_level),
  INDEX idx_school_year_levels_school (school_id)
);
