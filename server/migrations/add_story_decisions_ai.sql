-- Historia de clase (fase 2b): votación de la clase e IA coautora.
-- stories.ai_bible: "biblia" de la historia (personajes, tono, reglas) que la IA usa como memoria.
-- story_scenes.decision: escena de decisión (pregunta, opciones con su desenlace, estado y opción ganadora).
-- story_votes: un voto por alumno y escena (se puede cambiar hasta que el profesor cierra la votación).
-- Aditiva y segura. Aplicar ANTES de desplegar el código que la usa.
ALTER TABLE stories ADD COLUMN ai_bible TEXT NULL AFTER description;
ALTER TABLE story_scenes ADD COLUMN decision JSON NULL AFTER trigger_config;
CREATE TABLE story_votes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  scene_id VARCHAR(36) NOT NULL,
  option_id VARCHAR(36) NOT NULL,
  student_profile_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_story_votes_scene_student (scene_id, student_profile_id),
  KEY idx_story_votes_scene (scene_id)
);
