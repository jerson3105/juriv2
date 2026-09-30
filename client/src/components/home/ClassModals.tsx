import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Copy, HelpCircle, Layers, ShoppingBag, Sparkles, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { HomeModal } from './HomeModal';
import { cancelButton, classroomsKey, copyClassCode, errorMessage, inputClass, labelClass, primaryButton } from './homeHelpers';

const checkRow = 'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/60';
const countChip = 'ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100';

// ── Duplicar ────────────────────────────────────────────────────────────────
export const CloneClassModal = ({ classroom, schools, onClose, onCloned }: {
  classroom: Classroom;
  schools: MySchool[];
  onClose: () => void;
  onCloned: (copy: Classroom) => void;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(`${classroom.name} (copia)`);
  const [description, setDescription] = useState(classroom.description ?? '');
  const [copy, setCopy] = useState({ behaviors: true, badges: true, shopItems: true, questionBanks: true });
  const [schoolId, setSchoolId] = useState<string | null>(schools.some((s) => s.id === classroom.schoolId) ? classroom.schoolId : null);

  const { data: counts } = useQuery({
    queryKey: ['cloneable-counts', classroom.id],
    queryFn: () => classroomApi.getCloneableCounts(classroom.id),
  });

  const clone = useMutation({
    mutationFn: () => classroomApi.clone(classroom.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      copyBehaviors: copy.behaviors,
      copyBadges: copy.badges,
      copyShopItems: copy.shopItems,
      copyQuestionBanks: copy.questionBanks,
      schoolId,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: classroomsKey });
      toast.success(`Copia creada: ${data.classroom.name}`);
      onCloned(data.classroom);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo duplicar la clase')),
  });

  const items = [
    { key: 'behaviors' as const, icon: Sparkles, label: 'Comportamientos', hint: 'Acciones positivas y a mejorar', n: counts?.behaviors },
    { key: 'badges' as const, icon: Trophy, label: 'Insignias', hint: 'Logros y reconocimientos', n: counts?.badges },
    { key: 'shopItems' as const, icon: ShoppingBag, label: 'Tienda', hint: 'Artículos y recompensas', n: counts?.shopItems },
    { key: 'questionBanks' as const, icon: HelpCircle, label: 'Bancos de preguntas', hint: 'Para torneos y actividades', n: counts?.questionBanks },
  ];
  const canSubmit = name.trim().length >= 2 && !clone.isPending;

  return (
    <HomeModal
      title="Duplicar clase"
      subtitle={`Nueva clase con la configuración de "${classroom.name}", sin estudiantes`}
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={!canSubmit} onClick={() => clone.mutate()} className={primaryButton}><Layers size={16} aria-hidden="true" />{clone.isPending ? 'Duplicando...' : 'Duplicar'}</button></>}
    >
      <label className={labelClass}>
        Nombre de la nueva clase
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} data-autofocus className={`${inputClass} mt-1.5`} />
      </label>
      <label className={labelClass}>
        Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={`${inputClass} mt-1.5`} />
      </label>
      <fieldset className="space-y-2">
        <legend className={`${labelClass} mb-1.5`}>¿Qué copiar?</legend>
        {items.map((item) => (
          <label key={item.key} className={checkRow}>
            <input type="checkbox" checked={copy[item.key]} onChange={(e) => setCopy((c) => ({ ...c, [item.key]: e.target.checked }))} className="h-4 w-4 accent-primary-600" />
            <item.icon size={18} className="text-primary-700 dark:text-primary-300" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">{item.label}</span>
              <span className="block text-xs text-gray-700 dark:text-gray-300">{item.hint}</span>
            </span>
            {item.n !== undefined && <span className={countChip}>{item.n}</span>}
          </label>
        ))}
      </fieldset>
      {classroom.useCompetencies && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">También se copia la configuración de competencias.</p>}
      {schools.length > 0 && (
        <label className={labelClass}>
          Escuela
          <select value={schoolId ?? ''} onChange={(e) => setSchoolId(e.target.value || null)} className={`${inputClass} mt-1.5`}>
            <option value="">Sin escuela (clase personal)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
    </HomeModal>
  );
};

// ── Eliminar definitivamente (solo archivadas) ──────────────────────────────
export const DeleteClassModal = ({ classroom, onClose, onDeleted }: { classroom: Classroom; onClose: () => void; onDeleted: () => void }) => {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLocaleLowerCase('es') === classroom.name.trim().toLocaleLowerCase('es');
  const students = classroom.studentCount ?? 0;

  const remove = useMutation({
    mutationFn: () => classroomApi.delete(classroom.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classroomsKey });
      toast.success(`Clase eliminada: ${classroom.name}`);
      onDeleted();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la clase')),
  });

  return (
    <HomeModal
      title="Eliminar definitivamente"
      subtitle={classroom.name}
      onClose={remove.isPending ? () => undefined : onClose}
      footer={<><button type="button" onClick={onClose} disabled={remove.isPending} className={cancelButton}>Cancelar</button><button type="button" disabled={!matches || remove.isPending} onClick={() => remove.mutate()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">{remove.isPending ? 'Eliminando...' : 'Eliminar para siempre'}</button></>}
    >
      <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-100">
        <AlertTriangle size={20} className="flex-shrink-0" aria-hidden="true" />
        <p>
          Se borrarán {students > 0 ? <strong>{students} {students === 1 ? 'estudiante' : 'estudiantes'} con todo su progreso</strong> : 'todos los datos'}: puntos, asistencia, insignias, tienda, coleccionables y actividades. <strong>No se puede deshacer.</strong>
        </p>
      </div>
      <label className={labelClass}>
        Escribe el nombre de la clase para confirmar
        <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={classroom.name} autoComplete="off" data-autofocus className={`${inputClass} mt-1.5`} />
      </label>
    </HomeModal>
  );
};

// ── Asignar clases personales a una escuela ─────────────────────────────────
export const AssignSchoolModal = ({ classrooms, schools, onClose }: { classrooms: Classroom[]; schools: MySchool[]; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const personal = classrooms.filter((c) => !c.schoolId && c.isActive !== false);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const assign = async () => {
    if (!schoolId || selected.size === 0) return;
    setAssigning(true);
    const results = await Promise.allSettled([...selected].map((id) => schoolApi.assignClassroom(schoolId, id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    setAssigning(false);
    queryClient.invalidateQueries({ queryKey: classroomsKey });
    if (failed === 0) {
      toast.success(`${ok} ${ok === 1 ? 'clase asignada' : 'clases asignadas'} a la escuela`);
      onClose();
    } else {
      const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      toast.error(`${ok} asignadas, ${failed} con error: ${errorMessage(firstError?.reason, 'inténtalo de nuevo')}`);
    }
  };

  return (
    <HomeModal
      title="Asignar clases a una escuela"
      subtitle="Sus reportes pasan a verse en la escuela. Califican por competencias."
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={assigning || !schoolId || selected.size === 0} onClick={assign} className={primaryButton}>{assigning ? 'Asignando...' : `Asignar${selected.size ? ` (${selected.size})` : ''}`}</button></>}
    >
      <label className={labelClass}>
        Escuela
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={`${inputClass} mt-1.5`} data-autofocus>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {personal.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">Todas tus clases activas ya tienen escuela.</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className={`${labelClass} mb-1.5`}>Clases sin escuela ({personal.length})</legend>
          {personal.map((c) => (
            <label key={c.id} className={checkRow}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-primary-600" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
                <span className="block text-xs text-gray-700 dark:text-gray-300">{c.studentCount ?? 0} estudiantes</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </HomeModal>
  );
};

// ── Proyectar el código para que los estudiantes se unan ────────────────────
export const ProjectCodeModal = ({ classroom, onClose }: { classroom: Classroom; onClose: () => void }) => {
  const site = window.location.host;
  return (
    <HomeModal
      title={`Código de ${classroom.name}`}
      onClose={onClose}
      size="lg"
      footer={<><button type="button" onClick={() => void copyClassCode(classroom.code)} className={cancelButton}><Copy size={16} className="mr-1 inline" aria-hidden="true" />Copiar</button><button type="button" onClick={onClose} className={primaryButton} data-autofocus>Listo</button></>}
    >
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-indigo-200">Únete a {classroom.name}</p>
        <p className="mt-3 break-all font-mono text-5xl font-black tracking-[0.2em] sm:text-7xl" aria-label={`Código ${classroom.code.split('').join(' ')}`}>{classroom.code}</p>
        <ol className="mx-auto mt-6 max-w-md space-y-1 text-left text-base text-indigo-50">
          <li>1. Entra a <strong className="text-white">{site}</strong> e inicia sesión como estudiante.</li>
          <li>2. Elige <strong className="text-white">Unirme a una clase</strong>.</li>
          <li>3. Escribe este código.</li>
        </ol>
      </div>
    </HomeModal>
  );
};
