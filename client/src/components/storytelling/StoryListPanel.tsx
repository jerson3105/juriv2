import { Plus } from 'lucide-react';
import type { StoryListItem } from '../../lib/storyApi';
import { accentGradient, deriveStoryAccent } from '../../lib/storyTheme';
import { plural } from './storyEditorHelpers';

interface StoryListPanelProps {
  stories: StoryListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

// Columna maestra: la historia en curso primero, luego los borradores.
export const StoryListPanel = ({ stories, selectedId, onSelect, onCreate }: StoryListPanelProps) => (
  <nav aria-label="Historias de la clase" className="space-y-2">
    <ul className="space-y-2">
      {stories.map((story) => {
        const accent = deriveStoryAccent(story.themeConfig);
        const selected = story.id === selectedId;
        return (
          <li key={story.id}>
            <button
              type="button"
              onClick={() => onSelect(story.id)}
              aria-current={selected ? 'true' : undefined}
              className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left transition-shadow hover:shadow-md dark:bg-gray-800 ${
                selected ? 'border-primary-600 shadow-md dark:border-primary-400' : 'border-transparent shadow-sm'
              }`}
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: accent ? accentGradient(accent) : 'linear-gradient(135deg, #4338ca, #6d28d9)' }} aria-hidden="true">
                {accent?.emoji ?? '📖'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-gray-900 dark:text-white">{story.title}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">
                  {plural(story.chapterCount, 'capítulo', 'capítulos')} · {story.completedChapters} completado{story.completedChapters === 1 ? '' : 's'}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {story.isActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">En curso</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100">Borrador</span>
                  )}
                  {story.isActive && story.readyToReveal > 0 && (
                    <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-amber-950">Final listo</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    <button type="button" onClick={onCreate} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-800 hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-100 dark:hover:text-primary-300">
      <Plus size={16} aria-hidden="true" /> Nueva historia
    </button>
  </nav>
);
