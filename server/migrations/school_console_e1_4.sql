-- Consola escolar, Entrega 1.4 (2026-10-04): importar el padrón desde Excel (plantilla de Juried o nómina del SIAGIE).
-- Las filas del archivo y sus correcciones se guardan cifradas (AES-256-GCM, contexto school_import:<id>) y se borran a
-- las 24 horas. result guarda solo ids y los campos que se completaron, para poder deshacer. Ningún documento en claro.
CREATE TABLE IF NOT EXISTS school_import_batches (
  id VARCHAR(36) NOT NULL,
  school_id VARCHAR(36) NOT NULL,
  year_id VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  status ENUM('REVIEW', 'CONFIRMED', 'UNDONE') NOT NULL DEFAULT 'REVIEW',
  source VARCHAR(10) NOT NULL,
  row_count INT NOT NULL,
  mapping JSON NOT NULL,
  rows_encrypted MEDIUMTEXT NULL,
  fixes_encrypted MEDIUMTEXT NULL,
  revision INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  result JSON NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  confirmed_at DATETIME(3) NULL,
  undone_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_school_import_batches_school_year (school_id, year_id, created_at),
  INDEX idx_school_import_batches_expires (expires_at)
);
