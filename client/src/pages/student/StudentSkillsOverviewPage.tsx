import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Check,
  GraduationCap,
  LayoutList,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { classroomApi } from '../../lib/classroomApi';
import { gradeApi, type PerformanceBucket } from '../../lib/gradeApi';
import { studentApi } from '../../lib/studentApi';
import { useStudentStore } from '../../store/studentStore';

type StoryOutletContext = {
  storyTheme?: unknown;
  isThemeDark?: boolean;
};

const PERFORMANCE_COLUMNS: PerformanceBucket[] = ['C', 'B', 'A', 'AD'];

const getBucketCheckIconClassName = (bucket: PerformanceBucket | null | undefined) => {
  if (bucket === 'AD') return 'text-emerald-500';
  if (bucket === 'A') return 'text-blue-500';
  if (bucket === 'B') return 'text-amber-500';
  if (bucket === 'C') return 'text-red-500';
  return 'text-emerald-500';
};

export const StudentSkillsOverviewPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex, setSelectedClassIndex } = useStudentStore();
  const { storyTheme, isThemeDark } = useOutletContext<StoryOutletContext>();
  const hasTheme = !!storyTheme;
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);

  const { data: myClasses = [], isLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const competencyProfiles = useMemo(
    () => myClasses.filter((profile) => profile.classroom?.useCompetencies),
    [myClasses]
  );

  const competencyQueries = useQueries({
    queries: competencyProfiles.map((profile) => ({
      queryKey: ['classroom-competencies', profile.classroomId],
      queryFn: async () => {
        try {
          return await classroomApi.getCompetencies(profile.classroomId);
        } catch {
          return [];
        }
      },
      enabled: !!profile.classroomId,
    })),
  });

  const gradebookQueries = useQueries({
    queries: competencyProfiles.map((profile) => ({
      queryKey: ['student-skills-gradebook', profile.id],
      queryFn: async () => {
        try {
          return await gradeApi.getStudentGrades(profile.id, 'CURRENT');
        } catch {
          return null;
        }
      },
      enabled: !!profile.id,
    })),
  });

  useEffect(() => {
    if (!competencyProfiles.length) {
      setSelectedClassroomId(null);
      return;
    }

    const isCurrentSelectionValid = selectedClassroomId
      ? competencyProfiles.some((profile) => profile.classroomId === selectedClassroomId)
      : false;

    if (isCurrentSelectionValid) {
      return;
    }

    const preferredProfile = competencyProfiles.find(
      (profile) => profile.classroomId === myClasses[selectedClassIndex]?.classroomId
    ) ?? competencyProfiles[0];

    setSelectedClassroomId(preferredProfile.classroomId);
  }, [competencyProfiles, myClasses, selectedClassIndex, selectedClassroomId]);

  const competencyClassrooms = competencyProfiles.map((profile, index) => ({
    profile,
    competencies: competencyQueries[index]?.data ?? [],
    gradebook: gradebookQueries[index]?.data,
  }));

  const selectedClassroom = competencyClassrooms.find(
    (entry) => entry.profile.classroomId === selectedClassroomId
  ) ?? competencyClassrooms[0];

  const selectedCompetencies = useMemo(() => {
    if (!selectedClassroom) {
      return [];
    }

    const gradeByCompetencyId = new Map(
      (selectedClassroom.gradebook?.grades ?? []).map((grade) => [grade.competencyId, grade])
    );

    return selectedClassroom.competencies.map((competency) => {
      const grade = gradeByCompetencyId.get(competency.id);
      const breakdownByIndicatorId = new Map(
        (grade?.indicatorBreakdown ?? []).map((indicator) => [indicator.id, indicator])
      );

      const indicators = competency.indicators.length > 0
        ? competency.indicators.map((indicator) => {
            const breakdown = breakdownByIndicatorId.get(indicator.id);

            return {
              id: indicator.id,
              name: indicator.name,
              description: indicator.description,
              bucket: breakdown?.bucket ?? null,
              gradeLabel: breakdown?.gradeLabel ?? null,
              hasEvidence: breakdown?.hasEvidence ?? false,
            };
          })
        : (grade?.indicatorBreakdown ?? []).map((indicator) => ({
            id: indicator.id,
            name: indicator.name,
            description: indicator.description,
            bucket: indicator.bucket,
            gradeLabel: indicator.gradeLabel,
            hasEvidence: indicator.hasEvidence,
          }));

      return {
        competency,
        grade,
        indicators,
      };
    });
  }, [selectedClassroom]);

  const handleSelectClassroom = (classroomId: string) => {
    setSelectedClassroomId(classroomId);

    const index = myClasses.findIndex((profile) => profile.classroomId === classroomId);
    if (index >= 0) {
      setSelectedClassIndex(index);
    }
  };

  const skillsLoading = isLoading || competencyQueries.some((query) => query.isLoading) || gradebookQueries.some((query) => query.isLoading);

  if (skillsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <div className="h-[560px] rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-[560px] rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (myClasses.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-xl text-center space-y-5">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/20">
            <Users className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Aún no estás en ninguna clase</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Cuando te unas a una clase con competencias activas, aquí verás tus destrezas organizadas por aula.
            </p>
          </div>
          <div className="flex justify-center">
            <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/join-class')}>
              Unirme a una clase
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (competencyProfiles.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className={`max-w-2xl rounded-3xl border p-8 text-center shadow-lg ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 text-white' : 'border-white/60 bg-white/90 text-slate-900 dark:border-gray-800 dark:bg-gray-900/80 dark:text-white'}`}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Aún no tienes clases con destrezas activas</h1>
          <p className={`mt-3 text-sm ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
            Esta sección se llenará automáticamente cuando una de tus clases utilice calificaciones por competencias con desglose por destrezas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 h-64 w-64 rounded-full bg-sky-200 opacity-20 blur-3xl dark:bg-sky-950 dark:opacity-30" />
          <div className="absolute left-10 top-44 h-64 w-64 rounded-full bg-violet-200 opacity-20 blur-3xl dark:bg-violet-950 dark:opacity-30" />
        </>
      )}

      <div className="relative z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border p-5 shadow-lg md:p-6 ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/80 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}
        >
          <div className="flex items-start gap-4">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${hasTheme && isThemeDark ? 'bg-white/10 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'}`}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                Destrezas
              </h1>
              <p className={`mt-2 max-w-2xl text-sm ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
                Revisa por clase el estado de cada destreza y en qué nivel de logro te encuentras actualmente.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
          <aside className={`rounded-3xl border p-4 shadow-lg ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/90 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}>
            <div className="mb-4 flex items-center gap-2">
              <LayoutList className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 className={`text-sm font-semibold uppercase tracking-[0.18em] ${hasTheme && isThemeDark ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}`}>
                Clases con destrezas
              </h2>
            </div>

            <div className="space-y-2">
              {competencyClassrooms.map((entry) => {
                const isActive = entry.profile.classroomId === selectedClassroom?.profile.classroomId;
                const average = entry.gradebook?.average;

                return (
                  <button
                    key={entry.profile.id}
                    type="button"
                    onClick={() => handleSelectClassroom(entry.profile.classroomId)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                      isActive
                        ? 'border-sky-400 bg-sky-50 text-sky-900 shadow-md dark:border-sky-500/40 dark:bg-sky-950/20 dark:text-white'
                        : hasTheme && isThemeDark
                          ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          : 'border-slate-100 bg-white/70 text-slate-900 hover:bg-white dark:border-gray-800 dark:bg-gray-900/80 dark:text-white dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {entry.profile.classroom?.name}
                        </p>
                        <p className={`mt-1 text-xs ${isActive ? 'text-current/70' : hasTheme && isThemeDark ? 'text-white/55' : 'text-slate-500 dark:text-gray-400'}`}>
                          {entry.competencies.length} competencia{entry.competencies.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      {average && (
                        <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-sky-700 dark:bg-white/10 dark:text-white">
                          {average.label}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            <div className={`overflow-hidden rounded-3xl border shadow-lg ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/90 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}>
              <div className={`grid grid-cols-[minmax(0,1fr),44px,44px,44px,52px] border-b ${hasTheme && isThemeDark ? 'border-white/10 bg-black/10 text-white/80' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-300'}`}>
                <div className="px-4 py-3 text-sm font-semibold">Competencias y destrezas</div>
                {PERFORMANCE_COLUMNS.map((bucket) => (
                  <div key={bucket} className="flex items-center justify-center px-2 py-3 text-sm font-bold">
                    {bucket}
                  </div>
                ))}
              </div>

              <div>
                {selectedCompetencies.map(({ competency, grade, indicators }) => {
                  const hasVisibleIndicatorResults = indicators.some(
                    (indicator) => indicator.bucket || indicator.gradeLabel || indicator.hasEvidence
                  );

                  return (
                  <div key={competency.id} className={`border-b last:border-b-0 ${hasTheme && isThemeDark ? 'border-white/10' : 'border-slate-200 dark:border-gray-800'}`}>
                    <div className="grid grid-cols-[minmax(0,1fr),44px,44px,44px,52px] bg-sky-600 text-white">
                      <div className="px-4 py-3">
                        <p className="text-sm font-semibold leading-snug md:text-[15px]">{competency.name}</p>
                      </div>
                      {PERFORMANCE_COLUMNS.map((bucket) => (
                        <div
                          key={`${competency.id}-${bucket}`}
                          className="flex items-center justify-center border-l border-white/10"
                        >
                          {hasVisibleIndicatorResults && grade?.bucket === bucket && (
                            <Check className="h-5 w-5 text-white" />
                          )}
                        </div>
                      ))}
                    </div>

                    {indicators.length > 0 ? (
                      indicators.map((indicator) => (
                        <div
                          key={indicator.id}
                          className={`grid grid-cols-[minmax(0,1fr),44px,44px,44px,52px] ${hasTheme && isThemeDark ? 'bg-white/5 text-white/85' : 'bg-white text-slate-700 dark:bg-gray-950/60 dark:text-gray-200'}`}
                        >
                          <div className={`px-4 py-3 text-sm ${hasTheme && isThemeDark ? 'border-r border-white/10' : 'border-r border-slate-200 dark:border-gray-800'}`}>
                            <p className="leading-relaxed">{indicator.name}</p>
                          </div>

                          {PERFORMANCE_COLUMNS.map((bucket) => (
                            <div
                              key={`${indicator.id}-${bucket}`}
                              className={`flex items-center justify-center ${hasTheme && isThemeDark ? 'border-l border-white/10' : 'border-l border-slate-200 dark:border-gray-800'}`}
                            >
                              {indicator.bucket === bucket && (
                                <Check className={`h-5 w-5 ${getBucketCheckIconClassName(indicator.bucket)}`} />
                              )}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className={`px-4 py-4 text-sm ${hasTheme && isThemeDark ? 'text-white/60' : 'text-slate-500 dark:text-gray-400'}`}>
                        Esta competencia todavía no tiene destrezas visibles para mostrar en el panel.
                      </div>
                    )}
                  </div>
                );})}
              </div>
            </div>

            <div className={`rounded-3xl border p-4 shadow-lg ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/90 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">C</span>
                  <span className={hasTheme && isThemeDark ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}>En inicio</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-600">B</span>
                  <span className={hasTheme && isThemeDark ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}>En proceso</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">A</span>
                  <span className={hasTheme && isThemeDark ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}>Logro esperado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-600">AD</span>
                  <span className={hasTheme && isThemeDark ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}>Logro destacado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};