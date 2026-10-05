import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { sectionName } from '../../components/schools/console/sectionHelpers';
import { NameSplitEditor } from '../../components/schools/console/NameSplitEditor';
import {
  classWithTeacher, isDecided, personLetter, splitToStrings, stringsToSplit, summarize,
} from '../../components/schools/console/rosterBuilderHelpers';
import {
  rosterBuilderApi, rosterBuilderKeys, type BuilderDecision, type BuilderGroup, type BuilderOverview, type BuilderProposal, type Mapping,
} from '../../lib/schoolRosterBuilderApi';
import { schoolRosterKeys } from '../../lib/schoolRosterApi';

type Step = 1 | 2 | 3;
const NOT_A_SECTION = 'none';
const SAFE_PAGE = 50;

/** «Armar desde clases»: mapear cada clase a su sección, revisar las uniones y confirmar. */
export const SchoolRosterBuilderPage = () => {
  const { school, activeYear, yearsLoading } = useSchoolConsole();
  const yearId = activeYear?.id ?? '';
  const overview = useQuery({ queryKey: rosterBuilderKeys.overview(school.id, yearId), queryFn: () => rosterBuilderApi.overview(school.id, yearId), enabled: !!activeYear });

  if (yearsLoading || (activeYear && overview.isLoading)) {
    return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando las clases" />;
  }
  if (!activeYear || overview.isError || !overview.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">{activeYear ? 'No se pudieron cargar las clases.' : 'Primero prepara el año escolar.'}</p>
        {activeYear && <button type="button" onClick={() => void overview.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>}
      </div>
    );
  }
  return <Builder key={overview.data.draft.updatedAt ?? 'new'} data={overview.data} schoolId={school.id} yearId={yearId} />;
};

const initialMapping = (data: BuilderOverview): Mapping => Object.fromEntries(data.classes.flatMap((c) => {
  const saved = data.draft.mapping[c.id];
  if (saved) return [[c.id, saved]];
  const sectionId = c.current ?? c.suggestion;
  return sectionId ? [[c.id, { sectionId }]] : [];
}));

const Builder = ({ data, schoolId, yearId }: { data: BuilderOverview; schoolId: string; yearId: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [mapping, setMapping] = useState<Mapping>(() => initialMapping(data));
  const [decisions, setDecisions] = useState<Record<string, BuilderDecision>>(data.draft.decisions);
  const proposal = useQuery({
    queryKey: rosterBuilderKeys.proposal(schoolId, yearId),
    queryFn: () => rosterBuilderApi.proposal(schoolId, yearId),
    enabled: step >= 2,
    staleTime: Infinity,
  });
  const totalProfiles = data.classes.reduce((sum, c) => sum + c.students - c.linked, 0);
  const mapped = data.classes.filter((c) => mapping[c.id] !== undefined).length;

  const saveMapping = useMutation({
    mutationFn: () => rosterBuilderApi.saveMapping(schoolId, yearId, mapping),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar el mapeo')),
  });
  const { mutate: persistDecisions } = useMutation({ mutationFn: (next: Record<string, BuilderDecision>) => rosterBuilderApi.saveDecisions(schoolId, yearId, next) });

  // Las decisiones se guardan solas (para seguir después), un momento después del último cambio.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(() => persistDecisions(decisions), 800);
    return () => window.clearTimeout(timer);
  }, [decisions, persistDecisions]);

  const toReview = async () => {
    await saveMapping.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: rosterBuilderKeys.proposal(schoolId, yearId) });
    setStep(2);
  };
  const saveAndLeave = async () => {
    try {
      await rosterBuilderApi.saveMapping(schoolId, yearId, mapping);
      if (step >= 2) await rosterBuilderApi.saveDecisions(schoolId, yearId, decisions);
      toast.success('Guardado: puedes seguir después');
      navigate(`/escuela/${schoolId}/estudiantes`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar'));
    }
  };

  const groups = proposal.data?.groups ?? [];
  const summary = summarize(groups, decisions);
  const pending = groups.filter((g) => g.kind !== 'SAFE' && !isDecided(g, decisions[g.key])).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <Link to={`/escuela/${schoolId}/estudiantes`} className="pg-icon-btn pg-focus" aria-label="Volver a Estudiantes"><ArrowLeft size={20} aria-hidden="true" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Armar el padrón desde las clases</h1>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{data.classes.length} clases · {totalProfiles} perfiles por unir · los estudiantes no ven ningún cambio</p>
        </div>
        <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => void saveAndLeave()}>Guardar y seguir después</button>
      </header>

      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos">
        {[
          { n: 1, title: 'Mapear clases', detail: `${mapped} de ${data.classes.length}` },
          { n: 2, title: 'Revisar uniones', detail: step >= 2 && proposal.data ? `${pending} por decidir` : '—' },
          { n: 3, title: 'Confirmar', detail: step >= 2 && proposal.data ? `${summary.created} estudiantes` : '—' },
        ].map((s, i) => (
          <li key={s.n} className="flex items-center gap-2" aria-current={step === s.n ? 'step' : undefined}>
            {i > 0 && <span className="h-0.5 w-6 rounded bg-gray-300 dark:bg-gray-600" aria-hidden="true" />}
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step > s.n ? 'bg-emerald-600 text-white' : step === s.n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
              {step > s.n ? <Check size={14} aria-hidden="true" /> : s.n}
            </span>
            <span>
              <span className="block font-semibold text-gray-900 dark:text-white">{s.title}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-300">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-sm text-primary-950 dark:bg-primary-500/10 dark:text-primary-50">
        <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>Un estudiante aparece una vez por cada clase. Aquí juntamos sus perfiles en una sola persona del padrón. <b>Cada perfil conserva su XP, notas y asistencia.</b></span>
      </p>

      {step === 1 && <MapStep data={data} mapping={mapping} onChange={setMapping} busy={saveMapping.isPending} onContinue={() => void toReview()} />}
      {step === 2 && (
        proposal.isLoading ? <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Buscando a cada estudiante en sus clases…</p>
          : proposal.isError || !proposal.data ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudieron proponer las uniones.</p>
            : <ReviewStep proposal={proposal.data} decisions={decisions} onDecide={setDecisions} pending={pending} onBack={() => setStep(1)} onContinue={() => setStep(3)} />
      )}
      {step === 3 && proposal.data && <ConfirmStep schoolId={schoolId} yearId={yearId} groups={groups} decisions={decisions} summary={summary} onBack={() => setStep(2)} />}
    </div>
  );
};

const MapStep = ({ data, mapping, onChange, busy, onContinue }: { data: BuilderOverview; mapping: Mapping; onChange: (m: Mapping) => void; busy: boolean; onContinue: () => void }) => {
  if (data.sections.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">🔤</span><span className="text-5xl">🏫</span><span className="text-4xl">🎨</span></div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Primero crea las secciones</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Cada clase se une a una sección del año: créalas en «Grados y secciones».</p>
      </div>
    );
  }
  const set = (classId: string, value: string) => {
    const next = { ...mapping };
    if (value === '') delete next[classId];
    else next[classId] = { sectionId: value === NOT_A_SECTION ? null : value };
    onChange(next);
  };
  const ready = data.classes.every((c) => mapping[c.id] !== undefined);
  return (
    <section className="space-y-3" aria-labelledby="map-title">
      <h2 id="map-title" className="text-base font-bold text-gray-900 dark:text-white">¿De qué sección es cada clase?</h2>
      <div className="pg-surface overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Clase</th>
              <th scope="col" className="px-3 py-2 font-semibold">Área</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Estudiantes</th>
              <th scope="col" className="px-3 py-2 font-semibold">Sección</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.classes.map((c) => {
              const entry = mapping[c.id];
              const value = entry === undefined ? '' : entry.sectionId ?? NOT_A_SECTION;
              const suggested = !!c.suggestion && entry?.sectionId === c.suggestion && !c.current;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{c.teacher ?? 'Sin docente'}{c.linked > 0 && ` · ${c.linked} ya en el padrón`}</p>
                  </td>
                  <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">{c.area ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-100">{c.students}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label={`Sección de ${c.name}`} value={value} onChange={(e) => set(c.id, e.target.value)} className="pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <option value="">Elige…</option>
                        {data.sections.map((s) => <option key={s.id} value={s.id}>{sectionName(s)} · {LEVEL_LABEL[s.level]}</option>)}
                        <option value={NOT_A_SECTION}>No es una sección (taller, club…)</option>
                      </select>
                      {suggested && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-900 dark:bg-primary-500/20 dark:text-primary-100">Sugerida</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-sm text-gray-600 dark:text-gray-300">{ready ? 'Todas las clases tienen su sección o están marcadas como «no es una sección».' : 'Elige la sección de cada clase para continuar.'}</p>
        <button type="button" className={primaryButton} disabled={!ready || busy} onClick={onContinue}>{busy ? 'Guardando…' : 'Continuar'}<ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  );
};

type Filter = 'pending' | 'safe' | 'decided';

const ReviewStep = ({ proposal, decisions, onDecide, pending, onBack, onContinue }: {
  proposal: BuilderProposal; decisions: Record<string, BuilderDecision>; onDecide: (d: Record<string, BuilderDecision>) => void;
  pending: number; onBack: () => void; onContinue: () => void;
}) => {
  const [filter, setFilter] = useState<Filter>('pending');
  const [safePage, setSafePage] = useState<number | null>(null);
  const safe = proposal.groups.filter((g) => g.kind === 'SAFE');
  const toDecide = proposal.groups.filter((g) => g.kind !== 'SAFE');
  const decided = toDecide.filter((g) => isDecided(g, decisions[g.key]));
  const shown = filter === 'pending' ? toDecide.filter((g) => !isDecided(g, decisions[g.key])) : filter === 'decided' ? decided : [];
  const reviewLeft = toDecide.filter((g) => g.kind === 'REVIEW' && !isDecided(g, decisions[g.key])).length;
  const decide = (key: string, decision: BuilderDecision | undefined) => {
    const next = { ...decisions };
    if (decision) next[key] = decision;
    else delete next[key];
    onDecide(next);
  };
  const acceptedSafe = safe.filter((g) => decisions[g.key]?.kind === 'SAFE').length;

  return (
    <section className="space-y-4" aria-label="Revisar uniones">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar uniones">
        <button type="button" className="pg-chip pg-focus" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Por decidir <span className="tabular-nums opacity-80">{pending}</span></button>
        <button type="button" className="pg-chip pg-focus" aria-pressed={filter === 'safe'} onClick={() => { setFilter('safe'); setSafePage(0); }}>Seguras <span className="tabular-nums opacity-80">{safe.length}</span></button>
        <button type="button" className="pg-chip pg-focus" aria-pressed={filter === 'decided'} onClick={() => setFilter('decided')}>Decididas <span className="tabular-nums opacity-80">{decided.length}</span></button>
      </div>

      {proposal.counts.skipped > 0 && (
        <p className="text-sm text-amber-900 dark:text-amber-100">{proposal.counts.skipped} {proposal.counts.skipped === 1 ? 'perfil no tiene nombre y queda fuera' : 'perfiles no tienen nombre y quedan fuera'}: agrégalos a mano después.</p>
      )}

      {safe.length > 0 && filter !== 'safe' && (
        <div className="pg-surface flex flex-wrap items-center gap-3 p-4">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">Segura</span>
          <p className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100">
            <b>{safe.length} {safe.length === 1 ? 'unión segura' : 'uniones seguras'}</b>
            <span className="text-gray-600 dark:text-gray-300"> · el mismo nombre en clases de la misma sección, o en una sola clase{acceptedSafe === safe.length ? ' · aceptadas' : ''}</span>
          </p>
          <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => { setFilter('safe'); setSafePage(0); }}>Ver lista</button>
          {acceptedSafe < safe.length && (
            <button type="button" className="pg-btn pg-focus" onClick={() => onDecide({ ...decisions, ...Object.fromEntries(safe.filter((g) => !decisions[g.key]).map((g) => [g.key, { kind: 'SAFE' } as BuilderDecision])) })}>
              Aceptar {safe.length === 1 ? 'la segura' : `las ${safe.length}`}
            </button>
          )}
        </div>
      )}

      {filter === 'safe' ? (
        <SafeList groups={safe} decisions={decisions} page={safePage ?? 0} onPage={setSafePage} onDecide={decide} />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
          {filter === 'pending' ? 'No queda nada por decidir.' : 'Aún no decidiste ninguna unión.'}
        </p>
      ) : (
        <div className="space-y-4">
          {shown.map((group) => (group.kind === 'REVIEW'
            ? <ReviewCard key={group.key} group={group} decision={decisions[group.key]} onDecide={(d) => decide(group.key, d)} />
            : <ProbableCard key={group.key} group={group} decision={decisions[group.key]} onDecide={(d) => decide(group.key, d)} />))}
        </div>
      )}

      <div className="pg-surface flex flex-wrap items-center gap-2 p-3">
        <p className="mr-auto text-sm text-gray-800 dark:text-gray-100">
          <b>{pending} por decidir</b>{reviewLeft > 0 && ` · ${reviewLeft} «Revisar» ${reviewLeft === 1 ? 'obligatoria' : 'obligatorias'}`}
        </p>
        <button type="button" className={cancelButton} onClick={onBack}><ChevronLeft size={16} className="mr-1 inline" aria-hidden="true" />Volver</button>
        <button type="button" className={primaryButton} disabled={reviewLeft > 0} onClick={onContinue}>Continuar<ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      {reviewLeft > 0 && <p className="text-right text-xs text-gray-600 dark:text-gray-300">Decide las marcadas «Revisar» para continuar.</p>}
    </section>
  );
};

const SafeList = ({ groups, decisions, page, onPage, onDecide }: {
  groups: BuilderGroup[]; decisions: Record<string, BuilderDecision>; page: number; onPage: (p: number) => void; onDecide: (key: string, d: BuilderDecision | undefined) => void;
}) => {
  const [editing, setEditing] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(groups.length / SAFE_PAGE));
  const visible = groups.slice(page * SAFE_PAGE, (page + 1) * SAFE_PAGE);
  return (
    <div className="pg-surface">
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {visible.map((group) => {
          const decision = decisions[group.key];
          const name = decision?.kind === 'SAFE' && decision.name ? stringsToSplit(decision.name) : group.name;
          return (
            <li key={group.key} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-sm">
                  <b className="text-gray-900 dark:text-white">{name.lastNames.join(' ')}{name.lastNames.length ? ', ' : ''}{name.firstNames.join(' ')}</b>
                  <span className="text-gray-600 dark:text-gray-300"> · {group.sectionLabel} · {group.profiles.map((p) => classWithTeacher(p)).join(' / ')}</span>
                </p>
                {group.anchor ? <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Ya en el padrón</span>
                  : <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setEditing(editing === group.key ? null : group.key)} aria-expanded={editing === group.key}>Ajustar nombre</button>}
              </div>
              {editing === group.key && !group.anchor && (
                <div className="mt-2">
                  <NameSplitEditor label={`Nombre de ${group.profiles[0]?.displayName ?? 'la persona'}`} value={name} onChange={(next) => onDecide(group.key, { kind: 'SAFE', name: splitToStrings(next) })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav className="flex items-center justify-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700" aria-label="Páginas de uniones seguras">
          <span className="text-sm text-gray-700 dark:text-gray-300">Página {page + 1} de {pages}</span>
          <button type="button" className="pg-btn pg-focus" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" />Anterior</button>
          <button type="button" className="pg-btn pg-focus" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Siguiente<ChevronRight size={16} aria-hidden="true" /></button>
        </nav>
      )}
    </div>
  );
};

const ProbableCard = ({ group, decision, onDecide }: { group: BuilderGroup; decision: BuilderDecision | undefined; onDecide: (d: BuilderDecision | undefined) => void }) => {
  const current = decision?.kind === 'PROBABLE' ? decision : undefined;
  const name = current?.name ? stringsToSplit(current.name) : group.name;
  const titleId = `probable-${group.key}`;
  return (
    <article className="pg-surface p-4" aria-labelledby={titleId}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Probable</span>
        <h3 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">{group.anchor ? group.anchor.name : `${name.lastNames.join(' ')}${name.lastNames.length ? ', ' : ''}${name.firstNames.join(' ')}`}</h3>
        {current && <span className="ml-auto text-xs font-semibold text-emerald-800 dark:text-emerald-200">{current.action === 'merge' ? 'Se unirá' : 'Quedará separado'}</span>}
      </header>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{group.why}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <ul className="space-y-1.5" aria-label="Cómo figura en cada clase">
          {group.anchor && <li className="text-sm"><b className="text-gray-900 dark:text-white">«{group.anchor.name}»</b> <span className="text-xs text-gray-600 dark:text-gray-300">ya en el padrón</span></li>}
          {group.profiles.map((p) => (
            <li key={p.id} className="text-sm"><b className="text-gray-900 dark:text-white">«{p.displayName}»</b> <span className="text-xs text-gray-600 dark:text-gray-300">{classWithTeacher(p)} · {p.xp} XP</span></li>
          ))}
        </ul>
        {!group.anchor && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Nombre en el padrón</p>
            <NameSplitEditor label="Nombre en el padrón" value={name} onChange={(next) => onDecide({ kind: 'PROBABLE', action: 'merge', name: splitToStrings(next) })} />
          </div>
        )}
      </div>
      <footer className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="pg-btn pg-focus" aria-pressed={current?.action === 'split'} onClick={() => onDecide(current?.action === 'split' ? undefined : { kind: 'PROBABLE', action: 'split' })}>Separar</button>
        <button type="button" className="pg-btn pg-focus" aria-pressed={current?.action === 'merge'} onClick={() => onDecide(current?.action === 'merge' ? undefined : { kind: 'PROBABLE', action: 'merge', name: current?.name })}>
          Unir {group.profiles.length + (group.anchor ? 1 : 0)} {group.anchor ? 'con el padrón' : 'perfiles'}
        </button>
      </footer>
    </article>
  );
};

const ReviewCard = ({ group, decision, onDecide }: { group: BuilderGroup; decision: BuilderDecision | undefined; onDecide: (d: BuilderDecision | undefined) => void }) => {
  const people = group.people ?? [];
  const current = decision?.kind === 'REVIEW' ? decision : { kind: 'REVIEW' as const, assignments: {}, names: {} };
  const profilesById = useMemo(() => new Map(group.profiles.map((p) => [p.id, p])), [group.profiles]);
  const missing = (group.loose ?? []).filter((id) => current.assignments[id] === undefined).length;
  const titleId = `review-${group.key}`;
  const assign = (profileId: string, value: number | 'new') => onDecide({ ...current, assignments: { ...current.assignments, [profileId]: value } });
  const rename = (index: number, next: { lastNames: string[]; firstNames: string[] }) => onDecide({ ...current, names: { ...(current.names ?? {}), [String(index)]: splitToStrings(next) } });
  const nameOf = (index: number) => {
    const saved = current.names?.[String(index)];
    return saved ? stringsToSplit(saved) : people[index].name;
  };

  return (
    <article className="pg-surface border-l-4 border-l-red-500 p-4 dark:border-l-red-400" aria-labelledby={titleId}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900 dark:bg-red-900/50 dark:text-red-100">Revisar</span>
        <h3 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">{group.profiles[0]?.displayName} · {group.sectionLabel}</h3>
      </header>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{group.why}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {people.map((person, index) => (
          <div key={index} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Persona {personLetter(index)}{person.anchorStudentId && <span className="ml-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">ya en el padrón</span>}</p>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">{person.anchorProfileIds.map((id) => profilesById.get(id)).filter(Boolean).map((p) => `«${p!.displayName}» (${classWithTeacher(p!)})`).join(' · ')}</p>
            {!person.anchorStudentId && <NameSplitEditor label={`Nombre de la persona ${personLetter(index)}`} value={nameOf(index)} onChange={(next) => rename(index, next)} />}
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
            <tr><th scope="col" className="py-1.5 font-semibold">Cómo figura</th><th scope="col" className="py-1.5 font-semibold">Clase</th><th scope="col" className="py-1.5 text-right font-semibold">XP</th><th scope="col" className="py-1.5 font-semibold">Es</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {(group.loose ?? []).map((id) => {
              const profile = profilesById.get(id)!;
              const value = current.assignments[id];
              return (
                <tr key={id} className={value === undefined ? 'bg-amber-50/60 dark:bg-amber-900/10' : undefined}>
                  <td className="py-2 font-semibold text-gray-900 dark:text-white">«{profile.displayName}»</td>
                  <td className="py-2 text-gray-700 dark:text-gray-300">{classWithTeacher(profile)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{profile.xp}</td>
                  <td className="py-2">
                    <div className="pg-seg" role="group" aria-label={`¿A quién corresponde «${profile.displayName}» de ${profile.classroomName}?`}>
                      {people.map((_, index) => (
                        <button key={index} type="button" className="pg-seg-item pg-focus" aria-pressed={value === index} onClick={() => assign(id, index)}>{personLetter(index)}</button>
                      ))}
                      <button type="button" className="pg-seg-item pg-focus" aria-pressed={value === 'new'} onClick={() => assign(id, 'new')}>Otra persona</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="mt-3 text-sm">
        {missing > 0
          ? <span className="font-semibold text-amber-800 dark:text-amber-200">{missing === 1 ? 'Falta 1 perfil por asignar' : `Faltan ${missing} perfiles por asignar`}</span>
          : <span className="font-semibold text-emerald-800 dark:text-emerald-200">Listo</span>}
      </footer>
    </article>
  );
};

const ConfirmStep = ({ schoolId, yearId, groups, decisions, summary, onBack }: {
  schoolId: string; yearId: string; groups: BuilderGroup[]; decisions: Record<string, BuilderDecision>;
  summary: ReturnType<typeof summarize>; onBack: () => void;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groups) map.set(g.sectionLabel, (map.get(g.sectionLabel) ?? 0) + g.profiles.length);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }, [groups]);
  const confirm = useMutation({
    mutationFn: async () => {
      await rosterBuilderApi.saveDecisions(schoolId, yearId, decisions);
      return rosterBuilderApi.confirm(schoolId, yearId);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: ['roster-builder', schoolId, yearId] });
      toast.success(result.message);
      navigate(`/escuela/${schoolId}/estudiantes`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo armar el padrón')),
  });
  return (
    <section className="pg-surface space-y-4 p-5" aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="text-lg font-bold text-gray-900 dark:text-white">Todo listo para armar el padrón</h2>
      <p className="text-sm text-gray-800 dark:text-gray-100">
        Se crearán <b>{summary.created} {summary.created === 1 ? 'estudiante' : 'estudiantes'}</b> y quedarán vinculados <b>{summary.linked} {summary.linked === 1 ? 'perfil' : 'perfiles'}</b>. Los estudiantes no ven ningún cambio: sus clases, XP y notas siguen igual.
      </p>
      {summary.undecidedProbable > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-50">
          <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {summary.undecidedProbable === 1 ? 'Una unión probable que no revisaste se unirá como se propone.' : `${summary.undecidedProbable} uniones probables que no revisaste se unirán como se propone.`}
        </p>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Perfiles por sección</p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {bySection.map(([label, n]) => <li key={label} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100">{label}: {n}</li>)}
        </ul>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">Después completa los DNI y las fechas de nacimiento desde «Estudiantes» (filtro «Datos por completar»).</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={cancelButton} onClick={onBack}>Volver</button>
        <button type="button" className={primaryButton} disabled={confirm.isPending || summary.pendingReview > 0} onClick={() => confirm.mutate()}>
          {confirm.isPending ? 'Armando…' : 'Armar el padrón'}
        </button>
      </div>
    </section>
  );
};
