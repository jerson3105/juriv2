-- Tienda del alumno (2026-10-01): meta de ahorro, canje con el oro del alumno, regalo anónimo y
-- «tu oro solo baja cuando tú lo gastas». Ejecutar ANTES de desplegar el código (Drizzle pide todas
-- las columnas). Las tres primeras sentencias son aditivas; la última cambia datos de configuración.

-- Premio que el alumno eligió como su meta (null = sin meta). Si el premio se borra o se agota, el
-- cliente lo trata como "tu meta ya no está".
ALTER TABLE student_profiles ADD COLUMN shop_goal_item_id VARCHAR(36) NULL AFTER home_seen_at;
CREATE INDEX idx_student_profiles_shop_goal ON student_profiles (shop_goal_item_id);

-- REDEEM = el docente canjea un premio con el oro del alumno (clases sin cuentas, pequeños).
ALTER TABLE purchases MODIFY COLUMN purchase_type ENUM('SELF', 'GIFT', 'TEACHER', 'REWARD', 'REDEEM') NOT NULL DEFAULT 'SELF';

-- Regalo anónimo: quien recibe ve "un compañero o compañera"; el docente siempre ve quién fue.
ALTER TABLE purchases ADD COLUMN gift_anonymous TINYINT(1) NOT NULL DEFAULT 0 AFTER gift_message;

-- Los comportamientos negativos ya no multan oro (el oro solo baja cuando el alumno lo gasta).
-- Los de la biblioteca de la escuela siempre son positivos (school_behaviors no tiene is_positive).
UPDATE behaviors SET gp_value = 0 WHERE is_positive = 0 AND gp_value > 0;
