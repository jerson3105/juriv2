import { useState, useEffect } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Zap, 
  Heart, 
  Coins,
  ShoppingBag,
  MessageSquare,
  Eye,
  Save,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  User,
  UserX,
  Users,
  Flame,
  Plus,
  X,
  Gift,
  BookOpen,
  Printer,
  FileText,
  Loader2,
  Search,
  Swords,
  GripVertical,
  Pencil,
} from 'lucide-react';
import {
  classroomApi,
  type Classroom,
  type Student,
  type UpdateClassroomSettings,
} from '../../lib/classroomApi';
import { characterClassApi, type CharacterClassData } from '../../lib/characterClassApi';
import { studentApi } from '../../lib/studentApi';
import { parentApi } from '../../lib/parentApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';
import { StudentManagementModal } from '../../components/students/StudentManagementModal';
import { } from '../../hooks/useClassroomCompetencies';
import {
  CLASSROOM_SETTINGS_SECTIONS,
  DEFAULT_CLASSROOM_SETTINGS_SECTION,
  isClassroomSettingsSection,
  type ClassroomSettingsSectionKey,
} from './classroomSettingsSections';
import { escapeHtml } from '../../lib/safeHtml';
import { ResetDataModal } from '../../components/classroom/ResetDataModal';

export const ClassroomSettingsPage = () => {
  const { section } = useParams<{ section?: string }>();
  const { classroom, refetch } = useOutletContext<{ classroom: Classroom & { students?: Student[] }; refetch: () => void }>();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showResetData, setShowResetData] = useState(false);
  const [showDemoDeleteConfirm, setShowDemoDeleteConfirm] = useState(false);
  const [showAddPlaceholderModal, setShowAddPlaceholderModal] = useState(false);
  const [generatingFlyers, setGeneratingFlyers] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [managedStudentId, setManagedStudentId] = useState<string | null>(null);
  const [removeStudentConfirm, setRemoveStudentConfirm] = useState<{ id: string; name: string } | null>(null);

  // Estado para clases de personaje
  const [editingClass, setEditingClass] = useState<CharacterClassData | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassKey, setNewClassKey] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassIcon, setNewClassIcon] = useState('⚔️');
  const [newClassColor, setNewClassColor] = useState('blue');

  // Query para clases de personaje
  const { data: characterClasses = [], refetch: refetchClasses } = useQuery({
    queryKey: ['character-classes', classroom.id],
    queryFn: () => characterClassApi.list(classroom.id),
  });



  // Mutations para clases de personaje
  const createClassMutation = useMutation({
    mutationFn: (data: { name: string; key: string; description?: string; icon: string; color: string }) =>
      characterClassApi.create(classroom.id, data),
    onSuccess: () => { refetchClasses(); setShowAddClass(false); resetNewClassForm(); toast.success('Clase creada'); },
    onError: () => toast.error('Error al crear clase'),
  });

  const updateClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; icon?: string; color?: string; isActive?: boolean } }) =>
      characterClassApi.update(classroom.id, id, data),
    onSuccess: () => { refetchClasses(); setEditingClass(null); toast.success('Clase actualizada'); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => characterClassApi.remove(classroom.id, id),
    onSuccess: () => { refetchClasses(); toast.success('Clase eliminada'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error al eliminar'),
  });

  const resetNewClassForm = () => {
    setNewClassName(''); setNewClassKey(''); setNewClassDesc(''); setNewClassIcon('⚔️'); setNewClassColor('blue');
  };

  // Query para estudiantes placeholder
  const { data: placeholderStudents = [] } = useQuery({
    queryKey: ['placeholder-students', classroom.id],
    queryFn: () => placeholderStudentApi.getAll(classroom.id),
  });

  // Función para descargar PDFs
  const downloadAllPDFs = async () => {
    if (placeholderStudents.length === 0) {
      toast.error('No hay estudiantes sin vincular');
      return;
    }
    try {
      await placeholderStudentApi.downloadAllCardsPDF(classroom.id);
      toast.success('PDF descargado');
    } catch {
      toast.error('Error al descargar PDF');
    }
  };
  
  // Estado del formulario
  const [formData, setFormData] = useState<UpdateClassroomSettings>({
    name: '',
    description: '',
    isActive: true,
    defaultXp: 0,
    defaultHp: 100,
    defaultGp: 0,
    maxHp: 100,
    xpPerLevel: 100,
    allowNegativeHp: false,
    allowNegativePoints: true,
    showReasonToStudent: true,
    notifyOnPoints: true,
    shopEnabled: true,
    requirePurchaseApproval: false,
    dailyPurchaseLimit: null,
    classAssignmentMode: 'STUDENT_CHOICE' as const,
    showCharacterName: true,
    // Clanes
    clansEnabled: false,
    clanXpPercentage: 50,
    clanBattlesEnabled: false,
    clanGpRewardEnabled: true,
    // Racha de login
    loginStreakEnabled: false,
    loginStreakConfig: {
      dailyXp: 5,
      milestones: [
        { day: 3, xp: 10, gp: 0, randomItem: false },
        { day: 7, xp: 25, gp: 10, randomItem: false },
        { day: 14, xp: 50, gp: 25, randomItem: false },
        { day: 30, xp: 100, gp: 50, randomItem: true },
      ],
      resetOnMiss: true,
      graceDays: 0,
    },
    useCompetencies: false,
    curriculumAreaId: null,
    gradeScaleType: 'PERU_LETTERS',
  });

  // Cargar datos del classroom
  useEffect(() => {
    if (classroom) {
      setFormData({
        name: classroom.name,
        description: classroom.description || '',
        isActive: classroom.isActive,
        defaultXp: classroom.defaultXp,
        defaultHp: classroom.defaultHp,
        defaultGp: classroom.defaultGp,
        maxHp: classroom.maxHp,
        xpPerLevel: classroom.xpPerLevel ?? 100,
        allowNegativeHp: classroom.allowNegativeHp ?? false,
        allowNegativePoints: classroom.allowNegativePoints ?? true,
        showReasonToStudent: classroom.showReasonToStudent ?? true,
        notifyOnPoints: classroom.notifyOnPoints ?? true,
        shopEnabled: classroom.shopEnabled ?? true,
        requirePurchaseApproval: classroom.requirePurchaseApproval ?? false,
        dailyPurchaseLimit: classroom.dailyPurchaseLimit ?? null,
        classAssignmentMode: (classroom as any).classAssignmentMode ?? 'STUDENT_CHOICE',
        showCharacterName: classroom.showCharacterName ?? true,
        // Clanes
        clansEnabled: classroom.clansEnabled ?? false,
        clanXpPercentage: classroom.clanXpPercentage ?? 50,
        clanBattlesEnabled: classroom.clanBattlesEnabled ?? false,
        clanGpRewardEnabled: classroom.clanGpRewardEnabled ?? true,
        // Racha de login
        loginStreakEnabled: classroom.loginStreakEnabled ?? false,
        loginStreakConfig: classroom.loginStreakConfig ?? {
          dailyXp: 5,
          milestones: [
            { day: 3, xp: 10, gp: 0, randomItem: false },
            { day: 7, xp: 25, gp: 10, randomItem: false },
            { day: 14, xp: 50, gp: 25, randomItem: false },
            { day: 30, xp: 100, gp: 50, randomItem: true },
          ],
          resetOnMiss: true,
          graceDays: 0,
        },
        useCompetencies: classroom.useCompetencies ?? false,
        curriculumAreaId: classroom.curriculumAreaId ?? null,
        gradeScaleType: classroom.gradeScaleType ?? 'PERU_LETTERS',
      });
    }
  }, [classroom]);

  // Mutation para actualizar
  const updateMutation = useMutation({
    mutationFn: (data: UpdateClassroomSettings) => classroomApi.update(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['student-grades'] });
      refetch();
      toast.success('Configuración guardada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al guardar');
    },
  });

  // Mutation para eliminar
  const deleteMutation = useMutation({
    mutationFn: () => classroomApi.delete(classroom.id),
    onSuccess: () => {
      toast.success('Clase eliminada');
      window.location.href = '/dashboard';
    },
    onError: () => toast.error('Error al eliminar'),
  });


  // Query para verificar si hay estudiante demo
  const { data: hasDemoStudent, refetch: refetchDemo } = useQuery({
    queryKey: ['demoStudent', classroom.id],
    queryFn: () => studentApi.hasDemoStudent(classroom.id),
  });

  // Mutation para eliminar estudiante demo
  const deleteDemoMutation = useMutation({
    mutationFn: () => studentApi.deleteDemoStudent(classroom.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['demoStudent', classroom.id] });
      refetch();
      refetchDemo();
      toast.success('Estudiante demo eliminado');
    },
    onError: () => toast.error('Error al eliminar estudiante demo'),
  });

  // Mutation para retirar estudiante de la clase
  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => studentApi.removeFromClass(studentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['students', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroom.id] });
      refetch();
      toast.success(`${data.studentName} ha sido retirado de la clase`);
      setRemoveStudentConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al retirar estudiante');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(classroom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (deleteConfirmText === classroom.name) {
      deleteMutation.mutate();
    }
  };

  const classroomStudents = (classroom.students || []).filter((student) => !student.isDemo);
  const managedStudent = managedStudentId
    ? classroomStudents.find((student) => student.id === managedStudentId) || null
    : null;

  const getRealStudentName = (student: Student) => [student.realName, student.realLastName].filter(Boolean).join(' ').trim();

  const getStudentStatusLabel = (student: Student) => {
    if (student.isDemo) return 'Demo';
    if (student.linkCode) return 'Sin vincular';
    return 'Vinculado';
  };

  const getStudentStatusClassName = (student: Student) => {
    if (student.isDemo) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
    }

    if (student.linkCode) {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }

    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  };

  const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-violet-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );

  const currentSectionKey: ClassroomSettingsSectionKey = isClassroomSettingsSection(section)
    ? section
    : DEFAULT_CLASSROOM_SETTINGS_SECTION;
  const currentSection = CLASSROOM_SETTINGS_SECTIONS.find((item) => item.key === currentSectionKey)
    || CLASSROOM_SETTINGS_SECTIONS[0];

  if (section && !isClassroomSettingsSection(section)) {
    return <Navigate to={`/classroom/${classroom.id}/settings/${DEFAULT_CLASSROOM_SETTINGS_SECTION}`} replace />;
  }

  const renderGeneralSection = () => (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/50 rounded-lg flex items-center justify-center">
              <Settings size={16} className="text-violet-600" />
            </div>
            General
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre de la clase</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
                placeholder="Descripción opcional..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Código de acceso</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-mono text-gray-700 dark:text-gray-200">
                  {classroom.code}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                >
                  {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Clase activa</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Los estudiantes pueden acceder</p>
              </div>
              <Toggle
                checked={formData.isActive ?? true}
                onChange={(v) => setFormData({ ...formData, isActive: v })}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900/50 rounded-lg flex items-center justify-center">
              <Eye size={16} className="text-pink-600" />
            </div>
            Visualización
          </h2>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Mostrar nombre como</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <input
                    type="radio"
                    name="showCharacterName"
                    checked={formData.showCharacterName === true}
                    onChange={() => setFormData({ ...formData, showCharacterName: true })}
                    className="w-4 h-4 text-violet-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧙</span>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre de personaje</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ej: "Gandalf el Sabio"</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <input
                    type="radio"
                    name="showCharacterName"
                    checked={formData.showCharacterName === false}
                    onChange={() => setFormData({ ...formData, showCharacterName: false })}
                    className="w-4 h-4 text-violet-500"
                  />
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre real</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ej: "Juan Pérez"</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );

  const renderGamificationSection = () => (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-emerald-600" />
            </div>
            Sistema de Puntos
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Zap size={12} className="text-emerald-500" /> XP inicial</span>
              </label>
              <input
                type="number"
                min={0}
                value={formData.defaultXp}
                onChange={(e) => setFormData({ ...formData, defaultXp: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Heart size={12} className="text-red-500" /> HP inicial</span>
              </label>
              <input
                type="number"
                min={0}
                value={formData.defaultHp}
                onChange={(e) => setFormData({ ...formData, defaultHp: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Coins size={12} className="text-amber-500" /> GP inicial</span>
              </label>
              <input
                type="number"
                min={0}
                value={formData.defaultGp}
                onChange={(e) => setFormData({ ...formData, defaultGp: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Heart size={12} className="text-red-500" /> HP máximo</span>
              </label>
              <input
                type="number"
                min={1}
                value={formData.maxHp}
                onChange={(e) => setFormData({ ...formData, maxHp: parseInt(e.target.value) || 100 })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">XP por nivel</label>
              <input
                type="number"
                min={1}
                value={formData.xpPerLevel}
                onChange={(e) => setFormData({ ...formData, xpPerLevel: parseInt(e.target.value) || 100 })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Permitir HP negativo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Los estudiantes pueden tener HP menor a 0</p>
              </div>
              <Toggle
                checked={formData.allowNegativeHp ?? false}
                onChange={(v) => setFormData({ ...formData, allowNegativeHp: v })}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
              <MessageSquare size={16} className="text-blue-600" />
            </div>
            Comportamientos
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Permitir puntos negativos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Habilitar comportamientos que restan puntos</p>
              </div>
              <Toggle
                checked={formData.allowNegativePoints ?? true}
                onChange={(v) => setFormData({ ...formData, allowNegativePoints: v })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Mostrar razón al estudiante</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">El estudiante ve por qué recibió puntos</p>
              </div>
              <Toggle
                checked={formData.showReasonToStudent ?? true}
                onChange={(v) => setFormData({ ...formData, showReasonToStudent: v })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Notificar al recibir puntos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mostrar notificación cuando recibe puntos</p>
              </div>
              <Toggle
                checked={formData.notifyOnPoints ?? true}
                onChange={(v) => setFormData({ ...formData, notifyOnPoints: v })}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
              <ShoppingBag size={16} className="text-amber-600" />
            </div>
            Tienda
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Tienda habilitada</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Los estudiantes pueden comprar items</p>
              </div>
              <Toggle
                checked={formData.shopEnabled ?? true}
                onChange={(v) => setFormData({ ...formData, shopEnabled: v })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Requerir aprobación</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Las compras necesitan tu aprobación</p>
              </div>
              <Toggle
                checked={formData.requirePurchaseApproval ?? false}
                onChange={(v) => setFormData({ ...formData, requirePurchaseApproval: v })}
                disabled={!formData.shopEnabled}
              />
            </div>

            <div className="py-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Límite de compras diarias</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dejar vacío para sin límite</p>
              <input
                type="number"
                min={0}
                value={formData.dailyPurchaseLimit ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  dailyPurchaseLimit: e.target.value ? parseInt(e.target.value) : null,
                })}
                disabled={!formData.shopEnabled}
                placeholder="Sin límite"
                className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
              <Swords size={16} className="text-indigo-600" />
            </div>
            Clases de Personaje
          </h2>

          <div className="space-y-3">
            <div className="py-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Modo de asignación</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'STUDENT_CHOICE' as const, label: 'El estudiante elige', icon: '🎯' },
                  { value: 'TEACHER_ASSIGNS' as const, label: 'El profesor asigna', icon: '👨‍🏫' },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setFormData({ ...formData, classAssignmentMode: mode.value })}
                    className={`p-3 rounded-xl text-left transition-all text-sm ${
                      formData.classAssignmentMode === mode.value
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span className="text-lg block mb-1">{mode.icon}</span>
                    <span className="font-medium">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Clases disponibles</p>
              <div className="space-y-2">
                {characterClasses.map((cc) => (
                  <div key={cc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    cc.isActive
                      ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      : 'bg-gray-100/50 dark:bg-gray-800/50 border-gray-200/50 dark:border-gray-700/50 opacity-60'
                  }`}>
                    <GripVertical size={14} className="text-gray-400 flex-shrink-0 cursor-grab" />
                    <span className="text-xl flex-shrink-0">{cc.icon}</span>
                    {editingClass?.id === cc.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          value={editingClass.name}
                          onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                          value={editingClass.description || ''}
                          onChange={(e) => setEditingClass({ ...editingClass, description: e.target.value })}
                          placeholder="Descripción"
                          className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <EmojiPicker
                            value={editingClass.icon}
                            onChange={(emoji) => setEditingClass({ ...editingClass, icon: emoji })}
                          />
                          <select
                            value={editingClass.color}
                            onChange={(e) => setEditingClass({ ...editingClass, color: e.target.value })}
                            className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-xs outline-none"
                          >
                            {['blue', 'violet', 'green', 'orange', 'red', 'cyan', 'pink', 'amber', 'emerald', 'indigo', 'rose', 'teal'].map((c) => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateClassMutation.mutate({ id: cc.id, data: { name: editingClass.name, description: editingClass.description || undefined, icon: editingClass.icon, color: editingClass.color } })}
                            className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingClass(null)}
                            className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{cc.name}</p>
                          {cc.description && <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{cc.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateClassMutation.mutate({ id: cc.id, data: { isActive: !cc.isActive } })}
                            className={`p-1.5 rounded-lg transition-all ${cc.isActive ? 'bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'}`}
                            title={cc.isActive ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'}
                          >
                            {cc.isActive ? <Check size={14} /> : <X size={14} />}
                          </button>
                          <button
                            onClick={() => setEditingClass(cc)}
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteClassMutation.mutate(cc.id)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {showAddClass ? (
                <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newClassName}
                      onChange={(e) => {
                        setNewClassName(e.target.value);
                        if (!newClassKey || newClassKey === newClassName.toUpperCase().replace(/\s+/g, '_')) {
                          setNewClassKey(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                        }
                      }}
                      placeholder="Nombre"
                      className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <input
                      value={newClassKey}
                      onChange={(e) => setNewClassKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      placeholder="Clave (ej. WARRIOR)"
                      className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <input
                    value={newClassDesc}
                    onChange={(e) => setNewClassDesc(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <EmojiPicker
                      value={newClassIcon}
                      onChange={(emoji) => setNewClassIcon(emoji)}
                    />
                    <select
                      value={newClassColor}
                      onChange={(e) => setNewClassColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-xs outline-none"
                    >
                      {['blue', 'violet', 'green', 'orange', 'red', 'cyan', 'pink', 'amber', 'emerald', 'indigo', 'rose', 'teal'].map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newClassName.trim() || !newClassKey.trim()) { toast.error('Nombre y clave requeridos'); return; }
                        createClassMutation.mutate({ name: newClassName, key: newClassKey, description: newClassDesc || undefined, icon: newClassIcon, color: newClassColor });
                      }}
                      disabled={createClassMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                      {createClassMutation.isPending ? 'Creando...' : 'Crear clase'}
                    </button>
                    <button
                      onClick={() => { setShowAddClass(false); resetNewClassForm(); }}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddClass(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-dashed border-indigo-300 dark:border-indigo-700"
                >
                  <Plus size={16} /> Añadir clase
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/50 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-violet-600" />
            </div>
            Sistema de Clanes
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Habilitar clanes</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Permite crear equipos/clanes</p>
              </div>
              <Toggle
                checked={formData.clansEnabled ?? false}
                onChange={(v) => setFormData({ ...formData, clansEnabled: v })}
              />
            </div>

            {formData.clansEnabled && (
              <>
                <div className="py-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    % XP que va al clan
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Porcentaje del XP ganado que se suma al clan
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={formData.clanXpPercentage ?? 50}
                      onChange={(e) => setFormData({
                        ...formData,
                        clanXpPercentage: parseInt(e.target.value),
                      })}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <span className="text-sm font-medium text-violet-600 w-12 text-right">
                      {formData.clanXpPercentage ?? 50}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Batallas de clan</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Clanes vs Boss en lugar de individual</p>
                  </div>
                  <Toggle
                    checked={formData.clanBattlesEnabled ?? false}
                    onChange={(v) => setFormData({ ...formData, clanBattlesEnabled: v })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">GP para todos al ganar</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Todos los miembros reciben GP en victorias</p>
                  </div>
                  <Toggle
                    checked={formData.clanGpRewardEnabled ?? true}
                    onChange={(v) => setFormData({ ...formData, clanGpRewardEnabled: v })}
                  />
                </div>
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
              <Flame size={16} className="text-orange-600" />
            </div>
            Racha de Login
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Habilitar racha de login</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recompensa a estudiantes por conectarse diariamente</p>
              </div>
              <Toggle
                checked={formData.loginStreakEnabled ?? false}
                onChange={(v) => setFormData({ ...formData, loginStreakEnabled: v })}
              />
            </div>

            {formData.loginStreakEnabled && formData.loginStreakConfig && (
              <>
                <div className="py-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    XP diario por login
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    XP que recibe el estudiante cada día que se conecta
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={formData.loginStreakConfig?.dailyXp}
                    onChange={(e) => setFormData({
                      ...formData,
                      loginStreakConfig: {
                        ...formData.loginStreakConfig!,
                        dailyXp: parseInt(e.target.value) || 0,
                      },
                    })}
                    className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="py-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Días de gracia
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Días que puede faltar sin perder la racha
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={formData.loginStreakConfig?.graceDays}
                    onChange={(e) => setFormData({
                      ...formData,
                      loginStreakConfig: {
                        ...formData.loginStreakConfig!,
                        graceDays: parseInt(e.target.value) || 0,
                      },
                    })}
                    className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Reiniciar al perder día</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">La racha vuelve a 0 si pierde un día</p>
                  </div>
                  <Toggle
                    checked={formData.loginStreakConfig?.resetOnMiss}
                    onChange={(v) => setFormData({
                      ...formData,
                      loginStreakConfig: {
                        ...formData.loginStreakConfig!,
                        resetOnMiss: v,
                      },
                    })}
                  />
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Milestones</p>
                    <button
                      type="button"
                      onClick={() => {
                        const milestones = formData.loginStreakConfig!.milestones || [];
                        const lastDay = milestones.length > 0 ? Math.max(...milestones.map(m => m.day)) : 0;
                        setFormData({
                          ...formData,
                          loginStreakConfig: {
                            ...formData.loginStreakConfig!,
                            milestones: [
                              ...milestones,
                              { day: lastDay + 7, xp: 50, gp: 25, randomItem: false },
                            ],
                          },
                        });
                      }}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                    >
                      <Plus size={14} />
                      Agregar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(formData.loginStreakConfig.milestones || [])
                      .sort((a, b) => a.day - b.day)
                      .map((milestone, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1 grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400">Día</label>
                              <input
                                type="number"
                                min={1}
                                value={milestone.day}
                                onChange={(e) => {
                                  const newMilestones = [...formData.loginStreakConfig!.milestones];
                                  newMilestones[index] = { ...milestone, day: parseInt(e.target.value) || 1 };
                                  setFormData({
                                    ...formData,
                                    loginStreakConfig: {
                                      ...formData.loginStreakConfig!,
                                      milestones: newMilestones,
                                    },
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400">XP</label>
                              <input
                                type="number"
                                min={0}
                                value={milestone.xp}
                                onChange={(e) => {
                                  const newMilestones = [...formData.loginStreakConfig!.milestones];
                                  newMilestones[index] = { ...milestone, xp: parseInt(e.target.value) || 0 };
                                  setFormData({
                                    ...formData,
                                    loginStreakConfig: {
                                      ...formData.loginStreakConfig!,
                                      milestones: newMilestones,
                                    },
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400">GP</label>
                              <input
                                type="number"
                                min={0}
                                value={milestone.gp}
                                onChange={(e) => {
                                  const newMilestones = [...formData.loginStreakConfig!.milestones];
                                  newMilestones[index] = { ...milestone, gp: parseInt(e.target.value) || 0 };
                                  setFormData({
                                    ...formData,
                                    loginStreakConfig: {
                                      ...formData.loginStreakConfig!,
                                      milestones: newMilestones,
                                    },
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded"
                              />
                            </div>
                            <div className="flex items-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const newMilestones = [...formData.loginStreakConfig!.milestones];
                                  newMilestones[index] = { ...milestone, randomItem: !milestone.randomItem };
                                  setFormData({
                                    ...formData,
                                    loginStreakConfig: {
                                      ...formData.loginStreakConfig!,
                                      milestones: newMilestones,
                                    },
                                  });
                                }}
                                className={`p-1.5 rounded ${milestone.randomItem ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-400'}`}
                                title="Item aleatorio"
                              >
                                <Gift size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newMilestones = formData.loginStreakConfig!.milestones.filter((_, i) => i !== index);
                                  setFormData({
                                    ...formData,
                                    loginStreakConfig: {
                                      ...formData.loginStreakConfig!,
                                      milestones: newMilestones,
                                    },
                                  });
                                }}
                                className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );

  // Competencias, destrezas, escala y bimestres se configuran en Calificaciones → Competencias.
  const renderClassSection = () => (
    <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
        <BookOpen size={18} aria-hidden="true" /> Calificaciones por competencias
      </h2>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {classroom.useCompetencies && classroom.curriculumAreaId
          ? 'Las competencias, destrezas, la escala de notas y las fechas de los bimestres ahora se configuran dentro de Calificaciones, en la pestaña Competencias.'
          : 'Activa las calificaciones por competencias: eliges el área curricular y la escala, y ya puedes poner notas.'}
      </p>
      <Link
        to={`/classroom/${classroom.id}/gradebook${classroom.useCompetencies && classroom.curriculumAreaId ? '?tab=competencias' : ''}`}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700"
      >
        {classroom.useCompetencies && classroom.curriculumAreaId ? 'Ir a Competencias' : 'Activar calificaciones'}
      </Link>
    </div>
  );

  const renderPeopleSection = () => (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
      >
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Users size={16} className="text-white" />
          </div>
          Gestión de Estudiantes
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Añade estudiantes sin cuenta o gestiona los existentes.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddPlaceholderModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <Plus size={16} />
              Añadir estudiantes sin cuenta
            </button>

            {placeholderStudents.length > 0 && (
              <button
                onClick={downloadAllPDFs}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <Copy size={16} />
                Descargar tarjetas PDF
                <span className="text-xs bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded-full">
                  {placeholderStudents.length}
                </span>
              </button>
            )}
          </div>

          {placeholderStudents.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tienes {placeholderStudents.length} estudiante{placeholderStudents.length !== 1 ? 's' : ''} sin vincular
            </p>
          )}

          {classroomStudents.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estudiantes en la clase ({classroomStudents.length})
                </p>
              </div>

              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Buscar estudiante..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {classroomStudents
                  .filter((student) => {
                    if (!studentSearch.trim()) return true;
                    const search = studentSearch.toLowerCase();
                    const name = (student.characterName || student.displayName || '').toLowerCase();
                    const realName = getRealStudentName(student).toLowerCase();
                    return name.includes(search) || realName.includes(search);
                  })
                  .map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                          student.characterClass === 'GUARDIAN' ? 'bg-blue-500' :
                          student.characterClass === 'ARCANE' ? 'bg-purple-500' :
                          student.characterClass === 'EXPLORER' ? 'bg-green-500' :
                          'bg-orange-500'
                        }`}>
                          {(student.characterName || student.displayName || '?')[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {student.characterName || student.displayName || 'Sin nombre'}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStudentStatusClassName(student)}`}>
                              {getStudentStatusLabel(student)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {getRealStudentName(student) || 'Sin nombre real registrado'}
                            {student.linkedEmail ? ` · ${student.linkedEmail}` : ''}
                            {' · '}Nv.{student.level} · ⚡{student.xp} XP
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setManagedStudentId(student.id)}
                          className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          title="Editar información"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setRemoveStudentConfirm({
                            id: student.id,
                            name: student.characterName || student.displayName || student.realName || 'Estudiante',
                          })}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Retirar de la clase"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
      >
        <h2 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          Folletos para Padres
        </h2>

        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Genera folletos individuales con el código de vinculación de cada estudiante para repartir a los padres de familia.
          </p>

          <button
            onClick={async () => {
              setGeneratingFlyers(true);
              try {
                const data = await parentApi.generateBulkParentLinkCodes(classroom.id);
                if (data.students.length === 0) {
                  toast.error('No hay estudiantes activos en la clase');
                  return;
                }
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                  toast.error('Permite las ventanas emergentes para imprimir');
                  return;
                }
                printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Folletos para Padres - ${escapeHtml(data.classroomName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; }
    .page { page-break-after: always; padding: 10mm; }
    .page:last-child { page-break-after: auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; height: calc(297mm - 20mm); }
    .flyer {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 6mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: white;
    }
    .flyer-logo { font-size: 28px; font-weight: 700; color: #6366f1; margin-bottom: 4mm; }
    .flyer-class { font-size: 11px; color: #64748b; margin-bottom: 5mm; background: #f1f5f9; padding: 3px 10px; border-radius: 20px; }
    .flyer-student { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 2mm; }
    .flyer-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2mm; margin-top: 4mm; }
    .flyer-code {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #6366f1;
      background: #eef2ff;
      padding: 4mm 8mm;
      border-radius: 10px;
      margin: 3mm 0;
      font-family: monospace;
    }
    .flyer-instructions {
      font-size: 9px;
      color: #64748b;
      line-height: 1.5;
      margin-top: 4mm;
      max-width: 90%;
    }
    .flyer-instructions ol { padding-left: 14px; text-align: left; }
    .flyer-url { font-size: 10px; color: #6366f1; font-weight: 600; margin-top: 2mm; }
    .scissors { text-align: center; color: #cbd5e1; font-size: 10px; margin: 2mm 0; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page { padding: 8mm; }
      .flyer { border: 1.5px dashed #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#6366f1;color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <strong>${escapeHtml(data.classroomName)}</strong> — ${data.students.length} folletos generados
    </div>
    <button onclick="window.print()" style="background:white;color:#6366f1;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">
      \u{1F5A8} Imprimir folletos
    </button>
  </div>
${(() => {
  const pages = [];
  for (let i = 0; i < data.students.length; i += 4) {
    const batch = data.students.slice(i, i + 4);
    const flyers = batch.map(s => `
      <div class="flyer">
        <div class="flyer-logo">Juried</div>
        <div class="flyer-class">${escapeHtml(data.classroomName)}</div>
        <div class="flyer-student">${escapeHtml(s.name)}</div>
        <div class="flyer-label">Código de vinculación para padres</div>
        <div class="flyer-code">${escapeHtml(s.parentLinkCode)}</div>
        <div class="flyer-instructions">
          <ol>
            <li>Ingrese a <strong>www.plataformajuried.com</strong> y regístrese como <strong>Padre/Madre</strong></li>
            <li>Ingrese el código de arriba para vincular a su hijo/a</li>
            <li>Podrá ver el progreso, calificaciones y actividad de su hijo/a</li>
          </ol>
        </div>
        <div class="flyer-url">www.plataformajuried.com</div>
      </div>
    `).join('');
    const empty = Array(4 - batch.length).fill('<div class="flyer" style="border-color:transparent;"></div>').join('');
    pages.push('<div class="page"><div class="grid">' + flyers + empty + '</div></div>');
  }
  return pages.join('');
})()}
</body>
</html>`);
                printWindow.document.close();
                toast.success(`${data.students.length} folletos generados`);
              } catch {
                toast.error('Error al generar folletos');
              } finally {
                setGeneratingFlyers(false);
              }
            }}
            disabled={generatingFlyers}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50"
          >
            {generatingFlyers ? (
              <><Loader2 size={16} className="animate-spin" /> Generando...</>
            ) : (
              <><Printer size={16} /> Obtener folletos individuales</>
            )}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Se generarán folletos imprimibles con 4 por página. Los códigos existentes se mantienen.
          </p>
        </div>
      </motion.div>
    </div>
  );

  const renderRiskSection = () => (
    <div className="max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-5"
      >
        <h2 className="font-semibold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          Zona de peligro
        </h2>

        <div className="space-y-3">
          {hasDemoStudent && (
            <button
              onClick={() => setShowDemoDeleteConfirm(true)}
              disabled={deleteDemoMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 text-amber-600 rounded-xl text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
            >
              <UserX size={16} className={deleteDemoMutation.isPending ? 'animate-pulse' : ''} />
              {deleteDemoMutation.isPending ? 'Eliminando...' : 'Eliminar estudiante demo'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowResetData(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Borrar datos de la clase…
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
          >
            <Trash2 size={16} />
            Eliminar clase
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (currentSectionKey) {
      case 'general':
        return renderGeneralSection();
      case 'gamificacion':
        return renderGamificationSection();
      case 'clase':
        return renderClassSection();
      case 'personas':
        return renderPeopleSection();
      case 'riesgo':
        return renderRiskSection();
      default:
        return renderGeneralSection();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">{currentSection.title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{currentSection.description}</p>
          </div>
        </div>

        {currentSection.showsSaveAction && (
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50"
          >
            <Save size={16} />
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 p-2 backdrop-blur-sm">
        {CLASSROOM_SETTINGS_SECTIONS.map((item) => {
          const isActiveSection = item.key === currentSectionKey;

          return (
            <Link
              key={item.key}
              to={`/classroom/${classroom.id}/settings/${item.key}`}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActiveSection
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {renderCurrentSection()}

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800"
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">¿Eliminar clase?</h3>
              <p className="text-sm text-gray-400">
                Esta acción no se puede deshacer. Se eliminarán todos los estudiantes, puntos e historial.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">
                Escribe "<span className="text-red-400 font-medium">{classroom.name}</span>" para confirmar
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder={classroom.name}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== classroom.name || deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showResetData && <ResetDataModal classroom={classroom} onClose={() => setShowResetData(false)} />}

      {/* Modal de confirmación para eliminar estudiante demo */}      {/* Modal de confirmación para eliminar estudiante demo */}
      <ConfirmModal
        isOpen={showDemoDeleteConfirm}
        onClose={() => setShowDemoDeleteConfirm(false)}
        onConfirm={() => {
          deleteDemoMutation.mutate();
          setShowDemoDeleteConfirm(false);
        }}
        title="¿Eliminar estudiante demo?"
        message="Se eliminará el estudiante demo y toda su información. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="warning"
        isLoading={deleteDemoMutation.isPending}
      />

      {/* Modal para añadir estudiantes placeholder */}
      <AddPlaceholderStudentsModal
        isOpen={showAddPlaceholderModal}
        onClose={() => setShowAddPlaceholderModal(false)}
        classroomId={classroom.id}
        onStudentsCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroom.id] });
        }}
      />

      <StudentManagementModal
        isOpen={!!managedStudent}
        onClose={() => setManagedStudentId(null)}
        classroomId={classroom.id}
        student={managedStudent}
      />

      {/* Modal de confirmación para retirar estudiante */}
      {removeStudentConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-800"
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-red-500/20 rounded-2xl flex items-center justify-center">
                <UserX size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                ¿Retirar a "{removeStudentConfirm.name}"?
              </h3>
              <p className="text-sm text-gray-400 mb-3">
                Se eliminará permanentemente de esta clase:
              </p>
              <div className="text-left text-xs text-gray-500 space-y-1 bg-gray-800/50 rounded-xl p-3">
                <p>• Su perfil y progreso en esta clase</p>
                <p>• Puntos (XP, HP, GP) e historial</p>
                <p>• Insignias y logros ganados</p>
                <p>• Compras y uso de items</p>
                <p>• Asistencia y rachas</p>
                <p>• Progreso en actividades</p>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Si tiene cuenta vinculada, podrá volver a unirse con el código de clase.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRemoveStudentConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => removeStudentMutation.mutate(removeStudentConfirm.id)}
                disabled={removeStudentMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {removeStudentMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Retirando...</>
                ) : (
                  <><UserX size={14} /> Retirar estudiante</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
