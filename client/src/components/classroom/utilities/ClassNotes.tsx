import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Check, ClipboardList, Eye, FileCheck, Package, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { classNoteApi, type ClassNote } from '../../../lib/classNoteApi';
import { useToolKeys } from './helpers';
import { ToolCloseButton } from './ui';

const NOTE_CATEGORIES = [
  { id: 'task', label: 'Tarea', icon: FileCheck, pill: 'bg-blue-500/25 text-blue-100 border-blue-300/50' },
  { id: 'review', label: 'Revisar', icon: BookOpen, pill: 'bg-amber-500/25 text-amber-100 border-amber-300/50' },
  { id: 'material', label: 'Material', icon: Package, pill: 'bg-purple-500/25 text-purple-100 border-purple-300/50' },
  { id: 'other', label: 'Otro', icon: StickyNote, pill: 'bg-gray-500/30 text-gray-100 border-gray-300/50' },
] as const;

// Notas del docente para la siguiente clase (tareas, páginas, pendientes).
export const ClassNotes = ({ classroomId, onClose }: { classroomId: string; onClose: () => void }) => {
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<string>('task');
  const [newDueDate, setNewDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useToolKeys(onClose);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['class-notes', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['class-notes-count', classroomId] });
  };

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['class-notes', classroomId],
    queryFn: () => classNoteApi.list(classroomId),
  });

  const createMutation = useMutation({
    mutationFn: () => classNoteApi.create(classroomId, newContent.trim(), newCategory, newDueDate || null),
    onSuccess: () => {
      refresh();
      setNewContent('');
      setNewDueDate('');
      inputRef.current?.focus();
    },
    onError: () => toast.error('No se pudo guardar la nota'),
  });

  const toggleMutation = useMutation({
    mutationFn: (noteId: string) => classNoteApi.toggleComplete(classroomId, noteId),
    onSuccess: refresh,
  });

  // Borrar con "Deshacer": la nota se vuelve a crear con el mismo contenido, categoría, fecha y estado.
  const restore = async (note: ClassNote) => {
    try {
      const created = await classNoteApi.create(classroomId, note.content, note.category, note.dueDate ? String(note.dueDate).slice(0, 10) : null);
      if (note.isCompleted) await classNoteApi.toggleComplete(classroomId, created.id);
      refresh();
      toast.success('Nota restaurada');
    } catch {
      toast.error('No se pudo restaurar la nota');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (note: ClassNote) => classNoteApi.remove(classroomId, note.id),
    onSuccess: (_data, note) => {
      refresh();
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Nota eliminada</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void restore(note);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    },
    onError: () => toast.error('No se pudo eliminar la nota'),
  });

  const filteredNotes = notes.filter((note) => (filter === 'pending' ? !note.isCompleted : filter === 'completed' ? note.isCompleted : true));
  const pendingCount = notes.filter((n) => !n.isCompleted).length;
  const completedCount = notes.length - pendingCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Notas de clase"
      className="fixed inset-0 z-[9999] flex flex-col items-center bg-gradient-to-br from-gray-950 via-emerald-950 to-teal-950"
    >
      <div className="w-full max-w-2xl px-4 pt-4">
        <div className="flex items-center justify-between mb-4 pr-16">
          <div>
            <h2 className="text-white/85 text-sm font-semibold tracking-widest uppercase">Notas de clase</h2>
            <p className="text-sm text-white/80 mt-0.5">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} · {completedCount} completada{completedCount !== 1 ? 's' : ''}
            </p>
            {/* Las notas con fecha aparecen en el calendario de los alumnos: que el docente lo sepa al escribirlas. */}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-100">
              <Eye size={14} aria-hidden="true" />
              Tus estudiantes ven en su calendario las notas que tienen fecha.
            </p>
          </div>
        </div>
        <ToolCloseButton onClose={onClose} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newContent.trim()) createMutation.mutate();
          }}
          className="mb-4"
        >
          <div className="flex gap-2 mb-2">
            <label htmlFor="new-note" className="sr-only">Nueva nota</label>
            <input
              id="new-note"
              ref={inputRef}
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ej: Traer el cuaderno de fracciones, leer pág. 45-50"
              className="flex-1 min-h-[48px] rounded-xl border border-white/30 bg-white/10 px-4 text-white placeholder:text-white/60 focus:outline-none focus:border-emerald-300"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newContent.trim() || createMutation.isPending}
              aria-label="Agregar nota"
              className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label="Categoría">
              {NOTE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewCategory(cat.id)}
                  aria-pressed={newCategory === cat.id}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border text-sm font-medium ${
                    newCategory === cat.id ? cat.pill : 'border-transparent bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <cat.icon size={14} aria-hidden="true" />
                  {cat.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-white/85">
              Para
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="min-h-[36px] rounded-lg border border-white/30 bg-white/10 px-2 text-white [color-scheme:dark] focus:outline-none focus:border-emerald-300"
              />
            </label>
          </div>
        </form>

        <div className="flex gap-1 mb-3 rounded-lg bg-white/5 p-1" role="tablist" aria-label="Filtrar notas">
          {([
            { key: 'pending', label: `Pendientes (${pendingCount})` },
            { key: 'completed', label: `Completadas (${completedCount})` },
            { key: 'all', label: 'Todas' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 min-h-[36px] px-3 rounded-md text-sm font-medium ${filter === tab.key ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          <p className="text-center text-white/85 py-8">Cargando notas...</p>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList size={40} className="mx-auto text-white/40 mb-3" aria-hidden="true" />
            <p className="text-white/85">
              {filter === 'pending' ? 'No hay notas pendientes. ¡Todo al día!' : filter === 'completed' ? 'No hay notas completadas aún.' : 'No hay notas. Añade una arriba.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotes.map((note) => {
              const cat = NOTE_CATEGORIES.find((c) => c.id === note.category) || NOTE_CATEGORIES[3];
              const dueDate = note.dueDate ? new Date(note.dueDate) : null;
              const isOverdue = dueDate && !note.isCompleted && dueDate < new Date();
              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${note.isCompleted ? 'border-white/10 bg-white/5' : 'border-white/20 bg-white/10'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(note.id)}
                    disabled={toggleMutation.isPending}
                    aria-label={note.isCompleted ? `Marcar como pendiente: ${note.content}` : `Marcar como hecha: ${note.content}`}
                    aria-pressed={note.isCompleted}
                    className="flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${note.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/60 hover:border-emerald-300'}`}>
                      {note.isCompleted && <Check size={14} aria-hidden="true" />}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className={`leading-snug ${note.isCompleted ? 'text-white/70 line-through' : 'text-white'}`}>{note.content}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-medium ${cat.pill}`}>
                        <cat.icon size={12} aria-hidden="true" />
                        {cat.label}
                      </span>
                      {dueDate && (
                        <span className={`inline-flex items-center gap-1 font-medium ${isOverdue ? 'text-red-300' : 'text-white/80'}`}>
                          <Calendar size={12} aria-hidden="true" />
                          {dueDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                          {isOverdue && ' · Vencida'}
                        </span>
                      )}
                      <span className="text-white/70">
                        Creada {new Date(note.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(note)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Eliminar nota: ${note.content}`}
                    title="Eliminar"
                    className="flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-white/80 hover:bg-red-500/25 hover:text-red-200"
                  >
                    <Trash2 size={16} aria-hidden="true" />
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
