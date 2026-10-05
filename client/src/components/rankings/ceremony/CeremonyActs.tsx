import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { useCountUp } from '../../../hooks/useCountUp';
import { MovementChip } from '../RankingList';
import { classIcon, formatNumber, type ClassMap, type DayStars, type RankRow } from '../rankingHelpers';

// «Temporada»: la del año que termina (cifras, reconocimientos que no compiten y desfile), sin podio.
export type CeremonyMode = 'today' | 'total' | 'season';

export const ActTitle = ({ kicker, title }: { kicker?: string; title: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 text-center"
    >
      {kicker && <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">{kicker}</p>}
      <h2 className="mt-1 text-3xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:text-5xl">{title}</h2>
    </motion.header>
  );
};

// ── Preparación: qué se premia y sonido ─────────────────────────────────────
interface SetupActProps {
  classroomName: string;
  mode: CeremonyMode;
  onMode: (mode: CeremonyMode) => void;
  todayScorers: number;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
}

export const SetupAct = ({ classroomName, mode, onMode, todayScorers, muted, onToggleMute, onStart }: SetupActProps) => {
  const options: { id: CeremonyMode; title: string; text: string; disabled?: boolean }[] = [
    {
      id: 'today',
      title: 'Lo ganado hoy',
      text: todayScorers > 0 ? `Todos parten de cero. ${todayScorers} ${todayScorers === 1 ? 'estudiante sumó' : 'estudiantes sumaron'} hoy.` : 'Hoy aún no se han dado puntos.',
      disabled: todayScorers === 0,
    },
    { id: 'total', title: 'XP total', text: 'La clasificación de siempre, con quién escaló hoy.' },
    { id: 'season', title: 'Temporada', text: 'Cifras del año, reconocimientos y el desfile de cada estudiante. Sin podio.' },
  ];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">{classroomName}</p>
      <h2 className="mt-2 text-4xl font-black text-white sm:text-6xl">Gala de cierre</h2>
      <p className="mt-2 text-indigo-100">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <fieldset className="mt-8 w-full">
        <legend className="mb-3 text-sm font-bold text-indigo-100">¿Qué premiamos hoy?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => onMode(opt.id)}
              aria-pressed={mode === opt.id}
              className={`rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${mode === opt.id ? 'border-amber-300 bg-amber-300/15' : 'border-white/20 bg-white/5 hover:border-white/40'}`}
            >
              <span className="block text-lg font-black text-white">{opt.title}</span>
              <span className="mt-1 block text-sm text-indigo-100">{opt.text}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" onClick={onToggleMute} aria-pressed={!muted} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-indigo-100 hover:bg-white/10">
        {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        {muted ? 'Sonido desactivado' : 'Sonido activado'}
      </button>

      <button
        type="button"
        onClick={onStart}
        autoFocus
        className="mt-4 inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 px-10 text-lg font-black text-amber-950 shadow-[0_0_40px_rgba(252,211,77,0.45)] hover:from-amber-100 hover:to-amber-300"
      >
        <Sparkles size={20} aria-hidden="true" />
        Comenzar la gala
      </button>
      <p className="mt-3 text-sm text-indigo-100">Espacio o → para avanzar · ← para volver · Esc para salir</p>
    </div>
  );
};

// ── Apertura: cifras de la clase ────────────────────────────────────────────
const StatTile = ({ label, value, delay }: { label: string; value: number; delay: number }) => {
  const reduce = useReducedMotion();
  const shown = useCountUp(value, 1400, delay * 1000);
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay }}
      className="rounded-3xl border border-white/15 bg-white/10 px-6 py-5 text-center backdrop-blur"
    >
      <p className="text-4xl font-black tabular-nums text-amber-300 sm:text-6xl">{formatNumber(shown)}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-wide text-indigo-100">{label}</p>
    </motion.div>
  );
};

export const OpeningAct = ({ stats, title = '¡Resultados de la clase!' }: { stats: { label: string; value: number }[]; title?: string }) => {
  const reduce = useReducedMotion();
  return (
    <div className="flex w-full flex-col items-center">
      <motion.h2
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="text-center text-4xl font-black text-white drop-shadow-[0_6px_30px_rgba(252,211,77,0.35)] sm:text-7xl"
      >
        {title}
      </motion.h2>
      <div className={`mt-10 grid w-full max-w-4xl gap-4 ${stats.length === 3 ? 'sm:grid-cols-3' : stats.length === 2 ? 'sm:grid-cols-2' : ''}`}>
        {stats.map((s, i) => <StatTile key={s.label} label={s.label} value={s.value} delay={0.5 + i * 0.25} />)}
      </div>
    </div>
  );
};

// ── Premios especiales ──────────────────────────────────────────────────────
export const AwardsAct = ({ stars, mode }: { stars: DayStars; mode: CeremonyMode }) => {
  const reduce = useReducedMotion();
  const cards = [
    stars.climber && { key: 'climb', icon: '🚀', title: 'Gran escalada', who: stars.climber.row.name, detail: `Subió ${stars.climber.places} ${stars.climber.places === 1 ? 'puesto' : 'puestos'} en el ranking general`, studentId: stars.climber.row.student.id, gender: stars.climber.row.student.avatarGender },
    mode === 'total' && stars.xp && { key: 'xp', icon: '⚡', title: 'Más XP hoy', who: stars.xp.name, detail: `+${formatNumber(stars.xp.amount)} XP en la clase de hoy`, studentId: stars.xp.student.id, gender: stars.xp.student.avatarGender },
    stars.gold && { key: 'gold', icon: '🪙', title: 'Mina de oro', who: stars.gold.name, detail: `+${formatNumber(stars.gold.amount)} de oro hoy`, studentId: stars.gold.student.id, gender: stars.gold.student.avatarGender },
    stars.clan && { key: 'clan', icon: CLAN_EMBLEMS[stars.clan.clan.emblem] || '🛡️', title: 'Clan del día', who: stars.clan.clan.name, detail: `+${formatNumber(stars.clan.amount)} XP para el clan`, color: stars.clan.clan.color },
  ].filter(Boolean) as { key: string; icon: string; title: string; who: string; detail: string; studentId?: string; gender?: 'MALE' | 'FEMALE'; color?: string }[];

  return (
    <div className="w-full">
      <ActTitle kicker="Antes del podio" title="Premios especiales" />
      <ul className={`mx-auto grid gap-4 sm:grid-cols-2 ${cards.length === 3 ? 'max-w-5xl lg:grid-cols-3' : 'max-w-4xl'}`} style={{ perspective: 1000 }}>
        {cards.map((card, i) => (
          <motion.li
            key={card.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.4 + i * 0.7, duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-4 rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-indigo-900/90 to-slate-900/90 p-4 shadow-[0_0_30px_rgba(252,211,77,0.15)]"
          >
            {card.studentId ? (
              <span className="flex h-28 w-16 flex-shrink-0 items-end justify-center" aria-hidden="true">
                <StudentAvatarMini studentProfileId={card.studentId} gender={card.gender ?? 'MALE'} size="sm" />
              </span>
            ) : (
              <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-5xl shadow-lg" style={{ backgroundColor: card.color }} aria-hidden="true">{card.icon}</span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-wide text-amber-300"><span aria-hidden="true">{card.icon} </span>{card.title}</p>
              <p className="truncate text-2xl font-black text-white" title={card.who}>{card.who}</p>
              <p className="text-sm text-indigo-100">{card.detail}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

// ── Cuenta atrás: del 10.º al 4.º ───────────────────────────────────────────
export const CeremonyRow = ({ row, classMap, unit, plus, highlight = false }: { row: RankRow; classMap: ClassMap; unit: string; plus: boolean; highlight?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${highlight ? 'border-amber-300/70 bg-amber-300/10' : 'border-white/10 bg-white/[0.07]'}`}>
    <span className="w-9 flex-shrink-0 text-center text-xl font-black tabular-nums text-amber-200">{row.rank}</span>
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-lg" aria-hidden="true">{classIcon(row, classMap)}</span>
    <span className="min-w-0 flex-1 truncate text-lg font-bold text-white" title={row.name}>{row.name}</span>
    <MovementChip movement={row.movement && row.movement > 0 ? row.movement : null} onDark />
    <span className="flex-shrink-0 text-lg font-black tabular-nums text-white">
      {plus && row.value > 0 ? '+' : ''}{formatNumber(row.value)} <span className="text-sm font-bold text-indigo-100">{unit}</span>
    </span>
  </div>
);

export const CountdownAct = ({ rows, hiddenTies, shown, classMap, unit, plus }: { rows: RankRow[]; hiddenTies: number; shown: number; classMap: ClassMap; unit: string; plus: boolean }) => {
  const reduce = useReducedMotion();
  const first = rows[0]?.rank ?? 4;
  const last = rows[rows.length - 1]?.rank ?? first;
  const twoColumns = rows.length > 7;
  return (
    <div className="w-full">
      <ActTitle kicker="Cuenta atrás" title={first === last ? `Empate en el ${first}.º puesto` : `Del ${last}.º al ${first}.º`} />
      <ol className={`mx-auto grid gap-2 ${twoColumns ? 'max-w-6xl md:grid-cols-2' : 'max-w-3xl'}`}>
        {rows.map((row, i) => {
          // Se revelan desde el último (abajo) hacia el 4.º (arriba).
          const visible = rows.length - i <= shown;
          return (
            <li key={row.student.id} className="min-h-[52px]">
              {visible && (
                <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
                  <CeremonyRow row={row} classMap={classMap} unit={unit} plus={plus} />
                </motion.div>
              )}
            </li>
          );
        })}
      </ol>
      {hiddenTies > 0 && shown >= rows.length && (
        <p className="mt-3 text-center text-sm font-semibold text-indigo-100">…y {hiddenTies} más empatados: los verás en la clasificación completa.</p>
      )}
    </div>
  );
};
