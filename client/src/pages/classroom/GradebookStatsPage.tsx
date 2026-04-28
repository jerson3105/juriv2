import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  GraduationCap,
  Award,
  AlertTriangle,
  Users,
  ChevronRight,
  ChevronDown,
  Target,
  BookOpen,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { type Classroom } from '../../lib/classroomApi';
import { gradeApi } from '../../lib/gradeApi';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';

export const GradebookStatsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const { data: gradebookData } = useQuery({
    queryKey: ['classroom-grades', classroom.id, 'CURRENT'],
    queryFn: () => gradeApi.getClassroomGrades(classroom.id, 'CURRENT'),
    enabled: !!classroom.useCompetencies && !!classroom.id,
  });

  const getDisplayName = (student: any) => {
    if (student.nickname) return student.nickname;
    if (student.firstName && student.lastName) return `${student.firstName} ${student.lastName}`;
    if (student.firstName) return student.firstName;
    return student.user?.email?.split('@')[0] || 'Sin nombre';
  };

  const getBucketBadgeClass = (bucket: string) => {
    if (bucket === 'AD') return 'bg-emerald-100 text-emerald-600';
    if (bucket === 'A') return 'bg-blue-100 text-blue-600';
    if (bucket === 'B') return 'bg-amber-100 text-amber-600';
    return 'bg-red-100 text-red-600';
  };

  const gradeStats = useMemo(() => {
    if (!gradebookData?.students?.length) return null;

    const studentsWithGrades = gradebookData.students.map((student) => ({
      id: student.studentProfileId,
      firstName: student.studentName,
      lastName: '',
      nickname: student.studentName,
      avatarGender: 'MALE',
      grades: student.grades,
      gradeInfo: {
        avg: student.average.score,
        label: student.average.label,
        bucket: student.average.bucket,
        grades: student.grades,
      },
    })).sort((a, b) => b.gradeInfo.avg - a.gradeInfo.avg);

    const topPerformers = studentsWithGrades.filter(s => s.gradeInfo.bucket === 'AD').slice(0, 5);
    const needsSupport = studentsWithGrades.filter(s => s.gradeInfo.bucket === 'C' || (s.gradeInfo.bucket === 'B' && s.gradeInfo.avg < 65));

    return {
      studentsWithGrades,
      distribution: gradebookData.summary.distribution,
      avgScore: gradebookData.summary.averageScore,
      topPerformers,
      needsSupport,
      totalEvaluated: gradebookData.summary.evaluatedStudentCount,
    };
  }, [gradebookData]);

  if (!classroom.useCompetencies) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Sistema de Competencias no habilitado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Para ver estadísticas de calificaciones, primero habilita el sistema de competencias
            en la configuración de la clase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
          <BarChart3 size={28} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Stats de calificaciones</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Análisis y distribución de logros académicos</p>
        </div>
      </div>

      {/* Content */}
      {!gradeStats ? (
        <Card className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Sin calificaciones</h3>
          <p className="text-gray-500 dark:text-gray-400">Recalcula las calificaciones desde el Libro de Calificaciones</p>
        </Card>
      ) : (
        <>
          {/* Métricas principales de calificaciones */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center text-white">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{gradeStats.totalEvaluated}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Evaluados</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-xl flex items-center justify-center text-white">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{gradeStats.avgScore.toFixed(0)}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Promedio General</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{gradeStats.distribution.AD}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Logro Destacado</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-rose-600 rounded-xl flex items-center justify-center text-white">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{gradeStats.needsSupport.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Necesitan Apoyo</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Distribución de calificaciones */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Distribución de Logros</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">AD</p>
                <p className="text-xl font-semibold text-emerald-600 mt-1">{gradeStats.distribution.AD}</p>
                <p className="text-xs text-gray-500 mt-1">Logro Destacado</p>
                <p className="text-xs text-gray-400">
                  {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.AD / gradeStats.totalEvaluated) * 100) : 0}%
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">A</p>
                <p className="text-xl font-semibold text-blue-600 mt-1">{gradeStats.distribution.A}</p>
                <p className="text-xs text-gray-500 mt-1">Logro Esperado</p>
                <p className="text-xs text-gray-400">
                  {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.A / gradeStats.totalEvaluated) * 100) : 0}%
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">B</p>
                <p className="text-xl font-semibold text-amber-600 mt-1">{gradeStats.distribution.B}</p>
                <p className="text-xs text-gray-500 mt-1">En Proceso</p>
                <p className="text-xs text-gray-400">
                  {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.B / gradeStats.totalEvaluated) * 100) : 0}%
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-600">C</p>
                <p className="text-xl font-semibold text-red-600 mt-1">{gradeStats.distribution.C}</p>
                <p className="text-xs text-gray-500 mt-1">En Inicio</p>
                <p className="text-xs text-gray-400">
                  {gradeStats.totalEvaluated > 0 ? Math.round((gradeStats.distribution.C / gradeStats.totalEvaluated) * 100) : 0}%
                </p>
              </div>
            </div>
          </Card>

          {/* Alertas de estudiantes que necesitan apoyo */}
          {gradeStats.needsSupport.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-400">
                    ⚠️ {gradeStats.needsSupport.length} estudiante{gradeStats.needsSupport.length > 1 ? 's' : ''} necesitan apoyo académico
                  </h3>
                  <p className="text-sm text-red-600 mt-1">
                    Estos estudiantes tienen calificación C o B bajo. Considera reforzar conceptos o brindar tutorías.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {gradeStats.needsSupport.slice(0, 6).map((student) => (
                      <div key={student.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              student.gradeInfo.bucket === 'C' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {student.gradeInfo.label}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{getDisplayName(student)}</span>
                        <span className="text-xs text-gray-500">{student.gradeInfo.avg.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Estudiantes por Calificación */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Top Calificaciones</h3>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Logro Destacado (AD)</span>
              </div>
              {gradeStats.topPerformers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aún no hay estudiantes con AD</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gradeStats.topPerformers.map((student, idx) => (
                    <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="font-bold text-emerald-600">#{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800 dark:text-white truncate block">{getDisplayName(student)}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Promedio: {student.gradeInfo.avg.toFixed(1)}%</p>
                      </div>
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 font-bold rounded-lg text-sm">
                        AD
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Listado de todos los estudiantes con selector */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">Todos los Estudiantes</h3>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Por promedio</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {gradeStats.studentsWithGrades.map((student) => (
                  <div 
                    key={student.id} 
                    onClick={() => setSelectedStudent(selectedStudent === student.id ? null : student.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedStudent === student.id 
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      getBucketBadgeClass(student.gradeInfo.bucket)
                    }`}>
                      {student.gradeInfo.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 dark:text-white truncate block text-sm">{getDisplayName(student)}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {student.gradeInfo.avg.toFixed(0)}%
                    </span>
                    {selectedStudent === student.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Detalle del estudiante seleccionado */}
          {selectedStudent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-5">
                {(() => {
                  const student = gradeStats.studentsWithGrades.find(s => s.id === selectedStudent);
                  if (!student) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                          <StudentAvatarMini
                            studentProfileId={student.id}
                            gender={student.avatarGender || 'MALE'}
                            size="xl"
                            className="scale-[0.22] origin-top"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 dark:text-white">{getDisplayName(student)}</h3>
                          <p className="text-sm text-gray-500">Promedio: <span className="font-semibold">{student.gradeInfo.avg.toFixed(1)}%</span> ({student.gradeInfo.label})</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-xl text-lg font-bold ${
                          getBucketBadgeClass(student.gradeInfo.bucket)
                        }`}>
                          {student.gradeInfo.label}
                        </span>
                      </div>
                      
                      {/* Calificaciones por competencia con detalle */}
                      <div className="space-y-4">
                        {student.gradeInfo.grades.map((grade: any) => (
                          <div key={grade.competencyId} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{grade.competencyName}</p>
                                <p className="text-xs text-gray-500">{grade.activitiesCount || 0} actividades registradas</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-300">{parseFloat(grade.score).toFixed(0)}%</span>
                                <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                                  getBucketBadgeClass(grade.bucket)
                                }`}>
                                  {grade.gradeLabel}
                                </span>
                              </div>
                            </div>
                            
                            {/* Detalle de actividades que contribuyen */}
                            {grade.calculationDetails?.activities && grade.calculationDetails.activities.length > 0 ? (
                              <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                                <p className="text-xs font-medium text-gray-500 mb-2">📋 Registros que contribuyen a esta nota:</p>
                                {grade.calculationDetails.activities.map((activity: any, idx: number) => {
                                  const getActivityIcon = (type: string) => {
                                    switch (type) {
                                      case 'BEHAVIOR': return '🎯';
                                      case 'BADGE': return '🏅';
                                      case 'TOURNAMENT': return '🏆';
                                      case 'EXPEDITION': return '🗺️';
                                      case 'TIMER': return '⏱️';
                                      case 'MANUAL_POINTS': return '🧾';
                                      default: return '📝';
                                    }
                                  };
                                  const getActivityLabel = (type: string) => {
                                    switch (type) {
                                      case 'BEHAVIOR': return 'Comportamiento';
                                      case 'BADGE': return 'Insignia';
                                      case 'TOURNAMENT': return 'Torneo';
                                      case 'EXPEDITION': return 'Expedición';
                                      case 'TIMER': return 'Actividad';
                                      case 'MANUAL_POINTS': return 'Punto manual';
                                      default: return 'Actividad';
                                    }
                                  };
                                  const isPositive = activity.score >= 50;
                                  
                                  return (
                                    <div 
                                      key={`${activity.id}-${idx}`} 
                                      className={`flex items-center justify-between p-2 rounded-lg ${
                                        isPositive 
                                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800' 
                                          : 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-lg">{getActivityIcon(activity.type)}</span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{activity.name}</p>
                                          <p className="text-xs text-gray-500">{getActivityLabel(activity.type)} • Peso: {activity.weight}%</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 ml-2">
                                        <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                          {activity.score}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <p className="text-xs text-gray-400 italic">Sin actividades registradas para esta competencia</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </Card>
            </motion.div>
          )}

          {/* Consejos para mejorar calificaciones */}
          <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">💡 Recomendaciones para padres y profesores</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {gradeStats.needsSupport.length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">•</span>
                      <span><strong>{gradeStats.needsSupport.length} estudiantes</strong> requieren refuerzo académico. Considera tutorías individuales.</span>
                    </li>
                  )}
                  {gradeStats.distribution.AD > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>¡Excelente! <strong>{gradeStats.distribution.AD} estudiantes</strong> tienen Logro Destacado. Reconoce su esfuerzo.</span>
                    </li>
                  )}
                  {gradeStats.avgScore < 65 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>El promedio general está por debajo del logro esperado. Revisa las estrategias de enseñanza.</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>Las actividades gamificadas como misiones y torneos contribuyen a las calificaciones. ¡Incentívalas!</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
