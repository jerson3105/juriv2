import { useCallback } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { ClipboardList, Clock, Dices, Monitor, MonitorUp, Timer, Users, Wrench, X, type LucideIcon } from 'lucide-react';
import { TIMER_PRESETS_MINUTES } from '../../../lib/timerPresets';
import { useToolKeys } from './helpers';

export type ToolId = 'random' | 'groups' | 'message' | 'notes' | 'showcase';

interface ToolSelectorProps {
  onSelect: (tool: ToolId) => void;
  onClose: () => void;
  pendingNotesCount: number;
  onStartTimer: (minutes: number) => void;
  onOpenTimer: () => void;
  onOpenStopwatch: () => void;
}

const TOOLS: { id: ToolId; icon: LucideIcon; title: string; description: string; tile: string }[] = [
  { id: 'random', icon: Dices, title: 'Elección aleatoria', description: 'Elige a un estudiante sin repetir y dale puntos ahí mismo', tile: 'from-purple-600 to-indigo-600' },
  { id: 'groups', icon: Users, title: 'Creador de grupos', description: 'Grupos equilibrados por tamaño o por número', tile: 'from-blue-600 to-cyan-600' },
  { id: 'message', icon: MonitorUp, title: 'Mensaje en pantalla', description: 'Proyecta un mensaje grande para toda la clase', tile: 'from-amber-600 to-orange-600' },
  { id: 'notes', icon: ClipboardList, title: 'Notas de clase', description: 'Tareas, páginas y pendientes para la siguiente clase', tile: 'from-emerald-600 to-teal-600' },
  { id: 'showcase', icon: Monitor, title: 'Desfile de héroes', description: 'Muestra los personajes de tus estudiantes en pantalla completa', tile: 'from-pink-600 to-rose-600' },
];

export const ToolSelector = ({ onSelect, onClose, pendingNotesCount, onStartTimer, onOpenTimer, onOpenStopwatch }: ToolSelectorProps) => {
  // Mientras sale (al abrir una herramienta) ya no responde a Escape: si no, cerraría la herramienta recién abierta.
  const isPresent = useIsPresent();
  const handleEscape = useCallback(() => {
    if (isPresent) onClose();
  }, [isPresent, onClose]);
  useToolKeys(handleEscape);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tools-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 id="tools-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <Wrench className="text-primary-600 dark:text-primary-400" size={20} aria-hidden="true" />
              Herramientas de clase
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">Para usar en plena clase · Esc para cerrar</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.9fr] gap-4 p-5">
          <div className="space-y-3">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelect(tool.id)}
                className="group w-full flex items-center gap-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4 text-left hover:border-primary-400 dark:hover:border-primary-500"
              >
                <span className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br ${tool.tile} text-white shadow-md`} aria-hidden="true">
                  <tool.icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900 dark:text-white">{tool.title}</span>
                  <span className="block text-sm text-gray-600 dark:text-gray-300">{tool.description}</span>
                </span>
                {tool.id === 'notes' && pendingNotesCount > 0 && (
                  <span className="ml-auto min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold" aria-label={`${pendingNotesCount} pendientes`}>
                    {pendingNotesCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-primary-100 dark:border-primary-900/60 bg-primary-50/70 dark:bg-primary-950/30 p-4 space-y-4">
            <div>
              <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <Timer size={18} className="text-primary-700 dark:text-primary-300" aria-hidden="true" />
                Temporizador
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Toca los minutos y empieza al instante</p>
              <div className="flex flex-wrap gap-2">
                {TIMER_PRESETS_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onStartTimer(m)}
                    className="min-h-[44px] min-w-[56px] px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold"
                  >
                    {m} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenTimer}
                  className="min-h-[44px] px-3 rounded-xl border border-primary-300 dark:border-primary-700 text-primary-800 dark:text-primary-200 font-semibold hover:bg-white dark:hover:bg-gray-800"
                >
                  Otro tiempo
                </button>
              </div>
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <Clock size={18} className="text-teal-700 dark:text-teal-300" aria-hidden="true" />
                Cronómetro
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Cuenta el tiempo transcurrido</p>
              <button
                type="button"
                onClick={onOpenStopwatch}
                className="min-h-[44px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold"
              >
                Abrir cronómetro
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ambos quedan flotando en la pantalla y tienen modo pantalla completa para proyectar.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
