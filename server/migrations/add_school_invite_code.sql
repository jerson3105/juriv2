-- Escuelas: código de invitación para que los profesores se unan con un enlace (el responsable lo genera o lo desactiva).
-- Aditiva y segura: columna nueva, nula por defecto. Aplicar ANTES de desplegar el código que la usa.
ALTER TABLE schools ADD COLUMN invite_code VARCHAR(16) NULL AFTER logo_url;
ALTER TABLE schools ADD UNIQUE INDEX uniq_schools_invite_code (invite_code);
