import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Copy, Eye, EyeOff, Pencil, Play, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type { Classroom } from '../../lib/classroomApi';
import { DIFFICULTY_LABELS, getBankEmoji, questionBankApi, type Question, type QuestionDifficulty } from '../../lib/questionBankApi';
import { inputClass, primaryButton } from '../home/homeHelpers';
import { card, secondaryButton } from '../gradebook/gradebookHelpers';
import { ActionMenu } from '../home/ActionMenu';
import { showUndoToast } from '../storytelling/undoToast';
import {
  ACTIVITY_NAMES, activityRoute, bankRoute, errorMessage, isErrorQuestion, usesOf, type ActivityKey, type EditorKind,
} from './bankHelpers';
import { BankFormDialog } from './BankFormDialog';
import { CreateQuestionsDialog } from './CreateQuestionsDialog';
import { DuplicateBankDialog } from './DuplicateBankDialog';
import { QuestionEditor } from './QuestionEditor';
import { QuestionRow } from './QuestionRow';

const HIDE_KEY = 'question-banks-hide-answers';
const readHide = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
};

const KIND_FILTERS: { value: EditorKind | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'TRUE_FALSE', label: 'Verdadero o falso' },
  { value: 'SINGLE_CHOICE', label: 'Selección única' },
  { value: 'MULTIPLE_CHOICE', label: 'Selección múltiple' },
  { value: 'MATCHING', label: 'Unir pares' },
  { value: 'ERROR', label: 'Con error' },
];

const kindOf = (q: Question): EditorKind => (isErrorQuestion(q) ? 'ERROR' : q.type);
const isPending = (q: Question) => q.aiGenerated && !q.reviewedAt;
const selectClass = `${inputClass.replace('w-full', 'min-w-[40%] flex-1 sm:min-w-0 sm:w-auto sm:flex-none')} min-h-[44px]`;
const toggleChip = (on: boolean) =>
  `inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${on
    ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-500/15 dark:text-white'
    : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`;

/** "Usar en clase": abre la actividad del Observatorio con este banco ya elegido. */
const UseInClassMenu = ({ items }: { items: { key: ActivityKey; count: number; to: string }[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative z-10">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className={secondaryButton}>
        <Play size={16} aria-hidden="true" /> Usar en clase <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" className="absolute left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-600 dark:bg-gray-800">
          {items.map((item) => (
            <li key={item.key} role="none">
              <Link to={item.to} role="menuitem" className="flex min-h-[48px] flex-col justify-center px-4 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white">{ACTIVITY_NAMES[item.key]}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{item.count} {item.count === 1 ? 'pregunta sirve' : 'preguntas sirven'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Un banco: sus preguntas, qué tan listas están para clase y lo que hay que revisar. */
export const BankDetail = ({ classroom, bankId }: { classroom: Classroom; bankId: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // "Escribirlas yo" desde Crear preguntas llega con ?nueva=1.
  const [editing, setEditing] = useState<Question | 'new' | null>(() => (searchParams.get('nueva') === '1' ? 'new' : null));
  const [creating, setCreating] = useState(false);
  const [bankForm, setBankForm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [hideAnswers, setHideAnswers] = useState(readHide);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<EditorKind | ''>('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'NONE' | ''>('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const bankQuery = useQuery({ queryKey: ['question-bank', bankId], queryFn: () => questionBankApi.getBank(bankId), retry: false });
  const { data: questions = [], isLoading: questionsLoading } = useQuery({ queryKey: ['questions', bankId], queryFn: () => questionBankApi.getQuestions(bankId), enabled: bankQuery.isSuccess });
  const bank = bankQuery.data;

  useEffect(() => {
    if (searchParams.get('nueva') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('nueva');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleHide = () => {
    setHideAnswers((v) => {
      try {
        localStorage.setItem(HIDE_KEY, v ? '0' : '1');
      } catch { /* sin almacenamiento */ }
      return !v;
    });
  };

  const summary = useMemo(() => {
    const result = { pending: 0, blocked: 0, explained: 0, general: 0, errors: 0, byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0, NONE: 0 } };
    for (const q of questions) {
      const { blocker } = usesOf(q);
      if (isPending(q)) result.pending += 1;
      if (blocker) result.blocked += 1;
      else if (isErrorQuestion(q)) result.errors += 1;
      else result.general += 1;
      if (q.explanation) result.explained += 1;
      result.byDifficulty[q.difficulty ?? 'NONE'] += 1;
    }
    return result;
  }, [questions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) => (!kind || kindOf(q) === kind)
        && (!difficulty || (q.difficulty ?? 'NONE') === difficulty)
        && (!onlyPending || isPending(q))
        && (!onlyBlocked || !!usesOf(q).blocker)
        && (!term || `${q.questionText} ${q.explanation ?? ''}`.toLowerCase().includes(term)));
  }, [questions, kind, difficulty, onlyPending, onlyBlocked, search]);
  const filtering = !!(kind || difficulty || onlyPending || onlyBlocked || search.trim());

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['questions', bankId] });
    void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
  };

  const removeQuestion = useMutation({
    mutationFn: (q: Question) => questionBankApi.deleteQuestion(q.id),
    onSuccess: (_, q) => {
      refresh();
      showUndoToast('Pregunta eliminada', () => questionBankApi.restoreQuestion(q.id), refresh);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la pregunta')),
  });
  const approve = useMutation({
    mutationFn: (q: Question) => questionBankApi.reviewQuestion(q.id),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, 'No se pudo aprobar la pregunta')),
  });
  const approveAll = useMutation({
    mutationFn: () => questionBankApi.reviewBank(bankId),
    onSuccess: (data) => {
      refresh();
      setOnlyPending(false);
      toast.success(`${data.reviewed} ${data.reviewed === 1 ? 'pregunta aprobada' : 'preguntas aprobadas'}`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron aprobar')),
  });
  const removeBank = useMutation({
    mutationFn: () => questionBankApi.deleteBank(bankId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      showUndoToast(`Banco eliminado: ${bank?.name ?? ''}`, () => questionBankApi.restoreBank(bankId), () => void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] }));
      navigate(bankRoute(classroom.id));
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el banco')),
  });

  const backLink = (
    <Link to={bankRoute(classroom.id)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-gray-800 hover:text-primary-700 dark:text-gray-100 dark:hover:text-primary-300">
      <ArrowLeft size={16} aria-hidden="true" /> Bancos
    </Link>
  );

  if (bankQuery.isLoading) {
    return <div className="space-y-4">{backLink}<p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300" role="status">Cargando banco…</p></div>;
  }
  if (!bank) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className={`${card} text-center`} role="alert">
          <p className="font-semibold text-gray-900 dark:text-white">No encontramos este banco.</p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Puede que se haya eliminado o que sea de otro docente.</p>
        </div>
      </div>
    );
  }

  const activities: { key: ActivityKey; count: number; to: string }[] = [];
  if (summary.general > 0) {
    activities.push({ key: 'estrellas', count: summary.general, to: activityRoute(classroom.id, 'estrellas', bank.id) });
    activities.push({ key: 'conquista', count: summary.general, to: activityRoute(classroom.id, 'conquista', bank.id) });
  }
  if (summary.errors > 0) activities.push({ key: 'error', count: summary.errors, to: activityRoute(classroom.id, 'error', bank.id) });
  const otherClass = bank.classroomId !== classroom.id;
  const total = questions.length;

  return (
    <div className="space-y-4">
      {backLink}

      <div className="flex flex-wrap items-start gap-x-2 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${bank.color}26` }} aria-hidden="true">
            {getBankEmoji(bank.icon)}
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-gray-900 dark:text-white">{bank.name}</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {total} {total === 1 ? 'pregunta' : 'preguntas'}
              {otherClass && ' · de otra de tus clases'}
              {bank.description && ` · ${bank.description}`}
            </p>
          </div>
        </div>
        {/* En móvil las acciones bajan a su propia fila; "⋯" queda junto al título. */}
        <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
          <UseInClassMenu items={activities} />
          <button type="button" onClick={() => setEditing('new')} className={secondaryButton}>
            <Plus size={16} aria-hidden="true" /> Nueva pregunta
          </button>
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
            <Sparkles size={16} aria-hidden="true" /> Crear con IA
          </button>
        </div>
        <ActionMenu
          label={`Más acciones de ${bank.name}`}
          items={[
            { label: 'Editar banco', icon: Pencil, onClick: () => setBankForm(true) },
            { label: 'Duplicar', icon: Copy, onClick: () => setDuplicating(true) },
            { label: 'Eliminar banco', icon: Trash2, danger: true, onClick: () => removeBank.mutate() },
          ]}
        />
      </div>

      {summary.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/40 dark:bg-amber-400/10" role="status">
          <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong>{summary.pending} {summary.pending === 1 ? 'pregunta generada con IA está' : 'preguntas generadas con IA están'} por revisar.</strong>{' '}
              Léelas antes de proyectarlas: en clase se muestran como respuesta correcta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!onlyPending && (
              <button type="button" onClick={() => setOnlyPending(true)} className={secondaryButton}>Ver solo esas</button>
            )}
            <button type="button" onClick={() => approveAll.mutate()} disabled={approveAll.isPending} className={secondaryButton}>
              <Check size={16} aria-hidden="true" /> Aprobar todas
            </button>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className={`${card} grid grid-cols-2 gap-3 text-sm sm:grid-cols-4`}>
          <div>
            <p className="text-gray-700 dark:text-gray-300">Se proyectan</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{total - summary.blocked} de {total}</p>
          </div>
          <div>
            <p className="text-gray-700 dark:text-gray-300">Con explicación</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{summary.explained} de {total}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-700 dark:text-gray-300">Dificultad</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {(['EASY', 'MEDIUM', 'HARD', 'NONE'] as const)
                .filter((k) => summary.byDifficulty[k] > 0)
                .map((k) => `${summary.byDifficulty[k]} ${k === 'NONE' ? 'sin definir' : DIFFICULTY_LABELS[k].toLowerCase()}`)
                .join(' · ')}
            </p>
          </div>
          {summary.blocked > 0 && (
            <p className="col-span-2 flex items-start gap-2 text-amber-900 dark:text-amber-100 sm:col-span-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {summary.blocked} no {summary.blocked === 1 ? 'entra' : 'entran'} en Estrellas ni Conquista (solo Sorteo y Expediciones).{' '}
                {!onlyBlocked && <button type="button" onClick={() => setOnlyBlocked(true)} className="inline-block py-1.5 font-bold underline">Ver cuáles</button>}
              </span>
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-56">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
            <label htmlFor="question-search" className="sr-only">Buscar pregunta</label>
            <input id="question-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pregunta" className={`${inputClass} pl-9`} />
          </div>
          <label htmlFor="question-kind" className="sr-only">Tipo</label>
          <select id="question-kind" value={kind} onChange={(e) => setKind(e.target.value as EditorKind | '')} className={selectClass}>
            {KIND_FILTERS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <label htmlFor="question-difficulty" className="sr-only">Dificultad</label>
          <select id="question-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty | 'NONE' | '')} className={selectClass}>
            <option value="">Toda dificultad</option>
            {(['EASY', 'MEDIUM', 'HARD'] as QuestionDifficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
            <option value="NONE">Sin definir</option>
          </select>
          {summary.pending > 0 && (
            <button type="button" onClick={() => setOnlyPending((v) => !v)} aria-pressed={onlyPending} className={toggleChip(onlyPending)}>Por revisar</button>
          )}
          {summary.blocked > 0 && (
            <button type="button" onClick={() => setOnlyBlocked((v) => !v)} aria-pressed={onlyBlocked} className={toggleChip(onlyBlocked)}>No se proyectan</button>
          )}
          <button type="button" onClick={toggleHide} aria-pressed={hideAnswers} className={`${toggleChip(hideAnswers)} sm:ml-auto`}>
            {hideAnswers ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            Ocultar respuestas
          </button>
        </div>
      )}

      {questionsLoading ? (
        <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300" role="status">Cargando preguntas…</p>
      ) : total === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">✏️</span><span className="text-5xl">✨</span><span className="text-4xl">📄</span>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Este banco aún no tiene preguntas</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
            Genéralas con IA a partir de un tema o un PDF, o escríbelas tú una por una.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setCreating(true)} className={primaryButton}><Sparkles size={16} aria-hidden="true" /> Crear con IA</button>
            <button type="button" onClick={() => setEditing('new')} className={secondaryButton}><Plus size={16} aria-hidden="true" /> Nueva pregunta</button>
          </div>
        </div>
      ) : (
        <>
          {filtering && (
            <p className="text-sm text-gray-700 dark:text-gray-300" role="status">
              {filtered.length} de {total}{' '}
              <button type="button" onClick={() => { setSearch(''); setKind(''); setDifficulty(''); setOnlyPending(false); setOnlyBlocked(false); }} className="inline-block py-1.5 font-semibold text-primary-700 underline dark:text-primary-300">Quitar filtros</button>
            </p>
          )}
          <ul className="space-y-2">
            {filtered.map(({ q, index }) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={index}
                hideAnswers={hideAnswers}
                onEdit={() => setEditing(q)}
                onDelete={() => removeQuestion.mutate(q)}
                onApprove={() => approve.mutate(q)}
                approving={approve.isPending && approve.variables?.id === q.id}
              />
            ))}
          </ul>
        </>
      )}

      {editing && <QuestionEditor bankId={bank.id} question={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {creating && (
        <CreateQuestionsDialog
          classroomId={bank.classroomId}
          bankId={bank.id}
          onClose={() => setCreating(false)}
          onSaved={(savedBankId) => { if (savedBankId !== bank.id) navigate(bankRoute(classroom.id, savedBankId)); }}
          onWrite={(targetBankId) => { if (targetBankId === bank.id) setEditing('new'); else navigate(`${bankRoute(classroom.id, targetBankId)}?nueva=1`); }}
        />
      )}
      {bankForm && <BankFormDialog classroomId={bank.classroomId} bank={bank} onClose={() => setBankForm(false)} />}
      {duplicating && (
        <DuplicateBankDialog
          bank={{ id: bank.id, name: bank.name, classroomId: bank.classroomId, questionCount: total }}
          currentClassroomId={classroom.id}
          onClose={() => setDuplicating(false)}
          onDone={(created) => navigate(bankRoute(classroom.id, created.id))}
        />
      )}
    </div>
  );
};
