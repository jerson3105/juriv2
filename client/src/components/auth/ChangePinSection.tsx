import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { PinInput } from './PinInput';
import { errorMessage, isWeakPin } from './authHelpers';
import { primaryButton } from '../home/homeHelpers';

/**
 * Configuración del alumno sin correo: cambiar su PIN con el actual. El servidor cierra sus otras
 * sesiones (por si alguien lo vio) y este equipo sigue dentro con un token nuevo.
 */
export const ChangePinSection = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<{ field: 'current' | 'next' | 'repeat'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (current.length !== 4) return setError({ field: 'current', message: 'Escribe tu PIN actual.' });
    if (next.length !== 4) return setError({ field: 'next', message: 'Escribe tu PIN nuevo.' });
    if (isWeakPin(next)) return setError({ field: 'next', message: 'Ese PIN es muy fácil de adivinar. No uses 1234 ni el mismo número cuatro veces.' });
    if (next === current) return setError({ field: 'next', message: 'El PIN nuevo debe ser distinto del actual.' });
    if (repeat !== next) return setError({ field: 'repeat', message: 'Los PIN nuevos no coinciden.' });
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.changePin({ currentPin: current, newPin: next });
      useAuthStore.getState().setAccessToken(response.data.data!.accessToken);
      setCurrent(''); setNext(''); setRepeat('');
      toast.success('PIN actualizado. Cerramos tu sesión en los demás equipos.');
    } catch (err) {
      setCurrent('');
      setError({ field: 'current', message: errorMessage(err, 'No se pudo cambiar tu PIN') });
    } finally {
      setBusy(false);
    }
  };

  const errorFor = (field: 'current' | 'next' | 'repeat') => (error?.field === field ? error.message : null);

  return (
    <form onSubmit={submit} noValidate>
      <h3 className="mb-1 flex items-center gap-2 font-medium text-gray-800 dark:text-white">
        <KeyRound size={16} aria-hidden="true" /> Cambiar mi PIN
      </h3>
      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
        Entras con el código de tu clase, tu nombre y tu PIN. Si alguien vio tu PIN, cámbialo aquí. ¿Lo olvidaste? Pídele a tu profe que restablezca tu acceso.
      </p>
      <div className="grid gap-5">
        <PinInput label="PIN actual" value={current} onChange={(v) => { setCurrent(v); setError(null); }} error={errorFor('current')} disabled={busy} />
        <PinInput label="PIN nuevo" value={next} onChange={(v) => { setNext(v); setError(null); }} error={errorFor('next')} disabled={busy} />
        <PinInput label="Repite el PIN nuevo" value={repeat} onChange={(v) => { setRepeat(v); setError(null); }} error={errorFor('repeat')} disabled={busy} />
      </div>
      <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Cambiar PIN
      </button>
    </form>
  );
};
