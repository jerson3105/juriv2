-- Catálogo de avatar v2 (2026-10-02): colecciones, prendas unidas por par (versión chico y chica),
-- tienda de avatar automática en cada clase con precios según su oro semanal, y excepciones del
-- docente. Ejecutar ANTES de desplegar el código (Drizzle pide todas las columnas).

-- Colecciones del admin. «Básicos» reúne el catálogo actual; las nuevas llegan solas a las clases.
CREATE TABLE IF NOT EXISTS avatar_collections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_avatar_collections_slug (slug)
);

INSERT INTO avatar_collections (id, slug, name, description, sort_order, is_active, created_at, updated_at)
SELECT '6f1d2c3b-8a4e-4c5d-9b7a-1e2f3a4b5c6d', 'basicos', 'Básicos', 'Las prendas de siempre', 0, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM avatar_collections WHERE slug = 'basicos');

-- Colección de cada prenda y su par (la misma prenda en el otro cuerpo comparte pair_key).
ALTER TABLE avatar_items
  ADD COLUMN collection_id VARCHAR(36) NULL AFTER rarity,
  ADD COLUMN pair_key VARCHAR(36) NULL AFTER collection_id,
  ADD INDEX idx_avatar_items_collection (collection_id),
  ADD INDEX idx_avatar_items_pair (pair_key);

UPDATE avatar_items SET collection_id = (SELECT id FROM avatar_collections WHERE slug = 'basicos') WHERE collection_id IS NULL;

-- Pares claros del catálogo actual: misma ranura y mismo nombre sin «(H)»/«(F)»
-- (en prod: Duende Capturado, Fondo 8bit y Ojos marrones). El resto son de un solo cuerpo.
UPDATE avatar_items f
JOIN avatar_items m
  ON m.avatar_slot = f.avatar_slot
 AND m.avatar_gender = 'MALE' AND f.avatar_gender = 'FEMALE'
 AND m.is_active = 1 AND f.is_active = 1
 AND TRIM(REPLACE(REPLACE(m.name, '(H)', ''), '(F)', '')) = TRIM(REPLACE(REPLACE(f.name, '(H)', ''), '(F)', ''))
SET m.pair_key = m.id, f.pair_key = m.id
WHERE m.pair_key IS NULL AND f.pair_key IS NULL;

-- Tienda de avatar de cada clase: activada por defecto; precios = oro semanal (base, se calcula la
-- primera vez que se abre y queda fija hasta que el docente la actualice) × semanas por rareza × nivel.
ALTER TABLE classrooms
  ADD COLUMN avatar_shop_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN avatar_price_level ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN avatar_price_base INT NULL,
  ADD COLUMN avatar_prices_at DATETIME NULL;

-- classroom_avatar_items pasa a guardar solo excepciones del docente:
-- is_available = 0 → prenda oculta en la clase; price → precio propio (NULL = el calculado).
ALTER TABLE classroom_avatar_items MODIFY COLUMN price INT NULL;

-- Filas de clases ya borradas (de borrados antiguos).
DELETE ci FROM classroom_avatar_items ci LEFT JOIN classrooms c ON c.id = ci.classroom_id WHERE c.id IS NULL;

-- Las clases que armaron su tienda a mano conservan su selección: lo que no eligieron queda oculto.
INSERT INTO classroom_avatar_items (id, classroom_id, avatar_item_id, price, is_available, created_at)
SELECT UUID(), sel.classroom_id, ai.id, NULL, 0, UTC_TIMESTAMP()
FROM (SELECT DISTINCT classroom_id FROM classroom_avatar_items WHERE is_available = 1) sel
JOIN avatar_items ai ON ai.is_active = 1 AND ai.is_default = 0
LEFT JOIN classroom_avatar_items x ON x.classroom_id = sel.classroom_id AND x.avatar_item_id = ai.id
WHERE x.id IS NULL;

-- Lo elegido queda visible con el precio recalculado (sin precio propio): ya no hace falta la fila.
DELETE FROM classroom_avatar_items WHERE is_available = 1;

-- Colecciones ocultas por clase (excepción del docente).
CREATE TABLE IF NOT EXISTS classroom_avatar_collections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  classroom_id VARCHAR(36) NOT NULL,
  collection_id VARCHAR(36) NOT NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uniq_classroom_avatar_collection (classroom_id, collection_id)
);
