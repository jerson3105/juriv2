-- Inicio del alumno: "Lo nuevo desde tu última visita" lleva su propio corte, independiente del de
-- las celebraciones (que avanza al cerrar la celebración aunque el alumno no haya visto "Lo nuevo").
-- Aditiva. Ejecutar ANTES de desplegar el código: Drizzle pide todas las columnas del perfil.
-- NULL = aún no lo vio (la primera visita muestra "Lo que ya ganaste en esta clase").
ALTER TABLE student_profiles ADD COLUMN home_seen_at DATETIME NULL AFTER celebrated_at;
