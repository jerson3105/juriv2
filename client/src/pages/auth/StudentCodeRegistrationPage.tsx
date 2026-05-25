import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Lock, Mail, School, Search, Sparkles, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const validatePassword = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

interface VerifiedStudentCode {
  code: string;
  studentName: string | null;
  classroomName: string | null;
}

export const StudentCodeRegistrationPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [code, setCode] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudentCode | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const passwordValidation = useMemo(
    () => validatePassword(formData.password),
    [formData.password]
  );

  const isPasswordValid = useMemo(
    () => passwordValidation.minLength
      && passwordValidation.hasUppercase
      && passwordValidation.hasLowercase
      && passwordValidation.hasNumber
      && passwordValidation.hasSpecial,
    [passwordValidation]
  );

  const handleVerifyCode = async () => {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 6) {
      setVerifyError('Ingresa un código válido de 6 a 8 caracteres.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const response = await authApi.verifyStudentCode(normalizedCode);
      const verification = response.data.data;

      if (!verification) {
        throw new Error('No pudimos validar el código.');
      }

      if (verification.alreadyLinked) {
        setVerifiedStudent(null);
        setVerifyError('Este código ya fue usado. Inicia sesión o pide otro a tu profesor.');
        return;
      }

      setCode(normalizedCode);
      setVerifiedStudent({
        code: normalizedCode,
        studentName: verification.studentName,
        classroomName: verification.classroomName,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Código no encontrado. Revisa que esté bien escrito.';
      setVerifiedStudent(null);
      setVerifyError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifiedStudent) {
      setFormError('Primero verifica tu código de estudiante.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }

    if (!isPasswordValid) {
      setFormError('La contraseña no cumple con los requisitos.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await authApi.registerStudentWithCode({
        code: verifiedStudent.code,
        email: formData.email,
        password: formData.password,
      });

      if (!response.data.success || !response.data.data) {
        throw new Error('No se pudo activar la cuenta.');
      }

      setAuth(response.data.data);
      toast.success('Tu cuenta fue activada correctamente');
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.message || 'No se pudo activar la cuenta con ese código.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const officialName = verifiedStudent?.studentName || 'Estudiante asignado';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-stretch">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:flex lg:w-[44%]"
        >
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 p-10 shadow-2xl">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -left-8 top-16 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute bottom-10 right-0 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
            </div>

            <div className="relative z-10">
              <img src="/logo.png" alt="Juried" className="mb-8 h-20 w-auto drop-shadow-2xl" />
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-blue-50 backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                Activaci\u00f3n guiada para estudiantes
              </p>
              <h1 className="text-4xl font-bold leading-tight text-white">
                Usa tu código y conserva el nombre oficial de tu aula.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                Tu profe ya registró tu nombre. Aquí solo validarás tu código y crearás tu acceso con correo y contraseña.
              </p>
            </div>

            <div className="relative z-10 space-y-4">
              {[
                'Validas tu código personal de estudiante',
                'Vemos el nombre oficial asignado por tu docente',
                'Creas tu acceso y entras a Juried',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full lg:flex-1"
        >
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <img src="/logo.png" alt="Juried" className="h-14 w-auto drop-shadow-xl" />
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm transition-colors hover:text-primary-600 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </div>

            <div className="rounded-[2rem] bg-white/92 p-6 shadow-2xl backdrop-blur-sm dark:bg-gray-900/92 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {verifiedStudent ? 'Crea tu acceso' : 'Tengo código de estudiante'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {verifiedStudent
                      ? 'Tu nombre oficial ya está listo. Solo completa tu acceso.'
                      : 'Primero validemos el código que te dio tu profesor.'}
                  </p>
                </div>

                <Link
                  to="/login"
                  className="hidden items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600 dark:border-gray-700 dark:text-gray-300 lg:inline-flex"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Link>
              </div>

              {!verifiedStudent ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-4 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/40">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Este código trae tu nombre oficial</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Así evitamos que tu docente te vea con nombres incompletos o distintos en la lista.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Input
                    label="Código de estudiante"
                    name="studentCode"
                    placeholder="ABC12345"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setVerifyError(null);
                    }}
                    leftIcon={<UserCheck className="h-5 w-5" />}
                    helperText="Ingresa el código personal que te entregó tu profesor."
                    className="text-center font-semibold uppercase tracking-[0.32em]"
                    maxLength={8}
                    autoFocus
                    autoComplete="one-time-code"
                  />

                  {verifyError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                    >
                      {verifyError}
                    </motion.p>
                  )}

                  <Button
                    type="button"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    size="lg"
                    isLoading={isVerifying}
                    leftIcon={!isVerifying ? <Search className="h-5 w-5" /> : undefined}
                    onClick={handleVerifyCode}
                  >
                    Verificar código
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-4 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-cyan-950/30">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
                          Nombre oficial confirmado
                        </p>
                        <h3 className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-white">{officialName}</h3>
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <School className="h-4 w-4" />
                          <span>{verifiedStudent.classroomName || 'Clase asignada'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800/70 dark:text-gray-400">
                    Usaremos el nombre oficial que registró tu profesor. Aquí solo crearás tu correo y contraseña para ingresar.
                  </div>

                  <Input
                    label="Correo electrónico"
                    type="email"
                    name="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormError(null);
                      setFormData((current) => ({ ...current, email: e.target.value }));
                    }}
                    leftIcon={<Mail size={18} />}
                    required
                    autoComplete="email"
                  />

                  <div>
                    <Input
                      label="Contraseña"
                      type="password"
                      name="password"
                      placeholder="Crea una contraseña segura"
                      value={formData.password}
                      onChange={(e) => {
                        setFormError(null);
                        setFormData((current) => ({ ...current, password: e.target.value }));
                      }}
                      leftIcon={<Lock size={18} />}
                      required
                      autoComplete="new-password"
                    />

                    {formData.password.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 space-y-1 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70"
                      >
                        <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                          Requisitos de contraseña:
                        </p>
                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.minLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mínimo 8 caracteres</span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Al menos una mayúscula</span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Al menos una minúscula</span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Al menos un número</span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${passwordValidation.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Al menos un carácter especial</span>
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
                    onChange={(e) => {
                      setFormError(null);
                      setFormData((current) => ({ ...current, confirmPassword: e.target.value }));
                    }}
                    leftIcon={<Lock size={18} />}
                    required
                    autoComplete="new-password"
                  />

                  {formError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                    >
                      {formError}
                    </motion.p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setVerifiedStudent(null);
                        setVerifyError(null);
                        setFormError(null);
                      }}
                    >
                      Cambiar código
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      isLoading={isSubmitting}
                    >
                      Activar cuenta
                    </Button>
                  </div>
                </form>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ¿Ya activaste tu acceso?{' '}
                  <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                    Inicia sesión
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};