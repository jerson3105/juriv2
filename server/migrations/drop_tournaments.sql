-- Observatorio de Jiro · bloque 5: Torneos fuera (interfaz y rutas ya se quitaron en el bloque 1).
-- Prod al 2026-10-01: 4 torneos, 30 participaciones, 0 vinculados a competencias → no cambia ninguna nota.
-- El código ya no lee estas tablas. IRREVERSIBLE: respaldar antes (mysqldump --single-transaction).
-- Los valores 'TOURNAMENT' de los enums activity_type / score_activity_type se dejan (cambiar enums es riesgoso).

DELETE FROM activity_competencies WHERE activity_type = 'TOURNAMENT';
DELETE FROM student_activity_scores WHERE activity_type = 'TOURNAMENT';

DROP TABLE IF EXISTS tournament_answers;
DROP TABLE IF EXISTS tournament_matches;
DROP TABLE IF EXISTS tournament_participants;
DROP TABLE IF EXISTS tournaments;
