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
import { badgeApi, type Badge, type CreateBadgeDto, type BadgeRarity, type BadgeAssignment, RARITY_COLORS, RARITY_LABELS, type GeneratedBadge } from '../../lib/badgeApi';
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
  const [showAIModal, setShowAIModal] = useState(false);

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg"
          >
            <Sparkles size={18} />
            Generar con IA
          </button>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus size={18} />
            Nueva
          </Button>
        </div>
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

      {/* Modal de generación con IA */}
      <AIBadgeModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        classroom={classroom}
        onImport={async (badges: GeneratedBadge[]) => {
          let successCount = 0;
          for (const badge of badges) {
            try {
              await createMutation.mutateAsync({
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                rarity: badge.rarity,
                assignmentMode: badge.assignmentMode,
                unlockCondition: badge.unlockCondition,
                rewardXp: badge.rewardXp,
                rewardGp: badge.rewardGp,
                isSecret: badge.isSecret,
              });
              successCount++;
            } catch (e) {
              console.error('Error importing badge:', e);
            }
          }
          if (successCount > 0) {
            toast.success(`${successCount} insignias importadas`);
            setShowAIModal(false);
          }
        }}
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
            src="/assets/mascot/jiro-insignias.jpg"
            alt="Jiro"
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white text-xs font-semibold mb-2">💡 Consejos para crear insignias</p>
            <ul className="text-white/80 text-[10px] space-y-1">
              <li>• Usa nombres motivadores y claros.</li>
              <li>• Ajusta rarezas según la frecuencia del logro.</li>
              <li>• Configura condiciones para otorgarlas solas.</li>
            </ul>
          </div>
        </div>

        {/* Panel derecho - Contenido */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Award className="text-amber-500" size={24} />
              {badge ? 'Editar Insignia' : 'Crear Insignia'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
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

          {/* Footer con botones */}
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name || !formData.description || isLoading}
                className="flex-1 !bg-gradient-to-r !from-amber-500 !to-orange-500 hover:!from-amber-600 hover:!to-orange-600"
              >
                {isLoading ? 'Guardando...' : badge ? 'Guardar Cambios' : '🏆 Crear Insignia'}
              </Button>
            </div>
          </div>
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

// Modal de generación con IA
const AIBadgeModal = ({
  isOpen,
  onClose,
  classroom,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroom: Classroom;
  onImport: (badges: GeneratedBadge[]) => void;
}) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(8);
  const [assignmentMode, setAssignmentMode] = useState<'MANUAL' | 'AUTOMATIC' | 'BOTH'>('MANUAL');
  const [rarities, setRarities] = useState<Set<BadgeRarity>>(new Set(['COMMON', 'RARE', 'EPIC']));
  const [includeSecret, setIncludeSecret] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBadges, setGeneratedBadges] = useState<GeneratedBadge[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);

  // Obtener comportamientos del aula para mostrar nombres
  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
    enabled: isOpen,
  });

  // Cargar competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas-badges'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  // Helper para obtener nombre de comportamiento por ID
  const getBehaviorName = (behaviorId: string) => {
    const behavior = behaviors.find(b => b.id === behaviorId);
    return behavior?.name || 'Comportamiento no encontrado';
  };

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

      const result = await badgeApi.generateWithAI({
        description,
        level,
        count,
        assignmentMode,
        rarities: Array.from(rarities),
        includeSecret,
        classroomId: classroom.id,
        competencies: competenciesToSend,
      });

      setGeneratedBadges(result.badges);
      setSelectedBadges(new Set(result.badges.map((_, i) => i)));
      setStep('preview');
      toast.success(`${result.badges.length} insignias generadas`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al generar insignias');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = () => {
    const badgesToImport = generatedBadges.filter((_, i) => selectedBadges.has(i));
    if (badgesToImport.length === 0) {
      toast.error('Selecciona al menos una insignia');
      return;
    }
    onImport(badgesToImport);
    setStep('form');
    setGeneratedBadges([]);
    setSelectedBadges(new Set());
    setDescription('');
    setSelectedCompetencies([]);
  };

  const toggleBadge = (index: number) => {
    const newSelected = new Set(selectedBadges);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedBadges(newSelected);
  };

  const toggleRarity = (rarity: BadgeRarity) => {
    const newRarities = new Set(rarities);
    if (newRarities.has(rarity)) {
      if (newRarities.size > 1) newRarities.delete(rarity);
    } else {
      newRarities.add(rarity);
    }
    setRarities(newRarities);
  };

  const updateBadge = (index: number, updates: Partial<GeneratedBadge>) => {
    setGeneratedBadges(prev => prev.map((b, i) => 
      i === index ? { ...b, ...updates } : b
    ));
  };

  const deleteBadge = (index: number) => {
    setGeneratedBadges(prev => prev.filter((_, i) => i !== index));
    setSelectedBadges(prev => {
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
    setGeneratedBadges([]);
    setSelectedBadges(new Set());
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
                  {step === 'form' ? 'Generar Insignias con IA' : 'Vista Previa'}
                </h2>
                <p className="text-xs text-gray-500">
                  {step === 'form' ? 'Describe qué logros quieres reconocer' : `${selectedBadges.size} de ${generatedBadges.length} seleccionadas`}
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
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    🏆 <strong>¿Qué son las insignias?</strong> Son premios especiales que reconocen logros de tus estudiantes.
                    Pueden otorgarse manualmente o desbloquearse automáticamente al cumplir condiciones. ¡Motívalos a coleccionarlas!
                  </p>
                </div>

                {/* Ejemplos rápidos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🚀 Ejemplos rápidos <span className="font-normal text-gray-500">(clic para usar)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { emoji: '⭐', title: 'Excelencia', desc: 'Insignias para reconocer notas sobresalientes, trabajos perfectos y logros académicos destacados' },
                      { emoji: '🔥', title: 'Constancia', desc: 'Insignias para premiar asistencia continua, racha de participaciones y progreso sostenido' },
                      { emoji: '🤝', title: 'Colaboración', desc: 'Insignias para el trabajo en equipo, ayudar compañeros, liderazgo positivo y buen compañerismo' },
                      { emoji: '🚀', title: 'Progreso', desc: 'Insignias para celebrar mejoras personales, superar metas, subir de nivel y evolucionar' },
                      { emoji: '💡', title: 'Creatividad', desc: 'Insignias para ideas innovadoras, proyectos creativos, soluciones originales y pensamiento crítico' },
                      { emoji: '🎯', title: 'Retos', desc: 'Insignias para completar desafíos especiales, misiones difíciles y logros extraordinarios' },
                    ].map((example) => (
                      <button
                        key={example.title}
                        onClick={() => setDescription(example.desc)}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          description === example.desc
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
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
                    placeholder="Describe qué logros quieres reconocer con insignias..."
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
                      🔢 ¿Cuántas insignias?
                    </label>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 8)))}
                      min={1}
                      max={20}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Modo de asignación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🎁 ¿Cómo se otorgan?
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: 'MANUAL', label: 'Manual', desc: 'Tú decides cuándo darlas', icon: '✋' },
                      { value: 'AUTOMATIC', label: 'Automático', desc: 'Se desbloquean solas', icon: '⚡' },
                      { value: 'BOTH', label: 'Mixto', desc: 'Ambas formas', icon: '🔄' },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setAssignmentMode(mode.value as any)}
                        className={`flex-1 p-2 rounded-lg border-2 text-sm ${
                          assignmentMode === mode.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="font-medium">{mode.icon} {mode.label}</div>
                        <div className="text-xs text-gray-500">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rarezas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    💎 Dificultad de las insignias
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { rarity: 'COMMON' as BadgeRarity, hint: 'Fáciles' },
                      { rarity: 'RARE' as BadgeRarity, hint: 'Moderadas' },
                      { rarity: 'EPIC' as BadgeRarity, hint: 'Difíciles' },
                      { rarity: 'LEGENDARY' as BadgeRarity, hint: 'Muy difíciles' },
                    ].map(({ rarity, hint }) => (
                      <button
                        key={rarity}
                        onClick={() => toggleRarity(rarity)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          rarities.has(rarity)
                            ? `bg-gradient-to-r ${RARITY_COLORS[rarity].gradient} text-white`
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <div>{RARITY_LABELS[rarity]}</div>
                        <div className="text-xs opacity-80">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secretas */}
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={includeSecret}
                    onChange={(e) => setIncludeSecret(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔒 Incluir insignias secretas</span>
                    <p className="text-xs text-gray-500">Los estudiantes no saben que existen hasta desbloquearlas</p>
                  </div>
                </label>

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
                        ? `${selectedCompetencies.length} competencia(s) seleccionada(s) - la IA asignará la más apropiada a cada insignia`
                        : 'Opcional - selecciona competencias para que la IA las asigne automáticamente'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Preview */
              <div className="space-y-2">
                {generatedBadges.map((b, index) => (
                  editingIndex === index ? (
                    /* Formulario de edición inline */
                    <div key={index} className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Editando insignia</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteBadge(index)}
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
                      
                      {/* Icono y rareza */}
                      <div className="flex gap-3">
                        <div className="flex gap-1 flex-wrap">
                          {['🏆', '⭐', '🎖️', '💎', '👑', '🎯', '🔥', '💪', '📚', '✨', '🎓', '🚀'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => updateBadge(index, { icon: emoji })}
                              className={`w-7 h-7 rounded text-sm ${b.icon === emoji ? 'bg-blue-500 ring-2 ring-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <select
                          value={b.rarity}
                          onChange={(e) => updateBadge(index, { rarity: e.target.value as BadgeRarity })}
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          {(['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as BadgeRarity[]).map(r => (
                            <option key={r} value={r}>{RARITY_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Nombre y descripción */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={b.name}
                          onChange={(e) => updateBadge(index, { name: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={b.description}
                          onChange={(e) => updateBadge(index, { description: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Descripción"
                        />
                      </div>

                      {/* Condición de desbloqueo */}
                      {b.unlockCondition && (
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Target size={14} className="text-purple-600" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              Condición de desbloqueo
                            </span>
                          </div>
                          {b.unlockCondition.type === 'BEHAVIOR_COUNT' && (
                            <div className="flex items-center gap-2">
                              <select
                                value={b.unlockCondition.behaviorId || ''}
                                onChange={(e) => updateBadge(index, { 
                                  unlockCondition: { ...b.unlockCondition!, behaviorId: e.target.value } 
                                })}
                                className="flex-1 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg"
                              >
                                <option value="">Seleccionar comportamiento...</option>
                                {behaviors.filter(bh => bh.isPositive).map(bh => (
                                  <option key={bh.id} value={bh.id}>✅ {bh.name}</option>
                                ))}
                                {behaviors.filter(bh => !bh.isPositive).map(bh => (
                                  <option key={bh.id} value={bh.id}>❌ {bh.name}</option>
                                ))}
                              </select>
                              <span className="text-xs text-purple-600">×</span>
                              <input
                                type="number"
                                value={b.unlockCondition.count || 1}
                                onChange={(e) => updateBadge(index, { 
                                  unlockCondition: { ...b.unlockCondition!, count: parseInt(e.target.value) || 1 } 
                                })}
                                className="w-12 px-2 py-1 text-xs text-center bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg"
                                min={1}
                              />
                              <span className="text-xs text-purple-600">veces</span>
                            </div>
                          )}
                          {b.unlockCondition.type === 'BEHAVIOR_CATEGORY' && (
                            <div className="flex items-center gap-2 text-xs text-purple-600">
                              📊 Recibir {b.unlockCondition.count}+ comportamientos {(b.unlockCondition as any).category === 'positive' ? 'positivos' : 'negativos'}
                            </div>
                          )}
                          {b.unlockCondition.type === 'XP_TOTAL' && (
                            <div className="flex items-center gap-2 text-xs text-purple-600">
                              ⚡ Alcanzar {(b.unlockCondition as any).value} XP total
                            </div>
                          )}
                          {b.unlockCondition.type === 'LEVEL' && (
                            <div className="flex items-center gap-2 text-xs text-purple-600">
                              📈 Alcanzar nivel {(b.unlockCondition as any).value}
                            </div>
                          )}
                          {b.unlockCondition.type === 'ANY_BEHAVIOR' && (
                            <div className="flex items-center gap-2 text-xs text-purple-600">
                              🎯 Recibir {b.unlockCondition.count}+ comportamientos
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recompensas */}
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                          <Sparkles size={12} className="text-emerald-600" />
                          <input
                            type="number"
                            value={b.rewardXp}
                            onChange={(e) => updateBadge(index, { rewardXp: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-emerald-400"
                            min={0}
                          />
                          <span className="text-xs text-emerald-600">XP</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          <Award size={12} className="text-amber-600" />
                          <input
                            type="number"
                            value={b.rewardGp}
                            onChange={(e) => updateBadge(index, { rewardGp: parseInt(e.target.value) || 0 })}
                            className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-amber-400"
                            min={0}
                          />
                          <span className="text-xs text-amber-600">GP</span>
                        </div>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={b.isSecret}
                            onChange={(e) => updateBadge(index, { isSecret: e.target.checked })}
                            className="w-3 h-3"
                          />
                          Secreta
                        </label>
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
                            onChange={(e) => updateBadge(index, { competencyId: e.target.value || undefined })}
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
                    /* Vista normal */
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        selectedBadges.has(index)
                          ? `${RARITY_COLORS[b.rarity].border} ${RARITY_COLORS[b.rarity].bg}`
                          : 'border-gray-200 dark:border-gray-600 opacity-50'
                      }`}
                    >
                      <button
                        onClick={() => toggleBadge(index)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedBadges.has(index)
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selectedBadges.has(index) && <Check size={12} className="text-white" />}
                      </button>

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                        {b.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800 dark:text-white truncate">{b.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${RARITY_COLORS[b.rarity].gradient} text-white`}>
                            {RARITY_LABELS[b.rarity]}
                          </span>
                          {b.isSecret && <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-white rounded">🔒</span>}
                          {b.competencyId && classroomCompetencies.find((c: any) => c.id === b.competencyId) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 flex items-center gap-1">
                              <Award size={10} />
                              {classroomCompetencies.find((c: any) => c.id === b.competencyId)?.name?.substring(0, 20)}...
                            </span>
                          )}
                          {b.unlockCondition ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              b.unlockCondition.type === 'BEHAVIOR_COUNT' 
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            }`}>
                              <Target size={10} />
                              {b.unlockCondition.type === 'BEHAVIOR_COUNT' && `🔗 ${b.unlockCondition.behaviorId ? getBehaviorName(b.unlockCondition.behaviorId) : 'Sin asignar'} ×${b.unlockCondition.count || 1}`}
                              {b.unlockCondition.type === 'BEHAVIOR_CATEGORY' && `📊 ${b.unlockCondition.count}+ ${(b.unlockCondition as any).category === 'positive' ? 'positivos' : 'negativos'}`}
                              {b.unlockCondition.type === 'XP_TOTAL' && `⚡ ${(b.unlockCondition as any).value} XP`}
                              {b.unlockCondition.type === 'LEVEL' && `📈 Nivel ${(b.unlockCondition as any).value}`}
                              {b.unlockCondition.type === 'ANY_BEHAVIOR' && `🎯 ${b.unlockCondition.count}+ acciones`}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 flex items-center gap-1">
                              ✋ Manual
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{b.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Sparkles size={12} /> {b.rewardXp}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Award size={12} /> {b.rewardGp}
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
                    disabled={!description.trim() || !level.trim() || rarities.size === 0 || isGenerating}
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
                    disabled={selectedBadges.size === 0}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} />
                    Importar {selectedBadges.size} seleccionadas
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

export default BadgesPage;
