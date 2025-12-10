-- =====================================================
-- CREAR USUARIO ADMINISTRADOR DE JURIED
-- Base de datos: juried_db
-- Ejecutar: mysql -u root juried_db < create_admin_user.sql
-- =====================================================

-- Contraseña: Admin123! (hasheada con bcrypt)
-- IMPORTANTE: Cambiar la contraseña después del primer login

-- Primero, actualizar si ya existe
UPDATE users 
SET password = '$2a$10$.gtZMRgxCMY.DQnFcGJfyOTJCwN6JBPaH1iDE6T32Jm5f2acJgAEK',
    role = 'ADMIN',
    updated_at = NOW()
WHERE email = 'admin@juried.com';

-- Si no existe, insertar
INSERT INTO users (
  id,
  email,
  password,
  first_name,
  last_name,
  role,
  provider,
  is_active,
  notify_badges,
  notify_level_up,
  created_at,
  updated_at
) 
SELECT 
  UUID(),
  'admin@juried.com',
  '$2a$10$.gtZMRgxCMY.DQnFcGJfyOTJCwN6JBPaH1iDE6T32Jm5f2acJgAEK',
  'Admin',
  'Juried',
  'ADMIN',
  'LOCAL',
  TRUE,
  TRUE,
  TRUE,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@juried.com');

-- Verificar que se creó
SELECT id, email, first_name, last_name, role FROM users WHERE email = 'admin@juried.com';
