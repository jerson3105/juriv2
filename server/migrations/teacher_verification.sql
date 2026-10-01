-- Verificación de docentes, último ingreso, dominios institucionales, caducidad de la invitación
-- de escuela y un perfil por alumno en cada clase. Aditiva. Ejecutar ANTES de desplegar el código.

-- Estado del docente: el rol ya no basta, porque cualquiera podía registrarse como docente.
ALTER TABLE users
  ADD COLUMN teacher_status ENUM('UNVERIFIED','PENDING','VERIFIED') NULL AFTER role,
  ADD COLUMN teacher_verified_via ENUM('LEGACY','ADMIN','SCHOOL','DOMAIN') NULL AFTER teacher_status,
  ADD COLUMN teacher_verified_at DATETIME NULL AFTER teacher_verified_via,
  ADD COLUMN teacher_verification_note VARCHAR(500) NULL AFTER teacher_verified_at,
  ADD COLUMN teacher_verification_requested_at DATETIME NULL AFTER teacher_verification_note,
  ADD COLUMN last_login_at DATETIME NULL AFTER updated_at;

-- Docentes con clases o en una escuela: verificados por antigüedad. Sin clases: sin verificar.
UPDATE users u
SET u.teacher_status = 'VERIFIED', u.teacher_verified_via = 'LEGACY', u.teacher_verified_at = NOW()
WHERE u.role = 'TEACHER'
  AND (EXISTS (SELECT 1 FROM classrooms c WHERE c.teacher_id = u.id)
       OR EXISTS (SELECT 1 FROM school_members m WHERE m.user_id = u.id AND m.school_member_status = 'VERIFIED')
       OR EXISTS (SELECT 1 FROM schools s WHERE s.created_by = u.id));
UPDATE users SET teacher_status = 'UNVERIFIED' WHERE role = 'TEACHER' AND teacher_status IS NULL;

-- El reloj de 180 días sin uso empieza hoy (no se conoce el último ingreso anterior).
UPDATE users SET last_login_at = NOW() WHERE last_login_at IS NULL;

-- Dominios institucionales: un docente con ese correo queda verificado al registrarse.
CREATE TABLE IF NOT EXISTS verified_domains (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  school_id VARCHAR(36) NULL,
  note VARCHAR(255) NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uniq_verified_domains_domain (domain)
);

-- La invitación de escuela caduca (antes servía para siempre y daba estado verificado).
ALTER TABLE schools ADD COLUMN invite_expires_at DATETIME NULL AFTER invite_code;
UPDATE schools SET invite_expires_at = DATE_ADD(NOW(), INTERVAL 14 DAY) WHERE invite_code IS NOT NULL;

-- Un perfil por alumno en cada clase (varios NULL permitidos: los alumnos sin cuenta no chocan).
ALTER TABLE student_profiles ADD UNIQUE INDEX uniq_student_profiles_classroom_user (classroom_id, user_id);
