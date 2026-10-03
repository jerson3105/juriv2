import { useEffect, useRef } from 'react';
import type { Behavior } from '../../lib/behaviorApi';
import type { Student } from '../../lib/classroomApi';
import { BehaviorMenu, GiveButton } from './BehaviorMenu';
import { ClanTag, ExceptionTags, TodayStar } from './studentsUi';
import { rowClick, type AttendanceMark, type EnergyState, type Role } from './studentsHelpers';

export interface StudentRow {
  student: Student;
  name: string;
  secondary: string | null;
  role: Role | null;
  /** Ya vienen en null al proyectar. */
  energy: EnergyState;
  attendance: AttendanceMark;
  /** null = no se muestra (proyectando o aún cargando). */
  recognized: boolean | null;
  roundCount: number;
}

/** Lo que comparten la Lista y Por clan para dar puntos desde una fila. */
export interface RowPoints {
  /** El botón de la fila: el fijado, el más usado o el de «Pasar por todos». */
  behavior: Behavior | null;
  positives: Behavior[];
  negatives: Behavior[];
  totalPositives: number;
  totalNegatives: number;
  pinnedId: string | null;
  onPin: ((id: string | null) => void) | undefined;
  applying: boolean;
  onApply: (behavior: Behavior, studentId: string) => void;
  onOpenAll: (studentId: string, positive: boolean) => void;
  onBadge: (studentId: string) => void;
  onProfile: (studentId: string) => void;
}

interface StudentsTableProps {
  rows: StudentRow[];
  clansEnabled: boolean;
  projecting: boolean;
  selected: Set<string>;
  onToggle: (studentId: string) => void;
  onToggleAll: () => void;
  points: RowPoints;
  onOpenFicha: (studentId: string) => void;
  onRecovery: (studentId: string) => void;
  emptyMessage: string;
}

// Casilla «Todos»: marcada, a medias (indeterminate) o vacía.
const SelectAll = ({ checked, partial, count, onChange }: { checked: boolean; partial: boolean; count: number; onChange: () => void }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="pg-check" aria-label={`Seleccionar a todos (${count})`} />
  );
};

const RowGive = ({ row, points, wrap }: { row: StudentRow; points: RowPoints; wrap?: boolean }) =>
  points.behavior ? (
    <GiveButton
      behavior={points.behavior}
      studentName={row.name}
      onApply={(behavior) => points.onApply(behavior, row.student.id)}
      disabled={points.applying}
      count={row.roundCount}
      wrap={wrap}
    />
  ) : null;

const RowMore = ({ row, points }: { row: StudentRow; points: RowPoints }) => (
  <BehaviorMenu
    mode="more"
    target={row.name}
    positives={points.positives}
    negatives={points.negatives}
    totalPositives={points.totalPositives}
    totalNegatives={points.totalNegatives}
    pinnedId={points.pinnedId}
    onPin={points.onPin}
    disabled={points.applying}
    onApply={(behavior) => points.onApply(behavior, row.student.id)}
    onOpenAll={(positive) => points.onOpenAll(row.student.id, positive)}
    onBadge={() => points.onBadge(row.student.id)}
    onProfile={() => points.onProfile(row.student.id)}
  />
);

const RoleIcon = ({ role }: { role: Role | null }) => (
  <span className="w-6 flex-shrink-0 text-center text-lg leading-none" title={role?.name ?? 'Sin rol'} aria-hidden="true">
    {role?.icon ?? '·'}
  </span>
);

/** Vista Lista: una fila por alumno con lo mínimo (rol, nombre, clan, nivel, hoy) y lo excepcional en texto. */
export const StudentsTable = ({ rows, clansEnabled, projecting, selected, onToggle, onToggleAll, points, onOpenFicha, onRecovery, emptyMessage }: StudentsTableProps) => {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.student.id));
  const someSelected = !allSelected && rows.some((row) => selected.has(row.student.id));
  const recognizedLabel = (recognized: boolean) => (recognized ? 'Reconocido hoy' : 'Sin reconocimiento hoy');

  const nameCell = (row: StudentRow) => (
    <span className="flex min-w-0 items-center gap-2">
      <RoleIcon role={row.role} />
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <button type="button" onClick={() => onOpenFicha(row.student.id)} className="pg-row-link truncate text-sm font-semibold pg-fg" title={`Abrir la ficha de ${row.name}`}>
            {row.name}
          </button>
          {row.secondary && <span className="truncate text-xs pg-fg2">{row.secondary}</span>}
        </span>
      </span>
    </span>
  );

  const exceptions = (row: StudentRow) => (
    <>
      <ExceptionTags energy={row.energy} hp={row.student.hp} attendance={row.attendance} />
      {row.energy === 'resting' && (
        <button type="button" onClick={() => onRecovery(row.student.id)} className="pg-btn pg-btn-ghost pg-fix px-2 text-xs underline-offset-2 hover:underline">
          Misión de recuperación
        </button>
      )}
    </>
  );

  if (rows.length === 0) {
    return <p className="pg-surface px-4 py-10 text-center text-sm pg-fg2">{emptyMessage}</p>;
  }

  return (
    <div className="pg-surface overflow-hidden" data-selecting={selected.size > 0}>
      {/* Escritorio y tableta: tabla de filas de 48 px */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b pg-line text-left text-xs font-semibold uppercase tracking-wide pg-fg2">
            <th scope="col" className="w-12 py-2 pl-4">
              <SelectAll checked={allSelected} partial={someSelected} count={rows.length} onChange={onToggleAll} />
            </th>
            <th scope="col" className="py-2 pr-3">Alumno</th>
            {clansEnabled && <th scope="col" className="w-44 py-2 pr-3">Clan</th>}
            <th scope="col" className="w-16 py-2 pr-3 text-center">Nivel</th>
            {!projecting && <th scope="col" className="w-14 py-2 pr-3 text-center">Hoy</th>}
            <th scope="col" className="py-2 pr-3 text-right"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selected.has(row.student.id);
            return (
              <tr key={row.student.id} className="pg-row pg-reveal border-b last:border-b-0" data-selected={isSelected} onClick={rowClick(row.student.id, onToggle)}>
                <td className="py-1 pl-4">
                  <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.student.id)} className="pg-check" aria-label={`Seleccionar a ${row.name}`} />
                </td>
                <td className="py-1.5 pr-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                    {nameCell(row)}
                    {exceptions(row)}
                  </span>
                </td>
                {clansEnabled && (
                  <td className="py-1.5 pr-3">
                    {row.student.clanName
                      ? <ClanTag name={row.student.clanName} color={row.student.clanColor} />
                      : !projecting && <span className="text-sm pg-fg2">Por asignar</span>}
                  </td>
                )}
                <td className="py-1.5 pr-3 text-center text-sm font-semibold tabular-nums pg-fg">{row.student.level}</td>
                {!projecting && (
                  <td className="py-1.5 pr-3 text-center">
                    {row.recognized !== null && <TodayStar lit={row.recognized} label={recognizedLabel(row.recognized)} />}
                  </td>
                )}
                <td className="py-1.5 pr-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    <RowGive row={row} points={points} />
                    <RowMore row={row} points={points} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Celular: tarjetas de dos líneas, sin tabla ni desplazamiento lateral */}
      <div className="md:hidden">
        <label className="flex min-h-[44px] items-center gap-3 border-b px-3 text-sm font-semibold pg-line pg-fg">
          <SelectAll checked={allSelected} partial={someSelected} count={rows.length} onChange={onToggleAll} />
          Todos ({rows.length})
        </label>
        <ul>
          {rows.map((row) => {
            const isSelected = selected.has(row.student.id);
            return (
              <li key={row.student.id} className="pg-row border-b px-3 py-2 last:border-b-0" data-selected={isSelected}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isSelected} onChange={() => onToggle(row.student.id)} className="pg-check" aria-label={`Seleccionar a ${row.name}`} />
                  <span className="min-w-0 flex-1">{nameCell(row)}</span>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums pg-fg2">Nv {row.student.level}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-7">
                  <span className="flex max-w-[45%] flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {row.student.clanName && clansEnabled && <ClanTag name={row.student.clanName} color={row.student.clanColor} />}
                    {exceptions(row)}
                    {!projecting && row.recognized !== null && <TodayStar lit={row.recognized} label={recognizedLabel(row.recognized)} />}
                  </span>
                  <RowGive row={row} points={points} wrap />
                  <RowMore row={row} points={points} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
