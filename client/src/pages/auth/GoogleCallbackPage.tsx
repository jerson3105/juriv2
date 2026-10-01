import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';
import { Starfield } from '../../components/auth/SpaceScene';
import { authApi } from '../../lib/api';
import { studentLanding } from '../../components/auth/authHelpers';

const getHashParam = (paramName: string): string | null => {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) {
    return null;
  }

  const hashParams = new URLSearchParams(hash.slice(1));
  return hashParams.get(paramName);
};

export const GoogleCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Evitar procesamiento duplicado
      if (processedRef.current) return;
      processedRef.current = true;

      const code = searchParams.get('code') || getHashParam('code');
      const error = searchParams.get('error') || getHashParam('error');
      // El código es de un solo uso: no se deja en el historial del navegador.
      window.history.replaceState(null, '', window.location.pathname);
      if (error) {
        console.error('Error en autenticación con Google:', error);
        navigate('/login?error=google_auth_failed');
        return;
      }

      // Solo se aceptan tokens intercambiando el código atado a este navegador (nunca desde la URL).
      try {
        const exchangeResponse = await authApi.exchangeGoogleCode(code || undefined);
        const tokenData = exchangeResponse.data.data;

        if (!exchangeResponse.data.success || !tokenData) {
          throw new Error('No se pudo intercambiar el código de autenticación');
        }

        const { accessToken, refreshToken } = tokenData;

        // Guardar tokens temporalmente para hacer la petición
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        // Obtener datos del usuario
        const response = await authApi.getMe();
        
        if (response.data.success && response.data.data) {
          // Guardar en el store con los datos del usuario
          setAuth({
            user: response.data.data,
            accessToken,
            refreshToken,
          });
          
          // El alumno que venía de /unirse termina de unirse a su clase.
          navigate(response.data.data.role === 'STUDENT' ? studentLanding() : '/dashboard');
        } else {
          throw new Error('No se pudo obtener el usuario');
        }
      } catch (err) {
        console.error('Error al procesar callback OAuth:', err);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth-storage');

        if (!code) {
          navigate('/login?error=missing_code');
          return;
        }

        navigate('/login?error=token_error');
      }
    };

    handleCallback();
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1026] px-4" role="status">
      <Starfield count={80} />
      <div className="relative text-center">
        <img src="/assets/jiro/emocionado.webp" alt="" aria-hidden="true" className="auth-float mx-auto h-36 w-auto drop-shadow-2xl" />
        <Loader2 className="mx-auto mt-4 h-8 w-8 animate-spin text-amber-200" aria-hidden="true" />
        <p className="mt-3 text-lg text-indigo-50">Completando tu inicio de sesión con Google…</p>
      </div>
    </div>
  );
};
