import { Star } from 'lucide-react';
import { regionTotal, teamTotal, type ConquistaState, type Region, type Team } from './conquistaLogic';

/** Marcador: estrellas de cada equipo (sin puestos durante la partida; el podio va en la Bitácora). */
export const TeamScoreboard = ({ state, highlight = [] }: { state: ConquistaState; highlight?: string[] }) => (
  <ul className="flex w-full flex-wrap justify-center gap-2" aria-label="Estrellas por equipo">
    {state.teams.map((team) => (
      <li
        key={team.id}
        className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-1.5 ${highlight.includes(team.id) ? 'ring-4 ring-amber-300' : ''}`}
        style={{ borderColor: team.color, backgroundColor: `${team.color}26` }}
      >
        <span className="text-[clamp(22px,3.4vh,40px)]" aria-hidden="true">{team.emblem}</span>
        <span className="text-[clamp(16px,2.6vh,30px)] font-bold text-white">{team.name}</span>
        <span className="inline-flex items-center gap-1 text-[clamp(18px,3vh,34px)] font-black text-amber-200">
          <Star className="h-[0.9em] w-[0.9em] fill-amber-300 text-amber-300" aria-hidden="true" />
          {teamTotal(state, team.id)}
        </span>
      </li>
    ))}
  </ul>
);

const teamById = (teams: Team[], id: string) => teams.find((t) => t.id === id);

interface RegionTileProps {
  region: Region;
  teams: Team[];
  onPick?: () => void;
  active?: boolean;
}

/** Región del cielo: la Niebla se aclara con las estrellas; la barra muestra quién aportó. */
const RegionTile = ({ region, teams, onPick, active }: RegionTileProps) => {
  const total = regionTotal(region);
  const progress = Math.min(1, total / region.goal);
  const conquerors = region.conquerors.map((id) => teamById(teams, id)).filter((t): t is Team => !!t);
  const border = conquerors[0]?.color ?? (active ? '#fcd34d' : 'rgba(255,255,255,0.18)');
  const content = (
    <>
      {/* Niebla: capa gris que se desvanece con el progreso (solo opacidad). */}
      {!region.cleared && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-slate-500/60 via-slate-400/50 to-slate-500/60"
          style={{ opacity: 1 - progress }}
          aria-hidden="true"
        />
      )}
      <span className="relative flex h-full flex-col justify-between gap-2">
        <span>
          <span className="block text-[clamp(20px,3.2vh,38px)] font-black leading-tight text-white">{region.name}</span>
          <span className="block text-[clamp(14px,2vh,22px)] font-semibold text-indigo-100">{region.subtitle}</span>
        </span>
        <span>
          {/* Aporte por equipo (barra apilada) */}
          <span className="flex h-3 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            {teams.map((t) => {
              const n = region.stars[t.id] ?? 0;
              return n > 0 ? <span key={t.id} style={{ width: `${(n / region.goal) * 100}%`, backgroundColor: t.color }} /> : null;
            })}
            {region.neutral > 0 && <span className="bg-amber-200" style={{ width: `${(region.neutral / region.goal) * 100}%` }} />}
          </span>
          <span className="mt-1 block text-[clamp(16px,2.4vh,28px)] font-bold text-amber-100">
            {region.cleared
              ? `Conquistada por ${conquerors.map((t) => `${t.emblem} ${t.name}`).join(' y ') || 'la clase'}`
              : `${Math.min(total, region.goal)} de ${region.goal} ⭐`}
          </span>
        </span>
      </span>
    </>
  );
  const className = 'relative min-h-[18vh] rounded-3xl border-4 p-4 text-left transition-transform';
  const style = { borderColor: border, backgroundColor: conquerors[0] ? `${conquerors[0].color}33` : '#121a3d' };
  if (onPick && !region.cleared) {
    return (
      <button type="button" onClick={onPick} className={`${className} hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300`} style={style}>
        {content}
      </button>
    );
  }
  return <div className={className} style={style}>{content}</div>;
};

interface SkyMapProps {
  state: ConquistaState;
  onPick?: (regionId: string) => void;
  activeRegionId?: string | null;
}

export const SkyMap = ({ state, onPick, activeRegionId }: SkyMapProps) => (
  <div className={`grid w-full gap-3 ${state.regions.length > 4 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
    {state.regions.map((region) => (
      <RegionTile
        key={region.id}
        region={region}
        teams={state.teams}
        active={region.id === activeRegionId}
        onPick={onPick ? () => onPick(region.id) : undefined}
      />
    ))}
  </div>
);
