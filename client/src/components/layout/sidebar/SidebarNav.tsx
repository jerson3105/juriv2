import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Sparkle } from './ClassSeal';
import { groupBadge, type NavBadge, type NavGroup, type NavItem, type NavNode, type NavSection } from './navTypes';
import { useSidebarUi } from './sidebarContext';
import { SidebarFlyout } from './sidebarUi';

export const Badge = ({ badge }: { badge: NavBadge }) => {
  switch (badge.kind) {
    case 'count':
      return (
        <span key={badge.value} className="sb-count sb-pop">
          <span aria-hidden="true">{badge.value}</span>
          <span className="sr-only">{badge.label}</span>
        </span>
      );
    case 'chip':
      return (
        <span className="sb-chip sb-pop">
          <span aria-hidden="true">{badge.text}</span>
          <span className="sr-only">{badge.label}</span>
        </span>
      );
    case 'gold':
      return <span className="sb-gold">{badge.value.toLocaleString('es')} de oro</span>;
    case 'dot':
      return (
        <span className="sb-dot sb-pop">
          <span className="sr-only">{badge.label}</span>
        </span>
      );
  }
};

/** En el carril: el número o el punto sobre el ícono. */
const RailBadge = ({ badge }: { badge: NavBadge }) => {
  if (badge.kind === 'count') {
    return (
      <span className="sb-count sb-pop absolute -bottom-2 -right-2.5">
        <span aria-hidden="true">{badge.value}</span>
        <span className="sr-only">{badge.label}</span>
      </span>
    );
  }
  if (badge.kind === 'gold') return null;
  return (
    <span className="sb-dot sb-pop absolute -bottom-0.5 -right-0.5 ring-2 ring-[color:var(--sb-bg)]">
      <span className="sr-only">{badge.label}</span>
    </span>
  );
};

/**
 * Posición vertical de un ítem dentro de su lista, por layout (sin transform). No basta offsetTop: mientras
 * una fila anima (la cascada al abrir el grupo), la fila pasa a ser el offsetParent y offsetTop vale 0.
 */
const offsetWithin = (element: HTMLElement, container: HTMLElement) => {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== container) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === container ? top : element.getBoundingClientRect().top - container.getBoundingClientRect().top;
};

interface NavListProps {
  items: NavItem[];
  /** Dentro de un grupo: la guía nace bajo el ícono del grupo. */
  inGroup?: boolean;
  speed: 'normal' | 'fast';
  onNavigate: () => void;
  labelledBy?: string;
  /** El menú está a la vista (para llevar el ítem activo a la vista sin mover la página). */
  visible?: boolean;
}

/**
 * Una lista como constelación: guía tenue, una estrella apagada por página y el destello dorado de la
 * página actual, que se desliza cuando cambias de página dentro de la lista (o aparece con un «pop» si
 * llegas desde otra).
 */
export const NavList = ({ items, inGroup = false, speed, onNavigate, labelledBy, visible = true }: NavListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const lastY = useRef<number | null>(null);
  const activeId = items.find((item) => item.active)?.id ?? null;

  useLayoutEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    if (!list || !marker) return;
    const target = activeId ? list.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(activeId)}"]`) : null;
    if (!target) {
      marker.classList.remove('sb-marker-pop');
      marker.style.opacity = '0';
      lastY.current = null;
      return;
    }
    const y = offsetWithin(target, list) + target.offsetHeight / 2;
    if (lastY.current === null) {
      marker.style.transition = 'none';
      marker.style.transform = `translateY(${y}px)`;
      void marker.offsetHeight;
      marker.style.transition = '';
      marker.classList.remove('sb-marker-pop');
      void marker.offsetWidth;
      marker.classList.add('sb-marker-pop');
    } else {
      marker.style.transform = `translateY(${y}px)`;
    }
    marker.style.opacity = '1';
    lastY.current = y;
    if (visible) target.scrollIntoView({ block: 'nearest' });
  }, [activeId, items.length, visible]);

  return (
    <div ref={listRef} className="sb-list" data-in-group={inGroup}>
      <span className="sb-guide" aria-hidden="true" />
      <span ref={markerRef} className="sb-marker" data-speed={speed} aria-hidden="true">
        <Sparkle className="h-full w-full" />
      </span>
      <ul aria-labelledby={labelledBy}>
      {items.map((item, index) => (
        <li key={item.id} style={{ '--i': index } as CSSProperties}>
          <Link
            to={item.to}
            data-nav-id={item.id}
            aria-current={item.active ? 'page' : undefined}
            className="sb-item"
            onClick={() => {
              item.onSelect?.();
              onNavigate();
            }}
          >
            <span className="sb-star-off" aria-hidden="true" />
            <span className="sb-icon">{item.icon}</span>
            <span className="sb-label min-w-0 flex-1 line-clamp-2">{item.label}</span>
            {item.badge && <Badge badge={item.badge} />}
          </Link>
        </li>
      ))}
      </ul>
    </div>
  );
};

/** Ítem suelto con su ícono en tesela; la página actual lleva el destello en la esquina. */
const TopLink = ({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) => (
  <Link
    to={item.to}
    aria-current={item.active ? 'page' : undefined}
    className="sb-item"
    onClick={() => {
      item.onSelect?.();
      onNavigate();
    }}
  >
    <span className="sb-tile relative">
      {item.icon}
      {item.active && <Sparkle className="sb-tile-star sb-marker-pop" />}
    </span>
    <span className="sb-label min-w-0 flex-1 line-clamp-2">{item.label}</span>
    {item.badge && <Badge badge={item.badge} />}
  </Link>
);

interface GroupBlockProps {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  speed: 'normal' | 'fast';
  onNavigate: () => void;
  visible: boolean;
}

const GroupBlock = ({ group, open, onToggle, speed, onNavigate, visible }: GroupBlockProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [cascade, setCascade] = useState(false);
  const hasActive = group.items.some((item) => item.active);
  const badge = open ? undefined : groupBadge(group.items);
  const panelId = `sb-group-${group.id}`;

  // Cerrado: fuera del orden de tabulación y del lector.
  useEffect(() => {
    panelRef.current?.toggleAttribute('inert', !open);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="sb-item"
        aria-expanded={open}
        aria-controls={panelId}
        data-has-active={hasActive}
        onClick={() => {
          setCascade(true);
          onToggle();
        }}
      >
        <span className="sb-tile">{group.icon}</span>
        <span className="sb-label min-w-0 flex-1 truncate font-semibold">{group.label}</span>
        {badge && <Badge badge={badge} />}
        <ChevronDown size={16} className="sb-chevron flex-shrink-0" data-open={open} aria-hidden="true" />
      </button>
      <div className="sb-panel" data-open={open} data-cascade={cascade}>
        <div ref={panelRef} id={panelId}>
          <NavList items={group.items} inGroup speed={speed} onNavigate={onNavigate} visible={visible && open} />
        </div>
      </div>
    </>
  );
};

interface NavTreeProps {
  nodes: NavNode[];
  speed: 'normal' | 'fast';
  onNavigate: () => void;
  openGroups?: { isOpen: (id: string) => boolean; toggle: (id: string) => void };
  visible: boolean;
}

/** El menú expandido. */
export const NavTree = ({ nodes, speed, onNavigate, openGroups, visible }: NavTreeProps) => (
  <ul className="space-y-0.5">
    {nodes.map((node) => {
      if (node.kind === 'link') {
        return (
          <li key={node.item.id}>
            <TopLink item={node.item} onNavigate={onNavigate} />
          </li>
        );
      }
      if (node.kind === 'section') {
        const titleId = `sb-section-${node.id}`;
        return (
          <li key={node.id}>
            <p id={titleId} className="sb-section-title sb-label">{node.label}</p>
            <NavList items={node.items} speed={speed} onNavigate={onNavigate} labelledBy={titleId} visible={visible} />
          </li>
        );
      }
      return (
        <li key={node.id}>
          <GroupBlock
            group={node}
            open={openGroups?.isOpen(node.id) ?? true}
            onToggle={() => openGroups?.toggle(node.id)}
            speed={speed}
            onNavigate={onNavigate}
            visible={visible}
          />
        </li>
      );
    })}
  </ul>
);

// ── Carril colapsado ────────────────────────────────────────────────────────────────────────────

const RailLink = ({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) => {
  const { showTip, hideTip } = useSidebarUi();
  return (
    <Link
      to={item.to}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      className="sb-item justify-center px-0"
      onMouseEnter={(event) => showTip(event.currentTarget, item.label)}
      onMouseLeave={hideTip}
      onFocus={(event) => showTip(event.currentTarget, item.label, true)}
      onBlur={hideTip}
      onClick={() => {
        hideTip();
        item.onSelect?.();
        onNavigate();
      }}
    >
      <span className="sb-tile relative">
        {item.icon}
        {item.active && <Sparkle className="sb-tile-star sb-marker-pop" />}
        {item.badge && <RailBadge badge={item.badge} />}
      </span>
    </Link>
  );
};

/** Un grupo o sección en el carril: al tocarlo, sus páginas flotan al lado (antes no pasaba nada). */
const RailGroup = ({ node, speed }: { node: NavGroup | NavSection; speed: 'normal' | 'fast' }) => {
  const { showTip, hideTip } = useSidebarUi();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasActive = node.items.some((item) => item.active);
  const badge = groupBadge(node.items);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={node.label}
        aria-expanded={open}
        data-has-active={hasActive}
        className="sb-item justify-center px-0"
        onMouseEnter={(event) => !open && showTip(event.currentTarget, node.label)}
        onMouseLeave={hideTip}
        onFocus={(event) => !open && showTip(event.currentTarget, node.label, true)}
        onBlur={hideTip}
        onClick={() => {
          hideTip();
          setOpen((value) => !value);
        }}
      >
        <span className="sb-tile relative">
          {node.icon}
          {hasActive && <Sparkle className="sb-tile-star sb-marker-pop" />}
          {badge && <RailBadge badge={badge} />}
        </span>
      </button>
      {open && (
        <SidebarFlyout
          anchorRef={triggerRef}
          label={node.label}
          width={256}
          onClose={(restore) => {
            setOpen(false);
            if (restore) triggerRef.current?.focus();
          }}
        >
          <p className="sb-section-title pt-1">{node.label}</p>
          <NavList items={node.items} speed={speed} onNavigate={() => setOpen(false)} />
        </SidebarFlyout>
      )}
    </>
  );
};

export const RailNav = ({ nodes, speed, onNavigate }: { nodes: NavNode[]; speed: 'normal' | 'fast'; onNavigate: () => void }) => (
  <ul className="space-y-1">
    {nodes.map((node) => (
      <li key={node.kind === 'link' ? node.item.id : node.id}>
        {node.kind === 'link' ? <RailLink item={node.item} onNavigate={onNavigate} /> : <RailGroup node={node} speed={speed} />}
      </li>
    ))}
  </ul>
);
