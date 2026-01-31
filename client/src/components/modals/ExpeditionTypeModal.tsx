import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, Zap, ChevronRight, Compass } from 'lucide-react';

interface ExpeditionOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  emoji: string;
  gradient: string;
  shadowColor: string;
}

const expeditionOptions: ExpeditionOption[] = [
  {
    id: 'expeditions',
    name: 'Expediciones Clásicas',
    description: 'Aventuras con mapas interactivos. Los estudiantes exploran y completan misiones.',
    icon: <Map size={24} />,
    emoji: '🗺️',
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    shadowColor: 'shadow-emerald-500/30',
  },
  {
    id: 'jiro-expeditions',
    name: 'La Expedición de Jiro',
    description: 'Actividades gamificadas con bancos de preguntas, sistema de energía y entregas.',
    icon: <Zap size={24} />,
    emoji: '🦊',
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    shadowColor: 'shadow-orange-500/30',
  },
];

interface ExpeditionTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (optionId: string) => void;
}

export const ExpeditionTypeModal = ({ 
  isOpen, 
  onClose, 
  onSelectOption 
}: ExpeditionTypeModalProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
              {/* Panel izquierdo - Jiro */}
              <div className="hidden md:block md:w-64 relative overflow-hidden flex-shrink-0">
                <motion.img
                  src="/assets/mascot/jiro-expedicion.jpg"
                  alt="Jiro"
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Panel derecho - Contenido */}
              <div className="flex-1 flex flex-col">
                {/* Header con gradiente */}
                <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-6 pb-8">
                  {/* Partículas decorativas */}
                  <div className="absolute inset-0 overflow-hidden">
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute text-2xl opacity-30"
                        style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 2) * 40}%` }}
                        animate={{ 
                          y: [0, -10, 0], 
                          rotate: [0, 15, -15, 0],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
                      >
                        {['🗺️', '⭐', '🦊', '✨', '🏔️', '💫'][i]}
                      </motion.div>
                    ))}
                  </div>

                  {/* Botón cerrar */}
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors z-10"
                  >
                    <X size={22} className="text-white" />
                  </button>

                  {/* Título */}
                  <div className="relative flex items-center gap-4">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/30"
                    >
                      <Compass size={32} className="text-white" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-black text-white drop-shadow-lg">
                        🗺️ Expediciones
                      </h2>
                      <p className="text-white/80 text-sm mt-1">
                        Elige el tipo de expedición que deseas crear
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opciones */}
                <div className="p-6 space-y-3">
                  {expeditionOptions.map((option, index) => (
                    <motion.button
                      key={option.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onSelectOption(option.id);
                        onClose();
                      }}
                      className="w-full group"
                    >
                      <div className={`
                        relative overflow-hidden rounded-2xl p-4 
                        bg-gradient-to-r from-gray-50 to-gray-100 
                        dark:from-gray-700/50 dark:to-gray-700/30
                        hover:from-gray-100 hover:to-gray-50
                        dark:hover:from-gray-700 dark:hover:to-gray-600
                        border border-gray-200 dark:border-gray-600
                        transition-all duration-300
                        ${option.shadowColor}
                      `}>
                        <div className="flex items-center gap-4">
                          {/* Icono */}
                          <div className={`
                            w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                            bg-gradient-to-br ${option.gradient} text-white shadow-lg
                            group-hover:scale-110 transition-transform duration-300
                          `}>
                            {option.icon}
                          </div>

                          {/* Contenido */}
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{option.emoji}</span>
                              <h3 className="font-bold text-gray-800 dark:text-white">
                                {option.name}
                              </h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {option.description}
                            </p>
                          </div>

                          {/* Flecha */}
                          <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className={`
                              w-10 h-10 rounded-xl flex items-center justify-center
                              bg-gradient-to-br ${option.gradient} text-white
                              opacity-0 group-hover:opacity-100 transition-opacity duration-300
                            `}
                          >
                            <ChevronRight size={20} />
                          </motion.div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <Zap size={14} />
                    <span>Selecciona una opción para comenzar</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExpeditionTypeModal;
