import { useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { storyApi, type SceneKind, type Story } from '../../lib/storyApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { SCENE_ORDER, SCENE_TYPES, dialoguesToLines, errorMessage, linesToDialogues } from './storyEditorHelpers';

interface AiCoauthorModalProps {
  story: Story;
  onClose: () => void;
  onApplied: () => Promise<unknown> | void;
}

interface EditableOption { key: string; label: string; outcome: string }
interface EditableScene { key: string; type: SceneKind; percent: number; lines: string; question: string; options: EditableOption[] }

let seed = 0;
const key = () => `ai${++seed}`;
const inlineField = inputClass.replace('w-full ', '');

// IA coautora: propone un capítulo o escenas con la memoria de la historia; el profesor edita y decide.
export const AiCoauthorModal = ({ story, onClose, onApplied }: AiCoauthorModalProps) => {
  const open = story.chapters.filter((c) => c.status !== 'COMPLETED');
  const [kind, setKind] = useState<'chapter' | 'scenes'>('chapter');
  const [chapterId, setChapterId] = useState(open[0]?.id ?? '');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState<'draft' | 'save' | null>(null);
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState('');
  const [targetXp, setTargetXp] = useState(0);
  const [scenes, setScenes] = useState<EditableScene[] | null>(null);

  const generate = async () => {
    if (busy) return;
    setBusy('draft');
    try {
      const draft = await storyApi.getAiDraft(story.id, { kind, chapterId: kind === 'scenes' ? chapterId : undefined, idea: idea.trim() || undefined });
      setTitle(draft.chapter?.title ?? '');
      setCover(draft.chapter?.description ?? '');
      setTargetXp(draft.chapter?.targetXp ?? 0);
      setScenes(draft.scenes.map((sc) => ({
        key: key(),
        type: sc.type,
        percent: sc.triggerPercent ?? 50,
        lines: dialoguesToLines(sc.dialogues),
        question: sc.decision?.question ?? '',
        options: (sc.decision?.options ?? []).map((o) => ({ key: key(), label: o.label, outcome: dialoguesToLines(o.outcome) })),
      })));
    } catch (e) {
      toast.error(errorMessage(e, 'La IA no pudo proponer un borrador'));
    } finally {
      setBusy(null);
    }
  };

  const update = (k: string, patch: Partial<EditableScene>) => setScenes((list) => list?.map((sc) => (sc.key === k ? { ...sc, ...patch } : sc)) ?? null);
  const invalid = !scenes?.length || (kind === 'chapter' && !title.trim())
    || scenes.some((sc) => sc.type === 'DECISION' && (!sc.question.trim() || sc.options.length < 2 || sc.options.some((o) => !o.label.trim())));

  // Aceptar: se crean el capítulo (si corresponde) y sus escenas con la API normal.
  const apply = async () => {
    if (!scenes || invalid || busy) return;
    setBusy('save');
    let created = 0;
    try {
      let targetChapter = chapterId;
      if (kind === 'chapter') {
        const chapter = await storyApi.createChapter(story.id, {
          title: title.trim(),
          description: cover.trim() || undefined,
          completionType: targetXp > 0 ? 'XP_GOAL' : 'BIMESTER',
          completionConfig: targetXp > 0 ? { targetXp } : undefined,
        });
        targetChapter = chapter.id;
      }
      for (const sc of scenes) {
        await storyApi.createScene(targetChapter, {
          type: sc.type,
          triggerConfig: sc.type === 'MILESTONE' ? { percentage: Math.min(100, Math.max(1, sc.percent)) } : undefined,
          dialogues: linesToDialogues(sc.lines),
          decision: sc.type === 'DECISION'
            ? { question: sc.question.trim(), options: sc.options.map((o) => ({ label: o.label.trim(), outcome: linesToDialogues(o.outcome) })) }
            : undefined,
        });
        created++;
      }
      await onApplied();
      toast.success(kind === 'chapter' ? `Capítulo «${title.trim()}» creado con ${created} escenas` : `${created} escenas añadidas`);
      onClose();
    } catch (e) {
      await onApplied();
      toast.error(`${errorMessage(e, 'No se pudo guardar el borrador')}${created ? ` (se guardaron ${created} escenas)` : ''}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <HomeModal
      title="Coautor con IA"
      subtitle={scenes ? 'Revisa y edita: nada se guarda hasta que aceptes.' : story.title}
      onClose={onClose}
      size="lg"
      footer={scenes ? (
        <>
          <button type="button" onClick={generate} disabled={!!busy} className="mr-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700">
            {busy === 'draft' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />} Otra propuesta
          </button>
          <button type="button" onClick={onClose} className={cancelButton}>Descartar</button>
          <button type="button" onClick={apply} disabled={invalid || !!busy} className={primaryButton}>
            {busy === 'save' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {kind === 'chapter' ? 'Crear capítulo' : 'Añadir escenas'}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={generate} disabled={!!busy || (kind === 'scenes' && !chapterId)} className={primaryButton}>
            {busy === 'draft' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />} Proponer
          </button>
        </>
      )}
    >
      {!scenes ? (
        <>
          <fieldset>
            <legend className={labelClass}>¿Qué necesitas?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([['chapter', 'El siguiente capítulo', 'Título, portada, meta y escenas.'], ['scenes', 'Escenas para un capítulo', 'Continúa uno que aún no termina.']] as const).map(([value, label, hint]) => (
                <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} disabled={value === 'scenes' && open.length === 0}
                  className={`min-h-[64px] rounded-xl border-2 p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${kind === value ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-600'}`}>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">{label}</span>
                  <span className="block text-sm text-gray-700 dark:text-gray-300">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {kind === 'scenes' && (
            <div>
              <label htmlFor="ai-chapter" className={labelClass}>Capítulo</label>
              <select id="ai-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)} className={`${inputClass} mt-1`}>
                {open.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="ai-idea" className={labelClass}>Idea <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
            <textarea id="ai-idea" data-autofocus value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={1000} rows={2} placeholder="Ej.: descubren que el guía los traicionó" className={`${inputClass} mt-1 resize-none`} />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            La IA recuerda lo que ya pasó y lo que votó la clase.
            {!story.aiBible && ' Para más coherencia, escribe una biblia (personajes, tono) en Editar historia.'}
          </p>
        </>
      ) : (
        <>
          {kind === 'chapter' && (
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div>
                <label htmlFor="ai-title" className={labelClass}>Título</label>
                <input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} className={`${inputClass} mt-1`} />
              </div>
              <div>
                <label htmlFor="ai-target" className={labelClass}>Meta (XP)</label>
                <input id="ai-target" type="number" min={0} value={targetXp} onChange={(e) => setTargetXp(Math.max(0, parseInt(e.target.value, 10) || 0))} className={`${inputClass} mt-1`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ai-cover" className={labelClass}>Portada</label>
                <textarea id="ai-cover" rows={2} value={cover} onChange={(e) => setCover(e.target.value)} maxLength={2000} className={`${inputClass} mt-1`} />
              </div>
            </div>
          )}
          <ol className="space-y-3">
            {scenes.map((sc, i) => (
              <li key={sc.key} className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Escena {i + 1}</span>
                  <label htmlFor={`type-${sc.key}`} className="sr-only">Tipo de la escena {i + 1}</label>
                  <select id={`type-${sc.key}`} value={sc.type} onChange={(e) => update(sc.key, { type: e.target.value as SceneKind })} className={`${inlineField} w-auto`}>
                    {SCENE_ORDER.map((t) => <option key={t} value={t}>{SCENE_TYPES[t].emoji} {SCENE_TYPES[t].label}</option>)}
                  </select>
                  {sc.type === 'MILESTONE' && (
                    <label className="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
                      <input type="number" min={1} max={100} value={sc.percent} onChange={(e) => update(sc.key, { percent: parseInt(e.target.value, 10) || 50 })} className={`${inlineField} w-20`} aria-label="Porcentaje del hito" /> %
                    </label>
                  )}
                  <button type="button" onClick={() => setScenes((list) => list?.filter((x) => x.key !== sc.key) ?? null)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30" aria-label={`Quitar escena ${i + 1}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <label htmlFor={`lines-${sc.key}`} className="sr-only">Diálogos de la escena {i + 1}</label>
                <textarea id={`lines-${sc.key}`} value={sc.lines} onChange={(e) => update(sc.key, { lines: e.target.value })} rows={3} className={`${inputClass} resize-y`} />
                {sc.type === 'DECISION' && (
                  <div className="space-y-2 rounded-lg bg-rose-50 p-2 dark:bg-rose-900/20">
                    <label htmlFor={`q-${sc.key}`} className="text-sm font-semibold text-gray-900 dark:text-white">Pregunta</label>
                    <input id={`q-${sc.key}`} value={sc.question} onChange={(e) => update(sc.key, { question: e.target.value })} maxLength={300} className={inputClass} />
                    {sc.options.map((o, j) => (
                      <div key={o.key} className="space-y-1 rounded-lg border border-rose-200 p-2 dark:border-rose-800/60">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`opt-${o.key}`} className="text-sm font-semibold text-gray-900 dark:text-white">Opción {j + 1}</label>
                          {sc.options.length > 2 && (
                            <button type="button" onClick={() => update(sc.key, { options: sc.options.filter((x) => x.key !== o.key) })} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30" aria-label={`Quitar opción ${j + 1}`}>
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <input id={`opt-${o.key}`} value={o.label} onChange={(e) => update(sc.key, { options: sc.options.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)) })} maxLength={120} className={inputClass} />
                        <label htmlFor={`out-${o.key}`} className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Desenlace si gana</label>
                        <textarea id={`out-${o.key}`} value={o.outcome} onChange={(e) => update(sc.key, { options: sc.options.map((x) => (x.key === o.key ? { ...x, outcome: e.target.value } : x)) })} rows={2} className={`${inputClass} resize-y`} />
                      </div>
                    ))}
                    {sc.options.length < 3 && (
                      <button type="button" onClick={() => update(sc.key, { options: [...sc.options, { key: key(), label: '', outcome: '' }] })} className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-primary-700 dark:text-primary-300">
                        <Plus size={14} aria-hidden="true" /> Opción
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="text-sm text-gray-700 dark:text-gray-300">Una línea por diálogo; «Personaje: texto» indica quién habla.</p>
        </>
      )}
    </HomeModal>
  );
};
