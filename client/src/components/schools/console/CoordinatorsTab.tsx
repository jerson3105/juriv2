import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { errorMessage } from '../../auth/authHelpers';
import { coordinatorApi, coordinatorKeys, type CoordinatorArea, type CoordinatorList } from '../../../lib/schoolCoordinatorApi';
import type { SchoolLevel } from '../../../lib/schoolYearApi';
import { schoolBadgesKey, schoolBehaviorsKey } from '../schoolHelpers';
import { LEVEL_LABEL } from './schoolYearHelpers';

const select = 'pg-focus min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

const classesSummary = (area: CoordinatorArea) => {
  const parts = [
    area.sections ? `${area.sections} ${area.sections === 1 ? 'sección' : 'secciones'}` : null,
    area.workshops ? `${area.workshops} ${area.workshops === 1 ? 'taller' : 'talleres'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Aún sin clases asignadas';
};

/**
 * Coordinación: la administración nombra al coordinador de cada área del plan, por nivel y para el año. El coordinador
 * ve cómo van las clases y talleres de su área y propone comportamientos e insignias para ella en la Biblioteca.
 */
export const CoordinatorsTab = ({ schoolId, yearId }: { schoolId: string; yearId: string }) => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const list = useQuery({ queryKey: coordinatorKeys.list(schoolId, yearId), queryFn: () => coordinatorApi.list(schoolId, yearId) });
  const save = useMutation({
    mutationFn: (input: { level: SchoolLevel; areaId: string; userId: string | null }) => coordinatorApi.set(schoolId, yearId, input),
    onSuccess: (message) => {
      void queryClient.invalidateQueries({ queryKey: coordinatorKeys.all(schoolId, yearId) });
      // Quien gana o pierde una coordinación ve otra Biblioteca.
      void queryClient.invalidateQueries({ queryKey: schoolBehaviorsKey(schoolId) });
      void queryClient.invalidateQueries({ queryKey: schoolBadgesKey(schoolId) });
      toast.success(message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar el coordinador')),
  });

  if (list.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando la coordinación" />;
  if (list.isError || !list.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudo cargar la coordinación.</p>
        <button type="button" onClick={() => void list.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  const { levels, team } = list.data;
  if (levels.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Elige los niveles del colegio en «Año escolar» para nombrar coordinadores.</p>;
  }
  const level = levels.find((l) => l.level === params.get('nivel')) ?? levels[0];
  const setLevel = (next: SchoolLevel) => {
    const updated = new URLSearchParams(params);
    updated.set('nivel', next);
    setParams(updated, { replace: true });
  };
  const named = level.areas.filter((a) => a.coordinator).length;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        Cada área tiene un coordinador por nivel. Ve cómo van las clases y talleres de su área (participación, asistencia y avance de notas, sin entrar a ellas ni ver a cada estudiante) y propone comportamientos e insignias para su área en la Biblioteca.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {levels.length > 1 && (
          <div className="pg-seg" role="group" aria-label="Nivel">
            {levels.map((l) => (
              <button key={l.level} type="button" className="pg-seg-item pg-focus" aria-pressed={l.level === level.level} onClick={() => setLevel(l.level)}>{LEVEL_LABEL[l.level]}</button>
            ))}
          </div>
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300">{named} de {level.areas.length} {level.areas.length === 1 ? 'área' : 'áreas'} con coordinador</span>
      </div>
      <ul className="pg-surface divide-y divide-gray-200 overflow-hidden dark:divide-gray-700" aria-label={`Áreas de ${LEVEL_LABEL[level.level]}`}>
        {level.areas.map((area) => (
          <AreaRow key={area.areaId} level={level.level} area={area} team={team} busy={save.isPending} onChange={(userId) => save.mutate({ level: level.level, areaId: area.areaId, userId })} />
        ))}
      </ul>
    </div>
  );
};

const AreaRow = ({ level, area, team, busy, onChange }: {
  level: SchoolLevel; area: CoordinatorArea; team: CoordinatorList['team']; busy: boolean; onChange: (userId: string | null) => void;
}) => {
  const fieldId = `coord-${level}-${area.areaId}`;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={fieldId} className="block font-semibold text-gray-900 dark:text-white">{area.name}</label>
        <p className="text-xs text-gray-600 dark:text-gray-300">{classesSummary(area)}</p>
      </div>
      <div className="sm:w-72">
        <select id={fieldId} className={select} value={area.coordinator?.userId ?? ''} disabled={busy} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Sin coordinador</option>
          {area.coordinator && !area.coordinator.inTeam && <option value={area.coordinator.userId}>{area.coordinator.name} (ya no está en el equipo)</option>}
          {team.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </div>
    </li>
  );
};
