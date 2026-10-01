import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { questionBankApi } from '../../lib/questionBankApi';
import { stageControlClass } from './EscenarioObservatorio';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

interface AiQuestionGeneratorProps {
  classroomId: string;
  kind: 'TRUE_FALSE' | 'SINGLE_CHOICE';
  onCreated: (bank: { bankId: string; bankName: string }) => void;
}

/** Genera 10 preguntas con IA y las guarda directo en un banco de la clase (sin CSV). */
export const AiQuestionGenerator = ({ classroomId, kind, onCreated }: AiQuestionGeneratorProps) => {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [topic, setTopic] = useState('');
  const generate = useMutation({
    mutationFn: () => questionBankApi.generateIntoBank(classroomId, { topic: topic.trim(), quantity: 10, kind }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      void queryClient.invalidateQueries({ queryKey: ['questionBanks', classroomId] });
      onCreated({ bankId: data.bankId, bankName: data.bankName });
      setTopic('');
      toast.success(`${data.created} preguntas guardadas en "${data.bankName}"`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron generar las preguntas')),
  });

  return (
    <div className="rounded-2xl border border-white/15 bg-[#121a3d] p-4">
      <label htmlFor={inputId} className="flex items-center gap-2 text-lg font-bold text-indigo-100">
        <Sparkles size={20} aria-hidden="true" /> Generar 10 preguntas con IA sobre…
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id={inputId}
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && topic.trim().length >= 2 && !generate.isPending) generate.mutate();
          }}
          placeholder="Ej.: los estados del agua"
          className="min-h-[52px] min-w-0 flex-1 rounded-xl border border-white/30 bg-white/10 px-4 text-lg text-white placeholder:text-indigo-200"
        />
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={topic.trim().length < 2 || generate.isPending}
          className={`${stageControlClass} border border-white/30 text-base`}
        >
          {generate.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
          {generate.isPending ? 'Jiro está escribiendo…' : 'Generar'}
        </button>
      </div>
      <p className="mt-2 text-sm text-indigo-100">Se guardan en un banco de esta clase para reutilizarlas.</p>
    </div>
  );
};
