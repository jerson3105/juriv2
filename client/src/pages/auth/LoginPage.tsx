import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Sparkles, Shield, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleGoogleLogin = () => {
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
    window.location.href = `${baseUrl}/api/auth/google`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
      toast.success('¡Bienvenido de vuelta!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - Hero visual (oculto en móvil) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 overflow-hidden">
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
              Bienvenido a Juried
            </h1>
            <p className="text-xl text-primary-100 mb-12 max-w-md">
              La plataforma que transforma el aprendizaje en una aventura épica
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
              { icon: Sparkles, text: 'Gamificación educativa avanzada' },
              { icon: Users, text: 'Gestiona clases y estudiantes' },
              { icon: Shield, text: 'Sistema de recompensas y logros' },
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

        {/* Mascota Jiro - Asomándose desde la esquina inferior derecha */}
        <motion.div
          initial={{ opacity: 0, x: 50, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ 
            duration: 0.8, 
            delay: 0.8,
            type: 'spring',
            stiffness: 100
          }}
          className="absolute bottom-8 right-0 z-20"
        >
          <motion.img
            src="/assets/mascot/jiro.webp"
            alt="Jiro - Mascota de Juried"
            className="h-40 w-auto object-contain drop-shadow-2xl rounded-l-2xl"
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            title="¡Hola! Soy Jiro, tu compañero de aventuras"
          />
        </motion.div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo solo visible en móvil */}
          <div className="text-center mb-8 lg:hidden">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <img 
                src="/logo.png" 
                alt="Juried" 
                className="h-16 w-auto mx-auto drop-shadow-2xl"
              />
            </motion.div>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
              Plataforma de Gamificación Educativa
            </p>
          </div>

          {/* Formulario */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Iniciar Sesión
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Correo electrónico"
                type="email"
                name="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleChange}
                leftIcon={<Mail size={20} />}
                required
              />

              <Input
                label="Contraseña"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                leftIcon={<Lock size={20} />}
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
                Iniciar Sesión
              </Button>
            </form>

            {/* Separador */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">o continúa con</span>
              </div>
            </div>

            {/* Botón de Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-200 font-medium">Continuar con Google</span>
            </button>

            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Regístrate aquí
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
    </div>
  );
};
