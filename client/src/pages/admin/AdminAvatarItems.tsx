import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Upload,
  Search,
  Plus,
  Trash2,
  X,
  Check,
  Shirt,
  AlertCircle
} from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { AdminAvatarItem } from '../../lib/adminApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';

const SLOTS = [
  { value: 'HEAD', label: 'Cabeza', folder: 'Cabeza' },
  { value: 'HAIR', label: 'Pelo', folder: 'Pelo' },
  { value: 'EYES', label: 'Ojos', folder: 'Ojos' },
  { value: 'TOP', label: 'Superior', folder: 'Superior' },
  { value: 'BOTTOM', label: 'Inferior', folder: 'Inferior' },
  { value: 'LEFT_HAND', label: 'Mano Izquierda', folder: 'Mano izquierda' },
  { value: 'RIGHT_HAND', label: 'Mano Derecha', folder: 'Mano derecha' },
  { value: 'SHOES', label: 'Zapatos', folder: 'Zapatos' },
  { value: 'BACK', label: 'Espalda', folder: 'Espalda' },
  { value: 'FLAG', label: 'Bandera', folder: 'Bandera' },
  { value: 'BACKGROUND', label: 'Fondo', folder: 'Fondo' },
];

const RARITIES = [
  { value: 'COMMON', label: 'Común', color: 'bg-gray-100 text-gray-700' },
  { value: 'RARE', label: 'Raro', color: 'bg-blue-100 text-blue-700' },
  { value: 'LEGENDARY', label: 'Legendario', color: 'bg-amber-100 text-amber-700' },
];

export default function AdminAvatarItems() {
  const user = useAuthStore((state) => state.user);
  const [items, setItems] = useState<AdminAvatarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterSlot, setFilterSlot] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    slot: 'HEAD',
    rarity: 'COMMON',
    basePrice: 100,
    isDefault: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [filterGender, filterSlot]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAvatarItems({
        gender: filterGender || undefined,
        slot: filterSlot || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png' && file.type !== 'image/gif') {
        setError('Solo se permiten archivos PNG o GIF');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Selecciona una imagen PNG');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('image', selectedFile);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('slot', formData.slot);
      formDataToSend.append('rarity', formData.rarity);
      formDataToSend.append('basePrice', formData.basePrice.toString());
      formDataToSend.append('isDefault', formData.isDefault.toString());

      await adminApi.createAvatarItem(formDataToSend);
      
      setShowModal(false);
      resetForm();
      loadItems();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error al crear el item');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gender: 'MALE',
      slot: 'HEAD',
      rarity: 'COMMON',
      basePrice: 100,
      isDefault: false,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('¿Estás seguro de eliminar este item?')) return;
    
    try {
      await adminApi.deleteAvatarItem(itemId);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleDefault = async (item: AdminAvatarItem) => {
    try {
      await adminApi.updateAvatarItem(item.id, { isDefault: !item.isDefault });
      loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  // Verificar rol de admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Items de Avatar</h1>
                <p className="text-gray-600">Gestiona los items disponibles para los estudiantes</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Item
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos los géneros</option>
              <option value="MALE">Masculino</option>
              <option value="FEMALE">Femenino</option>
            </select>
            <select
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos los slots</option>
              {SLOTS.map(slot => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Shirt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No hay items</h3>
            <p className="text-gray-600">Crea tu primer item de avatar</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative ${
                  item.isDefault ? 'ring-2 ring-green-500' : ''
                }`}
              >
                {item.isDefault && (
                  <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                    Default
                  </span>
                )}
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  <img
                    src={item.imagePath}
                    alt={item.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-avatar.png';
                    }}
                  />
                </div>
                <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    RARITIES.find(r => r.value === item.rarity)?.color
                  }`}>
                    {RARITIES.find(r => r.value === item.rarity)?.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.gender === 'MALE' ? '♂' : '♀'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {SLOTS.find(s => s.value === item.slot)?.label}
                </p>
                <p className="text-sm font-medium text-purple-600 mt-1">
                  {item.basePrice} GP
                </p>
                
                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => toggleDefault(item)}
                    className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                      item.isDefault 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {item.isDefault ? 'Quitar Default' : 'Hacer Default'}
                  </button>
                  {!item.isDefault && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nuevo Item de Avatar</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imagen (PNG/GIF, 255x444px)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      previewUrl ? 'border-purple-300 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col items-center">
                        <img src={previewUrl} alt="Preview" className="h-32 object-contain mb-2" />
                        <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">Click para seleccionar imagen</p>
                        <p className="text-sm text-gray-400">PNG o GIF</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    placeholder="Ej: Gorro de Navidad"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    rows={2}
                    placeholder="Descripción del item..."
                  />
                </div>

                {/* Gender & Slot */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Género
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    >
                      <option value="MALE">Masculino</option>
                      <option value="FEMALE">Femenino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slot
                    </label>
                    <select
                      value={formData.slot}
                      onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    >
                      {SLOTS.map(slot => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rarity & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rareza
                    </label>
                    <select
                      value={formData.rarity}
                      onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    >
                      {RARITIES.map(rarity => (
                        <option key={rarity.value} value={rarity.value}>{rarity.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio Base (GP)
                    </label>
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })}
                      min={0}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>

                {/* Is Default */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">
                    Item por defecto (se equipa automáticamente al crear cuenta)
                  </label>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Crear Item
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
