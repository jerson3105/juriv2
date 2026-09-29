import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmojiPicker } from '../ui/EmojiPicker';
import { CATEGORY_CONFIG, shopApi, type ItemCategory, type ItemRarity, type ShopItem } from '../../lib/shopApi';
import { PriceTag, ShopDisplay } from './ShopDisplay';
import { ITEM_EXAMPLES, PRICE_CHIPS, PRICE_PRESETS, SHOP_RARITY_ORDER, SHOP_RARITY_STYLE } from './shopHelpers';

export type ShopFormTarget = { kind: 'create'; template?: ShopItem } | { kind: 'edit'; item: ShopItem };

export interface ShopItemFormData {
  name: string;
  description: string | null;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number;
  icon: string;
  // undefined = no cambiar (imagen antigua); null = quitar; string = nueva imagen subida
  imageUrl?: string | null;
  stock: number | null;
}

interface ShopItemFormModalProps {
  target: ShopFormTarget;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: ShopItemFormData, another: boolean) => Promise<boolean>;
}

const MAX_PRICE = 100000;

const initialState = (target: ShopFormTarget) => {
  const source = target.kind === 'edit' ? target.item : target.template;
  return {
    // Duplicar añade "(copia)"; partir de un ejemplo (sin id) usa el nombre tal cual.
    name: source ? (target.kind === 'edit' || !source.id ? source.name : `${source.name} (copia)`) : '',
    description: source?.description ?? '',
    category: (source?.category === 'SPECIAL' ? 'SPECIAL' : 'CONSUMABLE') as ItemCategory,
    rarity: (source?.rarity ?? 'COMMON') as ItemRarity,
    price: source?.price ?? PRICE_PRESETS.COMMON,
    priceTouched: !!source,
    icon: source?.icon || '🎁',
    // Al duplicar se copia la imagen solo si es de las subidas a la plataforma.
    imageUrl: (target.kind === 'create' && !source?.imageUrl?.startsWith('/api/uploads/shop-items/') ? null : source?.imageUrl ?? null) as string | null,
    imageChanged: target.kind === 'create' && !!source?.imageUrl?.startsWith('/api/uploads/shop-items/'),
    limited: source ? source.stock !== null : false,
    stock: source?.stock ?? 10,
  };
};

type FormState = ReturnType<typeof initialState>;

const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';

export const ShopItemFormModal = ({ target, isSaving, onClose, onSubmit }: ShopItemFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const [form, setForm] = useState(() => initialState(target));
  const [isUploading, setIsUploading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isPresent = useIsPresent();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const canSave = form.name.trim().length > 0 && !isSaving && !isUploading;

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isPresent || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('[aria-label="Selector de iconos"]')) return;
    onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const setRarity = (rarity: ItemRarity) =>
    setForm((current) => (current.priceTouched ? { ...current, rarity } : { ...current, rarity, price: PRICE_PRESETS[rarity] }));

  const setPrice = (value: number) =>
    setForm((current) => ({ ...current, price: Math.min(MAX_PRICE, Math.max(0, Math.round(Number.isFinite(value) ? value : 0))), priceTouched: true }));

  const applyExample = (example: typeof ITEM_EXAMPLES[number]) =>
    setForm((current) => ({ ...current, name: example.name, description: example.description, category: example.category, rarity: example.rarity, price: example.price, icon: example.icon, priceTouched: true }));

  const uploadImage = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe pesar menos de 2 MB');
      return;
    }
    setIsUploading(true);
    try {
      const url = await shopApi.uploadImage(file);
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
      category: form.category,
      rarity: form.rarity,
      price: form.price,
      icon: form.icon || '🎁',
      // Solo se envía la imagen si cambió (las antiguas pueden no cumplir el formato nuevo).
      imageUrl: form.imageChanged ? form.imageUrl : undefined,
      stock: form.limited ? Math.max(0, Math.round(form.stock || 0)) : null,
    }, another);
    if (saved && another) {
      setForm(initialState({ kind: 'create' }));
      nameRef.current?.focus();
    }
  };

  const preview = { name: form.name, icon: form.icon, imageUrl: form.imageUrl, rarity: form.rarity, category: form.category };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
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
        aria-labelledby="shop-form-title"
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        {/* Vista previa en vivo, como se verá en la tienda */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="h-2.5 w-full bg-[repeating-linear-gradient(90deg,#2563eb_0_16px,#ffffff_16px_32px)] dark:bg-[repeating-linear-gradient(90deg,#3b82f6_0_16px,#1f2937_16px_32px)]" aria-hidden="true" />
          <div className="flex items-center gap-4 px-5 py-3">
            <div className="w-32 flex-shrink-0">
              <ShopDisplay item={preview} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="shop-form-title" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {isEdit ? 'Editar artículo' : 'Nuevo artículo'}
              </h2>
              <p className={`truncate text-lg font-black ${form.name ? 'text-gray-900 dark:text-white' : 'italic text-gray-600 dark:text-gray-400'}`}>
                {form.name || 'Nombre del artículo'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <PriceTag price={form.price} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SHOP_RARITY_STYLE[form.rarity].chip}`}>{SHOP_RARITY_STYLE[form.rarity].label}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!isEdit && !target.template && (
            <div>
              <span className={labelClass}>Ideas rápidas</span>
              <div className="flex flex-wrap gap-1.5">
                {ITEM_EXAMPLES.map((example) => (
                  <button
                    key={example.name}
                    type="button"
                    onClick={() => applyExample(example)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:border-primary-400 hover:bg-primary-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-primary-900/30"
                  >
                    <span aria-hidden="true">{example.icon}</span>
                    {example.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div>
              <span className={labelClass}>Icono</span>
              {form.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, imageUrl: null, imageChanged: true }))}
                  className="flex h-11 items-center rounded-xl border-2 border-gray-300 px-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
                  title="Quitar la imagen y usar el icono"
                >
                  Quitar imagen
                </button>
              ) : (
                <EmojiPicker
                  value={form.icon}
                  onChange={(icon) => set('icon', icon)}
                  ariaLabel="Cambiar icono del artículo"
                  triggerClassName="flex h-11 w-14 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-2xl hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="shop-item-name" className={labelClass}>Nombre</label>
              <input
                id="shop-item-name"
                ref={nameRef}
                type="text"
                maxLength={100}
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ej: Elegir asiento"
                className={fieldClass}
              />
            </div>
            <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700" title="Subir imagen propia (PNG, JPG, GIF o WEBP, máx. 2 MB)">
              <ImagePlus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{isUploading ? 'Subiendo...' : 'Imagen'}</span>
              <span className="sr-only sm:hidden">Subir imagen</span>
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
          </div>

          <div>
            <span className={labelClass}>Tipo</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de artículo">
              {(['CONSUMABLE', 'SPECIAL'] as ItemCategory[]).map((category) => {
                const active = form.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => set('category', category)}
                    aria-pressed={active}
                    className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                      active ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">{CATEGORY_CONFIG[category].icon} {CATEGORY_CONFIG[category].label}</span>
                    <span className="block text-xs text-gray-700 dark:text-gray-300">{CATEGORY_CONFIG[category].description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className={labelClass}>Rareza</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Rareza">
              {SHOP_RARITY_ORDER.map((rarity) => {
                const active = form.rarity === rarity;
                return (
                  <button
                    key={rarity}
                    type="button"
                    onClick={() => setRarity(rarity)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-xl border-2 px-2 text-sm font-bold transition-colors ${
                      active ? `${SHOP_RARITY_STYLE[rarity].card} ${SHOP_RARITY_STYLE[rarity].chip}` : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200'
                    }`}
                  >
                    {SHOP_RARITY_STYLE[rarity].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="shop-item-price" className={labelClass}>
              Precio en oro <span className="font-normal text-gray-600 dark:text-gray-300">(sugerido para {SHOP_RARITY_STYLE[form.rarity].label.toLowerCase()}: {PRICE_PRESETS[form.rarity]})</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRICE_CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrice(value)}
                  aria-pressed={form.price === value}
                  className={`min-h-[40px] min-w-[52px] rounded-lg border px-2 text-sm font-bold transition-colors ${
                    form.price === value ? 'border-amber-500 bg-amber-400 text-amber-950' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {value}
                </button>
              ))}
              <input
                id="shop-item-price"
                type="number"
                min={0}
                max={MAX_PRICE}
                value={form.price}
                onChange={(e) => setPrice(e.target.valueAsNumber)}
                onFocus={(e) => e.target.select()}
                className="h-10 w-24 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <span className={labelClass}>Unidades disponibles</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Unidades disponibles">
                {([[false, 'Sin límite'], [true, 'Limitadas']] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set('limited', value)}
                    aria-pressed={form.limited === value}
                    className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${form.limited === value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.limited && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  Quedan
                  <input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => set('stock', parseInt(e.target.value) || 0)}
                    className="h-10 w-20 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="shop-item-description" className={labelClass}>
              Descripción <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, la verán los estudiantes)</span>
            </label>
            <textarea
              id="shop-item-description"
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void submit(false);
                }
              }}
              placeholder="Qué recibe el estudiante al comprarlo"
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {!canSave && !isSaving && !isUploading && (
            <p className="mb-2 text-xs text-gray-700 dark:text-gray-300" role="status">Escribe un nombre para guardar.</p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={!canSave}
                className="min-h-[44px] rounded-xl border-2 border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-500 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/30 dark:disabled:border-gray-600 dark:disabled:text-gray-400"
              >
                Guardar y crear otro
              </button>
            )}
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-[44px] rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
            >
              {isSaving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Poner a la venta'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
};
