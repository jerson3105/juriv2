import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  Plus,
  BookOpen,
  LogOut,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';
import { parentApi } from '../../lib/parentApi';
import type { ChildSummary } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useState } from 'react';
import LinkChildModal from './LinkChildModal';
import { useAuthStore } from '../../store/authStore';

export default function ParentDashboard() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['parent-children'],
    queryFn: parentApi.getChildren,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin actividad';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  };

  const getGradeColor = (grade: string | null) => {
    if (!grade) return 'bg-gray-100 text-gray-600';
    if (grade === 'AD') return 'bg-emerald-100 text-emerald-700';
    if (grade === 'A') return 'bg-blue-100 text-blue-700';
    if (grade === 'B') return 'bg-amber-100 text-amber-700';
    if (grade === 'C') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header con logo */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Juried" 
                className="h-9 w-auto"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowLinkModal(true)} size="sm">
                <Plus size={18} />
                Vincular hijo
              </Button>
              
              {/* Menú de usuario */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
                    <User size={18} className="text-pink-600 dark:text-pink-400" />
                  </div>
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={16} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Bienvenida */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ¡Hola, {user?.firstName || 'Padre'}!
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aquí puedes ver el progreso académico de tus hijos
              </p>
            </div>
          </div>
        </motion.div>

        {/* Lista de hijos */}
        {children.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="p-8 text-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                <GraduationCap className="text-indigo-500" size={40} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Sin hijos vinculados
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Solicita el código de vinculación al profesor de tu hijo para comenzar a ver su progreso académico.
              </p>
              <Button onClick={() => setShowLinkModal(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
                <Plus size={18} />
                Vincular mi primer hijo
              </Button>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {children.map((child: ChildSummary, index: number) => (
              <motion.div
                key={child.studentProfileId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChildCard 
                  child={child} 
                  formatDate={formatDate}
                  getGradeColor={getGradeColor}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal para vincular hijo */}
        {showLinkModal && (
          <LinkChildModal onClose={() => setShowLinkModal(false)} />
        )}
      </main>
    </div>
  );
}

function ChildCard({ 
  child, 
  formatDate, 
  getGradeColor 
}: { 
  child: ChildSummary;
  formatDate: (date: string | null) => string;
  getGradeColor: (grade: string | null) => string;
}) {
  return (
    <Link to={`/parent/child/${child.studentProfileId}`}>
      <Card className="p-5 hover:shadow-lg transition-all duration-300 cursor-pointer bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 group overflow-hidden relative">
        {/* Barra de color lateral */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600" />
        
        <div className="flex items-start justify-between pl-3">
          <div className="flex-1">
            {/* Clase como principal */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {child.classroomName}
              </h3>
              {child.alertCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full animate-pulse">
                  <AlertTriangle size={12} />
                  {child.alertCount}
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{child.studentName}</span>
              {child.gradeLevel && <span className="text-gray-400"> · {child.gradeLevel}</span>}
              <span className="text-gray-400"> · {child.teacherName}</span>
            </p>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Promedio - solo si hay calificaciones */}
              {child.averageGrade && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg">
                  <BookOpen size={16} className="text-indigo-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Promedio:</span>
                  <span className={`px-2 py-0.5 rounded-md text-sm font-bold ${getGradeColor(child.averageGrade)}`}>
                    {child.averageGrade}
                    {child.averageScore && ` (${child.averageScore}%)`}
                  </span>
                </div>
              )}

              {/* Última actividad */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(child.lastActivityDate)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <ChevronRight className="text-gray-400 group-hover:text-indigo-500 transition-colors" size={24} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
