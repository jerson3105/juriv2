import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { RoleDoors } from '../../components/auth/RoleDoors';

const DOOR_ROUTES = { STUDENT: '/unirse', TEACHER: '/registro/docente', PARENT: '/registro/familia' } as const;

/** "Crear una cuenta": tres puertas. Cada una fija el rol; el alumno nunca ve la opción de docente. */
export const RegisterPage = () => {
  const navigate = useNavigate();
  return (
    <AuthShell
      title="¿Cómo vas a usar Juried?"
      subtitle="Elige tu puerta de entrada."
      footer={(
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="inline-flex min-h-[44px] items-center font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">
            Inicia sesión
          </Link>
        </p>
      )}
    >
      <RoleDoors onPick={(role) => navigate(DOOR_ROUTES[role])} />
    </AuthShell>
  );
};
