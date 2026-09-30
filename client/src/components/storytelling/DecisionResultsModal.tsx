import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { storyApi } from '../../lib/storyApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, primaryButton } from '../home/homeHelpers';
import { errorMessage, storyDetailKey } from './storyEditorHelpers';

interface DecisionResultsModalProps {
  sceneId: string;
  storyId: string;
  onClose: () => void;
}

// Votos de la clase y cierre de la votación (con empate o sin votos, el profesor elige).
export const DecisionResultsModal = ({ sceneId, storyId, onClose }: DecisionResultsModalProps) => {
  const queryClient = useQueryClient();
  const [pick, setPick] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['decision-results', sceneId],
    queryFn: () => storyApi.getDecisionResults(sceneId),
    refetchInterval: 5000,
  });

  const top = Math.max(0, ...(data?.options.map((o) => o.votes) ?? [0]));
  const leaders = data?.options.filter((o) => o.votes === top) ?? [];
  const needsPick = !!data && data.status === 'OPEN' && leaders.length !== 1;
  const closed = data?.status === 'CLOSED';

  const close = async () => {
    if (!data || closing) return;
    setClosing(true);
    try {
      await storyApi.closeDecision(sceneId, needsPick ? pick : null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['decision-results', sceneId] }),
        queryClient.invalidateQueries({ queryKey: storyDetailKey(storyId) }),
      ]);
      toast.success('Votación cerrada: los alumnos verán el desenlace');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cerrar la votación'));
    } finally {
      setClosing(false);
    }
  };

  return (
    <HomeModal
      title="Votación de la clase"
      subtitle={data?.question}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>{closed ? 'Cerrar' : 'Seguir esperando'}</button>
        {!closed && (
          <button type="button" onClick={close} disabled={!data || closing || (needsPick && !pick)} className={primaryButton}>
            {closing && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Cerrar votación
          </button>
        )}
      </>}
    >
      {isLoading || !data ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Cargando votos" />
      ) : (
        <>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {closed ? 'La votación terminó.' : `${data.total} de ${data.eligible} alumnos votaron. Se actualiza solo.`}
          </p>
          <ul className="space-y-2">
            {data.options.map((option) => {
              const winner = closed ? data.winnerOptionId === option.id : leaders.length === 1 && leaders[0].id === option.id;
              const percent = data.total ? (option.votes / data.total) * 100 : 0;
              return (
                <li key={option.id} className={`rounded-xl border-2 p-3 ${winner ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/25' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                      {winner && <Trophy size={16} className="text-amber-700 dark:text-amber-300" aria-label={closed ? 'Ganadora' : 'Va ganando'} />} {option.label}
                    </span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{option.votes} voto{option.votes === 1 ? '' : 's'} · {Math.round(percent)} %</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.max(percent, option.votes ? 3 : 0)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {needsPick && (
            <fieldset>
              <legend className="text-sm font-semibold text-gray-900 dark:text-white">{top === 0 ? 'Nadie votó todavía: elige tú el camino' : 'Hay empate: elige la opción ganadora'}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {leaders.map((o) => (
                  <label key={o.id} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${pick === o.id ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-800 dark:border-gray-600 dark:text-gray-100'}`}>
                    <input type="radio" name="decision-winner" value={o.id} checked={pick === o.id} onChange={() => setPick(o.id)} className="accent-primary-600" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {!closed && <p className="text-sm text-gray-700 dark:text-gray-300">Al cerrar, la escena vuelve a mostrarse a la clase con el desenlace ganador. No se puede reabrir.</p>}
        </>
      )}
    </HomeModal>
  );
};
