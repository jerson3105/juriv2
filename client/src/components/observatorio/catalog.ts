import type { ActivityOverview, ActivitySession, ActivityType } from '../../lib/activityApi';
import type { TutorialId } from '../tutorials/TutorialModal';
import type { JiroPose } from './jiroPoses';

export type ObservatorioActivityId = 'descanso' | 'estrellas' | 'conquista' | 'correo' | 'error' | 'bingo' | 'pergaminos' | 'expediciones';

export interface CatalogEntry {
  id: ObservatorioActivityId;
  name: string;
  description: string;
  pose: JiroPose;
  /** Portada 4:3 de la tarjeta (ilustración de la actividad). Sin portada, la tarjeta muestra la pose sobre el cielo. */
  cover?: string;
  /** Duración típica en clase. */
  duration: string;
  requirements: { icon: string; label: string }[];
  /** Tipo de partida en el servidor (las actividades que guardan sesión). */
  sessionType?: ActivityType;
  /** Solo se muestra si la clase tiene el mural de Pergaminos activado. */
  onlyWithScrolls?: boolean;
  /** Tutorial para estudiantes («Cómo se juega»), si la actividad ya tiene uno. */
  tutorial?: TutorialId;
}

// Catálogo del Observatorio. Sin etiquetas de "Popular/Nuevo": la tarjeta dice duración,
// requisitos y cuándo se jugó por última vez.
export const CATALOG: CatalogEntry[] = [
  {
    id: 'descanso',
    name: 'Descanso de Jiro',
    description: 'Mientras hay calma, Jiro sueña y dibuja una constelación. El ruido solo pausa.',
    pose: 'dormido',
    cover: '/assets/jiro/actividades/descanso.webp',
    duration: '3–10 min',
    requirements: [{ icon: '🎤', label: 'Micrófono o manual' }],
    sessionType: 'DESCANSO',
    tutorial: 'descanso',
  },
  {
    id: 'estrellas',
    name: 'Estrellas en Movimiento',
    description: 'Verdadero o falso con el cuerpo: de pie o agachados. Las rachas encienden estrellas.',
    pose: 'emocionado',
    cover: '/assets/jiro/actividades/estrellas.webp',
    duration: '10–15 min',
    requirements: [{ icon: '📚', label: 'Banco, IA o modo libre' }],
    sessionType: 'ESTRELLAS',
    tutorial: 'estrellas',
  },
  {
    id: 'conquista',
    name: 'Conquista del Cielo',
    description: 'Todos los equipos responden a la vez para despejar la Niebla. Se guarda para seguir otro día.',
    pose: 'senalando',
    cover: '/assets/jiro/actividades/conquista.webp',
    duration: '15–30 min',
    requirements: [{ icon: '🛡️', label: 'Clanes o equipos' }, { icon: '📚', label: 'Banco o IA' }],
    tutorial: 'conquista',
    sessionType: 'CONQUISTA',
  },
  {
    id: 'error',
    name: 'El Error de Jiro',
    description: 'Jiro resolvió un ejercicio y se equivocó en un paso. En parejas o en clan, encuéntrenlo y explíquenlo.',
    pose: 'confundido',
    cover: '/assets/jiro/actividades/error.webp',
    duration: '10–20 min',
    requirements: [{ icon: '📚', label: 'Banco o IA' }],
    sessionType: 'ERROR',
    tutorial: 'error',
  },
  {
    id: 'bingo',
    name: 'Bingo Estelar',
    description: 'Jiro sortea preguntas y cada uno marca su cartón: en pantalla o en una hoja impresa. Se premia lo que acierta la clase.',
    pose: 'emocionado',
    cover: '/assets/jiro/actividades/bingo.webp',
    duration: '15–25 min',
    requirements: [{ icon: '📚', label: 'Banco o Tablas' }, { icon: '🖨️', label: 'Impresora o cuentas' }],
    sessionType: 'BINGO',
    tutorial: 'bingo',
  },
  {
    id: 'correo',
    name: 'Correo Estelar',
    description: 'Cada uno escribe a una estrella secreta. En papel o desde su cuenta; Jiro entrega las cartas.',
    pose: 'emocionado',
    cover: '/assets/jiro/actividades/correo.webp',
    duration: '15 min + entrega',
    requirements: [{ icon: '📝', label: 'Papel o cuentas' }],
    sessionType: 'CORREO',
    tutorial: 'correo',
  },
  {
    id: 'pergaminos',
    name: 'Pergaminos del Aula',
    description: 'Mural donde los alumnos se envían mensajes de ánimo y reconocimiento.',
    pose: 'emocionado',
    duration: 'Toda la semana',
    requirements: [{ icon: '👤', label: 'Cuentas de alumnos' }],
    onlyWithScrolls: true,
  },
  {
    id: 'expediciones',
    name: 'Expediciones',
    description: 'Un viaje por paradas: relatos de Jiro, retos de tu banco, evidencias y actividades en clase.',
    pose: 'senalando',
    cover: '/assets/jiro/actividades/expediciones.webp',
    duration: 'Varias clases',
    requirements: [{ icon: '👤', label: 'Cuentas de alumnos' }],
    tutorial: 'expediciones',
  },
];

export const entryForSession = (type: ActivityType) => CATALOG.find((e) => e.sessionType === type) ?? null;

/** Días de calendario local entre una fecha y hoy. */
export const daysAgo = (iso: string) => {
  const then = new Date(iso);
  const now = new Date();
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
};

export const lastPlayedLabel = (iso: string | null | undefined) => {
  if (!iso) return 'Nunca jugada';
  const days = daysAgo(iso);
  if (days === 0) return 'Jugada hoy';
  if (days === 1) return 'Jugada ayer';
  return `Jugada hace ${days} días`;
};

export interface Recommendation {
  line: string;
  entry: CatalogEntry | null;
  resume: ActivitySession | null;
}

/**
 * Lo que propone Jiro al entrar, con datos reales: una partida a medias, la calma si hay varios
 * descansando, o la actividad que más tiempo lleva sin jugarse.
 */
export const recommend = (overview: ActivityOverview | undefined, restingCount: number): Recommendation => {
  // La primera partida a medias de una actividad del catálogo (la expedición proyectada se retoma desde su editor).
  const active = overview?.active.find((session) => entryForSession(session.activityType)) ?? null;
  const activeEntry = active ? entryForSession(active.activityType) : null;
  if (active && activeEntry) {
    return { line: `Dejamos ${activeEntry.name} a medias. ¿La seguimos?`, entry: activeEntry, resume: active };
  }
  if (restingCount >= 3) {
    return {
      line: `Hay ${restingCount} descansando. Un Descanso de Jiro nos ayuda a recuperar la calma.`,
      entry: CATALOG.find((e) => e.id === 'descanso') ?? null,
      resume: null,
    };
  }
  const tracked = CATALOG.filter((e) => e.sessionType);
  const last = new Map((overview?.lastByType ?? []).map((r) => [r.activityType, r.lastPlayedAt]));
  const never = tracked.find((e) => !last.get(e.sessionType!));
  if (never) return { line: `Aún no jugamos ${never.name}. ¿Probamos hoy?`, entry: never, resume: null };
  const oldest = tracked
    .map((e) => ({ e, at: last.get(e.sessionType!) as string }))
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  if (oldest && daysAgo(oldest.at) >= 3) {
    return { line: `Hace ${daysAgo(oldest.at)} días que no jugamos ${oldest.e.name}.`, entry: oldest.e, resume: null };
  }
  return { line: '¡Hola! ¿Qué exploramos hoy?', entry: null, resume: null };
};
