import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus,
  GraduationCap,
  Lightbulb,
  ArrowRight,
  Megaphone,
  Sparkles,
  ChevronRight,
  X,
  Album,
  Package,
  Trophy,
  Star,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { classroomApi } from '../../lib/classroomApi';
import { getMySchools } from '../../api/schoolApi';

// Tips rotativos para Jiro
const JIRO_TIPS = [
  { text: "¡Los eventos aleatorios son geniales para sorprender a tus estudiantes! Actívalos desde Actividades.", highlight: "eventos aleatorios" },
  { text: "¿Sabías que puedes crear insignias personalizadas? Motiva a tus estudiantes con logros únicos.", highlight: "insignias personalizadas" },
  { text: "La tienda de clase permite a los estudiantes canjear sus puntos por recompensas. ¡Configúrala!", highlight: "tienda de clase" },
  { text: "Los clanes fomentan el trabajo en equipo. Activa las batallas de clanes para más emoción.", highlight: "clanes" },
  { text: "Usa los Pergaminos del Aula para que tus estudiantes se reconozcan entre sí.", highlight: "Pergaminos del Aula" },
  { text: "Las expediciones son misiones grupales perfectas para proyectos colaborativos.", highlight: "expediciones" },
  { text: "Crea álbumes de cromos coleccionables. ¡A los estudiantes les encanta completarlos!", highlight: "cromos coleccionables" },
  { text: "El banco de preguntas te permite reutilizar preguntas en diferentes actividades.", highlight: "banco de preguntas" },
];

// Noticias/Actualizaciones de Juried
const JURIED_NEWS = [
  { 
    id: 'collectibles',
    title: '🆕 Nueva función: Coleccionables',
    description: 'Crea álbumes de cromos para tus estudiantes. ¡Pueden comprar sobres con GP!',
    date: '2026-01-23',
    isNew: true,
    hasModal: true,
  },
];

export const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showCollectiblesModal, setShowCollectiblesModal] = useState(false);

  // Rotar tips cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % JIRO_TIPS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
  const currentTip = JIRO_TIPS[currentTipIndex];

  // Función para resaltar texto en el tip
  const renderTipText = (text: string, highlight: string) => {
    const parts = text.split(highlight);
    if (parts.length === 1) return text;
    return (
      <>
        {parts[0]}
        <span className="font-bold text-yellow-300">{highlight}</span>
        {parts[1]}
      </>
    );
  };

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

        {/* Main Content - 2 columnas */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Columna Izquierda - Clases */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2"
          >
            <div 
              data-onboarding="classes-list"
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl p-4 shadow-lg shadow-blue-500/10 border border-white/50 dark:border-gray-700/50 h-full"
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
                        transition={{ delay: 0.3 + 0.05 * index }}
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
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
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
                    <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-7 h-7 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">¡Crea tu primera clase!</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Comienza a gamificar tu aula</p>
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

          {/* Columna Derecha - Resumen y Noticias */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Resumen */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Resumen</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Clases activas</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{classrooms?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Total estudiantes</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{totalStudents}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Promedio por clase</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {classrooms?.length ? Math.round(totalStudents / classrooms.length) : 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Últimas Noticias */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-md">
                  <Megaphone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Últimas Noticias</h3>
              </div>
              <div className="space-y-3">
                {JURIED_NEWS.map((news, index) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    onClick={() => news.hasModal && setShowCollectiblesModal(true)}
                    className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-gray-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {news.title}
                          </h4>
                          {news.isNew && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {news.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Banner con Jiro - Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/20"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          
          <div className="relative flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-5">
            {/* Imagen de Jiro */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="flex-shrink-0"
            >
              <img 
                src="/jiro-mascot.png" 
                alt="Jiro - Mascota de Juried"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-2xl"
              />
            </motion.div>
            
            {/* Contenido del tip */}
            <div className="flex-1 text-white text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Consejo de Jiro</span>
                </div>
                <div className="flex gap-1">
                  {JIRO_TIPS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentTipIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentTipIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <motion.p
                key={currentTipIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm md:text-base leading-relaxed text-white/95"
              >
                {renderTipText(currentTip.text, currentTip.highlight)}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal de Coleccionables */}
      {showCollectiblesModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCollectiblesModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header del modal */}
            <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-2xl">
              <button
                onClick={() => setShowCollectiblesModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <Album className="w-8 h-8 text-white" />
                </div>
                <div className="text-white">
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium mb-1 inline-block">Nueva función</span>
                  <h2 className="text-xl font-bold">Coleccionables</h2>
                </div>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-5">
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                ¡Crea álbumes de cromos coleccionables para tus estudiantes! Una forma divertida de motivarlos mientras aprenden.
              </p>

              {/* Características */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  ¿Qué puedes hacer?
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Album className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white text-sm">Crear álbumes temáticos</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Define temáticas como "Historia del Perú", "Ciencias", etc.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white text-sm">Sobres con diferentes precios</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Configura precios para sobres de 1, 5 o 10 cromos.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white text-sm">Rarezas y cromos brillantes</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Común, Poco común, Raro, Épico y Legendario. ¡Con versiones shiny!</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white text-sm">Recompensas al completar</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Otorga XP y GP cuando completen el álbum.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cómo funciona */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  ¿Cómo funciona para los estudiantes?
                </h3>
                <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Ganan GP completando actividades y comportamientos</li>
                  <li>Compran sobres de cromos con sus GP</li>
                  <li>Abren los sobres y descubren qué cromos obtienen</li>
                  <li>Completan el álbum para ganar la recompensa</li>
                </ol>
              </div>

              {/* Botón de acción */}
              <button
                onClick={() => {
                  setShowCollectiblesModal(false);
                  navigate('/classrooms');
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Album className="w-5 h-5" />
                Ir a mis clases para crear un álbum
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
