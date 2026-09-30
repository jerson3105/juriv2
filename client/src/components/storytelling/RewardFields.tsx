import { useQuery } from '@tanstack/react-query';
import { badgeApi } from '../../lib/badgeApi';
import { collectibleApi } from '../../lib/collectibleApi';
import type { StoryRewardConfig } from '../../lib/storyApi';
import { inputClass, labelClass } from '../home/homeHelpers';

interface RewardFieldsProps {
  classroomId: string;
  clansEnabled: boolean;
  value: StoryRewardConfig;
  disabled?: boolean;
  onChange: (value: StoryRewardConfig) => void;
}

const inlineField = inputClass.replace('w-full ', '');
const PRIZE_OPTIONS = [
  { value: 'NONE', label: 'Sin premio' },
  { value: 'MENTION', label: 'Mención en el cierre' },
  { value: 'GP', label: 'Oro para sus miembros' },
] as const;

// Recompensa al revelar: la reciben quienes aportaron XP durante el capítulo.
export const RewardFields = ({ classroomId, clansEnabled, value, disabled, onChange }: RewardFieldsProps) => {
  const { data: badges = [] } = useQuery({
    queryKey: ['badges', classroomId],
    queryFn: () => badgeApi.getClassroomBadges(classroomId),
  });
  const { data: cards = [] } = useQuery({
    queryKey: ['story-reward-cards', classroomId],
    queryFn: async () => {
      const albums = await collectibleApi.getAlbums(classroomId);
      const full = await Promise.all(albums.map((album) => collectibleApi.getAlbumById(album.id)));
      return full.flatMap((album) => album.cards.map((card) => ({ id: card.id, name: card.name, album: album.name })));
    },
  });
  // Solo insignias que se pueden otorgar a mano (las automáticas se ganan solas).
  const awardable = badges.filter((b) => b.isActive && b.assignmentMode !== 'AUTOMATIC');
  const set = (patch: Partial<StoryRewardConfig>) => onChange({ ...value, ...patch });
  const number = (raw: string) => Math.min(1000, Math.max(0, parseInt(raw, 10) || 0));
  const prize = value.clanPrize?.mode ?? 'MENTION';

  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <legend className={`${labelClass} px-1`}>Recompensa al revelar</legend>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {disabled ? 'Ya se entregó al revelar el final.' : 'La reciben quienes ganaron XP durante el capítulo. Todo es opcional.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="reward-badge" className={labelClass}>Insignia</label>
          <select id="reward-badge" value={value.badgeId ?? ''} onChange={(e) => set({ badgeId: e.target.value || null })} className={`${inputClass} mt-1`}>
            <option value="">Ninguna</option>
            {awardable.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="reward-card" className={labelClass}>Cromo</label>
          <select id="reward-card" value={value.cardId ?? ''} onChange={(e) => set({ cardId: e.target.value || null })} className={`${inputClass} mt-1`} disabled={disabled || cards.length === 0}>
            <option value="">{cards.length === 0 ? 'La clase no tiene álbumes' : 'Ninguno'}</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.album})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="reward-xp" className={labelClass}>XP extra</label>
          <input id="reward-xp" type="number" min={0} max={1000} inputMode="numeric" value={value.xp ?? 0} onChange={(e) => set({ xp: number(e.target.value) })} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="reward-gp" className={labelClass}>Oro extra</label>
          <input id="reward-gp" type="number" min={0} max={1000} inputMode="numeric" value={value.gp ?? 0} onChange={(e) => set({ gp: number(e.target.value) })} className={`${inputClass} mt-1`} />
        </div>
      </div>
      {clansEnabled && (
        <div>
          <p className={labelClass} id="prize-label">Clan que más aportó</p>
          <div role="radiogroup" aria-labelledby="prize-label" className="mt-1 flex flex-wrap items-center gap-2">
            {PRIZE_OPTIONS.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={prize === o.value}
                onClick={() => set({ clanPrize: { mode: o.value, gp: o.value === 'GP' ? value.clanPrize?.gp || 10 : undefined } })}
                className={`min-h-[40px] rounded-xl border-2 px-3 text-sm font-semibold ${prize === o.value ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-800 dark:border-gray-600 dark:text-gray-100'}`}>
                {o.label}
              </button>
            ))}
            {prize === 'GP' && (
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input type="number" min={1} max={1000} inputMode="numeric" aria-label="Oro por miembro" value={value.clanPrize?.gp ?? 10}
                  onChange={(e) => set({ clanPrize: { mode: 'GP', gp: number(e.target.value) } })} className={`${inlineField} w-24`} />
                oro por miembro
              </label>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
};
