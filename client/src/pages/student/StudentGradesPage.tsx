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
import { IndicatorEvidenceSplit } from '../../components/ui/IndicatorEvidenceSplit';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { gradeApi, type PerformanceBucket, type StudentGrade } from '../../lib/gradeApi';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';

const getActivityDotClassName = (type: string) => {
  if (type === 'BEHAVIOR') return 'bg-emerald-500';
  if (type === 'INDICATOR') return 'bg-indigo-500';
  if (type === 'BADGE') return 'bg-amber-500';
  if (type === 'EXPEDITION') return 'bg-purple-500';
  if (type === 'TIMED') return 'bg-cyan-500';
  if (type === 'MANUAL_POINTS') return 'bg-sky-500';
  return 'bg-gray-500';
};

const getActivityTypeLabel = (type: string) => {
  if (type === 'BEHAVIOR') return 'Comportamiento';
  if (type === 'INDICATOR') return 'Destreza';
  if (type === 'BADGE') return 'Insignia';
  if (type === 'EXPEDITION') return 'Expedición';
  if (type === 'TIMED') return 'Actividad';
  if (type === 'MANUAL_POINTS') return 'Punto manual';
  return type;
};

const getActivityWeightLabel = (type: string) => {
  if (type === 'BEHAVIOR' || type === 'MANUAL_POINTS' || type === 'INDICATOR') {
    return 'peso evidencia';
  }

  return 'peso';
};

// Componente para mostrar el desglose de actividades
const ActivityBreakdown = ({ grade }: { grade: StudentGrade }) => {
  // Parse calculationDetails if it's a string (MySQL JSON column)
  let details: StudentGrade['calculationDetails'] | string | null | undefined = grade.calculationDetails;
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { details = null; }
  }
  const activities = typeof details === 'object' && details && Array.isArray(details.activities)
    ? details.activities
    : [];
  const hasIndicatorBreakdown = grade.indicatorBreakdownStatus === 'AVAILABLE'
    && grade.indicatorBreakdown.length > 0;
  const visibleActivities = hasIndicatorBreakdown
    ? activities.filter((activity) => activity.type !== 'INDICATOR')
    : activities;

  if (visibleActivities.length === 0) {
    if (hasIndicatorBreakdown) {
      return null;
    }

    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        Aún no hay actividades registradas para esta competencia.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {hasIndicatorBreakdown ? 'Otras actividades consideradas' : '¿Cómo se calculó esta nota?'}
      </span>
      <div className="space-y-2">
        {visibleActivities.map((activity: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getActivityDotClassName(activity.type)}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {activity.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 dark:text-gray-400">
                {getActivityTypeLabel(activity.type)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {activity.score.toFixed(0)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({getActivityWeightLabel(activity.type)}: {activity.weight})
              </span>
            </div>
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

  const { competencies: classroomCompetencies = [] } = useClassroomCompetencies(
    classroom?.id,
    !!classroom?.useCompetencies && !!classroom?.curriculumAreaId,
  );

  // Período a consultar
  const periodToQuery = selectedPeriod === 'CURRENT' 
    ? bimesterStatus?.currentBimester || 'CURRENT'
    : selectedPeriod;

  // Obtener calificaciones del estudiante
  const { data: gradebookResponse, isLoading } = useQuery({
    queryKey: ['my-grades', currentProfile?.id, periodToQuery],
    queryFn: () => gradeApi.getStudentGrades(currentProfile!.id, periodToQuery),
    enabled: !!currentProfile?.id && !!classroom?.useCompetencies && !!periodToQuery,
  });

  const grades = gradebookResponse?.grades || [];
  const visibleGrades = grades.filter((grade) => grade.activitiesCount > 0 || grade.isManualOverride);
  const average = gradebookResponse?.average;
  const gradeScaleType = gradebookResponse?.gradeScaleType || classroom?.gradeScaleType;

  // Información del bimestre actual
  const currentBimester = bimesterStatus?.currentBimester || '';
  const bimesterNumber = currentBimester.split('-B')[1] || '1';
  const bimesterYear = currentBimester.split('-B')[0] || new Date().getFullYear().toString();

  // Bimestres disponibles para navegar
  const availableBimesters = bimesterStatus?.allBimesters || [];

  // Calcular si el período seleccionado es el actual
  const isCurrentPeriod = selectedPeriod === 'CURRENT' || selectedPeriod === currentBimester;

  const getBucketColor = (bucket: PerformanceBucket) => {
    if (bucket === 'AD') return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30';
    if (bucket === 'A') return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
    if (bucket === 'B') return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
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
  const getLevelDescription = (bucket: PerformanceBucket) => {
    if (bucket === 'AD') return 'Logro destacado - Supera las expectativas';
    if (bucket === 'A') return 'Logro esperado - Cumple con las expectativas';
    if (bucket === 'B') return 'En proceso - Está cerca del logro esperado';
    if (bucket === 'C') return 'En inicio - Necesita más apoyo';
    return '';
  };

  const formatPeriodLabel = (value: string | null) => {
    if (!value || !value.includes('-B')) {
      return 'un bimestre posterior';
    }

    const [year, bimester] = value.split('-B');
    return `Bimestre ${bimester} ${year}`;
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

  // Estadísticas adicionales
  const stats = {
    totalCompetencies: classroomCompetencies.length,
    evaluatedCompetencies: average?.evaluatedCompetencies || 0,
    adCount: grades.filter(g => g.bucket === 'AD').length,
    aCount: grades.filter(g => g.bucket === 'A').length,
    bCount: grades.filter(g => g.bucket === 'B').length,
    cCount: grades.filter(g => g.bucket === 'C').length,
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
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">{grades.length === 0 ? '—' : average?.label || '—'}</span>
              <span className="text-lg text-purple-200 font-medium">{average ? `${average.score.toFixed(1)}%` : '0.0%'}</span>
              <TrendingUp size={20} className="text-purple-200" />
            </div>
            <p className="text-purple-200 text-xs mt-1">
              {stats.evaluatedCompetencies} de {stats.totalCompetencies} competencias evaluadas
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
          
          {visibleGrades.length === 0 ? (
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
            visibleGrades.map((grade) => {
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
                            {getLevelDescription(grade.bucket)}
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
                                  grade.bucket === 'AD' ? 'bg-emerald-500' :
                                  grade.bucket === 'A' ? 'bg-blue-500' :
                                  grade.bucket === 'B' ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Desglose de actividades */}
                          <ActivityBreakdown grade={grade} />

                          {grade.indicatorBreakdownStatus === 'HISTORICAL_NO_BREAKDOWN' && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                Histórico sin desglose de destrezas
                              </p>
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                                Esta competencia empezó a mostrar destrezas desde {formatPeriodLabel(grade.indicatorStartPeriod)}.
                              </p>
                            </div>
                          )}

                          {grade.indicatorBreakdownStatus === 'AVAILABLE' && grade.indicatorBreakdown.length > 0 && (
                            <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                              <div className="flex items-center gap-2">
                                <Target size={14} className="text-indigo-500" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Destrezas
                                </span>
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  Cuenta en nota oficial
                                </span>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {grade.indicatorBreakdown.map((indicator) => (
                                  <div
                                    key={indicator.id}
                                    className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-3 dark:border-indigo-900/40 dark:bg-indigo-900/10"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                                          {indicator.name}
                                        </p>
                                        {indicator.description && (
                                          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                            {indicator.description}
                                          </p>
                                        )}
                                      </div>
                                      {indicator.hasEvidence ? (
                                        <span className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold ${indicator.bucket ? getBucketColor(indicator.bucket) : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}>
                                          {indicator.gradeLabel || `${Number(indicator.score || 0).toFixed(0)}%`}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                                          Sin evidencias
                                        </span>
                                      )}
                                    </div>

                                    {indicator.hasEvidence && (
                                      <IndicatorEvidenceSplit
                                        positiveObservations={indicator.positiveObservations}
                                        negativeObservations={indicator.negativeObservations}
                                        positivePoints={indicator.positivePoints}
                                        negativePoints={indicator.negativePoints}
                                      />
                                    )}

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                      {indicator.hasEvidence
                                        ? `${Number(indicator.score || 0).toFixed(0)}% · peso evidencia: ${indicator.evidenceWeight} · ${indicator.observations} registro(s)`
                                        : 'Aun no hay comportamientos vinculados a esta destreza en el periodo.'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
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
            {gradeScaleType === 'PERU_VIGESIMAL' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('18')}`}>18-20</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">Logro destacado</p>
                    <p className="text-xs text-gray-500">Nivel superior</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('14')}`}>14-17</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">Logro esperado</p>
                    <p className="text-xs text-gray-500">Nivel satisfactorio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('11')}`}>11-13</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">En proceso</p>
                    <p className="text-xs text-gray-500">Nivel intermedio</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('05')}`}>0-10</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">En inicio</p>
                    <p className="text-xs text-gray-500">Requiere refuerzo</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getBucketColor('AD')}`}>AD</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">Destacado</p>
                    <p className="text-xs text-gray-500">90% - 100%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getBucketColor('A')}`}>A</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">Esperado</p>
                    <p className="text-xs text-gray-500">70% - 89%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getBucketColor('B')}`}>B</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">En proceso</p>
                    <p className="text-xs text-gray-500">50% - 69%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getBucketColor('C')}`}>C</span>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-white">En inicio</p>
                    <p className="text-xs text-gray-500">0% - 49%</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
