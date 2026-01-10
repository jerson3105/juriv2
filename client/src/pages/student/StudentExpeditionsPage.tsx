import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  MapPin,
  Home,
  Flag,
  ChevronRight,
  Trophy,
  Clock,
  CheckCircle,
  Lock,
  Sparkles,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  FileText,
  Upload,
  Send,
  X,
  Coins,
  Calendar,
  BookOpen,
  Target,
  Award,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  expeditionApi,
  PIN_TYPE_CONFIG,
  PROGRESS_STATUS_CONFIG,
  type Expedition,
  type ExpeditionPin,
  type ExpeditionStudentProgress,
  type ExpeditionPinProgress,
} from '../../lib/expeditionApi';
import { useStudentStore } from '../../store/studentStore';
import toast from 'react-hot-toast';

// Helper para construir URLs de archivos estáticos
const getStaticUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  if (url.startsWith('/api')) {
    return `${baseUrl.replace('/api', '')}${url}`;
  }
  return `${baseUrl}${url}`;
};

export const StudentExpeditionsPage = () => {
  const queryClient = useQueryClient();
  const { selectedClassIndex } = useStudentStore();
  const [selectedExpedition, setSelectedExpedition] = useState<(Expedition & { studentProgress: ExpeditionStudentProgress }) | null>(null);
  const [selectedPin, setSelectedPin] = useState<ExpeditionPin | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submissionComment, setSubmissionComment] = useState('');

  // Obtener clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => import('../../lib/studentApi').then(m => m.studentApi.getMyClasses()),
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  // Obtener expediciones del estudiante
  const { data: expeditions = [], isLoading } = useQuery({
    queryKey: ['student-expeditions', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => expeditionApi.getStudentExpeditions(currentProfile!.classroomId, currentProfile!.id),
    enabled: !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  // Obtener detalle de expedición seleccionada
  const { data: expeditionDetail } = useQuery({
    queryKey: ['student-expedition-detail', selectedExpedition?.id, currentProfile?.id],
    queryFn: () => expeditionApi.getStudentExpeditionDetail(selectedExpedition!.id, currentProfile!.id),
    enabled: !!selectedExpedition?.id && !!currentProfile?.id,
  });

  // Función para completar un pin y avanzar
  const handleCompletePin = async () => {
    if (!selectedPin || !currentProfile) return;
    
    setIsCompleting(true);
    try {
      await expeditionApi.completePin(selectedPin.id, currentProfile.id);
      toast.success('¡Avanzaste al siguiente punto!');
      
      // Refrescar datos
      queryClient.invalidateQueries({ queryKey: ['student-expedition-detail', selectedExpedition?.id] });
      queryClient.invalidateQueries({ queryKey: ['student-expeditions'] });
      
      setShowPinModal(false);
      setSelectedPin(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar');
    } finally {
      setIsCompleting(false);
    }
  };

  // Función para manejar la selección de archivos (hasta 3)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validar tipo de archivo
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Solo se permiten imágenes y PDFs`);
        continue;
      }

      // Validar tamaño
      if (file.size > maxSize) {
        toast.error(`${file.name}: No puede superar los 5MB`);
        continue;
      }

      newFiles.push(file);
    }

    // Limitar a 3 archivos en total
    const totalFiles = [...selectedFiles, ...newFiles].slice(0, 3);
    if (selectedFiles.length + newFiles.length > 3) {
      toast.error('Máximo 3 archivos permitidos');
    }
    setSelectedFiles(totalFiles);
  };

  // Función para eliminar un archivo seleccionado
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Función para subir archivos y crear entrega
  const handleSubmitTask = async () => {
    if (selectedFiles.length === 0 || !selectedPin || !currentProfile || !selectedExpedition) return;

    setIsSubmitting(true);
    try {
      // Subir todos los archivos
      const uploadedUrls: string[] = [];
      
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/expeditions/upload`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Error al subir ${file.name}`);
        }

        const { url } = await uploadResponse.json();
        uploadedUrls.push(url);
      }

      // Crear entrega con las URLs de los archivos
      await expeditionApi.createSubmission(selectedExpedition.id, selectedPin.id, {
        studentProfileId: currentProfile.id,
        files: uploadedUrls,
        comment: submissionComment || undefined,
      });

      toast.success('¡Tarea entregada correctamente!');

      // Refrescar datos
      queryClient.invalidateQueries({ queryKey: ['student-expedition-detail', selectedExpedition.id] });
      queryClient.invalidateQueries({ queryKey: ['student-expeditions'] });

      // Limpiar estado
      setSelectedFiles([]);
      setSubmissionComment('');
    } catch (error: any) {
      console.error('Error submitting task:', error);
      toast.error(error.message || 'Error al entregar tarea');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obtener entrega del estudiante para el pin actual
  const getMySubmission = () => {
    return expeditionDetail?.studentProgress?.submissions?.find(
      s => s.pinId === selectedPin?.id
    );
  };

  // Obtener progreso del pin actual
  const getPinProgress = (pinId: string): ExpeditionPinProgress | undefined => {
    return expeditionDetail?.studentProgress?.pinProgress?.find(p => p.pinId === pinId);
  };

  // Handle zoom
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Handle pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle pin click
  const handlePinClick = (pin: ExpeditionPin) => {
    const progress = getPinProgress(pin.id);
    // Solo permitir click si el pin está desbloqueado o completado
    if (progress?.status === 'LOCKED') {
      toast.error('Este punto está bloqueado');
      return;
    }
    setSelectedPin(pin);
    setShowPinModal(true);
  };

  // Get pin icon
  const getPinIcon = (pinType: string) => {
    switch (pinType) {
      case 'INTRO': return <Home size={12} />;
      case 'OBJECTIVE': return <MapPin size={12} />;
      case 'FINAL': return <Flag size={12} />;
      default: return <MapPin size={12} />;
    }
  };

  // Get pin status color
  const getPinStatusColor = (pinId: string) => {
    const progress = getPinProgress(pinId);
    if (!progress) return 'from-gray-400 to-gray-500';
    
    switch (progress.status) {
      case 'LOCKED': return 'from-gray-400 to-gray-500 opacity-50';
      case 'UNLOCKED': return 'from-blue-400 to-blue-500';
      case 'IN_PROGRESS': return 'from-yellow-400 to-orange-500';
      case 'PASSED':
      case 'COMPLETED': return 'from-green-400 to-emerald-500';
      case 'FAILED': return 'from-red-400 to-red-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Vista de lista de expediciones
  if (!selectedExpedition) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Map size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Expediciones</h1>
            <p className="text-gray-500 dark:text-gray-400">Explora mapas y completa misiones</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : expeditions.length === 0 ? (
          <Card className="p-12 text-center">
            <Map size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No hay expediciones disponibles
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Tu profesor aún no ha publicado ninguna expedición
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {expeditions.map((expedition) => {
              const isCompleted = expedition.studentProgress?.isCompleted;
              const completedPins = expedition.studentProgress?.pinProgress?.filter(
                p => p.status === 'PASSED' || p.status === 'COMPLETED'
              ).length || 0;
              const totalPins = expedition.pins?.length || 0;
              const progress = totalPins > 0 ? (completedPins / totalPins) * 100 : 0;

              return (
                <motion.div
                  key={expedition.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="cursor-pointer"
                  onClick={() => setSelectedExpedition(expedition)}
                >
                  <Card className="overflow-hidden hover:shadow-xl transition-shadow">
                    {/* Map preview */}
                    <div className="relative aspect-video">
                      <img
                        src={getStaticUrl(expedition.mapImageUrl)}
                        alt={expedition.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      
                      {/* Status badge */}
                      <div className="absolute top-3 right-3">
                        {isCompleted ? (
                          <span className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            <CheckCircle size={12} />
                            Completada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            <Clock size={12} />
                            En progreso
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white font-bold text-lg">{expedition.name}</h3>
                        {expedition.description && (
                          <p className="text-white/80 text-sm line-clamp-1">{expedition.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="p-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          {completedPins} de {totalPins} puntos
                        </span>
                        <span className="font-medium text-emerald-600">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MapPin size={14} />
                          {totalPins} puntos
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Vista de mapa de expedición
  const expedition = expeditionDetail || selectedExpedition;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedExpedition(null);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{expedition.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {expedition.studentProgress?.isCompleted ? (
                <span className="text-green-500 flex items-center gap-1">
                  <Trophy size={14} /> ¡Expedición completada!
                </span>
              ) : (
                'Explora el mapa y completa los objetivos'
              )}
            </p>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => handleZoom(-0.25)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <ZoomOut size={18} />
          </button>
          <span className="px-2 text-sm text-gray-600 dark:text-gray-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.25)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Map container */}
      <div
        className="flex-1 relative overflow-hidden rounded-xl border-4 border-emerald-500 bg-gray-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-100"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Map image */}
          <img
            src={getStaticUrl(expedition.mapImageUrl)}
            alt={expedition.name}
            className="w-full h-full object-contain"
            draggable={false}
          />

          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {expedition.connections?.map((connection) => {
              const fromPin = expedition.pins?.find(p => p.id === connection.fromPinId);
              const toPin = expedition.pins?.find(p => p.id === connection.toPinId);
              if (!fromPin || !toPin) return null;

              const fromProgress = getPinProgress(fromPin.id);
              const isActive = fromProgress?.status === 'PASSED' || fromProgress?.status === 'COMPLETED';

              return (
                <line
                  key={connection.id}
                  x1={`${fromPin.positionX}%`}
                  y1={`${fromPin.positionY}%`}
                  x2={`${toPin.positionX}%`}
                  y2={`${toPin.positionY}%`}
                  stroke={isActive ? '#22c55e' : '#ffffff50'}
                  strokeWidth="2"
                  strokeDasharray={isActive ? '0' : '4,4'}
                />
              );
            })}
          </svg>

          {/* Pins */}
          {expedition.pins?.map((pin) => {
            const progress = getPinProgress(pin.id);
            const isLocked = progress?.status === 'LOCKED';
            const isCurrent = expedition.studentProgress?.currentPinId === pin.id;

            return (
              <button
                key={pin.id}
                onClick={() => handlePinClick(pin)}
                disabled={isLocked}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  left: `${pin.positionX}%`,
                  top: `${pin.positionY}%`,
                }}
              >
                {/* Current pin indicator */}
                {isCurrent && !isLocked && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full bg-yellow-400/30"
                  />
                )}
                
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  bg-gradient-to-br ${getPinStatusColor(pin.id)}
                  text-white shadow-md border-2 border-white
                  transition-transform ${!isLocked && 'group-hover:scale-110'}
                `}>
                  {isLocked ? <Lock size={10} /> : getPinIcon(pin.pinType)}
                </div>
                
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap">
                  <span className={`bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-md ${
                    isLocked ? 'text-gray-400' : ''
                  }`}>
                    {pin.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pin Modal */}
      <AnimatePresence>
        {showPinModal && selectedPin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowPinModal(false);
              setSelectedPin(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header mejorado con gradiente dinámico */}
              <div className={`relative p-5 ${
                selectedPin.pinType === 'INTRO' 
                  ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500' 
                  : selectedPin.pinType === 'FINAL'
                    ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500'
                    : 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500'
              } text-white overflow-hidden`}>
                {/* Patrón decorativo de fondo */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>
                
                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {/* Icono grande animado */}
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring' }}
                      className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
                    >
                      {selectedPin.pinType === 'INTRO' ? (
                        <Home size={28} className="text-white" />
                      ) : selectedPin.pinType === 'FINAL' ? (
                        <Flag size={28} className="text-white" />
                      ) : (
                        <Target size={28} className="text-white" />
                      )}
                    </motion.div>
                    <div>
                      <motion.h3 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 }}
                        className="font-bold text-xl drop-shadow-sm"
                      >
                        {selectedPin.name}
                      </motion.h3>
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-white/80 text-sm flex items-center gap-1"
                      >
                        {PIN_TYPE_CONFIG[selectedPin.pinType].label}
                      </motion.p>
                    </div>
                  </div>
                  
                  {/* Badge de recompensas en el header */}
                  {(selectedPin.rewardXp > 0 || selectedPin.rewardGp > 0) && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 }}
                      className="flex flex-col gap-1"
                    >
                      {selectedPin.rewardXp > 0 && (
                        <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold">
                          <Zap size={12} />
                          +{selectedPin.rewardXp} XP
                        </div>
                      )}
                      {selectedPin.rewardGp > 0 && (
                        <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold">
                          <Coins size={12} />
                          +{selectedPin.rewardGp} GP
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Barra de progreso de la expedición */}
                {expedition.pins && expedition.pins.length > 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 pt-3 border-t border-white/20"
                  >
                    <div className="flex items-center justify-between text-xs text-white/70 mb-2">
                      <span>Progreso de la expedición</span>
                      <span>
                        Paso {(expedition.pins.findIndex(p => p.id === selectedPin.id) || 0) + 1} de {expedition.pins.length}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {expedition.pins.map((pin) => {
                        const pinProgress = getPinProgress(pin.id);
                        const isCompleted = pinProgress?.status === 'COMPLETED' || pinProgress?.status === 'PASSED';
                        const isCurrent = pin.id === selectedPin.id;
                        return (
                          <div
                            key={pin.id}
                            className={`flex-1 h-2 rounded-full transition-all ${
                              isCompleted 
                                ? 'bg-white' 
                                : isCurrent 
                                  ? 'bg-white/60 animate-pulse' 
                                  : 'bg-white/20'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Content con scroll suave */}
              <div className="p-5 overflow-y-auto max-h-[50vh] space-y-4 scroll-smooth">
                {/* Status mejorado */}
                {(() => {
                  const progress = getPinProgress(selectedPin.id);
                  if (progress) {
                    const statusConfig = PROGRESS_STATUS_CONFIG[progress.status];
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 p-3 rounded-xl ${statusConfig.bgColor} border ${
                          progress.status === 'COMPLETED' || progress.status === 'PASSED'
                            ? 'border-green-200 dark:border-green-800'
                            : progress.status === 'LOCKED'
                              ? 'border-gray-200 dark:border-gray-700'
                              : 'border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {progress.status === 'COMPLETED' || progress.status === 'PASSED' ? (
                          <CheckCircle size={20} className="text-green-500" />
                        ) : progress.status === 'LOCKED' ? (
                          <Lock size={20} className="text-gray-400" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        )}
                        <span className={`text-sm font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </motion.div>
                    );
                  }
                  return null;
                })()}

                {/* Story con diseño de pergamino */}
                {(selectedPin.storyContent || (Array.isArray(selectedPin.storyFiles) && selectedPin.storyFiles.length > 0)) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <BookOpen size={16} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <h4 className="font-semibold text-gray-800 dark:text-white">Historia</h4>
                    </div>
                    
                    {selectedPin.storyContent && (
                      <div className="relative p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                        {/* Decoración de esquina */}
                        <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-amber-300 dark:border-amber-700 rounded-tl" />
                        <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-amber-300 dark:border-amber-700 rounded-tr" />
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-amber-300 dark:border-amber-700 rounded-bl" />
                        <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-amber-300 dark:border-amber-700 rounded-br" />
                        
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap italic">
                          {selectedPin.storyContent}
                        </p>
                      </div>
                    )}
                    
                    {/* Recursos adicionales (archivos, URLs, Genially) */}
                    {Array.isArray(selectedPin.storyFiles) && selectedPin.storyFiles.length > 0 && (
                      <div className="space-y-3 mt-4">
                        {selectedPin.storyFiles.map((file: string, idx: number) => {
                          const isGenially = file.includes('genial.ly') || file.includes('genially');
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file);
                          const isPdf = /\.pdf$/i.test(file);
                          
                          if (isGenially) {
                            return (
                              <motion.div 
                                key={idx} 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                className="rounded-xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-lg"
                              >
                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 flex items-center gap-2">
                                  <Sparkles size={14} className="text-white" />
                                  <span className="text-white text-xs font-medium">Contenido interactivo</span>
                                </div>
                                <iframe
                                  src={file}
                                  className="w-full aspect-video"
                                  frameBorder="0"
                                  allowFullScreen
                                  title={`Genially ${idx + 1}`}
                                />
                              </motion.div>
                            );
                          } else if (isImage) {
                            return (
                              <motion.a
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                href={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                              >
                                <img
                                  src={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                  alt={`Recurso ${idx + 1}`}
                                  className="w-full max-h-64 object-contain bg-gray-100 dark:bg-gray-800"
                                />
                              </motion.a>
                            );
                          } else if (isPdf) {
                            return (
                              <motion.a
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                href={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800 hover:shadow-md transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <FileText size={20} className="text-white" />
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Documento PDF</span>
                                  <p className="text-xs text-red-500 dark:text-red-400">Clic para abrir</p>
                                </div>
                              </motion.a>
                            );
                          } else {
                            return (
                              <motion.a
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                href={file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <ChevronRight size={20} className="text-white" />
                                </div>
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">{file}</span>
                              </motion.a>
                            );
                          }
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Task mejorada */}
                {selectedPin.pinType === 'OBJECTIVE' && selectedPin.taskName && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Target size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4 className="font-semibold text-gray-800 dark:text-white">Misión</h4>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                          <Award size={20} className="text-white" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-blue-800 dark:text-blue-200">{selectedPin.taskName}</h5>
                          {selectedPin.taskContent && (
                            <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                              {selectedPin.taskContent}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Fecha límite si existe */}
                      {selectedPin.dueDate && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                          <Calendar size={14} className="text-blue-500" />
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            Fecha límite: {new Date(selectedPin.dueDate).toLocaleDateString('es-ES', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      )}
                    
                      {selectedPin.requiresSubmission && (
                        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                          {(() => {
                            const mySubmission = getMySubmission();
                            const progress = getPinProgress(selectedPin.id);
                            
                            // Si ya entregó, mostrar estado
                            if (mySubmission) {
                              return (
                                <div className="space-y-3">
                                  <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                    progress?.status === 'PASSED' 
                                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                                      : progress?.status === 'FAILED'
                                        ? 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                                        : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                                  }`}>
                                    {progress?.status === 'PASSED' ? (
                                      <>
                                        <CheckCircle size={20} className="text-green-500" />
                                        <div>
                                          <span className="text-sm font-medium text-green-700 dark:text-green-300">¡Aprobado!</span>
                                          <p className="text-xs text-green-600 dark:text-green-400">El profesor ha revisado tu trabajo</p>
                                        </div>
                                      </>
                                    ) : progress?.status === 'FAILED' ? (
                                      <>
                                        <X size={20} className="text-red-500" />
                                        <div>
                                          <span className="text-sm font-medium text-red-700 dark:text-red-300">No aprobado</span>
                                          <p className="text-xs text-red-600 dark:text-red-400">Puedes volver a intentarlo</p>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <Clock size={20} className="text-amber-500" />
                                        <div>
                                          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Entregado</span>
                                          <p className="text-xs text-amber-600 dark:text-amber-400">Esperando revisión del profesor</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  
                                  {/* Archivos entregados */}
                                  {(() => {
                                    const files = typeof mySubmission.files === 'string' 
                                      ? JSON.parse(mySubmission.files) 
                                      : mySubmission.files;
                                    return Array.isArray(files) && files.length > 0 && (
                                      <div className="space-y-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Archivos entregados:</span>
                                        {files.map((file: string, idx: number) => (
                                          <a
                                            key={idx}
                                            href={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                          >
                                            <FileText size={14} />
                                            <span className="truncate">Archivo {idx + 1}</span>
                                          </a>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            }
                            
                            // Si no ha entregado, mostrar formulario mejorado
                            return (
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                  <Upload size={16} />
                                  <span>Sube hasta 3 archivos (máx. 5MB c/u)</span>
                                </div>
                                
                                <input
                                  type="file"
                                  id="task-file-input"
                                  accept="image/*,.pdf"
                                  onChange={handleFileSelect}
                                  multiple
                                  className="hidden"
                                />
                                
                                {/* Lista de archivos seleccionados */}
                                {selectedFiles.length > 0 && (
                                  <div className="space-y-2">
                                    {selectedFiles.map((file, index) => (
                                      <motion.div 
                                        key={index} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-700"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <FileText size={14} className="text-blue-600" />
                                          </div>
                                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                                            {file.name}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => handleRemoveFile(index)}
                                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
                                          <X size={14} className="text-red-500" />
                                        </button>
                                      </motion.div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Área de selección de archivo */}
                                {selectedFiles.length < 3 && (
                                  <label
                                    htmlFor="task-file-input"
                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all group"
                                  >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                      <Upload size={24} className="text-blue-500" />
                                    </div>
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                      {selectedFiles.length === 0 ? 'Seleccionar archivos' : 'Agregar más'}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">
                                      {3 - selectedFiles.length} archivos restantes
                                    </span>
                                  </label>
                                )}
                                
                                {/* Comentario opcional */}
                                <textarea
                                  value={submissionComment}
                                  onChange={(e) => setSubmissionComment(e.target.value)}
                                  placeholder="Añade un comentario (opcional)..."
                                  rows={2}
                                  className="w-full px-4 py-3 text-sm rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                                
                                {/* Botón de enviar mejorado */}
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={handleSubmitTask}
                                  disabled={selectedFiles.length === 0 || isSubmitting}
                                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                                    selectedFiles.length === 0 || isSubmitting
                                      ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
                                  }`}
                                >
                                  {isSubmitting ? (
                                    <>
                                      <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Send size={18} />
                                      Entregar tarea
                                    </>
                                  )}
                                </motion.button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Final pin celebration mejorado */}
                {selectedPin.pinType === 'FINAL' && getPinProgress(selectedPin.id)?.status === 'COMPLETED' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="relative overflow-hidden p-6 bg-gradient-to-br from-amber-100 via-yellow-100 to-orange-100 dark:from-amber-900/30 dark:via-yellow-900/30 dark:to-orange-900/30 rounded-2xl text-center"
                  >
                    {/* Confetti decorativo */}
                    <div className="absolute inset-0 overflow-hidden">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ y: -20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className={`absolute w-2 h-2 rounded-full ${
                            ['bg-amber-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-pink-400', 'bg-purple-400'][i]
                          }`}
                          style={{
                            left: `${15 + i * 15}%`,
                            top: `${10 + (i % 3) * 20}%`,
                          }}
                        />
                      ))}
                    </div>
                    
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                    >
                      <Trophy size={48} className="mx-auto text-amber-500 mb-3 drop-shadow-lg" />
                    </motion.div>
                    <h4 className="font-bold text-xl text-amber-800 dark:text-amber-300 mb-1">
                      ¡Felicitaciones! 🎉
                    </h4>
                    <p className="text-amber-700 dark:text-amber-400 text-sm">
                      Has completado esta expedición con éxito
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer mejorado */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                {(() => {
                  const progress = getPinProgress(selectedPin.id);
                  
                  // Usar autoProgress del pin si existe, sino el de la expedición
                  const pinAutoProgress = selectedPin.autoProgress ?? expedition?.autoProgress;
                  
                  const canContinue = progress && 
                    pinAutoProgress &&
                    (progress.status === 'UNLOCKED' || progress.status === 'IN_PROGRESS') &&
                    (selectedPin.pinType === 'INTRO' || selectedPin.pinType === 'FINAL' || !selectedPin.requiresSubmission);
                  
                  if (canContinue) {
                    return (
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowPinModal(false);
                            setSelectedPin(null);
                          }}
                          className="flex-1 py-3"
                        >
                          Cerrar
                        </Button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCompletePin}
                          disabled={isCompleting}
                          className={`flex-1 py-3 px-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 ${
                            isCompleting 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg hover:shadow-xl'
                          } transition-all`}
                        >
                          {isCompleting ? (
                            <>
                              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              Avanzando...
                            </>
                          ) : (
                            <>
                              {selectedPin.pinType === 'FINAL' ? (
                                <>
                                  <Trophy size={18} />
                                  Completar expedición
                                </>
                              ) : (
                                <>
                                  <ChevronRight size={18} />
                                  Continuar aventura
                                </>
                              )}
                            </>
                          )}
                        </motion.button>
                      </div>
                    );
                  }
                  
                  return (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowPinModal(false);
                        setSelectedPin(null);
                      }}
                      className="w-full py-3"
                    >
                      Cerrar
                    </Button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentExpeditionsPage;
