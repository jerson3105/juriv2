import toast from 'react-hot-toast';
import type { Classroom, ClassroomOverview } from '../../lib/classroomApi';
import type { MySchool } from '../../lib/schoolApi';

// Estilos compartidos por los modales de Inicio.
export const primaryButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300';
export const cancelButton = 'min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700';
export const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
export const labelClass = 'block text-sm font-semibold text-gray-800 dark:text-gray-100';

export const classroomsKey = ['classrooms'] as const;
export const overviewKey = (date: string) => ['classrooms-overview', date] as const;

// "Hoy" en la hora del profesor: medianoche local (ISO) y fecha YYYY-MM-DD (formato del pase de lista).
export const localToday = (now = new Date()) => {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { since: midnight.toISOString(), date };
};

// Escuelas donde el profesor puede poner clases (mismo criterio que el servidor).
export const attachableSchools = (schools: MySchool[]) =>
  schools.filter((s) => s.memberStatus === 'VERIFIED' || (s.memberRole === 'OWNER' && s.memberStatus === 'PENDING_ADMIN'));

export const GRADE_LEVELS = [
  { value: 'INICIAL_3', label: '3 años (Inicial)' },
  { value: 'INICIAL_4', label: '4 años (Inicial)' },
  { value: 'INICIAL_5', label: '5 años (Inicial)' },
  { value: 'PRIMARIA_1', label: '1.° Primaria' },
  { value: 'PRIMARIA_2', label: '2.° Primaria' },
  { value: 'PRIMARIA_3', label: '3.° Primaria' },
  { value: 'PRIMARIA_4', label: '4.° Primaria' },
  { value: 'PRIMARIA_5', label: '5.° Primaria' },
  { value: 'PRIMARIA_6', label: '6.° Primaria' },
  { value: 'SECUNDARIA_1', label: '1.° Secundaria' },
  { value: 'SECUNDARIA_2', label: '2.° Secundaria' },
  { value: 'SECUNDARIA_3', label: '3.° Secundaria' },
  { value: 'SECUNDARIA_4', label: '4.° Secundaria' },
  { value: 'SECUNDARIA_5', label: '5.° Secundaria' },
];

export const gradeLabel = (value: string | null) => GRADE_LEVELS.find((g) => g.value === value)?.label ?? null;

// Tema visual guardado por storytelling (MySQL puede devolver el JSON como texto).
export const classTheme = (classroom: Classroom) => {
  let tc = classroom.themeConfig as Classroom['themeConfig'] | string | null;
  if (typeof tc === 'string') {
    try { tc = JSON.parse(tc); } catch { tc = null; }
  }
  const theme = tc && typeof tc === 'object' ? tc : null;
  const primary = theme?.colors?.primary;
  const secondary = theme?.colors?.secondary;
  return {
    hasTheme: !!(primary && secondary),
    primary: primary ?? '#2563eb',
    secondary: secondary ?? '#4f46e5',
    emoji: theme?.banner?.emoji ?? null,
  };
};

// "hace 5 min", "hace 2 h", "ayer", "hace 3 días".
export const relativeTime = (iso: string | null, now = Date.now()) => {
  if (!iso) return null;
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
};

export const pendingOf = (o?: ClassroomOverview) => (o ? o.pendingPurchases + o.pendingUsages : 0);

// Más reciente primero: última actividad y, sin ella, la clase creada más tarde.
export const byRecentActivity = (overview: Map<string, ClassroomOverview>) => (a: Classroom, b: Classroom) => {
  const ta = overview.get(a.id)?.lastActivityAt;
  const tb = overview.get(b.id)?.lastActivityAt;
  if (ta && tb) return tb.localeCompare(ta);
  if (ta) return -1;
  if (tb) return 1;
  return b.createdAt.localeCompare(a.createdAt);
};

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const JIRO_TIPS = [
  { text: 'En el Observatorio de Jiro la clase juega proyectada y cierra con la Bitácora.', highlight: 'Observatorio de Jiro' },
  { text: 'Crea insignias propias y otórgalas en lote al final de la clase.', highlight: 'insignias propias' },
  { text: 'En la tienda tus estudiantes canjean su oro por recompensas reales.', highlight: 'tienda' },
  { text: 'Los clanes fomentan el trabajo en equipo: cada punto suma para su equipo.', highlight: 'clanes' },
  { text: 'Con los álbumes de cromos, completar la colección se vuelve una meta de toda la clase.', highlight: 'álbumes de cromos' },
  { text: 'Cierra la clase con la Gala de Rankings: podio, redoble y confeti.', highlight: 'Gala de Rankings' },
  { text: 'Pasa lista en segundos desde Asistencia: los presentes suman XP solos.', highlight: 'Asistencia' },
  { text: 'El banco de preguntas te deja reutilizar preguntas en el Observatorio de Jiro y las Expediciones.', highlight: 'banco de preguntas' },
];

export const copyClassCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code);
    toast.success(`Código ${code} copiado`);
    return true;
  } catch {
    toast.error('No se pudo copiar el código');
    return false;
  }
};
