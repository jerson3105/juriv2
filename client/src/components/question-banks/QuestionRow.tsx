import { useId, useState } from 'react';
import { Check, ChevronDown, MessageSquare, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { parseQuestionData, type Question } from '../../lib/questionBankApi';
import { answerSummary, difficultyLabel, kindName, ERROR_PREFIX, isErrorQuestion, usesOf } from './bankHelpers';

interface QuestionRowProps {
  question: Question;
  index: number;
  hideAnswers: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  approving?: boolean;
}

const iconButton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';

/** Una pregunta del banco: enunciado, respuesta en una línea y para qué sirve. Se despliega para ver todo. */
export const QuestionRow = ({ question, index, hideAnswers, onEdit, onDelete, onApprove, approving }: QuestionRowProps) => {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const parsed = parseQuestionData(question);
  const isError = isErrorQuestion(question);
  const text = isError ? question.questionText.slice(ERROR_PREFIX.length).trim() : question.questionText;
  const { uses, blocker } = usesOf(question);
  const pending = question.aiGenerated && !question.reviewedAt;

  return (
    <li className={`rounded-2xl border bg-white dark:bg-gray-800 ${pending ? 'border-amber-300 dark:border-amber-400/50' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-1 p-2 sm:p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100">{index + 1}</span>
          <span className="min-w-0 flex-1">
            {isError && <span className="block text-xs font-bold text-rose-700 dark:text-rose-300">Con error · El Error de Jiro</span>}
            <span className={`block font-semibold text-gray-900 dark:text-white ${open ? '' : 'line-clamp-2'}`}>{text}</span>
            {!hideAnswers && <span className="mt-0.5 block text-sm font-semibold text-emerald-800 dark:text-emerald-300">{answerSummary(question)}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700 dark:text-gray-300">
              {!isError && <span>{kindName(question.type)}</span>}
              <span>{difficultyLabel(question.difficulty)}</span>
              {question.explanation && (
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden="true" /> Con explicación</span>
              )}
              {blocker ? (
                <span className="font-semibold text-amber-800 dark:text-amber-200">{blocker}</span>
              ) : (
                <span>Sirve para: {uses.join(', ')}</span>
              )}
            </span>
          </span>
          <ChevronDown size={18} className={`mt-1 shrink-0 text-gray-600 transition-transform dark:text-gray-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={onEdit} aria-label={`Editar la pregunta ${index + 1}`} className={iconButton}>
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Eliminar la pregunta ${index + 1}`} className={`${iconButton} hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300`}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/30 dark:bg-amber-400/10">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <Sparkles size={14} aria-hidden="true" /> Generada con IA · por revisar
          </span>
          <button type="button" onClick={onApprove} disabled={approving} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-60 dark:bg-gray-800 dark:text-amber-100 dark:ring-amber-400/50 dark:hover:bg-gray-700">
            <Check size={16} aria-hidden="true" /> Aprobar
          </button>
        </div>
      )}

      {open && (
        <div id={detailId} className="space-y-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
          {question.type === 'TRUE_FALSE' && (
            <p className="text-gray-800 dark:text-gray-100">Respuesta: <strong>{hideAnswers ? 'oculta' : (parsed.correctAnswer === true || parsed.correctAnswer === 'true') ? 'Verdadero' : 'Falso'}</strong></p>
          )}
          {parsed.options && parsed.options.length > 0 && (
            <ol className="space-y-1">
              {parsed.options.map((o, i) => {
                const mark = !hideAnswers && o.isCorrect;
                return (
                  <li key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${mark ? (isError ? 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100') : 'text-gray-800 dark:text-gray-100'}`}>
                    <span className="w-5 shrink-0 font-bold">{isError ? `${i + 1}.` : `${'ABCDEF'[i]}.`}</span>
                    <span className="flex-1">{isError ? o.text.replace(/^Paso \d+:\s*/, '') : o.text}</span>
                    {mark && <span className="shrink-0 text-xs font-bold">{isError ? 'Aquí está el error' : 'Correcta'}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          {parsed.pairs && parsed.pairs.length > 0 && (
            <ul className="space-y-1 text-gray-800 dark:text-gray-100">
              {parsed.pairs.map((p, i) => <li key={i}>{p.left} <span aria-hidden="true">↔</span><span className="sr-only">con</span> {hideAnswers ? '…' : p.right}</li>)}
            </ul>
          )}
          {question.explanation && !hideAnswers && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-gray-800 dark:bg-gray-900/40 dark:text-gray-100"><strong>Explicación:</strong> {question.explanation}</p>
          )}
          {question.imageUrl && <p className="break-all text-gray-700 dark:text-gray-300">Imagen: {question.imageUrl}</p>}
        </div>
      )}
    </li>
  );
};
