import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Story, StoryChapter, StoryRewardConfig, ThemeConfig, ThemePreset } from '../../lib/storyApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { ThemePreview, ThemeSwatch } from './ThemeSwatch';
import { RewardFields } from './RewardFields';
import { COMPLETION_TYPES, chapterConfig, chapterReward, type CompletionType } from './storyEditorHelpers';

const presetTheme = (preset: ThemePreset): ThemeConfig => ({
  colors: preset.colors,
  particles: preset.particles,
  decorations: preset.decorations,
  banner: preset.banner,
});

const sameTheme = (a: ThemeConfig | null | undefined, b: ThemeConfig | null | undefined) =>
  !!a && !!b && a.colors?.primary === b.colors?.primary && a.banner?.emoji === b.banner?.emoji;

// ---------- Historia ----------

interface StoryFormModalProps {
  story?: Story | null;
  presets: ThemePreset[];
  saving: boolean;
  onSubmit: (data: { title: string; description?: string; aiBible?: string; themeConfig?: ThemeConfig | null }) => void;
  onClose: () => void;
}

export const StoryFormModal = ({ story, presets, saving, onSubmit, onClose }: StoryFormModalProps) => {
  const [title, setTitle] = useState(story?.title ?? '');
  const [description, setDescription] = useState(story?.description ?? '');
  const [aiBible, setAiBible] = useState(story?.aiBible ?? '');
  const initialTheme = story?.themeConfig ?? null;
  const [theme, setTheme] = useState<ThemeConfig | null>(initialTheme);
  // Un tema propio (p. ej. de IA) que no es ningún preset se conserva como opción "Tema actual".
  const customCurrent = useMemo(
    () => (initialTheme && !presets.some((p) => sameTheme(presetTheme(p), initialTheme)) ? initialTheme : null),
    [initialTheme, presets],
  );
  const valid = title.trim().length > 0;

  const submit = () => {
    if (!valid || saving) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      aiBible: aiBible.trim() || (story ? '' : undefined),
      // Al editar, "Sin tema" se envía como null para quitarlo.
      themeConfig: theme ?? (story ? null : undefined),
    });
  };

  return (
    <HomeModal
      title={story ? 'Editar historia' : 'Nueva historia'}
      subtitle="El tema se aplica a la clase cuando activas la historia."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={primaryButton}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {story ? 'Guardar cambios' : 'Crear historia'}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="story-title" className={labelClass}>Título</label>
        <input id="story-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="Ej.: La expedición perdida" className={`${inputClass} mt-1`} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>
      <div>
        <label htmlFor="story-description" className={labelClass}>Premisa <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
        <textarea id="story-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} placeholder="¿De qué trata la aventura? Los alumnos la verán al inicio." className={`${inputClass} mt-1 resize-none`} />
      </div>
      <div>
        <label htmlFor="story-bible" className={labelClass}>Biblia para la IA <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
        <textarea id="story-bible" value={aiBible} onChange={(e) => setAiBible(e.target.value)} maxLength={4000} rows={3} placeholder="Personajes, lugares, tono y reglas del mundo. La IA coautora lo usa para mantener la historia coherente." className={`${inputClass} mt-1 resize-y`} />
      </div>
      <fieldset>
        <legend className={labelClass}>Tema visual</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {customCurrent && (
            <ThemeSwatch theme={customCurrent} name={customCurrent.banner?.title || 'Tema actual'} selected={sameTheme(theme, customCurrent)} onSelect={() => setTheme(customCurrent)} />
          )}
          {presets.map((preset) => (
            <ThemeSwatch key={preset.key} theme={presetTheme(preset)} name={preset.name} selected={sameTheme(theme, presetTheme(preset))} onSelect={() => setTheme(presetTheme(preset))} />
          ))}
          <ThemeSwatch theme={null} name="Sin tema" selected={!theme} onSelect={() => setTheme(null)} />
        </div>
        <div className="mt-3">
          <ThemePreview theme={theme} title={title.trim() || 'Tu historia'} />
        </div>
      </fieldset>
    </HomeModal>
  );
};

// ---------- Capítulo ----------

interface ChapterFormModalProps {
  chapter?: StoryChapter | null;
  position: number;
  classroomId: string;
  clansEnabled: boolean;
  saving: boolean;
  onSubmit: (data: {
    title: string;
    description?: string;
    completionType?: CompletionType;
    completionConfig?: { targetXp?: number; donationPercent?: number };
    rewardConfig?: StoryRewardConfig | null;
  }) => void;
  onClose: () => void;
}

export const ChapterFormModal = ({ chapter, position, classroomId, clansEnabled, saving, onSubmit, onClose }: ChapterFormModalProps) => {
  const config = chapter ? chapterConfig(chapter) : {};
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [description, setDescription] = useState(chapter?.description ?? '');
  const [type, setType] = useState<CompletionType>(chapter?.completionType ?? 'XP_GOAL');
  const [target, setTarget] = useState(config.targetXp ? String(config.targetXp) : '');
  const [percent, setPercent] = useState(config.donationPercent ? String(config.donationPercent) : '10');
  const [reward, setReward] = useState<StoryRewardConfig>(() => chapterReward(chapter) ?? { clanPrize: { mode: 'MENTION' } });
  const locked = chapter?.status === 'COMPLETED';

  const needsTarget = type !== 'BIMESTER';
  const targetNumber = parseInt(target, 10);
  const percentNumber = parseInt(percent, 10);
  const targetError = needsTarget && !(targetNumber >= 1) ? 'Indica una meta de al menos 1 XP.' : null;
  const percentError = type === 'DONATION' && !(percentNumber >= 1 && percentNumber <= 100) ? 'Entre 1 y 100.' : null;
  const valid = title.trim().length > 0 && (locked || (!targetError && !percentError));

  const submit = () => {
    if (!valid || saving) return;
    if (locked) {
      onSubmit({ title: title.trim(), description: description.trim() });
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim() || (chapter ? '' : undefined),
      completionType: type,
      completionConfig: type === 'XP_GOAL'
        ? { targetXp: targetNumber }
        : type === 'DONATION'
          ? { targetXp: targetNumber, donationPercent: percentNumber }
          : undefined,
      rewardConfig: reward,
    });
  };

  return (
    <HomeModal
      title={chapter ? `Editar capítulo ${position}` : `Nuevo capítulo ${position}`}
      subtitle={chapter?.status === 'ACTIVE' ? 'Está en curso: si cambias la condición a Meta de XP, la cuenta empieza de nuevo.' : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={primaryButton}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {chapter ? 'Guardar cambios' : 'Crear capítulo'}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="chapter-title" className={labelClass}>Título</label>
        <input id="chapter-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="Ej.: El mapa roto" className={`${inputClass} mt-1`} />
      </div>
      <div>
        <label htmlFor="chapter-description" className={labelClass}>Portada <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
        <textarea id="chapter-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} placeholder="Una frase que aparece en la portada del capítulo." className={`${inputClass} mt-1 resize-none`} />
      </div>
      <fieldset disabled={locked}>
        <legend className={labelClass}>¿Cuándo se puede revelar el final?</legend>
        {locked && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">El capítulo ya terminó: su condición no cambia.</p>}
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(COMPLETION_TYPES) as CompletionType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={type === key}
              className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                type === key
                  ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100'
                  : 'border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:text-gray-100'
              }`}
            >
              <span aria-hidden="true">{COMPLETION_TYPES[key].emoji}</span> {COMPLETION_TYPES[key].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{COMPLETION_TYPES[type].hint}</p>
        {needsTarget && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="chapter-target" className={labelClass}>Meta (XP)</label>
              <input id="chapter-target" type="number" min={1} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ej.: 1500" className={`${inputClass} mt-1`} aria-invalid={!!targetError && target !== ''} aria-describedby="chapter-target-error" />
              {targetError && target !== '' && <p id="chapter-target-error" className="mt-1 text-sm text-red-700 dark:text-red-300">{targetError}</p>}
            </div>
            {type === 'DONATION' && (
              <div>
                <label htmlFor="chapter-percent" className={labelClass}>% de cada XP que se dona</label>
                <input id="chapter-percent" type="number" min={1} max={100} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} className={`${inputClass} mt-1`} aria-invalid={!!percentError} aria-describedby="chapter-percent-error" />
                {percentError && <p id="chapter-percent-error" className="mt-1 text-sm text-red-700 dark:text-red-300">{percentError}</p>}
              </div>
            )}
          </div>
        )}
      </fieldset>
      <RewardFields classroomId={classroomId} clansEnabled={clansEnabled} value={reward} disabled={locked} onChange={setReward} />
    </HomeModal>
  );
};
