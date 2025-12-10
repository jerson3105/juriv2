import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, Skull, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BossBattleTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
}

const BossBattleTypeModal = ({ isOpen, onClose, classroomId, onSelectClassic }: BossBattleTypeModalProps & { onSelectClassic?: () => void }) => {
  const navigate = useNavigate();

  const handleSelect = (type: 'classic' | 'student') => {
    onClose();
    if (type === 'classic') {
      // Llamar callback para abrir la actividad clásica
      onSelectClassic?.();
    } else {
      navigate(`/classroom/${classroomId}/boss-battles/student`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white relative">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Swords size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Boss Battles</h2>
                    <p className="text-white/80">Selecciona el tipo de batalla</p>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="p-6 grid md:grid-cols-2 gap-4">
                {/* Classic Boss Battle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect('classic')}
                  className="p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                      <Target size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                        Boss Battle Clásica
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Batalla en tiempo real donde el profesor controla las preguntas y los estudiantes responden en vivo.
                      </p>
                      <ul className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Preguntas controladas por el profesor
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Respuestas en tiempo real
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Ideal para clases presenciales
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.button>

                {/* Student Boss Battle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect('student')}
                  className="p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                      <Skull size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                        Boss Battle Cooperativa
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Los estudiantes trabajan juntos para derrotar al boss respondiendo preguntas a su propio ritmo.
                      </p>
                      <ul className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          HP compartido del boss
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Preguntas del banco de preguntas
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Ideal para tareas asíncronas
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  Puedes crear batallas de ambos tipos según las necesidades de tu clase
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BossBattleTypeModal;
