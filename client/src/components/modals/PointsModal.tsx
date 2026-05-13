import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  Heart,
  Coins,
  X,
  Zap,
  Users,
  Award,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import { type Classroom } from '../../lib/classroomApi';
import { type PointType } from '../../lib/studentApi';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';

export { behaviorApi, type Behavior };
export { type PointType };

interface PointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPositive: boolean;
  selectedCount: number;
  selectedStudentNames: string[];
  behaviors: Behavior[];
  onApplyBehavior: (behavior: Behavior) => void;
  onApplyManual: (pointType: PointType, amount: number, reason: string, competencyId?: string) => Promise<void>;
  isLoading: boolean;
  classroomId: string;
  classroom: Classroom;
}

export const PointsModal = ({
  isOpen,
  onClose,
  isPositive,
  selectedCount,
  selectedStudentNames,
  behaviors,
  onApplyBehavior,
  onApplyManual,
  isLoading,
  classroomId,
  classroom,
}: PointsModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'behaviors' | 'manual'>('behaviors');
  const [manualPointType, setManualPointType] = useState<PointType>('XP');
  const [manualAmount, setManualAmount] = useState(10);
  const [manualReason, setManualReason] = useState('');
  const [manualCompetencyId, setManualCompetencyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { competencies: classroomCompetencies = [] } = useClassroomCompetencies(
    classroom.id,
    !!classroom.useCompetencies && !!classroom.curriculumAreaId,
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onApplyManual(manualPointType, manualAmount, manualReason, manualCompetencyId || undefined);
      setManualReason('');
      setManualCompetencyId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col md:flex-row"
        >
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-72 flex-shrink-0 relative overflow-hidden">
            <motion.img
              src={isPositive ? '/assets/mascot/jiro-puntosfavor.jpg' : '/assets/mascot/jiro-puntoscontra.jpg'}
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Panel derecho - Contenido */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {isPositive ? <Sparkles className="text-emerald-500" size={24} /> : <Zap className="text-red-500" size={24} />}
                {isPositive ? 'Dar puntos' : 'Quitar puntos'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('behaviors')}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'behaviors'
                    ? isPositive
                      ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'text-red-600 border-b-2 border-red-600 bg-red-50 dark:bg-red-900/20'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Award size={16} />
                Comportamientos
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'manual'
                    ? isPositive
                      ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'text-red-600 border-b-2 border-red-600 bg-red-50 dark:bg-red-900/20'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Settings size={16} />
                Manual
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {/* Destinatario */}
              <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2">
                  <Users size={14} />
                  Aplicar a <span className="font-bold">{selectedCount}</span> estudiante{selectedCount !== 1 ? 's' : ''}
                  {selectedCount <= 3 && selectedStudentNames.length > 0 && (
                    <span className="text-violet-500 dark:text-violet-400">— {selectedStudentNames.join(', ')}</span>
                  )}
                  {selectedCount > 3 && (
                    <span className="text-violet-500 dark:text-violet-400">— {selectedCount} seleccionados</span>
                  )}
                </p>
              </div>

              {/* Tab: Comportamientos */}
              {activeTab === 'behaviors' && (
                <>
                  {behaviors.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No hay comportamientos configurados</p>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          onClose();
                          navigate(`/classroom/${classroomId}/behaviors`);
                        }}
                      >
                        Configurar comportamientos
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {behaviors.map((behavior) => (
                        <button
                          key={behavior.id}
                          onClick={() => onApplyBehavior(behavior)}
                          disabled={isLoading}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                            isPositive
                              ? 'border-green-200 dark:border-green-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                              : 'border-red-200 dark:border-red-800 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">{behavior.icon || (isPositive ? '⭐' : '💔')}</span>
                            <div className="text-left min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">{behavior.name}</p>
                              {behavior.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {behavior.description.length > 120 ? behavior.description.slice(0, 120) + '...' : behavior.description}
                                </p>
                              )}
                              {behavior.competency && (
                                <div className="mt-1 flex items-center gap-1">
                                  <Award size={11} className="text-violet-500 flex-shrink-0" />
                                  <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium truncate">{behavior.competency.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const xp = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
                              const hp = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
                              const gp = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);
                              const sign = isPositive ? '+' : '-';
                              const rewards = [];
                              if (xp > 0) rewards.push(<span key="xp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{sign}{xp} XP</span>);
                              if (hp > 0) rewards.push(<span key="hp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">{sign}{hp} HP</span>);
                              if (gp > 0) rewards.push(<span key="gp" className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{sign}{gp} GP</span>);
                              return rewards.length > 0 ? rewards : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">0</span>;
                            })()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Manual */}
              {activeTab === 'manual' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${
                    isPositive
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <h4 className={`font-semibold text-sm mb-2 flex items-center gap-2 ${isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                      💡 Consejos para asignar puntos
                    </h4>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                      {isPositive ? (
                        <>
                          <li className="flex items-start gap-2"><span className="text-emerald-500">✓</span><span><strong>XP:</strong> Para logros académicos y participación activa.</span></li>
                          <li className="flex items-start gap-2"><span className="text-emerald-500">✓</span><span><strong>HP:</strong> Para premiar buena conducta y puntualidad.</span></li>
                          <li className="flex items-start gap-2"><span className="text-emerald-500">✓</span><span><strong>GP:</strong> Moneda para la tienda. Úsalo como incentivo especial.</span></li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2"><span className="text-red-500">!</span><span><strong>Sé justo:</strong> La penalización debe ser proporcional a la falta.</span></li>
                          <li className="flex items-start gap-2"><span className="text-red-500">!</span><span><strong>HP para conducta:</strong> Quitar HP por faltas de comportamiento.</span></li>
                          <li className="flex items-start gap-2"><span className="text-red-500">!</span><span><strong>XP con cuidado:</strong> Solo para trabajo académico.</span></li>
                        </>
                      )}
                    </ul>
                  </div>

                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Tipo de punto</label>
                      <div className="flex gap-2">
                        {(['XP', 'HP', 'GP'] as PointType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setManualPointType(type)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                              manualPointType === type
                                ? isPositive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {type === 'XP' && <Sparkles size={16} />}
                            {type === 'HP' && <Heart size={16} />}
                            {type === 'GP' && <Coins size={16} />}
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Cantidad</label>
                      <div className="flex items-center gap-3">
                        {[5, 10, 25, 50].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setManualAmount(val)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              manualAmount === val
                                ? isPositive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                        <Input
                          type="number"
                          value={manualAmount}
                          onChange={(e) => setManualAmount(parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          min={1}
                        />
                      </div>
                    </div>

                    {classroom.useCompetencies && classroom.curriculumAreaId && classroomCompetencies.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Competencia <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <select
                          value={manualCompetencyId}
                          onChange={(e) => setManualCompetencyId(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-700 dark:text-gray-200"
                        >
                          <option value="">Sin competencia</option>
                          {classroomCompetencies.map((comp: any) => (
                            <option key={comp.id} value={comp.id}>{comp.shortName ? `${comp.shortName} — ` : ''}{comp.name}</option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                          {manualCompetencyId ? '📊 Estos puntos contarán en el libro de calificaciones' : 'Vincular a una competencia hace que cuenten en calificaciones'}
                        </p>
                      </div>
                    )}

                    <Input
                      label="Razón"
                      placeholder="Ej: Participación en clase, tarea completada..."
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                      required
                    />

                    <Button
                      type="submit"
                      className={`w-full ${isPositive ? '!bg-green-500 hover:!bg-green-600' : '!bg-red-500 hover:!bg-red-600'}`}
                      isLoading={isSubmitting}
                      disabled={!manualReason.trim() || manualAmount <= 0}
                    >
                      {isPositive ? 'Agregar' : 'Quitar'} {manualAmount} {manualPointType}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
