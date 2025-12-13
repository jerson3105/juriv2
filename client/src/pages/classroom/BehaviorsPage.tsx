import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Sparkles,
  Heart,
  Coins,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { type Classroom } from '../../lib/classroomApi';
import { behaviorApi, type Behavior, type PointType } from '../../lib/behaviorApi';
import toast from 'react-hot-toast';

const EMOJI_OPTIONS = ['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '💔', '⚡', '🔥', '❌', '😴', '📵'];

export const BehaviorsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<Behavior | null>(null);

  const { data: behaviors, isLoading } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  const createMutation = useMutation({
    mutationFn: behaviorApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      setShowModal(false);
      toast.success('Comportamiento creado');
    },
    onError: () => toast.error('Error al crear comportamiento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      behaviorApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      setShowModal(false);
      setEditingBehavior(null);
      toast.success('Comportamiento actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: behaviorApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      toast.success('Comportamiento eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const positiveBehaviors = behaviors?.filter((b) => b.isPositive) || [];
  const negativeBehaviors = behaviors?.filter((b) => !b.isPositive) || [];

  const openEditModal = (behavior: Behavior) => {
    setEditingBehavior(behavior);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingBehavior(null);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <Sparkles size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Comportamientos
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Configura acciones rápidas para dar o quitar puntos
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openCreateModal} className="w-full sm:w-auto">
          Nuevo comportamiento
        </Button>
      </div>

      {/* Comportamientos positivos */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-900/20">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Para dar puntos ({positiveBehaviors.length})</span>
        </div>
        <div className="p-4">
          {positiveBehaviors.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
              No hay comportamientos positivos configurados
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {positiveBehaviors.map((behavior) => (
                <BehaviorCard
                  key={behavior.id}
                  behavior={behavior}
                  onEdit={() => openEditModal(behavior)}
                  onDelete={() => deleteMutation.mutate(behavior.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Comportamientos negativos */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700 bg-red-50/50 dark:bg-red-900/20">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Heart size={16} className="text-white" />
          </div>
          <span className="font-semibold text-red-700 dark:text-red-400">Para quitar puntos ({negativeBehaviors.length})</span>
        </div>
        <div className="p-4">
          {negativeBehaviors.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
              No hay comportamientos negativos configurados
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {negativeBehaviors.map((behavior) => (
                <BehaviorCard
                  key={behavior.id}
                  behavior={behavior}
                  onEdit={() => openEditModal(behavior)}
                  onDelete={() => deleteMutation.mutate(behavior.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Modal de crear/editar */}
      <BehaviorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingBehavior(null);
        }}
        behavior={editingBehavior}
        onSave={(data) => {
          if (editingBehavior) {
            updateMutation.mutate({ id: editingBehavior.id, data });
          } else {
            createMutation.mutate({ ...data, classroomId: classroom.id });
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};

// Componente de tarjeta de comportamiento
const BehaviorCard = ({
  behavior,
  onEdit,
  onDelete,
}: {
  behavior: Behavior;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  // Usar valores combinados con fallback a legacy
  const xpVal = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
  const hpVal = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
  const gpVal = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);

  const rewards: { icon: typeof Sparkles; value: number; color: string; label: string }[] = [];
  if (xpVal > 0) rewards.push({ icon: Sparkles, value: xpVal, color: 'emerald', label: 'XP' });
  if (hpVal > 0) rewards.push({ icon: Heart, value: hpVal, color: 'red', label: 'HP' });
  if (gpVal > 0) rewards.push({ icon: Coins, value: gpVal, color: 'amber', label: 'Oro' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        flex items-center justify-between p-3 rounded-xl border-2 bg-white dark:bg-gray-800
        ${behavior.isPositive
          ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700'
          : 'border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
        }
        transition-colors
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
          behavior.isPositive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'
        }`}>
          {behavior.icon || '⭐'}
        </div>
        <div>
          <p className="font-medium text-gray-800 dark:text-white text-sm">
            {behavior.name}
          </p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {rewards.map((reward, idx) => {
              const Icon = reward.icon;
              return (
                <div key={idx} className="flex items-center gap-0.5">
                  <Icon size={12} className={`text-${reward.color}-500`} />
                  <span className={`font-semibold ${behavior.isPositive ? `text-${reward.color}-600` : 'text-red-600'}`}>
                    {behavior.isPositive ? '+' : '-'}{reward.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Edit2 size={14} className="text-gray-400" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 size={14} className="text-red-400" />
        </button>
      </div>
    </motion.div>
  );
};

// Modal de crear/editar comportamiento
const BehaviorModal = ({
  isOpen,
  onClose,
  behavior,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  behavior: Behavior | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) => {
  const [name, setName] = useState(behavior?.name || '');
  const [description, setDescription] = useState(behavior?.description || '');
  const [xpValue, setXpValue] = useState(behavior?.xpValue || 0);
  const [hpValue, setHpValue] = useState(behavior?.hpValue || 0);
  const [gpValue, setGpValue] = useState(behavior?.gpValue || 0);
  const [isPositive, setIsPositive] = useState(behavior?.isPositive ?? true);
  const [icon, setIcon] = useState(behavior?.icon || '⭐');

  // Reset form when behavior changes
  useEffect(() => {
    if (behavior) {
      setName(behavior.name);
      setDescription(behavior.description || '');
      setXpValue(behavior.xpValue || 0);
      setHpValue(behavior.hpValue || 0);
      setGpValue(behavior.gpValue || 0);
      setIsPositive(behavior.isPositive);
      setIcon(behavior.icon || '⭐');
    } else {
      setName('');
      setDescription('');
      setXpValue(10);
      setHpValue(0);
      setGpValue(0);
      setIsPositive(true);
      setIcon('⭐');
    }
  }, [behavior]);

  // Determinar tipo principal para legacy
  const getPrimaryType = (): PointType => {
    if (xpValue >= hpValue && xpValue >= gpValue) return 'XP';
    if (hpValue >= gpValue) return 'HP';
    return 'GP';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primaryType = getPrimaryType();
    onSave({
      name,
      description: description || undefined,
      pointType: primaryType,
      pointValue: primaryType === 'XP' ? xpValue : primaryType === 'HP' ? hpValue : gpValue,
      xpValue,
      hpValue,
      gpValue,
      isPositive,
      icon,
    });
  };

  const hasAnyValue = xpValue > 0 || hpValue > 0 || gpValue > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">
              {behavior ? 'Editar comportamiento' : 'Nuevo comportamiento'}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Row 1: Tipo + Icono seleccionado */}
            <div className="flex gap-3">
              {/* Tipo: Positivo/Negativo */}
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5 text-gray-400">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPositive(true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      isPositive
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    ✨ Dar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPositive(false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      !isPositive
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    ⚡ Quitar
                  </button>
                </div>
              </div>

              {/* Icono seleccionado preview */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">Icono</label>
                <div className={`
                  w-[76px] h-[40px] rounded-lg flex items-center justify-center text-2xl
                  ${isPositive ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-red-500/20 border border-red-500/50'}
                `}>
                  {icon}
                </div>
              </div>
            </div>

            {/* Row 2: Iconos grid */}
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 text-lg rounded-lg transition-all ${
                    icon === emoji
                      ? isPositive 
                        ? 'bg-emerald-500 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900'
                        : 'bg-red-500 ring-2 ring-red-400 ring-offset-2 ring-offset-gray-900'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Row 3: Nombre y Descripción en grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej: Participación"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">Descripción</label>
                <input
                  type="text"
                  placeholder="Opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Row 4: Recompensas combinadas */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-400">
                Recompensas {isPositive ? '(dar)' : '(quitar)'} - Puedes combinar
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* XP */}
                <div className={`p-2 rounded-lg border-2 transition-all ${
                  xpValue > 0 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : 'border-gray-700 bg-gray-800'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles size={12} className="text-emerald-500" />
                    <span className="text-xs text-gray-400">XP</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={xpValue}
                    onChange={(e) => setXpValue(parseInt(e.target.value) || 0)}
                    className="w-full py-1 px-2 rounded text-sm font-medium text-center bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                {/* HP */}
                <div className={`p-2 rounded-lg border-2 transition-all ${
                  hpValue > 0 
                    ? 'border-red-500 bg-red-500/10' 
                    : 'border-gray-700 bg-gray-800'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Heart size={12} className="text-red-500" />
                    <span className="text-xs text-gray-400">HP</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={hpValue}
                    onChange={(e) => setHpValue(parseInt(e.target.value) || 0)}
                    className="w-full py-1 px-2 rounded text-sm font-medium text-center bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
                {/* GP (Oro) */}
                <div className={`p-2 rounded-lg border-2 transition-all ${
                  gpValue > 0 
                    ? 'border-amber-500 bg-amber-500/10' 
                    : 'border-gray-700 bg-gray-800'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Coins size={12} className="text-amber-500" />
                    <span className="text-xs text-gray-400">Oro</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={gpValue}
                    onChange={(e) => setGpValue(parseInt(e.target.value) || 0)}
                    className="w-full py-1 px-2 rounded text-sm font-medium text-center bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Deja en 0 los tipos que no quieras incluir
              </p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!name.trim() || !hasAnyValue || isLoading}
              className={`
                w-full py-3 rounded-xl font-semibold text-white transition-all
                ${isPositive 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30' 
                  : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/30'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isLoading ? 'Guardando...' : behavior ? 'Guardar cambios' : 'Crear comportamiento'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
