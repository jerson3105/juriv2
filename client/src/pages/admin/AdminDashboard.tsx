import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  GraduationCap, 
  Shirt, 
  School,
  Shield,
  ChevronRight,
  LogOut,
  Building2,
  Map
} from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { AdminStats } from '../../lib/adminApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verificar rol de admin
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const statCards = stats ? [
    {
      title: 'Usuarios Totales',
      value: stats.users.total,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      details: `${stats.users.teachers} docentes, ${stats.users.students} estudiantes`,
    },
    {
      title: 'Clases Activas',
      value: stats.classrooms,
      icon: School,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Items de Avatar',
      value: stats.avatarItems,
      icon: Shirt,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Perfiles de Estudiante',
      value: stats.studentProfiles,
      icon: GraduationCap,
      color: 'from-amber-500 to-amber-600',
    },
  ] : [];

  const menuItems = [
    {
      title: 'Gestión de Escuelas',
      description: 'Crear y administrar escuelas (B2B)',
      icon: Building2,
      link: '/admin/schools',
      color: 'bg-pink-100 text-pink-600',
    },
    {
      title: 'Gestión de Items de Avatar',
      description: 'Subir y administrar items de avatar para los estudiantes',
      icon: Shirt,
      link: '/admin/avatar-items',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Gestión de Usuarios',
      description: 'Ver y administrar usuarios del sistema',
      icon: Users,
      link: '/admin/users',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Gestión de Clases',
      description: 'Ver todas las clases del sistema',
      icon: School,
      link: '/admin/classrooms',
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Mapas de Expediciones',
      description: 'Gestionar mapas disponibles para expediciones',
      icon: Map,
      link: '/admin/expedition-maps',
      color: 'bg-emerald-100 text-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">Panel de Administración</h1>
                <p className="text-indigo-200">Juried - Sistema de Gamificación Educativa</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${stat.color} flex items-center justify-center mb-4`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
                <p className="text-gray-600">{stat.title}</p>
                {stat.details && (
                  <p className="text-sm text-gray-400 mt-1">{stat.details}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Menu Grid */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <Link
                to={item.link}
                className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-4">{item.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{item.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
