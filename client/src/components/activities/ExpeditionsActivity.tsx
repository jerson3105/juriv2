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
  Users,
  CheckCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  expeditionApi,
  type Expedition,
  type ExpeditionStatus,
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
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    selectedMap: '',
  });

  // Query expediciones
  const { data: expeditions = [], isLoading } = useQuery({
    queryKey: ['expeditions', classroom.id],
    queryFn: () => expeditionApi.getByClassroom(classroom.id),
  });

  // Query mapas disponibles
  const { data: availableMaps = [] } = useQuery({
    queryKey: ['expedition-maps-active'],
    queryFn: expeditionMapApi.getActive,
  });

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
          >
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : expeditions.length === 0 ? (
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
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {expeditions.map((expedition) => (
                  <motion.div
                    key={expedition.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      {/* Imagen del mapa */}
                      <div className="relative aspect-video">
                        <img
                          src={expedition.mapImageUrl}
                          alt={expedition.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Mapa';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-white font-semibold truncate">{expedition.name}</h3>
                        </div>
                        <div className="absolute top-3 right-3">
                          {getStatusBadge(expedition.status)}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {expedition.pins?.length || 0} pines
                          </span>
                          {expedition.publishedAt && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {new Date(expedition.publishedAt).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(expedition)}
                            className="flex-1"
                          >
                            {expedition.status === 'DRAFT' ? 'Editar' : 'Ver'}
                          </Button>
                          
                          {expedition.status === 'DRAFT' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => publishMutation.mutate(expedition.id)}
                                disabled={publishMutation.isPending}
                                className="bg-gradient-to-r from-emerald-500 to-teal-500"
                              >
                                Publicar
                              </Button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, expedition })}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          
                          {expedition.status === 'PUBLISHED' && (
                            <button
                              onClick={() => archiveMutation.mutate(expedition.id)}
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
