-- Tabla para mapas de expediciones (gestionados por administrador Juried)
CREATE TABLE IF NOT EXISTS expedition_maps (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_expedition_maps_category (category),
  INDEX idx_expedition_maps_active (is_active)
);

-- Insertar algunos mapas de ejemplo
INSERT INTO expedition_maps (id, name, description, image_url, category, is_active, created_at, updated_at) VALUES
(UUID(), 'Bosque Encantado', 'Un misterioso bosque lleno de magia y aventuras', '/maps/forest.jpg', 'fantasy', TRUE, NOW(), NOW()),
(UUID(), 'Mares del Silencio', 'Navega por aguas tranquilas hacia el conocimiento', '/maps/sea.jpg', 'nature', TRUE, NOW(), NOW()),
(UUID(), 'Montañas del Saber', 'Escala las cumbres del aprendizaje', '/maps/mountains.jpg', 'nature', TRUE, NOW(), NOW()),
(UUID(), 'Ciudad Futurista', 'Explora la tecnología del mañana', '/maps/city.jpg', 'sci-fi', TRUE, NOW(), NOW()),
(UUID(), 'Desierto Dorado', 'Atraviesa las arenas del tiempo', '/maps/desert.jpg', 'adventure', TRUE, NOW(), NOW());
