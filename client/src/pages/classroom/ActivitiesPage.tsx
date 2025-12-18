import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Target,
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
  emoji: string;
  gradient: string;
  bgGradient: string;
  shadowColor: string;
  glowColor: string;
  available: boolean;
  tag?: string;
  tagColor?: string;
}

const activities: Activity[] = [
  {
    id: 'random-picker',
    name: 'Selección Aleatoria',
    description: 'Elige estudiantes al azar sin repetir. Ideal para participaciones en clase.',
    icon: <Dices size={28} />,
    emoji: '🎲',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    bgGradient: 'from-violet-500/10 via-purple-500/5 to-fuchsia-500/10',
    shadowColor: 'shadow-violet-500/30',
    glowColor: 'violet',
    available: true,
    tag: '⭐ Popular',
    tagColor: 'from-amber-400 to-orange-500',
  },
  {
    id: 'boss-battle',
    name: 'Boss Battle',
    description: 'Batallas cooperativas contra jefes épicos. ¡Trabaja en equipo!',
    icon: <Swords size={28} />,
    emoji: '⚔️',
    gradient: 'from-red-500 via-orange-500 to-amber-500',
    bgGradient: 'from-red-500/10 via-orange-500/5 to-amber-500/10',
    shadowColor: 'shadow-red-500/30',
    glowColor: 'red',
    available: true,
    tag: '🔥 Épico',
    tagColor: 'from-red-500 to-orange-500',
  },
  {
    id: 'random-events',
    name: 'Eventos Aleatorios',
    description: 'Eventos sorpresa que afectan a estudiantes seleccionados al azar.',
    icon: <Sparkles size={28} />,
    emoji: '✨',
    gradient: 'from-pink-500 via-rose-500 to-red-400',
    bgGradient: 'from-pink-500/10 via-rose-500/5 to-red-400/10',
    shadowColor: 'shadow-pink-500/30',
    glowColor: 'pink',
    available: true,
  },
  {
    id: 'clan-picker',
    name: 'Selección de Clanes',
    description: 'Elige un clan al azar para participar. Recompensa a todos sus miembros.',
    icon: <Shield size={28} />,
    emoji: '🛡️',
    gradient: 'from-teal-500 via-emerald-500 to-green-500',
    bgGradient: 'from-teal-500/10 via-emerald-500/5 to-green-500/10',
    shadowColor: 'shadow-teal-500/30',
    glowColor: 'teal',
    available: true,
  },
  {
    id: 'timed-activities',
    name: 'Actividades de Tiempo',
    description: 'Cronómetro, temporizador y modo bomba para retos con tiempo.',
    icon: <Timer size={28} />,
    emoji: '⏱️',
    gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
    bgGradient: 'from-cyan-500/10 via-blue-500/5 to-indigo-500/10',
    shadowColor: 'shadow-blue-500/30',
    glowColor: 'blue',
    available: true,
    tag: '💣 Bomba',
    tagColor: 'from-purple-500 to-pink-500',
  },
  {
    id: 'noise-meter',
    name: 'Aula Zen',
    description: 'Mide el ruido del aula. ¡Mantén la calma y gana recompensas!',
    icon: <Target size={28} />,
    emoji: '🧘',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgGradient: 'from-emerald-500/10 via-teal-500/5 to-cyan-500/10',
    shadowColor: 'shadow-emerald-500/30',
    glowColor: 'emerald',
    available: true,
  },
  {
    id: 'scrolls',
    name: 'Pergaminos del Aula',
    description: 'Mural social donde los estudiantes envían mensajes de motivación y reconocimiento.',
    icon: <ScrollText size={28} />,
    emoji: '📜',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    bgGradient: 'from-amber-500/10 via-orange-500/5 to-red-500/10',
    shadowColor: 'shadow-amber-500/30',
    glowColor: 'amber',
    available: true,
  },
  {
    id: 'territory-conquest',
    name: 'Conquista de Territorios',
    description: 'Batalla de clanes por el control del mapa. ¡Conquista territorios respondiendo preguntas!',
    icon: <Map size={28} />,
    emoji: '🗺️',
    gradient: 'from-indigo-500 via-blue-500 to-cyan-500',
    bgGradient: 'from-indigo-500/10 via-blue-500/5 to-cyan-500/10',
    shadowColor: 'shadow-indigo-500/30',
    glowColor: 'indigo',
    available: true,
  },
];

// Consejos rotativos
const tips = [
  { icon: '🎲', title: 'Selección Aleatoria', text: 'Usa la Selección Aleatoria para elegir quién participa en clase. ¡Los estudiantes estarán más atentos!' },
  { icon: '⚔️', title: 'Boss Battle', text: 'Las batallas de boss fomentan el trabajo en equipo. ¡Úsalas para repasar contenido de forma épica!' },
  { icon: '🧘', title: 'Aula Zen', text: 'El medidor de ruido ayuda a mantener un ambiente tranquilo. ¡Recompensa el silencio!' },
  { icon: '💣', title: 'Modo Bomba', text: 'El modo bomba añade emoción a las actividades. ¡Perfecto para respuestas rápidas!' },
  { icon: '🛡️', title: 'Clanes', text: 'Seleccionar clanes promueve la colaboración entre equipos. ¡Todos ganan juntos!' },
];

export const ActivitiesPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const { id: classroomId } = useParams<{ id: string }>();
  
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [showBossBattleModal, setShowBossBattleModal] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

  // Rotación automática de consejos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handler para click en actividad
  const handleActivityClick = (activityId: string) => {
    if (activityId === 'boss-battle') {
      setShowBossBattleModal(true);
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
    <div className="space-y-6">
      {/* Header Épico */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 rounded-2xl p-6 shadow-2xl"
      >
        {/* Partículas de fondo */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl opacity-20"
              style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ 
                y: [0, -15, 0], 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
            >
              {['⚡', '🎮', '🏆', '⭐', '🎯', '🚀', '💎', '🔥'][i]}
            </motion.div>
          ))}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative flex items-center gap-4">
          <motion.div 
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30"
          >
            <Zap size={32} className="text-white drop-shadow-lg" />
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white drop-shadow-lg">
                Actividades Gamificadas
              </h1>
              <motion.span 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold text-white border border-white/30"
              >
                🎮 {activities.filter(a => a.available).length} disponibles
              </motion.span>
            </div>
            <p className="text-white/80 text-sm mt-1">
              Herramientas interactivas para dinamizar tu clase
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
              <Users size={16} className="text-white" />
              <span className="text-white font-bold">{classroom?.students?.length || 0}</span>
              <span className="text-white/70 text-sm">estudiantes</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid de actividades - Diseño mejorado */}
      <div className="grid md:grid-cols-2 gap-4">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
            onHoverStart={() => setHoveredActivity(activity.id)}
            onHoverEnd={() => setHoveredActivity(null)}
          >
            <motion.div 
              whileHover={activity.available ? { scale: 1.02, y: -4 } : {}}
              whileTap={activity.available ? { scale: 0.98 } : {}}
              className={`
                relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300
                ${activity.available 
                  ? `bg-white dark:bg-gray-800 shadow-xl hover:shadow-2xl ${activity.shadowColor}` 
                  : 'bg-gray-100 dark:bg-gray-800/50 opacity-70'
                }
              `}
              onClick={() => handleActivityClick(activity.id)}
            >
              {/* Fondo con gradiente animado */}
              <div className={`absolute inset-0 bg-gradient-to-br ${activity.bgGradient} transition-opacity duration-300 ${hoveredActivity === activity.id ? 'opacity-100' : 'opacity-50'}`} />
              
              {/* Efecto de brillo en hover */}
              {activity.available && hoveredActivity === activity.id && (
                <motion.div 
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: '200%', opacity: 0.3 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent skew-x-12"
                />
              )}
              
              {/* Tag especial */}
              {activity.tag && (
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.08 + 0.3 }}
                  className={`absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r ${activity.tagColor} rounded-full text-[10px] font-bold text-white shadow-lg z-10`}
                >
                  {activity.tag}
                </motion.div>
              )}
              
              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  {/* Icono con animación */}
                  <motion.div 
                    animate={hoveredActivity === activity.id && activity.available ? { 
                      rotate: [0, -5, 5, 0],
                      scale: [1, 1.1, 1]
                    } : {}}
                    transition={{ duration: 0.5 }}
                    className={`
                      relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                      bg-gradient-to-br ${activity.gradient} text-white shadow-lg ${activity.shadowColor}
                    `}
                  >
                    {activity.icon}
                    {/* Glow effect */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${activity.gradient} blur-lg opacity-40 -z-10`} />
                  </motion.div>
                  
                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{activity.emoji}</span>
                      <h3 className="font-bold text-gray-800 dark:text-white text-base">
                        {activity.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {activity.description}
                    </p>
                    
                    {/* Footer de la tarjeta */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                      {activity.available ? (
                        <>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Users size={14} />
                            <span>{classroom?.students?.length || 0} estudiantes</span>
                          </div>
                          <motion.div 
                            animate={hoveredActivity === activity.id ? { x: [0, 5, 0] } : {}}
                            transition={{ duration: 0.5, repeat: hoveredActivity === activity.id ? Infinity : 0 }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r ${activity.gradient} text-white text-xs font-semibold shadow-md`}
                          >
                            <span>Iniciar</span>
                            <ChevronRight size={14} />
                          </motion.div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span className="text-xs text-gray-400 italic">En desarrollo</span>
                          <span className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-medium">
                            Próximamente
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Tips con animación de rotación */}
      <motion.div
        key={currentTipIndex}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-xl"
      >
        {/* Decoración de fondo */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative flex items-start gap-4">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 text-2xl shadow-lg border border-white/20"
          >
            {tips[currentTipIndex].icon}
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb size={16} className="text-yellow-300" />
              <h4 className="font-bold text-sm">
                Consejo del día
              </h4>
              <span className="text-white/50 text-xs">•</span>
              <span className="text-white/70 text-xs font-medium">{tips[currentTipIndex].title}</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">
              {tips[currentTipIndex].text}
            </p>
          </div>
          {/* Indicadores de progreso */}
          <div className="flex gap-1.5 items-center">
            {tips.map((_, i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentTipIndex ? 'bg-white w-4' : 'bg-white/30'}`}
              />
            ))}
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

    </div>
  );
};
