-- Registro de actividad: índices para el registro por cursor y el resumen del periodo.
-- Solo rendimiento: el código funciona sin ellos (más lento). Aditiva; en tablas grandes
-- CREATE INDEX tarda y en MariaDB/MySQL recientes no bloquea escrituras (ALGORITHM=INPLACE).
-- Resumen (SUM de XP por acción en un rango, sin reversiones): índice cubriente.
CREATE INDEX idx_point_logs_student_type_date ON point_logs (student_id, point_type, created_at, action, amount, is_reverted);
-- Orden por fecha dentro de cada fuente del registro.
CREATE INDEX idx_student_badges_student_unlocked ON student_badges (student_profile_id, unlocked_at);
CREATE INDEX idx_purchases_student_date ON purchases (student_id, purchased_at);
CREATE INDEX idx_item_usages_classroom_used ON item_usages (classroom_id, used_at);
CREATE INDEX idx_attendance_classroom_created ON attendance_records (classroom_id, created_at);
