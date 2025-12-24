import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  ArrowLeft,
  Settings,
  Check,
  X,
  Trash2,
  MessageSquare,
  Eye,
  EyeOff,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  scrollApi,
  SCROLL_CATEGORIES,
  REACTION_TYPES,
  type Scroll,
  type ScrollCategory,
} from '../../lib/scrollApi';
import { classroomApi } from '../../lib/classroomApi';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ScrollsActivityProps {
  classroom: any;
  onBack: () => void;
}

export const ScrollsActivity = ({ classroom: initialClassroom, onBack }: ScrollsActivityProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'mural' | 'pending' | 'config'>('mural');
  const [selectedCategory, setSelectedCategory] = useState<ScrollCategory | 'ALL'>('ALL');
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; scroll: Scroll | null }>({ isOpen: false, scroll: null });
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; scroll: Scroll | null }>({ isOpen: false, scroll: null });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Query para obtener el classroom actualizado
  const { data: classroom } = useQuery({
    queryKey: ['classroom', initialClassroom.id],
    queryFn: () => classroomApi.getById(initialClassroom.id),
    initialData: initialClassroom,
  });

  // Queries
  const { data: approvedScrolls = [], isLoading: loadingApproved } = useQuery({
    queryKey: ['scrolls-approved', classroom.id, selectedCategory],
    queryFn: () => scrollApi.getApproved(classroom.id, selectedCategory !== 'ALL' ? { category: selectedCategory } : undefined),
  });

  const { data: pendingScrolls = [], isLoading: loadingPending } = useQuery({
    queryKey: ['scrolls-pending', classroom.id],
    queryFn: () => scrollApi.getPending(classroom.id),
  });

  const { data: stats } = useQuery({
    queryKey: ['scrolls-stats', classroom.id],
    queryFn: () => scrollApi.getStats(classroom.id),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: scrollApi.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrolls-approved', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-pending', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-stats', classroom.id] });
      toast.success('Pergamino aprobado');
    },
    onError: () => toast.error('Error al aprobar'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ scrollId, reason }: { scrollId: string; reason: string }) => 
      scrollApi.reject(scrollId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrolls-pending', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-stats', classroom.id] });
      setRejectModal({ isOpen: false, scroll: null });
      setRejectReason('');
      toast.success('Pergamino rechazado');
    },
    onError: () => toast.error('Error al rechazar'),
  });

  const deleteMutation = useMutation({
    mutationFn: scrollApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrolls-approved', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-pending', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-stats', classroom.id] });
      setDeleteConfirm({ isOpen: false, scroll: null });
      toast.success('Pergamino eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const toggleOpenMutation = useMutation({
    mutationFn: (isOpen: boolean) => scrollApi.toggleOpen(classroom.id, isOpen),
    onSuccess: (_, isOpen) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success(isOpen ? 'Mural abierto' : 'Mural cerrado');
    },
    onError: () => toast.error('Error al cambiar estado'),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (config: { enabled?: boolean; maxPerDay?: number; requireApproval?: boolean }) =>
      scrollApi.updateConfig(classroom.id, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success('Configuración actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  // Helpers
  const getRecipientText = (scroll: Scroll) => {
    if (scroll.recipientType === 'CLASS') return 'Toda la clase';
    if (scroll.recipientType === 'TEACHER') return 'Al profesor';
    if (scroll.recipientType === 'CLAN' && scroll.clan) return `Clan: ${scroll.clan.name}`;
    if (scroll.recipients && scroll.recipients.length > 0) {
      const names = scroll.recipients.map(r => r.characterName || r.displayName || 'Estudiante');
      if (names.length === 1) return names[0];
      if (names.length <= 3) return names.join(', ');
      return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`;
    }
    return 'Destinatario';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filtrar scrolls por fecha
  const filterScrollsByDate = (scrolls: Scroll[]) => {
    if (dateFilter === 'all') return scrolls;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return scrolls.filter(scroll => {
      const scrollDate = new Date(scroll.createdAt);
      
      if (dateFilter === 'today') {
        return scrollDate >= today;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return scrollDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return scrollDate >= monthAgo;
      }
      return true;
    });
  };

  // Agrupar scrolls por fecha
  const groupScrollsByDate = (scrolls: Scroll[]) => {
    const groups: { [key: string]: { label: string; scrolls: Scroll[] } } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    scrolls.forEach(scroll => {
      const scrollDate = new Date(scroll.createdAt);
      const scrollDay = new Date(scrollDate.getFullYear(), scrollDate.getMonth(), scrollDate.getDate());
      
      let key: string;
      let label: string;
      
      if (scrollDay.getTime() === today.getTime()) {
        key = 'today';
        label = 'Hoy';
      } else if (scrollDay.getTime() === yesterday.getTime()) {
        key = 'yesterday';
        label = 'Ayer';
      } else {
        key = scrollDay.toISOString().split('T')[0];
        label = scrollDate.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        // Capitalizar primera letra
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      
      if (!groups[key]) {
        groups[key] = { label, scrolls: [] };
      }
      groups[key].scrolls.push(scroll);
    });

    // Ordenar por fecha (más reciente primero)
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'today') return -1;
      if (b[0] === 'today') return 1;
      if (a[0] === 'yesterday') return -1;
      if (b[0] === 'yesterday') return 1;
      return b[0].localeCompare(a[0]);
    });
  };

  // Scrolls filtrados y agrupados
  const filteredScrolls = filterScrollsByDate(approvedScrolls);
  const groupedScrolls = groupScrollsByDate(filteredScrolls);

  // Render scroll card
  const renderScrollCard = (scroll: Scroll, showActions: boolean = false) => {
    const categoryConfig = SCROLL_CATEGORIES[scroll.category];
    
    return (
      <motion.div
        key={scroll.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${categoryConfig.borderColor} shadow-md overflow-hidden`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{categoryConfig.emoji}</span>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Para:</p>
                <p className="font-medium text-gray-800 dark:text-white text-sm">
                  {getRecipientText(scroll)}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${categoryConfig.color} text-white`}>
              {categoryConfig.label}
            </span>
          </div>

          {/* Message */}
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 whitespace-pre-wrap">
            {scroll.message}
          </p>

          {/* Image */}
          {scroll.imageUrl && (
            <div 
              className="mb-3 cursor-pointer"
              onClick={() => setPreviewImage(scroll.imageUrl)}
            >
              <img 
                src={scroll.imageUrl} 
                alt="Imagen adjunta" 
                className="w-full max-h-48 object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            </div>
          )}

          {/* Reactions */}
          {scroll.status === 'APPROVED' && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {REACTION_TYPES.map(reaction => {
                const scrollReaction = scroll.reactions.find(r => r.type === reaction.type);
                const count = scrollReaction?.count || 0;
                if (count === 0) return null;
                return (
                  <span 
                    key={reaction.type}
                    className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full"
                  >
                    <span>{reaction.emoji}</span>
                    <span className="text-gray-600 dark:text-gray-400">{count}</span>
                  </span>
                );
              })}
              {scroll.totalReactions === 0 && (
                <span className="text-xs text-gray-400">Sin reacciones aún</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {scroll.author.avatarUrl ? (
                <img src={scroll.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                  {(scroll.author.characterName || scroll.author.displayName || 'E')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">De:</p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {scroll.author.characterName || scroll.author.displayName || 'Estudiante'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {formatDate(scroll.createdAt)}
              </span>
              {showActions && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => approveMutation.mutate(scroll.id)}
                    disabled={approveMutation.isPending}
                    className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    title="Aprobar"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setRejectModal({ isOpen: true, scroll })}
                    className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    title="Rechazar"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {!showActions && scroll.status === 'APPROVED' && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, scroll })}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <ScrollText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              Pergaminos del Aula
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Mural de mensajes entre estudiantes
            </p>
          </div>
        </div>


      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.total || 0}</p>
              <p className="text-xs text-blue-500/70">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.pending || 0}</p>
              <p className="text-xs text-yellow-500/70">Pendientes</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.approved || 0}</p>
              <p className="text-xs text-green-500/70">Aprobados</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <X size={18} className="text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.rejected || 0}</p>
              <p className="text-xs text-red-500/70">Rechazados</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('mural')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'mural'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ScrollText size={16} />
            <span>Mural</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            activeTab === 'pending'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>Pendientes</span>
            {(stats?.pending || 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {stats?.pending}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'config'
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} />
            <span>Configuración</span>
          </div>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'mural' && (
          <motion.div
            key="mural"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Todos
                </button>
                {Object.entries(SCROLL_CATEGORIES).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key as ScrollCategory)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                      selectedCategory === key
                        ? `bg-gradient-to-r ${config.color} text-white`
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{config.emoji}</span>
                    <span>{config.label}</span>
                  </button>
                ))}
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Todas las fechas</option>
                  <option value="today">Hoy</option>
                  <option value="week">Última semana</option>
                  <option value="month">Último mes</option>
                </select>
              </div>
            </div>

            {/* Scrolls Grid - Grouped by Date */}
            {loadingApproved ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : filteredScrolls.length === 0 ? (
              <Card className="p-8 text-center">
                <ScrollText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay pergaminos en el mural</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {approvedScrolls.length > 0 ? 'No hay pergaminos en el rango de fechas seleccionado' : 'Los mensajes aprobados aparecerán aquí'}
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {groupedScrolls.map(([dateKey, { label, scrolls }]) => (
                  <div key={dateKey}>
                    {/* Date Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-full">
                        <Calendar size={14} className="text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{label}</span>
                        <span className="text-xs text-purple-500 dark:text-purple-400">({scrolls.length})</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-purple-200 to-transparent dark:from-purple-800"></div>
                    </div>
                    
                    {/* Scrolls for this date */}
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                      {scrolls.map(scroll => (
                        <div key={scroll.id} className="break-inside-avoid">
                          {renderScrollCard(scroll)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
              </div>
            ) : pendingScrolls.length === 0 ? (
              <Card className="p-8 text-center">
                <Check size={48} className="mx-auto text-green-300 dark:text-green-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay pergaminos pendientes</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  ¡Todo revisado!
                </p>
              </Card>
            ) : (
              <div className="columns-1 md:columns-2 gap-4 space-y-4">
                {pendingScrolls.map(scroll => (
                  <div key={scroll.id} className="break-inside-avoid">
                    {renderScrollCard(scroll, true)}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="p-6 space-y-6">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Settings size={18} />
                Configuración del Mural
              </h3>

              {/* Enabled */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Habilitar Pergaminos</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Activa o desactiva la funcionalidad completa
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={classroom.scrollsEnabled}
                    onChange={(e) => updateConfigMutation.mutate({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Require Approval */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Requiere Aprobación</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Los mensajes deben ser aprobados antes de publicarse
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={classroom.scrollsRequireApproval}
                    onChange={(e) => updateConfigMutation.mutate({ requireApproval: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Max Per Day */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Límite Diario</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Máximo de pergaminos por estudiante al día
                  </p>
                </div>
                <select
                  value={classroom.scrollsMaxPerDay}
                  onChange={(e) => updateConfigMutation.mutate({ maxPerDay: parseInt(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500"
                >
                  {[1, 2, 3, 5, 10].map(n => (
                    <option key={n} value={n}>{n} pergamino{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal.isOpen && rejectModal.scroll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setRejectModal({ isOpen: false, scroll: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                Rechazar Pergamino
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Indica la razón por la que rechazas este mensaje. El estudiante será notificado.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Escribe la razón del rechazo..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRejectModal({ isOpen: false, scroll: null });
                    setRejectReason('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (rejectReason.trim()) {
                      rejectMutation.mutate({ scrollId: rejectModal.scroll!.id, reason: rejectReason });
                    } else {
                      toast.error('Debes indicar una razón');
                    }
                  }}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                >
                  Rechazar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, scroll: null })}
        onConfirm={() => {
          if (deleteConfirm.scroll) {
            deleteMutation.mutate(deleteConfirm.scroll.id);
          }
        }}
        title="Eliminar Pergamino"
        message="¿Estás seguro de que deseas eliminar este pergamino? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
