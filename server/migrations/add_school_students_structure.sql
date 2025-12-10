-- Migración: Estructura de estudiantes de escuela con grados y secciones
-- Fecha: 2024-12-10

-- Tabla de grados (1° SEC, 2° SEC, etc.)
CREATE TABLE IF NOT EXISTS school_grades (
  id VARCHAR(36) PRIMARY KEY,
  school_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  INDEX idx_school_grades_school (school_id),
  UNIQUE KEY unique_grade_name (school_id, name)
);

-- Tabla de secciones (A, B, C, etc.)
CREATE TABLE IF NOT EXISTS school_sections (
  id VARCHAR(36) PRIMARY KEY,
  grade_id VARCHAR(36) NOT NULL,
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grade_id) REFERENCES school_grades(id) ON DELETE CASCADE,
  INDEX idx_school_sections_grade (grade_id),
  UNIQUE KEY unique_section_name (grade_id, name)
);

-- Tabla de estudiantes de escuela
CREATE TABLE IF NOT EXISTS school_students (
  id VARCHAR(36) PRIMARY KEY,
  school_id VARCHAR(36) NOT NULL,
  section_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  temp_password VARCHAR(100) NULL,
  student_code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES school_sections(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_school_students_school (school_id),
  INDEX idx_school_students_section (section_id),
  INDEX idx_school_students_user (user_id),
  UNIQUE KEY unique_student_email (school_id, email)
);

-- Agregar columna school_student_id a student_profiles
ALTER TABLE student_profiles 
ADD COLUMN school_student_id VARCHAR(36) NULL AFTER id,
ADD CONSTRAINT fk_student_profiles_school_student 
  FOREIGN KEY (school_student_id) REFERENCES school_students(id) ON DELETE SET NULL,
ADD INDEX idx_student_profiles_school_student (school_student_id);
