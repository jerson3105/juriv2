import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmojiPicker } from '../ui/EmojiPicker';
import { collectibleApi, type CardRarity, type CollectibleCard, type CreateCardData } from '../../lib/collectibleApi';
import { CollectibleCardView } from './CollectibleCardView';
import { CARD_RARITY_ORDER, CARD_RARITY_STYLE, RARITY_FALLBACK_ICON, RARITY_WEIGHT } from './collectibleHelpers';

export type CardFormTarget = { kind: 'create'; nextSlot: number } | { kind: 'edit'; card: CollectibleCard; owners: number };

interface CardFormModalProps {
  target: CardFormTarget;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCardData, another: boolean) => Promise<boolean>;
}

const initialState = (target: CardFormTarget) => {
  const card = target.kind === 'edit' ? target.card : null;
  return {
    name: card?.name ?? '',
    description: card?.description ?? '',
    rarity: (card?.rarity ?? 'COMMON') as CardRarity,
    icon: card?.icon ?? '',
    imageUrl: card?.imageUrl ?? null,
    imageChanged: false,
  };
};

type FormState = ReturnType<typeof initialState>;

const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';

export const CardFormModal = ({ target, isSaving, onClose, onSubmit }: CardFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const [form, setForm] = useState(() => initialState(target));
  const [isUploading, setIsUploading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isPresent = useIsPresent();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const canSave = form.name.trim().length > 0 && !isSaving && !isUploading;
  const slot = target.kind === 'edit' ? target.card.slotNumber : target.nextSlot;

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isPresent || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('[aria-label="Selector de iconos"]')) return;
    onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const uploadImage = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe pesar menos de 2 MB');
      return;
    }
    setIsUploading(true);
    try {
      const url = await collectibleApi.uploadImage(file);
      setForm((current) => ({ ...current, imageUrl: url, imageChanged: true }));
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async (another: boolean) => {
    if (!canSave) return;
    const saved = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      rarity: form.rarity,
      icon: form.icon || null,
      // Solo se envía la imagen si cambió (las antiguas pueden ser URLs externas).
      ...(form.imageChanged ? { imageUrl: form.imageUrl } : {}),
    }, another);
    if (saved && another) {
      setForm({ ...initialState({ kind: 'create', nextSlot: slot + 1 }), rarity: form.rarity });
      nameRef.current?.focus();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-form-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="card-form-title" className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Editar cromo' : 'Nuevo cromo'} <span className="font-semibold text-gray-700 dark:text-gray-300">· casilla {slot}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 sm:flex-row">
          <div className="mx-auto w-40 flex-shrink-0 sm:mx-0">
            <CollectibleCardView card={{ name: form.name || 'Nombre del cromo', rarity: form.rarity, slotNumber: slot, imageUrl: form.imageUrl, icon: form.icon || null }} />
            <p className="mt-2 text-center text-xs text-gray-700 dark:text-gray-300">Así se verá en el álbum</p>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {isEdit && target.owners > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                {target.owners} {target.owners === 1 ? 'estudiante ya lo tiene' : 'estudiantes ya lo tienen'}: los cambios también se verán en su álbum.
              </p>
            )}
            <div>
              <label htmlFor="card-name" className={labelClass}>Nombre</label>
              <input id="card-name" ref={nameRef} type="text" maxLength={100} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Tiranosaurio" className={fieldClass} />
            </div>

            <div>
              <span className={labelClass}>Rareza <span className="font-normal text-gray-600 dark:text-gray-300">(probabilidad al abrir un sobre)</span></span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Rareza">
                {CARD_RARITY_ORDER.map((rarity) => {
                  const active = form.rarity === rarity;
                  return (
                    <button
                      key={rarity}
                      type="button"
                      onClick={() => set('rarity', rarity)}
                      aria-pressed={active}
                      className={`flex min-h-[44px] items-center justify-between gap-1 rounded-xl border-2 px-2.5 text-sm font-bold transition-colors ${
                        active ? 'border-primary-600 bg-primary-50 text-gray-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-white' : 'border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-600 dark:text-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true">{RARITY_FALLBACK_ICON[rarity]}</span>
                        {CARD_RARITY_STYLE[rarity].label}
                      </span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{RARITY_WEIGHT[rarity]}%</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <span className={labelClass}>Emoji</span>
                <EmojiPicker
                  value={form.icon || RARITY_FALLBACK_ICON[form.rarity]}
                  onChange={(icon) => set('icon', icon)}
                  ariaLabel="Cambiar emoji del cromo"
                  triggerClassName="flex h-11 w-14 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-2xl hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                />
              </div>
              <div>
                <span className={labelClass}>Imagen <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, reemplaza al emoji)</span></span>
                <div className="flex gap-2">
                  <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                    <ImagePlus size={16} aria-hidden="true" />
                    {isUploading ? 'Subiendo...' : form.imageUrl ? 'Cambiar' : 'Subir'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="sr-only"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {form.imageUrl && (
                    <button type="button" onClick={() => setForm((current) => ({ ...current, imageUrl: null, imageChanged: true }))} className="h-11 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="card-description" className={labelClass}>Dato curioso <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span></label>
              <textarea
                id="card-description"
                rows={2}
                maxLength={300}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void submit(false);
                  }
                }}
                placeholder="Algo que aprenderán al conseguirlo"
                className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">Cancelar</button>
          {!isEdit && (
            <button type="button" onClick={() => void submit(true)} disabled={!canSave} className="min-h-[44px] rounded-xl border-2 border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-500 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/30 dark:disabled:border-gray-600 dark:disabled:text-gray-400">
              Guardar y crear otro
            </button>
          )}
          <button type="submit" disabled={!canSave} className="min-h-[44px] rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
            {isSaving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Pegar en el álbum'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};
