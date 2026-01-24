import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Album,
  Sparkles,
  Package,
  Coins,
  Crown,
  Trophy,
  X,
  ChevronLeft,
  Lock,
  Check,
  Gift,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import {
  collectibleApi,
  type CollectibleAlbum,
  type CardWithStatus,
  type CardRarity,
  type PackType,
  type PurchaseResult,
} from '../../lib/collectibleApi';
import toast from 'react-hot-toast';

const RARITY_CONFIG: Record<CardRarity, { label: string; color: string; bgColor: string; borderColor: string; glow: string; icon: string; gradient: string }> = {
  COMMON: { label: 'Común', color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-300', glow: '', icon: '⚪', gradient: 'from-gray-400 to-gray-500' },
  UNCOMMON: { label: 'Poco común', color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-400', glow: '', icon: '🟢', gradient: 'from-green-400 to-emerald-500' },
  RARE: { label: 'Raro', color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-400', glow: 'shadow-blue-500/30', icon: '🔵', gradient: 'from-blue-400 to-indigo-500' },
  EPIC: { label: 'Épico', color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-400', glow: 'shadow-purple-500/40', icon: '🟣', gradient: 'from-purple-400 to-pink-500' },
  LEGENDARY: { label: 'Legendario', color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-400', glow: 'shadow-amber-500/50', icon: '🌟', gradient: 'from-amber-400 to-orange-500' },
};

const PACK_CONFIG: Record<PackType, { name: string; icon: typeof Package; color: string; gradient: string; cards: number }> = {
  SINGLE: { name: 'Sobre', icon: Package, color: 'text-gray-600', gradient: 'from-gray-400 to-gray-600', cards: 1 },
  PACK_5: { name: 'Paquete x5', icon: Gift, color: 'text-blue-600', gradient: 'from-blue-400 to-blue-600', cards: 5 },
  PACK_10: { name: 'Super x10', icon: Crown, color: 'text-purple-600', gradient: 'from-purple-400 to-purple-600', cards: 10 },
};

export const StudentCollectiblesPage = () => {
  const queryClient = useQueryClient();
  const { selectedClassIndex } = useStudentStore();
  const [selectedAlbum, setSelectedAlbum] = useState<CollectibleAlbum | null>(null);
  const [showPackOpening, setShowPackOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState<PurchaseResult['cards']>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPackType, setSelectedPackType] = useState<PackType>('SINGLE');
  const [selectedCard, setSelectedCard] = useState<CardWithStatus | null>(null);

  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const studentProfile = myClasses?.[selectedClassIndex];

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['student-collectible-albums', studentProfile?.classroomId],
    queryFn: () => collectibleApi.getAlbums(studentProfile!.classroomId),
    enabled: !!studentProfile?.classroomId,
  });

  const { data: albumsProgress = [] } = useQuery({
    queryKey: ['student-albums-progress', studentProfile?.classroomId],
    queryFn: () => collectibleApi.getMyAlbumsProgress(studentProfile!.classroomId),
    enabled: !!studentProfile?.classroomId,
  });

  const { data: collection } = useQuery({
    queryKey: ['student-collection', selectedAlbum?.id],
    queryFn: () => collectibleApi.getMyCollection(selectedAlbum!.id),
    enabled: !!selectedAlbum?.id,
  });

  const getAlbumProgress = (albumId: string) => {
    const progress = albumsProgress.find(p => p.albumId === albumId);
    return progress?.progress || 0;
  };

  const purchaseMutation = useMutation({
    mutationFn: ({ albumId, packType }: { albumId: string; packType: PackType }) =>
      collectibleApi.purchasePack(albumId, packType),
    onSuccess: (result) => {
      setOpenedCards(result.cards);
      setCurrentCardIndex(0);
      setShowPurchaseModal(false);
      setShowPackOpening(true);
      queryClient.invalidateQueries({ queryKey: ['student-collection'] });
      queryClient.invalidateQueries({ queryKey: ['student-albums-progress'] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al comprar sobre');
    },
  });

  const activeAlbums = albums.filter(a => a.isActive);

  const handleOpenPack = (packType: PackType) => {
    setSelectedPackType(packType);
    setShowPurchaseModal(true);
  };

  const getCardCount = (card: CardWithStatus): number => {
    return card.collected.reduce((sum, c) => sum + c.quantity, 0);
  };

  const confirmPurchase = () => {
    if (!selectedAlbum) return;
    purchaseMutation.mutate({ albumId: selectedAlbum.id, packType: selectedPackType });
  };

  const getPackPrice = (album: CollectibleAlbum, packType: PackType) => {
    switch (packType) {
      case 'SINGLE': return album.singlePackPrice;
      case 'PACK_5': return album.fivePackPrice;
      case 'PACK_10': return album.tenPackPrice;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header - estilo similar a Mi Asistencia */}
      <div>
        {selectedAlbum && (
          <button
            onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a álbumes
          </button>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center ring-2 sm:ring-4 ring-amber-200 dark:ring-amber-800 flex-shrink-0">
              <Album className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {selectedAlbum ? selectedAlbum.name : 'Álbum de Cromos'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {selectedAlbum ? `${collection?.uniqueCollected || 0} / ${collection?.totalCards || 0} cromos coleccionados` : 'Colecciona cromos y completa álbumes'}
              </p>
            </div>
          </div>
          {studentProfile && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 px-3 sm:px-4 py-2 rounded-xl shadow-inner">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              <span className="font-bold text-amber-700 dark:text-amber-400 text-sm sm:text-base">{studentProfile.gp} GP</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedAlbum ? (
          /* Lista de Álbumes */
          <motion.div
            key="albums"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {activeAlbums.length === 0 ? (
              <Card className="col-span-full p-12 text-center">
                <Album className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No hay álbumes disponibles</h3>
                <p className="text-gray-500">Tu profesor aún no ha creado álbumes de cromos</p>
              </Card>
            ) : (
              activeAlbums.map((album, index) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="group cursor-pointer overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    onClick={() => setSelectedAlbum(album)}
                  >
                    {/* Cover Image */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 relative overflow-hidden">
                      {album.coverImage ? (
                        <img src={album.coverImage} alt={album.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Album className="w-20 h-20 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white font-bold text-lg drop-shadow-lg">{album.name}</h3>
                        {album.theme && (
                          <p className="text-white/80 text-sm">{album.theme}</p>
                        )}
                      </div>
                      {/* Sparkle effect on hover */}
                      <motion.div
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        <Sparkles className="w-6 h-6 text-yellow-300" />
                      </motion.div>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">{album.totalCards} cromos</span>
                        <div className="flex items-center gap-1 text-amber-600">
                          <Coins className="w-4 h-4" />
                          <span className="font-semibold">{album.singlePackPrice}</span>
                        </div>
                      </div>
                      {/* Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Progreso</span>
                          <span className="font-medium text-amber-600">{Math.round(getAlbumProgress(album.id))}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${getAlbumProgress(album.id)}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          /* Vista del Álbum */
          <motion.div
            key="album-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Progress Bar */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Progreso del álbum</span>
                <span className="text-lg font-bold text-amber-600">
                  {collection?.uniqueCollected || 0} / {collection?.totalCards || 0}
                </span>
              </div>
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((collection?.uniqueCollected || 0) / (collection?.totalCards || 1)) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              {collection?.isCompleted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-center justify-center gap-2 text-green-600"
                >
                  <Trophy className="w-5 h-5" />
                  <span className="font-bold">¡Álbum Completado!</span>
                </motion.div>
              )}
            </Card>

            {/* Pack Purchase Section */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Comprar Sobres
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {(['SINGLE', 'PACK_5', 'PACK_10'] as PackType[]).map((packType) => {
                  const config = PACK_CONFIG[packType];
                  const price = getPackPrice(selectedAlbum, packType);
                  const canAfford = (studentProfile?.gp || 0) >= price;
                  const Icon = config.icon;
                  
                  return (
                    <motion.button
                      key={packType}
                      whileHover={{ scale: canAfford ? 1.05 : 1 }}
                      whileTap={{ scale: canAfford ? 0.95 : 1 }}
                      onClick={() => canAfford && handleOpenPack(packType)}
                      disabled={!canAfford}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all
                        ${canAfford 
                          ? `border-transparent bg-gradient-to-br ${config.gradient} text-white shadow-lg hover:shadow-xl` 
                          : 'border-gray-200 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2" />
                      <p className="font-semibold text-sm">{config.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Coins className="w-4 h-4" />
                        <span className="font-bold">{price}</span>
                      </div>
                      {!canAfford && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                          <Lock className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            {/* Album Grid - Gamificado */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-4 sm:p-6 shadow-inner">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                {collection?.cards.map((card, index) => {
                  const cardCount = getCardCount(card);
                  const isCollected = cardCount > 0;
                  const rarityConfig = RARITY_CONFIG[card.rarity];
                  const isLegendary = card.rarity === 'LEGENDARY';
                  const isEpic = card.rarity === 'EPIC';
                  const isRare = card.rarity === 'RARE';
                  const isUncommon = card.rarity === 'UNCOMMON';
                  
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02, type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: isCollected ? 1.08 : 1.02, zIndex: 10 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => isCollected && setSelectedCard(card)}
                      className={`cursor-pointer ${isCollected ? '' : 'cursor-default'} relative`}
                    >
                      {/* Glow effect for legendary/epic */}
                      {isCollected && (isLegendary || isEpic) && (
                        <motion.div
                          className={`absolute -inset-1 rounded-xl blur-md ${isLegendary ? 'bg-amber-400/60' : 'bg-purple-400/50'}`}
                          animate={{ 
                            opacity: [0.4, 0.8, 0.4],
                            scale: [1, 1.05, 1]
                          }}
                          transition={{ duration: isLegendary ? 1.5 : 2, repeat: Infinity }}
                        />
                      )}
                      
                      {/* Subtle glow for rare/uncommon */}
                      {isCollected && (isRare || isUncommon) && (
                        <motion.div
                          className={`absolute -inset-0.5 rounded-xl ${isRare ? 'bg-blue-400/30' : 'bg-green-400/20'}`}
                          animate={{ opacity: [0.2, 0.4, 0.2] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                      )}
                      
                      <div
                        className={`
                          aspect-[3/4] rounded-xl overflow-hidden relative
                          ${isCollected 
                            ? `bg-gradient-to-br ${rarityConfig.gradient} shadow-lg hover:shadow-2xl border-2 ${rarityConfig.borderColor}` 
                            : 'bg-gray-200 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600'
                          }
                          transition-all duration-300
                          ${card.isShiny ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-amber-50 dark:ring-offset-gray-800' : ''}
                        `}
                      >
                        {isCollected ? (
                          <>
                            {/* Animated shine effect for legendary */}
                            {isLegendary && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                                animate={{ x: ['-200%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                              />
                            )}
                            
                            {/* Animated shine effect for epic (slower) */}
                            {isEpic && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
                                animate={{ x: ['-200%', '200%'] }}
                                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                              />
                            )}
                            
                            {/* Subtle pulse for rare */}
                            {isRare && (
                              <motion.div
                                className="absolute inset-0 bg-white/10"
                                animate={{ opacity: [0, 0.15, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                            
                            {/* Card content */}
                            {card.imageUrl ? (
                              /* Card with image */
                              <div className="w-full h-full relative z-10">
                                <img 
                                  src={card.imageUrl} 
                                  alt={card.name}
                                  className="w-full h-full object-cover"
                                />
                                {/* Name overlay at bottom */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6">
                                  <p className="text-white text-[9px] sm:text-[10px] font-bold text-center leading-tight line-clamp-2 drop-shadow">
                                    {card.name}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* Card without image - show icon */
                              <div className="w-full h-full flex flex-col items-center justify-center p-2 relative z-10">
                                <motion.span 
                                  className="text-3xl sm:text-4xl mb-1 drop-shadow-lg"
                                  animate={isLegendary ? { 
                                    scale: [1, 1.15, 1],
                                    rotate: [0, 5, -5, 0]
                                  } : isEpic ? {
                                    scale: [1, 1.1, 1]
                                  } : {}}
                                  transition={{ duration: isLegendary ? 2 : 3, repeat: Infinity }}
                                >
                                  {rarityConfig.icon}
                                </motion.span>
                                <p className="text-white text-[9px] sm:text-[10px] font-bold text-center leading-tight line-clamp-2 drop-shadow px-1">
                                  {card.name}
                                </p>
                              </div>
                            )}
                            
                            {/* Sparkle particles for legendary */}
                            {isLegendary && (
                              <>
                                <motion.div
                                  className="absolute top-2 right-3 w-1.5 h-1.5 bg-yellow-200 rounded-full"
                                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                                />
                                <motion.div
                                  className="absolute top-4 left-2 w-1 h-1 bg-amber-200 rounded-full"
                                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                                />
                                <motion.div
                                  className="absolute bottom-6 right-2 w-1.5 h-1.5 bg-orange-200 rounded-full"
                                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                                />
                              </>
                            )}
                            
                            {/* Rarity badge */}
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10">
                              <motion.span 
                                className={`text-[8px] sm:text-[9px] font-bold text-white/90 px-2 py-0.5 bg-black/30 backdrop-blur-sm rounded-full whitespace-nowrap ${isLegendary ? 'ring-1 ring-amber-300/50' : isEpic ? 'ring-1 ring-purple-300/50' : ''}`}
                                animate={isLegendary ? { scale: [1, 1.05, 1] } : {}}
                                transition={{ duration: 1, repeat: Infinity }}
                              >
                                {rarityConfig.label}
                              </motion.span>
                            </div>
                            
                            {/* Slot number */}
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center shadow z-10">
                              <span className="text-white text-[10px] sm:text-xs font-bold">{card.slotNumber}</span>
                            </div>
                            
                            {/* Quantity badge */}
                            {cardCount > 1 && (
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 shadow-lg z-10">
                                <span className="text-white text-[9px] sm:text-[10px] font-bold">x{cardCount}</span>
                              </div>
                            )}
                            
                            {/* Shiny indicator */}
                            {card.isShiny && (
                              <motion.div
                                className="absolute top-1.5 right-1.5 z-10"
                                animate={{ 
                                  rotate: [0, 360],
                                  scale: [1, 1.2, 1]
                                }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              >
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 drop-shadow-lg" />
                              </motion.div>
                            )}
                            
                            {/* Hover glow effect */}
                            <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors rounded-xl z-10" />
                          </>
                        ) : (
                          /* Empty slot - Mystery card */
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mb-1 shadow-inner">
                              <span className="font-bold text-xs sm:text-sm">{card.slotNumber}</span>
                            </div>
                            <Lock className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" />
                            <span className="text-[8px] sm:text-[9px] mt-1 opacity-50">???</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {showPurchaseModal && selectedAlbum && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowPurchaseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-center mb-4">Confirmar Compra</h3>
              <div className="text-center mb-6">
                <div className={`w-20 h-20 mx-auto mb-3 rounded-xl bg-gradient-to-br ${PACK_CONFIG[selectedPackType].gradient} flex items-center justify-center`}>
                  {(() => { const Icon = PACK_CONFIG[selectedPackType].icon; return <Icon className="w-10 h-10 text-white" />; })()}
                </div>
                <p className="font-semibold text-lg">{PACK_CONFIG[selectedPackType].name}</p>
                <div className="flex items-center justify-center gap-2 mt-2 text-2xl font-bold text-amber-600">
                  <Coins className="w-6 h-6" />
                  <span>{getPackPrice(selectedAlbum, selectedPackType)} GP</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmPurchase}
                  isLoading={purchaseMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  Comprar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pack Opening Animation */}
      <AnimatePresence>
        {showPackOpening && openedCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <div className="relative w-full max-w-lg p-4">
              {/* Close button */}
              <button
                onClick={() => setShowPackOpening(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Card Display */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCardIndex}
                  initial={{ rotateY: -180, scale: 0.5, opacity: 0 }}
                  animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                  exit={{ rotateY: 180, scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.6, type: 'spring' }}
                  className="relative mx-auto"
                  style={{ perspective: '1000px' }}
                >
                  {(() => {
                    const card = openedCards[currentCardIndex];
                    const rarityKey = card.rarity as CardRarity;
                    const rarityConfig = RARITY_CONFIG[rarityKey];
                    return (
                      <div
                        className={`
                          relative w-64 aspect-[3/4] mx-auto rounded-2xl overflow-hidden
                          border-4 ${rarityConfig.borderColor}
                          shadow-2xl ${rarityConfig.glow}
                          ${card.isShiny ? 'ring-4 ring-yellow-400' : ''}
                        `}
                      >
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.cardName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${rarityConfig.gradient} flex flex-col items-center justify-center`}>
                            <span className="text-7xl mb-2">{rarityConfig.icon}</span>
                          </div>
                        )}
                        {/* Card info overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                          <h4 className="text-white font-bold text-lg">{card.cardName}</h4>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-2 py-1 rounded-lg text-sm font-semibold ${rarityConfig.bgColor} ${rarityConfig.color}`}>
                              {rarityConfig.label}
                            </span>
                            {card.isNew && (
                              <span className="px-2 py-1 rounded-lg text-sm font-semibold bg-green-500 text-white">
                                ¡NUEVO!
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Shiny effect */}
                        {card.isShiny && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            animate={{
                              background: [
                                'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                                'linear-gradient(45deg, transparent 100%, rgba(255,255,255,0.3) 150%, transparent 200%)',
                              ],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>

              {/* Navigation dots */}
              <div className="flex items-center justify-center gap-2 mt-6">
                {openedCards.map((card, index) => {
                  const rarityKey = card.rarity as CardRarity;
                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentCardIndex(index)}
                      className={`
                        w-3 h-3 rounded-full transition-all
                        ${index === currentCardIndex
                          ? `scale-125 ${RARITY_CONFIG[rarityKey].bgColor}`
                          : 'bg-white/30 hover:bg-white/50'
                        }
                      `}
                    />
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                  disabled={currentCardIndex === 0}
                  className="!bg-white/10 !text-white hover:!bg-white/20"
                >
                  Anterior
                </Button>
                {currentCardIndex < openedCards.length - 1 ? (
                  <Button
                    onClick={() => setCurrentCardIndex(currentCardIndex + 1)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500"
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowPackOpening(false)}
                    className="bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Listo
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Detail Overlay */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setSelectedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-3xl w-full"
            >
              {/* Card Visual - Left Side */}
              <motion.div
                initial={{ rotateY: -30, x: -50 }}
                animate={{ rotateY: 0, x: 0 }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="flex-shrink-0"
              >
                <div
                  className={`
                    w-48 sm:w-56 md:w-64 aspect-[3/4] rounded-2xl overflow-hidden relative
                    ${selectedCard.imageUrl ? '' : `bg-gradient-to-br ${RARITY_CONFIG[selectedCard.rarity].gradient}`}
                    shadow-2xl border-4 ${RARITY_CONFIG[selectedCard.rarity].borderColor}
                    ${selectedCard.isShiny ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-black/80' : ''}
                  `}
                >
                  {/* Card content */}
                  {selectedCard.imageUrl ? (
                    /* Card with image */
                    <div className="w-full h-full relative">
                      <img 
                        src={selectedCard.imageUrl} 
                        alt={selectedCard.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Name overlay at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-10">
                        <p className="text-white text-sm sm:text-base font-bold text-center leading-tight drop-shadow-lg">
                          {selectedCard.name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Card without image - show icon */
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      <motion.span 
                        className="text-6xl sm:text-7xl md:text-8xl mb-3 drop-shadow-2xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {RARITY_CONFIG[selectedCard.rarity].icon}
                      </motion.span>
                      <p className="text-white text-sm sm:text-base font-bold text-center leading-tight drop-shadow-lg">
                        {selectedCard.name}
                      </p>
                    </div>
                  )}
                  
                  {/* Slot number */}
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-white text-sm font-bold">#{selectedCard.slotNumber}</span>
                  </div>
                  
                  {/* Shiny effect */}
                  {selectedCard.isShiny && (
                    <>
                      <motion.div
                        className="absolute top-3 right-3"
                        animate={{ rotate: 360, scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Sparkles className="w-8 h-8 text-yellow-300 drop-shadow-lg" />
                      </motion.div>
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        animate={{
                          background: [
                            'linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                            'linear-gradient(45deg, transparent 100%, rgba(255,255,255,0.2) 150%, transparent 200%)',
                          ],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </>
                  )}
                  
                  {/* Rarity badge */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${RARITY_CONFIG[selectedCard.rarity].bgColor} ${RARITY_CONFIG[selectedCard.rarity].color} shadow-lg`}>
                      {RARITY_CONFIG[selectedCard.rarity].label}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Card Info - Right Side */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 text-white space-y-4 text-center md:text-left"
              >
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">
                    {selectedCard.name}
                  </h2>
                  <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${RARITY_CONFIG[selectedCard.rarity].bgColor} ${RARITY_CONFIG[selectedCard.rarity].color}`}>
                      {RARITY_CONFIG[selectedCard.rarity].label}
                    </span>
                    {selectedCard.isShiny && (
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 flex items-center gap-1">
                        <Sparkles className="w-4 h-4" /> Brillante
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm">
                      #{selectedCard.slotNumber}
                    </span>
                  </div>
                </div>

                {selectedCard.description && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wide">Descripción</h3>
                    <p className="text-white/90 text-sm sm:text-base leading-relaxed">
                      {selectedCard.description}
                    </p>
                  </div>
                )}

                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white/70 mb-2 uppercase tracking-wide">Colección</h3>
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-400">{getCardCount(selectedCard)}</p>
                      <p className="text-xs text-white/60">Copias</p>
                    </div>
                    {selectedCard.isShiny && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">✨</p>
                        <p className="text-xs text-white/60">Versión Brillante</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => setSelectedCard(null)}
                  className="w-full md:w-auto bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border border-white/30"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cerrar
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
