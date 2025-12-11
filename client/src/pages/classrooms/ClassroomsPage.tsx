import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Copy, Check, Trash2, X, GraduationCap, Sparkles } from 'lucide-react';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { getMySchools } from '../../api/schoolApi';
import { useOnboardingStore } from '../../store/onboardingStore';
import toast from 'react-hot-toast';

export const ClassroomsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(null);
  
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
          <button 
            onClick={() => setShowCreateModal(true)}
            data-onboarding="create-class-btn"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
          >
            <Plus size={18} />
            Nueva Clase
          </button>
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
  onView,
}: {
  classroom: Classroom;
  index: number;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
  onDelete: (id: string) => void;
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(classroom.id);
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
        </button>
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
  onSubmit: (data: { name: string; description?: string; gradeLevel?: string }) => void;
  isLoading: boolean;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description: description || undefined, gradeLevel: gradeLevel || undefined });
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setGradeLevel('');
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
          className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">
              Nueva Clase
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Nombre de la clase
              </label>
              <input
                type="text"
                placeholder="Ej: Matemáticas 3°A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Grado (opcional)
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              >
                {GRADE_LEVELS.map((grade) => (
                  <option key={grade.value} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                placeholder="Describe tu clase..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none placeholder-gray-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-violet-500/25 disabled:opacity-50"
              >
                {isLoading ? 'Creando...' : 'Crear Clase'}
              </button>
            </div>
          </form>
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
