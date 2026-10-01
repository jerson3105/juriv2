import { useMemo, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { parseQuestionData, type Question, type TeacherBank } from '../../../lib/questionBankApi';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
interface BankSelectProps {
  banks: TeacherBank[];
  value: string | null;
  onChange: (bankId: string | null) => void;
}

/** Selector de banco sobre fondo oscuro, agrupado por clase. */
export const BankSelect = ({ banks, value, onChange }: BankSelectProps) => {
  const byClass = useMemo(() => {
    const groups = new Map<string, TeacherBank[]>();
    for (const bank of banks.filter((b) => b.questionCount - b.countsByType.MATCHING > 0)) {
      groups.set(bank.classroomName, [...(groups.get(bank.classroomName) ?? []), bank]);
    }
    return [...groups.entries()];
  }, [banks]);
  if (byClass.length === 0) return <span className="text-sm text-white/85">No tienes bancos con preguntas.</span>;
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
      Banco
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="min-h-[40px] max-w-[16rem] rounded-xl border border-white/40 bg-gray-900 px-2 text-sm text-white"
      >
        <option value="">Elige un banco…</option>
        {byClass.map(([classroomName, items]) => (
          <optgroup key={classroomName} label={classroomName}>
            {items.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.name} ({bank.questionCount - bank.countsByType.MATCHING})</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
};

interface QuestionCardProps {
  question: Question;
  onAnother: () => void;
}

/** Pregunta proyectada: se muestra sin respuesta; "Mostrar respuesta" marca la correcta y explica. */
export const QuestionCard = ({ question, onAnother }: QuestionCardProps) => {
  const [revealed, setRevealed] = useState(false);
  const parsed = parseQuestionData(question);
  const options = question.type === 'TRUE_FALSE'
    ? [{ text: 'Verdadero', isCorrect: parsed.correctAnswer === true || parsed.correctAnswer === 'true' }, { text: 'Falso', isCorrect: parsed.correctAnswer === false || parsed.correctAnswer === 'false' }]
    : (parsed.options ?? []);

  return (
    <section aria-label="Pregunta" className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white/10 p-5">
      <p className="text-3xl font-bold leading-snug text-white sm:text-4xl">{question.questionText}</p>
      {options.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map((option, i) => {
            const correct = revealed && option.isCorrect;
            return (
              <li
                key={i}
                className={`flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-4 py-2 text-xl font-semibold sm:text-2xl ${
                  correct ? 'border-emerald-300 bg-emerald-400/25 text-white' : revealed ? 'border-white/10 text-white/70' : 'border-white/25 text-white'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base font-black" aria-hidden="true">
                  {question.type === 'TRUE_FALSE' ? (i === 0 ? 'V' : 'F') : LETTERS[i]}
                </span>
                {option.text}
                {correct && <span className="ml-auto text-sm font-black text-emerald-200">Correcta</span>}
              </li>
            );
          })}
        </ul>
      )}
      {revealed && question.explanation && (
        <p className="mt-4 rounded-2xl bg-indigo-950/60 p-3 text-xl text-indigo-50">{question.explanation}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!revealed && (
          <button type="button" onClick={() => setRevealed(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 font-bold text-gray-900 hover:bg-white/90">
            <Eye size={18} aria-hidden="true" /> Mostrar respuesta
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            onAnother();
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/15 px-4 font-semibold text-white hover:bg-white/25"
        >
          <RefreshCw size={16} aria-hidden="true" /> Otra pregunta
        </button>
      </div>
    </section>
  );
};
