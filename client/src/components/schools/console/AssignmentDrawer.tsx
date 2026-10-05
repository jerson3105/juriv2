import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCw, Trash2 } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { cancelButton, primaryButton } from '../../home/homeHelpers';
import { SideDrawer } from '../SideDrawer';
import { schoolTeachersKey } from '../schoolHelpers';
import {
  assignmentApi, assignmentKeys, type ClassroomChoice, type MatrixAssignment, type MatrixSection, type MatrixTeacher, type PlanArea,
} from '../../../lib/schoolAssignmentApi';
import { schoolRosterKeys } from '../../../lib/schoolRosterApi';

type Mode = 'keep' | 'create' | 'link' | 'none';
const select = 'pg-focus min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/** Panel de una celda: asignar docente y clase, cambiarlos, sincronizar o quitar la asignación. */
export const AssignmentDrawer = ({ schoolId, yearId, section, area, assignment, teachers, onClose }: {
  schoolId: string; yearId: string; section: MatrixSection; area: PlanArea; assignment: MatrixAssignment | null;
  teachers: MatrixTeacher[]; onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState(assignment?.teacherUserId ?? '');
  const [mode, setMode] = useState<Mode>(assignment ? 'keep' : 'create');
  const [classroomId, setClassroomId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const teacher = teachers.find((t) => t.userId === teacherId);
  const firstName = teacher?.name.split(' ')[0] ?? 'el docente';
  const changingTeacher = !!assignment && teacherId !== assignment.teacherUserId;
  const effectiveMode: Mode = changingTeacher && mode === 'keep' ? 'none' : mode;

  const classes = useQuery({
    queryKey: assignmentKeys.teacherClasses(schoolId, teacherId),
    queryFn: () => assignmentApi.teacherClassrooms(schoolId, teacherId),
    enabled: !!teacherId,
  });
  // Clases libres del docente que pueden ser de esta celda (sin sección y área, o con las mismas).
  const usable = (classes.data ?? []).filter((c) => (!c.linked || c.id === assignment?.classroom?.id)
    && (!c.sectionId || c.sectionId === section.id) && (!c.areaId || c.areaId === area.areaId)
    && c.id !== assignment?.classroom?.id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.teacherClasses(schoolId, teacherId) });
    void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: schoolTeachersKey(schoolId) });
  };
  const choice = (): ClassroomChoice | undefined => {
    if (effectiveMode === 'keep') return undefined;
    if (effectiveMode === 'link') return { mode: 'link', classroomId };
    return { mode: effectiveMode };
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!assignment) return assignmentApi.create(schoolId, yearId, { sectionId: section.id, areaId: area.areaId, teacherUserId: teacherId, classroom: choice()! });
      return assignmentApi.update(schoolId, assignment.id, { ...(changingTeacher ? { teacherUserId: teacherId } : {}), ...(choice() ? { classroom: choice() } : {}) });
    },
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la asignación')),
  });
  const sync = useMutation({
    mutationFn: () => assignmentApi.sync(schoolId, assignment!.id),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo sincronizar')),
  });
  const remove = useMutation({
    mutationFn: () => assignmentApi.remove(schoolId, assignment!.id),
    onSuccess: (message) => {
      refresh();
      toast.success(message);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar la asignación')),
  });

  const nothingToSave = !!assignment && !changingTeacher && effectiveMode === 'keep';
  const invalid = !teacherId || (effectiveMode === 'link' && !classroomId) || nothingToSave;
  const title = `${section.label} · ${area.name}`;
  const radio = (value: Mode, label: string, disabled = false) => (
    <label className={`flex min-h-[40px] items-center gap-2 text-sm ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
      <input type="radio" name="assignment-class" value={value} checked={effectiveMode === value} disabled={disabled} onChange={() => setMode(value)} className="h-4 w-4 accent-primary-600" />
      {label}
    </label>
  );

  return (
    <SideDrawer title={title} subtitle={`${section.students} ${section.students === 1 ? 'estudiante' : 'estudiantes'}`} onClose={onClose}>
      {assignment && (
        <section className="rounded-xl border border-gray-200 p-3 dark:border-gray-700" aria-label="Asignación actual">
          <p className="text-sm text-gray-800 dark:text-gray-100">
            <b>{teachers.find((t) => t.userId === assignment.teacherUserId)?.name ?? 'Docente'}</b>
            {assignment.classroom
              ? <> · clase «{assignment.classroom.name}»{assignment.classroom.archived ? ' (archivada)' : ''} con {assignment.classroom.students} {assignment.classroom.students === 1 ? 'estudiante' : 'estudiantes'}</>
              : ' · sin clase vinculada'}
          </p>
          {assignment.classroom && assignment.classroom.missing > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-amber-900 dark:text-amber-100">{assignment.classroom.missing} de la sección aún no {assignment.classroom.missing === 1 ? 'está' : 'están'} en la clase.</p>
              <button type="button" className="pg-btn pg-focus" onClick={() => sync.mutate()} disabled={sync.isPending}>
                <RefreshCw size={16} aria-hidden="true" />{sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
              </button>
            </div>
          )}
        </section>
      )}

      <div>
        <label htmlFor="assignment-teacher" className="text-sm font-semibold text-gray-800 dark:text-gray-100">Docente</label>
        <select id="assignment-teacher" className={`${select} mt-1`} value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setClassroomId(''); if (!assignment) setMode('create'); }}>
          <option value="">Elige…</option>
          {teachers.map((t) => <option key={t.userId} value={t.userId}>{t.name} · {t.assignments} {t.assignments === 1 ? 'asignación' : 'asignaciones'}</option>)}
        </select>
        {changingTeacher && assignment?.classroom && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">La clase «{assignment.classroom.name}» sigue siendo de su docente, con sus estudiantes; solo deja de estar vinculada.</p>
        )}
      </div>

      {teacherId && (
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 dark:text-gray-100">Clase</legend>
          <div className="mt-1 space-y-0.5">
            {assignment && !changingTeacher && radio('keep', assignment.classroom ? `Seguir con «${assignment.classroom.name}»` : 'Seguir sin clase')}
            {radio('create', `Crear «${area.name} ${section.label}» para ${firstName}`)}
            {radio('link', `Usar una clase que ${firstName} ya tiene`, !classes.isLoading && usable.length === 0)}
            {effectiveMode === 'link' && (
              <select aria-label="Clase que ya tiene" className={`${select} ml-6 w-[calc(100%-1.5rem)]`} value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                <option value="">Elige la clase…</option>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.students} {c.students === 1 ? 'estudiante' : 'estudiantes'}</option>)}
              </select>
            )}
            {!classes.isLoading && usable.length === 0 && <p className="ml-6 text-xs text-gray-600 dark:text-gray-300">No tiene clases libres de esta sección y área en la escuela.</p>}
            {radio('none', 'Sin clase por ahora')}
          </div>
        </fieldset>
      )}

      {(effectiveMode === 'create' || effectiveMode === 'link') && (
        <p className="rounded-xl bg-primary-50 p-3 text-sm text-primary-950 dark:bg-primary-500/10 dark:text-primary-50">
          La matrícula automática pondrá a {section.students === 1 ? 'el estudiante' : `los ${section.students} estudiantes`} de {section.label} en la clase. Quien ya tiene una cuenta la verá sola; los demás la reclaman con su tarjeta.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
        <button type="button" className={primaryButton} disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando…' : assignment ? 'Guardar' : 'Asignar'}
        </button>
      </div>

      {assignment && (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          {confirmRemove ? (
            <div role="alertdialog" aria-label="Quitar la asignación" className="space-y-2">
              <p className="text-sm text-gray-800 dark:text-gray-100">¿Quitar la asignación? La clase y sus estudiantes siguen con su docente.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => remove.mutate()} disabled={remove.isPending}>Quitar</button>
                <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirmRemove(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="pg-btn pg-btn-ghost pg-focus text-red-800 dark:text-red-200" onClick={() => setConfirmRemove(true)}>
              <Trash2 size={16} aria-hidden="true" />Quitar la asignación
            </button>
          )}
        </div>
      )}
    </SideDrawer>
  );
};
