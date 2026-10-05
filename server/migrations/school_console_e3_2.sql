-- Consola escolar, Entrega 3.2 (2026-10-05): exoneraciones para la libreta.
-- Aplicar ANTES del deploy: la libreta y la página «Libretas» leen esta tabla. Idempotente (CREATE TABLE IF NOT EXISTS).

-- Un estudiante exonerado de un área en el año (Educación Religiosa o Educación Física): la libreta pone «EXO» en sus
-- competencias, no cuentan como faltantes ni piden conclusión. La marca la administración en «Libretas».
CREATE TABLE IF NOT EXISTS school_exemptions (
  year_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  area_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (year_id, student_id, area_id),
  KEY idx_school_exemptions_school (school_id)
);
