-- Bloqueo escalonado del PIN (2026-10-04).
-- Cuántos bloqueos lleva el alumno sin entrar bien: el 1.º dura 15 minutos, el 2.º una hora y el 3.º deja el acceso
-- bloqueado hasta que el docente lo restablezca. Entrar bien o «Restablecer acceso» lo vuelve a 0.
ALTER TABLE users
  ADD COLUMN pin_lock_level TINYINT NOT NULL DEFAULT 0 AFTER pin_locked_until;
