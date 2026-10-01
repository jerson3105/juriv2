import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react';
import { questionBankApi, DIFFICULTY_LABELS, type Question, type QuestionDifficulty } from '../../lib/questionBankApi';
import { SidePanel } from '../gradebook/SidePanel';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { secondaryButton } from '../gradebook/gradebookHelpers';
import { AnswerFields } from './AnswerFields';
import {
  EDITOR_KINDS, editorFromQuestion, editorToPayload, emptyEditor, errorMessage, switchKind, usesOfEditor, validateEditor,
  type EditorState,
} from './bankHelpers';
import { ProjectedPreview } from './ProjectedPreview';

interface QuestionEditorProps {
  bankId: string;
  question?: Question | null;
  onClose: () => void;
}

const segment = (on: boolean) =>
  `min-h-[44px] rounded-xl border px-3 text-sm font-bold ${on
    ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-500/15 dark:text-white'
    : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`;

/**
 * Editor de una pregunta (panel lateral; hoja inferior en móvil). Lo esencial primero: tipo,
 * enunciado, respuestas y explicación. Dificultad, imagen, puntos y tiempo van en "Más opciones".
 */
export const QuestionEditor = ({ bankId, question, onClose }: QuestionEditorProps) => {
  const queryClient = useQueryClient();
  const ids = useId();
  const editing = !!question;
  const [state, setState] = useState<EditorState>(() => (question ? editorFromQuestion(question) : emptyEditor()));
  const [showMore, setShowMore] = useState(false);
  const [preview, setPreview] = useState(false);
  const [touched, setTouched] = useState(false);
  const patch = (p: Partial<EditorState>) => setState((s) => ({ ...s, ...p }));

  const problem = validateEditor(state);
  const uses = usesOfEditor(state);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['questions', bankId] });
    void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
  };
  const save = useMutation({
    mutationFn: () => (editing
      ? questionBankApi.updateQuestion(question!.id, editorToPayload(state))
      : questionBankApi.createQuestion(bankId, editorToPayload(state))),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la pregunta')),
  });

  const submit = async (andNew: boolean) => {
    setTouched(true);
    if (problem) return;
    try {
      await save.mutateAsync();
    } catch {
      return;
    }
    refresh();
    toast.success(editing ? 'Pregunta guardada' : 'Pregunta creada');
    if (andNew) {
      // Mismo tipo y dificultad para escribir la siguiente rápido.
      setState((s) => ({ ...emptyEditor(s.kind), difficulty: s.difficulty }));
      setTouched(false);
      setPreview(false);
    } else {
      onClose();
    }
  };

  return (
    <SidePanel
      title={editing ? 'Editar pregunta' : 'Nueva pregunta'}
      subtitle={editing && question?.aiGenerated && !question.reviewedAt ? 'Generada con IA: al guardar queda revisada' : undefined}
      onClose={onClose}
      wide
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          {!editing && (
            <button type="button" onClick={() => void submit(true)} disabled={save.isPending} className={secondaryButton}>
              Guardar y nueva
            </button>
          )}
          <button type="button" onClick={() => void submit(false)} disabled={save.isPending} className={primaryButton}>
            {save.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Guardar
          </button>
        </>
      )}
    >
      <fieldset>
        <legend className={labelClass}>Tipo</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {EDITOR_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => setState((s) => switchKind(s, k.value))} aria-pressed={state.kind === k.value} title={k.hint} className={segment(state.kind === k.value)}>
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${ids}-text`} className={labelClass}>{state.kind === 'ERROR' ? 'Problema' : 'Pregunta'}</label>
        <textarea
          id={`${ids}-text`}
          data-autofocus
          value={state.questionText}
          onChange={(e) => patch({ questionText: e.target.value.slice(0, 2000) })}
          rows={3}
          placeholder={state.kind === 'ERROR' ? 'Ej.: Calcula 1/2 + 1/3' : state.kind === 'TRUE_FALSE' ? 'Ej.: El Sol es una estrella.' : 'Escribe la pregunta'}
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
          {state.kind === 'ERROR' ? 'Escribe la solución correcta paso a paso y cambia uno con un error típico.' : 'Frases cortas y sin doble negación.'}
        </p>
      </div>

      <AnswerFields state={state} onChange={patch} />

      <div>
        <label htmlFor={`${ids}-explanation`} className={labelClass}>Explicación</label>
        <textarea
          id={`${ids}-explanation`}
          value={state.explanation}
          onChange={(e) => patch({ explanation: e.target.value.slice(0, 2000) })}
          rows={2}
          placeholder={state.kind === 'ERROR' ? 'Qué está mal en ese paso y cómo es lo correcto' : 'Por qué es la respuesta correcta'}
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">Jiro la muestra en clase al revelar la respuesta.</p>
      </div>

      {/* Dónde se podrá usar */}
      {uses.blocker ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {uses.blocker}.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Sirve para: {uses.uses.join(', ')}.
        </p>
      )}

      <div>
        <button type="button" onClick={() => setPreview((v) => !v)} aria-expanded={preview} className={secondaryButton}>
          {preview ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {preview ? 'Ocultar vista previa' : 'Vista previa en el proyector'}
        </button>
        {preview && <div className="mt-3"><ProjectedPreview state={state} /></div>}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700">
        <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="flex min-h-[48px] w-full items-center justify-between px-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
          Más opciones
          <ChevronDown size={18} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {showMore && (
          <div className="space-y-4 border-t border-gray-200 p-3 dark:border-gray-700">
            <fieldset>
              <legend className={labelClass}>Dificultad</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {([null, 'EASY', 'MEDIUM', 'HARD'] as (QuestionDifficulty | null)[]).map((d) => (
                  <button key={d ?? 'none'} type="button" onClick={() => patch({ difficulty: d })} aria-pressed={state.difficulty === d} className={segment(state.difficulty === d)}>
                    {d ? DIFFICULTY_LABELS[d] : 'Sin definir'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">Con un solo banco, Conquista del Cielo arma sus regiones por dificultad.</p>
            </fieldset>
            <div>
              <label htmlFor={`${ids}-image`} className={labelClass}>Imagen (enlace)</label>
              <input id={`${ids}-image`} type="url" value={state.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="https://…" className={`${inputClass} mt-1`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${ids}-points`} className={labelClass}>Puntos</label>
                <input id={`${ids}-points`} type="number" min={1} max={100} value={state.points} onChange={(e) => patch({ points: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} className={`${inputClass} mt-1`} />
              </div>
              <div>
                <label htmlFor={`${ids}-time`} className={labelClass}>Tiempo (segundos)</label>
                <input id={`${ids}-time`} type="number" min={5} max={300} value={state.timeLimitSeconds} onChange={(e) => patch({ timeLimitSeconds: Math.max(5, Math.min(300, Number(e.target.value) || 30)) })} className={`${inputClass} mt-1`} />
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">Puntos y tiempo solo se usan en Expediciones de Jiro.</p>
          </div>
        )}
      </div>

      {touched && problem && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-200" role="alert">{problem}</p>
      )}
    </SidePanel>
  );
};
