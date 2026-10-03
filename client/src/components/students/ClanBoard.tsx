import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Behavior } from '../../lib/behaviorApi';
import { clanVars } from '../../lib/storyTheme';
import { BehaviorMenu } from './BehaviorMenu';
import { TodayStar } from './studentsUi';
import { rowClick } from './studentsHelpers';
import type { RowPoints, StudentRow } from './StudentsTable';

export interface ClanColumn {
  id: string;
  name: string;
  color: string | null;
  emblem: string;
  motto: string | null;
  /** Miembros que pasan la búsqueda y los filtros. */
  rows: StudentRow[];
  /** Todos los miembros (para «Dar al clan» y las estrellas de hoy). */
  memberIds: string[];
  /** XP aportado esta semana; null mientras carga. */
  weekXp: number | null;
  /** Quiénes ganaron XP hoy; null al proyectar o mientras carga. */
  contributors: Set<string> | null;
}

interface ClanBoardProps {
  classroomId: string;
  clans: ClanColumn[];
  /** Sin clan: solo para el profe (nunca al proyectar). */
  unassigned: StudentRow[];
  projecting: boolean;
  selected: Set<string>;
  onToggle: (studentId: string) => void;
  onToggleMany: (studentIds: string[], select: boolean) => void;
  points: RowPoints;
  onGiveClan: (behavior: Behavior, memberIds: string[], clanName: string) => void;
  onOpenAllClan: (memberIds: string[], positive: boolean) => void;
  onOpenFicha: (studentId: string) => void;
}

const ClanCheck = ({ name, ids, selected, onToggleMany }: { name: string; ids: string[]; selected: Set<string>; onToggleMany: ClanBoardProps['onToggleMany'] }) => {
  const ref = useRef<HTMLInputElement>(null);
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <input ref={ref} type="checkbox" checked={all} onChange={() => onToggleMany(ids, !all)} disabled={ids.length === 0} className="pg-check" aria-label={`Seleccionar a todo el clan ${name}`} />
  );
};

/**
 * Vista Por clan: los clanes como equipos, en columnas. Cabecera neutra con la franja y el emblema del clan,
 * lo aportado esta semana (nunca el total histórico), quién aportó hoy (solo el profe) y «Dar al clan».
 * Filas mínimas, sin avatar ni puntos.
 */
export const ClanBoard = ({ classroomId, clans, unassigned, projecting, selected, onToggle, onToggleMany, points, onGiveClan, onOpenAllClan, onOpenFicha }: ClanBoardProps) => {
  if (clans.length === 0) {
    return (
      <div className="pg-surface px-4 py-10 text-center">
        <p className="text-sm pg-fg">Esta clase aún no tiene clanes.</p>
        <Link to={`/classroom/${classroomId}/clans`} className="pg-btn mt-3">
          Crear clanes <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-selecting={selected.size > 0}>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
        {clans.map((clan) => {
          const contributed = clan.contributors ? clan.memberIds.filter((id) => clan.contributors!.has(id)).length : 0;
          return (
            <section key={clan.id} aria-labelledby={`clan-${clan.id}`} className="pg-surface flex flex-col overflow-hidden" style={clanVars(clan.color)}>
              <span className="h-1 flex-shrink-0 pg-clan-stripe" aria-hidden="true" />
              <div className="space-y-2 border-b px-3 py-3 pg-line">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-2xl pg-clan-tint" aria-hidden="true">{clan.emblem}</span>
                  <div className="min-w-0 flex-1">
                    <h3 id={`clan-${clan.id}`} className="truncate text-lg font-semibold pg-fg">{clan.name}</h3>
                    {clan.motto && <p className="truncate text-sm italic pg-fg2">«{clan.motto}»</p>}
                  </div>
                  <span className="flex-shrink-0 text-sm pg-fg2">{clan.memberIds.length}</span>
                  {!projecting && <ClanCheck name={clan.name} ids={clan.rows.map((row) => row.student.id)} selected={selected} onToggleMany={onToggleMany} />}
                </div>
                {clan.weekXp !== null && (
                  <p className="text-sm pg-fg2">
                    Esta semana <strong className="font-bold pg-clan-ink">+{clan.weekXp.toLocaleString('es')} XP</strong>
                  </p>
                )}
                {clan.contributors && clan.memberIds.length > 0 && (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm pg-fg2">
                    <span className="flex flex-wrap items-center" aria-hidden="true">
                      {clan.memberIds.map((id) => <span key={id} className="pg-star" data-lit={clan.contributors!.has(id)} />)}
                    </span>
                    Aportaron hoy {contributed} de {clan.memberIds.length}
                  </p>
                )}
                <BehaviorMenu
                  mode="clan"
                  target={clan.name}
                  positives={points.positives}
                  negatives={[]}
                  totalPositives={points.totalPositives}
                  totalNegatives={0}
                  disabled={points.applying || clan.memberIds.length === 0}
                  onApply={(behavior) => onGiveClan(behavior, clan.memberIds, clan.name)}
                  onOpenAll={(positive) => onOpenAllClan(clan.memberIds, positive)}
                  align="start"
                />
              </div>
              <ul className="flex-1">
                {clan.rows.map((row) => {
                  const isSelected = selected.has(row.student.id);
                  return (
                    <li key={row.student.id} className="pg-row pg-reveal flex min-h-[40px] items-center gap-2 border-b px-3 last:border-b-0" data-selected={isSelected} onClick={rowClick(row.student.id, onToggle)}>
                      <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.student.id)} className="pg-check" aria-label={`Seleccionar a ${row.name}`} />
                      <span className="w-6 flex-shrink-0 text-center text-lg leading-none" title={row.role?.name ?? 'Sin rol'} aria-hidden="true">{row.role?.icon ?? '·'}</span>
                      <button type="button" onClick={() => onOpenFicha(row.student.id)} className="pg-row-link min-w-0 flex-1 truncate py-2 text-sm font-semibold pg-fg" title={`Abrir la ficha de ${row.name}`}>
                        {row.name}
                      </button>
                      <span className="flex-shrink-0 text-sm tabular-nums pg-fg2">Nv {row.student.level}</span>
                      {clan.contributors && (
                        <TodayStar lit={clan.contributors.has(row.student.id)} label={clan.contributors.has(row.student.id) ? 'Aportó al clan hoy' : 'Aún no aporta hoy'} />
                      )}
                    </li>
                  );
                })}
                {clan.rows.length === 0 && <li className="px-3 py-4 text-sm pg-fg2">Nadie de este clan con este filtro.</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {!projecting && unassigned.length > 0 && (
        <p className="text-sm pg-fg2">
          <span className="font-semibold pg-fg">Por asignar ({unassigned.length}):</span>{' '}
          {unassigned.map((row) => row.name).join(', ')}{' '}
          <Link to={`/classroom/${classroomId}/clans`} className="whitespace-nowrap font-semibold text-primary-800 underline-offset-2 hover:underline dark:text-primary-200">
            Asignar en Clanes ›
          </Link>
        </p>
      )}
    </div>
  );
};
