import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Plus,
  Edit2,
  Trash2,
  Play,
  Users,
  Heart,
  Trophy,
  Calendar,
  Clock,
  Target,
  Zap,
  Coins,
  X,
  Skull,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  studentBossBattleApi,
  type StudentBossBattle,
  type CreateBattleDto,
  STATUS_CONFIG,
} from '../../lib/studentBossBattleApi';
import { questionBankApi } from '../../lib/questionBankApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const StudentBossBattlesPage = () => {
  const { id: classroomId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBattle, setEditingBattle] = useState<StudentBossBattle | null>(null);
  const [viewingBattle, setViewingBattle] = useState<StudentBossBattle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; battle: StudentBossBattle | null }>({ isOpen: false, battle: null });

  // Obtener batallas
  const { data: battles = [], isLoading } = useQuery({
    queryKey: ['student-boss-battles', classroomId],
    queryFn: () => studentBossBattleApi.getByClassroom(classroomId!),
    enabled: !!classroomId,
  });

  // Obtener bancos de preguntas
  const { data: questionBanks = [] } = useQuery({
    queryKey: ['question-banks', classroomId],
    queryFn: () => questionBankApi.getBanks(classroomId!),
    enabled: !!classroomId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateBattleDto) => studentBossBattleApi.create(classroomId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-boss-battles', classroomId] });
      setShowCreateModal(false);
      toast.success('Boss Battle creada');
    },
    onError: () => toast.error('Error al crear batalla'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBattleDto> }) =>
      studentBossBattleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-boss-battles', classroomId] });
      setEditingBattle(null);
      toast.success('Batalla actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentBossBattleApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-boss-battles', classroomId] });
      toast.success('Batalla eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => studentBossBattleApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-boss-battles', classroomId] });
      toast.success('¡Batalla activada!');
    },
    onError: () => toast.error('Error al activar'),
  });

  const getHpPercentage = (battle: StudentBossBattle) => {
    return Math.round((battle.bossCurrentHp / battle.bossMaxHp) * 100);
  };

  const getHpColor = (percentage: number) => {
    if (percentage > 60) return 'bg-emerald-500';
    if (percentage > 30) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Swords className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Boss Battles para Estudiantes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Crea batallas donde los estudiantes responden preguntas para derrotar al boss
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus size={18} />
          Nueva Batalla
        </Button>
      </div>

      {/* Lista de batallas */}
      {battles.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl">
          <Swords className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={64} />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
            No hay Boss Battles
          </h3>
          <p className="text-gray-500 dark:text-gray-500 mb-4">
            Crea tu primera batalla para que los estudiantes puedan participar
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus size={18} />
            Crear Boss Battle
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {battles.map((battle) => {
            const statusConfig = STATUS_CONFIG[battle.status];
            const hpPercentage = getHpPercentage(battle);

            return (
              <motion.div
                key={battle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Boss image/header */}
                <div className="relative h-32 bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  {battle.bossImageUrl ? (
                    <img
                      src={battle.bossImageUrl}
                      alt={battle.bossName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Skull className="text-white/30" size={64} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white truncate">{battle.bossName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${statusConfig.color}-500/20 text-${statusConfig.color}-100`}>
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HP Bar */}
                <div className="px-4 pt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Heart size={12} className="text-red-500" />
                      HP del Boss
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {battle.bossCurrentHp} / {battle.bossMaxHp}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${hpPercentage}%` }}
                      className={`h-full ${getHpColor(hpPercentage)} rounded-full`}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="p-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <Users size={14} className="mx-auto text-blue-500 mb-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Participantes</span>
                    <p className="font-bold text-gray-800 dark:text-white">{battle.participantCount || 0}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <Target size={14} className="mx-auto text-amber-500 mb-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Preguntas</span>
                    <p className="font-bold text-gray-800 dark:text-white">{battle.questionsPerAttempt}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <Zap size={14} className="mx-auto text-purple-500 mb-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Daño</span>
                    <p className="font-bold text-gray-800 dark:text-white">{battle.damagePerCorrect}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex gap-2">
                  {battle.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate(battle.id)}
                      disabled={activateMutation.isPending}
                      className="flex-1 gap-1 bg-gradient-to-r from-emerald-500 to-green-500"
                    >
                      <Play size={14} />
                      Activar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewingBattle(battle)}
                    className="flex-1"
                  >
                    Ver detalles
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingBattle(battle)}
                    className="p-2"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirm({ isOpen: true, battle })}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal de crear/editar */}
      <AnimatePresence>
        {(showCreateModal || editingBattle) && (
          <BattleFormModal
            battle={editingBattle}
            questionBanks={questionBanks}
            onClose={() => {
              setShowCreateModal(false);
              setEditingBattle(null);
            }}
            onSubmit={(data) => {
              if (editingBattle) {
                updateMutation.mutate({ id: editingBattle.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Modal de detalles */}
      <AnimatePresence>
        {viewingBattle && (
          <BattleDetailModal
            battleId={viewingBattle.id}
            onClose={() => setViewingBattle(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, battle: null })}
        onConfirm={() => {
          if (deleteConfirm.battle) {
            deleteMutation.mutate(deleteConfirm.battle.id);
          }
          setDeleteConfirm({ isOpen: false, battle: null });
        }}
        title="¿Eliminar batalla?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.battle?.bossName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// ==================== Modal de formulario ====================

interface BattleFormModalProps {
  battle: StudentBossBattle | null;
  questionBanks: any[];
  onClose: () => void;
  onSubmit: (data: CreateBattleDto) => void;
  isLoading: boolean;
}

const BattleFormModal = ({ battle, questionBanks, onClose, onSubmit, isLoading }: BattleFormModalProps) => {
  const [formData, setFormData] = useState<CreateBattleDto>({
    bossName: battle?.bossName || '',
    bossImageUrl: battle?.bossImageUrl || '',
    bossMaxHp: battle?.bossMaxHp || 100,
    questionBankId: battle?.questionBankId || '',
    questionsPerAttempt: battle?.questionsPerAttempt || 5,
    damagePerCorrect: battle?.damagePerCorrect || 10,
    damageToStudentOnWrong: battle?.damageToStudentOnWrong || 5,
    maxAttempts: battle?.maxAttempts || 1,
    xpPerCorrectAnswer: battle?.xpPerCorrectAnswer || 10,
    gpPerCorrectAnswer: battle?.gpPerCorrectAnswer || 5,
    bonusXpOnVictory: battle?.bonusXpOnVictory || 50,
    bonusGpOnVictory: battle?.bonusGpOnVictory || 25,
    startDate: battle?.startDate || null,
    endDate: battle?.endDate || null,
    startImmediately: false,
  });

  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>(
    battle?.startDate ? 'scheduled' : 'immediate'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.questionBankId) {
      toast.error('Selecciona un banco de preguntas');
      return;
    }
    onSubmit({
      ...formData,
      startImmediately: scheduleType === 'immediate',
      startDate: scheduleType === 'scheduled' ? formData.startDate : null,
      endDate: scheduleType === 'scheduled' ? formData.endDate : null,
    });
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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {battle ? 'Editar Boss Battle' : 'Nueva Boss Battle'}
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
          {/* Info del Boss */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <h3 className="font-medium text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
              <Skull size={18} />
              Información del Boss
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Boss *
                </label>
                <input
                  type="text"
                  value={formData.bossName}
                  onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ej: Dragón de las Matemáticas"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  HP del Boss *
                </label>
                <input
                  type="number"
                  value={formData.bossMaxHp}
                  onChange={(e) => setFormData({ ...formData, bossMaxHp: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  min={10}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL de imagen (opcional)
                </label>
                <input
                  type="url"
                  value={formData.bossImageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, bossImageUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Banco de preguntas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Banco de Preguntas *
            </label>
            <select
              value={formData.questionBankId}
              onChange={(e) => setFormData({ ...formData, questionBankId: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              required
            >
              <option value="">Seleccionar banco...</option>
              {questionBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.icon} {bank.name} ({bank.questionCount || 0} preguntas)
                </option>
              ))}
            </select>
          </div>

          {/* Configuración de batalla */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
            <h3 className="font-medium text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
              <Target size={18} />
              Configuración de Batalla
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Preguntas por intento</label>
                <input
                  type="number"
                  value={formData.questionsPerAttempt}
                  onChange={(e) => setFormData({ ...formData, questionsPerAttempt: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  min={1}
                  max={50}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Daño por correcta</label>
                <input
                  type="number"
                  value={formData.damagePerCorrect}
                  onChange={(e) => setFormData({ ...formData, damagePerCorrect: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Daño al estudiante</label>
                <input
                  type="number"
                  value={formData.damageToStudentOnWrong}
                  onChange={(e) => setFormData({ ...formData, damageToStudentOnWrong: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Intentos permitidos</label>
                <input
                  type="number"
                  value={formData.maxAttempts}
                  onChange={(e) => setFormData({ ...formData, maxAttempts: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  min={1}
                  max={10}
                />
              </div>
            </div>
          </div>

          {/* Recompensas */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
              <Trophy size={18} />
              Recompensas
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">XP por correcta</label>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-purple-500" />
                  <input
                    type="number"
                    value={formData.xpPerCorrectAnswer}
                    onChange={(e) => setFormData({ ...formData, xpPerCorrectAnswer: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">GP por correcta</label>
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-amber-500" />
                  <input
                    type="number"
                    value={formData.gpPerCorrectAnswer}
                    onChange={(e) => setFormData({ ...formData, gpPerCorrectAnswer: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bonus XP al ganar</label>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-purple-500" />
                  <input
                    type="number"
                    value={formData.bonusXpOnVictory}
                    onChange={(e) => setFormData({ ...formData, bonusXpOnVictory: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bonus GP al ganar</label>
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-amber-500" />
                  <input
                    type="number"
                    value={formData.bonusGpOnVictory}
                    onChange={(e) => setFormData({ ...formData, bonusGpOnVictory: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Programación */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <h3 className="font-medium text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
              <Calendar size={18} />
              Programación
            </h3>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'immediate'}
                  onChange={() => setScheduleType('immediate')}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm">Iniciar inmediatamente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'scheduled'}
                  onChange={() => setScheduleType('scheduled')}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm">Programar fechas</span>
              </label>
            </div>
            {scheduleType === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de inicio</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate ? new Date(formData.startDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha de fin (opcional)</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate ? new Date(formData.endDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : battle ? 'Guardar Cambios' : 'Crear Batalla'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ==================== Modal de detalles ====================

interface BattleDetailModalProps {
  battleId: string;
  onClose: () => void;
}

const BattleDetailModal = ({ battleId, onClose }: BattleDetailModalProps) => {
  const { data: battle, isLoading } = useQuery({
    queryKey: ['student-boss-battle', battleId],
    queryFn: () => studentBossBattleApi.getById(battleId),
    refetchInterval: 5000, // Refrescar cada 5 segundos
  });

  if (isLoading || !battle) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto" />
        </div>
      </motion.div>
    );
  }

  const hpPercentage = Math.round((battle.bossCurrentHp / battle.bossMaxHp) * 100);
  const statusConfig = STATUS_CONFIG[battle.status];

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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="relative h-40 bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
          {battle.bossImageUrl ? (
            <img src={battle.bossImageUrl} alt={battle.bossName} className="w-full h-full object-cover" />
          ) : (
            <Skull className="text-white/30" size={80} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-lg text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{battle.bossName}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white mt-1`}>
                  {statusConfig.icon} {statusConfig.label}
                </span>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-sm">HP</div>
                <div className="text-2xl font-bold text-white">
                  {battle.bossCurrentHp} / {battle.bossMaxHp}
                </div>
              </div>
            </div>
            {/* HP Bar */}
            <div className="mt-3 h-3 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${hpPercentage}%` }}
                className={`h-full ${hpPercentage > 60 ? 'bg-emerald-500' : hpPercentage > 30 ? 'bg-amber-500' : 'bg-red-500'} rounded-full`}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <Users className="mx-auto text-blue-500 mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {(battle as any).participants?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Participantes</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <Target className="mx-auto text-amber-500 mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {battle.questionsPerAttempt}
              </div>
              <div className="text-xs text-gray-500">Preguntas</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <Zap className="mx-auto text-purple-500 mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {battle.damagePerCorrect}
              </div>
              <div className="text-xs text-gray-500">Daño/Correcta</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <Clock className="mx-auto text-green-500 mb-2" size={24} />
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {battle.maxAttempts}
              </div>
              <div className="text-xs text-gray-500">Intentos</div>
            </div>
          </div>

          {/* Participantes */}
          <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            Ranking de Participantes
          </h3>
          {(battle as any).participants?.length > 0 ? (
            <div className="space-y-2">
              {(battle as any).participants.map((p: any, index: number) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <img
                    src={p.student?.avatarUrl || `https://ui-avatars.com/api/?name=${p.student?.characterName?.[0] || '?'}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800 dark:text-white">
                      {p.student?.characterName || p.student?.displayName || 'Estudiante'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.totalCorrectAnswers} correctas • {p.attemptsUsed}/{battle.maxAttempts} intentos
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-500">{p.totalDamageDealt} daño</div>
                    <div className="text-xs text-gray-500">
                      +{p.xpEarned} XP • +{p.gpEarned} GP
                    </div>
                  </div>
                  {p.isCurrentlyBattling && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs animate-pulse">
                      ⚔️ Batallando
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto mb-2 opacity-50" size={32} />
              Aún no hay participantes
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudentBossBattlesPage;
