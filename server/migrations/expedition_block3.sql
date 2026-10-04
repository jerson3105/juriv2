-- Expedición unificada, bloque 3 (2026-10-04): capa de clanes por mayoría y meta de clase.
-- Correr DESPUÉS de expedition_block2.sql. NO es idempotente (MySQL 8 no admite ADD COLUMN IF NOT EXISTS):
-- antes, revisar que no exista: SHOW COLUMNS FROM expeditions LIKE 'goal_percent';

-- 1) Premio del clan al llegar a la meta (modo por clanes) y meta de la clase (opcional: null = sin meta).
ALTER TABLE expeditions
  ADD COLUMN clan_xp INT NOT NULL DEFAULT 0 AFTER perseverance_badge_id,
  ADD COLUMN goal_percent TINYINT UNSIGNED NULL AFTER clan_xp,
  ADD COLUMN goal_due_at DATETIME NULL AFTER goal_percent,
  ADD COLUMN goal_xp INT NOT NULL DEFAULT 0 AFTER goal_due_at,
  ADD COLUMN goal_reached_at DATETIME NULL AFTER goal_xp;

-- 2) El premio de la meta de clase se paga una sola vez a cada alumno que llegó.
ALTER TABLE expedition_finishes
  ADD COLUMN goal_rewarded_at DATETIME NULL AFTER rewarded_at;

-- 3) Clanes que llegaron a la meta: una parada cuenta para el clan cuando la logra más de la mitad de sus
--    miembros; con todas, el clan llega y su premio se paga una sola vez.
CREATE TABLE IF NOT EXISTS expedition_clan_finishes (
  expedition_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  finished_at DATETIME NOT NULL,
  rewarded_at DATETIME NULL,
  PRIMARY KEY (expedition_id, team_id),
  KEY idx_expedition_clan_finishes_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
