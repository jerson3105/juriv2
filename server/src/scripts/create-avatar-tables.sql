-- Crear tablas de avatar si no existen

-- Tabla de items de avatar (catálogo global)
CREATE TABLE IF NOT EXISTS `avatar_items` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `avatar_gender` enum('MALE','FEMALE') NOT NULL,
  `avatar_slot` enum('HEAD','FACE','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','PETS') NOT NULL,
  `image_path` varchar(500) NOT NULL,
  `layer_order` int NOT NULL DEFAULT 0,
  `base_price` int NOT NULL DEFAULT 100,
  `rarity` enum('COMMON','RARE','LEGENDARY') NOT NULL DEFAULT 'COMMON',
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de items de avatar por clase (tienda de cada clase)
CREATE TABLE IF NOT EXISTS `classroom_avatar_items` (
  `id` varchar(36) NOT NULL,
  `classroom_id` varchar(36) NOT NULL,
  `avatar_item_id` varchar(36) NOT NULL,
  `price` int NOT NULL,
  `is_available` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `classroom_avatar_items_classroom_id_avatar_item_id_unique` (`classroom_id`, `avatar_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de compras de items de avatar por estudiante
CREATE TABLE IF NOT EXISTS `student_avatar_purchases` (
  `id` varchar(36) NOT NULL,
  `student_profile_id` varchar(36) NOT NULL,
  `avatar_item_id` varchar(36) NOT NULL,
  `price_paid` int NOT NULL,
  `purchased_at` datetime NOT NULL,
  `classroom_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_purchase_unique` (`student_profile_id`, `avatar_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de items equipados por estudiante
CREATE TABLE IF NOT EXISTS `student_equipped_items` (
  `id` varchar(36) NOT NULL,
  `student_profile_id` varchar(36) NOT NULL,
  `avatar_item_id` varchar(36) NOT NULL,
  `avatar_slot` enum('HEAD','FACE','TOP','BOTTOM','LEFT_HAND','RIGHT_HAND','SHOES','BACK','PETS') NOT NULL,
  `equipped_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_equipped_unique` (`student_profile_id`, `avatar_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
