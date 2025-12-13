import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer,
  Plus,
  Play,
  Trash2,
  Edit2,
  X,
  Clock,
  Bomb,
  Zap,
  Users,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { behaviorApi } from '../../lib/behaviorApi';
import {
  timedActivityApi,
  type TimedActivity,
  type CreateTimedActivityDto,
  type TimedActivityMode,
  MODE_CONFIG,
  STATUS_CONFIG,
} from '../../lib/timedActivityApi';
import { TimedActivityRunner } from './TimedActivityRunner';
import { BombRandomRunner } from './BombRandomRunner';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface TimedActivitiesActivityProps {
  classroom: any;
  onBack: () => void;
}

export const TimedActivitiesActivity = ({ classroom, onBack }: TimedActivitiesActivityProps) => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<TimedActivity | null>(null);
  const [runningActivity, setRunningActivity] = useState<TimedActivity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; activity: TimedActivity | null }>({ isOpen: false, activity: null });

  // Obtener actividades - HOOKS DEBEN IR ANTES DE CUALQUIER RETURN CONDICIONAL
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['timed-activities', classroom.id],
    queryFn: () => timedActivityApi.getByClassroom(classroom.id),
  });

  // Obtener comportamientos para el selector
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateTimedActivityDto) => timedActivityApi.create(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      setShowCreateModal(false);
      toast.success('Actividad creada');
    },
    onError: () => toast.error('Error al crear actividad'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTimedActivityDto> }) =>
      timedActivityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      setEditingActivity(null);
      toast.success('Actividad actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: timedActivityApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
      toast.success('Actividad eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  // Si hay una actividad corriendo, mostrar el runner como vista completa
  // IMPORTANTE: Este return condicional debe ir DESPUÉS de todos los hooks
  if (runningActivity) {
    const RunnerComponent = runningActivity.mode === 'BOMB_RANDOM' ? BombRandomRunner : TimedActivityRunner;
    return (
      <RunnerComponent
        activity={runningActivity}
        classroom={classroom}
        onBack={() => {
          setRunningActivity(null);
          queryClient.invalidateQueries({ queryKey: ['timed-activities', classroom.id] });
        }}
      />
    );
  }

  const handleStartActivity = (activity: TimedActivity) => {
    setRunningActivity(activity);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-4">
          <ArrowLeft size={18} />
          Volver
        </Button>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={onBack} className="p-1.5 sm:p-2">
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </Button>
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30 flex-shrink-0">
            <Timer size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Actividades de Tiempo
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Cronómetro, temporizador y modo bomba
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 w-full sm:w-auto">
          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
          Nueva Actividad
        </Button>
      </div>

      {/* Lista de actividades */}
      {activities.length === 0 ? (
        <Card className="text-center py-12">
          <Timer className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Sin actividades de tiempo
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crea tu primera actividad con cronómetro, temporizador o modo bomba
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus size={18} />
            Crear Actividad
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => {
            const modeConfig = MODE_CONFIG[activity.mode];
            const statusConfig = STATUS_CONFIG[activity.status];
            
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                {/* Header con modo */}
                <div className={`px-4 py-3 bg-gradient-to-r ${
                  activity.mode === 'STOPWATCH' ? 'from-blue-500 to-cyan-500' :
                  activity.mode === 'TIMER' ? 'from-amber-500 to-orange-500' :
                  'from-red-500 to-pink-500'
                } text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{modeConfig.icon}</span>
                      <span className="font-medium">{modeConfig.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      activity.status === 'ACTIVE' ? 'bg-white/20' :
                      activity.status === 'COMPLETED' ? 'bg-white/30' :
                      'bg-black/20'
                    }`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-1">
                    {activity.name}
                  </h3>
                  {activity.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {activity.description}
                    </p>
                  )}

                  {/* Info */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {activity.timeLimitSeconds && (
                      <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                        <Clock size={12} />
                        {formatTime(activity.timeLimitSeconds)}
                      </span>
                    )}
                    {activity.mode === 'BOMB' && activity.bombMinSeconds && activity.bombMaxSeconds && (
                      <span className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-lg">
                        <Bomb size={12} />
                        {activity.bombMinSeconds}s - {activity.bombMaxSeconds}s
                      </span>
                    )}
                    {activity.useMultipliers && (
                      <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg">
                        <Zap size={12} />
                        Multiplicadores
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg">
                      +{activity.basePoints} {activity.pointType}
                    </span>
                  </div>

                  {/* Resultados si hay */}
                  {activity.results && activity.results.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                      <Users size={14} />
                      <span>{activity.results.length} participantes</span>
                      {activity.results.filter(r => r.completedAt).length > 0 && (
                        <>
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span>{activity.results.filter(r => r.completedAt).length} completaron</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2">
                    {activity.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        onClick={() => handleStartActivity(activity)}
                        className="flex-1 gap-1"
                      >
                        <Play size={14} />
                        Iniciar
                      </Button>
                    )}
                    {(activity.status === 'ACTIVE' || activity.status === 'PAUSED') && (
                      <Button
                        size="sm"
                        onClick={() => handleStartActivity(activity)}
                        className="flex-1 gap-1"
                      >
                        <Play size={14} />
                        Continuar
                      </Button>
                    )}
                    {activity.status === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStartActivity(activity)}
                        className="flex-1 gap-1"
                      >
                        Ver Resultados
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingActivity(activity)}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirm({ isOpen: true, activity })}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <AnimatePresence>
        {(showCreateModal || editingActivity) && (
          <ActivityFormModal
            activity={editingActivity}
            behaviors={behaviors}
            onClose={() => {
              setShowCreateModal(false);
              setEditingActivity(null);
            }}
            onSubmit={(data) => {
              if (editingActivity) {
                updateMutation.mutate({ id: editingActivity.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, activity: null })}
        onConfirm={() => {
          if (deleteConfirm.activity) {
            deleteMutation.mutate(deleteConfirm.activity.id);
          }
          setDeleteConfirm({ isOpen: false, activity: null });
        }}
        title="¿Eliminar actividad?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.activity?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// Modal de formulario
interface ActivityFormModalProps {
  activity: TimedActivity | null;
  behaviors: any[];
  onClose: () => void;
  onSubmit: (data: CreateTimedActivityDto) => void;
  isLoading: boolean;
}

const ActivityFormModal = ({ activity, behaviors, onClose, onSubmit, isLoading }: ActivityFormModalProps) => {
  const [formData, setFormData] = useState<CreateTimedActivityDto>({
    name: activity?.name || '',
    description: activity?.description || '',
    mode: activity?.mode || 'STOPWATCH',
    timeLimitSeconds: activity?.timeLimitSeconds || 60,
    bombMinSeconds: activity?.bombMinSeconds || 10,
    bombMaxSeconds: activity?.bombMaxSeconds || 30,
    behaviorId: activity?.behaviorId || undefined,
    basePoints: activity?.basePoints || 10,
    pointType: (activity?.pointType as 'XP' | 'HP' | 'GP') || 'XP',
    useMultipliers: activity?.useMultipliers || false,
    multiplier50: activity?.multiplier50 || 200,
    multiplier75: activity?.multiplier75 || 150,
    negativeBehaviorId: activity?.negativeBehaviorId || undefined,
    bombPenaltyPoints: activity?.bombPenaltyPoints || 10,
    bombPenaltyType: (activity?.bombPenaltyType as 'XP' | 'HP' | 'GP') || 'HP',
  });

  const positiveBehaviors = behaviors.filter((b: any) => b.isPositive);
  const negativeBehaviors = behaviors.filter((b: any) => !b.isPositive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {activity ? 'Editar Actividad' : 'Nueva Actividad de Tiempo'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre de la actividad
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Ej: Reto de velocidad"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              rows={2}
              placeholder="Describe la actividad..."
            />
          </div>

          {/* Modo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Modo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(MODE_CONFIG) as TimedActivityMode[]).map((mode) => {
                const config = MODE_CONFIG[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormData({ ...formData, mode })}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      formData.mode === mode
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{config.icon}</span>
                    <span className="text-xs font-medium leading-tight">{config.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {MODE_CONFIG[formData.mode].description}
            </p>
          </div>

          {/* Tiempo límite (para TIMER) */}
          {formData.mode === 'TIMER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tiempo límite (segundos)
              </label>
              <input
                type="number"
                value={formData.timeLimitSeconds}
                onChange={(e) => setFormData({ ...formData, timeLimitSeconds: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                min={5}
                max={3600}
              />
            </div>
          )}

          {/* Tiempo bomba (para BOMB y BOMB_RANDOM) */}
          {(formData.mode === 'BOMB' || formData.mode === 'BOMB_RANDOM') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tiempo mínimo (seg)
                </label>
                <input
                  type="number"
                  value={formData.bombMinSeconds}
                  onChange={(e) => setFormData({ ...formData, bombMinSeconds: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  min={5}
                  max={300}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tiempo máximo (seg)
                </label>
                <input
                  type="number"
                  value={formData.bombMaxSeconds}
                  onChange={(e) => setFormData({ ...formData, bombMaxSeconds: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  min={10}
                  max={600}
                />
              </div>
            </div>
          )}

          {/* Puntos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Puntos base
              </label>
              <input
                type="number"
                value={formData.basePoints}
                onChange={(e) => setFormData({ ...formData, basePoints: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de punto
              </label>
              <select
                value={formData.pointType}
                onChange={(e) => setFormData({ ...formData, pointType: e.target.value as 'XP' | 'HP' | 'GP' })}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="XP">XP (Experiencia)</option>
                <option value="GP">GP (Oro)</option>
                <option value="HP">HP (Vida)</option>
              </select>
            </div>
          </div>

          {/* Comportamiento positivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comportamiento a aplicar (opcional)
            </label>
            <select
              value={formData.behaviorId || ''}
              onChange={(e) => setFormData({ ...formData, behaviorId: e.target.value || undefined })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="">Sin comportamiento (usar puntos base)</option>
              {positiveBehaviors.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name} (+{b.pointValue} {b.pointType})
                </option>
              ))}
            </select>
          </div>

          {/* Multiplicadores (solo para TIMER) */}
          {formData.mode === 'TIMER' && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useMultipliers}
                  onChange={(e) => setFormData({ ...formData, useMultipliers: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Usar multiplicadores de tiempo
                </span>
              </label>
              
              {formData.useMultipliers && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Antes del 50% del tiempo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.multiplier50}
                        onChange={(e) => setFormData({ ...formData, multiplier50: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                        min={100}
                        max={500}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Antes del 75% del tiempo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.multiplier75}
                        onChange={(e) => setFormData({ ...formData, multiplier75: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                        min={100}
                        max={300}
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Penalización bomba */}
          {(formData.mode === 'BOMB' || formData.mode === 'BOMB_RANDOM') && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
              <h4 className="font-medium text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                <Bomb size={16} />
                Penalización por explosión
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Puntos a quitar</label>
                  <input
                    type="number"
                    value={formData.bombPenaltyPoints}
                    onChange={(e) => setFormData({ ...formData, bombPenaltyPoints: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tipo</label>
                  <select
                    value={formData.bombPenaltyType}
                    onChange={(e) => setFormData({ ...formData, bombPenaltyType: e.target.value as 'XP' | 'HP' | 'GP' })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  >
                    <option value="HP">HP (Vida)</option>
                    <option value="XP">XP (Experiencia)</option>
                    <option value="GP">GP (Oro)</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-500">Comportamiento negativo (opcional)</label>
                <select
                  value={formData.negativeBehaviorId || ''}
                  onChange={(e) => setFormData({ ...formData, negativeBehaviorId: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="">Sin comportamiento</option>
                  {negativeBehaviors.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.icon} {b.name} (-{b.pointValue} {b.pointType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : activity ? 'Guardar Cambios' : 'Crear Actividad'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
