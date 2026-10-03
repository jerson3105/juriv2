-- Sala de familias (2026-10-03): avisos y conversación en una sola tabla, orden exacto y lectura por cursor.
-- Ejecutar ANTES de desplegar el código que lo usa.

-- 1) Un aviso es un mensaje destacado del docente. created_at con milisegundos: los mensajes del mismo
--    segundo salían desordenados y el cursor de páginas saltaba los que compartían segundo.
ALTER TABLE classroom_messages
  ADD COLUMN kind ENUM('MESSAGE','ANNOUNCEMENT') NOT NULL DEFAULT 'MESSAGE' AFTER sender_role,
  MODIFY created_at DATETIME(3) NOT NULL;

-- 2) Los avisos existentes pasan a la sala (en producción no hay ninguno).
INSERT INTO classroom_messages (id, classroom_id, sender_id, sender_role, kind, message, created_at)
  SELECT a.id, a.classroom_id, a.teacher_id, 'TEACHER', 'ANNOUNCEMENT', a.message, a.created_at
  FROM announcements a
  WHERE NOT EXISTS (SELECT 1 FROM classroom_messages m WHERE m.id = a.id);

-- 3) Lectura por cursor: una fila por persona y clase («visto» = abrió la sala después del aviso).
CREATE TABLE IF NOT EXISTS classroom_room_reads (
  classroom_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  last_read_at DATETIME(3) NOT NULL,
  PRIMARY KEY (classroom_id, user_id)
);

-- 4) La conversación entre familias empieza cerrada (sin fila = cerrada; el docente la abre).
ALTER TABLE classroom_chat_settings MODIFY is_open TINYINT(1) NOT NULL DEFAULT 0;

-- announcements y announcement_reads quedan sin uso; se borrarán en una migración posterior.
