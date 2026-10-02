-- «Mi personaje» (bloque 3 del avatar, 2026-10-02): una sola meta de ahorro para premios y prendas,
-- la prenda de regalo (una común, una vez por perfil) y ropa a mitad de precio para los pequeños.
-- Ejecutar DESPUÉS de avatar_catalog_v2.sql y ANTES de desplegar el código.

-- La meta guarda el id de un premio de la tienda o de una prenda; shop_goal_kind dice cuál.
-- avatar_gift_at: cuándo eligió su prenda de regalo (NULL = aún la tiene).
ALTER TABLE student_profiles
  ADD COLUMN shop_goal_kind ENUM('ITEM', 'AVATAR') NULL AFTER shop_goal_item_id,
  ADD COLUMN avatar_gift_at DATETIME NULL AFTER shop_goal_kind;

UPDATE student_profiles SET shop_goal_kind = 'ITEM' WHERE shop_goal_item_id IS NOT NULL AND shop_goal_kind IS NULL;

-- Inicial a 2.º: «Más barata» (seis semanas de oro son una eternidad a esa edad). El docente puede cambiarla.
UPDATE classrooms SET avatar_price_level = 'LOW'
WHERE avatar_price_level = 'NORMAL'
  AND (UPPER(grade_level) LIKE 'INICIAL%' OR UPPER(grade_level) IN ('PRIMARIA_1', 'PRIMARIA_2'));
