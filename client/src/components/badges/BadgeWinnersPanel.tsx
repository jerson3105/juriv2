import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Clock, Search, Trophy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { RARITY_LABELS, badgeApi, badgeImageUrl, type BadgeAssignment, type BadgeRarity } from '../../lib/badgeApi';
import { historyApi } from '../../lib/historyApi';
import { ASSIGNMENT_NAME, RARITY_ORDER, RARITY_STYLE, badgeAwardCountsKey } from './badgeHelpers';

interface BadgeWinnersPanelProps {
  classroomId: string;
  onClose: () => void;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const BadgeVisual = ({ icon, name, small = false }: { icon: string | null; name: string; small?: boolean }) =>
  icon && icon.startsWith('/') ? (
    <img src={badgeImageUrl(icon)} alt={name} className={`${small ? 'h-5 w-5 rounded' : 'h-10 w-10 rounded-xl'} object-cover`} />
  ) : small ? (
    <span aria-hidden="true">{icon || '🏆'}</span>
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl dark:bg-amber-900/40" aria-hidden="true">{icon || '🏆'}</span>
  );

const selectClass = 'h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

// Quién ganó qué insignias y cuántas veces; permite quitar el último otorgamiento.
export const BadgeWinnersPanel = ({ classroomId, onClose }: BadgeWinnersPanelProps) => {
  const queryClient = useQueryClient();
  const isPresent = useIsPresent();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<BadgeRarity | 'ALL'>('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState<BadgeAssignment | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'byBadge' | 'byStudent'>('byBadge');
  const [expandedBadgeId, setExpandedBadgeId] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  // Espera a que se deje de escribir antes de consultar al servidor.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: breakdown, isLoading, isError } = useQuery({
    queryKey: ['badge-awards-breakdown', classroomId, search, rarityFilter, assignmentFilter],
    queryFn: () =>
      badgeApi.getClassroomAwardsBreakdown(classroomId, {
        search: search || undefined,
        rarity: rarityFilter === 'ALL' ? undefined : rarityFilter,
        assignmentMode: assignmentFilter === 'ALL' ? undefined : assignmentFilter,
      }),
  });
  const { data: counts = [] } = useQuery({
    queryKey: badgeAwardCountsKey(classroomId),
    queryFn: () => badgeApi.getAwardCounts(classroomId),
  });
  const lastAward = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of counts) map.set(`${row.studentProfileId}:${row.badgeId}`, row.lastStudentBadgeId);
    return map;
  }, [counts]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    if (!confirmKey) return;
    const timer = setTimeout(() => setConfirmKey(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmKey]);

  const removeOne = async (studentProfileId: string, badgeId: string, studentName: string, badgeName: string) => {
    const key = `${studentProfileId}:${badgeId}`;
    if (confirmKey !== key) {
      setConfirmKey(key);
      return;
    }
    const studentBadgeId = lastAward.get(key);
    if (!studentBadgeId) return;
    setConfirmKey(null);
    setRemovingKey(key);
    try {
      await historyApi.revertEntry('BADGE', studentBadgeId);
      toast.success(`Quitada: ${badgeName} a ${studentName}`);
      queryClient.invalidateQueries({ queryKey: badgeAwardCountsKey(classroomId) });
      queryClient.invalidateQueries({ queryKey: ['badge-awards-breakdown', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo quitar');
    } finally {
      setRemovingKey(null);
    }
  };

  const removeButton = (studentProfileId: string, badgeId: string, studentName: string, badgeName: string) => {
    const key = `${studentProfileId}:${badgeId}`;
    const confirming = confirmKey === key;
    return (
      <button
        type="button"
        onClick={() => void removeOne(studentProfileId, badgeId, studentName, badgeName)}
        disabled={removingKey === key || !lastAward.has(key)}
        aria-label={confirming ? `Confirmar: quitar ${badgeName} a ${studentName}` : `Quitar una ${badgeName} a ${studentName}`}
        className={`min-h-[36px] rounded-lg px-2.5 text-xs font-bold transition-colors disabled:opacity-60 ${
          confirming ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'
        }`}
      >
        {removingKey === key ? 'Quitando...' : confirming ? '¿Quitar? Toca otra vez' : 'Quitar'}
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-winners-title"
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 md:max-w-3xl"
      >
        <div className="border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg" aria-hidden="true">
                <Trophy size={18} />
              </span>
              <div>
                <h2 id="badge-winners-title" className="text-lg font-bold text-gray-900 dark:text-white">Ganadores de insignias</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">Quién ganó qué insignias y cuántas veces</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar estudiante o insignia"
                aria-label="Buscar estudiante o insignia"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              />
            </div>
            <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as BadgeRarity | 'ALL')} aria-label="Rareza" className={`${selectClass} story-select`}>
              <option value="ALL">Todas las rarezas</option>
              {RARITY_ORDER.map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
            </select>
            <select value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value as BadgeAssignment | 'ALL')} aria-label="Cómo se gana" className={`${selectClass} story-select`}>
              <option value="ALL">Manuales y automáticas</option>
              <option value="MANUAL">Solo manuales</option>
              <option value="AUTOMATIC">Solo automáticas</option>
              <option value="BOTH">Manual y automática</option>
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
            </div>
          )}
          {isError && (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">No se pudo cargar el desglose de insignias.</p>
          )}

          {!isLoading && !isError && breakdown && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Otorgamientos', value: breakdown.summary.totalAwards },
                  { label: 'Estudiantes con insignias', value: `${breakdown.summary.totalStudentsWithAwards}/${breakdown.summary.totalStudentsInClassroom}` },
                  { label: 'Insignias distintas', value: breakdown.summary.totalBadgesAwarded },
                  { label: 'La más otorgada', value: breakdown.summary.mostAwardedBadge?.name ?? 'Sin datos', small: true },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{stat.label}</p>
                    <p className={`${stat.small ? 'truncate text-sm font-bold' : 'text-xl font-black'} text-gray-900 dark:text-white`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {breakdown.recentAwards.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                    <Clock size={15} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    Recientes
                  </h3>
                  <ul className="space-y-1.5">
                    {breakdown.recentAwards.slice(0, 5).map((award) => (
                      <li key={`${award.studentProfileId}-${award.badgeId}-${award.awardedAt}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 text-gray-800 dark:text-gray-200">
                          <BadgeVisual icon={award.badgeIcon} name={award.badgeName} small />
                          <span className="truncate"><span className="font-semibold">{award.studentName}</span> · {award.badgeName}</span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{formatDate(award.awardedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist" aria-label="Ver ganadores">
                {([['byBadge', 'Por insignia'], ['byStudent', 'Por estudiante']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === value}
                    onClick={() => setActiveTab(value)}
                    className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors ${
                      activeTab === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'byBadge' && (
                <div className="space-y-3">
                  {breakdown.byBadge.length === 0 && (
                    <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Nadie ha ganado insignias con estos filtros.</p>
                  )}
                  {breakdown.byBadge.map((badge) => {
                    const expanded = expandedBadgeId === badge.badgeId;
                    return (
                      <div key={badge.badgeId} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <button
                          type="button"
                          onClick={() => setExpandedBadgeId(expanded ? null : badge.badgeId)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-3 p-4 text-left"
                        >
                          <BadgeVisual icon={badge.badgeIcon} name={badge.badgeName} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold text-gray-900 dark:text-white">{badge.badgeName}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                              <span className={`rounded-full px-2 py-0.5 font-bold ${RARITY_STYLE[badge.rarity].chip}`}>{RARITY_LABELS[badge.rarity]}</span>
                              {ASSIGNMENT_NAME[badge.assignmentMode]}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-bold text-gray-900 dark:text-white">{badge.uniqueStudents} {badge.uniqueStudents === 1 ? 'estudiante' : 'estudiantes'}</span>
                            <span className="block text-xs text-gray-700 dark:text-gray-300">{badge.totalAwards} {badge.totalAwards === 1 ? 'vez' : 'veces'}</span>
                          </span>
                          <ChevronDown size={18} className={`text-gray-600 transition-transform dark:text-gray-300 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        {expanded && (
                          <ul className="space-y-2 border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                            {badge.winners.map((winner) => (
                              <li key={winner.studentProfileId} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-gray-900 dark:text-white">{winner.studentName}</span>
                                  <span className="block truncate text-xs text-gray-700 dark:text-gray-300">
                                    Nivel {winner.level} · {formatDate(winner.lastAwardedAt)}{winner.lastAwardReason ? ` · ${winner.lastAwardReason}` : ''}
                                  </span>
                                </span>
                                <span className="flex flex-shrink-0 items-center gap-2">
                                  <span className="text-sm font-black text-gray-900 dark:text-white">×{winner.awardCount}</span>
                                  {removeButton(winner.studentProfileId, badge.badgeId, winner.studentName, badge.badgeName)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'byStudent' && (
                <div className="space-y-3">
                  {breakdown.byStudent.length === 0 && (
                    <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Nadie ha ganado insignias con estos filtros.</p>
                  )}
                  {breakdown.byStudent.map((student) => (
                    <div key={student.studentProfileId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-gray-900 dark:text-white">{student.studentName}</span>
                          <span className="block text-xs text-gray-700 dark:text-gray-300">
                            {student.uniqueBadges} {student.uniqueBadges === 1 ? 'insignia' : 'insignias'} · {student.totalAwards} {student.totalAwards === 1 ? 'vez' : 'veces'}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{formatDate(student.lastAwardedAt)}</span>
                      </div>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {student.badges.map((badge) => (
                          <li key={badge.badgeId} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 py-1 pl-2.5 pr-1 text-xs text-gray-900 dark:bg-gray-700 dark:text-white">
                            <BadgeVisual icon={badge.badgeIcon} name={badge.badgeName} small />
                            <span className="max-w-[140px] truncate font-medium">{badge.badgeName}</span>
                            <span className="font-black">×{badge.awardCount}</span>
                            {removeButton(student.studentProfileId, badge.badgeId, student.studentName, badge.badgeName)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
};
