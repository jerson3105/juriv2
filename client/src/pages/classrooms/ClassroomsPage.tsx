import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Copy, Check, Trash2, X, GraduationCap, Sparkles, BookOpen, Layers, Award, ShoppingBag, HelpCircle } from 'lucide-react';
import { classroomApi, type Classroom, type CreateClassroomData } from '../../lib/classroomApi';
import { getMySchools } from '../../api/schoolApi';
import { useOnboardingStore } from '../../store/onboardingStore';
import { AIClassroomWizard } from '../../components/classroom/AIClassroomWizard';
import toast from 'react-hot-toast';

export const ClassroomsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(null);
  const [cloningClassroom, setCloningClassroom] = useState<Classroom | null>(null);
  
  const { isActive, currentStep, nextStep } = useOnboardingStore();

  const { data: classrooms, isLoading, isError } = useQuery({
    queryKey: ['classrooms'],
    queryFn: classroomApi.getMyClassrooms,
  });

  // Verificar si el profesor pertenece a una escuela y sus permisos
  const { data: mySchools = [] } = useQuery({
    queryKey: ['my-schools'],
    queryFn: getMySchools,
  });

  // Si pertenece a alguna escuela, verificar si puede crear clases
  // Un profesor puede crear clases si:
  // 1. No pertenece a ninguna escuela (profesor independiente B2C)
  // 2. Es OWNER o ADMIN de alguna escuela
  // 3. Tiene el permiso canCreateClasses en alguna escuela
  const canCreateClasses = mySchools.length === 0 || mySchools.some(
    s => s.role === 'OWNER' || s.role === 'ADMIN' || s.canCreateClasses
  );

  const createMutation = useMutation({
    mutationFn: classroomApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      setShowCreateModal(false);
      toast.success('¡Clase creada exitosamente!');
      
      // Avanzar al paso final del onboarding si está activo
      if (isActive && currentStep === 2) {
        setTimeout(() => nextStep(), 500);
      }
    },
    onError: () => {
      toast.error('Error al crear la clase');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: classroomApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success('Clase eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la clase');
    },
  });

  const cloneMutation = useMutation({
    mutationFn: ({ classroomId, options }: { classroomId: string; options: Parameters<typeof classroomApi.clone>[1] }) => 
      classroomApi.clone(classroomId, options),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      setCloningClassroom(null);
      toast.success(`¡Aula "${data.classroom.name}" creada exitosamente!`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al clonar el aula');
    },
  });

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Código copiado');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDelete = (classroom: Classroom) => {
    setDeletingClassroom(classroom);
  };

  const confirmDelete = () => {
    if (deletingClassroom) {
      deleteMutation.mutate(deletingClassroom.id);
      setDeletingClassroom(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Mis Clases</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gestiona tus aulas y estudiantes</p>
          </div>
        </div>
        {canCreateClasses && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIWizard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-shadow"
            >
              <Sparkles size={18} />
              Crear con IA
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              data-onboarding="create-class-btn"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
            >
              <Plus size={18} />
              Nueva Clase
            </button>
          </div>
        )}
      </div>

      {/* Lista de clases */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
          <p className="text-red-500 mb-2">Error al cargar las clases</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm text-violet-600 hover:underline"
          >
            Reintentar
          </button>
        </div>
      ) : classrooms?.length === 0 ? (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center">
            <Sparkles size={28} className="text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            No tienes clases aún
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
            Crea tu primera clase para comenzar la aventura
          </p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25"
          >
            <Plus size={18} />
            Crear mi primera clase
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms?.map((classroom, index) => (
            <ClassroomCard
              key={classroom.id}
              classroom={classroom}
              index={index}
              onCopyCode={copyCode}
              copiedCode={copiedCode}
              onDelete={(id) => handleDelete(classrooms?.find(c => c.id === id)!)}
              onClone={(id) => setCloningClassroom(classrooms?.find(c => c.id === id)!)}
              onView={(id) => navigate(`/classroom/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal de crear clase */}
      <CreateClassroomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Modal de crear clase con IA */}
      <AIClassroomWizard
        isOpen={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onSuccess={(classroomId) => {
          navigate(`/classroom/${classroomId}`);
        }}
      />

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {deletingClassroom && (
          <DeleteConfirmModal
            classroomName={deletingClassroom.name}
            onClose={() => setDeletingClassroom(null)}
            onConfirm={confirmDelete}
            isLoading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Modal de clonación de aula */}
      <AnimatePresence>
        {cloningClassroom && (
          <CloneClassroomModal
            classroom={cloningClassroom}
            onClose={() => setCloningClassroom(null)}
            onClone={(options) => cloneMutation.mutate({ classroomId: cloningClassroom.id, options })}
            isLoading={cloneMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Componente de tarjeta de clase
const ClassroomCard = ({
  classroom,
  index,
  onCopyCode,
  copiedCode,
  onDelete,
  onClone,
  onView,
}: {
  classroom: Classroom;
  index: number;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
  onDelete: (id: string) => void;
  onClone: (id: string) => void;
  onView: (id: string) => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => onView(classroom.id)}
      data-onboarding={index === 0 ? 'first-class' : undefined}
      className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 dark:text-white truncate">{classroom.name}</h3>
          <p className="text-xs text-gray-500 truncate">
            {classroom.description || 'Sin descripción'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClone(classroom.id);
            }}
            title="Duplicar aula"
            className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(classroom.id);
            }}
            title="Eliminar aula"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Código de clase */}
      <div 
        className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-100 dark:border-violet-800/50 rounded-xl px-3 py-2.5 mb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] text-violet-500 font-medium">Código de clase</p>
          <p className="text-lg font-mono font-bold text-violet-600">
            {classroom.code}
          </p>
        </div>
        <button
          onClick={() => onCopyCode(classroom.code)}
          className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
        >
          {copiedCode === classroom.code ? (
            <Check size={18} className="text-green-500" />
          ) : (
            <Copy size={18} className="text-violet-400" />
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Users size={14} />
          <span className="text-xs">{classroom.studentCount || 0} estudiantes</span>
        </div>
        <button 
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onView(classroom.id);
          }}
          className="text-xs text-violet-500 hover:text-violet-600 font-medium"
        >
          Ver detalles →
        </button>
      </div>
    </motion.div>
  );
};

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

// Modal de crear clase
const CreateClassroomModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateClassroomData) => void;
  isLoading: boolean;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [useCompetencies, setUseCompetencies] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [gradeScaleType, setGradeScaleType] = useState<'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS'>('PERU_LETTERS');

  // Cargar áreas curriculares
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: useCompetencies,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ 
      name, 
      description: description || undefined, 
      gradeLevel: gradeLevel || undefined,
      useCompetencies,
      curriculumAreaId: useCompetencies ? selectedAreaId || null : null,
      gradeScaleType: useCompetencies ? gradeScaleType : null,
    });
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setGradeLevel('');
    setUseCompetencies(false);
    setSelectedAreaId('');
    setGradeScaleType('PERU_LETTERS');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col md:flex-row"
        >
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-2/5 relative overflow-hidden">
            <motion.img
              src="/assets/mascot/jiro-crearclase.jpg"
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Panel derecho - Formulario */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Nueva Clase
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nombre de la clase
                </label>
                <input
                  type="text"
                  placeholder="Ej: Matemáticas 3°A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Grado (opcional)
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              >
                {GRADE_LEVELS.map((grade) => (
                  <option key={grade.value} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                placeholder="Describe tu clase..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                rows={2}
              />
            </div>

            {/* Toggle de Competencias */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-violet-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Usar Competencias</p>
                    <p className="text-xs text-gray-500">Habilita calificaciones por competencias</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseCompetencies(!useCompetencies)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    useCompetencies ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      useCompetencies ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Opciones de Competencias */}
              <AnimatePresence>
                {useCompetencies && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3 p-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Área Curricular
                        </label>
                        <select
                          value={selectedAreaId}
                          onChange={(e) => setSelectedAreaId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        >
                          <option value="">Selecciona un área...</option>
                          {curriculumAreas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name} ({area.competencies.length} competencias)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Sistema de Calificación
                        </label>
                        <select
                          value={gradeScaleType}
                          onChange={(e) => setGradeScaleType(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        >
                          <option value="PERU_LETTERS">Perú - Letras (AD, A, B, C)</option>
                          <option value="PERU_VIGESIMAL">Perú - Vigesimal (0-20)</option>
                        </select>
                      </div>

                      <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg flex items-center gap-2">
                        <span>🇵🇪</span>
                        <span>Por el momento solo están disponibles las competencias del currículo de Perú.</span>
                      </div>

                      {selectedAreaId && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                          <p className="font-medium text-violet-400 mb-1">Competencias incluidas:</p>
                          <ul className="space-y-0.5">
                            {curriculumAreas
                              .find(a => a.id === selectedAreaId)
                              ?.competencies.map((c, i) => (
                                <li key={c.id} className="truncate" title={c.name}>
                                  {i + 1}. {c.name}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isLoading || (useCompetencies && !selectedAreaId)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-violet-500/25 disabled:opacity-50"
              >
                {isLoading ? 'Creando...' : 'Crear Clase'}
              </button>
            </div>
          </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal de confirmación de eliminación
const DeleteConfirmModal = ({
  classroomName,
  onClose,
  onConfirm,
  isLoading,
}: {
  classroomName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) => {
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Eliminar Clase</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-center">
            ¿Estás seguro de que deseas eliminar la clase <strong className="text-gray-900 dark:text-white">"{classroomName}"</strong>?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
            Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a esta clase.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            <Trash2 className="w-4 h-4" />
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Modal de clonación de aula
const CloneClassroomModal = ({
  classroom,
  onClose,
  onClone,
  isLoading,
}: {
  classroom: Classroom;
  onClose: () => void;
  onClone: (options: {
    name: string;
    description?: string;
    copyBehaviors: boolean;
    copyBadges: boolean;
    copyShopItems: boolean;
    copyQuestionBanks: boolean;
  }) => void;
  isLoading: boolean;
}) => {
  const [name, setName] = useState(`${classroom.name} (Copia)`);

  // Obtener cantidades de elementos clonables
  const { data: counts } = useQuery({
    queryKey: ['cloneable-counts', classroom.id],
    queryFn: () => classroomApi.getCloneableCounts(classroom.id),
  });
  const [description, setDescription] = useState(classroom.description || '');
  const [copyBehaviors, setCopyBehaviors] = useState(true);
  const [copyBadges, setCopyBadges] = useState(true);
  const [copyShopItems, setCopyShopItems] = useState(true);
  const [copyQuestionBanks, setCopyQuestionBanks] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClone({
      name: name.trim(),
      description: description.trim() || undefined,
      copyBehaviors,
      copyBadges,
      copyShopItems,
      copyQuestionBanks,
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Duplicar Aula</h2>
              <p className="text-xs text-gray-500">Crea una copia de "{classroom.name}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre de la nueva aula *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Matemáticas 3°B"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              required
              minLength={2}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu clase..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Info de configuración heredada */}
          {classroom.useCompetencies && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg flex items-center gap-2">
              <BookOpen size={14} />
              <span>Se copiará la configuración de competencias del aula original.</span>
            </div>
          )}

          {/* Checkboxes de qué copiar */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ¿Qué deseas copiar?
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={copyBehaviors}
                onChange={(e) => setCopyBehaviors(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2 flex-1">
                <Award size={18} className="text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Comportamientos
                    {counts && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">{counts.behaviors}</span>}
                  </p>
                  <p className="text-xs text-gray-500">Acciones positivas y negativas configuradas</p>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={copyBadges}
                onChange={(e) => setCopyBadges(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2 flex-1">
                <Award size={18} className="text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Insignias
                    {counts && <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">{counts.badges}</span>}
                  </p>
                  <p className="text-xs text-gray-500">Medallas y reconocimientos</p>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={copyShopItems}
                onChange={(e) => setCopyShopItems(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2 flex-1">
                <ShoppingBag size={18} className="text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Tienda
                    {counts && <span className="ml-2 text-xs font-normal text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{counts.shopItems}</span>}
                  </p>
                  <p className="text-xs text-gray-500">Items y recompensas de la tienda</p>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={copyQuestionBanks}
                onChange={(e) => setCopyQuestionBanks(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex items-center gap-2 flex-1">
                <HelpCircle size={18} className="text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Banco de Preguntas
                    {counts && <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{counts.questionBanks}</span>}
                  </p>
                  <p className="text-xs text-gray-500">Preguntas para torneos y actividades</p>
                </div>
              </div>
            </label>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || name.trim().length < 2}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              <Layers className="w-4 h-4" />
              {isLoading ? 'Creando...' : 'Crear Copia'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
