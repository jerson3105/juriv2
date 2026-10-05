import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { cancelButton, primaryButton } from '../../home/homeHelpers';
import { SideDrawer } from '../SideDrawer';
import { schoolTeachersKey } from '../schoolHelpers';
import { assignmentApi, assignmentKeys, type FromClassesPreview, type PlanLevel } from '../../../lib/schoolAssignmentApi';
import { schoolRosterKeys } from '../../../lib/schoolRosterApi';
import type { SchoolLevel } from '../../../lib/schoolYearApi';
import { LEVEL_LABEL } from './schoolYearHelpers';
import { gradeLabel } from './sectionHelpers';

type DraftArea = { areaId: string; grades: number[] };

/** Plan de estudios del año, por nivel: qué áreas lleva y en qué grados. */
export const PlanDrawer = ({ schoolId, yearId, initialLevel, onClose }: { schoolId: string; yearId: string; initialLevel: SchoolLevel; onClose: () => void }) => {
  const plan = useQuery({ queryKey: assignmentKeys.plan(schoolId, yearId), queryFn: () => assignmentApi.getPlan(schoolId, yearId) });
  const [level, setLevel] = useState<SchoolLevel>(initialLevel);
  const current = plan.data?.levels.find((l) => l.level === level) ?? plan.data?.levels[0];
  return (
    <SideDrawer title="Plan de estudios" subtitle="Las áreas de cada nivel son las columnas de la matriz" onClose={onClose}>
      {plan.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Cargando el plan…</p>}
      {plan.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo cargar el plan.</p>}
      {plan.data && current && (
        <>
          {plan.data.levels.length > 1 && (
            <div className="pg-seg" role="group" aria-label="Nivel">
              {plan.data.levels.map((l) => (
                <button key={l.level} type="button" className="pg-seg-item pg-focus" aria-pressed={l.level === current.level} onClick={() => setLevel(l.level)}>{LEVEL_LABEL[l.level]}</button>
              ))}
            </div>
          )}
          <LevelPlan key={`${current.level}-${current.custom}-${current.areas.map((a) => a.areaId).join()}`} schoolId={schoolId} yearId={yearId} plan={current} />
        </>
      )}
      <div className="flex justify-end"><button type="button" className={cancelButton} onClick={onClose}>Cerrar</button></div>
    </SideDrawer>
  );
};

const LevelPlan = ({ schoolId, yearId, plan }: { schoolId: string; yearId: string; plan: PlanLevel }) => {
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<DraftArea[]>(() => plan.areas.map((a) => ({ areaId: a.areaId, grades: a.grades })));
  const nameOf = new Map(plan.available.map((a) => [a.areaId, a.name]));
  const addable = plan.available.filter((a) => !areas.some((x) => x.areaId === a.areaId));
  const changed = JSON.stringify(areas) !== JSON.stringify(plan.areas.map((a) => ({ areaId: a.areaId, grades: a.grades })));
  const save = useMutation({
    mutationFn: () => assignmentApi.savePlan(schoolId, yearId, plan.level, areas),
    onSuccess: (data) => {
      queryClient.setQueryData(assignmentKeys.plan(schoolId, yearId), data);
      void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
      toast.success(`Plan de ${LEVEL_LABEL[plan.level]} guardado`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar el plan')),
  });
  const move = (index: number, delta: number) => setAreas((list) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  });
  const toggleGrade = (index: number, grade: number) => setAreas((list) => list.map((a, i) => (i !== index ? a : {
    ...a, grades: a.grades.includes(grade) ? a.grades.filter((g) => g !== grade) : [...a.grades, grade].sort((x, y) => x - y),
  })));
  const empty = areas.some((a) => a.grades.length === 0);

  return (
    <section className="space-y-3" aria-label={`Plan de ${LEVEL_LABEL[plan.level]}`}>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {plan.custom ? 'Plan propio del colegio.' : 'Plan del CNEB (aún no lo cambiaste).'} Toca un grado para sacar el área de ese grado.
      </p>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {areas.map((area, index) => (
          <li key={area.areaId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white">{nameOf.get(area.areaId) ?? area.areaId}</span>
            <span className="flex flex-wrap gap-1" role="group" aria-label={`Grados de ${nameOf.get(area.areaId)}`}>
              {plan.grades.map((g) => (
                <button key={g} type="button" className="pg-chip pg-focus min-h-[32px] px-2 text-xs" aria-pressed={area.grades.includes(g)} onClick={() => toggleGrade(index, g)}>{gradeLabel(plan.level, g)}</button>
              ))}
            </span>
            <span className="flex gap-0.5">
              <button type="button" className="pg-icon-btn pg-focus h-8 w-8" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${nameOf.get(area.areaId)}`}><ArrowUp size={14} aria-hidden="true" /></button>
              <button type="button" className="pg-icon-btn pg-focus h-8 w-8" disabled={index === areas.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${nameOf.get(area.areaId)}`}><ArrowDown size={14} aria-hidden="true" /></button>
              <button type="button" className="pg-icon-btn pg-focus h-8 w-8" disabled={areas.length === 1} onClick={() => setAreas((list) => list.filter((_, i) => i !== index))} aria-label={`Quitar ${nameOf.get(area.areaId)} del plan`}><X size={14} aria-hidden="true" /></button>
            </span>
          </li>
        ))}
      </ul>
      {addable.length > 0 && (
        <select
          aria-label="Agregar un área"
          className="pg-focus min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value=""
          onChange={(e) => e.target.value && setAreas((list) => [...list, { areaId: e.target.value, grades: plan.grades }])}
        >
          <option value="">Agregar un área…</option>
          {addable.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
        </select>
      )}
      {empty && <p className="text-xs text-amber-900 dark:text-amber-100">Cada área necesita al menos un grado.</p>}
      <div className="flex justify-end">
        <button type="button" className={primaryButton} disabled={!changed || empty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando…' : `Guardar plan de ${LEVEL_LABEL[plan.level]}`}
        </button>
      </div>
    </section>
  );
};

const REASON: Record<FromClassesPreview['skipped'][number]['reason'], string> = {
  two_classes: 'Hay dos clases para la misma sección y área: elige una en la matriz',
  out_of_plan: 'El área no está en el plan de ese grado',
  not_member: 'Su docente ya no es parte de la escuela',
  taken: 'Esa sección y área ya tiene otro docente',
};

/** «Completar desde las clases»: las clases con sección (del armado) y área se vuelven asignaciones de su docente. */
export const FromClassesDrawer = ({ schoolId, yearId, onClose }: { schoolId: string; yearId: string; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const preview = useQuery({ queryKey: assignmentKeys.fromClasses(schoolId, yearId), queryFn: () => assignmentApi.fromClassesPreview(schoolId, yearId) });
  const confirm = useMutation({
    mutationFn: () => assignmentApi.fromClassesConfirm(schoolId, yearId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: schoolTeachersKey(schoolId) });
      toast.success(result.message);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo asignar desde las clases')),
  });
  const data = preview.data;
  return (
    <SideDrawer title="Completar desde las clases" subtitle="Cada clase con sección y área pasa a ser la asignación de su docente" onClose={onClose}>
      {preview.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Revisando las clases…</p>}
      {preview.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudieron revisar las clases.</p>}
      {data && (
        <>
          {data.proposals.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 px-4 py-8 text-center dark:border-gray-600">
              <div className="mx-auto flex w-fit gap-2" aria-hidden="true"><span className="text-3xl">🏫</span><span className="text-4xl">✅</span><span className="text-3xl">📚</span></div>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">No hay clases nuevas para asignar</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {data.already > 0 ? `${data.already} ${data.already === 1 ? 'clase ya está asignada' : 'clases ya están asignadas'}. ` : ''}Una clase necesita sección (de «Armar desde clases») y área.
              </p>
            </div>
          ) : (
            <section aria-labelledby="from-proposals">
              <h3 id="from-proposals" className="text-sm font-bold text-gray-900 dark:text-white">Se asignarán {data.proposals.length}</h3>
              <ul className="mt-2 divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                {data.proposals.map((p) => (
                  <li key={p.classroomId} className="px-3 py-2 text-sm">
                    <b className="text-gray-900 dark:text-white">{p.sectionLabel} · {p.areaName}</b>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">{p.teacherName} · clase «{p.className}»</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">La matrícula automática pondrá en cada clase a los estudiantes de su sección que aún no estén.</p>
            </section>
          )}
          {data.skipped.length > 0 && (
            <section aria-labelledby="from-skipped">
              <h3 id="from-skipped" className="text-sm font-bold text-gray-900 dark:text-white">Se omiten {data.skipped.length}</h3>
              <ul className="mt-2 space-y-1.5">
                {data.skipped.map((s) => (
                  <li key={s.classroomId} className="text-sm text-gray-800 dark:text-gray-100">
                    «{s.className}» · {s.sectionLabel} · {s.areaName}
                    <span className="block text-xs text-amber-900 dark:text-amber-100">{REASON[s.reason]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
            {data.proposals.length > 0 && (
              <button type="button" className={primaryButton} disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                {confirm.isPending ? 'Asignando…' : `Asignar ${data.proposals.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </SideDrawer>
  );
};
