import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Heart, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';

type UserRole = 'TEACHER' | 'STUDENT' | 'PARENT';

interface GoogleData {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export const SelectRolePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [googleData, setGoogleData] = useState<GoogleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const decoded = JSON.parse(atob(dataParam));
        setGoogleData(decoded);
      } catch {
        toast.error('Error al procesar datos de Google');
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  const handleSelectRole = async (role: UserRole) => {
    if (!googleData || isLoading) return;
    
    setSelectedRole(role);
    setIsLoading(true);

    try {
      const response = await authApi.completeGoogleRegistration({ googleData, role });
      
      if (response.data.success && response.data.data) {
        const { user, accessToken, refreshToken } = response.data.data;
        
        setAuth({ user, accessToken, refreshToken });
        
        toast.success(`¡Bienvenido/a ${user.firstName}!`);
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al completar registro');
      setSelectedRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!googleData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
        <Loader2 className="w-12 h-12 animate-spin text-primary-400" />
      </div>
    );
  }

  const roles = [
    {
      id: 'TEACHER' as UserRole,
      icon: GraduationCap,
      title: 'Soy Docente',
      description: 'Crea y gestiona clases con gamificación',
      color: 'primary',
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'STUDENT' as UserRole,
      icon: Users,
      title: 'Soy Estudiante',
      description: 'Únete a clases y gana recompensas',
      color: 'secondary',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'PARENT' as UserRole,
      icon: Heart,
      title: 'Soy Padre/Madre',
      description: 'Sigue el progreso de tus hijos',
      color: 'pink',
      gradient: 'from-pink-500 to-rose-600',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="mb-4"
          >
            <img 
              src="/logo.png" 
              alt="Juried" 
              className="h-16 w-auto mx-auto drop-shadow-2xl"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="text-primary-200">¡Casi listo!</span>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8"
        >
          {/* User info */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            {googleData.avatarUrl ? (
              <img 
                src={googleData.avatarUrl} 
                alt={googleData.firstName}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-600">
                  {googleData.firstName[0]}{googleData.lastName[0]}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {googleData.firstName} {googleData.lastName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {googleData.email}
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            ¿Cómo usarás Juried?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            Selecciona tu rol para personalizar tu experiencia
          </p>

          {/* Role selection */}
          <div className="space-y-3">
            {roles.map((role, index) => (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                onClick={() => handleSelectRole(role.id)}
                disabled={isLoading}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all
                  ${selectedRole === role.id 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg`}>
                  {isLoading && selectedRole === role.id ? (
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  ) : (
                    <role.icon className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {role.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {role.description}
                  </p>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: selectedRole === role.id ? 1 : 0 }}
                  className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-primary-400 text-xs">
            © {new Date().getFullYear()} Juried. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
