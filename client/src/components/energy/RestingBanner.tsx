import { useQuery } from '@tanstack/react-query';
import { Moon } from 'lucide-react';
import { recoveryApi } from '../../lib/recoveryApi';

/** Para el alumno que descansa (0 HP): tranquilo, sin alarmas, con su misión si ya la tiene. */
export const RestingBanner = ({ profileId }: { profileId: string }) => {
  const { data } = useQuery({
    queryKey: ['my-energy', profileId],
    queryFn: () => recoveryApi.mine(profileId),
    staleTime: 30_000,
  });
  if (!data?.resting) return null;
  return (
    <section aria-labelledby="resting-title" className="mb-4 flex gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" aria-hidden="true">
        <Moon size={22} className="fill-current" />
      </span>
      <div className="min-w-0">
        <h2 id="resting-title" className="text-base font-bold text-slate-900 dark:text-white">Estás descansando</h2>
        {data.initial ? (
          <p className="text-sm text-slate-800 dark:text-slate-100">Te quedaste sin energía. Cuando estés listo, tu profe te ayudará a recuperarla.</p>
        ) : (
          <>
            <p className="text-sm text-slate-800 dark:text-slate-100">Te quedaste sin energía. Mientras descansas, la tienda de premios está en pausa. Sigues ganando XP y oro.</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {data.mission ? <>Tu misión: «{data.mission.text}»</> : 'Pregúntale a tu profe por tu misión de recuperación.'}
            </p>
            <p className="text-sm text-slate-800 dark:text-slate-100">Al cumplirla vuelves con la mitad de tu energía.</p>
          </>
        )}
      </div>
    </section>
  );
};
