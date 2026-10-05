-- Consola escolar, Entrega 1.5b (2026-10-04): talleres. Un taller es parte de un área del plan (Panadería → EPT) y su
-- nota cuenta dentro del área con un peso (la libreta lo usa en la Entrega 3). Lo llevan toda una o varias secciones
-- del nivel (entran solas, como un área) o solo los inscritos (aunque sean de varias secciones).
CREATE TABLE IF NOT EXISTS school_workshops (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NOT NULL,
  area_id VARCHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  teacher_user_id VARCHAR(36) NOT NULL,
  classroom_id VARCHAR(36) NULL,
  mode ENUM('SECTION', 'CHOSEN') NOT NULL,
  weight TINYINT NOT NULL DEFAULT 30,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_workshops_classroom (classroom_id),
  INDEX idx_school_workshops_school_year (school_id, year_id),
  INDEX idx_school_workshops_teacher (teacher_user_id)
);

-- Taller de toda la sección: sus secciones.
CREATE TABLE IF NOT EXISTS school_workshop_sections (
  workshop_id VARCHAR(36) NOT NULL,
  section_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (workshop_id, section_id),
  INDEX idx_school_workshop_sections_section (section_id)
);

-- Taller con inscripción: sus estudiantes.
CREATE TABLE IF NOT EXISTS school_workshop_students (
  workshop_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (workshop_id, student_id),
  INDEX idx_school_workshop_students_student (student_id)
);
