import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  User,
  Mail,
  Trash2,
  Edit,
  X,
  Check,
  ArrowLeft
} from 'lucide-react';
import { 
  getSchool, 
  getSchoolMembers, 
  addSchoolMember, 
  updateSchoolMember, 
  removeSchoolMember,
  type SchoolMember 
} from '../../api/schoolApi';
import toast from 'react-hot-toast';

export default function SchoolMembersPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'add');
  const [editingMember, setEditingMember] = useState<SchoolMember | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['school-members', schoolId],
    queryFn: () => getSchoolMembers(schoolId!),
    enabled: !!schoolId,
  });

  const addMutation = useMutation({
    mutationFn: (data: Parameters<typeof addSchoolMember>[1]) => 
      addSchoolMember(schoolId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-members', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      setShowAddModal(false);
      toast.success('Profesor agregado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al agregar profesor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: Parameters<typeof updateSchoolMember>[2] }) =>
      updateSchoolMember(schoolId!, memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-members', schoolId] });
      setEditingMember(null);
      toast.success('Miembro actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeSchoolMember(schoolId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-members', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      toast.success('Miembro eliminado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    },
  });

  const isAdmin = school?.userRole === 'OWNER' || school?.userRole === 'ADMIN';

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      case 'ADMIN': return <Shield className="w-4 h-4 text-purple-600" />;
      default: return <User className="w-4 h-4 text-blue-600" />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Propietario';
      case 'ADMIN': return 'Administrador';
      default: return 'Profesor';
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Profesores
          </h1>
          <p className="text-gray-600 mt-1">
            {members.length} miembros en {school?.name}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Agregar Profesor
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Members List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <motion.div
              key={member.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
                {member.firstName[0]}{member.lastName[0]}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-gray-900 font-medium">
                    {member.firstName} {member.lastName}
                  </h3>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    member.role === 'OWNER' 
                      ? 'bg-amber-100 text-amber-700'
                      : member.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {getRoleIcon(member.role)}
                    {getRoleName(member.role)}
                  </span>
                </div>
                <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                  <Mail className="w-3 h-3" />
                  {member.email}
                </p>
                {member.role === 'TEACHER' && (
                  <div className="flex gap-2 mt-2">
                    {member.canCreateClasses && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Puede crear clases
                      </span>
                    )}
                    {member.canManageStudents && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Gestiona estudiantes
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isAdmin && member.role !== 'OWNER' && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                  
                  <AnimatePresence>
                    {menuOpen === member.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10"
                      >
                        <button
                          onClick={() => {
                            setEditingMember(member);
                            setMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Editar permisos
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar este miembro?')) {
                              removeMutation.mutate(member.id);
                            }
                            setMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No se encontraron miembros</p>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            onClose={() => setShowAddModal(false)}
            onSubmit={(data) => addMutation.mutate(data)}
            isLoading={addMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onClose={() => setEditingMember(null)}
            onSubmit={(data) => updateMutation.mutate({ memberId: editingMember.id, data })}
            isLoading={updateMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Add Member Modal Component
function AddMemberModal({ 
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'TEACHER' as 'ADMIN' | 'TEACHER',
    canCreateClasses: false,
    canManageStudents: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password.length < 6) {
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
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Agregar Profesor</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              El profesor usará esta contraseña para iniciar sesión en Juried
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rol en la escuela</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'TEACHER' })}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                  formData.role === 'TEACHER'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User className="w-5 h-5" />
                Profesor
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                  formData.role === 'ADMIN'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield className="w-5 h-5" />
                Admin
              </button>
            </div>
          </div>

          {formData.role === 'TEACHER' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Permisos</label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.canCreateClasses}
                  onChange={(e) => setFormData({ ...formData, canCreateClasses: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">Puede crear clases</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.canManageStudents}
                  onChange={(e) => setFormData({ ...formData, canManageStudents: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">Puede gestionar estudiantes</span>
              </label>
            </div>
          )}

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
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Agregando...' : 'Agregar Profesor'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Edit Member Modal Component
function EditMemberModal({ 
  member,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  member: SchoolMember;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    role: member.role as 'ADMIN' | 'TEACHER',
    canCreateClasses: member.canCreateClasses,
    canManageStudents: member.canManageStudents,
    isActive: member.isActive,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          <h2 className="text-xl font-bold text-gray-900">Editar Permisos</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-gray-900 font-medium">{member.firstName} {member.lastName}</p>
          <p className="text-gray-500 text-sm">{member.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'TEACHER' })}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                  formData.role === 'TEACHER'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User className="w-5 h-5" />
                Profesor
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                className={`p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                  formData.role === 'ADMIN'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield className="w-5 h-5" />
                Admin
              </button>
            </div>
          </div>

          {formData.role === 'TEACHER' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Permisos</label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.canCreateClasses}
                  onChange={(e) => setFormData({ ...formData, canCreateClasses: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">Puede crear clases</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.canManageStudents}
                  onChange={(e) => setFormData({ ...formData, canManageStudents: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">Puede gestionar estudiantes</span>
              </label>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700">Cuenta activa</span>
          </label>

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
              <Check className="w-4 h-4" />
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
