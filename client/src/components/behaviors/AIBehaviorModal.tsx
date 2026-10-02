import { useCallback, useEffect, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { Award, Check, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Classroom } from '../../lib/classroomApi';
import { behaviorApi, type GeneratedBehavior } from '../../lib/behaviorApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';

type PointMode = 'COMBINED' | 'XP_ONLY' | 'HP_ONLY' | 'GP_ONLY';

interface AIBehaviorModalProps {
  classroom: Classroom;
  onClose: () => void;
  // Importa en lote; el padre muestra un único aviso con el resultado.
  onImport: (behaviors: GeneratedBehavior[]) => Promise<void>;
}

const EXAMPLES = [
  { emoji: '✋', title: 'Participación', desc: 'Premiar levantar la mano, responder preguntas, aportar ideas. Penalizar no participar o distraerse.' },
  { emoji: '📝', title: 'Tareas y trabajos', desc: 'Premiar entregas puntuales y trabajos completos. Penalizar tareas incompletas o atrasadas.' },
  { emoji: '🤝', title: 'Convivencia', desc: 'Premiar respeto, ayudar compañeros, trabajo en equipo. Penalizar faltas de respeto o interrupciones.' },
  { emoji: '📱', title: 'Uso de tecnología', desc: 'Premiar buen uso de dispositivos. Penalizar celular sin permiso, distracciones digitales.' },
  { emoji: '🎒', title: 'Organización', desc: 'Premiar traer materiales, orden, puntualidad. Penalizar olvidos, desorden, impuntualidad.' },
  { emoji: '🧪', title: 'Clase práctica', desc: 'Premiar seguir instrucciones, cuidar materiales, limpiar área. Penalizar mal uso de equipos.' },
];

const LEVELS = ['Primaria (6-11 años)', 'Secundaria (12-16 años)', 'Preparatoria/Bachillerato', 'Universidad', 'Formación profesional'];

const POINT_MODES: { value: PointMode; label: string; icon: string; desc: string }[] = [
  { value: 'COMBINED', label: 'Combinado', icon: '🎮', desc: 'XP + HP + GP' },
  { value: 'XP_ONLY', label: 'Solo XP', icon: '⭐', desc: 'Experiencia' },
  { value: 'HP_ONLY', label: 'Solo HP', icon: '❤️', desc: 'Vida' },
  { value: 'GP_ONLY', label: 'Solo GP', icon: '🪙', desc: 'Oro' },
];

const clampCount = (value: number) => Math.min(20, Math.max(5, value || 10));

const QUICK_ICONS = ['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '💔', '⚡', '🔥', '❌'];

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';
const fieldClass = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-400';
const chipClass = (active: boolean) =>
  `rounded-xl border-2 text-left transition-colors ${
    active
      ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
      : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
  }`;

// Genera comportamientos con IA, permite revisarlos/editarlos y los importa en lote.
export const AIBehaviorModal = ({ classroom, onClose, onImport }: AIBehaviorModalProps) => {
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(10);
  const [includePositive, setIncludePositive] = useState(true);
  const [includeNegative, setIncludeNegative] = useState(true);
  const [pointMode, setPointMode] = useState<PointMode>('COMBINED');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedBehavior[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const isPresent = useIsPresent();

  const { competencies = [] } = useClassroomCompetencies(
    classroom.id,
    !!classroom.useCompetencies && !!classroom.curriculumAreaId,
  );
  const competencyName = (id?: string) => competencies.find((c) => c.id === id)?.name;

  const busy = isGenerating || isImporting;
  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !busy && !event.defaultPrevented) onClose();
  }, [isPresent, busy, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const handleGenerate = async () => {
    if (!description.trim() || !level) {
      toast.error('Completa la descripción y el nivel educativo');
      return;
    }
    setIsGenerating(true);
    try {
      const competenciesToSend = classroom.useCompetencies && selectedCompetencies.length > 0
        ? competencies.filter((c) => selectedCompetencies.includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
        : undefined;
      const result = await behaviorApi.generateWithAI({
        description,
        level,
        count: clampCount(count),
        includePositive,
        includeNegative,
        pointMode,
        competencies: competenciesToSend,
      });
      setGenerated(result.behaviors);
      setSelected(new Set(result.behaviors.map((_, i) => i)));
      setEditingIndex(null);
      setStep('preview');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron generar comportamientos'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async () => {
    const toImport = generated.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(toImport);
    } finally {
      setIsImporting(false);
    }
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const update = (index: number, updates: Partial<GeneratedBehavior>) => {
    setGenerated((prev) => prev.map((b, i) => (i === index ? { ...b, ...updates } : b)));
  };

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

  const toggleCompetency = (id: string, checked: boolean) => {
    setSelectedCompetencies((prev) => (checked ? [...prev, id] : prev.filter((c) => c !== id)));
  };

  const pills = (b: GeneratedBehavior) => {
    const sign = b.isPositive ? '+' : '−';
    // Un negativo nunca quita oro: el servidor lo guarda en 0.
    return (b.isPositive ? (['XP', 'HP', 'GP'] as const) : (['XP', 'HP'] as const))
      .map((type) => ({ type, value: type === 'XP' ? b.xpValue : type === 'HP' ? b.hpValue : b.gpValue }))
      .filter((r) => r.value > 0)
      .map((r) => (
        <span key={r.type} className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS[r.type]}`}>
          {sign}{r.value} {r.type}
        </span>
      ));
  };

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
        aria-labelledby="ai-behaviors-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 id="ai-behaviors-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {step === 'form' ? 'Generar comportamientos con IA' : 'Revisa antes de importar'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {step === 'form' ? 'Describe qué quieres premiar y corregir' : `${selected.size} de ${generated.length} seleccionados`}
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
                <span className={labelClass}>Ejemplos rápidos</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example.title}
                      type="button"
                      onClick={() => setDescription(example.desc)}
                      aria-pressed={description === example.desc}
                      className={`${chipClass(description === example.desc)} flex min-h-[44px] items-center gap-2 px-3 py-2`}
                    >
                      <span className="text-lg" aria-hidden="true">{example.emoji}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{example.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="ai-description" className={labelClass}>O escribe tu propia descripción</label>
                <textarea
                  id="ai-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qué acciones quieres premiar y cuáles corregir..."
                  rows={3}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-level" className={labelClass}>Nivel educativo</label>
                  <select id="ai-level" value={level} onChange={(e) => setLevel(e.target.value)} className={`${fieldClass} story-select`}>
                    <option value="">Selecciona...</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ai-count" className={labelClass}>¿Cuántos? <span className="font-normal text-gray-600 dark:text-gray-300">(5 a 20)</span></label>
                  <input
                    id="ai-count"
                    type="number"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                    onBlur={() => setCount(clampCount)}
                    min={5}
                    max={20}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <span className={labelClass}>¿Qué tipo incluir?</span>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={includePositive} onClick={() => setIncludePositive((v) => !v)} className={`${chipClass(includePositive)} flex min-h-[48px] flex-1 items-center gap-2 px-3`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${includePositive ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                      {includePositive && <Check size={13} />}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Para dar puntos</span>
                  </button>
                  <button type="button" aria-pressed={includeNegative} onClick={() => setIncludeNegative((v) => !v)} className={`${chipClass(includeNegative)} flex min-h-[48px] flex-1 items-center gap-2 px-3`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${includeNegative ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                      {includeNegative && <Check size={13} />}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Para quitar puntos</span>
                  </button>
                </div>
              </div>

              <div>
                <span className={labelClass}>¿Qué puntos usar?</span>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {POINT_MODES.map((mode) => (
                    <button key={mode.value} type="button" aria-pressed={pointMode === mode.value} onClick={() => setPointMode(mode.value)} className={`${chipClass(pointMode === mode.value)} p-3`}>
                      <span className="block text-xl" aria-hidden="true">{mode.icon}</span>
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{mode.label}</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-300">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {classroom.useCompetencies && competencies.length > 0 && (
                <div>
                  <span className={labelClass}>
                    Competencias a considerar <span className="font-normal text-gray-600 dark:text-gray-300">(la IA asignará la más adecuada)</span>
                  </span>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-900">
                    {competencies.map((c) => (
                      <label key={c.id} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="checkbox"
                          checked={selectedCompetencies.includes(c.id)}
                          onChange={(e) => toggleCompetency(c.id, e.target.checked)}
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
              {generated.map((b, index) => (
                editingIndex === index ? (
                  <li key={index} className="space-y-3 rounded-xl border-2 border-primary-500 bg-primary-50 p-4 dark:bg-primary-900/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary-800 dark:text-primary-200">Editando</span>
                      <button type="button" onClick={() => remove(index)} aria-label={`Descartar ${b.name}`} title="Descartar" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex gap-1" role="group" aria-label="Tipo">
                        <button type="button" aria-pressed={b.isPositive} onClick={() => update(index, { isPositive: true })} className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${b.isPositive ? 'bg-emerald-700 text-white' : 'bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>Dar</button>
                        <button type="button" aria-pressed={!b.isPositive} onClick={() => update(index, { isPositive: false })} className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${!b.isPositive ? 'bg-red-600 text-white' : 'bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>Quitar</button>
                      </div>
                      <div className="flex flex-wrap gap-1" role="group" aria-label="Icono">
                        {QUICK_ICONS.map((emoji) => (
                          <button key={emoji} type="button" aria-pressed={b.icon === emoji} aria-label={`Icono ${emoji}`} onClick={() => update(index, { icon: emoji })} className={`h-8 w-8 rounded-lg text-base ${b.icon === emoji ? 'bg-primary-100 ring-2 ring-primary-500 dark:bg-primary-900/50' : 'bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input type="text" value={b.name} onChange={(e) => update(index, { name: e.target.value })} aria-label="Nombre" placeholder="Nombre" className={fieldClass} />
                      <input type="text" value={b.description} onChange={(e) => update(index, { description: e.target.value })} aria-label="Descripción" placeholder="Descripción" className={fieldClass} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(b.isPositive
                        ? ([['xpValue', 'XP'], ['hpValue', 'HP'], ['gpValue', 'GP']] as const)
                        : ([['xpValue', 'XP'], ['hpValue', 'HP']] as const)
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {label}
                          <input
                            type="number"
                            min={0}
                            value={b[key]}
                            onChange={(e) => update(index, { [key]: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="h-9 w-16 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          />
                        </label>
                      ))}
                    </div>
                    {classroom.useCompetencies && competencies.length > 0 && (
                      <select
                        value={b.competencyId || ''}
                        onChange={(e) => update(index, { competencyId: e.target.value || undefined })}
                        aria-label="Competencia"
                        className={fieldClass}
                      >
                        <option value="">Sin competencia</option>
                        {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => setEditingIndex(null)} className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700">
                      <Check size={16} aria-hidden="true" /> Listo
                    </button>
                  </li>
                ) : (
                  <li
                    key={index}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                      selected.has(index)
                        ? b.isPositive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(index)}
                      aria-pressed={selected.has(index)}
                      aria-label={`${selected.has(index) ? 'Quitar de la importación' : 'Incluir en la importación'}: ${b.name}`}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${selected.has(index) ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400'}`} aria-hidden="true">
                        {selected.has(index) && <Check size={13} />}
                      </span>
                    </button>
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${b.isPositive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`} aria-hidden="true">
                      {b.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900 dark:text-white">{b.name}</span>
                      {b.description && <span className="block truncate text-xs text-gray-600 dark:text-gray-300">{b.description}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs font-semibold ${b.isPositive ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>{b.isPositive ? 'Dar' : 'Quitar'}</span>
                        {pills(b)}
                        {competencyName(b.competencyId) && (
                          <span className="inline-flex max-w-[12rem] items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" title={competencyName(b.competencyId)}>
                            <Award size={12} className="flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{competencyName(b.competencyId)}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <button type="button" onClick={() => setEditingIndex(index)} aria-label={`Editar ${b.name}`} title="Editar" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white">
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </li>
                )
              ))}
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
                onClick={handleGenerate}
                disabled={!description.trim() || !level || (!includePositive && !includeNegative) || isGenerating}
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
                onClick={handleImport}
                disabled={selected.size === 0 || isImporting}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
              >
                <Check size={16} aria-hidden="true" />
                {isImporting ? 'Importando...' : `Importar ${selected.size}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
