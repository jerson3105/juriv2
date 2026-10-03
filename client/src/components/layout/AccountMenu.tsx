import { useState } from 'react';
import { Bug, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { usePopover } from '../../hooks/usePopover';
import { MenuCheck, Popover } from '../ui/Popover';
import { BugReportButton } from '../BugReportButton';

const THEMES = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Como el sistema', icon: Monitor },
] as const;

/** Cuenta del profe en el aula: tema, reportar un error y, al final, cerrar sesión (PC compartidas). */
export const AccountMenu = ({ onLogout }: { onLogout: () => void }) => {
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { open, anchorRef, close, toggle } = usePopover();
  const [reporting, setReporting] = useState(false);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Tu cuenta: tema, reportar un error y cerrar sesión"
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-800 dark:bg-gray-600 dark:text-gray-100" aria-hidden="true">
          {initials}
        </span>
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} label="Tu cuenta" className="w-64">
        {user?.firstName && <p className="truncate px-3 pb-1 pt-2 text-sm font-semibold pg-fg">{user.firstName} {user.lastName}</p>}
        <p className="pg-menu-label" id="account-theme">Tema</p>
        <div role="radiogroup" aria-labelledby="account-theme">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => setTheme(id)} className="pg-menu-item">
              <Icon size={16} aria-hidden="true" />
              {label}
              <MenuCheck on={theme === id} />
            </button>
          ))}
        </div>
        <div className="pg-menu-sep" />
        <button type="button" onClick={() => { close(); setReporting(true); }} className="pg-menu-item">
          <Bug size={16} aria-hidden="true" />
          Reportar un error
        </button>
        <button type="button" onClick={() => { close(); onLogout(); }} className="pg-menu-item pg-alert">
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </Popover>
      <BugReportButton variant="none" open={reporting} onOpenChange={setReporting} />
    </>
  );
};
