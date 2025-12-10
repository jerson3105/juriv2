-- Seed de items de avatar de prueba

-- Items masculinos
INSERT INTO `avatar_items` (`id`, `name`, `description`, `avatar_gender`, `avatar_slot`, `image_path`, `layer_order`, `base_price`, `rarity`, `is_active`, `created_at`, `updated_at`)
VALUES 
  (UUID(), 'Pantalón Elegante', 'Un pantalón elegante para ocasiones especiales', 'MALE', 'BOTTOM', '/avatars/male/bottom/pantalon_elegante.png', 4, 150, 'RARE', true, NOW(), NOW()),
  (UUID(), 'Abrigo Largo', 'Un abrigo largo y elegante para el frío', 'MALE', 'TOP', '/avatars/male/top/abrigo_largo.png', 5, 200, 'RARE', true, NOW(), NOW());

-- Verificar inserción
SELECT id, name, avatar_gender, avatar_slot, base_price, rarity FROM avatar_items;
