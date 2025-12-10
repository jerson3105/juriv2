-- Agregar columnas para configuración inicial de estudiantes B2B
-- Ejecutar: mysql -u root juried_db < migrations/add_student_setup_columns.sql

-- Agregar columna needs_setup si no existe
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN NOT NULL DEFAULT FALSE;

-- Agregar columnas real_name y real_last_name si no existen
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS real_name VARCHAR(100);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS real_last_name VARCHAR(100);

-- Marcar estudiantes B2B existentes que necesitan configuración (los que tienen school_student_id pero no character_name)
UPDATE student_profiles sp
INNER JOIN school_students ss ON sp.school_student_id = ss.id
SET sp.needs_setup = TRUE,
    sp.real_name = ss.first_name,
    sp.real_last_name = ss.last_name
WHERE sp.school_student_id IS NOT NULL 
  AND (sp.character_name IS NULL OR sp.character_name = '');

-- Actualizar display_name para estudiantes B2B existentes que no lo tienen
UPDATE student_profiles sp
INNER JOIN school_students ss ON sp.school_student_id = ss.id
SET sp.display_name = CONCAT(ss.first_name, ' ', ss.last_name)
WHERE sp.school_student_id IS NOT NULL 
  AND (sp.display_name IS NULL OR sp.display_name = '');
