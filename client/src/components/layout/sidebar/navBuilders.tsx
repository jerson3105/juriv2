import {
  Album,
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Bug,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  House,
  Layers,
  LayoutDashboard,
  List,
  Map,
  Medal,
  MessageSquareText,
  MessagesSquare,
  Plus,
  School,
  Scroll,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Telescope,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import type { MyClass } from '../../../hooks/useCurrentStudentProfile';
import type { NavGroup, NavItem, NavNode } from './navTypes';

const ICON = 16;
const icon = (Icon: typeof House) => <Icon size={ICON} aria-hidden="true" />;

// ── Profe dentro de una clase ────────────────────────────────────────────────────────────────────

interface TeacherClassNavInput {
  classroomId: string;
  pathname: string;
  scrollsEnabled: boolean;
  isUnlocked: (featureKey?: string) => boolean;
  isNew: (featureKey?: string) => boolean;
  dismissNew: (featureKey: string) => void;
  pendingShopCount: number;
  readyToReveal: number;
  /** Familias que pidieron unirse a esta clase y esperan al docente. */
  pendingFamilyCount: number;
}

/** Grupos del aula, el pie fijo (Estadísticas y Configuración) y el grupo de la página actual. */
export const teacherClassNav = (input: TeacherClassNavInput) => {
  const { classroomId: id, pathname, isUnlocked, isNew, dismissNew } = input;
  const base = `/classroom/${id}`;
  const at = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  const item = (
    path: string,
    label: string,
    Icon: typeof House,
    featureKey?: string,
    extra: Partial<NavItem> = {},
  ): NavItem | null => {
    if (!isUnlocked(featureKey)) return null;
    const fresh = isNew(featureKey);
    return {
      id: path,
      label,
      to: path,
      icon: icon(Icon),
      active: at(path),
      badge: fresh ? { kind: 'chip', text: 'Nuevo', label: 'Función nueva' } : undefined,
      onSelect: fresh && featureKey ? () => dismissNew(featureKey) : undefined,
      ...extra,
    };
  };

  const shop = `${base}/shop`;
  const story = `${base}/storytelling`;
  const allGroups: NavGroup[] = [
    {
      kind: 'group',
      id: 'students',
      label: 'Estudiantes',
      icon: icon(Users),
      items: [
        // La ficha de un alumno (/student/:id) cuenta como «Lista».
        item(`${base}/students`, 'Lista', List, 'students', { active: at(`${base}/students`) || at(`${base}/student`) }),
        item(`${base}/clans`, 'Clanes', Shield, 'clans'),
        item(`${base}/attendance`, 'Asistencia', CalendarCheck, 'attendance'),
      ].filter((entry): entry is NavItem => !!entry),
    },
    {
      kind: 'group',
      id: 'gamification',
      label: 'Gamificación',
      icon: icon(Gamepad2),
      items: [
        item(`${base}/behaviors`, 'Comportamientos', Award, 'behaviors'),
        item(`${base}/badges`, 'Insignias', Medal, 'badges'),
        item(shop, 'Tienda', ShoppingBag, 'shop', input.pendingShopCount > 0
          ? { badge: { kind: 'count', value: input.pendingShopCount, label: `${input.pendingShopCount} por atender en la tienda` } }
          : {}),
        item(`${base}/collectibles`, 'Coleccionables', Album, 'collectibles'),
        item(`${base}/rankings`, 'Rankings', Trophy, 'rankings'),
        item(story, 'Historia de clase', Sparkles, 'storytelling', input.readyToReveal > 0
          ? { badge: { kind: 'chip', text: 'Revelar', label: 'Hay un final listo para revelar' } }
          : {}),
      ].filter((entry): entry is NavItem => !!entry),
    },
    {
      kind: 'group',
      id: 'learning',
      label: 'Aprendizaje',
      icon: icon(GraduationCap),
      items: [
        // Expediciones vive dentro del Observatorio (su tarjeta abre /expeditions).
        item(`${base}/activities`, 'Observatorio de Jiro', Telescope, 'activities', { active: at(`${base}/activities`) || at(`${base}/expeditions`) }),
        item(`${base}/question-banks`, 'Preguntas', BookOpen, 'question_bank'),
        // Siempre visible: sin configurar, Calificaciones muestra cómo empezar.
        item(`${base}/gradebook`, 'Calificaciones', ClipboardList, 'grades'),
        item(`${base}/history`, 'Registro de actividad', Scroll),
      ].filter((entry): entry is NavItem => !!entry),
    },
    {
      kind: 'group',
      id: 'communication',
      label: 'Comunicación',
      icon: icon(MessagesSquare),
      items: [
        // Una sola sala: avisos (con «visto por») y, si el docente la abre, conversación con las familias.
        item(`${base}/families`, 'Familias', HeartHandshake, undefined, input.pendingFamilyCount > 0
          ? { badge: { kind: 'count', value: input.pendingFamilyCount, label: `${input.pendingFamilyCount} ${input.pendingFamilyCount === 1 ? 'familia espera' : 'familias esperan'} tu aprobación` } }
          : {}),
        // Se queda (se usará más adelante). Lleva a la misma página que el Observatorio: nunca se marca
        // como la actual, para no resaltar dos lugares a la vez.
        input.scrollsEnabled ? item(`${base}/activities`, 'Chats', MessageSquareText, undefined, { id: 'chats', active: false }) : null,
      ].filter((entry): entry is NavItem => !!entry),
    },
  ];
  const groups = allGroups.filter((group) => group.items.length > 0);

  const footer = [
    item(`${base}/reports`, 'Estadísticas', BarChart3),
    // Clase, Reglas del juego y Archivar o eliminar son pestañas de la página.
    item(`${base}/settings/general`, 'Configuración', Settings, 'settings', { active: at(`${base}/settings`) }),
  ].filter((entry): entry is NavItem => !!entry);

  const activeGroupId = groups.find((group) => group.items.some((entry) => entry.active))?.id ?? null;
  return { groups, footer, activeGroupId };
};

// ── Profe fuera de una clase ────────────────────────────────────────────────────────────────────

export const teacherHomeNav = (pathname: string): NavNode[] => [
  { kind: 'link', item: { id: 'home', label: 'Inicio', to: '/dashboard', icon: icon(LayoutDashboard), active: pathname === '/dashboard' } },
  { kind: 'link', item: { id: 'school', label: 'Mi Escuela', to: '/escuela', icon: icon(School), active: pathname === '/schools' || pathname.startsWith('/schools/') || pathname.startsWith('/escuela') } },
  { kind: 'link', item: { id: 'settings', label: 'Configuración', to: '/settings', icon: icon(Settings), active: pathname === '/settings' || pathname.startsWith('/settings/') } },
];

// ── Consola escolar ─────────────────────────────────────────────────────────────────────────────

interface SchoolConsoleNavInput {
  schoolId: string;
  pathname: string;
  /** Responsable o administración, verificados. */
  manager: boolean;
  /** Miembro verificado. Si no, la escuela espera verificación: solo Inicio y Clases. */
  verified: boolean;
  pendingRequests: number;
}

/** Menú del colegio: como el aula, la consola es un contexto. Cada bloque de la Entrega 1 suma sus páginas. */
export const schoolConsoleNav = (input: SchoolConsoleNavInput): NavNode[] => {
  const { schoolId, pathname, manager, verified, pendingRequests } = input;
  const base = `/escuela/${schoolId}`;
  const entry = (path: string, label: string, Icon: typeof House, extra: Partial<NavItem> = {}): NavItem => {
    const to = path ? `${base}/${path}` : base;
    const active = path ? pathname === to || pathname.startsWith(`${to}/`) : pathname === base;
    return { id: to, label, to, icon: icon(Icon), active, ...extra };
  };
  const link = (item: NavItem): NavNode => ({ kind: 'link', item });

  if (!verified) return [link(entry('', 'Inicio', LayoutDashboard)), link(entry('clases', 'Clases', GraduationCap))];
  const requests = manager && pendingRequests > 0
    ? { badge: { kind: 'count' as const, value: pendingRequests, label: `${pendingRequests} ${pendingRequests === 1 ? 'solicitud para unirse' : 'solicitudes para unirse'}` } }
    : {};
  return [
    link(entry('', 'Inicio', LayoutDashboard)),
    ...(manager ? [link(entry('estudiantes', 'Estudiantes', GraduationCap)), link(entry('secciones', 'Grados y secciones', Layers))] : []),
    link(entry('docentes', 'Docentes', Users, requests)),
    link(entry('clases', 'Clases', BookOpen)),
    ...(manager ? [link(entry('anio', 'Año escolar', CalendarCheck))] : []),
    {
      kind: 'section',
      id: 'school-more',
      label: 'Más',
      icon: icon(BookOpen),
      items: [...(manager ? [entry('informes', 'Informes', BarChart3)] : []), entry('biblioteca', 'Biblioteca', Award)],
    },
  ];
};

// ── Alumno ──────────────────────────────────────────────────────────────────────────────────────

interface StudentNavInput {
  profile: MyClass;
  pathname: string;
  /** Expediciones de la clase (0 = no hay) y si en alguna tiene algo que hacer ahora. */
  expeditions: number;
  hasActiveExpeditions: boolean;
  hasStoryTheme: boolean;
}

// Qué secciones tiene una clase (también decide si al cambiar de clase la página sigue existiendo).
const studentAvailability = (profile: MyClass) => {
  const classroom = profile.classroom;
  return {
    grades: !!classroom?.useCompetencies,
    shop: (!!classroom?.shopEnabled && (profile.shopSummary?.items ?? 0) > 0) || (profile.shopSummary?.owned ?? 0) > 0,
    badges: (profile.badgeSummary?.available ?? 0) > 0 || (profile.badgeSummary?.owned ?? 0) > 0,
    collectibles: (profile.collectibleSummary?.albums ?? 0) > 0 || (profile.collectibleSummary?.owned ?? 0) > 0,
    scrolls: !!classroom?.scrollsEnabled,
    clan: !!classroom?.clansEnabled,
  };
};

/**
 * Menú del alumno: «Inicio» arriba, secciones con título siempre visibles (los avisos ya no quedan
 * escondidos en grupos cerrados) y «Mi clan» suelto. Cada entrada aparece solo si tiene contenido.
 */
export const studentClassNav = (input: StudentNavInput): NavNode[] => {
  const { profile, pathname } = input;
  const has = studentAvailability(profile);
  const at = (path: string) => pathname === path;
  const link = (path: string, label: string, Icon: typeof House, extra: Partial<NavItem> = {}): NavItem => ({
    id: path, label, to: path, icon: icon(Icon), active: at(path), ...extra,
  });

  const space: NavItem[] = [
    link('/my-calendar', 'Mi calendario', Calendar),
    link('/my-progress', 'Mi progreso', BarChart3),
    ...(has.grades ? [link('/my-grades', 'Mis calificaciones', BookOpen)] : []),
  ];
  const rewards: NavItem[] = [
    ...(has.shop ? [link('/my-shop', 'Tienda', ShoppingBag, { badge: { kind: 'gold', value: profile.gp } })] : []),
    link('/my-avatar', 'Mi personaje', Shirt),
    ...(has.badges ? [link('/my-badges', 'Mis insignias', Medal)] : []),
    ...(has.collectibles ? [link('/collectibles', 'Coleccionables', Album)] : []),
  ];
  const inExpeditions = at('/expeditions') || pathname.startsWith('/expeditions/');
  const adventures: NavItem[] = [
    ...(input.expeditions > 0 || inExpeditions ? [link('/expeditions', 'Expediciones', Map, {
      active: inExpeditions,
      ...(input.hasActiveExpeditions && !inExpeditions ? { badge: { kind: 'dot', label: 'Tienes algo que hacer en Expediciones' } } : {}),
    })] : []),
    ...(has.scrolls ? [link('/scrolls', 'Pergaminos', ScrollText, profile.classroom?.scrollsOpen && !at('/scrolls')
      ? { badge: { kind: 'dot', label: 'Hay algo nuevo en Pergaminos' } }
      : {})] : []),
    ...(profile.classroom?.hasActiveStory || input.hasStoryTheme ? [link('/my-story', 'Mi historia', BookMarked)] : []),
  ];

  const nodes: NavNode[] = [{ kind: 'link', item: link('/my-class', 'Inicio', House) }];
  if (space.length) nodes.push({ kind: 'section', id: 'space', label: 'Mi espacio', icon: icon(UserRound), items: space });
  if (rewards.length) nodes.push({ kind: 'section', id: 'rewards', label: 'Recompensas', icon: icon(Medal), items: rewards });
  if (adventures.length) nodes.push({ kind: 'section', id: 'adventures', label: 'Aventuras', icon: icon(Map), items: adventures });
  if (has.clan) nodes.push({ kind: 'link', item: link('/my-clan', 'Mi clan', Shield) });
  return nodes;
};

/** Sin clases: entrar a una. */
export const studentEmptyNav = (pathname: string): NavNode[] => [
  { kind: 'link', item: { id: 'classes', label: 'Mis clases', to: '/dashboard', icon: icon(Users), active: pathname === '/dashboard' || pathname === '/my-classes' } },
  { kind: 'link', item: { id: 'join', label: 'Unirme a una clase', to: '/join-class', icon: icon(Plus), active: pathname === '/join-class' } },
];

// Página del alumno → sección que necesita (las demás existen en toda clase).
const ROUTE_NEEDS: Record<string, keyof ReturnType<typeof studentAvailability>> = {
  '/my-grades': 'grades',
  '/my-shop': 'shop',
  '/my-badges': 'badges',
  '/collectibles': 'collectibles',
  '/scrolls': 'scrolls',
  '/my-clan': 'clan',
};

/** Al cambiar de clase: ¿la página actual existe en la otra? (si no, se va a su Inicio). */
export const studentRouteAvailable = (profile: MyClass, pathname: string) => {
  const needs = ROUTE_NEEDS[pathname];
  if (needs) return studentAvailability(profile)[needs];
  if (pathname === '/my-story') return !!profile.classroom?.hasActiveStory || !!profile.classroom?.themeConfig;
  return true;
};

// ── Panel de administración ─────────────────────────────────────────────────────────────────────

/** Lo que espera una acción del admin (los números del menú). */
export interface AdminNavCounts {
  teacherRequests: number;
  schoolRequests: number;
  drafts: number;
  bugReports: number;
}

const counted = (value: number, label: string) => (value > 0 ? { kind: 'count' as const, value, label } : undefined);

/** Menú del panel: secciones con título (como el del alumno) y un número solo donde te espera algo. */
export const adminNav = (pathname: string, counts: AdminNavCounts | null): NavNode[] => {
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const item = (id: string, label: string, to: string, Icon: typeof House, badge?: NavItem['badge']): NavItem => ({
    id, label, to, icon: icon(Icon), active: under(to), ...(badge ? { badge } : {}),
  });
  return [
    { kind: 'link', item: { ...item('home', 'Inicio', '/admin', LayoutDashboard), active: pathname === '/admin' } },
    {
      kind: 'section', id: 'people', label: 'Personas', icon: icon(Users), items: [
        item('users', 'Usuarios', '/admin/users', Users),
        item('teachers', 'Docentes por verificar', '/admin/teacher-verifications', ShieldCheck,
          counted(counts?.teacherRequests ?? 0, 'docentes piden verificación')),
        item('schools', 'Escuelas', '/admin/school-verifications', School,
          counted(counts?.schoolRequests ?? 0, 'escuelas por verificar')),
      ],
    },
    {
      kind: 'section', id: 'content', label: 'Contenido', icon: icon(Shirt), items: [
        item('avatar-items', 'Prendas del avatar', '/admin/avatar-items', Shirt, counted(counts?.drafts ?? 0, 'prendas en borrador')),
        item('maps', 'Mapas de expedición', '/admin/expedition-maps', Map),
      ],
    },
    { kind: 'section', id: 'classes', label: 'Aulas', icon: icon(GraduationCap), items: [item('classrooms', 'Clases', '/admin/classrooms', GraduationCap)] },
    {
      kind: 'section', id: 'support', label: 'Soporte', icon: icon(Bug), items: [
        item('bug-reports', 'Reportes de error', '/admin/bug-reports', Bug, counted(counts?.bugReports ?? 0, 'reportes por atender')),
      ],
    },
  ];
};
