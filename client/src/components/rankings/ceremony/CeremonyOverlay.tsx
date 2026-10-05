import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Volume2, VolumeX, X } from 'lucide-react';
import type { Student } from '../../../lib/classroomApi';
import type { ClanWithMembers } from '../../../lib/clanApi';
import { rankingApi, rankingDeltasKey } from '../../../lib/rankingApi';
import { classSeasonKey, seasonApi } from '../../../lib/seasonApi';
import { studentLabel } from '../../badges/badgeHelpers';
import {
  activeStudents, buildDayStars, buildRace, buildRows, classIcon, deltaMap, periodStart, type ClassMap,
} from '../rankingHelpers';
import { AwardsAct, CountdownAct, OpeningAct, SetupAct, type CeremonyMode } from './CeremonyActs';
import { ParadeAct, RecognitionsAct, type ParadeRow, type SeasonRecognition } from './CeremonySeasonActs';
import { CeremonyPodium } from './CeremonyPodium';
import { CeremonyRace } from './CeremonyRace';
import { CeremonyTable } from './CeremonyTable';
import { CeremonyBackdrop, JiroPresenter, type JiroPose } from './CeremonyStage';
import { createCeremonySound, readMuted, saveMuted } from './ceremonySound';

type Step = 'setup' | 'opening' | 'awards' | 'countdown' | 'third' | 'second' | 'first' | 'race' | 'table' | 'recognitions' | 'parade';

const STEP_LABEL: Record<Step, string> = {
  setup: 'Preparación',
  opening: 'Apertura',
  awards: 'Premios especiales',
  countdown: 'Cuenta atrás',
  third: 'Tercer lugar',
  second: 'Segundo lugar',
  first: 'Primer lugar',
  race: 'La carrera',
  table: 'Clasificación completa',
  recognitions: 'Reconocimientos',
  parade: 'Desfile',
};

const PODIUM_PLACE: Partial<Record<Step, 0 | 1 | 2>> = { third: 2, second: 1, first: 0 };
const DRUM_MS = 2600;
const DRUM_FIRST_MS = 3400;

// Pantalla completa del propio overlay (el menú de la app no se ve al proyectar).
const subscribeFullscreen = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb);
  return () => document.removeEventListener('fullscreenchange', cb);
};
const COMPACT_QUERY = '(max-width: 767px), (max-height: 640px)';
const subscribeCompact = (cb: () => void) => {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

interface CeremonyOverlayProps {
  classroomId: string;
  classroomName: string;
  students: Student[];
  clans: ClanWithMembers[];
  classMap: ClassMap;
  showCharacterName: boolean;
  /** Clase archivada (p. ej. de un año que cerró): la gala empieza en «Temporada». */
  archived?: boolean;
  onClose: () => void;
}

// Gala de cierre: overlay a pantalla completa que recorre apertura, premios, cuenta atrás, podio con redoble,
// repetición de la carrera y clasificación completa. En «Temporada»: cifras del año, reconocimientos que no compiten y
// el desfile de cada estudiante, sin podio. El profesor marca el ritmo (Espacio / →).
export const CeremonyOverlay = ({ classroomId, classroomName, students, clans, classMap, showCharacterName, archived = false, onClose }: CeremonyOverlayProps) => {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<confetti.CreateTypes | null>(null);
  const [since] = useState(() => periodStart('today'));
  const [sound] = useState(() => createCeremonySound(readMuted()));
  const [muted, setMuted] = useState(readMuted);
  const [modeChoice, setModeChoice] = useState<CeremonyMode | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'drum' | 'shown'>('shown');
  const [countdownShown, setCountdownShown] = useState(0);
  const [paradeChoice, setParadePage] = useState(0);

  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement && document.fullscreenElement === rootRef.current);
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT_QUERY).matches);

  const { data: today, isLoading, isError } = useQuery({
    queryKey: rankingDeltasKey(classroomId, since, true),
    queryFn: () => rankingApi.getDeltas(classroomId, since, true),
  });

  // ── Datos de la gala ──
  const todayMap = useMemo(() => deltaMap(today), [today]);
  const active = useMemo(() => activeStudents(students), [students]);
  const todayScorers = active.filter((s) => (todayMap.get(s.id)?.xp ?? 0) > 0).length;
  const mode: CeremonyMode = modeChoice ?? (archived ? 'season' : todayScorers > 0 ? 'today' : 'total');
  const plus = mode === 'today';
  const isSeason = mode === 'season';

  // ── Temporada (solo si se elige) ──
  const seasonQuery = useQuery({
    queryKey: classSeasonKey(classroomId),
    queryFn: () => seasonApi.classroom(classroomId),
    enabled: isSeason,
  });
  const season = seasonQuery.data;
  // Por orden alfabético: nadie desfila por puesto.
  const parade = useMemo<ParadeRow[]>(() => {
    if (!season) return [];
    const byId = new Map(season.students.map((s) => [s.id, s]));
    return active
      .flatMap((student) => {
        const data = byId.get(student.id);
        return data ? [{ student, name: studentLabel(student, showCharacterName), season: data }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [season, active, showCharacterName]);
  const recognitions = useMemo<SeasonRecognition[]>(() => {
    const most = Math.max(0, ...parade.map((row) => row.season.badgeCount));
    const albums = parade.filter((row) => row.season.albumsCompleted > 0);
    const perfect = parade.filter((row) => row.season.perfectAttendance);
    const items: SeasonRecognition[] = [
      { key: 'badges', icon: '🏅', title: 'Coleccionista de insignias', detail: `${most} ${most === 1 ? 'insignia' : 'insignias'} en la temporada`, people: most > 0 ? parade.filter((row) => row.season.badgeCount === most) : [] },
      { key: 'albums', icon: '📒', title: 'Álbum completo', detail: albums.length === 1 ? 'Completó un álbum de cartas' : 'Completaron un álbum de cartas', people: albums },
      { key: 'attendance', icon: '📅', title: 'Asistencia perfecta', detail: perfect.length === 1 ? 'Vino a cada clase de la temporada' : 'Vinieron a cada clase de la temporada', people: perfect },
    ];
    return items.filter((item) => item.people.length > 0);
  }, [parade]);
  const paradeSize = compact ? 4 : 8;
  const paradePages = Math.max(1, Math.ceil(parade.length / paradeSize));
  // Al pasar a pantalla chica hay más páginas; a grande, menos: la elegida se ajusta.
  const paradePage = Math.min(paradeChoice, paradePages - 1);

  const rows = useMemo(
    () => (mode === 'today'
      ? buildRows(students, 'xp', 'today', todayMap, null, showCharacterName)
      : buildRows(students, 'xp', 'all', todayMap, todayMap, showCharacterName)),
    [mode, students, todayMap, showCharacterName],
  );
  const ranked = rows.filter((r) => r.value > 0);
  const podium = ranked.slice(0, 3);
  // Del 4.º al 10.º puesto, incluidos todos los empatados (tope de 16 filas; el resto sale en la tabla final).
  const countdownAll = ranked.slice(3).filter((r) => r.rank <= 10);
  const countdown = countdownAll.slice(0, 16);
  const countdownHidden = countdownAll.length - countdown.length;
  const stars = useMemo(() => buildDayStars(students, clans, today, showCharacterName), [students, clans, today, showCharacterName]);
  const hasAwards = !!(stars.climber || stars.gold || stars.clan || (mode === 'total' && stars.xp));
  const race = useMemo(() => (today ? buildRace(students, today, mode === 'today', showCharacterName) : null), [students, today, mode, showCharacterName]);
  const raceIcons = useMemo(() => race?.students.map((student) => classIcon({ student }, classMap)) ?? [], [race, classMap]);

  const gainedXp = (today?.students ?? []).reduce((sum, s) => sum + Math.max(0, s.xp), 0);
  const gainedGp = (today?.students ?? []).reduce((sum, s) => sum + Math.max(0, s.gp), 0);
  const seasonStats = season
    ? [
        { label: 'Insignias ganadas', value: season.stats.badges },
        season.stats.albumsCompleted > 0 ? { label: 'Álbumes completos', value: season.stats.albumsCompleted } : { label: 'Cartas reunidas', value: season.stats.cards },
        { label: 'Días de clase', value: season.stats.attendanceDays },
        { label: 'XP de toda la clase', value: season.stats.xp },
        { label: 'Estudiantes', value: season.stats.students },
      ].filter((s) => s.value > 0).slice(0, 3)
    : [];
  const stats = isSeason
    ? seasonStats
    : mode === 'today'
    ? [
        { label: 'XP ganado hoy', value: gainedXp },
        { label: 'Oro ganado hoy', value: gainedGp },
        { label: todayScorers === 1 ? 'Estudiante sumó' : 'Estudiantes sumaron', value: todayScorers },
      ]
    : [
        { label: 'XP total de la clase', value: active.reduce((sum, s) => sum + s.xp, 0) },
        { label: 'XP ganado hoy', value: gainedXp },
        { label: 'Estudiantes', value: active.length },
      ];

  const steps = useMemo<Step[]>(() => (isSeason
    ? [
        'setup',
        'opening',
        ...(recognitions.length > 0 ? ['recognitions' as const] : []),
        ...(parade.length > 0 ? ['parade' as const] : []),
      ]
    : [
        'setup',
        'opening',
        ...(hasAwards ? ['awards' as const] : []),
        ...(countdown.length > 0 ? ['countdown' as const] : []),
        ...(podium[2] ? ['third' as const] : []),
        ...(podium[1] ? ['second' as const] : []),
        ...(podium[0] ? ['first' as const] : []),
        ...(race ? ['race' as const] : []),
        'table',
      ]), [isSeason, recognitions.length, parade.length, hasAwards, countdown.length, podium, race]);
  const current = steps[Math.min(stepIndex, steps.length - 1)];
  const place = PODIUM_PLACE[current];

  // ── Efectos de celebración ──
  const celebrate = useCallback(() => {
    if (reduce || !canvasRef.current) return;
    confettiRef.current ??= confetti.create(canvasRef.current, { resize: true });
    const fire = confettiRef.current;
    const colors = ['#fcd34d', '#fbbf24', '#fef3c7', '#a78bfa', '#60a5fa'];
    fire({ particleCount: 160, spread: 100, startVelocity: 55, origin: { x: 0.5, y: 0.55 }, colors });
    const end = Date.now() + 2500;
    const burst = () => {
      fire({ particleCount: 7, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors });
      fire({ particleCount: 7, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [reduce]);

  const reveal = useCallback((placeIndex: 0 | 1 | 2) => {
    setPhase('shown');
    sound.stopAll();
    sound.hit();
    if (placeIndex === 0) {
      sound.fanfare();
      celebrate();
    }
  }, [sound, celebrate]);

  // ── Navegación ──
  const go = useCallback((index: number, instant = false) => {
    const target = steps[index];
    if (!target) return;
    sound.stopAll();
    setStepIndex(index);
    const targetPlace = PODIUM_PLACE[target];
    if (targetPlace !== undefined && !instant) {
      setPhase('drum');
      sound.drumroll((targetPlace === 0 ? DRUM_FIRST_MS : DRUM_MS) / 1000);
    } else {
      setPhase('shown');
    }
    setCountdownShown(instant ? countdown.length : 0);
    setParadePage(0);
    if (!instant && (target === 'opening' || target === 'awards' || target === 'table' || target === 'recognitions' || target === 'parade')) sound.whoosh();
  }, [steps, sound, countdown.length]);

  const start = useCallback(() => {
    sound.unlock();
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.().catch(() => { /* el navegador lo impide: sigue en ventana */ });
    go(1);
  }, [sound, go]);

  const next = useCallback(() => {
    if (current === 'setup') return start();
    if (place !== undefined && phase === 'drum') return reveal(place);
    if (current === 'countdown' && countdownShown < countdown.length) return setCountdownShown(countdown.length);
    if (current === 'parade' && paradePage < paradePages - 1) {
      sound.whoosh();
      return setParadePage(paradePage + 1);
    }
    if (stepIndex < steps.length - 1) go(stepIndex + 1);
    else onClose();
  }, [current, place, phase, countdownShown, countdown.length, paradePage, paradePages, stepIndex, steps.length, start, reveal, go, sound, onClose]);

  const prev = useCallback(() => {
    if (current === 'parade' && paradePage > 0) return setParadePage(paradePage - 1);
    if (stepIndex > 1) go(stepIndex - 1, true);
  }, [current, paradePage, stepIndex, go]);

  const toggleMute = useCallback(() => {
    const value = !muted;
    setMuted(value);
    sound.setMuted(value);
    saveMuted(value);
  }, [muted, sound]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  // Temporizadores del acto actual (redoble → revelación; cuenta atrás fila a fila).
  useEffect(() => {
    if (place !== undefined && phase === 'drum') {
      const id = window.setTimeout(() => reveal(place), place === 0 ? DRUM_FIRST_MS : DRUM_MS);
      return () => window.clearTimeout(id);
    }
    if (current === 'countdown' && countdownShown < countdown.length) {
      const id = window.setTimeout(() => {
        setCountdownShown((n) => n + 1);
        sound.tick();
      }, countdownShown === 0 ? 700 : 600);
      return () => window.clearTimeout(id);
    }
  }, [current, place, phase, countdownShown, countdown.length, reveal, sound]);

  // Teclado: Espacio/→ avanzar, ← volver, Esc salir, M sonido, F pantalla completa.
  const keysRef = useRef({ next, prev, onClose, toggleMute, toggleFullscreen });
  useLayoutEffect(() => {
    keysRef.current = { next, prev, onClose, toggleMute, toggleFullscreen };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, input, select, textarea, a');
      const k = keysRef.current;
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) { e.preventDefault(); k.next(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); k.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); k.prev(); }
      else if (e.key === 'Escape') { e.preventDefault(); k.onClose(); }
      else if (e.key === 'm' || e.key === 'M') k.toggleMute();
      else if (e.key === 'f' || e.key === 'F') k.toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bloquea el scroll de la página, enfoca la gala y limpia sonido/pantalla completa al salir.
  useEffect(() => {
    const root = rootRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (document.fullscreenElement && document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
      confettiRef.current?.reset();
      sound.close();
    };
  }, [sound]);

  // ── Presentador ──
  const podiumName = place !== undefined ? podium[place]?.name : undefined;
  const jiro: { pose: JiroPose; line: string } = (() => {
    switch (current) {
      case 'setup': return { pose: 'cheer', line: '¡Hola! Hoy presento yo.' };
      case 'opening': return { pose: 'cheer', line: isSeason ? '¡Qué temporada! Mira estas cifras.' : '¡Qué clase! Mira estas cifras.' };
      case 'recognitions': return { pose: 'point', line: '¡Estos logros merecen un aplauso!' };
      case 'parade': return { pose: 'cheer', line: '¡Un aplauso para cada uno!' };
      case 'awards': return { pose: 'point', line: 'Primero, los premios especiales…' };
      case 'countdown': return { pose: 'point', line: '¡Estos también brillaron!' };
      case 'third': return phase === 'drum' ? { pose: 'nervous', line: '¿Quién se lleva el bronce…?' } : { pose: 'point', line: `¡Bronce para ${podiumName}!` };
      case 'second': return phase === 'drum' ? { pose: 'nervous', line: '¿Y la plata…?' } : { pose: 'point', line: `¡Plata para ${podiumName}!` };
      case 'first': return phase === 'drum' ? { pose: 'nervous', line: 'Redoble… ¡el oro es para…!' } : { pose: 'cheer', line: `¡${podiumName} gana el oro!` };
      case 'race': return { pose: 'cheer', line: 'Así se vivió la carrera.' };
      default: return { pose: 'cheer', line: '¡Gracias por jugar!' };
    }
  })();

  // ── Acto actual ──
  const actKey = place !== undefined ? 'podium' : current;
  const revealedFrom = place === undefined ? 0 : phase === 'shown' ? place : place + 1;
  const unit = 'XP';

  // La temporada carga al elegirla: la preparación no la espera (se puede cambiar de modo).
  const loading = isLoading || (isSeason && current !== 'setup' && seasonQuery.isLoading);
  const failed = isError || (isSeason && current !== 'setup' && seasonQuery.isError);

  const renderAct = () => {
    if (loading) {
      return (
        <p className="flex items-center gap-3 text-xl font-bold text-indigo-100" role="status">
          <Loader2 className="animate-spin" aria-hidden="true" />
          Preparando la gala…
        </p>
      );
    }
    if (failed) {
      return (
        <p className="text-xl font-bold text-white" role="alert">
          {isError ? 'No se pudieron cargar los datos de hoy.' : 'No se pudieron cargar los datos de la temporada.'} Cierra e inténtalo de nuevo.
        </p>
      );
    }
    switch (current) {
      case 'setup':
        return (
          <SetupAct
            classroomName={classroomName}
            mode={mode}
            onMode={setModeChoice}
            todayScorers={todayScorers}
            muted={muted}
            onToggleMute={toggleMute}
            onStart={start}
          />
        );
      case 'opening': return <OpeningAct stats={stats} title={isSeason ? '¡Así fue nuestra temporada!' : undefined} />;
      case 'recognitions': return <RecognitionsAct items={recognitions} />;
      case 'parade': return <ParadeAct rows={parade.slice(paradePage * paradeSize, (paradePage + 1) * paradeSize)} page={paradePage} pages={paradePages} />;
      case 'awards': return <AwardsAct stars={stars} mode={mode} />;
      case 'countdown': return <CountdownAct rows={countdown} hiddenTies={countdownHidden} shown={countdownShown} classMap={classMap} unit={unit} plus={plus} />;
      case 'race': return race ? <CeremonyRace race={race} since={since} classIcons={raceIcons} onTick={sound.tick} /> : null;
      case 'table': return <CeremonyTable rows={rows} classMap={classMap} unit={unit} plus={plus} />;
      default:
        return (
          <div className="flex w-full flex-col items-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-amber-300">{mode === 'today' ? 'Lo ganado hoy' : 'XP total'}</p>
            <h2 className="mb-6 text-3xl font-black text-white sm:text-5xl">El podio</h2>
            <CeremonyPodium rows={podium} revealedFrom={revealedFrom} drumming={phase === 'drum' ? place ?? null : null} unit={unit} plus={plus} compact={compact} />
          </div>
        );
    }
  };

  const isLast = stepIndex >= steps.length - 1 && !(current === 'parade' && paradePage < paradePages - 1);
  const controlButton = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-40';

  return createPortal(
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Gala de cierre" tabIndex={-1} className="fixed inset-0 z-[180] flex flex-col overflow-hidden bg-slate-950 text-white outline-none">
      <CeremonyBackdrop />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 pt-8 sm:px-10 md:pl-[17vw]">
        {/* Solo animación de entrada: cambiar de acto nunca espera a que termine una salida. */}
        <motion.div
          key={loading || failed ? 'status' : actKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className={`flex w-full justify-center ${current === 'table' ? 'h-full' : ''}`}
        >
          {renderAct()}
        </motion.div>
      </div>

      <JiroPresenter pose={jiro.pose} line={jiro.line} hidden={current === 'table' || loading} />

      <nav aria-label="Controles de la gala" className="relative z-30 flex items-center gap-1 border-t border-white/10 bg-slate-950/80 px-2 py-1.5 backdrop-blur sm:gap-2 sm:px-4">
        <button type="button" onClick={onClose} className={controlButton} aria-label="Salir de la gala">
          <X size={20} aria-hidden="true" />
          <span className="hidden sm:inline">Salir</span>
        </button>

        <ol className="mx-auto hidden items-center gap-1.5 sm:flex" aria-label="Actos">
          {steps.slice(1).map((step, i) => {
            const index = i + 1;
            const isCurrent = index === stepIndex;
            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => stepIndex > 0 && go(index, true)}
                  disabled={stepIndex === 0}
                  aria-label={`Ir a: ${STEP_LABEL[step]}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  title={STEP_LABEL[step]}
                  className="flex h-9 w-5 items-center justify-center disabled:cursor-default"
                >
                  <span className={`block rounded-full transition-all ${isCurrent ? 'h-2.5 w-2.5 bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.9)]' : index < stepIndex ? 'h-2 w-2 bg-white/70' : 'h-2 w-2 bg-white/30'}`} />
                </button>
              </li>
            );
          })}
        </ol>

        <button type="button" onClick={toggleMute} className={`${controlButton} ml-auto sm:ml-0`} aria-label={muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={muted} title="Sonido (M)">
          {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        </button>
        <button type="button" onClick={toggleFullscreen} className={controlButton} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa (F)">
          {isFullscreen ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}
        </button>
        {current !== 'setup' && (
          <>
            <button type="button" onClick={prev} disabled={stepIndex <= 1} className={controlButton} aria-label="Acto anterior">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" onClick={next} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-amber-300 px-4 text-sm font-black text-amber-950 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
              {isLast ? 'Terminar' : place !== undefined && phase === 'drum' ? 'Revelar' : 'Siguiente'}
              {!isLast && <ChevronRight size={18} aria-hidden="true" />}
            </button>
          </>
        )}
      </nav>
    </div>,
    document.body,
  );
};
