import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { storyApi, type ThemeConfig, type ThemePreset } from '../../lib/storyApi';
import type { Classroom } from '../../lib/classroomApi';
import { parseThemeConfig } from '../../lib/storyTheme';
import { useStoryParticles } from '../../hooks/useStoryParticles';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { ThemePreview, ThemeSwatch } from './ThemeSwatch';
import { classroomKey, errorMessage } from './storyEditorHelpers';
import { showUndoToast } from './undoToast';

interface ThemePanelProps {
  classroom: Classroom;
  presets: ThemePreset[];
  activeStoryTitle: string | null;
  onClose: () => void;
}

type Pending = { theme: ThemeConfig | null; source: 'PRESET' | 'AI' | 'DEFAULT'; name: string; key: string };

const AI_IDEAS = ['Piratas en alta mar', 'Selva tropical', 'Galaxia lejana', 'Reino medieval', 'Laboratorio secreto'];

const presetTheme = (preset: ThemePreset): ThemeConfig => ({
  colors: preset.colors,
  particles: preset.particles,
  decorations: preset.decorations,
  banner: preset.banner,
});

// Tema del aula independiente de la historia: se previsualiza antes de aplicarlo y se puede deshacer.
export const ThemePanel = ({ classroom, presets, activeStoryTitle, onClose }: ThemePanelProps) => {
  const queryClient = useQueryClient();
  const current = parseThemeConfig(classroom.themeConfig);
  const [pending, setPending] = useState<Pending | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [particles, setParticles] = useStoryParticles('teacher');

  const refresh = () => queryClient.invalidateQueries({ queryKey: classroomKey(classroom.id) });

  const generate = async () => {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const result = await storyApi.generateAIThemePreview(aiText.trim());
      setPending({ theme: result.themeConfig, source: 'AI', name: result.name, key: 'ai' });
    } catch (e) {
      toast.error(errorMessage(e, 'La IA no pudo crear el tema'));
    } finally {
      setAiBusy(false);
    }
  };

  const apply = async () => {
    if (!pending || saving) return;
    setSaving(true);
    const previous = current;
    const previousSource = classroom.themeSource || 'DEFAULT';
    try {
      if (pending.theme) await storyApi.updateClassroomTheme(classroom.id, pending.theme, pending.source);
      else await storyApi.resetTheme(classroom.id);
      await refresh();
      onClose();
      showUndoToast(
        pending.theme ? `Tema «${pending.name}» aplicado` : 'Tema quitado',
        () => (previous ? storyApi.updateClassroomTheme(classroom.id, previous, previousSource) : storyApi.resetTheme(classroom.id)),
        () => void refresh(),
      );
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo aplicar el tema'));
    } finally {
      setSaving(false);
    }
  };

  const shown = pending ? pending.theme : current;

  return (
    <HomeModal
      title="Tema del aula"
      subtitle="Colorea la barra lateral, la cabecera y los banners. El contenido siempre se mantiene legible."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cerrar</button>
          <button type="button" onClick={apply} disabled={!pending || saving} className={primaryButton}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {pending ? (pending.theme ? `Aplicar «${pending.name}»` : 'Quitar tema') : 'Elige un tema'}
          </button>
        </>
      }
    >
      <div>
        <p className={labelClass}>{pending ? 'Vista previa' : 'Tema actual'}</p>
        <div className="mt-2">
          <ThemePreview theme={shown} title={classroom.name} />
        </div>
        {activeStoryTitle && classroom.themeSource === 'STORY' && (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Ahora se usa el tema de la historia «{activeStoryTitle}». Si eliges otro, lo reemplaza hasta que vuelvas a activarla.</p>
        )}
      </div>

      <fieldset>
        <legend className={labelClass}>Temas listos</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((preset) => (
            <ThemeSwatch
              key={preset.key}
              theme={presetTheme(preset)}
              name={preset.name}
              selected={pending?.key === preset.key}
              onSelect={() => setPending({ theme: presetTheme(preset), source: 'PRESET', name: preset.name, key: preset.key })}
            />
          ))}
          <ThemeSwatch theme={null} name="Sin tema" selected={pending?.key === 'none'} onSelect={() => setPending({ theme: null, source: 'DEFAULT', name: 'Sin tema', key: 'none' })} />
        </div>
      </fieldset>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/20">
        <label htmlFor="theme-ai" className="flex items-center gap-2 text-sm font-bold text-violet-900 dark:text-violet-100">
          <Wand2 size={16} aria-hidden="true" /> Crear un tema con IA
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="theme-ai" value={aiText} onChange={(e) => setAiText(e.target.value)} maxLength={500} placeholder="Describe el ambiente: época, lugar, colores…" className={`${inputClass} flex-1`} onKeyDown={(e) => e.key === 'Enter' && generate()} />
          <button type="button" onClick={generate} disabled={!aiText.trim() || aiBusy} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50">
            {aiBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} Crear
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AI_IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setAiText(idea)} className="min-h-[36px] rounded-full border border-violet-300 bg-white px-3 text-sm text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-gray-800 dark:text-violet-100 dark:hover:bg-violet-900/40">
              {idea}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">La IA solo propone: verás la vista previa antes de aplicarlo.</p>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 dark:border-gray-700">
        <span>
          <span className="block text-sm font-semibold text-gray-900 dark:text-white">Partículas en tus vistas</span>
          <span className="block text-sm text-gray-700 dark:text-gray-300">Los alumnos las ven suaves; tú puedes encenderlas en este dispositivo.</span>
        </span>
        <input type="checkbox" role="switch" checked={particles} onChange={(e) => setParticles(e.target.checked)} className="h-5 w-5 flex-shrink-0 accent-primary-600" />
      </label>
    </HomeModal>
  );
};
