import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { AccountForm, type AccountFormValues } from '../../components/auth/AccountForm';
import { GoogleButton, OrDivider } from '../../components/auth/GoogleButton';
import { errorMessage } from '../../components/auth/authHelpers';
import { useAuthStore } from '../../store/authStore';

/** Puerta de la familia: crea la cuenta y luego vincula al hijo o hija con el código familiar. */
export const FamilyRegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: AccountFormValues) => {
    setError(null);
    try {
      await register({ ...values, role: 'PARENT' });
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'No se pudo crear la cuenta'));
    }
  };

  return (
    <AuthShell
      title="Crea tu cuenta de familia"
      back={{ to: '/register', label: 'Volver' }}
      subtitle="Después vinculas a tu hijo o hija con el código familiar que te da su docente (es distinto del código de la clase)."
      footer={(
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Inicia sesión</Link>
        </p>
      )}
    >
      <GoogleButton role="PARENT" label="Crear cuenta de familia con Google" />
      <OrDivider text="o con tu correo" />
      <AccountForm submitLabel="Crear cuenta de familia" onSubmit={submit} busy={isLoading} error={error} />
    </AuthShell>
  );
};
