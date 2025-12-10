import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Users, 
  Copy, 
  Check, 
  Sparkles, 
  Heart, 
  Coins,
  Plus,
  Minus,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { classroomApi } from '../../lib/classroomApi';
import { studentApi, CHARACTER_CLASSES, type PointType } from '../../lib/studentApi';
import toast from 'react-hot-toast';

export const ClassroomDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);
  const [pointsModal, setPointsModal] = useState<{ studentId: string; type: PointType } | null>(null);

  const { data: classroom, isLoading, isError } = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => classroomApi.getById(id!),
    enabled: !!id,
  });

  const updatePointsMutation = useMutation({
    mutationFn: ({ studentId, data }: { studentId: string; data: { pointType: PointType; amount: number; reason: string } }) =>
      studentApi.updatePoints(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', id] });
      setPointsModal(null);
      toast.success('Puntos actualizados');
    },
    onError: () => {
      toast.error('Error al actualizar puntos');
    },
  });

  const copyCode = async () => {
    if (!classroom) return;
    await navigator.clipboard.writeText(classroom.code);
    setCopiedCode(true);
    toast.success('Código copiado');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !classroom) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {isError ? 'Error al cargar la clase' : 'Clase no encontrada'}
        </p>
        <Button variant="secondary" onClick={() => navigate('/classrooms')} className="mt-4">
          Volver a mis clases
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/classrooms')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {classroom.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {classroom.description || 'Sin descripción'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 rounded-lg">
          <span className="text-sm text-indigo-600 dark:text-indigo-400">Código:</span>
          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-xl">
            {classroom.code}
          </span>
          <button onClick={copyCode} className="ml-2 p-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded">
            {copiedCode ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <Users className="w-8 h-8 mx-auto text-blue-500" />
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{classroom.students?.length || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Estudiantes</p>
        </Card>
        <Card className="text-center">
          <Sparkles className="w-8 h-8 mx-auto text-emerald-500" />
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{classroom.defaultXp}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">XP Inicial</p>
        </Card>
        <Card className="text-center">
          <Heart className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{classroom.defaultHp}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">HP Inicial</p>
        </Card>
      </div>

      {/* Lista de estudiantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Estudiantes ({classroom.students?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!classroom.students || classroom.students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Aún no hay estudiantes en esta clase
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Comparte el código <span className="font-mono font-bold">{classroom.code}</span> con tus estudiantes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {classroom.students.map((student) => {
                const classInfo = CHARACTER_CLASSES[student.characterClass];
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-2xl">
                        {classInfo?.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {student.characterName || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {classInfo?.name} • Nivel {student.level}
                        </p>
                      </div>
                    </div>

                    {/* Stats del estudiante */}
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => setPointsModal({ studentId: student.id, type: 'XP' })}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                      >
                        <Sparkles size={16} className="text-emerald-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{student.xp}</span>
                      </button>
                      <button
                        onClick={() => setPointsModal({ studentId: student.id, type: 'HP' })}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Heart size={16} className="text-red-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{student.hp}</span>
                      </button>
                      <button
                        onClick={() => setPointsModal({ studentId: student.id, type: 'GP' })}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <Coins size={16} className="text-amber-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{student.gp}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de puntos */}
      <PointsModal
        isOpen={!!pointsModal}
        onClose={() => setPointsModal(null)}
        pointType={pointsModal?.type || 'XP'}
        onSubmit={(amount, reason) => {
          if (pointsModal) {
            updatePointsMutation.mutate({
              studentId: pointsModal.studentId,
              data: { pointType: pointsModal.type, amount, reason },
            });
          }
        }}
        isLoading={updatePointsMutation.isPending}
      />
    </div>
  );
};

// Modal para agregar/quitar puntos
const PointsModal = ({
  isOpen,
  onClose,
  pointType,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  pointType: PointType;
  onSubmit: (amount: number, reason: string) => void;
  isLoading: boolean;
}) => {
  const [amount, setAmount] = useState(10);
  const [isAdding, setIsAdding] = useState(true);
  const [reason, setReason] = useState('');

  const handleClose = () => {
    setAmount(10);
    setIsAdding(true);
    setReason('');
    onClose();
  };

  const pointConfig = {
    XP: { icon: Sparkles, label: 'XP' },
    HP: { icon: Heart, label: 'HP' },
    GP: { icon: Coins, label: 'Oro' },
  };

  const config = pointConfig[pointType];
  const Icon = config.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(isAdding ? amount : -amount, reason);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Icon className="text-indigo-500" />
              Modificar {config.label}
            </h2>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Toggle agregar/quitar */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isAdding
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <Plus size={18} /> Agregar
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  !isAdding
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <Minus size={18} /> Quitar
              </button>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Cantidad</label>
              <div className="flex items-center gap-3">
                {[5, 10, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      amount === val
                        ? isAdding 
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {val}
                  </button>
                ))}
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  className="w-20 text-center"
                  min={1}
                />
              </div>
            </div>

            {/* Razón */}
            <Input
              label="Razón"
              placeholder="Ej: Participación en clase, tarea completada..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            <Button
              type="submit"
              className={`w-full ${isAdding ? '!bg-green-500 hover:!bg-green-600' : '!bg-red-500 hover:!bg-red-600'}`}
              isLoading={isLoading}
              disabled={!reason.trim() || amount <= 0}
            >
              {isAdding ? 'Agregar' : 'Quitar'} {amount} {config.label}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
