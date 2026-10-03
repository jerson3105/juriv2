import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Maximize2, Minimize2, SkipForward, Volume2, VolumeX, Vote, X, Trophy, CalendarDays, Sparkles, Heart, Loader2 } from 'lucide-react';
import { storyApi, type ChapterRecap, type SceneDialogue, type StoryRewardResult, type StoryScene } from '../../lib/storyApi';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { createCeremonySound, readMuted, saveMuted, type CeremonySound } from '../rankings/ceremony/ceremonySound';
import { emotionOf, playableDecision, youTubeId, type PlayableDecision, type PlayerItem } from './storyPlayerHelpers';

interface StoryPlayerProps {
  items: PlayerItem[];
  accent: StoryAccent | null;
  // Modo proyector (profesor): letra grande, pantalla completa y sonido de la revelación.
  projector?: boolean;
  label?: string;
  onSceneSeen?: (sceneId: string) => void;
  // Alumno: vota en las escenas de decisión (devuelve su voto guardado).
  onVote?: (sceneId: string, optionId: string) => Promise<string | null>;
  // Profesor en el proyector: votos en vivo de las decisiones abiertas.
  liveVotes?: boolean;
  onClose: () => void;
}

const FALLBACK_BG = 'linear-gradient(135deg, #1e1b4b, #312e81)';

// Novela visual: ilustración a pantalla completa, diálogo abajo con la placa del personaje.
// Teclado: → / Espacio / Enter avanza, ← retrocede, Esc cierra.
export const StoryPlayer = ({ items, accent, projector = false, label, onSceneSeen, onVote, liveVotes = false, onClose }: StoryPlayerProps) => {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  const sound = useRef<CeremonySound | null>(null);

  const [choosing, setChoosing] = useState(false);
  const [votes, setVotes] = useState<Record<string, string | null>>({});

  const current = items[index];
  const scene = current?.kind === 'scene' ? current.scene : null;
  const decision = useMemo(() => (scene?.type === 'DECISION' ? playableDecision(scene.decision) : null), [scene]);
  // Decisión cerrada: tras la escena, lo que eligió la clase y su desenlace.
  const dialogues = useMemo<SceneDialogue[]>(() => {
    const base = scene?.dialogues ?? [];
    if (!scene || !decision || decision.status !== 'CLOSED') return base;
    const winner = decision.options.find((o) => o.id === decision.winnerOptionId);
    return [
      ...base,
      { id: 'decision-result', sceneId: scene.id, orderIndex: base.length, speaker: null, text: `La clase eligió: «${winner?.label ?? ''}»`, emotion: 'excited' },
      ...decision.outcome.map((d, i) => ({ id: `outcome-${i}`, sceneId: scene.id, orderIndex: base.length + 1 + i, speaker: d.speaker ?? null, text: d.text, emotion: d.emotion ?? 'neutral' })),
    ];
  }, [scene, decision]);
  const dialogue = dialogues[line];
  const text = dialogue?.text ?? '';
  const done = reduceMotion || typed >= text.length;

  // Sonido solo en el proyector; el AudioContext nace del clic del profesor que abrió la presentación.
  useEffect(() => {
    if (!projector) return;
    sound.current = createCeremonySound(readMuted());
    sound.current.unlock();
    return () => sound.current?.close();
  }, [projector]);

  // Bloquea el scroll de fondo y devuelve el foco al cerrar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    containerRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) void document.exitFullscreen?.();
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Efecto máquina de escribir (sin él si el usuario pidió reducir movimiento).
  useEffect(() => {
    // El contador vuelve a 0 en los manejadores que cambian de línea (next/goTo), no aquí.
    if (!scene || reduceMotion || !text) return;
    const step = projector ? 2 : 3;
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + step;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [scene, line, text, reduceMotion, projector]);

  useEffect(() => {
    if (!sound.current) return;
    if (current?.kind === 'cover') sound.current.whoosh();
    if (current?.kind === 'recap') sound.current.fanfare();
  }, [current]);

  const markSeen = useCallback((item: PlayerItem | undefined) => {
    if (item?.kind !== 'scene' || seen.current.has(item.scene.id)) return;
    seen.current.add(item.scene.id);
    onSceneSeen?.(item.scene.id);
  }, [onSceneSeen]);

  const close = useCallback(() => {
    markSeen(current);
    sound.current?.stopAll();
    onClose();
  }, [current, markSeen, onClose]);

  const goTo = useCallback((next: number) => {
    if (next >= items.length) {
      onClose();
      return;
    }
    setIndex(Math.max(0, next));
    setLine(0);
    setTyped(0);
    setChoosing(false);
  }, [items.length, onClose]);

  const next = useCallback(() => {
    if (scene) {
      if (!done) {
        setTyped(Number.MAX_SAFE_INTEGER);
        return;
      }
      if (line < dialogues.length - 1) {
        setLine(line + 1);
        setTyped(0);
        return;
      }
      // Decisión abierta: antes de seguir, el panel para votar (o ver los votos).
      if (decision?.status === 'OPEN' && !choosing) {
        setChoosing(true);
        return;
      }
      markSeen(current);
    }
    goTo(index + 1);
  }, [scene, done, line, dialogues.length, decision, choosing, markSeen, current, goTo, index]);

  const previous = useCallback(() => {
    if (choosing) {
      setChoosing(false);
      return;
    }
    if (scene && line > 0) {
      setLine(line - 1);
      setTyped(Number.MAX_SAFE_INTEGER);
      return;
    }
    if (index > 0) goTo(index - 1);
  }, [scene, line, index, goTo, choosing]);

  const skipScene = useCallback(() => {
    markSeen(current);
    goTo(index + 1);
  }, [markSeen, current, goTo, index]);

  useEffect(() => {
    // En captura y sin propagar: si el reproductor se abre sobre un modal (vista previa), Esc solo cierra el reproductor.
    const onKey = (event: KeyboardEvent) => {
      const handle = (action: () => void) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        action();
      };
      if (event.key === 'Escape') return handle(close);
      if (event.key === 'ArrowRight') return handle(next);
      if (event.key === 'ArrowLeft') return handle(previous);
      if (event.key === 'Enter' || event.key === ' ') {
        // Sobre un botón, Enter/Espacio ya lo pulsan: no avanzar dos veces.
        if ((event.target as HTMLElement | null)?.closest('button, a, input, textarea, select')) return;
        handle(next);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, next, previous]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void containerRef.current?.requestFullscreen?.();
  };

  const toggleMute = () => {
    const value = !muted;
    setMuted(value);
    saveMuted(value);
    sound.current?.setMuted(value);
  };

  const backdrop = accent ? `radial-gradient(circle at 30% 20%, ${accent.primary}, ${accent.sidebar} 70%)` : FALLBACK_BG;
  // Numeración dentro del capítulo actual (una secuencia puede abarcar varios capítulos).
  const sameChapter = (item: PlayerItem) => item.kind === 'scene' && (current?.kind !== 'scene' || item.chapterPosition === current.chapterPosition);
  const sceneCount = items.filter(sameChapter).length;
  const sceneNumber = items.slice(0, index + 1).filter(sameChapter).length;
  const iconButton = 'flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

  if (!current) return null;

  return createPortal(
    <motion.div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label ?? 'Historia de la clase'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="fixed inset-0 z-[190] overflow-hidden bg-gray-950 text-white outline-none"
    >
      {/* Barra superior */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          {current.kind === 'scene' && sceneCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold">
              {current.chapterPosition ? `Capítulo ${current.chapterPosition} · ` : ''}Escena {sceneNumber} de {sceneCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {projector && (
            <button type="button" onClick={toggleMute} className={iconButton} aria-label={muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={muted}>
              {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
          )}
          {projector && (
            <button type="button" onClick={toggleFullscreen} className={iconButton} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              {fullscreen ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}
            </button>
          )}
          {current.kind === 'scene' && (
            <button type="button" onClick={skipScene} className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-black/60 px-4 text-sm font-semibold hover:bg-black/80">
              <SkipForward size={16} aria-hidden="true" /> Saltar escena
            </button>
          )}
          <button type="button" onClick={close} className={iconButton} aria-label="Cerrar historia">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {current.kind === 'cover' && (
        <CoverView key={current.key} item={current} backdrop={backdrop} emoji={accent?.emoji ?? '📖'} projector={projector} onStart={next} />
      )}

      {current.kind === 'recap' && (
        <RecapView key={current.key} chapterId={current.chapterId} backdrop={backdrop} projector={projector} reduceMotion={!!reduceMotion} onDone={() => goTo(index + 1)} isLast={index === items.length - 1} />
      )}

      {scene && (
        <SceneView
          key={current.key}
          scene={{ ...scene, dialogues }}
          hideDialogue={choosing}
          backdrop={backdrop}
          emoji={accent?.emoji ?? '📖'}
          projector={projector}
          line={line}
          text={text}
          typed={done ? text.length : typed}
          done={done}
          onNext={next}
          onPrevious={previous}
          canGoBack={line > 0 || index > 0}
          isLastLine={line >= dialogues.length - 1}
          isLastItem={index === items.length - 1}
        />
      )}
      {scene && decision && choosing && (
        <DecisionPanel
          sceneId={scene.id}
          decision={decision}
          myVote={votes[scene.id] !== undefined ? votes[scene.id] : decision.myVote}
          projector={projector}
          liveVotes={liveVotes && !scene.id.startsWith('preview')}
          onVote={onVote ? async (optionId) => {
            const saved = await onVote(scene.id, optionId);
            setVotes((prev) => ({ ...prev, [scene.id]: saved }));
          } : undefined}
          onContinue={next}
        />
      )}
    </motion.div>,
    document.body,
  );
};

// ---------- Decisión: votar o ver los votos ----------

const DecisionPanel = ({ sceneId, decision, myVote, projector, liveVotes, onVote, onContinue }: {
  sceneId: string;
  decision: PlayableDecision;
  myVote: string | null;
  projector: boolean;
  liveVotes: boolean;
  onVote?: (optionId: string) => Promise<void>;
  onContinue: () => void;
}) => {
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: results } = useQuery({
    queryKey: ['decision-results', sceneId],
    queryFn: () => storyApi.getDecisionResults(sceneId),
    enabled: liveVotes,
    refetchInterval: liveVotes ? 4000 : false,
  });
  const votesOf = (id: string) => results?.options.find((o) => o.id === id)?.votes ?? 0;
  const top = Math.max(1, ...(results?.options.map((o) => o.votes) ?? [1]));

  const choose = async (optionId: string) => {
    if (!onVote || sending) return;
    setSending(optionId);
    setError(null);
    try {
      await onVote(optionId);
    } catch {
      setError('No se pudo guardar tu voto. Intenta de nuevo.');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 sm:px-6 sm:pb-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby="decision-question"
        className={`mx-auto w-full rounded-2xl border border-white/15 bg-gray-950/90 p-4 shadow-2xl backdrop-blur-md sm:p-6 ${projector ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-200"><Vote size={16} aria-hidden="true" /> La clase decide</p>
        <h2 id="decision-question" className={`mt-1 font-black text-white ${projector ? 'text-3xl' : 'text-xl'}`}>{decision.question}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {decision.options.map((option) => {
            const chosen = myVote === option.id;
            const votes = votesOf(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => choose(option.id)}
                  disabled={!onVote || !!sending}
                  aria-pressed={onVote ? chosen : undefined}
                  className={`relative flex min-h-[56px] w-full items-center gap-3 overflow-hidden rounded-xl border-2 px-4 text-left font-semibold text-white ${chosen ? 'border-amber-300 bg-amber-300/15' : 'border-white/25 bg-white/5'} ${onVote ? 'hover:border-white/60' : 'cursor-default'} ${projector ? 'text-xl' : 'text-base'}`}
                >
                  {liveVotes && <span className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${(votes / top) * 100}%` }} aria-hidden="true" />}
                  <span className="relative flex-1">{option.label}</span>
                  {sending === option.id && <Loader2 size={18} className="relative animate-spin" aria-hidden="true" />}
                  {chosen && <Check size={20} className="relative text-amber-300" aria-label="Tu voto" />}
                  {liveVotes && <span className="relative tabular-nums">{votes}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={`mt-3 text-white/90 ${projector ? 'text-lg' : 'text-sm'}`} aria-live="polite">
          {error ?? (onVote
            ? myVote ? 'Voto guardado. Puedes cambiarlo hasta que tu profe cierre la votación.' : 'Elige una opción: gana la más votada por la clase.'
            : liveVotes ? `${results?.total ?? 0} de ${results?.eligible ?? 0} alumnos ya votaron.` : 'Los alumnos votan desde Mi Historia; tú cierras la votación en el editor.')}
        </p>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onContinue} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-gray-900 hover:bg-gray-100">
            Continuar <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </motion.section>
    </div>
  );
};

// ---------- Portada del capítulo ----------

const CoverView = ({ item, backdrop, emoji, projector, onStart }: {
  item: Extract<PlayerItem, { kind: 'cover' }>;
  backdrop: string;
  emoji: string;
  projector: boolean;
  onStart: () => void;
}) => (
  <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: backdrop }}>
    <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
    <div className="relative max-w-3xl text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: 'backOut' }} className={projector ? 'text-7xl' : 'text-6xl'} aria-hidden="true">
        {emoji}
      </motion.div>
      {item.storyTitle && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-white/90">
          {item.storyTitle}
        </motion.p>
      )}
      <motion.p initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.3em' }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-2 text-base font-bold uppercase text-amber-200">
        Capítulo {item.position}
      </motion.p>
      <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }} className={`mt-3 font-black leading-tight ${projector ? 'text-5xl md:text-7xl' : 'text-4xl md:text-5xl'}`}>
        {item.title}
      </motion.h2>
      {item.description && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className={`mx-auto mt-4 max-w-2xl text-white/90 ${projector ? 'text-2xl' : 'text-lg'}`}>
          {item.description}
        </motion.p>
      )}
      <motion.button
        type="button"
        onClick={onStart}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-7 text-base font-bold text-gray-900 hover:bg-gray-100"
      >
        Comenzar <ChevronRight size={18} aria-hidden="true" />
      </motion.button>
    </div>
  </div>
);

// ---------- Escena ----------

interface SceneViewProps {
  scene: StoryScene;
  hideDialogue?: boolean;
  backdrop: string;
  emoji: string;
  projector: boolean;
  line: number;
  text: string;
  typed: number;
  done: boolean;
  onNext: () => void;
  onPrevious: () => void;
  canGoBack: boolean;
  isLastLine: boolean;
  isLastItem: boolean;
}

const SceneView = ({ scene, hideDialogue, backdrop, emoji, projector, line, text, typed, done, onNext, onPrevious, canGoBack, isLastLine, isLastItem }: SceneViewProps) => {
  const dialogues = scene.dialogues ?? [];
  const dialogue = dialogues[line];
  const emotion = emotionOf(dialogue?.emotion);
  const videoId = scene.mediaType === 'VIDEO' && scene.mediaUrl ? youTubeId(scene.mediaUrl) : null;
  const image = scene.mediaType === 'IMAGE' && scene.mediaUrl ? scene.mediaUrl : null;
  const [imageFailed, setImageFailed] = useState(false);
  const nextLabel = !done ? 'Mostrar todo' : !isLastLine || dialogues.length === 0 ? (dialogues.length === 0 && isLastItem ? 'Terminar' : 'Siguiente') : isLastItem ? 'Terminar' : 'Continuar';

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Fondo: ilustración a pantalla completa o el degradado del tema */}
      <div className="absolute inset-0 overflow-hidden" style={{ background: scene.backgroundColor || backdrop }} aria-hidden="true">
        {image && !imageFailed ? (
          <img src={image} alt="" onError={() => setImageFailed(true)} className="story-kenburns h-full w-full object-cover" />
        ) : !videoId ? (
          <div className="flex h-full items-center justify-center text-[40vmin] opacity-15">{emoji}</div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
      </div>

      {/* Video centrado (YouTube) */}
      <div className="relative flex flex-1 items-center justify-center px-4 pt-20">
        {videoId && (
          <div className={`relative aspect-video w-full overflow-hidden rounded-2xl shadow-2xl ${projector ? 'max-w-5xl' : 'max-w-3xl'}`}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video de la escena"
            />
          </div>
        )}
      </div>

      {/* Caja de diálogo */}
      <div className={`relative px-3 pb-3 sm:px-6 sm:pb-6 ${hideDialogue ? 'invisible' : ''}`} aria-hidden={hideDialogue || undefined}>
        <div className={`mx-auto w-full ${projector ? 'max-w-5xl' : 'max-w-3xl'}`}>
          {dialogues.length > 0 ? (
            <div
              className="relative cursor-pointer rounded-2xl border border-white/15 bg-gray-950/85 p-4 shadow-2xl backdrop-blur-md sm:p-6"
              onClick={onNext}
            >
              {dialogue?.speaker && (
                <motion.div key={`speaker-${line}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="absolute -top-5 left-4 flex items-center gap-2">
                  <span
                    className={`flex items-center justify-center rounded-full font-black text-white ring-2 ring-gray-950 ${projector ? 'h-12 w-12 text-xl' : 'h-10 w-10 text-lg'}`}
                    style={{ backgroundColor: emotion.color }}
                    aria-hidden="true"
                  >
                    {dialogue.speaker.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className={`rounded-full px-3 py-1 font-bold text-white ${projector ? 'text-lg' : 'text-sm'}`} style={{ backgroundColor: emotion.color }}>
                    {dialogue.speaker}
                    <span className="sr-only"> ({emotion.label})</span>
                  </span>
                </motion.div>
              )}
              {/* Texto: el visible se escribe letra a letra; el lector de pantalla recibe la línea completa */}
              <p className={`min-h-[3.5em] whitespace-pre-line leading-relaxed text-white ${dialogue?.speaker ? 'mt-4' : ''} ${projector ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'}`} aria-hidden="true">
                {text.slice(0, typed)}
                {!done && <span className="ml-0.5 inline-block h-[1em] w-2 translate-y-1 animate-pulse bg-white/80" />}
              </p>
              <p className="sr-only" aria-live="polite">{dialogue?.speaker ? `${dialogue.speaker}: ` : ''}{text}</p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  {dialogues.map((d, i) => (
                    <span key={d.id ?? i} className={`h-2 rounded-full transition-all ${i === line ? 'w-6 bg-white' : i < line ? 'w-2 bg-white/70' : 'w-2 bg-white/30'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={onPrevious} disabled={!canGoBack} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40" aria-label="Anterior">
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={onNext} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-gray-900 hover:bg-gray-100">
                    {nextLabel} <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={onNext} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-6 text-base font-bold text-gray-900 hover:bg-gray-100">
                {nextLabel} <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
          <p className="mt-2 hidden text-center text-sm text-white/80 sm:block">Clic, Espacio o → para avanzar · ← para volver · Esc para salir</p>
        </div>
      </div>
    </div>
  );
};

// ---------- Cierre celebrado ----------

const MEDALS = ['🥇', '🥈', '🥉'];

// Resumen de lo entregado al revelar (insignia, XP, oro, figurita).
const rewardLine = (r: StoryRewardResult) => [
  r.badge && r.badge.awarded > 0 ? `${r.badge.icon} ${r.badge.name}` : null,
  r.xp ? `+${r.xp} XP` : null,
  r.gp ? `+${r.gp} de oro` : null,
  r.card ? `🃏 ${r.card.name}` : null,
].filter(Boolean).join(' · ');

const RecapView = ({ chapterId, backdrop, projector, reduceMotion, onDone, isLast }: {
  chapterId: string;
  backdrop: string;
  projector: boolean;
  reduceMotion: boolean;
  onDone: () => void;
  isLast: boolean;
}) => {
  const { data: recap, isLoading, isError } = useQuery({
    queryKey: ['story-recap', chapterId],
    queryFn: () => storyApi.getChapterRecap(chapterId),
    staleTime: 30_000,
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-6 pt-20" style={{ background: backdrop }}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      {!reduceMotion && recap && <Confetti />}
      <div className={`relative w-full text-center ${projector ? 'max-w-4xl' : 'max-w-2xl'}`}>
        {isLoading ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin" aria-label="Cargando resumen" />
        ) : isError || !recap ? (
          <p className="text-lg">No se pudo cargar el resumen del capítulo.</p>
        ) : (
          <RecapContent recap={recap} projector={projector} />
        )}
        <button type="button" onClick={onDone} className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-7 text-base font-bold text-gray-900 hover:bg-gray-100">
          {isLast ? 'Cerrar' : 'Continuar'} <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const RecapContent = ({ recap, projector }: { recap: ChapterRecap; projector: boolean }) => {
  const metric = recap.completionType === 'XP_GOAL'
    ? { icon: <Sparkles size={22} aria-hidden="true" />, value: `${Math.round(recap.progress).toLocaleString('es')} XP`, label: recap.target ? `de ${recap.target.toLocaleString('es')} de meta` : 'reunidos por la clase' }
    : recap.completionType === 'DONATION'
      ? { icon: <Heart size={22} aria-hidden="true" />, value: `${Math.round(recap.progress).toLocaleString('es')} XP`, label: 'donados por la clase' }
      : null;

  return (
    <>
      <motion.div initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-[0_0_40px_rgba(252,211,77,0.6)]">
        <Trophy size={40} aria-hidden="true" />
      </motion.div>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.25em] text-amber-200">Capítulo {recap.position} completado</p>
      <h2 className={`mt-2 font-black leading-tight ${projector ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl'}`}>{recap.title}</h2>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {recap.days !== null && (
          <div className="min-w-[150px] rounded-2xl bg-black/50 px-5 py-3">
            <CalendarDays size={22} className="mx-auto" aria-hidden="true" />
            <p className={`mt-1 font-black ${projector ? 'text-3xl' : 'text-2xl'}`}>{recap.days} {recap.days === 1 ? 'día' : 'días'}</p>
            <p className="text-sm text-white/90">de aventura</p>
          </div>
        )}
        {metric && (
          <div className="min-w-[150px] rounded-2xl bg-black/50 px-5 py-3">
            <span className="mx-auto flex justify-center">{metric.icon}</span>
            <p className={`mt-1 font-black ${projector ? 'text-3xl' : 'text-2xl'}`}>{metric.value}</p>
            <p className="text-sm text-white/90">{metric.label}</p>
          </div>
        )}
      </div>

      {recap.heroes.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold uppercase tracking-widest text-white/90">Héroes del capítulo</p>
          <ol className="mt-3 flex flex-wrap justify-center gap-3">
            {recap.heroes.map((hero, i) => (
              <motion.li key={hero.studentId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.25 }} className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2">
                <span className="text-2xl" aria-hidden="true">{MEDALS[i]}</span>
                <span className={`font-bold ${projector ? 'text-xl' : 'text-base'}`}>{hero.displayName}</span>
                <span className="text-sm text-white/90">{Math.round(hero.xp ?? hero.donated ?? 0)} XP</span>
              </motion.li>
            ))}
          </ol>
        </div>
      )}

      {recap.rewardResult?.winningClan && (
        <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }} className={`mt-6 font-bold text-amber-200 ${projector ? 'text-2xl' : 'text-lg'}`}>
          <span aria-hidden="true">{CLAN_EMBLEMS[recap.rewardResult.winningClan.emblem] || '🛡️'}</span> El clan {recap.rewardResult.winningClan.name} fue el que más aportó ({recap.rewardResult.winningClan.xp} XP)
          {recap.rewardResult.winningClan.prizeGp > 0 && ` · +${recap.rewardResult.winningClan.prizeGp} de oro para cada miembro`}
        </motion.p>
      )}

      {recap.rewardResult && rewardLine(recap.rewardResult) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }} className="mx-auto mt-4 max-w-2xl rounded-2xl bg-black/50 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-widest text-white/90">Recompensa</p>
          <p className={`mt-1 font-semibold text-white ${projector ? 'text-xl' : 'text-base'}`}>{rewardLine(recap.rewardResult)}</p>
          <p className="text-sm text-white/90">Para {recap.rewardResult.participants} {recap.rewardResult.participants === 1 ? 'aventurero que aportó' : 'aventureros que aportaron'} en el capítulo</p>
        </motion.div>
      )}

      <p className={`mt-6 font-semibold text-white ${projector ? 'text-2xl' : 'text-lg'}`}>
        {recap.nextChapterTitle ? `La aventura continúa en «${recap.nextChapterTitle}»` : recap.isLast ? 'Fin de la historia… por ahora' : 'La aventura continúa pronto'}
      </p>
    </>
  );
};

// Confeti de celebración (se omite si el usuario pidió reducir movimiento).
const CONFETTI_COLORS = ['#fcd34d', '#f472b6', '#60a5fa', '#34d399', '#c084fc', '#fb923c'];

const Confetti = () => {
  // Dispersión determinista (render puro): fracción del seno por índice.
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const r = (k: number) => {
      const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      id: i,
      left: r(1) * 100,
      delay: r(2) * 0.6,
      duration: 2.4 + r(3) * 1.6,
      rotate: r(4) * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + r(5) * 6,
    };
  }), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
          initial={{ y: -40, opacity: 1, rotate: 0 }}
          animate={{ y: '105vh', opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
};

export default StoryPlayer;
