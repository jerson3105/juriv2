import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dices, 
  Swords, 
  Sparkles, 
  ChevronRight,
  Users,
  Zap,
  Lightbulb,
  Shield,
  Timer,
  ScrollText,
  Map,
  X,
  Rocket,
} from 'lucide-react';
import { RandomPickerActivity } from '../../components/activities/RandomPickerActivity';
import { RandomEventsActivity } from '../../components/activities/RandomEventsActivity';
import { BossBattleActivity } from '../../components/activities/BossBattleActivity';
import { ClanPickerActivity } from '../../components/activities/ClanPickerActivity';
import { TimedActivitiesActivity } from '../../components/activities/TimedActivitiesActivity';
import { AulaZenActivity } from '../../components/activities/AulaZenActivity';
import { ScrollsActivity } from '../../components/activities/ScrollsActivity';
import { TerritoryConquestActivity } from '../../components/activities/TerritoryConquestActivity';
import { useOutletContext, useParams } from 'react-router-dom';
import BossBattleTypeModal from '../../components/modals/BossBattleTypeModal';

interface Activity {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
  available: boolean;
}

const activities: Activity[] = [
  {
    id: 'random-picker',
    name: 'Selección Aleatoria',
    description: 'Elige estudiantes al azar sin repetir. Ideal para participaciones en clase.',
    icon: <Dices size={24} />,
    gradient: 'from-violet-500 to-purple-600',
    shadowColor: 'shadow-violet-500/25',
    available: true,
  },
  {
    id: 'boss-battle',
    name: 'Boss Battle',
    description: 'Batallas cooperativas contra jefes épicos. ¡Trabaja en equipo!',
    icon: <Swords size={24} />,
    gradient: 'from-red-500 to-orange-500',
    shadowColor: 'shadow-red-500/25',
    available: true,
  },
  {
    id: 'random-events',
    name: 'Eventos Aleatorios',
    description: 'Eventos sorpresa que afectan a estudiantes seleccionados al azar.',
    icon: <Sparkles size={24} />,
    gradient: 'from-pink-500 to-rose-500',
    shadowColor: 'shadow-pink-500/25',
    available: true,
  },
  {
    id: 'clan-picker',
    name: 'Selección de Clanes',
    description: 'Elige un clan al azar para participar. Recompensa a todos sus miembros.',
    icon: <Shield size={24} />,
    gradient: 'from-teal-500 to-emerald-500',
    shadowColor: 'shadow-teal-500/25',
    available: true,
  },
  {
    id: 'timed-activities',
    name: 'Actividades de Tiempo',
    description: 'Cronómetro, temporizador y modo bomba para retos con tiempo.',
    icon: <Timer size={24} />,
    gradient: 'from-purple-500 to-pink-500',
    shadowColor: 'shadow-purple-500/25',
    available: true,
  },
  {
    id: 'noise-meter',
    name: 'Aula Zen',
    description: 'Mide el ruido del aula. ¡Mantén la calma y gana recompensas!',
    icon: <Shield size={24} />,
    gradient: 'from-emerald-500 to-teal-600',
    shadowColor: 'shadow-emerald-500/25',
    available: true,
  },
  {
    id: 'scrolls',
    name: 'Pergaminos del Aula',
    description: 'Mural social donde los estudiantes envían mensajes de motivación y reconocimiento.',
    icon: <ScrollText size={24} />,
    gradient: 'from-amber-500 to-orange-500',
    shadowColor: 'shadow-amber-500/25',
    available: true,
  },
  {
    id: 'territory-conquest',
    name: 'Conquista de Territorios',
    description: 'Batalla de clanes por el control del mapa. ¡Conquista territorios respondiendo preguntas!',
    icon: <Map size={24} />,
    gradient: 'from-indigo-500 to-blue-600',
    shadowColor: 'shadow-indigo-500/25',
    available: false,
  },
];

export const ActivitiesPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const { id: classroomId } = useParams<{ id: string }>();
  
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [showBossBattleModal, setShowBossBattleModal] = useState(false);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);

  // Handler para click en actividad
  const handleActivityClick = (activityId: string) => {
    if (activityId === 'boss-battle') {
      setShowBossBattleModal(true);
    } else if (activityId === 'territory-conquest') {
      setShowTerritoryModal(true);
    } else {
      setSelectedActivity(activityId);
    }
  };

  // Handler para seleccionar Boss Battle clásica desde el modal
  const handleSelectClassicBattle = () => {
    setSelectedActivity('boss-battle');
  };

  // Si hay una actividad seleccionada, mostrarla
  if (selectedActivity === 'random-picker') {
    return (
      <RandomPickerActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'random-events') {
    return (
      <RandomEventsActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'boss-battle') {
    return (
      <BossBattleActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'clan-picker') {
    return (
      <ClanPickerActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'timed-activities') {
    return (
      <TimedActivitiesActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'noise-meter') {
    return (
      <AulaZenActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'scrolls') {
    return (
      <ScrollsActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'territory-conquest') {
    return (
      <TerritoryConquestActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
          <Zap size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Actividades Gamificadas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Herramientas interactivas para dinamizar tu clase
          </p>
        </div>
      </div>

      {/* Grid de actividades */}
      <div className="grid md:grid-cols-2 gap-4">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div 
              className={`
                relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden
                transition-all duration-300 cursor-pointer
                ${activity.available 
                  ? 'hover:shadow-xl hover:scale-[1.02] shadow-lg ' + activity.shadowColor
                  : 'opacity-70 hover:opacity-90'
                }
              `}
              onClick={() => handleActivityClick(activity.id)}
            >
              {/* Fondo decorativo */}
              <div className={`
                absolute top-0 right-0 w-24 h-24 
                bg-gradient-to-br ${activity.gradient} 
                opacity-10 rounded-full -translate-y-1/2 translate-x-1/2
              `} />
              
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icono */}
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                    bg-gradient-to-br ${activity.gradient} text-white shadow-lg ${activity.shadowColor}
                  `}>
                    {activity.icon}
                  </div>
                  
                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                        {activity.name}
                      </h3>
                      {activity.available ? (
                        <div className={`
                          w-7 h-7 rounded-lg flex items-center justify-center
                          bg-gradient-to-br ${activity.gradient} text-white
                        `}>
                          <ChevronRight size={16} />
                        </div>
                      ) : (
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                          Próximamente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {activity.description}
                    </p>
                    
                    {activity.available && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users size={12} />
                          <span>{classroom?.students?.length || 0} estudiantes</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/25"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Lightbulb size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              💡 Consejo del día
            </h4>
            <p className="text-xs text-blue-100 mt-1">
              Usa la <strong>Selección Aleatoria</strong> para elegir quién participa en clase. 
              ¡Los estudiantes estarán más atentos sabiendo que pueden ser elegidos en cualquier momento!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Modal de selección de tipo de Boss Battle */}
      <BossBattleTypeModal
        isOpen={showBossBattleModal}
        onClose={() => setShowBossBattleModal(false)}
        classroomId={classroomId || ''}
        onSelectClassic={handleSelectClassicBattle}
      />

      {/* Modal de Conquista de Territorios - Próximamente */}
      <AnimatePresence>
        {showTerritoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowTerritoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decoración de fondo */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
              </div>

              {/* Contenido */}
              <div className="relative p-8 text-center text-white">
                {/* Icono principal */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                  className="w-24 h-24 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-xl"
                >
                  <Map size={48} className="text-white" />
                </motion.div>

                {/* Badge de próximamente */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4"
                >
                  <Sparkles size={16} className="text-yellow-300" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Próximamente</span>
                  <Sparkles size={16} className="text-yellow-300" />
                </motion.div>

                {/* Título */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold mb-3"
                >
                  ⚔️ Conquista de Territorios
                </motion.h2>

                {/* Descripción */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/90 text-lg mb-6 leading-relaxed"
                >
                  ¡Prepárate para la batalla definitiva! Los clanes lucharán por el control del mapa respondiendo preguntas.
                </motion.p>

                {/* Beneficios */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-6 text-left"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Rocket size={18} className="text-yellow-300" />
                    ¿Qué podrás hacer?
                  </h3>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">🗺️</span>
                      <span>Crear mapas personalizados con territorios únicos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">⚔️</span>
                      <span>Batallas entre clanes por conquistar territorios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">🏆</span>
                      <span>Sistema de puntos, rachas y bonificaciones</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">📊</span>
                      <span>Ranking en tiempo real y estadísticas detalladas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">❓</span>
                      <span>Integración con tus bancos de preguntas</span>
                    </li>
                  </ul>
                </motion.div>

                {/* Mensaje motivacional */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-white/80 text-sm mb-6"
                >
                  🚀 Estamos trabajando para traerte esta increíble funcionalidad muy pronto.
                  <br />¡Manténte atento a las novedades!
                </motion.p>

                {/* Botón de cerrar */}
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  onClick={() => setShowTerritoryModal(false)}
                  className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  ¡Entendido!
                </motion.button>
              </div>

              {/* Botón X para cerrar */}
              <button
                onClick={() => setShowTerritoryModal(false)}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
