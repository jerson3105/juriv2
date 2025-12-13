import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Sparkles,
  Heart,
  Coins,
  Check,
  X,
  Zap,
  Trophy,
  TrendingUp,
  Crown,
  Swords,
  Star,
  Search,
  LayoutGrid,
  List,
  Eye,
  Medal,
  UserPlus,
  Download,
  Link2,
  Copy,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import { studentApi, CHARACTER_CLASSES, type PointType } from '../../lib/studentApi';
import { badgeApi, type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';
import { LevelUpAnimation } from '../../components/effects/LevelUpAnimation';
import { MultiPointsAnimation, useMultiPointsEffect } from '../../components/effects/PurchaseEffects';
import { TeacherBadgeAwardedModal } from '../../components/badges/TeacherBadgeAwardedModal';
import { AddPlaceholderStudentsModal } from '../../components/students/AddPlaceholderStudentsModal';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';

export const StudentsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [behaviorType, setBehaviorType] = useState<'positive' | 'negative'>('positive');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  // Estado para animación de subida de nivel
  const [, setLevelUpQueue] = useState<Array<{ studentName: string; newLevel: number }>>([]);
  const [currentLevelUp, setCurrentLevelUp] = useState<{ studentName: string; newLevel: number } | null>(null);
  
  // Estado para modal de insignias otorgadas automáticamente
  const [awardedBadgeInfo, setAwardedBadgeInfo] = useState<{
    badge: Badge | null;
    studentNames: string[];
  }>({ badge: null, studentNames: [] });

  // Estado para modal de añadir estudiantes placeholder
  const [showAddPlaceholderModal, setShowAddPlaceholderModal] = useState(false);

  // Hook para animación de puntos
  const { effect: pointsEffect, showMultiPointsEffect, hideMultiPointsEffect } = useMultiPointsEffect();

  const { data: classroomData, isLoading } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const { data: behaviors } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });

  // Estudiantes placeholder (sin cuenta vinculada)
  const { data: placeholderStudents = [] } = useQuery({
    queryKey: ['placeholder-students', classroom.id],
    queryFn: () => placeholderStudentApi.getAll(classroom.id),
  });

  const applyBehaviorMutation = useMutation({
    mutationFn: (data: any) => behaviorApi.apply(data),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      setSelectedStudents(new Set());
      setShowBehaviorModal(false);
      
      // Mostrar animación de puntos
      const behavior = result.behavior;
      const xp = behavior.xpValue || (behavior.pointType === 'XP' ? behavior.pointValue : 0);
      const hp = behavior.hpValue || (behavior.pointType === 'HP' ? behavior.pointValue : 0);
      const gp = behavior.gpValue || (behavior.pointType === 'GP' ? behavior.pointValue : 0);
      
      if (xp > 0 || hp > 0 || gp > 0) {
        showMultiPointsEffect(xp, hp, gp, behavior.isPositive);
      }
      
      toast.success(`${result.behavior.name} aplicado a ${result.studentsAffected} estudiante(s)`);
      
      // Si hay subidas de nivel, mostrar animación
      if (result.levelUps && result.levelUps.length > 0) {
        setLevelUpQueue(result.levelUps);
        setCurrentLevelUp(result.levelUps[0]);
      }
      
      // Si hay insignias otorgadas, mostrar modal consolidado
      if (result.awardedBadges && result.awardedBadges.length > 0) {
        // Agrupar por insignia (todas las insignias otorgadas deberían ser la misma)
        const badgeNames = result.awardedBadges.flatMap(ab => ab.badges);
        const uniqueBadgeName = badgeNames[0]; // Tomar la primera (deberían ser todas iguales)
        
        // Obtener los nombres de estudiantes que ganaron la insignia
        const studentNames = result.awardedBadges
          .filter(ab => ab.badges.includes(uniqueBadgeName))
          .map(ab => {
            const studentResult = result.results.find(r => r.studentId === ab.studentId);
            return studentResult?.studentName || 'Estudiante';
          });
        
        // Obtener la insignia completa desde la API
        try {
          const badges = await badgeApi.getClassroomBadges(classroom.id);
          const badge = badges.find((b: Badge) => b.name === uniqueBadgeName);
          if (badge) {
            setAwardedBadgeInfo({ badge, studentNames });
          }
        } catch {
          // Error al obtener info de insignia - ignorar silenciosamente
        }
      }
    },
    onError: () => {
      toast.error('Error al aplicar comportamiento');
    },
  });

  // Manejar cola de animaciones de nivel
  const handleLevelUpComplete = () => {
    setLevelUpQueue(prev => {
      const newQueue = prev.slice(1);
      if (newQueue.length > 0) {
        setCurrentLevelUp(newQueue[0]);
      } else {
        setCurrentLevelUp(null);
      }
      return newQueue;
    });
  };

  const allStudents = classroomData?.students || [];
  
  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: typeof allStudents[0]) => {
    if (classroom.showCharacterName === false) {
      // Mostrar nombre real
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      }
      return student.realName || student.characterName || 'Sin nombre';
    }
    // Mostrar nombre de personaje (por defecto)
    return student.characterName || 'Sin nombre';
  };

  // Filtrar estudiantes por búsqueda
  const students = allStudents.filter((student) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const displayName = getDisplayName(student).toLowerCase();
    const realName = `${student.realName || ''} ${student.realLastName || ''}`.toLowerCase();
    const className = CHARACTER_CLASSES[student.characterClass]?.name.toLowerCase() || '';
    return displayName.includes(query) || realName.includes(query) || className.includes(query);
  });

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const selectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const openBehaviorModal = (type: 'positive' | 'negative') => {
    if (selectedStudents.size === 0) {
      toast.error('Selecciona al menos un estudiante');
      return;
    }
    setBehaviorType(type);
    setShowBehaviorModal(true);
  };

  const applyBehavior = (behavior: Behavior) => {
    applyBehaviorMutation.mutate({
      behaviorId: behavior.id,
      studentIds: Array.from(selectedStudents),
    });
  };

  const positiveBehaviors = behaviors?.filter((b) => b.isPositive) || [];
  const negativeBehaviors = behaviors?.filter((b) => !b.isPositive) || [];

  // Funciones para estudiantes placeholder
  const copyLinkCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  const downloadAllPDFs = async () => {
    if (placeholderStudents.length === 0) {
      toast.error('No hay estudiantes sin vincular');
      return;
    }
    try {
      await placeholderStudentApi.downloadAllCardsPDF(classroom.id);
      toast.success('PDF descargado');
    } catch (error) {
      toast.error('Error al descargar PDF');
    }
  };

  // Verificar si un estudiante es placeholder (tiene linkCode)
  const getStudentLinkCode = (studentId: string): string | null => {
    const placeholder = placeholderStudents.find(p => p.id === studentId);
    return placeholder?.linkCode || null;
  };

  // Calcular estadísticas del curso
  const totalXP = students.reduce((sum, s) => sum + s.xp, 0);
  const totalGP = students.reduce((sum, s) => sum + s.gp, 0);
  const avgLevel = students.length > 0 
    ? Math.round(students.reduce((sum, s) => sum + s.level, 0) / students.length * 10) / 10
    : 0;
  const topStudent = students.length > 0 
    ? [...students].sort((a, b) => b.xp - a.xp)[0]
    : null;
  const topStudentClass = topStudent ? CHARACTER_CLASSES[topStudent.characterClass] : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Animación de puntos */}
      <MultiPointsAnimation
        show={pointsEffect.show}
        xp={pointsEffect.xp}
        hp={pointsEffect.hp}
        gp={pointsEffect.gp}
        isPositive={pointsEffect.isPositive}
        onComplete={hideMultiPointsEffect}
      />

      {/* Animación de subida de nivel */}
      {currentLevelUp && (
        <LevelUpAnimation
          show={true}
          newLevel={currentLevelUp.newLevel}
          onComplete={handleLevelUpComplete}
        />
      )}

      {/* Banner de estadísticas del curso */}
      {students.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Título */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div>
                <h2 className="text-lg lg:text-xl font-bold">Resumen del Curso</h2>
                <p className="text-indigo-200 text-xs lg:text-sm">¡Sigue motivando a tus estudiantes!</p>
              </div>
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-3 lg:gap-6">
              {/* XP Total */}
              <div className="text-center bg-white/10 rounded-lg p-2 lg:p-0 lg:bg-transparent">
                <div className="flex items-center justify-center gap-1 text-emerald-300">
                  <Sparkles size={16} className="lg:w-[18px] lg:h-[18px]" />
                  <span className="text-xl lg:text-2xl font-bold">{totalXP.toLocaleString()}</span>
                </div>
                <p className="text-xs text-indigo-200">XP Total</p>
              </div>

              {/* Oro Total */}
              <div className="text-center bg-white/10 rounded-lg p-2 lg:p-0 lg:bg-transparent">
                <div className="flex items-center justify-center gap-1 text-amber-300">
                  <Coins size={16} className="lg:w-[18px] lg:h-[18px]" />
                  <span className="text-xl lg:text-2xl font-bold">{totalGP.toLocaleString()}</span>
                </div>
                <p className="text-xs text-indigo-200">Oro Total</p>
              </div>

              {/* Nivel Promedio */}
              <div className="text-center bg-white/10 rounded-lg p-2 lg:p-0 lg:bg-transparent">
                <div className="flex items-center justify-center gap-1 text-blue-300">
                  <TrendingUp size={16} className="lg:w-[18px] lg:h-[18px]" />
                  <span className="text-xl lg:text-2xl font-bold">{avgLevel}</span>
                </div>
                <p className="text-xs text-indigo-200">Nivel Promedio</p>
              </div>

              {/* Top Estudiante */}
              {topStudent && (
                <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-center justify-center lg:justify-start gap-3 bg-white/10 rounded-xl px-3 py-2">
                  <div className="relative">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center text-lg lg:text-xl">
                      {topStudentClass?.icon}
                    </div>
                    <Crown className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-400 absolute -top-1 -right-1 lg:-top-2 lg:-right-2" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200">Líder en XP</p>
                    <p className="font-bold text-sm lg:text-base">{getDisplayName(topStudent)}</p>
                    <p className="text-xs text-emerald-300">{topStudent.xp} XP</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Header con acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Lista de Estudiantes
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {students.length} estudiante{students.length !== 1 ? 's' : ''} en la clase
            </p>
          </div>
        </div>

        {students.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {selectedStudents.size} seleccionado{selectedStudents.size !== 1 ? 's' : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openBehaviorModal('positive')}
              disabled={selectedStudents.size === 0}
              data-onboarding="give-points-btn"
              className="!bg-green-500 hover:!bg-green-600 !text-white text-xs sm:text-sm px-2 sm:px-3"
            >
              <Zap size={14} className="sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Dar puntos</span>
              <span className="sm:hidden">Dar</span>
            </Button>
            {classroom.allowNegativePoints !== false && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openBehaviorModal('negative')}
                disabled={selectedStudents.size === 0}
                className="!bg-red-500 hover:!bg-red-600 !text-white text-xs sm:text-sm px-2 sm:px-3"
              >
                <Zap size={14} className="sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Quitar puntos</span>
                <span className="sm:hidden">Quitar</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBadgeModal(true)}
              disabled={selectedStudents.size === 0}
              className="!bg-amber-500 hover:!bg-amber-600 !text-white text-xs sm:text-sm px-2 sm:px-3"
            >
              <Medal size={14} className="sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Dar insignia</span>
              <span className="sm:hidden">Insignia</span>
            </Button>
          </div>
        )}
      </div>

      {/* Lista de estudiantes - Grid de Cards RPG */}
      {allStudents.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Sin estudiantes
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Comparte el código <span className="font-mono font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">{classroom.code}</span> con tus estudiantes
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowAddPlaceholderModal(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Añadir estudiantes sin cuenta
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Crea estudiantes que podrán vincular su cuenta después
          </p>
        </Card>
      ) : (
        <>
          {/* Toolbar con búsqueda */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar estudiante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Seleccionar todos */}
            <button
              onClick={selectAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-2"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedStudents.size === students.length && students.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-500'
              }`}>
                {selectedStudents.size === students.length && students.length > 0 && <Check size={12} className="text-white" />}
              </div>
              {selectedStudents.size === students.length && students.length > 0 ? 'Deseleccionar' : 'Seleccionar todos'}
            </button>

            {/* Toggle de vista */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'cards' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title="Vista de tarjetas"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title="Vista de lista"
              >
                <List size={18} />
              </button>
            </div>

            {/* Contador */}
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {students.length === allStudents.length 
                  ? `${students.length} héroes` 
                  : `${students.length} de ${allStudents.length} héroes`
                }
              </span>
            </div>

            {/* Botones para estudiantes placeholder */}
            <div className="flex items-center gap-2 ml-auto">
              {placeholderStudents.length > 0 && (
                <button
                  onClick={downloadAllPDFs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  title="Descargar tarjetas de vinculación"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Tarjetas PDF</span>
                  <span className="text-xs bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded-full">
                    {placeholderStudents.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => setShowAddPlaceholderModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                title="Añadir estudiantes sin cuenta"
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">Añadir sin cuenta</span>
              </button>
            </div>
          </div>

          {/* Mensaje cuando no hay resultados de búsqueda */}
          {students.length === 0 && searchQuery.trim() && (
            <div className="text-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
                No se encontraron resultados
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                No hay estudiantes que coincidan con "<span className="font-medium">{searchQuery}</span>"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}

          {/* Vista de Cards */}
          {viewMode === 'cards' && students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student, index) => {
              const classInfo = CHARACTER_CLASSES[student.characterClass];
              const isSelected = selectedStudents.has(student.id);
              // Calcular XP para el nivel actual y siguiente (sistema progresivo)
              const xpPerLevel = (classroom as any).xpPerLevel || 100;
              const lvl = student.level;
              const xpForCurrentLevel = (xpPerLevel * lvl * (lvl - 1)) / 2;
              const xpForNextLevel = (xpPerLevel * (lvl + 1) * lvl) / 2;
              const xpInLevel = student.xp - xpForCurrentLevel;
              const xpNeeded = xpForNextLevel - xpForCurrentLevel;
              const xpProgress = Math.min((xpInLevel / xpNeeded) * 100, 100);
              const hpPercent = Math.min((student.hp / (classroom.maxHp || 100)) * 100, 100);
              const isTopStudent = topStudent?.id === student.id;

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => toggleStudent(student.id)}
                  data-onboarding={index === 0 ? 'student-card' : undefined}
                  className={`
                    relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300
                    ${isSelected 
                      ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-lg shadow-indigo-500/20' 
                      : 'hover:shadow-lg hover:-translate-y-1'
                    }
                  `}
                >
                  {/* Card Background con gradiente según clase */}
                  <div className={`
                    absolute inset-0 bg-gradient-to-br
                    ${student.characterClass === 'GUARDIAN' ? 'from-blue-500/10 to-cyan-500/10' : ''}
                    ${student.characterClass === 'ARCANE' ? 'from-purple-500/10 to-pink-500/10' : ''}
                    ${student.characterClass === 'EXPLORER' ? 'from-green-500/10 to-emerald-500/10' : ''}
                    ${student.characterClass === 'ALCHEMIST' ? 'from-amber-500/10 to-orange-500/10' : ''}
                  `} />

                  <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
                    {/* Checkbox de selección */}
                    <div className="absolute top-3 left-3 z-10">
                      <div className={`
                        w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                        ${isSelected
                          ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/30'
                          : 'border-gray-300 bg-white/80 hover:border-indigo-400'
                        }
                      `}>
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                    </div>

                    {/* Badge de líder */}
                    {isTopStudent && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                          <Crown size={12} />
                          <span>Líder</span>
                        </div>
                      </div>
                    )}

                    {/* Layout horizontal: Avatar izquierda, Info derecha */}
                    <div className="flex gap-4 pt-6">
                      {/* Avatar del estudiante - Izquierda */}
                      <div className="flex-shrink-0">
                        <div className={`
                          relative w-[120px] h-[210px] rounded-xl overflow-hidden
                          bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50
                          border-2 ${isSelected ? 'border-indigo-400' : 'border-gray-200'}
                        `}>
                          <StudentAvatarMini
                            studentProfileId={student.id}
                            gender={student.avatarGender || 'MALE'}
                            size="xl"
                            className="absolute top-0 left-1/2 -translate-x-1/2 scale-[0.47] origin-top"
                          />
                          {/* Nivel badge */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                            <div className="flex items-center gap-0.5 bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                              <Star size={12} className="text-amber-400 fill-amber-400" />
                              <span>Nv.{student.level}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Información del estudiante - Derecha */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        {/* Nombre y clase */}
                        <div className="mb-3">
                          <h3 className="font-bold text-gray-800 dark:text-white text-lg truncate">
                            {getDisplayName(student)}
                          </h3>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <span className="text-base">{classInfo?.icon}</span>
                            <span>{classInfo?.name}</span>
                          </div>
                          {/* Clan del estudiante */}
                          {classroom.clansEnabled && (
                            <div className="mt-1">
                              {(student as any).clanName ? (
                                <span 
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: (student as any).clanColor || '#6366f1' }}
                                >
                                  🛡️ {(student as any).clanName}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Sin clan</span>
                              )}
                            </div>
                          )}
                          {/* Código de vinculación para estudiantes placeholder */}
                          {getStudentLinkCode(student.id) && (
                            <div className="mt-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyLinkCode(getStudentLinkCode(student.id)!);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                title="Clic para copiar código"
                              >
                                <Link2 size={12} />
                                <span className="font-mono font-bold tracking-wider">{getStudentLinkCode(student.id)}</span>
                                <Copy size={10} className="opacity-50" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Barras de stats */}
                        <div className="space-y-2">
                          {/* HP Bar */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="flex items-center gap-1 text-red-600 font-medium">
                                <Heart size={11} className="fill-red-500" />
                                HP
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-[10px]">{student.hp}/{classroom.maxHp || 100}</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${hpPercent}%` }}
                                className={`h-full rounded-full ${
                                  hpPercent > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                  hpPercent > 25 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                                  'bg-gradient-to-r from-red-400 to-red-600'
                                }`}
                              />
                            </div>
                          </div>

                          {/* XP Bar */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                <Sparkles size={11} />
                                XP
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-[10px]">{xpInLevel}/{xpNeeded}</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${xpProgress}%` }}
                                className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stats numéricos */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            <Sparkles size={14} className="text-indigo-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-200">{student.xp}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Coins size={14} className="text-amber-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-200">{student.gp}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart size={14} className="text-red-500" />
                            <span className="font-bold text-gray-700 dark:text-gray-200">{student.hp}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}

          {/* Vista de Lista */}
          {viewMode === 'list' && students.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estudiante</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nivel</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">XP</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">HP</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">GP</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {students.map((student) => {
                    const classInfo = CHARACTER_CLASSES[student.characterClass];
                    const isSelected = selectedStudents.has(student.id);
                    const hpPercent = Math.min((student.hp / (classroom.maxHp || 100)) * 100, 100);
                    const isTopStudent = topStudent?.id === student.id;

                    return (
                      <tr 
                        key={student.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleStudent(student.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'
                            }`}
                          >
                            {isSelected && <Check size={12} className="text-white" />}
                          </button>
                        </td>

                        {/* Estudiante */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                              <StudentAvatarMini
                                studentProfileId={student.id}
                                gender={student.avatarGender || 'MALE'}
                                size="xl"
                                className="scale-[0.22] origin-top"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-white">{getDisplayName(student)}</span>
                                {isTopStudent && <Crown size={14} className="text-amber-500" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <span className="text-lg leading-none">{classInfo?.icon || '🎮'}</span>
                                <span>{classInfo?.name || 'Sin clase'}</span>
                                {classroom.clansEnabled && (
                                  <>
                                    <span className="text-gray-300">•</span>
                                    {(student as any).clanName ? (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-white text-[10px]"
                                        style={{ backgroundColor: (student as any).clanColor || '#6366f1' }}
                                      >
                                        {(student as any).clanName}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 italic">Sin clan</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Nivel */}
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-sm font-medium">
                            <Star size={12} className="fill-amber-500 text-amber-500" />
                            {student.level}
                          </div>
                        </td>

                        {/* XP */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-emerald-600 font-medium">
                            <Sparkles size={14} />
                            {student.xp}
                          </div>
                        </td>

                        {/* HP */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Heart size={14} className="text-red-500 flex-shrink-0" />
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                              <div 
                                className={`h-full rounded-full ${
                                  hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${hpPercent}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 w-16">{student.hp}/{classroom.maxHp || 100}</span>
                          </div>
                        </td>

                        {/* GP */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-600 font-medium">
                            <Coins size={14} />
                            {student.gp}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/classroom/${classroom.id}/student/${student.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                          >
                            <Eye size={14} />
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modal de puntos con tabs */}
      <PointsModal
        isOpen={showBehaviorModal}
        onClose={() => setShowBehaviorModal(false)}
        isPositive={behaviorType === 'positive'}
        selectedCount={selectedStudents.size}
        behaviors={behaviorType === 'positive' ? positiveBehaviors : negativeBehaviors}
        onApplyBehavior={applyBehavior}
        onApplyManual={async (pointType, amount, reason) => {
          // Aplicar manualmente a todos los estudiantes seleccionados
          const levelUps: Array<{ studentName: string; newLevel: number }> = [];
          
          for (const studentId of selectedStudents) {
            const result = await studentApi.updatePoints(studentId, {
              pointType,
              amount: behaviorType === 'positive' ? amount : -amount,
              reason,
            });
            
            // Verificar si hubo subida de nivel
            if (result.leveledUp && result.newLevel) {
              levelUps.push({
                studentName: result.studentName,
                newLevel: result.newLevel,
              });
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
          setSelectedStudents(new Set());
          setShowBehaviorModal(false);
          toast.success(`Puntos aplicados a ${selectedStudents.size} estudiante(s)`);
          
          // Mostrar animación de subida de nivel si hay
          if (levelUps.length > 0) {
            setLevelUpQueue(levelUps);
            setCurrentLevelUp(levelUps[0]);
          }
        }}
        isLoading={applyBehaviorMutation.isPending}
        classroomId={classroom.id}
      />

      {/* Modal de insignias */}
      <BadgeAwardModal
        isOpen={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
        classroomId={classroom.id}
        selectedStudentIds={Array.from(selectedStudents)}
        studentNames={Array.from(selectedStudents).map(id => {
          const student = allStudents.find(s => s.id === id);
          return student ? getDisplayName(student) : 'Estudiante';
        })}
        onSuccess={(badge, names) => {
          setSelectedStudents(new Set());
          setShowBadgeModal(false);
          // Mostrar animación de insignia otorgada
          setAwardedBadgeInfo({ badge, studentNames: names });
        }}
      />

      {/* Modal de insignia otorgada automáticamente (para el profesor) */}
      <TeacherBadgeAwardedModal
        badge={awardedBadgeInfo.badge}
        studentNames={awardedBadgeInfo.studentNames}
        isOpen={!!awardedBadgeInfo.badge}
        onClose={() => setAwardedBadgeInfo({ badge: null, studentNames: [] })}
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
    </div>
  );
};

// Modal para otorgar insignias desde lista de estudiantes
const BadgeAwardModal = ({
  isOpen,
  onClose,
  classroomId,
  selectedStudentIds,
  studentNames,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  selectedStudentIds: string[];
  studentNames: string[];
  onSuccess: (badge: Badge, studentNames: string[]) => void;
}) => {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Obtener insignias de la clase
  const { data: badges = [], isLoading: loadingBadges } = useQuery({
    queryKey: ['badges', classroomId],
    queryFn: () => badgeApi.getClassroomBadges(classroomId),
    enabled: isOpen,
  });

  // Mostrar todas las insignias
  const manualBadges = badges;

  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBadge) return;
      for (const studentId of selectedStudentIds) {
        await badgeApi.awardBadge(studentId, selectedBadge.id, reason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      toast.success(`Insignia "${selectedBadge?.name}" otorgada a ${selectedStudentIds.length} estudiante(s)`);
      if (selectedBadge) {
        onSuccess(selectedBadge, studentNames);
      }
      setSelectedBadge(null);
      setReason('');
    },
    onError: () => {
      toast.error('Error al otorgar insignia');
    },
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Medal size={24} />
                <h2 className="font-bold text-lg">Dar Insignia</h2>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-white/80 mt-1">
              {selectedStudentIds.length} estudiante(s) seleccionado(s)
            </p>
          </div>

          {/* Lista de insignias */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingBadges ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Cargando insignias...</p>
              </div>
            ) : manualBadges.length === 0 ? (
              <div className="text-center py-8">
                <Medal className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No hay insignias disponibles</p>
                <p className="text-sm text-gray-400 mt-1">
                  Crea insignias en Gamificación → Insignias
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {manualBadges.map((badge: Badge) => {
                  const colors = RARITY_COLORS[badge.rarity];
                  return (
                    <button
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        selectedBadge?.id === badge.id
                          ? `${colors.bg} ${colors.border}`
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${colors.gradient}`}>
                        <span className="text-2xl">{badge.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800 dark:text-white">{badge.name}</p>
                          {badge.assignmentMode === 'AUTOMATIC' && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Auto</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{badge.description}</p>
                        <span className={`text-xs font-medium ${colors.text}`}>
                          {RARITY_LABELS[badge.rarity]}
                        </span>
                      </div>
                      {selectedBadge?.id === badge.id && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Razón y botón */}
          {selectedBadge && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Razón (opcional)"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
              />
              <Button
                onClick={() => awardMutation.mutate()}
                disabled={awardMutation.isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {awardMutation.isPending ? 'Otorgando...' : `Dar "${selectedBadge.name}"`}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal de puntos con tabs
const PointsModal = ({
  isOpen,
  onClose,
  isPositive,
  selectedCount,
  behaviors,
  onApplyBehavior,
  onApplyManual,
  isLoading,
  classroomId,
}: {
  isOpen: boolean;
  onClose: () => void;
  isPositive: boolean;
  selectedCount: number;
  behaviors: Behavior[];
  onApplyBehavior: (behavior: Behavior) => void;
  onApplyManual: (pointType: PointType, amount: number, reason: string) => Promise<void>;
  isLoading: boolean;
  classroomId: string;
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'behaviors' | 'manual'>('behaviors');
  const [manualPointType, setManualPointType] = useState<PointType>('XP');
  const [manualAmount, setManualAmount] = useState(10);
  const [manualReason, setManualReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onApplyManual(manualPointType, manualAmount, manualReason);
      setManualReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isPositive ? '✨ Dar puntos' : '⚡ Quitar puntos'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div data-onboarding="points-modal-tabs" className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('behaviors')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'behaviors'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Comportamientos
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              data-onboarding="manual-tab-btn"
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Manual
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-96">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Aplicar a {selectedCount} estudiante{selectedCount !== 1 ? 's' : ''}
            </p>

            {/* Tab: Comportamientos */}
            {activeTab === 'behaviors' && (
              <>
                {behaviors.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No hay comportamientos configurados
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onClose();
                        navigate(`/classroom/${classroomId}/behaviors`);
                      }}
                    >
                      Configurar comportamientos
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {behaviors.map((behavior) => (
                      <button
                        key={behavior.id}
                        onClick={() => onApplyBehavior(behavior)}
                        disabled={isLoading}
                        className={`
                          w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all
                          hover:scale-[1.02] active:scale-[0.98]
                          ${isPositive
                            ? 'border-green-200 dark:border-green-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                            : 'border-red-200 dark:border-red-800 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{behavior.icon || (isPositive ? '⭐' : '💔')}</span>
                          <div className="text-left">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {behavior.name}
                            </p>
                            {behavior.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {behavior.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const xp = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
                            const hp = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
                            const gp = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);
                            const sign = isPositive ? '+' : '-';
                            const rewards = [];
                            if (xp > 0) rewards.push(<span key="xp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{sign}{xp} XP</span>);
                            if (hp > 0) rewards.push(<span key="hp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">{sign}{hp} HP</span>);
                            if (gp > 0) rewards.push(<span key="gp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{sign}{gp} GP</span>);
                            return rewards.length > 0 ? rewards : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">0</span>;
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tab: Manual */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} data-onboarding="manual-section" className="space-y-4">
                {/* Tipo de punto */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Tipo de punto
                  </label>
                  <div className="flex gap-2">
                    {(['XP', 'HP', 'GP'] as PointType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setManualPointType(type)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                          manualPointType === type
                            ? isPositive
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {type === 'XP' && <Sparkles size={16} />}
                        {type === 'HP' && <Heart size={16} />}
                        {type === 'GP' && <Coins size={16} />}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-3">
                    {[5, 10, 25, 50].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setManualAmount(val)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          manualAmount === val
                            ? isPositive
                              ? 'bg-green-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                    <Input
                      type="number"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(parseInt(e.target.value) || 0)}
                      className="w-20 text-center"
                      min={1}
                    />
                  </div>
                </div>

                {/* Razón */}
                <Input
                  label="Razón"
                  placeholder="Ej: Participación en clase, tarea completada..."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  className={`w-full ${isPositive ? '!bg-green-500 hover:!bg-green-600' : '!bg-red-500 hover:!bg-red-600'}`}
                  isLoading={isSubmitting}
                  disabled={!manualReason.trim() || manualAmount <= 0}
                >
                  {isPositive ? 'Agregar' : 'Quitar'} {manualAmount} {manualPointType}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
