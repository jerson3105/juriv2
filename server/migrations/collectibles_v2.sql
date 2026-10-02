-- Coleccionables v2 (2026-10-02): sobres con pocas repetidas, precio automático por nivel (como el avatar)
-- y sobre de bienvenida. Ejecutar ANTES de desplegar el código (Drizzle pide la columna nueva).

-- Nivel de precio del álbum: más barato (la mitad), normal o más caro (el doble) sobre la base semanal de la
-- clase. Las columnas de precio manual (single/five/ten_pack_price) quedan sin uso.
ALTER TABLE collectible_albums
  ADD COLUMN price_level ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL' AFTER ten_pack_price;

-- Inicial a 2.º: «Más barato».
UPDATE collectible_albums a
JOIN classrooms c ON c.id = a.classroom_id
SET a.price_level = 'LOW'
WHERE UPPER(c.grade_level) LIKE 'INICIAL%' OR UPPER(c.grade_level) IN ('PRIMARIA_1', 'PRIMARIA_2');

-- Tipos de sobre: PACK es el sobre único de v2 (5 figuritas, 3 en inicial a 2.º, menos si faltan menos) y
-- WELCOME el de bienvenida (gratis). SINGLE/PACK_5/PACK_10 quedan para el historial.
ALTER TABLE collectible_purchases
  MODIFY COLUMN pack_type ENUM('SINGLE', 'PACK_5', 'PACK_10', 'PACK', 'WELCOME') NOT NULL;

-- Sobre de bienvenida: uno por alumno y álbum (el índice único hace que dos pestañas no abran dos).
CREATE TABLE IF NOT EXISTS collectible_welcome_packs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  student_profile_id VARCHAR(36) NOT NULL,
  album_id VARCHAR(36) NOT NULL,
  opened_at DATETIME NOT NULL,
  UNIQUE KEY uniq_collectible_welcome (student_profile_id, album_id),
  KEY idx_collectible_welcome_album (album_id)
);
