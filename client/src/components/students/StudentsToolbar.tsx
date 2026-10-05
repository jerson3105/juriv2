import type { ReactNode } from 'react';
import { ClipboardCheck, Heart, Moon, MoreHorizontal, PlayCircle, Search, Shield, X } from 'lucide-react';
import { usePopover } from '../../hooks/usePopover';
import { MenuCheck, Popover } from '../ui/Popover';
import type { ListFilter, StudentsView } from './studentsHelpers';

interface ClanOption {
  id: string;
  name: string;
  color: string;
}

interface StudentsToolbarProps {
  view: StudentsView;
  onViewChange: (view: StudentsView) => void;
  clansEnabled: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filter: ListFilter;
  onFilterChange: (filter: ListFilter) => void;
  clans: ClanOption[];
  clanFilter: string | null;
  onClanFilterChange: (clanId: string | null) => void;
  total: number;
  shown: number;
  /** Clase del colegio: «17 mujeres · 15 hombres» según el padrón (null si no hay el dato). */
  bySex?: string | null;
  projecting: boolean;
  /** null mientras carga el pulso de hoy. */
  unrecognized: number | null;
  resting: number;
  lowHp: number;
  absent: number;
  round: { pending: number; done: number } | null;
  /** «Pasar lista» solo mientras falte (y si la asistencia está activa). */
  attendance: { marked: number; onOpen: () => void } | null;
  onStartRound: (() => void) | null;
  levelUps: ReactNode;
  manage: ReactNode;
}

const VIEWS: { id: StudentsView; label: string }[] = [
  { id: 'ficha', label: 'Ficha' },
  { id: 'lista', label: 'Lista' },
  { id: 'clanes', label: 'Por clan' },
];

/**
 * Una sola barra para Ficha, Lista y Por clan: selector con texto, búsqueda y filtros siempre a la vista
 * (se acabó el estado invisible). Los chips de atención solo aparecen con N > 0 y nunca al proyectar.
 */
export const StudentsToolbar = (props: StudentsToolbarProps) => {
  const { view, onViewChange, search, onSearchChange, filter, onFilterChange, clanFilter, onClanFilterChange, projecting } = props;
  const { open: clanOpen, anchorRef: clanAnchor, close: closeClan, toggle: toggleClan } = usePopover();
  const { open: moreOpen, anchorRef: moreAnchor, close: closeMore, toggle: toggleMore } = usePopover();
  const filtered = search.trim() !== '' || filter !== 'all' || clanFilter !== null;
  const activeClan = props.clans.find((clan) => clan.id === clanFilter) ?? null;
  const toggle = (next: ListFilter) => onFilterChange(filter === next ? 'all' : next);
  const showAttendance = !!props.attendance && !projecting;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="pg-seg" role="group" aria-label="Vista">
          {VIEWS.filter((item) => item.id !== 'clanes' || props.clansEnabled).map((item) => (
            <button key={item.id} type="button" onClick={() => onViewChange(item.id)} aria-pressed={view === item.id} className="pg-seg-item">
              {item.label}
            </button>
          ))}
        </div>

        <label className="relative order-last w-full sm:order-none sm:w-64">
          <span className="sr-only">Buscar alumno</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 pg-fg2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar alumno"
            className="pg-focus h-10 w-full rounded-lg border bg-[var(--pg-surface)] pl-9 pr-3 text-sm pg-fg placeholder:text-[var(--pg-fg2)] border-[var(--pg-control)] [@media(pointer:coarse)]:h-11"
          />
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showAttendance && (
            <button type="button" onClick={props.attendance!.onOpen} className="pg-btn max-sm:hidden" title="Tomar asistencia de hoy">
              <ClipboardCheck size={16} aria-hidden="true" />
              Pasar lista
              {props.attendance!.marked > 0 && <span className="text-xs font-semibold pg-fg2">{props.attendance!.marked}/{props.total}</span>}
            </button>
          )}
          {props.levelUps}
          {props.manage}
          {(props.onStartRound || showAttendance) && (
            <>
              {/* En el celular «Pasar lista» vive aquí para que la barra quepa en una fila. */}
              <button
                ref={moreAnchor}
                type="button"
                onClick={toggleMore}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                aria-label="Más acciones de la clase"
                title="Más"
                className={`pg-icon-btn ${props.onStartRound ? '' : 'sm:hidden'}`}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              <Popover open={moreOpen} onClose={closeMore} anchorRef={moreAnchor} label="Más acciones">
                {showAttendance && (
                  <button type="button" onClick={() => { closeMore(); props.attendance?.onOpen(); }} className="pg-menu-item sm:hidden">
                    <ClipboardCheck size={16} aria-hidden="true" />
                    Pasar lista
                  </button>
                )}
                {props.onStartRound && (
                  <button type="button" onClick={() => { closeMore(); props.onStartRound?.(); }} className="pg-menu-item">
                    <PlayCircle size={16} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block">Pasar por todos</span>
                      <span className="block text-xs font-normal pg-fg2">Un toque por alumno con el mismo comportamiento</span>
                    </span>
                  </button>
                )}
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Filtros: en el celular, una sola línea que se desplaza de lado. */}
      <div className="flex items-center gap-2 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none] sm:flex-wrap" role="group" aria-label="Filtros">
        <button type="button" onClick={() => { onFilterChange('all'); onClanFilterChange(null); }} aria-pressed={!filtered} className="pg-chip">
          Todos ({props.total})
        </button>
        {props.round && (
          <>
            <button type="button" onClick={() => toggle('round_pending')} aria-pressed={filter === 'round_pending'} className="pg-chip">
              Faltan ({props.round.pending})
            </button>
            <button type="button" onClick={() => toggle('round_done')} aria-pressed={filter === 'round_done'} className="pg-chip">
              Ya pasaron ({props.round.done})
            </button>
          </>
        )}
        {!projecting && !!props.unrecognized && (
          <button type="button" onClick={() => toggle('unrecognized')} aria-pressed={filter === 'unrecognized'} className="pg-chip" title="Aún no reciben un comportamiento positivo hoy">
            <span className="pg-star" aria-hidden="true" />
            Sin reconocimiento hoy ({props.unrecognized})
          </button>
        )}
        {!projecting && props.resting > 0 && (
          <button type="button" onClick={() => toggle('resting')} aria-pressed={filter === 'resting'} className="pg-chip">
            <Moon size={14} className="fill-current pg-fix" aria-hidden="true" />
            Descansando ({props.resting})
          </button>
        )}
        {!projecting && props.lowHp > 0 && (
          <button type="button" onClick={() => toggle('low_hp')} aria-pressed={filter === 'low_hp'} className="pg-chip">
            <Heart size={14} className="fill-current pg-alert" aria-hidden="true" />
            Energía baja ({props.lowHp})
          </button>
        )}
        {!projecting && props.absent > 0 && (
          <button type="button" onClick={() => toggle('absent')} aria-pressed={filter === 'absent'} className="pg-chip">
            Ausentes hoy ({props.absent})
          </button>
        )}
        {props.clansEnabled && props.clans.length > 0 && (
          <>
            <button ref={clanAnchor} type="button" onClick={toggleClan} aria-expanded={clanOpen} aria-haspopup="dialog" aria-pressed={!!activeClan} className="pg-chip">
              <Shield size={14} aria-hidden="true" />
              {activeClan ? activeClan.name : 'Clan'}
            </button>
            <Popover open={clanOpen} onClose={closeClan} anchorRef={clanAnchor} label="Filtrar por clan" align="start">
              <div role="radiogroup" aria-label="Clan">
                <button type="button" role="radio" aria-checked={!clanFilter} onClick={() => { onClanFilterChange(null); closeClan(true); }} className="pg-menu-item">
                  Todos los clanes
                  <MenuCheck on={!clanFilter} />
                </button>
                {props.clans.map((clan) => (
                  <button key={clan.id} type="button" role="radio" aria-checked={clanFilter === clan.id} onClick={() => { onClanFilterChange(clan.id); closeClan(true); }} className="pg-menu-item">
                    <span className="h-4 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: clan.color }} aria-hidden="true" />
                    {clan.name}
                    <MenuCheck on={clanFilter === clan.id} />
                  </button>
                ))}
              </div>
            </Popover>
          </>
        )}
        {props.bySex && !projecting && <span className="text-sm pg-fg2">{props.bySex}</span>}
        {filtered && (
          <span className="inline-flex items-center gap-1 text-sm pg-fg2" role="status">
            {props.shown} de {props.total}
            <button type="button" onClick={() => { onSearchChange(''); onFilterChange('all'); onClanFilterChange(null); }} className="pg-btn pg-btn-ghost px-2" aria-label="Quitar búsqueda y filtros">
              <X size={14} aria-hidden="true" />
              Quitar filtros
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
