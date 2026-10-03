-- Panel de prendas del admin (2026-10-03): borradores, publicación y huella de la imagen.
-- Ejecutar ANTES de desplegar el código que lo usa.
--   Borrador  = is_active 0 y published_at NULL (no llega a ninguna clase).
--   Publicada = is_active 1 (published_at = cuándo salió; «Nueva» cuenta desde ahí).
--   Retirada  = is_active 0 con published_at (ya no se vende; quien la tiene la conserva).
ALTER TABLE avatar_items
  ADD COLUMN image_hash CHAR(64) NULL AFTER image_path,
  ADD COLUMN published_at DATETIME NULL AFTER is_active;

-- Todo lo existente ya salió alguna vez.
UPDATE avatar_items SET published_at = created_at WHERE published_at IS NULL;

-- Un par (la misma prenda en los dos cuerpos) tiene a lo sumo una versión por cuerpo.
-- Antes de crearlo: SELECT pair_key, avatar_gender, COUNT(*) FROM avatar_items
--   WHERE pair_key IS NOT NULL GROUP BY pair_key, avatar_gender HAVING COUNT(*) > 1; → debe dar 0 filas.
CREATE UNIQUE INDEX uniq_avatar_items_pair_gender ON avatar_items (pair_key, avatar_gender);
