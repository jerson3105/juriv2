import { Heart, Moon } from 'lucide-react';
import { clanVars } from '../../lib/storyTheme';
import type { AttendanceMark, EnergyState } from './studentsHelpers';

/** Estrella de hoy (solo para el profe): encendida = recibió algo hoy; punto apagado = aún no. */
export const TodayStar = ({ lit, label }: { lit: boolean; label: string }) => (
  <span className="pg-star" data-lit={lit} role="img" aria-label={label} title={label} />
);

/**
 * Lo excepcional de un alumno, en texto (nunca solo color): descansa, energía baja, ausente o tarde.
 * Quien lo usa no lo pinta al proyectar. `compact`: solo íconos con número (lista de la ficha).
 */
export const ExceptionTags = ({ energy, hp, attendance, compact = false }: { energy: EnergyState; hp: number; attendance: AttendanceMark; compact?: boolean }) => {
  if (!energy && !attendance) return null;
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-2 text-xs font-semibold">
      {energy === 'resting' && (
        <span className="inline-flex items-center gap-1 pg-fix" title="Descansando: sin energía">
          <Moon size={12} className="fill-current" aria-hidden="true" />
          {compact ? <span className="sr-only">Descansando</span> : 'Descansando'}
        </span>
      )}
      {energy === 'low' && (
        <span className="inline-flex items-center gap-0.5 pg-alert" title={`Energía baja: ${hp}`}>
          <Heart size={12} className="fill-current" aria-hidden="true" />
          <span className="sr-only">Energía baja:</span> {hp}
        </span>
      )}
      {attendance && <span className="pg-fg2">{attendance === 'absent' ? 'Ausente' : 'Tarde'}</span>}
    </span>
  );
};

/** Clan en una fila: franja de su color y nombre en tinta neutra (sin texto blanco sobre el color). */
export const ClanTag = ({ name, color }: { name: string; color: string | null | undefined }) => (
  <span className="inline-flex min-w-0 items-center gap-1.5 text-sm pg-fg" style={clanVars(color)}>
    <span className="h-4 w-1 flex-shrink-0 rounded-full pg-clan-stripe" aria-hidden="true" />
    <span className="truncate">{name}</span>
  </span>
);
