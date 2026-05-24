import { useNavigate, useOutletContext } from 'react-router-dom';
import { useStudentStore } from '../../store/studentStore';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { studentApi } from '../../lib/studentApi';
import { StudentShopPage } from './StudentShopPage';

export const StudentItemsShopPage = () => {
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
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasStoryTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {!hasStoryTheme && (
        <div className="absolute top-20 right-10 w-64 h-64 bg-amber-200 dark:bg-amber-950 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-30 animate-pulse" />
      )}

      <div className="relative z-10 space-y-6">
        <button
          onClick={() => navigate('/my-class')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a mi clase</span>
        </button>

        <StudentShopPage
          studentProfile={{
            id: currentProfile.id,
            classroomId: currentProfile.classroomId,
            gp: currentProfile.gp,
            characterName: currentProfile.characterName,
          }}
        />
      </div>
    </div>
  );
};