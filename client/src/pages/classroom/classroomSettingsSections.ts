export type ClassroomSettingsSectionKey = 'general' | 'gamificacion' | 'clase' | 'personas' | 'riesgo';

export const DEFAULT_CLASSROOM_SETTINGS_SECTION: ClassroomSettingsSectionKey = 'general';

export const CLASSROOM_SETTINGS_SECTIONS = [
  {
    key: 'general',
    label: 'General',
    title: 'Configuracion',
    description: 'Identidad y visualizacion del aula',
    showsSaveAction: true,
  },
  {
    key: 'gamificacion',
    label: 'Gamificacion',
    title: 'Configuracion de gamificacion',
    description: 'Motor de juego, puntos y recompensas',
    showsSaveAction: true,
  },
  {
    key: 'clase',
    label: 'Clase',
    title: 'Configuracion academica',
    description: 'Competencias, destrezas y notas',
    showsSaveAction: true,
  },
  {
    key: 'personas',
    label: 'Personas',
    title: 'Gestion de personas',
    description: 'Estudiantes, vinculos y material para familias',
    showsSaveAction: false,
  },
  {
    key: 'riesgo',
    label: 'Riesgo',
    title: 'Zona de riesgo',
    description: 'Acciones irreversibles o delicadas',
    showsSaveAction: false,
  },
] as const;

export const isClassroomSettingsSection = (value: string | undefined | null): value is ClassroomSettingsSectionKey => {
  return CLASSROOM_SETTINGS_SECTIONS.some((section) => section.key === value);
};
