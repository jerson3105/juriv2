import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileDown, KeyRound, Printer, QrCode, RefreshCw } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { errorMessage } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { schoolAccessApi, schoolAccessKeys, type AccessOverview } from '../../lib/schoolAccessApi';

const card = 'pg-surface p-4';

/**
 * Acceso de los estudiantes (administración): el código del colegio y su póster (código o QR → DNI → PIN), cómo va cada
 * sección y sus tarjetas de un solo uso. Restablecer un PIN se hace desde la ficha del estudiante o desde «Mi tutoría».
 */
export const SchoolAccessPage = () => {
  const { school, manager, activeYear } = useSchoolConsole();
  const queryClient = useQueryClient();
  const [confirmChange, setConfirmChange] = useState(false);
  const [busySection, setBusySection] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: schoolAccessKeys.overview(school.id, activeYear?.id ?? ''),
    queryFn: () => schoolAccessApi.overview(school.id, activeYear!.id),
    enabled: manager && !!activeYear,
  });
  const setCode = useMutation({
    mutationFn: () => schoolAccessApi.setCode(school.id),
    onSuccess: () => {
      setConfirmChange(false);
      void queryClient.invalidateQueries({ queryKey: ['school-access', school.id] });
      toast.success('Código del colegio listo');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo preparar el código')),
  });

  if (!manager) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">El acceso de los estudiantes lo prepara la administración. Las tarjetas de tu sección están en «Mi tutoría».</p>;
  }
  if (!activeYear) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">Primero crea el año escolar.</p>;
  }
  const data = overview.data;
  const code = data?.school.studentCode ?? null;

  const poster = async () => {
    if (!code) return;
    try {
      await schoolAccessApi.downloadPoster(school.id, code);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo descargar el póster'));
    }
  };
  const cards = async (section: AccessOverview['sections'][number]) => {
    setBusySection(section.id);
    try {
      await schoolAccessApi.downloadSectionCards(school.id, activeYear.id, section.id, section.label);
      void queryClient.invalidateQueries({ queryKey: schoolAccessKeys.overview(school.id, activeYear.id) });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron generar las tarjetas'));
    } finally {
      setBusySection(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Acceso de estudiantes</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">Código del colegio o QR → DNI → PIN de 4 números</p>
      </header>

      {overview.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Cargando…</p>}
      {overview.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo cargar el acceso.</p>}

      {data && !data.piiReady && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100" role="status">
          El servidor aún no tiene las llaves para leer los DNI: la puerta del colegio no funcionará hasta que el equipo de Juried las configure. Las tarjetas y la entrada por cada clase sí funcionan.
        </p>
      )}

      {data && (code ? (
        <section className={`${card} flex flex-wrap items-center gap-4`} aria-labelledby="access-code-title">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true"><QrCode size={24} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="access-code-title" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Código del colegio</h2>
            <p className="font-mono text-3xl font-black tracking-[0.2em] text-gray-900 dark:text-white">{code}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Los estudiantes lo escriben en /unirse (o escanean el QR del póster), luego su DNI y su PIN.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${primaryButton} min-h-[40px]`} onClick={() => void poster()}><Printer size={16} aria-hidden="true" />Póster con QR</button>
            {confirmChange ? (
              <span className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                Los pósters impresos dejarán de servir.
                <button type="button" className="pg-btn pg-focus" disabled={setCode.isPending} onClick={() => setCode.mutate()}>Cambiar</button>
                <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirmChange(false)}>No</button>
              </span>
            ) : (
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirmChange(true)}><RefreshCw size={16} aria-hidden="true" />Cambiar código</button>
            )}
          </div>
        </section>
      ) : (
        <section className={`${card} flex flex-wrap items-center gap-4`} aria-labelledby="access-start-title">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true"><KeyRound size={24} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="access-start-title" className="font-bold text-gray-900 dark:text-white">Activa el acceso con DNI</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">El colegio recibe su código y su póster con QR. Cada estudiante crea su PIN una vez con su tarjeta y entra a todas sus clases con su DNI y ese PIN.</p>
          </div>
          <button type="button" className={`${primaryButton} min-h-[40px]`} disabled={setCode.isPending} onClick={() => setCode.mutate()}>
            {setCode.isPending ? 'Activando…' : 'Activar'}
          </button>
        </section>
      ))}

      {data && (
        <section className={card} aria-labelledby="access-totals-title">
          <h2 id="access-totals-title" className="font-bold text-gray-900 dark:text-white">Estudiantes del año</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Entran con su PIN', value: data.totals.pin },
              { label: 'Con correo o Google', value: data.totals.account },
              { label: 'Aún sin acceso', value: data.totals.none },
              { label: 'Sin documento', value: data.totals.withoutDocument },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{item.label}</dt>
                <dd className="mt-0.5 text-2xl font-black tabular-nums text-gray-900 dark:text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
          {data.totals.withoutDocument > 0 && (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              Sin documento no pueden usar la puerta del colegio (sí la de cada clase).{' '}
              <Link to={`/escuela/${school.id}/estudiantes?filtro=incomplete`} className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Completar datos</Link>
            </p>
          )}
        </section>
      )}

      {data && (
        <section className={card} aria-labelledby="access-cards-title">
          <h2 id="access-cards-title" className="font-bold text-gray-900 dark:text-white">Tarjetas por sección</h2>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            Cada tarjeta es de un solo uso: con ella el estudiante crea su PIN. Solo van quienes aún no tienen PIN, e imprimir otra vez da las mismas tarjetas. Si alguien olvida su PIN, restablécelo desde su ficha o desde «Mi tutoría».
          </p>
          {data.sections.length === 0 ? (
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">Aún no hay secciones este año.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold">Sección</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Estudiantes</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Con PIN</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Sin PIN</th>
                    <th scope="col" className="py-2 font-semibold"><span className="sr-only">Tarjetas</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.sections.map((s) => {
                    const pending = s.students - s.pin;
                    return (
                      <tr key={s.id}>
                        <th scope="row" className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">{s.label}</th>
                        <td className="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{s.students}</td>
                        <td className="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{s.pin}</td>
                        <td className="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{pending}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            className="pg-btn pg-focus"
                            disabled={!code || pending === 0 || busySection === s.id}
                            onClick={() => void cards(s)}
                            title={!code ? 'Primero activa el acceso con DNI' : pending === 0 ? 'Todos ya tienen su PIN' : undefined}
                          >
                            <FileDown size={16} aria-hidden="true" />{busySection === s.id ? 'Generando…' : 'Tarjetas'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
