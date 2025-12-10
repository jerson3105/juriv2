import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Search,
  MoreVertical,
  Edit,
  Trash2,
  ArrowLeft,
  X,
  GraduationCap,
  BookOpen,
  Download,
  Key,
  Plus,
  Mail,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  getSchool, 
  getSchoolGrades,
  getSchoolClassrooms,
  getSchoolStudentsNew,
  createSchoolStudentNew,
  bulkCreateSchoolStudentsNew,
  updateSchoolStudentNew,
  deleteSchoolStudentNew,
  resetStudentPassword,
  enrollStudentInClass,
  unenrollStudentFromClass,
  getStudentEnrollments,
  exportSchoolStudents,
  bulkEnrollStudents,
  type SchoolStudentNew,
  type SchoolGrade,
  type SchoolClassroom
} from '../../api/schoolApi';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function SchoolStudentsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SchoolStudentNew | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ['school-grades', schoolId],
    queryFn: () => getSchoolGrades(schoolId!),
    enabled: !!schoolId,
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['school-students-new', schoolId, filterSection],
    queryFn: () => getSchoolStudentsNew(schoolId!, filterSection || undefined),
    enabled: !!schoolId,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ['school-classrooms', schoolId],
    queryFn: () => getSchoolClassrooms(schoolId!),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createSchoolStudentNew>[1]) => 
      createSchoolStudentNew(schoolId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
      setShowAddModal(false);
      toast.success('Estudiante creado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear estudiante');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ studentId, data }: { studentId: string; data: Parameters<typeof updateSchoolStudentNew>[2] }) =>
      updateSchoolStudentNew(schoolId!, studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
      setShowEditModal(false);
      setSelectedStudent(null);
      toast.success('Estudiante actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (studentId: string) => deleteSchoolStudentNew(schoolId!, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
      toast.success('Estudiante eliminado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (studentId: string) => resetStudentPassword(schoolId!, studentId),
    onSuccess: (data) => {
      toast.success(`Nueva contraseña: ${data.tempPassword}`, { duration: 10000 });
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al resetear contraseña');
    },
  });

  const isAdmin = school?.userRole === 'OWNER' || school?.userRole === 'ADMIN';
  const canManageStudents = isAdmin || school?.canManageStudents;

  // Flatten sections for filter dropdown
  const allSections = grades.flatMap(g => 
    g.sections.map(s => ({ ...s, gradeName: g.name }))
  );

  const filteredStudents = students.filter(s => {
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
  });

  const handleDelete = (student: SchoolStudentNew) => {
    if (confirm(`¿Estás seguro de eliminar a "${student.firstName} ${student.lastName}"?`)) {
      deleteMutation.mutate(student.id);
    }
  };

  const handleResetPassword = (student: SchoolStudentNew) => {
    if (confirm(`¿Resetear la contraseña de "${student.firstName} ${student.lastName}"?`)) {
      resetPasswordMutation.mutate(student.id);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportSchoolStudents(schoolId!, filterSection || undefined);
      
      // Convert to CSV
      const headers = ['DNI', 'Nombre', 'Apellido', 'Email', 'Contraseña', 'Código', 'Grado', 'Sección'];
      const rows = data.map(s => [s.dni, s.nombre, s.apellido, s.email, s.contraseña, s.codigo, s.grado, s.seccion]);
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estudiantes_${school?.name || 'escuela'}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Archivo exportado correctamente');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al exportar');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Estudiantes
          </h1>
          <p className="text-gray-600 mt-1">
            {students.length} estudiantes en {school?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          )}
          {canManageStudents && (
            <>
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Carga Masiva
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Agregar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">Todas las secciones</option>
          {allSections.map((s) => (
            <option key={s.id} value={s.id}>{s.gradeName} - {s.name}</option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay estudiantes</p>
          {canManageStudents && grades.length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Agregar el primer estudiante
            </button>
          )}
          {grades.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">
              Primero debes <Link to={`/school/${schoolId}/grades`} className="text-indigo-600 hover:underline">crear grados y secciones</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Barra de acciones masivas */}
          {selectedStudents.size > 0 && canManageStudents && (
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-indigo-700">
                {selectedStudents.size} estudiante{selectedStudents.size > 1 ? 's' : ''} seleccionado{selectedStudents.size > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkEnrollModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Inscribir en clase
                </button>
                <button
                  onClick={() => setSelectedStudents(new Set())}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {canManageStudents && (
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
                          } else {
                            setSelectedStudents(new Set());
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estudiante</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Grado/Sección</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Clases</th>
                  {canManageStudents && (
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-gray-50 ${selectedStudents.has(student.id) ? 'bg-indigo-50/50' : ''}`}>
                    {canManageStudents && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedStudents);
                            if (e.target.checked) {
                              newSelected.add(student.id);
                            } else {
                              newSelected.delete(student.id);
                            }
                            setSelectedStudents(newSelected);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{student.firstName} {student.lastName}</p>
                          {student.studentCode && (
                            <p className="text-xs text-gray-500">Código: {student.studentCode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {(student.grade as any)?.name || '-'} - {(student.section as any)?.name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{student.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                        <BookOpen className="w-3 h-3" />
                        {student.enrolledClasses || 0}
                      </span>
                    </td>
                    {canManageStudents && (
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          {openMenuId === student.id && (
                            <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[180px]">
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowEnrollModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <BookOpen className="w-4 h-4" />
                                Gestionar clases
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowEditModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  handleResetPassword(student);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Key className="w-4 h-4" />
                                Resetear contraseña
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    handleDelete(student);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddStudentModal
            grades={grades}
            onClose={() => setShowAddModal(false)}
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkUploadModal
            schoolId={schoolId!}
            grades={grades}
            onClose={() => setShowBulkModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
              setShowBulkModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Bulk Enroll Modal */}
      <AnimatePresence>
        {showBulkEnrollModal && selectedStudents.size > 0 && (
          <BulkEnrollModal
            schoolId={schoolId!}
            studentIds={Array.from(selectedStudents)}
            students={students.filter(s => selectedStudents.has(s.id))}
            classrooms={classrooms}
            onClose={() => setShowBulkEnrollModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
              setSelectedStudents(new Set());
              setShowBulkEnrollModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {showEditModal && selectedStudent && (
          <EditStudentModal
            student={selectedStudent}
            grades={grades}
            onClose={() => {
              setShowEditModal(false);
              setSelectedStudent(null);
            }}
            onSubmit={(data) => updateMutation.mutate({ studentId: selectedStudent.id, data })}
            isLoading={updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Enroll Student Modal */}
      <AnimatePresence>
        {showEnrollModal && selectedStudent && (
          <EnrollStudentModal
            schoolId={schoolId!}
            student={selectedStudent}
            classrooms={classrooms}
            onClose={() => {
              setShowEnrollModal(false);
              setSelectedStudent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Add Student Modal
function AddStudentModal({ 
  grades,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  grades: SchoolGrade[];
  onClose: () => void;
  onSubmit: (data: { sectionId: string; firstName: string; lastName: string; email: string; studentCode?: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    sectionId: '',
    firstName: '',
    lastName: '',
    email: '',
    studentCode: '',
  });

  const allSections = grades.flatMap(g => 
    g.sections.map(s => ({ ...s, gradeName: g.name }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sectionId) {
      toast.error('Selecciona una sección');
      return;
    }
    onSubmit({
      ...formData,
      studentCode: formData.studentCode || undefined,
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
          <h2 className="text-xl font-bold text-gray-900">Agregar Estudiante</h2>
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
                placeholder="Nombre"
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
                placeholder="Apellido"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email institucional</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="estudiante@escuela.edu"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grado y Sección</label>
            <select
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar...</option>
              {allSections.map((s) => (
                <option key={s.id} value={s.id}>{s.gradeName} - Sección {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de estudiante (opcional)</label>
            <input
              type="text"
              value={formData.studentCode}
              onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
              placeholder="Ej: 2024001"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            Se generará una contraseña temporal automáticamente. Podrás exportar las credenciales después.
          </p>

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
              {isLoading ? 'Creando...' : 'Crear Estudiante'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Edit Student Modal
function EditStudentModal({ 
  student,
  grades,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  student: SchoolStudentNew;
  grades: SchoolGrade[];
  onClose: () => void;
  onSubmit: (data: Partial<{ firstName: string; lastName: string; email: string; studentCode: string; sectionId: string }>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    studentCode: student.studentCode || '',
    sectionId: student.sectionId,
  });

  const allSections = grades.flatMap(g => 
    g.sections.map(s => ({ ...s, gradeName: g.name }))
  );

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
          <h2 className="text-xl font-bold text-gray-900">Editar Estudiante</h2>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grado y Sección</label>
            <select
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              {allSections.map((s) => (
                <option key={s.id} value={s.id}>{s.gradeName} - Sección {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de estudiante</label>
            <input
              type="text"
              value={formData.studentCode}
              onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Enroll Student Modal
function EnrollStudentModal({ 
  schoolId,
  student,
  classrooms,
  onClose
}: { 
  schoolId: string;
  student: SchoolStudentNew;
  classrooms: SchoolClassroom[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['student-enrollments', schoolId, student.id],
    queryFn: () => getStudentEnrollments(schoolId, student.id),
  });

  const enrollMutation = useMutation({
    mutationFn: (classroomId: string) => enrollStudentInClass(schoolId, student.id, classroomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments', schoolId, student.id] });
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
      toast.success('Estudiante inscrito en la clase');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al inscribir');
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: (classroomId: string) => unenrollStudentFromClass(schoolId, student.id, classroomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-enrollments', schoolId, student.id] });
      queryClient.invalidateQueries({ queryKey: ['school-students-new', schoolId] });
      toast.success('Estudiante desinscrito de la clase');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al desinscribir');
    },
  });

  const enrolledClassroomIds = new Set(enrollments.map(e => e.classroomId));

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
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Gestionar Clases</h2>
            <p className="text-sm text-gray-500">{student.firstName} {student.lastName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {classrooms.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay clases disponibles</p>
            ) : (
              classrooms.map((classroom) => {
                const isEnrolled = enrolledClassroomIds.has(classroom.id);
                return (
                  <div
                    key={classroom.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isEnrolled ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isEnrolled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{classroom.name}</p>
                        <p className="text-xs text-gray-500">{classroom.studentCount} estudiantes</p>
                      </div>
                    </div>
                    
                    {isEnrolled ? (
                      <button
                        onClick={() => unenrollMutation.mutate(classroom.id)}
                        disabled={unenrollMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Quitar
                      </button>
                    ) : (
                      <button
                        onClick={() => enrollMutation.mutate(classroom.id)}
                        disabled={enrollMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Inscribir
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Bulk Upload Modal
function BulkUploadModal({ 
  schoolId,
  grades,
  onClose, 
  onSuccess 
}: { 
  schoolId: string;
  grades: SchoolGrade[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sectionId, setSectionId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Array<{
    dni: string;
    fullName: string;
    email: string;
    firstName: string;
    lastName: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<{ created: number; errors: Array<{ student: any; error: string }> } | null>(null);

  const allSections = grades.flatMap(g => 
    g.sections.map(s => ({ ...s, gradeName: g.name }))
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        // Buscar las columnas por nombre (ignorando mayúsculas/minúsculas)
        const headerRow = jsonData[0]?.map(h => String(h || '').toLowerCase().trim()) || [];
        
        const dniCol = headerRow.findIndex(h => h.includes('dni') || h.includes('documento'));
        const nameCol = headerRow.findIndex(h => h.includes('apellido') || h.includes('nombre'));
        const emailCol = headerRow.findIndex(h => h.includes('correo') || h.includes('email') || h.includes('mail'));

        if (dniCol === -1 || nameCol === -1 || emailCol === -1) {
          toast.error('El archivo debe tener columnas: DNI, Apellidos y Nombres, Correo');
          return;
        }

        const students = jsonData.slice(1)
          .filter(row => row[dniCol] && row[nameCol] && row[emailCol])
          .map(row => {
            const fullName = String(row[nameCol] || '').trim();
            // Intentar separar apellidos y nombres (asumiendo formato "Apellidos, Nombres" o "Apellidos Nombres")
            let firstName = '';
            let lastName = '';
            
            if (fullName.includes(',')) {
              const parts = fullName.split(',');
              lastName = parts[0].trim();
              firstName = parts.slice(1).join(',').trim();
            } else {
              // Asumir que las primeras palabras son apellidos y las últimas nombres
              const words = fullName.split(' ').filter(w => w);
              if (words.length >= 2) {
                // Tomar la mitad como apellidos y la otra mitad como nombres
                const mid = Math.ceil(words.length / 2);
                lastName = words.slice(0, mid).join(' ');
                firstName = words.slice(mid).join(' ');
              } else {
                lastName = fullName;
                firstName = '';
              }
            }

            return {
              dni: String(row[dniCol] || '').trim(),
              fullName,
              email: String(row[emailCol] || '').toLowerCase().trim(),
              firstName,
              lastName,
            };
          });

        setParsedData(students);
        
        if (students.length === 0) {
          toast.error('No se encontraron estudiantes válidos en el archivo');
        } else {
          toast.success(`Se encontraron ${students.length} estudiantes`);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Error al leer el archivo');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = async () => {
    if (!sectionId) {
      toast.error('Selecciona un grado y sección');
      return;
    }
    if (parsedData.length === 0) {
      toast.error('No hay estudiantes para cargar');
      return;
    }

    setIsUploading(true);
    try {
      const result = await bulkCreateSchoolStudentsNew(schoolId, {
        sectionId,
        students: parsedData.map(s => ({
          firstName: s.firstName || s.fullName,
          lastName: s.lastName || '',
          email: s.email,
          dni: s.dni,
        })),
      });

      setResults({
        created: result.created.length,
        errors: result.errors,
      });

      if (result.created.length > 0) {
        toast.success(`${result.created.length} estudiantes creados`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errores encontrados`);
      }

      if (result.errors.length === 0) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cargar estudiantes');
    } finally {
      setIsUploading(false);
    }
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
        className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Carga Masiva de Estudiantes
            </h2>
            <p className="text-sm text-gray-500 mt-1">Sube un archivo Excel con los datos de los estudiantes</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Instrucciones */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <h3 className="font-medium text-indigo-900 mb-2">Formato del archivo Excel:</h3>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>• <strong>DNI</strong> - Documento de identidad del estudiante</li>
              <li>• <strong>Apellidos y Nombres</strong> - Nombre completo (puede ser "Apellidos, Nombres" o "Apellidos Nombres")</li>
              <li>• <strong>Correo institucional</strong> - Email del estudiante</li>
            </ul>
          </div>

          {/* Selector de sección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grado y Sección</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Seleccionar...</option>
              {allSections.map((s) => (
                <option key={s.id} value={s.id}>{s.gradeName} - Sección {s.name}</option>
              ))}
            </select>
          </div>

          {/* Input de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo Excel</label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-indigo-300 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Haz clic para seleccionar un archivo'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
              </label>
            </div>
          </div>

          {/* Preview de datos */}
          {parsedData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Vista previa ({parsedData.length} estudiantes)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600">DNI</th>
                      <th className="text-left px-3 py-2 text-gray-600">Nombre</th>
                      <th className="text-left px-3 py-2 text-gray-600">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.slice(0, 10).map((student, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-900">{student.dni}</td>
                        <td className="px-3 py-2 text-gray-900">{student.firstName} {student.lastName}</td>
                        <td className="px-3 py-2 text-gray-500">{student.email}</td>
                      </tr>
                    ))}
                    {parsedData.length > 10 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center text-gray-400">
                          ... y {parsedData.length - 10} más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultados */}
          {results && (
            <div className="space-y-2">
              {results.created > 0 && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{results.created} estudiantes creados correctamente</span>
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{results.errors.length} errores encontrados:</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <li key={i}>• {err.student.email}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {results ? 'Cerrar' : 'Cancelar'}
          </button>
          {!results && (
            <button
              onClick={handleUpload}
              disabled={isUploading || parsedData.length === 0 || !sectionId}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Cargando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Cargar {parsedData.length} estudiantes
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Bulk Enroll Modal
function BulkEnrollModal({ 
  schoolId,
  studentIds,
  students,
  classrooms,
  onClose, 
  onSuccess 
}: { 
  schoolId: string;
  studentIds: string[];
  students: SchoolStudentNew[];
  classrooms: SchoolClassroom[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [results, setResults] = useState<{ enrolled: number; errors: Array<{ studentId: string; error: string }> } | null>(null);

  const handleEnroll = async () => {
    if (!selectedClassroom) {
      toast.error('Selecciona una clase');
      return;
    }

    setIsEnrolling(true);
    try {
      const result = await bulkEnrollStudents(schoolId, selectedClassroom, studentIds);
      setResults(result);

      if (result.enrolled > 0) {
        toast.success(`${result.enrolled} estudiantes inscritos`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errores encontrados`);
      }

      if (result.errors.length === 0) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al inscribir estudiantes');
    } finally {
      setIsEnrolling(false);
    }
  };

  const selectedClassroomData = classrooms.find(c => c.id === selectedClassroom);

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
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Inscribir Estudiantes
            </h2>
            <p className="text-sm text-gray-500 mt-1">{studentIds.length} estudiantes seleccionados</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Lista de estudiantes seleccionados */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estudiantes a inscribir:</label>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {students.map(student => (
                  <span 
                    key={student.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full text-xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </span>
                    {student.firstName} {student.lastName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Selector de clase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clase destino</label>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Seleccionar clase...</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
              ))}
            </select>
          </div>

          {selectedClassroomData && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <p className="text-sm text-indigo-700">
                Los estudiantes serán inscritos en <strong>{selectedClassroomData.name}</strong> con la clase de personaje predeterminada (GUARDIAN).
              </p>
            </div>
          )}

          {/* Resultados */}
          {results && (
            <div className="space-y-2">
              {results.enrolled > 0 && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{results.enrolled} estudiantes inscritos correctamente</span>
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{results.errors.length} errores encontrados:</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1 max-h-24 overflow-y-auto">
                    {results.errors.map((err, i) => {
                      const student = students.find(s => s.id === err.studentId);
                      return (
                        <li key={i}>• {student ? `${student.firstName} ${student.lastName}` : err.studentId}: {err.error}</li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {results ? 'Cerrar' : 'Cancelar'}
          </button>
          {!results && (
            <button
              onClick={handleEnroll}
              disabled={isEnrolling || !selectedClassroom}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isEnrolling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Inscribiendo...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Inscribir {studentIds.length} estudiantes
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
