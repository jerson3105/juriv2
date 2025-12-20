import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  Monitor,
} from 'lucide-react';
import {
  bugReportApi,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  type BugReport,
  type BugReportStatus,
  type BugReportPriority,
  type BugReportCategory,
} from '../../lib/bugReportApi';
import toast from 'react-hot-toast';

const STATUS_ICONS: Record<BugReportStatus, any> = {
  PENDING: Clock,
  IN_PROGRESS: RefreshCw,
  RESOLVED: CheckCircle,
  CLOSED: XCircle,
};

export const AdminBugReports = () => {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [filters, setFilters] = useState<{
    status?: BugReportStatus;
    priority?: BugReportPriority;
    category?: BugReportCategory;
  }>({});
  const [adminNotes, setAdminNotes] = useState('');

  // Obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['bug-report-stats'],
    queryFn: bugReportApi.getStats,
  });

  // Obtener reportes
  const { data: reportsData, isLoading, refetch } = useQuery({
    queryKey: ['bug-reports', filters],
    queryFn: () => bugReportApi.getAllReports(filters),
  });

  // Mutación para actualizar estado
  const updateStatusMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: BugReportStatus }) =>
      bugReportApi.updateStatus(reportId, status),
    onSuccess: (updatedReport) => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-report-stats'] });
      setSelectedReport(updatedReport);
      toast.success('Estado actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar estado');
    },
  });

  // Mutación para actualizar notas
  const updateNotesMutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes: string }) =>
      bugReportApi.updateNotes(reportId, notes),
    onSuccess: (updatedReport) => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      setSelectedReport(updatedReport);
      toast.success('Notas guardadas');
    },
    onError: () => {
      toast.error('Error al guardar notas');
    },
  });

  const handleSelectReport = (report: BugReport) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
  };

  const handleSaveNotes = () => {
    if (selectedReport) {
      updateNotesMutation.mutate({ reportId: selectedReport.id, notes: adminNotes });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseBrowserInfo = (info?: string) => {
    if (!info) return null;
    try {
      return JSON.parse(info);
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl text-white">
              <Bug size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Reportes de Bugs
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Gestiona los reportes enviados por los profesores
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 shadow-sm border border-yellow-200 dark:border-yellow-800"
            >
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-yellow-600/80">Pendientes</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 shadow-sm border border-blue-200 dark:border-blue-800"
            >
              <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-blue-600/80">En Progreso</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 shadow-sm border border-green-200 dark:border-green-800"
            >
              <div className="text-3xl font-bold text-green-600">{stats.resolved}</div>
              <div className="text-sm text-green-600/80">Resueltos</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 shadow-sm border border-red-200 dark:border-red-800"
            >
              <div className="text-3xl font-bold text-red-600">{stats.criticalPending}</div>
              <div className="text-sm text-red-600/80">Críticos Pendientes</div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Filter size={18} />
              <span className="font-medium">Filtros:</span>
            </div>

            <div className="relative">
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as BugReportStatus || undefined })}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.priority || ''}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value as BugReportPriority || undefined })}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
              >
                <option value="">Todas las prioridades</option>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters({ ...filters, category: e.target.value as BugReportCategory || undefined })}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer"
              >
                <option value="">Todas las categorías</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setFilters({})}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Limpiar filtros
            </button>

            <button
              onClick={() => refetch()}
              className="ml-auto p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : reportsData?.reports.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
                <Bug className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay reportes
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  No se encontraron reportes con los filtros seleccionados
                </p>
              </div>
            ) : (
              reportsData?.reports.map((report) => {
                const StatusIcon = STATUS_ICONS[report.status];
                return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSelectReport(report)}
                    className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-2 ${
                      selectedReport?.id === report.id
                        ? 'border-orange-500'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[report.priority]}`}>
                            {PRIORITY_LABELS[report.priority]}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status]}`}>
                            <StatusIcon className="w-3 h-3 inline mr-1" />
                            {STATUS_LABELS[report.status]}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {report.user?.firstName} {report.user?.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {CATEGORY_LABELS[report.category]}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedReport ? (
                <motion.div
                  key={selectedReport.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm sticky top-6"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[selectedReport.priority]}`}>
                        {PRIORITY_LABELS[selectedReport.priority]}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedReport.status]}`}>
                        {STATUS_LABELS[selectedReport.status]}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {selectedReport.title}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Descripción */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Descripción
                      </h4>
                      <p className="text-gray-900 dark:text-white text-sm whitespace-pre-wrap">
                        {selectedReport.description}
                      </p>
                    </div>

                    {/* Info del usuario */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Reportado por
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedReport.user?.firstName} {selectedReport.user?.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{selectedReport.user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* URL */}
                    {selectedReport.currentUrl && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                          URL del problema
                        </h4>
                        <a
                          href={selectedReport.currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {selectedReport.currentUrl}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}

                    {/* Browser Info */}
                    {selectedReport.browserInfo && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <Monitor size={14} />
                          Info del navegador
                        </h4>
                        {(() => {
                          const info = parseBrowserInfo(selectedReport.browserInfo);
                          if (!info) return <p className="text-xs text-gray-500">No disponible</p>;
                          return (
                            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 space-y-1">
                              <p><span className="font-medium">Pantalla:</span> {info.screenWidth}x{info.screenHeight}</p>
                              <p><span className="font-medium">Ventana:</span> {info.windowWidth}x{info.windowHeight}</p>
                              <p><span className="font-medium">Plataforma:</span> {info.platform}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Creado:</span>
                        <p className="text-gray-900 dark:text-white">{formatDate(selectedReport.createdAt)}</p>
                      </div>
                      {selectedReport.resolvedAt && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Resuelto:</span>
                          <p className="text-gray-900 dark:text-white">{formatDate(selectedReport.resolvedAt)}</p>
                        </div>
                      )}
                    </div>

                    {/* Cambiar estado */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Cambiar estado
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as BugReportStatus[]).map((status) => {
                          const Icon = STATUS_ICONS[status];
                          return (
                            <button
                              key={status}
                              onClick={() => updateStatusMutation.mutate({ reportId: selectedReport.id, status })}
                              disabled={updateStatusMutation.isPending || selectedReport.status === status}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                                selectedReport.status === status
                                  ? STATUS_COLORS[status] + ' ring-2 ring-offset-2 ring-current'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              } disabled:opacity-50`}
                            >
                              <Icon size={12} />
                              {STATUS_LABELS[status]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notas del admin */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                        <MessageSquare size={14} />
                        Notas del administrador
                      </h4>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Agregar notas sobre este reporte..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleSaveNotes}
                        disabled={updateNotesMutation.isPending || adminNotes === (selectedReport.adminNotes || '')}
                        className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {updateNotesMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar notas'
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center"
                >
                  <Bug className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Selecciona un reporte para ver los detalles
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
