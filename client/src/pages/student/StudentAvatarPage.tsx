import { useNavigate, useOutletContext } from 'react-router-dom';
import { useStudentStore } from '../../store/studentStore';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../lib/studentApi';
import { AvatarShop } from '../../components/avatar/AvatarShop';

export const StudentAvatarPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();
  const { hasStoryTheme } = useOutletContext<{ hasStoryTheme?: boolean }>();

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  if (!currentProfile) return null;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8">
      <AvatarShop
        studentProfile={{
          id: currentProfile.id,
          classroomId: currentProfile.classroomId,
          gp: currentProfile.gp,
          avatarGender: currentProfile.avatarGender || 'MALE',
        }}
        onClose={() => navigate('/my-class')}
        hasStoryTheme={!!hasStoryTheme}
      />
    </div>
  );
};