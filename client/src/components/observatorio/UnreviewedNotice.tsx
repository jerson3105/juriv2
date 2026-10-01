import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { TeacherBank } from '../../lib/questionBankApi';
import { bankRoute } from '../question-banks/bankHelpers';

/** Aviso en la configuración: hay preguntas de la IA que nadie revisó y en clase se muestran como correctas. */
export const UnreviewedNotice = ({ banks, classroomId }: { banks: TeacherBank[]; classroomId: string }) => {
  const withPending = banks.filter((b) => b.stats.unreviewed > 0);
  const pending = withPending.reduce((n, b) => n + b.stats.unreviewed, 0);
  if (pending === 0) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-base text-amber-100" role="status">
      <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {pending === 1 ? '1 pregunta generada con IA está' : `${pending} preguntas generadas con IA están`} sin revisar.
        Revísalas antes de jugar: se muestran como respuesta correcta.{' '}
        <Link to={bankRoute(classroomId, withPending[0].id)} className="inline-block py-1 font-bold text-white underline">Revisar</Link>
      </span>
    </p>
  );
};
