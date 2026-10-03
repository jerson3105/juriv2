import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { StoryAccent } from '../../../lib/storyTheme';
import type { NavItem, NavNode } from './navTypes';
import { SidebarBand, type BandSky } from './SidebarBand';
import { NavTree, RailNav } from './SidebarNav';
import { SidebarUiContext } from './sidebarContext';
import { useIsDesktop, useMotionBudget } from './useSidebarState';

const EXPANDED = 256;
const RAIL = 72;
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface AppSidebarProps {
  /** Tema de la clase: el menú toma su color (texto blanco). Sin tema: claro u oscuro. */
  accent: StoryAccent | null;
  /** Noche de la banda: teñida con el tema, o null (noche pura). */
  bandTint: string | null;
  sky: BandSky;
  twinkle: boolean;
  logoTo: string;
  /** La tarjeta o ficha de la clase (lee rail/drawer del contexto). */
  context?: ReactNode;
  nav: NavNode[];
  navLabel: string;
  /** Ítems fijos al pie del menú (Estadísticas, Configuración): nunca se van con el scroll. */
  footerNav?: NavItem[];
  footer?: (state: { rail: boolean; drawer: boolean }) => ReactNode;
  speed?: 'normal' | 'fast';
  openGroups?: { isOpen: (id: string) => boolean; toggle: (id: string) => void };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /** El contenido de la página: se desliza (transform) al colapsar, en vez de animar el ancho. */
  contentRef?: RefObject<HTMLElement>;
  /** El botón ☰: recibe el foco al cerrar el cajón. */
  menuButtonRef?: RefObject<HTMLElement>;
}

/**
 * El sidebar común de Juried (profe y alumno, dentro y fuera de una clase). Arriba, la banda del
 * Observatorio; después el menú (con su propio scroll) y el pie fijo. En el celular es un cajón modal:
 * el foco entra y no sale, Esc y ✕ lo cierran y elegir una página también.
 */
export const AppSidebar = (props: AppSidebarProps) => {
  const { accent, collapsed, mobileOpen, nav, footerNav, speed = 'normal' } = props;
  const isDesktop = useIsDesktop();
  const motion = useMotionBudget();
  const location = useLocation();
  const rail = isDesktop && collapsed;
  const drawer = !isDesktop;

  const asideRef = useRef<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const setAside = useCallback((element: HTMLElement | null) => {
    asideRef.current = element;
    setPanelHost(element);
  }, []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsing, setCollapsing] = useState(false);
  const [labelsIn, setLabelsIn] = useState(false);
  const [more, setMore] = useState(false);
  // El tooltip recuerda en qué página nació: al navegar deja de mostrarse (sin setState en un efecto).
  const [tip, setTip] = useState<{ label: string; top: number; left: number; path: string } | null>(null);
  const pathRef = useRef(location.pathname);
  const tipTimer = useRef<number>();

  // Las funciones del padre cambian en cada render: se leen siempre las últimas.
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
    pathRef.current = location.pathname;
  });
  const closeDrawer = useCallback(() => latest.current.onMobileOpenChange(false), []);

  const hideTip = useCallback(() => {
    window.clearTimeout(tipTimer.current);
    setTip(null);
  }, []);
  const showTip = useCallback((anchor: HTMLElement, label: string, immediate = false) => {
    window.clearTimeout(tipTimer.current);
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10, path: pathRef.current });
    };
    if (immediate) place();
    else tipTimer.current = window.setTimeout(place, 300);
  }, []);

  // Al navegar: se cierra el cajón y no aparece un tooltip pendiente.
  useEffect(() => {
    latest.current.onMobileOpenChange(false);
    window.clearTimeout(tipTimer.current);
  }, [location.pathname]);

  // Cerrado en el celular, el cajón queda fuera de la pantalla: tampoco recibe foco ni lo lee el lector.
  useEffect(() => {
    asideRef.current?.toggleAttribute('inert', drawer && !mobileOpen);
  }, [drawer, mobileOpen]);

  // Cajón abierto: el foco entra, Tab no sale, Esc cierra y el foco vuelve a ☰.
  useEffect(() => {
    if (!drawer || !mobileOpen) return;
    const aside = asideRef.current;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!aside || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        latest.current.onMobileOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !aside.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !aside.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const target = latest.current.menuButtonRef?.current ?? previous;
      target?.focus?.();
    };
  }, [drawer, mobileOpen]);

  // Difuminado al pie del menú cuando hay más ítems abajo.
  const updateMore = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    setMore(box.scrollHeight - box.scrollTop - box.clientHeight > 4);
  }, []);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateMore);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, [updateMore, rail]);

  // Colapsar sin animar el ancho: las etiquetas se desvanecen, el carril cambia de una vez y el contenido
  // se desliza con transform (un solo reflujo).
  const slideContent = (dx: number) => {
    if (motion === 'off') return;
    latest.current.contentRef?.current?.animate(
      [{ transform: `translateX(${dx}px)` }, { transform: 'none' }],
      { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  };
  const toggleCollapsed = () => {
    if (collapsing) return;
    hideTip();
    if (!collapsed) {
      if (motion === 'off') {
        props.onCollapsedChange(true);
        return;
      }
      setCollapsing(true);
      window.setTimeout(() => {
        flushSync(() => {
          latest.current.onCollapsedChange(true);
          setCollapsing(false);
        });
        slideContent(EXPANDED - RAIL);
      }, 100);
    } else {
      flushSync(() => {
        props.onCollapsedChange(false);
        setLabelsIn(motion !== 'off');
      });
      slideContent(RAIL - EXPANDED);
      window.setTimeout(() => setLabelsIn(false), 400);
    }
  };

  const ui = useMemo(
    () => ({ rail, drawer, motion, panelHost, closeDrawer, showTip, hideTip }),
    [rail, drawer, motion, panelHost, closeDrawer, showTip, hideTip],
  );
  const visible = isDesktop || mobileOpen;
  const footerNodes: NavNode[] = (footerNav ?? []).map((item) => ({ kind: 'link', item }));
  const footerContent = props.footer?.({ rail, drawer }) ?? null;

  return (
    <SidebarUiContext.Provider value={ui}>
      {drawer && mobileOpen && (
        <div className="sb-backdrop fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      )}
      <aside
        ref={setAside}
        data-sb={accent ? 'theme' : 'light'}
        data-collapsing={collapsing}
        role={drawer && mobileOpen ? 'dialog' : undefined}
        aria-modal={drawer && mobileOpen ? true : undefined}
        aria-label={drawer ? 'Menú' : undefined}
        style={accent ? ({ '--sb-theme-bg': accent.sidebar } as CSSProperties) : undefined}
        className={`sb-surface fixed inset-y-0 left-0 z-50 flex w-[min(85vw,320px)] flex-col border-r sb-line shadow-xl shadow-slate-900/10 transition-transform duration-200 ease-out lg:transform-none lg:transition-none ${
          rail ? 'lg:w-[72px]' : 'lg:w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${labelsIn ? 'sb-label-in' : ''}`}
      >
        <SidebarBand
          sky={props.sky}
          tint={props.bandTint}
          twinkle={props.twinkle}
          motion={motion}
          rail={rail}
          logoTo={props.logoTo}
          showClose={drawer}
          closeRef={closeRef}
          onClose={closeDrawer}
        >
          {props.context}
        </SidebarBand>

        <nav aria-label={props.navLabel} className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} onScroll={updateMore} className={`sb-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 ${rail ? 'px-3' : 'px-2'}`}>
            {rail
              ? <RailNav nodes={nav} speed={speed} onNavigate={closeDrawer} />
              : <NavTree nodes={nav} speed={speed} onNavigate={closeDrawer} openGroups={props.openGroups} visible={visible} />}
            {more && (
              <div
                className="pointer-events-none sticky -bottom-2 -mb-2 -mt-8 h-8"
                style={{ background: 'linear-gradient(to top, var(--sb-bg), transparent)' }}
                aria-hidden="true"
              />
            )}
          </div>
          {footerNodes.length > 0 && (
            <div className={`flex-shrink-0 border-t sb-line py-2 ${rail ? 'px-3' : 'px-2'}`}>
              {rail
                ? <RailNav nodes={footerNodes} speed={speed} onNavigate={closeDrawer} />
                : <NavTree nodes={footerNodes} speed={speed} onNavigate={closeDrawer} visible={visible} />}
            </div>
          )}
        </nav>

        {footerContent && <div className={`flex-shrink-0 border-t sb-line py-2 ${rail ? 'px-3' : 'px-2'}`}>{footerContent}</div>}

        {isDesktop && (
          <div className={`flex-shrink-0 border-t sb-line py-2 ${rail ? 'px-3' : 'px-2'}`}>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!collapsed}
              className={`sb-item ${rail ? 'justify-center px-0' : ''}`}
              onMouseEnter={(event) => rail && showTip(event.currentTarget, 'Expandir menú')}
              onMouseLeave={hideTip}
            >
              <span className="sb-icon">{rail ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}</span>
              {!rail && <span className="sb-label">Colapsar</span>}
            </button>
          </div>
        )}
      </aside>

      {tip && rail && tip.path === location.pathname && (
        <div
          role="presentation"
          aria-hidden="true"
          data-sb="light"
          className="sb-surface sb-tip pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-lg border sb-line px-2.5 py-1.5 text-sm font-semibold shadow-lg"
          style={{ top: tip.top, left: tip.left }}
        >
          {tip.label}
        </div>
      )}
    </SidebarUiContext.Provider>
  );
};
