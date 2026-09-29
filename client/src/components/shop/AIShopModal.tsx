import { useCallback, useEffect, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { Check, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CATEGORY_CONFIG, shopApi, type ItemCategory, type ItemRarity } from '../../lib/shopApi';
import { PriceTag } from './ShopDisplay';
import { SHOP_RARITY_ORDER, SHOP_RARITY_STYLE } from './shopHelpers';

export interface GeneratedShopItem {
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number;
  icon: string;
}

interface AIShopModalProps {
  onClose: () => void;
  onImport: (items: GeneratedShopItem[]) => Promise<void>;
}

type ItemType = 'MIXED' | 'PRIVILEGES' | 'REWARDS' | 'POWERS';

const EXAMPLES = [
  { emoji: '💺', title: 'Privilegios', desc: 'Elegir asiento, tiempo extra en exámenes, entregar tarde, ser ayudante del día' },
  { emoji: '🎁', title: 'Recompensas', desc: 'Stickers, certificados, tiempo libre, poner música en clase' },
  { emoji: '⚡', title: 'Poderes', desc: 'Escudo anti-HP, duplicar XP del día, revivir puntos, congelar HP por un día' },
  { emoji: '🎮', title: 'Temática gamer', desc: 'Pociones, escudos mágicos, power-ups, monedas doradas' },
  { emoji: '⚔️', title: 'Aventura medieval', desc: 'Pergamino del conocimiento, poción de sabiduría, escudo del guardián, amuleto de la suerte' },
  { emoji: '🚀', title: 'Espacial', desc: 'Combustible extra, escudo de energía, teletransporte, visión de rayos X' },
];

const TYPES: { value: ItemType; label: string }[] = [
  { value: 'MIXED', label: 'Variado' },
  { value: 'PRIVILEGES', label: 'Privilegios' },
  { value: 'REWARDS', label: 'Recompensas' },
  { value: 'POWERS', label: 'Poderes' },
];

const LEVELS = ['Primaria (6-11 años)', 'Secundaria (12-16 años)', 'Preparatoria/Bachillerato', 'Universidad'];

const clampCount = (value: number) => Math.min(15, Math.max(3, value || 8));
const clampPrice = (value: number) => Math.min(100000, Math.max(0, Math.round(value || 0)));

const chip = (active: boolean) =>
  `rounded-xl border-2 transition-colors ${active ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'}`;
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';
const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400';

export const AIShopModal = ({ onClose, onImport }: AIShopModalProps) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(8);
  const [itemType, setItemType] = useState<ItemType>('MIXED');
  const [generated, setGenerated] = useState<GeneratedShopItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const isPresent = useIsPresent();

  const busy = isGenerating || isImporting;
  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !busy && !event.defaultPrevented) onClose();
  }, [isPresent, busy, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const result = await shopApi.generateWithAI({ description, level, count: clampCount(count), itemType });
      const items = (result.data?.items ?? []).map((item) => ({
        name: String(item.name ?? '').slice(0, 100),
        description: String(item.description ?? '').slice(0, 500),
        category: (item.category === 'SPECIAL' ? 'SPECIAL' : 'CONSUMABLE') as ItemCategory,
        rarity: (SHOP_RARITY_ORDER.includes(item.rarity) ? item.rarity : 'COMMON') as ItemRarity,
        price: clampPrice(item.price),
        icon: String(item.icon || '🎁').slice(0, 50),
      })).filter((item) => item.name.trim());
      if (items.length === 0) {
        toast.error(result.message || 'La IA no devolvió artículos');
        return;
      }
      setGenerated(items);
      setSelected(new Set(items.map((_, i) => i)));
      setEditingIndex(null);
      setStep('preview');
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudieron generar artículos');
    } finally {
      setIsGenerating(false);
    }
  };

  const update = (index: number, changes: Partial<GeneratedShopItem>) =>
    setGenerated((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const remove = (index: number) => {
    setGenerated((prev) => prev.filter((_, i) => i !== index));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
    setEditingIndex(null);
  };

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const importSelected = async () => {
    const list = generated.filter((_, i) => selected.has(i));
    if (list.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(list);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-shop-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 id="ai-shop-title" className="text-lg font-bold text-gray-900 dark:text-white">{step === 'form' ? 'Surtir la tienda con IA' : 'Revisa antes de poner a la venta'}</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">{step === 'form' ? 'Cuenta qué quieres ofrecer' : `${selected.size} de ${generated.length} seleccionados`}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'form' ? (
            <div className="space-y-5">
              <div>
                <span className={labelClass}>Ideas rápidas</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EXAMPLES.map((example) => (
                    <button key={example.title} type="button" onClick={() => setDescription(example.desc)} aria-pressed={description === example.desc} className={`${chip(description === example.desc)} flex min-h-[44px] items-center gap-2 px-3 py-2 text-left`}>
                      <span className="text-lg" aria-hidden="true">{example.emoji}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{example.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="ai-shop-description" className={labelClass}>O escribe tu propia idea</label>
                <textarea id="ai-shop-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué premios o privilegios quieres ofrecer..." className={`${fieldClass} h-auto resize-none py-2.5`} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-shop-level" className={labelClass}>Nivel educativo</label>
                  <select id="ai-shop-level" value={level} onChange={(e) => setLevel(e.target.value)} className={`${fieldClass} story-select`}>
                    <option value="">Selecciona...</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ai-shop-count" className={labelClass}>¿Cuántos? <span className="font-normal text-gray-600 dark:text-gray-300">(3 a 15)</span></label>
                  <input id="ai-shop-count" type="number" min={3} max={15} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 0)} onBlur={() => setCount(clampCount)} className={fieldClass} />
                </div>
              </div>
              <div>
                <span className={labelClass}>Tipo de artículos</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TYPES.map((type) => (
                    <button key={type.value} type="button" aria-pressed={itemType === type.value} onClick={() => setItemType(type.value)} className={`${chip(itemType === type.value)} min-h-[44px] px-2 text-sm font-semibold text-gray-900 dark:text-white`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {generated.map((item, index) => {
                if (editingIndex === index) {
                  return (
                    <li key={index} className="space-y-3 rounded-xl border-2 border-primary-500 bg-primary-50 p-4 dark:bg-primary-900/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary-800 dark:text-primary-200">Editando</span>
                        <button type="button" onClick={() => remove(index)} aria-label={`Descartar ${item.name}`} title="Descartar" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input type="text" value={item.name} maxLength={100} onChange={(e) => update(index, { name: e.target.value })} aria-label="Nombre" className={fieldClass} />
                        <input type="text" value={item.description} maxLength={500} onChange={(e) => update(index, { description: e.target.value })} aria-label="Descripción" className={fieldClass} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={item.rarity} onChange={(e) => update(index, { rarity: e.target.value as ItemRarity })} aria-label="Rareza" className={`${fieldClass} story-select w-auto`}>
                          {SHOP_RARITY_ORDER.map((r) => <option key={r} value={r}>{SHOP_RARITY_STYLE[r].label}</option>)}
                        </select>
                        <select value={item.category} onChange={(e) => update(index, { category: e.target.value as ItemCategory })} aria-label="Tipo" className={`${fieldClass} story-select w-auto`}>
                          {(['CONSUMABLE', 'SPECIAL'] as ItemCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>)}
                        </select>
                        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                          Precio
                          <input type="number" min={0} value={item.price} onChange={(e) => update(index, { price: clampPrice(parseInt(e.target.value)) })} className="h-9 w-24 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                        </label>
                      </div>
                      <button type="button" onClick={() => setEditingIndex(null)} className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700">
                        <Check size={16} aria-hidden="true" /> Listo
                      </button>
                    </li>
                  );
                }
                const isSelected = selected.has(index);
                return (
                  <li key={index} className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors ${isSelected ? `bg-white dark:bg-gray-800 ${SHOP_RARITY_STYLE[item.rarity].card}` : 'border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
                    <button type="button" onClick={() => toggle(index)} aria-pressed={isSelected} aria-label={`${isSelected ? 'Quitar de la importación' : 'Incluir en la importación'}: ${item.name}`} className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                      <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                        {isSelected && <Check size={13} />}
                      </span>
                    </button>
                    <span className="text-3xl" aria-hidden="true">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-gray-900 dark:text-white">{item.name}</span>
                      {item.description && <span className="block truncate text-xs text-gray-700 dark:text-gray-300">{item.description}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${SHOP_RARITY_STYLE[item.rarity].chip}`}>{SHOP_RARITY_STYLE[item.rarity].label}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{CATEGORY_CONFIG[item.category].label}</span>
                      </span>
                    </span>
                    <PriceTag price={item.price} />
                    <button type="button" onClick={() => setEditingIndex(index)} aria-label={`Editar ${item.name}`} title="Editar" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white">
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {step === 'preview' ? (
            <button type="button" onClick={() => setStep('form')} disabled={busy} className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">← Volver</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-700">Cancelar</button>
            {step === 'form' ? (
              <button type="button" onClick={() => void generate()} disabled={!description.trim() || !level || isGenerating} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden="true" />
                    Generar
                  </>
                )}
              </button>
            ) : (
              <button type="button" onClick={() => void importSelected()} disabled={selected.size === 0 || isImporting} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
                <Check size={16} aria-hidden="true" />
                {isImporting ? 'Poniendo a la venta...' : `Poner a la venta ${selected.size}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
