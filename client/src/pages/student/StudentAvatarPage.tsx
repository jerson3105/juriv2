import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { avatarApi } from '../../lib/avatarApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { RestingBanner } from '../../components/energy/RestingBanner';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { myAvatarKey } from '../../components/avatar/avatarHelpers';
import { Closet } from '../../components/avatar/closet/Closet';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];

const Skeleton = () => (
  <div role="status" aria-label="Cargando tu clóset" className="grid items-start gap-5 md:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
    <div className="h-56 rounded-3xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700 md:h-[30rem]" />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
      {[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="h-48 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />)}
    </div>
  </div>
);

const ClosetContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  // El profe da oro en clase: al volver a la pestaña se refresca.
  const query = useQuery({ queryKey: myAvatarKey(profile.id), queryFn: () => avatarApi.getStudentView(profile.id), refetchOnWindowFocus: true });
  const view = query.data;
  const avatarOff = view?.shop.reason === 'AVATAR_OFF';
  const header = (
    <StudentPageHeader
      title="Mi personaje"
      subtitle={`${view?.classroomName ?? profile.classroom.name} · ${avatarOff ? 'tu clóset' : 'tu clóset y la tienda de prendas'}`}
      emoji="👕"
      storyAccent={storyAccent}
    />
  );

  if (query.isLoading) return <div className="space-y-5">{header}<Skeleton /></div>;
  if (query.isError || !view) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorCard text="No pudimos abrir tu clóset." onRetry={() => void query.refetch()} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {header}
      {profile.hp <= 0 && <RestingBanner profileId={profile.id} />}
      <Closet view={view} />
    </div>
  );
};

/** «Mi personaje»: el espejo y el clóset de la clase elegida (cada clase tiene su personaje, su oro y su ropa). */
export const StudentAvatarPage = () => {
  const selectedClassIndex = useStudentStore((s) => s.selectedClassIndex);
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { data: myClasses, isLoading } = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses });
  const profile = myClasses?.[selectedClassIndex];

  if (isLoading) return <Skeleton />;
  if (!profile) return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  return <ClosetContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
