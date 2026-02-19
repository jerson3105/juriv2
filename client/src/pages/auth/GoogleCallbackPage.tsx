import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';
import { authApi } from '../../lib/api';

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

      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('Error en autenticación con Google:', error);
        navigate('/login?error=google_auth_failed');
        return;
      }

      if (code) {
        try {
          const exchangeResponse = await authApi.exchangeGoogleCode(code);
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
            
            // Redirigir al dashboard
            navigate('/dashboard');
          } else {
            throw new Error('No se pudo obtener el usuario');
          }
        } catch (err) {
          console.error('Error al procesar callback OAuth:', err);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          navigate('/login?error=token_error');
        }
      } else {
        navigate('/login?error=missing_code');
      }
    };

    handleCallback();
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-400 mx-auto mb-4" />
        <p className="text-primary-200 text-lg">Completando inicio de sesión con Google...</p>
      </div>
    </div>
  );
};
