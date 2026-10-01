-- Configuración: "Aceptar alumnos nuevos" separado de "Archivar" (is_active).
-- Aditiva. Todas las clases existentes siguen aceptando alumnos (DEFAULT 1).
-- Ejecutar ANTES de desplegar el código (el código lee la columna).
ALTER TABLE classrooms ADD COLUMN accepting_students TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active;
