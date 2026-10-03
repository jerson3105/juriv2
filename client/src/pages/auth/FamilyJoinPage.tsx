import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, School } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { errorMessage, normalizeJoinCode, pressable, setPendingFamilyCode } from '../../components/auth/authHelpers';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { authApi } from '../../lib/api';
import { parentApi } from '../../lib/parentApi';
import { useAuthStore } from '../../store/authStore';

const linkClass = 'inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300';
const ROLE_LABEL: Record<string, string> = { TEACHER: 'docente', STUDENT: 'estudiante', ADMIN: 'administración' };

/**
 * Enlace del folleto o del mensaje del docente: /familia/<código>. La familia ve a qué clase pide unirse,
 * entra (o crea su cuenta) y la solicitud sale sola; el docente la aprueba en «Familias».
 */
export const FamilyJoinPage = () => {
  const { code: raw = '' } = useParams<{ code: string }>();
  const code = normalizeJoinCode(raw);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, logout } = useAuthStore();

  const verify = useQuery({
    queryKey: ['family-code', code],
    queryFn: async () => (await authApi.verifyJoinCode(code)).data.data!,
    enabled: code.length >= 6,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const family = verify.data?.type === 'family' ? verify.data : null;

  // Sin sesión: guardar el código para volver aquí después de crear la cuenta, de Google o de iniciar sesión.
  useEffect(() => {
    if (!isAuthenticated && family?.open) setPendingFamilyCode(code);
  }, [isAuthenticated, family?.open, code]);

  const link = useMutation({
    mutationFn: () => parentApi.linkChild(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      void queryClient.invalidateQueries({ queryKey: ['parent-pending-links'] });
    },
  });

  if (code.length < 6 || verify.isError) {
    const tooMany = (verify.error as { response?: { status?: number } } | null)?.response?.status === 429;
    return (
      <AuthShell title={tooMany ? 'Demasiados intentos' : 'Este código no sirve'} back={{ to: '/registro/familia', label: 'Volver' }}>
        <p className="text-sm text-gray-800 dark:text-gray-100">
          {tooMany
            ? 'Espera unos minutos y vuelve a abrir el enlace.'
            : 'No existe o su docente lo cambió. Pídele el código nuevo de tu hijo o hija.'}
        </p>
      </AuthShell>
    );
  }
  if (verify.isLoading) {
    return <AuthShell title="Revisando el código…"><p className="text-sm text-gray-700 dark:text-gray-300">Un momento.</p></AuthShell>;
  }
  // Un código de clase o de alumno: es la puerta del estudiante.
  if (!family) return <Navigate to={`/unirse/${code}`} replace />;

  const who = family.studentName ?? 'tu hijo o hija';
  const card = (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true">
        <School size={20} />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-gray-900 dark:text-white">{family.classroomName}</p>
        {family.teacherName && <p className="text-gray-700 dark:text-gray-300">Docente: {family.teacherName}</p>}
        <p className="text-gray-800 dark:text-gray-100">Familia de <strong>{who}</strong></p>
      </div>
    </div>
  );

  if (!family.open) {
    return (
      <AuthShell title="Esta clase aún no recibe familias" back={{ to: '/', label: 'Inicio' }}>
        {card}
        <p className="mt-4 text-sm text-gray-800 dark:text-gray-100">Su docente todavía está verificando su cuenta. Avísale y vuelve a abrir este enlace más tarde.</p>
      </AuthShell>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <AuthShell
        title="Únete como familia"
        subtitle="Entra o crea tu cuenta de familia: tu solicitud le llega al docente, que confirma que eres su familia."
        footer={(
          <p>
            ¿Ya tienes cuenta de familia? <Link to="/login" className={linkClass}>Inicia sesión</Link>
          </p>
        )}
      >
        {card}
        <div className="mt-5 space-y-3">
          <GoogleButton role="PARENT" label="Continuar con Google" />
          <OrDivider text="o con tu correo" />
          <Link to="/registro/familia" className={`${primaryButton} ${pressable} w-full`}>Crear cuenta con mi correo</Link>
        </div>
      </AuthShell>
    );
  }

  if (user.role !== 'PARENT') {
    return (
      <AuthShell title="Este enlace es para familias">
        {card}
        <p className="mt-4 text-sm text-gray-800 dark:text-gray-100">
          Entraste con una cuenta de {ROLE_LABEL[user.role] ?? 'otro tipo'}. Para unirte como familia, cierra sesión y entra con tu cuenta de familia.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {/* El código se guarda después de limpiar el navegador: al entrar como familia, vuelve aquí. */}
          <button type="button" onClick={() => void logout(() => setPendingFamilyCode(code))} className={primaryButton}>Cerrar sesión</button>
          <button type="button" onClick={() => navigate('/dashboard')} className={cancelButton}>Volver a mi inicio</button>
        </div>
      </AuthShell>
    );
  }

  if (link.isSuccess) {
    return (
      <AuthShell title="¡Solicitud enviada!">
        {card}
        <p className="mt-4 flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100">
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          Su docente confirmará que eres la familia de {who}. Te avisaremos aquí en Juried.
        </p>
        <button type="button" onClick={() => navigate('/dashboard')} className={`${primaryButton} mt-5 w-full`}>Ir a mi inicio</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Pide unirte como familia" back={{ to: '/dashboard', label: 'Mi inicio' }}>
      {card}
      <p className="mt-4 text-sm text-gray-800 dark:text-gray-100">
        Su docente confirmará que eres su familia antes de que veas su progreso y los avisos de la clase.
      </p>
      {link.isError && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
          {errorMessage(link.error, 'No se pudo enviar la solicitud. Vuelve a intentarlo.')}
        </p>
      )}
      <button type="button" onClick={() => link.mutate()} disabled={link.isPending} className={`${primaryButton} ${pressable} mt-5 w-full`}>
        {link.isPending ? 'Enviando…' : `Pedir unirme como familia de ${who}`}
      </button>
    </AuthShell>
  );
};

export default FamilyJoinPage;
