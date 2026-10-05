-- Consola escolar (2026-10-05): el equipo de Juried crea colegios desde su panel, con su código modular (Minedu).
-- IMPORTANTE: aplicar ANTES del deploy (cada select de schools lee la columna). No es idempotente: revisar
-- information_schema antes.
ALTER TABLE schools ADD COLUMN modular_code VARCHAR(10) NULL;
