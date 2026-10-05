-- Consola escolar, Entrega 1.6 (2026-10-05): traslados, retiros y reincorporaciones con baja blanda (el perfil queda
-- inactivo con su historial; antes retirar era borrar).
-- IMPORTANTE: aplicar ANTES del deploy. El código nuevo lee student_badges.origin_badge_id en cada consulta de insignias.

-- 1) Movimientos del estudiante: quién lo hizo, desde cuándo, el motivo (de una lista fija) y una nota que solo ve la
--    administración. Un traslado se puede deshacer mientras el estudiante no reciba puntos ni notas en su sección nueva.
CREATE TABLE IF NOT EXISTS school_student_moves (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  kind ENUM('TRANSFER', 'WITHDRAWAL', 'REINSTATEMENT') NOT NULL,
  from_section_id VARCHAR(36) NULL,
  to_section_id VARCHAR(36) NULL,
  reason VARCHAR(24) NOT NULL,
  note VARCHAR(255) NULL,
  effective_date DATE NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  undone_at DATETIME(3) NULL,
  undone_by VARCHAR(36) NULL,
  PRIMARY KEY (id),
  INDEX idx_school_student_moves_student (student_id, created_at),
  INDEX idx_school_student_moves_school (school_id, created_at)
);

-- 2) Perfiles de cada movimiento: los que dejó inactivos (origen) y adónde llegó su progreso (destino). Un origen de un
--    área sin destino espera la clase de esa área en la sección nueva («se aplica cuando se cree la clase»). Si el
--    destino era un perfil inactivo que volvió, snapshot guarda cómo estaba para poder deshacer.
CREATE TABLE IF NOT EXISTS school_move_profiles (
  id VARCHAR(36) NOT NULL,
  move_id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  area_id VARCHAR(36) NULL,
  source_profile_id VARCHAR(36) NULL,
  source_label VARCHAR(60) NULL,
  target_profile_id VARCHAR(36) NULL,
  target_reactivated TINYINT(1) NOT NULL DEFAULT 0,
  target_xp INT NULL,
  target_gp INT NULL,
  snapshot JSON NULL,
  applied_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_school_move_profiles_move (move_id),
  INDEX idx_school_move_profiles_pending (student_id, area_id, applied_at),
  INDEX idx_school_move_profiles_target (target_profile_id)
);

-- 3) Insignias que viajan con un traslado: la copia apunta a la insignia original (la primera de la cadena), para
--    mostrarla «traída de…» y no repetirla si el estudiante vuelve a una clase donde ya la tiene.
ALTER TABLE student_badges ADD COLUMN origin_badge_id VARCHAR(36) NULL;
