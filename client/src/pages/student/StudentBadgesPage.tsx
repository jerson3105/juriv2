import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { studentApi } from '../../lib/studentApi';
import { badgeApi } from '../../lib/badgeApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { isYoungLevel } from '../../components/energy/energyHelpers';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { rowButton } from '../../components/student/home/studentHomeHelpers';
import { BadgeShowcase } from '../../components/student/badges/BadgeShowcase';
import { EarnedTile, SecretTile, ToEarnTile } from '../../components/student/badges/BadgeTiles';
import { BadgeDetailModal, type BadgeDetail } from '../../components/student/badges/BadgeDetailModal';
import { YoungBadges } from '../../components/student/badges/YoungBadges';
import { groupTitle, groupToEarn, myBadgesKey, subTitle } from '../../components/student/badges/badgeStudentHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
type BadgesClassroom = MyClass['classroom'] & { gradeLevel?: string | null };

const FOLD = 6;
const grid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

const Skeleton = () => (
  <div role="status" aria-label="Cargando tus insignias" className="space-y-5">
    <div className="h-36 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className={grid}>
      {[0, 1, 2, 3].map((index) => <div key={index} className="h-48 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />)}
    </div>
  </div>
);

/**
 * «Mis insignias»: un medallero. Tu vitrina (qué tienes y qué te falta poco), lo que ganaste con su
 * porqué, lo que puedes ganar y cómo, y cuántas secretas quedan. Nunca promete lo que no existe y
 * nunca compara con compañeros.
 */
const BadgesContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const classroom = profile.classroom as BadgesClassroom;
  const [detail, setDetail] = useState<BadgeDetail | null>(null);
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({ queryKey: myBadgesKey(profile.id), queryFn: () => badgeApi.getStudentView(profile.id) });
  const view = query.data;

  const header = <StudentPageHeader title="Mis insignias" subtitle={`${classroom.name} · tus logros y cómo ganar más`} emoji="🏅" storyAccent={storyAccent} />;
  if (query.isLoading) return <div className="space-y-5">{header}<Skeleton /></div>;
  if (query.isError || !view) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorCard text="No pudimos cargar tus insignias." onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const young = isYoungLevel(view.gradeLevel ?? classroom.gradeLevel);
  const openEarned = (badgeId: string) => {
    const badge = view.earned.find((item) => item.id === badgeId);
    if (badge) setDetail({ kind: 'earned', badge });
  };
  const openToEarn = (badgeId: string) => {
    const badge = view.toEarn.find((item) => item.id === badgeId);
    if (badge) setDetail({ kind: 'toEarn', badge });
  };
  const showToEarn = () => {
    const section = document.getElementById('puedes-ganar');
    section?.scrollIntoView({ block: 'start' });
    section?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  };

  const nothing = view.earned.length === 0 && view.toEarn.length === 0 && view.secrets === 0;
  const { auto, teacher } = groupToEarn(view.toEarn);
  // Con muchas, se pliega: primero las que se ganan solas, después las del profe.
  const visibleAuto = showAll ? auto : auto.slice(0, FOLD);
  const visibleTeacher = showAll ? teacher : teacher.slice(0, Math.max(0, FOLD - visibleAuto.length));
  const hidden = view.toEarn.length - visibleAuto.length - visibleTeacher.length;

  return (
    <div className="space-y-5">
      {header}

      {nothing ? (
        <HomeEmptyState
          emojis={['🥉', '🏅', '🏆']}
          title="Tu profe aún no crea insignias"
          text="Cuando las cree, aquí verás cómo ganarlas."
          primary={{ to: '/my-progress', label: 'Ver mi progreso' }}
          secondary={{ to: '/my-class', label: 'Volver al inicio' }}
        />
      ) : young ? (
        <YoungBadges view={view} onOpenEarned={openEarned} onOpenToEarn={openToEarn} />
      ) : (
        <>
          <BadgeShowcase view={view} onOpenEarned={openEarned} onOpenToEarn={openToEarn} onShowToEarn={showToEarn} />

          {view.earned.length > 0 && (
            <section aria-labelledby="earned-title">
              <h2 id="earned-title" className={groupTitle}>Ganaste · {view.earned.length}</h2>
              <ul className={`mt-2 ${grid}`}>
                {view.earned.map((badge) => <EarnedTile key={badge.id} badge={badge} onOpen={() => openEarned(badge.id)} />)}
              </ul>
            </section>
          )}

          {view.toEarn.length > 0 && (
            <section id="puedes-ganar" aria-labelledby="to-earn-title" className="scroll-mt-20 space-y-3">
              <h2 id="to-earn-title" tabIndex={-1} className={`${groupTitle} outline-none`}>Puedes ganar · {view.toEarn.length}</h2>
              {visibleAuto.length > 0 && (
                <div>
                  <h3 className={subTitle}>Se ganan solas</h3>
                  <ul className={`mt-2 ${grid}`}>
                    {visibleAuto.map((badge) => <ToEarnTile key={badge.id} badge={badge} onOpen={() => openToEarn(badge.id)} />)}
                  </ul>
                </div>
              )}
              {visibleTeacher.length > 0 && (
                <div>
                  <h3 className={subTitle}>Te las da tu profe</h3>
                  <ul className={`mt-2 ${grid}`}>
                    {visibleTeacher.map((badge) => <ToEarnTile key={badge.id} badge={badge} onOpen={() => openToEarn(badge.id)} />)}
                  </ul>
                </div>
              )}
              {(hidden > 0 || showAll) && view.toEarn.length > FOLD && (
                <button type="button" onClick={() => setShowAll((value) => !value)} className={rowButton}>
                  {showAll ? 'Ver menos' : `Ver todas (${view.toEarn.length})`}
                </button>
              )}
            </section>
          )}

          {view.secrets > 0 && (
            <section aria-labelledby="secrets-title">
              <h2 id="secrets-title" className={groupTitle}>Secretas · {view.secrets}</h2>
              <ul className={`mt-2 ${grid}`}>
                {Array.from({ length: Math.min(view.secrets, 4) }, (_, index) => <SecretTile key={index} />)}
              </ul>
              {view.secrets > 4 && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">y {view.secrets - 4} más por descubrir</p>}
            </section>
          )}
        </>
      )}

      <AnimatePresence>
        {detail && <BadgeDetailModal key="badge-detail" detail={detail} young={young} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
};

export const StudentBadgesPage = () => {
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { profile, isLoading } = useCurrentStudentProfile();

  if (isLoading) return <Skeleton />;
  if (!profile) return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  return <BadgesContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
