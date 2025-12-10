import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Building2,
  Save,
  Trash2,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { getSchool, updateSchool, deleteSchool } from '../../api/schoolApi';
import toast from 'react-hot-toast';

export default function SchoolSettingsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    address: '',
  });

  // Actualizar formData cuando se carga la escuela
  useState(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        description: school.description || '',
        email: school.email || '',
        phone: school.phone || '',
        address: school.address || '',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => updateSchool(schoolId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      toast.success('Configuración guardada');
    },
    onError: () => {
      toast.error('Error al guardar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSchool(schoolId!),
    onSuccess: () => {
      toast.success('Escuela eliminada');
      navigate('/schools');
    },
    onError: () => {
      toast.error('Error al eliminar');
    },
  });

  const isOwner = school?.userRole === 'OWNER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Escuela no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link 
        to={`/school/${schoolId}`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-600" />
          Configuración
        </h1>
        <p className="text-gray-600 mt-1">
          Configuración de {school.name}
        </p>
      </div>

      {/* Settings Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la escuela
            </label>
            <input
              type="text"
              value={formData.name || school.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description || school.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Descripción de la escuela..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de contacto
              </label>
              <input
                type="email"
                value={formData.email || school.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="contacto@escuela.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone || school.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="+51 999 999 999"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              value={formData.address || school.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Av. Principal 123, Ciudad"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Danger Zone */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 border border-red-200 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zona de Peligro
          </h2>
          
          <p className="text-gray-600 mb-4">
            Eliminar la escuela borrará permanentemente todos los datos asociados, incluyendo profesores, clases y estudiantes.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Escuela
            </button>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-700 font-medium mb-3">
                ¿Estás seguro? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
