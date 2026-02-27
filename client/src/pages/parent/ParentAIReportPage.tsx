import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Clock,
  TrendingUp,
  Star,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Zap,
  CheckCircle,
  Award,
  Calendar,
  Target,
  Heart,
} from 'lucide-react';
import { parentApi } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeUntilExpiry(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m restantes`;
  return `${minutes}m restantes`;
}

export default function ParentAIReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const queryClient = useQueryClient();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['parent-ai-report', studentId],
    queryFn: () => parentApi.getAIReport(studentId!),
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => parentApi.regenerateAIReport(studentId!),
    onSuccess: (data) => {
      queryClient.setQueryData(['parent-ai-report', studentId], data);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/parent/ai-report" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informe inteligente</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-12 h-12 text-purple-500" />
          </motion.div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Generando informe inteligente...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Esto puede tomar unos segundos</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !report) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/parent/ai-report" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informe inteligente</h1>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No se pudo generar el informe. Intenta de nuevo más tarde.
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['parent-ai-report', studentId] })}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  const canRegenerate = !regenerateMutation.isPending;
  const isExpired = new Date(report.expiresAt).getTime() <= Date.now();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/parent/ai-report" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informe inteligente</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {report.studentName} · {report.classroomName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
            <Clock size={12} />
            <span>{report.cached ? 'En caché · ' : ''}{timeUntilExpiry(report.expiresAt)}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => regenerateMutation.mutate()}
            disabled={!canRegenerate}
            leftIcon={<RefreshCw size={14} className={regenerateMutation.isPending ? 'animate-spin' : ''} />}
          >
            {regenerateMutation.isPending ? 'Generando...' : isExpired ? 'Generar nuevo' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Meta info */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-6">
        Generado el {formatDate(report.generatedAt)} · Analiza los últimos 7 días de actividad
      </div>

      {/* Weekly Highlights */}
      {report.weeklyHighlights?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
        >
          {report.weeklyHighlights?.map((highlight, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl px-4 py-3 border border-purple-100 dark:border-purple-800/30"
            >
              <Zap size={14} className="text-purple-500 flex-shrink-0" />
              <span className="text-sm text-purple-800 dark:text-purple-300">{highlight}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6"
      >
        <StatBadge icon={<CheckCircle size={16} />} label="Positivos" value={report.stats?.positiveActions ?? 0} color="green" />
        <StatBadge icon={<AlertTriangle size={16} />} label="Observaciones" value={report.stats?.negativeActions ?? 0} color="amber" />
        <StatBadge icon={<Zap size={16} />} label="XP Total" value={report.stats?.totalXP ?? 0} color="blue" />
        <StatBadge icon={<Award size={16} />} label="Insignias" value={report.stats?.badges ?? 0} color="purple" />
        <StatBadge icon={<Calendar size={16} />} label="Asistencia" value={`${report.stats?.attendanceRate ?? 0}%`} color="teal" />
        <StatBadge icon={<Target size={16} />} label="Promedio" value={report.stats?.averageGrade || '—'} color="indigo" />
        <StatBadge icon={<Heart size={16} />} label="Racha" value={`${report.stats?.loginStreak ?? 0}d`} color="rose" />
      </motion.div>

      {/* Main content sections */}
      <div className="space-y-5">
        {/* Summary */}
        <ReportSection
          icon={<MessageSquare size={18} />}
          title="Resumen general"
          gradient="from-indigo-500 to-blue-500"
          delay={0.1}
        >
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{report.summary}</p>
        </ReportSection>

        {/* Behavior Analysis */}
        <ReportSection
          icon={<TrendingUp size={18} />}
          title="Análisis de comportamiento"
          gradient="from-orange-500 to-amber-500"
          delay={0.15}
        >
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{report.behaviorAnalysis}</p>
        </ReportSection>

        {/* Strengths & Areas to Improve */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ReportSection
            icon={<Star size={18} />}
            title="Fortalezas"
            gradient="from-emerald-500 to-green-500"
            delay={0.2}
          >
            <ul className="space-y-2">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </ReportSection>

          <ReportSection
            icon={<AlertTriangle size={18} />}
            title="Áreas de mejora"
            gradient="from-amber-500 to-orange-500"
            delay={0.25}
          >
            <ul className="space-y-2">
              {(report.areasToImprove || []).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Target size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  {a}
                </li>
              ))}
            </ul>
          </ReportSection>
        </div>

        {/* Recommendations */}
        <ReportSection
          icon={<Lightbulb size={18} />}
          title="Recomendaciones"
          gradient="from-blue-500 to-cyan-500"
          delay={0.3}
        >
          <div className="space-y-2">
            {(report.recommendations || []).map((r, i) => (
              <div key={i} className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{r}</p>
              </div>
            ))}
          </div>
        </ReportSection>

        {/* Predictions */}
        {report.predictions && (
          <ReportSection
            icon={<TrendingUp size={18} />}
            title="Proyección"
            gradient="from-teal-500 to-emerald-500"
            delay={0.35}
          >
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{report.predictions}</p>
          </ReportSection>
        )}

        {/* Parent Tips */}
        <ReportSection
          icon={<Heart size={18} />}
          title="Tips para padres"
          gradient="from-rose-500 to-pink-500"
          delay={0.4}
        >
          <div className="space-y-2">
            {(report.parentTips || []).map((tip, i) => (
              <div key={i} className="flex items-start gap-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">
                <span className="text-rose-500 flex-shrink-0 mt-0.5">💡</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
              </div>
            ))}
          </div>
        </ReportSection>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
        Este informe fue generado con inteligencia artificial y puede contener imprecisiones.
        <br />
        Consulta con el profesor para obtener información más detallada.
      </div>
    </div>
  );
}

// Reusable section component
function ReportSection({
  icon,
  title,
  gradient,
  delay = 0,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  gradient: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="overflow-hidden p-0">
        <div className={`flex items-center gap-2 px-5 py-3 bg-gradient-to-r ${gradient}`}>
          <span className="text-white">{icon}</span>
          <h2 className="font-semibold text-white">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </motion.div>
  );
}

// Stat badge component
function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className={`rounded-xl p-3 text-center ${colorMap[color] || colorMap.blue}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}
