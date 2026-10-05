import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { cardText, homeCard } from '../../components/student/home/studentHomeHelpers';
import { groupTitle } from '../../components/student/badges/badgeStudentHelpers';
import { BadgeMedallion } from '../../components/badges/BadgeMedallion';
import { mySeasonsKey, seasonApi, type Season, type SeasonClass } from '../../lib/seasonApi';

// En cada clase se ven las primeras (de la más rara a la más común); el resto, como «+N».
const SHOWN_BADGES = 8;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const Skeleton = () => (
  <div role="status" aria-label="Cargando tus temporadas" className="space-y-3">
    <div className="h-5 w-24 rounded bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    {[0, 1].map((index) => <div key={index} className="h-40 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />)}
  </div>
);

const SeasonClassCard = ({ item }: { item: SeasonClass }) => {
  const badgeTotal = item.badges.reduce((sum, badge) => sum + badge.times, 0);
  const shown = item.badges.slice(0, SHOWN_BADGES);
  const hidden = item.badges.length - shown.length;
  const completed = item.albums.filter((album) => album.completed).length;
  return (
    <li className={homeCard}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-100">
          Nivel {item.level}
        </span>
      </div>

      <p className={`mt-3 ${cardText}`}>
        {badgeTotal > 0 ? plural(badgeTotal, 'insignia', 'insignias') : 'Sin insignias en esta clase'}
      </p>
      {shown.length > 0 && (
        <ul className="mt-2 flex flex-wrap items-center gap-2" aria-label="Insignias">
          {shown.map((badge) => {
            const label = badge.times > 1 ? `${badge.name} (×${badge.times})` : badge.name;
            return (
              <li key={badge.id} title={label} className="relative">
                <BadgeMedallion badge={badge} size="sm" animated={false} />
                {badge.times > 1 && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-gray-900 px-1.5 text-xs font-bold text-white dark:bg-white dark:text-gray-900" aria-hidden="true">
                    ×{badge.times}
                  </span>
                )}
                <span className="sr-only">{label}</span>
              </li>
            );
          })}
          {hidden > 0 && (
            <li className="flex h-12 min-w-[3rem] items-center justify-center rounded-full bg-gray-100 px-2 text-sm font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              +{hidden}
            </li>
          )}
        </ul>
      )}

      {item.albums.length > 0 && (
        <>
          <p className={`mt-4 ${cardText}`}>
            {[completed > 0 ? plural(completed, 'álbum completo', 'álbumes completos') : null, plural(item.cards, 'carta reunida', 'cartas reunidas')]
              .filter(Boolean).join(' · ')}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Álbumes">
            {item.albums.map((album) => (
              <li
                key={album.id}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${album.completed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100'
                  : 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-100'}`}
              >
                {album.completed && <Check size={14} aria-hidden="true" />}
                <span className="max-w-[14rem] truncate" title={album.name}>{album.name}</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-300">
                  {album.completed ? <span className="sr-only">completo, </span> : null}{album.owned}/{album.total}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
};

const SeasonSection = ({ season }: { season: Season }) => {
  const badges = season.classes.reduce((sum, item) => sum + item.badges.reduce((total, badge) => total + badge.times, 0), 0);
  const albums = season.classes.reduce((sum, item) => sum + item.albums.filter((album) => album.completed).length, 0);
  const titleId = `season-${season.yearId}`;
  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div>
        <h2 id={titleId} className="text-xl font-black text-gray-900 dark:text-white">{season.year}</h2>
        <p className={groupTitle}>
          {[season.school, plural(season.classes.length, 'clase', 'clases'), badges > 0 ? plural(badges, 'insignia', 'insignias') : null,
            albums > 0 ? plural(albums, 'álbum completo', 'álbumes completos') : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {season.classes.map((item) => <SeasonClassCard key={item.classroomId} item={item} />)}
      </ul>
    </section>
  );
};

/**
 * «Mis temporadas»: lo que lograste en cada clase de los años escolares que ya cerraron (tu nivel, tus insignias, tus
 * álbumes y cartas). Sin puestos ni oro. Se ve también en vacaciones, cuando aún no tienes clases.
 */
export const StudentSeasonsPage = () => {
  const query = useQuery({ queryKey: mySeasonsKey, queryFn: seasonApi.mine, staleTime: 5 * 60 * 1000 });
  const header = <StudentPageHeader title="Mis temporadas" subtitle="Lo que lograste en cada año escolar" emoji="🏆" storyAccent={null} />;
  const seasons = query.data;

  return (
    <div className="space-y-6">
      {header}
      {query.isLoading ? (
        <Skeleton />
      ) : query.isError || !seasons ? (
        <ErrorCard text="No pudimos cargar tus temporadas." onRetry={() => void query.refetch()} />
      ) : seasons.length === 0 ? (
        <HomeEmptyState
          emojis={['📅', '🏆', '✨']}
          title="Aún no tienes temporadas"
          text="Cuando tu colegio cierre el año escolar, aquí verás tu nivel, tus insignias y tus álbumes de cada clase."
          primary={{ to: '/my-class', label: 'Volver al inicio' }}
        />
      ) : (
        seasons.map((season) => <SeasonSection key={season.yearId} season={season} />)
      )}
    </div>
  );
};
