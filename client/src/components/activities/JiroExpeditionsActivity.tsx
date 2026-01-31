import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Plus, Map, Clock, Zap, Users, Play, Pause, Settings, Trash2,
  Eye, FileText, Upload, BookOpen, Trophy, AlertCircle, X, BarChart3,
  Sparkles, Target, CheckCircle, XCircle, Award, Star, HelpCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { jiroExpeditionApi, type CreateExpeditionData } from '../../lib/jiroExpeditionApi';
import { questionBankApi } from '../../lib/questionBankApi';
import { classroomApi } from '../../lib/classroomApi';
import toast from 'react-hot-toast';

// Imagen de Jiro - coloca la imagen en: public/jiro-mascot.png (tamaño recomendado: 128x128px o 256x256px)
const JIRO_IMAGE = '/jiro-mascot.png';

interface Props {
  classroom: any;
  onBack: () => void;
}

export const JiroExpeditionsActivity = ({ classroom, onBack }: Props) => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExpedition, setSelectedExpedition] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'progress' | 'deliveries'>('list');

  const { data: expeditions = [], isLoading } = useQuery({
    queryKey: ['jiro-expeditions', classroom.id],
    queryFn: () => jiroExpeditionApi.getByClassroom(classroom.id),
  });

  const { data: questionBanks = [] } = useQuery({
    queryKey: ['question-banks', classroom.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateExpeditionData) => jiroExpeditionApi.create(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-expeditions', classroom.id] });
      setShowCreateModal(false);
      toast.success('Expedición creada');
    },
    onError: () => toast.error('Error al crear expedición'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jiroExpeditionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-expeditions', classroom.id] });
      toast.success('Expedición eliminada');
    },
  });

  const openMutation = useMutation({
    mutationFn: (id: string) => jiroExpeditionApi.open(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-expeditions', classroom.id] });
      toast.success('Expedición abierta');
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => jiroExpeditionApi.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-expeditions', classroom.id] });
      toast.success('Expedición cerrada');
    },
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string; dot: string }> = {
      DRAFT: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', label: 'Borrador', dot: 'bg-gray-400' },
      OPEN: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Abierta', dot: 'bg-emerald-500' },
      IN_PROGRESS: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'En Progreso', dot: 'bg-blue-500 animate-pulse' },
      CLOSED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Cerrada', dot: 'bg-red-500' },
    };
    return configs[status] || configs.DRAFT;
  };

  if (viewMode === 'detail' && selectedExpedition) {
    return <ExpeditionDetailView expeditionId={selectedExpedition} onBack={() => { setViewMode('list'); setSelectedExpedition(null); }} />;
  }

  if (viewMode === 'progress' && selectedExpedition) {
    return <ExpeditionProgressView expeditionId={selectedExpedition} onBack={() => { setViewMode('list'); setSelectedExpedition(null); }} classroom={classroom} />;
  }

  if (viewMode === 'deliveries' && selectedExpedition) {
    return <ExpeditionDeliveriesView expeditionId={selectedExpedition} onBack={() => { setViewMode('list'); setSelectedExpedition(null); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 p-6 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="p-2 text-white hover:bg-white/20">
              <ChevronLeft size={24} />
            </Button>
            <div className="flex items-center gap-4">
              <motion.img 
                src={JIRO_IMAGE} 
                alt="Jiro" 
                className="w-16 h-16 object-contain drop-shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                  La Expedición de Jiro
                  <Sparkles className="w-6 h-6 text-yellow-200" />
                </h1>
                <p className="text-white/80 text-sm md:text-base">Actividades gamificadas con bancos de preguntas</p>
              </div>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              className="gap-2 !bg-white !text-orange-600 hover:!bg-orange-50 shadow-lg font-semibold border-0"
            >
              <Plus size={18} className="text-orange-600" />
              Nueva Expedición
            </Button>
          </motion.div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-orange-200 border-t-orange-500"
          />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Cargando expediciones...</p>
        </div>
      ) : expeditions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-12 text-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-900 border-2 border-dashed border-orange-200 dark:border-orange-800">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-7xl mb-4"
            >
              🗺️
            </motion.div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¡Comienza la aventura!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Crea tu primera expedición para que tus estudiantes comiencen su viaje de aprendizaje con Jiro
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => setShowCreateModal(true)} className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg">
                <Plus size={18} />
                Crear Primera Expedición
              </Button>
            </motion.div>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {expeditions.map((exp, index) => {
              const statusConfig = getStatusConfig(exp.status);
              return (
                <motion.div 
                  key={exp.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="group p-0 overflow-hidden hover:shadow-xl transition-all duration-300 border-l-4 border-l-orange-400">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Título y badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{exp.name}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                              {statusConfig.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                              exp.mode === 'EXAM' 
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                                : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                            }`}>
                              {exp.mode === 'EXAM' ? <Clock size={12} /> : <Sparkles size={12} />}
                              {exp.mode === 'EXAM' ? 'Examen' : 'Asincrónico'}
                            </span>
                          </div>
                          
                          {exp.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-1">{exp.description}</p>
                          )}
                          
                          {/* Stats */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <BookOpen size={15} className="text-indigo-500" />
                              <span className="truncate max-w-[120px]">{exp.questionBank?.name || 'Sin banco'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <Map size={15} className="text-emerald-500" />
                              {exp.totalQuestions} preguntas
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <Users size={15} className="text-blue-500" />
                              {exp.studentsStarted} iniciaron
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <Zap size={15} className="text-yellow-500" />
                              {exp.initialEnergy} energía
                            </span>
                            {exp.mode === 'EXAM' && exp.timeLimitMinutes && (
                              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                <Clock size={15} className="text-purple-500" />
                                {exp.timeLimitMinutes} min
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {exp.status === 'DRAFT' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setSelectedExpedition(exp.id); setViewMode('detail'); }}
                                className="text-gray-500 hover:text-gray-700"
                                title="Configurar"
                              >
                                <Settings size={18} />
                              </Button>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button 
                                  variant="primary" 
                                  size="sm" 
                                  onClick={() => openMutation.mutate(exp.id)} 
                                  disabled={openMutation.isPending} 
                                  className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                                >
                                  <Play size={14} />
                                  Abrir
                                </Button>
                              </motion.div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { if (confirm('¿Eliminar esta expedición?')) deleteMutation.mutate(exp.id); }} 
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </>
                          )}
                          {(exp.status === 'OPEN' || exp.status === 'IN_PROGRESS') && (
                            <>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => { setSelectedExpedition(exp.id); setViewMode('progress'); }} 
                                  className="gap-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <BarChart3 size={16} />
                                  <span className="hidden sm:inline">Progreso</span>
                                </Button>
                              </motion.div>
                              {exp.requiresReview && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => { setSelectedExpedition(exp.id); setViewMode('deliveries'); }} 
                                  className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                  title="Entregas pendientes"
                                >
                                  <FileText size={18} />
                                </Button>
                              )}
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => closeMutation.mutate(exp.id)} 
                                disabled={closeMutation.isPending} 
                                className="gap-1.5"
                              >
                                <Pause size={14} />
                                Cerrar
                              </Button>
                            </>
                          )}
                          {exp.status === 'CLOSED' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setSelectedExpedition(exp.id); setViewMode('progress'); }} 
                                className="gap-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <Eye size={16} />
                                <span className="hidden sm:inline">Ver resultados</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { if (confirm('¿Eliminar esta expedición y todos sus datos? Esta acción no se puede deshacer.')) deleteMutation.mutate(exp.id); }} 
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar expedición"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <CreateExpeditionModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} questionBanks={questionBanks} classroom={classroom} />
    </div>
  );
};

// Modal crear expedición
const CreateExpeditionModal = ({ isOpen, onClose, onSubmit, isLoading, questionBanks, classroom }: { isOpen: boolean; onClose: () => void; onSubmit: (data: CreateExpeditionData) => void; isLoading: boolean; questionBanks: any[]; classroom: any }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questionBankId, setQuestionBankId] = useState('');
  const [mode, setMode] = useState<'ASYNC' | 'EXAM'>('ASYNC');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [initialEnergy, setInitialEnergy] = useState(5);
  const [energyRegenMinutes, setEnergyRegenMinutes] = useState(30);
  const [energyPurchasePrice, setEnergyPurchasePrice] = useState(5);
  const [rewardXpPerCorrect, setRewardXpPerCorrect] = useState(10);
  const [rewardGpPerCorrect, setRewardGpPerCorrect] = useState(2);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([]);

  // Obtener áreas curriculares para las competencias
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: isOpen && classroom?.useCompetencies,
  });

  // Obtener competencias del área de la clase
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  const toggleCompetency = (id: string) => {
    setSelectedCompetencyIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !questionBankId) { toast.error('Completa los campos requeridos'); return; }
    onSubmit({ 
      name: name.trim(), 
      description: description.trim() || undefined, 
      questionBankId, 
      mode, 
      timeLimitMinutes: mode === 'EXAM' ? timeLimitMinutes : undefined, 
      initialEnergy, 
      energyRegenMinutes, 
      energyPurchasePrice, 
      rewardXpPerCorrect, 
      rewardGpPerCorrect,
      competencyIds: selectedCompetencyIds.length > 0 ? selectedCompetencyIds : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header fijo */}
        <div className="flex-shrink-0 p-6 bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <motion.img 
                src={JIRO_IMAGE} 
                alt="Jiro" 
                className="w-12 h-12 object-contain drop-shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h2 className="text-xl font-bold">Nueva Expedición</h2>
                <p className="text-sm text-white/80">Configura la aventura</p>
              </div>
            </div>
            <motion.button 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>
        
        {/* Contenido scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Aventura Matemática" required />
          </div>
          
          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Describe la expedición..." 
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all" 
              rows={2} 
            />
          </div>
          
          {/* Banco de preguntas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Banco de preguntas *</label>
            {questionBanks.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                No tienes bancos de preguntas. Crea uno primero.
              </div>
            ) : (
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {questionBanks.map((bank: any) => (
                  <motion.button 
                    key={bank.id} 
                    type="button" 
                    onClick={() => setQuestionBankId(bank.id)} 
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      questionBankId === bank.id 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md" style={{ backgroundColor: bank.color }}>
                      <BookOpen size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{bank.name}</p>
                      <p className="text-xs text-gray-500">{bank.questionCount || 0} preguntas</p>
                    </div>
                    {questionBankId === bank.id && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center"
                      >
                        <CheckCircle size={14} className="text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
          
          {/* Modo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modo</label>
            <div className="grid grid-cols-2 gap-3">
              <motion.button 
                type="button" 
                onClick={() => setMode('ASYNC')} 
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  mode === 'ASYNC' 
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-md' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles size={28} className={`mx-auto mb-2 ${mode === 'ASYNC' ? 'text-teal-500' : 'text-gray-400'}`} />
                <p className="font-semibold text-gray-900 dark:text-white">Asincrónico</p>
                <p className="text-xs text-gray-500 mt-1">Sin límite, energía regenera</p>
              </motion.button>
              <motion.button 
                type="button" 
                onClick={() => setMode('EXAM')} 
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  mode === 'EXAM' 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Clock size={28} className={`mx-auto mb-2 ${mode === 'EXAM' ? 'text-purple-500' : 'text-gray-400'}`} />
                <p className="font-semibold text-gray-900 dark:text-white">Examen</p>
                <p className="text-xs text-gray-500 mt-1">Tiempo límite, sin regeneración</p>
              </motion.button>
            </div>
          </div>
          
          {/* Tiempo límite (solo modo examen) */}
          <AnimatePresence>
            {mode === 'EXAM' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Tiempo límite (minutos)
                </label>
                <Input 
                  type="number" 
                  value={timeLimitMinutes} 
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))} 
                  min={1} 
                  max={180} 
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Energía */}
          <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
              <Zap size={18} className="text-yellow-500" />
              Energía
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Inicial</label>
                <Input type="number" value={initialEnergy} onChange={(e) => setInitialEnergy(Number(e.target.value))} min={1} max={10} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Regenera (min)</label>
                <Input type="number" value={energyRegenMinutes} onChange={(e) => setEnergyRegenMinutes(Number(e.target.value))} min={5} max={120} disabled={mode === 'EXAM'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Precio (GP)</label>
                <Input type="number" value={energyPurchasePrice} onChange={(e) => setEnergyPurchasePrice(Number(e.target.value))} min={1} max={100} />
              </div>
            </div>
          </div>
          
          {/* Selector de Competencias - Solo si la clase usa competencias */}
          {classroom?.useCompetencies && classroomCompetencies.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
              <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Target size={18} className="text-purple-500" />
                Competencias que evalúa esta expedición
              </h4>
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                {classroomCompetencies.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompetency(c.id)}
                    className={`p-2 rounded-lg text-left text-sm transition-all ${
                      selectedCompetencyIds.includes(c.id)
                        ? 'bg-purple-200 dark:bg-purple-800 ring-2 ring-purple-500'
                        : 'bg-white dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        selectedCompetencyIds.includes(c.id)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        {selectedCompetencyIds.includes(c.id) && <CheckCircle size={12} />}
                      </div>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              {selectedCompetencyIds.length > 0 && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                  {selectedCompetencyIds.length} competencia{selectedCompetencyIds.length > 1 ? 's' : ''} seleccionada{selectedCompetencyIds.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Recompensas */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-emerald-500" />
              Recompensas por respuesta correcta
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Star size={12} className="text-purple-500" />
                  XP
                </label>
                <Input type="number" value={rewardXpPerCorrect} onChange={(e) => setRewardXpPerCorrect(Number(e.target.value))} min={0} max={100} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Award size={12} className="text-yellow-500" />
                  GP
                </label>
                <Input type="number" value={rewardGpPerCorrect} onChange={(e) => setRewardGpPerCorrect(Number(e.target.value))} min={0} max={50} />
              </div>
            </div>
          </div>
          
          {/* Botones */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white dark:bg-gray-800 pb-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                type="submit" 
                disabled={isLoading || !name.trim() || !questionBankId} 
                isLoading={isLoading} 
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg"
              >
                <Sparkles size={16} className="mr-2" />
                Crear Expedición
              </Button>
            </motion.div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// Vista detalle
const ExpeditionDetailView = ({ expeditionId, onBack }: { expeditionId: string; onBack: () => void }) => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const { data: expedition, isLoading } = useQuery({ queryKey: ['jiro-expedition', expeditionId], queryFn: () => jiroExpeditionApi.getById(expeditionId) });
  const addMutation = useMutation({ mutationFn: (data: any) => jiroExpeditionApi.createDeliveryStation(expeditionId, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jiro-expedition', expeditionId] }); setShowAddModal(false); toast.success('Estación agregada'); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => jiroExpeditionApi.deleteDeliveryStation(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jiro-expedition', expeditionId] }); toast.success('Eliminada'); } });

  if (isLoading || !expedition) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button variant="ghost" onClick={onBack} className="p-2"><ChevronLeft size={20} /></Button><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{expedition.name}</h1><p className="text-gray-500">Configuración</p></div></div>
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><BookOpen size={18} />Banco de preguntas</h3>
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: expedition.questionBank?.color || '#6366f1' }}><BookOpen size={24} /></div>
          <div><p className="font-medium text-gray-900 dark:text-white">{expedition.questionBank?.name}</p><p className="text-sm text-gray-500">{expedition.questionBank?.questions?.length || 0} preguntas</p></div>
        </div>
      </Card>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Upload size={18} />Estaciones de Entrega</h3><Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5"><Plus size={16} />Agregar</Button></div>
        {expedition.deliveryStations.length === 0 ? (
          <div className="text-center py-8 text-gray-500"><Upload size={32} className="mx-auto mb-2 opacity-50" /><p>No hay estaciones de entrega</p></div>
        ) : (
          <div className="space-y-3">
            {expedition.deliveryStations.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold text-sm">{i + 1}</div><div><p className="font-medium text-gray-900 dark:text-white">{s.name}</p><p className="text-xs text-gray-500">{Array.isArray(s.allowedFileTypes) ? s.allowedFileTypes.join(', ') : s.allowedFileTypes} • Máx {s.maxFileSizeMb}MB</p></div></div>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Eliminar?')) deleteMutation.mutate(s.id); }} className="text-red-500"><Trash2 size={16} /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {showAddModal && <AddDeliveryModal onClose={() => setShowAddModal(false)} onSubmit={(d) => addMutation.mutate(d)} isLoading={addMutation.isPending} orderIndex={expedition.deliveryStations.length} />}
    </div>
  );
};

// Modal agregar estación
const AddDeliveryModal = ({ onClose, onSubmit, isLoading, orderIndex }: { onClose: () => void; onSubmit: (d: any) => void; isLoading: boolean; orderIndex: number }) => {
  const [description, setDescription] = useState('');
  // Tipos y tamaño estandarizados
  const standardTypes = ['PDF', 'IMAGE', 'WORD', 'EXCEL', 'POWERPOINT'];
  const standardMaxSize = 5;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!description.trim()) return; onSubmit({ name: `Entrega ${orderIndex + 1}`, description: description.trim(), orderIndex, allowedFileTypes: standardTypes, maxFileSizeMb: standardMaxSize }); };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Upload size={20} className="text-amber-500" />Nueva Estación de Entrega</h2><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descripción de la entrega *</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Describe qué debe subir el estudiante. Ej: Sube tu informe del proyecto en formato PDF o Word..."
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Formatos permitidos:</span>
              <span className="font-medium text-gray-900 dark:text-white">PDF, Imagen, Word, Excel, PowerPoint</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tamaño máximo:</span>
              <span className="font-medium text-gray-900 dark:text-white">5 MB</span>
            </div>
          </div>
          <div className="flex gap-3"><Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button><Button type="submit" disabled={isLoading || !description.trim()} isLoading={isLoading} className="flex-1">Agregar</Button></div>
        </form>
      </motion.div>
    </div>
  );
};

// Vista progreso
const ExpeditionProgressView = ({ expeditionId, onBack, classroom }: { expeditionId: string; onBack: () => void; classroom: any }) => {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const { data: progress, isLoading } = useQuery({ 
    queryKey: ['jiro-progress', expeditionId], 
    queryFn: () => jiroExpeditionApi.getClassProgress(expeditionId), 
    refetchInterval: 10000 
  });

  // Verificar si la clase usa competencias
  const usesCompetencies = classroom?.useCompetencies ?? false;
  
  if (isLoading || !progress) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-4 border-orange-200 border-t-orange-500"
        />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Cargando progreso...</p>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    NOT_STARTED: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', label: 'Sin iniciar', icon: Clock },
    IN_PROGRESS: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'En progreso', icon: Target },
    PENDING_REVIEW: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendiente', icon: Eye },
    COMPLETED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Completado', icon: CheckCircle },
  };

  const stats = {
    total: progress.progress.length,
    inProgress: progress.progress.filter(p => p.status === 'IN_PROGRESS').length,
    pending: progress.progress.filter(p => p.status === 'PENDING_REVIEW').length,
    completed: progress.progress.filter(p => p.status === 'COMPLETED').length,
  };

  // Calcular nota según si usa competencias o no
  const calculateGrade = (p: any) => {
    if (!p.finalScore && p.finalScore !== 0) return '-';
    const score = parseFloat(p.finalScore) || 0;
    if (usesCompetencies) {
      // Mostrar nivel de logro (AD, A, B, C) junto con porcentaje
      let level = 'C';
      if (score >= 90) level = 'AD';
      else if (score >= 70) level = 'A';
      else if (score >= 50) level = 'B';
      return `${level} (${score.toFixed(0)}%)`;
    }
    // Mostrar porcentaje
    return `${score.toFixed(0)}%`;
  };

  const getGradeColor = (p: any) => {
    if (!p.finalScore && p.finalScore !== 0) return 'text-gray-400';
    const score = parseFloat(p.finalScore) || 0;
    if (usesCompetencies) {
      if (score >= 90) return 'text-purple-600 dark:text-purple-400';
      if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
      if (score >= 50) return 'text-amber-600 dark:text-amber-400';
      return 'text-red-600 dark:text-red-400';
    }
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (selectedStudent) {
    return (
      <StudentAnswersView 
        expeditionId={expeditionId} 
        studentProfileId={selectedStudent}
        studentName={progress.progress.find(p => p.student.id === selectedStudent)?.student.name || 'Estudiante'}
        onBack={() => setSelectedStudent(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-6 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="p-2 text-white hover:bg-white/20">
            <ChevronLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7" />
              Progreso de la Clase
            </h1>
            <p className="text-white/80">{progress.expedition.name}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-4 text-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-0 shadow-md">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500">Estudiantes</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-0 shadow-md">
            <Target className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
            <p className="text-sm text-blue-600/70 dark:text-blue-400/70">En progreso</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4 text-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-0 shadow-md">
            <Clock className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
            <p className="text-sm text-amber-600/70 dark:text-amber-400/70">Pendientes</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-4 text-center bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border-0 shadow-md">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
            <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">Completados</p>
          </Card>
        </motion.div>
      </div>

      {/* Tabla de estudiantes */}
      <Card className="overflow-hidden shadow-lg border-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Estudiante</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Progreso</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Correctas</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <span className="flex items-center justify-center gap-1">
                    <Zap size={14} className="text-yellow-500" />
                    Energía
                  </span>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Nota
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {progress.progress.map((p, index) => {
                const config = statusConfig[p.status];
                const StatusIcon = config.icon;
                const progressPercent = p.totalStations > 0 ? (p.completedStations / p.totalStations) * 100 : 0;
                
                return (
                  <motion.tr 
                    key={p.student.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {p.student.level}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{p.student.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                        <StatusIcon size={12} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-28 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                          {p.completedStations}/{p.totalStations}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{p.correctAnswers}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-500">{p.correctAnswers + p.wrongAnswers}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                        <Zap size={14} className="text-yellow-500" />
                        <span className="font-medium text-yellow-700 dark:text-yellow-400">{p.currentEnergy}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-lg font-bold ${getGradeColor(p)}`}>
                        {calculateGrade(p)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(p.status === 'IN_PROGRESS' || p.status === 'COMPLETED') && (
                        <motion.button
                          onClick={() => setSelectedStudent(p.student.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Eye size={14} />
                          Ver respuestas
                        </motion.button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Vista de respuestas del estudiante
const StudentAnswersView = ({ expeditionId, studentProfileId, studentName, onBack }: { 
  expeditionId: string; 
  studentProfileId: string; 
  studentName: string;
  onBack: () => void;
}) => {
  const queryClient = useQueryClient();
  const { data: answers = [], isLoading: loadingAnswers } = useQuery({
    queryKey: ['jiro-student-answers', expeditionId, studentProfileId],
    queryFn: () => jiroExpeditionApi.getStudentAnswers(expeditionId, studentProfileId),
  });

  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ['jiro-student-deliveries', expeditionId, studentProfileId],
    queryFn: () => jiroExpeditionApi.getStudentDeliveries(expeditionId, studentProfileId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, feedback }: { id: string; status: 'APPROVED' | 'REJECTED'; feedback?: string }) =>
      jiroExpeditionApi.reviewDelivery(id, status, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jiro-student-deliveries', expeditionId, studentProfileId] });
      queryClient.invalidateQueries({ queryKey: ['jiro-deliveries', expeditionId] });
      toast.success('Entrega revisada');
    },
  });

  const isLoading = loadingAnswers || loadingDeliveries;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-500"
        />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Cargando respuestas...</p>
      </div>
    );
  }

  const getFileIcon = (fileType: string) => {
    if (fileType === 'PDF') return '📄';
    if (fileType === 'IMAGE') return '🖼️';
    if (fileType === 'WORD') return '📝';
    if (fileType === 'EXCEL') return '📊';
    return '📁';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Aprobado</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Rechazado</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendiente</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="p-2 text-white hover:bg-white/20">
            <ChevronLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Respuestas de {studentName}
            </h1>
            <p className="text-white/80">
              {answers?.length || 0} preguntas • {deliveries?.length || 0} entregas
            </p>
          </div>
        </div>
      </div>

      {/* Sección de Entregas de Archivos */}
      {deliveries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload size={20} className="text-amber-500" />
            Entregas de Archivos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {deliveries.map((delivery: any, index: number) => (
              <motion.div
                key={delivery.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`p-4 border-l-4 ${
                  delivery.status === 'APPROVED' ? 'border-l-emerald-500' :
                  delivery.status === 'REJECTED' ? 'border-l-red-500' :
                  'border-l-amber-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{getFileIcon(delivery.fileType)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          {delivery.stationName}
                        </span>
                        {getStatusBadge(delivery.status)}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white truncate" title={delivery.fileName}>
                        {delivery.fileName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(delivery.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                        {delivery.submittedAt && ` • ${new Date(delivery.submittedAt).toLocaleDateString()}`}
                      </p>
                      
                      {delivery.feedback && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                          <strong>Feedback:</strong> {delivery.feedback}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <a
                          href={delivery.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1"
                        >
                          <Eye size={14} /> Ver
                        </a>
                        {delivery.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => reviewMutation.mutate({ id: delivery.id, status: 'REJECTED' })}
                              disabled={reviewMutation.isPending}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => reviewMutation.mutate({ id: delivery.id, status: 'APPROVED' })}
                              disabled={reviewMutation.isPending}
                              className="text-xs"
                            >
                              Aprobar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de Preguntas */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HelpCircle size={20} className="text-indigo-500" />
          Preguntas Respondidas
        </h2>
        
        {!answers || answers.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Este estudiante aún no ha respondido preguntas</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {answers.map((answer: any, index: number) => (
              <motion.div
                key={answer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`p-4 border-l-4 ${answer.isCorrect ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      answer.isCorrect 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {answer.isCorrect 
                        ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                        : <XCircle className="w-4 h-4 text-red-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          Pregunta {index + 1}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          answer.isCorrect 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {answer.isCorrect ? 'Correcta' : 'Incorrecta'}
                        </span>
                      </div>
                      
                      <p className="font-medium text-gray-900 dark:text-white mb-2 text-sm">{answer.questionText}</p>
                      
                      {!answer.isCorrect && (
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-500">Respuesta correcta:</span>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {answer.correctAnswer}
                          </span>
                        </div>
                      )}
                        
                      {answer.explanation && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">Explicación:</p>
                          <p className="text-xs text-blue-600 dark:text-blue-300">{answer.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Vista entregas
const ExpeditionDeliveriesView = ({ expeditionId, onBack }: { expeditionId: string; onBack: () => void }) => {
  const queryClient = useQueryClient();
  const { data: deliveries = [], isLoading } = useQuery({ queryKey: ['jiro-deliveries', expeditionId], queryFn: () => jiroExpeditionApi.getPendingDeliveries(expeditionId) });
  const reviewMutation = useMutation({ mutationFn: ({ id, status, feedback }: { id: string; status: 'APPROVED' | 'REJECTED'; feedback?: string }) => jiroExpeditionApi.reviewDelivery(id, status, feedback), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jiro-deliveries', expeditionId] }); toast.success('Entrega revisada'); } });
  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button variant="ghost" onClick={onBack} className="p-2"><ChevronLeft size={20} /></Button><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Entregas Pendientes</h1><p className="text-gray-500">{deliveries.length} por revisar</p></div></div>
      {deliveries.length === 0 ? (
        <Card className="p-12 text-center"><FileText size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">No hay entregas pendientes</p></Card>
      ) : (
        <div className="grid gap-4">
          {deliveries.map(d => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between">
                <div><p className="font-semibold text-gray-900 dark:text-white">{d.student.name}</p><p className="text-sm text-gray-500">{d.station.name}</p><p className="text-xs text-gray-400 mt-1">{d.fileName} • {(d.fileSizeBytes / 1024 / 1024).toFixed(2)}MB</p></div>
                <div className="flex gap-2">
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200"><Eye size={16} className="inline mr-1" />Ver</a>
                  <Button size="sm" variant="secondary" onClick={() => reviewMutation.mutate({ id: d.id, status: 'REJECTED' })} disabled={reviewMutation.isPending} className="text-red-500">Rechazar</Button>
                  <Button size="sm" onClick={() => reviewMutation.mutate({ id: d.id, status: 'APPROVED' })} disabled={reviewMutation.isPending}>Aprobar</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
