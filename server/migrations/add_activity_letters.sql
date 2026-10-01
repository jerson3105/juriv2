-- Observatorio de Jiro · Correo Estelar: cartas a la "estrella secreta" (modo dispositivo).
-- Privadas y sin autor para quien las recibe; pasan por moderación del docente.
-- Aditiva. Ejecutar ANTES de desplegar el código.
CREATE TABLE activity_letters (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  classroom_id VARCHAR(36) NOT NULL,
  writer_id VARCHAR(36) NOT NULL,
  recipient_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  -- PENDING | APPROVED | REJECTED
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  -- Una carta por alumno y partida (doble envío = 409).
  UNIQUE KEY uq_activity_letters_writer (session_id, writer_id),
  INDEX idx_activity_letters_recipient (recipient_id, status, created_at),
  INDEX idx_activity_letters_session (session_id, status)
);
