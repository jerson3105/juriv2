import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Lock,
  CheckCircle2,
  Sparkles,
  Clock,
  Target,
  Heart,
  Film,
  Image,
  MessageSquare,
  Palette,
  Eye,
  Wand2,
  Loader2,
} from 'lucide-react';
import { storyApi, type Story, type StoryListItem, type StoryChapter, type StoryScene, type ThemeConfig, type ThemePreset } from '../../lib/storyApi';
import { type Classroom } from '../../lib/classroomApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { SceneCinematic } from '../../components/story/SceneCinematic';
import toast from 'react-hot-toast';

// ==================== MAIN PAGE ====================

export const StorytellingPage = () => {
  const { classroom, isThemeDark } = useOutletContext<{ classroom: Classroom, storyTheme?: any, isThemeDark?: boolean }>();
  const queryClient = useQueryClient();

  const [showCreateStory, setShowCreateStory] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [aiThemePrompt, setAiThemePrompt] = useState('');
  const [showAIThemeInput, setShowAIThemeInput] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [previewScene, setPreviewScene] = useState<StoryScene | null>(null);

  // Queries
  const { data: storiesList, isLoading } = useQuery({
    queryKey: ['stories', classroom?.id],
    queryFn: () => storyApi.getClassroomStories(classroom.id),
    enabled: !!classroom?.id,
  });

  const { data: presets } = useQuery({
    queryKey: ['theme-presets'],
    queryFn: () => storyApi.getPresets(),
  });

  // Mutations
  const createStoryMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; themeConfig?: ThemeConfig }) =>
      storyApi.createStory(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', classroom.id] });
      setShowCreateStory(false);
      toast.success('Historia creada');
    },
    onError: () => toast.error('Error al crear historia'),
  });

  const updateStoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => storyApi.updateStory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['story-detail'] });
      setEditingStory(null);
      toast.success('Historia actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const activateMutation = useMutation({
    mutationFn: (storyId: string) => storyApi.activateStory(storyId, classroom.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-theme', classroom.id] });
      toast.success('Historia activada');
    },
    onError: () => toast.error('Error al activar'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (storyId: string) => storyApi.deactivateStory(storyId, classroom.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom-theme', classroom.id] });
      toast.success('Historia desactivada');
    },
    onError: () => toast.error('Error al desactivar'),
  });

  const deleteStoryMutation = useMutation({
    mutationFn: (id: string) => storyApi.deleteStory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', classroom.id] });
      toast.success('Historia eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  // Theme mutations
  const applyPresetMutation = useMutation({
    mutationFn: (presetKey: string) => storyApi.applyPreset(classroom.id, presetKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-theme', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Tema aplicado');
    },
    onError: () => toast.error('Error al aplicar tema'),
  });

  const resetThemeMutation = useMutation({
    mutationFn: () => storyApi.resetTheme(classroom.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-theme', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Tema reseteado');
    },
    onError: () => toast.error('Error al resetear tema'),
  });

  const generateAIThemeMutation = useMutation({
    mutationFn: (description: string) => storyApi.generateAITheme(classroom.id, description),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-theme', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success(`Tema "${data.name}" generado y aplicado`);
      setAiThemePrompt('');
      setShowAIThemeInput(false);
    },
    onError: () => toast.error('Error al generar tema con IA'),
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'story') {
      deleteStoryMutation.mutate(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30 flex-shrink-0">
            <BookOpen size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Historia de clase
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Crea historias interactivas para tu clase con temas visuales y capítulos
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            onClick={() => setShowThemePanel(!showThemePanel)}
            className="flex-1 sm:flex-none flex items-center gap-2"
          >
            <Palette size={16} />
            Temas
          </Button>
          <Button onClick={() => setShowCreateStory(true)} className="flex-1 sm:flex-none flex items-center gap-2">
            <Plus size={16} />
            Nueva Historia
          </Button>
        </div>
      </div>

      {/* Theme Presets Panel */}
      <AnimatePresence>
        {showThemePanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="overflow-hidden border-0 shadow-lg">
              {/* Panel Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <Palette className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-base">Temas del Aula</h3>
                      <p className="text-white/70 text-[11px] sm:text-xs hidden sm:block">
                        Aplica un tema visual. Los colores, partículas y decoraciones cambiarán la interfaz.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowThemePanel(false)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-5">
                {/* Preset Cards */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Temas predefinidos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {presets?.map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => applyPresetMutation.mutate(preset.key)}
                        disabled={applyPresetMutation.isPending}
                        className="group relative p-3 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all hover:shadow-lg hover:-translate-y-0.5 bg-white dark:bg-gray-800"
                      >
                        <div
                          className="w-full aspect-[4/3] rounded-xl mb-2.5 flex items-center justify-center text-3xl shadow-inner relative overflow-hidden"
                          style={{
                            background: `linear-gradient(135deg, ${preset.colors?.primary || '#6366f1'}, ${preset.colors?.secondary || '#8b5cf6'})`,
                          }}
                        >
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          <span className="relative drop-shadow-md group-hover:scale-110 transition-transform">{preset.banner?.emoji || '🎨'}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center truncate">
                          {preset.name}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => resetThemeMutation.mutate()}
                      disabled={resetThemeMutation.isPending}
                      className="group p-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 transition-all hover:shadow-lg hover:-translate-y-0.5 bg-white dark:bg-gray-800"
                    >
                      <div className="w-full aspect-[4/3] rounded-xl mb-2.5 flex items-center justify-center text-3xl bg-gray-50 dark:bg-gray-700">
                        <span className="group-hover:scale-110 transition-transform">🚫</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">
                        Sin tema
                      </p>
                    </button>
                  </div>
                </div>

                {/* AI Theme Generation */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
                        <Wand2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crear con IA</span>
                    </div>
                    {!showAIThemeInput && (
                      <button
                        onClick={() => setShowAIThemeInput(true)}
                        className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                      >
                        + Generar tema personalizado
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showAIThemeInput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`rounded-2xl p-4 border ${isThemeDark ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.35)]' : 'bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/10 dark:to-fuchsia-900/10 border-violet-200 dark:border-violet-800'}`}>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Describe el tema que quieres y la IA lo creará. Ej: <span className="italic text-violet-600 dark:text-violet-400">"Un tema de piratas con colores oscuros y partículas de estrellas"</span>
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={aiThemePrompt}
                              onChange={(e) => setAiThemePrompt(e.target.value)}
                              placeholder="Describe tu tema ideal..."
                              className={`flex-1 px-4 py-2.5 border-2 rounded-xl text-sm focus:ring-0 transition-colors ${isThemeDark ? 'border-[rgba(139,92,246,0.4)] bg-[rgba(255,255,255,0.08)] text-white placeholder-white/40' : 'border-violet-200 dark:border-violet-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400'} focus:border-violet-500`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && aiThemePrompt.trim() && !generateAIThemeMutation.isPending) {
                                  generateAIThemeMutation.mutate(aiThemePrompt.trim());
                                }
                              }}
                              disabled={generateAIThemeMutation.isPending}
                            />
                            <button
                              onClick={() => {
                                if (aiThemePrompt.trim()) generateAIThemeMutation.mutate(aiThemePrompt.trim());
                              }}
                              disabled={!aiThemePrompt.trim() || generateAIThemeMutation.isPending}
                              className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                            >
                              {generateAIThemeMutation.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                              ) : (
                                <><Wand2 className="w-4 h-4" /> Generar</>
                              )}
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-wrap gap-1.5">
                              {['Piratas 🏴‍☠️', 'Selva tropical 🌴', 'Galaxia lejana 🌌', 'Medieval 🏰', 'Volcán 🌋'].map((suggestion) => (
                                <button
                                  key={suggestion}
                                  onClick={() => setAiThemePrompt(suggestion)}
                                  className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${isThemeDark ? 'bg-[rgba(255,255,255,0.1)] text-white border-[rgba(139,92,246,0.4)] hover:bg-[rgba(139,92,246,0.3)]' : 'bg-white/80 dark:bg-gray-800/80 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30'}`}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => { setShowAIThemeInput(false); setAiThemePrompt(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2 flex-shrink-0"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stories List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : !storiesList || storiesList.length === 0 ? (
        <Card className={`p-8 sm:p-12 text-center border-dashed border-2 ${isThemeDark ? 'bg-[rgba(var(--story-primary-rgb),0.12)] border-[rgba(var(--story-primary-rgb),0.4)]' : 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border-purple-200 dark:border-purple-800'}`}>
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isThemeDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            No hay historias creadas
          </h3>
          <p className={`mb-6 max-w-sm mx-auto ${isThemeDark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
            Crea tu primera historia para darle vida a tu clase con narrativas interactivas
          </p>
          <Button onClick={() => setShowCreateStory(true)} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/25">
            <Plus size={16} className="mr-2" />
            Crear Historia
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {storiesList.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              classroomId={classroom.id}
              isExpanded={expandedStory === story.id}
              onToggle={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
              onEdit={() => setEditingStory(story as any)}
              onActivate={() => activateMutation.mutate(story.id)}
              onDeactivate={() => deactivateMutation.mutate(story.id)}
              onDelete={() => setDeleteTarget({ type: 'story', id: story.id, name: story.title })}
              onPreviewScene={(scene) => setPreviewScene(scene)}
              isThemeDark={isThemeDark}
            />
          ))}
        </div>
      )}

      {/* Create Story Modal */}
      <AnimatePresence>
        {showCreateStory && (
          <StoryFormModal
            onSubmit={(data) => createStoryMutation.mutate(data)}
            onClose={() => setShowCreateStory(false)}
            isLoading={createStoryMutation.isPending}
            presets={presets || []}
          />
        )}
      </AnimatePresence>

      {/* Edit Story Modal */}
      <AnimatePresence>
        {editingStory && (
          <StoryFormModal
            story={editingStory}
            onSubmit={(data) => updateStoryMutation.mutate({ id: editingStory.id, data })}
            onClose={() => setEditingStory(null)}
            isLoading={updateStoryMutation.isPending}
            presets={presets || []}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title={`Eliminar ${deleteTarget.type === 'story' ? 'historia' : 'elemento'}`}
          message={`¿Estás seguro de eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          confirmText="Eliminar"
          variant="danger"
        />
      )}

      {/* Scene Preview */}
      <AnimatePresence>
        {previewScene && (
          <SceneCinematic
            scene={previewScene}
            onComplete={() => setPreviewScene(null)}
            onClose={() => setPreviewScene(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== STORY CARD ====================

interface StoryCardProps {
  story: StoryListItem;
  classroomId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onPreviewScene: (scene: StoryScene) => void;
  isThemeDark?: boolean;
}

const StoryCard = ({ story, classroomId, isExpanded, onToggle, onEdit, onActivate, onDeactivate, onDelete, onPreviewScene, isThemeDark }: StoryCardProps) => {

  // Fetch full story when expanded
  const { data: fullStory } = useQuery({
    queryKey: ['story-detail', story.id],
    queryFn: () => storyApi.getStory(story.id),
    enabled: isExpanded,
  });

  return (
    <Card className={`overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg ${
      story.isActive ? 'ring-2 ring-purple-400/50 dark:ring-purple-500/30' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-md flex-shrink-0 ${
            story.isActive
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            <span className={story.isActive ? 'drop-shadow-sm' : ''}>{story.themeConfig?.banner?.emoji || '📖'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{story.title}</h3>
              {story.isActive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  ACTIVA
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {story.chapterCount} capítulo{story.chapterCount !== 1 ? 's' : ''} · {story.completedChapters} completado{story.completedChapters !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {story.isActive ? (
            <button onClick={(e) => { e.stopPropagation(); onDeactivate(); }} className="p-2 rounded-xl text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" title="Desactivar">
              <Pause size={16} />
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onActivate(); }} className="p-2 rounded-xl text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Activar">
              <Play size={16} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar">
            <Edit2 size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
            <Trash2 size={16} />
          </button>
          <div className="ml-1">
            {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded content: chapters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
              {story.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{story.description}</p>
              )}

              {/* Chapters */}
              {fullStory?.chapters && fullStory.chapters.length > 0 ? (
                <div className="space-y-2">
                  {fullStory.chapters.map((chapter) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      storyId={story.id}
                      storyTitle={story.title}
                      classroomId={classroomId}
                      onPreviewScene={onPreviewScene}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No hay capítulos aún</p>
              )}

              {/* Add chapter button */}
              <AddChapterForm storyId={story.id} classroomId={classroomId} isThemeDark={isThemeDark} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// ==================== CHAPTER ROW ====================

interface ChapterRowProps {
  chapter: StoryChapter;
  storyId: string;
  storyTitle?: string;
  classroomId: string;
  onPreviewScene: (scene: StoryScene) => void;
}

const ChapterRow = ({ chapter, storyId, storyTitle, classroomId, onPreviewScene }: ChapterRowProps) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showAddScene, setShowAddScene] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isStoryDark, setIsStoryDark] = useState(false);
  useEffect(() => { if (rowRef.current) setIsStoryDark(!!rowRef.current.closest('.story-theme-dark')); }, []);

  const completeMutation = useMutation({
    mutationFn: () => storyApi.completeChapter(chapter.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories', classroomId] });
      toast.success('Capítulo completado');
    },
    onError: () => toast.error('Error al completar'),
  });

  const deleteChapterMutation = useMutation({
    mutationFn: () => storyApi.deleteChapter(chapter.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories', classroomId] });
      toast.success('Capítulo eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const statusIcon = chapter.status === 'COMPLETED' ? <CheckCircle2 size={16} className="text-green-500" /> :
    chapter.status === 'ACTIVE' ? <Sparkles size={16} className="text-purple-500" /> :
    <Lock size={16} className="text-gray-400" />;

  const completionLabel = chapter.completionType === 'BIMESTER' ? 'Bimestre' :
    chapter.completionType === 'XP_GOAL' ? 'Meta XP' : 'Donación';

  const completionIcon = chapter.completionType === 'BIMESTER' ? <Clock size={12} /> :
    chapter.completionType === 'XP_GOAL' ? <Target size={12} /> : <Heart size={12} />;

  // Safe parse completionConfig (MySQL may return JSON as string)
  const parsedConfig = (() => {
    const raw = chapter.completionConfig;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();

  const progress = parseFloat(chapter.currentProgress as any) || 0;
  const target = parsedConfig?.targetXp || 0;
  const progressPercent = target > 0 ? Math.min((progress / target) * 100, 100) : 0;

  return (
    <div ref={rowRef} className={`rounded-lg overflow-hidden ${isStoryDark ? 'border border-white/10' : 'border border-gray-100 dark:border-gray-700'}`}>
      {/* Chapter header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer ${isStoryDark ? 'hover:bg-white/5' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className={`text-sm font-medium truncate ${isStoryDark ? 'text-white/90' : 'text-gray-800 dark:text-gray-200'}`}>
            Cap. {chapter.orderIndex + 1}: {chapter.title}
          </span>
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${isStoryDark ? 'bg-white/10 text-white/60' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {completionIcon} {completionLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isStoryDark ? 'text-white/40' : 'text-gray-400'}`}>{chapter.scenes?.length || 0} escenas</span>
          {expanded ? <ChevronDown size={14} className={isStoryDark ? 'text-white/40' : 'text-gray-400'} /> : <ChevronRight size={14} className={isStoryDark ? 'text-white/40' : 'text-gray-400'} />}
        </div>
      </div>

      {/* Progress bar (shown below header when chapter is active with a target) */}
      {chapter.status === 'ACTIVE' && target > 0 && (
        <div className="px-3 pb-2.5 -mt-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {Math.round(progress)} / {target} XP ({progressPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`px-3 py-3 space-y-2 ${isStoryDark ? 'border-t border-white/10 bg-white/5' : 'border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'}`}>
              {chapter.description && (
                <p className={`text-xs mb-2 ${isStoryDark ? 'text-white/50' : 'text-gray-500 dark:text-gray-400'}`}>{chapter.description}</p>
              )}

              {/* Scenes */}
              {chapter.scenes && chapter.scenes.length > 0 ? (
                chapter.scenes.map((scene) => (
                  <SceneRow key={scene.id} scene={scene} storyId={storyId} onPreview={() => onPreviewScene(scene)} />
                ))
              ) : (
                <p className={`text-xs text-center py-2 ${isStoryDark ? 'text-white/30' : 'text-gray-400'}`}>No hay escenas</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowAddScene(!showAddScene)}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Añadir escena
                </button>
                {chapter.status === 'ACTIVE' && (
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Completar
                  </button>
                )}
                <button
                  onClick={() => deleteChapterMutation.mutate()}
                  disabled={deleteChapterMutation.isPending}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>

              {/* Add Scene Form */}
              <AnimatePresence>
                {showAddScene && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <AddSceneForm
                      chapterId={chapter.id}
                      storyId={storyId}
                      onDone={() => setShowAddScene(false)}
                      isStoryDark={isStoryDark}
                      storyTitle={storyTitle}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== SCENE ROW ====================

interface SceneRowProps {
  scene: StoryScene;
  storyId: string;
  onPreview: () => void;
}

const SceneRow = ({ scene, storyId, onPreview }: SceneRowProps) => {
  const queryClient = useQueryClient();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isStoryDark, setIsStoryDark] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(scene.type);
  const [editMilestonePercent, setEditMilestonePercent] = useState<string>(
    (() => { const tc = typeof scene.triggerConfig === 'string' ? (() => { try { return JSON.parse(scene.triggerConfig as string); } catch { return null; } })() : scene.triggerConfig; return tc?.percentage?.toString() || ''; })()
  );
  const [editMediaType, setEditMediaType] = useState<'VIDEO' | 'IMAGE' | ''>(scene.mediaType || '');
  const [editMediaUrl, setEditMediaUrl] = useState(scene.mediaUrl || '');
  const [editDialogues, setEditDialogues] = useState<Array<{ text: string; speaker: string; emotion: string }>>(
    (scene.dialogues || []).map(d => ({ text: d.text, speaker: d.speaker || '', emotion: d.emotion || 'neutral' }))
  );
  const [editAiDescription, setEditAiDescription] = useState('');
  const [editAiGenerating, setEditAiGenerating] = useState<'image' | 'dialogues' | 'full' | null>(null);
  const [editGeneratedPrompt, setEditGeneratedPrompt] = useState('');
  const [showEditAiPanel, setShowEditAiPanel] = useState(false);
  useEffect(() => { if (sceneRef.current) setIsStoryDark(!!sceneRef.current.closest('.story-theme-dark')); }, []);

  const deleteSceneMutation = useMutation({
    mutationFn: () => storyApi.deleteScene(scene.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      toast.success('Escena eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const updateSceneMutation = useMutation({
    mutationFn: (data: { type?: string; mediaType?: string | null; mediaUrl?: string | null; triggerConfig?: any }) => storyApi.updateScene(scene.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] }),
    onError: () => toast.error('Error al actualizar escena'),
  });

  const updateDialoguesMutation = useMutation({
    mutationFn: (dialogues: Array<{ text: string; speaker?: string; emotion?: string }>) => storyApi.setDialogues(scene.id, dialogues),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] }),
    onError: () => toast.error('Error al actualizar diálogos'),
  });

  const handleSave = async () => {
    await updateSceneMutation.mutateAsync({
      type: editType,
      mediaType: editMediaType || null,
      mediaUrl: editMediaUrl || null,
      triggerConfig: editType === 'MILESTONE' && editMilestonePercent ? { percentage: parseInt(editMilestonePercent) } : null,
    });
    const validDialogues = editDialogues.filter(d => d.text.trim());
    await updateDialoguesMutation.mutateAsync(
      validDialogues.map(d => ({ text: d.text.trim(), speaker: d.speaker.trim() || undefined, emotion: d.emotion || 'neutral' }))
    );
    toast.success('Escena actualizada');
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditType(scene.type);
    setEditMediaType(scene.mediaType || '');
    setEditMediaUrl(scene.mediaUrl || '');
    setEditDialogues((scene.dialogues || []).map(d => ({ text: d.text, speaker: d.speaker || '', emotion: d.emotion || 'neutral' })));
    setEditing(false);
  };

  const handleEditAIImagePrompt = async () => {
    if (!editAiDescription.trim()) return;
    setEditAiGenerating('image');
    try {
      const result = await storyApi.generateAIImagePrompt({ description: editAiDescription, sceneType: editType });
      setEditGeneratedPrompt(result.imagePrompt);
      setEditMediaType('IMAGE');
    } catch { toast.error('Error al generar prompt'); }
    finally { setEditAiGenerating(null); }
  };

  const handleEditAIDialogues = async () => {
    if (!editAiDescription.trim()) return;
    setEditAiGenerating('dialogues');
    try {
      const result = await storyApi.generateAIDialogues({ description: editAiDescription, sceneType: editType });
      if (result.dialogues?.length > 0) {
        setEditDialogues(result.dialogues.map(d => ({ text: d.text, speaker: d.speaker, emotion: d.emotion || 'neutral' })));
        toast.success('Diálogos generados');
      }
    } catch { toast.error('Error al generar diálogos'); }
    finally { setEditAiGenerating(null); }
  };

  const handleEditAIFullScene = async () => {
    if (!editAiDescription.trim()) return;
    setEditAiGenerating('full');
    try {
      const result = await storyApi.generateAIFullScene({ description: editAiDescription, sceneType: editType });
      if (result.imagePrompt) { setEditGeneratedPrompt(result.imagePrompt); setEditMediaType('IMAGE'); }
      if (result.dialogues?.length > 0) setEditDialogues(result.dialogues.map(d => ({ text: d.text, speaker: d.speaker, emotion: d.emotion || 'neutral' })));
      toast.success('Escena generada con IA');
    } catch { toast.error('Error al generar escena'); }
    finally { setEditAiGenerating(null); }
  };

  const addEditDialogue = () => setEditDialogues([...editDialogues, { text: '', speaker: '', emotion: 'neutral' }]);
  const updateEditDialogue = (i: number, field: string, value: string) => {
    const updated = [...editDialogues];
    (updated[i] as any)[field] = value;
    setEditDialogues(updated);
  };
  const removeEditDialogue = (i: number) => {
    if (editDialogues.length <= 1) return;
    setEditDialogues(editDialogues.filter((_, idx) => idx !== i));
  };

  const typeLabel = scene.type === 'INTRO' ? 'Introducción' : scene.type === 'DESARROLLO' ? 'Desarrollo' : scene.type === 'MILESTONE' ? 'Hito' : 'Cierre';
  const typeColor = scene.type === 'INTRO' ? 'text-blue-500' : scene.type === 'DESARROLLO' ? 'text-purple-500' : scene.type === 'MILESTONE' ? 'text-amber-500' : 'text-green-500';
  const isSaving = updateSceneMutation.isPending || updateDialoguesMutation.isPending;

  return (
    <div ref={sceneRef} className={`rounded-lg overflow-hidden ${isStoryDark ? 'bg-white/5 border border-white/10' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2 min-w-0">
          {scene.mediaType === 'VIDEO' ? <Film size={14} className="text-red-400 shrink-0" /> :
           scene.mediaType === 'IMAGE' ? <Image size={14} className="text-blue-400 shrink-0" /> :
           <MessageSquare size={14} className="text-gray-400 shrink-0" />}
          <div className="min-w-0">
            <span className={`text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
            <p className={`text-xs truncate ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>
              {scene.dialogues?.length || 0} diálogo{(scene.dialogues?.length || 0) !== 1 ? 's' : ''}
              {scene.mediaUrl && ' · Con media'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(!editing)} className={`p-1 rounded ${isStoryDark ? 'text-white/40 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`} title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={onPreview} className={`p-1 rounded ${isStoryDark ? 'text-white/40 hover:text-purple-400' : 'text-gray-400 hover:text-purple-500'}`} title="Vista previa">
            <Eye size={14} />
          </button>
          <button
            onClick={() => deleteSceneMutation.mutate()}
            disabled={deleteSceneMutation.isPending}
            className={`p-1 rounded ${isStoryDark ? 'text-white/40 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Edit form */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`px-3 pb-3 space-y-3 ${isStoryDark ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-700'}`}>
              {/* Scene type */}
              <div className="flex gap-2 mt-3">
                {(['INTRO', 'DESARROLLO', 'MILESTONE', 'OUTRO'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEditType(type)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      editType === type
                        ? isStoryDark ? 'border-purple-400/50 bg-purple-500/20 text-purple-300' : 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : isStoryDark ? 'border-white/10 text-white/50 hover:border-white/20' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {type === 'INTRO' ? '🎬 Intro' : type === 'DESARROLLO' ? '📖 Desarrollo' : type === 'MILESTONE' ? '⭐ Hito' : '🏁 Cierre'}
                  </button>
                ))}
              </div>
              {editType === 'MILESTONE' && (
                <div>
                  <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Se activa al llegar a % de progreso</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editMilestonePercent}
                    onChange={(e) => setEditMilestonePercent(e.target.value)}
                    placeholder="Ej: 50"
                    className={`w-32 px-3 py-2 text-sm rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                  />
                  <span className={`ml-1 text-xs ${isStoryDark ? 'text-white/40' : 'text-gray-400'}`}>%</span>
                </div>
              )}

              {/* AI Panel */}
              <div className={`rounded-lg border p-2.5 space-y-2 ${isStoryDark ? 'border-purple-500/30 bg-purple-900/20' : 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'}`}>
                <button
                  onClick={() => setShowEditAiPanel(!showEditAiPanel)}
                  className={`flex items-center gap-1.5 text-xs font-semibold w-full ${isStoryDark ? 'text-purple-300' : 'text-purple-600 dark:text-purple-400'}`}
                >
                  <Wand2 size={12} />
                  Regenerar con IA
                  <ChevronDown size={11} className={`ml-auto transition-transform ${showEditAiPanel ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showEditAiPanel && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={editAiDescription}
                          onChange={(e) => setEditAiDescription(e.target.value)}
                          placeholder="Describe la escena para regenerar..."
                          className={`w-full px-3 py-2 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                        />
                        <div className="flex gap-2">
                          <button onClick={handleEditAIImagePrompt} disabled={!editAiDescription.trim() || editAiGenerating !== null}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 ${isStoryDark ? 'border-blue-400/40 bg-blue-500/15 text-blue-300' : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                            {editAiGenerating === 'image' ? <Loader2 size={10} className="animate-spin" /> : <Image size={10} />} Prompt imagen
                          </button>
                          <button onClick={handleEditAIDialogues} disabled={!editAiDescription.trim() || editAiGenerating !== null}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 ${isStoryDark ? 'border-green-400/40 bg-green-500/15 text-green-300' : 'border-green-300 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
                            {editAiGenerating === 'dialogues' ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />} Diálogos
                          </button>
                          <button onClick={handleEditAIFullScene} disabled={!editAiDescription.trim() || editAiGenerating !== null}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50 ${isStoryDark ? 'border-purple-400/40 bg-purple-500/20 text-purple-300' : 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'}`}>
                            {editAiGenerating === 'full' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Todo
                          </button>
                        </div>
                        {editGeneratedPrompt && (
                          <div className={`rounded-lg p-2 space-y-1 ${isStoryDark ? 'bg-blue-900/20 border border-blue-500/20' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isStoryDark ? 'text-blue-300/70' : 'text-blue-500'}`}>Prompt para generador de imágenes</span>
                              <button onClick={() => { navigator.clipboard.writeText(editGeneratedPrompt); toast.success('Copiado'); }}
                                className={`text-[10px] px-2 py-0.5 rounded border ${isStoryDark ? 'border-blue-400/30 text-blue-300' : 'border-blue-300 text-blue-600'}`}>Copiar</button>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isStoryDark ? 'text-white/70' : 'text-gray-600 dark:text-gray-400'}`}>{editGeneratedPrompt}</p>
                            <p className={`text-[10px] ${isStoryDark ? 'text-white/40' : 'text-gray-400'}`}>Usa este prompt en Midjourney, DALL-E u otro generador. Luego pega la URL abajo.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Media */}
              <div>
                <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Media</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setEditMediaType(editMediaType === 'VIDEO' ? '' : 'VIDEO')}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${editMediaType === 'VIDEO' ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600' : isStoryDark ? 'border-white/10 text-white/50' : 'border-gray-200 dark:border-gray-600 text-gray-500'}`}
                  >
                    <Film size={12} className="inline mr-1" /> YouTube
                  </button>
                  <button
                    onClick={() => setEditMediaType(editMediaType === 'IMAGE' ? '' : 'IMAGE')}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${editMediaType === 'IMAGE' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : isStoryDark ? 'border-white/10 text-white/50' : 'border-gray-200 dark:border-gray-600 text-gray-500'}`}
                  >
                    <Image size={12} className="inline mr-1" /> Imagen
                  </button>
                </div>
                {editMediaType && (
                  <input
                    type="text"
                    value={editMediaUrl}
                    onChange={(e) => setEditMediaUrl(e.target.value)}
                    placeholder={editMediaType === 'VIDEO' ? 'URL de YouTube' : 'URL de la imagen'}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                  />
                )}
              </div>

              {/* Dialogues */}
              <div>
                <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Diálogos</label>
                <div className="space-y-2">
                  {editDialogues.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={d.speaker}
                        onChange={(e) => updateEditDialogue(i, 'speaker', e.target.value)}
                        placeholder="Narrador"
                        className={`w-24 px-2 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                      />
                      <input
                        type="text"
                        value={d.text}
                        onChange={(e) => updateEditDialogue(i, 'text', e.target.value)}
                        placeholder="Texto del diálogo..."
                        className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                      />
                      <select
                        value={d.emotion}
                        onChange={(e) => updateEditDialogue(i, 'emotion', e.target.value)}
                        className={`w-24 px-1 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                      >
                        <option value="neutral">😐 Neutral</option>
                        <option value="excited">🤩 Emoción</option>
                        <option value="happy">😊 Feliz</option>
                        <option value="sad">😢 Triste</option>
                        <option value="angry">😠 Enojado</option>
                        <option value="mysterious">🔮 Misterio</option>
                      </select>
                      {editDialogues.length > 1 && (
                        <button onClick={() => removeEditDialogue(i)} className="text-red-400 hover:text-red-600 p-1">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addEditDialogue} className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                  <Plus size={12} /> Añadir diálogo
                </button>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 justify-end">
                <button onClick={handleCancelEdit} className={`px-3 py-1.5 text-xs ${isStoryDark ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'}`}>
                  Cancelar
                </button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== ADD CHAPTER FORM ====================

const AddChapterForm = ({ storyId, classroomId, isThemeDark }: { storyId: string; classroomId: string; isThemeDark?: boolean }) => {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionType, setCompletionType] = useState('BIMESTER');
  const [targetXp, setTargetXp] = useState('');
  const [donationPercent, setDonationPercent] = useState('10');

  const createMutation = useMutation({
    mutationFn: (data: any) => storyApi.createChapter(storyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories', classroomId] });
      setShow(false);
      setTitle('');
      setDescription('');
      setCompletionType('BIMESTER');
      setTargetXp('');
      toast.success('Capítulo creado');
    },
    onError: () => toast.error('Error al crear capítulo'),
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    const data: any = { title: title.trim(), completionType };
    if (description.trim()) data.description = description.trim();
    if (completionType === 'XP_GOAL' && targetXp) {
      data.completionConfig = { targetXp: parseInt(targetXp) };
    } else if (completionType === 'DONATION' && targetXp && donationPercent) {
      data.completionConfig = { targetXp: parseInt(targetXp), donationPercent: parseInt(donationPercent) };
    }
    createMutation.mutate(data);
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-400 hover:text-purple-500 hover:border-purple-300 transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={14} /> Añadir capítulo
      </button>
    );
  }

  return (
    <div className={`p-3 border rounded-lg space-y-3 ${isThemeDark ? 'border-purple-500/40 bg-purple-900/20' : 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'}`}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del capítulo"
        className={`w-full px-3 py-2 text-sm rounded-lg border ${isThemeDark ? 'border-white/20 bg-white/10 text-white placeholder:text-white/50' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        rows={2}
        className={`w-full px-3 py-2 text-sm rounded-lg border resize-none ${isThemeDark ? 'border-white/20 bg-white/10 text-white placeholder:text-white/50' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
      />
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Condición de completado</label>
        <div className="flex gap-2">
          {(['BIMESTER', 'XP_GOAL', 'DONATION'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setCompletionType(type)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                completionType === type
                  ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              {type === 'BIMESTER' ? '📅 Bimestre' : type === 'XP_GOAL' ? '🎯 Meta XP' : '💝 Donación'}
            </button>
          ))}
        </div>
        {/* Explanation for selected type */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
          {completionType === 'BIMESTER' && 'El capítulo se completa automáticamente cuando el profesor cierra el bimestre.'}
          {completionType === 'XP_GOAL' && 'El capítulo se completa cuando la clase acumula la meta de XP total indicada.'}
          {completionType === 'DONATION' && 'Los estudiantes "donan" un % de cada XP que ganan. El capítulo se completa cuando la donación acumulada alcanza la meta.'}
        </p>
      </div>
      {(completionType === 'XP_GOAL' || completionType === 'DONATION') && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={targetXp}
              onChange={(e) => setTargetXp(e.target.value)}
              placeholder="Meta de XP total"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">XP</span>
          </div>
          {completionType === 'DONATION' && (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={donationPercent}
                onChange={(e) => setDonationPercent(e.target.value)}
                placeholder="% de XP donado"
                min="1"
                max="100"
                className="w-32 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">% de cada XP ganado se dona</span>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShow(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
        <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || createMutation.isPending}>
          Crear capítulo
        </Button>
      </div>
    </div>
  );
};

// ==================== ADD SCENE FORM ====================

const AddSceneForm = ({ chapterId, storyId, onDone, isStoryDark = false, storyTitle }: { chapterId: string; storyId: string; onDone: () => void; isStoryDark?: boolean; storyTitle?: string }) => {
  const queryClient = useQueryClient();
  const [sceneType, setSceneType] = useState<'INTRO' | 'DESARROLLO' | 'MILESTONE' | 'OUTRO'>('INTRO');
  const [milestonePercent, setMilestonePercent] = useState('');
  const [mediaType, setMediaType] = useState<'VIDEO' | 'IMAGE' | ''>('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [dialogues, setDialogues] = useState<Array<{ text: string; speaker: string; emotion: string }>>([
    { text: '', speaker: '', emotion: 'neutral' },
  ]);
  const [aiDescription, setAiDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState<'image' | 'dialogues' | 'full' | null>(null);
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  const handleAIImagePrompt = async () => {
    if (!aiDescription.trim()) return;
    setAiGenerating('image');
    try {
      const result = await storyApi.generateAIImagePrompt({
        description: aiDescription,
        sceneType,
        storyContext: storyTitle,
      });
      setGeneratedImagePrompt(result.imagePrompt);
      setMediaType('IMAGE');
    } catch {
      toast.error('Error al generar prompt de imagen');
    } finally {
      setAiGenerating(null);
    }
  };

  const handleAIDialogues = async () => {
    if (!aiDescription.trim()) return;
    setAiGenerating('dialogues');
    try {
      const result = await storyApi.generateAIDialogues({
        description: aiDescription,
        sceneType,
        storyContext: storyTitle,
      });
      if (result.dialogues?.length > 0) {
        setDialogues(result.dialogues.map(d => ({ text: d.text, speaker: d.speaker, emotion: d.emotion || 'neutral' })));
        toast.success('Diálogos generados');
      }
    } catch {
      toast.error('Error al generar diálogos');
    } finally {
      setAiGenerating(null);
    }
  };

  const handleAIFullScene = async () => {
    if (!aiDescription.trim()) return;
    setAiGenerating('full');
    try {
      const result = await storyApi.generateAIFullScene({
        description: aiDescription,
        sceneType,
        storyContext: storyTitle,
      });
      if (result.imagePrompt) {
        setGeneratedImagePrompt(result.imagePrompt);
        setMediaType('IMAGE');
      }
      if (result.dialogues?.length > 0) {
        setDialogues(result.dialogues.map(d => ({ text: d.text, speaker: d.speaker, emotion: d.emotion || 'neutral' })));
      }
      toast.success('Escena generada con IA');
    } catch {
      toast.error('Error al generar escena');
    } finally {
      setAiGenerating(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => storyApi.createScene(chapterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      toast.success('Escena creada');
      onDone();
    },
    onError: () => toast.error('Error al crear escena'),
  });

  const handleSubmit = () => {
    const validDialogues = dialogues.filter(d => d.text.trim());
    const data: any = { type: sceneType };
    if (mediaType) {
      data.mediaType = mediaType;
      data.mediaUrl = mediaUrl;
    }
    if (sceneType === 'MILESTONE' && milestonePercent) {
      data.triggerConfig = { percentage: parseInt(milestonePercent) };
    }
    if (validDialogues.length > 0) {
      data.dialogues = validDialogues.map(d => ({
        text: d.text.trim(),
        speaker: d.speaker.trim() || undefined,
        emotion: d.emotion || 'neutral',
      }));
    }
    createMutation.mutate(data);
  };

  const addDialogue = () => {
    setDialogues([...dialogues, { text: '', speaker: '', emotion: 'neutral' }]);
  };

  const updateDialogue = (index: number, field: string, value: string) => {
    const updated = [...dialogues];
    (updated[index] as any)[field] = value;
    setDialogues(updated);
  };

  const removeDialogue = (index: number) => {
    if (dialogues.length <= 1) return;
    setDialogues(dialogues.filter((_, i) => i !== index));
  };

  return (
    <div className={`p-3 rounded-lg space-y-3 mt-2 ${isStoryDark ? 'border border-white/15 bg-white/5' : 'border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'}`}>
      <h4 className={`text-xs font-semibold ${isStoryDark ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>Nueva Escena</h4>

      {/* Scene type */}
      <div className="flex gap-2">
        {(['INTRO', 'DESARROLLO', 'MILESTONE', 'OUTRO'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSceneType(type)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              sceneType === type
                ? isStoryDark ? 'border-purple-400/50 bg-purple-500/20 text-purple-300' : 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : isStoryDark ? 'border-white/10 text-white/50 hover:border-white/20' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {type === 'INTRO' ? '🎬 Intro' : type === 'DESARROLLO' ? '📖 Desarrollo' : type === 'MILESTONE' ? '⭐ Hito' : '🏁 Cierre'}
          </button>
        ))}
      </div>
      {sceneType === 'MILESTONE' && (
        <div>
          <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Se activa al llegar a % de progreso</label>
          <input
            type="number"
            min="1"
            max="100"
            value={milestonePercent}
            onChange={(e) => setMilestonePercent(e.target.value)}
            placeholder="Ej: 50"
            className={`w-32 px-3 py-2 text-sm rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
          />
          <span className={`ml-1 text-xs ${isStoryDark ? 'text-white/40' : 'text-gray-400'}`}>%</span>
        </div>
      )}

      {/* AI Panel */}
      <div className={`rounded-lg border p-3 space-y-2 ${isStoryDark ? 'border-purple-500/30 bg-purple-900/20' : 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'}`}>
        <button
          onClick={() => setShowAiPanel(!showAiPanel)}
          className={`flex items-center gap-1.5 text-xs font-semibold w-full ${isStoryDark ? 'text-purple-300' : 'text-purple-600 dark:text-purple-400'}`}
        >
          <Wand2 size={13} />
          Generar con IA
          <ChevronDown size={12} className={`ml-auto transition-transform ${showAiPanel ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showAiPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="Describe la escena... ej: Un héroe llega a una aldea en llamas al atardecer"
                  className={`w-full px-3 py-2 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAIImagePrompt}
                    disabled={!aiDescription.trim() || aiGenerating !== null}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${isStoryDark ? 'border-blue-400/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'}`}
                  >
                    {aiGenerating === 'image' ? <Loader2 size={11} className="animate-spin" /> : <Image size={11} />}
                    Prompt imagen
                  </button>
                  <button
                    onClick={handleAIDialogues}
                    disabled={!aiDescription.trim() || aiGenerating !== null}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${isStoryDark ? 'border-green-400/40 bg-green-500/15 text-green-300 hover:bg-green-500/25' : 'border-green-300 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100'}`}
                  >
                    {aiGenerating === 'dialogues' ? <Loader2 size={11} className="animate-spin" /> : <MessageSquare size={11} />}
                    Diálogos
                  </button>
                  <button
                    onClick={handleAIFullScene}
                    disabled={!aiDescription.trim() || aiGenerating !== null}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${isStoryDark ? 'border-purple-400/40 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100'}`}
                  >
                    {aiGenerating === 'full' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Todo
                  </button>
                </div>
                {generatedImagePrompt && (
                  <div className={`rounded-lg p-2 space-y-1.5 ${isStoryDark ? 'bg-blue-900/20 border border-blue-500/20' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isStoryDark ? 'text-blue-300/70' : 'text-blue-500'}`}>Prompt para generador de imágenes</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(generatedImagePrompt); toast.success('Copiado'); }}
                        className={`text-[10px] px-2 py-0.5 rounded border ${isStoryDark ? 'border-blue-400/30 text-blue-300 hover:bg-blue-500/20' : 'border-blue-300 text-blue-600 hover:bg-blue-100'}`}
                      >
                        Copiar
                      </button>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isStoryDark ? 'text-white/70' : 'text-gray-600 dark:text-gray-400'}`}>{generatedImagePrompt}</p>
                    <p className={`text-[10px] ${isStoryDark ? 'text-white/40' : 'text-gray-400'}`}>Usa este prompt en Midjourney, DALL-E, Stable Diffusion u otro generador. Luego pega la URL de la imagen abajo.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Media */}
      <div>
        <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Media (opcional)</label>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setMediaType(mediaType === 'VIDEO' ? '' : 'VIDEO')}
            className={`px-3 py-1.5 rounded-lg text-xs border ${mediaType === 'VIDEO' ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600' : isStoryDark ? 'border-white/10 text-white/50' : 'border-gray-200 dark:border-gray-600 text-gray-500'}`}
          >
            <Film size={12} className="inline mr-1" /> YouTube
          </button>
          <button
            onClick={() => setMediaType(mediaType === 'IMAGE' ? '' : 'IMAGE')}
            className={`px-3 py-1.5 rounded-lg text-xs border ${mediaType === 'IMAGE' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : isStoryDark ? 'border-white/10 text-white/50' : 'border-gray-200 dark:border-gray-600 text-gray-500'}`}
          >
            <Image size={12} className="inline mr-1" /> Imagen
          </button>
        </div>
        {mediaType && (
          <input
            type="text"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder={mediaType === 'VIDEO' ? 'URL de YouTube' : 'URL de la imagen'}
            className={`w-full px-3 py-2 text-sm rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
          />
        )}
      </div>

      {/* Dialogues */}
      <div>
        <label className={`text-xs font-medium mb-1 block ${isStoryDark ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>Diálogos</label>
        <div className="space-y-2">
          {dialogues.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={d.speaker}
                onChange={(e) => updateDialogue(i, 'speaker', e.target.value)}
                placeholder="Narrador"
                className={`w-24 px-2 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
              />
              <input
                type="text"
                value={d.text}
                onChange={(e) => updateDialogue(i, 'text', e.target.value)}
                placeholder="Texto del diálogo..."
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white placeholder-white/30' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
              />
              <select
                value={d.emotion}
                onChange={(e) => updateDialogue(i, 'emotion', e.target.value)}
                className={`w-24 px-1 py-1.5 text-xs rounded-lg border ${isStoryDark ? 'border-white/15 bg-white/10 text-white' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}`}
              >
                <option value="neutral">😐 Neutral</option>
                <option value="excited">🤩 Emoción</option>
                <option value="happy">😊 Feliz</option>
                <option value="sad">😢 Triste</option>
                <option value="angry">😠 Enojado</option>
                <option value="mysterious">🔮 Misterio</option>
              </select>
              {dialogues.length > 1 && (
                <button onClick={() => removeDialogue(i)} className="text-red-400 hover:text-red-600 p-1">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addDialogue} className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
          <Plus size={12} /> Añadir diálogo
        </button>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className={`px-3 py-1.5 text-xs ${isStoryDark ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'}`}>
          Cancelar
        </button>
        <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending}>
          Crear escena
        </Button>
      </div>
    </div>
  );
};

// ==================== STORY FORM MODAL ====================

interface StoryFormModalProps {
  story?: Story;
  onSubmit: (data: { title: string; description?: string; themeConfig?: ThemeConfig }) => void;
  onClose: () => void;
  isLoading: boolean;
  presets: ThemePreset[];
}

const StoryFormModal = ({ story, onSubmit, onClose, isLoading, presets }: StoryFormModalProps) => {
  const [title, setTitle] = useState(story?.title || '');
  const [description, setDescription] = useState(story?.description || '');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | undefined>(story?.themeConfig || undefined);

  const handlePresetSelect = (preset: ThemePreset) => {
  setSelectedPreset(preset.key);
  setThemeConfig({
    colors: preset.colors,
    particles: preset.particles,
    decorations: preset.decorations as any,
    banner: preset.banner,
  }); // faltaba } para cerrar el objeto
};

const handleSubmit = () => {
  if (!title.trim()) return;
  onSubmit({
    title: title.trim(),
    description: description.trim() || undefined,
    themeConfig,
  }); 
};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {story ? 'Editar Historia' : 'Nueva Historia'}
                </h3>
                <p className="text-white/80 text-sm">Dale vida a tu clase con narrativas</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Título de la historia *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: La Guerra de los Elementos"
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-0 transition-colors"
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Una breve descripción de la historia..."
              rows={2}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-0 transition-colors resize-none"
            />
          </div>

          {/* Tema visual */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-purple-500 rounded-lg flex items-center justify-center">
                <Palette className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tema visual (opcional)</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetSelect(preset)}
                  className={`group p-2.5 rounded-xl border-2 transition-all hover:shadow-md ${
                    selectedPreset === preset.key
                      ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800 shadow-md'
                      : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                  }`}
                >
                  <div
                    className="w-full h-10 rounded-lg mb-1.5 flex items-center justify-center text-lg shadow-inner"
                    style={{ background: `linear-gradient(135deg, ${preset.colors?.primary}, ${preset.colors?.secondary})` }}
                  >
                    {preset.banner?.emoji}
                  </div>
                  <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center truncate">{preset.name}</p>
                </button>
              ))}
              <button
                onClick={() => { setSelectedPreset(null); setThemeConfig(undefined); }}
                className={`p-2.5 rounded-xl border-2 transition-all hover:shadow-md ${
                  !selectedPreset && !story?.themeConfig ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="w-full h-10 rounded-lg mb-1.5 flex items-center justify-center text-lg bg-gray-100 dark:bg-gray-700">
                  🚫
                </div>
                <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center">Sin tema</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
            className="flex-1 py-3 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'Guardando...' : story ? 'Guardar cambios' : 'Crear Historia'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StorytellingPage;
