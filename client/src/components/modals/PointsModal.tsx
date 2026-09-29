import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  Heart,
  Coins,
  X,
  Award,
  Settings,
  Target,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { behaviorApi, type Behavior } from '../../lib/behaviorApi';
import { type Classroom } from '../../lib/classroomApi';
import { type PointType } from '../../lib/studentApi';
import { getBehaviorRewards } from '../../lib/behaviorPoints';
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
  onApplyBehavior: (behavior: Behavior, multiplier: number) => void;
  onApplyManual: (pointType: PointType, amount: number, reason: string, competencyId?: string, competencyIndicatorId?: string) => Promise<void>;
  isLoading: boolean;
  classroomId: string;
  classroom: Classroom;
}

const MULTIPLIERS = [1, 0.5, 0.25, 0.125];

const rewardPillClass: Record<'XP' | 'HP' | 'GP', string> = {
  XP: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
  HP: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
  GP: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
};

// Un toque en un comportamiento lo aplica con el puntaje elegido arriba (antes: elegir + confirmar).
// Si la lista trae positivos y negativos, se muestran en dos secciones; primero la del botón que abrió.
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
  const [manualCompetencyIndicatorId, setManualCompetencyIndicatorId] = useState<string>('');
  const [behaviorMultiplier, setBehaviorMultiplier] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { competencies: classroomCompetencies = [] } = useClassroomCompetencies(
    classroom.id,
    !!classroom.useCompetencies && !!classroom.curriculumAreaId,
  );

  useEffect(() => {
    if (!isOpen) return;
    setBehaviorMultiplier(1);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onApplyManual(manualPointType, manualAmount, manualReason, manualCompetencyId || undefined, manualCompetencyIndicatorId || undefined);
      setManualReason('');
      setManualCompetencyId('');
      setManualCompetencyIndicatorId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const positives = behaviors.filter((behavior) => behavior.isPositive);
  const negatives = behaviors.filter((behavior) => !behavior.isPositive);
  const sections = [
    { key: 'positive', title: 'Positivos', items: positives },
    { key: 'negative', title: 'Negativos', items: negatives },
  ].filter((section) => section.items.length > 0);
  if (!isPositive) sections.reverse();

  const recipients = selectedCount <= 3 && selectedStudentNames.length > 0
    ? selectedStudentNames.join(', ')
    : `${selectedCount} estudiantes`;

  const tabClass = (tab: 'behaviors' | 'manual') =>
    `flex-1 min-h-[44px] text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
      activeTab === tab
        ? 'text-primary-700 dark:text-primary-300 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/20'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
    }`;

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
          role="dialog"
          aria-modal="true"
          aria-labelledby="points-modal-title"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="min-w-0">
              <h2 id="points-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {isPositive ? 'Dar puntos' : 'Quitar puntos'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                Para <span className="font-semibold text-primary-700 dark:text-primary-300">{recipients}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => setActiveTab('behaviors')} className={tabClass('behaviors')}>
              <Award size={16} aria-hidden="true" />
              Comportamientos
            </button>
            <button onClick={() => setActiveTab('manual')} className={tabClass('manual')}>
              <Settings size={16} aria-hidden="true" />
              Manual
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
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
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Puntaje</span>
                        {MULTIPLIERS.map((multiplier) => (
                          <button
                            key={multiplier}
                            type="button"
                            onClick={() => setBehaviorMultiplier(multiplier)}
                            aria-pressed={behaviorMultiplier === multiplier}
                            className={`min-h-[36px] min-w-[48px] px-2 rounded-lg text-sm font-semibold ${
                              behaviorMultiplier === multiplier
                                ? 'bg-primary-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            {multiplier === 1 ? '1x' : `1/${1 / multiplier}`}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="0.01"
                          max="10"
                          step="0.01"
                          value={behaviorMultiplier}
                          onChange={(event) => setBehaviorMultiplier(Math.min(10, Math.max(0.01, Number(event.target.value) || 1)))}
                          aria-label="Multiplicador personalizado"
                          title="Multiplicador personalizado"
                          className="min-h-[36px] w-20 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        />
                        <span className="w-full text-xs text-gray-600 dark:text-gray-400">Toca un comportamiento para aplicarlo.</span>
                      </div>

                      <div className="space-y-5">
                        {sections.map((section) => (
                          <section key={section.key} aria-label={section.title}>
                            {sections.length > 1 && (
                              <h3 className={`mb-2 text-xs font-bold uppercase tracking-wide ${section.key === 'positive' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                {section.title}
                              </h3>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {section.items.map((behavior) => {
                                const rewards = getBehaviorRewards(behavior, behaviorMultiplier);
                                const sign = behavior.isPositive ? '+' : '−';
                                return (
                                  <button
                                    key={behavior.id}
                                    type="button"
                                    onClick={() => onApplyBehavior(behavior, behaviorMultiplier)}
                                    disabled={isLoading}
                                    className={`w-full min-h-[56px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                                      behavior.isPositive
                                        ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                        : 'border-red-200 dark:border-red-800 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2.5 min-w-0">
                                      <span className="text-2xl flex-shrink-0" aria-hidden="true">{behavior.icon || (behavior.isPositive ? '⭐' : '💔')}</span>
                                      <span className="min-w-0">
                                        <span className="block font-medium text-gray-900 dark:text-white truncate">{behavior.name}</span>
                                        {behavior.competency && (
                                          <span className="mt-0.5 flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300 truncate">
                                            <Award size={11} className="flex-shrink-0" aria-hidden="true" />
                                            {behavior.competency.name}
                                          </span>
                                        )}
                                        {behavior.competencyIndicator && (
                                          <span className="mt-0.5 flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300 truncate">
                                            <Target size={11} className="flex-shrink-0" aria-hidden="true" />
                                            {behavior.competencyIndicator.name}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                    <span className="flex flex-col items-end gap-1 flex-shrink-0">
                                      {rewards.length > 0 ? rewards.map((reward) => (
                                        <span key={reward.type} className={`px-2 py-0.5 rounded-full text-xs font-bold ${rewardPillClass[reward.type]}`}>
                                          {sign}{reward.amount} {reward.type}
                                        </span>
                                      )) : (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">0</span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
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
                          onChange={(e) => { setManualCompetencyId(e.target.value); setManualCompetencyIndicatorId(''); }}
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
                        {manualCompetencyId && (() => {
                          const indicators = classroomCompetencies.find((competency) => competency.id === manualCompetencyId)?.indicators.filter((indicator) => indicator.isActive) || [];
                          if (indicators.length === 0) return null;
                          return <div className="mt-3">
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Destreza <span className="text-gray-400 font-normal">(opcional)</span></label>
                            <select value={manualCompetencyIndicatorId} onChange={(e) => setManualCompetencyIndicatorId(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200">
                              <option value="">Sin destreza específica</option>
                              {indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}
                            </select>
                          </div>;
                        })()}
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
