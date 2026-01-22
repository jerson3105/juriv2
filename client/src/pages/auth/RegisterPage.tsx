import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, GraduationCap, Users, X, Check, AlertCircle, Heart, Trophy, Sparkles, Target } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

type UserRole = 'TEACHER' | 'STUDENT' | 'PARENT';

// Validación de requisitos de contraseña
const validatePassword = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

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

  // Validar contraseña en tiempo real
  const passwordValidation = useMemo(() => 
    validatePassword(formData.password), 
    [formData.password]
  );
  
  const isPasswordValid = useMemo(() => 
    passwordValidation.minLength && 
    passwordValidation.hasUppercase && 
    passwordValidation.hasLowercase &&
    passwordValidation.hasNumber &&
    passwordValidation.hasSpecial,
    [passwordValidation]
  );

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

    if (!isPasswordValid) {
      toast.error('La contraseña no cumple con los requisitos');
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
    <div className="min-h-screen flex">
      {/* Panel izquierdo - Hero visual (oculto en móvil) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 overflow-hidden">
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        {/* Contenido del hero */}
        <div className="relative z-10 flex flex-col justify-center items-center text-center p-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img 
              src="/logo.png" 
              alt="Juried" 
              className="h-24 w-auto mx-auto mb-8 drop-shadow-2xl"
            />
            <h1 className="text-4xl font-bold text-white mb-4">
              Únete a la Aventura
            </h1>
            <p className="text-xl text-emerald-100 mb-12 max-w-md">
              Crea tu cuenta y comienza a transformar el aprendizaje
            </p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-4 w-full max-w-sm"
          >
            {[
              { icon: Trophy, text: 'Gana puntos y sube de nivel' },
              { icon: Target, text: 'Completa misiones y desafíos' },
              { icon: Sparkles, text: 'Desbloquea logros y recompensas' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3 text-left bg-white/10 backdrop-blur-sm rounded-xl p-4"
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo solo visible en móvil */}
          <div className="text-center mb-6 lg:hidden">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <img 
                src="/logo.png" 
                alt="Juried" 
                className="h-14 w-auto mx-auto drop-shadow-2xl"
              />
            </motion.div>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
              Crea tu cuenta
            </p>
          </div>

          {/* Formulario */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
            {step === 1 ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  ¿Quién eres?
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Selecciona tu rol para continuar
                </p>

              <div className="grid grid-cols-3 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole('TEACHER')}
                  className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <GraduationCap className="w-10 h-10 mx-auto text-primary-600 mb-2" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    Docente
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Crea clases
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole('STUDENT')}
                  className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <Users className="w-10 h-10 mx-auto text-primary-600 mb-2" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    Estudiante
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Únete a clase
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole('PARENT')}
                  className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all group"
                >
                  <Heart className="w-10 h-10 mx-auto text-pink-600 mb-2" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    Padre
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ve el progreso
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
                  {formData.role === 'TEACHER' ? 'Docente' : formData.role === 'PARENT' ? 'Padre' : 'Estudiante'}
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

                <div>
                  <Input
                    label="Contraseña"
                    type="password"
                    name="password"
                    placeholder="Crea una contraseña segura"
                    value={formData.password}
                    onChange={handleChange}
                    leftIcon={<Lock size={18} />}
                    required
                  />
                  {/* Requisitos de contraseña */}
                  {formData.password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-1"
                    >
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Requisitos de contraseña:
                      </p>
                      <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {passwordValidation.minLength ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {passwordValidation.hasUppercase ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>Al menos una letra mayúscula (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {passwordValidation.hasLowercase ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>Al menos una letra minúscula (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {passwordValidation.hasNumber ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>Al menos un número (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {passwordValidation.hasSpecial ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>Al menos un carácter especial (!@#$%^&*)</span>
                      </div>
                    </motion.div>
                  )}
                </div>

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
          </div>

          {/* Footer */}
          <div className="text-center mt-6 space-y-2">
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link to="/about" className="text-gray-500 hover:text-primary-600 transition-colors">
                ¿Qué es Juried?
              </Link>
              <span className="text-gray-400">•</span>
              <Link to="/privacy" className="text-gray-500 hover:text-primary-600 transition-colors">
                Privacidad
              </Link>
            </div>
            <p className="text-gray-400 text-xs">
              © {new Date().getFullYear()} Juried. Todos los derechos reservados.
            </p>
          </div>
        </motion.div>
      </div>

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

              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => handleGoogleRegister('TEACHER')}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-800/40 transition-colors">
                    <GraduationCap className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Docente</span>
                  <span className="text-xs text-gray-500 text-center">Crea clases</span>
                </button>

                <button
                  onClick={() => handleGoogleRegister('STUDENT')}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-all group"
                >
                  <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/30 rounded-full flex items-center justify-center group-hover:bg-secondary-200 dark:group-hover:bg-secondary-800/40 transition-colors">
                    <Users className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Estudiante</span>
                  <span className="text-xs text-gray-500 text-center">Únete a clases</span>
                </button>

                <button
                  onClick={() => handleGoogleRegister('PARENT')}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all group"
                >
                  <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center group-hover:bg-pink-200 dark:group-hover:bg-pink-800/40 transition-colors">
                    <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Padre</span>
                  <span className="text-xs text-gray-500 text-center">Ve el progreso</span>
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
