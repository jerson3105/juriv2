import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FileUp, Link2, Loader2, MapPin, School, Shuffle, Trash2, X } from 'lucide-react';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { NumberField, SaveBar } from '../../settings/settingsUi';
import { inputClass, labelClass } from '../../home/homeHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { QUESTION_TYPE_LABELS, questionBankApi } from '../../../lib/questionBankApi';
import {
  expeditionApi, expeditionKeys,
  type ExpeditionResource, type StopKind, type StopPatch, type TeacherExpedition, type TeacherStop,
} from '../../../lib/expeditionApi';
import { KIND_INFO, KIND_ORDER, MAX_QUESTIONS, MAX_REWARD, MAX_UPLOAD_BYTES, compressImage, fromLocalInput, resourceLabel, toLocalInput } from '../expeditionHelpers';

const SUGGESTED: Record<StopKind, { xpPercent: number; gold: number }> = {
  STORY: { xpPercent: 0, gold: 0 }, CHALLENGE: { xpPercent: 10, gold: 0 }, EVIDENCE: { xpPercent: 15, gold: 5 }, CLASS: { xpPercent: 10, gold: 0 },
};

interface Draft {
  kind: StopKind;
  title: string;
  story: string;
  goal: string;
  successCriteria: string;
  mission: string;
  resources: ExpeditionResource[];
  bankId: string | null;
  questionIds: string[];
  passPercent: number;
  reviewMode: 'ADVANCE' | 'WAIT';
  dueAt: string;
  rewardXp: string;
  rewardGold: string;
}

const toDraft = (stop: TeacherStop): Draft => ({
  kind: stop.kind,
  title: stop.title,
  story: stop.story ?? '',
  goal: stop.goal ?? '',
  successCriteria: stop.successCriteria ?? '',
  mission: stop.mission ?? '',
  resources: stop.resources,
  bankId: stop.bankId,
  questionIds: stop.questionIds,
  passPercent: stop.passPercent,
  reviewMode: stop.reviewMode,
  dueAt: toLocalInput(stop.dueAt),
  rewardXp: String(stop.rewardXp),
  rewardGold: String(stop.rewardGold),
});

/** Solo lo que cambió (el servidor valida con lista blanca). */
const patchOf = (stop: TeacherStop, draft: Draft): StopPatch => {
  const base = toDraft(stop);
  const patch: StopPatch = {};
  if (draft.kind !== base.kind) patch.kind = draft.kind;
  if (draft.title !== base.title) patch.title = draft.title;
  for (const key of ['story', 'goal', 'successCriteria', 'mission'] as const) {
    if (draft[key] !== base[key]) patch[key] = draft[key].trim() || null;
  }
  if (JSON.stringify(draft.resources) !== JSON.stringify(base.resources)) patch.resources = draft.resources;
  if (draft.bankId !== base.bankId) patch.bankId = draft.bankId;
  if (JSON.stringify(draft.questionIds) !== JSON.stringify(base.questionIds)) patch.questionIds = draft.questionIds;
  if (draft.passPercent !== base.passPercent) patch.passPercent = draft.passPercent;
  if (draft.reviewMode !== base.reviewMode) patch.reviewMode = draft.reviewMode;
  if (draft.dueAt !== base.dueAt) patch.dueAt = fromLocalInput(draft.dueAt);
  if (draft.rewardXp !== base.rewardXp) patch.rewardXp = Number(draft.rewardXp);
  if (draft.rewardGold !== base.rewardGold) patch.rewardGold = Number(draft.rewardGold);
  return patch;
};

const rewardError = (value: string) => {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n)) return 'Escribe un número entero';
  if (n < 0 || n > MAX_REWARD) return `Entre 0 y ${MAX_REWARD}`;
  return null;
};

const QuestionPicker = ({ classroomId, bankId, questionIds, onChange }: {
  classroomId: string; bankId: string | null; questionIds: string[]; onChange: (bankId: string | null, ids: string[]) => void;
}) => {
  const banks = useQuery({ queryKey: ['questionBanks', classroomId], queryFn: () => questionBankApi.getBanks(classroomId) });
  const questions = useQuery({ queryKey: ['questions', bankId], queryFn: () => questionBankApi.getQuestions(bankId!), enabled: !!bankId });
  const usable = (q: { isActive: boolean; aiGenerated: boolean; reviewedAt: string | null }) => q.isActive && (!q.aiGenerated || !!q.reviewedAt);
  const list = (questions.data ?? []).filter((q) => q.isActive);
  const selected = new Set(questionIds);
  const toggle = (id: string) => onChange(bankId, selected.has(id) ? questionIds.filter((q) => q !== id) : questionIds.length >= MAX_QUESTIONS ? questionIds : [...questionIds, id]);
  const randomFive = () => {
    const pool = list.filter(usable).map((q) => q.id).sort(() => Math.random() - 0.5);
    onChange(bankId, pool.slice(0, 5));
  };

  if (banks.isSuccess && banks.data.length === 0) {
    return (
      <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
        Aún no tienes bancos de preguntas en esta clase. <Link to={`/classroom/${classroomId}/question-banks`} className="font-semibold underline">Crea uno</Link> (también con IA) y vuelve.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={labelClass}>Banco de preguntas</span>
        <select value={bankId ?? ''} onChange={(event) => onChange(event.target.value || null, [])} className={`${inputClass} mt-1.5 min-h-[44px]`}>
          <option value="">Elige un banco…</option>
          {(banks.data ?? []).map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
        </select>
      </label>
      {bankId && (
        questions.isLoading ? <p className="text-sm text-gray-700 dark:text-gray-300">Cargando preguntas…</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{questionIds.length} elegidas <span className="font-normal text-gray-700 dark:text-gray-300">(5 a 10 es lo ideal; máximo {MAX_QUESTIONS})</span></span>
              <button type="button" onClick={randomFive} className="pg-btn ml-auto"><Shuffle size={15} aria-hidden="true" /> 5 al azar</button>
              {questionIds.length > 0 && <button type="button" onClick={() => onChange(bankId, [])} className="pg-btn">Quitar todas</button>}
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-1 dark:border-gray-700">
              {list.length === 0 && <li className="p-3 text-sm text-gray-700 dark:text-gray-300">Este banco no tiene preguntas.</li>}
              {list.map((question) => {
                const ok = usable(question);
                return (
                  <li key={question.id}>
                    <label className={`flex items-start gap-2 rounded-lg px-2 py-2 ${ok ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'opacity-60'}`}>
                      <input type="checkbox" className="pg-check mt-0.5" checked={selected.has(question.id)} disabled={!ok} onChange={() => toggle(question.id)} />
                      <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
                        {question.questionText}
                        <span className="block text-xs text-gray-700 dark:text-gray-300">
                          {QUESTION_TYPE_LABELS[question.type]}{!ok ? ' · De IA, sin revisar' : question.explanation ? ' · Con explicación' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )
      )}
    </div>
  );
};

const ResourceEditor = ({ resources, onChange }: { resources: ExpeditionResource[]; onChange: (next: ExpeditionResource[]) => void }) => {
  const [link, setLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = resources.length >= 5;
  const addLink = () => {
    const url = link.trim();
    if (!/^https:\/\/[^\s<>"']+$/i.test(url)) return toast.error('El enlace debe empezar con https://');
    onChange([...resources, { kind: 'LINK', url, name: null }]);
    setLink('');
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const ready = await compressImage(file);
      if (ready.size > MAX_UPLOAD_BYTES) throw new Error('El archivo pesa más de 5 MB');
      const uploaded = await expeditionApi.upload(ready);
      onChange([...resources, { kind: 'FILE', url: uploaded.url, name: uploaded.name }]);
    } catch (error) {
      toast.error(errorMessage(error, error instanceof Error ? error.message : 'No se pudo subir'));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="space-y-2">
      <p className={labelClass}>Recursos <span className="font-normal text-gray-700 dark:text-gray-300">(imagen, PDF, enlace o Genially · hasta 5)</span></p>
      {resources.length > 0 && (
        <ul className="space-y-1">
          {resources.map((resource) => (
            <li key={resource.url} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 dark:border-gray-700">
              {resource.kind === 'FILE' ? <FileUp size={16} aria-hidden="true" className="text-gray-600 dark:text-gray-300" /> : <Link2 size={16} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{resourceLabel(resource)}</span>
              <button type="button" onClick={() => onChange(resources.filter((r) => r.url !== resource.url))} className="pg-icon-btn" aria-label={`Quitar ${resourceLabel(resource)}`}>
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" id="stop-resource-file" onChange={(event) => void upload(event.target.files?.[0])} />
          <label htmlFor="stop-resource-file" className={`pg-btn cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            {uploading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileUp size={15} aria-hidden="true" />} Subir archivo
          </label>
          <div className="flex min-w-[14rem] flex-1 gap-2">
            <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" aria-label="Enlace (https)" className={`${inputClass} min-h-[40px] py-2`}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} />
            <button type="button" onClick={addLink} disabled={!link.trim()} className="pg-btn">Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Panel de una parada: campos según el tipo, recompensa sugerida y guardar solo si hay cambios. El tipo se puede
 * cambiar mientras nadie la haya empezado.
 */
export const StopPanel = ({ expedition, stop, index, xpPerLevel, placing, onPlace, onMarkClass, onDeleted }: {
  expedition: TeacherExpedition;
  stop: TeacherStop;
  index: number;
  xpPerLevel: number;
  placing: boolean;
  onPlace: (placing: boolean) => void;
  onMarkClass: () => void;
  onDeleted: () => void;
}) => {
  const queryClient = useQueryClient();
  // El padre monta el panel con key={stopPanelKey(stop)}: al cambiar de parada o al guardar, empieza de lo guardado.
  const [draft, setDraft] = useState<Draft>(() => toDraft(stop));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useMemo(() => patchOf(stop, draft), [stop, draft]);
  const dirty = Object.keys(patch).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const xpError = rewardError(draft.rewardXp);
  const goldError = rewardError(draft.rewardGold);
  const invalid = !draft.title.trim() || !!xpError || !!goldError;
  const started = stop.stats.started + stop.stats.waiting + stop.stats.done + stop.stats.pending + stop.stats.needsWork > 0;
  const suggested = SUGGESTED[draft.kind];
  const suggestion = `Sugerido: ${Math.round((xpPerLevel * suggested.xpPercent) / 100)} XP${suggested.gold ? ` y ${suggested.gold} de oro` : ''}`;

  const refresh = () => queryClient.invalidateQueries({ queryKey: expeditionKeys.detail(expedition.id) });
  const save = useMutation({
    mutationFn: () => expeditionApi.updateStop(stop.id, patch),
    onSuccess: () => {
      toast.success('Parada guardada');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la parada')),
  });
  const remove = useMutation({
    mutationFn: () => expeditionApi.deleteStop(stop.id),
    onSuccess: () => {
      toast.success('Parada eliminada');
      setConfirmDelete(false);
      onDeleted();
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar la parada')),
  });

  const textArea = (key: 'story' | 'mission', label: string, placeholder: string, rows = 4) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea value={draft[key]} onChange={(event) => set(key, event.target.value)} rows={rows} maxLength={4000} placeholder={placeholder} className={`${inputClass} mt-1.5`} />
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Título</span>
        <input value={draft.title} onChange={(event) => set('title', event.target.value)} maxLength={120} className={`${inputClass} mt-1.5 min-h-[44px]`} />
      </label>

      <fieldset>
        <legend className={labelClass}>Tipo de parada</legend>
        <div className="pg-seg mt-1.5 flex-wrap" role="group" aria-label="Tipo de parada">
          {KIND_ORDER.map((kind) => (
            <button key={kind} type="button" aria-pressed={draft.kind === kind} disabled={started && kind !== stop.kind}
              onClick={() => set('kind', kind)} className="pg-seg-item disabled:cursor-not-allowed disabled:opacity-50">
              <span aria-hidden="true">{KIND_INFO[kind].emoji}</span> {KIND_INFO[kind].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{started ? 'Ya tiene avances: el tipo queda fijo.' : KIND_INFO[draft.kind].hint}</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Lo que vas a lograr <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></span>
          <input value={draft.goal} onChange={(event) => set('goal', event.target.value)} maxLength={200} placeholder="Ej.: Reconocer los estados del agua" className={`${inputClass} mt-1.5 min-h-[44px]`} />
        </label>
        <label className="block">
          <span className={labelClass}>Cómo sabrás que lo lograste <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></span>
          <input value={draft.successCriteria} onChange={(event) => set('successCriteria', event.target.value)} maxLength={200} placeholder="Ej.: Aciertas 4 de 5" className={`${inputClass} mt-1.5 min-h-[44px]`} />
        </label>
      </div>

      {draft.kind === 'STORY' && (
        <>
          {textArea('story', 'Lo que cuenta Jiro', 'Ej.: Una gota se escapó del mar y quiere volver. ¿La acompañan?', 5)}
          <ResourceEditor resources={draft.resources} onChange={(next) => set('resources', next)} />
        </>
      )}

      {draft.kind === 'CHALLENGE' && (
        <>
          <QuestionPicker classroomId={expedition.classroomId} bankId={draft.bankId} questionIds={draft.questionIds}
            onChange={(bankId, ids) => setDraft((current) => ({ ...current, bankId, questionIds: ids }))} />
          <label className="block">
            <span className={labelClass}>Para superarlo</span>
            <select value={draft.passPercent} onChange={(event) => set('passPercent', Number(event.target.value))} className={`${inputClass} mt-1.5 min-h-[44px] max-w-xs`}>
              {[50, 60, 70, 80, 90, 100].map((p) => <option key={p} value={p}>{p} % de aciertos</option>)}
            </select>
            <span className="mt-1 block text-sm text-gray-700 dark:text-gray-300">Si no llega, reintenta solo las que falló (ve la explicación) y lo supera igual. Con 80 % o más al primer intento gana una estrella dorada.</span>
          </label>
          {textArea('story', 'Lo que cuenta Jiro antes del reto (opcional)', 'Ej.: Para cruzar el río hay que saber cuándo el agua hierve.', 3)}
        </>
      )}

      {draft.kind === 'EVIDENCE' && (
        <>
          {textArea('mission', '¿Qué deben entregar?', 'Ej.: Sube una foto de tu vaso con hielo y escribe qué pasó a los 10 minutos.')}
          <fieldset>
            <legend className={labelClass}>Cuando entregan</legend>
            <div className="pg-seg mt-1.5" role="group" aria-label="Cuando entregan">
              <button type="button" aria-pressed={draft.reviewMode === 'ADVANCE'} onClick={() => set('reviewMode', 'ADVANCE')} className="pg-seg-item">Siguen enseguida</button>
              <button type="button" aria-pressed={draft.reviewMode === 'WAIT'} onClick={() => set('reviewMode', 'WAIT')} className="pg-seg-item">Esperan tu revisión</button>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {draft.reviewMode === 'ADVANCE'
                ? 'Avanzan al entregar y tú revisas después en «Por revisar». Recomendado.'
                : 'No siguen hasta que apruebes. Úsalo solo en paradas clave.'}
            </p>
          </fieldset>
          <label className="block">
            <span className={labelClass}>Fecha límite <span className="font-normal text-gray-700 dark:text-gray-300">(opcional; sale en su calendario)</span></span>
            <input type="datetime-local" value={draft.dueAt} onChange={(event) => set('dueAt', event.target.value)} className={`${inputClass} mt-1.5 min-h-[44px] max-w-xs`} />
          </label>
          <ResourceEditor resources={draft.resources} onChange={(next) => set('resources', next)} />
          {textArea('story', 'Lo que cuenta Jiro (opcional)', 'Ej.: El hielo guarda un secreto…', 3)}
        </>
      )}

      {draft.kind === 'CLASS' && (
        <>
          {textArea('mission', '¿Qué harán en clase?', 'Ej.: Hervimos agua juntos y anotamos qué pasa con el vapor.')}
          {expedition.status === 'PUBLISHED' && (
            <button type="button" onClick={onMarkClass} className="pg-btn"><School size={16} aria-hidden="true" /> Marcar a los presentes</button>
          )}
          {textArea('story', 'Lo que cuenta Jiro (opcional)', '', 3)}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="XP" value={draft.rewardXp} onChange={(value) => set('rewardXp', value)} min={0} max={MAX_REWARD} error={xpError} hint={suggestion} />
        <NumberField label="Oro" value={draft.rewardGold} onChange={(value) => set('rewardGold', value)} min={0} max={MAX_REWARD} error={goldError}
          hint={draft.kind === 'EVIDENCE' ? 'Si pides una mejora, al aprobarla se paga lo mismo.' : undefined} />
      </div>

      {expedition.scenario === 'MAP' && (
        <button type="button" onClick={() => onPlace(!placing)} aria-pressed={placing} className="pg-btn">
          <MapPin size={16} aria-hidden="true" /> {placing ? 'Toca el mapa (o cancela)' : 'Ubicar en el mapa'}
        </button>
      )}

      <SaveBar dirty={dirty} saving={save.isPending} invalid={invalid} onSave={() => save.mutate()} onDiscard={() => setDraft(toDraft(stop))} />

      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <button type="button" onClick={() => setConfirmDelete(true)} className="pg-btn pg-btn-ghost text-[var(--pg-alert)]">
          <Trash2 size={16} aria-hidden="true" /> Eliminar parada {index + 1}
        </button>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        isLoading={remove.isPending}
        title={`¿Eliminar «${stop.title}»?`}
        message={started
          ? `${stop.stats.done + stop.stats.waiting + stop.stats.started} alumnos ya la empezaron: se borra su avance en esta parada (las recompensas entregadas se quedan).`
          : 'La parada se borra y las demás se reordenan.'}
        confirmText="Eliminar"
      />
    </div>
  );
};
