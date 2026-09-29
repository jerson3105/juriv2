import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MonitorUp, Send, Trash2 } from 'lucide-react';
import { useToolKeys } from './helpers';
import { ToolCloseButton } from './ui';

const recentKey = (classroomId: string) => `juried:screen-messages:${classroomId}`;
const MAX_RECENT = 6;

const readRecent = (classroomId: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(recentKey(classroomId)) || '[]');
  } catch {
    return [];
  }
};

// Tamaño del texto proyectado según su longitud: un mensaje corto se ve enorme y uno largo cabe.
const projectedSize = (text: string) => {
  const length = text.trim().length;
  if (length <= 40) return 'text-5xl sm:text-7xl';
  if (length <= 100) return 'text-4xl sm:text-6xl';
  if (length <= 220) return 'text-3xl sm:text-5xl';
  return 'text-2xl sm:text-4xl';
};

// Mensaje en pantalla completa para proyectar (antes "Anuncios"; los avisos a alumnos están en Comunicación).
export const ScreenMessage = ({ classroomId, onClose }: { classroomId: string; onClose: () => void }) => {
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<string[]>(() => readRecent(classroomId));
  const [isProjecting, setIsProjecting] = useState(false);

  const formattedDate = (() => {
    const text = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  })();

  const saveRecent = (next: string[]) => {
    setRecent(next);
    try {
      localStorage.setItem(recentKey(classroomId), JSON.stringify(next));
    } catch {
      // Ignorar: los recientes valen para esta sesión.
    }
  };

  const project = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessage(clean);
    saveRecent([clean, ...recent.filter((m) => m !== clean)].slice(0, MAX_RECENT));
    setIsProjecting(true);
  };

  const onEscape = useCallback(() => {
    if (isProjecting) setIsProjecting(false);
    else onClose();
  }, [isProjecting, onClose]);
  useToolKeys(onEscape);

  if (isProjecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Mensaje proyectado"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-950 p-8 cursor-pointer"
        onClick={() => setIsProjecting(false)}
      >
        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-amber-400/70 rounded-tl-xl" aria-hidden="true" />
        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-amber-400/70 rounded-tr-xl" aria-hidden="true" />
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-amber-400/70 rounded-bl-xl" aria-hidden="true" />
        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-amber-400/70 rounded-br-xl" aria-hidden="true" />
        <div className="max-w-6xl w-full max-h-[75vh] overflow-hidden">
          <p className={`text-white font-bold text-center leading-tight break-words ${projectedSize(message)}`}>{message}</p>
        </div>
        <div className="absolute bottom-12 flex items-center gap-2 text-white/80">
          <Calendar size={16} aria-hidden="true" />
          <span className="text-base font-medium">{formattedDate}</span>
        </div>
        <p className="absolute bottom-4 text-sm text-white/70">Toca la pantalla o pulsa Esc para volver</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Mensaje en pantalla"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-gradient-to-br from-gray-950 via-amber-950 to-orange-950"
    >
      <ToolCloseButton onClose={onClose} />
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
        <h2 className="flex items-center gap-2 text-white/85 text-sm font-semibold tracking-widest uppercase mb-6">
          <MonitorUp size={16} aria-hidden="true" /> Mensaje en pantalla
        </h2>
        <form
          className="w-full max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            project(message);
          }}
        >
          <label htmlFor="screen-message" className="sr-only">Mensaje a proyectar</label>
          <textarea
            id="screen-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) project(message);
            }}
            placeholder="Escribe el mensaje que verá la clase"
            maxLength={400}
            className="w-full h-40 rounded-2xl border-2 border-white/30 bg-white/10 p-5 text-lg text-white placeholder:text-white/60 focus:outline-none focus:border-amber-300 resize-none"
            autoFocus
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-white/80">{message.trim().length}/400 · Ctrl+Enter proyecta</span>
            <button
              type="submit"
              disabled={!message.trim()}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-amber-400 text-gray-900 font-bold hover:bg-amber-300 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              Proyectar
            </button>
          </div>
        </form>

        {recent.length > 0 && (
          <div className="w-full max-w-xl mt-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-white/85">Mensajes recientes</p>
              <button type="button" onClick={() => saveRecent([])} className="inline-flex items-center gap-1 min-h-[36px] px-2 rounded-lg text-sm text-white/85 hover:bg-white/10">
                <Trash2 size={14} aria-hidden="true" /> Borrar lista
              </button>
            </div>
            <ul className="space-y-2">
              {recent.map((text) => (
                <li key={text}>
                  <button
                    type="button"
                    onClick={() => project(text)}
                    className="w-full min-h-[44px] rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-left text-white hover:bg-white/20"
                    title="Proyectar este mensaje"
                  >
                    <span className="line-clamp-2">{text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};
