import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, FileText, Hourglass, Loader2, MessageSquareQuote, RotateCcw } from 'lucide-react';
import { assetUrl, expeditionApi, expeditionKeys, type ReviewDecision, type ReviewItem } from '../../../lib/expeditionApi';
import type { GradeScaleOptions, GradeScaleType } from '../../../lib/gradeApi';
import { ScaleValuePicker } from '../../gradebook/ScaleValuePicker';
import { isImageFile, plural, rewardLabel } from '../expeditionHelpers';

/** ¿El nivel escrito vale en la escala de la clase? (letras: una de la lista; números: dentro del rango). */
const validLevel = (scale: GradeScaleOptions, value: string) => {
  const text = value.trim();
  if (!text) return false;
  if (scale.kind === 'letters') return scale.values.some((v) => v.label.toUpperCase() === text.toUpperCase());
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n >= scale.min && n <= scale.max && (scale.step < 1 || Number.isInteger(n));
};

const QUICK_FEEDBACK = [
  'La foto se ve borrosa: vuelve a tomarla con más luz.',
  'Falta una parte de la consigna.',
  'Explica con tus palabras qué hiciste.',
];

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
};

const Evidence = ({ item }: { item: ReviewItem }) => {
  if (!item.evidence) return <p className="text-sm pg-fg2">Sin archivos.</p>;
  return (
    <div className="space-y-2">
      {item.evidence.note && <p className="whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:bg-gray-900/40 dark:text-gray-100">{item.evidence.note}</p>}
      {item.evidence.files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.evidence.files.map((file) => (
            <a key={file} href={assetUrl(file)} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pg-ring)]">
              {isImageFile(file)
                ? <img src={assetUrl(file)} alt={`Evidencia de ${item.student.name}`} className="h-24 w-24 rounded-lg object-cover" loading="lazy" />
                : <span className="pg-btn"><FileText size={16} aria-hidden="true" /> Abrir PDF</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const PendingRow = ({ item, selected, onSelect, onDecide, scale, scaleType, level, onLevel, closed }: {
  item: ReviewItem; selected: boolean; onSelect: () => void; onDecide: (decision: ReviewDecision) => void;
  scale: GradeScaleOptions; scaleType: GradeScaleType | null; level: string; onLevel: (value: string) => void;
  /** Expedición cerrada: solo se aprueba (ya no pueden reenviar). */
  closed: boolean;
}) => {
  const [asking, setAsking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const levelOk = !level.trim() || validLevel(scale, level);
  return (
    <li className="pg-row border-b p-3 last:border-b-0" data-selected={selected}>
      <div className="flex items-start gap-3">
        <input type="checkbox" className="pg-check mt-1" checked={selected} onChange={onSelect} aria-label={`Elegir la evidencia de ${item.student.name}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="font-bold pg-fg">{item.student.name}</p>
            <p className="text-sm pg-fg2">Parada {item.stopNumber} · {item.stopTitle}</p>
            {item.evidence && <p className="text-xs pg-fg2">{timeAgo(item.evidence.submittedAt)}</p>}
          </div>
          {item.reviewMode === 'WAIT' && (
            <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-50">
              <Hourglass size={12} aria-hidden="true" /> Espera tu revisión para seguir
            </p>
          )}
          <Evidence item={item} />
          {item.competency && !asking && (
            <div className="space-y-1">
              <p className="text-sm font-semibold pg-fg">Nivel para la nota <span className="font-normal pg-fg2">({item.competency.name} · opcional)</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <ScaleValuePicker scale={scale} scaleType={scaleType} value={level || null} label={`Nivel de ${item.student.name}`} size="sm"
                  onChange={(value) => onLevel(scale.kind === 'letters' && value.toUpperCase() === level.toUpperCase() ? '' : value)} />
                {level && scale.kind === 'letters' && <button type="button" onClick={() => onLevel('')} className="pg-btn pg-btn-ghost text-sm">Sin nivel</button>}
              </div>
              {!levelOk && <p className="text-sm font-semibold text-[var(--pg-alert)]">Ese valor no es de la escala de tu clase.</p>}
            </div>
          )}
          {asking ? (
            <div className="space-y-2 rounded-xl border border-[var(--pg-line)] p-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FEEDBACK.map((text) => (
                  <button key={text} type="button" onClick={() => setFeedback(text)} className="pg-chip min-h-[36px] text-xs">{text}</button>
                ))}
              </div>
              <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={500} rows={2} autoFocus
                placeholder="¿Qué debe mejorar?" aria-label={`Qué debe mejorar ${item.student.name}`}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAsking(false)} className="pg-btn pg-btn-ghost">Cancelar</button>
                <button type="button" disabled={!feedback.trim()} onClick={() => onDecide({ progressId: item.progressId, decision: 'NEEDS_WORK', feedback: feedback.trim(), evidenceId: item.evidence?.id ?? null })} className="pg-btn pg-btn-fix">
                  Enviar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!levelOk}
                onClick={() => onDecide({ progressId: item.progressId, decision: 'APPROVE', evidenceId: item.evidence?.id ?? null, level: item.competency && level.trim() ? level.trim() : null })}
                className="pg-btn pg-btn-give">
                <Check size={16} aria-hidden="true" /> Aprobar{item.competency && level.trim() && levelOk ? ` con ${level.trim().toUpperCase()}` : ''} <span className="font-normal">({rewardLabel(item.rewardXp, item.rewardGold)})</span>
              </button>
              {!closed && (
                <button type="button" onClick={() => setAsking(true)} className="pg-btn pg-btn-fix">
                  <RotateCcw size={16} aria-hidden="true" /> Pedir mejora
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

/**
 * «Por revisar»: las evidencias de toda la expedición en una cola, con aprobar en lote y pedir mejora con un
 * comentario. Cada decisión se puede deshacer durante 5 s. Proyectando, no se muestra nada.
 */
export const ReviewQueue = ({ expeditionId, projecting, undoable, closed }: {
  expeditionId: string;
  projecting: boolean;
  /** Expedición cerrada: se aprueba lo que entregaron antes de cerrar; para pedir mejoras, se abre de nuevo. */
  closed: boolean;
  undoable: (options: { message: string; action: () => Promise<unknown>; onUndo?: () => void; onDone?: () => void; errorText: string }) => void;
}) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: expeditionKeys.review(expeditionId), queryFn: () => expeditionApi.reviewQueue(expeditionId) });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Nivel elegido en cada fila (también viaja con «Aprobar todas»).
  const [levels, setLevels] = useState<Record<string, string>>({});

  if (projecting) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border-2 border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-600">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">📽️</span><span className="text-5xl">🙈</span><span className="text-4xl">🔒</span></div>
        <h2 className="mt-3 text-lg font-bold pg-fg">Las evidencias se ocultan mientras proyectas</h2>
        <p className="mt-1 text-sm pg-fg2">Tienen nombres y trabajos de tus alumnos.</p>
      </div>
    );
  }
  if (query.isLoading) return <p className="flex items-center justify-center gap-2 py-10 text-sm pg-fg2" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando evidencias…</p>;
  if (query.isError || !query.data) return <p className="py-10 text-center text-sm pg-fg">No se pudieron cargar las evidencias.</p>;

  const pending = query.data.pending.filter((item) => !hidden.has(item.progressId));
  const needsWork = query.data.needsWork;
  const { scale, scaleType } = query.data;
  const approval = (item: ReviewItem): ReviewDecision => {
    const level = (levels[item.progressId] ?? '').trim();
    return {
      progressId: item.progressId, decision: 'APPROVE', evidenceId: item.evidence?.id ?? null,
      level: item.competency && level && validLevel(scale, level) ? level : null,
    };
  };
  const decide = (decisions: ReviewDecision[]) => {
    const ids = decisions.map((d) => d.progressId);
    setHidden((current) => new Set([...current, ...ids]));
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    const approvals = decisions.filter((d) => d.decision === 'APPROVE').length;
    undoable({
      message: approvals === decisions.length
        ? `${plural(approvals, 'evidencia aprobada', 'evidencias aprobadas')}`
        : approvals === 0 ? 'Mejora pedida' : `${approvals} aprobadas y ${decisions.length - approvals} con mejora pedida`,
      errorText: 'No se pudo guardar la revisión',
      action: async () => {
        const result = await expeditionApi.review(expeditionId, decisions);
        // El alumno cambió su entrega mientras la mirabas: esa decisión no se aplicó y vuelve a la cola.
        if (result.changed > 0) {
          toast(`${plural(result.changed, 'entrega cambió', 'entregas cambiaron')} mientras revisabas: vuelve a mirarla${result.changed === 1 ? '' : 's'}.`, { icon: '🔄' });
        }
      },
      onUndo: () => setHidden((current) => new Set([...current].filter((id) => !ids.includes(id)))),
      onDone: () => {
        void queryClient.invalidateQueries({ queryKey: expeditionKeys.review(expeditionId) }).then(() => {
          setHidden((current) => new Set([...current].filter((id) => !ids.includes(id))));
        });
        void queryClient.invalidateQueries({ queryKey: expeditionKeys.detail(expeditionId) });
        void queryClient.invalidateQueries({ queryKey: expeditionKeys.board(expeditionId) });
        void queryClient.invalidateQueries({ queryKey: ['expeditions'] });
      },
    });
  };

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">📤</span><span className="text-5xl">✅</span><span className="text-4xl">⭐</span></div>
          <h2 className="mt-3 text-lg font-bold pg-fg">No hay evidencias por revisar</h2>
          <p className="mt-1 text-sm pg-fg2">Cuando un alumno entregue, aparecerá aquí y te llegará un aviso al día.</p>
        </div>
      ) : (
        <section aria-labelledby="review-pending" className="pg-surface" data-selecting={selected.size > 0}>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--pg-line)] px-3 py-2">
            <h2 id="review-pending" className="font-bold pg-fg">{plural(pending.length, 'evidencia por revisar', 'evidencias por revisar')}</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              {selected.size > 0 && (
                <button type="button" onClick={() => decide(pending.filter((item) => selected.has(item.progressId)).map(approval))} className="pg-btn pg-btn-give" data-filled="true">
                  <Check size={16} aria-hidden="true" /> Aprobar {selected.size}
                </button>
              )}
              {selected.size === 0 && pending.length > 1 && (
                <button type="button" onClick={() => decide(pending.map(approval))} className="pg-btn pg-btn-give">
                  <Check size={16} aria-hidden="true" /> Aprobar todas
                </button>
              )}
            </div>
          </div>
          {closed && (
            <p className="border-b border-[var(--pg-line)] px-3 py-2 text-sm pg-fg2">La expedición está cerrada: puedes aprobar lo que entregaron. Para pedir mejoras, ábrela de nuevo.</p>
          )}
          <ul>
            {pending.map((item) => (
              <PendingRow key={item.progressId} item={item} selected={selected.has(item.progressId)} closed={closed}
                scale={scale} scaleType={scaleType} level={levels[item.progressId] ?? ''}
                onLevel={(value) => setLevels((current) => ({ ...current, [item.progressId]: value }))}
                onSelect={() => setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(item.progressId)) next.delete(item.progressId); else next.add(item.progressId);
                  return next;
                })}
                onDecide={(decision) => decide([decision])} />
            ))}
          </ul>
        </section>
      )}

      {needsWork.length > 0 && (
        <section aria-labelledby="review-waiting" className="space-y-2">
          <h2 id="review-waiting" className="font-bold pg-fg">Esperando que mejoren ({needsWork.length})</h2>
          {closed && <p className="text-sm pg-fg2">Podrán mejorarlas si abres la expedición de nuevo.</p>}
          <ul className="pg-surface divide-y divide-[var(--pg-line)]">
            {needsWork.map((item) => (
              <li key={item.progressId} className="flex items-start gap-3 p-3">
                <MessageSquareQuote size={18} className="mt-0.5 flex-shrink-0 pg-fg2" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold pg-fg">{item.student.name} <span className="font-normal pg-fg2">· Parada {item.stopNumber} · {item.stopTitle}</span></p>
                  {item.feedback && <p className="text-sm pg-fg2">«{item.feedback}»{item.reviewedAt ? ` · ${timeAgo(item.reviewedAt)}` : ''}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
