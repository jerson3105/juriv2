-- Banco de preguntas v2: dificultad opcional ("sin definir" por defecto) y revisión de lo que genera la IA.
-- Aditiva/compatible. Ejecutar ANTES de desplegar el código.

-- Dificultad opcional: lo nuevo nace "sin definir" (la IA la sugiere). Lo existente se conserva.
ALTER TABLE questions MODIFY difficulty ENUM('EASY','MEDIUM','HARD') NULL DEFAULT NULL;

-- Lo que genera la IA queda "por revisar" (reviewed_at NULL) hasta que el docente lo aprueba o lo edita.
ALTER TABLE questions ADD COLUMN ai_generated TINYINT(1) NOT NULL DEFAULT 0 AFTER explanation;
ALTER TABLE questions ADD COLUMN reviewed_at DATETIME NULL AFTER ai_generated;

-- Lo existente cuenta como revisado (no se sabe qué vino de la IA).
UPDATE questions SET reviewed_at = created_at WHERE reviewed_at IS NULL;
