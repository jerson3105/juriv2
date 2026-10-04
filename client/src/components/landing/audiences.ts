// Contenido de las pestañas «Para quién» de la landing. Solo funciones que existen hoy (sin precios ni cifras).

export type AudienceId = 'docentes' | 'estudiantes' | 'directivos';

export interface Audience {
  id: AudienceId;
  label: string;
  title: string;
  points: string[];
  cta: { label: string; to: string };
  /** Aclaración bajo el botón. */
  note?: string;
  /** Un solo Jiro por panel, en una pose propia de ese público. */
  art: { src: string; width: number; height: number };
}

export const AUDIENCES: Audience[] = [
  {
    id: 'docentes',
    label: 'Docentes',
    title: 'Motiva a tu clase sin complicarte',
    points: [
      'Reconoce al momento lo que tu clase hace bien y lo que debe mejorar.',
      'Empieza rápido: Jiro te propone comportamientos, insignias, premios y una historia. Tú decides qué queda.',
      'Pasa lista, califica por competencias y revisa estadísticas en el mismo lugar.',
    ],
    cta: { label: 'Crear mi cuenta de docente', to: '/registro/docente' },
    art: { src: '/assets/jiro/senalando.webp', width: 600, height: 900 },
  },
  {
    id: 'estudiantes',
    label: 'Estudiantes',
    title: 'Tu personaje avanza contigo',
    points: [
      'Elige tu personaje (Guardián, Arcano, Explorador o Alquimista) y vístelo con el oro que ganas.',
      'Gana insignias, completa tus álbumes de figuritas y viaja en expediciones con tu clase.',
      'Entras con el código de tu clase, tu nombre y un PIN. Sin correo.',
    ],
    cta: { label: 'Entrar con mi código', to: '/unirse' },
    art: { src: '/assets/jiro/acceso/alumno.webp', width: 479, height: 600 },
  },
  {
    id: 'directivos',
    label: 'Directivos',
    title: 'Tu colegio, aula por aula',
    points: [
      'Crea tu escuela en «Mi Escuela» e invita a tus docentes con un enlace o un código.',
      'Mira la asistencia por clase, el clima de la escuela y quiénes necesitan acompañamiento a tiempo.',
      'Comparte con tu equipo una biblioteca de comportamientos e insignias.',
    ],
    cta: { label: 'Registrar mi escuela', to: '/registro/docente' },
    note: 'Se hace con una cuenta de docente: después creas la escuela en «Mi Escuela» y Juried la verifica.',
    art: { src: '/assets/jiro/acceso/google.webp', width: 423, height: 600 },
  },
];
