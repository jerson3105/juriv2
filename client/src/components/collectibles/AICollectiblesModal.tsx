import { useCallback, useEffect, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { Check, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { collectibleApi, type CardRarity, type GeneratedAlbum, type GeneratedCard } from '../../lib/collectibleApi';
import { CollectibleCardView } from './CollectibleCardView';
import { CARD_RARITY_ORDER } from './collectibleHelpers';

interface AICollectiblesModalProps {
  mode: 'album' | 'cards';
  classroomId: string;
  albumName?: string;
  firstSlot?: number;
  onClose: () => void;
  onConfirm: (album: { name: string; description: string } | null, cards: GeneratedCard[]) => Promise<void>;
}

const COUNTS = { album: [9, 12, 18, 24, 30], cards: [3, 6, 9] };

export const AICollectiblesModal = ({ mode, classroomId, albumName, firstSlot = 1, onClose, onConfirm }: AICollectiblesModalProps) => {
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(COUNTS[mode][1]);
  const [generated, setGenerated] = useState<GeneratedAlbum | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isPresent = useIsPresent();
  const busy = isGenerating || isSaving;

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !busy && !event.defaultPrevented) onClose();
  }, [isPresent, busy, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const generate = async () => {
    if (!theme.trim()) return;
    setIsGenerating(true);
    try {
      const result = await collectibleApi.generateAlbumWithAI(classroomId, { theme: theme.trim(), cardCount: count });
      const cards = (result.cards ?? [])
        .filter((card) => card?.name)
        .map((card) => ({
          name: String(card.name).slice(0, 100),
          description: String(card.description ?? '').slice(0, 300),
          rarity: (CARD_RARITY_ORDER.includes(card.rarity) ? card.rarity : 'COMMON') as CardRarity,
          icon: card.icon ? String(card.icon).slice(0, 50) : undefined,
        }));
      if (cards.length === 0) {
        toast.error('La IA no devolvió cromos; prueba con otra descripción');
        return;
      }
      setGenerated({ name: String(result.name ?? theme).slice(0, 100), description: String(result.description ?? '').slice(0, 500), cards });
      setExcluded(new Set());
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo generar con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirm = async () => {
    if (!generated) return;
    const cards = generated.cards.filter((_, i) => !excluded.has(i));
    if (cards.length === 0) return;
    setIsSaving(true);
    try {
      await onConfirm(mode === 'album' ? { name: generated.name, description: generated.description } : null, cards);
    } finally {
      setIsSaving(false);
    }
  };

  const included = generated ? generated.cards.length - excluded.size : 0;
  // Casilla que ocupará cada cromo incluido (los quitados no cuentan).
  const slotNumbers: number[] = [];
  for (const [i] of (generated?.cards ?? []).entries()) slotNumbers.push(excluded.has(i) ? 0 : firstSlot + slotNumbers.filter((n) => n > 0).length);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-collectibles-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white" aria-hidden="true"><Sparkles size={20} /></span>
            <div>
              <h2 id="ai-collectibles-title" className="text-lg font-bold text-gray-900 dark:text-white">{mode === 'album' ? 'Crear álbum con IA' : 'Añadir cromos con IA'}</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">{generated ? `${included} de ${generated.cards.length} seleccionados` : mode === 'album' ? 'Describe el tema y la IA crea los cromos con su emoji' : `Para el álbum ${albumName ?? ''}`}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!generated ? (
            <div className="space-y-5">
              <div>
                <label htmlFor="ai-theme" className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">Tema</label>
                <textarea
                  id="ai-theme"
                  rows={3}
                  maxLength={1000}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ej: Los dinosaurios más famosos del Jurásico y el Cretácico, carnívoros y herbívoros"
                  className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">¿Cuántos cromos?</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidad de cromos">
                  {COUNTS[mode].map((n) => (
                    <button key={n} type="button" onClick={() => setCount(n)} aria-pressed={count === n} className={`min-h-[44px] min-w-[56px] rounded-xl border-2 px-3 text-sm font-bold ${count === n ? 'border-primary-600 bg-primary-50 text-gray-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-white' : 'border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:text-gray-100'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                {mode === 'album' && <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">Con 6 cromos por página: {Math.ceil(count / 6)} páginas.</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mode === 'album' && (
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                  <p className="font-bold text-gray-900 dark:text-white">{generated.name}</p>
                  {generated.description && <p className="text-sm text-gray-700 dark:text-gray-300">{generated.description}</p>}
                </div>
              )}
              <p className="text-xs text-gray-700 dark:text-gray-300">Toca un cromo para quitarlo o volver a incluirlo. Podrás editar nombre, emoji e imagen después.</p>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {generated.cards.map((card, i) => {
                  const isIncluded = !excluded.has(i);
                  const slotNumber = slotNumbers[i];
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setExcluded((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })}
                        aria-pressed={isIncluded}
                        aria-label={`${isIncluded ? 'Quitar' : 'Incluir'}: ${card.name}`}
                        className={`relative block w-full rounded-xl transition ${isIncluded ? '' : 'opacity-40 grayscale'}`}
                      >
                        <CollectibleCardView card={{ name: card.name, rarity: card.rarity, slotNumber: slotNumber || 0, imageUrl: null, icon: card.icon ?? null }} size="sm" />
                        {isIncluded && <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow" aria-hidden="true"><Check size={14} /></span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {generated ? (
            <button type="button" onClick={() => setGenerated(null)} disabled={busy} className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">← Cambiar tema</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-700">Cancelar</button>
            {generated ? (
              <button type="button" onClick={() => void confirm()} disabled={included === 0 || isSaving} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
                <Check size={16} aria-hidden="true" />
                {isSaving ? 'Guardando...' : mode === 'album' ? `Crear álbum con ${included}` : `Añadir ${included}`}
              </button>
            ) : (
              <button type="button" onClick={() => void generate()} disabled={!theme.trim() || isGenerating} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
                {isGenerating ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />Generando...</> : <><Sparkles size={16} aria-hidden="true" />Generar</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
