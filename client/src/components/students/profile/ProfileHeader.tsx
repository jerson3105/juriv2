import { useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Heart, KeyRound, Medal, Moon, Pencil, Sparkles, Trophy, UserMinus, Users } from 'lucide-react';
import { RestingPill } from '../../energy/EnergyMeter';
import { RecoveryMissionModal } from '../../energy/RecoveryMissionModal';
import { isInitialLevel } from '../../energy/energyHelpers';
import type { Classroom, Student } from '../../../lib/classroomApi';
import type { StudentSummary } from '../../../lib/studentApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { accentGradient, type StoryAccent } from '../../../lib/storyTheme';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import { ActionMenu } from '../../home/ActionMenu';
import { LOW_HP_RATIO, levelProgress, studentNames } from './profileHelpers';
import { hasStudentAccount, isPinStudent } from '../../../lib/studentAccess';

type CharacterClassOption = { id?: string; name: string; icon?: string | null; isActive?: boolean };

interface ProfileHeaderProps {
  classroom: Classroom & { showCharacterName?: boolean; xpPerLevel?: number | null };
  student: Student;
  summary?: StudentSummary;
  accent: StoryAccent | null;
  classIcon: string;
  characterClasses: CharacterClassOption[];
  position: number;
  total: number;
  previousName: string | null;
  nextName: string | null;
  assigning: boolean;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onAssignClass: (characterClassId: string | null) => void;
  onGivePoints: () => void;
  onGiveBadge: () => void;
  onEdit: () => void;
  onAccessCode: () => void;
  onFamilyCode: () => void;
  onRemove: () => void;
}

const navButton = 'flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

export const ProfileHeader = ({
  classroom, student, summary, accent, classIcon, characterClasses, position, total, previousName, nextName, assigning,
  onBack, onPrevious, onNext, onAssignClass, onGivePoints, onGiveBadge, onEdit, onAccessCode, onFamilyCode, onRemove,
}: ProfileHeaderProps) => {
  const names = studentNames(student, classroom.showCharacterName);
  const [showRecovery, setShowRecovery] = useState(false);
  const initial = isInitialLevel(classroom.gradeLevel);
  const maxHp = classroom.maxHp || 100;
  const hpRatio = Math.min(student.hp / maxHp, 1);
  const level = levelProgress(student.xp, student.level, classroom.xpPerLevel || 100);
  const hasAccount = hasStudentAccount(student);

  const menu = [
    { label: 'Editar nombres', icon: Pencil, onClick: onEdit },
    { label: isPinStudent(student) ? 'Acceso del alumno' : hasAccount ? 'Cuenta del alumno' : 'Código de acceso', icon: KeyRound, onClick: onAccessCode },
    { label: 'Código para la familia', icon: Users, onClick: onFamilyCode },
    { label: 'Retirar de la clase', icon: UserMinus, danger: true, onClick: onRemove },
  ];

  return (
    <div className="space-y-3">
      {/* Navegación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18} aria-hidden="true" /> Estudiantes
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevious} disabled={!previousName} className={navButton} aria-label={previousName ? `Alumno anterior: ${previousName}` : 'No hay alumno anterior'} title={previousName ?? undefined}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="min-w-[64px] text-center text-sm text-gray-700 dark:text-gray-300" aria-live="polite">{position} de {total}</span>
          <button type="button" onClick={onNext} disabled={!nextName} className={navButton} aria-label={nextName ? `Alumno siguiente: ${nextName}` : 'No hay alumno siguiente'} title={nextName ?? undefined}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Ficha */}
      <section aria-labelledby="student-name" className="overflow-clip rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="h-1.5" style={{ background: accent ? accentGradient(accent, 90) : 'linear-gradient(90deg, #4338ca, #6d28d9)' }} aria-hidden="true" />
        <div className="flex flex-col gap-5 p-4 sm:p-5 md:flex-row">
          <div className="mx-auto h-48 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-primary-50 to-white dark:border-gray-700 dark:from-gray-700 dark:to-gray-800 md:mx-0">
            <StudentAvatarMini studentProfileId={student.id} gender={student.avatarGender || 'MALE'} size="md" />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 id="student-name" className="truncate text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">{names.primary}</h1>
                {names.secondary && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{names.secondaryLabel}: <span className="font-semibold">{names.secondary}</span></p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Nivel {student.level}</span>
                  <label className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 pl-2.5 text-sm text-gray-800 dark:border-gray-600 dark:text-gray-100">
                    <span aria-hidden="true">{classIcon}</span>
                    <span className="sr-only">Clase de personaje</span>
                    <select
                      value={student.characterClassId || ''}
                      disabled={assigning}
                      onChange={(e) => onAssignClass(e.target.value || null)}
                      className="min-h-[36px] cursor-pointer rounded-full bg-transparent pr-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-gray-800"
                    >
                      <option value="">Sin clase</option>
                      {characterClasses.filter((c) => c.isActive !== false && c.id).map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </label>
                  {summary?.clan && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                      <span aria-hidden="true">{CLAN_EMBLEMS[summary.clan.emblem] || '🛡️'}</span> {summary.clan.name}
                    </span>
                  )}
                  {summary && summary.rank.total > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-sm font-semibold text-primary-800 dark:bg-primary-900/40 dark:text-primary-100">
                      <Trophy size={14} aria-hidden="true" /> #{summary.rank.position} de {summary.rank.total} en XP
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${hasAccount ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>
                    {hasAccount ? 'Con cuenta' : 'Sin cuenta'}
                  </span>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                <button type="button" onClick={onGivePoints} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
                  <Sparkles size={16} aria-hidden="true" /> Dar puntos
                </button>
                <button type="button" onClick={onGiveBadge} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                  <Medal size={16} aria-hidden="true" /> Dar insignia
                </button>
                <ActionMenu items={menu} label={`Más acciones para ${names.primary}`} variant="button" />
              </div>
            </div>

            {/* Medidores */}
            <div className="grid gap-3 sm:grid-cols-3">
              {student.hp <= 0 ? (
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <Heart size={16} aria-hidden="true" /> Energía
                    </span>
                    <RestingPill compact />
                  </div>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{initial ? 'Sin energía: recupéralo cuando esté listo.' : 'Sin energía: la tienda de premios está en pausa.'}</p>
                  <button type="button" onClick={() => setShowRecovery(true)}
                    className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-700 px-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white">
                    <Moon size={14} aria-hidden="true" /> {initial ? 'Recuperar energía' : 'Misión de recuperación'}
                  </button>
                </div>
              ) : (
                <Meter
                  icon={<Heart size={16} className="fill-current" aria-hidden="true" />}
                  label="Energía"
                  tone="text-red-700 dark:text-red-300"
                  value={`${student.hp}`}
                  suffix={`/ ${maxHp}`}
                  percent={hpRatio * 100}
                  bar={hpRatio < LOW_HP_RATIO ? 'bg-red-600' : hpRatio < 0.6 ? 'bg-amber-500' : 'bg-emerald-600'}
                />
              )}
              <Meter
                icon={<Sparkles size={16} aria-hidden="true" />}
                label="Experiencia"
                tone="text-primary-700 dark:text-primary-300"
                value={student.xp.toLocaleString('es')}
                suffix="XP"
                percent={level.percent}
                bar="bg-primary-600"
                hint={`${level.inLevel} de ${level.needed} para el nivel ${student.level + 1}`}
              />
              <Meter
                icon={<Coins size={16} aria-hidden="true" />}
                label="Oro"
                tone="text-amber-800 dark:text-amber-300"
                value={student.gp.toLocaleString('es')}
                suffix="GP"
              />
            </div>
          </div>
        </div>
      </section>
      {showRecovery && (
        <RecoveryMissionModal classroomId={classroom.id} studentId={student.id} studentName={names.primary} initial={initial} onClose={() => setShowRecovery(false)} />
      )}
    </div>
  );
};

const Meter = ({ icon, label, tone, value, suffix, percent, bar, hint }: {
  icon: ReactNode;
  label: string;
  tone: string;
  value: string;
  suffix: string;
  percent?: number;
  bar?: string;
  hint?: string;
}) => (
  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
    <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>{icon}{label}</p>
    <p className="mt-0.5 text-2xl font-black tabular-nums text-gray-900 dark:text-white">
      {value} <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{suffix}</span>
    </p>
    {percent !== undefined && (
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={label}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
    )}
    {hint && <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">{hint}</p>}
  </div>
);

