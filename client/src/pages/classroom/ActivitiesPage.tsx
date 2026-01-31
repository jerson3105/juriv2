import { useState, useEffect } from 'react';
import { 
  Dices, 
  ChevronRight,
  Users,
  Zap,
  Lightbulb,
  Timer,
  ScrollText,
  Map,
  Target,
  Trophy,
} from 'lucide-react';
import { RandomPickerActivity } from '../../components/activities/RandomPickerActivity';
import { RandomEventsActivity } from '../../components/activities/RandomEventsActivity';
import { ClanPickerActivity } from '../../components/activities/ClanPickerActivity';
import { TimedActivitiesActivity } from '../../components/activities/TimedActivitiesActivity';
import { AulaZenActivity } from '../../components/activities/AulaZenActivity';
import { ScrollsActivity } from '../../components/activities/ScrollsActivity';
import { TournamentsActivity } from '../../components/activities/TournamentsActivity';
import { ExpeditionsActivity } from '../../components/activities/ExpeditionsActivity';
import { JiroExpeditionsActivity } from '../../components/activities/JiroExpeditionsActivity';
import { useOutletContext, useParams } from 'react-router-dom';
import RouletteOfDestinyModal from '../../components/modals/RouletteOfDestinyModal';
import ExpeditionTypeModal from '../../components/modals/ExpeditionTypeModal';

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
    id: 'roulette-of-destiny',
    name: 'Ruleta del Destino',
    description: 'Selección aleatoria de estudiantes, clanes o eventos sorpresa. ¡Deja que el azar decida!',
    icon: <Dices size={28} />,
    emoji: '🎲',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    bgGradient: 'from-amber-500/10 via-orange-500/5 to-red-500/10',
    shadowColor: 'shadow-amber-500/30',
    glowColor: 'amber',
    available: true,
    tag: '⭐ Popular',
    tagColor: 'from-amber-400 to-orange-500',
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
    id: 'tournaments',
    name: 'Torneos',
    description: 'Competencias de bracket eliminatorio. ¡Estudiantes o clanes compiten respondiendo preguntas!',
    icon: <Trophy size={28} />,
    emoji: '🏆',
    gradient: 'from-amber-500 via-yellow-500 to-orange-500',
    bgGradient: 'from-amber-500/10 via-yellow-500/5 to-orange-500/10',
    shadowColor: 'shadow-amber-500/30',
    glowColor: 'amber',
    available: true,
    tag: '🆕 Nuevo',
    tagColor: 'from-green-400 to-emerald-500',
  },
  {
    id: 'expeditions-selector',
    name: 'Expediciones',
    description: 'Aventuras de aprendizaje con mapas interactivos. ¡Los estudiantes exploran y completan misiones!',
    icon: <Map size={28} />,
    emoji: '🗺️',
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    bgGradient: 'from-emerald-500/10 via-green-500/5 to-teal-500/10',
    shadowColor: 'shadow-emerald-500/30',
    glowColor: 'emerald',
    available: true,
    tag: '🌟 Aventura',
    tagColor: 'from-emerald-400 to-teal-500',
  },
];

// Consejos rotativos
const tips = [
  { icon: '🎲', title: 'Selección Aleatoria', text: 'Usa la Selección Aleatoria para elegir quién participa en clase. ¡Los estudiantes estarán más atentos!' },
  { icon: '🧘', title: 'Aula Zen', text: 'El medidor de ruido ayuda a mantener un ambiente tranquilo. ¡Recompensa el silencio!' },
  { icon: '💣', title: 'Modo Bomba', text: 'El modo bomba añade emoción a las actividades. ¡Perfecto para respuestas rápidas!' },
  { icon: '🛡️', title: 'Clanes', text: 'Seleccionar clanes promueve la colaboración entre equipos. ¡Todos ganan juntos!' },
];

export const ActivitiesPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  useParams<{ id: string }>();
  
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [showExpeditionModal, setShowExpeditionModal] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Rotación automática de consejos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handler para click en actividad
  const handleActivityClick = (activityId: string) => {
    if (activityId === 'roulette-of-destiny') {
      setShowRouletteModal(true);
    } else if (activityId === 'expeditions-selector') {
      setShowExpeditionModal(true);
    } else {
      setSelectedActivity(activityId);
    }
  };

  // Handler para seleccionar opción de la Ruleta del Destino
  const handleRouletteSelect = (optionId: string) => {
    setSelectedActivity(optionId);
  };

  // Handler para seleccionar tipo de expedición
  const handleExpeditionSelect = (optionId: string) => {
    setSelectedActivity(optionId);
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

  if (selectedActivity === 'tournaments') {
    return (
      <TournamentsActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'expeditions') {
    return (
      <ExpeditionsActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  if (selectedActivity === 'jiro-expeditions') {
    return (
      <JiroExpeditionsActivity 
        classroom={classroom}
        onBack={() => setSelectedActivity(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Épico - Animaciones reducidas */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 rounded-2xl p-6 shadow-2xl">
        {/* Decoración estática de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-4 left-[15%] text-2xl opacity-20">⚡</div>
          <div className="absolute top-8 left-[40%] text-2xl opacity-20">🎮</div>
          <div className="absolute top-4 right-[30%] text-2xl opacity-20">🏆</div>
          <div className="absolute bottom-4 right-[15%] text-2xl opacity-20">⭐</div>
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30">
            <Zap size={32} className="text-white drop-shadow-lg" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white drop-shadow-lg">
                Actividades Gamificadas
              </h1>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold text-white border border-white/30">
                🎮 {activities.filter(a => a.available).length} disponibles
              </span>
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
      </div>

      {/* Grid de actividades - Animaciones simplificadas */}
      <div className="grid md:grid-cols-2 gap-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => activity.available && handleActivityClick(activity.id)}
            className={`
              relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-200
              ${activity.available 
                ? `bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl hover:-translate-y-1 ${activity.shadowColor}` 
                : 'bg-gray-100 dark:bg-gray-800/50 opacity-70 cursor-not-allowed'
              }
            `}
          >
            {/* Fondo con gradiente */}
            <div className={`absolute inset-0 bg-gradient-to-br ${activity.bgGradient} opacity-50`} />
            
            {/* Tag especial */}
            {activity.tag && (
              <div className={`absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r ${activity.tagColor} rounded-full text-[10px] font-bold text-white shadow-lg z-10`}>
                {activity.tag}
              </div>
            )}
            
            <div className="relative p-5">
              <div className="flex items-start gap-4">
                {/* Icono sin animación */}
                <div className={`
                  relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                  bg-gradient-to-br ${activity.gradient} text-white shadow-lg ${activity.shadowColor}
                `}>
                  {activity.icon}
                </div>
                  
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
                        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r ${activity.gradient} text-white text-xs font-semibold shadow-md`}>
                          <span>Iniciar</span>
                          <ChevronRight size={14} />
                        </div>
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
          </div>
        ))}
      </div>

      {/* Tips - Animación simplificada */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-xl">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 text-2xl shadow-lg border border-white/20">
            {tips[currentTipIndex].icon}
          </div>
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
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${i === currentTipIndex ? 'bg-white w-4' : 'bg-white/30 w-2'}`}
              />
            ))}
          </div>
        </div>
      </div>


      {/* Modal de Ruleta del Destino */}
      <RouletteOfDestinyModal
        isOpen={showRouletteModal}
        onClose={() => setShowRouletteModal(false)}
        onSelectOption={handleRouletteSelect}
      />

      {/* Modal de Tipo de Expedición */}
      <ExpeditionTypeModal
        isOpen={showExpeditionModal}
        onClose={() => setShowExpeditionModal(false)}
        onSelectOption={handleExpeditionSelect}
      />

    </div>
  );
};
