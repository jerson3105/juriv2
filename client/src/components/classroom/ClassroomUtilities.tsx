import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Shuffle,
  Users,
  Megaphone,
  Dices,
  RefreshCw,
  Send,
  Minus,
  Plus,
  Calendar,
} from 'lucide-react';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../lib/avatarApi';

interface StudentData {
  id: string;
  characterName: string | null;
  realName: string | null;
  realLastName: string | null;
  avatarGender: 'MALE' | 'FEMALE';
  characterClass: string;
}

interface ClassroomUtilitiesProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  showCharacterName?: boolean;
}

type ActiveTool = null | 'random' | 'groups' | 'announcement';

const getDisplayName = (student: StudentData, showCharacterName: boolean) => {
  if (!showCharacterName) {
    if (student.realName && student.realLastName) {
      return `${student.realLastName}, ${student.realName}`;
    }
    return student.realName || student.characterName || 'Sin nombre';
  }
  return student.characterName || 'Sin nombre';
};

// ─── Tool Selection Modal ────────────────────────────────────────────
const ToolSelector = ({
  onSelect,
  onClose,
}: {
  onSelect: (tool: ActiveTool) => void;
  onClose: () => void;
}) => {
  const tools = [
    {
      id: 'random' as const,
      icon: Dices,
      title: 'Elección aleatoria',
      description: 'Elige un estudiante al azar con una animación divertida',
      gradient: 'from-purple-500 to-indigo-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      hover: 'hover:border-purple-400 dark:hover:border-purple-600',
    },
    {
      id: 'groups' as const,
      icon: Users,
      title: 'Creador de grupos',
      description: 'Organiza a tus estudiantes en grupos rápidamente',
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:border-blue-400 dark:hover:border-blue-600',
    },
    {
      id: 'announcement' as const,
      icon: Megaphone,
      title: 'Anuncios',
      description: 'Proyecta un mensaje en pantalla completa',
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:border-amber-400 dark:hover:border-amber-600',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shuffle className="text-indigo-500" size={20} />
              Utilidades
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Herramientas rápidas para tu clase
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onSelect(tool.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${tool.border} ${tool.bg} ${tool.hover} transition-all text-left group`}
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}
              >
                <tool.icon size={22} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white text-sm">
                  {tool.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {tool.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Random Picker ───────────────────────────────────────────────────
const RandomPicker = ({
  students,
  showCharacterName,
  onClose,
}: {
  students: StudentData[];
  showCharacterName: boolean;
  onClose: () => void;
}) => {
  const [isSpinning, setIsSpinning] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spin = useCallback(() => {
    if (students.length === 0) return;
    setIsSpinning(true);
    setSelectedStudent(null);

    let speed = 50;
    let elapsed = 0;
    const totalDuration = 2500;

    const tick = () => {
      setCurrentIndex((prev) => (prev + 1) % students.length);
      elapsed += speed;

      if (elapsed >= totalDuration) {
        // Done — pick final
        const finalIdx = Math.floor(Math.random() * students.length);
        setCurrentIndex(finalIdx);
        setSelectedStudent(students[finalIdx]);
        setIsSpinning(false);
        return;
      }

      // Slow down gradually
      speed = 50 + (elapsed / totalDuration) * 250;
      intervalRef.current = setTimeout(tick, speed);
    };

    if (intervalRef.current) clearTimeout(intervalRef.current);
    intervalRef.current = setTimeout(tick, speed);
  }, [students]);

  useEffect(() => {
    spin();
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [spin]);

  const displayStudent = selectedStudent || students[currentIndex];

  if (students.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center z-[9999]"
      >
        <p className="text-white text-xl">No hay estudiantes en la clase</p>
        <button onClick={onClose} className="mt-4 px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors">
          Cerrar
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center z-[9999]"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
      >
        <X size={24} />
      </button>

      <h2 className="text-white/60 text-sm font-medium tracking-widest uppercase mb-4">
        Elección aleatoria
      </h2>

      {/* Student display */}
      <motion.div
        key={isSpinning ? currentIndex : 'final'}
        initial={!isSpinning ? { scale: 0.8, opacity: 0 } : {}}
        animate={!isSpinning ? { scale: 1, opacity: 1 } : {}}
        transition={!isSpinning ? { type: 'spring', damping: 12, stiffness: 200 } : {}}
        className="flex flex-col items-center"
      >
        <div
          className={`w-36 h-56 sm:w-44 sm:h-72 rounded-3xl overflow-hidden bg-white/10 backdrop-blur-sm border-4 ${
            isSpinning
              ? 'border-white/30'
              : 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.4)]'
          } transition-all duration-300 flex items-end justify-center`}
        >
          {displayStudent && (
            <StudentAvatarMini
              studentProfileId={displayStudent.id}
              gender={displayStudent.avatarGender as AvatarGender}
              size="md"
            />
          )}
        </div>

        <motion.p
          key={isSpinning ? currentIndex : 'final-name'}
          className={`mt-6 text-2xl sm:text-3xl font-bold text-center px-4 ${
            isSpinning ? 'text-white/70' : 'text-white'
          }`}
        >
          {displayStudent ? getDisplayName(displayStudent, showCharacterName) : ''}
        </motion.p>

        {!isSpinning && selectedStudent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-2 text-purple-300 text-sm"
          >
            ¡Elegido!
          </motion.div>
        )}
      </motion.div>

      {/* Action buttons */}
      <div className="mt-12 flex gap-4">
        <button
          onClick={() => spin()}
          disabled={isSpinning}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          <RefreshCw size={18} className={isSpinning ? 'animate-spin' : ''} />
          Volver a elegir
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </motion.div>
  );
};

// ─── Group Creator ───────────────────────────────────────────────────
const GroupCreator = ({
  students,
  showCharacterName,
  onClose,
}: {
  students: StudentData[];
  showCharacterName: boolean;
  onClose: () => void;
}) => {
  const [perGroup, setPerGroup] = useState(Math.min(4, Math.max(2, Math.ceil(students.length / 4))));
  const [groups, setGroups] = useState<StudentData[][]>([]);

  const generate = useCallback(() => {
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const result: StudentData[][] = [];
    for (let i = 0; i < shuffled.length; i += perGroup) {
      result.push(shuffled.slice(i, i + perGroup));
    }
    setGroups(result);
  }, [students, perGroup]);

  useEffect(() => {
    generate();
  }, [generate]);

  const groupColors = [
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-red-500 to-rose-500',
    'from-indigo-500 to-violet-500',
    'from-lime-500 to-green-500',
    'from-fuchsia-500 to-purple-500',
    'from-sky-500 to-blue-500',
    'from-yellow-500 to-amber-500',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 flex flex-col z-[9999] overflow-hidden"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
      >
        <X size={24} />
      </button>

      {/* Header */}
      <div className="flex-shrink-0 pt-6 pb-4 px-6 text-center">
        <h2 className="text-white/60 text-sm font-medium tracking-widest uppercase mb-2">
          Creador de grupos
        </h2>
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="text-white/70 text-sm">Alumnos por grupo:</span>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2 py-1">
            <button
              onClick={() => setPerGroup((p) => Math.max(2, p - 1))}
              className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Minus size={16} />
            </button>
            <span className="text-white font-bold text-lg w-8 text-center">{perGroup}</span>
            <button
              onClick={() => setPerGroup((p) => Math.min(students.length, p + 1))}
              className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={generate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-700 transition-all text-sm shadow-lg"
          >
            <Shuffle size={14} />
            Reorganizar
          </button>
        </div>
        <p className="text-white/40 text-xs mt-2">
          {groups.length} grupo{groups.length !== 1 ? 's' : ''} · {students.length} estudiantes
        </p>
      </div>

      {/* Groups grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {groups.map((group, gIdx) => (
            <motion.div
              key={`${gIdx}-${group.map((s) => s.id).join(',')}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gIdx * 0.05 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10"
            >
              <div
                className={`bg-gradient-to-r ${groupColors[gIdx % groupColors.length]} px-4 py-2.5`}
              >
                <span className="text-white font-bold text-sm">
                  Grupo {gIdx + 1}
                </span>
                <span className="text-white/70 text-xs ml-2">
                  ({group.length} {group.length === 1 ? 'alumno' : 'alumnos'})
                </span>
              </div>
              <div className="p-3 space-y-2">
                {group.map((student, sIdx) => (
                  <div key={student.id} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                      <span className="text-white/60 text-[10px] font-bold">{sIdx + 1}</span>
                    </div>
                    <span className="text-white text-sm truncate">
                      {getDisplayName(student, showCharacterName)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Announcement Projector ──────────────────────────────────────────
const AnnouncementProjector = ({ onClose }: { onClose: () => void }) => {
  const [message, setMessage] = useState('');
  const [isProjecting, setIsProjecting] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Capitalize first letter
  const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  if (isProjecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex flex-col items-center justify-center z-[9999] p-8"
        onClick={() => setIsProjecting(false)}
      >
        {/* Decorative corners */}
        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-amber-400/60 rounded-tl-xl" />
        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-amber-400/60 rounded-tr-xl" />
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-amber-400/60 rounded-bl-xl" />
        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-amber-400/60 rounded-br-xl" />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-6"
        >
          <Megaphone size={24} className="text-amber-400" />
          <span className="text-amber-400 font-bold text-lg tracking-widest uppercase">
            Anuncio
          </span>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', damping: 15 }}
          className="max-w-4xl w-full"
        >
          <p className="text-white text-3xl sm:text-4xl md:text-5xl font-bold text-center leading-relaxed">
            {message}
          </p>
        </motion.div>

        {/* Date */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-12 flex items-center gap-2 text-white/40"
        >
          <Calendar size={14} />
          <span className="text-sm font-medium">{formattedDate}</span>
        </motion.div>

        {/* Close hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-4 text-white/20 text-xs"
        >
          Toca en cualquier lugar para volver
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-amber-900 to-orange-900 flex flex-col items-center justify-center z-[9999] p-6"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>

      <h2 className="text-white/60 text-sm font-medium tracking-widest uppercase mb-6">
        Anuncios
      </h2>

      <div className="w-full max-w-lg">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu anuncio aquí..."
          className="w-full h-40 bg-white/10 border-2 border-white/20 rounded-2xl p-5 text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-amber-400/60 resize-none transition-colors"
          autoFocus
        />

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Calendar size={12} />
            <span>{formattedDate}</span>
          </div>
          <button
            onClick={() => {
              if (!message.trim()) return;
              setIsProjecting(true);
            }}
            disabled={!message.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <Send size={16} />
            Proyectar
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export const ClassroomUtilities = ({
  isOpen,
  onClose,
  students,
  showCharacterName = true,
}: ClassroomUtilitiesProps) => {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  // Reset tool when modal closes
  useEffect(() => {
    if (!isOpen) setActiveTool(null);
  }, [isOpen]);

  const handleClose = () => {
    setActiveTool(null);
    onClose();
  };

  const handleToolClose = () => {
    setActiveTool(null);
  };

  if (!isOpen && !activeTool) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && !activeTool && (
          <ToolSelector
            key="tool-selector"
            onSelect={setActiveTool}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTool === 'random' && (
          <RandomPicker
            key="random-picker"
            students={students}
            showCharacterName={showCharacterName}
            onClose={handleToolClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTool === 'groups' && (
          <GroupCreator
            key="group-creator"
            students={students}
            showCharacterName={showCharacterName}
            onClose={handleToolClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTool === 'announcement' && (
          <AnnouncementProjector key="announcement" onClose={handleToolClose} />
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
