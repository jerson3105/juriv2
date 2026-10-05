-- Consola escolar (2026-10-05): la administración cierra y reabre los bimestres del colegio. Las clases de un colegio con
-- año escolar activo siguen sus bimestres en Calificaciones; un bimestre cerrado deja congeladas las notas de todas.
-- IMPORTANTE: aplicar ANTES del deploy (los select de school_periods leen las columnas nuevas). No es idempotente:
-- revisar information_schema antes.
ALTER TABLE school_periods
  ADD COLUMN locked_at DATETIME NULL,
  ADD COLUMN locked_by VARCHAR(36) NULL;
