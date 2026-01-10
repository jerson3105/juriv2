import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Plus,
  Search,
  Trash2,
  Edit2,
  Gift,
  X,
  Sparkles,
  Target,
  Zap,
  Check,
} from 'lucide-react';
import { badgeApi, type Badge, type CreateBadgeDto, type BadgeRarity, type BadgeAssignment, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import { behaviorApi } from '../../lib/behaviorApi';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { BadgeCard } from '../../components/badges/BadgeCard';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

// Helper para mostrar icono de insignia (emoji o imagen)
export const BadgeIcon = ({ badge, size = 'md' }: { badge: Badge; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xl',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };
  
  if (badge.customImage) {
    return (
      <img 
        src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${badge.customImage}`}
        alt={badge.name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }
  
  return <span className={sizeClasses[size]}>{badge.icon}</span>;
};

export const BadgesPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState<BadgeRarity | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedBadgeForAward, setSelectedBadgeForAward] = useState<Badge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; badge: Badge | null }>({ isOpen: false, badge: null });

  // Obtener insignias
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['badges', classroom.id],
    queryFn: () => badgeApi.getClassroomBadges(classroom.id),
  });

  // Mutación para crear
  const createMutation = useMutation({
    mutationFn: (data: CreateBadgeDto) => badgeApi.createBadge(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges', classroom.id] });
      setShowCreateModal(false);
      toast.success('Insignia creada');
    },
    onError: () => toast.error('Error al crear insignia'),
  });

  // Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (badgeId: string) => badgeApi.deleteBadge(badgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges', classroom.id] });
      toast.success('Insignia eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  // Filtrar insignias
  const filteredBadges = badges.filter(badge => {
    const matchesSearch = badge.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = filterRarity === 'ALL' || badge.rarity === filterRarity;
    return matchesSearch && matchesRarity;
  });

  // Separar por tipo
  const systemBadges = filteredBadges.filter(b => b.scope === 'SYSTEM');
  const customBadges = filteredBadges.filter(b => b.scope === 'CLASSROOM');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <Award size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Insignias
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Gestiona las insignias y logros de tu clase
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus size={18} />
          Crear Insignia
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar insignias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map((rarity) => (
            <button
              key={rarity}
              onClick={() => setFilterRarity(rarity)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterRarity === rarity
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {rarity === 'ALL' ? 'Todas' : RARITY_LABELS[rarity]}
            </button>
          ))}
        </div>
      </div>

      {/* Insignias Personalizadas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Mis Insignias ({customBadges.length})
          </h2>
        </div>
        
        {customBadges.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-dashed border-gray-300 dark:border-gray-600">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 mb-3">
              Aún no has creado insignias personalizadas
            </p>
            <Button variant="secondary" onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus size={16} />
              Crear mi primera insignia
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {customBadges.map((badge) => (
              <div key={badge.id} className="relative group">
                <BadgeCard badge={badge} isUnlocked showDetails />
                
                {/* Acciones */}
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => {
                      setSelectedBadgeForAward(badge);
                      setShowAwardModal(true);
                    }}
                    className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    title="Otorgar"
                  >
                    <Gift size={14} />
                  </button>
                  <button
                    onClick={() => setEditingBadge(badge)}
                    className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, badge })}
                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Insignias del Sistema */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Insignias del Sistema ({systemBadges.length})
          </h2>
        </div>
        
        {systemBadges.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No hay insignias del sistema disponibles
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {systemBadges.map((badge) => (
              <div key={badge.id} className="relative group">
                <BadgeCard badge={badge} isUnlocked showDetails />
                
                {/* Solo otorgar para sistema */}
                {badge.assignmentMode !== 'AUTOMATIC' && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedBadgeForAward(badge);
                        setShowAwardModal(true);
                      }}
                      className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      title="Otorgar"
                    >
                      <Gift size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Crear/Editar */}
      <AnimatePresence>
        {(showCreateModal || editingBadge) && (
          <CreateBadgeModal
            key={editingBadge?.id || 'new'}
            badge={editingBadge}
            classroom={classroom}
            onClose={() => {
              setShowCreateModal(false);
              setEditingBadge(null);
            }}
            onSave={(data) => {
              if (editingBadge) {
                badgeApi.updateBadge(editingBadge.id, data).then(() => {
                  queryClient.invalidateQueries({ queryKey: ['badges', classroom.id] });
                  setEditingBadge(null);
                  toast.success('Insignia actualizada');
                });
              } else {
                createMutation.mutate(data);
              }
            }}
            isLoading={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Modal Otorgar */}
      <AnimatePresence>
        {showAwardModal && selectedBadgeForAward && (
          <AwardBadgeModal
            badge={selectedBadgeForAward}
            classroomId={classroom.id}
            onClose={() => {
              setShowAwardModal(false);
              setSelectedBadgeForAward(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, badge: null })}
        onConfirm={() => {
          if (deleteConfirm.badge) {
            deleteMutation.mutate(deleteConfirm.badge.id);
          }
          setDeleteConfirm({ isOpen: false, badge: null });
        }}
        title="¿Eliminar insignia?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.badge?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// Modal para crear/editar insignia
const CreateBadgeModal = ({
  badge,
  classroom,
  onClose,
  onSave,
  isLoading,
}: {
  badge: Badge | null;
  classroom: Classroom;
  onClose: () => void;
  onSave: (data: CreateBadgeDto & { competencyId?: string }) => void;
  isLoading: boolean;
}) => {
  const classroomId = classroom.id;
  const [formData, setFormData] = useState<CreateBadgeDto>({
    name: badge?.name || '',
    description: badge?.description || '',
    icon: badge?.icon || '🏆',
    customImage: badge?.customImage || null,
    rarity: badge?.rarity || 'COMMON',
    assignmentMode: badge?.assignmentMode || 'MANUAL',
    unlockCondition: badge?.unlockCondition || null,
    rewardXp: badge?.rewardXp || 0,
    rewardGp: badge?.rewardGp || 0,
    isSecret: badge?.isSecret || false,
  });
  const [competencyId, setCompetencyId] = useState<string | null>((badge as any)?.competencyId || null);

  // Cargar competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  // Estado para imagen personalizada
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [useCustomImage, setUseCustomImage] = useState(!!badge?.customImage);

  // Helper para parsear condición (puede venir como string JSON)
  const parseCondition = (cond: any) => {
    if (!cond) return null;
    if (typeof cond === 'string') {
      try {
        return JSON.parse(cond);
      } catch {
        return null;
      }
    }
    return cond;
  };

  const initialCondition = parseCondition(badge?.unlockCondition);

  // Estado para la condición
  const [conditionType, setConditionType] = useState<string>(
    initialCondition?.type || 'BEHAVIOR_COUNT'
  );
  const [conditionValue, setConditionValue] = useState<number>(
    initialCondition?.value || initialCondition?.count || 5
  );
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string>(
    initialCondition?.behaviorId || ''
  );
  const [behaviorCategory, setBehaviorCategory] = useState<'positive' | 'negative'>(
    initialCondition?.category || 'positive'
  );

  // Sincronizar estados cuando cambia el badge (para edición)
  useEffect(() => {
    if (badge) {
      setFormData({
        name: badge.name || '',
        description: badge.description || '',
        icon: badge.icon || '🏆',
        customImage: badge.customImage || null,
        rarity: badge.rarity || 'COMMON',
        assignmentMode: badge.assignmentMode || 'MANUAL',
        unlockCondition: badge.unlockCondition || null,
        rewardXp: badge.rewardXp || 0,
        rewardGp: badge.rewardGp || 0,
        isSecret: badge.isSecret || false,
      });
      setUseCustomImage(!!badge.customImage);
      
      // Parsear condición si viene como string JSON
      const condition = parseCondition(badge.unlockCondition);
      
      if (condition) {
        setConditionType(condition.type || 'BEHAVIOR_COUNT');
        setConditionValue(condition.value || condition.count || 5);
        setSelectedBehaviorId(condition.behaviorId || '');
        setBehaviorCategory(condition.category || 'positive');
      } else {
        setConditionType('BEHAVIOR_COUNT');
        setConditionValue(5);
        setSelectedBehaviorId('');
        setBehaviorCategory('positive');
      }
    } else {
      // Reset para nueva insignia
      setFormData({
        name: '',
        description: '',
        icon: '🏆',
        customImage: null,
        rarity: 'COMMON',
        assignmentMode: 'MANUAL',
        unlockCondition: null,
        rewardXp: 0,
        rewardGp: 0,
        isSecret: false,
      });
      setUseCustomImage(false);
      setConditionType('BEHAVIOR_COUNT');
      setConditionValue(5);
      setSelectedBehaviorId('');
      setBehaviorCategory('positive');
      setCompetencyId(null);
    }
  }, [badge]);

  // Manejar subida de imagen
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const imageUrl = await badgeApi.uploadBadgeImage(file);
      setFormData(prev => ({ ...prev, customImage: imageUrl }));
      setUseCustomImage(true);
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Obtener comportamientos de la clase
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroomId],
    queryFn: () => behaviorApi.getByClassroom(classroomId),
  });

  // Actualizar condición cuando cambian los valores
  const updateCondition = () => {
    if (formData.assignmentMode === 'MANUAL') {
      return null;
    }

    switch (conditionType) {
      case 'BEHAVIOR_COUNT':
        return selectedBehaviorId ? {
          type: 'BEHAVIOR_COUNT',
          behaviorId: selectedBehaviorId,
          count: conditionValue,
        } : null;
      case 'BEHAVIOR_CATEGORY':
        return {
          type: 'BEHAVIOR_CATEGORY',
          category: behaviorCategory,
          count: conditionValue,
        };
      case 'XP_TOTAL':
        return { type: 'XP_TOTAL', value: conditionValue };
      case 'LEVEL':
        return { type: 'LEVEL', value: conditionValue };
      case 'ANY_BEHAVIOR':
        return { type: 'ANY_BEHAVIOR', count: conditionValue };
      default:
        return null;
    }
  };

  const handleSave = () => {
    const condition = updateCondition();
    // Si usa imagen personalizada, asegurar que se incluya
    const dataToSave = {
      ...formData,
      unlockCondition: condition,
      // Si hay imagen personalizada, usarla; si no, asegurar que icon tenga valor
      icon: formData.icon || '🏆',
      competencyId: competencyId || undefined,
    };
    onSave(dataToSave);
  };

  const icons = ['🏆', '⭐', '🎖️', '🥇', '🥈', '🥉', '💎', '👑', '🎯', '🔥', '💪', '📚', '✨', '🌟', '🎓', '🏅'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {badge ? 'Editar Insignia' : 'Crear Insignia'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Tipo de icono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icono
            </label>
            
            {/* Toggle entre emoji e imagen */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setUseCustomImage(false);
                  setFormData({ ...formData, customImage: null });
                }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  !useCustomImage
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => setUseCustomImage(true)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  useCustomImage
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                Imagen personalizada
              </button>
            </div>

            {!useCustomImage ? (
              <div className="flex flex-wrap gap-2">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      formData.icon === icon
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Preview de imagen */}
                {formData.customImage && (
                  <div className="flex items-center gap-3">
                    <img 
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${formData.customImage}`}
                      alt="Badge preview"
                      className="w-16 h-16 rounded-lg object-cover border-2 border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, customImage: null })}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                
                {/* Input de archivo */}
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors">
                  <div className="text-center">
                    {isUploadingImage ? (
                      <span className="text-gray-500">Subiendo...</span>
                    ) : (
                      <>
                        <span className="text-2xl">📷</span>
                        <p className="text-sm text-gray-500 mt-1">
                          Clic para subir imagen (PNG, JPG, max 2MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Lector del Mes"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ej: Completar 5 libros en el mes"
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Rareza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rareza
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as BadgeRarity[]).map((rarity) => {
                const colors = RARITY_COLORS[rarity];
                return (
                  <button
                    key={rarity}
                    type="button"
                    onClick={() => setFormData({ ...formData, rarity })}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                      formData.rarity === rarity
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {RARITY_LABELS[rarity]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modo de asignación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Modo de asignación
            </label>
            <div className="space-y-2">
              {([
                { value: 'MANUAL', label: 'Solo manual', desc: 'Yo decido cuándo darla' },
                { value: 'AUTOMATIC', label: 'Automática', desc: 'Se da al cumplir condición' },
                { value: 'BOTH', label: 'Ambas', desc: 'Automática + puedo darla manualmente' },
              ] as { value: BadgeAssignment; label: string; desc: string }[]).map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.assignmentMode === mode.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="assignmentMode"
                    value={mode.value}
                    checked={formData.assignmentMode === mode.value}
                    onChange={() => setFormData({ ...formData, assignmentMode: mode.value })}
                    className="sr-only"
                  />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">{mode.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Condición de desbloqueo (solo si no es manual) */}
          {formData.assignmentMode !== 'MANUAL' && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 space-y-4">
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Condición de desbloqueo
              </label>
              
              {/* Tipo de condición */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                <select
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="BEHAVIOR_COUNT">Comportamiento específico</option>
                  <option value="BEHAVIOR_CATEGORY">Cualquier comportamiento (positivo/negativo)</option>
                  <option value="ANY_BEHAVIOR">Cualquier comportamiento</option>
                  <option value="XP_TOTAL">XP acumulado</option>
                  <option value="LEVEL">Nivel alcanzado</option>
                </select>
              </div>

              {/* Comportamiento específico */}
              {conditionType === 'BEHAVIOR_COUNT' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Comportamiento</label>
                  <select
                    value={selectedBehaviorId}
                    onChange={(e) => setSelectedBehaviorId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                  >
                    <option value="">Seleccionar comportamiento...</option>
                    {behaviors.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.icon} {b.name} ({b.isPositive ? '+' : '-'}{b.pointValue} {b.pointType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Categoría de comportamiento */}
              {conditionType === 'BEHAVIOR_CATEGORY' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBehaviorCategory('positive')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        behaviorCategory === 'positive'
                          ? 'bg-green-100 text-green-700 border-2 border-green-500'
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      ✅ Positivos
                    </button>
                    <button
                      type="button"
                      onClick={() => setBehaviorCategory('negative')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        behaviorCategory === 'negative'
                          ? 'bg-red-100 text-red-700 border-2 border-red-500'
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      ❌ Negativos
                    </button>
                  </div>
                </div>
              )}

              {/* Valor/Cantidad */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {conditionType === 'XP_TOTAL' ? 'XP requerido' : 
                   conditionType === 'LEVEL' ? 'Nivel requerido' : 
                   'Cantidad de veces'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              {/* Preview de la condición */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Se desbloqueará cuando: </span>
                {conditionType === 'BEHAVIOR_COUNT' && selectedBehaviorId && (
                  <>reciba "{behaviors.find((b: any) => b.id === selectedBehaviorId)?.name}" {conditionValue} veces</>
                )}
                {conditionType === 'BEHAVIOR_CATEGORY' && (
                  <>reciba {conditionValue} comportamientos {behaviorCategory === 'positive' ? 'positivos' : 'negativos'}</>
                )}
                {conditionType === 'ANY_BEHAVIOR' && (
                  <>reciba {conditionValue} comportamientos (cualquiera)</>
                )}
                {conditionType === 'XP_TOTAL' && (
                  <>acumule {conditionValue} XP</>
                )}
                {conditionType === 'LEVEL' && (
                  <>alcance el nivel {conditionValue}</>
                )}
              </div>
            </div>
          )}

          {/* Recompensas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recompensa al desbloquear (opcional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">XP</label>
                <input
                  type="number"
                  min="0"
                  value={formData.rewardXp}
                  onChange={(e) => setFormData({ ...formData, rewardXp: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">GP</label>
                <input
                  type="number"
                  min="0"
                  value={formData.rewardGp}
                  onChange={(e) => setFormData({ ...formData, rewardGp: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Secreta */}
          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isSecret}
              onChange={(e) => setFormData({ ...formData, isSecret: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-gray-800 dark:text-white">Insignia secreta</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Los estudiantes no la verán hasta desbloquearla
              </p>
            </div>
          </label>

          {/* Selector de Competencia */}
          {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Award size={16} className="text-emerald-500" />
                Competencia asociada
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setCompetencyId(null)}
                  className={`p-2 rounded-lg text-left text-xs ${!competencyId ? 'bg-gray-200 dark:bg-gray-600 ring-1 ring-gray-400' : 'bg-white dark:bg-gray-800 hover:bg-gray-100'}`}
                >
                  <span className="text-gray-500">Sin competencia</span>
                </button>
                {classroomCompetencies.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompetencyId(c.id)}
                    className={`p-2 rounded-lg text-left text-xs ${competencyId === c.id ? 'bg-emerald-100 dark:bg-emerald-900/50 ring-1 ring-emerald-500' : 'bg-white dark:bg-gray-800 hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {competencyId === c.id && <Check size={12} className="text-emerald-500" />}
                      <span className="truncate text-gray-800 dark:text-white">{c.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {competencyId ? 'Esta insignia contribuirá a la competencia' : 'Opcional'}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.name || !formData.description || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Guardando...' : badge ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Modal para otorgar insignia
const AwardBadgeModal = ({
  badge,
  classroomId,
  onClose,
}: {
  badge: Badge;
  classroomId: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Obtener estudiantes
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId),
  });

  const students = classroomData?.students || [];
  const filteredStudents = students.filter((s: any) =>
    s.characterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.realName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const awardMutation = useMutation({
    mutationFn: async () => {
      for (const studentId of selectedStudents) {
        await badgeApi.awardBadge(studentId, badge.id, reason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      toast.success(`Insignia otorgada a ${selectedStudents.length} estudiante(s)`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al otorgar insignia');
    },
  });

  const colors = RARITY_COLORS[badge.rarity];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${colors.gradient} p-4 text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">{badge.icon}</span>
            </div>
            <div>
              <h2 className="font-bold">Otorgar: {badge.name}</h2>
              <p className="text-sm text-white/80">{RARITY_LABELS[badge.rarity]}</p>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Lista de estudiantes */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredStudents.map((student: any) => (
              <label
                key={student.id}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  selectedStudents.includes(student.id)
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                    : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudents([...selectedStudents, student.id]);
                    } else {
                      setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                    }
                  }}
                  className="sr-only"
                />
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {(student.characterName || student.realName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-white">
                    {student.characterName || student.realName || 'Sin nombre'}
                  </p>
                  <p className="text-xs text-gray-500">Nivel {student.level}</p>
                </div>
                {selectedStudents.includes(student.id) && (
                  <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Razón */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Razón (opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Por su excelente participación"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          />
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={() => awardMutation.mutate()}
            disabled={selectedStudents.length === 0 || awardMutation.isPending}
            className="flex-1 gap-2"
          >
            <Gift size={16} />
            {awardMutation.isPending ? 'Otorgando...' : `Otorgar (${selectedStudents.length})`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BadgesPage;
