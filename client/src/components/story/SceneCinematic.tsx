import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X, Play, SkipForward } from 'lucide-react';
import type { StoryScene } from '../../lib/storyApi';

interface SceneCinematicProps {
  scene: StoryScene;
  onComplete: () => void;
  onClose?: () => void;
}

// Extract YouTube video ID from various URL formats
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export const SceneCinematic = ({ scene, onComplete, onClose }: SceneCinematicProps) => {
  const [currentDialogue, setCurrentDialogue] = useState(0);
  const [showMedia] = useState(true);
  const dialogues = scene.dialogues || [];
  const hasDialogues = dialogues.length > 0;
  const isLastDialogue = currentDialogue >= dialogues.length - 1;

  const handleNext = useCallback(() => {
    if (!hasDialogues || isLastDialogue) {
      onComplete();
    } else {
      setCurrentDialogue(prev => prev + 1);
    }
  }, [hasDialogues, isLastDialogue, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const youtubeId = scene.mediaType === 'VIDEO' && scene.mediaUrl
    ? getYouTubeId(scene.mediaUrl)
    : null;

  const bgColor = scene.backgroundColor || '#0a0a1a';

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: bgColor, zIndex: 99999 }}
    >
      {/* Skip / Close button */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {hasDialogues && (
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors"
          >
            <SkipForward size={14} />
            Saltar
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Media area */}
      {showMedia && (scene.mediaType === 'VIDEO' || scene.mediaType === 'IMAGE') && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-2xl px-4 mb-6"
        >
          {scene.mediaType === 'VIDEO' && youtubeId ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&modestbranding=1`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Story scene video"
              />
            </div>
          ) : scene.mediaType === 'IMAGE' && scene.mediaUrl ? (
            <div className="relative w-full max-h-[50vh] rounded-xl overflow-hidden shadow-2xl">
              <img
                src={scene.mediaUrl}
                alt="Story scene"
                className="w-full h-full object-contain"
              />
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Dialogue box */}
      {hasDialogues && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="w-full max-w-2xl px-4"
        >
          <div
            className="relative rounded-xl border border-white/10 backdrop-blur-md p-5 cursor-pointer select-none"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={handleNext}
          >
            {/* Speaker name */}
            <AnimatePresence mode="wait">
              {dialogues[currentDialogue]?.speaker && (
                <motion.div
                  key={`speaker-${currentDialogue}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: getEmotionColor(dialogues[currentDialogue]?.emotion || 'neutral'),
                    color: '#fff',
                  }}
                >
                  {dialogues[currentDialogue].speaker}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dialogue text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={`dialogue-${currentDialogue}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-white text-base leading-relaxed mt-1"
              >
                {dialogues[currentDialogue]?.text || ''}
              </motion.p>
            </AnimatePresence>

            {/* Progress + next indicator */}
            <div className="flex items-center justify-between mt-4">
              {/* Dots indicator */}
              <div className="flex gap-1">
                {dialogues.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === currentDialogue ? 'bg-white' :
                      i < currentDialogue ? 'bg-white/50' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>

              {/* Next button hint */}
              <div className="flex items-center gap-1 text-white/50 text-xs">
                {isLastDialogue ? 'Finalizar' : 'Siguiente'}
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* If no dialogues, show a continue button */}
      {!hasDialogues && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onComplete}
          className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <Play size={16} />
          Continuar
        </motion.button>
      )}
    </motion.div>,
    document.body
  );
};

function getEmotionColor(emotion: string): string {
  switch (emotion) {
    case 'excited': return '#F59E0B';
    case 'happy': return '#10B981';
    case 'sad': return '#6366F1';
    case 'angry': return '#EF4444';
    case 'mysterious': return '#8B5CF6';
    default: return '#6B7280';
  }
}

export default SceneCinematic;
