-- Historia de clase: meta relativa desde la activación del capítulo y "listo para revelar".
-- progress_baseline: XP total de la clase cuando el capítulo se activó (NULL = capítulos antiguos, cuentan desde 0 como antes).
-- activated_at: cuándo empezó el capítulo (cierre: XP ganado y días de duración).
-- goal_reached_at: la meta se alcanzó; el capítulo espera a que el profesor revele el final en clase.
-- Aditiva y segura: columnas nuevas, nulas por defecto. Aplicar ANTES de desplegar el código que las usa.
ALTER TABLE story_chapters ADD COLUMN progress_baseline DECIMAL(12,2) NULL AFTER current_progress;
ALTER TABLE story_chapters ADD COLUMN activated_at DATETIME NULL AFTER progress_baseline;
ALTER TABLE story_chapters ADD COLUMN goal_reached_at DATETIME NULL AFTER activated_at;
