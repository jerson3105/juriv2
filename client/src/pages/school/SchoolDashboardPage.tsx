import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  BookOpen,
  Award,
  Star,
  Settings,
  Plus,
  ChevronRight,
  TrendingUp,
  UserPlus,
  School,
  ArrowLeft,
  Layers
} from 'lucide-react';
import { getSchool, getSchoolMembers, getSchoolClassrooms } from '../../api/schoolApi';

export default function SchoolDashboardPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();

  const { data: school, isLoading: loadingSchool } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId!),
    enabled: !!schoolId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['school-members', schoolId],
    queryFn: () => getSchoolMembers(schoolId!),
    enabled: !!schoolId,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ['school-classrooms', schoolId],
    queryFn: () => getSchoolClassrooms(schoolId!),
    enabled: !!schoolId,
  });

  const isAdmin = school?.userRole === 'OWNER' || school?.userRole === 'ADMIN';
  const canCreateClasses = isAdmin || school?.canCreateClasses;

  if (loadingSchool) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <School className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900">Escuela no encontrada</h2>
          <Link to="/dashboard" className="text-indigo-600 hover:underline mt-2 inline-block">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Profesores',
      value: school.stats?.members || 0,
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      link: `/school/${schoolId}/members`,
    },
    {
      label: 'Clases',
      value: school.stats?.classrooms || 0,
      icon: BookOpen,
      color: 'from-purple-500 to-pink-500',
      link: `/school/${schoolId}/classrooms`,
    },
    {
      label: 'Estudiantes',
      value: school.stats?.students || 0,
      icon: GraduationCap,
      color: 'from-green-500 to-emerald-500',
      link: `/school/${schoolId}/students`,
    },
    {
      label: 'Activo',
      value: school.isActive ? 'Sí' : 'No',
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-500',
    },
  ];

  const canManageStudents = isAdmin || school?.canManageStudents;

  const quickActions = [
    {
      label: 'Agregar Profesor',
      icon: UserPlus,
      color: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200',
      onClick: () => navigate(`/school/${schoolId}/members?action=add`),
      show: isAdmin,
    },
    {
      label: 'Crear Clase',
      icon: Plus,
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200',
      onClick: () => navigate(`/school/${schoolId}/classrooms?action=add`),
      show: canCreateClasses,
    },
    {
      label: 'Grados y Secciones',
      icon: Layers,
      color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200',
      onClick: () => navigate(`/school/${schoolId}/grades`),
      show: isAdmin,
    },
    {
      label: 'Estudiantes',
      icon: Users,
      color: 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200',
      onClick: () => navigate(`/school/${schoolId}/students`),
      show: canManageStudents,
    },
    {
      label: 'Comportamientos',
      icon: Star,
      color: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200',
      onClick: () => navigate(`/school/${schoolId}/behaviors`),
      show: isAdmin,
    },
    {
      label: 'Insignias',
      icon: Award,
      color: 'bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200',
      onClick: () => navigate(`/school/${schoolId}/badges`),
      show: isAdmin,
    },
    {
      label: 'Configuración',
      icon: Settings,
      color: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200',
      onClick: () => navigate(`/school/${schoolId}/settings`),
      show: isAdmin,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link 
        to="/schools"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Mis Escuelas
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm"
      >
        <div className="flex items-center gap-4">
          {school.logoUrl ? (
            <img 
              src={school.logoUrl} 
              alt={school.name}
              className="w-16 h-16 rounded-xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
            {school.description && (
              <p className="text-gray-600 mt-1">{school.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                school.userRole === 'OWNER' 
                  ? 'bg-amber-100 text-amber-700'
                  : school.userRole === 'ADMIN'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {school.userRole === 'OWNER' ? 'Propietario' : school.userRole === 'ADMIN' ? 'Administrador' : 'Profesor'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => stat.link && navigate(stat.link)}
            className={`bg-white rounded-xl p-4 border border-gray-200 shadow-sm ${
              stat.link ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all' : ''
            }`}
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      {quickActions.some(a => a.show) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {quickActions.filter(a => a.show).map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${action.color}`}
              >
                <action.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Members */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Profesores</h2>
            <Link 
              to={`/school/${schoolId}/members`}
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium truncate">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{member.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  member.role === 'OWNER' 
                    ? 'bg-amber-100 text-amber-700'
                    : member.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {member.role === 'OWNER' ? 'Dueño' : member.role === 'ADMIN' ? 'Admin' : 'Profesor'}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-gray-400 text-center py-4">No hay profesores aún</p>
            )}
          </div>
        </motion.div>

        {/* Recent Classrooms */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Clases</h2>
            <Link 
              to={`/school/${schoolId}/classrooms`}
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver todas <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {classrooms.slice(0, 5).map((classroom) => (
              <div key={classroom.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium truncate">{classroom.name}</p>
                  <p className="text-sm text-gray-500">
                    {classroom.teacher?.firstName} {classroom.teacher?.lastName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 font-medium">{classroom.studentCount}</p>
                  <p className="text-xs text-gray-500">estudiantes</p>
                </div>
              </div>
            ))}
            {classrooms.length === 0 && (
              <p className="text-gray-400 text-center py-4">No hay clases aún</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
