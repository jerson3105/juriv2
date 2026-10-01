import { useOutletContext, useParams } from 'react-router-dom';
import type { Classroom } from '../../lib/classroomApi';
import { BankDetail } from '../../components/question-banks/BankDetail';
import { BankLibrary } from '../../components/question-banks/BankLibrary';

// Banco de preguntas: la biblioteca (/question-banks) o un banco (/question-banks/:bankId).
export const QuestionBanksPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const { bankId } = useParams<{ bankId: string }>();
  if (!classroom) return null;
  return bankId ? <BankDetail key={bankId} classroom={classroom} bankId={bankId} /> : <BankLibrary classroom={classroom} />;
};
