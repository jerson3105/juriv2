import { useCallback, useEffect, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Award, Check, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { RARITY_LABELS, badgeApi, type BadgeAssignment, type BadgeRarity, type GeneratedBadge } from '../../lib/badgeApi';
import { behaviorApi } from '../../lib/behaviorApi';
import type { Classroom } from '../../lib/classroomApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';
import { BadgeMedallion } from './BadgeMedallion';
import { RARITY_ORDER, RARITY_STYLE, conditionText, isImportable, parseCondition } from './badgeHelpers';

interface AIBadgeModalProps {
  classroom: Classroom;
  onClose: () => void;
  onImport: (badges: GeneratedBadge[]) => Promise<void>;
}

const EXAMPLES = [
  { emoji: '⭐', title: 'Excelencia', desc: 'Insignias para reconocer notas sobresalientes, trabajos perfectos y logros académicos destacados' },
  { emoji: '🔥', title: 'Constancia', desc: 'Insignias para premiar asistencia continua, racha de participaciones y progreso sostenido' },
  { emoji: '🤝', title: 'Colaboración', desc: 'Insignias para el trabajo en equipo, ayudar compañeros, liderazgo positivo y buen compañerismo' },
  { emoji: '🚀', title: 'Progreso', desc: 'Insignias para celebrar mejoras personales, superar metas, subir de nivel y evolucionar' },
  { emoji: '💡', title: 'Creatividad', desc: 'Insignias para ideas innovadoras, proyectos creativos, soluciones originales y pensamiento crítico' },
  { emoji: '🎯', title: 'Retos', desc: 'Insignias para completar desafíos especiales, misiones difíciles y logros extraordinarios' },
];

const LEVELS = ['Primaria (6-11 años)', 'Secundaria (12-16 años)', 'Preparatoria/Bachillerato', 'Universidad', 'Formación profesional'];

const MODES: { value: BadgeAssignment; label: string }[] = [
  { value: 'MANUAL', label: 'Las doy yo' },
  { value: 'AUTOMATIC', label: 'Solas' },
  { value: 'BOTH', label: 'Ambas' },
];

const clampCount = (value: number) => Math.min(15, Math.max(3, value || 8));
const clampReward = (value: number) => Math.min(1000, Math.max(0, Math.round(value || 0)));


const chip = (active: boolean) =>
  `rounded-xl border-2 transition-colors ${
    active ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
  }`;
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';
const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400';

export const AIBadgeModal = ({ classroom, onClose, onImport }: AIBadgeModalProps) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(8);
  const [assignmentMode, setAssignmentMode] = useState<BadgeAssignment>('MANUAL');
  const [rarities, setRarities] = useState<Set<BadgeRarity>>(new Set(['COMMON', 'RARE', 'EPIC']));
  const [includeSecret, setIncludeSecret] = useState(false);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [generated, setGenerated] = useState<GeneratedBadge[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const isPresent = useIsPresent();

  const { data: behaviors = [] } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });
  const { competencies = [] } = useClassroomCompetencies(classroom.id, !!classroom.useCompetencies && !!classroom.curriculumAreaId);

  const busy = isGenerating || isImporting;
  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !busy && !event.defaultPrevented) onClose();
  }, [isPresent, busy, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const generate = async () => {
    setIsGenerating(true);
    try {
      const result = await badgeApi.generateWithAI({
        description,
        level,
        count: clampCount(count),
        assignmentMode,
        rarities: Array.from(rarities),
        includeSecret,
        classroomId: classroom.id,
        competencies: classroom.useCompetencies && selectedCompetencies.length > 0
          ? competencies.filter((c) => selectedCompetencies.includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
          : undefined,
      });
      const cleaned = result.badges.map((b) => ({
        ...b,
        name: String(b.name ?? '').slice(0, 100),
        description: String(b.description ?? '').slice(0, 255),
        icon: String(b.icon || '🏆').slice(0, 50),
        rarity: RARITY_ORDER.includes(b.rarity) ? b.rarity : 'COMMON',
        rewardXp: clampReward(b.rewardXp),
        rewardGp: clampReward(b.rewardGp),
      }));
      setGenerated(cleaned);
      setSelected(new Set(cleaned.map((b, i) => (isImportable(b, behaviors) ? i : -1)).filter((i) => i >= 0)));
      setEditingIndex(null);
      setStep('preview');
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudieron generar insignias');
    } finally {
      setIsGenerating(false);
    }
  };

  const update = (index: number, changes: Partial<GeneratedBadge>) =>
    setGenerated((prev) => prev.map((b, i) => (i === index ? { ...b, ...changes } : b)));

  const remove = (index: number) => {
    setGenerated((prev) => prev.filter((_, i) => i !== index));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
    setEditingIndex(null);
  };

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const importSelected = async () => {
    const list = generated.filter((b, i) => selected.has(i) && isImportable(b, behaviors));
    if (list.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(list);
    } finally {
      setIsImporting(false);
    }
  };

  const importableSelected = generated.filter((b, i) => selected.has(i) && isImportable(b, behaviors)).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-badges-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 id="ai-badges-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {step === 'form' ? 'Generar insignias con IA' : 'Revisa antes de importar'}
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {step === 'form' ? 'Cuenta qué logros quieres reconocer' : `${selected.size} de ${generated.length} seleccionadas`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'form' ? (
            <div className="space-y-5">
              <div>
                <span className={labelClass}>Ideas rápidas</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.title}
                      type="button"
                      onClick={() => setDescription(example.desc)}
                      aria-pressed={description === example.desc}
                      className={`${chip(description === example.desc)} flex min-h-[44px] items-center gap-2 px-3 py-2 text-left`}
                    >
                      <span className="text-lg" aria-hidden="true">{example.emoji}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{example.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="ai-badge-description" className={labelClass}>O escribe tu propia idea</label>
                <textarea
                  id="ai-badge-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qué logros quieres reconocer..."
                  className={`${fieldClass} h-auto resize-none py-2.5`}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-badge-level" className={labelClass}>Nivel educativo</label>
                  <select id="ai-badge-level" value={level} onChange={(e) => setLevel(e.target.value)} className={`${fieldClass} story-select`}>
                    <option value="">Selecciona...</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ai-badge-count" className={labelClass}>¿Cuántas? <span className="font-normal text-gray-600 dark:text-gray-300">(3 a 15)</span></label>
                  <input id="ai-badge-count" type="number" min={3} max={15} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 0)} onBlur={() => setCount(clampCount)} className={fieldClass} />
                </div>
              </div>

              <div>
                <span className={labelClass}>¿Cómo se ganan?</span>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((mode) => (
                    <button key={mode.value} type="button" aria-pressed={assignmentMode === mode.value} onClick={() => setAssignmentMode(mode.value)} className={`${chip(assignmentMode === mode.value)} min-h-[44px] px-2 text-sm font-semibold text-gray-900 dark:text-white`}>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={labelClass}>Rarezas <span className="font-normal text-gray-600 dark:text-gray-300">(al menos una)</span></span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RARITY_ORDER.map((rarity) => {
                    const active = rarities.has(rarity);
                    return (
                      <button
                        key={rarity}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setRarities((prev) => {
                          const next = new Set(prev);
                          if (next.has(rarity)) {
                            if (next.size > 1) next.delete(rarity);
                          } else next.add(rarity);
                          return next;
                        })}
                        className={`${chip(active)} flex min-h-[44px] items-center justify-center gap-2 px-2 text-sm font-semibold text-gray-900 dark:text-white`}
                      >
                        <span className={`h-4 w-4 rounded-full ${RARITY_STYLE[rarity].disc}`} aria-hidden="true" />
                        {RARITY_LABELS[rarity]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
                <input type="checkbox" checked={includeSecret} onChange={(e) => setIncludeSecret(e.target.checked)} className="h-5 w-5 rounded border-gray-400 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Incluir algunas secretas</span>
              </label>

              {classroom.useCompetencies && competencies.length > 0 && (
                <div>
                  <span className={labelClass}>Competencias a considerar <span className="font-normal text-gray-600 dark:text-gray-300">(la IA asignará la más adecuada)</span></span>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-900">
                    {competencies.map((c) => (
                      <label key={c.id} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="checkbox"
                          checked={selectedCompetencies.includes(c.id)}
                          onChange={(e) => setSelectedCompetencies((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))}
                          className="h-4 w-4 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="truncate text-sm text-gray-900 dark:text-white">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {generated.map((b, index) => {
                const valid = isImportable(b, behaviors);
                const condition = parseCondition(b.unlockCondition);
                const text = b.assignmentMode === 'MANUAL' ? 'La das tú' : `Sola ${conditionText(condition, behaviors) ?? ''}`;
                if (editingIndex === index) {
                  return (
                    <li key={index} className="space-y-3 rounded-xl border-2 border-primary-500 bg-primary-50 p-4 dark:bg-primary-900/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary-800 dark:text-primary-200">Editando</span>
                        <button type="button" onClick={() => remove(index)} aria-label={`Descartar ${b.name}`} title="Descartar" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input type="text" value={b.name} maxLength={100} onChange={(e) => update(index, { name: e.target.value })} aria-label="Nombre" className={fieldClass} />
                        <input type="text" value={b.description} maxLength={255} onChange={(e) => update(index, { description: e.target.value })} aria-label="Descripción" className={fieldClass} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={b.rarity} onChange={(e) => update(index, { rarity: e.target.value as BadgeRarity })} aria-label="Rareza" className={`${fieldClass} story-select w-auto`}>
                          {RARITY_ORDER.map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
                        </select>
                        {(['rewardXp', 'rewardGp'] as const).map((key) => (
                          <label key={key} className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {key === 'rewardXp' ? 'XP' : 'Oro'}
                            <input type="number" min={0} max={1000} value={b[key]} onChange={(e) => update(index, { [key]: clampReward(parseInt(e.target.value)) })} className="h-9 w-20 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                          </label>
                        ))}
                      </div>
                      {b.assignmentMode !== 'MANUAL' && condition?.type === 'BEHAVIOR_COUNT' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={condition.behaviorId ?? ''}
                            onChange={(e) => update(index, { unlockCondition: { ...condition, behaviorId: e.target.value } })}
                            aria-label="Comportamiento de la condición"
                            className={`${fieldClass} story-select min-w-0 flex-1`}
                          >
                            <option value="">Elige el comportamiento…</option>
                            {behaviors.filter((beh) => beh.isPositive).map((beh) => <option key={beh.id} value={beh.id}>{beh.name}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            Veces
                            <input type="number" min={1} value={condition.count ?? 1} onChange={(e) => update(index, { unlockCondition: { ...condition, count: Math.max(1, parseInt(e.target.value) || 1) } })} className="h-9 w-20 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                          </label>
                        </div>
                      )}
                      <button type="button" onClick={() => setEditingIndex(null)} className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700">
                        <Check size={16} aria-hidden="true" /> Listo
                      </button>
                    </li>
                  );
                }
                const isSelected = selected.has(index);
                return (
                  <li
                    key={index}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                      isSelected && valid ? `bg-gradient-to-r to-white dark:to-gray-800 ${RARITY_STYLE[b.rarity].tile}` : 'border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      disabled={!valid}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Quitar de la importación' : 'Incluir en la importación'}: ${b.name}`}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center disabled:cursor-not-allowed"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected && valid ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                        {isSelected && valid && <Check size={13} />}
                      </span>
                    </button>
                    <BadgeMedallion badge={{ ...b, customImage: null }} size="sm" animated={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-gray-900 dark:text-white">{b.name}</span>
                      {b.description && <span className="block truncate text-xs text-gray-700 dark:text-gray-300">{b.description}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${RARITY_STYLE[b.rarity].chip}`}>{RARITY_LABELS[b.rarity]}</span>
                        {b.rewardXp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.XP}`}>+{b.rewardXp} XP</span>}
                        {b.rewardGp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.GP}`}>+{b.rewardGp} oro</span>}
                        {b.competencyId && competencies.some((c) => c.id === b.competencyId) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                            <Award size={12} aria-hidden="true" />
                            Competencia
                          </span>
                        )}
                        <span className="text-gray-700 dark:text-gray-300">{text}</span>
                      </span>
                      {!valid && (
                        <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Condición incompleta: edítala para poder importarla
                        </span>
                      )}
                    </span>
                    <button type="button" onClick={() => setEditingIndex(index)} aria-label={`Editar ${b.name}`} title="Editar" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white">
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {step === 'preview' ? (
            <button type="button" onClick={() => setStep('form')} disabled={busy} className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              ← Volver
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            {step === 'form' ? (
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!description.trim() || !level || isGenerating}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
              >
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden="true" />
                    Generar
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void importSelected()}
                disabled={importableSelected === 0 || isImporting}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
              >
                <Check size={16} aria-hidden="true" />
                {isImporting ? 'Importando...' : `Importar ${importableSelected}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
