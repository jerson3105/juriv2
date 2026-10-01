import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronRight, Loader2 } from 'lucide-react';
import type { Classroom } from '../../lib/classroomApi';
import { statsApi, type StatsPeriod } from '../../lib/statsApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { card, chip } from '../../components/gradebook/gradebookHelpers';
import { CompetencyDistribution } from '../../components/gradebook/CompetencyDistribution';
import { AttentionList, ClimateSection, GamificationDetails, RecentActivity } from '../../components/stats/StatsSections';
import { statsKey, STATS_PERIODS } from '../../components/stats/statsHelpers';

interface ClassroomWithStudents extends Classroom {
  students?: Array<{ id: string; characterName?: string | null; realName?: string | null; realLastName?: string | null; displayName?: string | null }>;
}

// Estadísticas: ¿cómo va mi clase? Quién necesita atención, clima, notas por competencia y gamificación.
export const StatsPage = () => {
  const { classroom } = useOutletContext<{ classroom: ClassroomWithStudents }>();
  const usesGrades = !!classroom.useCompetencies && !!classroom.curriculumAreaId;
  const [period, setPeriod] = useState<StatsPeriod>(usesGrades ? 'bimester' : 'month');
  const { classMap } = useCharacterClasses(classroom.id);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: statsKey(classroom.id, period),
    queryFn: () => statsApi.getOverview(classroom.id, period),
    placeholderData: keepPreviousData,
  });

  // Nombre real y, debajo, el de personaje (como en Calificaciones).
  const nameOf = (s: { studentName: string; characterName: string | null }) => ({
    primary: s.studentName,
    secondary: s.characterName && s.characterName !== s.studentName ? s.characterName : null,
  });
  const nameById = useMemo(() => new Map((classroom.students ?? []).map((s) => [
    s.id,
    [s.realName, s.realLastName].filter(Boolean).join(' ') || s.displayName || s.characterName || 'Estudiante',
  ])), [classroom.students]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <BarChart3 size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Estadísticas</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Cómo va la clase{data ? ` · ${data.period.label} · ${data.studentCount} alumnos` : ''}{isFetching && !isLoading ? ' · actualizando…' : ''}
          </p>
        </div>
      </div>

      <div className={card}>
        <div role="radiogroup" aria-label="Periodo" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {STATS_PERIODS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className={`${card} flex justify-center py-10`}><Loader2 className="h-7 w-7 animate-spin text-primary-700" aria-label="Cargando estadísticas" /></div>
      ) : isError || !data ? (
        <p className={`${card} text-sm text-gray-800 dark:text-gray-100`}>No se pudieron cargar las estadísticas. Recarga la página.</p>
      ) : data.studentCount === 0 ? (
        <p className={`${card} text-sm text-gray-800 dark:text-gray-100`}>La clase aún no tiene alumnos.</p>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <AttentionList classroomId={classroom.id} data={data} nameOf={nameOf} />
            {data.grades ? (
              <section aria-labelledby="grades-title" className={card}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="grades-title" className="text-base font-bold text-gray-900 dark:text-white">Notas por competencia</h2>
                  <Link to={`/classroom/${classroom.id}/gradebook?tab=resumen`} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary-800 hover:underline dark:text-primary-200">
                    Ir al resumen de Calificaciones <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </div>
                <CompetencyDistribution rows={data.grades.competencies} caption="Bimestre en curso, según el último cálculo." />
              </section>
            ) : (
              <RecentActivity classroomId={classroom.id} nameById={nameById} />
            )}
          </div>
          <ClimateSection data={data} />
          {data.grades && <RecentActivity classroomId={classroom.id} nameById={nameById} />}
          <GamificationDetails classroomId={classroom.id} data={data} classLabel={(key) => classMap[key]?.name ?? (key || 'Sin clase')} />
        </>
      )}
    </div>
  );
};
