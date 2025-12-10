import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Coins,
  Check,
  X,
  Shirt,
  Crown,
  Footprints,
  Sparkles,
  Filter,
  SortAsc,
  SortDesc,
  History,
  Package,
  ArrowUpDown,
  Star,
  Gem,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { AvatarPreview } from './AvatarRenderer';
import { 
  avatarApi, 
  type AvatarSlot, 
  type ClassroomShopItem,
  type AvatarGender,
  type ItemRarity,
  SLOT_LABELS,
  RARITY_COLORS,
} from '../../lib/avatarApi';
import toast from 'react-hot-toast';

interface AvatarShopProps {
  studentProfile: {
    id: string;
    classroomId: string;
    gp: number;
    avatarGender: AvatarGender;
  };
  onClose?: () => void;
}

const SLOT_ICONS: Record<AvatarSlot, React.ReactNode> = {
  HEAD: <Crown className="w-4 h-4" />,
  HAIR: <Sparkles className="w-4 h-4" />,
  EYES: <Sparkles className="w-4 h-4" />,
  TOP: <Shirt className="w-4 h-4" />,
  BOTTOM: <Shirt className="w-4 h-4" />,
  LEFT_HAND: <Sparkles className="w-4 h-4" />,
  RIGHT_HAND: <Sparkles className="w-4 h-4" />,
  SHOES: <Footprints className="w-4 h-4" />,
  BACK: <Sparkles className="w-4 h-4" />,
  FLAG: <Sparkles className="w-4 h-4" />,
  BACKGROUND: <Sparkles className="w-4 h-4" />,
};

type SortOption = 'price_asc' | 'price_desc' | 'name' | 'rarity';
type TabOption = 'shop' | 'inventory' | 'history';

export const AvatarShop = ({ studentProfile, onClose }: AvatarShopProps) => {
  const queryClient = useQueryClient();
  
  // Estados de UI
  const [activeTab, setActiveTab] = useState<TabOption>('shop');
  const [selectedSlot, setSelectedSlot] = useState<AvatarSlot | 'ALL'>('ALL');
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('price_asc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados de preview y compra
  const [previewItem, setPreviewItem] = useState<ClassroomShopItem | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState<ClassroomShopItem | null>(null);

  // Obtener items de la tienda de la clase
  const { data: shopItems = [], isLoading } = useQuery({
    queryKey: ['avatar-shop', studentProfile.classroomId, studentProfile.avatarGender],
    queryFn: () => avatarApi.getClassroomShopItems(studentProfile.classroomId, studentProfile.avatarGender),
  });

  // Obtener items comprados
  const { data: purchases = [] } = useQuery({
    queryKey: ['avatar-purchases', studentProfile.id],
    queryFn: () => avatarApi.getStudentPurchases(studentProfile.id),
  });

  // Obtener items equipados
  const { data: equippedItems = [] } = useQuery({
    queryKey: ['avatar-equipped', studentProfile.id],
    queryFn: () => avatarApi.getEquippedItems(studentProfile.id),
  });

  // IDs de items ya comprados
  const purchasedItemIds = useMemo(() => 
    new Set(purchases.map((p: { avatarItemId: string }) => p.avatarItemId)), 
    [purchases]
  );

  // Items equipados formateados para el renderer
  const equippedForRenderer = useMemo(() => 
    equippedItems.map(item => ({
      slot: item.slot,
      imagePath: item.avatarItem.imagePath,
      layerOrder: item.avatarItem.layerOrder,
    })),
    [equippedItems]
  );

  // Orden de rareza para ordenamiento
  const RARITY_ORDER: Record<ItemRarity, number> = { COMMON: 1, RARE: 2, LEGENDARY: 3 };

  // Filtrar y ordenar items
  const filteredItems = useMemo(() => {
    let items = [...shopItems];
    
    // Filtrar por slot
    if (selectedSlot !== 'ALL') {
      items = items.filter(item => item.avatarItem.slot === selectedSlot);
    }
    
    // Filtrar por rareza
    if (selectedRarity !== 'ALL') {
      items = items.filter(item => item.avatarItem.rarity === selectedRarity);
    }
    
    // Ordenar
    switch (sortBy) {
      case 'price_asc':
        items.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        items.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        items.sort((a, b) => a.avatarItem.name.localeCompare(b.avatarItem.name));
        break;
      case 'rarity':
        items.sort((a, b) => RARITY_ORDER[b.avatarItem.rarity] - RARITY_ORDER[a.avatarItem.rarity]);
        break;
    }
    
    return items;
  }, [shopItems, selectedSlot, selectedRarity, sortBy]);

  // Mutation para comprar
  const purchaseMutation = useMutation({
    mutationFn: (avatarItemId: string) => 
      avatarApi.purchaseItem(studentProfile.id, studentProfile.classroomId, avatarItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      toast.success(`¡Compraste ${itemToBuy?.avatarItem.name}!`);
      setShowConfirmModal(false);
      setItemToBuy(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al comprar');
    },
  });

  // Mutation para equipar
  const equipMutation = useMutation({
    mutationFn: (avatarItemId: string) => 
      avatarApi.equipItem(studentProfile.id, avatarItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-equipped'] });
      toast.success('¡Item equipado!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al equipar');
    },
  });

  // Mutation para desequipar
  const unequipMutation = useMutation({
    mutationFn: (slot: AvatarSlot) => 
      avatarApi.unequipItem(studentProfile.id, slot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-equipped'] });
      toast.success('Item desequipado');
    },
  });

  const handleBuyClick = (item: ClassroomShopItem) => {
    setItemToBuy(item);
    setShowConfirmModal(true);
  };

  const handleConfirmPurchase = () => {
    if (itemToBuy) {
      purchaseMutation.mutate(itemToBuy.avatarItemId);
    }
  };

  const slots: (AvatarSlot | 'ALL')[] = ['ALL', 'HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'SHOES', 'LEFT_HAND', 'RIGHT_HAND', 'BACK', 'FLAG', 'BACKGROUND'];
  const rarities: (ItemRarity | 'ALL')[] = ['ALL', 'COMMON', 'RARE', 'LEGENDARY'];

  const RARITY_LABELS: Record<ItemRarity | 'ALL', string> = {
    ALL: 'Todas',
    COMMON: 'Común',
    RARE: 'Raro',
    LEGENDARY: 'Legendario',
  };

  const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'price_asc', label: 'Precio: Menor a Mayor', icon: <SortAsc className="w-4 h-4" /> },
    { value: 'price_desc', label: 'Precio: Mayor a Menor', icon: <SortDesc className="w-4 h-4" /> },
    { value: 'name', label: 'Nombre A-Z', icon: <ArrowUpDown className="w-4 h-4" /> },
    { value: 'rarity', label: 'Rareza', icon: <Gem className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center ring-4 ring-purple-200">
            <ShoppingBag className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tienda de Avatares</h1>
            <p className="text-sm text-gray-500">Personaliza tu personaje</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Balance */}
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 rounded-xl">
            <Coins className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-amber-700">{studentProfile.gp}</span>
            <span className="text-amber-600 text-sm">GP</span>
          </div>
          
          {onClose && (
            <Button variant="secondary" onClick={onClose} className="!p-2">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'shop'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
              : 'bg-white/80 text-gray-600 hover:bg-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Tienda
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'inventory'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
              : 'bg-white/80 text-gray-600 hover:bg-white'
          }`}
        >
          <Package className="w-4 h-4" />
          Mi Inventario
          {purchases.length > 0 && (
            <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs">{purchases.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
              : 'bg-white/80 text-gray-600 hover:bg-white'
          }`}
        >
          <History className="w-4 h-4" />
          Historial
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna izquierda - Preview del avatar */}
        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/50 sticky top-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Tu Avatar</h2>
            
            <div className="flex justify-center mb-4">
              {(() => {
                const hasBackground = equippedForRenderer.some(item => item.slot === 'BACKGROUND') || 
                  (previewItem && previewItem.avatarItem.slot === 'BACKGROUND');
                return (
                  <motion.div 
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className={`rounded-2xl overflow-hidden ${hasBackground ? '' : 'bg-gradient-to-br from-indigo-100 to-purple-100 p-4'}`}
                  >
                    <AvatarPreview
                      gender={studentProfile.avatarGender}
                      currentItems={equippedForRenderer}
                      previewItem={previewItem ? {
                        slot: previewItem.avatarItem.slot,
                        imagePath: previewItem.avatarItem.imagePath,
                        layerOrder: previewItem.avatarItem.layerOrder,
                      } : undefined}
                      size="xl"
                    />
                  </motion.div>
                );
              })()}
            </div>

            {/* Items equipados */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-600">Equipado:</h3>
              {equippedItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">Sin items equipados</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {equippedItems.map((item) => (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => unequipMutation.mutate(item.slot)}
                      className="relative bg-gray-100 rounded-lg p-2 group"
                      title={`Quitar ${item.avatarItem.name}`}
                    >
                      <img 
                        src={item.avatarItem.imagePath} 
                        alt={item.avatarItem.name}
                        className="w-full h-12 object-contain"
                      />
                      <div className="absolute inset-0 bg-red-500/80 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <X className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-[10px] text-gray-500 text-center mt-1 truncate">
                        {SLOT_LABELS[item.slot]}
                      </p>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha - Contenido según tab */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'shop' && (
            <>
              {/* Filtros mejorados */}
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50 space-y-3">
                {/* Toggle de filtros avanzados */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-purple-600"
                  >
                    <Filter className="w-4 h-4" />
                    {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                  </button>
                  <span className="text-xs text-gray-400">{filteredItems.length} items</span>
                </div>

                {/* Filtros por slot */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        selectedSlot === slot
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {slot === 'ALL' ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : (
                        SLOT_ICONS[slot]
                      )}
                      {slot === 'ALL' ? 'Todos' : SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>

                {/* Filtros avanzados (rareza y ordenamiento) */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        {/* Filtro por rareza */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Rareza</label>
                          <div className="flex flex-wrap gap-1">
                            {rarities.map((rarity) => (
                              <button
                                key={rarity}
                                onClick={() => setSelectedRarity(rarity)}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                  selectedRarity === rarity
                                    ? rarity === 'ALL' 
                                      ? 'bg-gray-800 text-white'
                                      : RARITY_COLORS[rarity]
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {rarity === 'ALL' ? (
                                  <Star className="w-3 h-3 inline mr-1" />
                                ) : null}
                                {RARITY_LABELS[rarity]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Ordenamiento */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Ordenar por</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {SORT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Grid de items */}
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white/50 rounded-xl h-48 animate-pulse" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-lg rounded-xl p-8 text-center">
                  <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No hay items disponibles con estos filtros</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((item, index) => {
                      const isPurchased = purchasedItemIds.has(item.avatarItemId);
                      const isEquipped = equippedItems.some(e => e.avatarItem.id === item.avatarItemId);
                      const canAfford = studentProfile.gp >= item.price;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      onMouseEnter={() => setPreviewItem(item)}
                      onMouseLeave={() => setPreviewItem(null)}
                      className={`bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border-2 transition-all ${
                        isEquipped 
                          ? 'border-green-400 bg-green-50/50' 
                          : isPurchased 
                            ? 'border-blue-300 bg-blue-50/50'
                            : 'border-white/50 hover:border-purple-300'
                      }`}
                    >
                      {/* Badge de rareza */}
                      <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${RARITY_COLORS[item.avatarItem.rarity]}`}>
                        {item.avatarItem.rarity}
                      </div>

                      {/* Imagen del item */}
                      <div className="relative h-24 mb-3 flex items-center justify-center">
                        <img 
                          src={item.avatarItem.imagePath} 
                          alt={item.avatarItem.name}
                          className="max-h-full max-w-full object-contain"
                        />
                        {isEquipped && (
                          <div className="absolute top-0 right-0 bg-green-500 rounded-full p-1">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <h3 className="font-semibold text-gray-800 text-sm truncate">
                        {item.avatarItem.name}
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        {SLOT_LABELS[item.avatarItem.slot]}
                      </p>

                      {/* Precio y acción */}
                      {isPurchased ? (
                        <Button
                          size="sm"
                          className={`w-full ${isEquipped ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                          onClick={() => !isEquipped && equipMutation.mutate(item.avatarItemId)}
                          disabled={isEquipped || equipMutation.isPending}
                        >
                          {isEquipped ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Equipado
                            </>
                          ) : (
                            'Equipar'
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className={`w-full ${canAfford ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-300'}`}
                          onClick={() => canAfford && handleBuyClick(item)}
                          disabled={!canAfford || purchaseMutation.isPending}
                        >
                          <Coins className="w-4 h-4 mr-1" />
                          {item.price} GP
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
            </>
          )}

          {/* Tab de Inventario */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  Mis Items ({purchases.length})
                </h3>
                
                {purchases.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Aún no has comprado ningún item</p>
                    <button
                      onClick={() => setActiveTab('shop')}
                      className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      Ir a la tienda →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {purchases.map((purchase: any) => {
                      const isEquipped = equippedItems.some(e => e.avatarItem.id === purchase.avatarItemId);
                      const itemRarity = purchase.avatarItem.rarity as ItemRarity;
                      const itemSlot = purchase.avatarItem.slot as AvatarSlot;
                      
                      return (
                        <motion.div
                          key={purchase.id}
                          whileHover={{ scale: 1.02 }}
                          onMouseEnter={() => setPreviewItem({
                            id: purchase.id,
                            classroomId: studentProfile.classroomId,
                            avatarItemId: purchase.avatarItemId,
                            price: purchase.pricePaid,
                            isAvailable: true,
                            avatarItem: purchase.avatarItem,
                          } as ClassroomShopItem)}
                          onMouseLeave={() => setPreviewItem(null)}
                          className={`bg-white rounded-xl p-4 shadow border-2 transition-all ${
                            isEquipped ? 'border-green-400 bg-green-50' : 'border-gray-100'
                          }`}
                        >
                          <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${RARITY_COLORS[itemRarity]}`}>
                            {itemRarity}
                          </div>
                          
                          <div className="h-20 flex items-center justify-center mb-3">
                            <img 
                              src={purchase.avatarItem.imagePath} 
                              alt={purchase.avatarItem.name}
                              className="max-h-full object-contain"
                            />
                          </div>
                          
                          <h4 className="font-medium text-gray-800 text-sm truncate">{purchase.avatarItem.name}</h4>
                          <p className="text-xs text-gray-500 mb-3">{SLOT_LABELS[itemSlot]}</p>
                          
                          <Button
                            size="sm"
                            className={`w-full ${isEquipped ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                            onClick={() => !isEquipped && equipMutation.mutate(purchase.avatarItemId)}
                            disabled={isEquipped || equipMutation.isPending}
                          >
                            {isEquipped ? (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Equipado
                              </>
                            ) : (
                              'Equipar'
                            )}
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab de Historial */}
          {activeTab === 'history' && (
            <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-white/50">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                Historial de Compras
              </h3>
              
              {purchases.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No tienes compras registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase: any) => {
                    const rarity = purchase.avatarItem.rarity as ItemRarity;
                    const slot = purchase.avatarItem.slot as AvatarSlot;
                    return (
                      <div 
                        key={purchase.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <img 
                            src={purchase.avatarItem.imagePath} 
                            alt={purchase.avatarItem.name}
                            className="max-h-10 object-contain"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-800 truncate">{purchase.avatarItem.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className={`px-1.5 py-0.5 rounded ${RARITY_COLORS[rarity]}`}>
                              {rarity}
                            </span>
                            <span>•</span>
                            <span>{SLOT_LABELS[slot]}</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-amber-600 font-bold">
                            <Coins className="w-4 h-4" />
                            {purchase.pricePaid}
                          </div>
                          <p className="text-xs text-gray-400">
                            {new Date(purchase.purchasedAt).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de compra con preview */}
      <AnimatePresence>
        {showConfirmModal && itemToBuy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                ¿Comprar este item?
              </h3>

              {/* Preview comparativo */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Avatar actual */}
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-2">Actual</p>
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-3 inline-block">
                    <AvatarPreview
                      gender={studentProfile.avatarGender}
                      currentItems={equippedForRenderer}
                      size="lg"
                    />
                  </div>
                </div>
                
                {/* Avatar con el nuevo item */}
                <div className="text-center">
                  <p className="text-xs text-purple-600 font-medium mb-2">Con el item</p>
                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-3 inline-block ring-2 ring-purple-400 ring-offset-2">
                    <AvatarPreview
                      gender={studentProfile.avatarGender}
                      currentItems={equippedForRenderer}
                      previewItem={{
                        slot: itemToBuy.avatarItem.slot,
                        imagePath: itemToBuy.avatarItem.imagePath,
                        layerOrder: itemToBuy.avatarItem.layerOrder,
                      }}
                      size="lg"
                    />
                  </div>
                </div>
              </div>

              {/* Info del item */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <img 
                      src={itemToBuy.avatarItem.imagePath} 
                      alt={itemToBuy.avatarItem.name}
                      className="max-h-14 object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">{itemToBuy.avatarItem.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RARITY_COLORS[itemToBuy.avatarItem.rarity]}`}>
                        {itemToBuy.avatarItem.rarity}
                      </span>
                      <span className="text-xs text-gray-500">{SLOT_LABELS[itemToBuy.avatarItem.slot]}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-600">
                      <Coins className="w-5 h-5" />
                      <span className="text-xl font-bold">{itemToBuy.price}</span>
                    </div>
                    <p className="text-xs text-gray-400">GP</p>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="flex items-center justify-between text-sm mb-4 px-2">
                <span className="text-gray-500">Tu balance:</span>
                <span className="font-bold text-gray-700">{studentProfile.gp} GP</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-4 px-2">
                <span className="text-gray-500">Después de comprar:</span>
                <span className={`font-bold ${studentProfile.gp - itemToBuy.price >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {studentProfile.gp - itemToBuy.price} GP
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                  onClick={handleConfirmPurchase}
                  isLoading={purchaseMutation.isPending}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Comprar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarShop;
