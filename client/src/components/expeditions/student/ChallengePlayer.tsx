import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import {
  assetUrl, expeditionApi, expeditionKeys,
  type AnswerResult, type ChallengeAnswer, type ChallengeQuestion, type StudentStop,
} from '../../../lib/expeditionApi';
import { errorMessage } from '../../auth/authHelpers';
import { primaryButton } from '../../home/homeHelpers';
import { secondaryButton } from '../../gradebook/gradebookHelpers';
import { rewardLabel } from '../expeditionHelpers';

const TYPE_LABEL: Record<ChallengeQuestion['type'], string> = {
  TRUE_FALSE: 'Verdadero o falso',
  SINGLE_CHOICE: 'Elige una respuesta',
  MULTIPLE_CHOICE: 'Elige todas las correctas',
  MATCHING: 'Une cada una con su pareja',
};

/** La respuesta correcta en palabras (se muestra recién en el reintento). */
const answerText = (question: ChallengeQuestion, answer: ChallengeAnswer | null) => {
  if (answer === null) return null;
  if (question.type === 'TRUE_FALSE') return answer === true ? 'Verdadero' : 'Falso';
  if (question.type === 'SINGLE_CHOICE') return question.options?.find((o) => o.key === answer)?.text ?? null;
  if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(answer)) {
    return answer.map((key) => question.options?.find((o) => o.key === key)?.text).filter(Boolean).join(' · ');
  }
  if (question.type === 'MATCHING' && Array.isArray(answer)) {
    return (question.left ?? []).map((left, i) => `${left.text} → ${question.right?.find((r) => r.key === answer[i])?.text ?? '?'}`).join(' · ');
  }
  return null;
};

const optionClass = (selected: boolean) =>
  `flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-base font-semibold transition-colors ${selected
    ? 'border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-50'
    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}`;

const QuestionInput = ({ question, value, onChange, disabled }: {
  question: ChallengeQuestion; value: ChallengeAnswer | null; onChange: (value: ChallengeAnswer | null) => void; disabled: boolean;
}) => {
  if (question.type === 'TRUE_FALSE') {
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Respuesta">
        {[true, false].map((option) => (
          <button key={String(option)} type="button" role="radio" aria-checked={value === option} disabled={disabled}
            onClick={() => onChange(option)} className={`${optionClass(value === option)} justify-center`}>
            {option ? 'Verdadero' : 'Falso'}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const multiple = question.type === 'MULTIPLE_CHOICE';
    const selected = multiple ? ((value as number[] | null) ?? []) : [];
    return (
      <div className="space-y-2" role={multiple ? 'group' : 'radiogroup'} aria-label="Opciones">
        {(question.options ?? []).map((option, index) => {
          const isSelected = multiple ? selected.includes(option.key) : value === option.key;
          return (
            <button key={option.key} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={isSelected} disabled={disabled}
              onClick={() => {
                if (!multiple) return onChange(option.key);
                const next = isSelected ? selected.filter((key) => key !== option.key) : [...selected, option.key];
                onChange(next.length ? next : null);
              }}
              className={optionClass(isSelected)}>
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center ${multiple ? 'rounded-md' : 'rounded-full'} border-2 text-sm font-bold ${isSelected ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500' : 'border-gray-400 text-gray-700 dark:border-gray-500 dark:text-gray-200'}`} aria-hidden="true">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1">{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  }
  // Parejas: un selector por cada elemento de la izquierda.
  const pairs = (value as number[] | null) ?? (question.left ?? []).map(() => -1);
  return (
    <div className="space-y-2">
      {(question.left ?? []).map((left, i) => (
        <label key={left.key} className="flex flex-col gap-1 rounded-xl border border-gray-300 p-3 dark:border-gray-600 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100">{left.text}</span>
          <select
            value={pairs[i] ?? -1}
            disabled={disabled}
            onChange={(event) => {
              const next = [...pairs];
              next[i] = Number(event.target.value);
              onChange(next);
            }}
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:w-56"
          >
            <option value={-1}>Elige…</option>
            {(question.right ?? []).map((right) => <option key={right.key} value={right.key}>{right.text}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
};

/**
 * Reto: una pregunta a la vez, con la explicación al instante. Si no llega al mínimo, reintenta solo las que
 * falló (ahí ve la respuesta correcta) y el reto queda superado igual. Sin energía ni castigo.
 */
export const ChallengePlayer = ({ stop, onExit }: { stop: StudentStop; onExit: () => void }) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: expeditionKeys.challenge(stop.id), queryFn: () => expeditionApi.challenge(stop.id) });
  // La respuesta en curso va atada a su pregunta: al cambiar de pregunta empieza vacía, pase lo que pase.
  const [draft, setDraft] = useState<{ questionId: string; value: ChallengeAnswer | null }>({ questionId: '', value: null });
  const [feedback, setFeedback] = useState<(AnswerResult & { questionId: string }) | null>(null);

  const state = query.data;
  const byId = useMemo(() => new Map((state?.questions ?? []).map((q) => [q.id, q])), [state?.questions]);
  const answeredNow = new Set((state?.answers ?? []).filter((a) => a.attempt === state?.attempt).map((a) => a.questionId));
  const pending = (state?.round ?? []).filter((id) => !answeredNow.has(id));
  const question = feedback ? byId.get(feedback.questionId) : byId.get(pending[0] ?? '');
  const value = question && draft.questionId === question.id ? draft.value : null;
  const setValue = (next: ChallengeAnswer | null) => setDraft({ questionId: question?.id ?? '', value: next });
  // Mientras se ve la respuesta, la pregunta todavía cuenta como pendiente (se recarga al tocar «Siguiente»).
  const position = (state?.round.length ?? 0) - pending.length + 1;

  const answer = useMutation({
    mutationFn: (input: { questionId: string; answer: ChallengeAnswer }) => expeditionApi.answer(stop.id, input.questionId, input.answer),
    // La opción elegida queda marcada mientras lee la explicación; se limpia al pasar a la siguiente.
    onSuccess: (result, input) => setFeedback({ ...result, questionId: input.questionId }),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar tu respuesta')),
  });

  const next = async () => {
    const done = feedback?.done;
    setFeedback(null);
    await queryClient.invalidateQueries({ queryKey: expeditionKeys.challenge(stop.id) });
    if (done) {
      void queryClient.invalidateQueries({ queryKey: ['expedition-play'] });
      void queryClient.invalidateQueries({ queryKey: ['my-expeditions'] });
      // XP y oro de la barra superior.
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    }
  };

  if (query.isLoading) {
    return <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-700 dark:text-gray-300"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Preparando el reto…</p>;
  }
  if (query.isError || !state) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-gray-800 dark:text-gray-200">{errorMessage(query.error, 'No se pudo cargar el reto')}</p>
        <button type="button" onClick={onExit} className={secondaryButton}>Volver</button>
      </div>
    );
  }
  if (state.preparing) {
    return (
      <div className="space-y-3 py-6 text-center">
        <div className="text-4xl" aria-hidden="true">🛠️</div>
        <p className="text-sm text-gray-800 dark:text-gray-200">Tu profe está preparando las preguntas de este reto. Vuelve en un rato.</p>
        <button type="button" onClick={onExit} className={secondaryButton}>Volver</button>
      </div>
    );
  }

  // Resultado de una vuelta completa (o reto ya terminado).
  const roundEnded = feedback?.roundComplete || (!feedback && pending.length === 0);
  if (roundEnded && !feedback) {
    const finished = state.status === 'DONE';
    return (
      <div className="space-y-4 py-2 text-center" aria-live="polite">
        {finished ? (
          <>
            <div className="mx-auto flex w-fit items-center gap-2 text-4xl" aria-hidden="true">{state.goldStar ? '⭐' : '🎯'}</div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{state.goldStar ? '¡Reto superado con estrella!' : '¡Reto superado!'}</h3>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Primer intento: {state.firstScore ?? 0} %{state.finalScore !== null && state.finalScore !== state.firstScore ? ` · después del reintento: ${state.finalScore} %` : ''}
            </p>
            {(stop.rewardXp > 0 || stop.rewardGold > 0) && <p className="text-sm font-bold text-[var(--pg-pos-ink,#065f46)] dark:text-emerald-300">{rewardLabel(stop.rewardXp, stop.rewardGold)}</p>}
          </>
        ) : (
          <>
            <div className="mx-auto text-4xl" aria-hidden="true">💪</div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Vamos con las que fallaste</h3>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Acertaste {state.firstScore ?? 0} % y para superarlo hace falta {state.passPercent} %. Ya viste la explicación: reintenta {state.round.length === 1 ? 'la que fallaste' : `las ${state.round.length} que fallaste`}.
            </p>
          </>
        )}
        <button type="button" onClick={onExit} className={finished ? primaryButton : secondaryButton}>
          {finished ? 'Volver a la expedición' : 'Más tarde'}
        </button>
      </div>
    );
  }

  if (!question) return null;
  const reveal = feedback ? answerText(question, feedback.correctAnswer) : null;
  const ready = value !== null && (question.type !== 'MATCHING' || (Array.isArray(value) && value.every((key) => key >= 0)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        <span>{state.attempt === 2 ? 'Reintento · ' : ''}Pregunta {Math.min(position, state.round.length)} de {state.round.length}</span>
        <span className="flex gap-1" aria-hidden="true">
          {state.round.map((id) => (
            <span key={id} className={`h-2 w-5 rounded-full ${answeredNow.has(id) || feedback?.questionId === id ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
          ))}
        </span>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">{TYPE_LABEL[question.type]}</p>
        <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{question.text}</h3>
        {question.imageUrl && <img src={assetUrl(question.imageUrl)} alt="" className="mt-3 max-h-56 rounded-xl object-contain" />}
      </div>

      <QuestionInput question={question} value={value} onChange={setValue} disabled={!!feedback || answer.isPending} />

      {feedback ? (
        <div aria-live="polite" className={`space-y-2 rounded-xl border p-3 ${feedback.isCorrect
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30'
          : 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60'}`}>
          <p className={`flex items-center gap-2 font-bold ${feedback.isCorrect ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-900 dark:text-slate-100'}`}>
            {feedback.isCorrect ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
            {feedback.isCorrect ? '¡Correcto!' : state.attempt === 2 ? 'Esta vez tampoco' : 'No es correcta: la vuelves a intentar al final'}
          </p>
          {reveal && <p className="text-sm text-slate-900 dark:text-slate-100"><span className="font-semibold">La respuesta correcta:</span> {reveal}</p>}
          {feedback.explanation && <p className="text-sm text-gray-800 dark:text-gray-200">{feedback.explanation}</p>}
          {feedback.roundComplete && (
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {feedback.done
                ? `${feedback.goldStar ? '⭐ ' : ''}¡Reto superado! ${feedback.score ?? 0} %`
                : `Acertaste ${feedback.score ?? 0} %: toca reintentar las que fallaste.`}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => void next()} className={primaryButton} data-autofocus>
              {feedback.roundComplete ? (feedback.done ? 'Ver el resultado' : <><RotateCcw size={16} aria-hidden="true" /> Reintentar</>) : 'Siguiente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onExit} className={secondaryButton}>Salir</button>
          <button type="button" disabled={!ready || answer.isPending} onClick={() => value !== null && answer.mutate({ questionId: question.id, answer: value })} className={primaryButton}>
            {answer.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Responder
          </button>
        </div>
      )}
    </div>
  );
};
