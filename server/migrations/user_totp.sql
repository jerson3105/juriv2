-- Verificación en dos pasos de las cuentas de administración (2026-10-04).
-- Código de 6 números (TOTP) con la clave cifrada (utils/piiCrypto). Se activa solo desde el servidor
-- (dist/scripts/adminTotp.js), nunca desde la web. Sin fila = la cuenta entra solo con contraseña.
-- Aplicar ANTES del deploy: el login de administración consulta esta tabla.
CREATE TABLE IF NOT EXISTS user_totp (
  user_id VARCHAR(36) NOT NULL,
  secret_encrypted VARCHAR(255) NOT NULL,
  enabled_at DATETIME(3) NOT NULL,
  last_step INT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  lock_level TINYINT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  PRIMARY KEY (user_id)
);
