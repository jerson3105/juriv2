import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, GraduationCap, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

type UserRole = 'TEACHER' | 'STUDENT';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [step, setStep] = useState(1);
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
    </div>
  );
};
