import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Upload,
  Search,
  Plus,
  Trash2,
  X,
  Check,
  Map,
  Edit2,
  Eye,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expeditionMapApi, type ExpeditionMap } from '../../lib/expeditionMapApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'fantasy', label: 'Fantasía', color: 'bg-purple-100 text-purple-700' },
  { value: 'nature', label: 'Naturaleza', color: 'bg-green-100 text-green-700' },
  { value: 'sci-fi', label: 'Ciencia Ficción', color: 'bg-blue-100 text-blue-700' },
  { value: 'adventure', label: 'Aventura', color: 'bg-amber-100 text-amber-700' },
  { value: 'mystery', label: 'Misterio', color: 'bg-gray-100 text-gray-700' },
  { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-700' },
];

export default function AdminExpeditionMaps() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingMap, setEditingMap] = useState<ExpeditionMap | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    imageUrl: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Query para obtener mapas
  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['admin-expedition-maps'],
    queryFn: expeditionMapApi.getAll,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: expeditionMapApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-expedition-maps'] });
      toast.success('Mapa creado exitosamente');
      closeModal();
    },
    onError: () => toast.error('Error al crear mapa'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof expeditionMapApi.update>[1] }) =>
      expeditionMapApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-expedition-maps'] });
      toast.success('Mapa actualizado');
      closeModal();
    },
    onError: () => toast.error('Error al actualizar mapa'),
  });

  const deleteMutation = useMutation({
    mutationFn: expeditionMapApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-expedition-maps'] });
      toast.success('Mapa eliminado');
    },
    onError: () => toast.error('Error al eliminar mapa'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      expeditionMapApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-expedition-maps'] });
      toast.success('Estado actualizado');
    },
  });

  // Verificar rol admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const closeModal = () => {
    setShowModal(false);
    setEditingMap(null);
    setFormData({ name: '', description: '', category: 'general', imageUrl: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const openCreateModal = () => {
    setEditingMap(null);
    setFormData({ name: '', description: '', category: 'general', imageUrl: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setShowModal(true);
  };

  const openEditModal = (map: ExpeditionMap) => {
    setEditingMap(map);
    setFormData({
      name: map.name,
      description: map.description || '',
      category: map.category,
      imageUrl: map.imageUrl,
    });
    setPreviewUrl(map.imageUrl.startsWith('http') ? map.imageUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${map.imageUrl}`);
    setShowModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('La imagen no puede superar 10MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      setUploading(true);
      let imageUrl = formData.imageUrl;

      // Si hay archivo seleccionado, subirlo primero
      if (selectedFile) {
        const uploadResult = await expeditionMapApi.uploadImage(selectedFile);
        imageUrl = uploadResult.url;
      }

      if (!imageUrl) {
        toast.error('La imagen es requerida');
        return;
      }

      if (editingMap) {
        await updateMutation.mutateAsync({
          id: editingMap.id,
          data: {
            name: formData.name,
            description: formData.description || undefined,
            category: formData.category,
            imageUrl,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          imageUrl,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este mapa?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtrar mapas
  const filteredMaps = maps.filter(map => {
    const matchesSearch = map.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      map.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || map.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${url}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/admin"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Map className="text-emerald-500" />
                  Mapas de Expediciones
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gestiona los mapas disponibles para las expediciones
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Plus size={20} />
              Nuevo Mapa
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar mapas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Maps Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredMaps.length === 0 ? (
          <div className="text-center py-12">
            <Map size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No hay mapas disponibles</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-emerald-500 hover:text-emerald-600"
            >
              Crear el primer mapa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaps.map((map) => (
              <motion.div
                key={map.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden ${
                  !map.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="relative h-48">
                  <img
                    src={getImageUrl(map.imageUrl)}
                    alt={map.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Mapa';
                    }}
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: map.id, isActive: !map.isActive })}
                      className={`p-2 rounded-lg ${
                        map.isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                      title={map.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {map.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  {!map.isActive && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
                        Inactivo
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{map.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      CATEGORIES.find(c => c.value === map.category)?.color || 'bg-gray-100 text-gray-700'
                    }`}>
                      {CATEGORIES.find(c => c.value === map.category)?.label || map.category}
                    </span>
                  </div>
                  {map.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {map.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(map)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <Edit2 size={16} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(map.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingMap ? 'Editar Mapa' : 'Nuevo Mapa'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Preview de imagen */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-48 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <ImageIcon size={48} />
                      <p className="mt-2">Clic para subir imagen</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ej: Bosque Encantado"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                    placeholder="Descripción del mapa..."
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* URL manual (opcional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    O ingresa URL de imagen
                  </label>
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, imageUrl: e.target.value });
                      if (e.target.value) setPreviewUrl(e.target.value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      {editingMap ? 'Guardar' : 'Crear'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
