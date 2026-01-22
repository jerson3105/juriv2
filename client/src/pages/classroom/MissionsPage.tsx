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
  Award,
  Check,
  Sparkles,
  X,
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
  type GeneratedMission,
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
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [selectedType, setSelectedType] = useState<MissionType | 'ALL'>('ALL');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningMission, setAssigningMission] = useState<Mission | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mission: Mission | null }>({ isOpen: false, mission: null });
  const [showAIModal, setShowAIModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateMissionDto & { competencyIds: string[] }>({
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
    competencyIds: [],
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Cargar competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];
  
  const toggleCompetency = (id: string) => {
    setFormData(p => ({
      ...p,
      competencyIds: p.competencyIds.includes(id) 
        ? p.competencyIds.filter(x => x !== id) 
        : [...p.competencyIds, id]
    }));
  };

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

  const updateProgressMutation = useMutation({
    mutationFn: ({ studentMissionId, progress }: { studentMissionId: string; progress: number }) =>
      missionApi.updateProgressManually(studentMissionId, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission-assignments', assigningMission?.id] });
      toast.success('Progreso actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar progreso');
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
      competencyIds: [],
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
      competencyIds: [],
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
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg"
          >
            <Sparkles size={18} />
            Generar con IA
          </button>
          <Button onClick={() => setShowModal(true)} className="gap-2">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Nueva
          </Button>
        </div>
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

                {/* Selector de Competencias */}
                {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Award size={16} className="text-emerald-500" />
                      Competencias que evalúa
                    </label>
                    <div className="grid grid-cols-1 gap-2 max-h-28 overflow-y-auto p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      {classroomCompetencies.map((c: any) => (
                        <button key={c.id} type="button" onClick={() => toggleCompetency(c.id)}
                          className={`p-2 rounded-lg text-left text-sm ${formData.competencyIds.includes(c.id) ? 'bg-emerald-200 dark:bg-emerald-800 ring-2 ring-emerald-500' : 'bg-white dark:bg-gray-800 hover:bg-emerald-100'}`}>
                          <div className="flex items-center gap-2">
                            {formData.competencyIds.includes(c.id) && <Check size={14} className="text-emerald-600" />}
                            <span className="truncate">{c.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.competencyIds.length === 0 ? 'Opcional' : `${formData.competencyIds.length} seleccionada(s)`}
                    </p>
                  </div>
                )}

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
            onClick={() => { setShowAssignModal(false); setStudentSearch(''); }}
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

                {/* Indicador de misión manual */}
                {assigningMission.objectiveType === 'CUSTOM' && (
                  <div className="p-3 mb-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      📝 <strong>Misión manual:</strong> Usa los botones +/- para actualizar el progreso de cada estudiante.
                    </p>
                  </div>
                )}

                {/* Buscador de estudiantes */}
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Buscar estudiante..."
                    className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {classroomData?.students?.filter(s => 
                    !studentSearch || 
                    (s.characterName || '').toLowerCase().includes(studentSearch.toLowerCase())
                  ).map((student) => {
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
                    const canUpdateProgress = assignment && assigningMission.objectiveType === 'CUSTOM' && assignment.status !== 'CLAIMED';
                    
                    return (
                      <div
                        key={student.id}
                        className={`flex items-center gap-3 p-3 rounded-lg ${style.bg}`}
                      >
                        {!isAssigned ? (
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                            checked={false}
                            onChange={() => {
                              assignMutation.mutate({
                                missionId: assigningMission.id,
                                studentIds: [student.id],
                              });
                            }}
                          />
                        ) : (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`${style.text} truncate block`}>
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
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {assignment.currentProgress}/{assignment.targetProgress}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Controles de progreso manual */}
                        {canUpdateProgress && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateProgressMutation.mutate({
                                studentMissionId: assignment.id,
                                progress: Math.max(0, assignment.currentProgress - 1)
                              })}
                              disabled={assignment.currentProgress <= 0 || updateProgressMutation.isPending}
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                              -
                            </button>
                            <button
                              onClick={() => updateProgressMutation.mutate({
                                studentMissionId: assignment.id,
                                progress: assignment.currentProgress + 1
                              })}
                              disabled={assignment.currentProgress >= assignment.targetProgress || updateProgressMutation.isPending}
                              className="w-6 h-6 flex items-center justify-center bg-purple-500 rounded text-white hover:bg-purple-600 disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                        )}
                        
                        {assignment && !canUpdateProgress && (
                          <span className={`text-xs font-medium ${style.text} whitespace-nowrap`}>
                            {assignment.status === 'CLAIMED' ? '✓ Reclamada' :
                             assignment.status === 'COMPLETED' ? '🎉 Completada' :
                             '⏳ En progreso'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <Button variant="secondary" className="w-full" onClick={() => { setShowAssignModal(false); setStudentSearch(''); }}>
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

      {/* Modal de generación con IA */}
      <AIMissionModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onImport={async (missions: GeneratedMission[]) => {
          let successCount = 0;
          for (const mission of missions) {
            try {
              await createMutation.mutateAsync({
                name: mission.name,
                description: mission.description,
                icon: mission.icon,
                type: mission.type,
                category: mission.category,
                objectiveType: mission.objectiveType,
                objectiveTarget: mission.objectiveTarget,
                rewardXp: mission.rewardXp,
                rewardGp: mission.rewardGp,
                isRepeatable: mission.isRepeatable,
                autoAssign: true,
              });
              successCount++;
            } catch (e) {
              console.error('Error importing mission:', e);
            }
          }
          if (successCount > 0) {
            toast.success(`${successCount} misiones importadas`);
            setShowAIModal(false);
          }
        }}
      />
    </div>
  );
};

// Modal de generación con IA
const AIMissionModal = ({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (missions: GeneratedMission[]) => void;
}) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(6);
  const [types, setTypes] = useState<Set<MissionType>>(new Set(['DAILY', 'WEEKLY']));
  const [categories, setCategories] = useState<Set<MissionCategory>>(new Set(['PARTICIPATION', 'PROGRESS', 'CUSTOM']));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMissions, setGeneratedMissions] = useState<GeneratedMission[]>([]);
  const [selectedMissions, setSelectedMissions] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!description.trim() || !level.trim()) {
      toast.error('Completa la descripción y el nivel educativo');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await missionApi.generateWithAI({
        description,
        level,
        count,
        types: Array.from(types),
        categories: Array.from(categories),
      });

      setGeneratedMissions(result.missions);
      setSelectedMissions(new Set(result.missions.map((_: any, i: number) => i)));
      setStep('preview');
      toast.success(`${result.missions.length} misiones generadas`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al generar misiones');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = () => {
    const missionsToImport = generatedMissions.filter((_, i) => selectedMissions.has(i));
    if (missionsToImport.length === 0) {
      toast.error('Selecciona al menos una misión');
      return;
    }
    onImport(missionsToImport);
    setStep('form');
    setGeneratedMissions([]);
    setSelectedMissions(new Set());
    setDescription('');
  };

  const toggleMission = (index: number) => {
    const newSelected = new Set(selectedMissions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedMissions(newSelected);
  };

  const toggleType = (type: MissionType) => {
    const newTypes = new Set(types);
    if (newTypes.has(type)) {
      if (newTypes.size > 1) newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setTypes(newTypes);
  };

  const toggleCategory = (category: MissionCategory) => {
    const newCategories = new Set(categories);
    if (newCategories.has(category)) {
      if (newCategories.size > 1) newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setCategories(newCategories);
  };

  const updateMission = (index: number, updates: Partial<GeneratedMission>) => {
    setGeneratedMissions(prev => prev.map((m, i) => 
      i === index ? { ...m, ...updates } : m
    ));
  };

  const deleteMission = (index: number) => {
    setGeneratedMissions(prev => prev.filter((_, i) => i !== index));
    setSelectedMissions(prev => {
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
    setGeneratedMissions([]);
    setSelectedMissions(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
                  {step === 'form' ? 'Generar Misiones con IA' : 'Vista Previa'}
                </h2>
                <p className="text-xs text-gray-500">
                  {step === 'form' ? 'Describe qué misiones necesitas' : `${selectedMissions.size} de ${generatedMissions.length} seleccionadas`}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'form' ? (
              <div className="space-y-4">
                {/* Introducción amigable */}
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    💡 <strong>¿Qué son las misiones?</strong> Son retos que motivan a tus estudiantes a lograr objetivos específicos. 
                    Al completarlas, ganan XP y monedas. Puedes crear misiones diarias, semanales o especiales.
                  </p>
                </div>

                {/* Ejemplos rápidos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🚀 Ejemplos rápidos <span className="font-normal text-gray-500">(clic para usar)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { emoji: '✋', title: 'Participación', desc: 'Quiero misiones que premien levantar la mano, responder preguntas y participar activamente en clase' },
                      { emoji: '📝', title: 'Tareas', desc: 'Misiones para motivar la entrega puntual de tareas, trabajos completos y bien presentados' },
                      { emoji: '🤝', title: 'Trabajo en equipo', desc: 'Misiones que fomenten la colaboración, ayudar a compañeros y trabajar en grupo' },
                      { emoji: '📚', title: 'Hábitos de estudio', desc: 'Misiones para crear buenos hábitos: traer materiales, tomar apuntes, repasar en casa' },
                      { emoji: '🎯', title: 'Metas académicas', desc: 'Misiones de progreso: mejorar notas, subir de nivel, alcanzar objetivos de aprendizaje' },
                      { emoji: '⭐', title: 'Comportamiento', desc: 'Misiones de buen comportamiento: puntualidad, respeto, mantener el orden en clase' },
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
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm resize-none"
                    placeholder="Describe con tus palabras qué quieres lograr con estas misiones..."
                  />
                </div>

                {/* Nivel y cantidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🎓 Nivel educativo
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
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
                      🔢 ¿Cuántas misiones?
                    </label>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 6)))}
                      min={1}
                      max={15}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Tipos de misión con explicación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ⏱️ Duración de las misiones
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { type: 'DAILY' as MissionType, hint: 'Se renuevan cada día' },
                      { type: 'WEEKLY' as MissionType, hint: 'Duran toda la semana' },
                      { type: 'SPECIAL' as MissionType, hint: 'Eventos únicos' },
                    ].map(({ type, hint }) => (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          types.has(type)
                            ? `${MISSION_TYPE_COLORS[type].bg} ${MISSION_TYPE_COLORS[type].text} ${MISSION_TYPE_COLORS[type].border} border-2`
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent'
                        }`}
                      >
                        <div className="font-medium">{MISSION_TYPE_LABELS[type]}</div>
                        <div className="text-xs opacity-70">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categorías simplificadas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📂 Tipos de objetivos
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { cat: 'PARTICIPATION' as MissionCategory, hint: 'Participar en clase' },
                      { cat: 'PROGRESS' as MissionCategory, hint: 'Mejorar y avanzar' },
                      { cat: 'SOCIAL' as MissionCategory, hint: 'Trabajo en equipo' },
                      { cat: 'CUSTOM' as MissionCategory, hint: 'Otros objetivos' },
                    ].map(({ cat, hint }) => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          categories.has(cat)
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-transparent'
                        }`}
                      >
                        <div className="font-medium">{MISSION_CATEGORY_LABELS[cat]}</div>
                        <div className="text-xs opacity-70">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Preview */
              <div className="space-y-2">
                {generatedMissions.map((m, index) => (
                  editingIndex === index ? (
                    /* Formulario de edición inline */
                    <div key={index} className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Editando misión</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteMission(index)}
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
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
                      
                      {/* Icono y tipo */}
                      <div className="flex gap-3 items-center">
                        <div className="flex gap-1 flex-wrap">
                          {MISSION_ICONS.slice(0, 12).map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => updateMission(index, { icon: emoji })}
                              className={`w-7 h-7 rounded text-sm ${m.icon === emoji ? 'bg-blue-500 ring-2 ring-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <select
                          value={m.type}
                          onChange={(e) => updateMission(index, { type: e.target.value as MissionType })}
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          {(['DAILY', 'WEEKLY', 'SPECIAL'] as MissionType[]).map(t => (
                            <option key={t} value={t}>{MISSION_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Nombre y descripción */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => updateMission(index, { name: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={m.description}
                          onChange={(e) => updateMission(index, { description: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Descripción"
                        />
                      </div>

                      {/* Objetivo y recompensas */}
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <Target size={12} className="text-purple-600" />
                          <input
                            type="number"
                            value={m.objectiveTarget}
                            onChange={(e) => updateMission(index, { objectiveTarget: parseInt(e.target.value) || 1 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-purple-400"
                            min={1}
                          />
                          <span className="text-xs text-purple-600">meta</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                          <Sparkles size={12} className="text-emerald-600" />
                          <input
                            type="number"
                            value={m.rewardXp}
                            onChange={(e) => updateMission(index, { rewardXp: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-emerald-400"
                            min={0}
                          />
                          <span className="text-xs text-emerald-600">XP</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          <Award size={12} className="text-amber-600" />
                          <input
                            type="number"
                            value={m.rewardGp}
                            onChange={(e) => updateMission(index, { rewardGp: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-amber-400"
                            min={0}
                          />
                          <span className="text-xs text-amber-600">GP</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingIndex(null)}
                        className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                      >
                        <Check size={14} className="inline mr-1" /> Listo
                      </button>
                    </div>
                  ) : (
                    /* Vista normal */
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        selectedMissions.has(index)
                          ? `${MISSION_TYPE_COLORS[m.type].border} ${MISSION_TYPE_COLORS[m.type].bg}`
                          : 'border-gray-200 dark:border-gray-600 opacity-50'
                      }`}
                    >
                      <button
                        onClick={() => toggleMission(index)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedMissions.has(index)
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selectedMissions.has(index) && <Check size={12} className="text-white" />}
                      </button>

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800 dark:text-white truncate">{m.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${MISSION_TYPE_COLORS[m.type].bg} ${MISSION_TYPE_COLORS[m.type].text}`}>
                            {MISSION_TYPE_LABELS[m.type]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{m.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="flex items-center gap-1 text-purple-600">
                          <Target size={12} /> {m.objectiveTarget}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Sparkles size={12} /> {m.rewardXp}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Award size={12} /> {m.rewardGp}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingIndex(index)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex-shrink-0"
                      >
                        <Edit2 size={14} />
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
                    disabled={!description.trim() || !level.trim() || types.size === 0 || isGenerating}
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
                    disabled={selectedMissions.size === 0}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} />
                    Importar {selectedMissions.size} seleccionadas
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
