import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  X,
  Coins,
  Gift,
  Clock,
  Check,
  XCircle,
  Shirt,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { AvatarShopManager } from '../../components/classroom/AvatarShopManager';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { 
  shopApi, 
  type ShopItem, 
  type ItemCategory, 
  type ItemRarity,
  type PendingPurchase,
  type ItemUsage,
  RARITY_CONFIG,
  CATEGORY_CONFIG,
} from '../../lib/shopApi';
import toast from 'react-hot-toast';

export const ShopPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom & { showCharacterName?: boolean } }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'items' | 'avatars'>('items');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; item: ShopItem | null }>({ isOpen: false, item: null });
  const [showAIModal, setShowAIModal] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shop-items', classroom.id],
    queryFn: () => shopApi.getItems(classroom.id),
  });

  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });

  const { data: pendingPurchases = [] } = useQuery({
    queryKey: ['pending-purchases', classroom.id],
    queryFn: () => shopApi.getPendingPurchases(classroom.id),
  });

  const { data: pendingUsages = [] } = useQuery({
    queryKey: ['pending-usages', classroom.id],
    queryFn: () => shopApi.getPendingUsages(classroom.id),
  });

  const students = classroomData?.students || [];

  // Función para obtener el nombre a mostrar según configuración
  const getDisplayName = (student: { characterName?: string | null; realName?: string | null; realLastName?: string | null }) => {
    if (classroom.showCharacterName === false) {
      if (student.realName && student.realLastName) {
        return `${student.realName} ${student.realLastName}`;
      } else if (student.realName) {
        return student.realName;
      }
    }
    return student.characterName || 'Sin nombre';
  };

  const createMutation = useMutation({
    mutationFn: shopApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroom.id] });
      setShowModal(false);
      toast.success('Artículo creado');
    },
    onError: () => toast.error('Error al crear artículo'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      shopApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroom.id] });
      setShowModal(false);
      setEditingItem(null);
      toast.success('Artículo actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: shopApi.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroom.id] });
      toast.success('Artículo eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const teacherPurchaseMutation = useMutation({
    mutationFn: ({ studentId, itemId }: { studentId: string; itemId: string }) =>
      shopApi.teacherPurchase(studentId, itemId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      setShowGiftModal(false);
      setSelectedItem(null);
      toast.success(result.message);
    },
    onError: () => toast.error('Error al dar artículo'),
  });

  const approvePurchaseMutation = useMutation({
    mutationFn: shopApi.approvePurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-purchases', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Compra aprobada');
    },
    onError: () => toast.error('Error al aprobar compra'),
  });

  const rejectPurchaseMutation = useMutation({
    mutationFn: (purchaseId: string) => shopApi.rejectPurchase(purchaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-purchases', classroom.id] });
      toast.success('Compra rechazada');
    },
    onError: () => toast.error('Error al rechazar compra'),
  });

  const approveUsageMutation = useMutation({
    mutationFn: (usageId: string) => shopApi.reviewUsage(usageId, 'APPROVED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-usages', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Uso de item aprobado');
    },
    onError: () => toast.error('Error al aprobar uso'),
  });

  const rejectUsageMutation = useMutation({
    mutationFn: (usageId: string) => shopApi.reviewUsage(usageId, 'REJECTED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-usages', classroom.id] });
      toast.success('Uso de item rechazado');
    },
    onError: () => toast.error('Error al rechazar uso'),
  });

  const handleEdit = (item: ShopItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDelete = (item: ShopItem) => {
    setDeleteConfirm({ isOpen: true, item });
  };

  const handleGiveToStudent = (item: ShopItem) => {
    setSelectedItem(item);
    setShowGiftModal(true);
  };

  // Agrupar items por rareza
  const itemsByRarity = {
    LEGENDARY: items.filter(i => i.rarity === 'LEGENDARY'),
    RARE: items.filter(i => i.rarity === 'RARE'),
    COMMON: items.filter(i => i.rarity === 'COMMON'),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
          <ShoppingBag size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            Tienda
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gestiona los artículos que pueden comprar tus estudiantes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'items'
              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Items
        </button>
        <button
          onClick={() => setActiveTab('avatars')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'avatars'
              ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Shirt className="w-4 h-4" />
          Avatares
        </button>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'avatars' ? (
        <AvatarShopManager classroomId={classroom.id} />
      ) : (
        <>
          {/* Botones de acción */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg"
            >
              <Sparkles size={18} />
              Generar con IA
            </button>
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowModal(true);
              }}
              leftIcon={<Plus size={16} />}
            >
              Nuevo artículo
            </Button>
          </div>

      {/* Compras pendientes de aprobación */}
      {pendingPurchases.length > 0 && (
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 dark:text-white">Compras pendientes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{pendingPurchases.length} compra(s) esperando aprobación</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingPurchases.map((purchase: PendingPurchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 border border-amber-100 dark:border-amber-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{purchase.item.icon || '🎁'}</span>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{purchase.item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getDisplayName(purchase.student)} • {purchase.totalPrice} GP
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approvePurchaseMutation.mutate(purchase.id)}
                    disabled={approvePurchaseMutation.isPending}
                    className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                    title="Aprobar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => rejectPurchaseMutation.mutate(purchase.id)}
                    disabled={rejectPurchaseMutation.isPending}
                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                    title="Rechazar"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Usos de items pendientes de aprobación */}
      {pendingUsages.length > 0 && (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <ShoppingBag size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 dark:text-white">Uso de items pendientes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{pendingUsages.length} uso(s) esperando aprobación</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingUsages.map((usage: ItemUsage) => (
              <div
                key={usage.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 border border-purple-100 dark:border-purple-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{usage.item.icon || '🎁'}</span>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{usage.item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {usage.student.characterName || 'Estudiante'} quiere usar este item
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveUsageMutation.mutate(usage.id)}
                    disabled={approveUsageMutation.isPending}
                    className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                    title="Aprobar uso"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => rejectUsageMutation.mutate(usage.id)}
                    disabled={rejectUsageMutation.isPending}
                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                    title="Rechazar uso"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de items por rareza */}
      {items.length === 0 ? (
        <Card className="py-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              ¡Bienvenido a la Tienda!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
              La tienda permite a tus estudiantes gastar el <strong className="text-amber-600">Oro (GP)</strong> que ganan en recompensas y privilegios especiales.
            </p>
          </div>

          {/* Guía rápida */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 border border-amber-200 dark:border-amber-800">
            <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              💡 ¿Cómo funciona?
            </h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex gap-2">
                <span className="text-lg">1️⃣</span>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Crea artículos</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Privilegios, premios o experiencias</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">2️⃣</span>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Los estudiantes compran</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Usando el oro que ganan</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-lg">3️⃣</span>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Tú apruebas el uso</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Controlas cuándo se canjean</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ideas de items */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">💎 Ideas populares:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">💺</span>
                <span className="text-gray-600 dark:text-gray-400">Elegir asiento</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">⏰</span>
                <span className="text-gray-600 dark:text-gray-400">+5 min en examen</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">🎵</span>
                <span className="text-gray-600 dark:text-gray-400">Poner música</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">📝</span>
                <span className="text-gray-600 dark:text-gray-400">Entregar tarea tarde</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">🛡️</span>
                <span className="text-gray-600 dark:text-gray-400">Escudo anti-HP</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">🍬</span>
                <span className="text-gray-600 dark:text-gray-400">Dulce o snack</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">📱</span>
                <span className="text-gray-600 dark:text-gray-400">5 min de celular</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                <span className="text-xl block mb-1">⭐</span>
                <span className="text-gray-600 dark:text-gray-400">Punto extra</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button onClick={() => setShowModal(true)} leftIcon={<Plus size={16} />}>
              Crear primer artículo
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {(['LEGENDARY', 'RARE', 'COMMON'] as ItemRarity[]).map((rarity) => {
            const rarityItems = itemsByRarity[rarity];
            if (rarityItems.length === 0) return null;

            const config = RARITY_CONFIG[rarity];

            return (
              <div key={rarity}>
                <h2 className={`text-base font-bold mb-3 ${config.color}`}>
                  {config.label} ({rarityItems.length})
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rarityItems.map((item, index) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      index={index}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onGive={handleGiveToStudent}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

          {/* Modal crear/editar */}
          <ItemModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingItem(null);
            }}
            item={editingItem}
            onSave={(data) => {
              if (editingItem) {
                updateMutation.mutate({ id: editingItem.id, data });
              } else {
                createMutation.mutate({ ...data, classroomId: classroom.id });
              }
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />

          {/* Modal dar a estudiante */}
          <GiveToStudentModal
            isOpen={showGiftModal}
            onClose={() => {
              setShowGiftModal(false);
              setSelectedItem(null);
            }}
            item={selectedItem}
            students={students}
            onGive={(studentId) => {
              if (selectedItem) {
                teacherPurchaseMutation.mutate({ studentId, itemId: selectedItem.id });
              }
            }}
            isLoading={teacherPurchaseMutation.isPending}
            getDisplayName={getDisplayName}
          />

          {/* Modal de generación con IA */}
          <AIShopModal
            isOpen={showAIModal}
            onClose={() => setShowAIModal(false)}
            classroomId={classroom.id}
            onItemsGenerated={() => {}}
          />
        </>
      )}

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={() => {
          if (deleteConfirm.item) {
            deleteMutation.mutate(deleteConfirm.item.id);
          }
          setDeleteConfirm({ isOpen: false, item: null });
        }}
        title="¿Eliminar artículo?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.item?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// Componente de tarjeta de item
const ItemCard = ({
  item,
  index,
  onEdit,
  onDelete,
  onGive,
}: {
  item: ShopItem;
  index: number;
  onEdit: (item: ShopItem) => void;
  onDelete: (item: ShopItem) => void;
  onGive: (item: ShopItem) => void;
}) => {
  const rarityConfig = RARITY_CONFIG[item.rarity];
  const categoryConfig = CATEGORY_CONFIG[item.category];
  const isLegendary = item.rarity === 'LEGENDARY';
  const isRare = item.rarity === 'RARE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative group"
    >
      {/* Animated border for legendary/rare items */}
      {(isLegendary || isRare) && (
        <div className={`
          absolute -inset-[2px] rounded-xl opacity-75 group-hover:opacity-100 transition-opacity
          ${isLegendary ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400' : 'bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400'}
          animate-border-spin
        `} style={{ backgroundSize: '200% 200%' }} />
      )}
      
      <div className={`
        relative bg-white dark:bg-gray-800 rounded-xl p-4 
        ${!isLegendary && !isRare ? 'border-2 ' + rarityConfig.borderColor : ''}
        hover:shadow-lg transition-shadow
      `}>
        <div className="flex items-start gap-3">
          {/* Icono/Imagen */}
          {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.name}
              className={`w-14 h-14 rounded-xl object-cover shadow-md border-2 ${rarityConfig.borderColor}`}
            />
          ) : (
            <div className={`
              w-14 h-14 rounded-xl flex items-center justify-center text-2xl
              bg-gradient-to-br ${rarityConfig.gradient} text-white shadow-md
            `}>
              {item.icon || categoryConfig.icon}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm truncate max-w-[120px]">
                {item.name}
              </h3>
              <span className={`
                text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap
                ${isLegendary ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : ''}
                ${isRare ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white' : ''}
                ${!isLegendary && !isRare ? rarityConfig.bgColor + ' ' + rarityConfig.color : ''}
              `}>
                {rarityConfig.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {categoryConfig.icon} {categoryConfig.label}
            </p>
            
            {item.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {item.description}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                <Coins size={14} />
                <span>{item.price} GP</span>
              </div>
              
              {item.stock !== null && (
                <span className="text-xs text-gray-400">
                  Stock: {item.stock}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onGive(item)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Gift size={14} />
            Dar a estudiante
          </button>
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Ejemplos de items para la tienda
const ITEM_EXAMPLES = [
  { icon: '💺', name: 'Elegir asiento', description: 'Elige dónde sentarte por un día', category: 'CONSUMABLE' as ItemCategory, rarity: 'COMMON' as ItemRarity, price: 25 },
  { icon: '⏰', name: '+5 min en examen', description: '5 minutos extra en cualquier evaluación', category: 'CONSUMABLE' as ItemCategory, rarity: 'RARE' as ItemRarity, price: 100 },
  { icon: '📝', name: 'Entregar tarde', description: 'Entrega una tarea con 1 día de retraso sin penalización', category: 'CONSUMABLE' as ItemCategory, rarity: 'RARE' as ItemRarity, price: 75 },
  { icon: '🛡️', name: 'Escudo protector', description: 'Protege de la próxima pérdida de HP', category: 'SPECIAL' as ItemCategory, rarity: 'LEGENDARY' as ItemRarity, price: 150 },
  { icon: '🎵', name: 'DJ por un día', description: 'Elige la música de fondo durante el trabajo', category: 'CONSUMABLE' as ItemCategory, rarity: 'COMMON' as ItemRarity, price: 30 },
  { icon: '⭐', name: 'Punto extra', description: '+1 punto en una tarea o examen', category: 'CONSUMABLE' as ItemCategory, rarity: 'LEGENDARY' as ItemRarity, price: 200 },
];

// Modal crear/editar item
const ItemModal = ({
  isOpen,
  onClose,
  item,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: ShopItem | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) => {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState<ItemCategory>(item?.category || 'CONSUMABLE');
  const [rarity, setRarity] = useState<ItemRarity>(item?.rarity || 'COMMON');
  const [price, setPrice] = useState(item?.price || 10);
  const [icon, setIcon] = useState(item?.icon || '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl || null);
  const [stock, setStock] = useState<number | ''>(item?.stock ?? '');

  const applyExample = (example: typeof ITEM_EXAMPLES[0]) => {
    setName(example.name);
    setDescription(example.description);
    setCategory(example.category);
    setRarity(example.rarity);
    setPrice(example.price);
    setIcon(example.icon);
  };

  // Manejar selección de imagen
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen debe ser menor a 2MB');
        return;
      }
      // Validar tipo
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten archivos de imagen');
        return;
      }
      // Convertir a base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageUrl(base64);
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageUrl('');
    setImagePreview(null);
  };

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      setCategory(item.category);
      setRarity(item.rarity);
      setPrice(item.price);
      setIcon(item.icon || '');
      setImageUrl(item.imageUrl || '');
      setImagePreview(item.imageUrl || null);
      setStock(item.stock ?? '');
    } else {
      setName('');
      setDescription('');
      setCategory('CONSUMABLE');
      setRarity('COMMON');
      setPrice(10);
      setIcon('');
      setImageUrl('');
      setImagePreview(null);
      setStock('');
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || undefined,
      category,
      rarity,
      price,
      icon: icon || undefined,
      imageUrl: imageUrl || undefined,
      stock: stock === '' ? undefined : stock,
    });
  };

  if (!isOpen) return null;

  const icons = ['🎁', '⭐', '💎', '🏆', '🎭', '👑', '🔮', '⚡', '🌟', '💫', '🎪', '🎨', '🧪', '💊', '🗡️', '🛡️'];
  const categories: ItemCategory[] = ['CONSUMABLE', 'SPECIAL'];

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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
            <motion.img
              src="/assets/mascot/jiro-tienda.jpg"
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Panel derecho - Contenido */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="text-amber-500" size={24} />
                {item ? 'Editar artículo' : 'Nuevo artículo'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-4 overflow-y-auto">
            {/* Ejemplos rápidos - solo para nuevos items */}
            {!item && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">💡 Ejemplos rápidos (click para usar):</p>
                <div className="flex flex-wrap gap-1.5">
                  {ITEM_EXAMPLES.map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyExample(example)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg border border-amber-200 dark:border-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                    >
                      <span>{example.icon}</span>
                      <span className="text-gray-700 dark:text-gray-300">{example.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Poción de XP"
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del artículo..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Categoría
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-3 rounded-lg text-left transition-colors border-2 ${
                      category === cat
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500'
                        : 'bg-gray-50 dark:bg-gray-700 border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CATEGORY_CONFIG[cat].icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{CATEGORY_CONFIG[cat].label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {CATEGORY_CONFIG[cat].description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Rareza */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Rareza
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(RARITY_CONFIG) as ItemRarity[]).map((rar) => (
                  <button
                    key={rar}
                    type="button"
                    onClick={() => setRarity(rar)}
                    className={`p-3 rounded-lg text-center transition-all border-2 ${
                      rarity === rar
                        ? `${RARITY_CONFIG[rar].borderColor} ${RARITY_CONFIG[rar].bgColor}`
                        : 'border-transparent bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`font-bold ${RARITY_CONFIG[rar].color}`}>
                      {RARITY_CONFIG[rar].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Precio */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Precio (GP)
              </label>
              <div className="flex items-center gap-2">
                {[10, 25, 50, 100, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPrice(val)}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      price === val
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {val}
                  </button>
                ))}
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                  className="w-24"
                  min={0}
                />
              </div>
            </div>

            {/* Icono */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Icono
              </label>
              <div className="flex flex-wrap gap-2">
                {icons.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                      icon === ic
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Imagen personalizada */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Imagen personalizada (opcional)
              </label>
              
              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-20 h-20 rounded-xl object-cover border-2 border-indigo-300 dark:border-indigo-600 shadow-md"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer text-sm text-indigo-600 hover:underline">
                      Cambiar imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="text-sm text-red-500 hover:underline text-left"
                    >
                      Quitar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-indigo-600">Click para subir</span> una imagen
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG hasta 2MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Si no agregas imagen, se usará el icono seleccionado
              </p>
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Stock (dejar vacío para ilimitado)
              </label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="Ilimitado"
                min={0}
              />
            </div>

            <Button
              type="submit"
              className="w-full !bg-gradient-to-r !from-amber-500 !to-orange-500 hover:!from-amber-600 hover:!to-orange-600"
              isLoading={isLoading}
              disabled={!name.trim()}
            >
              {item ? 'Guardar cambios' : '🛒 Crear artículo'}
            </Button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal dar a estudiante
const GiveToStudentModal = ({
  isOpen,
  onClose,
  item,
  students,
  onGive,
  isLoading,
  getDisplayName,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: ShopItem | null;
  students: any[];
  onGive: (studentId: string) => void;
  isLoading: boolean;
  getDisplayName: (student: any) => string;
}) => {
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  if (!isOpen || !item) return null;

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
              🎁 Dar artículo
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
                  <p className={`text-sm ${RARITY_CONFIG[item.rarity].color}`}>
                    {RARITY_CONFIG[item.rarity].label}
                  </p>
                </div>
              </div>
            </div>

            {/* Seleccionar estudiante */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Seleccionar estudiante
              </label>
              {students.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay estudiantes en la clase</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudent(student.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedStudent === student.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="w-10 h-10 bg-indigo-200 dark:bg-indigo-800 rounded-lg flex items-center justify-center">
                        🎮
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getDisplayName(student)}
                        </p>
                        <p className="text-sm text-amber-600">
                          {student.gp} GP
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() => onGive(selectedStudent)}
              className="w-full"
              isLoading={isLoading}
              disabled={!selectedStudent}
            >
              <Gift size={18} className="mr-2" />
              Dar artículo (gratis)
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal de generación con IA para la tienda
const AIShopModal = ({
  isOpen,
  onClose,
  classroomId,
  onItemsGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  onItemsGenerated: () => void;
}) => {
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [itemType, setItemType] = useState<'PRIVILEGES' | 'REWARDS' | 'POWERS' | 'MIXED'>('MIXED');
  const [count, setCount] = useState(8);
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const handleGenerate = async () => {
    if (!description.trim() || !level) {
      toast.error('Completa la descripción y el nivel educativo');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await shopApi.generateWithAI({
        description,
        level,
        count,
        itemType,
      });

      if (result.success && result.data?.items) {
        setGeneratedItems(result.data.items);
        setSelectedItems(new Set(result.data.items.map((_, i) => i)));
        setStep('preview');
      } else {
        toast.error(result.message || 'Error al generar items');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al conectar con la IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async () => {
    const itemsToImport = generatedItems.filter((_, i) => selectedItems.has(i));
    if (itemsToImport.length === 0) {
      toast.error('Selecciona al menos un item');
      return;
    }

    try {
      let imported = 0;
      for (const item of itemsToImport) {
        await shopApi.createItem({
          classroomId,
          name: item.name,
          description: item.description,
          category: item.category || 'CONSUMABLE',
          rarity: item.rarity || 'COMMON',
          price: item.price,
          icon: item.icon,
        });
        imported++;
      }
      toast.success(`${imported} artículo(s) importados a la tienda`);
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroomId] });
      onItemsGenerated();
      handleClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al importar items');
    }
  };

  const handleClose = () => {
    setStep('form');
    setDescription('');
    setGeneratedItems([]);
    setSelectedItems(new Set());
    setEditingIndex(null);
    onClose();
  };

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const updateItem = (index: number, updates: Partial<any>) => {
    const newItems = [...generatedItems];
    newItems[index] = { ...newItems[index], ...updates };
    setGeneratedItems(newItems);
  };

  const deleteItem = (index: number) => {
    setGeneratedItems(generatedItems.filter((_, i) => i !== index));
    const newSelected = new Set(selectedItems);
    newSelected.delete(index);
    setSelectedItems(newSelected);
    setEditingIndex(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  {step === 'form' ? 'Generar Artículos con IA' : 'Vista Previa'}
                </h2>
                <p className="text-xs text-gray-500">
                  {step === 'form' ? 'Describe qué items quieres en tu tienda' : `${selectedItems.size} de ${generatedItems.length} seleccionados`}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'form' ? (
              <div className="space-y-4">
                {/* Introducción amigable */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    🛒 <strong>¿Qué es la tienda?</strong> Es donde tus estudiantes gastan el Oro (GP) que ganan.
                    Puedes crear privilegios (elegir asiento, tiempo extra), recompensas (dulces, stickers) o poderes especiales (escudos, bonus).
                  </p>
                </div>

                {/* Ejemplos rápidos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🚀 Ejemplos rápidos <span className="font-normal text-gray-500">(clic para usar)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { emoji: '💺', title: 'Privilegios', desc: 'Elegir asiento, tiempo extra en exámenes, entregar tarde, ser ayudante del día' },
                      { emoji: '🎁', title: 'Recompensas', desc: 'Dulces, stickers, certificados, tiempo libre, poner música en clase' },
                      { emoji: '⚡', title: 'Poderes', desc: 'Escudo anti-HP, duplicar XP del día, revivir puntos, congelar HP por un día' },
                      { emoji: '🎮', title: 'Temática gamer', desc: 'Items con nombres de videojuegos: pociones, escudos mágicos, power-ups, monedas doradas' },
                      { emoji: '⚔️', title: 'Aventura medieval', desc: 'Pergamino del conocimiento, poción de sabiduría, escudo del guardián, amuleto de la suerte' },
                      { emoji: '🚀', title: 'Espacial/Ciencia', desc: 'Combustible extra, escudo de energía, teletransporte, visión de rayos X' },
                    ].map((example) => (
                      <button
                        key={example.title}
                        onClick={() => setDescription(example.desc)}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          description === example.desc
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{example.emoji}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{example.title}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción personalizada */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ✏️ O escribe tu propia descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm resize-none"
                    placeholder="Describe qué tipo de artículos quieres para tu tienda..."
                  />
                </div>

                {/* Nivel y cantidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🎓 Nivel educativo
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Primaria (6-11 años)">Primaria (6-11 años)</option>
                      <option value="Secundaria (12-16 años)">Secundaria (12-16 años)</option>
                      <option value="Preparatoria/Bachillerato">Preparatoria/Bachillerato</option>
                      <option value="Universidad">Universidad</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🔢 ¿Cuántos artículos?
                    </label>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 8)))}
                      min={1}
                      max={15}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Tipo de items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🏷️ Tipo de artículos
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'MIXED', label: '🎲 Variado', desc: 'Mezcla de todo' },
                      { value: 'PRIVILEGES', label: '💺 Privilegios', desc: 'Beneficios académicos' },
                      { value: 'REWARDS', label: '🎁 Recompensas', desc: 'Premios físicos' },
                      { value: 'POWERS', label: '⚡ Poderes', desc: 'Habilidades especiales' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setItemType(type.value as any)}
                        className={`px-3 py-2 rounded-lg text-sm transition-all ${
                          itemType === type.value
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Vista previa de items generados */
              <div className="space-y-2">
                {generatedItems.map((item, index) => (
                  editingIndex === index ? (
                    /* Formulario de edición inline */
                    <div key={index} className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Editando artículo</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteItem(index)}
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Icono y rareza */}
                      <div className="flex gap-3 items-center">
                        <div className="flex gap-1 flex-wrap">
                          {['🎁', '⭐', '💎', '🏆', '🎭', '👑', '🔮', '⚡', '🌟', '💺', '⏰', '🛡️'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => updateItem(index, { icon: emoji })}
                              className={`w-7 h-7 rounded text-sm ${item.icon === emoji ? 'bg-blue-500 ring-2 ring-blue-400' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <select
                          value={item.rarity}
                          onChange={(e) => updateItem(index, { rarity: e.target.value })}
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="COMMON">Común</option>
                          <option value="RARE">Raro</option>
                          <option value="LEGENDARY">Legendario</option>
                        </select>
                      </div>

                      {/* Nombre, descripción y precio */}
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(index, { name: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Nombre"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          placeholder="Descripción"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(index, { price: parseInt(e.target.value) || 0 })}
                            className="w-20 px-2 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                            min={0}
                          />
                          <span className="text-amber-600 font-medium text-sm">GP</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Vista normal del item */
                    <div
                      key={index}
                      onClick={() => toggleItem(index)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                        selectedItems.has(index)
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500'
                          : 'bg-gray-50 dark:bg-gray-700 border-transparent opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(index)}
                          onChange={() => toggleItem(index)}
                          className="w-4 h-4 rounded accent-emerald-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-2xl">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 dark:text-white truncate">{item.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              item.rarity === 'LEGENDARY' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                              item.rarity === 'RARE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {item.rarity === 'LEGENDARY' ? 'Legendario' : item.rarity === 'RARE' ? 'Raro' : 'Común'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{item.description}</p>
                        </div>
                        <span className="text-amber-600 font-bold text-sm flex-shrink-0">{item.price} GP</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingIndex(index); }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex-shrink-0"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-between items-center">
              {step === 'preview' && (
                <button
                  onClick={() => setStep('form')}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ← Volver
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                {step === 'form' ? (
                  <button
                    onClick={handleGenerate}
                    disabled={!description.trim() || !level || isGenerating}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generar con IA
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleImport}
                    disabled={selectedItems.size === 0}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check size={16} />
                    Importar {selectedItems.size} artículo(s)
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
