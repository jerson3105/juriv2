import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Info, Plus, Search, Upload } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { byName, gradeLabel, LEVEL_GRADES, sectionName } from '../../components/schools/console/sectionHelpers';
import { ageOf, initialsOf, maskedDocument, rosterName } from '../../components/schools/console/rosterHelpers';
import { StudentDrawer, type DrawerState } from '../../components/schools/console/StudentDrawer';
import { UndoBuildBanner } from '../../components/schools/console/UndoBuildBanner';
import { UndoImportBanner } from '../../components/schools/console/UndoImportBanner';
import { schoolRosterApi, schoolRosterKeys, type RosterFilter, type RosterQuery } from '../../lib/schoolRosterApi';
import { rosterImportApi } from '../../lib/schoolRosterImportApi';
import { schoolSectionApi, schoolSectionKeys } from '../../lib/schoolSectionApi';
import type { SchoolLevel } from '../../lib/schoolYearApi';

const FILTERS: { id: RosterFilter; label: string; attention?: boolean }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'no_section', label: 'Sin sección', attention: true },
  { id: 'incomplete', label: 'Datos por completar', attention: true },
  { id: 'withdrawn', label: 'Retirados', attention: true },
];
const select = 'pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/** Padrón del año: chips de estado, filtros, búsqueda por nombre o DNI completo, y la ficha en un cajón. */
export const SchoolStudentsPage = () => {
  const { school, activeYear, yearsLoading } = useSchoolConsole();
  const yearId = activeYear?.id ?? '';
  const [params, setParams] = useSearchParams();
  const query: RosterQuery = {
    filter: (FILTERS.some((f) => f.id === params.get('filtro')) ? params.get('filtro') : 'all') as RosterFilter,
    level: (['INICIAL', 'PRIMARIA', 'SECUNDARIA'].includes(params.get('nivel') ?? '') ? params.get('nivel') : undefined) as SchoolLevel | undefined,
    grade: Number(params.get('grado')) || undefined,
    sectionId: params.get('seccion') || undefined,
    q: params.get('q') || undefined,
    page: Math.max(1, Number(params.get('pagina')) || 1),
  };
  const [search, setSearch] = useState(query.q ?? '');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const template = useMutation({
    mutationFn: () => rosterImportApi.downloadTemplate(school.id, yearId, activeYear?.name ?? ''),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo descargar la plantilla')),
  });

  const sections = useQuery({ queryKey: schoolSectionKeys.list(school.id, yearId), queryFn: () => schoolSectionApi.list(school.id, yearId), enabled: !!activeYear });
  const roster = useQuery({
    queryKey: schoolRosterKeys.list(school.id, yearId, query),
    queryFn: () => schoolRosterApi.list(school.id, yearId, query),
    enabled: !!activeYear,
    placeholderData: (previous) => previous,
  });
  const allSections = useMemo(() => [...(sections.data ?? [])].sort((a, b) => a.level.localeCompare(b.level) || a.grade - b.grade || byName(a, b)), [sections.data]);

  const setParam = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('pagina' in changes)) next.delete('pagina');
    setParams(next, { replace: true });
  };

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams((previous) => {
        const value = search.trim();
        if ((previous.get('q') ?? '') === value) return previous;
        const next = new URLSearchParams(previous);
        if (value) next.set('q', value);
        else next.delete('q');
        next.delete('pagina');
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, setParams]);

  if (yearsLoading) return <div className="mx-auto h-64 max-w-6xl animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando" />;
  if (!activeYear) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">📅</span><span className="text-5xl">🎒</span><span className="text-4xl">✏️</span></div>
        <h1 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Primero prepara el año escolar</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">El padrón es de un año: elige sus fechas, periodos y niveles.</p>
        <Link to={`/escuela/${school.id}/anio`} className={`${primaryButton} mt-5`}>Preparar el año</Link>
      </div>
    );
  }

  const data = roster.data;
  const counts = data?.counts;
  const filtered = !!(query.level || query.grade || query.sectionId || query.q);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const gradesForLevel = query.level ? LEVEL_GRADES[query.level] : [];
  const sectionsForFilter = allSections.filter((s) => (!query.level || s.level === query.level) && (!query.grade || s.grade === query.grade));
  const emptyRoster = !!counts && counts.all === 0 && counts.withdrawn === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Estudiantes</h1>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            {counts ? `${counts.all} en el padrón ${activeYear.name}${counts.incomplete ? ` · ${counts.incomplete} con datos por completar` : ''}` : `Padrón ${activeYear.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/escuela/${school.id}/estudiantes/armar`} className="pg-btn pg-focus">Armar desde clases</Link>
          <Link to={`/escuela/${school.id}/estudiantes/importar`} className="pg-btn pg-focus">
            <Upload size={16} aria-hidden="true" />
            Importar
          </Link>
          <button type="button" className={primaryButton} onClick={() => setDrawer({ mode: 'create' })}>
            <Plus size={16} aria-hidden="true" />
            Agregar estudiante
          </button>
        </div>
      </header>

      <UndoBuildBanner schoolId={school.id} yearId={yearId} />
      <UndoImportBanner schoolId={school.id} yearId={yearId} />

      {data && !data.piiReady && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-50" role="status">
          <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          El servidor aún no tiene las llaves para guardar documentos: puedes armar el padrón, pero los DNI se cargarán cuando estén listas.
        </p>
      )}

      {emptyRoster ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">🎒</span><span className="text-5xl">📋</span><span className="text-4xl">🏫</span></div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Arma el padrón de {activeYear.name}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Únelo desde las clases que ya existen, o importa la nómina del SIAGIE o nuestra plantilla. Los estudiantes no ven ningún cambio.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to={`/escuela/${school.id}/estudiantes/armar`} className={primaryButton}>Armar desde clases</Link>
            <Link to={`/escuela/${school.id}/estudiantes/importar`} className="pg-btn pg-focus">
              <Upload size={16} aria-hidden="true" />
              Importar lista
            </Link>
            <button type="button" className="pg-btn pg-focus" onClick={() => setDrawer({ mode: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              Agregar a mano
            </button>
          </div>
          <button type="button" className="pg-focus mt-4 rounded text-sm font-semibold text-primary-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-primary-300" onClick={() => template.mutate()} disabled={template.isPending}>
            {template.isPending ? 'Preparando la plantilla…' : 'Descargar plantilla (.xlsx)'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar el padrón">
            {FILTERS.filter((f) => !f.attention || (counts?.[f.id] ?? 0) > 0 || query.filter === f.id).map((f) => (
              <button key={f.id} type="button" className="pg-chip pg-focus" aria-pressed={query.filter === f.id} onClick={() => setParam({ filtro: f.id === 'all' ? undefined : f.id })}>
                {f.label} <span className="tabular-nums opacity-80">{counts?.[f.id] ?? '—'}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[14rem] flex-1">
              <span className="sr-only">Buscar por nombre o DNI completo</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o DNI completo"
                className="pg-focus min-h-[40px] w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <select aria-label="Nivel" className={select} value={query.level ?? ''} onChange={(e) => setParam({ nivel: e.target.value || undefined, grado: undefined, seccion: undefined })}>
              <option value="">Todos los niveles</option>
              {(['INICIAL', 'PRIMARIA', 'SECUNDARIA'] as SchoolLevel[]).filter((l) => allSections.some((s) => s.level === l)).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            {query.level && (
              <select aria-label="Grado" className={select} value={query.grade ?? ''} onChange={(e) => setParam({ grado: e.target.value || undefined, seccion: undefined })}>
                <option value="">Todos los grados</option>
                {gradesForLevel.map((g) => <option key={g} value={g}>{gradeLabel(query.level!, g)}</option>)}
              </select>
            )}
            <select aria-label="Sección" className={select} value={query.sectionId ?? ''} onChange={(e) => setParam({ seccion: e.target.value || undefined })}>
              <option value="">Todas las secciones</option>
              {sectionsForFilter.map((s) => <option key={s.id} value={s.id}>{sectionName(s)}{query.level ? '' : ` · ${LEVEL_LABEL[s.level]}`}</option>)}
            </select>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            {data ? `${data.total} ${data.total === 1 ? 'estudiante' : 'estudiantes'} · por apellidos` : 'Cargando…'}
            {filtered && (
              <>
                {' · '}
                <button type="button" className="pg-focus rounded font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" onClick={() => { setSearch(''); setParam({ q: undefined, nivel: undefined, grado: undefined, seccion: undefined }); }}>
                  Quitar filtros
                </button>
              </>
            )}
          </p>

          {roster.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
              <p className="font-semibold text-red-900 dark:text-red-100">No se pudo cargar el padrón.</p>
              <button type="button" onClick={() => void roster.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
              Ningún estudiante coincide.{' '}
              {filtered && <button type="button" className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" onClick={() => { setSearch(''); setParam({ q: undefined, nivel: undefined, grado: undefined, seccion: undefined }); }}>Quitar filtros</button>}
            </div>
          ) : (
            <div className="pg-surface overflow-hidden">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Padrón {activeYear.name}, página {query.page} de {pages}</caption>
                <thead className="hidden border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300 md:table-header-group">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Estudiante</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Documento</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Sección</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Edad</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Clases</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(data?.items ?? []).map((s) => {
                    const age = ageOf(s.birthDate);
                    return (
                      <tr key={s.id} className="block cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 md:table-row" onClick={() => setDrawer({ mode: 'view', studentId: s.id })}>
                        <td className="block px-4 pt-3 md:table-cell md:py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-900 dark:bg-primary-500/20 dark:text-primary-100" aria-hidden="true">{initialsOf(s)}</span>
                            <div className="min-w-0">
                              <button type="button" className="pg-focus rounded text-left font-semibold text-gray-900 hover:underline dark:text-white" onClick={(e) => { e.stopPropagation(); setDrawer({ mode: 'view', studentId: s.id }); }}>
                                {rosterName(s)}
                              </button>
                              <p className="truncate text-xs text-gray-600 dark:text-gray-300">{s.email ?? 'Sin correo institucional'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="inline-block px-4 py-1 md:table-cell md:px-3 md:py-2.5">
                          {s.hasDocument ? <span className="font-mono tracking-wider text-gray-800 dark:text-gray-100">{maskedDocument(s.documentHint)}</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Falta DNI</span>}
                        </td>
                        <td className="inline-block px-2 py-1 md:table-cell md:px-3 md:py-2.5">
                          {s.section ? <span className="font-semibold text-gray-900 dark:text-white">{sectionName(s.section)}</span> : <span className="text-gray-600 dark:text-gray-300">Sin sección</span>}
                        </td>
                        <td className="inline-block px-2 py-1 tabular-nums md:table-cell md:px-3 md:py-2.5 md:text-right">
                          {age !== null ? <span className="text-gray-800 dark:text-gray-100">{age}<span className="md:hidden"> años</span></span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Falta fecha</span>}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-100 md:table-cell">{s.classes}</td>
                        <td className="block px-4 pb-3 md:table-cell md:px-3 md:py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}>
                            {s.status === 'ACTIVE' ? 'Matrícula activa' : 'Retirado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && pages > 1 && (
            <nav className="flex items-center justify-end gap-2" aria-label="Páginas del padrón">
              <span className="text-sm text-gray-700 dark:text-gray-300">Página {query.page} de {pages}</span>
              <button type="button" className="pg-btn pg-focus" disabled={query.page <= 1} onClick={() => setParam({ pagina: String(query.page - 1) })}><ChevronLeft size={16} aria-hidden="true" />Anterior</button>
              <button type="button" className="pg-btn pg-focus" disabled={query.page >= pages} onClick={() => setParam({ pagina: String(query.page + 1) })}>Siguiente<ChevronRight size={16} aria-hidden="true" /></button>
            </nav>
          )}
        </>
      )}

      <AnimatePresence>
        {drawer && (
          <StudentDrawer
            key={drawer.mode === 'create' ? 'create' : drawer.studentId}
            schoolId={school.id}
            yearId={yearId}
            state={drawer}
            sections={allSections}
            piiReady={data?.piiReady ?? true}
            onChange={setDrawer}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
