import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { studentApi } from '../../lib/studentApi';
import { useAuthStore } from '../../store/authStore';

/**
 * Entrada del alumno (/dashboard). Casi todos tienen una sola clase: su inicio es su clase, con su
 * personaje, nivel, energía y oro (antes aterrizaba en un calendario general casi siempre vacío).
 * Sin clases, la invitación a unirse.
 */
export const StudentOverviewPage = () => {
  const navigate = useNavigate();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const { data: myClasses = [], isLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Cargando tu clase">
        <div className="h-10 w-64 rounded-2xl bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse" />
        <div className="h-[360px] rounded-3xl bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse" />
      </div>
    );
  }

  if (myClasses.length > 0) {
    return <Navigate to="/my-class" replace />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="max-w-xl text-center space-y-5">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/20" aria-hidden="true">
          <Users className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {firstName ? `¡Hola, ${firstName}!` : '¡Hola!'}
          </h1>
          <p className="text-gray-700 dark:text-gray-300">
            Aún no estás en ninguna clase. Pídele el código a tu profe y únete para empezar tu aventura.
          </p>
        </div>
        <div className="flex justify-center">
          <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/join-class')}>
            Unirme a una clase
          </Button>
        </div>
      </div>
    </div>
  );
};
