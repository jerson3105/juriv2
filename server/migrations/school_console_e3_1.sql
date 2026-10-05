-- Consola escolar, Entrega 3.1 (2026-10-05): datos del colegio para la libreta («Informe de progreso del aprendizaje»).
-- Aplicar ANTES del deploy: la página «Libretas» y su PDF leen esta tabla. Idempotente (CREATE TABLE IF NOT EXISTS).
-- El logo del colegio usa la columna que ya existía (schools.logo_url).

-- Cabecera de la libreta: DRE, UGEL, director(a) y el código modular de cada nivel (en el Perú cada nivel tiene el suyo;
-- sin código propio, el del colegio). Los edita la administración del colegio en la consola.
CREATE TABLE IF NOT EXISTS school_report_settings (
  school_id VARCHAR(36) NOT NULL,
  dre VARCHAR(120) NULL,
  ugel VARCHAR(120) NULL,
  director_name VARCHAR(150) NULL,
  inicial_code VARCHAR(10) NULL,
  primaria_code VARCHAR(10) NULL,
  secundaria_code VARCHAR(10) NULL,
  updated_by VARCHAR(36) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (school_id)
);
