import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../../lib/avatarApi';
import type { Behavior } from '../../../lib/behaviorApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { getDisplayName, useToolKeys, type StudentData } from './helpers';
import { DarkBehaviorButtons, ToolCloseButton } from './ui';

interface RandomPickerProps {
  students: StudentData[];
  presentIds: Set<string> | null; // null = aún no se pasó lista hoy
  showCharacterName: boolean;
  classroomId: string;
  behaviors: Behavior[];
  isApplying: boolean;
  onApply: (behavior: Behavior, student: StudentData) => Promise<boolean>;
  onClose: () => void;
}

const drawnKey = (classroomId: string) => `juried:random-drawn:${classroomId}`;

const readDrawn = (classroomId: string): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(drawnKey(classroomId)) || '[]');
  } catch {
    return [];
  }
};

const writeDrawn = (classroomId: string, ids: string[]) => {
  try {
    sessionStorage.setItem(drawnKey(classroomId), JSON.stringify(ids));
  } catch {
    // Sin almacenamiento: la vuelta vale solo mientras la herramienta esté abierta.
  }
};

// Elección aleatoria. "Sin repetir": nadie sale dos veces hasta que hayan salido todos (la vuelta se
// guarda por clase durante la sesión del navegador y se reinicia sola al completarse).
export const RandomPicker = ({
  students,
  presentIds,
  showCharacterName,
  classroomId,
  behaviors,
  isApplying,
  onApply,
  onClose,
}: RandomPickerProps) => {
  const [onlyPresent, setOnlyPresent] = useState(presentIds !== null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [drawn, setDrawn] = useState<string[]>(() => readDrawn(classroomId));
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<StudentData | null>(null);
  const [awarded, setAwarded] = useState<string | null>(null);
  const [roundRestarted, setRoundRestarted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pool = useMemo(
    () => (onlyPresent && presentIds ? students.filter((s) => presentIds.has(s.id)) : students),
    [students, onlyPresent, presentIds],
  );
  const remaining = pool.filter((s) => !drawn.includes(s.id));

  const updateDrawn = useCallback((ids: string[]) => {
    setDrawn(ids);
    writeDrawn(classroomId, ids);
  }, [classroomId]);

  const spin = useCallback(() => {
    if (pool.length === 0 || isSpinning) return;
    let candidates = noRepeat ? pool.filter((s) => !drawn.includes(s.id)) : pool;
    let baseDrawn = drawn;
    let restarted = false;
    if (candidates.length === 0) {
      // Salieron todos: empieza una vuelta nueva.
      candidates = pool;
      baseDrawn = [];
      restarted = true;
    }
    const winner = candidates[Math.floor(Math.random() * candidates.length)];

    setIsSpinning(true);
    setSelected(null);
    setAwarded(null);
    setRoundRestarted(restarted);

    let speed = 50;
    let elapsed = 0;
    const totalDuration = 2200;
    const tick = () => {
      setCurrentIndex((prev) => (prev + 1) % pool.length);
      elapsed += speed;
      if (elapsed >= totalDuration) {
        setCurrentIndex(Math.max(0, pool.findIndex((s) => s.id === winner.id)));
        setSelected(winner);
        setIsSpinning(false);
        if (noRepeat) updateDrawn([...baseDrawn.filter((id) => id !== winner.id), winner.id]);
        return;
      }
      speed = 50 + (elapsed / totalDuration) * 250;
      timeoutRef.current = setTimeout(tick, speed);
    };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(tick, speed);
  }, [pool, isSpinning, noRepeat, drawn, updateDrawn]);

  // Arranca sola al abrir (programado: el giro cambia estado).
  useEffect(() => {
    const start = setTimeout(spin, 0);
    return () => clearTimeout(start);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useToolKeys(onClose, spin);

  const display = selected || pool[currentIndex % Math.max(1, pool.length)];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Elección aleatoria"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-gradient-to-br from-gray-950 via-purple-950 to-indigo-950"
    >
      <ToolCloseButton onClose={onClose} />
      <div className="min-h-full flex flex-col items-center justify-center gap-5 px-4 py-16">
        <h2 className="text-white/80 text-sm font-semibold tracking-widest uppercase">Elección aleatoria</h2>

        {/* Opciones */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setNoRepeat((v) => !v)}
            aria-pressed={noRepeat}
            className={`inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border text-sm font-semibold ${noRepeat ? 'border-white bg-white text-gray-900' : 'border-white/40 text-white hover:bg-white/10'}`}
          >
            {noRepeat && <Check size={16} aria-hidden="true" />}
            Sin repetir
          </button>
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
          {noRepeat && (
            <span className="text-sm text-white/80">
              {remaining.length} de {pool.length} sin salir
            </span>
          )}
          {noRepeat && drawn.length > 0 && (
            <button
              type="button"
              onClick={() => updateDrawn([])}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-sm font-medium text-white/90 hover:bg-white/10"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reiniciar vuelta
            </button>
          )}
        </div>

        {pool.length === 0 ? (
          <p className="text-white text-xl py-16">
            {onlyPresent ? 'No hay estudiantes presentes hoy.' : 'No hay estudiantes en la clase.'}
          </p>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <motion.div
              key={isSpinning ? 'spin' : `final-${selected?.id}`}
              initial={!isSpinning ? { scale: 0.85, opacity: 0 } : false}
              animate={!isSpinning ? { scale: 1, opacity: 1 } : undefined}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="flex flex-col items-center"
            >
              <div className={`w-36 h-56 sm:w-44 sm:h-72 rounded-3xl overflow-hidden bg-white/10 border-4 flex items-end justify-center ${
                isSpinning ? 'border-white/40' : 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.4)]'
              }`}>
                {display && (
                  <StudentAvatarMini studentProfileId={display.id} gender={display.avatarGender as AvatarGender} size="md" />
                )}
              </div>
              <p className={`mt-5 text-3xl sm:text-4xl font-bold text-center ${isSpinning ? 'text-white/80' : 'text-white'}`} aria-live="polite">
                {display ? getDisplayName(display, showCharacterName) : ''}
              </p>
              {!isSpinning && selected && (
                <p className="mt-1 text-base font-semibold text-yellow-300">
                  ¡Elegido!{roundRestarted ? ' · Nueva vuelta: ya habían salido todos' : ''}
                </p>
              )}
            </motion.div>

            {!isSpinning && selected?.teamId && selected.clanName && (
              <div
                className="w-48 rounded-2xl border-2 p-5 text-center"
                style={{ borderColor: selected.clanColor || '#6366f1', backgroundColor: `${selected.clanColor || '#6366f1'}26` }}
              >
                <div className="text-5xl mb-2" aria-hidden="true">{CLAN_EMBLEMS[selected.clanEmblem || 'shield'] || '🛡️'}</div>
                <p className="text-lg font-bold text-white">{selected.clanName}</p>
                {selected.clanMotto && <p className="text-sm text-white/85 italic">"{selected.clanMotto}"</p>}
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white">
                  <Users size={14} aria-hidden="true" /> Clan
                </p>
              </div>
            )}
          </div>
        )}

        {/* Dar puntos al elegido sin salir de aquí */}
        {!isSpinning && selected && behaviors.length > 0 && (
          <div className="w-full max-w-3xl">
            <p className="mb-2 text-center text-sm font-semibold text-white/85">
              {awarded ? `✓ ${awarded}` : `Dar puntos a ${getDisplayName(selected, showCharacterName)}`}
            </p>
            <DarkBehaviorButtons
              behaviors={behaviors}
              disabled={isApplying}
              onApply={(behavior) => {
                void onApply(behavior, selected).then((ok) => {
                  if (ok) setAwarded(`${behavior.name} aplicado`);
                });
              }}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={spin}
            disabled={isSpinning || pool.length === 0}
            className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-white text-gray-900 font-bold hover:bg-white/90 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSpinning ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />
            Volver a elegir <span className="text-sm font-medium text-gray-600">(Espacio)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-6 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </motion.div>
  );
};
