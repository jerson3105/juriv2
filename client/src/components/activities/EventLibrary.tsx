import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Users,
  Shuffle,
  Crown,
  Target,
  Clock,
  Repeat,
  Save
} from 'lucide-react';
import { eventsApi } from '../../lib/eventsApi';
import type { RandomEvent, CreateEventData, EventEffect } from '../../lib/eventsApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface EventLibraryProps {
  classroomId: string;
  onClose: () => void;
}

const ICONS = ['🎁', '⚡', '💰', '💚', '👑', '🌩️', '🦸', '🤝', '🎰', '⚔️', '🎲', '✨', '🔥', '❄️', '🌟', '💎'];
const COLORS = ['violet', 'emerald', 'amber', 'red', 'blue', 'pink', 'orange', 'green', 'yellow', 'gray'];

const CATEGORY_OPTIONS = [
  { value: 'BONUS', label: 'Bonificación', icon: '🎁' },
  { value: 'CHALLENGE', label: 'Desafío', icon: '⚡' },
  { value: 'ROULETTE', label: 'Ruleta', icon: '🎰' },
  { value: 'SPECIAL', label: 'Especial', icon: '✨' },
];

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'Todos', icon: <Users size={16} /> },
  { value: 'RANDOM_ONE', label: '1 aleatorio', icon: <Shuffle size={16} /> },
  { value: 'RANDOM_SOME', label: 'Varios aleatorios', icon: <Shuffle size={16} /> },
  { value: 'TOP', label: 'Mejor estudiante', icon: <Crown size={16} /> },
  { value: 'BOTTOM', label: 'Estudiante rezagado', icon: <Target size={16} /> },
];

const DURATION_OPTIONS = [
  { value: 'INSTANT', label: 'Instantáneo' },
  { value: 'TIMED', label: 'Por tiempo' },
  { value: 'SESSION', label: 'Toda la sesión' },
];

const REPEAT_OPTIONS = [
  { value: 'NONE', label: 'Sin repetición' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
];

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const EventLibrary = ({ classroomId, onClose }: EventLibraryProps) => {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RandomEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; event: RandomEvent | null }>({ isOpen: false, event: null });
  
  // Form state
  const [formData, setFormData] = useState<CreateEventData>({
    name: '',
    description: '',
    category: 'BONUS',
    targetType: 'ALL',
    targetCount: 1,
    effects: [{ type: 'XP', action: 'ADD', value: 10 }],
    icon: '🎁',
    color: 'violet',
    probability: 100,
    durationType: 'INSTANT',
    durationMinutes: 0,
    repeatType: 'NONE',
    repeatDays: [],
    repeatTime: '',
  });

  // Obtener eventos personalizados
  const { data: customEvents = [], isLoading } = useQuery({
    queryKey: ['custom-events', classroomId],
    queryFn: () => eventsApi.getCustomEvents(classroomId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateEventData) => eventsApi.createEvent(classroomId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-events'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-events'] });
      toast.success('Evento creado');
      resetForm();
    },
    onError: () => toast.error('Error al crear evento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: Partial<CreateEventData> }) =>
      eventsApi.updateEvent(classroomId, eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-events'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-events'] });
      toast.success('Evento actualizado');
      resetForm();
    },
    onError: () => toast.error('Error al actualizar evento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.deleteEvent(classroomId, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-events'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-events'] });
      toast.success('Evento eliminado');
    },
    onError: () => toast.error('Error al eliminar evento'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'BONUS',
      targetType: 'ALL',
      targetCount: 1,
      effects: [{ type: 'XP', action: 'ADD', value: 10 }],
      icon: '🎁',
      color: 'violet',
      probability: 100,
      durationType: 'INSTANT',
      durationMinutes: 0,
      repeatType: 'NONE',
      repeatDays: [],
      repeatTime: '',
    });
    setEditingEvent(null);
    setShowEditor(false);
  };

  const handleEdit = (event: RandomEvent) => {
    setEditingEvent(event);
    
    // Parsear effects si es string
    let effects: EventEffect[];
    if (typeof event.effects === 'string') {
      try {
        effects = JSON.parse(event.effects);
      } catch {
        effects = [{ type: 'XP', action: 'ADD', value: 10 }];
      }
    } else {
      effects = event.effects || [{ type: 'XP', action: 'ADD', value: 10 }];
    }
    
    setFormData({
      name: event.name,
      description: event.description,
      category: event.category,
      targetType: event.targetType,
      targetCount: event.targetCount || 1,
      effects,
      icon: event.icon,
      color: event.color,
      probability: event.probability,
      durationType: event.durationType,
      durationMinutes: event.durationMinutes,
      repeatType: event.repeatType,
      repeatDays: event.repeatDays || [],
      repeatTime: event.repeatTime || '',
    });
    setShowEditor(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (editingEvent) {
      updateMutation.mutate({ eventId: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addEffect = () => {
    setFormData({
      ...formData,
      effects: [...formData.effects, { type: 'XP', action: 'ADD', value: 10 }],
    });
  };

  const removeEffect = (index: number) => {
    setFormData({
      ...formData,
      effects: formData.effects.filter((_, i) => i !== index),
    });
  };

  const updateEffect = (index: number, field: keyof EventEffect, value: any) => {
    const newEffects = [...formData.effects];
    newEffects[index] = { ...newEffects[index], [field]: value };
    setFormData({ ...formData, effects: newEffects });
  };

  const toggleRepeatDay = (day: number) => {
    const days = formData.repeatDays || [];
    if (days.includes(day)) {
      setFormData({ ...formData, repeatDays: days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, repeatDays: [...days, day].sort() });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📚 Biblioteca de Eventos
          </h2>
          <div className="flex items-center gap-2">
            {!showEditor && (
              <button 
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-pink-500/25"
              >
                <Plus size={16} />
                Crear Evento
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-xl text-gray-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <AnimatePresence mode="wait">
            {showEditor ? (
              /* Editor de evento */
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-5 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">
                    {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                  </h3>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {/* Columna izquierda */}
                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Nombre</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none placeholder-gray-500"
                        placeholder="Ej: Lluvia de Oro"
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Descripción</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none placeholder-gray-500"
                        rows={2}
                        placeholder="Describe el evento..."
                      />
                    </div>

                    {/* Icono y Color */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-400">Icono</label>
                        <div className="flex flex-wrap gap-1">
                          {ICONS.map((icon) => (
                            <button
                              key={icon}
                              onClick={() => setFormData({ ...formData, icon })}
                              className={`w-7 h-7 rounded-lg text-base ${
                                formData.icon === icon
                                  ? 'bg-pink-500/30 ring-2 ring-pink-500'
                                  : 'hover:bg-gray-800'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-400">Color</label>
                        <div className="flex flex-wrap gap-1">
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setFormData({ ...formData, color })}
                              className={`w-7 h-7 rounded-lg bg-${color}-500 ${
                                formData.color === color
                                  ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white'
                                  : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Categoría */}
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Categoría</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORY_OPTIONS.map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => setFormData({ ...formData, category: cat.value as any })}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                              formData.category === cat.value
                                ? 'border-pink-500 bg-pink-500/20 text-pink-400'
                                : 'border-gray-700 hover:bg-gray-800 text-gray-400'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span className="text-xs">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Objetivo */}
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">¿A quién afecta?</label>
                      <select
                        value={formData.targetType}
                        onChange={(e) => setFormData({ ...formData, targetType: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                      >
                        {TARGET_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {['RANDOM_SOME', 'TOP', 'BOTTOM'].includes(formData.targetType) && (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={formData.targetCount}
                          onChange={(e) => setFormData({ ...formData, targetCount: parseInt(e.target.value) })}
                          className="mt-2 w-24 px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                          placeholder="Cantidad"
                        />
                      )}
                    </div>
                  </div>

                  {/* Columna derecha */}
                  <div className="space-y-4">
                    {/* Efectos */}
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Efectos</label>
                      <div className="space-y-2">
                        {formData.effects.map((effect, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-800 rounded-xl">
                            <select
                              value={effect.type}
                              onChange={(e) => updateEffect(index, 'type', e.target.value)}
                              className="px-2 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs"
                            >
                              <option value="XP">⚡ XP</option>
                              <option value="HP">❤️ HP</option>
                              <option value="GP">🪙 GP</option>
                            </select>
                            <select
                              value={effect.action}
                              onChange={(e) => updateEffect(index, 'action', e.target.value)}
                              className="px-2 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs"
                            >
                              <option value="ADD">+ Sumar</option>
                              <option value="REMOVE">- Restar</option>
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={effect.value}
                              onChange={(e) => updateEffect(index, 'value', parseInt(e.target.value))}
                              className="w-16 px-2 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs"
                            />
                            {formData.effects.length > 1 && (
                              <button
                                onClick={() => removeEffect(index)}
                                className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={addEffect}
                          className="text-xs text-pink-400 hover:text-pink-300 font-medium"
                        >
                          + Agregar efecto
                        </button>
                      </div>
                    </div>

                    {/* Probabilidad (para ruleta) */}
                    {formData.category === 'ROULETTE' && (
                      <div>
                        <label className="block text-xs font-medium mb-1 text-gray-400">
                          Probabilidad (1-100)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.probability}
                          onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                          className="w-24 px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                        />
                      </div>
                    )}

                    {/* Duración */}
                    <div>
                      <label className="block text-xs font-medium mb-1 flex items-center gap-1 text-gray-400">
                        <Clock size={12} />
                        Duración del efecto
                      </label>
                      <select
                        value={formData.durationType}
                        onChange={(e) => setFormData({ ...formData, durationType: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {formData.durationType === 'TIMED' && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                            className="w-20 px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                          />
                          <span className="text-xs text-gray-500">minutos</span>
                        </div>
                      )}
                    </div>

                    {/* Repetición */}
                    <div>
                      <label className="block text-xs font-medium mb-1 flex items-center gap-1 text-gray-400">
                        <Repeat size={12} />
                        Repetición automática
                      </label>
                      <select
                        value={formData.repeatType}
                        onChange={(e) => setFormData({ ...formData, repeatType: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                      >
                        {REPEAT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      
                      {formData.repeatType === 'WEEKLY' && (
                        <div className="mt-2 flex gap-1">
                          {DAYS.map((day, index) => (
                            <button
                              key={index}
                              onClick={() => toggleRepeatDay(index)}
                              className={`w-8 h-8 rounded-lg text-[10px] font-medium ${
                                formData.repeatDays?.includes(index)
                                  ? 'bg-pink-500 text-white'
                                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {formData.repeatType !== 'NONE' && (
                        <div className="mt-2">
                          <label className="text-[10px] text-gray-500">Hora de activación</label>
                          <input
                            type="time"
                            value={formData.repeatTime}
                            onChange={(e) => setFormData({ ...formData, repeatTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-700 rounded-xl bg-gray-800 text-white text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-xl text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-pink-500/25 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {editingEvent ? 'Guardar cambios' : 'Crear evento'}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Lista de eventos */
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : customEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-pink-500/20 rounded-2xl flex items-center justify-center">
                      <span className="text-3xl">📚</span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      No tienes eventos personalizados
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Crea tu primer evento para empezar
                    </p>
                    <button 
                      onClick={() => setShowEditor(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-pink-500/25"
                    >
                      <Plus size={16} />
                      Crear Evento
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-750 rounded-xl transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                          event.color === 'violet' ? 'bg-violet-500/20' :
                          event.color === 'emerald' ? 'bg-emerald-500/20' :
                          event.color === 'amber' ? 'bg-amber-500/20' :
                          event.color === 'red' ? 'bg-red-500/20' :
                          event.color === 'blue' ? 'bg-blue-500/20' :
                          event.color === 'pink' ? 'bg-pink-500/20' : 'bg-gray-700'
                        }`}>
                          {event.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white text-sm">
                            {event.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                              {CATEGORY_OPTIONS.find(c => c.value === event.category)?.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                              {TARGET_OPTIONS.find(t => t.value === event.targetType)?.label}
                            </span>
                            {event.repeatType !== 'NONE' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded flex items-center gap-0.5">
                                <Repeat size={8} />
                                {event.repeatType === 'DAILY' ? 'Diario' : 'Semanal'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(event)}
                            className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, event })}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, event: null })}
        onConfirm={() => {
          if (deleteConfirm.event) {
            deleteMutation.mutate(deleteConfirm.event.id);
          }
          setDeleteConfirm({ isOpen: false, event: null });
        }}
        title="¿Eliminar evento?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.event?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
