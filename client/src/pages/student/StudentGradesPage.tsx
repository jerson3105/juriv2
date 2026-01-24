import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Award,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  Calendar,
  Target,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { gradeApi } from '../../lib/gradeApi';
import { classroomApi } from '../../lib/classroomApi';

// Componente para mostrar el desglose de actividades
const ActivityBreakdown = ({ grade }: { grade: any }) => {
  // Parse calculationDetails if it's a string (MySQL JSON column)
  let details = grade.calculationDetails;
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { details = null; }
  }
  const activities = details?.activities || [];

  if (activities.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        Aún no hay actividades registradas para esta competencia.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        ¿Cómo se calculó esta nota?
      </span>
      <div className="space-y-2">
        {activities.map((activity: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                activity.type === 'BEHAVIOR' ? 'bg-emerald-500' :
                activity.type === 'BADGE' ? 'bg-amber-500' :
                activity.type === 'EXPEDITION' ? 'bg-purple-500' :
                activity.type === 'TIMED' ? 'bg-cyan-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {activity.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 dark:text-gray-400">
                {activity.type === 'BEHAVIOR' ? 'Comportamiento' :
                 activity.type === 'BADGE' ? 'Insignia' :
                 activity.type === 'EXPEDITION' ? 'Expedición' :
                 activity.type === 'TIMED' ? 'Actividad' :
                 activity.type}
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {activity.score.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StudentGradesPage = () => {
  const navigate = useNavigate();
  const { selectedClassIndex } = useStudentStore();
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('CURRENT');

  // Obtener perfil del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];
  const classroom = currentProfile?.classroom;

  // Obtener estado de bimestres
  const { data: bimesterStatus } = useQuery({
    queryKey: ['bimester-status', classroom?.id],
    queryFn: () => gradeApi.getBimesterStatus(classroom!.id),
    enabled: !!classroom?.id && !!classroom?.useCompetencies,
  });

  // Obtener áreas curriculares para nombres de competencias
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: !!classroom?.useCompetencies,
  });

  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  // Período a consultar
  const periodToQuery = selectedPeriod === 'CURRENT' 
    ? bimesterStatus?.currentBimester || 'CURRENT'
    : selectedPeriod;

  // Obtener calificaciones del estudiante
  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['my-grades', currentProfile?.id, periodToQuery],
    queryFn: () => gradeApi.getStudentGrades(currentProfile!.id, periodToQuery),
    enabled: !!currentProfile?.id && !!classroom?.useCompetencies && !!periodToQuery,
  });

  // Información del bimestre actual
  const currentBimester = bimesterStatus?.currentBimester || '';
  const bimesterNumber = currentBimester.split('-B')[1] || '1';
  const bimesterYear = currentBimester.split('-B')[0] || new Date().getFullYear().toString();

  // Bimestres disponibles para navegar
  const availableBimesters = bimesterStatus?.allBimesters || [];

  // Calcular si el período seleccionado es el actual
  const isCurrentPeriod = selectedPeriod === 'CURRENT' || selectedPeriod === currentBimester;

  // Calcular promedio general
  const calculateAverage = () => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, g) => sum + parseFloat(g.score), 0);
    return (total / grades.length).toFixed(1);
  };

  // Obtener color según calificación
  const getGradeColor = (gradeLabel: string) => {
    if (!gradeLabel) return 'text-gray-500 bg-gray-100 dark:bg-gray-700';
    
    // Perú Letras
    if (gradeLabel === 'AD') return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30';
    if (gradeLabel === 'A') return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
    if (gradeLabel === 'B') return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
    if (gradeLabel === 'C') return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    
    // Vigesimal
    const num = parseInt(gradeLabel);
    if (!isNaN(num)) {
      if (num >= 18) return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30';
      if (num >= 14) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      if (num >= 11) return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    }
    
    return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
  };

  // Obtener descripción del nivel
  const getLevelDescription = (gradeLabel: string) => {
    if (gradeLabel === 'AD') return 'Logro destacado - Supera las expectativas';
    if (gradeLabel === 'A') return 'Logro esperado - Cumple con las expectativas';
    if (gradeLabel === 'B') return 'En proceso - Está cerca del logro esperado';
    if (gradeLabel === 'C') return 'En inicio - Necesita más apoyo';
    return '';
  };

  if (!classroom?.useCompetencies) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          Calificaciones no disponibles
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Tu profesor aún no ha habilitado el sistema de calificaciones por competencias en esta clase.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const average = calculateAverage();

  // Estadísticas adicionales
  const stats = {
    totalCompetencies: classroomCompetencies.length,
    evaluatedCompetencies: grades.length,
    adCount: grades.filter(g => g.gradeLabel === 'AD').length,
    aCount: grades.filter(g => g.gradeLabel === 'A').length,
    bCount: grades.filter(g => g.gradeLabel === 'B').length,
    cCount: grades.filter(g => g.gradeLabel === 'C').length,
  };

  // Navegar entre bimestres
  const navigateBimester = (direction: 'prev' | 'next') => {
    const currentIdx = availableBimesters.findIndex(b => 
      b.period === (selectedPeriod === 'CURRENT' ? currentBimester : selectedPeriod)
    );
    if (direction === 'prev' && currentIdx > 0) {
      setSelectedPeriod(availableBimesters[currentIdx - 1].period);
    } else if (direction === 'next' && currentIdx < availableBimesters.length - 1) {
      setSelectedPeriod(availableBimesters[currentIdx + 1].period);
    }
  };

  // Obtener info del bimestre seleccionado
  const selectedBimesterInfo = availableBimesters.find(b => 
    b.period === (selectedPeriod === 'CURRENT' ? currentBimester : selectedPeriod)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 sm:mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Volver al dashboard
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center ring-2 sm:ring-4 ring-purple-200 dark:ring-purple-800 flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Mis Calificaciones</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Revisa tu progreso académico en {classroom?.name}
              </p>
            </div>
          </div>

          {/* Selector de Bimestre */}
          {availableBimesters.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => navigateBimester('prev')}
                disabled={availableBimesters.findIndex(b => b.period === (selectedPeriod === 'CURRENT' ? currentBimester : selectedPeriod)) === 0}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2 px-3 min-w-[160px] justify-center">
                <Calendar size={16} className="text-purple-500" />
                <span className="font-medium text-gray-800 dark:text-white">
                  Bimestre {selectedBimesterInfo?.period.split('-B')[1] || bimesterNumber}
                </span>
                {selectedBimesterInfo?.isCurrent && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full font-medium">
                    Actual
                  </span>
                )}
                {selectedBimesterInfo?.isClosed && (
                  <Lock size={12} className="text-gray-400" />
                )}
              </div>
              <button
                onClick={() => navigateBimester('next')}
                disabled={availableBimesters.findIndex(b => b.period === (selectedPeriod === 'CURRENT' ? currentBimester : selectedPeriod)) === availableBimesters.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resumen Principal */}
      <Card className="p-5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm mb-1">Promedio General</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{average}%</span>
              <TrendingUp size={20} className="text-purple-200" />
            </div>
            <p className="text-purple-200 text-xs mt-1">
              {grades.length} de {stats.totalCompetencies} competencias evaluadas
            </p>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <Award size={40} className="text-white" />
          </div>
        </div>
      </Card>

      {/* Estadísticas por Nivel de Logro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Star size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.adCount}</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Destacado (AD)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.aCount}</p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Esperado (A)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.bCount}</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">En proceso (B)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.cCount}</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">En inicio (C)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contenido principal en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de competencias - ocupa 2 columnas */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Info size={16} />
            Detalle por Competencia
            {!isCurrentPeriod && (
              <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                Bimestre {selectedPeriod.split('-B')[1]}
              </span>
            )}
          </h2>
          
          {grades.length === 0 ? (
            <Card className="p-8 text-center">
              <Award className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Sin calificaciones
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isCurrentPeriod 
                  ? 'Tu profesor aún no ha registrado calificaciones para este bimestre.'
                  : 'No hay calificaciones registradas para este bimestre.'}
              </p>
            </Card>
          ) : (
            grades.map((grade) => {
              const isExpanded = expandedCompetency === grade.competencyId;
              const comp = classroomCompetencies.find((c: any) => c.id === grade.competencyId);
              
              return (
                <motion.div
                  key={grade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="overflow-hidden">
                    <button
                      onClick={() => setExpandedCompetency(isExpanded ? null : grade.competencyId)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`px-3 py-2 rounded-xl text-lg font-bold ${getGradeColor(grade.gradeLabel)}`}>
                          {grade.gradeLabel}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-800 dark:text-white">
                            {comp?.name || grade.competencyName}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getLevelDescription(grade.gradeLabel)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {Number(grade.score).toFixed(1)}%
                        </span>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </button>
                    
                    {/* Detalles expandidos */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/30"
                      >
                        <div className="space-y-4">
                          {/* Barra de progreso */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                              <span>Progreso</span>
                              <span>{Number(grade.score).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Number(grade.score))}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full ${
                                  Number(grade.score) >= 85 ? 'bg-emerald-500' :
                                  Number(grade.score) >= 65 ? 'bg-blue-500' :
                                  Number(grade.score) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Desglose de actividades */}
                          <ActivityBreakdown grade={grade} />
                          
                          {/* Info adicional */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">Actividades</span>
                              <p className="font-semibold text-gray-800 dark:text-white">
                                {grade.activitiesCount} registradas
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">Última actualización</span>
                              <p className="font-semibold text-gray-800 dark:text-white">
                                {new Date(grade.calculatedAt).toLocaleDateString('es-PE', { 
                                  day: 'numeric', 
                                  month: 'short' 
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Nota del profesor si existe */}
                          {grade.manualNote && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">Nota del profesor</span>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                {grade.manualNote}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Panel lateral - Información adicional */}
        <div className="space-y-4">
          {/* Bimestre Actual */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-purple-500" />
              Período Académico
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Bimestre Actual</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">B{bimesterNumber}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Año Escolar</span>
                <span className="font-bold text-gray-800 dark:text-white">{bimesterYear}</span>
              </div>
            </div>
          </Card>

          {/* Historial de Bimestres */}
          {availableBimesters.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Historial de Bimestres
              </h3>
              <div className="space-y-2">
                {availableBimesters.map((bim) => (
                  <button
                    key={bim.period}
                    onClick={() => setSelectedPeriod(bim.period)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                      (selectedPeriod === bim.period || (selectedPeriod === 'CURRENT' && bim.isCurrent))
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        (selectedPeriod === bim.period || (selectedPeriod === 'CURRENT' && bim.isCurrent))
                          ? 'text-purple-700 dark:text-purple-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        Bimestre {bim.period.split('-B')[1]}
                      </span>
                      {bim.isCurrent && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500 text-white rounded-full">
                          Actual
                        </span>
                      )}
                    </div>
                    {bim.isClosed && <Lock size={14} className="text-gray-400" />}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Escala de Calificación */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Escala de Calificación
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('AD')}`}>AD</span>
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-white">Destacado</p>
                  <p className="text-xs text-gray-500">90% - 100%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('A')}`}>A</span>
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-white">Esperado</p>
                  <p className="text-xs text-gray-500">70% - 89%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('B')}`}>B</span>
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-white">En proceso</p>
                  <p className="text-xs text-gray-500">50% - 69%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('C')}`}>C</span>
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-white">En inicio</p>
                  <p className="text-xs text-gray-500">0% - 49%</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
