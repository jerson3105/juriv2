import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Search,
  School,
  Users,
  Calendar,
  Copy,
  ExternalLink,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { AdminClassroom, AdminClassroomDetails } from '../../lib/adminApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AdminClassroomDetailsModal } from '../../components/admin/AdminClassroomDetailsModal';

export default function AdminClassrooms() {
  const user = useAuthStore((state) => state.user);
  const [classrooms, setClassrooms] = useState<AdminClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [classroomDetails, setClassroomDetails] = useState<AdminClassroomDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadClassrooms();
  }, []);

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getClassrooms();
      setClassrooms(data);
    } catch (error) {
      console.error('Error loading classrooms:', error);
      toast.error('Error al cargar clases');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  const handleViewClassroom = async (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setLoadingDetails(true);
    try {
      const details = await adminApi.getClassroomDetails(classroomId);
      setClassroomDetails(details);
    } catch (error) {
      console.error('Error loading classroom details:', error);
      toast.error('Error al cargar detalles de la clase');
      setSelectedClassroomId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedClassroomId(null);
    setClassroomDetails(null);
  };

  // Verificar rol de admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const filteredClassrooms = classrooms.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.teacher.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.teacher.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || 
      (filterStatus === 'active' && c.isActive) ||
      (filterStatus === 'inactive' && !c.isActive);
    return matchesSearch && matchesStatus;
  });

  const activeCount = classrooms.filter(c => c.isActive).length;
  const inactiveCount = classrooms.filter(c => !c.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Clases</h1>
              <p className="text-gray-600">{classrooms.length} clases en el sistema</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o profesor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                <School className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{classrooms.length}</p>
                <p className="text-sm text-gray-500">Total de Clases</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <ToggleRight className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                <p className="text-sm text-gray-500">Clases Activas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gray-100 text-gray-600">
                <ToggleLeft className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
                <p className="text-sm text-gray-500">Clases Inactivas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Classrooms Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredClassrooms.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <School className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No hay clases</h3>
            <p className="text-gray-600">No se encontraron clases con los filtros aplicados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClassrooms.map((classroom) => (
              <motion.div
                key={classroom.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${
                  classroom.isActive ? 'border-green-500' : 'border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{classroom.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        classroom.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {classroom.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyCode(classroom.code)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-mono transition-colors"
                    title="Copiar código"
                  >
                    <Copy className="w-4 h-4" />
                    {classroom.code}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">
                      Profesor: <span className="font-medium">{classroom.teacher.firstName} {classroom.teacher.lastName}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Creada: {new Date(classroom.createdAt).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleViewClassroom(classroom.id)}
                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                  >
                    Ver detalles
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      <AdminClassroomDetailsModal
        isOpen={selectedClassroomId !== null}
        onClose={handleCloseModal}
        details={classroomDetails}
        loading={loadingDetails}
      />
    </div>
  );
}
