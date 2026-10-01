import { useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileText, Loader2, PenLine, Pencil, Sparkles } from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import {
  DIFFICULTY_LABELS, questionBankApi,
  type AiKind, type DraftQuestion, type QuestionDifficulty,
} from '../../lib/questionBankApi';
import { cancelButton, gradeLabel, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { secondaryButton } from '../gradebook/gradebookHelpers';
import { Jiro } from '../observatorio/Jiro';
import { AnswerFields } from './AnswerFields';
import { BankDialog } from './BankDialog';
import {
  answerSummary, kindName, editorFromDraft, editorToPayload, errorMessage, questionFromEditor, usesOf, validateEditor,
  type EditorState,
} from './bankHelpers';

type Mode = 'topic' | 'pdf' | 'write';
type Step = 'setup' | 'generating' | 'review';
interface Draft { include: boolean; editing: boolean; state: EditorState }

const NEW_BANK = '__new__';
const MAX_PDF_MB = 15;

const KIND_OPTIONS: { value: AiKind; label: string }[] = [
  { value: 'TRUE_FALSE', label: 'Verdadero o falso' },
  { value: 'SINGLE_CHOICE', label: 'Selección única' },
  { value: 'MULTIPLE_CHOICE', label: 'Selección múltiple' },
  { value: 'MATCHING', label: 'Unir pares' },
  { value: 'ERROR_STEPS', label: 'Con error (El Error de Jiro)' },
];

const choice = (on: boolean) =>
  `flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${on
    ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-500/15 dark:text-white'
    : 'border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`;

interface CreateQuestionsDialogProps {
  classroomId: string;
  /** Banco ya elegido (al abrir desde un banco). */
  bankId?: string | null;
  onClose: () => void;
  /** Se guardaron preguntas de la IA en ese banco. */
  onSaved: (bankId: string) => void;
  /** "Escribirlas yo": abrir el editor en ese banco. */
  onWrite: (bankId: string) => void;
}

/** Lo que hay que revisar de un borrador sin abrirlo: opciones, pasos o pares (la correcta marcada). */
const DraftAnswers = ({ state, fallback }: { state: EditorState; fallback: string }) => {
  const options = state.options.filter((o) => o.text.trim());
  if (state.kind === 'MATCHING') {
    return (
      <ul className="mt-1 space-y-0.5 text-sm text-gray-800 dark:text-gray-100">
        {state.pairs.map((p, i) => <li key={i}>{p.left} <span aria-hidden="true">↔</span><span className="sr-only">con</span> {p.right}</li>)}
      </ul>
    );
  }
  if (state.kind === 'TRUE_FALSE' || options.length === 0) {
    return <p className="mt-0.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{fallback}</p>;
  }
  const isError = state.kind === 'ERROR';
  return (
    <ol className="mt-1 space-y-0.5 text-sm">
      {options.map((o, i) => (
        <li key={i} className={o.isCorrect ? (isError ? 'font-semibold text-rose-800 dark:text-rose-200' : 'font-semibold text-emerald-800 dark:text-emerald-300') : 'text-gray-800 dark:text-gray-100'}>
          {isError ? `Paso ${i + 1}: ` : `${'ABCDEF'[i]}. `}{o.text}
          {o.isCorrect && <span className="ml-1 text-xs font-bold">{isError ? '← aquí está el error' : '✓ correcta'}</span>}
        </li>
      ))}
    </ol>
  );
};

/**
 * Un solo camino para crear preguntas: con IA sobre un tema, con IA desde un PDF o escribiéndolas.
 * Lo de la IA se revisa y edita antes de guardar; lo que se guarda queda "por revisar" en el banco.
 */
export const CreateQuestionsDialog = ({ classroomId, bankId: initialBankId, onClose, onSaved, onWrite }: CreateQuestionsDialogProps) => {
  const queryClient = useQueryClient();
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: banks = [] } = useQuery({ queryKey: ['question-banks-mine'], queryFn: questionBankApi.getMyBanks });
  const { data: classrooms = [] } = useQuery({ queryKey: ['my-classrooms'], queryFn: classroomApi.getMyClassrooms });
  const classBanks = useMemo(() => banks.filter((b) => b.classroomId === classroomId), [banks, classroomId]);
  const classLevel = gradeLabel(classrooms.find((c) => c.id === classroomId)?.gradeLevel ?? null);

  const [step, setStep] = useState<Step>('setup');
  const [mode, setMode] = useState<Mode>('topic');
  const [target, setTarget] = useState<string>(initialBankId ?? '');
  const [newBankName, setNewBankName] = useState('');
  const [topic, setTopic] = useState('');
  const [pdf, setPdf] = useState<File | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [kinds, setKinds] = useState<AiKind[]>(['TRUE_FALSE', 'SINGLE_CHOICE']);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | null>(null);
  const [level, setLevel] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [touched, setTouched] = useState(false);

  // Sin banco elegido: el primero de la clase o uno nuevo.
  const bankChoice = target || (classBanks[0]?.id ?? NEW_BANK);
  const isNewBank = bankChoice === NEW_BANK;
  const bankName = isNewBank ? (newBankName.trim() || topic.trim() || 'Nuevo banco') : classBanks.find((b) => b.id === bankChoice)?.name ?? 'el banco';
  const errorOnly = kinds.includes('ERROR_STEPS');

  const toggleKind = (kind: AiKind) => setKinds((current) => {
    // "Con error" va solo: son ejercicios de otro formato.
    if (kind === 'ERROR_STEPS') return current.includes(kind) ? ['TRUE_FALSE', 'SINGLE_CHOICE'] : ['ERROR_STEPS'];
    const base = current.filter((k) => k !== 'ERROR_STEPS');
    return base.includes(kind) ? base.filter((k) => k !== kind) : [...base, kind];
  });

  const setupProblem = (() => {
    if (isNewBank && mode === 'write' && !newBankName.trim()) return 'Escribe el nombre del banco nuevo';
    if (mode === 'write') return null;
    if (mode === 'topic' && topic.trim().length < 2) return 'Escribe el tema';
    if (mode === 'pdf' && !pdf) return 'Elige un PDF';
    if (kinds.length === 0) return 'Elige al menos un tipo de pregunta';
    return null;
  })();

  const generate = useMutation({
    mutationFn: (): Promise<DraftQuestion[]> => {
      const input = { quantity, kinds, difficulty, level: classLevel ? null : level.trim() || null };
      return mode === 'pdf' && pdf
        ? questionBankApi.aiDraftsFromPdf(classroomId, pdf, input)
        : questionBankApi.aiDrafts(classroomId, { ...input, topic: topic.trim() });
    },
    onMutate: () => setStep('generating'),
    onSuccess: (result) => {
      setDrafts(result.map((d) => ({ include: true, editing: false, state: editorFromDraft(d) })));
      setStep('review');
      setTouched(false);
    },
    onError: (error) => {
      setStep('setup');
      toast.error(errorMessage(error, 'Jiro no pudo generar las preguntas. Intenta de nuevo.'));
    },
  });

  const resolveBank = async () => {
    if (!isNewBank) return bankChoice;
    const created = await questionBankApi.createBank(classroomId, { name: bankName.slice(0, 100), icon: errorOnly ? 'brain' : 'book' });
    return created.id;
  };

  const save = useMutation({
    mutationFn: async () => {
      const chosen = drafts.filter((d) => d.include);
      const bankId = await resolveBank();
      await questionBankApi.createQuestionsBatch(bankId, chosen.map((d) => editorToPayload(d.state)), true);
      return { bankId, created: chosen.length };
    },
    onSuccess: ({ bankId, created }) => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      void queryClient.invalidateQueries({ queryKey: ['questions', bankId] });
      toast.success(`${created} ${created === 1 ? 'pregunta guardada' : 'preguntas guardadas'} en "${bankName}"`);
      onSaved(bankId);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron guardar las preguntas')),
  });

  const startWriting = useMutation({
    mutationFn: resolveBank,
    onSuccess: (bankId) => {
      if (isNewBank) void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      onWrite(bankId);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear el banco')),
  });

  const submitSetup = () => {
    setTouched(true);
    if (setupProblem) return;
    if (mode === 'write') startWriting.mutate();
    else generate.mutate();
  };

  const included = drafts.filter((d) => d.include);
  const invalidIndex = drafts.findIndex((d) => d.include && validateEditor(d.state));
  const submitReview = () => {
    setTouched(true);
    if (included.length === 0 || invalidIndex >= 0) {
      if (invalidIndex >= 0) setDrafts((list) => list.map((d, i) => (i === invalidIndex ? { ...d, editing: true } : d)));
      return;
    }
    save.mutate();
  };

  const updateDraft = (index: number, patch: Partial<Draft>) => setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const confirmDiscard = () => step !== 'review' || drafts.length === 0 || window.confirm(`¿Descartar las ${drafts.length} preguntas generadas?`);
  const close = () => {
    if (save.isPending) return;
    if (confirmDiscard()) onClose();
  };

  const onPickPdf = (file: File | null) => {
    if (file && file.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`El PDF pesa más de ${MAX_PDF_MB} MB`);
      return;
    }
    setPdf(file);
  };

  // ==================== Generando ====================
  if (step === 'generating') {
    return (
      <BankDialog title="Crear preguntas" onClose={close} size="lg">
        <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
          <Jiro pose="emocionado" variant="card" sizeClassName="h-40" line={null} />
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            Jiro está escribiendo {quantity} {errorOnly ? 'ejercicios con error' : 'preguntas'}{mode === 'topic' ? ` sobre «${topic.trim()}»` : ' con tu PDF'}…
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">Suele tardar entre 10 y 30 segundos. Luego las revisas antes de guardar.</p>
          <Loader2 size={24} className="animate-spin text-primary-700 dark:text-primary-300" aria-hidden="true" />
        </div>
      </BankDialog>
    );
  }

  // ==================== Revisión ====================
  if (step === 'review') {
    return (
      <BankDialog
        title="Revisa antes de guardar"
        subtitle={`Se guardan en "${bankName}". La IA puede equivocarse: quedan "por revisar" hasta que las apruebes.`}
        onClose={close}
        size="xl"
        dismissable={false}
        footer={(
          <>
            <span className="mr-auto text-sm font-semibold text-gray-800 dark:text-gray-100">{included.length} de {drafts.length} elegidas</span>
            <button type="button" onClick={() => { if (confirmDiscard()) { setDrafts([]); setStep('setup'); } }} className={cancelButton}>Volver</button>
            <button type="button" onClick={submitReview} disabled={save.isPending || included.length === 0} className={primaryButton}>
              {save.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              Guardar {included.length} {included.length === 1 ? 'pregunta' : 'preguntas'}
            </button>
          </>
        )}
      >
        <ol className="space-y-3">
          {drafts.map((draft, i) => {
            const preview = questionFromEditor(draft.state);
            const { uses, blocker } = usesOf(preview);
            const problem = validateEditor(draft.state);
            return (
              <li key={i} className={`rounded-2xl border p-3 ${draft.include ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 opacity-70 dark:border-gray-600'}`}>
                <div className="flex items-start gap-3">
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <input type="checkbox" checked={draft.include} onChange={(e) => updateDraft(i, { include: e.target.checked })} className="h-5 w-5 accent-primary-600" aria-label={`Incluir la pregunta ${i + 1}`} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {i + 1}. {kindName(draft.state.kind)} · {draft.state.difficulty ? DIFFICULTY_LABELS[draft.state.difficulty] : 'Sin dificultad'}
                    </p>
                    {!draft.editing && (
                      <>
                        <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{draft.state.questionText}</p>
                        <DraftAnswers state={draft.state} fallback={answerSummary(preview)} />
                        {draft.state.explanation && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{draft.state.explanation}</p>}
                        <p className={`mt-1 text-xs ${blocker ? 'font-semibold text-amber-800 dark:text-amber-200' : 'text-gray-700 dark:text-gray-300'}`}>{blocker ?? `Sirve para: ${uses.join(', ')}`}</p>
                      </>
                    )}
                  </div>
                  <button type="button" onClick={() => updateDraft(i, { editing: !draft.editing })} aria-expanded={draft.editing} aria-label={draft.editing ? `Terminar de editar la pregunta ${i + 1}` : `Editar la pregunta ${i + 1}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                </div>
                {draft.editing && (
                  <div className="mt-3 space-y-3 sm:pl-14">
                    <div>
                      <label htmlFor={`${ids}-q${i}`} className={labelClass}>{draft.state.kind === 'ERROR' ? 'Problema' : 'Pregunta'}</label>
                      <textarea id={`${ids}-q${i}`} value={draft.state.questionText} onChange={(e) => updateDraft(i, { state: { ...draft.state, questionText: e.target.value.slice(0, 2000) } })} rows={2} className={`${inputClass} mt-1`} />
                    </div>
                    <AnswerFields state={draft.state} onChange={(patch) => updateDraft(i, { state: { ...draft.state, ...patch } })} />
                    <div>
                      <label htmlFor={`${ids}-e${i}`} className={labelClass}>Explicación</label>
                      <textarea id={`${ids}-e${i}`} value={draft.state.explanation} onChange={(e) => updateDraft(i, { state: { ...draft.state, explanation: e.target.value.slice(0, 2000) } })} rows={2} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label htmlFor={`${ids}-d${i}`} className={labelClass}>Dificultad</label>
                      <select id={`${ids}-d${i}`} value={draft.state.difficulty ?? ''} onChange={(e) => updateDraft(i, { state: { ...draft.state, difficulty: (e.target.value || null) as QuestionDifficulty | null } })} className={`${inputClass} mt-1 sm:w-48`}>
                        <option value="">Sin definir</option>
                        {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {draft.include && problem && (touched || draft.editing) && (
                  <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 sm:pl-14" role="alert">{problem}</p>
                )}
              </li>
            );
          })}
        </ol>
      </BankDialog>
    );
  }

  // ==================== Configuración ====================
  const busy = startWriting.isPending;
  return (
    <BankDialog
      title="Crear preguntas"
      onClose={close}
      size="lg"
      footer={(
        <>
          <button type="button" onClick={close} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={submitSetup} disabled={busy} className={primaryButton}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : mode === 'write' ? <PenLine size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {mode === 'write' ? 'Empezar a escribir' : `Generar ${quantity}`}
          </button>
        </>
      )}
    >
      <fieldset>
        <legend className={labelClass}>¿Cómo quieres crearlas?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            { value: 'topic', label: 'Con IA sobre un tema', icon: Sparkles },
            { value: 'pdf', label: 'Con IA desde un PDF', icon: FileText },
            { value: 'write', label: 'Escribirlas yo', icon: PenLine },
          ] as const).map((option) => (
            <label key={option.value} className={choice(mode === option.value)}>
              <input type="radio" name={`${ids}-mode`} checked={mode === option.value} onChange={() => setMode(option.value)} className="sr-only" />
              <option.icon size={18} aria-hidden="true" /> {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${ids}-bank`} className={labelClass}>¿En qué banco?</label>
        <select id={`${ids}-bank`} value={bankChoice} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} mt-1`}>
          {classBanks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.questionCount})</option>)}
          <option value={NEW_BANK}>+ Banco nuevo</option>
        </select>
        {isNewBank && (
          <div className="mt-2">
            <label htmlFor={`${ids}-newbank`} className="sr-only">Nombre del banco nuevo</label>
            <input id={`${ids}-newbank`} value={newBankName} onChange={(e) => setNewBankName(e.target.value.slice(0, 100))} placeholder={mode === 'write' ? 'Nombre del banco nuevo' : 'Nombre del banco (si no, se usa el tema)'} className={inputClass} />
          </div>
        )}
      </div>

      {mode === 'topic' && (
        <div>
          <label htmlFor={`${ids}-topic`} className={labelClass}>Tema</label>
          <input
            id={`${ids}-topic`}
            data-autofocus
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, 300))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSetup(); }}
            placeholder="Ej.: los estados del agua"
            className={`${inputClass} mt-1`}
          />
        </div>
      )}

      {mode === 'pdf' && (
        <div>
          <span className={labelClass} id={`${ids}-pdf-label`}>PDF de la lectura o ficha</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" aria-labelledby={`${ids}-pdf-label`} onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)} />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className={secondaryButton}>
              <FileText size={16} aria-hidden="true" /> {pdf ? 'Cambiar PDF' : 'Elegir PDF'}
            </button>
            <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">{pdf ? pdf.name : `Hasta ${MAX_PDF_MB} MB`}</span>
          </div>
        </div>
      )}

      {mode !== 'write' && (
        <>
          <fieldset>
            <legend className={labelClass}>Cantidad</legend>
            <div className="mt-2 flex gap-2">
              {[5, 10, 15].map((n) => (
                <label key={n} className={`${choice(quantity === n)} justify-center px-5`}>
                  <input type="radio" name={`${ids}-qty`} checked={quantity === n} onChange={() => setQuantity(n)} className="sr-only" /> {n}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Tipos de pregunta</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {KIND_OPTIONS.map((k) => (
                <label key={k.value} className={choice(kinds.includes(k.value))}>
                  <input type="checkbox" checked={kinds.includes(k.value)} onChange={() => toggleKind(k.value)} className="h-4 w-4 accent-primary-600" />
                  {k.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {errorOnly ? 'Los ejercicios con error van solos: Jiro resuelve paso a paso y se equivoca en uno. Elige un cálculo o procedimiento.' : 'Verdadero o falso y Selección única se proyectan en Estrellas y Conquista.'}
            </p>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Dificultad</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([null, 'EASY', 'MEDIUM', 'HARD'] as (QuestionDifficulty | null)[]).map((d) => (
                <label key={d ?? 'mix'} className={choice(difficulty === d)}>
                  <input type="radio" name={`${ids}-diff`} checked={difficulty === d} onChange={() => setDifficulty(d)} className="sr-only" />
                  {d ? DIFFICULTY_LABELS[d] : 'Variada'}
                </label>
              ))}
            </div>
          </fieldset>

          {classLevel ? (
            <p className="text-sm text-gray-800 dark:text-gray-100">Nivel: <strong>{classLevel}</strong> (el de la clase)</p>
          ) : (
            <div>
              <label htmlFor={`${ids}-level`} className={labelClass}>Nivel <span className="font-normal text-gray-700 dark:text-gray-300">(la clase no tiene grado)</span></label>
              <input id={`${ids}-level`} value={level} onChange={(e) => setLevel(e.target.value.slice(0, 100))} placeholder="Ej.: 5.º de primaria" className={`${inputClass} mt-1`} />
            </div>
          )}
        </>
      )}

      {touched && setupProblem && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-200" role="alert">{setupProblem}</p>
      )}
    </BankDialog>
  );
};
