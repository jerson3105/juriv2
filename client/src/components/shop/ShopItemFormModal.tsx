import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { AlertTriangle, Gem, ImagePlus, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmojiPicker } from '../ui/EmojiPicker';
import { CATEGORY_CONFIG, rarityForPrice, shopApi, type ItemCategory, type ItemRarity, type ShopEconomy, type ShopItem } from '../../lib/shopApi';
import { PriceTag, ShopAwning, ShopDisplay } from './ShopDisplay';
import { DEFAULT_WEEKLY_GOLD, ITEM_EXAMPLES, OFF_MESSAGE_PATTERN, SHOP_RARITY_STYLE, weeksPrice, weeksText } from './shopHelpers';

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
  /** Poción: al aprobar su uso cura HP (no levanta a quien descansa). */
  effectType: 'HEAL_HP' | null;
  effectValue: number | null;
}

interface ShopItemFormModalProps {
  target: ShopFormTarget;
  /** Ingreso semanal de la clase y bandas de precio (null mientras carga: se usa el valor por defecto). */
  economy: ShopEconomy | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: ShopItemFormData, another: boolean) => Promise<boolean>;
}

const MAX_PRICE = 100000;
// Precios rápidos en semanas de oro de la clase: primer premio, común, raro y legendario.
const PRICE_WEEKS = [1, 2, 4, 8, 12];

const initialState = (target: ShopFormTarget, weekly: number) => {
  const source = target.kind === 'edit' ? target.item : target.template;
  return {
    // Duplicar añade "(copia)"; partir de un ejemplo (sin id) usa el nombre tal cual.
    name: source ? (target.kind === 'edit' || !source.id ? source.name : `${source.name} (copia)`) : '',
    description: source?.description ?? '',
    category: (source?.category === 'SPECIAL' ? 'SPECIAL' : 'CONSUMABLE') as ItemCategory,
    price: source?.price ?? weeksPrice(1, weekly),
    icon: source?.icon || '🎁',
    // Al duplicar se copia la imagen solo si es de las subidas a la plataforma.
    imageUrl: (target.kind === 'create' && !source?.imageUrl?.startsWith('/api/uploads/shop-items/') ? null : source?.imageUrl ?? null) as string | null,
    imageChanged: target.kind === 'create' && !!source?.imageUrl?.startsWith('/api/uploads/shop-items/'),
    limited: source ? source.stock !== null : false,
    stock: source?.stock ?? 10,
    // La poción solo se mantiene en las que ya existían: un premio nuevo no toca la energía.
    heals: target.kind === 'edit' && source?.effectType === 'HEAL_HP',
    healAmount: source?.effectType === 'HEAL_HP' && source.effectValue ? source.effectValue : 20,
  };
};

type FormState = ReturnType<typeof initialState>;

const RarityChip = ({ rarity }: { rarity: ItemRarity }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${SHOP_RARITY_STYLE[rarity].chip}`}>
    <span className="flex" aria-hidden="true">
      {Array.from({ length: rarity === 'COMMON' ? 1 : rarity === 'RARE' ? 2 : 3 }, (_, index) => <Gem key={index} size={12} />)}
    </span>
    {SHOP_RARITY_STYLE[rarity].label}
  </span>
);

const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';

export const ShopItemFormModal = ({ target, economy, isSaving, onClose, onSubmit }: ShopItemFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const weekly = economy?.effectiveWeekly ?? DEFAULT_WEEKLY_GOLD;
  const [form, setForm] = useState(() => initialState(target, weekly));
  const canHeal = isEdit && target.item.effectType === 'HEAL_HP';
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

  // La rareza sale del precio (igual que en el servidor): hasta 2 semanas común, hasta 5 raro, más legendario.
  const rarity = rarityForPrice(form.price, weekly);
  const offMessage = OFF_MESSAGE_PATTERN.test(`${form.name} ${form.description}`);
  const overBimester = !!economy && form.price > economy.maxPrice;

  const setPrice = (value: number) =>
    setForm((current) => ({ ...current, price: Math.min(MAX_PRICE, Math.max(0, Math.round(Number.isFinite(value) ? value : 0))) }));

  const applyExample = (example: typeof ITEM_EXAMPLES[number]) =>
    setForm((current) => ({ ...current, name: example.name, description: example.description, category: example.category, price: weeksPrice(example.weeks, weekly), icon: example.icon }));

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
      rarity,
      price: form.price,
      icon: form.icon || '🎁',
      // Solo se envía la imagen si cambió (las antiguas pueden no cumplir el formato nuevo).
      imageUrl: form.imageChanged ? form.imageUrl : undefined,
      stock: form.limited ? Math.max(0, Math.round(form.stock || 0)) : null,
      effectType: canHeal && form.category === 'CONSUMABLE' && form.heals ? 'HEAL_HP' : null,
      effectValue: canHeal && form.category === 'CONSUMABLE' && form.heals ? Math.min(1000, Math.max(1, Math.round(form.healAmount || 1))) : null,
    }, another);
    if (saved && another) {
      setForm(initialState({ kind: 'create' }, weekly));
      nameRef.current?.focus();
    }
  };

  const preview = { name: form.name, icon: form.icon, imageUrl: form.imageUrl, rarity, category: form.category };

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
          <ShopAwning />
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
                <RarityChip rarity={rarity} />
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
            <label htmlFor="shop-item-price" className={labelClass}>
              Precio en oro <span className="font-normal text-gray-600 dark:text-gray-300">(en semanas de oro de tu clase)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRICE_WEEKS.map((weeks) => {
                const value = weeksPrice(weeks, weekly);
                return (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setPrice(value)}
                    aria-pressed={form.price === value}
                    aria-label={`${value} de oro, ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`}
                    className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center rounded-lg border px-2 leading-tight transition-colors ${
                      form.price === value ? 'border-amber-500 bg-amber-400 text-amber-950' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                    }`}
                  >
                    <span className="text-sm font-bold">{value}</span>
                    <span className="text-xs font-semibold">{weeks} sem</span>
                  </button>
                );
              })}
              <input
                id="shop-item-price"
                type="number"
                min={0}
                max={MAX_PRICE}
                value={form.price}
                onChange={(e) => setPrice(e.target.valueAsNumber)}
                onFocus={(e) => e.target.select()}
                aria-describedby="shop-item-price-help"
                className="h-11 w-24 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <p id="shop-item-price-help" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              {form.price === 0 ? 'Gratis' : `${weeksText(form.price, weekly)} de oro de un estudiante`}
              <span aria-hidden="true">·</span>
              <RarityChip rarity={rarity} />
            </p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              La rareza sale del precio: común hasta 2 semanas, raro hasta 5 y legendario más. Conviene tener siempre un primer premio de una semana o menos.
            </p>
            {overBimester && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Es más de un bimestre de ahorro: pocos estudiantes llegarán.
              </p>
            )}
            {economy && economy.weeklyGold === 0 && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Tus estudiantes aún no ganan oro: calculamos con {DEFAULT_WEEKLY_GOLD} de oro por semana. Da oro en tus comportamientos positivos para que puedan comprar.
              </p>
            )}
          </div>

          {canHeal && form.category === 'CONSUMABLE' && (
            <div>
              <span className={labelClass}>Efecto al usarla</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Efecto al usarla">
                  {([[false, 'Ninguno'], [true, '❤️ Cura energía (HP)']] as const).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => set('heals', value)}
                      aria-pressed={form.heals === value}
                      className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${form.heals === value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.heals && (
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    +
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={form.healAmount}
                      onChange={(e) => set('healAmount', parseInt(e.target.value) || 0)}
                      className="h-10 w-20 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    HP al aprobar su uso
                  </label>
                )}
              </div>
              {form.heals && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">No levanta a quien está descansando (0 HP): para eso está la misión de recuperación.</p>}
            </div>
          )}

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

          {offMessage && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Parece un premio que toca notas, plazos, XP o energía, o una golosina. Funcionan mejor los privilegios, las responsabilidades y las experiencias: la nota refleja lo aprendido y la energía, la convivencia.
            </p>
          )}
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
