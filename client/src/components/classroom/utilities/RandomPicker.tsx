import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, HelpCircle, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../../lib/avatarApi';
import type { Behavior } from '../../../lib/behaviorApi';
import type { Question } from '../../../lib/questionBankApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { getDisplayName, useToolKeys, type StudentData } from './helpers';
import { DarkBehaviorButtons, ToolCloseButton } from './ui';
import { BankSelect, QuestionCard } from './QuestionCard';
import { readBank, saveBank, useBankQuestionDraw, useTeacherBanks } from './questionDraw';

interface RandomPickerProps {
  students: StudentData[];
  presentIds: Set<string> | null; // null = aún no se pasó lista hoy
  showCharacterName: boolean;
  classroomId: string;
  behaviors: Behavior[];
  isApplying: boolean;
  onApply: (behavior: Behavior, student: StudentData) => Promise<boolean>;
  onApplyGroup: (behavior: Behavior, members: StudentData[], label: string) => Promise<boolean>;
  onClose: () => void;
}

type Mode = 'student' | 'clan';
interface ClanOption {
  id: string;
  name: string;
  color: string;
  emblem: string;
  motto: string | null;
  members: StudentData[];
}

const drawnKey = (classroomId: string, mode: Mode) =>
  mode === 'student' ? `juried:random-drawn:${classroomId}` : `juried:random-drawn-clans:${classroomId}`;

const readDrawn = (classroomId: string, mode: Mode): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(drawnKey(classroomId, mode)) || '[]');
  } catch {
    return [];
  }
};

const writeDrawn = (classroomId: string, mode: Mode, ids: string[]) => {
  try {
    sessionStorage.setItem(drawnKey(classroomId, mode), JSON.stringify(ids));
  } catch {
    // Sin almacenamiento: la vuelta vale solo mientras la herramienta esté abierta.
  }
};

const optionClass = (on: boolean) =>
  `inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border text-sm font-semibold ${on ? 'border-white bg-white text-gray-900' : 'border-white/40 text-white hover:bg-white/10'}`;

// Elección aleatoria de alumno o de clan. "Sin repetir": nadie sale dos veces hasta que hayan salido
// todos (la vuelta se guarda por clase durante la sesión del navegador y se reinicia sola).
// Opcional: una pregunta del banco (de cualquier clase del profesor) para quien sale.
export const RandomPicker = ({
  students,
  presentIds,
  showCharacterName,
  classroomId,
  behaviors,
  isApplying,
  onApply,
  onApplyGroup,
  onClose,
}: RandomPickerProps) => {
  const [mode, setMode] = useState<Mode>('student');
  const [onlyPresent, setOnlyPresent] = useState(presentIds !== null);
  const [noRepeat, setNoRepeat] = useState(true);
  const [drawn, setDrawn] = useState<string[]>(() => readDrawn(classroomId, 'student'));
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [awarded, setAwarded] = useState<string | null>(null);
  const [roundRestarted, setRoundRestarted] = useState(false);
  const [withQuestion, setWithQuestion] = useState(() => !!readBank(classroomId));
  const [bankId, setBankId] = useState<string | null>(() => readBank(classroomId));
  const [question, setQuestion] = useState<Question | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: banks = [] } = useTeacherBanks(withQuestion);
  const questions = useBankQuestionDraw(withQuestion ? bankId : null);

  const studentPool = useMemo(
    () => (onlyPresent && presentIds ? students.filter((s) => presentIds.has(s.id)) : students),
    [students, onlyPresent, presentIds],
  );

  // Clanes con al menos un integrante (presente, si se filtra).
  const clanPool = useMemo<ClanOption[]>(() => {
    const byClan = new Map<string, ClanOption>();
    for (const s of studentPool) {
      if (!s.teamId || !s.clanName) continue;
      const clan = byClan.get(s.teamId) ?? {
        id: s.teamId, name: s.clanName, color: s.clanColor || '#6366f1',
        emblem: CLAN_EMBLEMS[s.clanEmblem || 'shield'] || '🛡️', motto: s.clanMotto ?? null, members: [],
      };
      clan.members.push(s);
      byClan.set(s.teamId, clan);
    }
    return [...byClan.values()];
  }, [studentPool]);
  const hasClans = useMemo(() => students.some((s) => s.teamId && s.clanName), [students]);

  const items: { id: string }[] = mode === 'student' ? studentPool : clanPool;
  const remaining = items.filter((s) => !drawn.includes(s.id));

  const updateDrawn = useCallback((ids: string[], forMode: Mode = mode) => {
    setDrawn(ids);
    writeDrawn(classroomId, forMode, ids);
  }, [classroomId, mode]);

  // Sorteo sobre una lista dada (al cambiar de modo, la del modo nuevo).
  const spinOver = useCallback((pool: { id: string }[], poolDrawn: string[], forMode: Mode) => {
    if (pool.length === 0 || isSpinning) return;
    let candidates = noRepeat ? pool.filter((s) => !poolDrawn.includes(s.id)) : pool;
    let baseDrawn = poolDrawn;
    let restarted = false;
    if (candidates.length === 0) {
      // Salieron todos: empieza una vuelta nueva.
      candidates = pool;
      baseDrawn = [];
      restarted = true;
    }
    const winner = candidates[Math.floor(Math.random() * candidates.length)];

    setIsSpinning(true);
    setSelectedId(null);
    setAwarded(null);
    setQuestion(null);
    setRoundRestarted(restarted);

    let speed = 50;
    let elapsed = 0;
    const totalDuration = 2200;
    const tick = () => {
      setCurrentIndex((prev) => (prev + 1) % pool.length);
      elapsed += speed;
      if (elapsed >= totalDuration) {
        setCurrentIndex(Math.max(0, pool.findIndex((s) => s.id === winner.id)));
        setSelectedId(winner.id);
        setIsSpinning(false);
        if (noRepeat) updateDrawn([...baseDrawn.filter((id) => id !== winner.id), winner.id], forMode);
        if (withQuestion && bankId) setQuestion(questions.draw());
        return;
      }
      speed = 50 + (elapsed / totalDuration) * 250;
      timeoutRef.current = setTimeout(tick, speed);
    };
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(tick, speed);
  }, [isSpinning, noRepeat, updateDrawn, withQuestion, bankId, questions]);

  const spin = useCallback(() => spinOver(items, drawn, mode), [spinOver, items, drawn, mode]);

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

  const changeMode = (next: Mode) => {
    if (next === mode || isSpinning) return;
    const nextDrawn = readDrawn(classroomId, next);
    setMode(next);
    setDrawn(nextDrawn);
    setCurrentIndex(0);
    spinOver(next === 'student' ? studentPool : clanPool, nextDrawn, next);
  };

  const chooseBank = (id: string | null) => {
    setBankId(id);
    saveBank(classroomId, id);
    setQuestion(null);
  };

  const selectedStudent = mode === 'student' ? studentPool.find((s) => s.id === selectedId) ?? null : null;
  const selectedClan = mode === 'clan' ? clanPool.find((c) => c.id === selectedId) ?? null : null;
  const displayStudent = selectedStudent || (mode === 'student' ? studentPool[currentIndex % Math.max(1, studentPool.length)] : null);
  const displayClan = selectedClan || (mode === 'clan' ? clanPool[currentIndex % Math.max(1, clanPool.length)] : null);
  const hasWinner = !isSpinning && (selectedStudent || selectedClan);
  const winnerLabel = selectedStudent ? getDisplayName(selectedStudent, showCharacterName) : selectedClan?.name ?? '';

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

        {/* Qué se elige */}
        {hasClans && (
          <div role="radiogroup" aria-label="Qué elegir" className="flex gap-2">
            {([['student', 'Alumno'], ['clan', 'Clan']] as const).map(([value, text]) => (
              <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => changeMode(value)} className={optionClass(mode === value)}>
                {text}
              </button>
            ))}
          </div>
        )}

        {/* Opciones */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => setNoRepeat((v) => !v)} aria-pressed={noRepeat} className={optionClass(noRepeat)}>
            {noRepeat && <Check size={16} aria-hidden="true" />}
            Sin repetir
          </button>
          {presentIds && (
            <button type="button" onClick={() => setOnlyPresent((v) => !v)} aria-pressed={onlyPresent} className={optionClass(onlyPresent)}>
              {onlyPresent && <Check size={16} aria-hidden="true" />}
              Solo presentes ({presentIds.size})
            </button>
          )}
          <button type="button" onClick={() => setWithQuestion((v) => !v)} aria-pressed={withQuestion} className={optionClass(withQuestion)}>
            {withQuestion ? <Check size={16} aria-hidden="true" /> : <HelpCircle size={16} aria-hidden="true" />}
            Con pregunta
          </button>
          {withQuestion && <BankSelect banks={banks} value={bankId} onChange={chooseBank} />}
          {noRepeat && (
            <span className="text-sm text-white/80">
              {remaining.length} de {items.length} sin salir
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

        {items.length === 0 ? (
          <p className="text-white text-xl py-16">
            {mode === 'clan'
              ? 'No hay clanes con integrantes presentes.'
              : onlyPresent ? 'No hay estudiantes presentes hoy.' : 'No hay estudiantes en la clase.'}
          </p>
        ) : mode === 'clan' && displayClan ? (
          <motion.div
            key={isSpinning ? 'spin' : `final-${selectedClan?.id}`}
            initial={!isSpinning ? { scale: 0.85, opacity: 0 } : false}
            animate={!isSpinning ? { scale: 1, opacity: 1 } : undefined}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="w-full max-w-md rounded-3xl border-4 p-6 text-center"
            style={{ borderColor: isSpinning ? 'rgba(255,255,255,0.4)' : displayClan.color, backgroundColor: `${displayClan.color}26` }}
          >
            <div className="text-7xl" aria-hidden="true">{displayClan.emblem}</div>
            <p className="mt-2 text-4xl font-bold text-white" aria-live="polite">{displayClan.name}</p>
            {!isSpinning && selectedClan && (
              <>
                {selectedClan.motto && <p className="mt-1 text-base italic text-white/85">"{selectedClan.motto}"</p>}
                <p className="mt-2 text-base font-semibold text-yellow-300">
                  ¡Elegido!{roundRestarted ? ' · Nueva vuelta: ya habían salido todos' : ''}
                </p>
                <p className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-white/90">
                  <Users size={16} aria-hidden="true" className="mt-0.5" />
                  {selectedClan.members.map((m) => getDisplayName(m, showCharacterName)).join(' · ')}
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <motion.div
              key={isSpinning ? 'spin' : `final-${selectedStudent?.id}`}
              initial={!isSpinning ? { scale: 0.85, opacity: 0 } : false}
              animate={!isSpinning ? { scale: 1, opacity: 1 } : undefined}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="flex flex-col items-center"
            >
              <div className={`w-36 h-56 sm:w-44 sm:h-72 rounded-3xl overflow-hidden bg-white/10 border-4 flex items-end justify-center ${
                isSpinning ? 'border-white/40' : 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.4)]'
              }`}>
                {displayStudent && (
                  <StudentAvatarMini studentProfileId={displayStudent.id} gender={displayStudent.avatarGender as AvatarGender} size="md" />
                )}
              </div>
              <p className={`mt-5 text-3xl sm:text-4xl font-bold text-center ${isSpinning ? 'text-white/80' : 'text-white'}`} aria-live="polite">
                {displayStudent ? getDisplayName(displayStudent, showCharacterName) : ''}
              </p>
              {!isSpinning && selectedStudent && (
                <p className="mt-1 text-base font-semibold text-yellow-300">
                  ¡Elegido!{roundRestarted ? ' · Nueva vuelta: ya habían salido todos' : ''}
                </p>
              )}
            </motion.div>

            {!isSpinning && selectedStudent?.teamId && selectedStudent.clanName && (
              <div
                className="w-48 rounded-2xl border-2 p-5 text-center"
                style={{ borderColor: selectedStudent.clanColor || '#6366f1', backgroundColor: `${selectedStudent.clanColor || '#6366f1'}26` }}
              >
                <div className="text-5xl mb-2" aria-hidden="true">{CLAN_EMBLEMS[selectedStudent.clanEmblem || 'shield'] || '🛡️'}</div>
                <p className="text-lg font-bold text-white">{selectedStudent.clanName}</p>
                {selectedStudent.clanMotto && <p className="text-sm text-white/85 italic">"{selectedStudent.clanMotto}"</p>}
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white">
                  <Users size={14} aria-hidden="true" /> Clan
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pregunta del banco para quien salió */}
        {hasWinner && withQuestion && bankId && (
          question
            ? <QuestionCard key={question.id} question={question} onAnother={() => setQuestion(questions.draw())} />
            : !questions.isLoading && (
              <button type="button" onClick={() => setQuestion(questions.draw())} disabled={questions.count === 0}
                className="min-h-[44px] rounded-xl bg-white/15 px-4 font-semibold text-white hover:bg-white/25 disabled:opacity-50">
                {questions.count === 0 ? 'Este banco no tiene preguntas para proyectar' : 'Sacar una pregunta'}
              </button>
            )
        )}

        {/* Dar puntos al elegido (o a los presentes del clan) sin salir de aquí */}
        {hasWinner && behaviors.length > 0 && (
          <div className="w-full max-w-3xl">
            <p className="mb-2 text-center text-sm font-semibold text-white/85">
              {awarded ? `✓ ${awarded}` : `Dar puntos a ${winnerLabel}${selectedClan ? ` (${selectedClan.members.length})` : ''}`}
            </p>
            <DarkBehaviorButtons
              behaviors={withQuestion ? behaviors.filter((b) => b.isPositive) : behaviors}
              disabled={isApplying}
              onApply={(behavior) => {
                const done = selectedClan
                  ? onApplyGroup(behavior, selectedClan.members, selectedClan.name)
                  : onApply(behavior, selectedStudent!);
                void done.then((ok) => {
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
            disabled={isSpinning || items.length === 0}
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
