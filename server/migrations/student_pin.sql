-- Alumnos sin correo: entran con el código de su clase, su nombre de la lista y un PIN de 4 números
-- que crean ellos mismos. El PIN es de la cuenta (sirve en todas sus clases). Aditiva.
-- Ejecutar ANTES de desplegar el código.

-- 'PIN' = cuenta sin correo (el correo guardado es interno y nunca se muestra).
ALTER TABLE users
  MODIFY provider ENUM('LOCAL', 'GOOGLE', 'PIN') NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN pin_hash VARCHAR(100) NULL,
  -- 5 intentos fallidos bloquean el PIN 15 minutos (el docente puede restablecerlo).
  ADD COLUMN pin_failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_until DATETIME NULL;
