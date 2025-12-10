-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE RENDIMIENTO - Juried
-- Base de datos: juried_db (MySQL con Drizzle ORM)
-- Ejecutar: mysql -u root juried_db < add_indexes.sql
-- =====================================================

-- ==================== USUARIOS Y AUTH ====================

-- Índices para classrooms
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher 
  ON classrooms(teacher_id);
-- code ya tiene UNIQUE constraint

-- Índices para refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires 
  ON refresh_tokens(expires_at);

-- ==================== ESTUDIANTES ====================

-- Índices para student_profiles
CREATE INDEX IF NOT EXISTS idx_student_profiles_classroom 
  ON student_profiles(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_user 
  ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_team 
  ON student_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_active 
  ON student_profiles(is_active);

-- Índices para login_streaks
CREATE INDEX IF NOT EXISTS idx_login_streaks_student 
  ON login_streaks(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_login_streaks_classroom 
  ON login_streaks(classroom_id);

-- ==================== EQUIPOS/CLANES ====================

-- Índices para teams
CREATE INDEX IF NOT EXISTS idx_teams_classroom 
  ON teams(classroom_id);

-- Índices para clan_logs
CREATE INDEX IF NOT EXISTS idx_clan_logs_clan 
  ON clan_logs(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_logs_student 
  ON clan_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_clan_logs_created 
  ON clan_logs(created_at);

-- ==================== COMPORTAMIENTOS Y PUNTOS ====================

-- Índices para behaviors
CREATE INDEX IF NOT EXISTS idx_behaviors_classroom 
  ON behaviors(classroom_id);
CREATE INDEX IF NOT EXISTS idx_behaviors_classroom_active 
  ON behaviors(classroom_id, is_active);

-- Índices para point_logs (consultas frecuentes de historial)
CREATE INDEX IF NOT EXISTS idx_point_logs_student 
  ON point_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_student_date 
  ON point_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_logs_behavior 
  ON point_logs(behavior_id);

-- ==================== PODERES ====================

-- Índices para powers
CREATE INDEX IF NOT EXISTS idx_powers_classroom 
  ON powers(classroom_id);

-- Índices para power_usages
CREATE INDEX IF NOT EXISTS idx_power_usages_power 
  ON power_usages(power_id);
CREATE INDEX IF NOT EXISTS idx_power_usages_student 
  ON power_usages(student_id);

-- ==================== BOSS BATTLES (Profesor) ====================

-- Índices para boss_battles
CREATE INDEX IF NOT EXISTS idx_boss_battles_classroom 
  ON boss_battles(classroom_id);
CREATE INDEX IF NOT EXISTS idx_boss_battles_classroom_status 
  ON boss_battles(classroom_id, status);

-- Índices para battle_questions
CREATE INDEX IF NOT EXISTS idx_battle_questions_battle 
  ON battle_questions(battle_id);

-- Índices para battle_participants
CREATE INDEX IF NOT EXISTS idx_battle_participants_battle 
  ON battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_student 
  ON battle_participants(student_id);

-- Índices para battle_answers
CREATE INDEX IF NOT EXISTS idx_battle_answers_battle 
  ON battle_answers(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_answers_question 
  ON battle_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_battle_answers_participant 
  ON battle_answers(participant_id);

-- Índices para battle_results
CREATE INDEX IF NOT EXISTS idx_battle_results_battle 
  ON battle_results(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_results_student 
  ON battle_results(student_id);

-- ==================== STUDENT BOSS BATTLES ====================

-- Índices para student_boss_battles
CREATE INDEX IF NOT EXISTS idx_student_boss_battles_classroom 
  ON student_boss_battles(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_boss_battles_status 
  ON student_boss_battles(status);
CREATE INDEX IF NOT EXISTS idx_student_boss_battles_question_bank 
  ON student_boss_battles(question_bank_id);

-- Índices para student_boss_battle_participants
CREATE INDEX IF NOT EXISTS idx_sbb_participants_battle 
  ON student_boss_battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS idx_sbb_participants_student 
  ON student_boss_battle_participants(student_profile_id);

-- Índices para student_boss_battle_attempts
CREATE INDEX IF NOT EXISTS idx_sbb_attempts_participant 
  ON student_boss_battle_attempts(participant_id);

-- ==================== EVENTOS ALEATORIOS ====================

-- Índices para random_events
CREATE INDEX IF NOT EXISTS idx_random_events_classroom 
  ON random_events(classroom_id);
CREATE INDEX IF NOT EXISTS idx_random_events_classroom_active 
  ON random_events(classroom_id, is_active);

-- Índices para event_logs
CREATE INDEX IF NOT EXISTS idx_event_logs_event 
  ON event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_classroom 
  ON event_logs(classroom_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_triggered 
  ON event_logs(triggered_at);

-- ==================== TIENDA ====================

-- Índices para shop_items
CREATE INDEX IF NOT EXISTS idx_shop_items_classroom 
  ON shop_items(classroom_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_classroom_active 
  ON shop_items(classroom_id, is_active);

-- Índices para purchases
CREATE INDEX IF NOT EXISTS idx_purchases_student 
  ON purchases(student_id);
CREATE INDEX IF NOT EXISTS idx_purchases_item 
  ON purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer 
  ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status 
  ON purchases(purchase_status);

-- Índices para item_usages
CREATE INDEX IF NOT EXISTS idx_item_usages_purchase 
  ON item_usages(purchase_id);
CREATE INDEX IF NOT EXISTS idx_item_usages_student 
  ON item_usages(student_id);
CREATE INDEX IF NOT EXISTS idx_item_usages_classroom 
  ON item_usages(classroom_id);
CREATE INDEX IF NOT EXISTS idx_item_usages_status 
  ON item_usages(status);

-- ==================== NOTIFICACIONES ====================

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user 
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_date 
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_classroom 
  ON notifications(classroom_id);

-- ==================== AVATARES ====================

-- Índices para avatar_items
CREATE INDEX IF NOT EXISTS idx_avatar_items_gender 
  ON avatar_items(avatar_gender);
CREATE INDEX IF NOT EXISTS idx_avatar_items_slot 
  ON avatar_items(avatar_slot);
CREATE INDEX IF NOT EXISTS idx_avatar_items_active 
  ON avatar_items(is_active);

-- Índices para classroom_avatar_items
CREATE INDEX IF NOT EXISTS idx_classroom_avatar_items_classroom 
  ON classroom_avatar_items(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_avatar_items_item 
  ON classroom_avatar_items(avatar_item_id);

-- Índices para student_avatar_purchases
CREATE INDEX IF NOT EXISTS idx_student_avatar_purchases_student 
  ON student_avatar_purchases(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_avatar_purchases_item 
  ON student_avatar_purchases(avatar_item_id);

-- Índices para student_equipped_items
CREATE INDEX IF NOT EXISTS idx_student_equipped_items_student 
  ON student_equipped_items(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_equipped_items_item 
  ON student_equipped_items(avatar_item_id);

-- ==================== ASISTENCIAS ====================

-- Índices para attendance_records
CREATE INDEX IF NOT EXISTS idx_attendance_classroom 
  ON attendance_records(classroom_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student 
  ON attendance_records(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date 
  ON attendance_records(classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date 
  ON attendance_records(date);

-- ==================== INSIGNIAS ====================

-- Índices para badges
CREATE INDEX IF NOT EXISTS idx_badges_classroom 
  ON badges(classroom_id);
CREATE INDEX IF NOT EXISTS idx_badges_scope 
  ON badges(badge_scope);
CREATE INDEX IF NOT EXISTS idx_badges_active 
  ON badges(is_active);

-- Índices para student_badges
CREATE INDEX IF NOT EXISTS idx_student_badges_student 
  ON student_badges(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_badge 
  ON student_badges(badge_id);

-- Índices para badge_progress
CREATE INDEX IF NOT EXISTS idx_badge_progress_student 
  ON badge_progress(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_badge_progress_badge 
  ON badge_progress(badge_id);

-- ==================== BANCO DE PREGUNTAS ====================

-- Índices para question_banks
CREATE INDEX IF NOT EXISTS idx_question_banks_classroom 
  ON question_banks(classroom_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_active 
  ON question_banks(is_active);

-- Índices para questions
CREATE INDEX IF NOT EXISTS idx_questions_bank 
  ON questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_type 
  ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty 
  ON questions(difficulty);

-- ==================== ACTIVIDADES DE TIEMPO ====================

-- Índices para timed_activities
CREATE INDEX IF NOT EXISTS idx_timed_activities_classroom 
  ON timed_activities(classroom_id);
CREATE INDEX IF NOT EXISTS idx_timed_activities_status 
  ON timed_activities(timed_activity_status);

-- Índices para timed_activity_results
CREATE INDEX IF NOT EXISTS idx_timed_activity_results_activity 
  ON timed_activity_results(activity_id);
CREATE INDEX IF NOT EXISTS idx_timed_activity_results_student 
  ON timed_activity_results(student_profile_id);

-- ==================== MISIONES ====================

-- Índices para missions
CREATE INDEX IF NOT EXISTS idx_missions_classroom 
  ON missions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_missions_type 
  ON missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_missions_active 
  ON missions(is_active);

-- Índices para student_missions
CREATE INDEX IF NOT EXISTS idx_student_missions_student 
  ON student_missions(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_missions_mission 
  ON student_missions(mission_id);
CREATE INDEX IF NOT EXISTS idx_student_missions_status 
  ON student_missions(mission_status);

-- Índices para student_streaks
CREATE INDEX IF NOT EXISTS idx_student_streaks_student 
  ON student_streaks(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_streaks_classroom 
  ON student_streaks(classroom_id);

-- ==================== ACTUALIZAR ESTADÍSTICAS ====================

ANALYZE TABLE users;
ANALYZE TABLE classrooms;
ANALYZE TABLE student_profiles;
ANALYZE TABLE teams;
ANALYZE TABLE behaviors;
ANALYZE TABLE point_logs;
ANALYZE TABLE notifications;
ANALYZE TABLE attendance_records;
ANALYZE TABLE badges;
ANALYZE TABLE student_badges;
ANALYZE TABLE purchases;
ANALYZE TABLE shop_items;
ANALYZE TABLE boss_battles;
ANALYZE TABLE battle_participants;
ANALYZE TABLE student_boss_battles;
ANALYZE TABLE student_boss_battle_participants;
ANALYZE TABLE missions;
ANALYZE TABLE student_missions;
ANALYZE TABLE timed_activities;
ANALYZE TABLE question_banks;
ANALYZE TABLE questions;
