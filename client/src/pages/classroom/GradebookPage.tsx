import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  RefreshCw,
  Download,
  Search,
  Award,
  Edit3,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  Lock,
  Unlock,
  Calendar,
  Settings2,
  Scale,
  Target,
  Sparkles,
  Medal,
  Trophy,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { gradeApi, type ClassroomGrade } from '../../lib/gradeApi';
import toast from 'react-hot-toast';

export const GradebookPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [showBimesterModal, setShowBimesterModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Obtener estado de bimestres
  const { data: bimesterStatus } = useQuery({
    queryKey: ['bimester-status', classroom.id, selectedYear],
    queryFn: () => gradeApi.getBimesterStatus(classroom.id, selectedYear),
    enabled: !!classroom.id && !!classroom.useCompetencies,
  });

  // El periodo actual es el bimestre actual del classroom
  const currentBimester = bimesterStatus?.currentBimester || `${new Date().getFullYear()}-B1`;
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const period = selectedPeriod || currentBimester;

  // Obtener datos completos de la clase (incluye estudiantes)
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const realStudents = classroomData?.students || [];
  const [editingGrade, setEditingGrade] = useState<{ id: string; score: number; note: string } | null>(null);

  // Verificar si la clase usa competencias
  if (!classroom.useCompetencies) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          Sistema de Competencias no habilitado
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Para usar el Libro de Calificaciones, primero habilita el sistema de competencias
          en la configuración de la clase.
        </p>
      </div>
    );
  }

  // Obtener competencias de la clase
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
  });

  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom.curriculumAreaId)?.competencies || [];

  // Obtener calificaciones
  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['classroom-grades', classroom.id, period],
    queryFn: () => gradeApi.getClassroomGrades(classroom.id, period),
  });

  // Mutación para recalcular (primero sincroniza competencias)
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      // Primero sincronizar competencias del classroom
      await classroomApi.syncCompetencies(classroom.id);
      // Luego recalcular calificaciones
      return gradeApi.recalculateClassroomGrades(classroom.id, period);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      toast.success(`Calificaciones recalculadas para ${data.studentsProcessed} estudiantes`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Error al recalcular calificaciones'),
  });

  // Mutación para nota manual
  const setManualMutation = useMutation({
    mutationFn: ({ gradeId, score, note }: { gradeId: string; score: number; note: string }) =>
      gradeApi.setManualGrade(gradeId, score, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      setEditingGrade(null);
      toast.success('Calificación manual guardada');
    },
    onError: () => toast.error('Error al guardar calificación'),
  });

  // Mutación para exportar Excel (formato SIAGIE)
  const exportExcelMutation = useMutation({
    mutationFn: () => gradeApi.exportExcel(classroom.id, period),
    onSuccess: () => toast.success('Excel descargado correctamente'),
    onError: () => toast.error('Error al exportar Excel'),
  });

  // Mutación para cerrar bimestre
  const closeBimesterMutation = useMutation({
    mutationFn: (periodToClose: string) => gradeApi.closeBimester(classroom.id, periodToClose),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bimester-status', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroom.id] });
      const closedLabel = `Bimestre ${data.closedPeriod.split('-B')[1]}`;
      const newLabel = `Bimestre ${data.newCurrentBimester.split('-B')[1]} (${data.newCurrentBimester.split('-B')[0]})`;
      toast.success(`${closedLabel} cerrado. Ahora trabajas en ${newLabel}`);
      setShowBimesterModal(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al cerrar bimestre'),
  });

  // Mutación para reabrir bimestre
  const reopenBimesterMutation = useMutation({
    mutationFn: (periodToReopen: string) => gradeApi.reopenBimester(classroom.id, periodToReopen),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bimester-status', classroom.id] });
      const reopenedLabel = `Bimestre ${data.reopenedPeriod.split('-B')[1]}`;
      toast.success(`${reopenedLabel} reabierto`);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al reabrir bimestre'),
  });

  // Verificar si el período seleccionado es futuro (no se puede calcular)
  const isFuturePeriod = useMemo(() => {
    if (!bimesterStatus?.currentBimester) return false;
    
    const [currentYear, currentBim] = bimesterStatus.currentBimester.split('-B').map(p => parseInt(p));
    const [periodYear, periodBim] = period.split('-B').map(p => parseInt(p));
    
    if (periodYear > currentYear) return true;
    if (periodYear === currentYear && periodBim > currentBim) return true;
    return false;
  }, [period, bimesterStatus?.currentBimester]);

  // Agrupar calificaciones por estudiante
  const studentGrades = useMemo(() => {
    const grouped: Record<string, { name: string; grades: ClassroomGrade[] }> = {};
    
    grades.forEach((g) => {
      if (!grouped[g.studentProfileId]) {
        grouped[g.studentProfileId] = {
          name: g.studentName || 'Estudiante',
          grades: [],
        };
      }
      grouped[g.studentProfileId].grades.push(g);
    });

    return Object.entries(grouped)
      .filter(([_, data]) => 
        data.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [grades, searchTerm]);

  // Calcular promedio de un estudiante (solo competencias con actividades)
  const calculateAverage = (studentGrades: ClassroomGrade[]): { score: number; label: string } => {
    if (studentGrades.length === 0) return { score: 0, label: 'C' };
    // Solo incluir competencias que tienen actividades registradas
    const validGrades = studentGrades.filter(g => 
      g.score != null && !isNaN(Number(g.score)) && g.activitiesCount > 0
    );
    if (validGrades.length === 0) return { score: 0, label: '-' };
    const total = validGrades.reduce((sum, g) => sum + Number(g.score), 0);
    const avg = total / validGrades.length;
    
    // Determinar letra según escala Perú
    let label = 'C';
    if (avg >= 90) label = 'AD';
    else if (avg >= 70) label = 'A';
    else if (avg >= 50) label = 'B';
    
    return { score: Number(avg.toFixed(1)), label };
  };

  // Obtener color según escala
  const getGradeColor = (gradeLabel: string) => {
    if (!gradeLabel) return 'text-gray-500';
    
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Libro de Calificaciones
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {classroomCompetencies.length} competencias · {realStudents.length} estudiantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending || isFuturePeriod}
            title={isFuturePeriod ? 'No se puede calcular un bimestre futuro' : ''}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCw size={16} className={recalculateMutation.isPending ? 'animate-spin' : ''} />
            {recalculateMutation.isPending ? 'Calculando...' : 'Recalcular'}
          </button>
          <button
            onClick={() => exportExcelMutation.mutate()}
            disabled={exportExcelMutation.isPending || grades.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title="Exportar en formato SIAGIE"
          >
            <Download size={16} className={exportExcelMutation.isPending ? 'animate-pulse' : ''} />
            {exportExcelMutation.isPending ? 'Generando...' : 'Excel SIAGIE'}
          </button>
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg"
            title="Información sobre calificaciones"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            >
              {bimesterStatus?.allBimesters.map((b) => (
                <option key={b.period} value={b.period}>
                  {b.label} {b.isCurrent ? '(Actual)' : ''} {b.isClosed ? '🔒' : ''}
                </option>
              )) || (
                <>
                  <option value={`${new Date().getFullYear()}-B1`}>Bimestre 1</option>
                  <option value={`${new Date().getFullYear()}-B2`}>Bimestre 2</option>
                  <option value={`${new Date().getFullYear()}-B3`}>Bimestre 3</option>
                  <option value={`${new Date().getFullYear()}-B4`}>Bimestre 4</option>
                </>
              )}
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBimesterModal(true)}
              title="Gestionar bimestres"
            >
              <Settings2 size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla de calificaciones */}
      {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="animate-spin text-indigo-500 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Cargando calificaciones...</span>
          </div>
        </Card>
      ) : studentGrades.length === 0 ? (
        <Card className="p-8 text-center">
          <Award className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Sin calificaciones registradas
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {isFuturePeriod 
              ? 'Este es un bimestre futuro. No se pueden calcular calificaciones hasta que sea el bimestre actual.'
              : 'Haz clic en "Recalcular" para generar las calificaciones basadas en las actividades completadas.'
            }
          </p>
          <Button 
            onClick={() => recalculateMutation.mutate()} 
            disabled={recalculateMutation.isPending || isFuturePeriod}
          >
            <RefreshCw size={16} className={recalculateMutation.isPending ? 'animate-spin' : ''} />
            Calcular Calificaciones
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Header de competencias */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800/50 z-10 min-w-[200px]">
                    Estudiante
                  </th>
                  {classroomCompetencies.map((comp: any) => (
                    <th
                      key={comp.id}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]"
                      title={comp.name}
                    >
                      <div className="truncate max-w-[80px]">{comp.name.substring(0, 15)}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[80px]">
                    Promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                {studentGrades.map(([studentId, data]) => {
                  const isExpanded = expandedStudent === studentId;
                  const avg = calculateAverage(data.grades);
                  
                  return (
                    <React.Fragment key={studentId}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-900 z-10">
                        <button
                          onClick={() => setExpandedStudent(isExpanded ? null : studentId)}
                          className="flex items-center gap-2 text-left hover:text-indigo-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span className="font-medium text-gray-800 dark:text-white">
                            {data.name}
                          </span>
                        </button>
                      </td>
                      {classroomCompetencies.map((comp: any) => {
                        const grade = data.grades.find(g => g.competencyId === comp.id);
                        return (
                          <td key={comp.id} className="px-3 py-3 text-center">
                            {grade ? (
                              <span
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-sm font-bold ${getGradeColor(grade.gradeLabel)}`}
                              >
                                {grade.gradeLabel || '-'}
                                {grade.isManualOverride && (
                                  <Edit3 size={10} className="ml-1 opacity-60" />
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-sm font-bold ${getGradeColor(avg.label)}`}>
                          {avg.label} ({avg.score}%)
                        </span>
                      </td>
                    </motion.tr>
                    {/* Fila expandida con detalles */}
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={classroomCompetencies.length + 2} className="px-4 py-4">
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              📊 Desglose de calificaciones de {data.name}
                            </h4>
                            
                            {data.grades.map((grade) => {
                              const comp = classroomCompetencies.find((c: any) => c.id === grade.competencyId);
                              // Parse calculationDetails if it's a string (MySQL JSON column)
                              let details: any = grade.calculationDetails;
                              if (typeof details === 'string') {
                                try { details = JSON.parse(details); } catch { details = undefined; }
                              }
                              const activities = details?.activities || [];
                              
                              return (
                                <div
                                  key={grade.id}
                                  className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                >
                                  {/* Header de competencia */}
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor(grade.gradeLabel)}`}>
                                        {grade.gradeLabel}
                                      </span>
                                      <span className="font-medium text-gray-800 dark:text-white">
                                        {comp?.name || grade.competencyName}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-500">
                                        {Number(grade.score || 0).toFixed(1)}%
                                      </span>
                                      <button
                                        onClick={() => setEditingGrade({
                                          id: grade.id,
                                          score: Number(grade.manualScore || grade.score || 0),
                                          note: grade.notes || ''
                                        })}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 flex items-center gap-1"
                                      >
                                        <Edit3 size={12} />
                                        Editar
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Lista de actividades que contribuyen */}
                                  {activities.length > 0 ? (
                                    <div className="space-y-2">
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                        Actividades que contribuyen a esta nota:
                                      </span>
                                      <div className="grid gap-2">
                                        {activities.map((activity: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
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
                                              <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                                                {activity.type === 'BEHAVIOR' ? 'Comportamiento' :
                                                 activity.type === 'BADGE' ? 'Insignia' :
                                                 activity.type === 'EXPEDITION' ? 'Expedición' :
                                                 activity.type === 'TIMED' ? 'Actividad' :
                                                 activity.type}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                {activity.score.toFixed(0)}%
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                (peso: {activity.weight})
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                      No hay actividades registradas para esta competencia.
                                    </p>
                                  )}
                                  
                                  {grade.isManualOverride && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                                      <Edit3 size={10} />
                                      Nota editada manualmente
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                            {data.grades.length === 0 && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                No hay calificaciones registradas. Haz clic en "Calcular Calificaciones".
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Leyenda */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Info size={16} />
          Escala de Calificación
        </h3>
        <div className="flex flex-wrap gap-4">
          {classroom.gradeScaleType === 'PERU_LETTERS' && (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('AD')}`}>AD</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Logro destacado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('A')}`}>A</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Logro esperado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('B')}`}>B</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">En proceso</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('C')}`}>C</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">En inicio</span>
              </div>
            </>
          )}
          {classroom.gradeScaleType === 'PERU_VIGESIMAL' && (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('18')}`}>18-20</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Excelente</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('14')}`}>14-17</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Bueno</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('11')}`}>11-13</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Regular</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeColor('05')}`}>0-10</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Desaprobado</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Edit3 size={14} className="text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Nota editada manualmente</span>
          </div>
        </div>
      </Card>

      {/* Modal de edición de nota */}
      <AnimatePresence>
        {editingGrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingGrade(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                Editar Calificación Manual
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Puntaje (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingGrade.score}
                    onChange={(e) => setEditingGrade({ ...editingGrade, score: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nota/Comentario (opcional)
                  </label>
                  <textarea
                    value={editingGrade.note}
                    onChange={(e) => setEditingGrade({ ...editingGrade, note: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 resize-none"
                    rows={3}
                    placeholder="Razón del ajuste..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={() => setEditingGrade(null)} className="flex-1">
                  <X size={16} />
                  Cancelar
                </Button>
                <Button
                  onClick={() => setManualMutation.mutate({
                    gradeId: editingGrade.id,
                    score: editingGrade.score,
                    note: editingGrade.note,
                  })}
                  disabled={setManualMutation.isPending}
                  className="flex-1"
                >
                  <Check size={16} />
                  Guardar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de gestión de bimestres */}
      <AnimatePresence>
        {showBimesterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBimesterModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Gestión de Bimestres</h2>
                    <p className="text-xs text-gray-500">Controla los períodos de calificación</p>
                  </div>
                </div>
                <button onClick={() => setShowBimesterModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Selector de año */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm"
                >
                  {bimesterStatus?.availableYears?.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  )) || (
                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  )}
                </select>
              </div>

              <div className="space-y-3">
                {bimesterStatus?.allBimesters.map((b) => (
                  <div
                    key={b.period}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      b.isCurrent 
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                        : b.isClosed
                          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {b.isClosed ? (
                        <Lock size={20} className="text-gray-400" />
                      ) : b.isCurrent ? (
                        <Unlock size={20} className="text-indigo-500" />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {b.label}
                          {b.isCurrent && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                              Actual
                            </span>
                          )}
                        </p>
                        {b.isClosed && b.closedAt && (
                          <p className="text-xs text-gray-500">
                            Cerrado el {new Date(b.closedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      {b.isClosed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => reopenBimesterMutation.mutate(b.period)}
                          disabled={reopenBimesterMutation.isPending}
                        >
                          <Unlock size={14} />
                          Reabrir
                        </Button>
                      ) : b.isCurrent ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => closeBimesterMutation.mutate(b.period)}
                          disabled={closeBimesterMutation.isPending}
                        >
                          <Lock size={14} />
                          Cerrar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">¿Cómo funciona?</p>
                    <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-300">
                      <li>• <strong>Cerrar bimestre</strong>: Las calificaciones quedan congeladas y pasas al siguiente bimestre.</li>
                      <li>• <strong>Reabrir bimestre</strong>: Permite editar calificaciones de un bimestre cerrado.</li>
                      <li>• Las calificaciones de cada bimestre son independientes.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de información sobre calificaciones */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Scale size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                      Sistema de Pesos en Calificaciones
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Cómo influyen las actividades en la nota final
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Explicación */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <Target size={16} />
                    ¿Qué es el peso?
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    El <strong>peso</strong> determina la importancia de cada actividad en el cálculo de la calificación final. 
                    Un peso mayor significa mayor influencia en la nota.
                  </p>
                </div>

                {/* Ejemplo visual */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Ejemplo de cálculo</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-300">Expedición (80% × peso 100)</span>
                      <span className="font-mono text-gray-800 dark:text-white">= 8000</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-300">Comportamientos (94% × peso 30)</span>
                      <span className="font-mono text-gray-800 dark:text-white">= 2820</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-300">Insignias (100% × peso 20)</span>
                      <span className="font-mono text-gray-800 dark:text-white">= 2000</span>
                    </div>
                    <div className="flex justify-between items-center py-1 pt-2 font-semibold">
                      <span className="text-gray-800 dark:text-white">Nota final: (8000 + 2820 + 2000) ÷ 150</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">= 85.5%</span>
                    </div>
                  </div>
                </div>

                {/* Pesos por feature */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Peso por tipo de actividad</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                        <Sparkles size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white">Comportamientos</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Acciones positivas y negativas</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">30</span>
                        <p className="text-xs text-gray-500">peso fijo</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <Medal size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white">Insignias</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Logros y reconocimientos</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">20</span>
                        <p className="text-xs text-gray-500">peso fijo</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <Trophy size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white">Expediciones de Jiro</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Configurable al crear</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">100</span>
                        <p className="text-xs text-gray-500">por defecto</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nota */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>💡 Tip:</strong> Un peso de 100 vs 30 significa que la primera actividad tiene ~3.3 veces más influencia en la nota final.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GradebookPage;
