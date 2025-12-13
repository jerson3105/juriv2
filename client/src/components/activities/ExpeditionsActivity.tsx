import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  ArrowLeft,
  Plus,
  Eye,
  Archive,
  Trash2,
  Settings,
  CheckCircle,
  Clock,
  MapPin,
  Users,
  Trophy,
  Coins,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Filter,
  BarChart3,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  expeditionApi,
  type Expedition,
  type ExpeditionStatus,
  type ExpeditionStatItem,
} from '../../lib/expeditionApi';
import { expeditionMapApi, type ExpeditionMap } from '../../lib/expeditionMapApi';
import { ExpeditionEditor } from './ExpeditionEditor';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ExpeditionsActivityProps {
  classroom: any;
  onBack: () => void;
}

export const ExpeditionsActivity = ({ classroom, onBack }: ExpeditionsActivityProps) => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedExpedition, setSelectedExpedition] = useState<Expedition | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; expedition: Expedition | null }>({ isOpen: false, expedition: null });
  const [statusFilter, setStatusFilter] = useState<ExpeditionStatus | 'ALL'>('ALL');
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    selectedMap: '',
  });

  // Query estadísticas de expediciones
  const { data: stats, isLoading } = useQuery({
    queryKey: ['expedition-stats', classroom.id],
    queryFn: () => expeditionApi.getClassroomStats(classroom.id),
  });

  // Query mapas disponibles
  const { data: availableMaps = [] } = useQuery({
    queryKey: ['expedition-maps-active'],
    queryFn: expeditionMapApi.getActive,
  });

  // Filtrar expediciones por estado
  const filteredExpeditions = stats?.expeditions.filter(exp => 
    statusFilter === 'ALL' || exp.status === statusFilter
  ) || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: expeditionApi.create,
    onSuccess: (expedition) => {
      queryClient.invalidateQueries({ queryKey: ['expeditions', classroom.id] });
      setSelectedExpedition(expedition);
      setView('edit');
      setCreateForm({ name: '', selectedMap: '' });
      toast.success('Expedición creada');
    },
    onError: () => toast.error('Error al crear expedición'),
  });

  const deleteMutation = useMutation({
    mutationFn: expeditionApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expeditions', classroom.id] });
      setDeleteConfirm({ isOpen: false, expedition: null });
      toast.success('Expedición eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const publishMutation = useMutation({
    mutationFn: expeditionApi.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expeditions', classroom.id] });
      toast.success('¡Expedición publicada!');
    },
    onError: () => toast.error('Error al publicar'),
  });

  const archiveMutation = useMutation({
    mutationFn: expeditionApi.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expeditions', classroom.id] });
      toast.success('Expedición archivada');
    },
    onError: () => toast.error('Error al archivar'),
  });

  // Handlers
  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error('Ingresa un nombre para la expedición');
      return;
    }
    if (!createForm.selectedMap) {
      toast.error('Selecciona un mapa');
      return;
    }

    createMutation.mutate({
      classroomId: classroom.id,
      name: createForm.name,
      mapImageUrl: createForm.selectedMap,
    });
  };

  const handleEdit = (expedition: Expedition) => {
    setSelectedExpedition(expedition);
    setView('edit');
  };

  const getStatusBadge = (status: ExpeditionStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
            <Settings size={12} />
            Borrador
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
            <Eye size={12} />
            Publicada
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full">
            <Archive size={12} />
            Archivada
          </span>
        );
    }
  };

  // Si estamos editando, mostrar el editor
  if (view === 'edit' && selectedExpedition) {
    return (
      <ExpeditionEditor
        expeditionId={selectedExpedition.id}
        onBack={() => {
          setView('list');
          setSelectedExpedition(null);
          queryClient.invalidateQueries({ queryKey: ['expeditions', classroom.id] });
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <Map size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Expediciones</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Misiones con mapas interactivos</p>
            </div>
          </div>
        </div>

        {view === 'list' && (
          <Button
            onClick={() => setView('create')}
            className="flex items-center gap-2"
          >
            <Plus size={18} />
            Nueva Expedición
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* Vista de creación */}
        {view === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6 text-center">
                Crear una nueva expedición
              </h3>

              {/* Nombre */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-center uppercase tracking-wide">
                  Introduce un nombre de expedición
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ej: La búsqueda del tesoro perdido"
                  className="w-full max-w-md mx-auto block px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Selección de mapa */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-4 text-center uppercase tracking-wide">
                  Selecciona un mapa de expedición
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableMaps.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <Map size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No hay mapas disponibles</p>
                      <p className="text-xs mt-1">El administrador debe agregar mapas primero</p>
                    </div>
                  ) : (
                    availableMaps.map((map: ExpeditionMap) => {
                      const mapUrl = map.imageUrl.startsWith('http') 
                        ? map.imageUrl 
                        : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${map.imageUrl}`;
                      return (
                        <button
                          key={map.id}
                          onClick={() => setCreateForm({ ...createForm, selectedMap: mapUrl })}
                          className={`relative aspect-video rounded-xl overflow-hidden border-4 transition-all ${
                            createForm.selectedMap === mapUrl
                              ? 'border-emerald-500 shadow-lg shadow-emerald-500/25'
                              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <img
                            src={mapUrl}
                            alt={map.name}
                            className={`w-full h-full object-cover ${
                              createForm.selectedMap === mapUrl ? '' : 'grayscale hover:grayscale-0'
                            } transition-all`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Mapa';
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-sm font-medium truncate">{map.name}</p>
                          </div>
                          {createForm.selectedMap === mapUrl && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle size={32} className="text-white drop-shadow-lg" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-center gap-3 mt-8">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setView('list');
                    setCreateForm({ name: '', selectedMap: '' });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Expedición'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Lista de expediciones */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : !stats || stats.expeditions.length === 0 ? (
              <Card className="p-12 text-center">
                <Map size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No hay expediciones
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Crea tu primera expedición con mapas interactivos
                </p>
                <Button onClick={() => setView('create')} className="mx-auto">
                  <Plus size={18} className="mr-2" />
                  Crear Expedición
                </Button>
              </Card>
            ) : (
              <>
                {/* Panel de estadísticas generales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                        <Map size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.summary.totalExpeditions}</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Expediciones</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                        <Users size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.summary.totalStarted}</p>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Participando</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                        <Trophy size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.summary.totalCompleted}</p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Completadas</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                        <AlertCircle size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.summary.totalPendingReviews}</p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">Por revisar</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <div className="flex gap-2">
                    {(['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                          statusFilter === status
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {status === 'ALL' ? 'Todas' : status === 'PUBLISHED' ? 'Publicadas' : status === 'DRAFT' ? 'Borradores' : 'Archivadas'}
                        {status !== 'ALL' && (
                          <span className="ml-1 opacity-70">
                            ({status === 'PUBLISHED' ? stats.summary.published : status === 'DRAFT' ? stats.summary.draft : stats.summary.archived})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid de expediciones */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredExpeditions.map((expedition: ExpeditionStatItem) => (
                    <motion.div
                      key={expedition.expeditionId}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group"
                    >
                      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        {/* Imagen del mapa */}
                        <div className="relative aspect-video">
                          <img
                            src={expedition.mapImageUrl}
                            alt={expedition.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Mapa';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="text-white font-bold text-lg truncate drop-shadow-lg">{expedition.name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-white/80 text-xs">
                                <MapPin size={12} />
                                {expedition.pinsCount} pines
                              </span>
                              <span className="flex items-center gap-1 text-white/80 text-xs">
                                <Users size={12} />
                                {expedition.startedCount}/{expedition.totalStudents}
                              </span>
                            </div>
                          </div>
                          <div className="absolute top-3 right-3">
                            {getStatusBadge(expedition.status)}
                          </div>
                          
                          {/* Badge de recompensas */}
                          {(expedition.totalXp > 0 || expedition.totalGp > 0) && (
                            <div className="absolute top-3 left-3 flex gap-1">
                              {expedition.totalXp > 0 && (
                                <span className="flex items-center gap-1 text-xs bg-purple-500/90 text-white px-2 py-0.5 rounded-full">
                                  <Sparkles size={10} />
                                  {expedition.totalXp} XP
                                </span>
                              )}
                              {expedition.totalGp > 0 && (
                                <span className="flex items-center gap-1 text-xs bg-amber-500/90 text-white px-2 py-0.5 rounded-full">
                                  <Coins size={10} />
                                  {expedition.totalGp} GP
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Info y progreso */}
                        <div className="p-4 space-y-3">
                          {/* Barra de progreso */}
                          {expedition.status === 'PUBLISHED' && expedition.totalStudents > 0 && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <TrendingUp size={12} />
                                  Progreso general
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  {expedition.completionRate}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${expedition.completionRate}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                />
                              </div>
                              <div className="flex justify-between mt-1 text-xs text-gray-400">
                                <span>{expedition.completedCount} completaron</span>
                                <span>{expedition.inProgressCount} en progreso</span>
                              </div>
                            </div>
                          )}

                          {/* Indicadores */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                              {expedition.publishedAt && (
                                <span className="flex items-center gap-1 text-xs">
                                  <Clock size={12} />
                                  {new Date(expedition.publishedAt).toLocaleDateString('es-ES')}
                                </span>
                              )}
                              {expedition.pendingReviews > 0 && (
                                <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                  <AlertCircle size={12} />
                                  {expedition.pendingReviews} por revisar
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit({ id: expedition.expeditionId, status: expedition.status } as Expedition)}
                              className="flex-1"
                            >
                              <BarChart3 size={14} className="mr-1" />
                              {expedition.status === 'DRAFT' ? 'Editar' : 'Ver detalles'}
                            </Button>
                            
                            {expedition.status === 'DRAFT' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => publishMutation.mutate(expedition.expeditionId)}
                                  disabled={publishMutation.isPending}
                                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                                >
                                  Publicar
                                </Button>
                                <button
                                  onClick={() => setDeleteConfirm({ isOpen: true, expedition: { id: expedition.expeditionId, name: expedition.name } as Expedition })}
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                            
                            {expedition.status === 'PUBLISHED' && (
                              <button
                                onClick={() => archiveMutation.mutate(expedition.expeditionId)}
                                className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title="Archivar"
                              >
                                <Archive size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {filteredExpeditions.length === 0 && (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      No hay expediciones con el filtro seleccionado
                    </p>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, expedition: null })}
        onConfirm={() => deleteConfirm.expedition && deleteMutation.mutate(deleteConfirm.expedition.id)}
        title="Eliminar Expedición"
        message={`¿Estás seguro de eliminar "${deleteConfirm.expedition?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
};
