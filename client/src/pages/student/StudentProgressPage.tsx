import { useNavigate, useOutletContext } from 'react-router-dom';
import { useStudentStore } from '../../store/studentStore';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../lib/studentApi';
import { StudentProgressView } from '../../components/student/StudentProgressView';
import type { ThemeConfig } from '../../lib/storyApi';

export const StudentProgressPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();
  const { storyTheme, isThemeDark, hasStoryTheme } = useOutletContext<{ storyTheme?: ThemeConfig | null; isThemeDark?: boolean; hasStoryTheme?: boolean }>();

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  if (!currentProfile) return null;

  return (
    <StudentProgressView
      studentId={currentProfile.id}
      onBack={() => navigate('/my-class')}
      storyTheme={storyTheme}
      isThemeDark={isThemeDark}
      hasStoryTheme={hasStoryTheme}
    />
  );
};
