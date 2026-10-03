-- Caja de la clase (2026-10-02): un alumno dona una repetida (nunca su última copia ni una brillante) y un compañero
-- al que le falta la toma (hasta 3 al día). Anónima para la clase; el profe ve quién dona y quién toma.
-- Ejecutar DESPUÉS de collectibles_v2.sql y ANTES de desplegar el código.

-- Encendida por defecto en todos los álbumes (la columna allow_trades no tenía uso); el profe la apaga por álbum.
ALTER TABLE collectible_albums
  MODIFY COLUMN allow_trades BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE collectible_albums SET allow_trades = TRUE;

-- Cada figurita donada es una fila: queda en la caja hasta que alguien la toma (taker_profile_id).
CREATE TABLE IF NOT EXISTS collectible_box_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  album_id VARCHAR(36) NOT NULL,
  card_id VARCHAR(36) NOT NULL,
  donor_profile_id VARCHAR(36) NOT NULL,
  donated_at DATETIME NOT NULL,
  taker_profile_id VARCHAR(36) NULL,
  taken_at DATETIME NULL,
  KEY idx_collectible_box_available (album_id, card_id, taker_profile_id),
  KEY idx_collectible_box_taker (taker_profile_id, taken_at),
  KEY idx_collectible_box_donor (donor_profile_id)
);
