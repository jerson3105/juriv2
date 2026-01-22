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
  Award,
  Check,
  Pencil,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { behaviorApi, type Behavior, type PointType, type GeneratedBehavior } from '../../lib/behaviorApi';
import toast from 'react-hot-toast';

const EMOJI_OPTIONS = ['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '💔', '⚡', '🔥', '❌', '😴', '📵'];

export const BehaviorsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<Behavior | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

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
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowAIModal(true)} 
            className="flex-1 sm:flex-none flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg"
          >
            <Sparkles size={16} />
            Generar con IA
          </button>
          <Button leftIcon={<Plus size={16} />} onClick={openCreateModal} className="flex-1 sm:flex-none">
            Nuevo
          </Button>
        </div>
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
        classroom={classroom}
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

      {/* Modal de generación con IA */}
      <AIBehaviorModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        classroom={classroom}
        onImport={(behaviors) => {
          // Importar los comportamientos seleccionados
          behaviors.forEach((b) => {
            createMutation.mutate({
              classroomId: classroom.id,
              name: b.name,
              description: b.description,
              pointType: b.xpValue > 0 ? 'XP' : b.hpValue > 0 ? 'HP' : 'GP',
              pointValue: Math.max(b.xpValue, b.hpValue, b.gpValue),
              xpValue: b.xpValue,
              hpValue: b.hpValue,
              gpValue: b.gpValue,
              isPositive: b.isPositive,
              icon: b.icon,
            });
          });
          setShowAIModal(false);
        }}
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
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-800 dark:text-white text-sm">
            {behavior.name}
          </p>
          {behavior.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {behavior.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs flex-wrap mt-1">
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
  classroom,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  behavior: Behavior | null;
  classroom: Classroom;
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
  const [competencyId, setCompetencyId] = useState<string | null>(behavior?.competencyId || null);

  // Cargar competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

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
      setCompetencyId(behavior?.competencyId || null);
    } else {
      setName('');
      setDescription('');
      setXpValue(10);
      setHpValue(0);
      setGpValue(0);
      setIsPositive(true);
      setIcon('⭐');
      setCompetencyId(null);
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
      competencyId: competencyId || undefined,
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
            <motion.img
              key={isPositive ? 'positive' : 'negative'}
              src={isPositive ? "/assets/mascot/jiro-puntosfavor.jpg" : "/assets/mascot/jiro-puntoscontra.jpg"}
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-xs font-semibold mb-2">💡 Consejos para crear comportamientos</p>
              <ul className="text-white/80 text-[10px] space-y-1">
                {isPositive ? (
                  <>
                    <li>• Sé específico: describe acciones concretas.</li>
                    <li>• Combina puntos según el impacto.</li>
                    <li>• Equilibra valores por frecuencia.</li>
                  </>
                ) : (
                  <>
                    <li>• Mantén proporcionalidad con la falta.</li>
                    <li>• Usa HP para conducta.</li>
                    <li>• Da oportunidad de mejora.</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Panel derecho - Contenido */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className={isPositive ? "text-emerald-500" : "text-red-500"} size={24} />
                {behavior ? 'Editar comportamiento' : 'Nuevo comportamiento'}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Row 1: Tipo + Icono seleccionado */}
              <div className="flex gap-3">
                {/* Tipo: Positivo/Negativo */}
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Tipo</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPositive(true)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isPositive
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      ✨ Dar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPositive(false)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        !isPositive
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      ⚡ Quitar
                    </button>
                  </div>
                </div>

                {/* Icono seleccionado preview */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Icono</label>
                  <div className={`
                    w-[76px] h-[42px] rounded-xl flex items-center justify-center text-2xl
                    ${isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300 dark:border-emerald-700' : 'bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700'}
                  `}>
                    {icon}
                  </div>
                </div>
              </div>

              {/* Row 2: Iconos grid */}
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-10 h-10 text-lg rounded-xl transition-all hover:scale-105 ${
                      icon === emoji
                        ? isPositive 
                          ? 'bg-emerald-500 ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                          : 'bg-red-500 ring-2 ring-red-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Row 3: Nombre y Descripción en grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej: Participación"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Descripción</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Row 4: Recompensas combinadas */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Recompensas {isPositive ? '(dar)' : '(quitar)'} - Puedes combinar
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* XP */}
                  <div className={`p-3 rounded-xl border-2 transition-all ${
                    xpValue > 0 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles size={14} className="text-emerald-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">XP</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={xpValue}
                      onChange={(e) => setXpValue(parseInt(e.target.value) || 0)}
                      className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {/* HP */}
                  <div className={`p-3 rounded-xl border-2 transition-all ${
                    hpValue > 0 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Heart size={14} className="text-red-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">HP</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={hpValue}
                      onChange={(e) => setHpValue(parseInt(e.target.value) || 0)}
                      className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {/* GP (Oro) */}
                  <div className={`p-3 rounded-xl border-2 transition-all ${
                    gpValue > 0 
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Coins size={14} className="text-amber-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Oro</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={gpValue}
                      onChange={(e) => setGpValue(parseInt(e.target.value) || 0)}
                      className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Deja en 0 los tipos que no quieras incluir
                </p>
              </div>

              {/* Selector de Competencia */}
              {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Award size={14} className="text-emerald-500" />
                    Competencia asociada
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={() => setCompetencyId(null)}
                      className={`p-2 rounded-lg text-left text-xs ${!competencyId ? 'bg-white dark:bg-gray-600 ring-1 ring-gray-300 dark:ring-gray-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      <span className="text-gray-500 dark:text-gray-400">Sin competencia</span>
                    </button>
                    {classroomCompetencies.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCompetencyId(c.id)}
                        className={`p-2 rounded-lg text-left text-xs ${competencyId === c.id ? 'bg-emerald-100 dark:bg-emerald-900/50 ring-1 ring-emerald-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {competencyId === c.id && <Check size={12} className="text-emerald-500" />}
                          <span className="truncate text-gray-800 dark:text-white">{c.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {competencyId ? 'Este comportamiento contribuirá a la competencia seleccionada' : 'Opcional - para calificación por competencias'}
                  </p>
                </div>
              )}
            </form>

            {/* Footer con botón */}
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={handleSubmit}
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
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal de generación con IA
const AIBehaviorModal = ({
  isOpen,
  onClose,
  classroom,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroom: Classroom;
  onImport: (behaviors: GeneratedBehavior[]) => void;
}) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(10);
  const [includePositive, setIncludePositive] = useState(true);
  const [includeNegative, setIncludeNegative] = useState(true);
  const [pointMode, setPointMode] = useState<'COMBINED' | 'XP_ONLY' | 'HP_ONLY' | 'GP_ONLY'>('COMBINED');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBehaviors, setGeneratedBehaviors] = useState<GeneratedBehavior[]>([]);
  const [selectedBehaviors, setSelectedBehaviors] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);

  // Cargar competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas-ai'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  const handleGenerate = async () => {
    if (!description.trim() || !level.trim()) {
      toast.error('Completa la descripción y el nivel educativo');
      return;
    }

    setIsGenerating(true);
    try {
      const competenciesToSend = classroom?.useCompetencies && selectedCompetencies.length > 0
        ? classroomCompetencies
            .filter((c: any) => selectedCompetencies.includes(c.id))
            .map((c: any) => ({ id: c.id, name: c.name }))
        : undefined;

      const result = await behaviorApi.generateWithAI({
        description,
        level,
        count,
        includePositive,
        includeNegative,
        pointMode,
        competencies: competenciesToSend,
      });

      setGeneratedBehaviors(result.behaviors);
      setSelectedBehaviors(new Set(result.behaviors.map((_, i) => i)));
      setStep('preview');
      toast.success(`${result.behaviors.length} comportamientos generados`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al generar comportamientos');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = () => {
    const behaviorsToImport = generatedBehaviors.filter((_, i) => selectedBehaviors.has(i));
    if (behaviorsToImport.length === 0) {
      toast.error('Selecciona al menos un comportamiento');
      return;
    }
    onImport(behaviorsToImport);
    // Reset
    setStep('form');
    setGeneratedBehaviors([]);
    setSelectedBehaviors(new Set());
    setDescription('');
    setSelectedCompetencies([]);
  };

  const toggleBehavior = (index: number) => {
    const newSelected = new Set(selectedBehaviors);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedBehaviors(newSelected);
  };

  const updateBehavior = (index: number, updates: Partial<GeneratedBehavior>) => {
    setGeneratedBehaviors(prev => prev.map((b, i) => 
      i === index ? { ...b, ...updates } : b
    ));
  };

  const deleteBehavior = (index: number) => {
    setGeneratedBehaviors(prev => prev.filter((_, i) => i !== index));
    setSelectedBehaviors(prev => {
      const newSet = new Set<number>();
      prev.forEach(i => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
    setEditingIndex(null);
  };

  const handleClose = () => {
    setStep('form');
    setGeneratedBehaviors([]);
    setSelectedBehaviors(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  {step === 'form' ? 'Generar Comportamientos con IA' : 'Vista Previa'}
                </h2>
                <p className="text-xs text-gray-500">
                  {step === 'form' ? 'Describe cómo quieres evaluar tu clase' : `${selectedBehaviors.size} de ${generatedBehaviors.length} seleccionados`}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'form' ? (
              <div className="space-y-4">
                {/* Introducción amigable */}
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    💡 <strong>¿Qué son los comportamientos?</strong> Son acciones que premias o penalizas en clase.
                    Los positivos dan puntos (XP, HP, GP) y los negativos los quitan. ¡Motiva las buenas acciones!
                  </p>
                </div>

                {/* Ejemplos rápidos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🚀 Ejemplos rápidos <span className="font-normal text-gray-500">(clic para usar)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { emoji: '✋', title: 'Participación', desc: 'Premiar levantar la mano, responder preguntas, aportar ideas. Penalizar no participar o distraerse.' },
                      { emoji: '📝', title: 'Tareas y trabajos', desc: 'Premiar entregas puntuales y trabajos completos. Penalizar tareas incompletas o atrasadas.' },
                      { emoji: '🤝', title: 'Convivencia', desc: 'Premiar respeto, ayudar compañeros, trabajo en equipo. Penalizar faltas de respeto o interrupciones.' },
                      { emoji: '📱', title: 'Uso de tecnología', desc: 'Premiar buen uso de dispositivos. Penalizar celular sin permiso, distracciones digitales.' },
                      { emoji: '🎒', title: 'Organización', desc: 'Premiar traer materiales, orden, puntualidad. Penalizar olvidos, desorden, impuntualidad.' },
                      { emoji: '🧪', title: 'Clase práctica', desc: 'Premiar seguir instrucciones, cuidar materiales, limpiar área. Penalizar mal uso de equipos.' },
                    ].map((example) => (
                      <button
                        key={example.title}
                        onClick={() => setDescription(example.desc)}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          description === example.desc
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{example.emoji}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{example.title}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción personalizada */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ✏️ O escribe tu propia descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe qué acciones quieres premiar y cuáles penalizar..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Nivel y Cantidad */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🎓 Nivel educativo
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Primaria (6-11 años)">Primaria (6-11 años)</option>
                      <option value="Secundaria (12-16 años)">Secundaria (12-16 años)</option>
                      <option value="Preparatoria/Bachillerato">Preparatoria/Bachillerato</option>
                      <option value="Universidad">Universidad</option>
                      <option value="Formación profesional">Formación profesional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🔢 ¿Cuántos comportamientos?
                    </label>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                      min={5}
                      max={20}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Incluir positivos/negativos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ✅ ¿Qué tipo de comportamientos incluir?
                  </label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      includePositive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600'
                    }`}>
                      <input
                        type="checkbox"
                        checked={includePositive}
                        onChange={(e) => setIncludePositive(e.target.checked)}
                        className="sr-only"
                      />
                      <Sparkles size={18} className="text-emerald-500" />
                      <div>
                        <div className="text-sm font-medium">Positivos</div>
                        <div className="text-xs text-gray-500">Dan puntos</div>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      includeNegative ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                    }`}>
                      <input
                        type="checkbox"
                        checked={includeNegative}
                        onChange={(e) => setIncludeNegative(e.target.checked)}
                        className="sr-only"
                      />
                      <Heart size={18} className="text-red-500" />
                      <div>
                        <div className="text-sm font-medium">Negativos</div>
                        <div className="text-xs text-gray-500">Quitan puntos</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Modo de puntos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🎮 ¿Qué puntos usar?
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: 'COMBINED', label: 'Combinado', icon: '🎮', desc: 'XP + HP + GP' },
                      { value: 'XP_ONLY', label: 'Solo XP', icon: '⭐', desc: 'Experiencia' },
                      { value: 'HP_ONLY', label: 'Solo HP', icon: '❤️', desc: 'Vida/Salud' },
                      { value: 'GP_ONLY', label: 'Solo GP', icon: '🪙', desc: 'Oro/Monedas' },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setPointMode(mode.value as typeof pointMode)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          pointMode === mode.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{mode.icon}</div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white">{mode.label}</div>
                        <div className="text-xs text-gray-500">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de Competencias */}
                {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Award size={14} className="inline mr-1 text-emerald-500" />
                      Competencias a considerar <span className="font-normal text-gray-500">(la IA las asignará)</span>
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600">
                      {classroomCompetencies.map((c: any) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                            selectedCompetencies.includes(c.id)
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 ring-1 ring-emerald-500'
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCompetencies.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCompetencies([...selectedCompetencies, c.id]);
                              } else {
                                setSelectedCompetencies(selectedCompetencies.filter(id => id !== c.id));
                              }
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedCompetencies.includes(c.id)
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {selectedCompetencies.includes(c.id) && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-xs text-gray-800 dark:text-white truncate">{c.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedCompetencies.length > 0 
                        ? `${selectedCompetencies.length} competencia(s) seleccionada(s) - la IA asignará la más apropiada a cada comportamiento`
                        : 'Opcional - selecciona competencias para que la IA las asigne automáticamente'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Preview de comportamientos generados */
              <div className="space-y-2">
                {generatedBehaviors.map((b, index) => (
                  editingIndex === index ? (
                    /* Formulario de edición inline */
                    <div key={index} className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Editando comportamiento</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteBehavior(index)}
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Tipo y icono */}
                      <div className="flex gap-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateBehavior(index, { isPositive: true })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${b.isPositive ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                          >
                            Dar
                          </button>
                          <button
                            onClick={() => updateBehavior(index, { isPositive: false })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!b.isPositive ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                          >
                            Quitar
                          </button>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '💔', '⚡', '🔥', '❌'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => updateBehavior(index, { icon: emoji })}
                              className={`w-7 h-7 rounded text-sm ${b.icon === emoji ? 'bg-blue-500 ring-2 ring-blue-400' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nombre y descripción */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={b.name}
                          onChange={(e) => updateBehavior(index, { name: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={b.description}
                          onChange={(e) => updateBehavior(index, { description: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Descripción"
                        />
                      </div>

                      {/* Puntos */}
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                          <Sparkles size={12} className="text-emerald-600" />
                          <input
                            type="number"
                            value={b.xpValue}
                            onChange={(e) => updateBehavior(index, { xpValue: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-emerald-400"
                            min={0}
                          />
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <Heart size={12} className="text-red-600" />
                          <input
                            type="number"
                            value={b.hpValue}
                            onChange={(e) => updateBehavior(index, { hpValue: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-red-400"
                            min={0}
                          />
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          <Coins size={12} className="text-amber-600" />
                          <input
                            type="number"
                            value={b.gpValue}
                            onChange={(e) => updateBehavior(index, { gpValue: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-amber-400"
                            min={0}
                          />
                        </div>
                      </div>

                      {/* Selector de competencia en edición inline */}
                      {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            <Award size={10} className="inline mr-1" />
                            Competencia
                          </label>
                          <select
                            value={b.competencyId || ''}
                            onChange={(e) => updateBehavior(index, { competencyId: e.target.value || undefined })}
                            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          >
                            <option value="">Sin competencia</option>
                            {classroomCompetencies.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        onClick={() => setEditingIndex(null)}
                        className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                      >
                        <Check size={14} className="inline mr-1" /> Listo
                      </button>
                    </div>
                  ) : (
                    /* Vista normal del comportamiento */
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        selectedBehaviors.has(index)
                          ? b.isPositive
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-600 opacity-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleBehavior(index)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedBehaviors.has(index)
                            ? b.isPositive ? 'bg-emerald-500 border-emerald-500' : 'bg-red-500 border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selectedBehaviors.has(index) && <Check size={12} className="text-white" />}
                      </button>

                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                        b.isPositive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'
                      }`}>
                        {b.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800 dark:text-white truncate">{b.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            b.isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                          }`}>
                            {b.isPositive ? 'Dar' : 'Quitar'}
                          </span>
                          {b.competencyId && classroomCompetencies.find((c: any) => c.id === b.competencyId) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 flex items-center gap-1">
                              <Award size={10} />
                              {classroomCompetencies.find((c: any) => c.id === b.competencyId)?.name?.substring(0, 20)}...
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{b.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        {b.xpValue > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Sparkles size={12} /> {b.xpValue}
                          </span>
                        )}
                        {b.hpValue > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Heart size={12} /> {b.hpValue}
                          </span>
                        )}
                        {b.gpValue > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Coins size={12} /> {b.gpValue}
                          </span>
                        )}
                      </div>
                      {/* Botón editar */}
                      <button
                        onClick={() => setEditingIndex(index)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex-shrink-0"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-between items-center">
              {step === 'preview' && (
                <button
                  onClick={() => setStep('form')}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ← Volver
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                {step === 'form' ? (
                  <button
                    onClick={handleGenerate}
                    disabled={!description.trim() || !level.trim() || (!includePositive && !includeNegative) || isGenerating}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generar con IA
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleImport}
                    disabled={selectedBehaviors.size === 0}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} />
                    Importar {selectedBehaviors.size} seleccionados
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
