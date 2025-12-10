import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shirt,
  Plus,
  Trash2,
  X,
  Coins,
  Search,
  Crown,
  Footprints,
  Sparkles,
  Check,
  Package,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  avatarApi, 
  type AvatarItem,
  type AvatarSlot, 
  type ClassroomShopItem,
  type AvatarGender,
  SLOT_LABELS,
  RARITY_COLORS,
} from '../../lib/avatarApi';
import toast from 'react-hot-toast';

interface AvatarShopManagerProps {
  classroomId: string;
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

const GENDER_LABELS: Record<AvatarGender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Femenino',
};

export const AvatarShopManager = ({ classroomId }: AvatarShopManagerProps) => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvatarSlot | 'ALL'>('ALL');
  const [selectedGender, setSelectedGender] = useState<AvatarGender | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [customPrice, setCustomPrice] = useState<Record<string, number>>({});

  // Items disponibles en el catálogo global
  const { data: allItems = [], isLoading: loadingAll } = useQuery<AvatarItem[]>({
    queryKey: ['avatar-items-all'],
    queryFn: () => avatarApi.getAllItems(),
  });

  // Items ya añadidos a la tienda de esta clase
  const { data: shopItems = [], isLoading: loadingShop } = useQuery({
    queryKey: ['classroom-avatar-shop', classroomId],
    queryFn: () => avatarApi.getClassroomShopItemsAll(classroomId),
  });

  // IDs de items ya en la tienda
  const shopItemIds = useMemo(() => 
    new Set(shopItems.map((item: ClassroomShopItem) => item.avatarItemId)),
    [shopItems]
  );

  // Items disponibles para añadir (no están en la tienda)
  const availableItems = useMemo(() => {
    return allItems.filter((item: AvatarItem) => !shopItemIds.has(item.id));
  }, [allItems, shopItemIds]);

  // Filtrar items disponibles
  const filteredAvailableItems = useMemo(() => {
    return availableItems.filter((item: AvatarItem) => {
      const matchesSlot = selectedSlot === 'ALL' || item.slot === selectedSlot;
      const matchesGender = selectedGender === 'ALL' || item.gender === selectedGender;
      const matchesSearch = !searchTerm || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSlot && matchesGender && matchesSearch;
    });
  }, [availableItems, selectedSlot, selectedGender, searchTerm]);

  // Filtrar items de la tienda
  const filteredShopItems = useMemo(() => {
    return shopItems.filter((item: ClassroomShopItem) => {
      const matchesSlot = selectedSlot === 'ALL' || item.avatarItem.slot === selectedSlot;
      const matchesGender = selectedGender === 'ALL' || item.avatarItem.gender === selectedGender;
      const matchesSearch = !searchTerm || 
        item.avatarItem.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSlot && matchesGender && matchesSearch;
    });
  }, [shopItems, selectedSlot, selectedGender, searchTerm]);

  // Mutation para añadir items a la tienda
  const addToShopMutation = useMutation({
    mutationFn: async (items: { avatarItemId: string; price: number }[]) => {
      const promises = items.map(item => 
        avatarApi.addToClassroomShop(classroomId, item.avatarItemId, item.price)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-avatar-shop', classroomId] });
      setSelectedItems(new Set());
      setCustomPrice({});
      setShowAddModal(false);
      toast.success('Items añadidos a la tienda');
    },
    onError: () => toast.error('Error al añadir items'),
  });

  // Mutation para eliminar item de la tienda
  const removeFromShopMutation = useMutation({
    mutationFn: (shopItemId: string) => avatarApi.removeFromClassroomShop(shopItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-avatar-shop', classroomId] });
      toast.success('Item eliminado de la tienda');
    },
    onError: () => toast.error('Error al eliminar item'),
  });

  // Mutation para actualizar precio
  const updatePriceMutation = useMutation({
    mutationFn: ({ shopItemId, price }: { shopItemId: string; price: number }) => 
      avatarApi.updateClassroomShopItemPrice(shopItemId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-avatar-shop', classroomId] });
      toast.success('Precio actualizado');
    },
    onError: () => toast.error('Error al actualizar precio'),
  });

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleAddSelected = () => {
    const itemsToAdd = Array.from(selectedItems).map(itemId => {
      const item = availableItems.find((i: AvatarItem) => i.id === itemId);
      return {
        avatarItemId: itemId,
        price: customPrice[itemId] || item?.basePrice || 100,
      };
    });
    addToShopMutation.mutate(itemsToAdd);
  };

  const slots: (AvatarSlot | 'ALL')[] = ['ALL', 'HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'SHOES', 'LEFT_HAND', 'RIGHT_HAND', 'BACK', 'FLAG', 'BACKGROUND'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Shirt className="w-6 h-6 text-purple-500" />
            Tienda de Avatares
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestiona los atuendos disponibles para tus estudiantes
          </p>
        </div>
        
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir Items
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro por género */}
          <div className="flex gap-2">
            {(['ALL', 'MALE', 'FEMALE'] as const).map((gender) => (
              <button
                key={gender}
                onClick={() => setSelectedGender(gender)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedGender === gender
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {gender === 'ALL' ? 'Todos' : GENDER_LABELS[gender]}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por slot */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedSlot === slot
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-transparent'
              }`}
            >
              {slot !== 'ALL' && SLOT_ICONS[slot]}
              {slot === 'ALL' ? 'Todos' : SLOT_LABELS[slot]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de items en la tienda */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            Items en tu tienda ({filteredShopItems.length})
          </h3>
        </div>

        {loadingShop ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredShopItems.length === 0 ? (
          <div className="text-center py-12">
            <Shirt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No hay items en la tienda</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Añade items del catálogo para que tus estudiantes puedan comprarlos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredShopItems.map((shopItem: ClassroomShopItem) => (
              <motion.div
                key={shopItem.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600 transition-all group"
              >
                {/* Badge de género */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    shopItem.avatarItem.gender === 'MALE' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-pink-100 text-pink-700'
                  }`}>
                    {GENDER_LABELS[shopItem.avatarItem.gender]}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${RARITY_COLORS[shopItem.avatarItem.rarity]}`}>
                    {shopItem.avatarItem.rarity}
                  </span>
                </div>

                {/* Imagen */}
                <div className="h-20 flex items-center justify-center mb-2">
                  <img 
                    src={shopItem.avatarItem.imagePath} 
                    alt={shopItem.avatarItem.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {/* Info */}
                <p className="text-xs font-medium text-gray-800 dark:text-white truncate mb-1">
                  {shopItem.avatarItem.name}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                  {SLOT_LABELS[shopItem.avatarItem.slot]}
                </p>

                {/* Precio editable */}
                <div className="flex items-center gap-1 mb-2">
                  <Coins className="w-3 h-3 text-amber-500" />
                  <input
                    type="number"
                    defaultValue={shopItem.price}
                    onBlur={(e) => {
                      const newPrice = parseInt(e.target.value);
                      if (newPrice !== shopItem.price && newPrice > 0) {
                        updatePriceMutation.mutate({ shopItemId: shopItem.id, price: newPrice });
                      }
                    }}
                    className="w-16 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded px-1 py-0.5 border border-amber-200 dark:border-amber-700 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Botón eliminar */}
                <button
                  onClick={() => removeFromShopMutation.mutate(shopItem.id)}
                  className="w-full py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Quitar
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para añadir items */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl"
            >
              {/* Header del modal */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Añadir Items al Catálogo</h3>
                  <p className="text-sm text-gray-500">
                    Selecciona los items que quieres ofrecer a tus estudiantes
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filtros del modal */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {/* Filtro por género */}
                  {(['ALL', 'MALE', 'FEMALE'] as const).map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setSelectedGender(gender)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedGender === gender
                          ? 'bg-purple-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                      }`}
                    >
                      {gender === 'ALL' ? 'Todos' : GENDER_LABELS[gender]}
                    </button>
                  ))}
                  <div className="w-px bg-gray-300 mx-2" />
                  {/* Filtro por slot */}
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedSlot === slot
                          ? 'bg-purple-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                      }`}
                    >
                      {slot === 'ALL' ? 'Todos' : SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de items disponibles */}
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {loadingAll ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                      <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredAvailableItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No hay items disponibles</p>
                    <p className="text-sm text-gray-400">Todos los items ya están en tu tienda o no hay items en esta categoría</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {filteredAvailableItems.map((item: AvatarItem) => {
                      const isSelected = selectedItems.has(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleToggleItem(item.id)}
                          className={`relative cursor-pointer rounded-xl p-3 border-2 transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-purple-500' : 'bg-gray-200'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>

                          {/* Badge de género */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            item.gender === 'MALE' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-pink-100 text-pink-700'
                          }`}>
                            {GENDER_LABELS[item.gender]}
                          </span>

                          {/* Imagen */}
                          <div className="h-16 flex items-center justify-center my-2">
                            <img 
                              src={item.imagePath} 
                              alt={item.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          {/* Info */}
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {SLOT_LABELS[item.slot]}
                          </p>

                          {/* Precio personalizable si está seleccionado */}
                          {isSelected && (
                            <div className="mt-2 flex items-center gap-1">
                              <Coins className="w-3 h-3 text-amber-500" />
                              <input
                                type="number"
                                value={customPrice[item.id] || item.basePrice}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setCustomPrice(prev => ({
                                    ...prev,
                                    [item.id]: parseInt(e.target.value) || item.basePrice
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs font-bold text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-200 focus:outline-none focus:border-amber-400"
                                placeholder="Precio"
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer del modal */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} seleccionado{selectedItems.size !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedItems(new Set());
                      setCustomPrice({});
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddSelected}
                    disabled={selectedItems.size === 0 || addToShopMutation.isPending}
                    isLoading={addToShopMutation.isPending}
                    className="bg-gradient-to-r from-purple-500 to-pink-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarShopManager;
