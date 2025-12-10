-- ═══════════════════════════════════════════════════════════════
-- JURIED - Índices de Base de Datos para Producción
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar antes de ir a producción para optimizar consultas

-- Índices para student_profiles (tabla más consultada)
CREATE INDEX IF NOT EXISTS idx_student_profiles_classroom 
  ON student_profiles(classroom_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user 
  ON student_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_team 
  ON student_profiles(team_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_active 
  ON student_profiles(classroom_id, is_active);

-- Índices para point_logs (historial de puntos)
CREATE INDEX IF NOT EXISTS idx_point_logs_student 
  ON point_logs(student_id);

CREATE INDEX IF NOT EXISTS idx_point_logs_date 
  ON point_logs(created_at);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user 
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_date 
  ON notifications(created_at);

-- Índices para clan_logs
CREATE INDEX IF NOT EXISTS idx_clan_logs_clan 
  ON clan_logs(clan_id);

CREATE INDEX IF NOT EXISTS idx_clan_logs_student 
  ON clan_logs(student_id);

-- Índices para battle_participants
CREATE INDEX IF NOT EXISTS idx_battle_participants_battle 
  ON battle_participants(battle_id);

CREATE INDEX IF NOT EXISTS idx_battle_participants_student 
  ON battle_participants(student_id);

-- Índices para battle_questions
CREATE INDEX IF NOT EXISTS idx_battle_questions_battle 
  ON battle_questions(battle_id);

-- Índices para student_badges
CREATE INDEX IF NOT EXISTS idx_student_badges_student 
  ON student_badges(student_profile_id);

CREATE INDEX IF NOT EXISTS idx_student_badges_badge 
  ON student_badges(badge_id);

-- Índices para behaviors
CREATE INDEX IF NOT EXISTS idx_behaviors_classroom 
  ON behaviors(classroom_id);

-- Índices para refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
  ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires 
  ON refresh_tokens(expires_at);

-- Índices para purchases
CREATE INDEX IF NOT EXISTS idx_purchases_student 
  ON purchases(student_id);

-- Índices para teams (clanes)
CREATE INDEX IF NOT EXISTS idx_teams_classroom 
  ON teams(classroom_id);

-- Verificar índices creados
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME;
