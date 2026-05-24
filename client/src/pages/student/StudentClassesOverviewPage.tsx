import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileCheck,
  MoreHorizontal,
  Package,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useStudentOverviewData } from '../../hooks/useStudentOverviewData';
import type { ThemeConfig } from '../../lib/storyApi';
import { useStudentStore } from '../../store/studentStore';

type StoryOutletContext = {
  storyTheme?: unknown;
  isThemeDark?: boolean;
};

const NOTE_CATEGORY_CONFIG = {
  task: { label: 'Tarea', icon: FileCheck, tone: 'bg-blue-100 text-blue-700' },
  review: { label: 'Revisar', icon: BookOpen, tone: 'bg-amber-100 text-amber-700' },
  material: { label: 'Material', icon: Package, tone: 'bg-violet-100 text-violet-700' },
  other: { label: 'Otro', icon: MoreHorizontal, tone: 'bg-slate-100 text-slate-700' },
} as const;

const isFutureDatedNote = (dueDate: string | null) => {
  if (!dueDate) return false;

  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const noteDate = new Date(dueDate);
  const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate()).getTime();

  return noteDay > currentDay;
};

const parseThemeConfig = (rawTheme: unknown): ThemeConfig | null => {
  if (!rawTheme) return null;

  if (typeof rawTheme === 'string') {
    try {
      return JSON.parse(rawTheme) as ThemeConfig;
    } catch {
      return null;
    }
  }

  return rawTheme as ThemeConfig;
};

export const StudentClassesOverviewPage = () => {
  const navigate = useNavigate();
  const { setSelectedClassIndex } = useStudentStore();
  const { storyTheme, isThemeDark } = useOutletContext<StoryOutletContext>();
  const hasTheme = !!storyTheme;
  const { myClasses, isLoading, classroomNotes } = useStudentOverviewData();

  const handleOpenClass = (index: number) => {
    setSelectedClassIndex(index);
    navigate('/my-class');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 rounded-3xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (myClasses.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-xl text-center space-y-5">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/20">
            <Users className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Aún no estás en ninguna clase</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Cuando te unas a una clase, aquí podrás revisar sus notas y entrar directamente a cada espacio.
            </p>
          </div>
          <div className="flex justify-center">
            <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/join-class')}>
              Unirme a una clase
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 ${hasTheme ? '' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-gray-950'}`}>
      {!hasTheme && (
        <>
          <div className="absolute top-20 right-10 h-64 w-64 rounded-full bg-sky-200 opacity-20 blur-3xl dark:bg-sky-950 dark:opacity-30" />
          <div className="absolute left-10 top-44 h-64 w-64 rounded-full bg-violet-200 opacity-20 blur-3xl dark:bg-violet-950 dark:opacity-30" />
        </>
      )}

      <div className="relative z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border p-5 shadow-lg md:p-6 ${hasTheme && isThemeDark ? 'border-white/10 bg-white/10 shadow-black/20' : hasTheme ? 'border-white/40 bg-white/70 shadow-black/5' : 'border-white/60 bg-white/80 shadow-sky-500/10 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20'}`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${hasTheme && isThemeDark ? 'bg-white/10 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  Mis clases
                </h1>
                <p className={`mt-2 max-w-2xl text-sm ${hasTheme && isThemeDark ? 'text-white/65' : 'text-slate-500 dark:text-gray-400'}`}>
                  Revisa las notas activas de cada clase y entra directamente al aula que quieras continuar.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 md:justify-end">
              <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/join-class')}>
                Unirme a otra clase
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {myClasses.map((profile, index) => {
            const themeConfig = parseThemeConfig(profile.classroom?.themeConfig);
            const hasClassroomTheme = !!(themeConfig?.colors?.primary && themeConfig?.colors?.secondary);
            const primary = themeConfig?.colors?.primary || '#8b5cf6';
            const secondary = themeConfig?.colors?.secondary || '#7c3aed';
            const emoji = themeConfig?.banner?.emoji;
            const notes = [...(classroomNotes[index]?.notes ?? [])]
              .filter((note) => !note.isCompleted && isFutureDatedNote(note.dueDate))
              .sort((left, right) => {
                return new Date(left.dueDate!).getTime() - new Date(right.dueDate!).getTime();
              });
            const previewNotes = notes.slice(0, 6);
            const remainingNotes = Math.max(notes.length - previewNotes.length, 0);

            return (
              <motion.button
                key={profile.id}
                type="button"
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOpenClass(index)}
                className={`group relative h-full overflow-hidden rounded-3xl text-left transition-all ${
                  hasClassroomTheme ? 'shadow-lg shadow-slate-300/30 dark:shadow-black/20' : ''
                }`}
                style={hasClassroomTheme ? { border: `1.5px solid ${primary}30` } : undefined}
              >
                {hasClassroomTheme && (
                  <div
                    className="relative h-2.5"
                    style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})`, zIndex: 2 }}
                  />
                )}

                <div
                  className={`relative flex h-full flex-col ${
                    hasClassroomTheme
                      ? 'bg-white/92 p-5 backdrop-blur-sm dark:bg-gray-900/92'
                      : hasTheme && isThemeDark
                        ? 'rounded-3xl border border-white/10 bg-white/8 p-5 hover:bg-white/10'
                        : hasTheme
                          ? 'rounded-3xl border border-white/40 bg-white/70 p-5 hover:bg-white/85'
                          : 'rounded-3xl border border-white/60 bg-white/90 p-5 shadow-sm hover:bg-white dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-black/20 dark:hover:bg-gray-900'
                  }`}
                  style={hasClassroomTheme ? { zIndex: 2 } : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`min-w-0 ${hasClassroomTheme && emoji ? 'flex flex-1 items-start gap-3' : ''}`}>
                      {hasClassroomTheme && emoji && (
                        <div
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-lg shadow-md"
                          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                        >
                          <span className="drop-shadow-sm">{emoji}</span>
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h2 className={`truncate text-xl font-bold ${hasTheme && isThemeDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                          {profile.classroom?.name || 'Clase'}
                        </h2>
                        <p className={`mt-1 text-sm ${hasTheme && isThemeDark ? 'text-white/55' : 'text-slate-500 dark:text-gray-400'}`}>
                          Código {profile.classroom?.code}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-2xl p-4 ${hasTheme && isThemeDark ? 'bg-black/10' : 'border border-slate-100 bg-white/70 dark:border-gray-800 dark:bg-gray-950/60'}`}
                    style={hasClassroomTheme ? { background: `linear-gradient(135deg, ${primary}10, ${secondary}08)`, border: `1px solid ${primary}20` } : undefined}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-amber-600">
                        <ClipboardList className="h-4 w-4" />
                        <span className="text-sm font-semibold">Notas activas</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                        {notes.length} pendiente{notes.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {previewNotes.length > 0 ? (
                      <div className="flex min-h-[52px] items-center gap-2 overflow-x-auto pb-1">
                        {previewNotes.map((note) => {
                          const category = NOTE_CATEGORY_CONFIG[note.category] || NOTE_CATEGORY_CONFIG.other;
                          const NoteIcon = category.icon;

                          return (
                            <span
                              key={note.id}
                              title={`${category.label}${note.dueDate ? ` · ${new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(new Date(note.dueDate))}` : ''}`}
                              className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${category.tone} shadow-sm`}
                            >
                              <NoteIcon className="h-5 w-5" />
                            </span>
                          );
                        })}

                        {remainingNotes > 0 && (
                          <span className={`inline-flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-2xl px-3 text-sm font-semibold ${hasTheme && isThemeDark ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-600'}`}>
                            +{remainingNotes}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex min-h-[52px] items-center">
                        <p className={`text-sm ${hasTheme && isThemeDark ? 'text-white/60' : 'text-slate-500 dark:text-gray-400'}`}>
                          No hay notas activas futuras en esta clase.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-semibold">Entrar a la clase</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400">
                      Abrir
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};