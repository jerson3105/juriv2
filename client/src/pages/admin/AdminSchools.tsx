import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Search,
  Users,
  GraduationCap,
  X,
  ExternalLink,
  Shield,
  LogOut
} from 'lucide-react';
import api from '../../lib/api';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

interface School {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  maxTeachers: number;
  maxStudentsPerClass: number;
  createdAt: string;
  stats?: {
    members: number;
    classrooms: number;
    students: number;
  };
}

interface Teacher {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// API functions for admin
const adminSchoolApi = {
  getAll: async (): Promise<School[]> => {
    const response = await api.get('/admin/schools');
    return response.data;
  },
  create: async (data: any): Promise<School> => {
    const response = await api.post('/schools', data);
    return response.data;
  },
  getTeachers: async (): Promise<Teacher[]> => {
    const response = await api.get('/admin/users?limit=1000');
    const users = response.data?.data?.users || response.data?.users || [];
    // Filtrar solo profesores (TEACHER)
    return users.filter((u: any) => u.role === 'TEACHER');
  },
};

export default function AdminSchools() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Verificar rol de admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['admin-schools'],
    queryFn: adminSchoolApi.getAll,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: adminSchoolApi.getTeachers,
  });

  const createMutation = useMutation({
    mutationFn: adminSchoolApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] });
      setShowCreateModal(false);
      toast.success('Escuela creada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear la escuela');
    },
  });

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">Gestión de Escuelas</h1>
                <p className="text-indigo-200">Administra las instituciones educativas de Juried</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Volver al Panel
              </Link>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{schools.length}</h3>
            <p className="text-gray-600">Escuelas totales</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {schools.reduce((acc, s) => acc + (s.stats?.members || 0), 0)}
            </h3>
            <p className="text-gray-600">Profesores asignados</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {schools.reduce((acc, s) => acc + (s.stats?.students || 0), 0)}
            </h3>
            <p className="text-gray-600">Estudiantes totales</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full h-full flex flex-col items-center justify-center text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-semibold">Nueva Escuela</span>
            </button>
          </motion.div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar escuelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Schools Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredSchools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchools.map((school, index) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
              >
                <div className="flex items-start justify-between mb-4">
                  {school.logoUrl ? (
                    <img 
                      src={school.logoUrl} 
                      alt={school.name}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    school.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {school.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-1">{school.name}</h3>
                <p className="text-gray-500 text-sm mb-4">/{school.slug}</p>

                <div className="grid grid-cols-3 gap-2 text-center py-3 border-t border-gray-100">
                  <div>
                    <p className="text-gray-900 font-semibold">{school.stats?.members || 0}</p>
                    <p className="text-xs text-gray-500">Profesores</p>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold">{school.stats?.classrooms || 0}</p>
                    <p className="text-xs text-gray-500">Clases</p>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold">{school.stats?.students || 0}</p>
                    <p className="text-xs text-gray-500">Estudiantes</p>
                  </div>
                </div>

                <Link
                  to={`/school/${school.id}`}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver escuela
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No se encontraron escuelas</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Crear primera escuela
            </button>
          </div>
        )}
      </div>

      {/* Create School Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateSchoolModal
            teachers={teachers}
            onClose={() => setShowCreateModal(false)}
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Create School Modal Component
function CreateSchoolModal({ 
  teachers,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  teachers: Teacher[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    email: '',
    phone: '',
    ownerId: '', // El admin selecciona quién será el owner
  });

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    setFormData({ ...formData, name, slug });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownerId) {
      toast.error('Selecciona un propietario para la escuela');
      return;
    }
    onSubmit(formData);
  };

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
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Crear Nueva Escuela</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de la escuela"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ej: Colegio San Martín"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Identificador (URL)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">/school/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="mi-escuela"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Propietario (Admin de la escuela)
            </label>
            <select
              value={formData.ownerId}
              onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Seleccionar profesor...</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName} ({teacher.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Este profesor será el propietario y administrador principal de la escuela
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve descripción de la institución..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email de contacto"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contacto@escuela.com"
            />
            <Input
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+51 999 999 999"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Creando...</span>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  Crear Escuela
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
