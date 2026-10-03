import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, Eye, Heart, Medal, RotateCcw } from 'lucide-react';
import { Hearts, RestingPill } from '../energy/EnergyMeter';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import { ConstellationSky } from '../observatorio/descanso/ConstellationSky';
import { classSkyFor, litStarsFor } from '../student/home/classSky';
import { Sparkle } from '../layout/sidebar/ClassSeal';
import { MenuCheck, Popover } from '../ui/Popover';
import { usePopover } from '../../hooks/usePopover';
import { useStarMarker } from '../../hooks/useStarMarker';
import { historyApi, type ActivityLogEntry } from '../../lib/historyApi';
import type { Behavior } from '../../lib/behaviorApi';
import type { Classroom, Student } from '../../lib/classroomApi';
import { clanVars } from '../../lib/storyTheme';
import { studentsPulseKey } from '../../lib/rankingApi';
import { levelProgress } from './profile/profileHelpers';
import { BehaviorMenu } from './BehaviorMenu';
import { ExceptionTags } from './studentsUi';
import { clanEmblem, rewardText, type Role } from './studentsHelpers';
import type { StudentRow } from './StudentsTable';

type CharacterClassOption = { id?: string; key?: string; name: string; icon?: string | null; isActive?: boolean };

export interface FocusPoints {
  positives: Behavior[];
  negatives: Behavior[];
  totalPositives: number;
  totalNegatives: number;
  applying: boolean;
  onApply: (behavior: Behavior, studentId: string) => void;
  onOpenAll: (studentId: string, positive: boolean) => void;
}

interface StudentFocusViewProps {
  classroom: Classroom & { xpPerLevel?: number | null; clansEnabled?: boolean | null };
  rows: StudentRow[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
  projecting: boolean;
  /** Animaciones completas (no al proyectar ni con movimiento reducido). */
  lively: boolean;
  initial: boolean;
  characterClasses: CharacterClassOption[];
  points: FocusPoints;
  onAwardBadge: (studentId: string) => void;
  onRecovery: (studentId: string) => void;
  onViewProfile: (studentId: string) => void;
  onAssignRole: (studentId: string, characterClassId: string | null) => void;
  emptyMessage: string;
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const entryAmounts = (entry: ActivityLogEntry) => {
  const sign = entry.details.action === 'REMOVE' ? '−' : '+';
  const { xpAmount, hpAmount, gpAmount, amount, pointType } = entry.details;
  const parts = [
    xpAmount ? `${sign}${xpAmount} XP` : null,
    hpAmount ? `${sign}${hpAmount} HP` : null,
    gpAmount ? `${sign}${gpAmount} oro` : null,
  ].filter(Boolean);
  if (parts.length === 0 && amount) parts.push(`${sign}${amount} ${pointType === 'MIXED' ? '' : pointType === 'GP' ? 'oro' : pointType || ''}`.trim());
  return { text: parts.join(' · '), positive: sign === '+' };
};

// Rol como texto con «Cambiar» o «Asignar» (un menú en lugar del select).
const RoleControl = ({ student, name, role, options, onAssign }: {
  student: Student;
  name: string;
  role: Role | null;
  options: CharacterClassOption[];
  onAssign: (characterClassId: string | null) => void;
}) => {
  const { open, anchorRef, close, toggle } = usePopover();
  const active = options.filter((option) => option.isActive !== false && option.id);
  const isCurrent = (option: CharacterClassOption) =>
    student.characterClassId ? student.characterClassId === option.id : !!option.key && option.key === student.characterClass;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-lg leading-none" aria-hidden="true">{role?.icon ?? '·'}</span>
      <span className="font-medium pg-fg">{role?.name ?? 'Sin rol'}</span>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${role ? 'Cambiar' : 'Asignar'} el rol de ${name}`}
        className="pg-btn pg-btn-ghost px-2 text-primary-800 dark:text-primary-200"
      >
        {role ? 'Cambiar' : 'Asignar'}
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} label={`Rol de ${name}`} align="start">
        <p className="pg-menu-label" id="focus-role-label">Rol de {name}</p>
        <div role="radiogroup" aria-labelledby="focus-role-label">
          {active.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={isCurrent(option)} onClick={() => { close(true); onAssign(option.id!); }} className="pg-menu-item">
              <span className="w-5 text-center" aria-hidden="true">{option.icon}</span>
              {option.name}
              <MenuCheck on={isCurrent(option)} />
            </button>
          ))}
          <div className="pg-menu-sep" />
          <button type="button" role="radio" aria-checked={!role} onClick={() => { close(true); onAssign(null); }} className="pg-menu-item pg-fg2">
            Sin rol
            <MenuCheck on={!role} />
          </button>
        </div>
      </Popover>
    </span>
  );
};

/**
 * Vista Ficha: a la izquierda los alumnos como una constelación (como el menú: guía, una estrella por alumno
 * —encendida si hoy recibió algo, solo para el profe— y el destello en quien se mira); a la derecha su ficha
 * en una sola capa, con el avatar como protagonista (se proyecta).
 */
export const StudentFocusView = ({
  classroom,
  rows,
  selectedStudentId,
  onSelectStudent,
  projecting,
  lively,
  initial,
  characterClasses,
  points,
  onAwardBadge,
  onRecovery,
  onViewProfile,
  onAssignRole,
  emptyMessage,
}: StudentFocusViewProps) => {
  const queryClient = useQueryClient();
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const current = (selectedStudentId && rows.find((row) => row.student.id === selectedStudentId)) || rows[0] || null;
  const student = current?.student ?? null;
  const maxHp = classroom.maxHp || 100;
  const xpPerLevel = classroom.xpPerLevel || 100;
  const { listRef, markerRef } = useStarMarker(current?.student.id ?? null, 'data-student-id', rows.map((row) => row.student.id).join(','), true);

  const { data: studentHistory } = useQuery({
    queryKey: ['history-today', classroom.id, 'student', student?.id],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, { studentId: student!.id, type: 'POINTS', limit: 20 }),
    enabled: !!student,
  });

  const todayStart = startOfToday();
  const todayEntries = (studentHistory?.logs || []).filter(
    (entry) => entry.type === 'POINTS'
      && !entry.isReverted
      && new Date(entry.timestamp).getTime() >= todayStart
      && (!projecting || entry.details.action !== 'REMOVE'),
  );

  const undoEntry = async (entry: ActivityLogEntry) => {
    setUndoingId(entry.id);
    try {
      await historyApi.revertEntry('POINTS', entry.id);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
      queryClient.invalidateQueries({ queryKey: studentsPulseKey(classroom.id) });
      toast.success(`Deshecho: ${entry.details.reason || 'puntos'}`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'No se pudo deshacer');
    } finally {
      setUndoingId(null);
    }
  };

  if (!current || !student) {
    return <p className="pg-surface px-4 py-10 text-center text-sm pg-fg2">{emptyMessage}</p>;
  }

  const name = current.name;
  const progress = levelProgress(student.xp, student.level, xpPerLevel);
  const remaining = Math.max(0, progress.needed - progress.inLevel);
  const sky = classSkyFor(classroom.id);
  const lit = litStarsFor(progress.percent);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-210px)] lg:min-h-[500px] lg:flex-row">
      {/* Alumnos: en el celular se ocultan al abrir una ficha */}
      <nav aria-label="Alumnos" className={`${selectedStudentId ? 'hidden lg:flex' : 'flex'} pg-surface max-h-[70vh] w-full flex-shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-72`}>
        <div className="sb-scroll flex-1 overflow-y-auto py-1">
          <div ref={listRef} className="sb-list">
            <span className="sb-guide" aria-hidden="true" />
            <span ref={markerRef} className="sb-marker" data-speed="fast" aria-hidden="true">
              <Sparkle className="h-full w-full" />
            </span>
            <ul>
              {rows.map((row) => {
                const active = row.student.id === student.id;
                return (
                  <li key={row.student.id}>
                    <button
                      type="button"
                      data-student-id={row.student.id}
                      onClick={() => onSelectStudent(row.student.id)}
                      aria-current={active ? 'true' : undefined}
                      className="pg-sky-row pg-row pg-focus flex min-h-[44px] w-full items-center gap-2 pr-3 text-left"
                    >
                      <span className="pg-star" data-lit={row.recognized === true} aria-hidden="true" />
                      <span className="w-6 flex-shrink-0 text-center text-lg leading-none" aria-hidden="true">{row.role?.icon ?? '·'}</span>
                      <span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-semibold' : 'font-medium'} pg-fg`}>{row.name}</span>
                      {row.recognized && <span className="sr-only">, reconocido hoy</span>}
                      <ExceptionTags energy={row.energy} hp={row.student.hp} attendance={row.attendance} compact />
                      <span className="flex-shrink-0 text-xs font-semibold tabular-nums pg-fg2">Nv {row.student.level}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>

      {/* Ficha del alumno, en una sola capa */}
      <section aria-label={`Ficha de ${name}`} className={`${selectedStudentId ? 'flex' : 'hidden lg:flex'} pg-surface min-w-0 flex-1 flex-col overflow-hidden`}>
        <button type="button" onClick={() => onSelectStudent(null)} className="pg-btn pg-btn-ghost m-3 mb-0 self-start lg:hidden">
          <ChevronLeft size={16} aria-hidden="true" />
          Alumnos
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 lg:flex-row lg:p-5">
          <div className="flex flex-shrink-0 justify-center">
            <div className="relative h-[280px] w-[160px] overflow-hidden rounded-2xl lg:h-[384px] lg:w-[220px] 2xl:h-[444px] 2xl:w-[255px]">
              <StudentAvatarMini
                studentProfileId={student.id}
                gender={student.avatarGender || 'MALE'}
                size="xl"
                className="absolute left-1/2 top-0 origin-top -translate-x-1/2 scale-[0.63] lg:scale-[0.865] 2xl:scale-100"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5 lg:overflow-y-auto lg:pr-1">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-bold pg-fg lg:text-3xl">{name}</h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-bold text-gray-900 dark:bg-gray-700 dark:text-gray-50">Nivel {student.level}</span>
              </div>
              {current.secondary && <p className="mt-0.5 text-sm pg-fg2">{current.secondary}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <RoleControl student={student} name={name} role={current.role} options={characterClasses} onAssign={(roleId) => onAssignRole(student.id, roleId)} />
                {classroom.clansEnabled && (student.clanName ? (
                  <span className="inline-flex items-center gap-1.5" style={clanVars(student.clanColor)}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-base pg-clan-tint" aria-hidden="true">{clanEmblem(student.clanEmblem)}</span>
                    <span className="font-medium pg-fg">{student.clanName}</span>
                  </span>
                ) : !projecting && <span className="pg-fg2">Sin clan (por asignar)</span>)}
              </div>
            </div>

            {/* Progreso: la constelación de la clase se enciende con el nivel, como en el Inicio del alumno */}
            <div className="flex items-center gap-4">
              <div className="obs-sky w-20 flex-shrink-0 rounded-xl px-1.5 py-1" aria-hidden="true">
                <ConstellationSky constellation={sky} lit={lit} still={!lively} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold pg-fg">Le faltan {remaining.toLocaleString('es')} XP para el nivel {student.level + 1}</p>
                <div
                  role="progressbar"
                  aria-label={`Progreso al nivel ${student.level + 1}`}
                  aria-valuemin={0}
                  aria-valuemax={progress.needed}
                  aria-valuenow={progress.inLevel}
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600"
                >
                  <motion.div initial={false} animate={{ width: `${progress.percent}%` }} className="h-full rounded-full bg-[var(--pg-accent)]" />
                </div>
                <p className="mt-1 text-xs pg-fg2">{student.xp.toLocaleString('es')} XP · {student.gp.toLocaleString('es')} de oro</p>
              </div>
            </div>

            {/* Energía: solo por excepción y nunca al proyectar */}
            {!projecting && current.energy && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {current.energy === 'resting' ? (
                  <>
                    <RestingPill compact />
                    <button type="button" onClick={() => onRecovery(student.id)} className="pg-btn pg-btn-ghost px-2 text-primary-800 dark:text-primary-200">
                      {initial ? 'Recuperar energía' : 'Misión de recuperación'}
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold pg-alert">
                    <Heart size={14} className="fill-current" aria-hidden="true" />
                    Energía baja:
                    {initial ? <Hearts hp={student.hp} maxHp={maxHp} /> : <span>{student.hp} de {maxHp}</span>}
                  </span>
                )}
              </p>
            )}

            {/* Dar: los más usados de la clase; corregir, plegado */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold pg-fg">Dar a {name}</h3>
                <button type="button" onClick={() => points.onOpenAll(student.id, true)} className="pg-btn pg-btn-ghost px-2 text-primary-800 dark:text-primary-200">
                  {points.totalPositives > points.positives.length ? `Ver todos (${points.totalPositives})` : 'Más opciones'}
                </button>
              </div>
              {points.positives.length === 0 ? (
                <p className="text-sm pg-fg2">La clase aún no tiene comportamientos positivos.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {points.positives.map((behavior) => (
                    // Los nombres suelen ser largos: el nombre usa todo el ancho y el monto va debajo.
                    <button
                      key={behavior.id}
                      type="button"
                      onClick={() => points.onApply(behavior, student.id)}
                      disabled={points.applying}
                      title={`${behavior.name} · ${rewardText(behavior)}`}
                      className="pg-btn min-h-[56px] items-start justify-start gap-2 whitespace-normal py-2 text-left font-medium"
                    >
                      <span className="flex-shrink-0 text-lg leading-6" aria-hidden="true">{behavior.icon || '⭐'}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-3 break-words leading-snug">{behavior.name}</span>
                        <span className="mt-0.5 text-xs font-bold pg-pos-ink">{rewardText(behavior)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {points.negatives.length > 0 && (
                  <BehaviorMenu
                    mode="fix"
                    target={name}
                    positives={[]}
                    negatives={points.negatives}
                    totalPositives={0}
                    totalNegatives={points.totalNegatives}
                    disabled={points.applying}
                    onApply={(behavior) => points.onApply(behavior, student.id)}
                    onOpenAll={(positive) => points.onOpenAll(student.id, positive)}
                    align="start"
                  />
                )}
                <button type="button" onClick={() => onAwardBadge(student.id)} className="pg-btn pg-btn-ghost">
                  <Medal size={16} aria-hidden="true" /> Insignia
                </button>
                <button type="button" onClick={() => onViewProfile(student.id)} className="pg-btn pg-btn-ghost">
                  <Eye size={16} aria-hidden="true" /> Ver perfil
                </button>
              </div>
            </div>

            {/* Lo de hoy, con deshacer (al proyectar, solo lo positivo) */}
            <div className="border-t pt-3 pg-line">
              <h3 className="mb-1 text-sm font-semibold pg-fg">Hoy con {name}</h3>
              {todayEntries.length === 0 ? (
                <p className="text-sm pg-fg2">Aún nada hoy.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {todayEntries.slice(0, 5).map((entry) => {
                    const amounts = entryAmounts(entry);
                    return (
                      <li key={entry.id} className="flex items-center gap-2 py-1 text-sm">
                        <span className="w-11 text-xs tabular-nums pg-fg2">
                          {new Date(entry.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="min-w-0 flex-1 truncate pg-fg">{entry.details.reason || 'Puntos'}</span>
                        <span className={`font-semibold ${amounts.positive ? 'pg-pos-ink' : 'pg-fix'}`}>{amounts.text}</span>
                        <button
                          type="button"
                          onClick={() => undoEntry(entry)}
                          disabled={undoingId !== null}
                          aria-label={`Deshacer ${entry.details.reason || 'puntos'}`}
                          title="Deshacer"
                          className="pg-icon-btn"
                        >
                          <RotateCcw size={14} className={undoingId === entry.id ? 'animate-spin' : ''} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
