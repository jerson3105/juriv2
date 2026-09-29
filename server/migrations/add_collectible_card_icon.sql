-- Coleccionables: emoji por cromo (para que cada cromo se distinga aunque no tenga imagen).
-- Aditiva y segura: columna nueva, nula por defecto. Aplicar ANTES de desplegar el código que la usa.
ALTER TABLE collectible_cards ADD COLUMN icon VARCHAR(50) NULL AFTER image_url;
