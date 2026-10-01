export type ClassroomSettingsSectionKey = 'general' | 'gamificacion' | 'riesgo';

export const DEFAULT_CLASSROOM_SETTINGS_SECTION: ClassroomSettingsSectionKey = 'general';

// Las claves de URL se mantienen (enlaces existentes); los nombres visibles son los nuevos.
export const CLASSROOM_SETTINGS_SECTIONS = [
  {
    key: 'general',
    label: 'Clase',
    description: 'Nombre, código para unirse y cómo se muestran los nombres',
  },
  {
    key: 'gamificacion',
    label: 'Reglas del juego',
    description: 'Puntos, avisos, clases de personaje, clanes y racha',
  },
  {
    key: 'riesgo',
    label: 'Archivar o eliminar',
    description: 'Archivar, borrar datos o eliminar la clase',
  },
] as const;

/** Secciones antiguas que ahora viven en otras vistas. */
export const LEGACY_SETTINGS_REDIRECTS: Record<string, (classroomId: string) => string> = {
  clase: (id) => `/classroom/${id}/gradebook?tab=competencias`,
  personas: (id) => `/classroom/${id}/students`,
};

export const isClassroomSettingsSection = (value: string | undefined | null): value is ClassroomSettingsSectionKey => {
  return CLASSROOM_SETTINGS_SECTIONS.some((section) => section.key === value);
};
