import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  School,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Target,
  Trophy,
  Map,
  Scroll,
  CheckCircle,
  Copy,
  Mail,
  Search,
  Circle,
  CheckCircle2,
  Pause,
  Play,
  FileText,
} from 'lucide-react';
import type { AdminClassroomDetails } from '../../lib/adminApi';
import toast from 'react-hot-toast';

interface AdminClassroomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: AdminClassroomDetails | null;
  loading: boolean;
}

type TabType = 'general' | 'students' | 'activities' | 'questionBanks';

export const AdminClassroomDetailsModal = ({
  isOpen,
  onClose,
  details,
  loading,
}: AdminClassroomDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  if (!isOpen) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays} días`;
  };

  const getDaysActive = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    return diffDays;
  };

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: School },
    { id: 'students' as TabType, label: 'Estudiantes', icon: Users, count: details?.students.length },
    { id: 'activities' as TabType, label: 'Actividades', icon: Target, count: details?.stats.activities.total },
    { id: 'questionBanks' as TabType, label: 'Bancos', icon: BookOpen, count: details?.questionBanks.length },
  ];

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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">
                  {loading ? 'Cargando...' : details?.classroom.name}
                </h2>
                {!loading && details && (
                  <div className="flex items-center gap-4 text-purple-100">
                    <button
                      onClick={() => copyCode(details.classroom.code)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-mono transition-colors"
                    >
                      <Copy size={14} />
                      {details.classroom.code}
                    </button>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      details.classroom.isActive
                        ? 'bg-green-500/30 text-green-100'
                        : 'bg-gray-500/30 text-gray-100'
                    }`}>
                      {details.classroom.isActive ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex gap-1 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="ml-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : details ? (
              <>
                {activeTab === 'general' && (
                  <GeneralTab details={details} formatDate={formatDate} getTimeAgo={getTimeAgo} getDaysActive={getDaysActive} />
                )}
                {activeTab === 'students' && (
                  <StudentsTab details={details} />
                )}
                {activeTab === 'activities' && (
                  <ActivitiesTab details={details} />
                )}
                {activeTab === 'questionBanks' && (
                  <QuestionBanksTab details={details} />
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Error al cargar detalles
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Tab: General
const GeneralTab = ({ details, formatDate, getTimeAgo, getDaysActive }: any) => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{details.stats.students.total}</p>
              <p className="text-xs text-blue-700">Estudiantes</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            {details.stats.students.active} activos, {details.stats.students.inactive} inactivos
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-900">{details.stats.questionBanks}</p>
              <p className="text-xs text-purple-700">Bancos</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-900">{details.stats.activities.total}</p>
              <p className="text-xs text-green-700">Actividades</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-900">{details.stats.activities.completed}</p>
              <p className="text-xs text-amber-700">Completadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activities by Type */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target size={20} className="text-purple-600" />
          Actividades por Tipo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-900">{details.stats.activities.byType.timer}</p>
            <p className="text-xs text-blue-700">Temporizador</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Trophy className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-900">{details.stats.activities.byType.tournament}</p>
            <p className="text-xs text-purple-700">Torneos</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Map className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-900">{details.stats.activities.byType.expedition}</p>
            <p className="text-xs text-green-700">Expediciones</p>
          </div>
        </div>
      </div>

      {/* Teacher Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} className="text-purple-600" />
          Información del Profesor
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {details.classroom.teacher.firstName[0]}{details.classroom.teacher.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {details.classroom.teacher.firstName} {details.classroom.teacher.lastName}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} />
                {details.classroom.teacher.email}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Clases totales</p>
              <p className="font-semibold text-gray-900">{details.teacherClassroomsCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Miembro desde</p>
              <p className="font-semibold text-gray-900">{formatDate(details.classroom.teacher.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-purple-600" />
          Información de la Clase
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Creada</p>
            <p className="font-semibold text-gray-900">{formatDate(details.classroom.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Última actualización</p>
            <p className="font-semibold text-gray-900">{formatDate(details.classroom.updatedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Días activa</p>
            <p className="font-semibold text-gray-900">{getDaysActive(details.classroom.createdAt)} días</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Última actividad</p>
            <p className="font-semibold text-gray-900">{getTimeAgo(details.stats.lastActivity)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Tasa de completación</p>
            <p className="font-semibold text-gray-900">
              {details.stats.activities.total > 0
                ? Math.round((details.stats.activities.completed / details.stats.activities.total) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tab: Students
const StudentsTab = ({ details }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'level' | 'xp' | 'gp' | 'name'>('level');

  const filteredStudents = details.students
    .filter((s: any) => {
      const name = s.characterName || s.displayName || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'level') return b.level - a.level;
      if (sortBy === 'xp') return b.xp - a.xp;
      if (sortBy === 'gp') return b.gp - a.gp;
      if (sortBy === 'name') {
        const nameA = a.characterName || a.displayName || '';
        const nameB = b.characterName || b.displayName || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Search and Sort */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar estudiante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="level">Ordenar por Nivel</option>
          <option value="xp">Ordenar por XP</option>
          <option value="gp">Ordenar por GP</option>
          <option value="name">Ordenar por Nombre</option>
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nivel</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">XP</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">GP</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">HP</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        student.avatarGender === 'MALE' ? 'bg-blue-500' : 'bg-pink-500'
                      }`}>
                        {(student.characterName || student.displayName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{student.characterName || student.displayName || 'Sin nombre'}</p>
                        {student.characterName && student.displayName && (
                          <p className="text-xs text-gray-500">{student.displayName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                      {student.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{student.xp.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-amber-600">{student.gp.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-red-600">{student.hp}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      student.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {student.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Users size={40} className="mx-auto mb-2 opacity-50" />
          <p>No se encontraron estudiantes</p>
        </div>
      )}
    </div>
  );
};

// Tab: Question Banks
const QuestionBanksTab = ({ details }: any) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBanks = details.questionBanks
    .filter((bank: any) => {
      return bank.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar banco de preguntas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Banks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBanks.map((bank: any) => (
          <div key={bank.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BookOpen size={24} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">{bank.name}</h4>
                {bank.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{bank.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1 text-sm">
                    <FileText size={14} className="text-gray-400" />
                    <span className="font-medium text-gray-900">{bank.questionCount}</span>
                    <span className="text-gray-500">preguntas</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(bank.createdAt).toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBanks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BookOpen size={40} className="mx-auto mb-2 opacity-50" />
          <p>No se encontraron bancos de preguntas</p>
        </div>
      )}
    </div>
  );
};

// Tab: Activities
const ActivitiesTab = ({ details }: any) => {
  const [filterType, setFilterType] = useState<'all' | 'timed' | 'tournament' | 'expedition'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allActivities = [
    ...details.activities.timed.map((a: any) => ({ ...a, type: 'TIMER', typeLabel: 'Temporizador', icon: Clock, color: 'blue' })),
    ...details.activities.tournaments.map((a: any) => ({ ...a, type: 'TOURNAMENT', typeLabel: 'Torneo', icon: Trophy, color: 'purple' })),
    ...details.activities.expeditions.map((a: any) => ({ ...a, type: 'EXPEDITION', typeLabel: 'Expedición', icon: Map, color: 'green' })),
  ];

  const filteredActivities = allActivities
    .filter((a: any) => {
      if (filterType !== 'all' && a.type.toLowerCase() !== filterType) return false;
      return a.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED' || status === 'FINISHED' || status === 'ARCHIVED') return CheckCircle2;
    if (status === 'ACTIVE' || status === 'PUBLISHED') return Play;
    if (status === 'PAUSED') return Pause;
    if (status === 'DRAFT') return FileText;
    return Circle;
  };

  const getStatusColor = (status: string) => {
    if (status === 'COMPLETED' || status === 'FINISHED' || status === 'ARCHIVED') return 'text-green-600 bg-green-50';
    if (status === 'ACTIVE' || status === 'PUBLISHED') return 'text-blue-600 bg-blue-50';
    if (status === 'PAUSED') return 'text-amber-600 bg-amber-50';
    if (status === 'DRAFT') return 'text-gray-600 bg-gray-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar actividad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">Todos los tipos</option>
          <option value="timed">Temporizador</option>
          <option value="tournament">Torneos</option>
          <option value="expedition">Expediciones</option>
        </select>
      </div>

      {/* Activities List */}
      <div className="space-y-2">
        {filteredActivities.map((activity: any) => {
          const Icon = activity.icon;
          const StatusIcon = getStatusIcon(activity.status);
          return (
            <div key={activity.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg bg-${activity.color}-100`}>
                    <Icon size={20} className={`text-${activity.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{activity.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full bg-${activity.color}-50 text-${activity.color}-700 font-medium`}>
                        {activity.typeLabel}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                  <StatusIcon size={14} />
                  {activity.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredActivities.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Target size={40} className="mx-auto mb-2 opacity-50" />
          <p>No se encontraron actividades</p>
        </div>
      )}
    </div>
  );
};
