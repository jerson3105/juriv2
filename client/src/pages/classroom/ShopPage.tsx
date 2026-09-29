import { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Backpack, Plus, Search, Shirt, ShoppingBag, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { AvatarShopManager } from '../../components/classroom/AvatarShopManager';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { shopApi, type ItemCategory, type ItemRarity, type ShopItem } from '../../lib/shopApi';
import { studentLabel } from '../../components/badges/badgeHelpers';
import { ShopItemCard } from '../../components/shop/ShopItemCard';
import { ShopItemFormModal, type ShopFormTarget, type ShopItemFormData } from '../../components/shop/ShopItemFormModal';
import { GiveItemModal } from '../../components/shop/GiveItemModal';
import { PendingTray } from '../../components/shop/PendingTray';
import { ShopSettingsBar } from '../../components/shop/ShopSettingsBar';
import { InventoryPanel } from '../../components/shop/InventoryPanel';
import { AIShopModal, type GeneratedShopItem } from '../../components/shop/AIShopModal';
import { ITEM_EXAMPLES, SHOP_RARITY_ORDER, SHOP_RARITY_STYLE, shopInventoryKey } from '../../components/shop/shopHelpers';

type SortKey = 'rarity' | 'price' | 'sold' | 'name';
const SORT_KEY = 'juried:shop-sort';
const readSort = (): SortKey => {
  try {
    const value = localStorage.getItem(SORT_KEY);
    return value === 'price' || value === 'sold' || value === 'name' ? value : 'rarity';
  } catch {
    return 'rarity';
  }
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const secondaryButton =
  'inline-flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
const segment = (active: boolean) =>
  `min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors ${active ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`;

export const ShopPage = () => {
  const { classroom, refetch } = useOutletContext<{ classroom: Classroom; refetch?: () => void }>();
  const queryClient = useQueryClient();
  const itemsKey = ['shop-items', classroom.id];
  const [tab, setTab] = useState<'items' | 'avatars'>('items');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>(readSort);
  const [formTarget, setFormTarget] = useState<ShopFormTarget | null>(null);
  const [giveItem, setGiveItem] = useState<ShopItem | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: itemsKey,
    queryFn: () => shopApi.getItems(classroom.id),
  });
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const { data: inventory } = useQuery({
    queryKey: shopInventoryKey(classroom.id),
    queryFn: () => shopApi.getInventory(classroom.id),
  });

  const showCharacterName = classroom.showCharacterName ?? true;
  const studentsById = useMemo(() => new Map((classroomData?.students ?? []).map((s) => [s.id, s])), [classroomData]);
  const nameOf = useCallback((studentId: string, fallback: string | null) => {
    const student = studentsById.get(studentId);
    return student ? studentLabel(student, showCharacterName) : fallback || 'Estudiante';
  }, [studentsById, showCharacterName]);

  // Unidades vendidas (compras y regalos entre estudiantes; no cuenta lo que diste tú).
  const soldByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory?.owned ?? []) {
      if (row.purchaseType === 'TEACHER') continue;
      map.set(row.item.id, (map.get(row.item.id) ?? 0) + row.quantity);
    }
    return map;
  }, [inventory]);
  const totalSold = [...soldByItem.values()].reduce((a, b) => a + b, 0);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    const list = items.filter((item) =>
      (!term || `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('es').includes(term))
      && (rarityFilter === 'ALL' || item.rarity === rarityFilter)
      && (categoryFilter === 'ALL' || item.category === categoryFilter));
    const byName = (a: ShopItem, b: ShopItem) => a.name.localeCompare(b.name, 'es');
    return [...list].sort((a, b) => {
      if (sort === 'name') return byName(a, b);
      if (sort === 'price') return a.price - b.price || byName(a, b);
      if (sort === 'sold') return (soldByItem.get(b.id) ?? 0) - (soldByItem.get(a.id) ?? 0) || byName(a, b);
      return SHOP_RARITY_ORDER.indexOf(b.rarity) - SHOP_RARITY_ORDER.indexOf(a.rarity) || a.price - b.price;
    });
  }, [items, search, rarityFilter, categoryFilter, sort, soldByItem]);

  const refreshItems = () => queryClient.invalidateQueries({ queryKey: itemsKey });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: ShopItemFormData; id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description ?? undefined,
        category: data.category,
        rarity: data.rarity,
        price: data.price,
        icon: data.icon,
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      };
      if (id) await shopApi.updateItem(id, { ...payload, description: data.description, stock: data.stock });
      else await shopApi.createItem({ ...payload, classroomId: classroom.id, imageUrl: data.imageUrl ?? undefined, stock: data.stock ?? undefined });
    },
  });

  const handleSave = async (data: ShopItemFormData, another: boolean) => {
    const id = formTarget?.kind === 'edit' ? formTarget.item.id : undefined;
    try {
      await saveMutation.mutateAsync({ data, id });
      refreshItems();
      toast.success(id ? `Guardado: ${data.name}` : `A la venta: ${data.name}`);
      if (!another) setFormTarget(null);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el artículo'));
      return false;
    }
  };

  const restore = async (item: ShopItem) => {
    try {
      await shopApi.restoreItem(item.id);
      toast.success(`De vuelta en la tienda: ${item.name}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restaurar'));
    } finally {
      refreshItems();
    }
  };

  // Se quita al instante; los estudiantes conservan lo que ya compraron y "Deshacer" lo devuelve a la venta.
  const handleDelete = async (item: ShopItem) => {
    await queryClient.cancelQueries({ queryKey: itemsKey });
    const previous = queryClient.getQueryData<ShopItem[]>(itemsKey);
    queryClient.setQueryData<ShopItem[]>(itemsKey, (current = []) => current.filter((i) => i.id !== item.id));
    try {
      await shopApi.deleteItem(item.id);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Quitado de la tienda: {item.name}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void restore(item);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
    } catch (error) {
      queryClient.setQueryData(itemsKey, previous);
      toast.error(errorMessage(error, 'No se pudo quitar'));
    } finally {
      refreshItems();
    }
  };

  const handleImport = async (generated: GeneratedShopItem[]) => {
    const outcomes = await Promise.allSettled(generated.map((item) => shopApi.createItem({
      classroomId: classroom.id,
      name: item.name,
      description: item.description || undefined,
      category: item.category,
      rarity: item.rarity,
      price: item.price,
      icon: item.icon,
    })));
    const created = outcomes.filter((o) => o.status === 'fulfilled').length;
    refreshItems();
    if (created === 0) {
      toast.error('No se pudo poner a la venta ningún artículo');
      return;
    }
    const failed = generated.length - created;
    if (failed === 0) toast.success(`${created} artículo${created !== 1 ? 's' : ''} a la venta`);
    else toast.error(`Se pusieron a la venta ${created} de ${generated.length}; ${failed} fallaron`);
    setShowAI(false);
  };

  const changeSort = (next: SortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Sin almacenamiento: el orden vale solo para esta visita.
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/30" aria-hidden="true">
            <ShoppingBag size={22} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Tienda</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {items.length === 0 ? 'Premios y privilegios que tus estudiantes compran con su oro' : `${items.length} artículo${items.length !== 1 ? 's' : ''} a la venta · ${totalSold} vendido${totalSold !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {tab === 'items' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowInventory(true)} className={secondaryButton}>
              <Backpack size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
              Inventario
            </button>
            <button type="button" onClick={() => setShowAI(true)} className={secondaryButton}>
              <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
              Surtir con IA
            </button>
            <button
              type="button"
              onClick={() => setFormTarget({ kind: 'create' })}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 sm:flex-none"
            >
              <Plus size={16} aria-hidden="true" />
              Nuevo artículo
            </button>
          </div>
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800" role="tablist" aria-label="Secciones de la tienda">
        {([['items', 'Artículos', ShoppingBag], ['avatars', 'Avatares', Shirt]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${tab === value ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'avatars' ? (
        <AvatarShopManager classroomId={classroom.id} />
      ) : (
        <>
          <ShopSettingsBar key={`${classroom.dailyPurchaseLimit ?? 'none'}`} classroom={classroom} onSaved={refetch} />
          <PendingTray classroomId={classroom.id} nameOf={nameOf} />

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-800/60">
              <div className="mx-auto flex w-fit gap-3 text-4xl" aria-hidden="true"><span>💺</span><span>🛍️</span><span>⭐</span></div>
              <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Abre tu tienda</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
                Tus estudiantes gastan el oro que ganan en premios y privilegios. Tú apruebas cuándo se usan.
              </p>
              <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
                {ITEM_EXAMPLES.map((example) => (
                  <button
                    key={example.name}
                    type="button"
                    onClick={() => setFormTarget({ kind: 'create', template: { ...example, id: '', classroomId: classroom.id, imageUrl: null, effectType: null, effectValue: null, stock: null, isActive: true, createdAt: '', updatedAt: '', name: example.name } as ShopItem })}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:border-primary-400 hover:bg-primary-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-primary-900/30"
                  >
                    <span aria-hidden="true">{example.icon}</span>
                    {example.name}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setFormTarget({ kind: 'create' })} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">
                  <Plus size={16} aria-hidden="true" />
                  Crear artículo
                </button>
                <button type="button" onClick={() => setShowAI(true)} className={secondaryButton}>
                  <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
                  Surtir con IA
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar artículos"
                    aria-label="Buscar artículos"
                    className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Rareza">
                    {(['ALL', ...SHOP_RARITY_ORDER] as const).map((rarity) => (
                      <button key={rarity} type="button" onClick={() => setRarityFilter(rarity)} aria-pressed={rarityFilter === rarity} className={segment(rarityFilter === rarity)}>
                        {rarity === 'ALL' ? 'Todas' : SHOP_RARITY_STYLE[rarity].label}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-xl border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800" role="group" aria-label="Tipo">
                    {([['ALL', 'Todos'], ['CONSUMABLE', 'Consumibles'], ['SPECIAL', 'Permanentes']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setCategoryFilter(value)} aria-pressed={categoryFilter === value} className={segment(categoryFilter === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                    Ordenar
                    <select value={sort} onChange={(e) => changeSort(e.target.value as SortKey)} className="story-select h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                      <option value="rarity">Rareza</option>
                      <option value="price">Precio</option>
                      <option value="sold">Más vendidos</option>
                      <option value="name">Nombre</option>
                    </select>
                  </label>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Ningún artículo coincide con los filtros.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  <AnimatePresence initial={false}>
                    {visible.map((item, index) => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        index={index}
                        sold={soldByItem.get(item.id) ?? 0}
                        onGive={() => setGiveItem(item)}
                        onEdit={() => setFormTarget({ kind: 'edit', item })}
                        onDuplicate={() => setFormTarget({ kind: 'create', template: item })}
                        onDelete={() => void handleDelete(item)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}
        </>
      )}

      <AnimatePresence>
        {formTarget && (
          <ShopItemFormModal
            key={formTarget.kind === 'edit' ? `edit-${formTarget.item.id}` : `create-${formTarget.template?.name ?? 'new'}`}
            target={formTarget}
            isSaving={saveMutation.isPending}
            onClose={() => setFormTarget(null)}
            onSubmit={handleSave}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {giveItem && (
          <GiveItemModal key={giveItem.id} item={giveItem} classroomId={classroom.id} showCharacterName={showCharacterName} onClose={() => setGiveItem(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showInventory && <InventoryPanel key="inventory" classroomId={classroom.id} nameOf={nameOf} onClose={() => setShowInventory(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAI && <AIShopModal key="ai" onClose={() => setShowAI(false)} onImport={handleImport} />}
      </AnimatePresence>
    </div>
  );
};
