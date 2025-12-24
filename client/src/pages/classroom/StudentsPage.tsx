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
  TrendingUp,
  Crown,
  Star,
  Search,
  LayoutGrid,
  List,
  Eye,
  Medal,
  Link2,
  Copy,
  ChevronLeft,
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
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

      {/* Header compacto: Stats + Toggle vista */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Izquierda: Label + Stats del curso */}
        <div className="flex items-center gap-2 sm:gap-4 text-sm flex-1 min-w-0 overflow-x-auto">
          <span className="hidden sm:inline text-xs font-medium text-gray-500 dark:text-gray-400 pr-2 border-r border-gray-200 dark:border-gray-600">
            Resumen de la clase
          </span>
          <div className="flex items-center gap-1.5" title="XP Total">
            <Sparkles size={14} className="text-emerald-500" />
            <span className="font-bold text-gray-700 dark:text-gray-200">{totalXP.toLocaleString()}</span>
            <span className="text-xs text-gray-400">XP</span>
          </div>
          <div className="flex items-center gap-1.5" title="Oro Total">
            <Coins size={14} className="text-amber-500" />
            <span className="font-bold text-gray-700 dark:text-gray-200">{totalGP.toLocaleString()}</span>
            <span className="text-xs text-gray-400">GP</span>
          </div>
          <div className="flex items-center gap-1.5" title="Nivel Promedio">
            <TrendingUp size={14} className="text-blue-500" />
            <span className="font-bold text-gray-700 dark:text-gray-200">{avgLevel}</span>
            <span className="text-xs text-gray-400">Nv</span>
          </div>
          {topStudent && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200 dark:border-gray-600" title="Líder en XP">
              <Crown size={14} className="text-amber-500" />
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{getDisplayName(topStudent)}</span>
            </div>
          )}
        </div>

        {/* Derecha: Acciones masivas + Toggle vista */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Acciones masivas - Solo en vista lista, ocultas en móvil */}
          {viewMode === 'list' && students.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              {/* Seleccionar todos */}
              <button
                onClick={selectAll}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1.5"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedStudents.size === students.length && students.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {selectedStudents.size === students.length && students.length > 0 && <Check size={10} className="text-white" />}
                </div>
                <span className="hidden md:inline">{selectedStudents.size > 0 ? `${selectedStudents.size}` : 'Todos'}</span>
              </button>

              {/* Botones de acción - Solo iconos en pantallas pequeñas */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openBehaviorModal('positive')}
                disabled={selectedStudents.size === 0}
                data-onboarding="give-points-btn"
                className="!bg-green-500 hover:!bg-green-600 !text-white text-xs px-2 py-1.5"
              >
                <Zap size={14} />
                <span className="hidden lg:inline ml-1">Dar puntos</span>
              </Button>
              {classroom.allowNegativePoints !== false && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openBehaviorModal('negative')}
                  disabled={selectedStudents.size === 0}
                  className="!bg-red-500 hover:!bg-red-600 !text-white text-xs px-2 py-1.5"
                >
                  <Zap size={14} />
                  <span className="hidden lg:inline ml-1">Quitar</span>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBadgeModal(true)}
                disabled={selectedStudents.size === 0}
                className="!bg-amber-500 hover:!bg-amber-600 !text-white text-xs px-2 py-1.5"
              >
                <Medal size={14} />
                <span className="hidden lg:inline ml-1">Insignia</span>
              </Button>
            </div>
          )}

          {/* Toggle de vista - Siempre visible, al final */}
          <div className="flex items-center bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-0.5 border border-indigo-200 dark:border-indigo-800">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
              title="Vista de lista"
            >
              <List size={18} />
            </button>
          </div>
        </div>
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

          {/* Vista de Cards - Layout Dividido */}
          {viewMode === 'cards' && students.length > 0 && (() => {
            // Obtener estudiante seleccionado para el panel de detalle
            const detailStudent = selectedStudentId 
              ? students.find(s => s.id === selectedStudentId) || students[0]
              : students[0];
            const detailClassInfo = detailStudent ? CHARACTER_CLASSES[detailStudent.characterClass] : null;
            const xpPerLevel = (classroom as any).xpPerLevel || 100;
            const lvl = detailStudent?.level || 1;
            const xpForCurrentLevel = (xpPerLevel * lvl * (lvl - 1)) / 2;
            const xpForNextLevel = (xpPerLevel * (lvl + 1) * lvl) / 2;
            const xpInLevel = (detailStudent?.xp || 0) - xpForCurrentLevel;
            const xpNeeded = xpForNextLevel - xpForCurrentLevel;
            const xpProgress = Math.min((xpInLevel / xpNeeded) * 100, 100);
            const hpPercent = detailStudent ? Math.min((detailStudent.hp / (classroom.maxHp || 100)) * 100, 100) : 100;
            const isTopStudent = topStudent?.id === detailStudent?.id;

            return (
              <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] min-h-[400px] lg:min-h-[500px]">
                {/* Sidebar izquierda - Lista compacta (oculta en móvil si hay estudiante seleccionado) */}
                <div className={`${selectedStudentId ? 'hidden lg:flex' : 'flex'} w-full lg:w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-col`}>
                  {/* Búsqueda en sidebar */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {students.map((student) => {
                      const classInfo = CHARACTER_CLASSES[student.characterClass];
                      const isActive = detailStudent?.id === student.id;
                      
                      return (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-l-4 transition-all ${
                            isActive 
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-indigo-500' 
                              : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          {/* Info del estudiante */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{classInfo?.icon}</span>
                              <span className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                {getDisplayName(student)}
                              </span>
                              {topStudent?.id === student.id && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>Nv.{student.level}</span>
                              <span>•</span>
                              <span className="text-emerald-600">{student.xp} XP</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Panel central - Detalle del estudiante */}
                {detailStudent && (
                  <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    {/* Header con gradiente */}
                    <div className={`relative h-32 bg-gradient-to-br ${
                      detailStudent.characterClass === 'GUARDIAN' ? 'from-blue-500 to-cyan-600' :
                      detailStudent.characterClass === 'ARCANE' ? 'from-purple-500 to-pink-600' :
                      detailStudent.characterClass === 'EXPLORER' ? 'from-green-500 to-emerald-600' :
                      'from-amber-500 to-orange-600'
                    }`}>
                      {/* Botón volver en móvil */}
                      <button
                        onClick={() => setSelectedStudentId(null)}
                        className="lg:hidden absolute top-3 left-3 flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-full hover:bg-white/30 transition-colors"
                      >
                        <ChevronLeft size={14} />
                        <span>Lista</span>
                      </button>
                      {isTopStudent && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/20 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-full">
                          <Crown size={12} />
                          <span>Líder en XP</span>
                        </div>
                      )}
                    </div>

                    {/* Contenido principal */}
                    <div className="flex-1 p-4 lg:p-6 -mt-16 overflow-hidden">
                      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
                        {/* Avatar grande + código de vinculación - Responsive */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <div className="relative w-[160px] h-[280px] 2xl:w-[220px] 2xl:h-[390px] rounded-xl overflow-hidden bg-gradient-to-br from-white to-gray-100 dark:from-gray-700 dark:to-gray-800 border-4 border-white dark:border-gray-700 shadow-xl">
                            <StudentAvatarMini
                              studentProfileId={detailStudent.id}
                              gender={detailStudent.avatarGender || 'MALE'}
                              size="xl"
                              className="absolute top-0 left-1/2 -translate-x-1/2 scale-[0.62] 2xl:scale-[0.85] origin-top"
                            />
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                              <div className="flex items-center gap-1 bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap">
                                <Star size={12} className="text-amber-400 fill-amber-400" />
                                <span>Nv.{detailStudent.level}</span>
                              </div>
                            </div>
                          </div>
                          {/* Código de vinculación debajo del avatar */}
                          {getStudentLinkCode(detailStudent.id) && (
                            <button
                              onClick={() => copyLinkCode(getStudentLinkCode(detailStudent.id)!)}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-mono font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              title="Clic para copiar"
                            >
                              <Link2 size={12} />
                              {getStudentLinkCode(detailStudent.id)}
                              <Copy size={10} className="opacity-50" />
                            </button>
                          )}
                        </div>

                        {/* Info del estudiante */}
                        <div className="flex-1 pt-4 lg:pt-16 overflow-y-auto">
                          {/* Nombre y clase */}
                          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                            {getDisplayName(detailStudent)}
                          </h2>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-4">
                            <span className="text-xl">{detailClassInfo?.icon}</span>
                            <span className="font-medium">{detailClassInfo?.name}</span>
                            {classroom.clansEnabled && (detailStudent as any).clanName && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                <span 
                                  className="px-2 py-0.5 rounded-full text-white text-sm"
                                  style={{ backgroundColor: (detailStudent as any).clanColor || '#6366f1' }}
                                >
                                  🛡️ {(detailStudent as any).clanName}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Stats con barras */}
                          <div className="space-y-4 mb-6">
                            {/* HP */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-2 text-red-600 font-semibold">
                                  <Heart size={18} className="fill-red-500" />
                                  HP
                                </span>
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                  {detailStudent.hp} <span className="text-sm font-normal text-gray-400">/ {classroom.maxHp || 100}</span>
                                </span>
                              </div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${hpPercent}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600"
                                />
                              </div>
                            </div>

                            {/* XP */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-2 text-indigo-600 font-semibold">
                                  <Sparkles size={18} />
                                  XP
                                </span>
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                  {detailStudent.xp} <span className="text-sm font-normal text-gray-400">({Math.round(xpInLevel)}/{xpNeeded})</span>
                                </span>
                              </div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${xpProgress}%` }}
                                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"
                                />
                              </div>
                            </div>

                            {/* GP */}
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2 text-amber-600 font-semibold">
                                <Coins size={18} />
                                GP
                              </span>
                              <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                {detailStudent.gp}
                              </span>
                            </div>
                          </div>

                          {/* Botones de acción rápida */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setBehaviorType('positive'); setShowBehaviorModal(true); }}
                              className="!bg-green-500 hover:!bg-green-600 !text-white"
                            >
                              <Zap size={14} className="mr-1" /> Dar puntos
                            </Button>
                            {classroom.allowNegativePoints !== false && (
                              <Button
                                size="sm"
                                onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setBehaviorType('negative'); setShowBehaviorModal(true); }}
                                className="!bg-red-500 hover:!bg-red-600 !text-white"
                              >
                                <Zap size={14} className="mr-1" /> Quitar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { setSelectedStudents(new Set([detailStudent.id])); setShowBadgeModal(true); }}
                              className="!bg-amber-500 hover:!bg-amber-600 !text-white"
                            >
                              <Medal size={14} className="mr-1" /> Insignia
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/classroom/${classroom.id}/student/${detailStudent.id}`)}
                              className="!bg-indigo-500 hover:!bg-indigo-600 !text-white"
                            >
                              <Eye size={14} className="mr-1" /> Ver perfil
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Vista de Lista */}
          {viewMode === 'list' && students.length > 0 && (
            <Card className="overflow-hidden">
              {/* Barra de búsqueda */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
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
                            <Heart size={14} className="text-red-500 fill-red-500 flex-shrink-0" />
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                              <div 
                                className="h-full rounded-full bg-red-500"
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
