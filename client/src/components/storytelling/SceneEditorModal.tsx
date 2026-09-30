import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Copy, Eye, Image as ImageIcon, Loader2, MessageSquarePlus, Trash2, Video, Wand2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { storyApi, type StoryScene } from '../../lib/storyApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { StoryPlayer } from '../story/StoryPlayer';
import { EMOTIONS, sceneItem, youTubeId } from '../story/storyPlayerHelpers';
import { SCENE_ORDER, SCENE_TYPES, errorMessage, sceneTrigger, type SceneType } from './storyEditorHelpers';

interface DraftDialogue {
  key: string;
  speaker: string;
  text: string;
  emotion: string;
}

export interface SceneDraft {
  type: SceneType;
  mediaType: 'IMAGE' | 'VIDEO' | null;
  mediaUrl: string | null;
  triggerConfig: { percentage: number } | null;
  dialogues: Array<{ speaker?: string; text: string; emotion: string }>;
}

interface SceneEditorModalProps {
  scene?: StoryScene | null;
  chapterTitle: string;
  storyContext: string;
  accent: StoryAccent | null;
  saving: boolean;
  onSave: (draft: SceneDraft) => void;
  onClose: () => void;
}

let keySeed = 0;
const newKey = () => `d${++keySeed}`;

const toDraftDialogues = (scene?: StoryScene | null): DraftDialogue[] =>
  scene?.dialogues?.length
    ? scene.dialogues.map((d) => ({ key: newKey(), speaker: d.speaker ?? '', text: d.text, emotion: d.emotion || 'neutral' }))
    : [{ key: newKey(), speaker: 'Narrador', text: '', emotion: 'neutral' }];

// Campos en línea: sin el ancho completo de inputClass (lo fija cada uno).
const inlineField = inputClass.replace('w-full ', '');

const isHttp = (url: string) => /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('/');

export const SceneEditorModal = ({ scene, chapterTitle, storyContext, accent, saving, onSave, onClose }: SceneEditorModalProps) => {
  const [type, setType] = useState<SceneType>(scene?.type ?? 'INTRO');
  const [percent, setPercent] = useState(String(scene ? sceneTrigger(scene) ?? 50 : 50));
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | null>(scene?.mediaType ?? null);
  const [mediaUrl, setMediaUrl] = useState(scene?.mediaUrl ?? '');
  const [imageError, setImageError] = useState(false);
  const [dialogues, setDialogues] = useState<DraftDialogue[]>(() => toDraftDialogues(scene));
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState<'dialogues' | 'image' | 'full' | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const percentNumber = parseInt(percent, 10);
  const percentError = type === 'MILESTONE' && !(percentNumber >= 1 && percentNumber <= 100) ? 'Indica un porcentaje entre 1 y 100.' : null;
  const url = mediaUrl.trim();
  const urlError = mediaType && url && !isHttp(url) ? 'La URL debe empezar con http:// o https://' : null;
  const videoError = mediaType === 'VIDEO' && url && !youTubeId(url) ? 'No reconozco el enlace de YouTube.' : null;
  const filled = dialogues.filter((d) => d.text.trim());
  const valid = !percentError && !urlError && !videoError && (filled.length > 0 || (!!mediaType && !!url));

  const draft = (): SceneDraft => ({
    type,
    mediaType: mediaType && url ? mediaType : null,
    mediaUrl: mediaType && url ? url : null,
    triggerConfig: type === 'MILESTONE' ? { percentage: percentNumber } : null,
    dialogues: filled.map((d) => ({ speaker: d.speaker.trim() || undefined, text: d.text.trim(), emotion: d.emotion })),
  });

  const previewScene: StoryScene = {
    id: scene?.id ?? 'preview',
    chapterId: scene?.chapterId ?? 'preview',
    orderIndex: 0,
    type,
    mediaType: mediaType && url ? mediaType : null,
    mediaUrl: mediaType && url ? url : null,
    backgroundColor: null,
    triggerConfig: null,
    createdAt: '',
    dialogues: filled.map((d, i) => ({ id: d.key, sceneId: 'preview', orderIndex: i, text: d.text.trim(), speaker: d.speaker.trim() || null, emotion: d.emotion })),
  };

  const update = (key: string, patch: Partial<DraftDialogue>) =>
    setDialogues((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (index: number, delta: number) =>
    setDialogues((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const runAi = async (mode: 'dialogues' | 'image' | 'full') => {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(mode);
    const input = { description: aiText.trim(), sceneType: type, storyContext: `${storyContext} — ${chapterTitle}`.slice(0, 2000) };
    try {
      if (mode === 'image') {
        const result = await storyApi.generateAIImagePrompt(input);
        setImagePrompt(result.imagePrompt);
      } else {
        const result: { imagePrompt?: string; dialogues: Array<{ speaker: string; text: string; emotion: string }> } =
          mode === 'full' ? await storyApi.generateAIFullScene(input) : await storyApi.generateAIDialogues(input);
        if (result.imagePrompt) setImagePrompt(result.imagePrompt);
        if (result.dialogues?.length) {
          setDialogues(result.dialogues.map((d) => ({ key: newKey(), speaker: d.speaker ?? '', text: d.text ?? '', emotion: EMOTIONS[d.emotion] ? d.emotion : 'neutral' })));
          toast.success('Diálogos generados: revísalos antes de guardar');
        }
      }
    } catch (e) {
      toast.error(errorMessage(e, 'La IA no pudo generar la escena'));
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <>
      <HomeModal
        title={scene ? 'Editar escena' : 'Nueva escena'}
        subtitle={chapterTitle}
        onClose={onClose}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setPreviewing(true)} disabled={filled.length === 0 && !(mediaType && url)} className="mr-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700">
              <Eye size={16} aria-hidden="true" /> Vista previa
            </button>
            <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={() => valid && !saving && onSave(draft())} disabled={!valid || saving} className={primaryButton}>
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {scene ? 'Guardar escena' : 'Crear escena'}
            </button>
          </>
        }
      >
        {/* Tipo */}
        <fieldset>
          <legend className={labelClass}>Momento de la escena</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCENE_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                aria-pressed={type === key}
                data-autofocus={type === key ? true : undefined}
                className={`min-h-[44px] rounded-xl border-2 px-2 text-sm font-semibold ${
                  type === key
                    ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100'
                    : 'border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:text-gray-100'
                }`}
              >
                <span aria-hidden="true">{SCENE_TYPES[key].emoji}</span> {SCENE_TYPES[key].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{SCENE_TYPES[type].hint}</p>
          {type === 'MILESTONE' && (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="scene-percent" className="text-sm font-semibold text-gray-800 dark:text-gray-100">Se desbloquea al</label>
              <input id="scene-percent" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} className={`${inlineField} w-24`} aria-invalid={!!percentError} aria-describedby="scene-percent-error" />
              <span className="text-sm text-gray-800 dark:text-gray-100">% de la meta</span>
            </div>
          )}
          {percentError && <p id="scene-percent-error" className="mt-1 text-sm text-red-700 dark:text-red-300">{percentError}</p>}
        </fieldset>

        {/* Medio */}
        <fieldset>
          <legend className={labelClass}>Ilustración o video <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              [null, 'Ninguno', X],
              ['IMAGE', 'Imagen', ImageIcon],
              ['VIDEO', 'YouTube', Video],
            ] as const).map(([value, label, Icon]) => (
              <button key={label} type="button" onClick={() => { setMediaType(value); setImageError(false); }} aria-pressed={mediaType === value} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold ${mediaType === value ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-800 dark:border-gray-600 dark:text-gray-100'}`}>
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          {mediaType && (
            <div className="mt-2">
              <label htmlFor="scene-media" className="sr-only">{mediaType === 'VIDEO' ? 'Enlace de YouTube' : 'URL de la imagen'}</label>
              <input id="scene-media" value={mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); setImageError(false); }} maxLength={500} placeholder={mediaType === 'VIDEO' ? 'https://youtube.com/watch?v=…' : 'https://…/ilustracion.jpg'} className={inputClass} aria-invalid={!!(urlError || videoError)} aria-describedby="scene-media-help" />
              <p id="scene-media-help" className={`mt-1 text-sm ${urlError || videoError || imageError ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {urlError || videoError || (imageError ? 'No se pudo cargar la imagen desde esa URL.' : mediaType === 'IMAGE' ? 'Se muestra a pantalla completa detrás del diálogo.' : 'El video aparece sobre el diálogo.')}
              </p>
              {mediaType === 'IMAGE' && url && !urlError && !imageError && (
                <img src={url} alt="Vista previa de la ilustración" onError={() => setImageError(true)} className="mt-2 h-32 w-full rounded-xl object-cover" />
              )}
            </div>
          )}
        </fieldset>

        {/* Diálogos */}
        <fieldset>
          <legend className={labelClass}>Diálogos</legend>
          <ol className="mt-2 space-y-2">
            {dialogues.map((d, i) => (
              <li key={d.key} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`speaker-${d.key}`} className="sr-only">Personaje de la línea {i + 1}</label>
                  <input id={`speaker-${d.key}`} value={d.speaker} onChange={(e) => update(d.key, { speaker: e.target.value })} maxLength={100} placeholder="Personaje" className={`${inlineField} min-w-0 flex-1 sm:w-48 sm:flex-none`} />
                  <label htmlFor={`emotion-${d.key}`} className="sr-only">Emoción de la línea {i + 1}</label>
                  <select id={`emotion-${d.key}`} value={d.emotion} onChange={(e) => update(d.key, { emotion: e.target.value })} className={`${inlineField} w-auto`}>
                    {Object.entries(EMOTIONS).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.emoji} {meta.label}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700" aria-label={`Subir línea ${i + 1}`}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === dialogues.length - 1} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700" aria-label={`Bajar línea ${i + 1}`}>
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDialogues((list) => list.filter((x) => x.key !== d.key))} disabled={dialogues.length === 1} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-900/30" aria-label={`Quitar línea ${i + 1}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <label htmlFor={`text-${d.key}`} className="sr-only">Texto de la línea {i + 1}</label>
                <textarea id={`text-${d.key}`} value={d.text} onChange={(e) => update(d.key, { text: e.target.value })} maxLength={2000} rows={2} placeholder="¿Qué dice?" className={`${inputClass} mt-2 resize-y`} />
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setDialogues((list) => [...list, { key: newKey(), speaker: list[list.length - 1]?.speaker ?? '', text: '', emotion: 'neutral' }])} disabled={dialogues.length >= 50} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
            <MessageSquarePlus size={16} aria-hidden="true" /> Añadir línea
          </button>
        </fieldset>

        {/* Ayuda de IA */}
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/20">
          <button type="button" onClick={() => setAiOpen(!aiOpen)} aria-expanded={aiOpen} className="flex min-h-[40px] w-full items-center gap-2 text-sm font-bold text-violet-900 dark:text-violet-100">
            <Wand2 size={16} aria-hidden="true" /> Escribir con IA
          </button>
          {aiOpen && (
            <div className="mt-2 space-y-2">
              <label htmlFor="scene-ai" className="text-sm text-gray-800 dark:text-gray-100">Describe lo que pasa y la IA propone los diálogos (reemplazan los actuales).</label>
              <textarea id="scene-ai" value={aiText} onChange={(e) => setAiText(e.target.value)} maxLength={1000} rows={2} placeholder="Ej.: El grupo encuentra la brújula rota junto al río" className={`${inputClass} resize-none`} />
              <div className="flex flex-wrap gap-2">
                {([['dialogues', 'Diálogos'], ['image', 'Idea de imagen'], ['full', 'Todo']] as const).map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => runAi(mode)} disabled={!aiText.trim() || !!aiBusy} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
                    {aiBusy === mode && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} {label}
                  </button>
                ))}
              </div>
              {imagePrompt && (
                <div className="rounded-lg bg-white p-2 dark:bg-gray-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Prompt para tu generador de imágenes</p>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(imagePrompt); toast.success('Prompt copiado'); }} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
                      <Copy size={14} aria-hidden="true" /> Copiar
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{imagePrompt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </HomeModal>

      <AnimatePresence>
        {previewing && (
          <StoryPlayer items={[sceneItem(previewScene)]} accent={accent} label="Vista previa de la escena" onClose={() => setPreviewing(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
