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
  const [period, setPeriod] = useState('CURRENT');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

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

  // Mutación para exportar PDF
  const exportPDFMutation = useMutation({
    mutationFn: () => gradeApi.exportPDF(classroom.id, period),
    onSuccess: () => toast.success('PDF descargado correctamente'),
    onError: () => toast.error('Error al exportar PDF'),
  });

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

  // Calcular promedio de un estudiante
  const calculateAverage = (studentGrades: ClassroomGrade[]) => {
    if (studentGrades.length === 0) return 0;
    const total = studentGrades.reduce((sum, g) => sum + (g.score || 0), 0);
    return (total / studentGrades.length).toFixed(1);
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw size={16} className={recalculateMutation.isPending ? 'animate-spin' : ''} />
            {recalculateMutation.isPending ? 'Calculando...' : 'Recalcular'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportPDFMutation.mutate()}
            disabled={exportPDFMutation.isPending || grades.length === 0}
          >
            <Download size={16} className={exportPDFMutation.isPending ? 'animate-pulse' : ''} />
            {exportPDFMutation.isPending ? 'Generando...' : 'Exportar PDF'}
          </Button>
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
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
          >
            <option value="CURRENT">Periodo Actual</option>
            <option value="2024-B1">Bimestre 1</option>
            <option value="2024-B2">Bimestre 2</option>
            <option value="2024-B3">Bimestre 3</option>
            <option value="2024-B4">Bimestre 4</option>
          </select>
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
            Haz clic en "Recalcular" para generar las calificaciones basadas en las actividades completadas.
          </p>
          <Button onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
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
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {avg}%
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
                                                activity.type === 'MISSION' ? 'bg-blue-500' :
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
                                                 activity.type === 'MISSION' ? 'Misión' :
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
    </div>
  );
};

export default GradebookPage;
