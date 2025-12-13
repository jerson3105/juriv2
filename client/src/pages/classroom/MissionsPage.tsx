import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Upload,
  FileText,
  Send,
  BarChart3,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import {
  missionApi,
  type Mission,
  type CreateMissionDto,
  type MissionType,
  type MissionCategory,
  MISSION_TYPE_LABELS,
  MISSION_CATEGORY_LABELS,
  OBJECTIVE_TYPE_LABELS,
  MISSION_ICONS,
  MISSION_TYPE_COLORS,
} from '../../lib/missionApi';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import toast from 'react-hot-toast';

const OBJECTIVE_TYPES = [
  { value: 'EARN_XP', label: 'Ganar XP', defaultTarget: 50 },
  { value: 'EARN_GP', label: 'Ganar Oro', defaultTarget: 20 },
  { value: 'ATTEND_CLASS', label: 'Asistir a clase', defaultTarget: 1 },
  { value: 'COMPLETE_BATTLE', label: 'Completar batalla', defaultTarget: 1 },
  { value: 'MAKE_PURCHASE', label: 'Hacer compra', defaultTarget: 1 },
  { value: 'GIVE_GIFT', label: 'Dar regalo', defaultTarget: 1 },
  { value: 'COMPLETE_MISSIONS', label: 'Completar misiones', defaultTarget: 3 },
  { value: 'CUSTOM', label: 'Personalizado (manual)', defaultTarget: 1 },
];

export const MissionsPage = () => {
  const { id: classroomId } = useParams<{ id: string }>();
  useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [selectedType, setSelectedType] = useState<MissionType | 'ALL'>('ALL');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningMission, setAssigningMission] = useState<Mission | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mission: Mission | null }>({ isOpen: false, mission: null });

  // Form state
  const [formData, setFormData] = useState<CreateMissionDto>({
    name: '',
    description: '',
    icon: '🎯',
    type: 'DAILY',
    category: 'PROGRESS',
    objectiveType: 'EARN_XP',
    objectiveTarget: 50,
    rewardXp: 20,
    rewardGp: 10,
    rewardHp: 0,
    isRepeatable: true,
    autoAssign: true,
    autoExpire: true,
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Queries
  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['missions', classroomId, selectedType],
    queryFn: () => missionApi.getClassroomMissions(classroomId!, selectedType === 'ALL' ? undefined : selectedType),
    enabled: !!classroomId,
  });

  const { data: stats } = useQuery({
    queryKey: ['mission-stats', classroomId],
    queryFn: () => missionApi.getStats(classroomId!),
    enabled: !!classroomId,
  });

  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId!),
    enabled: !!classroomId,
  });

  // Query para obtener asignaciones detalladas cuando se abre el modal
  const { data: missionAssignments } = useQuery({
    queryKey: ['mission-assignments', assigningMission?.id],
    queryFn: () => missionApi.getMissionAssignments(assigningMission!.id),
    enabled: !!assigningMission,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateMissionDto) => {
      // Upload file if exists
      let attachmentUrl = data.attachmentUrl;
      let attachmentName = data.attachmentName;
      
      if (attachmentFile) {
        const uploadResult = await missionApi.uploadFile(attachmentFile);
        attachmentUrl = uploadResult.url;
        attachmentName = uploadResult.name;
      }

      return missionApi.createMission(classroomId!, {
        ...data,
        attachmentUrl,
        attachmentName,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['missions', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['mission-stats', classroomId] });
      if (result.assignedCount !== undefined && result.assignedCount > 0) {
        toast.success(`Misión creada y asignada a ${result.assignedCount} estudiante(s)`);
      } else {
        toast.success('Misión creada exitosamente');
      }
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear la misión');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateMissionDto> }) => {
      let attachmentUrl = data.attachmentUrl;
      let attachmentName = data.attachmentName;
      
      if (attachmentFile) {
        const uploadResult = await missionApi.uploadFile(attachmentFile);
        attachmentUrl = uploadResult.url;
        attachmentName = uploadResult.name;
      }

      return missionApi.updateMission(id, {
        ...data,
        attachmentUrl,
        attachmentName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions', classroomId] });
      toast.success('Misión actualizada');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: missionApi.deleteMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['mission-stats', classroomId] });
      toast.success('Misión eliminada');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ missionId, studentIds }: { missionId: string; studentIds: string[] }) =>
      missionApi.assignMission(missionId, studentIds),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mission-assignments', variables.missionId] });
      toast.success(`Misión asignada a ${data.length} estudiante(s)`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al asignar');
    },
  });

  const assignAllMutation = useMutation({
    mutationFn: (missionId: string) => missionApi.assignMissionToAll(classroomId!, missionId),
    onSuccess: (data, missionId) => {
      queryClient.invalidateQueries({ queryKey: ['mission-assignments', missionId] });
      toast.success(`Misión asignada a ${data.assigned} estudiante(s)`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al asignar');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingMission(null);
    setAttachmentFile(null);
    setFormData({
      name: '',
      description: '',
      icon: '🎯',
      type: 'DAILY',
      category: 'PROGRESS',
      objectiveType: 'EARN_XP',
      objectiveTarget: 50,
      rewardXp: 20,
      rewardGp: 10,
      rewardHp: 0,
      isRepeatable: true,
      autoAssign: true,
      autoExpire: true,
    });
  };

  const openEditModal = (mission: Mission) => {
    setEditingMission(mission);
    setFormData({
      name: mission.name,
      description: mission.description,
      icon: mission.icon,
      type: mission.type,
      category: mission.category,
      objectiveType: mission.objectiveType,
      objectiveTarget: mission.objectiveTarget,
      objectiveConfig: mission.objectiveConfig,
      rewardXp: mission.rewardXp,
      rewardGp: mission.rewardGp,
      rewardHp: mission.rewardHp,
      attachmentUrl: mission.attachmentUrl || undefined,
      attachmentName: mission.attachmentName || undefined,
      isRepeatable: mission.isRepeatable,
      maxCompletions: mission.maxCompletions || undefined,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMission) {
      updateMutation.mutate({ id: editingMission.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no puede superar 5MB');
        return;
      }
      setAttachmentFile(file);
    }
  };

  const handleObjectiveTypeChange = (type: string) => {
    const objective = OBJECTIVE_TYPES.find(o => o.value === type);
    setFormData(prev => ({
      ...prev,
      objectiveType: type,
      objectiveTarget: objective?.defaultTarget || 1,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
            <Target className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">
              Misiones
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Crea y gestiona misiones para motivar a tus estudiantes
            </p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Nueva Misión
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.totalMissions}</p>
                <p className="text-xs text-gray-500">Total misiones</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.totalCompleted}</p>
                <p className="text-xs text-gray-500">Completadas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.totalAssigned}</p>
                <p className="text-xs text-gray-500">Asignadas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.completionRate}%</p>
                <p className="text-xs text-gray-500">Tasa completación</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'DAILY', 'WEEKLY', 'SPECIAL'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedType === type
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {type === 'ALL' ? 'Todas' : MISSION_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Missions List */}
      {missions.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
            No hay misiones
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crea tu primera misión para motivar a tus estudiantes
          </p>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Crear Misión
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.map((mission) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`p-5 border-l-4 ${MISSION_TYPE_COLORS[mission.type].border}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${MISSION_TYPE_COLORS[mission.type].bg}`}>
                      {mission.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white">{mission.name}</h3>
                      <span className={`text-xs font-medium ${MISSION_TYPE_COLORS[mission.type].text}`}>
                        {MISSION_TYPE_LABELS[mission.type]}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(mission)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, mission })}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {mission.description}
                </p>

                {/* Objetivo */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Target className="w-4 h-4" />
                  <span>{OBJECTIVE_TYPE_LABELS[mission.objectiveType] || mission.objectiveType}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    ({mission.objectiveTarget})
                  </span>
                </div>

                {/* Recompensas */}
                <div className="flex items-center gap-3 mb-4">
                  {mission.rewardXp > 0 && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                      +{mission.rewardXp} XP
                    </span>
                  )}
                  {mission.rewardGp > 0 && (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      💰 +{mission.rewardGp}
                    </span>
                  )}
                  {mission.rewardHp > 0 && (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      ❤️ +{mission.rewardHp}
                    </span>
                  )}
                </div>

                {/* Archivo adjunto */}
                {mission.attachmentUrl && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                    <FileText className="w-4 h-4" />
                    <a href={mission.attachmentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {mission.attachmentName || 'Archivo adjunto'}
                    </a>
                  </div>
                )}

                {/* Acciones */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setAssigningMission(mission);
                    setShowAssignModal(true);
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Asignar a estudiantes
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => closeModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {editingMission ? 'Editar Misión' : 'Nueva Misión'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Icono y Nombre */}
                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Icono
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          const icons = MISSION_ICONS;
                          const currentIndex = icons.indexOf(formData.icon || '🎯');
                          const nextIndex = (currentIndex + 1) % icons.length;
                          setFormData(prev => ({ ...prev, icon: icons[nextIndex] }));
                        }}
                      >
                        {formData.icon}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre de la misión *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      placeholder="Ej: Guerrero del Día"
                      required
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    rows={2}
                    placeholder="Describe qué debe hacer el estudiante"
                    required
                  />
                </div>

                {/* Tipo y Categoría */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as MissionType }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                      <option value="DAILY">Diaria</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="SPECIAL">Especial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoría
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as MissionCategory }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                      {Object.entries(MISSION_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Objetivo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de objetivo
                    </label>
                    <select
                      value={formData.objectiveType}
                      onChange={(e) => handleObjectiveTypeChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                      {OBJECTIVE_TYPES.map((obj) => (
                        <option key={obj.value} value={obj.value}>{obj.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cantidad objetivo
                    </label>
                    <input
                      type="number"
                      value={formData.objectiveTarget}
                      onChange={(e) => setFormData(prev => ({ ...prev, objectiveTarget: parseInt(e.target.value) || 1 }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      min="1"
                    />
                  </div>
                </div>

                {/* Recompensas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recompensas
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">XP</label>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        <input
                          type="number"
                          value={formData.rewardXp}
                          onChange={(e) => setFormData(prev => ({ ...prev, rewardXp: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Oro</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <input
                          type="number"
                          value={formData.rewardGp}
                          onChange={(e) => setFormData(prev => ({ ...prev, rewardGp: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">HP</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">❤️</span>
                        <input
                          type="number"
                          value={formData.rewardHp}
                          onChange={(e) => setFormData(prev => ({ ...prev, rewardHp: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Archivo adjunto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Archivo adjunto (máx. 5MB)
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <Upload className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {attachmentFile ? attachmentFile.name : 'Seleccionar archivo'}
                      </span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.zip"
                      />
                    </label>
                    {(attachmentFile || formData.attachmentUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentFile(null);
                          setFormData(prev => ({ ...prev, attachmentUrl: undefined, attachmentName: undefined }));
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {formData.attachmentUrl && !attachmentFile && (
                    <p className="text-sm text-blue-600 mt-2">
                      Archivo actual: {formData.attachmentName}
                    </p>
                  )}
                </div>

                {/* Opciones */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRepeatable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isRepeatable: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Puede asignarse múltiples veces
                    </span>
                  </label>

                  {/* Solo mostrar opciones de auto-asignación al crear */}
                  {!editingMission && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autoAssign}
                          onChange={(e) => setFormData(prev => ({ ...prev, autoAssign: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          🚀 Asignar automáticamente a todos los estudiantes
                        </span>
                      </label>

                      {formData.autoAssign && (
                        <label className="flex items-center gap-2 cursor-pointer ml-6">
                          <input
                            type="checkbox"
                            checked={formData.autoExpire}
                            onChange={(e) => setFormData(prev => ({ ...prev, autoExpire: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            ⏰ Expiración automática 
                            <span className="text-gray-500 ml-1">
                              ({formData.type === 'DAILY' ? 'en 24 horas' : 
                                formData.type === 'WEEKLY' ? 'en 7 días' : 
                                'en 30 días'})
                            </span>
                          </span>
                        </label>
                      )}
                    </>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button type="button" variant="secondary" onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingMission ? 'Guardar cambios' : 'Crear misión'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && assigningMission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Asignar Misión
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {assigningMission.name}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <Button
                  className="w-full"
                  onClick={() => assignAllMutation.mutate(assigningMission.id)}
                  disabled={assignAllMutation.isPending}
                >
                  <Users className="w-5 h-5 mr-2" />
                  Asignar a todos los estudiantes
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">o selecciona estudiantes</span>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {classroomData?.students?.map((student) => {
                    const assignment = missionAssignments?.find(a => a.studentProfileId === student.id);
                    const isAssigned = !!assignment;
                    
                    // Determinar color según estado
                    const getStatusStyle = () => {
                      if (!assignment) return { bg: 'hover:bg-gray-50 dark:hover:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
                      switch (assignment.status) {
                        case 'COMPLETED':
                          return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' };
                        case 'CLAIMED':
                          return { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' };
                        default:
                          return { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' };
                      }
                    };
                    
                    const style = getStatusStyle();
                    
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${style.bg}`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300"
                          checked={isAssigned}
                          disabled={isAssigned}
                          onChange={(e) => {
                            if (e.target.checked && !isAssigned) {
                              assignMutation.mutate({
                                missionId: assigningMission.id,
                                studentIds: [student.id],
                              });
                            }
                          }}
                        />
                        <div className="flex-1">
                          <span className={style.text}>
                            {student.characterName || 'Estudiante'}
                          </span>
                          {assignment && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    assignment.status === 'CLAIMED' ? 'bg-green-500' :
                                    assignment.status === 'COMPLETED' ? 'bg-amber-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${(assignment.currentProgress / assignment.targetProgress) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {assignment.currentProgress}/{assignment.targetProgress}
                              </span>
                            </div>
                          )}
                        </div>
                        {assignment && (
                          <span className={`text-xs font-medium ${style.text}`}>
                            {assignment.status === 'CLAIMED' ? '✓ Reclamada' :
                             assignment.status === 'COMPLETED' ? '🎉 Completada' :
                             '⏳ En progreso'}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <Button variant="secondary" className="w-full" onClick={() => setShowAssignModal(false)}>
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, mission: null })}
        onConfirm={() => {
          if (deleteConfirm.mission) {
            deleteMutation.mutate(deleteConfirm.mission.id);
          }
          setDeleteConfirm({ isOpen: false, mission: null });
        }}
        title="¿Eliminar misión?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.mission?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
