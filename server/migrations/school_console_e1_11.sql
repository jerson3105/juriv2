-- Consola escolar (2026-10-05): sexo del estudiante en el padrón (Mujer / Hombre, como el SIAGIE; null = sin registrar).
-- Con él se cuentan mujeres y hombres por sección y por clase, y el avatar nace con el cuerpo que le corresponde.
-- IMPORTANTE: aplicar ANTES del deploy (los select de school_students leen la columna). No es idempotente: revisar
-- information_schema antes.
ALTER TABLE school_students ADD COLUMN sex ENUM('FEMALE', 'MALE') NULL;
