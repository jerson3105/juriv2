-- Dominios verificados con alcance (2026-10-04).
-- Solo un dominio exclusivo de docentes verifica por sí solo al docente que entra con Google. Si el colegio da el
-- mismo dominio a sus alumnos (SHARED), un alumno con su correo institucional podría entrar por la puerta docente y
-- quedar verificado: por eso SHARED no verifica a nadie y es el valor por defecto.
ALTER TABLE verified_domains
  ADD COLUMN scope ENUM('TEACHERS_ONLY', 'SHARED') NOT NULL DEFAULT 'SHARED' AFTER domain;
