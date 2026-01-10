import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Award,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
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
                activity.type === 'MISSION' ? 'bg-blue-500' :
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
                 activity.type === 'MISSION' ? 'Misión' :
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
  const { selectedClassIndex } = useStudentStore();
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);

  // Obtener perfil del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const currentProfile = myClasses?.[selectedClassIndex];
  const classroom = currentProfile?.classroom;

  // Obtener áreas curriculares para nombres de competencias
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: !!classroom?.useCompetencies,
  });

  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  // Obtener calificaciones del estudiante
  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['my-grades', currentProfile?.id],
    queryFn: () => gradeApi.getStudentGrades(currentProfile!.id),
    enabled: !!currentProfile?.id && !!classroom?.useCompetencies,
  });

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

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
          <BookOpen size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Mis Calificaciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {classroom?.name}
          </p>
        </div>
      </div>

      {/* Resumen */}
      <Card className="p-5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm mb-1">Promedio General</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{average}%</span>
              <TrendingUp size={20} className="text-purple-200" />
            </div>
            <p className="text-purple-200 text-xs mt-1">
              {grades.length} competencias evaluadas
            </p>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <Award size={40} className="text-white" />
          </div>
        </div>
      </Card>

      {/* Lista de competencias */}
      {grades.length === 0 ? (
        <Card className="p-8 text-center">
          <Award className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Sin calificaciones aún
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Tu profesor aún no ha registrado calificaciones para este período.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Info size={16} />
            Detalle por Competencia
          </h2>
          
          {grades.map((grade) => {
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
          })}
        </div>
      )}

      {/* Leyenda */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Escala de Calificación
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('AD')}`}>AD</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">Destacado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('A')}`}>A</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">Esperado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('B')}`}>B</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">En proceso</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor('C')}`}>C</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">En inicio</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
