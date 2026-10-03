import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Search,
  Users,
  Shield,
  GraduationCap,
  UserCog,
  Ban,
  Mail,
  Calendar,
  ChevronDown,
  Plus,
  RotateCcw,
  X
} from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { AdminUser, AssignableRole } from '../../lib/adminApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { RoleChangeDialog } from '../../components/admin/RoleChangeDialog';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

const ROLES = [
  { value: 'ADMIN', label: 'Administrador', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  { value: 'TEACHER', label: 'Profesor', icon: UserCog, color: 'bg-blue-100 text-blue-700' },
  { value: 'STUDENT', label: 'Estudiante', icon: GraduationCap, color: 'bg-green-100 text-green-700' },
];
// Las familias se muestran, pero su rol no se cambia desde aquí.
const PARENT_ROLE = { value: 'PARENT', label: 'Familia', icon: Users, color: 'bg-amber-100 text-amber-800' };

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export default function AdminUsers() {
  const user = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers();
      setUsers(data.users);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChanged = (userId: string, newRole: AssignableRole) => {
    setUsers((list) => list.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setRoleTarget(null);
    toast.success('Rol actualizado. Sus sesiones se cerraron.');
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const next = !statusTarget.isActive;
    try {
      setSavingStatus(true);
      await adminApi.updateUserStatus(statusTarget.id, next);
      setUsers((list) => list.map(u => u.id === statusTarget.id ? { ...u, isActive: next } : u));
      toast.success(next ? 'Cuenta reactivada' : 'Cuenta desactivada. Sus sesiones se cerraron.');
      setStatusTarget(null);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo cambiar el estado de la cuenta'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCreateTeacher = async (data: { email: string; firstName: string; lastName: string; password: string }) => {
    try {
      setCreating(true);
      const response = await api.post('/admin/users/teacher', data);
      if (response.data.success) {
        toast.success('Profesor creado correctamente');
        setShowCreateModal(false);
        loadUsers(); // Recargar lista
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Error al crear profesor'));
    } finally {
      setCreating(false);
    }
  };

  // Verificar rol de admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || PARENT_ROLE;

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
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
                <p className="text-gray-600">{users.length} usuarios registrados</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Crear Profesor
            </button>
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
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos los roles</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {ROLES.map(role => {
            const count = users.filter(u => u.role === role.value).length;
            const Icon = role.icon;
            return (
              <div key={role.value} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${role.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-sm text-gray-500">{role.label}s</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No hay usuarios</h3>
              <p className="text-gray-600">No se encontraron usuarios con los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registro
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((u) => {
                    const roleInfo = getRoleInfo(u.role);
                    const RoleIcon = roleInfo.icon;
                    
                    return (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                              {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {u.provider}
                                {!u.isActive && (
                                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Desactivada</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4" />
                            {u.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="relative">
                            {u.id === user.id || u.role === 'PARENT' ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color}`}
                                title={u.id === user.id ? 'Tu propio rol no se cambia desde aquí' : 'El rol de una familia no se cambia desde aquí'}
                              >
                                <RoleIcon className="w-4 h-4" />
                                {roleInfo.label}
                              </span>
                            ) : (
                              <button
                                onClick={() => setRoleTarget(u)}
                                aria-label={`Cambiar el rol de ${u.firstName} ${u.lastName} (ahora: ${roleInfo.label})`}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color} hover:opacity-80 transition-opacity`}
                              >
                                <RoleIcon className="w-4 h-4" />
                                {roleInfo.label}
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Calendar className="w-4 h-4" />
                            {new Date(u.createdAt).toLocaleDateString('es-ES')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {u.id !== user.id && (u.isActive ? (
                              <button
                                onClick={() => setStatusTarget(u)}
                                className="p-2 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Desactivar cuenta"
                                aria-label={`Desactivar la cuenta de ${u.firstName} ${u.lastName}`}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setStatusTarget(u)}
                                className="p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Reactivar cuenta"
                                aria-label={`Reactivar la cuenta de ${u.firstName} ${u.lastName}`}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {roleTarget && (
        <RoleChangeDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onChanged={(role) => handleRoleChanged(roleTarget.id, role)}
        />
      )}

      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => !savingStatus && setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        isLoading={savingStatus}
        variant={statusTarget?.isActive ? 'danger' : 'info'}
        title={statusTarget?.isActive
          ? `¿Desactivar la cuenta de ${statusTarget.firstName} ${statusTarget.lastName}?`
          : `¿Reactivar la cuenta de ${statusTarget?.firstName ?? ''} ${statusTarget?.lastName ?? ''}?`}
        message={statusTarget?.isActive
          ? 'No podrá entrar y se cerrarán sus sesiones abiertas. Sus datos no se borran: puedes reactivarla cuando quieras.'
          : 'Podrá volver a entrar con sus datos de siempre.'}
        confirmText={statusTarget?.isActive ? 'Desactivar' : 'Reactivar'}
      />

      {/* Create Teacher Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTeacherModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateTeacher}
            isLoading={creating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Create Teacher Modal Component
function CreateTeacherModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (data: { email: string; firstName: string; lastName: string; password: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
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
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Profesor</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Juan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Pérez"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="profesor@escuela.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              El profesor usará esta contraseña para iniciar sesión
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-700">
              <strong>Nota:</strong> Este profesor podrá ser asignado como administrador de una escuela después de crearlo.
            </p>
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
              {isLoading ? 'Creando...' : 'Crear Profesor'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
