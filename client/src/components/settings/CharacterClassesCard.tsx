import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Swords, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Classroom, Student } from '../../lib/classroomApi';
import { characterClassApi, type CharacterClassData } from '../../lib/characterClassApi';
import { EmojiPicker } from '../ui/EmojiPicker';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { errorMessage, secondaryButton } from '../gradebook/gradebookHelpers';
import { SettingsCard, Switch } from './settingsUi';

// Colores que entiende el resto de la app (claves en inglés), con nombre en español.
const CLASS_COLORS = [
  { key: 'blue', label: 'Azul', swatch: 'bg-blue-500', soft: 'bg-blue-100 dark:bg-blue-900/50' },
  { key: 'violet', label: 'Violeta', swatch: 'bg-violet-500', soft: 'bg-violet-100 dark:bg-violet-900/50' },
  { key: 'indigo', label: 'Índigo', swatch: 'bg-indigo-500', soft: 'bg-indigo-100 dark:bg-indigo-900/50' },
  { key: 'cyan', label: 'Celeste', swatch: 'bg-cyan-500', soft: 'bg-cyan-100 dark:bg-cyan-900/50' },
  { key: 'teal', label: 'Turquesa', swatch: 'bg-teal-500', soft: 'bg-teal-100 dark:bg-teal-900/50' },
  { key: 'emerald', label: 'Esmeralda', swatch: 'bg-emerald-500', soft: 'bg-emerald-100 dark:bg-emerald-900/50' },
  { key: 'green', label: 'Verde', swatch: 'bg-green-500', soft: 'bg-green-100 dark:bg-green-900/50' },
  { key: 'amber', label: 'Ámbar', swatch: 'bg-amber-500', soft: 'bg-amber-100 dark:bg-amber-900/50' },
  { key: 'orange', label: 'Naranja', swatch: 'bg-orange-500', soft: 'bg-orange-100 dark:bg-orange-900/50' },
  { key: 'red', label: 'Rojo', swatch: 'bg-red-500', soft: 'bg-red-100 dark:bg-red-900/50' },
  { key: 'rose', label: 'Frambuesa', swatch: 'bg-rose-500', soft: 'bg-rose-100 dark:bg-rose-900/50' },
  { key: 'pink', label: 'Rosa', swatch: 'bg-pink-500', soft: 'bg-pink-100 dark:bg-pink-900/50' },
] as const;

const colorOf = (key: string) => CLASS_COLORS.find((c) => c.key === key) ?? CLASS_COLORS[0];

// Clave interna única a partir del nombre (el profesor ya no la escribe).
const keyFromName = (name: string, existing: Set<string>) => {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'CLASE';
  let key = base;
  for (let n = 2; existing.has(key); n++) key = `${base}_${n}`;
  return key;
};

type FormTarget = { kind: 'create' } | { kind: 'edit'; data: CharacterClassData };

export const CharacterClassesCard = ({ classroom, students, onModeChange }: {
  classroom: Classroom;
  students: Student[];
  onModeChange: (mode: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNS') => void;
}) => {
  const queryClient = useQueryClient();
  const listKey = ['character-classes', classroom.id];
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [toDelete, setToDelete] = useState<CharacterClassData | null>(null);
  const modeId = useId();

  const { data: classes = [] } = useQuery({ queryKey: listKey, queryFn: () => characterClassApi.list(classroom.id) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: listKey });

  const toggleActive = useMutation({
    mutationFn: (cc: CharacterClassData) => characterClassApi.update(classroom.id, cc.id, { isActive: !cc.isActive }),
    onSuccess: (_data, cc) => toast.success(cc.isActive ? `${cc.name} ya no se puede elegir` : `${cc.name} vuelve a estar disponible`),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar la clase')),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (cc: CharacterClassData) => characterClassApi.remove(classroom.id, cc.id),
    onSuccess: (_data, cc) => {
      toast.success(`Clase eliminada: ${cc.name}`);
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la clase')),
    onSettled: refresh,
  });

  const studentsWith = (cc: CharacterClassData) =>
    students.filter((s) => s.characterClassId === cc.id || (!s.characterClassId && s.characterClass === cc.key)).length;

  const mode = classroom.classAssignmentMode ?? 'STUDENT_CHOICE';
  const modes = [
    { value: 'STUDENT_CHOICE' as const, title: 'El alumno la elige', detail: 'Al unirse o desde su perfil.' },
    { value: 'TEACHER_ASSIGNS' as const, title: 'Tú la asignas', detail: 'Desde la Lista o el perfil del alumno.' },
  ];

  return (
    <SettingsCard title="Clases de personaje" icon={Swords} description="El rol de cada alumno en el juego (Guardián, Arcano…).">
      <div role="radiogroup" aria-labelledby={`${modeId}-l`} className="py-3">
        <p id={`${modeId}-l`} className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">¿Quién elige la clase?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {modes.map((option) => {
            const selected = mode === option.value;
            return (
              <label key={option.value} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${selected ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'}`}>
                <input type="radio" name={`${modeId}-mode`} checked={selected} onChange={() => onModeChange(option.value)} className="h-4 w-4 accent-primary-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">{option.title}</span>
                  <span className="block text-sm text-gray-700 dark:text-gray-300">{option.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <ul className="space-y-2">
          {classes.map((cc) => {
            const color = colorOf(cc.color);
            return (
              <li key={cc.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2 pl-3 dark:border-gray-700">
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl ${color.soft}`} aria-hidden="true">{cc.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${cc.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 line-through dark:text-gray-300'}`}>{cc.name}</p>
                  <p className="truncate text-sm text-gray-700 dark:text-gray-300">{cc.isActive ? (cc.description || color.label) : 'No disponible para elegir'}</p>
                </div>
                <Switch checked={cc.isActive} onChange={() => toggleActive.mutate(cc)} disabled={toggleActive.isPending} label={`${cc.name}: disponible`} />
                <button type="button" onClick={() => setFormTarget({ kind: 'edit', data: cc })} aria-label={`Editar ${cc.name}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                  <Pencil size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setToDelete(cc)} aria-label={`Eliminar ${cc.name}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setFormTarget({ kind: 'create' })} className={`${secondaryButton} mt-3 w-full`}>
          <Plus size={16} aria-hidden="true" /> Añadir clase
        </button>
      </div>

      {formTarget && (
        <CharacterClassModal
          classroomId={classroom.id}
          target={formTarget}
          existingKeys={new Set(classes.map((c) => c.key))}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); void refresh(); }}
        />
      )}

      {toDelete && (
        <HomeModal
          title={`¿Eliminar «${toDelete.name}»?`}
          onClose={remove.isPending ? () => undefined : () => setToDelete(null)}
          footer={<>
            <button type="button" onClick={() => setToDelete(null)} disabled={remove.isPending} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={() => remove.mutate(toDelete)} disabled={remove.isPending}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
              {remove.isPending ? 'Eliminando…' : 'Eliminar clase'}
            </button>
          </>}
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {studentsWith(toDelete) > 0
              ? <><strong>{studentsWith(toDelete)} {studentsWith(toDelete) === 1 ? 'alumno la tiene' : 'alumnos la tienen'}</strong> y quedarán sin clase de personaje. </>
              : 'Ningún alumno la tiene. '}
            Si solo quieres que nadie más la elija, apaga «disponible» en su fila.
          </p>
        </HomeModal>
      )}
    </SettingsCard>
  );
};

const CharacterClassModal = ({ classroomId, target, existingKeys, onClose, onSaved }: {
  classroomId: string;
  target: FormTarget;
  existingKeys: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const editing = target.kind === 'edit' ? target.data : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '⚔️');
  const [color, setColor] = useState(editing?.color ?? 'blue');
  const nameId = useId();
  const descId = useId();
  const colorId = useId();
  const nameOk = name.trim().length > 0;

  const save = useMutation({
    mutationFn: () => editing
      ? characterClassApi.update(classroomId, editing.id, { name: name.trim(), description: description.trim(), icon, color })
      : characterClassApi.create(classroomId, { name: name.trim(), key: keyFromName(name, existingKeys), description: description.trim() || undefined, icon, color }),
    onSuccess: () => {
      toast.success(editing ? `Guardado: ${name.trim()}` : `Clase creada: ${name.trim()}`);
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la clase')),
  });

  return (
    <HomeModal
      title={editing ? 'Editar clase de personaje' : 'Nueva clase de personaje'}
      onClose={save.isPending ? () => undefined : onClose}
      footer={<>
        <button type="button" onClick={onClose} disabled={save.isPending} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={() => save.mutate()} disabled={!nameOk || save.isPending} className={primaryButton}>
          {save.isPending ? 'Guardando…' : editing ? 'Guardar' : 'Crear clase'}
        </button>
      </>}
    >
      <div className="flex items-end gap-3">
        <div>
          <span className={labelClass}>Ícono</span>
          <div className="mt-1.5"><EmojiPicker value={icon} onChange={setIcon} ariaLabel={`Ícono: ${icon}. Cambiar`} /></div>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={nameId} className={labelClass}>Nombre</label>
          <input id={nameId} type="text" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Sanador" data-autofocus className={`${inputClass} mt-1.5`} />
        </div>
      </div>
      <div>
        <label htmlFor={descId} className={labelClass}>Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
        <input id={descId} type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej.: Cuida al equipo y lo ayuda a recuperarse" className={`${inputClass} mt-1.5`} />
      </div>
      <fieldset>
        <legend id={colorId} className={labelClass}>Color</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CLASS_COLORS.map((option) => {
            const selected = color === option.key;
            return (
              <label key={option.key} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary-500 ${selected ? 'border-primary-600 bg-primary-50 text-gray-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-white' : 'border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:text-gray-100'}`}>
                <input type="radio" name={`${colorId}-color`} value={option.key} checked={selected} onChange={() => setColor(option.key)} className="sr-only" />
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${option.swatch}`} aria-hidden="true">
                  {selected && <Check size={14} strokeWidth={3} className="text-white" />}
                </span>
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </HomeModal>
  );
};
