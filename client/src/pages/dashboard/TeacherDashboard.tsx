import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus,
  TrendingUp,
  GraduationCap,
  Lightbulb,
  ArrowRight,
  Star,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { classroomApi } from '../../lib/classroomApi';
import { getMySchools } from '../../api/schoolApi';

export const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Obtener clases del backend
  const { data: classrooms, isLoading, isError } = useQuery({
    queryKey: ['classrooms'],
    queryFn: classroomApi.getMyClassrooms,
  });

  // Verificar permisos de escuela
  const { data: mySchools = [] } = useQuery({
    queryKey: ['my-schools'],
    queryFn: getMySchools,
  });

  // Verificar si puede crear clases
  const canCreateClasses = mySchools.length === 0 || mySchools.some(
    s => s.role === 'OWNER' || s.role === 'ADMIN' || s.canCreateClasses
  );

  // Calcular estadísticas reales
  const totalStudents = classrooms?.reduce((acc, c) => acc + (c.studentCount || 0), 0) || 0;
  
  const stats = [
    { label: 'Clases Activas', value: classrooms?.length.toString() || '0', icon: GraduationCap, gradient: 'from-blue-500 to-cyan-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Estudiantes', value: totalStudents.toString(), icon: Users, gradient: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      <div className="absolute top-40 left-10 w-64 h-64 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-4 md:p-5 shadow-lg shadow-blue-500/10 border border-white/50 dark:border-gray-700/50"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl"
                >
                  👋
                </motion.div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  ¡Hola, {user?.firstName}!
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                ¿Listo para inspirar a tus estudiantes hoy?
              </p>
            </div>
            
            {canCreateClasses && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/classrooms')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all"
              >
                <Plus size={16} />
                Nueva Clase
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -2 }}
              className="group cursor-pointer"
            >
              <div className={`${stat.bg} dark:bg-gray-800/80 rounded-xl p-4 shadow-md hover:shadow-lg transition-all border border-white/50 dark:border-gray-700/50`}>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Clases */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div 
              data-onboarding="classes-list"
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl p-4 shadow-lg shadow-blue-500/10 border border-white/50 dark:border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-white" />
                  </div>
                  Tus Clases
                </h2>
                {classrooms && classrooms.length > 0 && (
                  <button 
                    onClick={() => navigate('/classrooms')}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs flex items-center gap-1"
                  >
                    Ver todas <ArrowRight size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : isError ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-500">Error al cargar las clases</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : classrooms && classrooms.length > 0 ? (
                  <>
                    {classrooms.slice(0, 3).map((classroom, index) => (
                      <motion.div 
                        key={classroom.id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                        whileHover={{ scale: 1.01, x: 3 }}
                        onClick={() => navigate(`/classroom/${classroom.id}`)}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 rounded-xl cursor-pointer transition-all border border-blue-100 dark:border-blue-800/50 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                              {classroom.name}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {classroom.studentCount || 0}
                              </span>
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {classroom.code}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </motion.div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-7 h-7 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">¡Crea tu primera clase!</h3>
                    <p className="text-xs text-gray-500">Comienza a gamificar tu aula</p>
                  </div>
                )}

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate('/classrooms')}
                  data-onboarding="create-class"
                  className="w-full py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-400 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700"
                >
                  <ArrowRight size={16} />
                  Ver mis clases
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Banner de Bienvenida */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-300" />
                  <span className="text-xs font-medium text-blue-100">Bienvenido</span>
                </div>
                
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl mb-2"
                >
                  🎓
                </motion.div>
                
                <h3 className="text-base font-bold mb-1">¡Bienvenido a Juried!</h3>
                <p className="text-blue-100 text-xs">
                  Gamifica tu aula y motiva a tus estudiantes.
                </p>
              </div>
            </div>

            {/* Consejo del día */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                  <Lightbulb className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Consejo del día</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                💡 Usa los <span className="font-semibold text-amber-600">eventos aleatorios</span> para mantener a tus estudiantes motivados.
              </p>
            </div>

            {/* Quick Stats Mini */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Tu progreso</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Clases</span>
                    <span className="font-semibold text-emerald-600">{classrooms?.length || 0}/10</span>
                  </div>
                  <div className="h-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${((classrooms?.length || 0) / 10) * 100}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Estudiantes</span>
                    <span className="font-semibold text-emerald-600">{totalStudents}/50</span>
                  </div>
                  <div className="h-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(totalStudents / 50) * 100}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            </motion.div>
        </div>
      </div>
    </div>
  );
};
