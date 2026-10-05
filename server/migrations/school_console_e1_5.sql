-- Consola escolar, Entrega 1.5 (2026-10-04): plan de estudios, asignaciones (sección × área → docente y clase) y las
-- áreas del nivel Inicial del CNEB (ciclo II, 3 a 5 años), que no existían. Ids fijos como los de las demás áreas
-- (area-pe-*, comp-pe-*): INSERT IGNORE la hace repetible y es igual en local y en producción.

INSERT IGNORE INTO curriculum_areas (id, country_code, education_level, name, short_name, display_order, is_active, created_at) VALUES
  ('area-pe-ini-ps', 'PE', 'INICIAL', 'Personal Social', 'Personal Social', 1, 1, NOW()),
  ('area-pe-ini-psi', 'PE', 'INICIAL', 'Psicomotriz', 'Psicomotriz', 2, 1, NOW()),
  ('area-pe-ini-com', 'PE', 'INICIAL', 'Comunicación', 'Comunicación', 3, 1, NOW()),
  ('area-pe-ini-csl', 'PE', 'INICIAL', 'Castellano como Segunda Lengua', 'Castellano L2', 4, 1, NOW()),
  ('area-pe-ini-mat', 'PE', 'INICIAL', 'Matemática', 'Matemática', 5, 1, NOW()),
  ('area-pe-ini-cyt', 'PE', 'INICIAL', 'Ciencia y Tecnología', 'CyT', 6, 1, NOW());

INSERT IGNORE INTO curriculum_competencies (id, area_id, source_type, name, short_name, display_order, is_active, created_at) VALUES
  ('comp-pe-ini-ps-01', 'area-pe-ini-ps', 'OFFICIAL', 'Construye su identidad', 'Identidad', 1, 1, NOW()),
  ('comp-pe-ini-ps-02', 'area-pe-ini-ps', 'OFFICIAL', 'Convive y participa democráticamente', 'Convivencia', 2, 1, NOW()),
  ('comp-pe-ini-ps-03', 'area-pe-ini-ps', 'OFFICIAL', 'Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente', 'Identidad Religiosa', 3, 1, NOW()),
  ('comp-pe-ini-psi-01', 'area-pe-ini-psi', 'OFFICIAL', 'Se desenvuelve de manera autónoma a través de su motricidad', 'Motricidad', 1, 1, NOW()),
  ('comp-pe-ini-com-01', 'area-pe-ini-com', 'OFFICIAL', 'Se comunica oralmente en su lengua materna', 'Comunicación Oral', 1, 1, NOW()),
  ('comp-pe-ini-com-02', 'area-pe-ini-com', 'OFFICIAL', 'Lee diversos tipos de textos escritos en su lengua materna', 'Lectura', 2, 1, NOW()),
  ('comp-pe-ini-com-03', 'area-pe-ini-com', 'OFFICIAL', 'Escribe diversos tipos de textos en su lengua materna', 'Escritura', 3, 1, NOW()),
  ('comp-pe-ini-com-04', 'area-pe-ini-com', 'OFFICIAL', 'Crea proyectos desde los lenguajes artísticos', 'Lenguajes Artísticos', 4, 1, NOW()),
  ('comp-pe-ini-csl-01', 'area-pe-ini-csl', 'OFFICIAL', 'Se comunica oralmente en castellano como segunda lengua', 'Comunicación Oral L2', 1, 1, NOW()),
  ('comp-pe-ini-mat-01', 'area-pe-ini-mat', 'OFFICIAL', 'Resuelve problemas de cantidad', 'Cantidad', 1, 1, NOW()),
  ('comp-pe-ini-mat-02', 'area-pe-ini-mat', 'OFFICIAL', 'Resuelve problemas de forma, movimiento y localización', 'Forma y Movimiento', 2, 1, NOW()),
  ('comp-pe-ini-cyt-01', 'area-pe-ini-cyt', 'OFFICIAL', 'Indaga mediante métodos científicos para construir sus conocimientos', 'Indagación', 1, 1, NOW());

-- Plan de estudios del año: qué áreas lleva cada nivel y en qué grados. Sin filas para un nivel = el plan del CNEB por
-- defecto (lo calcula el servidor); guardar el plan escribe todas las filas del nivel.
CREATE TABLE IF NOT EXISTS school_plan_areas (
  year_id VARCHAR(36) NOT NULL,
  school_level ENUM('INICIAL', 'PRIMARIA', 'SECUNDARIA') NOT NULL,
  area_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  grades VARCHAR(20) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (year_id, school_level, area_id),
  INDEX idx_school_plan_areas_school (school_id)
);

-- Asignación: en una sección, un área la enseña un docente, con su clase (opcional). Una clase va con una sola
-- asignación (UNIQUE admite varios NULL).
CREATE TABLE IF NOT EXISTS school_teaching_assignments (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  section_id VARCHAR(36) NOT NULL,
  area_id VARCHAR(36) NOT NULL,
  teacher_user_id VARCHAR(36) NOT NULL,
  classroom_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_school_assignments_section_area (section_id, area_id),
  UNIQUE KEY uq_school_assignments_classroom (classroom_id),
  INDEX idx_school_assignments_school_year (school_id, year_id),
  INDEX idx_school_assignments_teacher (teacher_user_id)
);

-- Matrícula automática: cada perfil que creó (CREATED) o ligó al padrón (LINKED) en una clase vinculada. Sirve para
-- deshacer una importación o un armado: se quitan los perfiles sin usar (user_id e initial_* dicen cómo quedaron).
CREATE TABLE IF NOT EXISTS school_auto_profiles (
  profile_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  classroom_id VARCHAR(36) NOT NULL,
  kind ENUM('CREATED', 'LINKED') NOT NULL,
  user_id VARCHAR(36) NULL,
  initial_xp INT NOT NULL DEFAULT 0,
  initial_gp INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (profile_id),
  INDEX idx_school_auto_profiles_student (student_id, created_at),
  INDEX idx_school_auto_profiles_school (school_id)
);
