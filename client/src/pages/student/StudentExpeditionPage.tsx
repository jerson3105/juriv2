import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { expeditionApi, expeditionKeys } from '../../lib/expeditionApi';
import { StudentExpeditionView } from '../../components/expeditions/student/StudentExpeditionView';
import { useExpeditionLive } from '../../components/expeditions/useExpeditionLive';
import { StudentAvatarMini } from '../../components/avatar/StudentAvatarMini';
import type { AvatarGender } from '../../lib/avatarApi';
import { errorMessage } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { ActivityWelcome } from '../../components/observatorio/ActivityWelcome';
import { CATALOG } from '../../components/observatorio/catalog';
import { useStageSound } from '../../components/observatorio/observatorioSound';
import { TutorialButton } from '../../components/tutorials/TutorialButton';

const COVER = CATALOG.find((entry) => entry.id === 'expediciones')?.cover ?? '/assets/jiro/actividades/expediciones.webp';

// Bienvenida de pantalla completa la primera vez que el alumno abre cada expedición en este dispositivo.
const welcomeKey = (expeditionId: string) => `expedition-welcome-seen-${expeditionId}`;
const readWelcomeSeen = (expeditionId: string) => {
  try {
    return localStorage.getItem(welcomeKey(expeditionId)) === '1';
  } catch {
    return true; // Sin almacenamiento (modo privado): mejor no repetirla en cada visita.
  }
};

/** Una expedición del alumno: su personaje marca «Estás aquí» sobre la estrella actual. */
export const StudentExpeditionPage = () => {
  const { expeditionId = '' } = useParams<{ expeditionId: string }>();
  const { profile } = useCurrentStudentProfile();
  useExpeditionLive('student');
  const query = useQuery({ queryKey: expeditionKeys.play(expeditionId), queryFn: () => expeditionApi.play(expeditionId), enabled: !!expeditionId });
  const { sound } = useStageSound();
  const [welcomeDone, setWelcomeDone] = useState(false);

  const back = (
    <Link to="/expeditions" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-gray-800 hover:underline dark:text-gray-100">
      <ArrowLeft size={16} aria-hidden="true" /> Expediciones
    </Link>
  );

  if (query.isLoading) {
    return <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-700 dark:text-gray-300" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando la expedición…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <div data-pg="" className="space-y-3">
        {back}
        <div className="rounded-2xl border border-[var(--pg-line)] p-6 text-center">
          <p className="text-sm pg-fg">{errorMessage(query.error, 'No se pudo abrir la expedición')}</p>
          <button type="button" onClick={() => void query.refetch()} className={`${primaryButton} mt-3`}>Reintentar</button>
        </div>
      </div>
    );
  }

  const expedition = query.data;
  // El personaje solo si es de esta clase (la clase abierta puede ser otra si cambió en otra pestaña).
  const here = profile && profile.classroomId === expedition.classroomId ? (
    <div className="h-[60px] w-[35px] overflow-visible">
      <div className="origin-top-left scale-[0.6]">
        <StudentAvatarMini studentProfileId={profile.id} gender={(profile.avatarGender ?? 'MALE') as AvatarGender} size="xs" hideBackground className="overflow-visible" />
      </div>
    </div>
  ) : undefined;

  const showWelcome = !welcomeDone && !expedition.finished && !readWelcomeSeen(expedition.id);
  const closeWelcome = () => {
    try {
      localStorage.setItem(welcomeKey(expedition.id), '1');
    } catch {
      // Sin almacenamiento: vuelve a salir en la próxima visita.
    }
    setWelcomeDone(true);
  };

  return (
    <div data-pg="">
      <StudentExpeditionView
        expedition={expedition}
        here={here}
        header={(
          <div className="space-y-1">
            {back}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-extrabold pg-fg">{expedition.name}</h1>
              <TutorialButton id="expediciones" label="¿Cómo funciona?" />
            </div>
          </div>
        )}
      />
      {showWelcome && (
        <ActivityWelcome title={expedition.name} tagline="¡Paso a paso hasta la meta!" cover={COVER} sound={sound} mood="viaje" onDone={closeWelcome} />
      )}
    </div>
  );
};
