import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { SchoolYearStatus, SchoolYearSummary } from '../../../lib/schoolYearApi';
import { formatRange } from './schoolYearHelpers';

const STATUS: Record<SchoolYearStatus, { text: string; className: string }> = {
  ACTIVE: { text: 'Activo', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' },
  PLANNING: { text: 'Borrador', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  CLOSED: { text: 'Archivado', className: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
};

export const YearStatusChip = ({ status }: { status: SchoolYearStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[status].className}`}>{STATUS[status].text}</span>
);

interface YearMenuProps {
  schoolId: string;
  years: SchoolYearSummary[];
  selected: SchoolYearSummary | null;
  onSelect: (yearId: string) => void;
  manager: boolean;
}

/**
 * Selector de año en la barra de la consola: el activo, el que se prepara (borrador) y los archivados (solo para
 * consultar). Lo que se elige es el año que miran las páginas de la consola. La administración prepara desde aquí el
 * año siguiente.
 */
export const YearMenu = ({ schoolId, years, selected, onSelect, manager }: YearMenuProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = years.filter((year) => year.status !== 'CLOSED');
  const archived = years.filter((year) => year.status === 'CLOSED');
  // El siguiente al último (la lista llega del más nuevo al más antiguo); uno a la vez.
  const next = years.length > 0 && !years.some((year) => year.status === 'PLANNING') ? String(Number(years[0].name) + 1) : null;
  const choose = (yearId: string) => {
    onSelect(yearId);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const item = (year: SchoolYearSummary) => (
    <li key={year.id}>
      <button
        type="button"
        aria-pressed={selected?.id === year.id}
        onClick={() => choose(year.id)}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span className="w-4 flex-shrink-0" aria-hidden="true">{selected?.id === year.id && <Check size={16} />}</span>
        <b>{year.name}</b>
        <YearStatusChip status={year.status} />
        <span className="ml-auto text-xs text-gray-600 dark:text-gray-300">{formatRange(year.startsOn, year.endsOn)}</span>
      </button>
    </li>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        {selected ? (
          <>
            <span>Año escolar <b>{selected.name}</b></span>
            <YearStatusChip status={selected.status} />
          </>
        ) : (
          <span>Año escolar <b>sin preparar</b></span>
        )}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-gray-200 bg-white p-2 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Año escolar</p>
          {current.length > 0 ? (
            <ul>{current.map(item)}</ul>
          ) : years.length === 0 ? (
            <p className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300">
              Aún no hay año escolar.{' '}
              {manager && (
                <Link to={`/escuela/${schoolId}/anio`} onClick={() => setOpen(false)} className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">
                  Prepararlo
                </Link>
              )}
            </p>
          ) : (
            <p className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300">Ningún año en curso.</p>
          )}
          {manager && next && (
            <Link
              to={`/escuela/${schoolId}/anio?preparar=1`}
              onClick={() => setOpen(false)}
              className="mt-1 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-gray-100 dark:text-primary-300 dark:hover:bg-gray-700"
            >
              <Plus size={16} aria-hidden="true" />
              Preparar {next}
            </Link>
          )}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Archivados</p>
          {archived.length > 0 ? (
            <ul>{archived.map(item)}</ul>
          ) : (
            <p className="px-2 pb-2 text-sm text-gray-700 dark:text-gray-300">Aún no hay años archivados. Al cerrar el año quedará aquí, solo para consultar.</p>
          )}
        </div>
      )}
    </div>
  );
};
