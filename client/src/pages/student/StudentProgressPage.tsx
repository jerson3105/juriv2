import { useNavigate } from 'react-router-dom';
import { useStudentStore } from '../../store/studentStore';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../lib/studentApi';
import { StudentProgressView } from '../../components/student/StudentProgressView';

export const StudentProgressPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  if (!currentProfile) return null;

  return (
    <StudentProgressView
      studentId={currentProfile.id}
      onBack={() => navigate('/dashboard')}
    />
  );
};
