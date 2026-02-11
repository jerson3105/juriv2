import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  School,
  Search,
  Plus,
  MapPin,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Send,
  FileText,
  Shield,
  Building2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  BookOpen,
  UserPlus,
  Mail,
  Check,
  GraduationCap,
  User,
  Star,
  Trash2,
  Download,
  X,
  Zap,
  Heart,
  Coins,
  Award,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { schoolApi, type MySchool, type CreateSchoolData, type SchoolMember } from '../../lib/schoolApi';
import { historyApi } from '../../lib/historyApi';
import { attendanceApi } from '../../lib/attendanceApi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

type Step = 'list' | 'search' | 'create-manual' | 'verification' | 'detail';
type DetailTab = 'teachers' | 'classes' | 'behaviors' | 'badges' | 'reports';

const ClassReportPanel = ({ classroomId, className: clsName }: { classroomId: string; className: string }) => {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['class-report-stats', classroomId],
    queryFn: () => historyApi.getClassroomStats(classroomId),
  });

  const { data: attStats, isLoading: loadingAtt } = useQuery({
    queryKey: ['class-report-attendance', classroomId],
    queryFn: () => attendanceApi.getClassroomStats(classroomId),
  });

  const isLoading = loadingStats || loadingAtt;

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Cargando reporte...
        </div>
      </div>
    );
  }

  const attendancePct = Math.round(attStats?.attendanceRate ?? 0);

  return (
    <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 space-y-3">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
        <BarChart3 size={12} /> Reporte de {clsName}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats?.totalXpGiven ?? 0}</p>
          <p className="text-[10px] text-emerald-500 dark:text-emerald-500 flex items-center justify-center gap-1"><Zap size={10} /> XP otorgado</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{stats?.totalXpRemoved ?? 0}</p>
          <p className="text-[10px] text-red-500 dark:text-red-500 flex items-center justify-center gap-1"><TrendingDown size={10} /> XP removido</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{attendancePct}%</p>
          <p className="text-[10px] text-blue-500 dark:text-blue-500 flex items-center justify-center gap-1"><Activity size={10} /> Asistencia</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats?.totalPurchases ?? 0}</p>
          <p className="text-[10px] text-amber-500 dark:text-amber-500 flex items-center justify-center gap-1"><Coins size={10} /> Compras</p>
        </div>
      </div>

      {/* Top students */}
      {stats?.topStudents && stats.topStudents.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <TrendingUp size={11} /> Top estudiantes por XP
          </p>
          <div className="space-y-1">
            {stats.topStudents.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  i === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                  i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{s.name}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <Zap size={10} /> {s.xp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top behaviors */}
      {((stats?.topPositiveBehaviors && stats.topPositiveBehaviors.length > 0) || (stats?.topNegativeBehaviors && stats.topNegativeBehaviors.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats?.topPositiveBehaviors && stats.topPositiveBehaviors.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                <TrendingUp size={11} /> Comportamientos positivos
              </p>
              <div className="space-y-1">
                {stats.topPositiveBehaviors.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-sm flex-shrink-0">{b.icon || '✅'}</span>
                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{b.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats?.topNegativeBehaviors && stats.topNegativeBehaviors.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                <TrendingDown size={11} /> Comportamientos negativos
              </p>
              <div className="space-y-1">
                {stats.topNegativeBehaviors.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-sm flex-shrink-0">{b.icon || '⚠️'}</span>
                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                    <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">{b.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SchoolsPage = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolForVerification, setSelectedSchoolForVerification] = useState<{ id: string; name: string } | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<MySchool | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('teachers');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  // Form state para crear escuela manual
  const [createForm, setCreateForm] = useState<CreateSchoolData>({
    name: '',
    address: '',
    city: '',
    province: '',
    country: 'Perú',
  });

  // Form state para verificación
  const [verificationForm, setVerificationForm] = useState({
    position: '',
    details: '',
  });

  const { data: mySchools = [], isLoading } = useQuery({
    queryKey: ['my-schools'],
    queryFn: schoolApi.getMySchools,
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['school-search', searchQuery],
    queryFn: () => schoolApi.search(searchQuery),
    enabled: searchQuery.length >= 2 && step === 'search',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSchoolData) => schoolApi.create(data),
    onSuccess: (school) => {
      queryClient.invalidateQueries({ queryKey: ['my-schools'] });
      toast.success('Escuela registrada. Envía tu verificación.');
      setSelectedSchoolForVerification({ id: school.id, name: school.name });
      setStep('verification');
      setCreateForm({ name: '', address: '', city: '', province: '', country: 'Perú' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear escuela');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (schoolId: string) => schoolApi.requestJoin(schoolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-schools'] });
      toast.success('Solicitud enviada al responsable de la escuela');
      setStep('list');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al solicitar unirse');
    },
  });

  const verificationMutation = useMutation({
    mutationFn: (data: { schoolId: string; position: string; details?: string }) =>
      schoolApi.createVerification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-schools'] });
      toast.success('Verificación enviada. Te notificaremos cuando sea revisada.');
      setStep('list');
      setVerificationForm({ position: '', details: '' });
      setSelectedSchoolForVerification(null);
    },
    onError: () => {
      toast.error('Error al enviar verificación');
    },
  });

  const [expandedPendingSchool, setExpandedPendingSchool] = useState<string | null>(null);

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-requests', expandedPendingSchool],
    queryFn: () => schoolApi.getPendingRequests(expandedPendingSchool!),
    enabled: !!expandedPendingSchool,
  });

  const reviewJoinMutation = useMutation({
    mutationFn: ({ memberId, approved, reason }: { memberId: string; approved: boolean; reason?: string }) =>
      schoolApi.reviewJoinRequest(memberId, approved, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-schools'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      toast.success(variables.approved ? 'Profesor aceptado' : 'Solicitud rechazada');
    },
    onError: () => {
      toast.error('Error al procesar solicitud');
    },
  });

  const cancelJoinMutation = useMutation({
    mutationFn: (memberId: string) => schoolApi.cancelJoinRequest(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-schools'] });
      toast.success('Solicitud cancelada');
    },
    onError: () => {
      toast.error('Error al cancelar solicitud');
    },
  });

  const handleCreateManual = () => {
    if (!createForm.name.trim()) {
      toast.error('El nombre de la escuela es requerido');
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleSendVerification = () => {
    if (!verificationForm.position.trim()) {
      toast.error('Indica tu cargo en la escuela');
      return;
    }
    if (!selectedSchoolForVerification) return;
    verificationMutation.mutate({
      schoolId: selectedSchoolForVerification.id,
      position: verificationForm.position,
      details: verificationForm.details || undefined,
    });
  };

  const getStatusBadge = (school: MySchool) => {
    switch (school.memberStatus) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            <CheckCircle size={12} /> Verificado
          </span>
        );
      case 'PENDING_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            <Clock size={12} /> Pendiente de verificación
          </span>
        );
      case 'PENDING_OWNER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            <Clock size={12} /> Esperando aprobación
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            <XCircle size={12} /> Rechazado
          </span>
        );
    }
  };

  // ==================== STEP: LIST ====================
  if (step === 'list') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <School size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">Mi Escuela</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gestiona tu escuela y sus clases</p>
            </div>
          </div>
          <button
            onClick={() => setStep('search')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow"
          >
            <Plus size={18} />
            Agregar Escuela
          </button>
        </div>

        {/* Lista de escuelas */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : mySchools.length === 0 ? (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <Building2 size={28} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              No tienes escuela aún
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
              Busca tu escuela o regístrala para agrupar tus clases
            </p>
            <button
              onClick={() => setStep('search')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25"
            >
              <Search size={18} />
              Buscar mi escuela
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mySchools.map((school) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (school.memberStatus === 'VERIFIED' || (school.memberRole === 'OWNER' && school.memberStatus === 'PENDING_ADMIN')) {
                    setSelectedSchool(school);
                    setStep('detail');
                    setExpandedTeacher(null);
                  }
                }}
                className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 ${
                  school.memberStatus === 'VERIFIED' || (school.memberRole === 'OWNER' && school.memberStatus === 'PENDING_ADMIN')
                    ? 'cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <School size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800 dark:text-white truncate">{school.name}</h3>
                        {getStatusBadge(school)}
                        {school.memberRole === 'OWNER' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                            <Shield size={10} /> Responsable
                          </span>
                        )}
                      </div>
                      {school.address && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {school.city ? `${school.city}, ` : ''}{school.country}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Users size={12} /> {school.memberCount} profesor(es)</span>
                        <span className="flex items-center gap-1"><BookOpen size={12} /> {school.classroomCount} clase(s)</span>
                      </div>
                    </div>
                  </div>
                  {(school.memberStatus === 'VERIFIED' || (school.memberRole === 'OWNER' && school.memberStatus === 'PENDING_ADMIN')) && (
                    <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {/* Solicitudes pendientes (solo OWNER verificado) */}
                {school.memberRole === 'OWNER' && school.pendingRequestCount > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedPendingSchool(expandedPendingSchool === school.id ? null : school.id)}
                      className="w-full flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <UserPlus size={16} className="text-orange-500" />
                        <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          {school.pendingRequestCount} solicitud(es) de unión pendiente(s)
                        </span>
                      </div>
                      <ChevronRight size={16} className={`text-orange-400 transition-transform ${expandedPendingSchool === school.id ? 'rotate-90' : ''}`} />
                    </button>

                    {expandedPendingSchool === school.id && (
                      <div className="mt-2 space-y-2">
                        {pendingRequests.length === 0 ? (
                          <div className="p-3 text-center">
                            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
                          </div>
                        ) : (
                          pendingRequests.map((request: SchoolMember) => (
                            <div key={request.id} className="p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Users size={14} className="text-gray-500 dark:text-gray-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{request.firstName} {request.lastName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Mail size={10} /> {request.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  <button
                                    onClick={() => reviewJoinMutation.mutate({ memberId: request.id, approved: true })}
                                    disabled={reviewJoinMutation.isPending}
                                    className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                    title="Aceptar"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => reviewJoinMutation.mutate({ memberId: request.id, approved: false, reason: 'Solicitud rechazada por el responsable' })}
                                    disabled={reviewJoinMutation.isPending}
                                    className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                    title="Rechazar"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mensajes según estado */}
                {school.memberStatus === 'PENDING_ADMIN' && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Verificación pendiente</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Tu escuela está pendiente de verificación por el equipo de Juried. Envía tu documentación para acelerar el proceso.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSchoolForVerification({ id: school.id, name: school.name });
                              setStep('verification');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
                          >
                            <FileText size={14} />
                            Enviar documentación
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('¿Estás seguro de que deseas cancelar el registro de esta escuela?')) {
                                cancelJoinMutation.mutate(school.memberId);
                              }
                            }}
                            disabled={cancelJoinMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Cancelar registro
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {school.memberStatus === 'PENDING_OWNER' && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Clock size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Esperando aprobación</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          El responsable de la escuela debe aprobar tu solicitud de unión.
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelJoinMutation.mutate(school.memberId); }}
                          disabled={cancelJoinMutation.isPending}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Cancelar solicitud
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {school.memberStatus === 'REJECTED' && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">Solicitud rechazada</p>
                        {school.rejectionReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{school.rejectionReason}</p>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelJoinMutation.mutate(school.memberId); }}
                          disabled={cancelJoinMutation.isPending}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Eliminar de mi lista
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== STEP: SEARCH ====================
  if (step === 'search') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep('list'); setSearchQuery(''); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Search size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">Encuentra tu escuela</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Busca por nombre de la escuela</p>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Búsqueda por nombre de la escuela o la dirección"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Resultados */}
        {searchQuery.length >= 2 && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
            {isSearching ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Buscando...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {searchResults.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => {
                      joinMutation.mutate(school.id);
                    }}
                    disabled={joinMutation.isPending}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">{school.name}</p>
                      {school.address && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {school.address}{school.city ? `, ${school.city}` : ''}, {school.country}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-4">
                      {school.memberCount} profesor(es)
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No se encontraron escuelas</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Puedes registrar tu escuela manualmente</p>
              </div>
            )}
          </div>
        )}

        {/* Opción de crear manualmente */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
          <button
            onClick={() => setStep('create-manual')}
            className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Plus size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-800 dark:text-white text-sm">¿No encuentras tu escuela?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Agrégala manualmente</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  // ==================== STEP: CREATE MANUAL ====================
  if (step === 'create-manual') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('search')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">Agrega tu escuela</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completa la información de tu escuela</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">País</label>
            <select
              value={createForm.country}
              onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Perú">Perú</option>
              <option value="México">México</option>
              <option value="Colombia">Colombia</option>
              <option value="Argentina">Argentina</option>
              <option value="Chile">Chile</option>
              <option value="Ecuador">Ecuador</option>
              <option value="Bolivia">Bolivia</option>
              <option value="España">España</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la escuela *</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Nombre de la escuela"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
            <input
              type="text"
              value={createForm.address}
              onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
              placeholder="Dirección"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ciudad</label>
              <input
                type="text"
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                placeholder="Ciudad"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provincia / Estado</label>
              <input
                type="text"
                value={createForm.province}
                onChange={(e) => setCreateForm({ ...createForm, province: e.target.value })}
                placeholder="Provincia"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setStep('search')}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateManual}
              disabled={createMutation.isPending || !createForm.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              Agregar escuela
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STEP: VERIFICATION ====================
  if (step === 'verification') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep('list'); setSelectedSchoolForVerification(null); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">Verificación de profesor</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verifica tu rol en {selectedSchoolForVerification?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-2">
            <Shield size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">¿Por qué necesitamos verificarte?</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Por seguridad, verificamos que realmente eres parte de la escuela. Un miembro del equipo de Juried revisará tu información.
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">¿Qué puesto ocupas en la escuela? *</label>
            <select
              value={verificationForm.position}
              onChange={(e) => setVerificationForm({ ...verificationForm, position: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona tu cargo</option>
              <option value="Director(a)">Director(a)</option>
              <option value="Subdirector(a)">Subdirector(a)</option>
              <option value="Coordinador(a) Académico">Coordinador(a) Académico</option>
              <option value="Profesor(a)">Profesor(a)</option>
              <option value="Auxiliar">Auxiliar</option>
              <option value="Tutor(a)">Tutor(a)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Detalles de la solicitud</label>
            <textarea
              value={verificationForm.details}
              onChange={(e) => setVerificationForm({ ...verificationForm, details: e.target.value })}
              placeholder="Introduce detalles que ayuden a verificar tu identidad (ej: área que enseñas, años en la escuela, etc.)"
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep('list'); setSelectedSchoolForVerification(null); }}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSendVerification}
              disabled={verificationMutation.isPending || !verificationForm.position}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-shadow disabled:opacity-50"
            >
              {verificationMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
              Enviar verificación
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STEP: DETAIL ====================
  if (step === 'detail' && selectedSchool) {
    return (
      <SchoolDetailView
        school={selectedSchool}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        expandedTeacher={expandedTeacher}
        setExpandedTeacher={setExpandedTeacher}
        onBack={() => { setStep('list'); setSelectedSchool(null); }}
      />
    );
  }

  return null;
};

// ==================== COMPONENTE DE DETALLE ====================
const SchoolDetailView = ({
  school,
  detailTab,
  setDetailTab,
  expandedTeacher,
  setExpandedTeacher,
  onBack,
}: {
  school: MySchool;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  expandedTeacher: string | null;
  setExpandedTeacher: (id: string | null) => void;
  onBack: () => void;
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = school.memberRole === 'OWNER';

  // State para filtro de clases
  const [classSearch, setClassSearch] = useState('');
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedClassReport, setExpandedClassReport] = useState<string | null>(null);

  // State para crear comportamiento (modal estilo BehaviorModal)
  const [showCreateBehavior, setShowCreateBehavior] = useState(false);
  const [bhName, setBhName] = useState('');
  const [bhDescription, setBhDescription] = useState('');
  const [bhIcon, setBhIcon] = useState('⭐');
  const [bhXp, setBhXp] = useState(10);
  const [bhHp, setBhHp] = useState(0);
  const [bhGp, setBhGp] = useState(0);

  // State para importar
  const [selectedBehaviorIds, setSelectedBehaviorIds] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>([]);

  // Queries
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['school-teachers', school.id],
    queryFn: () => schoolApi.getSchoolTeachers(school.id),
  });

  const { data: schoolDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['school-detail', school.id],
    queryFn: () => schoolApi.getDetail(school.id),
  });

  const { data: schoolBehaviors = [], isLoading: loadingBehaviors } = useQuery({
    queryKey: ['school-behaviors', school.id],
    queryFn: () => schoolApi.getSchoolBehaviors(school.id),
  });

  // Obtener clases del profesor actual en esta escuela
  const { data: myTeacherData } = useQuery({
    queryKey: ['school-teachers', school.id],
    queryFn: () => schoolApi.getSchoolTeachers(school.id),
    select: (data) => data.find(t => t.userId === user?.id),
  });

  const myClassrooms = myTeacherData?.classrooms || [];

  const resetBehaviorForm = () => {
    setBhName(''); setBhDescription(''); setBhIcon('⭐');
    setBhXp(10); setBhHp(0); setBhGp(0);
  };

  const getPrimaryType = (): 'XP' | 'HP' | 'GP' => {
    if (bhXp >= bhHp && bhXp >= bhGp) return 'XP';
    if (bhHp >= bhGp) return 'HP';
    return 'GP';
  };

  const bhHasAnyValue = bhXp > 0 || bhHp > 0 || bhGp > 0;

  // Mutations
  const createBehaviorMutation = useMutation({
    mutationFn: () => {
      const pt = getPrimaryType();
      return schoolApi.createSchoolBehavior(school.id, {
        name: bhName,
        description: bhDescription || undefined,
        pointType: pt,
        pointValue: pt === 'XP' ? bhXp : pt === 'HP' ? bhHp : bhGp,
        xpValue: bhXp,
        hpValue: bhHp,
        gpValue: bhGp,
        icon: bhIcon,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-behaviors', school.id] });
      setShowCreateBehavior(false);
      resetBehaviorForm();
      toast.success('Comportamiento creado');
    },
    onError: () => toast.error('Error al crear comportamiento'),
  });

  const deleteBehaviorMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteSchoolBehavior(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-behaviors', school.id] });
      toast.success('Comportamiento eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const importMutation = useMutation({
    mutationFn: () => schoolApi.importBehaviors(school.id, selectedBehaviorIds, selectedClassroomIds),
    onSuccess: (data) => {
      setShowImportModal(false);
      setSelectedBehaviorIds([]);
      setSelectedClassroomIds([]);
      toast.success(`Se importaron ${data.imported} comportamientos a ${data.classrooms} clase(s)`);
    },
    onError: () => toast.error('Error al importar comportamientos'),
  });

  // ==================== INSIGNIAS DE ESCUELA ====================

  // State para crear insignia (modal)
  const [showCreateBadge, setShowCreateBadge] = useState(false);
  const [bdName, setBdName] = useState('');
  const [bdDescription, setBdDescription] = useState('');
  const [bdIcon, setBdIcon] = useState('🏆');
  const [bdRarity, setBdRarity] = useState<'RARE' | 'EPIC' | 'LEGENDARY'>('RARE');
  const [bdRewardXp, setBdRewardXp] = useState(0);
  const [bdRewardGp, setBdRewardGp] = useState(0);

  // State para importar insignias
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
  const [showImportBadgesModal, setShowImportBadgesModal] = useState(false);
  const [selectedBadgeClassroomIds, setSelectedBadgeClassroomIds] = useState<string[]>([]);

  // Query insignias
  const { data: schoolBadges = [], isLoading: loadingBadges } = useQuery({
    queryKey: ['school-badges', school.id],
    queryFn: () => schoolApi.getSchoolBadges(school.id),
  });

  const resetBadgeForm = () => {
    setBdName(''); setBdDescription(''); setBdIcon('🏆');
    setBdRarity('RARE');
    setBdRewardXp(0); setBdRewardGp(0);
  };

  const createBadgeMutation = useMutation({
    mutationFn: () => schoolApi.createSchoolBadge(school.id, {
      name: bdName,
      description: bdDescription,
      icon: bdIcon,
      rarity: bdRarity,
      rewardXp: bdRewardXp,
      rewardGp: bdRewardGp,
      assignmentMode: 'MANUAL',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-badges', school.id] });
      setShowCreateBadge(false);
      resetBadgeForm();
      toast.success('Insignia creada');
    },
    onError: () => toast.error('Error al crear insignia'),
  });

  const deleteBadgeMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteSchoolBadge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-badges', school.id] });
      toast.success('Insignia eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const importBadgesMutation = useMutation({
    mutationFn: () => schoolApi.importBadges(school.id, selectedBadgeIds, selectedBadgeClassroomIds),
    onSuccess: (data) => {
      setShowImportBadgesModal(false);
      setSelectedBadgeIds([]);
      setSelectedBadgeClassroomIds([]);
      toast.success(`Se importaron ${data.imported} insignias a ${data.classrooms} clase(s)`);
    },
    onError: () => toast.error('Error al importar insignias'),
  });

  const toggleBadgeSelection = (id: string) => {
    setSelectedBadgeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleBadgeClassroomSelection = (id: string) => {
    setSelectedBadgeClassroomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const RARITY_CONFIG = {
    COMMON: { label: 'Común', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-300 dark:border-gray-600' },
    RARE: { label: 'Raro', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-600' },
    EPIC: { label: 'Épico', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-600' },
    LEGENDARY: { label: 'Legendario', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-600' },
  };

  const BADGE_EMOJIS = ['🏆', '⭐', '🎖️', '🥇', '🎓', '🦊', '💎', '👑', '🎯', '🔥', '💪', '📚', '✨', '🌟', '🛡️', '🎨'];

  // ==================== REPORTES ====================
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: reportSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['school-report-summary', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getReportSummary(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const { data: behaviorTrends = [], isLoading: loadingTrends } = useQuery({
    queryKey: ['school-report-trends', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getBehaviorTrends(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const { data: classRanking = [], isLoading: loadingRanking } = useQuery({
    queryKey: ['school-report-ranking', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getClassRanking(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const { data: topBehaviors, isLoading: loadingTopBehaviors } = useQuery({
    queryKey: ['school-report-top-behaviors', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getTopBehaviors(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const { data: studentsAtRisk = [], isLoading: loadingAtRisk } = useQuery({
    queryKey: ['school-report-at-risk', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getStudentsAtRisk(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const { data: attendanceReport, isLoading: loadingAttendance } = useQuery({
    queryKey: ['school-report-attendance', school.id, reportStartDate, reportEndDate],
    queryFn: () => schoolApi.getAttendanceReport(school.id, reportStartDate, reportEndDate),
    enabled: isOwner && detailTab === 'reports',
  });

  const toggleBehaviorSelection = (id: string) => {
    setSelectedBehaviorIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleClassroomSelection = (id: string) => {
    setSelectedClassroomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const tabs: { key: DetailTab; label: string; icon: typeof Users }[] = [
    { key: 'teachers', label: 'Profesores', icon: Users },
    { key: 'classes', label: 'Clases', icon: GraduationCap },
    { key: 'behaviors', label: 'Comportamientos', icon: Star },
    { key: 'badges', label: 'Insignias', icon: Award },
    ...(isOwner ? [{ key: 'reports' as DetailTab, label: 'Reportes', icon: BarChart3 }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <School size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white truncate">{school.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {school.address && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {school.city ? `${school.city}, ` : ''}{school.country}
                </span>
              )}
              <span className="flex items-center gap-1"><Users size={11} /> {school.memberCount} profesores</span>
              <span className="flex items-center gap-1"><BookOpen size={11} /> {school.classroomCount} clases</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Submenú */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = detailTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {active && (
                <motion.div
                  layoutId="school-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido del tab */}
      {detailTab === 'teachers' && (
        <div className="space-y-3">
          {loadingTeachers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <Users size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                No hay profesores verificados
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Los profesores aparecerán aquí cuando sean verificados en la escuela.
              </p>
            </div>
          ) : (
            teachers.map((teacher) => {
              const isExpanded = expandedTeacher === teacher.id;
              return (
                <div
                  key={teacher.id}
                  className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                            {teacher.firstName} {teacher.lastName}
                          </p>
                          {teacher.role === 'OWNER' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                              <Shield size={9} /> Responsable
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Mail size={10} /> {teacher.email}</span>
                          <span className="flex items-center gap-1"><GraduationCap size={10} /> {teacher.classrooms.length} clase{teacher.classrooms.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                          {teacher.classrooms.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
                              Este profesor no tiene clases asignadas a la escuela.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Clases en la escuela
                              </p>
                              {teacher.classrooms.map((cls) => (
                                <div
                                  key={cls.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{cls.name}</p>
                                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                        <span>Código: <span className="font-mono">{cls.code}</span></span>
                                        {cls.gradeLevel && <span>· {cls.gradeLevel}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                      <Users size={12} /> {cls.studentCount}
                                    </span>
                                    {cls.useCompetencies && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        Competencias
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      )}
      {/* Contenido del tab: Clases */}
      {detailTab === 'classes' && (
        <div className="space-y-4">
          {loadingDetail ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !schoolDetail?.classrooms || schoolDetail.classrooms.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <GraduationCap size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                No hay clases en esta escuela
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Las clases aparecerán aquí cuando los profesores las asignen a la escuela.
              </p>
            </div>
          ) : (() => {
            // Mapa de classroomId → teacher name
            const classTeacherMap = new Map<string, string>();
            teachers.forEach(t => {
              t.classrooms.forEach(c => {
                classTeacherMap.set(c.id, `${t.firstName} ${t.lastName}`.trim());
              });
            });

            // Filtrar clases por búsqueda
            const filteredClassrooms = schoolDetail.classrooms.filter(cls => {
              if (!classSearch.trim()) return true;
              const q = classSearch.toLowerCase();
              const teacherName = classTeacherMap.get(cls.id) || '';
              return cls.name.toLowerCase().includes(q) ||
                cls.code.toLowerCase().includes(q) ||
                (cls.gradeLevel || '').toLowerCase().includes(q) ||
                (cls.curriculumAreaName || '').toLowerCase().includes(q) ||
                teacherName.toLowerCase().includes(q);
            });

            // Agrupar clases filtradas por área curricular
            const grouped: Record<string, typeof filteredClassrooms> = {};
            filteredClassrooms.forEach((cls) => {
              const areaKey = cls.curriculumAreaName || '__sin_area__';
              if (!grouped[areaKey]) grouped[areaKey] = [];
              grouped[areaKey].push(cls);
            });
            const areaKeys = Object.keys(grouped).sort((a, b) => {
              if (a === '__sin_area__') return 1;
              if (b === '__sin_area__') return -1;
              return a.localeCompare(b);
            });

            const totalStudents = filteredClassrooms.reduce((sum, c) => sum + c.studentCount, 0);

            const toggleArea = (area: string) => {
              setExpandedAreas(prev => {
                const next = new Set(prev);
                if (next.has(area)) next.delete(area);
                else next.add(area);
                return next;
              });
            };

            return (
              <div className="space-y-4">
                {/* Barra de búsqueda y resumen */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      placeholder="Buscar clase, código, profesor..."
                      className="w-full pl-9 pr-3 py-2 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><GraduationCap size={13} /> {filteredClassrooms.length} clases</span>
                    <span className="flex items-center gap-1"><Users size={13} /> {totalStudents} estudiantes</span>
                  </div>
                </div>

                {filteredClassrooms.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                    No se encontraron clases con "{classSearch}"
                  </div>
                ) : (
                  areaKeys.map((areaKey) => {
                    const isCollapsed = !expandedAreas.has(areaKey);
                    const areaClasses = grouped[areaKey];
                    const areaStudents = areaClasses.reduce((sum, c) => sum + c.studentCount, 0);

                    return (
                      <div key={areaKey}>
                        {/* Encabezado del área - clickeable para colapsar */}
                        <button
                          onClick={() => toggleArea(areaKey)}
                          className="flex items-center gap-2 mb-2 w-full text-left group"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                          ) : (
                            <ChevronDown size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                          )}
                          <BookOpen size={14} className="text-indigo-500 dark:text-indigo-400" />
                          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {areaKey === '__sin_area__' ? 'Sin área curricular' : areaKey}
                          </h3>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {areaClasses.length} clases · {areaStudents} est.
                          </span>
                        </button>

                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {areaClasses.map((cls) => {
                              const teacherName = classTeacherMap.get(cls.id);
                              const isReportOpen = expandedClassReport === cls.id;
                              return (
                                <div
                                  key={cls.id}
                                  className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border shadow-sm hover:shadow-md transition-all p-4 ${
                                    isReportOpen ? 'border-indigo-300 dark:border-indigo-700 sm:col-span-2 lg:col-span-3' : 'border-white/50 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                      <GraduationCap size={18} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-gray-800 dark:text-white truncate leading-tight">{cls.name}</p>
                                      {cls.gradeLevel && (
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{cls.gradeLevel}</p>
                                      )}
                                    </div>
                                    {isOwner && cls.studentCount > 0 && (
                                      <button
                                        onClick={() => setExpandedClassReport(isReportOpen ? null : cls.id)}
                                        className={`flex-shrink-0 p-1.5 rounded-lg text-xs transition-colors ${
                                          isReportOpen
                                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-500'
                                        }`}
                                        title="Ver reporte"
                                      >
                                        <BarChart3 size={14} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                        <Users size={11} /> {cls.studentCount}
                                      </span>
                                      <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                                        {cls.code}
                                      </span>
                                    </div>
                                    {cls.studentCount > 0 && (
                                      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                                          style={{ width: `${Math.min(100, (cls.studentCount / 40) * 100)}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {teacherName && (
                                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                                        <User size={10} /> {teacherName}
                                      </span>
                                    </div>
                                  )}

                                  {isReportOpen && (
                                    <ClassReportPanel classroomId={cls.id} className={cls.name} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Contenido del tab: Comportamientos */}
      {detailTab === 'behaviors' && (
        <div className="space-y-4">
          {/* Header con botones de acción */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isOwner
                ? 'Crea puntos positivos para que los profesores los importen a sus clases.'
                : 'Selecciona los comportamientos que deseas importar a tus clases.'}
            </p>
            <div className="flex items-center gap-2">
              {selectedBehaviorIds.length > 0 && myClassrooms.length > 0 && (
                <button
                  onClick={() => { setSelectedClassroomIds([]); setShowImportModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  <Download size={14} />
                  Importar ({selectedBehaviorIds.length})
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setShowCreateBehavior(!showCreateBehavior)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  <Plus size={14} />
                  Crear
                </button>
              )}
            </div>
          </div>

          {/* Modal de creación (solo OWNER) - estilo BehaviorModal */}
          <AnimatePresence>
            {showCreateBehavior && isOwner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowCreateBehavior(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
                >
                  {/* Panel izquierdo - Jiro */}
                  <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
                    <img
                      src="/assets/mascot/jiro-puntosfavor.jpg"
                      alt="Jiro"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white text-xs font-semibold mb-2">💡 Consejos</p>
                      <ul className="text-white/80 text-[10px] space-y-1">
                        <li>• Sé específico: describe acciones concretas.</li>
                        <li>• Combina puntos según el impacto.</li>
                        <li>• Los profesores podrán importar estos comportamientos a sus clases.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Panel derecho - Contenido */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Star className="text-emerald-500" size={24} />
                        Nuevo comportamiento de escuela
                      </h2>
                      <button onClick={() => setShowCreateBehavior(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {/* Icono seleccionado preview */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Icono</label>
                        <div className="flex flex-wrap gap-2">
                          {['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '⚡', '🔥', '🤝', '🙋', '📝', '🎨'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setBhIcon(emoji)}
                              className={`w-10 h-10 text-lg rounded-xl transition-all hover:scale-105 ${
                                bhIcon === emoji
                                  ? 'bg-emerald-500 ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nombre y Descripción */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nombre *</label>
                          <input
                            type="text"
                            placeholder="Ej: Participación activa"
                            value={bhName}
                            onChange={(e) => setBhName(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Descripción</label>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={bhDescription}
                            onChange={(e) => setBhDescription(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Recompensas combinadas XP + HP + GP */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Recompensas (dar) - Puedes combinar
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {/* XP */}
                          <div className={`p-3 rounded-xl border-2 transition-all ${
                            bhXp > 0
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Zap size={14} className="text-emerald-500" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">XP</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={bhXp}
                              onChange={(e) => setBhXp(parseInt(e.target.value) || 0)}
                              className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                          </div>
                          {/* HP */}
                          <div className={`p-3 rounded-xl border-2 transition-all ${
                            bhHp > 0
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Heart size={14} className="text-red-500" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">HP</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={bhHp}
                              onChange={(e) => setBhHp(parseInt(e.target.value) || 0)}
                              className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                            />
                          </div>
                          {/* GP (Oro) */}
                          <div className={`p-3 rounded-xl border-2 transition-all ${
                            bhGp > 0
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Coins size={14} className="text-amber-500" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Oro</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={bhGp}
                              onChange={(e) => setBhGp(parseInt(e.target.value) || 0)}
                              className="w-full py-2 px-3 rounded-lg text-sm font-bold text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Deja en 0 los tipos que no quieras incluir
                        </p>
                      </div>
                    </div>

                    {/* Footer con botón */}
                    <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button
                        onClick={() => createBehaviorMutation.mutate()}
                        disabled={!bhName.trim() || !bhHasAnyValue || createBehaviorMutation.isPending}
                        className="w-full py-3 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createBehaviorMutation.isPending ? 'Guardando...' : 'Crear comportamiento'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de comportamientos */}
          {loadingBehaviors ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : schoolBehaviors.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <Star size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                No hay comportamientos
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {isOwner
                  ? 'Crea el primer comportamiento positivo de la escuela.'
                  : 'El responsable de la escuela aún no ha creado comportamientos.'}
              </p>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {schoolBehaviors.map((behavior) => {
                  const isSelected = selectedBehaviorIds.includes(behavior.id);
                  return (
                    <div
                      key={behavior.id}
                      className={`flex items-center gap-3 p-4 transition-colors ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleBehaviorSelection(behavior.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </button>

                      {/* Icono emoji */}
                      <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                        {behavior.icon || '⭐'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{behavior.name}</p>
                        {behavior.description && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{behavior.description}</p>
                        )}
                      </div>

                      {/* Valores combinados XP/HP/GP */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {behavior.xpValue > 0 && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                            +{behavior.xpValue} XP
                          </span>
                        )}
                        {behavior.hpValue > 0 && (
                          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                            +{behavior.hpValue} HP
                          </span>
                        )}
                        {behavior.gpValue > 0 && (
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                            +{behavior.gpValue} GP
                          </span>
                        )}
                      </div>

                      {/* Botón eliminar (solo OWNER) */}
                      {isOwner && (
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar este comportamiento?')) {
                              deleteBehaviorMutation.mutate(behavior.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mensaje si no tiene clases en la escuela */}
          {selectedBehaviorIds.length > 0 && myClassrooms.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No tienes clases asignadas a esta escuela. Asigna una clase primero para poder importar comportamientos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de importación */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header del modal */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white">Importar a mis clases</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedBehaviorIds.length} comportamiento{selectedBehaviorIds.length !== 1 ? 's' : ''} seleccionado{selectedBehaviorIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {/* Resumen de comportamientos seleccionados */}
              <div className="px-5 pt-4">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Comportamientos a importar
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {schoolBehaviors
                    .filter(b => selectedBehaviorIds.includes(b.id))
                    .map(b => (
                      <div key={b.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{b.icon || '⭐'}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {b.xpValue > 0 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{b.xpValue}XP</span>}
                          {b.hpValue > 0 && <span className="text-[10px] font-bold text-red-600 dark:text-red-400">+{b.hpValue}HP</span>}
                          {b.gpValue > 0 && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">+{b.gpValue}GP</span>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Selección de clases */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Selecciona las clases destino
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {myClassrooms.map((cls) => {
                    const isSelected = selectedClassroomIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        onClick={() => toggleClassroomSelection(cls.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{cls.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {cls.studentCount} estudiantes{cls.gradeLevel ? ` · ${cls.gradeLevel}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones del modal */}
              <div className="flex items-center gap-3 p-5 border-t border-gray-100 dark:border-gray-700 mt-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={selectedClassroomIds.length === 0 || importMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-shadow disabled:opacity-50"
                >
                  {importMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Importar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== TAB: INSIGNIAS ==================== */}
      {detailTab === 'badges' && (
        <div className="space-y-4">
          {/* Header con botón crear */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isOwner
                  ? 'Crea insignias para que los profesores las importen a sus clases.'
                  : 'Selecciona insignias para importarlas a tus clases.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedBadgeIds.length > 0 && myClassrooms.length > 0 && (
                <button
                  onClick={() => setShowImportBadgesModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  <Download size={14} />
                  Importar ({selectedBadgeIds.length})
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setShowCreateBadge(!showCreateBadge)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-xs font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  <Plus size={14} />
                  Crear
                </button>
              )}
            </div>
          </div>

          {/* Modal de creación de insignia (solo OWNER) */}
          <AnimatePresence>
            {showCreateBadge && isOwner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowCreateBadge(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
                >
                  {/* Panel izquierdo - Jiro */}
                  <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
                    <img
                      src="/assets/mascot/jiro-insignias.jpg"
                      alt="Jiro"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/assets/mascot/jiro-puntosfavor.jpg'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white text-xs font-semibold mb-2">🏅 Consejos para crear insignias</p>
                      <ul className="text-white/80 text-[10px] space-y-1">
                        <li>• Usa nombres motivadores y claros.</li>
                        <li>• Ajusta rarezas según la frecuencia del logro.</li>
                        <li>• Los profesores podrán importarlas a sus clases.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Panel derecho - Contenido */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Award className="text-amber-500" size={24} />
                        Crear Insignia de escuela
                      </h2>
                      <button onClick={() => setShowCreateBadge(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {/* Icono */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Icono</label>
                        <div className="flex flex-wrap gap-2">
                          {BADGE_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setBdIcon(emoji)}
                              className={`w-10 h-10 text-lg rounded-xl transition-all hover:scale-105 ${
                                bdIcon === emoji
                                  ? 'bg-amber-500 ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Nombre */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Nombre *</label>
                        <input
                          type="text"
                          placeholder="Ej: Lector del Mes"
                          value={bdName}
                          onChange={(e) => setBdName(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      {/* Descripción */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Descripción *</label>
                        <textarea
                          placeholder="Ej: Completar 5 libros en el mes"
                          value={bdDescription}
                          onChange={(e) => setBdDescription(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                        />
                      </div>

                      {/* Rareza */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Rareza</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['RARE', 'EPIC', 'LEGENDARY'] as const).map((r) => {
                            const cfg = RARITY_CONFIG[r];
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setBdRarity(r)}
                                className={`py-2.5 rounded-xl text-xs font-medium transition-all border-2 ${
                                  bdRarity === r
                                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Recompensa al desbloquear */}
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Recompensa al desbloquear</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Zap size={14} className="text-emerald-500" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">XP</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={bdRewardXp}
                              onChange={(e) => setBdRewardXp(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Coins size={14} className="text-amber-500" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Monedas (GP)</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={bdRewardGp}
                              onChange={(e) => setBdRewardGp(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Modo de asignación (siempre manual) */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">✋ Solo manual</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Las insignias de escuela se asignan manualmente por el profesor.</p>
                      </div>
                    </div>

                    {/* Footer con botón */}
                    <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button
                        onClick={() => createBadgeMutation.mutate()}
                        disabled={!bdName.trim() || !bdDescription.trim() || createBadgeMutation.isPending}
                        className="w-full py-3 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createBadgeMutation.isPending ? 'Guardando...' : 'Crear Insignia'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de insignias */}
          {loadingBadges ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : schoolBadges.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg text-center py-12 px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                <Award size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                No hay insignias
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {isOwner
                  ? 'Crea la primera insignia de la escuela.'
                  : 'El responsable de la escuela aún no ha creado insignias.'}
              </p>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {schoolBadges.map((badge) => {
                  const isSelected = selectedBadgeIds.includes(badge.id);
                  const rCfg = RARITY_CONFIG[badge.rarity];
                  return (
                    <div
                      key={badge.id}
                      className={`flex items-center gap-3 p-4 transition-colors ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleBadgeSelection(badge.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </button>

                      {/* Icono */}
                      <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                        {badge.icon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{badge.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{badge.description}</p>
                      </div>

                      {/* Rareza badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rCfg.bg} ${rCfg.color} flex-shrink-0`}>
                        {rCfg.label}
                      </span>

                      {/* Modo */}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {badge.assignmentMode === 'MANUAL' ? '✋ Manual' : badge.assignmentMode === 'AUTOMATIC' ? '⚡ Auto' : '🔄 Ambos'}
                      </span>

                      {/* Botón eliminar (solo OWNER) */}
                      {isOwner && (
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar esta insignia?')) {
                              deleteBadgeMutation.mutate(badge.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mensaje si no tiene clases en la escuela */}
          {selectedBadgeIds.length > 0 && myClassrooms.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No tienes clases asignadas a esta escuela. Asigna una clase primero para poder importar insignias.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de importación de insignias */}
      <AnimatePresence>
        {showImportBadgesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowImportBadgesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header del modal */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white">Importar insignias a mis clases</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedBadgeIds.length} insignia{selectedBadgeIds.length !== 1 ? 's' : ''} seleccionada{selectedBadgeIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowImportBadgesModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {/* Resumen de insignias seleccionadas */}
              <div className="px-5 pt-4">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Insignias a importar
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {schoolBadges
                    .filter(b => selectedBadgeIds.includes(b.id))
                    .map(b => (
                      <div key={b.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{b.icon}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${RARITY_CONFIG[b.rarity].bg} ${RARITY_CONFIG[b.rarity].color}`}>
                          {RARITY_CONFIG[b.rarity].label}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Selección de clases */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Selecciona las clases destino
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {myClassrooms.map((cls) => {
                    const isSelected = selectedBadgeClassroomIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        onClick={() => toggleBadgeClassroomSelection(cls.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{cls.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {cls.studentCount} estudiantes{cls.gradeLevel ? ` · ${cls.gradeLevel}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones del modal */}
              <div className="flex items-center gap-3 p-5 border-t border-gray-100 dark:border-gray-700 mt-3">
                <button
                  onClick={() => setShowImportBadgesModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => importBadgesMutation.mutate()}
                  disabled={selectedBadgeClassroomIds.length === 0 || importBadgesMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-shadow disabled:opacity-50"
                >
                  {importBadgesMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Importar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido del tab: Reportes */}
      {detailTab === 'reports' && isOwner && (
        <div className="space-y-5">
          {/* Selector de rango de fechas */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Período:</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Desde</span>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Hasta</span>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cards de resumen */}
          {loadingSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />)}
            </div>
          ) : reportSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-blue-500" />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Estudiantes</span>
                </div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{reportSummary.totalStudents}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{reportSummary.totalClasses} clases</p>
              </div>
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Pts. Positivos</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{reportSummary.totalPositivePoints}</p>
              </div>
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-red-500" />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Pts. Negativos</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">-{reportSummary.totalNegativePoints}</p>
              </div>
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={14} className="text-indigo-500" />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Asistencia</span>
                </div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">{reportSummary.attendanceRate}%</p>
              </div>
            </div>
          )}

          {/* Promedios XP/HP/GP */}
          {reportSummary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-3 border border-emerald-200/50 dark:border-emerald-700/50">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Zap size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Prom. XP</span>
                </div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{reportSummary.avgXp}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-3 border border-red-200/50 dark:border-red-700/50">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Heart size={12} className="text-red-600 dark:text-red-400" />
                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase">Prom. HP</span>
                </div>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{reportSummary.avgHp}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-700/50">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Coins size={12} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Prom. GP</span>
                </div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{reportSummary.avgGp}</p>
              </div>
            </div>
          )}

          {/* Gráfico de tendencias de comportamiento */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={16} className="text-indigo-500" />
              Tendencia de Comportamiento
            </h3>
            {loadingTrends ? (
              <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : behaviorTrends.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                No hay datos de comportamiento en este período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={behaviorTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}`; }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }); }}
                  />
                  <Area type="monotone" dataKey="positive" name="Positivos" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  <Area type="monotone" dataKey="negative" name="Negativos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Ranking de clases */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                Ranking de Clases
              </h3>
            </div>
            {loadingRanking ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />)}
              </div>
            ) : classRanking.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No hay datos</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                      <th className="text-left px-4 py-2.5 font-medium">#</th>
                      <th className="text-left px-4 py-2.5 font-medium">Clase</th>
                      <th className="text-center px-3 py-2.5 font-medium">Alumnos</th>
                      <th className="text-center px-3 py-2.5 font-medium">XP Prom.</th>
                      <th className="text-center px-3 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">+ Pts</th>
                      <th className="text-center px-3 py-2.5 font-medium text-red-600 dark:text-red-400">- Pts</th>
                      <th className="text-center px-3 py-2.5 font-medium">Asist.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {classRanking.map((cls, idx) => (
                      <tr key={cls.classroomId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-white">{cls.name}</p>
                          {cls.curriculumAreaName && <p className="text-[10px] text-gray-400">{cls.curriculumAreaName}</p>}
                        </td>
                        <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-400">{cls.studentCount}</td>
                        <td className="text-center px-3 py-3 font-medium text-gray-700 dark:text-gray-300">{cls.avgXp}</td>
                        <td className="text-center px-3 py-3 font-medium text-emerald-600 dark:text-emerald-400">+{cls.positivePoints}</td>
                        <td className="text-center px-3 py-3 font-medium text-red-600 dark:text-red-400">-{cls.negativePoints}</td>
                        <td className="text-center px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            cls.attendanceRate >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : cls.attendanceRate >= 60 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>{cls.attendanceRate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Comportamientos más usados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Positivos */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <TrendingUp size={14} />
                Top Comportamientos Positivos
              </h3>
              {loadingTopBehaviors ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
              ) : !topBehaviors?.positive?.length ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {topBehaviors.positive.map((b, idx) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <span className="text-sm">{b.icon || '⭐'}</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{b.name}</span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">{b.usageCount}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Negativos */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown size={14} />
                Top Comportamientos Negativos
              </h3>
              {loadingTopBehaviors ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
              ) : !topBehaviors?.negative?.length ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">Sin datos</p>
              ) : (
                <div className="space-y-2">
                  {topBehaviors.negative.map((b, idx) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <span className="text-sm">{b.icon || '⚠️'}</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{b.name}</span>
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">{b.usageCount}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estudiantes que necesitan atención */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" />
                Estudiantes que Necesitan Atención
                {studentsAtRisk.length > 0 && (
                  <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">{studentsAtRisk.length}</span>
                )}
              </h3>
            </div>
            {loadingAtRisk ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />)}</div>
            ) : studentsAtRisk.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Todos los estudiantes están bien en este período</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
                {studentsAtRisk.map((s) => (
                  <div key={s.studentId} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={14} className="text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-white truncate">{s.displayName}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{s.classroomName} · Nivel {s.level}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.risks.includes('HP_LOW') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">HP {s.hpPercentage}%</span>
                      )}
                      {s.risks.includes('NEGATIVE_BEHAVIOR') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">-{s.negativeCount} pts</span>
                      )}
                      {s.risks.includes('LOW_ATTENDANCE') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Asist. {s.attendanceRate}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asistencia por clase */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle size={16} className="text-blue-500" />
              Asistencia por Clase
              {attendanceReport?.byClass?.length ? (
                <span className="text-[10px] font-normal text-gray-400 ml-1">({attendanceReport.byClass.length} clases)</span>
              ) : null}
            </h3>
            {loadingAttendance ? (
              <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : !attendanceReport?.byClass?.length ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                No hay datos de asistencia en este período
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                {[...attendanceReport.byClass].sort((a, b) => b.rate - a.rate).map((cls, i) => (
                  <div key={i} className="flex items-center gap-3 group">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate w-[140px] sm:w-[200px] flex-shrink-0" title={cls.name}>
                      {cls.name}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cls.rate >= 80 ? 'bg-emerald-500' : cls.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${cls.rate}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-semibold tabular-nums w-10 text-right ${
                      cls.rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : cls.rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {cls.rate}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tendencia semanal de asistencia */}
          {attendanceReport?.weekly && attendanceReport.weekly.length > 0 && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Activity size={16} className="text-indigo-500" />
                Tendencia Semanal de Asistencia
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={attendanceReport.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}`; }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelFormatter={(v) => `Semana del ${new Date(v + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`}
                    formatter={(value) => [`${value}%`, 'Asistencia']}
                  />
                  <Area type="monotone" dataKey="rate" name="Asistencia" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolsPage;
