import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Target } from 'lucide-react';
import { MissionsWidget } from '../../components/student/MissionsWidget';

export const StudentMissionsPage = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();

  if (!classroomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Clase no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al dashboard
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center ring-4 ring-purple-200 dark:ring-purple-800">
            <Target className="text-purple-600 dark:text-purple-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Misiones</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Completa misiones para ganar XP, oro y mantener tu racha
            </p>
          </div>
        </div>
      </div>

      {/* Widget de misiones */}
      <MissionsWidget classroomId={classroomId} />
    </div>
  );
};
