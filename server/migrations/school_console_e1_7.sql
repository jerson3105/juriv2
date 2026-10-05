-- Consola escolar, Entrega 1.7 (2026-10-05): los estudiantes entran con el código del colegio (o su QR), su DNI y un PIN.
-- IMPORTANTE: aplicar ANTES del deploy. El código nuevo lee schools.student_code y school_students.access_code en cada
-- consulta de esas tablas. No es idempotente (ADD COLUMN simple): revisar information_schema antes.

-- 1) Código del colegio para la puerta de los estudiantes. 7 caracteres: no se cruza con los códigos de clase y de
--    familia (8) ni con las tarjetas de una clase (6).
ALTER TABLE schools
  ADD COLUMN student_code VARCHAR(7) NULL,
  ADD UNIQUE INDEX uniq_schools_student_code (student_code);

-- 2) Tarjeta de un solo uso de cada estudiante: con ella activa su acceso (crea su PIN) o lo vuelve a crear después de
--    que la administración o su tutor lo restablecen. Se borra al usarla.
ALTER TABLE school_students
  ADD COLUMN access_code VARCHAR(7) NULL,
  ADD COLUMN access_code_at DATETIME NULL,
  ADD UNIQUE INDEX uniq_school_students_access_code (access_code);
