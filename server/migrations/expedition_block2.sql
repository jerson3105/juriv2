-- Expedición unificada, bloque 2 (2026-10-03): nota por paradas, insignias, «¿Cómo me fue?» y modo clase.
-- Correr DESPUÉS de expedition_unified.sql. NO es idempotente (MySQL 8 no admite ADD COLUMN IF NOT EXISTS):
-- antes, revisar que no exista: SHOW COLUMNS FROM expedition_stops LIKE 'competency_id';

-- 1) Insignias que elige el docente: al llegar a la meta y por perseverancia (mejoró después de «pedir mejora»).
ALTER TABLE expeditions
  ADD COLUMN finish_badge_id VARCHAR(36) NULL AFTER finish_gold,
  ADD COLUMN perseverance_badge_id VARCHAR(36) NULL AFTER finish_badge_id;

-- 2) Paradas: competencia y peso para la nota (reto y evidencia; peso de 1 a 30) y la actividad del
--    Observatorio con la que se juega una parada «en clase» (ESTRELLAS | CONQUISTA | ERROR, con su banco).
ALTER TABLE expedition_stops
  ADD COLUMN competency_id VARCHAR(36) NULL AFTER reward_gold,
  ADD COLUMN grade_weight TINYINT UNSIGNED NOT NULL DEFAULT 20 AFTER competency_id,
  ADD COLUMN class_activity VARCHAR(12) NULL AFTER grade_weight,
  ADD KEY idx_expedition_stops_competency (competency_id);

-- 3) Avance: nivel elegido al aprobar la evidencia (en la escala de la clase, guardado también en %),
--    cuántas veces se pidió mejorar y si la parada se logró en clase (proyectada, sin nota individual).
ALTER TABLE expedition_stop_progress
  ADD COLUMN grade_score DECIMAL(5,2) NULL AFTER final_score,
  ADD COLUMN grade_label VARCHAR(10) NULL AFTER grade_score,
  ADD COLUMN needs_work_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER feedback,
  ADD COLUMN done_in_class TINYINT(1) NOT NULL DEFAULT 0 AFTER done_at;

-- 4) Meta: «¿Cómo me fue?» del alumno (GREEN | YELLOW | RED) y lo más difícil (opcional).
ALTER TABLE expedition_finishes
  ADD COLUMN reflection VARCHAR(8) NULL AFTER rewarded_at,
  ADD COLUMN reflection_note VARCHAR(200) NULL AFTER reflection,
  ADD COLUMN reflected_at DATETIME NULL AFTER reflection_note;

-- 5) Partidas del Observatorio jugadas desde una parada «en clase»: la Bitácora paga una vez y marca la parada.
ALTER TABLE activity_sessions
  ADD COLUMN expedition_stop_id VARCHAR(36) NULL AFTER title;
