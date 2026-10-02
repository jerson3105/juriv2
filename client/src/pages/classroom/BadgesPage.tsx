import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Award, Plus, Search, Sparkles, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { RARITY_LABELS, badgeApi, type Badge, type BadgeRarity, type CreateBadgeDto, type GeneratedBadge } from '../../lib/badgeApi';
import { behaviorApi } from '../../lib/behaviorApi';
import type { Classroom } from '../../lib/classroomApi';
import { BadgeTile } from '../../components/badges/BadgeTile';
import { BadgeFormModal, type BadgeFormTarget } from '../../components/badges/BadgeFormModal';
import { AwardBadgeModal } from '../../components/badges/AwardBadgeModal';
import { BadgeWinnersPanel } from '../../components/badges/BadgeWinnersPanel';
import { AIBadgeModal } from '../../components/badges/AIBadgeModal';
import { celebrateBadgeAward } from '../../components/celebrations/celebrationHelpers';
import { RARITY_ORDER, badgeAwardCountsKey } from '../../components/badges/badgeHelpers';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';

type ModeFilter = 'ALL' | 'MANUAL' | 'AUTO';
type SortKey = 'awards' | 'rarity' | 'name';

const SORT_KEY = 'juried:badges-sort';
const readSort = (): SortKey => {
  try {
    const value = localStorage.getItem(SORT_KEY);
    return value === 'rarity' || value === 'name' ? value : 'awards';
  } catch {
    return 'awards';
  }
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const secondaryButton =
  'inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const segment = (active: boolean) =>
  `min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors ${
    active ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
  }`;

export const BadgesPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const badgesKey = ['badges', classroom.id];
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<BadgeRarity | 'ALL'>('ALL');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL');
  const [sort, setSort] = useState<SortKey>(readSort);
  const [formTarget, setFormTarget] = useState<BadgeFormTarget | null>(null);
  const [awardBadge, setAwardBadge] = useState<Badge | null>(null);
  const [showWinners, setShowWinners] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const { data: badges = [], isLoading } = useQuery({
    queryKey: badgesKey,
    queryFn: () => badgeApi.getClassroomBadges(classroom.id),
  });
  const { data: counts = [] } = useQuery({
    queryKey: badgeAwardCountsKey(classroom.id),
    queryFn: () => badgeApi.getAwardCounts(classroom.id),
  });
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });
  // Las que tienen competencia cuentan para la nota (grade.service): se dice en la tarjeta.
  const { competencies } = useClassroomCompetencies(classroom.id, !!classroom.useCompetencies && !!classroom.curriculumAreaId);
  const competencyNames = useMemo(() => new Map(competencies.map((c) => [c.id, c.name])), [competencies]);

  const holders = useMemo(() => {
    const map = new Map<string, { students: number; awards: number }>();
    for (const row of counts) {
      const current = map.get(row.badgeId) ?? { students: 0, awards: 0 };
      map.set(row.badgeId, { students: current.students + 1, awards: current.awards + row.count });
    }
    return map;
  }, [counts]);
  const holdersOf = (id: string) => holders.get(id) ?? { students: 0, awards: 0 };

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    const list = badges.filter((badge) =>
      (!term || `${badge.name} ${badge.description}`.toLocaleLowerCase('es').includes(term))
      && (rarityFilter === 'ALL' || badge.rarity === rarityFilter)
      && (modeFilter === 'ALL' || (modeFilter === 'MANUAL' ? badge.assignmentMode !== 'AUTOMATIC' : badge.assignmentMode !== 'MANUAL')));
    const byName = (a: Badge, b: Badge) => a.name.localeCompare(b.name, 'es');
    const byRarity = (a: Badge, b: Badge) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    return [...list].sort((a, b) => {
      if (sort === 'name') return byName(a, b);
      if (sort === 'rarity') return byRarity(a, b) || byName(a, b);
      return (holders.get(b.id)?.awards ?? 0) - (holders.get(a.id)?.awards ?? 0) || byRarity(a, b) || byName(a, b);
    });
  }, [badges, search, rarityFilter, modeFilter, sort, holders]);

  const own = visible.filter((b) => b.scope === 'CLASSROOM');
  const system = visible.filter((b) => b.scope === 'SYSTEM');
  const totalAwards = counts.reduce((sum, row) => sum + row.count, 0);
  const studentsWithBadges = new Set(counts.map((row) => row.studentProfileId)).size;

  const refresh = () => queryClient.invalidateQueries({ queryKey: badgesKey });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: CreateBadgeDto; id?: string }) => {
      if (id) await badgeApi.updateBadge(id, data);
      else await badgeApi.createBadge(classroom.id, data);
    },
  });

  const handleSave = async (data: CreateBadgeDto, another: boolean) => {
    const id = formTarget?.kind === 'edit' ? formTarget.badge.id : undefined;
    try {
      await saveMutation.mutateAsync({ data, id });
      refresh();
      toast.success(id ? `Guardada: ${data.name}` : `Creada: ${data.name}`);
      if (!another) setFormTarget(null);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la insignia'));
      return false;
    }
  };

  const restore = async (badge: Badge) => {
    try {
      await badgeApi.restoreBadge(badge.id);
      toast.success(`Restaurada: ${badge.name}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restaurar'));
    } finally {
      refresh();
    }
  };

  // Se quita al instante; los alumnos conservan la que ganaron y "Deshacer" la reactiva.
  const handleArchive = async (badge: Badge) => {
    await queryClient.cancelQueries({ queryKey: badgesKey });
    const previous = queryClient.getQueryData<Badge[]>(badgesKey);
    queryClient.setQueryData<Badge[]>(badgesKey, (current = []) => current.filter((b) => b.id !== badge.id));
    try {
      await badgeApi.deleteBadge(badge.id);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Archivada: {badge.name}. Quienes la ganaron la conservan.</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void restore(badge);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    } catch (error) {
      queryClient.setQueryData(badgesKey, previous);
      toast.error(errorMessage(error, 'No se pudo archivar'));
    } finally {
      refresh();
    }
  };

  // Arreglo de un clic: una automática sin condición válida pasa a «La doy yo».
  const handleMakeManual = async (badge: Badge) => {
    try {
      await badgeApi.updateBadge(badge.id, { assignmentMode: 'MANUAL', unlockCondition: null });
      toast.success(`«${badge.name}» ahora la das tú`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo cambiar la insignia'));
    } finally {
      refresh();
    }
  };

  const handleImport = async (generated: GeneratedBadge[]) => {
    const outcomes = await Promise.allSettled(generated.map((b) => badgeApi.createBadge(classroom.id, {
      name: b.name,
      description: b.description,
      icon: b.icon,
      rarity: b.rarity,
      assignmentMode: b.assignmentMode,
      unlockCondition: b.assignmentMode === 'MANUAL' ? null : b.unlockCondition,
      rewardXp: b.rewardXp,
      rewardGp: b.rewardGp,
      isSecret: b.isSecret,
      competencyId: b.competencyId || undefined,
    })));
    const created = outcomes.filter((o) => o.status === 'fulfilled').length;
    refresh();
    if (created === 0) {
      toast.error('No se pudo importar ninguna insignia');
      return;
    }
    const failed = generated.length - created;
    if (failed === 0) toast.success(`Se importaron ${created} insignia${created !== 1 ? 's' : ''}`);
    else toast.error(`Se importaron ${created} de ${generated.length}; ${failed} fallaron`);
    setShowAI(false);
  };

  const changeSort = (next: SortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Sin almacenamiento: el orden vale solo para esta visita.
    }
  };

  const renderGrid = (list: Badge[], editable: boolean) => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      <AnimatePresence initial={false}>
        {list.map((badge, index) => (
          <BadgeTile
            key={badge.id}
            badge={badge}
            index={index}
            behaviors={behaviors}
            holders={holdersOf(badge.id)}
            competencyName={badge.competencyId ? competencyNames.get(badge.competencyId) ?? null : null}
            onAward={() => setAwardBadge(badge)}
            onEdit={editable ? () => setFormTarget({ kind: 'edit', badge }) : undefined}
            onDuplicate={editable ? () => setFormTarget({ kind: 'create', template: badge }) : undefined}
            onArchive={editable ? () => void handleArchive(badge) : undefined}
            onMakeManual={editable ? () => void handleMakeManual(badge) : undefined}
          />
        ))}
      </AnimatePresence>
    </ul>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/30" aria-hidden="true">
            <Award size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Insignias</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {badges.length === 0
                ? 'Logros que tus estudiantes coleccionan'
                : `${badges.length} insignia${badges.length !== 1 ? 's' : ''} · otorgadas ${totalAwards} ${totalAwards === 1 ? 'vez' : 'veces'} · ${studentsWithBadges} estudiante${studentsWithBadges !== 1 ? 's' : ''} con insignias`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowWinners(true)} className={secondaryButton}>
            <Trophy size={16} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
            Ganadores
          </button>
          <button type="button" onClick={() => setShowAI(true)} className={secondaryButton}>
            <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
            Generar con IA
          </button>
          <button
            type="button"
            onClick={() => setFormTarget({ kind: 'create' })}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 sm:flex-none"
          >
            <Plus size={16} aria-hidden="true" />
            Nueva
          </button>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar insignias"
              aria-label="Buscar insignias"
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Rareza">
              {(['ALL', ...RARITY_ORDER] as const).map((rarity) => (
                <button key={rarity} type="button" onClick={() => setRarityFilter(rarity)} aria-pressed={rarityFilter === rarity} className={segment(rarityFilter === rarity)}>
                  {rarity === 'ALL' ? 'Todas' : RARITY_LABELS[rarity]}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Cómo se ganan">
              {([['ALL', 'Todas'], ['MANUAL', 'Las doy yo'], ['AUTO', 'Solas']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setModeFilter(value)} aria-pressed={modeFilter === value} className={segment(modeFilter === value)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              Ordenar
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className="story-select h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="awards">Más otorgadas</option>
                <option value="rarity">Rareza</option>
                <option value="name">Nombre</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {badges.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">🥉</span><span className="text-5xl">🏆</span><span className="text-4xl">💎</span>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Crea la primera insignia de tu clase</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
            Reconoce logros especiales: tú las das cuando quieras o se ganan solas al cumplir una meta.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setFormTarget({ kind: 'create' })} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">
              <Plus size={16} aria-hidden="true" />
              Crear insignia
            </button>
            <button type="button" onClick={() => setShowAI(true)} className={secondaryButton}>
              <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
              Generar con IA
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
          Ninguna insignia coincide con los filtros.
        </p>
      ) : (
        <>
          {own.length > 0 && (
            <section aria-labelledby="own-badges" className="space-y-3">
              <h2 id="own-badges" className="text-base font-bold text-gray-900 dark:text-white">De tu clase <span className="font-semibold text-gray-700 dark:text-gray-300">({own.length})</span></h2>
              {renderGrid(own, true)}
            </section>
          )}
          {system.length > 0 && (
            <section aria-labelledby="system-badges" className="space-y-3">
              <h2 id="system-badges" className="text-base font-bold text-gray-900 dark:text-white">De Juried <span className="font-semibold text-gray-700 dark:text-gray-300">({system.length})</span></h2>
              {renderGrid(system, false)}
            </section>
          )}
        </>
      )}

      <AnimatePresence>
        {formTarget && (
          <BadgeFormModal
            key={formTarget.kind === 'edit' ? `edit-${formTarget.badge.id}` : `create-${formTarget.template?.id ?? 'new'}`}
            target={formTarget}
            classroom={classroom}
            isSaving={saveMutation.isPending}
            onClose={() => setFormTarget(null)}
            onSubmit={handleSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {awardBadge && (
          <AwardBadgeModal
            key={awardBadge.id}
            badge={awardBadge}
            classroomId={classroom.id}
            showCharacterName={classroom.showCharacterName}
            onClose={() => setAwardBadge(null)}
            onAwarded={(badge, studentNames) => {
              setAwardBadge(null);
              celebrateBadgeAward(badge, studentNames);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWinners && <BadgeWinnersPanel key="winners" classroomId={classroom.id} onClose={() => setShowWinners(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showAI && <AIBadgeModal key="ai" classroom={classroom} onClose={() => setShowAI(false)} onImport={handleImport} />}
      </AnimatePresence>

    </div>
  );
};
