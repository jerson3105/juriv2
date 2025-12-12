import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, GraduationCap, Users, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

type UserRole = 'TEACHER' | 'STUDENT';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [step, setStep] = useState(1);
  const [showGoogleRoleModal, setShowGoogleRoleModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '' as UserRole | '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectRole = (role: UserRole) => {
    setFormData({ ...formData, role });
    setStep(2);
  };

  const handleGoogleRegister = (role: UserRole) => {
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
    window.location.href = `${baseUrl}/api/auth/google?role=${role}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role as UserRole,
      });
      toast.success('¡Cuenta creada exitosamente!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(error || 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
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
              className="h-20 w-auto mx-auto drop-shadow-2xl"
            />
          </motion.div>
          <h1 className="text-2xl font-bold text-white font-display">
            Únete a Juried
          </h1>
          <p className="text-primary-200 mt-2">
            Comienza tu aventura educativa
          </p>
        </div>

        {/* Formulario */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8"
        >
          {step === 1 ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                ¿Quién eres?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Selecciona tu rol para continuar
              </p>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole('TEACHER')}
                  className="p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <GraduationCap className="w-12 h-12 mx-auto text-primary-600 mb-3" />
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Docente
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Crea y gestiona clases
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole('STUDENT')}
                  className="p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <Users className="w-12 h-12 mx-auto text-primary-600 mb-3" />
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Estudiante
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Únete a una clase
                  </p>
                </motion.button>
              </div>

              {/* Separador */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">o regístrate con</span>
                </div>
              </div>

              {/* Botón de Google */}
              <button
                type="button"
                onClick={() => setShowGoogleRoleModal(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700 dark:text-gray-200 font-medium">Continuar con Google</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  ←
                </button>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Crear cuenta
                </h2>
                <span className="ml-auto px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                  {formData.role === 'TEACHER' ? 'Docente' : 'Estudiante'}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Nombre"
                    name="firstName"
                    placeholder="Juan"
                    value={formData.firstName}
                    onChange={handleChange}
                    leftIcon={<User size={18} />}
                    required
                  />
                  <Input
                    label="Apellido"
                    name="lastName"
                    placeholder="Pérez"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <Input
                  label="Correo electrónico"
                  type="email"
                  name="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  leftIcon={<Mail size={18} />}
                  required
                />

                <Input
                  label="Contraseña"
                  type="password"
                  name="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  leftIcon={<Lock size={18} />}
                  required
                />

                <Input
                  label="Confirmar contraseña"
                  type="password"
                  name="confirmPassword"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  leftIcon={<Lock size={18} />}
                  required
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-red-500 text-sm"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isLoading}
                >
                  Crear cuenta
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Inicia sesión
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <Link
            to="/about"
            className="text-primary-300 hover:text-primary-100 text-sm font-medium transition-colors"
          >
            ¿Qué es Juried? →
          </Link>
          <p className="text-primary-400 text-xs">
            © {new Date().getFullYear()} Juried. Todos los derechos reservados.
          </p>
        </div>
      </motion.div>

      {/* Modal de selección de rol para Google */}
      <AnimatePresence>
        {showGoogleRoleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowGoogleRoleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  ¿Cómo quieres registrarte?
                </h3>
                <button
                  onClick={() => setShowGoogleRoleModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Selecciona tu rol para continuar con Google
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handleGoogleRegister('TEACHER')}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                    <GraduationCap className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">Docente</span>
                  <span className="text-xs text-gray-500 text-center">Crea y gestiona clases</span>
                </button>

                <button
                  onClick={() => handleGoogleRegister('STUDENT')}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-all group"
                >
                  <div className="w-16 h-16 bg-secondary-100 dark:bg-secondary-900/30 rounded-full flex items-center justify-center group-hover:bg-secondary-200 dark:group-hover:bg-secondary-800/40 transition-colors">
                    <Users className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">Estudiante</span>
                  <span className="text-xs text-gray-500 text-center">Únete a clases</span>
                </button>
              </div>

              {/* Botón de Google */}
              <button
                disabled
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-gray-500 font-medium">Continuar con Google</span>
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">Selecciona un rol primero</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
