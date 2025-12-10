import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Coins,
  Gift,
  X,
  Package,
  Send,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { 
  shopApi, 
  type ShopItem, 
  type ItemRarity,
  RARITY_CONFIG,
  CATEGORY_CONFIG,
} from '../../lib/shopApi';
import { classroomApi } from '../../lib/classroomApi';
import { CHARACTER_CLASSES } from '../../lib/studentApi';
import toast from 'react-hot-toast';

interface StudentShopPageProps {
  studentProfile: {
    id: string;
    classroomId: string;
    gp: number;
    characterName: string | null;
  };
  classmates?: Array<{
    id: string;
    characterName: string | null;
    characterClass: string;
  }>;
}

export const StudentShopPage = ({ studentProfile, classmates: propClassmates }: StudentShopPageProps) => {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Cargar compañeros de clase si no se proporcionan
  const { data: classroomData } = useQuery({
    queryKey: ['classroom-students', studentProfile.classroomId],
    queryFn: () => classroomApi.getById(studentProfile.classroomId),
    enabled: !propClassmates || propClassmates.length === 0,
  });

  const classmates = propClassmates?.length 
    ? propClassmates 
    : (classroomData?.students || []).filter(s => s.id !== studentProfile.id);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory' | 'gifts'>('shop');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shop-items', studentProfile.classroomId],
    queryFn: () => shopApi.getItems(studentProfile.classroomId),
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases', studentProfile.id],
    queryFn: () => shopApi.getPurchases(studentProfile.id),
  });

  const { data: giftsReceived = [] } = useQuery({
    queryKey: ['gifts-received', studentProfile.id],
    queryFn: () => shopApi.getGiftsReceived(studentProfile.id),
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      shopApi.purchase(studentProfile.id, itemId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      setShowPurchaseModal(false);
      setSelectedItem(null);
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al comprar');
    },
  });

  const giftMutation = useMutation({
    mutationFn: ({ recipientId, itemId, message }: { 
      recipientId: string; 
      itemId: string; 
      message?: string 
    }) => shopApi.gift(studentProfile.id, recipientId, itemId, 1, message),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      setShowGiftModal(false);
      setSelectedItem(null);
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al enviar regalo');
    },
  });

  const useItemMutation = useMutation({
    mutationFn: ({ purchaseId }: { purchaseId: string }) =>
      shopApi.useItem(studentProfile.id, purchaseId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al usar item');
    },
  });

  const handleBuy = (item: ShopItem) => {
    setSelectedItem(item);
    setShowPurchaseModal(true);
  };

  const handleGift = (item: ShopItem) => {
    setSelectedItem(item);
    setShowGiftModal(true);
  };

  // Agrupar items por rareza
  const itemsByRarity = {
    LEGENDARY: items.filter(i => i.rarity === 'LEGENDARY'),
    RARE: items.filter(i => i.rarity === 'RARE'),
    COMMON: items.filter(i => i.rarity === 'COMMON'),
  };

  return (
    <div className="space-y-6">
      {/* Header con GP */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center ring-4 ring-amber-200 dark:ring-amber-800">
            <ShoppingBag className="text-amber-600 dark:text-amber-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tienda</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gasta tu oro en artículos increíbles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 px-4 py-2 rounded-xl">
          <Coins className="text-amber-600" size={24} />
          <span className="text-2xl font-bold text-amber-600">{studentProfile.gp}</span>
          <span className="text-amber-600">GP</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'shop'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShoppingBag size={18} />
          Tienda
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package size={18} />
          Mis compras ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('gifts')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'gifts'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Gift size={18} />
          Regalos ({giftsReceived.length})
        </button>
      </div>

      {/* Tab: Tienda */}
      {activeTab === 'shop' && (
        <>
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Tienda vacía
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Tu profesor aún no ha agregado artículos
              </p>
            </Card>
          ) : (
            <div className="space-y-8">
              {(['LEGENDARY', 'RARE', 'COMMON'] as ItemRarity[]).map((rarity) => {
                const rarityItems = itemsByRarity[rarity];
                if (rarityItems.length === 0) return null;

                const config = RARITY_CONFIG[rarity];

                return (
                  <div key={rarity}>
                    <h2 className={`text-lg font-bold mb-4 ${config.color}`}>
                      {config.label}
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rarityItems.map((item, index) => (
                        <ShopItemCard
                          key={item.id}
                          item={item}
                          index={index}
                          canAfford={studentProfile.gp >= item.price}
                          onBuy={handleBuy}
                          onGift={handleGift}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Inventario */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <Card className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Sin compras
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Aún no has comprado nada
              </p>
            </Card>
          ) : (
            purchases.map((purchase) => {
              const isConsumable = purchase.item.category === 'CONSUMABLE';
              const remaining = purchase.quantity - (purchase.usedQuantity || 0);
              const canUse = isConsumable && remaining > 0;

              return (
                <Card key={purchase.id} className={remaining === 0 && isConsumable ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {purchase.item.imageUrl ? (
                      <img 
                        src={purchase.item.imageUrl} 
                        alt={purchase.item.name}
                        className={`w-14 h-14 rounded-xl object-cover border-2 ${RARITY_CONFIG[purchase.item.rarity].borderColor}`}
                      />
                    ) : (
                      <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                        bg-gradient-to-br ${RARITY_CONFIG[purchase.item.rarity].gradient} text-white
                      `}>
                        {purchase.item.icon}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {purchase.item.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{new Date(purchase.purchasedAt).toLocaleDateString()}</span>
                        {purchase.purchaseType === 'GIFT' && <span>• Regalo recibido</span>}
                        {purchase.purchaseType === 'TEACHER' && <span>• Regalo del profesor</span>}
                      </div>
                      {isConsumable && (
                        <p className="text-sm mt-1">
                          <span className={remaining > 0 ? 'text-green-600' : 'text-gray-400'}>
                            {remaining} de {purchase.quantity} disponibles
                          </span>
                        </p>
                      )}
                      {!isConsumable && (
                        <p className="text-sm text-indigo-600 mt-1">
                          ⭐ Item especial (permanente)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${RARITY_CONFIG[purchase.item.rarity].bgColor} ${RARITY_CONFIG[purchase.item.rarity].color}`}>
                        {RARITY_CONFIG[purchase.item.rarity].label}
                      </span>
                      {canUse && (
                        <Button
                          size="sm"
                          onClick={() => useItemMutation.mutate({ purchaseId: purchase.id })}
                          isLoading={useItemMutation.isPending}
                          className="!bg-green-500 hover:!bg-green-600"
                        >
                          🧪 Usar
                        </Button>
                      )}
                      {isConsumable && remaining === 0 && (
                        <span className="text-xs text-gray-400">Agotado</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Regalos */}
      {activeTab === 'gifts' && (
        <div className="space-y-4">
          {giftsReceived.length === 0 ? (
            <Card className="text-center py-12">
              <Gift className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Sin regalos
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Aún no has recibido regalos
              </p>
            </Card>
          ) : (
            giftsReceived.map((gift) => (
              <Card key={gift.id} className="border-2 border-pink-200 dark:border-pink-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                      bg-gradient-to-br ${RARITY_CONFIG[gift.item.rarity].gradient} text-white
                    `}>
                      {gift.item.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {gift.item.name}
                      </h3>
                      <p className="text-sm text-pink-600">
                        🎁 De: {gift.from?.characterName || 'Anónimo'}
                      </p>
                      {gift.giftMessage && (
                        <p className="text-sm text-gray-500 italic mt-1">
                          "{gift.giftMessage}"
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal de compra */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        currentGP={studentProfile.gp}
        onConfirm={() => {
          if (selectedItem) {
            purchaseMutation.mutate({ itemId: selectedItem.id });
          }
        }}
        isLoading={purchaseMutation.isPending}
      />

      {/* Modal de regalo */}
      <GiftModal
        isOpen={showGiftModal}
        onClose={() => {
          setShowGiftModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        currentGP={studentProfile.gp}
        classmates={classmates.filter(c => c.id !== studentProfile.id)}
        onConfirm={(recipientId, message) => {
          if (selectedItem) {
            giftMutation.mutate({ recipientId, itemId: selectedItem.id, message });
          }
        }}
        isLoading={giftMutation.isPending}
      />
    </div>
  );
};

// Tarjeta de item
const ShopItemCard = ({
  item,
  index,
  canAfford,
  onBuy,
  onGift,
}: {
  item: ShopItem;
  index: number;
  canAfford: boolean;
  onBuy: (item: ShopItem) => void;
  onGift: (item: ShopItem) => void;
}) => {
  const rarityConfig = RARITY_CONFIG[item.rarity];
  const categoryConfig = CATEGORY_CONFIG[item.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`border-2 ${rarityConfig.borderColor} ${!canAfford ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.name}
                className={`w-16 h-16 rounded-xl object-cover shadow-lg border-2 ${rarityConfig.borderColor}`}
              />
            ) : (
              <div className={`
                w-16 h-16 rounded-xl flex items-center justify-center text-3xl
                bg-gradient-to-br ${rarityConfig.gradient} text-white shadow-lg
              `}>
                {item.icon || categoryConfig.icon}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 dark:text-white truncate">
                  {item.name}
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {categoryConfig.icon} {categoryConfig.label}
              </p>
              
              {item.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center gap-1 text-amber-600 font-bold">
                <Coins size={16} />
                <span>{item.price} GP</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onBuy(item)}
              disabled={!canAfford}
            >
              <ShoppingBag size={16} className="mr-1" />
              Comprar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onGift(item)}
              disabled={!canAfford}
            >
              <Gift size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Modal de compra
const PurchaseModal = ({
  isOpen,
  onClose,
  item,
  currentGP,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: ShopItem | null;
  currentGP: number;
  onConfirm: () => void;
  isLoading: boolean;
}) => {
  if (!isOpen || !item) return null;

  const canAfford = currentGP >= item.price;
  const remainingGP = currentGP - item.price;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Confirmar compra
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Item preview */}
            <div className={`p-4 rounded-xl ${RARITY_CONFIG[item.rarity].bgColor} ${RARITY_CONFIG[item.rarity].borderColor} border-2`}>
              <div className="flex items-center gap-3">
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                  bg-gradient-to-br ${RARITY_CONFIG[item.rarity].gradient} text-white
                `}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                  <p className={`text-sm ${RARITY_CONFIG[item.rarity].color}`}>
                    {RARITY_CONFIG[item.rarity].label}
                  </p>
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tu oro actual:</span>
                <span className="font-bold text-amber-600">{currentGP} GP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Precio:</span>
                <span className="font-bold text-red-500">-{item.price} GP</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300">Oro restante:</span>
                <span className={`font-bold ${remainingGP >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {remainingGP} GP
                </span>
              </div>
            </div>

            <Button
              onClick={onConfirm}
              className="w-full"
              isLoading={isLoading}
              disabled={!canAfford}
            >
              {canAfford ? 'Confirmar compra' : 'GP insuficiente'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal de regalo
const GiftModal = ({
  isOpen,
  onClose,
  item,
  currentGP,
  classmates,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: ShopItem | null;
  currentGP: number;
  classmates: Array<{ id: string; characterName: string | null; characterClass: string }>;
  onConfirm: (recipientId: string, message?: string) => void;
  isLoading: boolean;
}) => {
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen || !item) return null;

  const canAfford = currentGP >= item.price;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              🎁 Enviar regalo
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Item preview */}
            <div className={`p-4 rounded-xl ${RARITY_CONFIG[item.rarity].bgColor} ${RARITY_CONFIG[item.rarity].borderColor} border-2`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                  <p className="text-amber-600 font-bold">{item.price} GP</p>
                </div>
              </div>
            </div>

            {/* Seleccionar destinatario */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                ¿A quién quieres regalar?
              </label>
              {classmates.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay compañeros disponibles</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {classmates.map((classmate) => {
                    const classInfo = CHARACTER_CLASSES[classmate.characterClass as keyof typeof CHARACTER_CLASSES];
                    return (
                      <button
                        key={classmate.id}
                        type="button"
                        onClick={() => setSelectedRecipient(classmate.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          selectedRecipient === classmate.id
                            ? 'bg-pink-100 dark:bg-pink-900/30 border-2 border-pink-500'
                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="text-xl">{classInfo?.icon}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {classmate.characterName || 'Sin nombre'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mensaje */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Mensaje (opcional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
                maxLength={200}
              />
            </div>

            <Button
              onClick={() => onConfirm(selectedRecipient, message || undefined)}
              className="w-full !bg-pink-500 hover:!bg-pink-600"
              isLoading={isLoading}
              disabled={!canAfford || !selectedRecipient}
            >
              <Send size={18} className="mr-2" />
              Enviar regalo ({item.price} GP)
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
