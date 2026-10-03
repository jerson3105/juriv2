import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import type { StoryAccent } from '../../lib/storyTheme';
import { StudentHome } from '../../components/student/home/StudentHome';

/** Inicio de la clase del alumno (/my-class). La historia, la racha y las celebraciones ocurren al entrar: StudentEntryEffects. */
export const StudentDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();

  const { myClasses, profile: currentProfile, isLoading } = useCurrentStudentProfile();

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando tu clase" className="space-y-5">
        <div className="h-14 w-72 max-w-full rounded-xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
        <div className="h-72 rounded-3xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-44 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
          <div className="h-44 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  // Si no tiene clases, mostrar opción de unirse
  if (!myClasses || myClasses.length === 0 || !currentProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Users className="mx-auto mb-4 h-16 w-16 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">¡Hola, {user?.firstName}!</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Aún no estás en ninguna clase. Pídele el código a tu profe para empezar tu aventura.
          </p>
          <Button size="lg" leftIcon={<Plus size={20} />} onClick={() => navigate('/join-class')}>
            Unirme a una clase
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudentHome
      key={currentProfile.id}
      profile={currentProfile}
      firstName={user?.firstName || currentProfile.displayName || currentProfile.characterName || 'estudiante'}
      storyAccent={storyAccent ?? null}
    />
  );
};
