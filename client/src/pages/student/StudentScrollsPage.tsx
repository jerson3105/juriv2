import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  Plus,
  Send,
  X,
  Users,
  User,
  Shield,
  GraduationCap,
  Image as ImageIcon,
  Clock,
  AlertCircle,
  Check,
  XCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  scrollApi,
  SCROLL_CATEGORIES,
  REACTION_TYPES,
  type Scroll,
  type ScrollCategory,
  type ScrollRecipientType,
  type CreateScrollDto,
} from '../../lib/scrollApi';
import { clanApi } from '../../lib/clanApi';
import { studentApi } from '../../lib/studentApi';
import { useStudentStore } from '../../store/studentStore';
import toast from 'react-hot-toast';

export const StudentScrollsPage = () => {
  const queryClient = useQueryClient();
  const { selectedClassIndex } = useStudentStore();
  
  // Obtener clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });
  
  const studentProfile = myClasses?.[selectedClassIndex];
  const classroom = studentProfile ? {
    id: studentProfile.classroomId,
    scrollsEnabled: studentProfile.classroom?.scrollsEnabled,
    scrollsOpen: studentProfile.classroom?.scrollsOpen,
    scrollsRequireApproval: studentProfile.classroom?.scrollsRequireApproval,
  } : null;
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'mural' | 'mine'>('mural');
  const [selectedCategory, setSelectedCategory] = useState<ScrollCategory | 'ALL'>('ALL');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Form state
  const [formData, setFormData] = useState<{
    message: string;
    imageUrl: string;
    category: ScrollCategory;
    recipientType: ScrollRecipientType;
    recipientIds: string[];
  }>({
    message: '',
    imageUrl: '',
    category: 'MOTIVATION',
    recipientType: 'CLASS',
    recipientIds: [],
  });

  // Queries
  const { data: approvedScrolls = [], isLoading: loadingApproved } = useQuery({
    queryKey: ['scrolls-approved', classroom?.id, selectedCategory],
    queryFn: () => scrollApi.getApproved(
      classroom!.id, 
      selectedCategory !== 'ALL' 
        ? { category: selectedCategory, studentProfileId: studentProfile?.id } 
        : { studentProfileId: studentProfile?.id }
    ),
    enabled: !!classroom?.id,
  });

  const { data: myScrolls = [], isLoading: loadingMine } = useQuery({
    queryKey: ['scrolls-mine', studentProfile?.id],
    queryFn: () => scrollApi.getByStudent(studentProfile!.id),
    enabled: !!studentProfile?.id,
  });

  const { data: classmates = [] } = useQuery({
    queryKey: ['classmates', classroom?.id],
    queryFn: async () => {
      const response = await fetch(`/api/classrooms/${classroom!.id}/students`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      return data.filter((s: any) => s.id !== studentProfile?.id);
    },
    enabled: !!classroom?.id && showCreateModal,
  });

  const { data: clans = [] } = useQuery({
    queryKey: ['clans', classroom?.id],
    queryFn: () => clanApi.getClassroomClans(classroom!.id),
    enabled: !!classroom?.id && showCreateModal,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateScrollDto) => scrollApi.create(classroom!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrolls-approved', classroom?.id] });
      queryClient.invalidateQueries({ queryKey: ['scrolls-mine', studentProfile?.id] });
      setShowCreateModal(false);
      resetForm();
      toast.success(
        classroom?.scrollsRequireApproval 
          ? '¡Pergamino enviado! Esperando aprobación del profesor.' 
          : '¡Pergamino publicado!'
      );
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al enviar el pergamino');
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ scrollId, reactionType }: { scrollId: string; reactionType: string }) =>
      scrollApi.toggleReaction(scrollId, studentProfile!.id, reactionType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrolls-approved', classroom?.id] });
    },
  });

  // Helpers
  const resetForm = () => {
    setFormData({
      message: '',
      imageUrl: '',
      category: 'MOTIVATION',
      recipientType: 'CLASS',
      recipientIds: [],
    });
  };

  const handleSubmit = () => {
    if (!formData.message.trim()) {
      toast.error('Escribe un mensaje');
      return;
    }

    if ((formData.recipientType === 'STUDENT' || formData.recipientType === 'MULTIPLE') && formData.recipientIds.length === 0) {
      toast.error('Selecciona al menos un destinatario');
      return;
    }

    if (formData.recipientType === 'CLAN' && formData.recipientIds.length === 0) {
      toast.error('Selecciona un clan');
      return;
    }

    createMutation.mutate({
      authorId: studentProfile!.id,
      message: formData.message,
      imageUrl: formData.imageUrl || undefined,
      category: formData.category,
      recipientType: formData.recipientType,
      recipientIds: formData.recipientIds.length > 0 ? formData.recipientIds : undefined,
    });
  };

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
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      
      if (!groups[key]) {
        groups[key] = { label, scrolls: [] };
      }
      groups[key].scrolls.push(scroll);
    });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full">
            <Clock size={12} />
            Pendiente
          </span>
        );
      case 'APPROVED':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
            <Check size={12} />
            Aprobado
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
            <XCircle size={12} />
            Rechazado
          </span>
        );
      default:
        return null;
    }
  };

  // Render scroll card
  const renderScrollCard = (scroll: Scroll, showStatus: boolean = false) => {
    const categoryConfig = SCROLL_CATEGORIES[scroll.category];
    const isMyScroll = scroll.authorId === studentProfile?.id;
    
    return (
      <motion.div
        key={scroll.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
            <div className="flex items-center gap-2">
              {showStatus && getStatusBadge(scroll.status)}
              <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${categoryConfig.color} text-white`}>
                {categoryConfig.label}
              </span>
            </div>
          </div>

          {/* Rejection reason */}
          {scroll.status === 'REJECTED' && scroll.rejectionReason && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">
                <strong>Razón:</strong> {scroll.rejectionReason}
              </p>
            </div>
          )}

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
                const hasReacted = scrollReaction?.hasReacted || false;
                
                return (
                  <button
                    key={reaction.type}
                    onClick={() => reactionMutation.mutate({ scrollId: scroll.id, reactionType: reaction.type })}
                    disabled={isMyScroll}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                      hasReacted
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 ring-2 ring-purple-300 dark:ring-purple-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } ${isMyScroll ? 'cursor-default' : 'cursor-pointer'}`}
                    title={reaction.label}
                  >
                    <span>{reaction.emoji}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
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
                  {isMyScroll ? 'Tú' : (scroll.author.characterName || scroll.author.displayName || 'Estudiante')}
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-400">
              {formatDate(scroll.createdAt)}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!classroom?.scrollsEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <ScrollText size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
          Pergaminos no disponibles
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          El profesor no ha habilitado esta función para tu clase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <ScrollText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              Pergaminos del Aula
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Mensajes de motivación y reconocimiento
            </p>
          </div>
        </div>

        {classroom?.scrollsOpen && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nuevo Pergamino</span>
          </Button>
        )}
      </div>

      {/* Mural closed notice */}
      {!classroom?.scrollsOpen && (
        <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-yellow-500" size={24} />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">
                El mural está cerrado
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                El profesor ha cerrado temporalmente el envío de pergaminos.
              </p>
            </div>
          </div>
        </Card>
      )}

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
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'mine'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Send size={16} />
            <span>Mis Pergaminos</span>
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
                  {approvedScrolls.length > 0 ? 'No hay pergaminos en el rango de fechas seleccionado' : '¡Sé el primero en enviar un mensaje!'}
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

        {activeTab === 'mine' && (
          <motion.div
            key="mine"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {loadingMine ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              </div>
            ) : myScrolls.length === 0 ? (
              <Card className="p-8 text-center">
                <Send size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No has enviado pergaminos</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Envía tu primer mensaje de motivación
                </p>
              </Card>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {myScrolls.map(scroll => (
                  <div key={scroll.id} className="break-inside-avoid">
                    {renderScrollCard(scroll, true)}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <ScrollText size={20} className="text-amber-500" />
                  Nuevo Pergamino
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de mensaje
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(SCROLL_CATEGORIES).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, category: key as ScrollCategory })}
                        className={`p-2 rounded-lg border-2 transition-all text-center ${
                          formData.category === key
                            ? `border-transparent bg-gradient-to-r ${config.color} text-white`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xl block mb-1">{config.emoji}</span>
                        <span className="text-xs">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ¿Para quién?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, recipientType: 'CLASS', recipientIds: [] })}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        formData.recipientType === 'CLASS'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Users size={20} className="mx-auto mb-1 text-purple-500" />
                      <span className="text-xs">Toda la clase</span>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, recipientType: 'STUDENT', recipientIds: [] })}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        formData.recipientType === 'STUDENT' || formData.recipientType === 'MULTIPLE'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <User size={20} className="mx-auto mb-1 text-blue-500" />
                      <span className="text-xs">Compañero(s)</span>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, recipientType: 'CLAN', recipientIds: [] })}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        formData.recipientType === 'CLAN'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Shield size={20} className="mx-auto mb-1 text-green-500" />
                      <span className="text-xs">Un clan</span>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, recipientType: 'TEACHER', recipientIds: [] })}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        formData.recipientType === 'TEACHER'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <GraduationCap size={20} className="mx-auto mb-1 text-amber-500" />
                      <span className="text-xs">Profesor</span>
                    </button>
                  </div>
                </div>

                {/* Recipient Selection */}
                {(formData.recipientType === 'STUDENT' || formData.recipientType === 'MULTIPLE') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selecciona compañero(s)
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                      {classmates.map((student: any) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.recipientIds.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  recipientIds: [...formData.recipientIds, student.id],
                                  recipientType: formData.recipientIds.length >= 1 ? 'MULTIPLE' : 'STUDENT',
                                });
                              } else {
                                const newIds = formData.recipientIds.filter(id => id !== student.id);
                                setFormData({
                                  ...formData,
                                  recipientIds: newIds,
                                  recipientType: newIds.length > 1 ? 'MULTIPLE' : 'STUDENT',
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {student.characterName || student.displayName || 'Estudiante'}
                          </span>
                        </label>
                      ))}
                      {classmates.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-2">No hay compañeros disponibles</p>
                      )}
                    </div>
                  </div>
                )}

                {formData.recipientType === 'CLAN' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selecciona un clan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {clans.map((clan: any) => (
                        <button
                          key={clan.id}
                          onClick={() => setFormData({ ...formData, recipientIds: [clan.id] })}
                          className={`p-2 rounded-lg border-2 transition-all text-left ${
                            formData.recipientIds.includes(clan.id)
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-medium text-sm">{clan.name}</span>
                        </button>
                      ))}
                      {clans.length === 0 && (
                        <p className="text-sm text-gray-400 col-span-2 text-center py-2">No hay clanes disponibles</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tu mensaje
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Escribe tu mensaje de motivación..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {formData.message.length}/500
                  </p>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Imagen (opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://ejemplo.com/imagen.jpg"
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <button
                      type="button"
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"
                      title="Pegar URL de imagen"
                    >
                      <ImageIcon size={20} />
                    </button>
                  </div>
                  {formData.imageUrl && (
                    <img 
                      src={formData.imageUrl} 
                      alt="Preview" 
                      className="mt-2 max-h-32 rounded-lg object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || !formData.message.trim()}
                    className="flex items-center gap-2"
                  >
                    <Send size={16} />
                    {createMutation.isPending ? 'Enviando...' : 'Enviar Pergamino'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
