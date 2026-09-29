import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { collectibleApi, collectibleImageUrl, type AlbumWithCards, type CreateAlbumData } from '../../lib/collectibleApi';
import { badgeApi } from '../../lib/badgeApi';
import { expectedCostToComplete } from './collectibleHelpers';

export type AlbumFormTarget = { kind: 'create' } | { kind: 'edit'; album: AlbumWithCards };

interface AlbumFormModalProps {
  target: AlbumFormTarget;
  classroomId: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAlbumData & { isActive?: boolean }) => Promise<boolean>;
}

const SUGGESTED = { single: 10, five: 45, ten: 80 };

const initialState = (target: AlbumFormTarget) => {
  const album = target.kind === 'edit' ? target.album : null;
  return {
    name: album?.name ?? '',
    description: album?.description ?? '',
    coverImage: album?.coverImage ?? null,
    coverChanged: false,
    single: album?.singlePackPrice ?? SUGGESTED.single,
    five: album?.fivePackPrice ?? SUGGESTED.five,
    ten: album?.tenPackPrice ?? SUGGESTED.ten,
    rewardXp: album?.rewardXp ?? 100,
    rewardGp: album?.rewardGp ?? 50,
    rewardBadgeId: album?.rewardBadgeId ?? '',
    isActive: album?.isActive ?? true,
  };
};

type FormState = ReturnType<typeof initialState>;

const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';
const numberClass = 'h-10 w-full rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export const AlbumFormModal = ({ target, classroomId, isSaving, onClose, onSubmit }: AlbumFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const [form, setForm] = useState(() => initialState(target));
  const [isUploading, setIsUploading] = useState(false);
  const isPresent = useIsPresent();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const canSave = form.name.trim().length > 0 && !isSaving && !isUploading;

  const { data: badges = [] } = useQuery({
    queryKey: ['badges', classroomId],
    queryFn: () => badgeApi.getClassroomBadges(classroomId),
  });

  const cost = useMemo(
    () => (target.kind === 'edit' && target.album.cards.length > 0 ? expectedCostToComplete(target.album.cards, { single: form.single, five: form.five, ten: form.ten }) : null),
    [target, form.single, form.five, form.ten],
  );

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const uploadCover = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe pesar menos de 2 MB');
      return;
    }
    setIsUploading(true);
    try {
      const url = await collectibleApi.uploadImage(file);
      setForm((current) => ({ ...current, coverImage: url, coverChanged: true }));
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async () => {
    if (!canSave) return;
    const saved = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      ...(form.coverChanged ? { coverImage: form.coverImage } : {}),
      singlePackPrice: form.single,
      fivePackPrice: form.five,
      tenPackPrice: form.ten,
      rewardXp: form.rewardXp,
      rewardGp: form.rewardGp,
      rewardBadgeId: form.rewardBadgeId || null,
      ...(isEdit ? { isActive: form.isActive } : {}),
    });
    if (saved) onClose();
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
          void submit();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-form-title"
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="album-form-title" className="text-lg font-bold text-gray-900 dark:text-white">{isEdit ? 'Configurar álbum' : 'Nuevo álbum'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex gap-4">
            <label className="relative flex h-28 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-amber-100 to-orange-200 text-center text-xs font-semibold text-gray-800 hover:border-primary-400 dark:border-gray-600 dark:from-amber-950 dark:to-orange-900 dark:text-gray-100" title="Portada (PNG, JPG, GIF o WEBP, máx. 2 MB)">
              {form.coverImage ? (
                <img src={collectibleImageUrl(form.coverImage)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus size={20} aria-hidden="true" />
                  {isUploading ? 'Subiendo...' : 'Portada'}
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                aria-label="Subir portada"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCover(file);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label htmlFor="album-name" className={labelClass}>Nombre</label>
                <input id="album-name" type="text" maxLength={100} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Animales del mundo" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="album-description" className={labelClass}>Descripción <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span></label>
                <input id="album-description" type="text" maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="De qué trata el álbum" className={fieldClass} />
              </div>
              {form.coverImage && (
                <button type="button" onClick={() => setForm((current) => ({ ...current, coverImage: null, coverChanged: true }))} className="text-xs font-semibold text-red-700 hover:underline dark:text-red-300">
                  Quitar portada
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Precio de los sobres (oro)</span>
              {(form.single !== SUGGESTED.single || form.five !== SUGGESTED.five || form.ten !== SUGGESTED.ten) && (
                <button type="button" onClick={() => setForm((current) => ({ ...current, ...SUGGESTED }))} className="min-h-[32px] rounded-lg px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
                  Usar sugeridos (10 · 45 · 80)
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['single', 'Sobre ×1'], ['five', 'Paquete ×5'], ['ten', 'Paquete ×10']] as const).map(([key, label]) => (
                <label key={key} className="rounded-xl bg-gray-50 p-2 text-center text-xs font-semibold text-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
                  {label}
                  <input type="number" min={0} value={form[key]} onChange={(e) => set(key, clamp(e.target.valueAsNumber, 100000))} onFocus={(e) => e.target.select()} className={`${numberClass} mt-1`} />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-700 dark:text-gray-300" role="status">
              {cost
                ? `Completarlo cuesta en promedio ~${cost.gp} GP (unos ${cost.draws} cromos, contando repetidos).`
                : 'Cuando el álbum tenga cromos verás cuánto oro cuesta completarlo en promedio.'}
            </p>
          </div>

          <div>
            <span className={labelClass}>Premio al completarlo</span>
            <div className="grid grid-cols-2 gap-2">
              {([['rewardXp', 'XP'], ['rewardGp', 'GP (oro)']] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
                  {label}
                  <input type="number" min={0} max={1000} value={form[key]} onChange={(e) => set(key, clamp(e.target.valueAsNumber, 1000))} onFocus={(e) => e.target.select()} className={`${numberClass} ml-auto w-20`} />
                </label>
              ))}
            </div>
            <label htmlFor="album-badge" className="mt-2 block text-xs font-semibold text-gray-800 dark:text-gray-100">Insignia al completarlo <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span></label>
            <select id="album-badge" value={form.rewardBadgeId} onChange={(e) => set('rewardBadgeId', e.target.value)} className={`${fieldClass} story-select mt-1`}>
              <option value="">Sin insignia</option>
              {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.icon} {badge.name}</option>)}
            </select>
          </div>

          {isEdit && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-5 w-5 rounded border-gray-400 text-primary-600 focus:ring-primary-500" />
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">A la venta</span>
                <span className="block text-xs text-gray-700 dark:text-gray-300">Si lo desactivas, nadie puede comprar sobres; los estudiantes conservan sus cromos</span>
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">Cancelar</button>
          <button type="submit" disabled={!canSave} className="min-h-[44px] rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
            {isSaving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear álbum'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};
