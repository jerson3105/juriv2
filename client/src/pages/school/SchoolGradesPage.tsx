import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  Plus, 
  Edit,
  Trash2,
  ArrowLeft,
  X,
  Users,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import { 
  getSchool, 
  getSchoolGrades,
  createSchoolGrade,
  updateSchoolGrade,
  deleteSchoolGrade,
  createSchoolSection,
  updateSchoolSection,
  deleteSchoolSection,
  type SchoolGrade,
  type SchoolSection
} from '../../api/schoolApi';
import toast from 'react-hot-toast';

export default function SchoolGradesPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const queryClient = useQueryClient();
  
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState<string | null>(null);
  const [editingGrade, setEditingGrade] = useState<SchoolGrade | null>(null);
  const [editingSection, setEditingSection] = useState<{ gradeId: string; section: SchoolSection } | null>(null);

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['school-grades', schoolId],
    queryFn: () => getSchoolGrades(schoolId!),
    enabled: !!schoolId,
  });

  const createGradeMutation = useMutation({
    mutationFn: (data: { name: string; level: number }) => createSchoolGrade(schoolId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      setShowAddGradeModal(false);
      toast.success('Grado creado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear grado');
    },
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ gradeId, data }: { gradeId: string; data: Partial<{ name: string; level: number }> }) =>
      updateSchoolGrade(schoolId!, gradeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      setEditingGrade(null);
      toast.success('Grado actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    },
  });

  const deleteGradeMutation = useMutation({
    mutationFn: (gradeId: string) => deleteSchoolGrade(schoolId!, gradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      toast.success('Grado eliminado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: ({ gradeId, name }: { gradeId: string; name: string }) =>
      createSchoolSection(schoolId!, gradeId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      setShowAddSectionModal(null);
      toast.success('Sección creada correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear sección');
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, name }: { sectionId: string; name: string }) =>
      updateSchoolSection(schoolId!, sectionId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      setEditingSection(null);
      toast.success('Sección actualizada');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => deleteSchoolSection(schoolId!, sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-grades', schoolId] });
      toast.success('Sección eliminada');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    },
  });

  const isAdmin = school?.userRole === 'OWNER' || school?.userRole === 'ADMIN';

  const toggleGrade = (gradeId: string) => {
    const newExpanded = new Set(expandedGrades);
    if (newExpanded.has(gradeId)) {
      newExpanded.delete(gradeId);
    } else {
      newExpanded.add(gradeId);
    }
    setExpandedGrades(newExpanded);
  };

  const handleDeleteGrade = (grade: SchoolGrade) => {
    if (confirm(`¿Estás seguro de eliminar "${grade.name}"? Esto eliminará todas sus secciones.`)) {
      deleteGradeMutation.mutate(grade.id);
    }
  };

  const handleDeleteSection = (section: SchoolSection) => {
    if (confirm(`¿Estás seguro de eliminar la sección "${section.name}"?`)) {
      deleteSectionMutation.mutate(section.id);
    }
  };

  const totalStudents = grades.reduce((acc, g) => 
    acc + g.sections.reduce((sAcc, s) => sAcc + (s.studentCount || 0), 0), 0
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-indigo-600" />
            Grados y Secciones
          </h1>
          <p className="text-gray-600 mt-1">
            {grades.length} grados • {totalStudents} estudiantes en {school?.name}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddGradeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar Grado
          </button>
        )}
      </div>

      {/* Grades List */}
      {grades.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay grados configurados</p>
          {isAdmin && (
            <button
              onClick={() => setShowAddGradeModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Crear el primer grado
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grades.map((grade) => (
            <div
              key={grade.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Grade Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleGrade(grade.id)}
              >
                <div className="flex items-center gap-3">
                  <button className="p-1">
                    {expandedGrades.has(grade.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {grade.level}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{grade.name}</h3>
                    <p className="text-sm text-gray-500">
                      {grade.sections.length} secciones • {grade.sections.reduce((acc, s) => acc + (s.studentCount || 0), 0)} estudiantes
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowAddSectionModal(grade.id)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Agregar sección"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingGrade(grade)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar grado"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGrade(grade)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar grado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sections */}
              <AnimatePresence>
                {expandedGrades.has(grade.id) && grade.sections.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100"
                  >
                    <div className="p-4 bg-gray-50 space-y-2">
                      {grade.sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                              {section.name}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Sección {section.name}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {section.studentCount || 0} estudiantes
                              </p>
                            </div>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingSection({ gradeId: grade.id, section })}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSection(section)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {expandedGrades.has(grade.id) && grade.sections.length === 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-gray-500 text-sm">
                  No hay secciones en este grado.
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddSectionModal(grade.id)}
                      className="ml-2 text-indigo-600 hover:text-indigo-700"
                    >
                      Agregar una
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Grade Modal */}
      <AnimatePresence>
        {showAddGradeModal && (
          <GradeModal
            onClose={() => setShowAddGradeModal(false)}
            onSubmit={(data) => createGradeMutation.mutate(data)}
            isLoading={createGradeMutation.isPending}
            existingLevels={grades.map(g => g.level)}
          />
        )}
      </AnimatePresence>

      {/* Edit Grade Modal */}
      <AnimatePresence>
        {editingGrade && (
          <GradeModal
            grade={editingGrade}
            onClose={() => setEditingGrade(null)}
            onSubmit={(data) => updateGradeMutation.mutate({ gradeId: editingGrade.id, data })}
            isLoading={updateGradeMutation.isPending}
            existingLevels={grades.filter(g => g.id !== editingGrade.id).map(g => g.level)}
          />
        )}
      </AnimatePresence>

      {/* Add Section Modal */}
      <AnimatePresence>
        {showAddSectionModal && (
          <SectionModal
            gradeId={showAddSectionModal}
            onClose={() => setShowAddSectionModal(null)}
            onSubmit={(name) => createSectionMutation.mutate({ gradeId: showAddSectionModal, name })}
            isLoading={createSectionMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit Section Modal */}
      <AnimatePresence>
        {editingSection && (
          <SectionModal
            gradeId={editingSection.gradeId}
            section={editingSection.section}
            onClose={() => setEditingSection(null)}
            onSubmit={(name) => updateSectionMutation.mutate({ sectionId: editingSection.section.id, name })}
            isLoading={updateSectionMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Grade Modal
function GradeModal({ 
  grade,
  onClose, 
  onSubmit, 
  isLoading,
  existingLevels
}: { 
  grade?: SchoolGrade;
  onClose: () => void;
  onSubmit: (data: { name: string; level: number }) => void;
  isLoading: boolean;
  existingLevels: number[];
}) {
  const [formData, setFormData] = useState({
    name: grade?.name || '',
    level: grade?.level || Math.max(0, ...existingLevels) + 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
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
          <h2 className="text-xl font-bold text-gray-900">
            {grade ? 'Editar Grado' : 'Agregar Grado'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del grado</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: 1° Secundaria"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel (orden)</label>
            <input
              type="number"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
              min={1}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Define el orden de los grados (1 = primero)</p>
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
              {isLoading ? 'Guardando...' : grade ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Section Modal
function SectionModal({ 
  gradeId,
  section,
  onClose, 
  onSubmit, 
  isLoading 
}: { 
  gradeId: string;
  section?: SchoolSection;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(section?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    onSubmit(name.trim());
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
          <h2 className="text-xl font-bold text-gray-900">
            {section ? 'Editar Sección' : 'Agregar Sección'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la sección</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: A, B, C..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              maxLength={10}
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
              {isLoading ? 'Guardando...' : section ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
