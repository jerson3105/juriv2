import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Check, Gift, Search, UserCheck, Users, X } from 'lucide-react';
import { RARITY_LABELS, badgeApi, type Badge } from '../../lib/badgeApi';
import { classroomApi } from '../../lib/classroomApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { useAwardBadge } from '../../hooks/useAwardBadge';
import { BadgeMedallion } from './BadgeMedallion';
import { RARITY_STYLE, badgeAwardCountsKey, studentLabel } from './badgeHelpers';

interface AwardBadgeModalProps {
  badge: Badge;
  classroomId: string;
  showCharacterName: boolean;
  onClose: () => void;
  onAwarded: (badge: Badge, studentNames: string[]) => void;
}

const GENERIC_REASONS = ['Excelente participación', 'Ayudó a un compañero', 'Gran esfuerzo', 'Superó un reto'];
const MAX_QUICK_REASONS = 4;

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Elegir a quién dar una insignia: marca quién ya la tiene, "Todos" y "Solo presentes".
export const AwardBadgeModal = ({ badge, classroomId, showCharacterName, onClose, onAwarded }: AwardBadgeModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const { award, isAwarding } = useAwardBadge(classroomId);
  const isPresent = useIsPresent();
  const today = localToday();
  const style = RARITY_STYLE[badge.rarity];

  const { data: classroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId),
  });
  const { data: counts = [] } = useQuery({
    queryKey: badgeAwardCountsKey(classroomId),
    queryFn: () => badgeApi.getAwardCounts(classroomId),
  });
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroomId, today],
    queryFn: () => attendanceApi.getAttendanceByDate(classroomId, today),
  });
  const { data: recentReasons = [] } = useQuery({
    queryKey: ['badge-recent-reasons', badge.id],
    queryFn: () => badgeApi.getRecentReasons(badge.id),
  });

  // Motivos rápidos de esta insignia: su criterio («¿Cuándo la das?»), los que ya usaste con ella y,
  // para completar, los genéricos. El alumno lee el motivo en su celebración y en «Mis insignias».
  const quickReasons = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of [badge.description ?? '', ...recentReasons, ...GENERIC_REASONS]) {
      const text = raw.trim();
      const key = text.toLocaleLowerCase('es');
      if (!text || text.length > 80 || seen.has(key)) continue;
      seen.add(key);
      list.push(text);
      if (list.length === MAX_QUICK_REASONS) break;
    }
    return list;
  }, [badge.description, recentReasons]);

  const students = useMemo(
    () => [...(classroom?.students ?? [])].sort((a, b) => studentLabel(a, showCharacterName).localeCompare(studentLabel(b, showCharacterName), 'es')),
    [classroom, showCharacterName],
  );
  const owned = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of counts) if (row.badgeId === badge.id) map.set(row.studentProfileId, row.count);
    return map;
  }, [counts, badge.id]);
  const presentIds = useMemo(() => {
    if (todayAttendance.length === 0) return null;
    return new Set(todayAttendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').map((r) => r.studentProfileId));
  }, [todayAttendance]);

  const term = search.trim().toLocaleLowerCase('es');
  const visible = term
    ? students.filter((s) => `${s.characterName ?? ''} ${s.realName ?? ''} ${s.realLastName ?? ''}`.toLocaleLowerCase('es').includes(term))
    : students;
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
  const nameOf = (id: string) => {
    const student = students.find((s) => s.id === id);
    return student ? studentLabel(student, showCharacterName) : 'Estudiante';
  };

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((s) => (allVisibleSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  };

  const submit = async () => {
    const ids = Array.from(selected);
    const result = await award(badge, ids, nameOf, reason.trim() || undefined);
    if (result && result.awarded.length > 0) {
      onAwarded(badge, result.awarded.map((a) => nameOf(a.studentProfileId)));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-badge-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className={`flex items-center gap-4 border-b-2 bg-gradient-to-b to-white px-5 py-4 dark:to-gray-800 ${style.tile}`}>
          <BadgeMedallion badge={badge} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Otorgar insignia</p>
            <h2 id="award-badge-title" className="truncate text-xl font-black text-gray-900 dark:text-white">{badge.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded-full px-2.5 py-0.5 font-bold ${style.chip}`}>{RARITY_LABELS[badge.rarity]}</span>
              {badge.rewardXp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.XP}`}>+{badge.rewardXp} XP</span>}
              {badge.rewardGp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.GP}`}>+{badge.rewardGp} GP</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-lg text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar estudiante"
              aria-label="Buscar estudiante"
              className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={toggleAllVisible}
            aria-pressed={allVisibleSelected}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Users size={16} aria-hidden="true" />
            {allVisibleSelected ? 'Ninguno' : 'Todos'}
          </button>
          {presentIds && (
            <button
              type="button"
              onClick={() => setSelected(new Set(students.filter((s) => presentIds.has(s.id)).map((s) => s.id)))}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <UserCheck size={16} aria-hidden="true" />
              Solo presentes
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!classroom ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">Cargando estudiantes...</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">No hay estudiantes que coincidan.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visible.map((student) => {
                const isSelected = selected.has(student.id);
                const times = owned.get(student.id) ?? 0;
                const name = studentLabel(student, showCharacterName);
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => toggle(student.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
                          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`} aria-hidden="true">
                        {isSelected ? <Check size={18} /> : name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
                        <span className="block text-xs text-gray-700 dark:text-gray-300">Nivel {student.level}</span>
                      </span>
                      {times > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                          Ya la tiene{times > 1 ? ` ×${times}` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <label htmlFor="award-reason" className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            Motivo <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, lo verá el estudiante)</span>
          </label>
          <input
            id="award-reason"
            type="text"
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selected.size > 0) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Ej: Por su excelente participación"
            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
          />
          <div className="flex flex-wrap gap-1.5">
            {quickReasons.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setReason(text)}
                aria-pressed={reason === text}
                className={`min-h-[32px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                  reason === text
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={selected.size === 0 || isAwarding}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
            >
              <Gift size={16} aria-hidden="true" />
              {isAwarding ? 'Otorgando...' : selected.size === 0 ? 'Elige estudiantes' : `Otorgar a ${selected.size}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
