import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { deriveStoryAccent } from '../../../lib/storyTheme';
import type { MyClass } from '../../../hooks/useCurrentStudentProfile';
import { ClassSeal } from './ClassSeal';
import { handleMenuKeys, useSidebarUi } from './sidebarContext';
import { SidebarFlyout } from './sidebarUi';

export interface ClassLink {
  to: string;
  label: string;
  icon: ReactNode;
}

const accentOf = (profile: MyClass) => deriveStoryAccent(profile.classroom?.themeConfig ?? null);
const nameOf = (profile: MyClass) => profile.classroom?.name ?? 'Tu clase';

interface ClassMenuProps {
  classes: MyClass[];
  currentId: string;
  links: ClassLink[];
  onPick: (profileId: string) => void;
  onLink: () => void;
}

/** «Tus clases»: un menú con la clase actual marcada, en orden estable (alfabético), y los atajos. */
const ClassMenu = ({ classes, currentId, links, onPick, onLink }: ClassMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} role="menu" aria-label="Tus clases" onKeyDown={(event) => handleMenuKeys(event, ref.current)}>
      {classes.map((profile) => {
        const checked = profile.id === currentId;
        return (
          <button
            key={profile.id}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            tabIndex={-1}
            data-autofocus={checked ? '' : undefined}
            onClick={() => onPick(profile.id)}
            className="sb-item gap-3 py-2"
          >
            <ClassSeal classroomId={profile.classroomId} name={nameOf(profile)} accent={accentOf(profile)} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-5 line-clamp-2">{nameOf(profile)}</span>
              <span className="block text-xs sb-muted">
                Nivel {profile.level}
                {profile.hp <= 0 && <> · <span aria-hidden="true">🌙</span> Descansando</>}
              </span>
            </span>
            {checked && <Check size={16} className="flex-shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
      <div role="separator" className="my-1 border-t sb-line" />
      {links.map((link) => (
        <Link key={link.to} to={link.to} role="menuitem" tabIndex={-1} onClick={onLink} className="sb-item">
          <span className="sb-icon">{link.icon}</span>
          <span className="min-w-0 flex-1">{link.label}</span>
        </Link>
      ))}
    </div>
  );
};

/** En el cajón del celular, «Tus clases» se desliza sobre el menú (sin otra capa encima). */
const DrawerPanel = ({ onBack, children }: { onBack: () => void; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    // Lo que queda debajo del panel no recibe foco ni lo lee el lector mientras está abierto.
    const covered = Array.from(panel?.parentElement?.children ?? []).filter((child) => child !== panel && !child.hasAttribute('inert'));
    covered.forEach((child) => child.setAttribute('inert', ''));
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => covered.forEach((child) => child.removeAttribute('inert'));
  }, []);
  return (
    <div
      ref={ref}
      className="sb-surface sb-slide-in absolute inset-0 z-20 flex flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <div className="flex items-center gap-2 border-b sb-line px-2 py-2">
        <button type="button" onClick={onBack} aria-label="Volver al menú" className="sb-focus flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[color:var(--sb-hover)]">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <p className="text-base font-bold">Tus clases</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
};

interface ClassSwitcherProps {
  classes: MyClass[];
  current: MyClass;
  onSelect: (profileId: string) => void;
  links: ClassLink[];
}

/**
 * La tarjeta de la clase del alumno, arriba del menú: sello propio de la clase (emoji del tema o
 * iniciales; nunca el ícono del rol) y nombre completo. Con 2 o más clases abre «Tus clases»: al costado
 * en escritorio (sin tapar el menú), deslizándose en el cajón del celular. Colapsado, queda el sello.
 */
export const ClassSwitcher = ({ classes, current, onSelect, links }: ClassSwitcherProps) => {
  const { rail, drawer, panelHost, closeDrawer, showTip, hideTip } = useSidebarUi();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const many = classes.length > 1;
  const name = nameOf(current);
  const seal = (size: 36 | 40) => <ClassSeal classroomId={current.classroomId} name={name} accent={accentOf(current)} size={size} />;

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    // Después de desmontar el panel (que deja inert lo de debajo mientras está abierto).
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const menu = (
    <ClassMenu
      classes={classes}
      currentId={current.id}
      links={links}
      onPick={(profileId) => {
        close(true);
        if (profileId !== current.id) onSelect(profileId);
      }}
      onLink={() => {
        setOpen(false);
        closeDrawer();
      }}
    />
  );
  const flyout = open && !drawer && (
    <SidebarFlyout anchorRef={triggerRef} label="Tus clases" onClose={close}>
      <p className="sb-section-title pt-1">Tus clases</p>
      {menu}
    </SidebarFlyout>
  );

  if (rail) {
    if (!many) {
      return (
        <span className="inline-flex" onMouseEnter={(event) => showTip(event.currentTarget, name)} onMouseLeave={hideTip}>
          {seal(40)}
          <span className="sr-only">Clase: {name}</span>
        </span>
      );
    }
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Clase actual: ${name}. Cambiar de clase`}
          className="sb-focus rounded-xl"
          onMouseEnter={(event) => !open && showTip(event.currentTarget, `${name} · cambiar de clase`)}
          onMouseLeave={hideTip}
          onFocus={(event) => !open && showTip(event.currentTarget, `${name} · cambiar de clase`, true)}
          onBlur={hideTip}
          onClick={() => {
            hideTip();
            setOpen((value) => !value);
          }}
        >
          {seal(40)}
        </button>
        {flyout}
      </>
    );
  }

  if (!many) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
        {seal(36)}
        <p className="sb-label min-w-0 flex-1 text-sm font-semibold leading-5 line-clamp-2">
          <span className="sr-only">Clase: </span>
          {name}
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Clase actual: ${name}. Cambiar de clase`}
        onClick={() => setOpen((value) => !value)}
        className="sb-focus flex min-h-14 w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left ring-1 ring-white/10 transition-colors hover:bg-white/15"
      >
        {seal(36)}
        <span className="sb-label min-w-0 flex-1 text-sm font-semibold leading-5 line-clamp-2">{name}</span>
        {drawer
          ? <ChevronRight size={18} className="flex-shrink-0 text-white/90" aria-hidden="true" />
          : <ChevronDown size={18} className={`flex-shrink-0 text-white/90 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
      </button>
      {flyout}
      {open && drawer && panelHost && createPortal(<DrawerPanel onBack={() => close(true)}>{menu}</DrawerPanel>, panelHost)}
    </>
  );
};
