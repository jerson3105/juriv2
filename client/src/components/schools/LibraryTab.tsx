import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Award, Coins, Download, Heart, Lightbulb, Pencil, Plus, Star, Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { schoolApi, type LibraryLevel, type SchoolBadge, type SchoolBehavior, type SchoolClassroom } from '../../lib/schoolApi';
import type { MyCoordination } from '../../lib/schoolCoordinatorApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, errorMessage, gradeLabel, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { LEVEL_LABEL } from './console/schoolYearHelpers';
import { schoolBadgesKey, schoolBehaviorsKey } from './schoolHelpers';

const BEHAVIOR_ICONS = ['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '⚡', '🔥', '🤝', '🙋', '📝', '🎨'];
const BADGE_ICONS = ['🏆', '⭐', '🎖️', '🥇', '🎓', '🦊', '💎', '👑', '🎯', '🔥', '💪', '📚', '✨', '🌟', '🛡️', '🎨'];
const RARITY: Record<SchoolBadge['rarity'], { label: string; chip: string }> = {
  COMMON: { label: 'Común', chip: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100' },
  RARE: { label: 'Rara', chip: 'bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100' },
  EPIC: { label: 'Épica', chip: 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100' },
  LEGENDARY: { label: 'Legendaria', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
};
const valueChip = 'rounded-full px-2 py-0.5 text-xs font-bold';
const iconButton = 'flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';
const outlineButton = 'inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const selectClass = `${inputClass} mt-1.5`;

/** Área y nivel de una propuesta (la crea el coordinador del área). */
interface AreaScope { areaId: string; level: LibraryLevel; label: string }
const scopeLabel = (name: string, level: LibraryLevel) => `${name} · ${LEVEL_LABEL[level]}`;
const itemScopeLabel = (item: SchoolBehavior | SchoolBadge) => (item.area && item.level ? scopeLabel(item.area.name, item.level) : null);

const IconPicker = ({ icons, value, onChange, label }: { icons: string[]; value: string; onChange: (v: string) => void; label: string }) => (
  <fieldset>
    <legend className={`${labelClass} mb-1.5`}>{label}</legend>
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {icons.map((e) => (
        <button key={e} type="button" role="radio" aria-checked={value === e} aria-label={e} onClick={() => onChange(e)} className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${value === e ? 'bg-primary-100 ring-2 ring-primary-600 dark:bg-primary-900/50' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
          {e}
        </button>
      ))}
    </div>
  </fieldset>
);

const NumberField = ({ label, icon: Icon, value, onChange }: { label: string; icon: typeof Zap; value: number; onChange: (v: number) => void }) => (
  <label className={labelClass}>
    <span className="flex items-center gap-1.5"><Icon size={14} aria-hidden="true" />{label}</span>
    <input type="number" min={0} max={9999} value={value} onChange={(e) => onChange(Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0)))} className={`${inputClass} mt-1.5 text-center font-bold`} />
  </label>
);

/** Al proponer con más de un área coordinada: para cuál es. */
const ScopePicker = ({ scopes, value, onChange }: { scopes: AreaScope[]; value: number; onChange: (index: number) => void }) =>
  scopes.length > 1 ? (
    <label className={labelClass}>
      Para
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={selectClass}>
        {scopes.map((s, i) => <option key={`${s.level}-${s.areaId}`} value={i}>{s.label}</option>)}
      </select>
    </label>
  ) : null;

/** Quién lo ve: todo el colegio o los docentes de un área. */
const audienceText = (label: string | null) => (label ? `Lo ven en la Biblioteca los docentes de ${label}` : 'Los profesores lo importan a sus clases');

// ── Formularios (crear y editar) ────────────────────────────────────────────
// scopes: al crear, las áreas para las que se propone (vacío = del colegio). Al editar no se cambia de área.
const BehaviorForm = ({ schoolId, behavior, scopes, onClose }: { schoolId: string; behavior: SchoolBehavior | null; scopes: AreaScope[]; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState(behavior?.icon ?? '⭐');
  const [name, setName] = useState(behavior?.name ?? '');
  const [description, setDescription] = useState(behavior?.description ?? '');
  const [xp, setXp] = useState(behavior?.xpValue ?? 10);
  const [hp, setHp] = useState(behavior?.hpValue ?? 0);
  const [gp, setGp] = useState(behavior?.gpValue ?? 0);
  const [scopeIndex, setScopeIndex] = useState(0);
  const scope = behavior ? null : scopes[scopeIndex] ?? null;
  const audience = behavior ? itemScopeLabel(behavior) : scope?.label ?? null;

  const save = useMutation({
    mutationFn: () => {
      const pointType: 'XP' | 'HP' | 'GP' = xp >= hp && xp >= gp ? 'XP' : hp >= gp ? 'HP' : 'GP';
      const data = { name: name.trim(), description: description.trim() || undefined, icon, pointType, pointValue: pointType === 'XP' ? xp : pointType === 'HP' ? hp : gp, xpValue: xp, hpValue: hp, gpValue: gp };
      return behavior
        ? schoolApi.updateSchoolBehavior(behavior.id, data)
        : schoolApi.createSchoolBehavior(schoolId, scope ? { ...data, areaId: scope.areaId, level: scope.level } : data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolBehaviorsKey(schoolId) });
      toast.success(behavior ? 'Comportamiento actualizado' : scope ? 'Propuesta lista para tu área' : 'Comportamiento creado');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo guardar')),
  });
  const valid = name.trim().length > 0 && (xp > 0 || hp > 0 || gp > 0);

  return (
    <HomeModal
      title={behavior ? 'Editar comportamiento' : scope ? 'Proponer un comportamiento' : 'Nuevo comportamiento de escuela'}
      subtitle={`${audienceText(audience)}; editarlo aquí no cambia las copias ya importadas.`}
      onClose={onClose}
      size="lg"
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()} className={primaryButton}>{save.isPending ? 'Guardando...' : 'Guardar'}</button></>}
    >
      {!behavior && <ScopePicker scopes={scopes} value={scopeIndex} onChange={setScopeIndex} />}
      <IconPicker icons={BEHAVIOR_ICONS} value={icon} onChange={setIcon} label="Icono" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Nombre<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="Ej: Participación activa" data-autofocus className={`${inputClass} mt-1.5`} /></label>
        <label className={labelClass}>Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className={`${inputClass} mt-1.5`} /></label>
      </div>
      <fieldset>
        <legend className={`${labelClass} mb-1.5`}>Recompensa (puedes combinar)</legend>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="XP" icon={Zap} value={xp} onChange={setXp} />
          <NumberField label="HP" icon={Heart} value={hp} onChange={setHp} />
          <NumberField label="Oro" icon={Coins} value={gp} onChange={setGp} />
        </div>
        {!(xp > 0 || hp > 0 || gp > 0) && <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">Pon al menos un valor mayor que 0.</p>}
      </fieldset>
    </HomeModal>
  );
};

const BadgeForm = ({ schoolId, badge, scopes, onClose }: { schoolId: string; badge: SchoolBadge | null; scopes: AreaScope[]; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState(badge?.icon ?? '🏆');
  const [name, setName] = useState(badge?.name ?? '');
  const [description, setDescription] = useState(badge?.description ?? '');
  const [rarity, setRarity] = useState<'RARE' | 'EPIC' | 'LEGENDARY'>(badge?.rarity === 'EPIC' || badge?.rarity === 'LEGENDARY' ? badge.rarity : 'RARE');
  const [xp, setXp] = useState(badge?.rewardXp ?? 0);
  const [gp, setGp] = useState(badge?.rewardGp ?? 0);
  const [scopeIndex, setScopeIndex] = useState(0);
  const scope = badge ? null : scopes[scopeIndex] ?? null;
  const audience = badge ? itemScopeLabel(badge) : scope?.label ?? null;

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim(), icon, rarity, rewardXp: xp, rewardGp: gp, assignmentMode: 'MANUAL' as const };
      return badge
        ? schoolApi.updateSchoolBadge(badge.id, data)
        : schoolApi.createSchoolBadge(schoolId, scope ? { ...data, areaId: scope.areaId, level: scope.level } : data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolBadgesKey(schoolId) });
      toast.success(badge ? 'Insignia actualizada' : scope ? 'Propuesta lista para tu área' : 'Insignia creada');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo guardar')),
  });
  const valid = name.trim().length > 0 && description.trim().length > 0;

  return (
    <HomeModal
      title={badge ? 'Editar insignia' : scope ? 'Proponer una insignia' : 'Nueva insignia de escuela'}
      subtitle={audience ? `${audienceText(audience)}; se otorga a mano en cada clase que la importe.` : 'Se otorga a mano en cada clase que la importe.'}
      onClose={onClose}
      size="lg"
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()} className={primaryButton}>{save.isPending ? 'Guardando...' : 'Guardar'}</button></>}
    >
      {!badge && <ScopePicker scopes={scopes} value={scopeIndex} onChange={setScopeIndex} />}
      <IconPicker icons={BADGE_ICONS} value={icon} onChange={setIcon} label="Icono" />
      <label className={labelClass}>Nombre<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Ej: Estudiante del mes" data-autofocus className={`${inputClass} mt-1.5`} /></label>
      <label className={labelClass}>Descripción<input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} placeholder="Por qué se gana" className={`${inputClass} mt-1.5`} /></label>
      <fieldset>
        <legend className={`${labelClass} mb-1.5`}>Rareza</legend>
        <div className="flex flex-wrap gap-2">
          {(['RARE', 'EPIC', 'LEGENDARY'] as const).map((r) => (
            <button key={r} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)} className={`min-h-[40px] rounded-xl px-4 text-sm font-bold ${rarity === r ? 'ring-2 ring-primary-600 ' + RARITY[r].chip : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100'}`}>
              {RARITY[r].label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="XP al ganarla" icon={Zap} value={xp} onChange={setXp} />
        <NumberField label="Oro al ganarla" icon={Coins} value={gp} onChange={setGp} />
      </div>
    </HomeModal>
  );
};

// ── Importar a mis clases ───────────────────────────────────────────────────
const ImportModal = ({ kind, schoolId, ids, myClassrooms, onClose, onDone }: { kind: 'behaviors' | 'badges'; schoolId: string; ids: string[]; myClassrooms: SchoolClassroom[]; onClose: () => void; onDone: () => void }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(myClassrooms.map((c) => c.id)));
  const run = useMutation({
    mutationFn: (): Promise<{ classrooms: number }> => (kind === 'behaviors'
      ? schoolApi.importBehaviors(schoolId, ids, [...selected])
      : schoolApi.importBadges(schoolId, ids, [...selected])),
    onSuccess: (data) => {
      toast.success(`Importado a ${data.classrooms} ${data.classrooms === 1 ? 'clase' : 'clases'}`);
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo importar')),
  });
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <HomeModal
      title="Importar a mis clases"
      subtitle={`${ids.length} ${kind === 'behaviors' ? (ids.length === 1 ? 'comportamiento' : 'comportamientos') : (ids.length === 1 ? 'insignia' : 'insignias')} · se crea una copia en cada clase`}
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={selected.size === 0 || run.isPending} onClick={() => run.mutate()} className={primaryButton}><Download size={16} aria-hidden="true" />{run.isPending ? 'Importando...' : `Importar a ${selected.size}`}</button></>}
    >
      <fieldset className="space-y-2">
        <legend className={`${labelClass} mb-1.5`}>Tus clases en esta escuela</legend>
        {myClassrooms.map((c) => (
          <label key={c.id} className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/60">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-primary-600" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
              <span className="block text-xs text-gray-700 dark:text-gray-300">{[gradeLabel(c.gradeLevel), `${c.studentCount} estudiantes`].filter(Boolean).join(' · ')}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </HomeModal>
  );
};

// ── Pestaña ─────────────────────────────────────────────────────────────────
interface LibraryTabProps {
  schoolId: string;
  manage: boolean;
  myClassrooms: SchoolClassroom[];
  /** Áreas que coordino este año: propongo y gestiono lo de esas áreas. */
  coordinations?: MyCoordination[];
}

type Editing = { kind: 'behavior'; item: SchoolBehavior | null; scopes: AreaScope[] } | { kind: 'badge'; item: SchoolBadge | null; scopes: AreaScope[] } | null;
type Item = SchoolBehavior | SchoolBadge;

/** Lo del colegio primero; luego cada área (con su nivel) en orden alfabético. */
const groupItems = <T extends Item>(items: T[]) => {
  const groups = new Map<string, { key: string; label: string | null; areaId: string | null; level: LibraryLevel | null; items: T[] }>();
  for (const item of items) {
    const key = item.areaId && item.level ? `${item.level}|${item.areaId}` : '';
    const group = groups.get(key) ?? { key, label: key ? itemScopeLabel(item) ?? 'Otra área' : null, areaId: item.areaId, level: item.level, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : (a.label ?? '').localeCompare(b.label ?? '', 'es')));
};

export const LibraryTab = ({ schoolId, manage, myClassrooms, coordinations = [] }: LibraryTabProps) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [picked, setPicked] = useState<{ behaviors: Set<string>; badges: Set<string> }>({ behaviors: new Set(), badges: new Set() });
  const [importing, setImporting] = useState<'behaviors' | 'badges' | null>(null);

  const { data: behaviors = [], isLoading: loadingBehaviors } = useQuery({ queryKey: schoolBehaviorsKey(schoolId), queryFn: () => schoolApi.getSchoolBehaviors(schoolId) });
  const { data: badges = [], isLoading: loadingBadges } = useQuery({ queryKey: schoolBadgesKey(schoolId), queryFn: () => schoolApi.getSchoolBadges(schoolId) });

  const myScopes: AreaScope[] = coordinations.map((c) => ({ areaId: c.area.id, level: c.level, label: scopeLabel(c.area.name, c.level) }));
  const coordinates = (areaId: string | null, level: LibraryLevel | null) => !!areaId && !!level && myScopes.some((s) => s.areaId === areaId && s.level === level);
  // Lo del colegio lo gestiona la administración; lo de un área, también su coordinador.
  const canEdit = (item: Item) => manage || coordinates(item.areaId, item.level);

  const togglePick = (kind: 'behaviors' | 'badges', id: string) => setPicked((prev) => {
    const next = new Set(prev[kind]);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...prev, [kind]: next };
  });

  // Se elimina al instante y "Deshacer" lo vuelve a activar.
  const remove = async (kind: 'behaviors' | 'badges', id: string, name: string) => {
    const key = kind === 'behaviors' ? schoolBehaviorsKey(schoolId) : schoolBadgesKey(schoolId);
    const setActive = (isActive: boolean) => (kind === 'behaviors' ? schoolApi.updateSchoolBehavior(id, { isActive }) : schoolApi.updateSchoolBadge(id, { isActive }));
    try {
      await (kind === 'behaviors' ? schoolApi.deleteSchoolBehavior(id) : schoolApi.deleteSchoolBadge(id));
      queryClient.invalidateQueries({ queryKey: key });
      toast.success((t) => (
        <span className="flex items-center gap-3">
          <span>Eliminado: {name}. Las copias ya importadas se mantienen.</span>
          <button type="button" onClick={async () => { toast.dismiss(t.id); try { await setActive(true); queryClient.invalidateQueries({ queryKey: key }); } catch (e) { toast.error(errorMessage(e, 'No se pudo restaurar')); } }} className="min-h-[36px] shrink-0 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15">
            Deshacer
          </button>
        </span>
      ), { duration: 8000 });
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar'));
    }
  };

  const row = (kind: 'behaviors' | 'badges', item: Item) => {
    const isBehaviors = kind === 'behaviors';
    const checked = picked[kind].has(item.id);
    const b = item as SchoolBehavior;
    const g = item as SchoolBadge;
    return (
      <li key={item.id} className={`flex items-center gap-3 px-3 py-2.5 ${checked ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
        <input type="checkbox" checked={checked} onChange={() => togglePick(kind, item.id)} aria-label={`Seleccionar ${item.name}`} className="h-5 w-5 accent-primary-600" />
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl dark:bg-gray-700" aria-hidden="true">{item.icon || (isBehaviors ? '⭐' : '🏆')}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900 dark:text-white">{item.name}</p>
          {item.description && <p className="truncate text-sm text-gray-700 dark:text-gray-300">{item.description}</p>}
        </div>
        <div className="hidden flex-shrink-0 flex-wrap justify-end gap-1 min-[480px]:flex">
          {isBehaviors ? (
            <>
              {b.xpValue > 0 && <span className={`${valueChip} bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100`}>+{b.xpValue} XP</span>}
              {b.hpValue > 0 && <span className={`${valueChip} bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100`}>+{b.hpValue} HP</span>}
              {b.gpValue > 0 && <span className={`${valueChip} bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100`}>+{b.gpValue} oro</span>}
            </>
          ) : (
            <span className={`${valueChip} ${RARITY[g.rarity].chip}`}>{RARITY[g.rarity].label}</span>
          )}
        </div>
        {canEdit(item) && (
          <span className="flex flex-shrink-0">
            <button type="button" onClick={() => setEditing(isBehaviors ? { kind: 'behavior', item: b, scopes: [] } : { kind: 'badge', item: g, scopes: [] })} aria-label={`Editar ${item.name}`} title="Editar" className={iconButton}><Pencil size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => void remove(kind, item.id, item.name)} aria-label={`Eliminar ${item.name}`} title="Eliminar" className={`${iconButton} text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30`}><Trash2 size={16} aria-hidden="true" /></button>
          </span>
        )}
      </li>
    );
  };

  const section = (kind: 'behaviors' | 'badges') => {
    const isBehaviors = kind === 'behaviors';
    const items: Item[] = isBehaviors ? behaviors : badges;
    const loading = isBehaviors ? loadingBehaviors : loadingBadges;
    const count = picked[kind].size;
    const groups = groupItems(items);
    const grouped = groups.some((group) => group.key !== '');
    const open = (scopes: AreaScope[]) => setEditing(isBehaviors ? { kind: 'behavior', item: null, scopes } : { kind: 'badge', item: null, scopes });
    return (
      <section aria-labelledby={`lib-${kind}`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`lib-${kind}`} className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
            {isBehaviors ? <Star size={18} aria-hidden="true" /> : <Award size={18} aria-hidden="true" />}
            {isBehaviors ? 'Comportamientos' : 'Insignias'} ({items.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {count > 0 && (
              myClassrooms.length > 0
                ? <button type="button" onClick={() => setImporting(kind)} className={`${primaryButton} min-h-[40px]`}><Download size={16} aria-hidden="true" />Importar ({count})</button>
                : <span className="self-center text-sm text-gray-700 dark:text-gray-300">Asigna una clase tuya a la escuela para importar.</span>
            )}
            {myScopes.length > 0 && (
              <button type="button" onClick={() => open(myScopes)} className={outlineButton}>
                <Lightbulb size={16} aria-hidden="true" />
                Proponer para tu área
              </button>
            )}
            {manage && (
              <button type="button" onClick={() => open([])} className={outlineButton}>
                <Plus size={16} aria-hidden="true" />
                {isBehaviors ? 'Nuevo comportamiento' : 'Nueva insignia'}
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-800 dark:border-gray-600 dark:text-gray-200">
            {manage
              ? (isBehaviors ? 'Crea comportamientos comunes para que todos los profesores los usen.' : 'Crea insignias comunes de la escuela.')
              : myScopes.length > 0
                ? (isBehaviors ? 'Propón comportamientos para tu área: los docentes del área los importan a sus clases.' : 'Propón insignias para tu área: los docentes del área las importan a sus clases.')
                : 'El responsable aún no ha creado ninguno.'}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.key || 'school'} className="space-y-1.5">
                {grouped && (
                  <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {group.label ?? 'Del colegio'}
                    {group.key !== '' && coordinates(group.areaId, group.level) && <span className={`${valueChip} bg-primary-100 text-primary-900 dark:bg-primary-500/20 dark:text-primary-100`}>Tu área</span>}
                  </h4>
                )}
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800" aria-label={group.label ?? 'Del colegio'}>
                  {group.items.map((item) => row(kind, item))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        {manage
          ? 'Lo que crees aquí queda disponible para todos los profesores: marcan lo que quieran y lo importan a sus clases.'
          : 'Marca los que quieras usar y pulsa Importar para copiarlos a tus clases.'}
        {myScopes.length > 0 && ` Lo que propongas para ${myScopes.length === 1 ? 'tu área' : 'tus áreas'} lo ven los docentes de ${myScopes.length === 1 ? myScopes[0].label : 'cada una'}.`}
      </p>
      {section('behaviors')}
      {section('badges')}

      <AnimatePresence>
        {editing?.kind === 'behavior' && <BehaviorForm key="bh" schoolId={schoolId} behavior={editing.item} scopes={editing.scopes} onClose={() => setEditing(null)} />}
        {editing?.kind === 'badge' && <BadgeForm key="bd" schoolId={schoolId} badge={editing.item} scopes={editing.scopes} onClose={() => setEditing(null)} />}
        {importing && (
          <ImportModal
            key="import"
            kind={importing}
            schoolId={schoolId}
            ids={[...picked[importing]]}
            myClassrooms={myClassrooms}
            onClose={() => setImporting(null)}
            onDone={() => { setPicked((p) => ({ ...p, [importing]: new Set() })); setImporting(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
