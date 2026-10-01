import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { AccountForm, type AccountFormValues } from '../../components/auth/AccountForm';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { errorMessage } from '../../components/auth/authHelpers';
import { useAuthStore } from '../../store/authStore';

/** Puerta del docente: texto para adultos y declaración obligatoria. Al alumno se le manda a su puerta. */
export const TeacherRegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: AccountFormValues) => {
    setError(null);
    try {
      await register({ ...values, role: 'TEACHER' });
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'No se pudo crear la cuenta'));
    }
  };

  return (
    <AuthShell
      title="Crea tu cuenta de docente"
      back={{ to: '/register', label: 'Volver' }}
      subtitle={(
        <>
          Para docentes y personal del colegio.{' '}
          <Link to="/unirse" className="font-semibold text-primary-700 underline underline-offset-2 dark:text-primary-300">¿Eres estudiante? Entra con el código de tu profe</Link>.
        </>
      )}
      footer={(
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Inicia sesión</Link>
        </p>
      )}
    >
      <GoogleButton role="TEACHER" label="Crear cuenta de docente con Google" />
      <OrDivider text="o con tu correo" />
      <AccountForm
        submitLabel="Crear cuenta de docente"
        onSubmit={submit}
        busy={isLoading}
        error={error}
        declaration="Confirmo que soy docente o personal de un colegio y tengo 18 años o más."
      />
    </AuthShell>
  );
};
