import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { questionBankApi, type Question, type TeacherBank } from '../../../lib/questionBankApi';
import { shuffle } from './helpers';

const bankKey = (classroomId: string) => `juried:random-bank:${classroomId}`;

export const readBank = (classroomId: string) => {
  try {
    return localStorage.getItem(bankKey(classroomId));
  } catch {
    return null;
  }
};
export const saveBank = (classroomId: string, bankId: string | null) => {
  try {
    if (bankId) localStorage.setItem(bankKey(classroomId), bankId);
    else localStorage.removeItem(bankKey(classroomId));
  } catch {
    // Sin almacenamiento: se elige de nuevo la próxima vez.
  }
};

/** Bancos de todas las clases del profesor (las de relacionar no se proyectan aquí). */
export const useTeacherBanks = (enabled: boolean) => useQuery<TeacherBank[]>({
  queryKey: ['question-banks-mine'],
  queryFn: questionBankApi.getMyBanks,
  enabled,
  staleTime: 60_000,
});

/** Preguntas de un banco al azar y sin repetir hasta agotarlas. */
export const useBankQuestionDraw = (bankId: string | null) => {
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['questions', bankId],
    queryFn: () => questionBankApi.getQuestions(bankId!),
    enabled: !!bankId,
  });
  const usable = useMemo(() => questions.filter((q) => q.type !== 'MATCHING'), [questions]);
  const [used, setUsed] = useState<string[]>([]);
  const draw = useCallback((): Question | null => {
    if (usable.length === 0) return null;
    const fresh = usable.filter((q) => !used.includes(q.id));
    const pool = fresh.length ? fresh : usable;
    const picked = shuffle(pool)[0];
    setUsed(fresh.length ? [...used, picked.id] : [picked.id]);
    return picked;
  }, [usable, used]);
  return { draw, count: usable.length, isLoading };
};
