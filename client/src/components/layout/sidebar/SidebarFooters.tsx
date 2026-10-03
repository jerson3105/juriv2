import { Lock, LogOut, Monitor, Moon, Sparkles, Sun, X } from 'lucide-react';
import type { User } from '../../../lib/api';
import { useThemeStore } from '../../../store/themeStore';
import { useSidebarUi } from './sidebarContext';

const avatarSrc = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const api = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  return `${api}${url.startsWith('/api') ? url.replace('/api', '') : url}`;
};

const THEMES = {
  light: { label: 'Claro', next: 'dark', icon: Sun },
  dark: { label: 'Oscuro', next: 'system', icon: Moon },
  system: { label: 'Como el sistema', next: 'light', icon: Monitor },
} as const;

/** Botón de tema que va rotando (claro → oscuro → como el sistema). */
const ThemeCycle = ({ rail }: { rail: boolean }) => {
  const { showTip, hideTip } = useSidebarUi();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const current = THEMES[theme as keyof typeof THEMES] ?? THEMES.system;
  const Icon = current.icon;
  const label = `Tema: ${current.label}. Cambiar`;
  return (
    <button
      type="button"
      onClick={() => setTheme(current.next)}
      aria-label={label}
      className={`sb-item ${rail ? 'justify-center px-0' : ''}`}
      onMouseEnter={(event) => rail && showTip(event.currentTarget, label)}
      onMouseLeave={hideTip}
    >
      <span className="sb-icon"><Icon size={rail ? 18 : 16} aria-hidden="true" /></span>
      {!rail && <span className="sb-label">Tema: {current.label}</span>}
    </button>
  );
};

/**
 * Pie del menú del profe fuera de una clase: quién está y «Cerrar sesión» (antes tapaba el menú). El panel
 * de administración lo usa con su rol y el botón de tema.
 */
export const TeacherHomeFooter = ({ user, rail, onLogout, roleLabel = 'Docente', showTheme = false }: { user: User | null; rail: boolean; onLogout: () => void; roleLabel?: string; showTheme?: boolean }) => {
  const { showTip, hideTip } = useSidebarUi();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const src = avatarSrc(user?.avatarUrl);
  const face = src
    ? <img src={src} alt="" className="h-9 w-9 flex-shrink-0 rounded-xl object-cover" />
    : (
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold text-white" aria-hidden="true">
        {user?.firstName?.[0]}{user?.lastName?.[0]}
      </span>
    );

  if (rail) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex py-1" onMouseEnter={(event) => showTip(event.currentTarget, name)} onMouseLeave={hideTip}>
          {face}
          <span className="sr-only">{name}, {roleLabel.toLowerCase()}</span>
        </span>
        {showTheme && <ThemeCycle rail />}
        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          className="sb-item sb-danger justify-center px-0"
          onMouseEnter={(event) => showTip(event.currentTarget, 'Cerrar sesión')}
          onMouseLeave={hideTip}
          onFocus={(event) => showTip(event.currentTarget, 'Cerrar sesión', true)}
          onBlur={hideTip}
        >
          <span className="sb-icon"><LogOut size={18} aria-hidden="true" /></span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-2 py-1">
        {face}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs sb-muted">{roleLabel}</p>
        </div>
      </div>
      {showTheme && <ThemeCycle rail={false} />}
      <button type="button" onClick={onLogout} className="sb-item sb-danger">
        <span className="sb-icon"><LogOut size={16} aria-hidden="true" /></span>
        <span className="sb-label">Cerrar sesión</span>
      </button>
    </div>
  );
};

/**
 * Novedades del onboarding del profe en una sola línea (antes, tres filas): abre el modal de funciones,
 * donde también está su nivel. Con ✕ se oculta hasta la próxima novedad.
 */
export const NewsLine = ({ rail, pending, onOpen, onDismiss }: { rail: boolean; pending: number; onOpen: () => void; onDismiss: () => void }) => {
  const { showTip, hideTip } = useSidebarUi();
  const label = pending > 0 ? `${pending} ${pending === 1 ? 'función nueva' : 'funciones nuevas'}` : 'Desbloquear más funciones';

  if (rail) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="sb-item justify-center px-0"
        onMouseEnter={(event) => showTip(event.currentTarget, label)}
        onMouseLeave={hideTip}
        onFocus={(event) => showTip(event.currentTarget, label, true)}
        onBlur={hideTip}
      >
        <span className="sb-tile relative">
          {pending > 0 ? <Sparkles size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          {pending > 0 && <span className="sb-dot sb-pop absolute -bottom-0.5 -right-0.5 ring-2 ring-[color:var(--sb-bg)]" aria-hidden="true" />}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onOpen} className="sb-item min-w-0 flex-1">
        <span className="sb-tile">{pending > 0 ? <Sparkles size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}</span>
        <span className="sb-label min-w-0 flex-1 truncate">{label}</span>
        {pending > 0 && <span className="sb-chip" aria-hidden="true">Ver</span>}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ocultar este aviso hasta la próxima novedad"
        className="sb-focus flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl sb-fg2 hover:bg-[color:var(--sb-hover)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

/** Alumno en el celular: salir desde el menú (en escritorio está en la barra superior). */
export const StudentDrawerFooter = ({ firstName, onLogout }: { firstName?: string; onLogout: () => void }) => (
  <button type="button" onClick={onLogout} className="sb-item sb-danger font-semibold">
    <span className="sb-icon"><LogOut size={16} aria-hidden="true" /></span>
    <span className="min-w-0 flex-1">Salir{firstName ? ` · ¿No eres ${firstName}?` : ''}</span>
  </button>
);
