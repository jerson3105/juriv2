import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CheckCircle2, Sparkles } from 'lucide-react';
import { collectibleApi, type AlbumWithCards } from '../../lib/collectibleApi';
import { CollectibleCardView } from './CollectibleCardView';

interface ProgressViewProps {
  album: AlbumWithCards;
  classroomId: string;
  nameOf: (studentId: string, fallback: string) => string;
  onBack: () => void;
  onBrowseStudent: (studentId: string, owned: Map<string, { hasNormal: boolean; hasShiny: boolean }>, name: string) => void;
}

type Filter = 'all' | 'none' | 'almost' | 'done';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'almost', label: 'A punto (75%+)' },
  { value: 'done', label: 'Completados' },
  { value: 'none', label: 'Sin figuritas' },
];

export const ProgressView = ({ album, classroomId, nameOf, onBack, onBrowseStudent }: ProgressViewProps) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: progress, isLoading } = useQuery({
    queryKey: ['collectible-progress', classroomId, album.id],
    queryFn: () => collectibleApi.getClassroomProgress(classroomId, album.id),
  });
  const { data: collection, isLoading: loadingCollection } = useQuery({
    queryKey: ['collectible-progress-student-detail', album.id, selectedId],
    queryFn: () => collectibleApi.getStudentCollection(album.id, selectedId!),
    enabled: !!selectedId,
  });

  const students = useMemo(() => (progress?.students ?? []).filter((s) => {
    if (filter === 'none') return s.uniqueCollected === 0;
    if (filter === 'almost') return !s.isCompleted && s.progress >= 75;
    if (filter === 'done') return s.isCompleted;
    return true;
  }), [progress, filter]);
  const withCards = (progress?.students ?? []).filter((s) => s.uniqueCollected > 0).length;
  const total = album.cards.length;

  const owned = useMemo(() => {
    const map = new Map<string, { hasNormal: boolean; hasShiny: boolean }>();
    for (const card of collection?.cards ?? []) map.set(card.id, { hasNormal: card.hasNormal, hasShiny: card.hasShiny });
    return map;
  }, [collection]);
  const selected = progress?.students.find((s) => s.studentId === selectedId) ?? null;
  const selectedName = selected ? nameOf(selected.studentId, selected.studentName) : '';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Volver al álbum" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Progreso · {album.name}</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">Quién colecciona y a quién le faltan figuritas</p>
        </div>
      </div>

      {isLoading || !progress ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Promedio', value: `${progress.averageProgress.toFixed(0)}%` },
              { label: 'Completaron', value: `${progress.completedCount}` },
              { label: 'Coleccionan', value: `${withCards} de ${progress.totalStudents}` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800 w-fit" role="group" aria-label="Filtrar estudiantes">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value} className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${filter === f.value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
              {students.length === 0 && <li className="p-6 text-center text-sm text-gray-700 dark:text-gray-300">Nadie en este filtro.</li>}
              {students.map((s) => {
                const rank = (progress.students.indexOf(s) ?? 0) + 1;
                const isSelected = s.studentId === selectedId;
                return (
                  <li key={s.studentId}>
                    <button type="button" onClick={() => setSelectedId(s.studentId)} aria-pressed={isSelected} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${rank <= 3 && s.uniqueCollected > 0 ? 'bg-amber-400 text-amber-950' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>{rank}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-gray-900 dark:text-white">{nameOf(s.studentId, s.studentName)}</span>
                          {s.isCompleted && <CheckCircle2 size={16} className="flex-shrink-0 text-green-700 dark:text-green-300" aria-label="Completado" />}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                            <span className={`block h-full rounded-full ${s.isCompleted ? 'bg-green-600' : 'bg-primary-600'}`} style={{ width: `${s.progress}%` }} />
                          </span>
                          <span className="w-14 text-right text-sm font-bold text-gray-800 dark:text-gray-100">{s.uniqueCollected}/{total}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="self-start rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 xl:sticky xl:top-4">
              {!selected ? (
                <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">Elige un estudiante para ver su álbum.</p>
              ) : loadingCollection || !collection ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedName}</p>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        {collection.uniqueCollected} de {collection.totalCards}
                        <span className="inline-flex items-center gap-1"><Sparkles size={14} aria-hidden="true" />{collection.cards.filter((c) => c.hasShiny).length} brillantes</span>
                      </p>
                    </div>
                    <button type="button" onClick={() => onBrowseStudent(selected.studentId, owned, selectedName)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-bold text-white hover:bg-primary-700">
                      <BookOpen size={16} aria-hidden="true" />
                      Hojear su álbum
                    </button>
                  </div>
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4 2xl:grid-cols-5">
                    {[...collection.cards].sort((a, b) => a.slotNumber - b.slotNumber).map((card) => (
                      <li key={card.id}>
                        <CollectibleCardView card={card} size="sm" missing={!card.hasNormal && !card.hasShiny} shiny={card.hasShiny} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
