-- Sesiones: el refresh viaja en una cookie httpOnly y cada sesión se puede revocar al instante
-- (también sus sockets). Aditiva. Ejecutar ANTES de desplegar el código.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  -- 0 = cookie de sesión (se borra al cerrar el navegador): alumnos en equipos compartidos.
  persistent TINYINT(1) NOT NULL DEFAULT 1,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  -- Vida máxima de la sesión (alumnos 8 h, el resto 30 días), sin importar cuánto se renueve.
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expires (expires_at)
);

-- Cada refresh pertenece a una sesión; al rotar se marca usado (no se borra) para detectar reusos.
ALTER TABLE refresh_tokens
  ADD COLUMN session_id VARCHAR(36) NULL AFTER user_id,
  ADD COLUMN used_at DATETIME NULL AFTER expires_at,
  ADD KEY idx_refresh_tokens_session (session_id);
