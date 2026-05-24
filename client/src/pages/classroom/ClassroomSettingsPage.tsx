import { useState, useEffect } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQueries, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Settings, 
  ArrowRightLeft,
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
  ChevronDown,
} from 'lucide-react';
import {
  classroomApi,
  type Classroom,
  type Student,
  type ClassroomCompetency,
  type ClassroomCompetencyIndicator,
  type CreateCustomClassroomCompetencyData,
  type CreateClassroomCompetencyIndicatorData,
  type TransferCompetencyIndicatorsData,
  type TransferCompetencyIndicatorsResult,
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
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';
import {
  CLASSROOM_SETTINGS_SECTIONS,
  DEFAULT_CLASSROOM_SETTINGS_SECTION,
  isClassroomSettingsSection,
  type ClassroomSettingsSectionKey,
} from './classroomSettingsSections';

export const ClassroomSettingsPage = () => {
  const { section } = useParams<{ section?: string }>();
  const { classroom, refetch } = useOutletContext<{ classroom: Classroom & { students?: Student[] }; refetch: () => void }>();
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
  const [showAddCompetenciesModal, setShowAddCompetenciesModal] = useState(false);
  const [showCompetencyActionsMenu, setShowCompetencyActionsMenu] = useState(false);
  const [competencySearch, setCompetencySearch] = useState('');
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([]);
  const [showCustomCompetencyModal, setShowCustomCompetencyModal] = useState(false);
  const [showExportCustomCompetenciesModal, setShowExportCustomCompetenciesModal] = useState(false);
  const [showIndicatorTransferModal, setShowIndicatorTransferModal] = useState(false);
  const [editingCustomCompetency, setEditingCustomCompetency] = useState<ClassroomCompetency | null>(null);
  const [showCompetencyIndicatorModal, setShowCompetencyIndicatorModal] = useState(false);
  const [selectedIndicatorCompetency, setSelectedIndicatorCompetency] = useState<ClassroomCompetency | null>(null);
  const [editingCompetencyIndicator, setEditingCompetencyIndicator] = useState<ClassroomCompetencyIndicator | null>(null);
  const [indicatorTransferMode, setIndicatorTransferMode] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [selectedIndicatorTransferSourceClassroomId, setSelectedIndicatorTransferSourceClassroomId] = useState<string | null>(null);
  const [selectedIndicatorTransferTargetClassroomIds, setSelectedIndicatorTransferTargetClassroomIds] = useState<string[]>([]);
  const [selectedIndicatorTransferCompetencyIds, setSelectedIndicatorTransferCompetencyIds] = useState<string[]>([]);
  const [copyMissingTransferCustomCompetencies, setCopyMissingTransferCustomCompetencies] = useState(true);
  const [customCompetencyForm, setCustomCompetencyForm] = useState({
    name: '',
    shortName: '',
    description: '',
  });
  const [competencyIndicatorForm, setCompetencyIndicatorForm] = useState({
    name: '',
    description: '',
  });
  const [selectedExportClassroomIds, setSelectedExportClassroomIds] = useState<string[]>([]);
  const [extraCompetencyToRemove, setExtraCompetencyToRemove] = useState<ClassroomCompetency | null>(null);
  const [customCompetencyToDelete, setCustomCompetencyToDelete] = useState<ClassroomCompetency | null>(null);
  const [indicatorToDelete, setIndicatorToDelete] = useState<{
    competency: ClassroomCompetency;
    indicator: ClassroomCompetencyIndicator;
  } | null>(null);

  // Query para clases de personaje
  const { data: characterClasses = [], refetch: refetchClasses } = useQuery({
    queryKey: ['character-classes', classroom.id],
    queryFn: () => characterClassApi.list(classroom.id),
  });

  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas', 'settings'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom.useCompetencies,
  });

  const { data: myClassrooms = [], isLoading: isLoadingMyClassrooms } = useQuery({
    queryKey: ['classrooms', 'export-custom-competencies'],
    queryFn: classroomApi.getMyClassrooms,
    enabled: showExportCustomCompetenciesModal || showIndicatorTransferModal,
  });

  const {
    competencies: classroomCompetencies,
    baseCompetencies,
    extraCompetencies,
    customCompetencies,
    refetch: refetchCompetencies,
  } = useClassroomCompetencies(classroom.id, classroom.useCompetencies);

  const { data: indicatorTransferSourceCompetencies = [], isLoading: isLoadingIndicatorTransferSourceCompetencies } = useQuery({
    queryKey: ['classroom-competencies-transfer-source', selectedIndicatorTransferSourceClassroomId],
    queryFn: () => classroomApi.getCompetencies(selectedIndicatorTransferSourceClassroomId!),
    enabled: showIndicatorTransferModal && indicatorTransferMode === 'IMPORT' && !!selectedIndicatorTransferSourceClassroomId,
    staleTime: 5 * 60 * 1000,
  });

  const indicatorTransferTargetQueries = useQueries({
    queries: showIndicatorTransferModal && indicatorTransferMode === 'EXPORT'
      ? selectedIndicatorTransferTargetClassroomIds.map((targetClassroomId) => ({
          queryKey: ['classroom-competencies-transfer-target', targetClassroomId],
          queryFn: () => classroomApi.getCompetencies(targetClassroomId),
          staleTime: 5 * 60 * 1000,
        }))
      : [],
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

  const addCompetenciesMutation = useMutation({
    mutationFn: (competencyIds: string[]) => classroomApi.addCompetencies(classroom.id, competencyIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      refetchCompetencies();
      setShowAddCompetenciesModal(false);
      setSelectedCompetencyIds([]);
      setCompetencySearch('');
      toast.success(
        result.created > 0
          ? `${result.created} competencia(s) agregada(s)`
          : 'No habia competencias nuevas para agregar'
      );
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al agregar competencias');
    },
  });

  const removeCompetencyMutation = useMutation({
    mutationFn: (competencyId: string) => classroomApi.removeCompetency(classroom.id, competencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      refetchCompetencies();
      setExtraCompetencyToRemove(null);
      toast.success('Competencia adicional retirada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al retirar competencia');
    },
  });

  const createCustomCompetencyMutation = useMutation({
    mutationFn: (data: CreateCustomClassroomCompetencyData) => classroomApi.createCustomCompetency(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      refetchCompetencies();
      closeCustomCompetencyModal();
      toast.success('Competencia personalizada creada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al crear competencia personalizada');
    },
  });

  const updateCustomCompetencyMutation = useMutation({
    mutationFn: ({ competencyId, data }: { competencyId: string; data: CreateCustomClassroomCompetencyData }) => (
      classroomApi.updateCustomCompetency(classroom.id, competencyId, data)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      refetchCompetencies();
      closeCustomCompetencyModal();
      toast.success('Competencia personalizada actualizada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al actualizar competencia personalizada');
    },
  });

  const deleteCustomCompetencyMutation = useMutation({
    mutationFn: (competencyId: string) => classroomApi.deleteCustomCompetency(classroom.id, competencyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      refetchCompetencies();
      setCustomCompetencyToDelete(null);
      toast.success('Competencia personalizada eliminada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al eliminar competencia personalizada');
    },
  });

  const createCompetencyIndicatorMutation = useMutation({
    mutationFn: ({ competencyId, data }: { competencyId: string; data: CreateClassroomCompetencyIndicatorData }) => (
      classroomApi.createCompetencyIndicator(classroom.id, competencyId, data)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      refetchCompetencies();
      refetch();
      closeCompetencyIndicatorModal();
      toast.success('Destreza creada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al crear destreza');
    },
  });

  const updateCompetencyIndicatorMutation = useMutation({
    mutationFn: ({
      competencyId,
      indicatorId,
      data,
    }: {
      competencyId: string;
      indicatorId: string;
      data: CreateClassroomCompetencyIndicatorData;
    }) => classroomApi.updateCompetencyIndicator(classroom.id, competencyId, indicatorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      refetchCompetencies();
      closeCompetencyIndicatorModal();
      toast.success('Destreza actualizada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al actualizar destreza');
    },
  });

  const deleteCompetencyIndicatorMutation = useMutation({
    mutationFn: ({ competencyId, indicatorId }: { competencyId: string; indicatorId: string }) => (
      classroomApi.deleteCompetencyIndicator(classroom.id, competencyId, indicatorId)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
      refetchCompetencies();
      setIndicatorToDelete(null);
      toast.success('Destreza eliminada');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al eliminar destreza');
    },
  });

  const transferCompetencyIndicatorsMutation = useMutation({
    mutationFn: (data: TransferCompetencyIndicatorsData) => classroomApi.transferCompetencyIndicators(classroom.id, data),
    onSuccess: (result: TransferCompetencyIndicatorsResult, variables) => {
      if (variables.mode === 'IMPORT') {
        queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
        queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroom.id] });
        queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
        queryClient.invalidateQueries({ queryKey: ['behaviors', classroom.id] });
        refetchCompetencies();
        refetch();
      }

      closeIndicatorTransferModal();

      const summary: string[] = [];

      if (result.createdIndicators > 0) {
        summary.push(`${result.createdIndicators} destreza(s) creada(s)`);
      }

      if (result.createdCompetencies > 0) {
        summary.push(`${result.createdCompetencies} competencia(s) personalizada(s) creada(s)`);
      }

      if (result.skippedExistingIndicators > 0) {
        summary.push(`${result.skippedExistingIndicators} omitida(s) por repetidas`);
      }

      if (result.skippedUnavailableCompetencies > 0) {
        summary.push(`${result.skippedUnavailableCompetencies} competencia(s) incompatible(s)`);
      }

      if (result.failedTargets.length > 0) {
        summary.push(`${result.failedTargets.length} clase(s) con error`);
      }

      if (result.createdIndicators > 0 || result.createdCompetencies > 0) {
        toast.success(summary.join(' · '));
        return;
      }

      toast.error(summary[0] || 'No se transfirieron destrezas nuevas');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al transferir destrezas');
    },
  });

  const exportCustomCompetenciesMutation = useMutation({
    mutationFn: async (targetClassroomIds: string[]) => {
      const exportableCompetencies = customCompetencies.map((competency) => ({
        name: competency.name,
        shortName: competency.shortName,
        description: competency.description,
      }));

      const classroomMap = new Map(myClassrooms.map((item) => [item.id, item]));
      let exportedCount = 0;
      let duplicateCount = 0;
      const failedExports: Array<{ classroomName: string; competencyName: string; message: string }> = [];

      for (const targetClassroomId of targetClassroomIds) {
        const targetClassroom = classroomMap.get(targetClassroomId);
        if (!targetClassroom) {
          continue;
        }

        for (const competency of exportableCompetencies) {
          try {
            await classroomApi.createCustomCompetency(targetClassroomId, competency);
            exportedCount += 1;
          } catch (error: any) {
            const message = error?.response?.data?.message || 'Error al exportar competencia';

            if (message.includes('Ya existe una competencia con ese nombre en el aula')) {
              duplicateCount += 1;
              continue;
            }

            failedExports.push({
              classroomName: targetClassroom.name,
              competencyName: competency.name,
              message,
            });
          }
        }
      }

      return {
        exportedCount,
        duplicateCount,
        failedExports,
        targetClassroomCount: targetClassroomIds.length,
      };
    },
    onSuccess: (result) => {
      const messages: string[] = [];

      if (result.exportedCount > 0) {
        messages.push(`${result.exportedCount} copia(s) exportadas`);
      }

      if (result.duplicateCount > 0) {
        messages.push(`${result.duplicateCount} omitida(s) por nombre repetido`);
      }

      if (result.failedExports.length > 0) {
        messages.push(`${result.failedExports.length} con error`);
      }

      closeExportCustomCompetenciesModal();

      if (result.exportedCount > 0) {
        toast.success(messages.join(' · '));
        return;
      }

      if (result.duplicateCount > 0 && result.failedExports.length === 0) {
        toast.error('No se exportaron competencias nuevas porque ya existen en las clases seleccionadas');
        return;
      }

      toast.error(messages[0] || 'No se pudo exportar las competencias');
    },
    onError: () => {
      toast.error('Error al exportar competencias personalizadas');
    },
  });

  const resetNewClassForm = () => {
    setNewClassName(''); setNewClassKey(''); setNewClassDesc(''); setNewClassIcon('⚔️'); setNewClassColor('blue');
  };

  const resetCustomCompetencyForm = () => {
    setEditingCustomCompetency(null);
    setCustomCompetencyForm({
      name: '',
      shortName: '',
      description: '',
    });
  };

  const resetCompetencyIndicatorForm = () => {
    setEditingCompetencyIndicator(null);
    setSelectedIndicatorCompetency(null);
    setCompetencyIndicatorForm({
      name: '',
      description: '',
    });
  };

  const closeCustomCompetencyModal = () => {
    setShowCustomCompetencyModal(false);
    resetCustomCompetencyForm();
  };

  const closeCompetencyIndicatorModal = () => {
    setShowCompetencyIndicatorModal(false);
    resetCompetencyIndicatorForm();
  };

  const closeExportCustomCompetenciesModal = () => {
    setShowExportCustomCompetenciesModal(false);
    setSelectedExportClassroomIds([]);
  };

  const closeIndicatorTransferModal = () => {
    setShowIndicatorTransferModal(false);
    setIndicatorTransferMode('IMPORT');
    setSelectedIndicatorTransferSourceClassroomId(null);
    setSelectedIndicatorTransferTargetClassroomIds([]);
    setSelectedIndicatorTransferCompetencyIds([]);
    setCopyMissingTransferCustomCompetencies(true);
  };

  const openIndicatorTransferModal = () => {
    if (!classroom.useCompetencies) {
      toast.error('Primero habilita competencias en esta clase');
      return;
    }

    setIndicatorTransferMode('IMPORT');
    setSelectedIndicatorTransferSourceClassroomId(null);
    setSelectedIndicatorTransferTargetClassroomIds([]);
    setSelectedIndicatorTransferCompetencyIds([]);
    setCopyMissingTransferCustomCompetencies(true);
    setShowIndicatorTransferModal(true);
  };

  const closeCompetencyActionsMenu = () => {
    setShowCompetencyActionsMenu(false);
  };

  const handleOpenCustomCompetencyFromMenu = () => {
    closeCompetencyActionsMenu();
    openCreateCustomCompetencyModal();
  };

  const handleOpenAddCompetenciesFromMenu = () => {
    closeCompetencyActionsMenu();
    setShowAddCompetenciesModal(true);
  };

  const toggleIndicatorTransferTargetClassroomSelection = (classroomId: string) => {
    setSelectedIndicatorTransferTargetClassroomIds((current) => (
      current.includes(classroomId)
        ? current.filter((id) => id !== classroomId)
        : [...current, classroomId]
    ));
  };

  const toggleIndicatorTransferCompetencySelection = (competencyId: string) => {
    setSelectedIndicatorTransferCompetencyIds((current) => (
      current.includes(competencyId)
        ? current.filter((id) => id !== competencyId)
        : [...current, competencyId]
    ));
  };

  const handleIndicatorTransferModeChange = (nextMode: 'IMPORT' | 'EXPORT') => {
    if (indicatorTransferMode === nextMode) {
      return;
    }

    setIndicatorTransferMode(nextMode);
    setSelectedIndicatorTransferCompetencyIds([]);

    if (nextMode === 'IMPORT') {
      setSelectedIndicatorTransferTargetClassroomIds([]);
      return;
    }

    setSelectedIndicatorTransferSourceClassroomId(null);
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

  const activeAreaId = formData.curriculumAreaId ?? classroom.curriculumAreaId;
  const activeGradeScale = formData.gradeScaleType ?? classroom.gradeScaleType ?? 'PERU_LETTERS';
  const activeArea = curriculumAreas.find((area) => area.id === activeAreaId) || null;
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

  const getCompetencyDeleteStatusLabel = (competency: ClassroomCompetency) => {
    if (competency.deleteBlockReason === 'HISTORICAL_RECORDS') {
      return 'Con historico';
    }

    if (competency.deleteBlockReason === 'CONFIG_ASSOCIATED') {
      return 'Configurada';
    }

    if (competency.deleteBlockReason === 'CONFIG_AND_HISTORICAL_RECORDS') {
      return 'En uso';
    }

    return null;
  };

  const getCompetencyDeleteBlockMessage = (
    competency: ClassroomCompetency,
    mode: 'REMOVE' | 'DELETE',
  ) => {
    const actionSuffix = mode === 'REMOVE'
      ? 'No se puede retirar del aula.'
      : 'Puedes editarla, pero no eliminarla.';

    if (competency.deleteBlockReason === 'HISTORICAL_RECORDS') {
      return `Ya tiene calificaciones o evidencias registradas, incluso en bimestres cerrados. ${actionSuffix}`;
    }

    if (competency.deleteBlockReason === 'CONFIG_ASSOCIATED') {
      return `Tiene comportamientos, actividades o destrezas configuradas. ${actionSuffix}`;
    }

    if (competency.deleteBlockReason === 'CONFIG_AND_HISTORICAL_RECORDS') {
      return `Tiene configuraciones activas y tambien calificaciones o evidencias registradas. ${actionSuffix}`;
    }

    return mode === 'REMOVE'
      ? 'No se puede retirar del aula.'
      : 'Puedes editarla, pero no eliminarla.';
  };

  const normalizeTransferName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

  const buildIndicatorTransferPreview = (
    sourceCompetencies: ClassroomCompetency[],
    targetCompetencies: ClassroomCompetency[],
    copyMissingCustomCompetencies: boolean,
  ) => {
    const targetAnyByName = new Map<string, ClassroomCompetency>();
    const targetCustomByName = new Map<string, ClassroomCompetency>();
    const indicatorNamesByCompetencyId = new Map<string, Set<string>>();
    const simulatedCustomIndicatorNames = new Map<string, Set<string>>();

    targetCompetencies.forEach((competency) => {
      const normalizedName = normalizeTransferName(competency.name);
      if (!targetAnyByName.has(normalizedName)) {
        targetAnyByName.set(normalizedName, competency);
      }
      if (competency.isCustom && !targetCustomByName.has(normalizedName)) {
        targetCustomByName.set(normalizedName, competency);
      }
      indicatorNamesByCompetencyId.set(
        competency.id,
        new Set(competency.indicators.map((indicator) => normalizeTransferName(indicator.name))),
      );
    });

    let createdCompetencies = 0;
    let createdIndicators = 0;
    let skippedExistingIndicators = 0;
    let skippedUnavailableCompetencies = 0;

    sourceCompetencies.forEach((sourceCompetency) => {
      let indicatorNames: Set<string> | null = null;

      if (!sourceCompetency.isCustom) {
        const targetCompetency = targetCompetencies.find((competency) => competency.id === sourceCompetency.id) || null;
        if (!targetCompetency) {
          skippedUnavailableCompetencies += 1;
          return;
        }

        indicatorNames = indicatorNamesByCompetencyId.get(targetCompetency.id) || new Set<string>();
      } else {
        const normalizedName = normalizeTransferName(sourceCompetency.name);
        const targetCustomCompetency = targetCustomByName.get(normalizedName);

        if (targetCustomCompetency) {
          indicatorNames = indicatorNamesByCompetencyId.get(targetCustomCompetency.id) || new Set<string>();
        } else if (simulatedCustomIndicatorNames.has(normalizedName)) {
          indicatorNames = simulatedCustomIndicatorNames.get(normalizedName)!;
        } else if (copyMissingCustomCompetencies && !targetAnyByName.has(normalizedName)) {
          createdCompetencies += 1;
          indicatorNames = new Set<string>();
          simulatedCustomIndicatorNames.set(normalizedName, indicatorNames);
        } else {
          skippedUnavailableCompetencies += 1;
          return;
        }
      }

      sourceCompetency.indicators.forEach((indicator) => {
        const normalizedIndicatorName = normalizeTransferName(indicator.name);
        if (indicatorNames!.has(normalizedIndicatorName)) {
          skippedExistingIndicators += 1;
          return;
        }

        indicatorNames!.add(normalizedIndicatorName);
        createdIndicators += 1;
      });
    });

    return {
      createdCompetencies,
      createdIndicators,
      skippedExistingIndicators,
      skippedUnavailableCompetencies,
    };
  };

  const exportTargetClassrooms = myClassrooms.filter((item) => item.id !== classroom.id);
  const eligibleExportClassrooms = exportTargetClassrooms.filter((item) => item.useCompetencies && !!item.curriculumAreaId);
  const ineligibleExportClassrooms = exportTargetClassrooms.filter((item) => !item.useCompetencies || !item.curriculumAreaId);
  const allEligibleExportSelected = eligibleExportClassrooms.length > 0 && eligibleExportClassrooms.every((item) => selectedExportClassroomIds.includes(item.id));
  const selectedIndicatorTransferSourceClassroom = eligibleExportClassrooms.find((item) => item.id === selectedIndicatorTransferSourceClassroomId) || null;
  const indicatorTransferSourcePool = indicatorTransferMode === 'IMPORT'
    ? indicatorTransferSourceCompetencies
    : classroomCompetencies;
  const indicatorTransferSelectableCompetencies = indicatorTransferSourcePool.filter((competency) => competency.indicators.length > 0);
  const allIndicatorTransferCompetenciesSelected = indicatorTransferSelectableCompetencies.length > 0
    && indicatorTransferSelectableCompetencies.every((competency) => selectedIndicatorTransferCompetencyIds.includes(competency.id));
  const allIndicatorTransferTargetClassroomsSelected = eligibleExportClassrooms.length > 0
    && eligibleExportClassrooms.every((item) => selectedIndicatorTransferTargetClassroomIds.includes(item.id));
  const selectedIndicatorTransferCompetencies = indicatorTransferSelectableCompetencies.filter((competency) => selectedIndicatorTransferCompetencyIds.includes(competency.id));
  const indicatorTransferTargetCompetenciesByClassroomId = new Map(
    selectedIndicatorTransferTargetClassroomIds.map((targetClassroomId, index) => [
      targetClassroomId,
      indicatorTransferTargetQueries[index]?.data || [],
    ]),
  );
  const indicatorTransferPreview = indicatorTransferMode === 'IMPORT'
    ? buildIndicatorTransferPreview(selectedIndicatorTransferCompetencies, classroomCompetencies, copyMissingTransferCustomCompetencies)
    : selectedIndicatorTransferTargetClassroomIds.reduce((summary, targetClassroomId) => {
        const targetCompetencies = indicatorTransferTargetCompetenciesByClassroomId.get(targetClassroomId) || [];
        const targetPreview = buildIndicatorTransferPreview(
          selectedIndicatorTransferCompetencies,
          targetCompetencies,
          copyMissingTransferCustomCompetencies,
        );

        return {
          createdCompetencies: summary.createdCompetencies + targetPreview.createdCompetencies,
          createdIndicators: summary.createdIndicators + targetPreview.createdIndicators,
          skippedExistingIndicators: summary.skippedExistingIndicators + targetPreview.skippedExistingIndicators,
          skippedUnavailableCompetencies: summary.skippedUnavailableCompetencies + targetPreview.skippedUnavailableCompetencies,
        };
      }, {
        createdCompetencies: 0,
        createdIndicators: 0,
        skippedExistingIndicators: 0,
        skippedUnavailableCompetencies: 0,
      });
  const indicatorTransferPreviewLoading = indicatorTransferMode === 'IMPORT'
    ? !!selectedIndicatorTransferSourceClassroomId && isLoadingIndicatorTransferSourceCompetencies
    : indicatorTransferTargetQueries.some((query) => query.isLoading);
  const indicatorTransferHasLoadedTargets = indicatorTransferMode === 'EXPORT'
    ? selectedIndicatorTransferTargetClassroomIds.length > 0 && indicatorTransferTargetQueries.length === selectedIndicatorTransferTargetClassroomIds.length && indicatorTransferTargetQueries.every((query) => query.isSuccess)
    : true;
  const enabledCompetencyIds = new Set(classroomCompetencies.map((competency) => competency.id));
  const filteredAreas = curriculumAreas.filter((area) => {
    if (!activeArea?.educationLevel || !area.educationLevel) {
      return true;
    }

    return area.educationLevel === activeArea.educationLevel;
  });
  const searchableAreas = activeArea
    ? filteredAreas.filter((area) => area.id !== activeArea.id)
    : filteredAreas;
  const competencySearchTerm = competencySearch.trim().toLowerCase();
  const availableCompetenciesByArea = searchableAreas
    .map((area) => ({
      ...area,
      competencies: area.competencies.filter((competency) => {
        if (enabledCompetencyIds.has(competency.id)) {
          return false;
        }

        if (!competencySearchTerm) {
          return true;
        }

        return [competency.name, competency.shortName || '', area.name]
          .join(' ')
          .toLowerCase()
          .includes(competencySearchTerm);
      }),
    }))
    .filter((area) => area.competencies.length > 0);

  const eligibleIndicatorTransferClassroomIdsKey = eligibleExportClassrooms.map((item) => item.id).join('|');
  const indicatorTransferSelectableCompetencyIdsKey = indicatorTransferSelectableCompetencies.map((competency) => competency.id).join('|');

  useEffect(() => {
    if (!showIndicatorTransferModal || indicatorTransferMode !== 'IMPORT') {
      return;
    }

    setSelectedIndicatorTransferSourceClassroomId((current) => {
      if (current && eligibleExportClassrooms.some((item) => item.id === current)) {
        return current;
      }

      return eligibleExportClassrooms[0]?.id ?? null;
    });
  }, [showIndicatorTransferModal, indicatorTransferMode, eligibleIndicatorTransferClassroomIdsKey]);

  useEffect(() => {
    if (!showIndicatorTransferModal || indicatorTransferMode !== 'EXPORT') {
      return;
    }

    setSelectedIndicatorTransferTargetClassroomIds((current) => {
      const next = current.filter((classroomId) => eligibleExportClassrooms.some((item) => item.id === classroomId));
      return next.length === current.length ? current : next;
    });
  }, [showIndicatorTransferModal, indicatorTransferMode, eligibleIndicatorTransferClassroomIdsKey]);

  useEffect(() => {
    if (!showIndicatorTransferModal) {
      return;
    }

    const availableCompetencyIds = indicatorTransferSelectableCompetencies.map((competency) => competency.id);

    setSelectedIndicatorTransferCompetencyIds((current) => {
      const validSelections = current.filter((competencyId) => availableCompetencyIds.includes(competencyId));

      if (validSelections.length === current.length && current.length > 0) {
        return current;
      }

      return validSelections.length > 0 ? validSelections : availableCompetencyIds;
    });
  }, [
    showIndicatorTransferModal,
    indicatorTransferMode,
    selectedIndicatorTransferSourceClassroomId,
    indicatorTransferSelectableCompetencyIdsKey,
  ]);

  const toggleSelectAllIndicatorTransferTargetClassrooms = () => {
    if (allIndicatorTransferTargetClassroomsSelected) {
      setSelectedIndicatorTransferTargetClassroomIds([]);
      return;
    }

    setSelectedIndicatorTransferTargetClassroomIds(eligibleExportClassrooms.map((item) => item.id));
  };

  const toggleSelectAllIndicatorTransferCompetencies = () => {
    if (allIndicatorTransferCompetenciesSelected) {
      setSelectedIndicatorTransferCompetencyIds([]);
      return;
    }

    setSelectedIndicatorTransferCompetencyIds(indicatorTransferSelectableCompetencies.map((competency) => competency.id));
  };

  const handleIndicatorTransferSubmit = () => {
    if (selectedIndicatorTransferCompetencyIds.length === 0) {
      toast.error('Selecciona al menos una competencia con destrezas');
      return;
    }

    if (indicatorTransferMode === 'IMPORT' && !selectedIndicatorTransferSourceClassroomId) {
      toast.error('Selecciona una clase de origen');
      return;
    }

    if (indicatorTransferMode === 'EXPORT' && selectedIndicatorTransferTargetClassroomIds.length === 0) {
      toast.error('Selecciona al menos una clase destino');
      return;
    }

    transferCompetencyIndicatorsMutation.mutate({
      mode: indicatorTransferMode,
      sourceClassroomId: indicatorTransferMode === 'IMPORT' ? selectedIndicatorTransferSourceClassroomId || undefined : undefined,
      targetClassroomIds: indicatorTransferMode === 'EXPORT' ? selectedIndicatorTransferTargetClassroomIds : undefined,
      competencyIds: selectedIndicatorTransferCompetencyIds,
      copyMissingCustomCompetencies: copyMissingTransferCustomCompetencies,
    });
  };

  const gradeScaleOptions = [
    {
      value: 'PERU_LETTERS' as const,
      label: 'Letras',
      helper: 'AD, A, B, C',
      description: 'Ideal si quieres comunicar niveles de logro de forma rápida y fácil de interpretar.',
    },
    {
      value: 'PERU_VIGESIMAL' as const,
      label: 'Vigesimal',
      helper: '0 a 20',
      description: 'Útil si prefieres registrar notas con una escala numérica tradicional.',
    },
  ];

  const toggleCompetencySelection = (competencyId: string) => {
    setSelectedCompetencyIds((current) => (
      current.includes(competencyId)
        ? current.filter((id) => id !== competencyId)
        : [...current, competencyId]
    ));
  };

  const openCreateCustomCompetencyModal = () => {
    if (!activeAreaId) {
      toast.error('Configura primero el area curricular del aula');
      return;
    }

    resetCustomCompetencyForm();
    setShowCustomCompetencyModal(true);
  };

  const openExportCustomCompetenciesModal = () => {
    if (customCompetencies.length === 0) {
      toast.error('Primero crea al menos una competencia personalizada');
      return;
    }

    setSelectedExportClassroomIds([]);
    setShowExportCustomCompetenciesModal(true);
  };

  const openEditCustomCompetencyModal = (competency: ClassroomCompetency) => {
    setEditingCustomCompetency(competency);
    setCustomCompetencyForm({
      name: competency.name,
      shortName: competency.shortName || '',
      description: competency.description || '',
    });
    setShowCustomCompetencyModal(true);
  };

  const openCreateCompetencyIndicatorModal = (competency: ClassroomCompetency) => {
    setSelectedIndicatorCompetency(competency);
    setEditingCompetencyIndicator(null);
    setCompetencyIndicatorForm({
      name: '',
      description: '',
    });
    setShowCompetencyIndicatorModal(true);
  };

  const openEditCompetencyIndicatorModal = (
    competency: ClassroomCompetency,
    indicator: ClassroomCompetencyIndicator,
  ) => {
    setSelectedIndicatorCompetency(competency);
    setEditingCompetencyIndicator(indicator);
    setCompetencyIndicatorForm({
      name: indicator.name,
      description: indicator.description || '',
    });
    setShowCompetencyIndicatorModal(true);
  };

  const handleCustomCompetencySubmit = () => {
    const payload: CreateCustomClassroomCompetencyData = {
      name: customCompetencyForm.name.trim(),
      shortName: customCompetencyForm.shortName.trim() || null,
      description: customCompetencyForm.description.trim() || null,
    };

    if (!payload.name) {
      toast.error('Ingresa el nombre de la competencia');
      return;
    }

    if (editingCustomCompetency) {
      updateCustomCompetencyMutation.mutate({
        competencyId: editingCustomCompetency.id,
        data: payload,
      });
      return;
    }

    createCustomCompetencyMutation.mutate(payload);
  };

  const handleCompetencyIndicatorSubmit = () => {
    if (!selectedIndicatorCompetency) {
      toast.error('Selecciona primero una competencia');
      return;
    }

    const payload: CreateClassroomCompetencyIndicatorData = {
      name: competencyIndicatorForm.name.trim(),
      description: competencyIndicatorForm.description.trim() || null,
    };

    if (!payload.name) {
      toast.error('Ingresa el nombre de la destreza');
      return;
    }

    if (editingCompetencyIndicator) {
      updateCompetencyIndicatorMutation.mutate({
        competencyId: selectedIndicatorCompetency.id,
        indicatorId: editingCompetencyIndicator.id,
        data: payload,
      });
      return;
    }

    createCompetencyIndicatorMutation.mutate({
      competencyId: selectedIndicatorCompetency.id,
      data: payload,
    });
  };

  const totalCompetencyIndicators = classroomCompetencies.reduce(
    (total, competency) => total + (competency.indicators?.length || 0),
    0,
  );

  const formatBimesterLabel = (period: string) => {
    const [year, bimester] = period.split('-B');
    return `Bimestre ${bimester} ${year}`;
  };

  const toggleExportClassroomSelection = (classroomId: string) => {
    setSelectedExportClassroomIds((current) => (
      current.includes(classroomId)
        ? current.filter((id) => id !== classroomId)
        : [...current, classroomId]
    ));
  };

  const toggleSelectAllExportClassrooms = () => {
    if (allEligibleExportSelected) {
      setSelectedExportClassroomIds([]);
      return;
    }

    setSelectedExportClassroomIds(eligibleExportClassrooms.map((item) => item.id));
  };

  const handleExportCustomCompetencies = () => {
    if (selectedExportClassroomIds.length === 0) {
      toast.error('Selecciona al menos una clase destino');
      return;
    }

    exportCustomCompetenciesMutation.mutate(selectedExportClassroomIds);
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

  const renderClassSection = () => {
    if (!classroom.useCompetencies) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-emerald-600" />
            </div>
            Configuración académica
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Esta aula no tiene competencias habilitadas, por lo que no hay configuración académica disponible en esta sección.
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
                  <BookOpen size={16} className="text-emerald-600" />
                </div>
                Competencias del aula
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Gestiona las competencias base, agrega competencias oficiales extra y crea competencias personalizadas solo para esta clase.
              </p>
            </div>

            <div className="relative self-start">
              <button
                type="button"
                onClick={() => setShowCompetencyActionsMenu((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={showCompetencyActionsMenu}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900/60 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <Plus size={15} />
                Gestionar competencias
                <ChevronDown size={15} className={`transition-transform ${showCompetencyActionsMenu ? 'rotate-180' : ''}`} />
              </button>

              {showCompetencyActionsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeCompetencyActionsMenu} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl shadow-indigo-100/40 dark:shadow-black/30">
                    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Agregar competencias</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Elige si deseas crear una competencia propia para esta clase o habilitar una oficial del currículo.
                      </p>
                    </div>

                    <div className="p-2 space-y-1.5">
                      <button
                        type="button"
                        onClick={handleOpenCustomCompetencyFromMenu}
                        disabled={!activeAreaId}
                        className="flex w-full min-h-[52px] items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <Plus size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Crear personalizada</span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Solo esta clase
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Crea una competencia nueva asociada al área curricular actual del aula.
                          </p>
                          {!activeAreaId && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Primero configura el área curricular para habilitar esta opción.
                            </p>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenAddCompetenciesFromMenu}
                        className="flex w-full min-h-[52px] items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <Plus size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Agregar oficiales</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Currículo
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Habilita competencias oficiales adicionales desde otras áreas del mismo nivel.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
                Area curricular base
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">
                {activeArea?.name || 'Sin area configurada'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {baseCompetencies.length} base, {extraCompetencies.length} oficial(es) extra y {customCompetencies.length} personalizada(s) activas.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Competencias base</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Provienen del area curricular principal.</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {baseCompetencies.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {baseCompetencies.length > 0 ? baseCompetencies.map((competency) => (
                    <div key={competency.id} className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-gray-900/60 px-3 py-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{competency.areaName}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay competencias base activas.</p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Competencias adicionales</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Se agregan desde otras areas del mismo nivel.</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {extraCompetencies.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {extraCompetencies.length > 0 ? extraCompetencies.map((competency) => (
                    <div key={competency.id} className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-white dark:bg-gray-900/60 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{competency.areaName}</p>
                          {!competency.canDelete && (
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                              {getCompetencyDeleteBlockMessage(competency, 'REMOVE')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Extra
                          </span>
                          <button
                            type="button"
                            onClick={() => setExtraCompetencyToRemove(competency)}
                            disabled={!competency.canDelete}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Retirar ${competency.name} del aula`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aun no agregaste competencias adicionales.</p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 lg:col-span-2">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Competencias personalizadas</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Se heredan automaticamente del area del aula y solo se usan en esta clase.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {customCompetencies.length}
                    </span>
                    <button
                      type="button"
                      onClick={openExportCustomCompetenciesModal}
                      disabled={customCompetencies.length === 0}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy size={14} />
                      Exportar a mis clases
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {customCompetencies.length > 0 ? customCompetencies.map((competency) => (
                    <div key={competency.id} className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-gray-900/60 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Personalizada
                            </span>
                            {!competency.canDelete && getCompetencyDeleteStatusLabel(competency) && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {getCompetencyDeleteStatusLabel(competency)}
                              </span>
                            )}
                          </div>
                          {competency.shortName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Nombre corto: {competency.shortName}
                            </p>
                          )}
                          {competency.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{competency.description}</p>
                          )}
                          {!competency.canDelete && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                              {getCompetencyDeleteBlockMessage(competency, 'DELETE')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditCustomCompetencyModal(competency)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            aria-label={`Editar ${competency.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomCompetencyToDelete(competency)}
                            disabled={!competency.canDelete}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Eliminar ${competency.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-amber-200 dark:border-amber-900/40 bg-white/70 dark:bg-gray-900/30 px-4 py-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Todavia no creaste competencias personalizadas.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 lg:col-span-2">
                <div className="flex flex-col gap-3 mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">Destrezas por competencia</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Organiza evidencias debajo de cada competencia y permite que las destrezas aporten a la nota oficial cuando corresponda.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {totalCompetencyIndicators}
                      </span>
                      <button
                        type="button"
                        onClick={openIndicatorTransferModal}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      >
                        <ArrowRightLeft size={14} />
                        Gestionar destrezas
                      </button>
                    </div>
                  </div>

                  {classroom.competencyIndicatorStartPeriod && (
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        El desglose de destrezas se mostrara desde {formatBimesterLabel(classroom.competencyIndicatorStartPeriod)}. Los bimestres anteriores apareceran como historico sin desglose.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {classroomCompetencies.length > 0 ? classroomCompetencies.map((competency) => (
                    <div key={`indicator-${competency.id}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 px-3 py-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                            {competency.isBase && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Base
                              </span>
                            )}
                            {!competency.isBase && !competency.isCustom && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                Extra
                              </span>
                            )}
                            {competency.isCustom && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                Personalizada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{competency.areaName}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openCreateCompetencyIndicatorModal(competency)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                        >
                          <Plus size={14} />
                          Agregar destreza
                        </button>
                      </div>

                      {competency.indicators.length > 0 ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {competency.indicators.map((indicator) => (
                            <div key={indicator.id} className="rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-900/10 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 dark:text-white">{indicator.name}</p>
                                  {indicator.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{indicator.description}</p>
                                  )}
                                  {!indicator.canDelete && (
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
                                      Ya tiene comportamientos o evidencias asociadas. No se puede eliminar.
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditCompetencyIndicatorModal(competency, indicator)}
                                    className="p-2 rounded-lg text-gray-500 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800"
                                    aria-label={`Editar destreza ${indicator.name}`}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIndicatorToDelete({ competency, indicator })}
                                    disabled={!indicator.canDelete}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={`Eliminar destreza ${indicator.name}`}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-900/40 bg-white/70 dark:bg-gray-900/30 px-4 py-4 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Todavia no agregaste destrezas para esta competencia.</p>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-indigo-200 dark:border-indigo-900/40 bg-white/70 dark:bg-gray-900/30 px-4 py-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Primero habilita competencias en esta aula para poder crear destrezas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Sistema de calificacion</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Cambia la forma en que se muestran las notas. Se aplicara al guardar cambios.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {gradeScaleOptions.map((scale) => {
                  const isSelected = activeGradeScale === scale.value;

                  return (
                    <label
                      key={scale.value}
                      className={`flex min-h-[132px] cursor-pointer flex-col rounded-2xl border px-4 py-4 transition-all ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="gradeScaleType"
                          checked={isSelected}
                          onChange={() => setFormData((current) => ({ ...current, gradeScaleType: scale.value }))}
                          className="mt-1 h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-base font-semibold ${isSelected ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-800 dark:text-white'}`}>
                              {scale.label}
                            </p>
                            {isSelected && (
                              <span className="rounded-full bg-white/80 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                Activo
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-sm ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`}>
                            {scale.helper}
                          </p>
                          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
                            {scale.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

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

      <ConfirmModal
        isOpen={!!extraCompetencyToRemove}
        onClose={() => setExtraCompetencyToRemove(null)}
        onConfirm={() => {
          if (!extraCompetencyToRemove) {
            return;
          }

          removeCompetencyMutation.mutate(extraCompetencyToRemove.id);
        }}
        title="¿Retirar competencia adicional?"
        message={extraCompetencyToRemove
          ? `Se retirara "${extraCompetencyToRemove.name}" solo de esta clase. El catalogo oficial no se modificara.`
          : 'Esta accion no se puede deshacer.'}
        confirmText="Retirar"
        variant="warning"
        isLoading={removeCompetencyMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!customCompetencyToDelete}
        onClose={() => setCustomCompetencyToDelete(null)}
        onConfirm={() => {
          if (!customCompetencyToDelete) {
            return;
          }

          deleteCustomCompetencyMutation.mutate(customCompetencyToDelete.id);
        }}
        title="¿Eliminar competencia personalizada?"
        message={customCompetencyToDelete
          ? `Se eliminara "${customCompetencyToDelete.name}" del aula. Esta accion no se puede deshacer.`
          : 'Esta accion no se puede deshacer.'}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteCustomCompetencyMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!indicatorToDelete}
        onClose={() => setIndicatorToDelete(null)}
        onConfirm={() => {
          if (!indicatorToDelete) {
            return;
          }

          deleteCompetencyIndicatorMutation.mutate({
            competencyId: indicatorToDelete.competency.id,
            indicatorId: indicatorToDelete.indicator.id,
          });
        }}
        title="¿Eliminar destreza?"
        message={indicatorToDelete
          ? `Se eliminara "${indicatorToDelete.indicator.name}" de la competencia "${indicatorToDelete.competency.name}".`
          : 'Esta accion no se puede deshacer.'}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteCompetencyIndicatorMutation.isPending}
      />

      {showIndicatorTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeIndicatorTransferModal}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Transferir destrezas</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Solo se agregan faltantes y duplicados omitidos automáticamente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeIndicatorTransferModal}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[76vh] overflow-y-auto space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Acción</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleIndicatorTransferModeChange('IMPORT')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      indicatorTransferMode === 'IMPORT'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    {indicatorTransferMode === 'IMPORT' && <Check size={16} />}
                    Importar desde otra clase
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIndicatorTransferModeChange('EXPORT')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      indicatorTransferMode === 'EXPORT'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-900/60'
                    }`}
                  >
                    {indicatorTransferMode === 'EXPORT' && <Check size={16} />}
                    Exportar a mis clases
                  </button>
                </div>
              </div>

              {indicatorTransferMode === 'IMPORT' ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Origen</p>

                  {eligibleExportClassrooms.length > 0 ? (
                    <>
                      <select
                        value={selectedIndicatorTransferSourceClassroomId || ''}
                        onChange={(e) => {
                          setSelectedIndicatorTransferSourceClassroomId(e.target.value || null);
                          setSelectedIndicatorTransferCompetencyIds([]);
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Selecciona una clase</option>
                        {eligibleExportClassrooms.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>

                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{classroom.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Clase destino actual</p>
                        {selectedIndicatorTransferSourceClassroom && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Origen seleccionado: {selectedIndicatorTransferSourceClassroom.name}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No tienes otras clases elegibles para importar destrezas.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Clases destino</p>
                    <button
                      type="button"
                      onClick={toggleSelectAllIndicatorTransferTargetClassrooms}
                      disabled={eligibleExportClassrooms.length === 0}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {allIndicatorTransferTargetClassroomsSelected ? 'Quitar selección' : 'Seleccionar todas'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {exportTargetClassrooms.length > 0 ? exportTargetClassrooms.map((item) => {
                      const isEligible = item.useCompetencies && !!item.curriculumAreaId;
                      const isSelected = selectedIndicatorTransferTargetClassroomIds.includes(item.id);

                      return (
                        <label
                          key={item.id}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                            isEligible
                              ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-70 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => isEligible && toggleIndicatorTransferTargetClassroomSelection(item.id)}
                            disabled={!isEligible}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-800 dark:text-white">{item.name}</p>
                              {!isEligible && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  No elegible
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {isEligible ? 'Lista para recibir destrezas' : 'Activa competencias o configura el área curricular'}
                            </p>
                          </div>
                        </label>
                      );
                    }) : (
                      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No tienes otras clases creadas para exportar destrezas.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {indicatorTransferMode === 'IMPORT' ? 'Competencias disponibles' : 'Competencias a exportar'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Solo se muestran competencias que ya tienen destrezas configuradas.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSelectAllIndicatorTransferCompetencies}
                    disabled={indicatorTransferSelectableCompetencies.length === 0 || indicatorTransferPreviewLoading}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allIndicatorTransferCompetenciesSelected ? 'Quitar selección' : 'Seleccionar todas'}
                  </button>
                </div>

                {indicatorTransferPreviewLoading ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Cargando destrezas...
                  </div>
                ) : indicatorTransferSelectableCompetencies.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {indicatorTransferSelectableCompetencies.map((competency) => {
                      const isSelected = selectedIndicatorTransferCompetencyIds.includes(competency.id);

                      return (
                        <label
                          key={competency.id}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleIndicatorTransferCompetencySelection(competency.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                              {competency.isCustom && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Personalizada</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {competency.indicators.length} destreza(s){competency.areaName ? ` · ${competency.areaName}` : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    <BookOpen size={22} className="mx-auto mb-3 opacity-60" />
                    {indicatorTransferMode === 'IMPORT' && !selectedIndicatorTransferSourceClassroomId
                      ? 'Selecciona primero una clase de origen'
                      : 'Sin destrezas disponibles para esta selección'}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
                <input
                  type="checkbox"
                  checked={copyMissingTransferCustomCompetencies}
                  onChange={(e) => setCopyMissingTransferCustomCompetencies(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    Crear competencias personalizadas faltantes en el destino
                  </p>
                </div>
              </label>

              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4">
                  <p className="text-3xl font-semibold text-gray-900 dark:text-white">{indicatorTransferPreview.createdIndicators}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nuevas</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4">
                  <p className="text-3xl font-semibold text-gray-900 dark:text-white">{indicatorTransferPreview.createdCompetencies}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Creadas</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4">
                  <p className="text-3xl font-semibold text-gray-900 dark:text-white">{indicatorTransferPreview.skippedExistingIndicators}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Repetidas</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4">
                  <p className="text-3xl font-semibold text-gray-900 dark:text-white">{indicatorTransferPreview.skippedUnavailableCompetencies}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Incompatibles</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  Competencias seleccionadas: <span className="font-semibold text-gray-900 dark:text-white">{selectedIndicatorTransferCompetencies.length}</span>
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  {indicatorTransferMode === 'IMPORT' ? 'Clase destino' : 'Clases destino'}: <span className="font-semibold text-gray-900 dark:text-white">{indicatorTransferMode === 'IMPORT' ? 1 : selectedIndicatorTransferTargetClassroomIds.length}</span>
                </span>
              </div>

              {ineligibleExportClassrooms.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {ineligibleExportClassrooms.length} clase no elegible{ineligibleExportClassrooms.length > 1 ? 's' : ''}: activa competencias o configura el área curricular.
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 bg-gray-50 dark:bg-gray-900/40">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeIndicatorTransferModal}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleIndicatorTransferSubmit}
                  disabled={
                    transferCompetencyIndicatorsMutation.isPending
                    || indicatorTransferPreviewLoading
                    || selectedIndicatorTransferCompetencyIds.length === 0
                    || (indicatorTransferMode === 'IMPORT' && !selectedIndicatorTransferSourceClassroomId)
                    || (indicatorTransferMode === 'EXPORT' && selectedIndicatorTransferTargetClassroomIds.length === 0)
                    || !indicatorTransferHasLoadedTargets
                  }
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {transferCompetencyIndicatorsMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {indicatorTransferMode === 'IMPORT' ? 'Importar destrezas' : 'Exportar destrezas'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showExportCustomCompetenciesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeExportCustomCompetenciesModal}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exportar competencias personalizadas</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Se crearán copias independientes de las {customCompetencies.length} competencia(s) personalizada(s) en otras clases tuyas.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExportCustomCompetenciesModal}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Origen: {classroom.name}</p>
                  <p className="text-xs mt-1">Solo se pueden seleccionar clases con competencias habilitadas y área curricular configurada.</p>
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAllExportClassrooms}
                  disabled={eligibleExportClassrooms.length === 0}
                  className="px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allEligibleExportSelected ? 'Quitar selección' : 'Seleccionar todas'}
                </button>
              </div>

              <div className="space-y-2">
                {isLoadingMyClassrooms ? (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Cargando clases...
                  </div>
                ) : exportTargetClassrooms.length > 0 ? (
                  exportTargetClassrooms.map((targetClassroom) => {
                    const isEligible = targetClassroom.useCompetencies && !!targetClassroom.curriculumAreaId;
                    const isSelected = selectedExportClassroomIds.includes(targetClassroom.id);

                    return (
                      <label
                        key={targetClassroom.id}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          isEligible
                            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => isEligible && toggleExportClassroomSelection(targetClassroom.id)}
                          disabled={!isEligible}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{targetClassroom.name}</p>
                            {!isEligible && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                No elegible
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {targetClassroom.useCompetencies && targetClassroom.curriculumAreaId
                              ? 'Lista para recibir copias de estas competencias personalizadas.'
                              : 'Debes habilitar competencias y configurar un área curricular en esa clase.'}
                          </p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No tienes otras clases creadas para exportar estas competencias.
                  </div>
                )}
              </div>

              {ineligibleExportClassrooms.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ineligibleExportClassrooms.length} clase(s) no son elegibles porque aún no tienen competencias habilitadas o les falta el área curricular.
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Se exportarán {customCompetencies.length} competencia(s) a {selectedExportClassroomIds.length} clase(s) seleccionada(s).
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeExportCustomCompetenciesModal}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExportCustomCompetencies}
                  disabled={selectedExportClassroomIds.length === 0 || exportCustomCompetenciesMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exportCustomCompetenciesMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Exportar seleccionadas
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showCustomCompetencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeCustomCompetencyModal}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingCustomCompetency ? 'Editar competencia personalizada' : 'Crear competencia personalizada'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Se asociara automaticamente al area curricular actual del aula.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomCompetencyModal}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Area heredada: {activeArea?.name || 'Sin area configurada'}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Nombre
                </label>
                <input
                  value={customCompetencyForm.name}
                  onChange={(e) => setCustomCompetencyForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Ej: Explica procesos de su contexto"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Nombre corto
                </label>
                <input
                  value={customCompetencyForm.shortName}
                  onChange={(e) => setCustomCompetencyForm((current) => ({ ...current, shortName: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={customCompetencyForm.description}
                  onChange={(e) => setCustomCompetencyForm((current) => ({ ...current, description: e.target.value }))}
                  rows={4}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Esta competencia quedara disponible en actividades, evidencias y libro de calificaciones.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCustomCompetencyModal}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCustomCompetencySubmit}
                  disabled={createCustomCompetencyMutation.isPending || updateCustomCompetencyMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {(createCustomCompetencyMutation.isPending || updateCustomCompetencyMutation.isPending) && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {editingCustomCompetency ? 'Guardar cambios' : 'Crear competencia'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showCompetencyIndicatorModal && selectedIndicatorCompetency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeCompetencyIndicatorModal}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingCompetencyIndicator ? 'Editar destreza' : 'Crear destreza'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Competencia: {selectedIndicatorCompetency.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCompetencyIndicatorModal}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-200">
                Estas destrezas podran vincularse a comportamientos y, cuando corresponda, aportar a la nota oficial de la competencia.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Nombre
                </label>
                <input
                  value={competencyIndicatorForm.name}
                  onChange={(e) => setCompetencyIndicatorForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Ej: Argumenta con evidencias"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={competencyIndicatorForm.description}
                  onChange={(e) => setCompetencyIndicatorForm((current) => ({ ...current, description: e.target.value }))}
                  rows={4}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Luego podras seleccionar esta destreza desde la pantalla de comportamientos.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCompetencyIndicatorModal}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCompetencyIndicatorSubmit}
                  disabled={createCompetencyIndicatorMutation.isPending || updateCompetencyIndicatorMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {(createCompetencyIndicatorMutation.isPending || updateCompetencyIndicatorMutation.isPending) && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {editingCompetencyIndicator ? 'Guardar cambios' : 'Crear destreza'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showAddCompetenciesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddCompetenciesModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agregar competencias al aula</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Selecciona competencias adicionales de otras areas del mismo nivel educativo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCompetenciesModal(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={competencySearch}
                  onChange={(e) => setCompetencySearch(e.target.value)}
                  placeholder="Buscar competencia o area..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">Area base: {activeArea?.name || 'Sin area'}</span>
                <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">Seleccionadas: {selectedCompetencyIds.length}</span>
              </div>

              <div className="space-y-4">
                {availableCompetenciesByArea.length > 0 ? availableCompetenciesByArea.map((area) => (
                  <div key={area.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{area.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{area.competencies.length} competencia(s) disponibles</p>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {area.competencies.map((competency) => {
                        const isSelected = selectedCompetencyIds.includes(competency.id);
                        return (
                          <button
                            key={competency.id}
                            type="button"
                            onClick={() => toggleCompetencySelection(competency.id)}
                            className={`w-full flex items-start justify-between gap-4 px-4 py-3 text-left transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">{competency.name}</p>
                              {competency.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{competency.description}</p>
                              )}
                            </div>
                            <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check size={12} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay competencias adicionales disponibles con los filtros actuales.
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Las competencias agregadas quedaran disponibles en libro de calificaciones, actividades y asignacion de evidencias.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompetenciesModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => addCompetenciesMutation.mutate(selectedCompetencyIds)}
                  disabled={selectedCompetencyIds.length === 0 || addCompetenciesMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {addCompetenciesMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Agregar seleccionadas
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
