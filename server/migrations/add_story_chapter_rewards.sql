-- Historia de clase (fase 2a): recompensa al revelar el final del capítulo.
-- reward_config: lo que el profesor configura (insignia, XP, oro, cromo y premio al clan que más aportó).
-- reward_result: lo que realmente se entregó al revelar (para el cierre celebrado y la auditoría).
-- Aditiva y segura: columnas nuevas, nulas por defecto. Aplicar ANTES de desplegar el código que las usa.
ALTER TABLE story_chapters ADD COLUMN reward_config JSON NULL AFTER completion_config;
ALTER TABLE story_chapters ADD COLUMN reward_result JSON NULL AFTER reward_config;
