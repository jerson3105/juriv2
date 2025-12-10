-- =====================================================
-- MIGRACIÓN: Sistema B2B - Escuelas
-- Base de datos: juried_db (MySQL con Drizzle ORM)
-- Ejecutar: mysql -u root juried_db < add_schools_b2b.sql
-- =====================================================

-- ==================== TABLA DE ESCUELAS ====================

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(500),
  
  -- Contacto
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  
  -- Configuración
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_teachers INT NOT NULL DEFAULT 50,
  max_students_per_class INT NOT NULL DEFAULT 50,
  
  -- Timestamps
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  INDEX idx_schools_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MIEMBROS DE ESCUELA ====================

CREATE TABLE IF NOT EXISTS school_members (
  id VARCHAR(36) PRIMARY KEY,
  school_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  school_member_role ENUM('OWNER', 'ADMIN', 'TEACHER') NOT NULL DEFAULT 'TEACHER',
  
  -- Permisos adicionales
  can_create_classes BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_students BOOLEAN NOT NULL DEFAULT TRUE,
  
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  INDEX idx_school_members_school (school_id),
  INDEX idx_school_members_user (user_id),
  UNIQUE KEY unique_school_member (school_id, user_id),
  
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== COMPORTAMIENTOS DE ESCUELA ====================

CREATE TABLE IF NOT EXISTS school_behaviors (
  id VARCHAR(36) PRIMARY KEY,
  school_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) NOT NULL DEFAULT '⭐',
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  xp_value INT NOT NULL DEFAULT 0,
  hp_value INT NOT NULL DEFAULT 0,
  gp_value INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  INDEX idx_school_behaviors_school (school_id),
  
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== INSIGNIAS DE ESCUELA ====================

CREATE TABLE IF NOT EXISTS school_badges (
  id VARCHAR(36) PRIMARY KEY,
  school_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  custom_image VARCHAR(500),
  school_badge_category ENUM('PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SPECIAL', 'CUSTOM') NOT NULL,
  school_badge_rarity ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL DEFAULT 'COMMON',
  xp_reward INT NOT NULL DEFAULT 0,
  gp_reward INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  INDEX idx_school_badges_school (school_id),
  
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MODIFICAR CLASSROOMS ====================

-- Agregar columna school_id a classrooms (nullable para B2C)
ALTER TABLE classrooms 
ADD COLUMN IF NOT EXISTS school_id VARCHAR(36) DEFAULT NULL AFTER teacher_id;

-- Agregar índice para school_id
CREATE INDEX IF NOT EXISTS idx_classrooms_school ON classrooms(school_id);

-- Agregar foreign key (opcional, comentar si causa problemas)
-- ALTER TABLE classrooms
-- ADD CONSTRAINT fk_classrooms_school 
-- FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- ==================== ACTUALIZAR ESTADÍSTICAS ====================

ANALYZE TABLE schools;
ANALYZE TABLE school_members;
ANALYZE TABLE school_behaviors;
ANALYZE TABLE school_badges;
ANALYZE TABLE classrooms;
