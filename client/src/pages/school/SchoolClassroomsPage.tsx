import { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Plus, 
  Search,
  Users,
  User,
  X,
  ExternalLink,
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import { 
  getSchool, 
  getSchoolClassrooms, 
  getSchoolMembers,
  createSchoolClassroom,
  updateSchoolClassroom,
  deleteSchoolClassroom,
  type SchoolMember,
  type SchoolClassroom
} from '../../api/schoolApi';
import toast from 'react-hot-toast';

export default function SchoolClassroomsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'add');
  const [editingClassroom, setEditingClassroom] = useState<SchoolClassroom | null>(null);
  const [deletingClassroom, setDeletingClassroom] = useState<SchoolClassroom | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ['school-classrooms', schoolId],
    queryFn: () => getSchoolClassrooms(schoolId!),
    enabled: !!schoolId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['school-members', schoolId],
    queryFn: () => getSchoolMembers(schoolId!),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; teacherId: string }) => 
      createSchoolClassroom(schoolId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-classrooms', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      setShowAddModal(false);
      toast.success('Clase creada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear clase');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ classroomId, ...data }: { classroomId: string; name?: string; description?: string; teacherId?: string; gradeLevel?: string | null }) => 
      updateSchoolClassroom(schoolId!, classroomId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-classrooms', schoolId] });
      setEditingClassroom(null);
      toast.success('Clase actualizada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar clase');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (classroomId: string) => deleteSchoolClassroom(schoolId!, classroomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-classrooms', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
      setDeletingClassroom(null);
      toast.success('Clase eliminada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar clase');
    },
  });

  const isAdmin = school?.userRole === 'OWNER' || school?.userRole === 'ADMIN';
  const canCreateClasses = isAdmin || school?.canCreateClasses;

  const filteredClassrooms = classrooms.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    `${c.teacher?.firstName} ${c.teacher?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // Filtrar solo profesores para asignar
  const teachers = members.filter(m => m.role === 'TEACHER' || m.role === 'ADMIN' || m.role === 'OWNER');

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
            <BookOpen className="w-7 h-7 text-indigo-600" />
            Clases
          </h1>
          <p className="text-gray-600 mt-1">
            {classrooms.length} clases en {school?.name}
          </p>
        </div>
        {canCreateClasses && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear Clase
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o profesor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Classrooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClassrooms.map((classroom, index) => (
            <motion.div
              key={classroom.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-500 font-mono">
                    {classroom.code}
                  </span>
                  {isAdmin && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === classroom.id ? null : classroom.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      {openMenuId === classroom.id && (
                        <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => {
                              setEditingClassroom(classroom);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setDeletingClassroom(classroom);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">{classroom.name}</h3>
              
              {classroom.gradeLevel && (
                <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full mb-2">
                  {GRADE_LEVELS.find(g => g.value === classroom.gradeLevel)?.label || classroom.gradeLevel}
                </span>
              )}
              
              {classroom.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{classroom.description}</p>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <User className="w-4 h-4" />
                <span>{classroom.teacher?.firstName} {classroom.teacher?.lastName}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-gray-500">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{classroom.studentCount} estudiantes</span>
                </div>
                <button
                  onClick={() => navigate(`/classroom/${classroom.id}`)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </motion.div>
          ))}

          {filteredClassrooms.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No se encontraron clases</p>
            </div>
          )}
        </div>
      )}

      {/* Add Classroom Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddClassroomModal
            teachers={teachers}
            onClose={() => setShowAddModal(false)}
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit Classroom Modal */}
      <AnimatePresence>
        {editingClassroom && (
          <EditClassroomModal
            classroom={editingClassroom}
            teachers={teachers}
            onClose={() => setEditingClassroom(null)}
            onSubmit={(data) => updateMutation.mutate({ classroomId: editingClassroom.id, ...data })}
            isLoading={updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingClassroom && (
          <DeleteConfirmModal
            classroom={deletingClassroom}
            onClose={() => setDeletingClassroom(null)}
            onConfirm={() => deleteMutation.mutate(deletingClassroom.id)}
            isLoading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Opciones de grado
const GRADE_LEVELS = [
  { value: '', label: 'Seleccionar grado (opcional)' },
  { value: 'INICIAL_3', label: '3 años (Inicial)' },
  { value: 'INICIAL_4', label: '4 años (Inicial)' },
  { value: 'INICIAL_5', label: '5 años (Inicial)' },
  { value: 'PRIMARIA_1', label: '1° Primaria' },
  { value: 'PRIMARIA_2', label: '2° Primaria' },
  { value: 'PRIMARIA_3', label: '3° Primaria' },
  { value: 'PRIMARIA_4', label: '4° Primaria' },
  { value: 'PRIMARIA_5', label: '5° Primaria' },
  { value: 'PRIMARIA_6', label: '6° Primaria' },
  { value: 'SECUNDARIA_1', label: '1° Secundaria' },
  { value: 'SECUNDARIA_2', label: '2° Secundaria' },
  { value: 'SECUNDARIA_3', label: '3° Secundaria' },
  { value: 'SECUNDARIA_4', label: '4° Secundaria' },
  { value: 'SECUNDARIA_5', label: '5° Secundaria' },
];

// Add Classroom Modal Component
function AddClassroomModal({ 
  teachers,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  teachers: SchoolMember[];
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; teacherId: string; gradeLevel?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teacherId: '',
    gradeLevel: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacherId) {
      toast.error('Selecciona un profesor');
      return;
    }
    onSubmit({
      ...formData,
      gradeLevel: formData.gradeLevel || undefined,
    });
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
          <h2 className="text-xl font-bold text-gray-900">Crear Clase</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la clase</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Matemáticas 3°A"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grado (opcional)
            </label>
            <select
              value={formData.gradeLevel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, gradeLevel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {GRADE_LEVELS.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción de la clase..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profesor asignado
            </label>
            <select
              value={formData.teacherId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar profesor...</option>
              {teachers.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {teacher.firstName} {teacher.lastName} ({teacher.email})
                </option>
              ))}
            </select>
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
              <Plus className="w-4 h-4" />
              {isLoading ? 'Creando...' : 'Crear Clase'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Edit Classroom Modal Component
function EditClassroomModal({ 
  classroom,
  teachers,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  classroom: SchoolClassroom;
  teachers: SchoolMember[];
  onClose: () => void;
  onSubmit: (data: { name?: string; description?: string; teacherId?: string; gradeLevel?: string | null }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: classroom.name,
    description: classroom.description || '',
    teacherId: classroom.teacherId,
    gradeLevel: classroom.gradeLevel || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      teacherId: formData.teacherId,
      gradeLevel: formData.gradeLevel || null,
    });
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
          <h2 className="text-xl font-bold text-gray-900">Editar Clase</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la clase</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Matemáticas 3°A"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grado (opcional)
            </label>
            <select
              value={formData.gradeLevel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, gradeLevel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {GRADE_LEVELS.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción de la clase..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profesor asignado
            </label>
            <select
              value={formData.teacherId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, teacherId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar profesor...</option>
              {teachers.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {teacher.firstName} {teacher.lastName} ({teacher.email})
                </option>
              ))}
            </select>
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
              <Pencil className="w-4 h-4" />
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ 
  classroom,
  onClose, 
  onConfirm, 
  isLoading 
}: { 
  classroom: SchoolClassroom;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Eliminar Clase</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-gray-600 text-center">
            ¿Estás seguro de que deseas eliminar la clase <strong>"{classroom.name}"</strong>?
          </p>
          <p className="text-sm text-gray-500 text-center mt-2">
            Esta acción no se puede deshacer. Los estudiantes deberán ser desinscritos primero.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
