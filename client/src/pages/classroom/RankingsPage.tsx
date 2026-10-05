import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Coins, Shield, Sparkles, Trophy, Zap } from 'lucide-react';
import { classroomApi, type Classroom, type Student } from '../../lib/classroomApi';
import { clanApi } from '../../lib/clanApi';
import { rankingApi, rankingDeltasKey } from '../../lib/rankingApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { RankingPodium } from '../../components/rankings/RankingPodium';
import { RankingList } from '../../components/rankings/RankingList';
import { ClanBattle } from '../../components/rankings/ClanBattle';
import { DayStars } from '../../components/rankings/DayStars';
import { CeremonyOverlay } from '../../components/rankings/ceremony/CeremonyOverlay';
import {
  METRIC_UNIT, PERIODS, activeStudents, buildClanRows, buildDayStars, buildRows, deltaMap, formatNumber, hasStars, periodStart,
  type Metric, type Period,
} from '../../components/rankings/rankingHelpers';

type Tab = Metric | 'clans';

const TABS: { id: Tab; label: string; icon: typeof Zap }[] = [
  { id: 'xp', label: 'XP', icon: Zap },
  { id: 'gp', label: 'Oro', icon: Coins },
  { id: 'clans', label: 'Clanes', icon: Shield },
];

const MASCOT: Record<Tab, string> = {
  xp: '/assets/jiro/rankings/xp.webp',
  gp: '/assets/jiro/rankings/oro.webp',
  clans: '/assets/mascot/jiro-ranking-clanes.png',
};

const REFRESH_MS = 30000;

export const RankingsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { students?: Student[] } }>();
  const classroomId = classroom.id;
  const { classMap } = useCharacterClasses(classroomId);
  const [tab, setTab] = useState<Tab>('xp');
  const [period, setPeriod] = useState<Period>('all');
  const [showCeremony, setShowCeremony] = useState(false);

  // Misma clave que el layout: se comparte caché y se refresca cada 30 s mientras la pestaña está visible.
  const { data: freshClassroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId),
    refetchInterval: REFRESH_MS,
  });
  const students = useMemo(() => freshClassroom?.students ?? classroom.students ?? [], [freshClassroom, classroom.students]);
  const active = useMemo(() => activeStudents(students), [students]);

  const { data: clans = [] } = useQuery({
    queryKey: ['clans', classroomId],
    queryFn: () => clanApi.getClassroomClans(classroomId),
    enabled: classroom.clansEnabled,
  });

  const todaySince = periodStart('today');
  const weekSince = periodStart('week');
  const { data: todayDeltas } = useQuery({
    queryKey: rankingDeltasKey(classroomId, todaySince),
    queryFn: () => rankingApi.getDeltas(classroomId, todaySince),
    refetchInterval: REFRESH_MS,
  });
  const { data: weekDeltas } = useQuery({
    queryKey: rankingDeltasKey(classroomId, weekSince),
    queryFn: () => rankingApi.getDeltas(classroomId, weekSince),
    enabled: period === 'week',
    refetchInterval: REFRESH_MS,
  });
  const periodDeltas = period === 'today' ? todayDeltas : period === 'week' ? weekDeltas : undefined;

  const metric: Metric = tab === 'gp' ? 'gp' : 'xp';
  const unit = METRIC_UNIT[metric];
  const plus = period !== 'all';
  const showCharacterName = classroom.showCharacterName;

  const rows = useMemo(
    () => buildRows(students, metric, period, deltaMap(periodDeltas), todayDeltas ? deltaMap(todayDeltas) : null, showCharacterName),
    [students, metric, period, periodDeltas, todayDeltas, showCharacterName],
  );
  const podium = rows.filter((r) => r.value > 0).slice(0, 3);
  const rest = rows.slice(podium.length);
  const clanRows = useMemo(() => buildClanRows(clans, period, periodDeltas), [clans, period, periodDeltas]);
  const stars = useMemo(() => buildDayStars(students, clans, todayDeltas, showCharacterName), [students, clans, todayDeltas, showCharacterName]);

  const periodLabel = period === 'today' ? 'hoy' : 'esta semana';
  const periodGains = periodDeltas?.students ?? [];
  const stats = period === 'all'
    ? [
        { label: 'XP de la clase', value: formatNumber(active.reduce((s, st) => s + st.xp, 0)), icon: Zap },
        { label: 'Oro de la clase', value: formatNumber(active.reduce((s, st) => s + st.gp, 0)), icon: Coins },
        { label: 'Nivel promedio', value: active.length ? (active.reduce((s, st) => s + st.level, 0) / active.length).toFixed(1) : '0', icon: Trophy },
      ]
    : [
        { label: `XP ganado ${periodLabel}`, value: formatNumber(periodGains.reduce((s, g) => s + Math.max(0, g.xp), 0)), icon: Zap },
        { label: `Oro ganado ${periodLabel}`, value: formatNumber(periodGains.reduce((s, g) => s + Math.max(0, g.gp), 0)), icon: Coins },
        { label: 'Estudiantes que sumaron', value: `${periodGains.filter((g) => g.xp > 0 || g.gp > 0).length} de ${active.length}`, icon: Trophy },
      ];

  const tabs = TABS.filter((t) => t.id !== 'clans' || classroom.clansEnabled);
  const segmented = 'min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition-colors sm:flex-none';

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30" aria-hidden="true">
            <Trophy size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Rankings</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {active.length} {active.length === 1 ? 'estudiante' : 'estudiantes'}{classroom.clansEnabled ? ` · ${clans.length} clanes` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCeremony(true)}
          disabled={active.length === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 px-5 text-sm font-bold text-amber-200 shadow-lg shadow-indigo-950/30 ring-1 ring-amber-300/40 hover:from-slate-800 hover:to-indigo-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={18} aria-hidden="true" />
          Gala de cierre
        </button>
      </div>

      {/* Qué y cuándo */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Ranking" className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`${segmented} inline-flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Periodo" className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`${segmented} ${period === p.id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {hasStars(stars) && <DayStars stars={stars} />}

      <motion.div
        key={`${tab}-${period}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        {active.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
            <p className="text-4xl" aria-hidden="true">🏆</p>
            <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">El ranking se llena solo</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Añade estudiantes y dales puntos con los comportamientos: aquí verás el podio en tiempo real.</p>
          </div>
        ) : tab === 'clans' ? (
          clanRows.length > 0
            ? <ClanBattle rows={clanRows} plus={plus} />
            : <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay clanes en esta clase.</p>
        ) : (
          <>
            {podium.length > 0 ? (
              <RankingPodium rows={podium} unit={unit} plus={plus} mascot={MASCOT[tab]} />
            ) : (
              <div className="rounded-3xl bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 px-6 py-10 text-center">
                <p className="text-4xl" aria-hidden="true">⏳</p>
                <h2 className="mt-2 text-lg font-bold text-white">
                  {period === 'all' ? `Aún nadie tiene ${unit}` : `${period === 'today' ? 'Hoy' : 'Esta semana'} aún no se ha ganado ${unit}`}
                </h2>
                <p className="mt-1 text-sm text-indigo-100">El podio aparece en cuanto des los primeros puntos.</p>
              </div>
            )}
            <RankingList rows={rest} classMap={classMap} unit={unit} plus={plus} />
          </>
        )}

        {active.length > 0 && tab !== 'clans' && (
          <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <s.icon size={20} className="flex-shrink-0 text-primary-600 dark:text-primary-300" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{s.label}</dt>
                  <dd className="text-lg font-black tabular-nums text-gray-900 dark:text-white">{s.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
      </motion.div>

      {showCeremony && (
        <CeremonyOverlay
            classroomId={classroomId}
            classroomName={classroom.name}
            students={students}
            clans={clans}
            classMap={classMap}
            showCharacterName={showCharacterName}
            archived={classroom.isActive === false}
          onClose={() => setShowCeremony(false)}
        />
      )}
    </div>
  );
};
