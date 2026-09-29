import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, Coins, Copy, Crown, Eye, Heart, LayoutList, Medal, RotateCcw, Search, Sparkles } from 'lucide-react';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import { historyApi, type ActivityLogEntry } from '../../lib/historyApi';
import type { Behavior } from '../../lib/behaviorApi';
import type { Classroom, Student } from '../../lib/classroomApi';
import { getBehaviorRewards } from '../../lib/behaviorPoints';

type CharacterClassOption = { id?: string; key?: string; name: string; icon?: string | null; isActive?: boolean };
type ClassInfo = { name: string; icon: string };

interface StudentFocusViewProps {
  classroom: Classroom & { xpPerLevel?: number | null; clansEnabled?: boolean | null };
  students: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  characterClasses: CharacterClassOption[];
  classMap: Record<string, ClassInfo>;
  topStudentId: string | null;
  getDisplayName: (student: Student) => string;
  getStudentLinkCode: (studentId: string) => string | null;
  onCopyLinkCode: (code: string) => void;
  featuredBehaviors: Behavior[];
  totalBehaviors: number;
  isApplying: boolean;
  onApplyBehavior: (behavior: Behavior, studentId: string) => void;
  onOpenAllBehaviors: (studentId: string) => void;
  onAwardBadge: (studentId: string) => void;
  onViewProfile: (studentId: string) => void;
  onAssignClass: (studentId: string, characterClassId: string | null) => void;
  storyTheme?: { colors?: { primary?: string } } | null;
  isThemeDark?: boolean;
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
    gpAmount ? `${sign}${gpAmount} GP` : null,
  ].filter(Boolean);
  if (parts.length === 0 && amount) parts.push(`${sign}${amount} ${pointType === 'MIXED' ? '' : pointType || ''}`.trim());
  return { text: parts.join(' · '), positive: sign === '+' };
};

// Vista "Foco en el alumno": lista compacta a la izquierda y la ficha del alumno elegido con su
// avatar como protagonista (se proyecta), sus comportamientos más usados a un toque y lo que se le
// dio hoy, con deshacer por línea.
export const StudentFocusView = ({
  classroom,
  students,
  selectedStudentId,
  onSelectStudent,
  searchQuery,
  onSearchChange,
  characterClasses,
  classMap,
  topStudentId,
  getDisplayName,
  getStudentLinkCode,
  onCopyLinkCode,
  featuredBehaviors,
  totalBehaviors,
  isApplying,
  onApplyBehavior,
  onOpenAllBehaviors,
  onAwardBadge,
  onViewProfile,
  onAssignClass,
  storyTheme,
  isThemeDark,
}: StudentFocusViewProps) => {
  const queryClient = useQueryClient();
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const student = (selectedStudentId && students.find((s) => s.id === selectedStudentId)) || students[0] || null;
  const maxHp = classroom.maxHp || 100;
  const xpPerLevel = classroom.xpPerLevel || 100;

  const { data: studentHistory } = useQuery({
    queryKey: ['history-today', classroom.id, 'student', student?.id],
    queryFn: () => historyApi.getClassroomHistory(classroom.id, { studentId: student!.id, type: 'POINTS', limit: 20 }),
    enabled: !!student,
  });

  const todayStart = startOfToday();
  const todayEntries = (studentHistory?.logs || []).filter(
    (entry) => entry.type === 'POINTS' && !entry.isReverted && new Date(entry.timestamp).getTime() >= todayStart,
  );

  const classInfoOf = (s: Student): ClassInfo | undefined =>
    (s.characterClassId && classMap[s.characterClassId]) || classMap[s.characterClass];

  const levelProgress = (s: Student) => {
    const lvl = s.level || 1;
    const xpForCurrent = (xpPerLevel * lvl * (lvl - 1)) / 2;
    const xpForNext = (xpPerLevel * (lvl + 1) * lvl) / 2;
    const inLevel = Math.max(0, s.xp - xpForCurrent);
    const needed = xpForNext - xpForCurrent;
    return { inLevel: Math.round(inLevel), needed, percent: Math.min((inLevel / needed) * 100, 100) };
  };

  const undoEntry = async (entry: ActivityLogEntry) => {
    setUndoingId(entry.id);
    try {
      await historyApi.revertEntry('POINTS', entry.id);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history-today', classroom.id] });
      toast.success(`Deshecho: ${entry.details.reason || 'puntos'}`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'No se pudo deshacer');
    } finally {
      setUndoingId(null);
    }
  };

  const positives = featuredBehaviors.filter((b) => b.isPositive);
  const negatives = featuredBehaviors.filter((b) => !b.isPositive);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
      {/* Lista compacta (en móvil se oculta al abrir una ficha) */}
      <aside className={`${selectedStudentId ? 'hidden lg:flex' : 'flex'} w-full lg:w-64 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 max-h-[70vh] lg:max-h-none`}>
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar alumno"
              aria-label="Buscar alumno"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full min-h-[36px] pl-8 pr-3 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {students.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
              {searchQuery.trim() ? `Sin resultados para "${searchQuery}"` : 'No hay alumnos con este filtro'}
            </p>
          ) : students.map((s) => {
            const isActive = student?.id === s.id;
            const progress = levelProgress(s);
            const lowHp = (s.hp / maxHp) * 100 < 30;
            return (
              <button
                key={s.id}
                type="button"
                data-student-id={s.id}
                onClick={() => onSelectStudent(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left border-l-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                  isActive
                    ? storyTheme ? '' : 'bg-primary-50 dark:bg-primary-900/30 border-l-primary-500'
                    : storyTheme ? 'border-l-transparent hover:bg-white/10' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
                style={isActive && storyTheme ? {
                  backgroundColor: `${storyTheme.colors?.primary}${isThemeDark ? '30' : '20'}`,
                  borderLeftColor: storyTheme.colors?.primary || '#3b82f6',
                } : undefined}
              >
                <span
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-lg"
                  title={classInfoOf(s)?.name || 'Sin clase'}
                  aria-hidden="true"
                >
                  {classInfoOf(s)?.icon || '👤'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1">
                    <span className={`truncate text-sm font-medium ${isActive && !storyTheme ? 'text-primary-800 dark:text-primary-200' : storyTheme && isThemeDark ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                      {getDisplayName(s)}
                    </span>
                    {topStudentId === s.id && <Crown size={12} className="text-amber-500 flex-shrink-0" aria-label="Líder en XP" />}
                    {lowHp && <Heart size={12} className="text-red-600 fill-red-600 flex-shrink-0" aria-label="HP bajo" />}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600" aria-hidden="true">
                      <span className="block h-full rounded-full bg-primary-500" style={{ width: `${progress.percent}%` }} />
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">Nv {s.level}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Ficha del alumno */}
      {student && (
        <section
          aria-label={`Ficha de ${getDisplayName(student)}`}
          className={`${selectedStudentId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
        >
          <div className="h-1.5 bg-primary-500 flex-shrink-0" />
          <button
            type="button"
            onClick={() => onSelectStudent(null)}
            className="lg:hidden self-start m-3 mb-0 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <LayoutList size={16} aria-hidden="true" />
            Lista
          </button>

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 p-4 lg:p-5">
            {/* Avatar protagonista */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative w-[160px] h-[280px] lg:w-[220px] lg:h-[384px] 2xl:w-[255px] 2xl:h-[444px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-primary-50 to-white dark:from-gray-700 dark:to-gray-800">
                <StudentAvatarMini
                  studentProfileId={student.id}
                  gender={student.avatarGender || 'MALE'}
                  size="xl"
                  className="absolute top-0 left-1/2 -translate-x-1/2 origin-top scale-[0.63] lg:scale-[0.865] 2xl:scale-100"
                />
              </div>
              {getStudentLinkCode(student.id) && (
                <button
                  type="button"
                  onClick={() => onCopyLinkCode(getStudentLinkCode(student.id)!)}
                  title="Copiar código del estudiante"
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Código <span className="font-mono font-bold text-gray-800 dark:text-gray-100">{getStudentLinkCode(student.id)}</span>
                  <Copy size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Datos y acciones */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 lg:overflow-y-auto lg:pr-1">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">{getDisplayName(student)}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-sm font-bold text-amber-800 dark:text-amber-200">
                    Nivel {student.level}
                  </span>
                  {topStudentId === student.id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-sm font-semibold text-primary-800 dark:text-primary-200">
                      <Crown size={14} aria-hidden="true" /> Líder en XP
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-lg" aria-hidden="true">{classInfoOf(student)?.icon || '👤'}</span>
                  <select
                    aria-label="Clase de personaje"
                    value={student.characterClassId || ''}
                    onChange={(e) => onAssignClass(student.id, e.target.value || null)}
                    className="min-h-[32px] rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent px-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
                  >
                    <option value="">Sin clase</option>
                    {characterClasses.filter((c) => c.isActive !== false && c.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                  {classroom.clansEnabled && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-100" style={{ backgroundColor: `${student.clanColor || '#6b7280'}33` }}>
                      🛡️ {student.clanName || 'Sin clan'}
                    </span>
                  )}
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300"><Heart size={16} className="fill-current" aria-hidden="true" />HP</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">{student.hp}<span className="text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400"> / {maxHp}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                    <motion.div initial={false} animate={{ width: `${Math.min((student.hp / maxHp) * 100, 100)}%` }} className="h-full rounded-full bg-red-500" />
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300"><Sparkles size={16} aria-hidden="true" />XP</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">{student.xp}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden" title={`${levelProgress(student).inLevel} / ${levelProgress(student).needed} para el nivel ${student.level + 1}`}>
                    <motion.div initial={false} animate={{ width: `${levelProgress(student).percent}%` }} className="h-full rounded-full bg-primary-500" />
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300"><Coins size={16} aria-hidden="true" />Oro</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">{student.gp}</div>
                </div>
              </div>

              {/* Comportamientos más usados: un toque */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Un toque aplica a {getDisplayName(student)}</span>
                  <button
                    type="button"
                    onClick={() => onOpenAllBehaviors(student.id)}
                    className="min-h-[36px] px-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                  >
                    {totalBehaviors > featuredBehaviors.length ? `Ver todos (${totalBehaviors})` : 'Más opciones'}
                  </button>
                </div>
                {featuredBehaviors.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Esta clase aún no tiene comportamientos.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[...positives, ...negatives].map((behavior) => {
                      const rewards = getBehaviorRewards(behavior);
                      const sign = behavior.isPositive ? '+' : '−';
                      return (
                        <button
                          key={behavior.id}
                          type="button"
                          onClick={() => onApplyBehavior(behavior, student.id)}
                          disabled={isApplying}
                          className={`min-h-[48px] flex items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                            behavior.isPositive
                              ? 'border-emerald-200 dark:border-emerald-800 text-gray-900 dark:text-white hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              : 'border-red-200 dark:border-red-800 text-gray-900 dark:text-white hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-lg flex-shrink-0" aria-hidden="true">{behavior.icon || (behavior.isPositive ? '⭐' : '💔')}</span>
                            <span className="truncate">{behavior.name}</span>
                          </span>
                          <span className={`flex-shrink-0 text-xs font-bold ${behavior.isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                            {rewards.map((reward) => `${sign}${reward.amount} ${reward.type}`).join(' · ')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAwardBadge(student.id)}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Medal size={15} aria-hidden="true" /> Insignia
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewProfile(student.id)}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Eye size={15} aria-hidden="true" /> Ver perfil completo
                  </button>
                </div>
              </div>

              {/* Lo que se le dio hoy */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">Hoy con {getDisplayName(student)}</p>
                {todayEntries.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sin actividad hoy.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {todayEntries.slice(0, 5).map((entry) => {
                      const amounts = entryAmounts(entry);
                      return (
                        <li key={entry.id} className="flex items-center gap-2 py-1.5 text-sm">
                          <span className="w-11 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {new Date(entry.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-100">{entry.details.reason || 'Puntos'}</span>
                          <span className={`font-semibold ${amounts.positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{amounts.text}</span>
                          <button
                            type="button"
                            onClick={() => undoEntry(entry)}
                            disabled={undoingId !== null}
                            aria-label={`Deshacer ${entry.details.reason || 'puntos'}`}
                            title="Deshacer"
                            className="inline-flex items-center justify-center min-h-[32px] min-w-[32px] rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
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
      )}
    </div>
  );
};
