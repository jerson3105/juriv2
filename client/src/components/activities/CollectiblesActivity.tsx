import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Album,
  ArrowLeft,
  Plus,
  Settings,
  Trash2,
  Edit,
  Users,
  Trophy,
  Star,
  Loader2,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Sparkles,
  Eye,
  Coins,
  Share2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  collectibleApi,
  RARITY_CONFIG,
  type CollectibleAlbum,
  type CollectibleCard,
  type AlbumWithCards,
  type CardRarity,
  type GeneratedAlbum,
  type ImportableAlbumSource,
} from '../../lib/collectibleApi';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface CollectiblesActivityProps {
  classroom: any;
  onBack?: () => void;
}

const TEACHER_CARD_RARITY_UI: Record<CardRarity, {
  frameGradient: string;
  auraClass: string;
  shadowClass: string;
  badgeClass: string;
  sheenClass: string;
  pulseDuration: number;
}> = {
  COMMON: {
    frameGradient: 'linear-gradient(135deg, rgba(148,163,184,0.95), rgba(226,232,240,0.9), rgba(148,163,184,0.95))',
    auraClass: 'bg-slate-300/20 dark:bg-slate-400/10',
    shadowClass: 'shadow-slate-200/80 dark:shadow-black/10',
    badgeClass: 'border-white/70 bg-white/92 text-slate-600',
    sheenClass: 'from-transparent via-white/20 to-transparent',
    pulseDuration: 4.8,
  },
  UNCOMMON: {
    frameGradient: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(110,231,183,0.95), rgba(16,185,129,0.92))',
    auraClass: 'bg-emerald-400/25 dark:bg-emerald-500/15',
    shadowClass: 'shadow-emerald-300/60 dark:shadow-emerald-950/30',
    badgeClass: 'border-emerald-100/80 bg-white/90 text-emerald-700',
    sheenClass: 'from-transparent via-emerald-100/25 to-transparent',
    pulseDuration: 4.2,
  },
  RARE: {
    frameGradient: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(129,140,248,0.95), rgba(96,165,250,0.92))',
    auraClass: 'bg-blue-400/30 dark:bg-blue-500/18',
    shadowClass: 'shadow-blue-300/70 dark:shadow-blue-950/35',
    badgeClass: 'border-blue-100/80 bg-white/92 text-blue-700',
    sheenClass: 'from-transparent via-blue-100/30 to-transparent',
    pulseDuration: 3.6,
  },
  EPIC: {
    frameGradient: 'linear-gradient(135deg, rgba(168,85,247,0.96), rgba(236,72,153,0.94), rgba(192,132,252,0.94), rgba(99,102,241,0.92))',
    auraClass: 'bg-fuchsia-500/35 dark:bg-fuchsia-500/20',
    shadowClass: 'shadow-fuchsia-400/80 dark:shadow-fuchsia-950/45',
    badgeClass: 'border-fuchsia-100/80 bg-white/92 text-fuchsia-700',
    sheenClass: 'from-transparent via-fuchsia-100/35 to-transparent',
    pulseDuration: 2.7,
  },
  LEGENDARY: {
    frameGradient: 'linear-gradient(135deg, rgba(251,191,36,0.98), rgba(249,115,22,0.96), rgba(253,224,71,0.96), rgba(245,158,11,0.94))',
    auraClass: 'bg-amber-400/40 dark:bg-amber-500/24',
    shadowClass: 'shadow-amber-300/90 dark:shadow-amber-950/45',
    badgeClass: 'border-amber-100/80 bg-white/94 text-amber-700',
    sheenClass: 'from-transparent via-amber-100/45 to-transparent',
    pulseDuration: 2.1,
  },
};

export const CollectiblesActivity = ({ classroom }: CollectiblesActivityProps) => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'album' | 'progress'>('list');
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumWithCards | null>(null);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState<CollectibleCard | null>(null);
  const [showGenerateAlbumModal, setShowGenerateAlbumModal] = useState(false);
  const [showGenerateCardModal, setShowGenerateCardModal] = useState(false);
  const [showImportAlbumModal, setShowImportAlbumModal] = useState(false);
  const [deleteAlbumConfirm, setDeleteAlbumConfirm] = useState<CollectibleAlbum | null>(null);
  const [deleteCardConfirm, setDeleteCardConfirm] = useState<CollectibleCard | null>(null);
  const [editAlbumFromList, setEditAlbumFromList] = useState<CollectibleAlbum | null>(null);
  const [albumToExport, setAlbumToExport] = useState<CollectibleAlbum | null>(null);

  const { data: albums = [], isLoading: loadingAlbums } = useQuery({
    queryKey: ['collectible-albums', classroom.id],
    queryFn: () => collectibleApi.getAlbums(classroom.id),
  });

  const { data: importableAlbumSources = [], isLoading: loadingImportableAlbumSources } = useQuery({
    queryKey: ['collectible-importable-albums', classroom.id],
    queryFn: () => collectibleApi.getImportableAlbums(classroom.id),
    enabled: showImportAlbumModal,
  });

  const { data: teacherClassrooms = [], isLoading: loadingTeacherClassrooms } = useQuery({
    queryKey: ['collectible-transfer-classrooms'],
    queryFn: classroomApi.getMyClassrooms,
    enabled: !!albumToExport,
  });

  const { data: albumProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['collectible-progress', classroom.id, selectedAlbum?.id],
    queryFn: () => selectedAlbum ? collectibleApi.getClassroomProgress(classroom.id, selectedAlbum.id) : null,
    enabled: !!selectedAlbum && view === 'progress',
  });

  const createAlbumMutation = useMutation({
    mutationFn: (data: Parameters<typeof collectibleApi.createAlbum>[1]) => collectibleApi.createAlbum(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      setShowCreateAlbumModal(false);
      toast.success('Álbum creado');
    },
    onError: () => toast.error('Error al crear álbum'),
  });

  const updateAlbumMutation = useMutation({
    mutationFn: ({ albumId, data }: { albumId: string; data: any }) => collectibleApi.updateAlbum(albumId, data),
    onSuccess: (updatedAlbum) => {
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      setSelectedAlbum(updatedAlbum);
      setShowEditAlbumModal(false);
      toast.success('Álbum actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: collectibleApi.deleteAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      setDeleteAlbumConfirm(null);
      setSelectedAlbum(null);
      setView('list');
      toast.success('Álbum eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const createCardMutation = useMutation({
    mutationFn: ({ albumId, data }: { albumId: string; data: any }) => collectibleApi.createCard(albumId, data),
    onSuccess: async () => {
      if (selectedAlbum) {
        const updated = await collectibleApi.getAlbumById(selectedAlbum.id);
        setSelectedAlbum(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      setShowCreateCardModal(false);
      toast.success('Cromo creado');
    },
    onError: () => toast.error('Error al crear cromo'),
  });

  const createManyCardsMutation = useMutation({
    mutationFn: ({ albumId, cards }: { albumId: string; cards: any[] }) => collectibleApi.createManyCards(albumId, cards),
    onSuccess: async () => {
      if (selectedAlbum) {
        const updated = await collectibleApi.getAlbumById(selectedAlbum.id);
        setSelectedAlbum(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      toast.success('Cromos creados');
    },
    onError: () => toast.error('Error al crear cromos'),
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: any }) => collectibleApi.updateCard(cardId, data),
    onSuccess: async () => {
      if (selectedAlbum) {
        const updated = await collectibleApi.getAlbumById(selectedAlbum.id);
        setSelectedAlbum(updated);
      }
      setShowEditCardModal(null);
      toast.success('Cromo actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteCardMutation = useMutation({
    mutationFn: collectibleApi.deleteCard,
    onSuccess: async () => {
      if (selectedAlbum) {
        const updated = await collectibleApi.getAlbumById(selectedAlbum.id);
        setSelectedAlbum(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      setDeleteCardConfirm(null);
      toast.success('Cromo eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const cloneAlbumMutation = useMutation({
    mutationFn: ({ albumId, targetClassroomIds }: { albumId: string; targetClassroomIds: string[] }) =>
      collectibleApi.cloneAlbum(albumId, targetClassroomIds),
    onSuccess: (result, variables) => {
      if (variables.targetClassroomIds.includes(classroom.id)) {
        queryClient.invalidateQueries({ queryKey: ['collectible-albums', classroom.id] });
      }

      setShowImportAlbumModal(false);
      setAlbumToExport(null);

      const baseMessage = variables.targetClassroomIds.includes(classroom.id)
        ? 'Álbum importado'
        : result.created.length > 1
          ? `Álbum exportado a ${result.created.length} clases`
          : 'Álbum exportado';

      toast.success(
        result.skippedRewardBadge
          ? `${baseMessage}. La insignia no se copió`
          : baseMessage
      );
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Error al copiar álbum'),
  });

  const exportableClassrooms = teacherClassrooms.filter((teacherClassroom) => teacherClassroom.id !== classroom.id);

  const transferModals = (
    <>
      <ImportAlbumModal
        isOpen={showImportAlbumModal}
        onClose={() => setShowImportAlbumModal(false)}
        sources={importableAlbumSources}
        isLoading={loadingImportableAlbumSources}
        isSubmitting={cloneAlbumMutation.isPending}
        onSubmit={(albumId) => cloneAlbumMutation.mutate({ albumId, targetClassroomIds: [classroom.id] })}
      />
      <ExportAlbumModal
        isOpen={!!albumToExport}
        onClose={() => setAlbumToExport(null)}
        album={albumToExport}
        classrooms={exportableClassrooms}
        isLoading={loadingTeacherClassrooms}
        isSubmitting={cloneAlbumMutation.isPending}
        onSubmit={(targetClassroomIds) => {
          if (!albumToExport) {
            return;
          }

          cloneAlbumMutation.mutate({ albumId: albumToExport.id, targetClassroomIds });
        }}
      />
    </>
  );

  const openAlbum = async (album: CollectibleAlbum) => {
    const fullAlbum = await collectibleApi.getAlbumById(album.id);
    setSelectedAlbum(fullAlbum);
    setView('album');
  };

  const openProgress = async (album: CollectibleAlbum) => {
    const fullAlbum = await collectibleApi.getAlbumById(album.id);
    setSelectedAlbum(fullAlbum);
    setView('progress');
  };

  // ==================== ALBUM VIEW ====================
  if (view === 'album' && selectedAlbum) {
    return (
      <div className="space-y-5">
        {/* Header mejorado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" onClick={() => { setSelectedAlbum(null); setView('list'); }} className="p-1.5 sm:p-2">
              <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            </Button>
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Album size={18} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white truncate">
                {selectedAlbum.name}
              </h1>
              {selectedAlbum.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                  {selectedAlbum.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setView('progress')}
              className="!bg-blue-50 dark:!bg-blue-900/20 !text-blue-600 dark:!text-blue-400 !border-blue-200 dark:!border-blue-800 hover:!bg-blue-100"
            >
              <Users className="w-4 h-4 mr-2" />Progreso
            </Button>
            <Button 
              variant="secondary"
              onClick={() => setAlbumToExport(selectedAlbum)}
              className="!bg-violet-50 dark:!bg-violet-900/20 !text-violet-600 dark:!text-violet-300 !border-violet-200 dark:!border-violet-800 hover:!bg-violet-100"
            >
              <Share2 className="w-4 h-4 mr-2" />Exportar
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowEditAlbumModal(true)}
              className="!bg-gray-100 dark:!bg-gray-700"
            >
              <Settings className="w-4 h-4 mr-2" />Configurar
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setDeleteAlbumConfirm(selectedAlbum)} 
              className="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats cards mejoradas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="p-4 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-0 shadow-md overflow-hidden relative">
              <div className="absolute -top-2 -right-2 w-12 h-12 bg-amber-500/10 rounded-full" />
              <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Album className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                {selectedAlbum.cards.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Cromos</div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="p-4 text-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-0 shadow-md overflow-hidden relative">
              <div className="absolute -top-2 -right-2 w-12 h-12 bg-emerald-500/10 rounded-full" />
              <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="text-white text-sm">📦</span>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                {selectedAlbum.singlePackPrice} GP
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Sobre</div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-0 shadow-md overflow-hidden relative">
              <div className="absolute -top-2 -right-2 w-12 h-12 bg-blue-500/10 rounded-full" />
              <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white text-sm">📦📦</span>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                {selectedAlbum.fivePackPrice} GP
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Paquete x5</div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-0 shadow-md overflow-hidden relative">
              <div className="absolute -top-2 -right-2 w-12 h-12 bg-purple-500/10 rounded-full" />
              <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-white text-sm">🎁</span>
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                {selectedAlbum.tenPackPrice} GP
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Super x10</div>
            </Card>
          </motion.div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowCreateCardModal(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25"
          >
            <Plus className="w-4 h-4 mr-2" />Añadir Cromo
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setShowGenerateCardModal(true)}
            className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white !border-0 hover:!from-emerald-600 hover:!to-teal-600 shadow-lg shadow-emerald-500/25"
          >
            <Sparkles className="w-4 h-4 mr-2" />Generar con IA
          </Button>
        </div>

        {/* Grid de cromos */}
        {selectedAlbum.cards.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-dashed border-2 border-gray-200 dark:border-gray-700">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded-2xl flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sin cromos aún</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Añade cromos para que los estudiantes coleccionen</p>
            <div className="flex justify-center gap-3">
              <Button 
                onClick={() => setShowCreateCardModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500"
              >
                <Plus className="w-4 h-4 mr-2" />Añadir Cromo
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setShowGenerateCardModal(true)}
                className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white !border-0"
              >
                <Sparkles className="w-4 h-4 mr-2" />Generar con IA
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {selectedAlbum.cards.map((card, index) => {
              const rarityUi = TEACHER_CARD_RARITY_UI[card.rarity];
              const isSpecialCard = card.rarity === 'EPIC' || card.rarity === 'LEGENDARY';
              const showAnimatedFrame = card.rarity !== 'COMMON';

              return (
                <motion.div 
                  key={card.id} 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ delay: index * 0.03 }}
                  className="group relative"
                >
                  {isSpecialCard && (
                    <motion.div
                      className={`pointer-events-none absolute -inset-1 rounded-[1.55rem] blur-xl ${rarityUi.auraClass}`}
                      animate={{
                        opacity: [0.35, 0.9, 0.35],
                        scale: [0.98, 1.05, 0.99],
                      }}
                      transition={{ duration: rarityUi.pulseDuration, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {showAnimatedFrame && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-[1.45rem] p-[1.5px] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        backgroundImage: rarityUi.frameGradient,
                        backgroundSize: '220% 220%',
                      }}
                      animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                      transition={{ duration: isSpecialCard ? 3.2 : 5.2, repeat: Infinity, ease: 'linear' }}
                    >
                      <div className="h-full w-full rounded-[1.35rem] bg-white/85 dark:bg-gray-900/75" />
                    </motion.div>
                  )}

                  <Card className={`relative overflow-hidden border-0 bg-white/95 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${rarityUi.shadowClass} hover:shadow-2xl dark:bg-gray-800/95`}>
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-white/16 via-white/5 to-transparent" />

                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${RARITY_CONFIG[card.rarity].gradient}`}>
                          <span className="text-5xl mb-2 drop-shadow-[0_8px_18px_rgba(15,23,42,0.22)]">{RARITY_CONFIG[card.rarity].icon}</span>
                          <span className="text-white/90 text-xs font-bold px-2 py-1 bg-black/20 rounded-full">
                            {RARITY_CONFIG[card.rarity].label}
                          </span>
                        </div>
                      )}

                      {isSpecialCard && (
                        <motion.div
                          className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r ${rarityUi.sheenClass} mix-blend-screen opacity-90`}
                          animate={{ x: ['-18%', '240%'] }}
                          transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            repeatDelay: 0.9,
                            ease: 'easeInOut',
                          }}
                        />
                      )}

                      {isSpecialCard && (
                        <motion.div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: card.rarity === 'LEGENDARY'
                              ? 'radial-gradient(circle at 18% 20%, rgba(254,240,138,0.34), transparent 32%), radial-gradient(circle at 82% 18%, rgba(251,191,36,0.24), transparent 30%), radial-gradient(circle at 50% 90%, rgba(249,115,22,0.2), transparent 34%)'
                              : 'radial-gradient(circle at 22% 18%, rgba(244,114,182,0.28), transparent 30%), radial-gradient(circle at 80% 24%, rgba(192,132,252,0.24), transparent 30%), radial-gradient(circle at 50% 88%, rgba(99,102,241,0.18), transparent 34%)',
                          }}
                          animate={{ opacity: [0.45, 0.9, 0.45] }}
                          transition={{ duration: rarityUi.pulseDuration, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}

                      <motion.div
                        className="pointer-events-none absolute inset-[6px] rounded-[1rem] border border-white/55"
                        animate={{ opacity: showAnimatedFrame ? [0.32, 0.72, 0.32] : [0.18, 0.3, 0.18] }}
                        transition={{ duration: rarityUi.pulseDuration, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      <div className={`absolute top-2 right-2 z-[2] inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-lg backdrop-blur-md ${rarityUi.badgeClass}`}>
                        <span>{RARITY_CONFIG[card.rarity].icon}</span>
                        <span>{RARITY_CONFIG[card.rarity].label}</span>
                      </div>

                      <div className="absolute bottom-2 left-2 z-[2] min-w-[1.9rem] rounded-lg bg-black/65 px-2 py-1 text-center text-xs font-black text-white shadow-lg backdrop-blur-sm">
                        {card.slotNumber}
                      </div>

                      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-black/80 via-black/38 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 flex items-end justify-center pb-4 gap-2">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => setShowEditCardModal(card)}
                          className="!bg-white/90 hover:!bg-white !text-gray-800"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => setDeleteCardConfirm(card)} 
                          className="!bg-red-500/90 hover:!bg-red-500 !text-white !border-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="relative bg-white/95 p-3 dark:bg-gray-800/95">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200/70 to-transparent dark:via-white/10" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{card.name}</p>
                      {card.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{card.description}</p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <EditAlbumModal isOpen={showEditAlbumModal} onClose={() => setShowEditAlbumModal(false)} album={selectedAlbum} onSubmit={(data) => updateAlbumMutation.mutate({ albumId: selectedAlbum.id, data })} isLoading={updateAlbumMutation.isPending} />
        <CreateCardModal isOpen={showCreateCardModal} onClose={() => setShowCreateCardModal(false)} onSubmit={(data) => createCardMutation.mutate({ albumId: selectedAlbum.id, data })} isLoading={createCardMutation.isPending} />
        <GenerateCardModal isOpen={showGenerateCardModal} onClose={() => setShowGenerateCardModal(false)} album={selectedAlbum} classroomId={classroom.id} onSubmit={async (cards) => { await createManyCardsMutation.mutateAsync({ albumId: selectedAlbum.id, cards }); setShowGenerateCardModal(false); }} isLoading={createManyCardsMutation.isPending} />
        {showEditCardModal && <EditCardModal isOpen={true} onClose={() => setShowEditCardModal(null)} card={showEditCardModal} onSubmit={(data) => updateCardMutation.mutate({ cardId: showEditCardModal.id, data })} isLoading={updateCardMutation.isPending} />}
        <ConfirmModal isOpen={!!deleteCardConfirm} onClose={() => setDeleteCardConfirm(null)} onConfirm={() => deleteCardConfirm && deleteCardMutation.mutate(deleteCardConfirm.id)} title="Eliminar cromo" message={`¿Eliminar "${deleteCardConfirm?.name}"?`} confirmText="Eliminar" isLoading={deleteCardMutation.isPending} variant="danger" />
        <ConfirmModal isOpen={!!deleteAlbumConfirm} onClose={() => setDeleteAlbumConfirm(null)} onConfirm={() => deleteAlbumConfirm && deleteAlbumMutation.mutate(deleteAlbumConfirm.id)} title="Eliminar álbum" message={`¿Eliminar "${deleteAlbumConfirm?.name}"? Se perderá todo el progreso.`} confirmText="Eliminar" isLoading={deleteAlbumMutation.isPending} variant="danger" />
        {transferModals}
      </div>
    );
  }

  // ==================== PROGRESS VIEW ====================
  if (view === 'progress' && selectedAlbum) {
    return (
      <div className="space-y-5">
        {/* Header mejorado */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={() => setView('album')} className="p-1.5 sm:p-2">
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </Button>
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Users size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Progreso: {selectedAlbum.name}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Seguimiento de colección de estudiantes
            </p>
          </div>
        </div>

        {loadingProgress ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : albumProgress ? (
          <>
            {/* Stats cards mejoradas */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card className="p-4 sm:p-5 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-0 shadow-md">
                  <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                    {albumProgress.averageProgress.toFixed(1)}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Promedio</div>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-4 sm:p-5 text-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-0 shadow-md">
                  <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    {albumProgress.completedCount}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Completados</div>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-4 sm:p-5 text-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-0 shadow-md">
                  <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    {albumProgress.totalStudents}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Estudiantes</div>
                </Card>
              </motion.div>
            </div>

            {/* Lista de estudiantes mejorada */}
            <Card className="overflow-hidden border-0 shadow-md">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Album className="w-4 h-4" />
                  Ranking de colección
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {albumProgress.students.map((student, index) => (
                  <motion.div 
                    key={student.studentId} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${student.isCompleted ? 'bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-900/10' : ''}`}
                  >
                    {/* Posición con medalla para top 3 */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{student.studentName}</p>
                        {student.isCompleted && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Completado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${student.progress}%` }}
                            transition={{ duration: 0.8, delay: index * 0.05 }}
                            className={`h-full rounded-full ${student.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} 
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300 min-w-[60px] text-right">
                          {student.uniqueCollected}/{selectedAlbum.totalCards}
                        </span>
                      </div>
                    </div>

                    {/* Porcentaje */}
                    <div className={`text-lg font-bold ${student.isCompleted ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {student.progress.toFixed(0)}%
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </>
        ) : <Card className="p-12 text-center"><p className="text-gray-500">Sin datos</p></Card>}
      </div>
    );
  }

  // ==================== LIST VIEW ====================
  return (
    <div className="space-y-5">
      {/* Header mejorado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30 flex-shrink-0">
            <Album size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Coleccionables
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Crea álbumes de cromos para tus estudiantes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowImportAlbumModal(true)}
            className="!bg-gradient-to-r !from-sky-500 !to-blue-600 !text-white !border-0 hover:!from-sky-600 hover:!to-blue-700 shadow-lg shadow-sky-500/25"
          >
            <Album className="w-4 h-4 mr-2" />Importar
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setShowGenerateAlbumModal(true)}
            className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white !border-0 hover:!from-emerald-600 hover:!to-teal-600 shadow-lg shadow-emerald-500/25"
          >
            <Sparkles className="w-4 h-4 mr-2" />Generar con IA
          </Button>
          <Button onClick={() => setShowCreateAlbumModal(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <Plus className="w-4 h-4 mr-2" />Nuevo Álbum
          </Button>
        </div>
      </div>

      {loadingAlbums ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : albums.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-dashed border-2 border-amber-200 dark:border-amber-800">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Album className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No hay álbumes aún</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Crea tu primer álbum de cromos coleccionables para motivar a tus estudiantes
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowImportAlbumModal(true)}
              className="!bg-gradient-to-r !from-sky-500 !to-blue-600 !text-white !border-0 shadow-lg shadow-sky-500/25 hover:!from-sky-600 hover:!to-blue-700"
            >
              <Album className="w-4 h-4 mr-2" />Importar
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowGenerateAlbumModal(true)}
              className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white !border-0 shadow-lg shadow-emerald-500/25"
            >
              <Sparkles className="w-4 h-4 mr-2" />Generar con IA
            </Button>
            <Button onClick={() => setShowCreateAlbumModal(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
              <Plus className="w-4 h-4 mr-2" />Crear Álbum
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group"
            >
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-md">
                <div className="h-36 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 relative overflow-hidden" style={album.coverImage ? { backgroundImage: `url(${album.coverImage})`, backgroundSize: 'cover' } : {}}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Decorative circles */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-bold text-white truncate drop-shadow-lg">{album.name}</h3>
                    {album.theme && <p className="text-xs text-white/80 truncate">{album.theme}</p>}
                  </div>
                  {!album.isActive && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                      Inactivo
                    </div>
                  )}
                  {album.isActive && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/90 backdrop-blur-sm rounded-full text-xs text-white font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      Activo
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Album className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cromos</p>
                        <p className="font-bold text-gray-900 dark:text-white">{album.totalCards || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
                        <Trophy className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Recompensa:</span>
                        {(album.rewardXp > 0 || album.rewardGp > 0) ? (
                          <div className="flex items-center gap-1">
                            {album.rewardXp > 0 && (
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">+{album.rewardXp} XP</span>
                            )}
                            {album.rewardXp > 0 && album.rewardGp > 0 && <span className="text-gray-400">/</span>}
                            {album.rewardGp > 0 && (
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">+{album.rewardGp} GP</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin configurar</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => openProgress(album)} 
                      className="flex-1 !bg-gray-100 dark:!bg-gray-700 hover:!bg-gray-200 dark:hover:!bg-gray-600"
                    >
                      <Users className="w-4 h-4 mr-1" />Progreso
                    </Button>
                    <Button 
                      variant="secondary"
                      size="sm" 
                      onClick={() => setEditAlbumFromList(album)} 
                      className="!bg-gray-100 dark:!bg-gray-700 hover:!bg-gray-200 dark:hover:!bg-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => openAlbum(album)} 
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      <Eye className="w-4 h-4 mr-1" />Ver
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {transferModals}
      <CreateAlbumModal isOpen={showCreateAlbumModal} onClose={() => setShowCreateAlbumModal(false)} onSubmit={(data) => createAlbumMutation.mutate(data)} isLoading={createAlbumMutation.isPending} />
      <GenerateAlbumModal isOpen={showGenerateAlbumModal} onClose={() => setShowGenerateAlbumModal(false)} classroomId={classroom.id} onSubmit={async (albumData, cards) => { const album = await createAlbumMutation.mutateAsync(albumData); if (cards.length > 0) await createManyCardsMutation.mutateAsync({ albumId: album.id, cards }); setShowGenerateAlbumModal(false); }} isLoading={createAlbumMutation.isPending || createManyCardsMutation.isPending} />
      <ConfirmModal isOpen={!!deleteAlbumConfirm} onClose={() => setDeleteAlbumConfirm(null)} onConfirm={() => deleteAlbumConfirm && deleteAlbumMutation.mutate(deleteAlbumConfirm.id)} title="Eliminar álbum" message={`¿Eliminar "${deleteAlbumConfirm?.name}"? Se perderá todo el progreso.`} confirmText="Eliminar" isLoading={deleteAlbumMutation.isPending} variant="danger" />
      {editAlbumFromList && <EditAlbumModal isOpen={true} onClose={() => setEditAlbumFromList(null)} album={editAlbumFromList} onSubmit={(data) => { updateAlbumMutation.mutate({ albumId: editAlbumFromList.id, data }); setEditAlbumFromList(null); }} isLoading={updateAlbumMutation.isPending} />}
    </div>
  );
};

// ==================== MODALS ====================

const ImportAlbumModal = ({
  isOpen,
  onClose,
  sources,
  isLoading,
  isSubmitting,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  sources: ImportableAlbumSource[];
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (albumId: string) => void;
}) => {
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState('');

  useEffect(() => {
    if (!isOpen || sources.length === 0) {
      setSelectedClassroomId('');
      setSelectedAlbumId('');
      return;
    }

    setSelectedClassroomId(sources[0].classroomId);
    setSelectedAlbumId(sources[0].albums[0]?.id ?? '');
  }, [isOpen, sources]);

  const selectedSource = sources.find((source) => source.classroomId === selectedClassroomId) ?? sources[0];
  const selectedAlbum = selectedSource?.albums.find((album) => album.id === selectedAlbumId) ?? selectedSource?.albums[0];

  useEffect(() => {
    if (!selectedSource) {
      setSelectedAlbumId('');
      return;
    }

    if (!selectedSource.albums.some((album) => album.id === selectedAlbumId)) {
      setSelectedAlbumId(selectedSource.albums[0]?.id ?? '');
    }
  }, [selectedAlbumId, selectedSource]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Importar álbum</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Desde otra de tus clases</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No hay álbumes para importar</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Crea uno en otra clase y luego impórtalo aquí.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Clase</label>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => {
                    const nextClassroomId = e.target.value;
                    const nextSource = sources.find((source) => source.classroomId === nextClassroomId);
                    setSelectedClassroomId(nextClassroomId);
                    setSelectedAlbumId(nextSource?.albums[0]?.id ?? '');
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-amber-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {sources.map((source) => (
                    <option key={source.classroomId} value={source.classroomId}>
                      {source.classroomName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Álbum</label>
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-amber-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {selectedSource?.albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAlbum && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{selectedAlbum.name}</p>
                      {selectedAlbum.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedAlbum.description}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                      {selectedAlbum.totalCards || 0} cromos
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/30">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => selectedAlbum && onSubmit(selectedAlbum.id)}
            disabled={!selectedAlbum || isLoading}
            isLoading={isSubmitting}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            Importar
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const ExportAlbumModal = ({
  isOpen,
  onClose,
  album,
  classrooms,
  isLoading,
  isSubmitting,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  album: CollectibleAlbum | null;
  classrooms: Classroom[];
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (targetClassroomIds: string[]) => void;
}) => {
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTargetIds([]);
      return;
    }

    setSelectedTargetIds([]);
  }, [isOpen, album?.id]);

  if (!isOpen || !album) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Exportar álbum</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Elige tus clases destino</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{album.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{album.totalCards || 0} cromos</p>
              </div>
              <Share2 className="h-4 w-4 text-violet-500" />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
          ) : classrooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No tienes otras clases disponibles</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {classrooms.map((targetClassroom) => {
                const isSelected = selectedTargetIds.includes(targetClassroom.id);

                return (
                  <label
                    key={targetClassroom.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      isSelected
                        ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/20'
                        : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedTargetIds((current) =>
                          current.includes(targetClassroom.id)
                            ? current.filter((id) => id !== targetClassroom.id)
                            : [...current, targetClassroom.id]
                        );
                      }}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100">{targetClassroom.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/30">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedTargetIds.length === 0 ? 'Sin clases seleccionadas' : `${selectedTargetIds.length} seleccionada(s)`}
          </span>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => onSubmit(selectedTargetIds)}
              disabled={selectedTargetIds.length === 0 || isLoading}
              isLoading={isSubmitting}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
            >
              Exportar
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const CreateAlbumModal = ({ isOpen, onClose, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; onSubmit: (data: any) => void; isLoading: boolean }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [singlePackPrice, setSinglePackPrice] = useState(10);
  const [fivePackPrice, setFivePackPrice] = useState(45);
  const [tenPackPrice, setTenPackPrice] = useState(80);
  const [rewardXp, setRewardXp] = useState(100);
  const [rewardGp, setRewardGp] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined, singlePackPrice, fivePackPrice, tenPackPrice, rewardXp, rewardGp });
    setName(''); setDescription('');
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Album className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Nuevo Álbum</h3>
                  <p className="text-white/80 text-sm">Crea un álbum de cromos</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nombre del álbum *
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors" 
                placeholder="Ej: Animales del mundo"
                required 
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors resize-none" 
                rows={2}
                placeholder="Describe la temática del álbum..."
              />
            </div>

            {/* Precios de sobres */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Star className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Precio de sobres (GP)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs text-gray-500 mb-1">Sobre x1</label>
                  <input 
                    type="number" 
                    value={singlePackPrice} 
                    onChange={(e) => setSinglePackPrice(Number(e.target.value))} 
                    className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-amber-600" 
                    min={1} 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                  <label className="block text-xs text-gray-500 mb-1">Pack x5</label>
                  <input 
                    type="number" 
                    value={fivePackPrice} 
                    onChange={(e) => setFivePackPrice(Number(e.target.value))} 
                    className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-blue-600" 
                    min={1} 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
                  <label className="block text-xs text-gray-500 mb-1">Super x10</label>
                  <input 
                    type="number" 
                    value={tenPackPrice} 
                    onChange={(e) => setTenPackPrice(Number(e.target.value))} 
                    className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-purple-600" 
                    min={1} 
                  />
                </div>
              </div>
            </div>

            {/* Recompensas */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Trophy className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recompensa al completar</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
                  <label className="block text-xs text-gray-500 mb-1">XP</label>
                  <input 
                    type="number" 
                    value={rewardXp} 
                    onChange={(e) => setRewardXp(Number(e.target.value))} 
                    className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-emerald-600" 
                    min={0} 
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs text-gray-500 mb-1">GP</label>
                  <input 
                    type="number" 
                    value={rewardGp} 
                    onChange={(e) => setRewardGp(Number(e.target.value))} 
                    className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-amber-600" 
                    min={0} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={isLoading} 
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Álbum
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const EditAlbumModal = ({ isOpen, onClose, album, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; album: CollectibleAlbum; onSubmit: (data: any) => void; isLoading: boolean }) => {
  const [name, setName] = useState(album.name);
  const [description, setDescription] = useState(album.description || '');
  const [singlePackPrice, setSinglePackPrice] = useState(album.singlePackPrice);
  const [fivePackPrice, setFivePackPrice] = useState(album.fivePackPrice);
  const [tenPackPrice, setTenPackPrice] = useState(album.tenPackPrice);
  const [rewardXp, setRewardXp] = useState(album.rewardXp);
  const [rewardGp, setRewardGp] = useState(album.rewardGp);
  const [isActive, setIsActive] = useState(album.isActive);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ name, description, singlePackPrice, fivePackPrice, tenPackPrice, rewardXp, rewardGp, isActive }); };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Editar Álbum</h3>
                  <p className="text-white/80 text-sm">Configura tu álbum</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors" 
                required 
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors resize-none" 
                rows={2} 
              />
            </div>

            {/* Precios */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Star className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Precio de sobres (GP)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs text-gray-500 mb-1">Sobre x1</label>
                  <input type="number" value={singlePackPrice} onChange={(e) => setSinglePackPrice(Number(e.target.value))} className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-amber-600" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                  <label className="block text-xs text-gray-500 mb-1">Pack x5</label>
                  <input type="number" value={fivePackPrice} onChange={(e) => setFivePackPrice(Number(e.target.value))} className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-blue-600" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
                  <label className="block text-xs text-gray-500 mb-1">Super x10</label>
                  <input type="number" value={tenPackPrice} onChange={(e) => setTenPackPrice(Number(e.target.value))} className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Recompensas */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Trophy className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recompensa al completar</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
                  <label className="block text-xs text-gray-500 mb-1">XP</label>
                  <input type="number" value={rewardXp} onChange={(e) => setRewardXp(Number(e.target.value))} className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-emerald-600" min={0} />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs text-gray-500 mb-1">GP</label>
                  <input type="number" value={rewardGp} onChange={(e) => setRewardGp(Number(e.target.value))} className="w-full text-center font-bold text-lg bg-transparent border-0 focus:ring-0 text-amber-600" min={0} />
                </div>
              </div>
            </div>

            {/* Estado activo */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
                  <CheckCircle2 className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Estado del álbum</span>
                  <p className="text-xs text-gray-500">{isActive ? 'Visible para estudiantes' : 'Oculto'}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsActive(!isActive)} 
                className={`w-12 h-7 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button 
              type="submit" 
              isLoading={isLoading} 
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />Guardar
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const CreateCardModal = ({ isOpen, onClose, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; onSubmit: (data: any) => void; isLoading: boolean }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rarity, setRarity] = useState<CardRarity>('COMMON');

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ name, description, imageUrl, rarity }); setName(''); setDescription(''); setImageUrl(''); setRarity('COMMON'); };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Nuevo Cromo</h3>
                  <p className="text-white/80 text-sm">Añade un cromo manualmente</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre del cromo *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors" 
                placeholder="Ej: León Africano"
                required 
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors resize-none" 
                rows={2}
                placeholder="Describe el cromo..."
              />
            </div>

            {/* URL Imagen */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">URL de imagen</label>
              <input 
                type="url" 
                value={imageUrl} 
                onChange={(e) => setImageUrl(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-0 transition-colors" 
                placeholder="https://..."
              />
            </div>

            {/* Rareza */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rareza</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(RARITY_CONFIG) as CardRarity[]).map((r) => (
                  <button 
                    key={r} 
                    type="button" 
                    onClick={() => setRarity(r)} 
                    className={`p-3 rounded-xl border-2 transition-all ${rarity === r ? `${RARITY_CONFIG[r].bgColor} border-current shadow-lg` : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-gray-300'}`}
                  >
                    <Star className={`w-5 h-5 mx-auto mb-1 ${rarity === r ? RARITY_CONFIG[r].color : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-bold block ${rarity === r ? RARITY_CONFIG[r].color : 'text-gray-500'}`}>
                      {RARITY_CONFIG[r].label.slice(0, 3)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button 
              type="submit" 
              isLoading={isLoading} 
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />Crear Cromo
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const EditCardModal = ({ isOpen, onClose, card, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; card: CollectibleCard; onSubmit: (data: any) => void; isLoading: boolean }) => {
  const [name, setName] = useState(card.name);
  const [description, setDescription] = useState(card.description || '');
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [rarity, setRarity] = useState<CardRarity>(card.rarity);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description, imageUrl, rarity }); }}>
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Editar Cromo</h3>
                  <p className="text-white/80 text-sm">Modifica la información</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Preview del cromo */}
            {(card.imageUrl || imageUrl) && (
              <div className="flex justify-center">
                <div className="w-24 h-32 rounded-xl overflow-hidden shadow-lg border-2 border-gray-200 dark:border-gray-600">
                  <img src={imageUrl || card.imageUrl || ''} alt={name} className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors" 
                required 
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors resize-none" 
                rows={2} 
              />
            </div>

            {/* URL Imagen */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">URL de imagen</label>
              <input 
                type="url" 
                value={imageUrl} 
                onChange={(e) => setImageUrl(e.target.value)} 
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors" 
              />
            </div>

            {/* Rareza */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rareza</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(RARITY_CONFIG) as CardRarity[]).map((r) => (
                  <button 
                    key={r} 
                    type="button" 
                    onClick={() => setRarity(r)} 
                    className={`p-3 rounded-xl border-2 transition-all ${rarity === r ? `${RARITY_CONFIG[r].bgColor} border-current shadow-lg` : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-gray-300'}`}
                  >
                    <Star className={`w-5 h-5 mx-auto ${rarity === r ? RARITY_CONFIG[r].color : 'text-gray-400'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button 
              type="submit" 
              isLoading={isLoading} 
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />Guardar
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const GenerateAlbumModal = ({ isOpen, onClose, classroomId, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; classroomId: string; onSubmit: (album: any, cards: any[]) => void; isLoading: boolean }) => {
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [theme, setTheme] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedAlbum | null>(null);
  
  // Precios de sobres
  const [singlePackPrice, setSinglePackPrice] = useState(10);
  const [fivePackPrice, setFivePackPrice] = useState(45);
  const [tenPackPrice, setTenPackPrice] = useState(80);
  
  // Recompensas al completar
  const [completionXp, setCompletionXp] = useState(100);
  const [completionGp, setCompletionGp] = useState(50);

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setGenerating(true);
    try {
      const result = await collectibleApi.generateAlbumWithAI(classroomId, { theme, cardCount });
      setGenerated(result);
      setStep('preview');
    } catch { toast.error('Error al generar'); }
    finally { setGenerating(false); }
  };

  const handleClose = () => { 
    setStep('input'); 
    setTheme(''); 
    setGenerated(null); 
    setSinglePackPrice(10);
    setFivePackPrice(45);
    setTenPackPrice(80);
    setCompletionXp(100);
    setCompletionGp(50);
    onClose(); 
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header con gradiente verde */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {step === 'input' ? 'Generar con IA' : '¡Vista Previa!'}
                </h3>
                <p className="text-white/80 text-sm">
                  {step === 'input' ? 'Crea un álbum automáticamente' : 'Revisa antes de crear'}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {step === 'input' ? (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Temática - ahora es textarea */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Descripción del álbum *
              </label>
              <textarea 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)} 
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-0 transition-colors resize-none" 
                placeholder="Describe la temática del álbum con detalle. Ej: Los dinosaurios más famosos del período Jurásico y Cretácico, incluyendo carnívoros y herbívoros..." 
              />
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Cantidad de cromos
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[5, 10, 15, 20, 25].map(n => (
                  <button 
                    key={n} 
                    type="button"
                    onClick={() => setCardCount(n)}
                    className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                      cardCount === n 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Precio de sobres */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Precio de sobres (GP)</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sobre x1</label>
                  <input 
                    type="number" 
                    value={singlePackPrice} 
                    onChange={(e) => setSinglePackPrice(Number(e.target.value))} 
                    min={0}
                    className="w-full px-2 py-2 text-center border-2 border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 font-bold focus:border-amber-400 focus:ring-0" 
                  />
                </div>
                <div className="text-center">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pack x5</label>
                  <input 
                    type="number" 
                    value={fivePackPrice} 
                    onChange={(e) => setFivePackPrice(Number(e.target.value))} 
                    min={0}
                    className="w-full px-2 py-2 text-center border-2 border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold focus:border-blue-400 focus:ring-0" 
                  />
                </div>
                <div className="text-center">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Super x10</label>
                  <input 
                    type="number" 
                    value={tenPackPrice} 
                    onChange={(e) => setTenPackPrice(Number(e.target.value))} 
                    min={0}
                    className="w-full px-2 py-2 text-center border-2 border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 font-bold focus:border-purple-400 focus:ring-0" 
                  />
                </div>
              </div>
            </div>

            {/* Recompensa al completar */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recompensa al completar</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">XP</label>
                  <input 
                    type="number" 
                    value={completionXp} 
                    onChange={(e) => setCompletionXp(Number(e.target.value))} 
                    min={0}
                    className="w-full px-2 py-2 text-center border-2 border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold focus:border-blue-400 focus:ring-0" 
                  />
                </div>
                <div className="text-center">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">GP</label>
                  <input 
                    type="number" 
                    value={completionGp} 
                    onChange={(e) => setCompletionGp(Number(e.target.value))} 
                    min={0}
                    className="w-full px-2 py-2 text-center border-2 border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 font-bold focus:border-amber-400 focus:ring-0" 
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex gap-3">
              <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerate} 
                isLoading={generating} 
                disabled={!theme.trim()} 
                className="flex-1 !bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white hover:!from-emerald-600 hover:!to-teal-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />Generar
              </Button>
            </div>
          </div>
        ) : generated && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Album preview card */}
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-0 shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Album className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-white">{generated.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{generated.description}</p>
                </div>
              </div>
            </Card>

            {/* Cards grid preview */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Cromos generados ({generated.cards.length})
              </h4>
              <div className="max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {generated.cards.map((card, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="group relative"
                    >
                      <div className={`aspect-[3/4] rounded-lg bg-gradient-to-br ${RARITY_CONFIG[card.rarity].gradient} flex flex-col items-center justify-center p-1 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}>
                        <span className="text-2xl mb-0.5">{RARITY_CONFIG[card.rarity].icon}</span>
                        <span className="text-[8px] font-bold text-white/90 text-center leading-tight line-clamp-2 px-0.5">
                          {card.name}
                        </span>
                        <span className="absolute top-1 left-1 w-4 h-4 rounded bg-black/40 text-white text-[9px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-[150px] truncate">
                        {card.name}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('input')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Volver
              </Button>
              <Button 
                onClick={() => onSubmit({ 
                  name: generated.name, 
                  description: generated.description, 
                  theme,
                  singlePackPrice,
                  fivePackPrice,
                  tenPackPrice,
                  completionXp,
                  completionGp,
                }, generated.cards)} 
                isLoading={isLoading} 
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />Crear Álbum
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const GenerateCardModal = ({ isOpen, onClose, album, classroomId, onSubmit, isLoading }: { isOpen: boolean; onClose: () => void; album: AlbumWithCards; classroomId: string; onSubmit: (cards: any[]) => void; isLoading: boolean }) => {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedAlbum['cards']>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const result = await collectibleApi.generateAlbumWithAI(classroomId, { theme: prompt, cardCount: count });
      setGenerated(result.cards);
    } catch { toast.error('Error al generar'); }
    finally { setGenerating(false); }
  };

  const handleClose = () => { setPrompt(''); setGenerated([]); onClose(); };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header con gradiente verde */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Generar Cromos</h3>
                <p className="text-white/80 text-sm">Añade cromos con IA</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
          {generated.length === 0 ? (
            <>
              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Describe los cromos a generar *</label>
                <input 
                  type="text" 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-0 transition-colors" 
                  placeholder="Ej: Animales de la selva, planetas del sistema solar..." 
                />
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Cantidad de cromos</label>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 5, 10].map(n => (
                    <button 
                      key={n} 
                      type="button"
                      onClick={() => setCount(n)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${count === n 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {n} cromos
                    </button>
                  ))}
                </div>
              </div>

              {/* Info del álbum */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Album className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Añadiendo a: {album.name}</p>
                    <p className="text-xs text-gray-500">Cromos actuales: {album.cards.length}</p>
                  </div>
                </div>
              </div>

              {/* Botón generar */}
              <Button 
                onClick={handleGenerate} 
                isLoading={generating} 
                disabled={!prompt.trim()} 
                className="w-full !bg-gradient-to-r !from-emerald-500 !to-teal-500 !text-white hover:!from-emerald-600 hover:!to-teal-600 shadow-lg shadow-emerald-500/25"
              >
                <Sparkles className="w-4 h-4 mr-2" />Generar Cromos
              </Button>
            </>
          ) : (
            <>
              {/* Lista de cromos generados */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Cromos generados ({generated.length})
                </h4>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {generated.map((card, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600"
                    >
                      <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-xs font-bold shadow">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white flex-1 truncate">{card.name}</span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${RARITY_CONFIG[card.rarity].bgColor} ${RARITY_CONFIG[card.rarity].color}`}>
                        {RARITY_CONFIG[card.rarity].label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setGenerated([])} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />Regenerar
                </Button>
                <Button 
                  onClick={() => onSubmit(generated)} 
                  isLoading={isLoading} 
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                >
                  <Plus className="w-4 h-4 mr-2" />Añadir {generated.length}
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CollectiblesActivity;
