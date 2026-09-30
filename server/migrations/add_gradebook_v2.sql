-- Calificaciones v2: fechas de bimestre, nota calculada separada de la manual, evaluaciones propias,
-- conclusiones descriptivas y pesos. Aditiva. Aplicar ANTES de desplegar el código que la usa.

-- Fechas de cada bimestre { "2026-B1": { "start": ISO, "end": ISO } } (fin exclusivo).
-- Si falta un bimestre se usa la lógica anterior (desde el cierre previo hasta el cierre o ahora).
ALTER TABLE classrooms ADD COLUMN bimester_dates JSON NULL AFTER closed_bimesters;
-- Peso (%) de las evaluaciones frente a la evidencia gamificada cuando hay ambas. NULL = 100.
ALTER TABLE classrooms ADD COLUMN grade_evaluation_weight TINYINT UNSIGNED NULL AFTER grade_scale_config;

-- score / grade_label siguen siendo la nota EFECTIVA (familias y exportación la leen).
-- calculated_*: lo que calcula el sistema, aunque haya ajuste manual (para avisar si difiere).
ALTER TABLE student_grades
  ADD COLUMN calculated_score DECIMAL(5,2) NULL AFTER grade_label,
  ADD COLUMN calculated_label VARCHAR(10) NULL AFTER calculated_score,
  ADD COLUMN manual_label VARCHAR(10) NULL AFTER manual_score,
  ADD COLUMN private_note TEXT NULL AFTER manual_note,
  ADD COLUMN conclusion TEXT NULL AFTER private_note;
UPDATE student_grades SET calculated_score = score, calculated_label = grade_label WHERE is_manual_override = 0;

-- Peso de cada destreza dentro de su competencia (1 = normal).
ALTER TABLE classroom_competency_indicators ADD COLUMN weight TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER display_order;

-- Evaluaciones propias del docente (examen, tarea...) con nota directa por alumno.
CREATE TABLE grade_evaluations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  period VARCHAR(20) NOT NULL,
  competency_id VARCHAR(36) NOT NULL,
  indicator_id VARCHAR(36) NULL,
  title VARCHAR(150) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'OTHER',
  evaluated_on DATE NULL,
  weight TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_grade_evaluations_classroom_period (classroom_id, period),
  KEY idx_grade_evaluations_competency (competency_id)
);

CREATE TABLE grade_evaluation_scores (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  evaluation_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  label VARCHAR(10) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_grade_evaluation_student (evaluation_id, student_profile_id),
  KEY idx_grade_evaluation_scores_student (student_profile_id)
);
