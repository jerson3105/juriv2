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
                        src={expedition.mapImageUrl}
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
            src={expedition.mapImageUrl}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowPinModal(false);
              setSelectedPin(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`p-4 bg-gradient-to-r ${PIN_TYPE_CONFIG[selectedPin.pinType].color} text-white`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    {getPinIcon(selectedPin.pinType)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedPin.name}</h3>
                    <p className="text-white/80 text-sm">{PIN_TYPE_CONFIG[selectedPin.pinType].label}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {/* Status */}
                {(() => {
                  const progress = getPinProgress(selectedPin.id);
                  if (progress) {
                    return (
                      <div className={`mb-4 p-3 rounded-lg ${PROGRESS_STATUS_CONFIG[progress.status].bgColor}`}>
                        <span className={`text-sm font-medium ${PROGRESS_STATUS_CONFIG[progress.status].color}`}>
                          Estado: {PROGRESS_STATUS_CONFIG[progress.status].label}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Story */}
                {selectedPin.storyContent && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                      <FileText size={16} />
                      Historia
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap">
                      {selectedPin.storyContent}
                    </p>
                  </div>
                )}

                {/* Task */}
                {selectedPin.pinType === 'OBJECTIVE' && selectedPin.taskName && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <Upload size={16} />
                      Tarea: {selectedPin.taskName}
                    </h4>
                    {selectedPin.taskContent && (
                      <p className="text-blue-700 dark:text-blue-400 text-sm mb-3">
                        {selectedPin.taskContent}
                      </p>
                    )}
                    
                    {selectedPin.requiresSubmission && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                        {(() => {
                          const mySubmission = getMySubmission();
                          const progress = getPinProgress(selectedPin.id);
                          
                          // Si ya entregó, mostrar estado
                          if (mySubmission) {
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                  <CheckCircle size={16} />
                                  <span className="text-sm font-medium">Tarea entregada</span>
                                </div>
                                {(() => {
                                  // files puede venir como string JSON o como array
                                  const files = typeof mySubmission.files === 'string' 
                                    ? JSON.parse(mySubmission.files) 
                                    : mySubmission.files;
                                  return Array.isArray(files) ? files.map((file: string, idx: number) => (
                                    <a
                                      key={idx}
                                      href={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                    >
                                      <FileText size={14} />
                                      Ver archivo entregado
                                    </a>
                                  )) : null;
                                })()}
                                {progress?.status === 'IN_PROGRESS' && (
                                  <p className="text-sm text-amber-600 dark:text-amber-400">
                                    ⏳ Esperando revisión del profesor
                                  </p>
                                )}
                                {progress?.status === 'PASSED' && (
                                  <p className="text-sm text-green-600 dark:text-green-400">
                                    ✅ ¡Aprobado por el profesor!
                                  </p>
                                )}
                                {progress?.status === 'FAILED' && (
                                  <p className="text-sm text-red-600 dark:text-red-400">
                                    ❌ No aprobado - Puedes volver a intentar
                                  </p>
                                )}
                              </div>
                            );
                          }
                          
                          // Si no ha entregado, mostrar formulario
                          return (
                            <div className="space-y-3">
                              <p className="text-sm text-blue-600 dark:text-blue-400">
                                📎 Sube hasta 3 archivos para completar esta tarea (máx. 5MB c/u)
                              </p>
                              
                              {/* Input de archivo oculto */}
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
                                    <div key={index} className="flex items-center justify-between p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-blue-600" />
                                        <span className="text-sm text-blue-800 dark:text-blue-200 truncate max-w-[180px]">
                                          {file.name}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveFile(index)}
                                        className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                                      >
                                        <X size={14} className="text-blue-600" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Área de selección de archivo */}
                              {selectedFiles.length < 3 && (
                                <label
                                  htmlFor="task-file-input"
                                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                  <Upload size={24} className="text-blue-400 mb-2" />
                                  <span className="text-sm text-blue-600 dark:text-blue-400">
                                    {selectedFiles.length === 0 ? 'Haz clic para seleccionar archivos' : 'Agregar más archivos'}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1">
                                    Imágenes o PDF (máx. 5MB) - {3 - selectedFiles.length} restantes
                                  </span>
                                </label>
                              )}
                              
                              {/* Comentario opcional */}
                              <textarea
                                value={submissionComment}
                                onChange={(e) => setSubmissionComment(e.target.value)}
                                placeholder="Comentario opcional..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
                              />
                              
                              {/* Botón de enviar */}
                              <Button
                                size="sm"
                                onClick={handleSubmitTask}
                                disabled={selectedFiles.length === 0 || isSubmitting}
                                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                              >
                                {isSubmitting ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Enviando...
                                  </>
                                ) : (
                                  <>
                                    <Send size={14} className="mr-1" />
                                    Entregar tarea
                                  </>
                                )}
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Rewards */}
                {(selectedPin.rewardXp > 0 || selectedPin.rewardGp > 0) && (
                  <div className="flex items-center gap-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <Sparkles size={20} className="text-amber-500" />
                    <div className="flex gap-4">
                      {selectedPin.rewardXp > 0 && (
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          +{selectedPin.rewardXp} XP
                        </span>
                      )}
                      {selectedPin.rewardGp > 0 && (
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          +{selectedPin.rewardGp} GP
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Final pin celebration */}
                {selectedPin.pinType === 'FINAL' && getPinProgress(selectedPin.id)?.status === 'COMPLETED' && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg text-center">
                    <Trophy size={32} className="mx-auto text-amber-500 mb-2" />
                    <h4 className="font-bold text-amber-800 dark:text-amber-300">
                      ¡Felicitaciones!
                    </h4>
                    <p className="text-amber-700 dark:text-amber-400 text-sm">
                      Has completado esta expedición
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {(() => {
                  const progress = getPinProgress(selectedPin.id);
                  const canContinue = progress && 
                    selectedExpedition?.autoProgress &&
                    (progress.status === 'UNLOCKED' || progress.status === 'IN_PROGRESS') &&
                    (selectedPin.pinType === 'INTRO' || selectedPin.pinType === 'FINAL' || !selectedPin.requiresSubmission);
                  
                  if (canContinue) {
                    return (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowPinModal(false);
                            setSelectedPin(null);
                          }}
                          className="flex-1"
                        >
                          Cerrar
                        </Button>
                        <Button
                          onClick={handleCompletePin}
                          disabled={isCompleting}
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500"
                        >
                          {isCompleting ? 'Avanzando...' : (
                            <>
                              <ChevronRight size={16} className="mr-1" />
                              Continuar
                            </>
                          )}
                        </Button>
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
                      className="w-full"
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
