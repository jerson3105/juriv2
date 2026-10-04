-- Expedición unificada (2026-10-03): la expedición clásica y la de Jiro pasan a ser una sola, con paradas
-- en lista (relato, reto del banco, evidencia y en clase). El avance de cada alumno nace al tocar la parada,
-- así que quien entra tarde y las paradas nuevas funcionan sin «publicar de nuevo».
-- Ejecutar ANTES de desplegar el código que lo usa. Después: node migrations/expedition_unified_migrate.mjs --apply
-- (pasa los pines de las expediciones clásicas a paradas).
-- Las tablas expedition_pins, _connections, _pin_progress, _student_progress, _submissions y jiro_* quedan
-- sin uso; se borrarán en una migración posterior.

-- 1) Expedición: escenario (constelación o mapa de la biblioteca), modo de grupo, texto de cierre y
--    recompensa por llegar a la meta. Con constelación no hace falta mapa.
ALTER TABLE expeditions
  ADD COLUMN scenario ENUM('CONSTELLATION','MAP') NOT NULL DEFAULT 'CONSTELLATION' AFTER description,
  ADD COLUMN constellation_id VARCHAR(40) NULL AFTER scenario,
  MODIFY map_image_url VARCHAR(500) NULL,
  ADD COLUMN group_mode ENUM('INDIVIDUAL','CLAN') NOT NULL DEFAULT 'INDIVIDUAL' AFTER map_image_url,
  ADD COLUMN closing_text TEXT NULL AFTER group_mode,
  ADD COLUMN finish_xp INT NOT NULL DEFAULT 0 AFTER closing_text,
  ADD COLUMN finish_gold INT NOT NULL DEFAULT 0 AFTER finish_xp;

-- Las que ya existen tienen mapa. Su URL se guardaba absoluta (con el dominio de la API, con o sin /api):
-- pasa a la ruta relativa /api/uploads/..., que no se rompe si cambia el dominio.
UPDATE expeditions SET scenario = 'MAP' WHERE map_image_url IS NOT NULL AND map_image_url <> '';
UPDATE expeditions
  SET map_image_url = SUBSTRING(map_image_url, LOCATE('/api/uploads/', map_image_url))
  WHERE map_image_url LIKE 'http%/api/uploads/%';
UPDATE expeditions
  SET map_image_url = CONCAT('/api', SUBSTRING(map_image_url, LOCATE('/uploads/', map_image_url)))
  WHERE map_image_url LIKE 'http%/uploads/%';

-- 2) Paradas en lista. question_ids = las preguntas del banco que eligió el docente (en orden).
--    map_x/map_y = % de la IMAGEN (no del contenedor), solo con escenario de mapa.
CREATE TABLE IF NOT EXISTS expedition_stops (
  id VARCHAR(36) NOT NULL,
  expedition_id VARCHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  kind ENUM('STORY','CHALLENGE','EVIDENCE','CLASS') NOT NULL,
  title VARCHAR(120) NOT NULL,
  story TEXT NULL,
  goal VARCHAR(200) NULL,
  success_criteria VARCHAR(200) NULL,
  mission TEXT NULL,
  resources JSON NULL,
  bank_id VARCHAR(36) NULL,
  question_ids JSON NULL,
  pass_percent INT NOT NULL DEFAULT 60,
  review_mode ENUM('ADVANCE','WAIT') NOT NULL DEFAULT 'ADVANCE',
  due_at DATETIME NULL,
  reward_xp INT NOT NULL DEFAULT 0,
  reward_gold INT NOT NULL DEFAULT 0,
  map_x DECIMAL(5,2) NULL,
  map_y DECIMAL(5,2) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_expedition_stops_expedition (expedition_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Avance de cada alumno en cada parada (la fila nace al tocarla).
--    status: STARTED = reto en curso · WAITING = evidencia que espera revisión · DONE = superada.
--    review: estado de la evidencia (con «avanza ya», el alumno sigue mientras queda PENDING).
--    rewarded_at: la recompensa se paga una sola vez por fila.
CREATE TABLE IF NOT EXISTS expedition_stop_progress (
  id VARCHAR(36) NOT NULL,
  expedition_id VARCHAR(36) NOT NULL,
  stop_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  status ENUM('STARTED','WAITING','DONE') NOT NULL DEFAULT 'STARTED',
  attempt TINYINT NOT NULL DEFAULT 1,
  first_score INT NULL,
  final_score INT NULL,
  gold_star TINYINT(1) NOT NULL DEFAULT 0,
  review ENUM('PENDING','APPROVED','NEEDS_WORK') NULL,
  feedback VARCHAR(500) NULL,
  reviewed_at DATETIME NULL,
  reviewed_by VARCHAR(36) NULL,
  done_at DATETIME NULL,
  rewarded_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_expedition_stop_progress (stop_id, student_profile_id),
  KEY idx_expedition_stop_progress_student (expedition_id, student_profile_id),
  KEY idx_expedition_stop_progress_review (expedition_id, review)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Respuestas del reto: una por pregunta en cada vuelta (1 = primer intento, 2 = reintento de las falladas).
CREATE TABLE IF NOT EXISTS expedition_answers (
  id VARCHAR(36) NOT NULL,
  stop_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  attempt TINYINT NOT NULL,
  answer JSON NULL,
  is_correct TINYINT(1) NOT NULL,
  answered_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_expedition_answer (stop_id, student_profile_id, question_id, attempt),
  KEY idx_expedition_answers_student (student_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Evidencias: cada entrega queda guardada; la vigente es la última (con milisegundos: dos entregas en el
--    mismo segundo no se confunden al decidir cuál vio el docente).
CREATE TABLE IF NOT EXISTS expedition_evidence (
  id VARCHAR(36) NOT NULL,
  expedition_id VARCHAR(36) NOT NULL,
  stop_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  files JSON NOT NULL,
  note TEXT NULL,
  submitted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_expedition_evidence_stop (stop_id, student_profile_id),
  KEY idx_expedition_evidence_student (student_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Llegada a la meta: una fila por alumno; la recompensa final se paga una sola vez.
CREATE TABLE IF NOT EXISTS expedition_finishes (
  expedition_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  finished_at DATETIME NOT NULL,
  rewarded_at DATETIME NULL,
  PRIMARY KEY (expedition_id, student_profile_id),
  KEY idx_expedition_finishes_student (student_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
