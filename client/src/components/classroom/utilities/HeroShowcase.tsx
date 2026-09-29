import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Shuffle, SkipForward, Timer } from 'lucide-react';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../../lib/avatarApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { useCharacterClasses } from '../../../hooks/useCharacterClasses';
import { getDisplayName, shuffle, useToolKeys, type StudentData } from './helpers';
import { ToolCloseButton } from './ui';

const SPEED_OPTIONS = [
  { label: '4 s', value: 4000 },
  { label: '6 s', value: 6000 },
  { label: '8 s', value: 8000 },
];

interface HeroShowcaseProps {
  students: StudentData[];
  showCharacterName: boolean;
  classroomId: string;
  xpPerLevel: number;
  onClose: () => void;
}

// Progreso dentro del nivel con la misma fórmula que el resto de la app (niveles triangulares).
const levelProgress = (xp: number, level: number, xpPerLevel: number) => {
  const lvl = Math.max(1, level);
  const start = (xpPerLevel * lvl * (lvl - 1)) / 2;
  const next = (xpPerLevel * (lvl + 1) * lvl) / 2;
  const inLevel = Math.max(0, xp - start);
  const needed = next - start;
  return { inLevel: Math.round(inLevel), needed, percent: Math.min(100, (inLevel / needed) * 100) };
};

export const HeroShowcase = ({ students, showCharacterName, classroomId, xpPerLevel, onClose }: HeroShowcaseProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isRandom, setIsRandom] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { classMap } = useCharacterClasses(classroomId);

  const order = useMemo(() => {
    const indices = students.map((_, i) => i);
    return isRandom ? shuffle(indices) : indices;
  }, [students, isRandom]);

  useEffect(() => {
    if (isPaused || order.length === 0) return;
    timerRef.current = setTimeout(() => setCurrentIndex((prev) => (prev + 1) % order.length), SPEED_OPTIONS[speedIdx].value);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isPaused, speedIdx, order]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);
  useToolKeys(onClose, togglePause);

  const student = students[order[currentIndex] ?? 0];

  if (!student) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Desfile de héroes" className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-950">
        <p className="text-white text-xl">No hay estudiantes en la clase</p>
        <button type="button" onClick={onClose} className="mt-4 min-h-[48px] px-6 rounded-xl bg-white/20 text-white hover:bg-white/30">Cerrar</button>
      </motion.div>
    );
  }

  const classInfo = (student.characterClassId && classMap[student.characterClassId]) || classMap[student.characterClass];
  const progress = levelProgress(student.xp, student.level, xpPerLevel);
  const accent = classInfo?.color || '#ec4899';

  const controlClass = 'inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-white hover:bg-white/15';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Desfile de héroes"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950"
    >
      <ToolCloseButton onClose={onClose} />
      <p className="absolute top-6 left-1/2 -translate-x-1/2 text-sm font-semibold tracking-widest uppercase text-white/80">
        {currentIndex + 1} / {order.length}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={student.id}
          initial={{ opacity: 0, x: 80, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -80, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="flex flex-col md:flex-row items-center gap-6 md:gap-10 px-4 pb-24"
        >
          <div className="relative">
            <div
              className="w-44 h-72 sm:w-52 sm:h-[364px] rounded-3xl overflow-hidden border-4 flex items-end justify-center"
              style={{ borderColor: accent, boxShadow: `0 0 50px ${accent}30`, background: `linear-gradient(135deg, ${accent}15, transparent)` }}
            >
              <StudentAvatarMini studentProfileId={student.id} gender={student.avatarGender as AvatarGender} size="lg" />
            </div>
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-amber-400 flex flex-col items-center justify-center shadow-lg ring-4 ring-gray-950">
              <span className="text-xs font-semibold text-amber-950 leading-none">Nivel</span>
              <span className="text-xl font-black text-gray-950 leading-none">{student.level}</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start gap-4 min-w-[280px]">
            <div className="text-center md:text-left">
              <h2 className="text-4xl sm:text-5xl font-black text-white">{getDisplayName(student, showCharacterName)}</h2>
              {classInfo && (
                <p className="flex items-center gap-2 mt-2 justify-center md:justify-start text-xl font-semibold text-white">
                  <span aria-hidden="true">{classInfo.icon}</span>
                  {classInfo.name}
                </p>
              )}
            </div>

            <div className="w-full space-y-3 rounded-2xl border border-white/15 bg-white/10 p-5">
              <div>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="font-semibold text-indigo-200 uppercase tracking-wider">Experiencia</span>
                  <span className="text-white/85">{progress.inLevel} / {progress.needed} XP para el nivel {student.level + 1}</span>
                </div>
                <div className="h-3 bg-white/15 rounded-full overflow-hidden" aria-hidden="true">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress.percent}%` }} transition={{ delay: 0.4, duration: 0.8 }} className="h-full bg-indigo-400 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 p-3 text-center">
                  <p className="text-sm font-semibold uppercase tracking-wider text-red-200">❤️ Vida</p>
                  <p className="text-3xl font-black text-white">{student.hp}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 text-center">
                  <p className="text-sm font-semibold uppercase tracking-wider text-amber-200">🪙 Oro</p>
                  <p className="text-3xl font-black text-white">{student.gp}</p>
                </div>
              </div>
            </div>

            {student.clanName && (
              <div className="flex items-center gap-3 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <span className="text-2xl" aria-hidden="true">{CLAN_EMBLEMS[student.clanEmblem || 'shield'] || '🛡️'}</span>
                <div className="min-w-0">
                  <p className="font-bold text-white">{student.clanName}</p>
                  {student.clanMotto && <p className="text-sm text-white/85 italic truncate">"{student.clanMotto}"</p>}
                </div>
                {student.clanColor && <span className="ml-auto w-4 h-4 rounded-full ring-2 ring-white/40" style={{ backgroundColor: student.clanColor }} aria-hidden="true" />}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-1.5">
        <button type="button" onClick={togglePause} className={controlClass}>
          {isPaused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
        <button type="button" onClick={() => setCurrentIndex((p) => (p + 1) % order.length)} className={controlClass}>
          <SkipForward size={18} aria-hidden="true" />
          Siguiente
        </button>
        <button type="button" onClick={() => {
            setIsRandom((v) => !v);
            setCurrentIndex(0);
          }} aria-pressed={isRandom} className={`${controlClass} ${isRandom ? 'bg-white/20' : ''}`}>
          <Shuffle size={18} aria-hidden="true" />
          {isRandom ? 'Orden aleatorio' : 'Orden de lista'}
        </button>
        <button type="button" onClick={() => setSpeedIdx((p) => (p + 1) % SPEED_OPTIONS.length)} className={controlClass} aria-label={`Velocidad: ${SPEED_OPTIONS[speedIdx].label} por héroe`}>
          <Timer size={18} aria-hidden="true" />
          {SPEED_OPTIONS[speedIdx].label}
        </button>
      </div>
    </motion.div>
  );
};
