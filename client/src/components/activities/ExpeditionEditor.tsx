import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Link2,
  Trash2,
  Save,
  Eye,
  ZoomIn,
  ZoomOut,
  Home,
  MapPin,
  Flag,
  X,
  Check,
  Settings,
  FileText,
  Upload,
  Calendar,
  Gift,
  Users,
  Image,
  FileUp,
  Globe,
  Code,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import {
  expeditionApi,
  PIN_TYPE_CONFIG,
  PROGRESS_STATUS_CONFIG,
  type ExpeditionPin,
  type ExpeditionConnection,
  type ExpeditionPinType,
  type ExpeditionPinProgress,
  type CreatePinDto,
} from '../../lib/expeditionApi';
import toast from 'react-hot-toast';

interface ExpeditionEditorProps {
  expeditionId: string;
  onBack: () => void;
}

type EditorMode = 'view' | 'add-pin' | 'connect';

export const ExpeditionEditor = ({ expeditionId, onBack }: ExpeditionEditorProps) => {
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  
  // State
  const [mode, setMode] = useState<EditorMode>('view');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPin, setSelectedPin] = useState<ExpeditionPin | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [newPinType, setNewPinType] = useState<ExpeditionPinType>('OBJECTIVE');
  
  // Pin form state
  const [pinForm, setPinForm] = useState<CreatePinDto>({
    pinType: 'OBJECTIVE',
    positionX: 50,
    positionY: 50,
    name: '',
    storyContent: '',
    storyFiles: [],
    taskName: '',
    taskContent: '',
    requiresSubmission: false,
    rewardXp: 0,
    rewardGp: 0,
  });
  const [isUploadingStoryFile, setIsUploadingStoryFile] = useState(false);
  const [activeTab, setActiveTab] = useState<'story' | 'task' | 'config' | 'progress'>('story');

  // Query
  const { data: expedition, isLoading } = useQuery({
    queryKey: ['expedition', expeditionId],
    queryFn: () => expeditionApi.getById(expeditionId),
  });

  // Query para progreso del pin seleccionado (solo cuando hay pin seleccionado y expedición publicada)
  const { data: pinProgress = [], isLoading: isLoadingProgress } = useQuery({
    queryKey: ['pin-progress', selectedPin?.id],
    queryFn: () => selectedPin ? expeditionApi.getPinProgress(selectedPin.id) : Promise.resolve([]),
    enabled: !!selectedPin && expedition?.status === 'PUBLISHED',
  });

  // Query para entregas del pin seleccionado
  const { data: pinSubmissions = [] } = useQuery({
    queryKey: ['pin-submissions', selectedPin?.id],
    queryFn: () => selectedPin ? expeditionApi.getPinSubmissions(selectedPin.id) : Promise.resolve([]),
    enabled: !!selectedPin && expedition?.status === 'PUBLISHED',
  });

  // Mutations
  const createPinMutation = useMutation({
    mutationFn: (data: CreatePinDto) => expeditionApi.createPin(expeditionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      setShowPinModal(false);
      resetPinForm();
      toast.success('Pin creado');
    },
    onError: () => toast.error('Error al crear pin'),
  });

  const updatePinMutation = useMutation({
    mutationFn: ({ pinId, data }: { pinId: string; data: Partial<CreatePinDto> }) => 
      expeditionApi.updatePin(pinId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      setShowPinModal(false);
      setSelectedPin(null);
      toast.success('Pin actualizado');
    },
    onError: () => toast.error('Error al actualizar pin'),
  });

  const deletePinMutation = useMutation({
    mutationFn: expeditionApi.deletePin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      setSelectedPin(null);
      setShowPinModal(false);
      toast.success('Pin eliminado');
    },
    onError: () => toast.error('Error al eliminar pin'),
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: { fromPinId: string; toPinId: string; onSuccess?: boolean | null }) =>
      expeditionApi.createConnection(expeditionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      setConnectingFrom(null);
      setMode('view');
      toast.success('Conexión creada');
    },
    onError: () => toast.error('Error al crear conexión'),
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: expeditionApi.deleteConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      toast.success('Conexión eliminada');
    },
    onError: () => toast.error('Error al eliminar conexión'),
  });

  const updateConnectionMutation = useMutation({
    mutationFn: ({ connectionId, onSuccess }: { connectionId: string; onSuccess: boolean | null }) =>
      expeditionApi.updateConnection(connectionId, onSuccess),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      toast.success('Conexión actualizada');
    },
    onError: () => toast.error('Error al actualizar conexión'),
  });

  const publishMutation = useMutation({
    mutationFn: () => expeditionApi.publish(expeditionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition', expeditionId] });
      toast.success('¡Expedición publicada!');
    },
    onError: () => toast.error('Error al publicar'),
  });

  // Reset pin form
  const resetPinForm = () => {
    setPinForm({
      pinType: 'OBJECTIVE',
      positionX: 50,
      positionY: 50,
      name: '',
      storyContent: '',
      taskName: '',
      taskContent: '',
      requiresSubmission: false,
      rewardXp: 0,
      rewardGp: 0,
    });
    setActiveTab('story');
  };

  // Handle map click to add pin
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'add-pin' || !mapRef.current) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPinForm({
      ...pinForm,
      pinType: newPinType,
      positionX: Math.round(x),
      positionY: Math.round(y),
    });
    setShowPinModal(true);
    setMode('view');
  };

  // Handle pin click
  const handlePinClick = (pin: ExpeditionPin, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (mode === 'connect') {
      if (connectingFrom) {
        // Crear conexión
        if (connectingFrom !== pin.id) {
          createConnectionMutation.mutate({
            fromPinId: connectingFrom,
            toPinId: pin.id,
            onSuccess: null, // Conexión lineal por defecto
          });
        }
        setConnectingFrom(null);
      } else {
        setConnectingFrom(pin.id);
      }
    } else {
      // Abrir modal de edición
      setSelectedPin(pin);
      setPinForm({
        pinType: pin.pinType,
        positionX: pin.positionX,
        positionY: pin.positionY,
        name: pin.name,
        storyContent: pin.storyContent || '',
        storyFiles: Array.isArray(pin.storyFiles) ? pin.storyFiles : [],
        taskName: pin.taskName || '',
        taskContent: pin.taskContent || '',
        requiresSubmission: pin.requiresSubmission,
        dueDate: pin.dueDate || undefined,
        rewardXp: pin.rewardXp,
        rewardGp: pin.rewardGp,
        earlySubmissionEnabled: pin.earlySubmissionEnabled,
        earlySubmissionDate: pin.earlySubmissionDate || undefined,
        earlyBonusXp: pin.earlyBonusXp,
        earlyBonusGp: pin.earlyBonusGp,
        autoProgress: pin.autoProgress ?? undefined,
      });
      setShowPinModal(true);
    }
  };

  // Handle zoom
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Handle pan (drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'view' || e.button !== 0) return;
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

  // Save pin
  const handleSavePin = () => {
    if (!pinForm.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (selectedPin) {
      updatePinMutation.mutate({ pinId: selectedPin.id, data: pinForm });
    } else {
      createPinMutation.mutate(pinForm);
    }
  };

  // Get pin icon
  const getPinIcon = (pinType: ExpeditionPinType) => {
    switch (pinType) {
      case 'INTRO': return <Home size={12} />;
      case 'OBJECTIVE': return <MapPin size={12} />;
      case 'FINAL': return <Flag size={12} />;
    }
  };

  // Render connection line (solo la línea SVG)
  const renderConnectionLine = (connection: ExpeditionConnection) => {
    const fromPin = expedition?.pins?.find(p => p.id === connection.fromPinId);
    const toPin = expedition?.pins?.find(p => p.id === connection.toPinId);
    
    if (!fromPin || !toPin) return null;

    const x1 = fromPin.positionX;
    const y1 = fromPin.positionY;
    const x2 = toPin.positionX;
    const y2 = toPin.positionY;

    return (
      <line
        key={connection.id}
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke={connection.onSuccess === true ? '#22c55e' : connection.onSuccess === false ? '#ef4444' : '#ffffff'}
        strokeWidth="2"
        strokeDasharray={connection.onSuccess === null ? '0' : '4,4'}
        markerEnd="url(#arrowhead)"
      />
    );
  };

  // Render connection controls (botones HTML fuera del SVG)
  const renderConnectionControls = (connection: ExpeditionConnection) => {
    const fromPin = expedition?.pins?.find(p => p.id === connection.fromPinId);
    const toPin = expedition?.pins?.find(p => p.id === connection.toPinId);
    
    if (!fromPin || !toPin) return null;

    const midX = (fromPin.positionX + toPin.positionX) / 2;
    const midY = (fromPin.positionY + toPin.positionY) / 2;

    // Si ya tiene una decisión, mostrar solo el icono elegido + eliminar
    const hasDecision = connection.onSuccess !== null;

    return (
      <div
        key={connection.id}
        className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${midX}%`,
          top: `${midY}%`,
        }}
      >
        <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5 shadow-md border border-gray-200 dark:border-gray-700 scale-75">
          {/* Si no hay decisión, mostrar ambos botones */}
          {!hasDecision && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateConnectionMutation.mutate({ connectionId: connection.id, onSuccess: true });
                }}
                className="p-0.5 rounded-full text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                title="Camino si APRUEBA"
              >
                <Check size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateConnectionMutation.mutate({ connectionId: connection.id, onSuccess: false });
                }}
                className="p-0.5 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Camino si NO APRUEBA"
              >
                <X size={12} />
              </button>
            </>
          )}
          {/* Si hay decisión, mostrar solo el icono elegido */}
          {hasDecision && (
            <div
              className={`p-0.5 rounded-full ${
                connection.onSuccess ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
              title={connection.onSuccess ? 'Camino si APRUEBA' : 'Camino si NO APRUEBA'}
            >
              {connection.onSuccess ? <Check size={12} /> : <X size={12} />}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteConnectionMutation.mutate(connection.id);
            }}
            className="p-0.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Eliminar conexión"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!expedition) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Expedición no encontrada</p>
        <Button onClick={onBack} className="mt-4">Volver</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{expedition.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {expedition.pins?.length || 0} pines • {expedition.connections?.length || 0} conexiones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toolbar */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => {
                setMode(mode === 'add-pin' ? 'view' : 'add-pin');
                setConnectingFrom(null);
              }}
              className={`p-2 rounded-lg transition-colors ${
                mode === 'add-pin' ? 'bg-emerald-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Agregar pin"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => {
                setMode(mode === 'connect' ? 'view' : 'connect');
                setConnectingFrom(null);
              }}
              className={`p-2 rounded-lg transition-colors ${
                mode === 'connect' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Conectar pines"
            >
              <Link2 size={18} />
            </button>
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

          {/* Publish button */}
          {expedition.status === 'DRAFT' && (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !expedition.pins?.length}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <Eye size={18} className="mr-2" />
              Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Pin type selector when in add mode */}
      {mode === 'add-pin' && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <span className="text-sm text-emerald-700 dark:text-emerald-300">Tipo de pin:</span>
          {(['INTRO', 'OBJECTIVE', 'FINAL'] as ExpeditionPinType[]).map((type) => (
            <button
              key={type}
              onClick={() => setNewPinType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                newPinType === type
                  ? `bg-gradient-to-r ${PIN_TYPE_CONFIG[type].color} text-white`
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {PIN_TYPE_CONFIG[type].icon} {PIN_TYPE_CONFIG[type].label}
            </button>
          ))}
          <span className="text-sm text-emerald-600 dark:text-emerald-400 ml-4">
            Haz clic en el mapa para agregar el pin
          </span>
        </div>
      )}

      {/* Connect mode indicator */}
      {mode === 'connect' && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Link2 size={18} className="text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {connectingFrom 
              ? 'Ahora haz clic en el pin de destino' 
              : 'Haz clic en el pin de origen para crear una conexión'}
          </span>
          {connectingFrom && (
            <button
              onClick={() => setConnectingFrom(null)}
              className="ml-auto text-sm text-blue-500 hover:underline"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="flex-1 relative overflow-hidden rounded-xl border-4 border-emerald-500 bg-gray-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: mode === 'add-pin' ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={mapRef}
          className="absolute inset-0 origin-center transition-transform duration-100"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          onClick={handleMapClick}
        >
          {/* Map image */}
          <img
            src={expedition.mapImageUrl}
            alt={expedition.name}
            className="w-full h-full object-contain"
            draggable={false}
          />

          {/* SVG for connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="white" />
              </marker>
            </defs>
            {expedition.connections?.map(renderConnectionLine)}
          </svg>

          {/* Connection controls (HTML buttons) */}
          {expedition.connections?.map(renderConnectionControls)}

          {/* Pins */}
          {expedition.pins?.map((pin) => (
            <button
              key={pin.id}
              onClick={(e) => handlePinClick(pin, e)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group ${
                connectingFrom === pin.id ? 'ring-4 ring-blue-500 ring-opacity-50' : ''
              }`}
              style={{
                left: `${pin.positionX}%`,
                top: `${pin.positionY}%`,
              }}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                bg-gradient-to-br ${PIN_TYPE_CONFIG[pin.pinType].color}
                text-white shadow-md border-2 border-white
                transition-transform group-hover:scale-110
              `}>
                {getPinIcon(pin.pinType)}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap">
                <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-md">
                  {pin.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pin Modal */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowPinModal(false);
              setSelectedPin(null);
              resetPinForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${PIN_TYPE_CONFIG[pinForm.pinType].color} text-white`}>
                    {getPinIcon(pinForm.pinType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      {selectedPin ? 'Editar Pin' : 'Nuevo Pin'}
                    </h3>
                    <p className="text-sm text-gray-500">{PIN_TYPE_CONFIG[pinForm.pinType].label}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setSelectedPin(null);
                    resetPinForm();
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Name input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del {pinForm.pinType === 'INTRO' ? 'inicio' : pinForm.pinType === 'FINAL' ? 'final' : 'objetivo'}
                  </label>
                  <input
                    type="text"
                    value={pinForm.name}
                    onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })}
                    placeholder="Ej: El comienzo de la aventura"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('story')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'story'
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText size={16} className="inline mr-1" />
                    Historia
                  </button>
                  {pinForm.pinType === 'OBJECTIVE' && (
                    <button
                      onClick={() => setActiveTab('task')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'task'
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Upload size={16} className="inline mr-1" />
                      Tarea
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('config')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'config'
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Settings size={16} className="inline mr-1" />
                    Configuración
                  </button>
                  {selectedPin && expedition?.status === 'PUBLISHED' && (
                    <button
                      onClick={() => setActiveTab('progress')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'progress'
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Users size={16} className="inline mr-1" />
                      Progreso ({pinProgress.length})
                    </button>
                  )}
                </div>

                {/* Tab content */}
                {activeTab === 'story' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Historia / Narrativa
                      </label>
                      <textarea
                        value={pinForm.storyContent}
                        onChange={(e) => setPinForm({ ...pinForm, storyContent: e.target.value })}
                        placeholder="Escribe la historia que verán los estudiantes al llegar a este punto..."
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Archivos adjuntos / URLs / Embeds */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Recursos adicionales (máx. 2)
                      </label>
                      
                      {/* Lista de recursos actuales */}
                      {Array.isArray(pinForm.storyFiles) && pinForm.storyFiles.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {pinForm.storyFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              {file.includes('genial.ly') || file.includes('genially') ? (
                                <Code size={16} className="text-purple-500 flex-shrink-0" />
                              ) : file.startsWith('http') ? (
                                <Globe size={16} className="text-blue-500 flex-shrink-0" />
                              ) : (
                                <FileUp size={16} className="text-emerald-500 flex-shrink-0" />
                              )}
                              <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                                {file.includes('genial.ly') || file.includes('genially') 
                                  ? 'Genially embed' 
                                  : file.startsWith('http') 
                                    ? file 
                                    : file.split('/').pop()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newFiles = [...(pinForm.storyFiles || [])];
                                  newFiles.splice(index, 1);
                                  setPinForm({ ...pinForm, storyFiles: newFiles });
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botones para agregar recursos */}
                      {(!Array.isArray(pinForm.storyFiles) || pinForm.storyFiles.length < 2) && (
                        <div className="flex flex-wrap gap-2">
                          {/* Subir archivo */}
                          <label className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error('El archivo no puede superar 5MB');
                                  return;
                                }
                                
                                setIsUploadingStoryFile(true);
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  const response = await fetch(`${import.meta.env.VITE_API_URL}/expeditions/upload`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                                    },
                                    body: formData,
                                  });
                                  
                                  if (!response.ok) throw new Error('Error al subir archivo');
                                  
                                  const data = await response.json();
                                  setPinForm({ 
                                    ...pinForm, 
                                    storyFiles: [...(pinForm.storyFiles || []), data.url] 
                                  });
                                  toast.success('Archivo subido');
                                } catch (error) {
                                  toast.error('Error al subir el archivo');
                                } finally {
                                  setIsUploadingStoryFile(false);
                                  e.target.value = '';
                                }
                              }}
                              disabled={isUploadingStoryFile}
                            />
                            {isUploadingStoryFile ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Image size={16} />
                            )}
                            <span>Subir imagen/PDF</span>
                          </label>

                          {/* Agregar URL */}
                          <button
                            type="button"
                            onClick={() => {
                              const url = prompt('Ingresa la URL del recurso:');
                              if (url && url.trim()) {
                                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                  toast.error('La URL debe comenzar con http:// o https://');
                                  return;
                                }
                                setPinForm({ 
                                  ...pinForm, 
                                  storyFiles: [...(pinForm.storyFiles || []), url.trim()] 
                                });
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          >
                            <Globe size={16} />
                            <span>Agregar URL</span>
                          </button>

                          {/* Agregar Genially */}
                          <button
                            type="button"
                            onClick={() => {
                              const embedCode = prompt('Pega el código de embed de Genially (o la URL de compartir):');
                              if (embedCode && embedCode.trim()) {
                                // Extraer URL del iframe si es código embed
                                let geniallyUrl = embedCode.trim();
                                const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
                                if (srcMatch) {
                                  geniallyUrl = srcMatch[1];
                                }
                                // Validar que sea de Genially
                                if (!geniallyUrl.includes('genial.ly') && !geniallyUrl.includes('genially')) {
                                  toast.error('El enlace debe ser de Genially');
                                  return;
                                }
                                setPinForm({ 
                                  ...pinForm, 
                                  storyFiles: [...(pinForm.storyFiles || []), geniallyUrl] 
                                });
                                toast.success('Genially agregado');
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          >
                            <Code size={16} />
                            <span>Insertar Genially</span>
                          </button>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mt-2">
                        Puedes agregar imágenes, PDFs, URLs o presentaciones de Genially
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'task' && pinForm.pinType === 'OBJECTIVE' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre de la tarea
                      </label>
                      <input
                        type="text"
                        value={pinForm.taskName || ''}
                        onChange={(e) => setPinForm({ ...pinForm, taskName: e.target.value })}
                        placeholder="Ej: Investigar sobre el tema"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Descripción de la tarea
                      </label>
                      <textarea
                        value={pinForm.taskContent || ''}
                        onChange={(e) => setPinForm({ ...pinForm, taskContent: e.target.value })}
                        placeholder="Describe lo que el estudiante debe hacer..."
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="requiresSubmission"
                        checked={pinForm.requiresSubmission}
                        onChange={(e) => setPinForm({ ...pinForm, requiresSubmission: e.target.checked })}
                        className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="requiresSubmission" className="text-sm text-gray-700 dark:text-gray-300">
                        El estudiante debe subir un archivo como resolución
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'config' && (
                  <div className="space-y-4">
                    {/* Auto progress */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="autoProgress"
                        checked={pinForm.autoProgress || false}
                        onChange={(e) => setPinForm({ ...pinForm, autoProgress: e.target.checked })}
                        className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="autoProgress" className="text-sm text-gray-700 dark:text-gray-300">
                        Progreso a ritmo del estudiante (avance automático)
                      </label>
                    </div>

                    {/* Rewards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Gift size={14} className="inline mr-1" />
                          Recompensa XP
                        </label>
                        <input
                          type="number"
                          value={pinForm.rewardXp}
                          onChange={(e) => setPinForm({ ...pinForm, rewardXp: parseInt(e.target.value) || 0 })}
                          min={0}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Gift size={14} className="inline mr-1" />
                          Recompensa GP
                        </label>
                        <input
                          type="number"
                          value={pinForm.rewardGp}
                          onChange={(e) => setPinForm({ ...pinForm, rewardGp: parseInt(e.target.value) || 0 })}
                          min={0}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Due date */}
                    {pinForm.pinType === 'OBJECTIVE' && pinForm.requiresSubmission && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <Calendar size={14} className="inline mr-1" />
                          Fecha de vencimiento
                        </label>
                        <input
                          type="datetime-local"
                          value={pinForm.dueDate ? new Date(pinForm.dueDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setPinForm({ ...pinForm, dueDate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Progress tab content */}
                {activeTab === 'progress' && selectedPin && (
                  <div className="space-y-4">
                    {isLoadingProgress ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                      </div>
                    ) : pinProgress.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No hay estudiantes en este pin aún</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {pinProgress.map((progress: ExpeditionPinProgress) => {
                          // Buscar entrega del estudiante
                          const submission = pinSubmissions.find(s => s.studentProfileId === progress.studentProfileId);
                          const files = submission?.files 
                            ? (typeof submission.files === 'string' ? JSON.parse(submission.files) : submission.files)
                            : [];
                          
                          return (
                            <div
                              key={progress.id}
                              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                            >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                  {progress.student?.characterName?.[0] || progress.student?.user?.displayName?.[0] || '?'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800 dark:text-white text-sm">
                                    {progress.student?.characterName || progress.student?.user?.displayName || 'Estudiante'}
                                  </p>
                                  <p className={`text-xs ${PROGRESS_STATUS_CONFIG[progress.status].color}`}>
                                    {PROGRESS_STATUS_CONFIG[progress.status].label}
                                  </p>
                                </div>
                              </div>
                              {/* Solo mostrar botones de aprobar/rechazar si autoProgress está desactivado (del pin o de la expedición) */}
                              {!(selectedPin?.autoProgress ?? expedition?.autoProgress) && (progress.status === 'IN_PROGRESS' || progress.status === 'UNLOCKED') && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => expeditionApi.setTeacherDecision(selectedPin.id, {
                                      studentProfileId: progress.studentProfileId,
                                      passed: true
                                    }).then(() => {
                                      queryClient.invalidateQueries({ queryKey: ['pin-progress', selectedPin.id] });
                                      queryClient.invalidateQueries({ queryKey: ['pin-submissions', selectedPin.id] });
                                      toast.success('Estudiante aprobado');
                                    })}
                                    className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                                    title="Aprobar"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => expeditionApi.setTeacherDecision(selectedPin.id, {
                                      studentProfileId: progress.studentProfileId,
                                      passed: false
                                    }).then(() => {
                                      queryClient.invalidateQueries({ queryKey: ['pin-progress', selectedPin.id] });
                                      queryClient.invalidateQueries({ queryKey: ['pin-submissions', selectedPin.id] });
                                      toast.success('Estudiante no aprobado');
                                    })}
                                    className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                                    title="No aprobar"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                              {(progress.status === 'PASSED' || progress.status === 'FAILED') && (
                                <span className={`text-xs px-2 py-1 rounded-full ${PROGRESS_STATUS_CONFIG[progress.status].bgColor} ${PROGRESS_STATUS_CONFIG[progress.status].color}`}>
                                  {progress.teacherDecision ? '✓ Aprobado' : '✗ No aprobado'}
                                </span>
                              )}
                            </div>
                            
                            {/* Archivos entregados */}
                              {files.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-500 mb-1">📎 Archivos entregados:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {files.map((file: string, idx: number) => (
                                      <a
                                        key={idx}
                                        href={file.startsWith('http') ? file : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${file}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                      >
                                        <FileText size={12} />
                                        {file.includes('.pdf') ? 'PDF' : 'Imagen'}
                                      </a>
                                    ))}
                                  </div>
                                  {submission?.comment && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                      "{submission.comment}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  {selectedPin && (
                    <Button
                      variant="danger"
                      onClick={() => deletePinMutation.mutate(selectedPin.id)}
                      disabled={deletePinMutation.isPending}
                    >
                      <Trash2 size={16} className="mr-1" />
                      Eliminar
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowPinModal(false);
                      setSelectedPin(null);
                      resetPinForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSavePin}
                    disabled={createPinMutation.isPending || updatePinMutation.isPending}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500"
                  >
                    <Save size={16} className="mr-1" />
                    {selectedPin ? 'Guardar' : 'Crear Pin'}
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
