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
  ClipboardList,
  Check,
  Trash2,
  BookOpen,
  FileCheck,
  Package,
  MoreHorizontal,
  Monitor,
  Pause,
  Play,
  SkipForward,
  Timer,
} from 'lucide-react';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import type { AvatarGender } from '../../lib/avatarApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { classNoteApi } from '../../lib/classNoteApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface StudentData {
  id: string;
  characterName: string | null;
  realName: string | null;
  realLastName: string | null;
  avatarGender: 'MALE' | 'FEMALE';
  characterClass: string;
  characterClassId?: string | null;
  level: number;
  xp: number;
  hp: number;
  gp: number;
  teamId?: string | null;
  clanName?: string | null;
  clanColor?: string | null;
  clanEmblem?: string | null;
  clanMotto?: string | null;
}

interface ClassroomUtilitiesProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentData[];
  showCharacterName?: boolean;
  classroomId: string;
}

type ActiveTool = null | 'random' | 'groups' | 'announcement' | 'notes' | 'showcase';

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
  pendingNotesCount,
}: {
  onSelect: (tool: ActiveTool) => void;
  onClose: () => void;
  pendingNotesCount: number;
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
    {
      id: 'notes' as const,
      icon: ClipboardList,
      title: 'Notas de clase',
      description: 'Anota tareas, páginas y pendientes para la siguiente clase',
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      hover: 'hover:border-emerald-400 dark:hover:border-emerald-600',
      badge: pendingNotesCount,
    },
    {
      id: 'showcase' as const,
      icon: Monitor,
      title: 'Desfile de Héroes',
      description: 'Muestra los personajes de tus estudiantes en pantalla completa',
      gradient: 'from-pink-500 to-rose-600',
      bg: 'bg-pink-50 dark:bg-pink-900/20',
      border: 'border-pink-200 dark:border-pink-800',
      hover: 'hover:border-pink-400 dark:hover:border-pink-600',
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
              {'badge' in tool && typeof tool.badge === 'number' && tool.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                  {tool.badge}
                </span>
              )}
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
      <div className="flex items-center justify-center gap-8">
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

        {/* Clan info */}
        {!isSpinning && selectedStudent?.teamId && selectedStudent?.clanName && (
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', damping: 15 }}
            className="flex flex-col items-center"
          >
            <div
              className="w-48 rounded-2xl border-2 p-5 backdrop-blur-sm text-center"
              style={{ borderColor: selectedStudent.clanColor || '#6366f1', backgroundColor: `${selectedStudent.clanColor || '#6366f1'}20` }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl mb-3"
              >
                {CLAN_EMBLEMS[selectedStudent.clanEmblem || 'shield'] || '🛡️'}
              </motion.div>
              <h3 className="text-lg font-bold text-white drop-shadow-md mb-1">
                {selectedStudent.clanName}
              </h3>
              {selectedStudent.clanMotto && (
                <p className="text-xs text-white/70 italic leading-snug">
                  "{selectedStudent.clanMotto}"
                </p>
              )}
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: `${selectedStudent.clanColor || '#6366f1'}90` }}
              >
                <Users size={12} />
                Clan
              </div>
            </div>
          </motion.div>
        )}
      </div>

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

// ─── Class Notes ─────────────────────────────────────────────────────
const NOTE_CATEGORIES = [
  { id: 'task', label: 'Tarea', icon: FileCheck, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  { id: 'review', label: 'Revisar', icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
  { id: 'material', label: 'Material', icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
  { id: 'other', label: 'Otro', icon: MoreHorizontal, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
] as const;

const ClassNotes = ({
  classroomId,
  onClose,
}: {
  classroomId: string;
  onClose: () => void;
}) => {
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<string>('task');
  const [newDueDate, setNewDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['class-notes', classroomId],
    queryFn: () => classNoteApi.list(classroomId),
  });

  const createMutation = useMutation({
    mutationFn: () => classNoteApi.create(classroomId, newContent, newCategory, newDueDate || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-notes', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['class-notes-count', classroomId] });
      setNewContent('');
      setNewDueDate('');
      inputRef.current?.focus();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (noteId: string) => classNoteApi.toggleComplete(classroomId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-notes', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['class-notes-count', classroomId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => classNoteApi.remove(classroomId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-notes', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['class-notes-count', classroomId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    createMutation.mutate();
  };

  const filteredNotes = notes.filter(note => {
    if (filter === 'pending') return !note.isCompleted;
    if (filter === 'completed') return note.isCompleted;
    return true;
  });

  const pendingCount = notes.filter(n => !n.isCompleted).length;
  const completedCount = notes.filter(n => n.isCompleted).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 flex flex-col items-center z-[9999]"
    >
      {/* Header */}
      <div className="w-full max-w-2xl px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white/60 text-sm font-medium tracking-widest uppercase">
              Notas de clase
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} · {completedCount} completada{completedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* New note form */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2 mb-2">
            <input
              ref={inputRef}
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ej: Revisar pág. 45-50, Recoger cuadernos..."
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/60 text-sm transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newContent.trim() || createMutation.isPending}
              className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg text-sm"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex gap-2 items-center">
            {/* Category pills */}
            <div className="flex gap-1.5 flex-1 flex-wrap">
              {NOTE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewCategory(cat.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    newCategory === cat.id
                      ? `${cat.bg} ${cat.color} border ${cat.border}`
                      : 'bg-white/5 text-white/40 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <cat.icon size={12} />
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Due date */}
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white/70 text-xs focus:outline-none focus:border-emerald-400/60 transition-colors [color-scheme:dark]"
            />
          </div>
        </form>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1">
          {([
            { key: 'pending', label: `Pendientes (${pendingCount})` },
            { key: 'completed', label: `Completadas (${completedCount})` },
            { key: 'all', label: 'Todas' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === tab.key
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 w-full max-w-2xl overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="text-center text-white/40 py-8">
            <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-emerald-400 rounded-full mx-auto mb-2" />
            Cargando notas...
          </div>
        ) : filteredNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <ClipboardList size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {filter === 'pending' ? 'No hay notas pendientes. ¡Todo al día!' : filter === 'completed' ? 'No hay notas completadas aún.' : 'No hay notas. Añade una arriba.'}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotes.map(note => {
              const catInfo = NOTE_CATEGORIES.find(c => c.id === note.category) || NOTE_CATEGORIES[3];
              const dueDate = note.dueDate ? new Date(note.dueDate) : null;
              const isOverdue = dueDate && !note.isCompleted && dueDate < new Date();

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    note.isCompleted
                      ? 'bg-white/5 border-white/10 opacity-60'
                      : 'bg-white/10 border-white/15 hover:bg-white/15'
                  }`}
                >
                  {/* Toggle button */}
                  <button
                    onClick={() => toggleMutation.mutate(note.id)}
                    disabled={toggleMutation.isPending}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      note.isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-white/30 hover:border-emerald-400'
                    }`}
                  >
                    {note.isCompleted && <Check size={12} />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${note.isCompleted ? 'text-white/40 line-through' : 'text-white'}`}>
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${catInfo.bg} ${catInfo.color}`}>
                        <catInfo.icon size={10} />
                        {catInfo.label}
                      </span>
                      {dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
                          <Calendar size={10} />
                          {dueDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                          {isOverdue && ' · Vencida'}
                        </span>
                      )}
                      <span className="text-[10px] text-white/25">
                        {new Date(note.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-white/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

// ─── Hero Showcase (Desfile de Héroes) ───────────────────────────────
const SPEED_OPTIONS = [
  { label: '4s', value: 4000 },
  { label: '6s', value: 6000 },
  { label: '8s', value: 8000 },
];

const HeroShowcase = ({
  students,
  showCharacterName,
  classroomId,
  onClose,
}: {
  students: StudentData[];
  showCharacterName: boolean;
  classroomId: string;
  onClose: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isRandom, setIsRandom] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // default 6s
  const [order, setOrder] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { classMap } = useCharacterClasses(classroomId);

  // Build display order
  useEffect(() => {
    if (students.length === 0) return;
    if (isRandom) {
      const indices = students.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setOrder(indices);
    } else {
      setOrder(students.map((_, i) => i));
    }
    setCurrentIndex(0);
  }, [students, isRandom]);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || students.length === 0 || order.length === 0) return;
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % order.length);
    }, SPEED_OPTIONS[speedIdx].value);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isPaused, speedIdx, order, students.length]);

  const goNext = () => {
    if (order.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % order.length);
  };

  if (students.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gradient-to-br from-gray-900 via-pink-900 to-rose-900 flex flex-col items-center justify-center z-[9999]"
      >
        <p className="text-white text-xl">No hay estudiantes en la clase</p>
        <button onClick={onClose} className="mt-4 px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors">
          Cerrar
        </button>
      </motion.div>
    );
  }

  const student = students[order[currentIndex] ?? 0];
  if (!student) return null;

  const classInfo = classMap[student.characterClassId!] || classMap[student.characterClass];
  const xpForNextLevel = student.level * 100;
  const xpProgress = Math.min((student.xp / xpForNextLevel) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex flex-col items-center justify-center z-[9999] overflow-hidden"
    >
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Decorative corners */}
      <div className="absolute top-6 left-6 w-14 h-14 border-t-4 border-l-4 border-pink-400/40 rounded-tl-xl" />
      <div className="absolute top-6 right-6 w-14 h-14 border-t-4 border-r-4 border-pink-400/40 rounded-tr-xl" />
      <div className="absolute bottom-20 left-6 w-14 h-14 border-b-4 border-l-4 border-pink-400/40 rounded-bl-xl" />
      <div className="absolute bottom-20 right-6 w-14 h-14 border-b-4 border-r-4 border-pink-400/40 rounded-br-xl" />

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2">
        <span className="text-white/30 text-xs font-medium tracking-widest uppercase">
          {currentIndex + 1} / {order.length}
        </span>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
      >
        <X size={24} />
      </button>

      {/* Hero Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={student.id}
          initial={{ opacity: 0, x: 80, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -80, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="flex flex-col md:flex-row items-center gap-6 md:gap-10 px-4"
        >
          {/* Avatar */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 15 }}
            className="relative"
          >
            <div
              className="w-44 h-72 sm:w-52 sm:h-[364px] rounded-3xl overflow-hidden backdrop-blur-sm border-4 flex items-end justify-center"
              style={{
                borderColor: classInfo?.color || '#ec4899',
                boxShadow: `0 0 50px ${classInfo?.color || '#ec4899'}30`,
                background: `linear-gradient(135deg, ${classInfo?.color || '#ec4899'}15, transparent)`,
              }}
            >
              <StudentAvatarMini
                studentProfileId={student.id}
                gender={student.avatarGender as AvatarGender}
                size="lg"
              />
            </div>
            {/* Level badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', damping: 10, stiffness: 250 }}
              className="absolute -top-3 -right-3 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg ring-4 ring-gray-900"
            >
              <div className="text-center">
                <p className="text-[10px] font-medium text-amber-900 leading-none">Nv</p>
                <p className="text-lg font-black text-white leading-none">{student.level}</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="flex flex-col items-center md:items-start gap-4 min-w-[260px]"
          >
            {/* Name */}
            <div className="text-center md:text-left">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg"
              >
                {getDisplayName(student, showCharacterName)}
              </motion.h2>
              {/* Class info */}
              {classInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center gap-2 mt-2 justify-center md:justify-start"
                >
                  <span className="text-2xl">{classInfo.icon}</span>
                  <span className="text-lg font-semibold" style={{ color: classInfo.color }}>
                    {classInfo.name}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full space-y-3 bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10"
            >
              {/* XP Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Experiencia</span>
                  <span className="text-xs text-white/50">{student.xp} / {xpForNextLevel} XP</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  />
                </div>
              </div>

              {/* HP & GP */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-300 font-semibold uppercase tracking-wider mb-1">❤️ Vida</p>
                  <p className="text-2xl font-black text-white">{student.hp}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider mb-1">🪙 Oro</p>
                  <p className="text-2xl font-black text-white">{student.gp}</p>
                </div>
              </div>
            </motion.div>

            {/* Clan */}
            {student.clanName && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55, type: 'spring', damping: 15 }}
                className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 w-full"
              >
                <motion.span
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl"
                >
                  {CLAN_EMBLEMS[student.clanEmblem || 'shield'] || '🛡️'}
                </motion.span>
                <div>
                  <p className="text-sm font-bold text-white">{student.clanName}</p>
                  {student.clanMotto && (
                    <p className="text-[11px] text-white/50 italic">"{student.clanMotto}"</p>
                  )}
                </div>
                {student.clanColor && (
                  <div
                    className="ml-auto w-4 h-4 rounded-full ring-2 ring-white/20"
                    style={{ backgroundColor: student.clanColor }}
                  />
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Controls */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10"
      >
        {/* Pause / Play */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-2.5 hover:bg-white/10 rounded-xl text-white transition-colors"
          title={isPaused ? 'Reanudar' : 'Pausar'}
        >
          {isPaused ? <Play size={18} /> : <Pause size={18} />}
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Next */}
        <button
          onClick={goNext}
          className="p-2.5 hover:bg-white/10 rounded-xl text-white transition-colors"
          title="Siguiente"
        >
          <SkipForward size={18} />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Random toggle */}
        <button
          onClick={() => setIsRandom(!isRandom)}
          className={`p-2.5 rounded-xl transition-colors ${
            isRandom ? 'bg-pink-500/30 text-pink-300' : 'hover:bg-white/10 text-white/60'
          }`}
          title={isRandom ? 'Orden secuencial' : 'Orden aleatorio'}
        >
          <Shuffle size={18} />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Speed */}
        <button
          onClick={() => setSpeedIdx((prev) => (prev + 1) % SPEED_OPTIONS.length)}
          className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/10 rounded-xl text-white/70 text-xs font-medium transition-colors"
          title="Velocidad"
        >
          <Timer size={14} />
          {SPEED_OPTIONS[speedIdx].label}
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export const ClassroomUtilities = ({
  isOpen,
  onClose,
  students,
  showCharacterName = true,
  classroomId,
}: ClassroomUtilitiesProps) => {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  const { data: pendingNotesCount = 0 } = useQuery({
    queryKey: ['class-notes-count', classroomId],
    queryFn: () => classNoteApi.pendingCount(classroomId),
    enabled: !!classroomId,
  });

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
            pendingNotesCount={pendingNotesCount}
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
      <AnimatePresence>
        {activeTool === 'notes' && (
          <ClassNotes key="notes" classroomId={classroomId} onClose={handleToolClose} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTool === 'showcase' && (
          <HeroShowcase
            key="showcase"
            students={students}
            showCharacterName={showCharacterName}
            classroomId={classroomId}
            onClose={handleToolClose}
          />
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
