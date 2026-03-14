import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  Award,
  Printer,
  FileText,
  Loader2,
  Search,
} from 'lucide-react';
import { classroomApi, type Classroom, type UpdateClassroomSettings } from '../../lib/classroomApi';
import { studentApi } from '../../lib/studentApi';
import { parentApi } from '../../lib/parentApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';

export const ClassroomSettingsPage = () => {
  const { classroom, refetch } = useOutletContext<{ classroom: Classroom; refetch: () => void }>();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showDemoDeleteConfirm, setShowDemoDeleteConfirm] = useState(false);
  const [showAddPlaceholderModal, setShowAddPlaceholderModal] = useState(false);
  const [generatingFlyers, setGeneratingFlyers] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [removeStudentConfirm, setRemoveStudentConfirm] = useState<{ id: string; name: string } | null>(null);

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
      });
    }
  }, [classroom]);

  // Mutation para actualizar
  const updateMutation = useMutation({
    mutationFn: (data: UpdateClassroomSettings) => classroomApi.update(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
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

  // Mutation para resetear clase completa
  const resetPointsMutation = useMutation({
    mutationFn: () => classroomApi.resetClassroomSelective(classroom.id, {
      points: true,
      history: true,
      purchases: true,
      badges: true,
      attendance: true,
      streaks: true,
      clans: true,
      scrolls: true,
      powerUsages: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['students', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['history', classroom.id] });
      refetch();
      toast.success('Clase reseteada a cero correctamente');
    },
    onError: () => toast.error('Error al resetear la clase'),
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Configuración</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ajustes de la clase</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50"
        >
          <Save size={16} />
          {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sección 1: General */}
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

          {/* Sección 2: Sistema de Puntos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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

          {/* Sección 3: Comportamientos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
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

          {/* Sección 4: Tienda */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                    dailyPurchaseLimit: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  disabled={!formData.shopEnabled}
                  placeholder="Sin límite"
                  className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          {/* Visualización */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
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

          {/* Sección: Clanes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
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
                          clanXpPercentage: parseInt(e.target.value) 
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

          {/* Sección: Racha de Login */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
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
                          dailyXp: parseInt(e.target.value) || 0
                        }
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
                          graceDays: parseInt(e.target.value) || 0
                        }
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
                          resetOnMiss: v
                        }
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
                                { day: lastDay + 7, xp: 50, gp: 25, randomItem: false }
                              ]
                            }
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
                                      milestones: newMilestones
                                    }
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
                                      milestones: newMilestones
                                    }
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
                                      milestones: newMilestones
                                    }
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
                                      milestones: newMilestones
                                    }
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
                                      milestones: newMilestones
                                    }
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

          {/* Sección de Competencias - Solo si está habilitado */}
          {classroom.useCompetencies && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <BookOpen size={16} className="text-white" />
                </div>
                Sistema de Calificaciones por Competencias
              </h2>
              
              <div className="space-y-4">
                {/* Info del área curricular */}
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <Award size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        Área Curricular Configurada
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Sistema: {classroom.gradeScaleType === 'PERU_LETTERS' ? 'Perú - Letras (AD, A, B, C)' : 
                                  classroom.gradeScaleType === 'PERU_VIGESIMAL' ? 'Perú - Vigesimal (0-20)' :
                                  classroom.gradeScaleType === 'CENTESIMAL' ? 'Centesimal (0-100)' :
                                  classroom.gradeScaleType === 'USA_LETTERS' ? 'USA - Letras (A-F)' : 'Personalizado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuración de rangos de calificación */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    Rangos de Calificación y Recompensas
                  </h3>
                  <div className="space-y-2">
                    {(classroom.gradeScaleType === 'PERU_LETTERS' ? [
                      { label: 'AD - Logro Destacado', minPercent: 90, maxPercent: 100, xpReward: 50, gpReward: 20 },
                      { label: 'A - Logrado', minPercent: 70, maxPercent: 89, xpReward: 30, gpReward: 10 },
                      { label: 'B - En Proceso', minPercent: 50, maxPercent: 69, xpReward: 15, gpReward: 5 },
                      { label: 'C - En Inicio', minPercent: 0, maxPercent: 49, xpReward: 5, gpReward: 0 },
                    ] : classroom.gradeScaleConfig?.ranges || []).map((range, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{range.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {range.minPercent}% - {range.maxPercent}%
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">XP</p>
                            <p className="text-sm font-bold text-violet-600 dark:text-violet-400">+{range.xpReward}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">GP</p>
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">+{range.gpReward}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Las recompensas se otorgan automáticamente al publicar las calificaciones.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Gestión de Estudiantes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
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

              {/* Lista de estudiantes con opción de retirar */}
              {(classroom as any).students && (classroom as any).students.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Estudiantes en la clase ({(classroom as any).students.filter((s: any) => !s.isDemo).length})
                    </p>
                  </div>

                  {/* Buscador */}
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

                  {/* Lista */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {(classroom as any).students
                      .filter((s: any) => !s.isDemo)
                      .filter((s: any) => {
                        if (!studentSearch.trim()) return true;
                        const search = studentSearch.toLowerCase();
                        const name = (s.characterName || s.displayName || '').toLowerCase();
                        const realName = `${s.realName || ''} ${s.realLastName || ''}`.toLowerCase();
                        return name.includes(search) || realName.includes(search);
                      })
                      .map((student: any) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
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
                              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                {student.characterName || student.displayName || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {student.realName ? `${student.realName} ${student.realLastName || ''}` : 'Sin vincular'}
                                {' · '}Nv.{student.level} · ⚡{student.xp} XP
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setRemoveStudentConfirm({
                              id: student.id,
                              name: student.characterName || student.displayName || student.realName || 'Estudiante',
                            })}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Retirar de la clase"
                          >
                            <UserX size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Folletos para padres */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52 }}
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
                    // Abrir ventana de impresión con los folletos
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      toast.error('Permite las ventanas emergentes para imprimir');
                      return;
                    }
                    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Folletos para Padres - ${data.classroomName}</title>
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
      <strong>${data.classroomName}</strong> — ${data.students.length} folletos generados
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
        <div class="flyer-class">${data.classroomName}</div>
        <div class="flyer-student">${s.name}</div>
        <div class="flyer-label">Código de vinculación para padres</div>
        <div class="flyer-code">${s.parentLinkCode}</div>
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
    // Pad with empty flyers if less than 4
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

          {/* Zona de peligro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-5"
          >
            <h2 className="font-semibold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              Zona de peligro
            </h2>
            
            <div className="space-y-3">
              {/* Eliminar estudiante demo */}
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
                onClick={() => setShowResetConfirm(true)}
                disabled={resetPointsMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={resetPointsMutation.isPending ? 'animate-spin' : ''} />
                {resetPointsMutation.isPending ? 'Reseteando...' : 'Resetear clase a cero'}
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
      </div>

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

      {/* Modal de confirmación para resetear clase a cero */}
      {showResetConfirm && (
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
              <h3 className="text-lg font-bold text-white mb-1">¿Resetear clase a cero?</h3>
              <p className="text-sm text-gray-400">
                Se eliminarán <span className="text-red-400 font-medium">todos</span> los datos de actividad: puntos, historial, compras, insignias, asistencia, rachas, clanes, pergaminos y uso de poderes. Los estudiantes, comportamientos y configuración se mantienen.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">
                Escribe "<span className="text-red-400 font-medium">{classroom.name}</span>" para confirmar
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder={classroom.name}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  resetPointsMutation.mutate();
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                disabled={resetConfirmText !== classroom.name || resetPointsMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetPointsMutation.isPending ? 'Reseteando...' : 'Resetear todo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de confirmación para eliminar estudiante demo */}
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
