import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { Classroom, Student } from '../../lib/classroomApi';
import { studentApi, type SummaryPeriod } from '../../lib/studentApi';
import { behaviorApi } from '../../lib/behaviorApi';
import { characterClassApi } from '../../lib/characterClassApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { useApplyWithUndo } from '../../hooks/useApplyWithUndo';
import { PointsModal } from '../../components/modals/PointsModal';
import { GiveBadgeModal } from '../../components/badges/GiveBadgeModal';
import { ProfileHeader } from '../../components/students/profile/ProfileHeader';
import { SummaryTab } from '../../components/students/profile/SummaryTab';
import { ActivityTab } from '../../components/students/profile/ActivityTab';
import { AchievementsTab } from '../../components/students/profile/AchievementsTab';
import { LearningTab } from '../../components/students/profile/LearningTab';
import { AccessCodeModal, EditNamesModal, FamilyCodeModal, RemoveStudentModal } from '../../components/students/profile/ManageStudentModals';
import { PROFILE_TABS, errorMessage, studentNames, summaryKey, type ProfileTab } from '../../components/students/profile/profileHelpers';

type Modal = 'points' | 'badge' | 'edit' | 'access' | 'family' | 'remove' | null;

// Perfil del estudiante (vista del profesor): análisis y gestión. El uso rápido en clase vive en
// "Foco en el alumno" (Estudiantes); ambos comparten cálculos (profileHelpers) y acciones.
export const StudentDetailPage = () => {
  const { id: classroomId, studentId } = useParams<{ id: string; studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { classroom, storyAccent } = useOutletContext<{
    classroom: Classroom & { students?: Student[]; showCharacterName?: boolean; xpPerLevel?: number | null };
    storyAccent: StoryAccent | null;
  }>();
  const { classMap, classes: characterClasses } = useCharacterClasses(classroomId);
  const pointsTools = useApplyWithUndo(classroomId!);
  const [period, setPeriod] = useState<SummaryPeriod>('bimester');
  const [modal, setModal] = useState<Modal>(null);
  const [assigning, setAssigning] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabParam = searchParams.get('tab') as ProfileTab | null;
  const tab: ProfileTab = PROFILE_TABS.some((t) => t.id === tabParam) ? tabParam! : 'resumen';

  // Mismo orden que la lista de la clase (sin reordenar la caché compartida).
  const roster = useMemo(() => (classroom?.students ?? []).filter((s) => s.isActive !== false && !s.isDemo), [classroom?.students]);
  const index = roster.findIndex((s) => s.id === studentId);
  const student = index >= 0 ? roster[index] : (classroom?.students ?? []).find((s) => s.id === studentId);
  const previous = index > 0 ? roster[index - 1] : null;
  const next = index >= 0 && index < roster.length - 1 ? roster[index + 1] : null;
  const nameOf = (s: typeof student) => (s ? studentNames(s, classroom.showCharacterName).primary : '');

  const summary = useQuery({
    queryKey: summaryKey(classroomId!, studentId!, period),
    queryFn: () => studentApi.getSummary(classroomId!, studentId!, period),
    enabled: !!classroomId && !!studentId && !!student,
  });
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroomId],
    queryFn: () => behaviorApi.getByClassroom(classroomId!),
    enabled: modal === 'points',
  });

  if (!student) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Estudiante no encontrado</h1>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Puede que lo hayan retirado de la clase.</p>
        <button type="button" onClick={() => navigate(`/classroom/${classroomId}/students`)} className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">
          Volver a Estudiantes
        </button>
      </div>
    );
  }

  const name = nameOf(student);
  const maxHp = classroom.maxHp || 100;
  const classInfo = (student.characterClassId && classMap[student.characterClassId]) || classMap[student.characterClass];
  const allowNegative = classroom.allowNegativePoints !== false;

  const refreshStudent = () => {
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['student-summary', classroomId, studentId] });
    queryClient.invalidateQueries({ queryKey: ['student-activity', classroomId, studentId] });
    queryClient.invalidateQueries({ queryKey: ['student-badges', studentId] });
  };

  const goTo = (id: string) => navigate(`/classroom/${classroomId}/student/${id}${tab !== 'resumen' ? `?tab=${tab}` : ''}`);

  // Cambiar la clase de personaje: al instante, con "Deshacer" (antes no avisaba si fallaba).
  const assignClass = async (characterClassId: string | null) => {
    const before = student.characterClassId ?? null;
    if (characterClassId === before) return;
    setAssigning(true);
    try {
      await characterClassApi.assign(classroomId!, student.id, characterClassId);
      await queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      const label = characterClasses.find((c) => c.id === characterClassId)?.name ?? 'Sin clase';
      toast.success((t) => (
        <span className="flex items-center gap-3">
          <span>{name}: {label}</span>
          <button type="button" onClick={async () => {
            toast.dismiss(t.id);
            try {
              await characterClassApi.assign(classroomId!, student.id, before);
              await queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
            } catch (e) {
              toast.error(errorMessage(e, 'No se pudo deshacer'));
            }
          }} className="min-h-[36px] shrink-0 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15">
            Deshacer
          </button>
        </span>
      ), { duration: 8000 });
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cambiar la clase de personaje'));
    } finally {
      setAssigning(false);
    }
  };

  const selectTab = (id: ProfileTab) => {
    const params = new URLSearchParams(searchParams);
    if (id === 'resumen') params.delete('tab');
    else params.set('tab', id);
    setSearchParams(params, { replace: true });
  };

  // Pestañas accesibles: flechas izquierda/derecha, Inicio y Fin.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const i = PROFILE_TABS.findIndex((t) => t.id === tab);
    const target = event.key === 'ArrowRight' ? (i + 1) % PROFILE_TABS.length
      : event.key === 'ArrowLeft' ? (i - 1 + PROFILE_TABS.length) % PROFILE_TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? PROFILE_TABS.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    selectTab(PROFILE_TABS[target].id);
    tabRefs.current[PROFILE_TABS[target].id]?.focus();
  };

  return (
    <div className="space-y-5">
      <ProfileHeader
        classroom={classroom}
        student={student}
        summary={summary.data}
        accent={storyAccent}
        classIcon={classInfo?.icon || '👤'}
        characterClasses={characterClasses}
        position={index >= 0 ? index + 1 : 0}
        total={roster.length}
        previousName={previous ? nameOf(previous) : null}
        nextName={next ? nameOf(next) : null}
        assigning={assigning}
        onBack={() => navigate(`/classroom/${classroomId}/students`)}
        onPrevious={() => previous && goTo(previous.id)}
        onNext={() => next && goTo(next.id)}
        onAssignClass={assignClass}
        onGivePoints={() => setModal('points')}
        onGiveBadge={() => setModal('badge')}
        onEdit={() => setModal('edit')}
        onAccessCode={() => setModal('access')}
        onFamilyCode={() => setModal('family')}
        onRemove={() => setModal('remove')}
      />

      <div role="tablist" aria-label="Secciones del perfil" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {PROFILE_TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => selectTab(t.id)}
            onKeyDown={onTabKey}
            className={`min-h-[44px] flex-shrink-0 border-b-2 px-4 text-sm font-semibold ${tab === t.id ? 'border-primary-600 text-primary-800 dark:border-primary-400 dark:text-primary-200' : 'border-transparent text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'resumen' && (
          <SummaryTab student={student} summary={summary.data} loading={summary.isLoading} error={summary.isError} period={period} maxHp={maxHp} onPeriodChange={setPeriod} />
        )}
        {tab === 'actividad' && <ActivityTab classroomId={classroomId!} studentId={student.id} />}
        {tab === 'logros' && <AchievementsTab classroomId={classroomId!} studentId={student.id} summary={summary.data} onGiveBadge={() => setModal('badge')} />}
        {tab === 'aprendizaje' && <LearningTab classroomId={classroomId!} studentId={student.id} useCompetencies={!!classroom.useCompetencies} summary={summary.data} />}
      </div>

      <PointsModal
        isOpen={modal === 'points'}
        onClose={() => setModal(null)}
        isPositive
        selectedCount={1}
        selectedStudentNames={[name]}
        behaviors={allowNegative ? behaviors : behaviors.filter((b) => b.isPositive)}
        onApplyBehavior={async (behavior, multiplier) => {
          setModal(null);
          await pointsTools.apply(behavior, [student.id], name, multiplier);
        }}
        onApplyManual={async (pointType, amount, reason, competencyId, competencyIndicatorId) => {
          try {
            await studentApi.updatePoints(student.id, { pointType, amount, reason, competencyId, competencyIndicatorId });
            refreshStudent();
            setModal(null);
            toast.success(`${name}: +${amount} ${pointType}`);
          } catch (e) {
            toast.error(errorMessage(e, 'No se pudieron dar los puntos'));
          }
        }}
        isLoading={pointsTools.isApplying}
        classroomId={classroomId!}
        classroom={classroom}
      />

      <GiveBadgeModal
        isOpen={modal === 'badge'}
        onClose={() => setModal(null)}
        classroomId={classroomId!}
        selectedStudentIds={[student.id]}
        studentNames={[name]}
        onSuccess={() => {
          setModal(null);
          refreshStudent();
        }}
      />

      <AnimatePresence>
        {modal === 'edit' && <EditNamesModal key="edit" classroomId={classroomId!} student={student} onClose={() => setModal(null)} />}
        {modal === 'access' && <AccessCodeModal key="access" classroomId={classroomId!} student={student} name={name} onClose={() => setModal(null)} />}
        {modal === 'family' && <FamilyCodeModal key="family" classroomId={classroomId!} student={student} name={name} onClose={() => setModal(null)} />}
        {modal === 'remove' && (
          <RemoveStudentModal
            key="remove"
            student={student}
            name={name}
            onClose={() => setModal(null)}
            onRemoved={() => {
              setModal(null);
              queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
              navigate(`/classroom/${classroomId}/students`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
