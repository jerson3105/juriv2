import { useQuery } from '@tanstack/react-query';
import { Gift, Swords } from 'lucide-react';
import { storyApi, type StoryChapter } from '../../lib/storyApi';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { chapterReward, chapterRewardResult } from './storyEditorHelpers';

// Recompensa del capítulo: lo configurado (por venir / en curso) o lo entregado (completado).
export const ChapterRewardChips = ({ chapter }: { chapter: StoryChapter }) => {
  const result = chapter.status === 'COMPLETED' ? chapterRewardResult(chapter) : null;
  const config = chapterReward(chapter);
  const chips = result
    ? [
        result.badge ? `${result.badge.icon} ${result.badge.name} (${result.badge.awarded})` : null,
        result.xp ? `+${result.xp} XP` : null,
        result.gp ? `+${result.gp} oro` : null,
        result.card ? `🃏 ${result.card.name} (${result.card.granted})` : null,
        result.winningClan ? `${CLAN_EMBLEMS[result.winningClan.emblem] || '🛡️'} Ganó ${result.winningClan.name}${result.winningClan.prizeGp ? ` (+${result.winningClan.prizeGp} oro c/u)` : ''}` : null,
      ]
    : [
        config?.badgeId ? '🏅 Insignia' : null,
        config?.xp ? `+${config.xp} XP` : null,
        config?.gp ? `+${config.gp} oro` : null,
        config?.cardId ? '🃏 Figurita' : null,
        config?.clanPrize?.mode === 'GP' ? `Clan ganador: +${config.clanPrize.gp ?? 0} oro c/u` : null,
      ];
  const visible = chips.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-100">
        <Gift size={14} aria-hidden="true" /> {result ? `Entregado a ${result.participants}:` : 'Recompensa:'}
      </span>
      {visible.map((chip) => (
        <span key={chip} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">{chip}</span>
      ))}
    </p>
  );
};

// Clanes como facciones: cuánto aporta cada clan al capítulo en curso.
export const FactionStandings = ({ chapterId }: { chapterId: string }) => {
  const { data } = useQuery({
    queryKey: ['chapter-factions', chapterId],
    queryFn: () => storyApi.getChapterFactions(chapterId),
    staleTime: 30_000,
  });
  if (!data || data.clans.length === 0) return null;
  const top = Math.max(1, ...data.clans.map((c) => c.xp));
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
        <Swords size={16} aria-hidden="true" /> Carrera de clanes · {data.participants} alumno{data.participants === 1 ? '' : 's'} aportando
      </p>
      <ol className="space-y-1.5">
        {data.clans.map((clan, i) => (
          <li key={clan.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right font-bold tabular-nums text-gray-800 dark:text-gray-100">{i + 1}</span>
            <span className="w-28 truncate text-gray-900 dark:text-white"><span aria-hidden="true">{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span> {clan.name}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
              <span className="block h-full rounded-full" style={{ width: `${Math.max((clan.xp / top) * 100, clan.xp > 0 ? 4 : 0)}%`, backgroundColor: clan.color }} />
            </span>
            <span className="w-16 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{clan.xp} XP</span>
          </li>
        ))}
      </ol>
    </div>
  );
};
