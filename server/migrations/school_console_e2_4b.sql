-- Consola escolar, Entrega 2.4b (2026-10-05): las clases sueltas del colegio quedan en el año que se cierra.
-- IMPORTANTE: aplicar ANTES del deploy. El calendario de cada clase del colegio (cabecera, Calificaciones, informes,
-- cierre del año, «Mis temporadas») lee esta tabla. Idempotente (CREATE TABLE IF NOT EXISTS).

-- Una clase del colegio sin asignación, taller ni sección sigue el año en curso. Al cerrarlo se archiva con él y aquí
-- queda de qué año fue: ya no sigue al año siguiente, no se restaura y aparece en «Mis temporadas» de sus estudiantes.
CREATE TABLE IF NOT EXISTS school_year_classrooms (
  classroom_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (classroom_id),
  KEY idx_school_year_classrooms_year (year_id)
);
