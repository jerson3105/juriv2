import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus, Plus, Shuffle, Sparkles } from 'lucide-react';
import type { Behavior } from '../../../lib/behaviorApi';
import { getDisplayName, shuffle, useToolKeys, type StudentData } from './helpers';
import { DarkBehaviorButtons, ToolCloseButton } from './ui';

interface GroupCreatorProps {
  students: StudentData[];
  presentIds: Set<string> | null;
  showCharacterName: boolean;
  classroomId: string;
  behaviors: Behavior[];
  isApplying: boolean;
  onApplyGroup: (behavior: Behavior, members: StudentData[], label: string) => Promise<boolean>;
  onClose: () => void;
}

type Mode = 'size' | 'count';
type Saved = { groups: string[][]; mode: Mode; value: number; onlyPresent: boolean };

const storageKey = (classroomId: string) => `juried:groups:${classroomId}`;

// Cabeceras con texto blanco ≥ 4,5:1 (tonos 700).
const GROUP_COLORS = ['bg-blue-700', 'bg-purple-700', 'bg-emerald-700', 'bg-amber-700', 'bg-red-700', 'bg-cyan-700', 'bg-pink-700', 'bg-lime-800', 'bg-orange-700', 'bg-teal-700'];

const readSaved = (classroomId: string): Saved | null => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
};

// Reparte en grupos equilibrados: los tamaños difieren como mucho en 1 (nunca un grupo suelto de 1-2).
const makeGroups = (ids: string[], groupCount: number): string[][] => {
  const count = Math.max(1, Math.min(groupCount, ids.length || 1));
  const groups: string[][] = Array.from({ length: count }, () => []);
  shuffle(ids).forEach((id, index) => groups[index % count].push(id));
  return groups;
};

export const GroupCreator = ({
  students,
  presentIds,
  showCharacterName,
  classroomId,
  behaviors,
  isApplying,
  onApplyGroup,
  onClose,
}: GroupCreatorProps) => {
  const saved = useMemo(() => readSaved(classroomId), [classroomId]);
  const [onlyPresent, setOnlyPresent] = useState(saved?.onlyPresent ?? presentIds !== null);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'size');
  const [value, setValue] = useState(saved?.value ?? 4);
  const [groups, setGroups] = useState<string[][]>([]);
  const [pointsFor, setPointsFor] = useState<number | null>(null);
  const [awarded, setAwarded] = useState<Record<number, string>>({});

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const pool = useMemo(
    () => (onlyPresent && presentIds ? students.filter((s) => presentIds.has(s.id)) : students),
    [students, onlyPresent, presentIds],
  );

  const groupCount = mode === 'count' ? value : Math.ceil(pool.length / Math.max(1, value));

  const persist = useCallback((next: string[][], nextMode: Mode, nextValue: number, nextOnlyPresent: boolean) => {
    try {
      localStorage.setItem(storageKey(classroomId), JSON.stringify({ groups: next, mode: nextMode, value: nextValue, onlyPresent: nextOnlyPresent }));
    } catch {
      // Sin almacenamiento: los grupos valen mientras la herramienta esté abierta.
    }
  }, [classroomId]);

  const generate = useCallback(() => {
    const next = makeGroups(pool.map((s) => s.id), groupCount);
    setGroups(next);
    setPointsFor(null);
    setAwarded({});
    persist(next, mode, value, onlyPresent);
  }, [pool, groupCount, persist, mode, value, onlyPresent]);

  // Al abrir: recuperar los grupos guardados si siguen siendo válidos; si no, crear nuevos.
  useEffect(() => {
    if (saved && saved.groups.length > 0 && saved.groups.flat().every((id) => byId.has(id))) {
      setGroups(saved.groups);
    } else {
      generate();
    }
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useToolKeys(onClose);

  const maxValue = mode === 'count' ? Math.max(1, pool.length) : Math.max(2, pool.length);
  const minValue = mode === 'count' ? 1 : 2;
  const sizes = groups.map((g) => g.length);
  const minSize = sizes.length ? Math.min(...sizes) : 0;
  const maxSize = sizes.length ? Math.max(...sizes) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Creador de grupos"
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-gradient-to-br from-gray-950 via-blue-950 to-cyan-950"
    >
      <ToolCloseButton onClose={onClose} />

      <div className="flex-shrink-0 px-6 pt-6 pb-4 text-center">
        <h2 className="text-white/80 text-sm font-semibold tracking-widest uppercase mb-3">Creador de grupos</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-xl border border-white/30 overflow-hidden" role="group" aria-label="Crear grupos por">
            {([['size', 'Por tamaño'], ['count', 'Por número']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setValue(key === 'count' ? Math.max(1, Math.ceil(pool.length / 4)) : 4);
                }}
                aria-pressed={mode === key}
                className={`min-h-[40px] px-3 text-sm font-semibold ${mode === key ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/10 px-1">
            <button type="button" onClick={() => setValue((v) => Math.max(minValue, v - 1))} aria-label="Menos" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white hover:bg-white/10">
              <Minus size={18} aria-hidden="true" />
            </button>
            <span className="min-w-[7.5rem] text-center text-white font-bold" aria-live="polite">
              {mode === 'size' ? `${value} por grupo` : `${value} grupos`}
            </span>
            <button type="button" onClick={() => setValue((v) => Math.min(maxValue, v + 1))} aria-label="Más" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white hover:bg-white/10">
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
          {presentIds && (
            <button
              type="button"
              onClick={() => setOnlyPresent((v) => !v)}
              aria-pressed={onlyPresent}
              className={`inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border text-sm font-semibold ${onlyPresent ? 'border-white bg-white text-gray-900' : 'border-white/40 text-white hover:bg-white/10'}`}
            >
              {onlyPresent && <Check size={16} aria-hidden="true" />}
              Solo presentes ({presentIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-white text-gray-900 font-bold hover:bg-white/90"
          >
            <Shuffle size={16} aria-hidden="true" />
            {groups.length ? 'Reorganizar' : 'Crear grupos'}
          </button>
        </div>
        <p className="mt-2 text-sm text-white/80">
          {groups.length} grupo{groups.length !== 1 ? 's' : ''}
          {groups.length > 0 && ` de ${minSize === maxSize ? minSize : `${minSize}–${maxSize}`}`} · {groups.flat().length} estudiantes
          {groups.length > 0 && groupCount !== groups.length && ' · pulsa Reorganizar para aplicar los cambios'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {groups.map((ids, gIdx) => {
            const members = ids.map((id) => byId.get(id)).filter((s): s is StudentData => Boolean(s));
            const label = `Grupo ${gIdx + 1}`;
            return (
              <section key={`${gIdx}-${ids.join(',')}`} aria-label={label} className="rounded-2xl overflow-hidden border border-white/15 bg-white/10">
                <div className={`${GROUP_COLORS[gIdx % GROUP_COLORS.length]} flex items-center justify-between gap-2 px-4 py-2.5`}>
                  <span className="text-white font-bold">
                    {label} <span className="font-medium text-white/90">({members.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPointsFor((current) => (current === gIdx ? null : gIdx))}
                    aria-expanded={pointsFor === gIdx}
                    className="inline-flex items-center gap-1 min-h-[32px] px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-semibold"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    Puntos
                  </button>
                </div>
                <ol className="p-3 space-y-1.5">
                  {members.map((student, sIdx) => (
                    <li key={student.id} className="flex items-center gap-2.5 text-white">
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-white/15 text-xs font-bold">{sIdx + 1}</span>
                      <span className="text-base truncate">{getDisplayName(student, showCharacterName)}</span>
                    </li>
                  ))}
                </ol>
                {awarded[gIdx] && <p className="px-3 pb-2 text-sm font-semibold text-emerald-200">✓ {awarded[gIdx]}</p>}
                {pointsFor === gIdx && behaviors.length > 0 && (
                  <div className="border-t border-white/15 p-3">
                    <DarkBehaviorButtons
                      behaviors={behaviors}
                      disabled={isApplying}
                      onApply={(behavior) => {
                        void onApplyGroup(behavior, members, label).then((ok) => {
                          if (ok) {
                            setAwarded((prev) => ({ ...prev, [gIdx]: `${behavior.name} a todo el grupo` }));
                            setPointsFor(null);
                          }
                        });
                      }}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
