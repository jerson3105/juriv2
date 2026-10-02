import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Award, Hand, ImagePlus, Lock, Sparkles, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmojiPicker } from '../ui/EmojiPicker';
import { SingleSelectCombobox } from '../behaviors/SingleSelectCombobox';
import { RARITY_LABELS, badgeApi, badgeImageUrl, type Badge, type BadgeAssignment, type BadgeCondition, type BadgeRarity, type CreateBadgeDto } from '../../lib/badgeApi';
import { behaviorApi } from '../../lib/behaviorApi';
import type { Classroom } from '../../lib/classroomApi';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';
import { BadgeMedallion } from './BadgeMedallion';
import { GRADE_WEIGHT, RARITY_ORDER, RARITY_STYLE, conditionText, parseCondition, rewardPreset } from './badgeHelpers';

export type BadgeFormTarget = { kind: 'create'; template?: Badge } | { kind: 'edit'; badge: Badge };

interface BadgeFormModalProps {
  target: BadgeFormTarget;
  classroom: Classroom;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBadgeDto, another: boolean) => Promise<boolean>;
}

type ConditionType = 'BEHAVIOR_COUNT' | 'BEHAVIOR_CATEGORY' | 'XP_TOTAL' | 'LEVEL';

// Las insignias reconocen logros: solo comportamientos positivos (el servidor rechaza los negativos).
const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'BEHAVIOR_COUNT', label: 'reciba un comportamiento positivo concreto' },
  { value: 'BEHAVIOR_CATEGORY', label: 'reciba comportamientos positivos (cualquiera)' },
  { value: 'XP_TOTAL', label: 'junte XP' },
  { value: 'LEVEL', label: 'llegue a un nivel' },
];

const MODES: { value: BadgeAssignment; label: string; hint: string; icon: typeof Hand }[] = [
  { value: 'MANUAL', label: 'La doy yo', hint: 'Se puede ganar varias veces', icon: Hand },
  { value: 'AUTOMATIC', label: 'Sola', hint: 'Al cumplir una condición, una vez', icon: Zap },
  { value: 'BOTH', label: 'Ambas', hint: 'Sola o cuando tú la des', icon: Sparkles },
];

const MAX_REWARD = 1000;

const initialState = (target: BadgeFormTarget, xpPerLevel?: number) => {
  const source = target.kind === 'edit' ? target.badge : target.template;
  const condition = parseCondition(source?.unlockCondition);
  // «Cualquier comportamiento» y la categoría ya solo cuentan positivos: se editan como «positivos (cualquiera)».
  const type = condition?.type === 'ANY_BEHAVIOR' ? 'BEHAVIOR_CATEGORY' : condition?.type;
  const known = !!type && CONDITION_OPTIONS.some((o) => o.value === type);
  const preset = rewardPreset('COMMON', xpPerLevel);
  return {
    name: source ? (target.kind === 'edit' ? source.name : `${source.name} (copia)`) : '',
    description: source?.description ?? '',
    icon: source?.icon || '🏆',
    customImage: source?.customImage ?? null,
    rarity: (source?.rarity ?? 'COMMON') as BadgeRarity,
    assignmentMode: (source?.assignmentMode ?? 'MANUAL') as BadgeAssignment,
    rewardXp: source?.rewardXp ?? preset.xp,
    rewardGp: source?.rewardGp ?? preset.gp,
    rewardsTouched: !!source,
    isSecret: source?.isSecret ?? false,
    competencyId: source?.competencyId ?? null,
    conditionType: (known ? type : 'BEHAVIOR_COUNT') as ConditionType,
    behaviorId: condition?.behaviorId ?? '',
    amount: condition?.count ?? condition?.value ?? 5,
  };
};

type FormState = ReturnType<typeof initialState>;

const buildCondition = (form: FormState): BadgeCondition | null => {
  if (form.assignmentMode === 'MANUAL') return null;
  const amount = Math.max(1, Math.round(form.amount || 1));
  switch (form.conditionType) {
    case 'BEHAVIOR_COUNT':
      return form.behaviorId ? { type: 'BEHAVIOR_COUNT', behaviorId: form.behaviorId, count: amount } : null;
    case 'BEHAVIOR_CATEGORY':
      return { type: 'BEHAVIOR_CATEGORY', category: 'positive', count: amount };
    case 'XP_TOTAL':
      return { type: 'XP_TOTAL', value: amount };
    case 'LEVEL':
      return { type: 'LEVEL', value: amount };
    default:
      return null;
  }
};

const fieldClass = 'h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100';

export const BadgeFormModal = ({ target, classroom, isSaving, onClose, onSubmit }: BadgeFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const [form, setForm] = useState(() => initialState(target, classroom.xpPerLevel));
  const [isUploading, setIsUploading] = useState(false);
  // Imagen que no carga (archivo borrado): se ve el emoji y se puede quitar.
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const isPresent = useIsPresent();

  const { data: behaviors = [], isSuccess: behaviorsLoaded } = useQuery({
    queryKey: ['behaviors', classroom.id],
    queryFn: () => behaviorApi.getByClassroom(classroom.id),
  });
  const positiveBehaviors = behaviors.filter((b) => b.isPositive);
  const { competencies = [] } = useClassroomCompetencies(classroom.id, !!classroom.useCompetencies && !!classroom.curriculumAreaId);

  // Una insignia vieja que citaba un comportamiento negativo (o uno que ya no existe): hay que elegir otro.
  useEffect(() => {
    if (!behaviorsLoaded) return;
    setForm((current) => (current.behaviorId && !behaviors.some((b) => b.id === current.behaviorId && b.isPositive)
      ? { ...current, behaviorId: '' }
      : current));
  }, [behaviorsLoaded, behaviors]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const condition = buildCondition(form);
  const needsCondition = form.assignmentMode !== 'MANUAL';
  const conditionMissing = needsCondition && !condition;
  const canSave = form.name.trim().length > 0 && !conditionMissing && !isSaving && !isUploading;
  const preset = rewardPreset(form.rarity, classroom.xpPerLevel);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isPresent || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('[aria-label="Selector de iconos"]')) return;
    onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const setRarity = (rarity: BadgeRarity) => {
    const next = rewardPreset(rarity, classroom.xpPerLevel);
    setForm((current) => current.rewardsTouched
      ? { ...current, rarity }
      : { ...current, rarity, rewardXp: next.xp, rewardGp: next.gp });
  };

  const setReward = (key: 'rewardXp' | 'rewardGp', value: number) => {
    const clean = Math.min(MAX_REWARD, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
    setForm((current) => ({ ...current, [key]: clean, rewardsTouched: true }));
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await badgeApi.uploadBadgeImage(file);
      set('customImage', url);
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async (another: boolean) => {
    if (!canSave) return;
    const saved = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon || '🏆',
      customImage: form.customImage,
      rarity: form.rarity,
      assignmentMode: form.assignmentMode,
      unlockCondition: condition,
      rewardXp: form.rewardXp,
      rewardGp: form.rewardGp,
      isSecret: form.isSecret,
      competencyId: form.competencyId,
    }, another);
    if (saved && another) {
      setForm(initialState({ kind: 'create' }, classroom.xpPerLevel));
      nameRef.current?.focus();
    }
  };

  const preview = { name: form.name || 'Nombre de la insignia', icon: form.icon, customImage: form.customImage, rarity: form.rarity };
  const conditionPreview = conditionText(condition, behaviors);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-form-title"
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        {/* Vista previa en vivo: así la verán los estudiantes */}
        <div className={`relative flex items-center gap-4 border-b-2 bg-gradient-to-b to-white px-5 py-4 dark:to-gray-800 ${RARITY_STYLE[form.rarity].tile}`}>
          <BadgeMedallion badge={preview} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id="badge-form-title" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {isEdit ? 'Editar insignia' : 'Nueva insignia'}
            </h2>
            <p className={`truncate text-xl font-black ${form.name ? 'text-gray-900 dark:text-white' : 'italic text-gray-600 dark:text-gray-400'}`}>{preview.name}</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${RARITY_STYLE[form.rarity].chip}`}>{RARITY_LABELS[form.rarity]}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-lg text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex items-end gap-3">
            <div>
              <span className={labelClass}>Icono</span>
              {form.customImage ? (
                <button
                  type="button"
                  onClick={() => set('customImage', null)}
                  className="relative flex h-11 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-gray-300 dark:border-gray-600"
                  aria-label="Quitar imagen y volver al emoji"
                  title="Quitar imagen"
                >
                  {brokenImage === form.customImage
                    ? <span className="text-2xl" aria-hidden="true">{form.icon}</span>
                    : <img src={badgeImageUrl(form.customImage)} alt="" onError={() => setBrokenImage(form.customImage)} className="h-full w-full object-cover" />}
                </button>
              ) : (
                <EmojiPicker
                  value={form.icon}
                  onChange={(icon) => set('icon', icon)}
                  ariaLabel="Cambiar icono de la insignia"
                  triggerClassName="flex h-11 w-14 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-2xl hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="badge-name" className={labelClass}>Nombre</label>
              <input
                id="badge-name"
                ref={nameRef}
                type="text"
                maxLength={100}
                autoFocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ej: Lector del mes"
                className={fieldClass}
              />
            </div>
            <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700" title="Subir imagen propia (PNG, JPG, GIF o WEBP, máx. 2 MB)">
              <ImagePlus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{isUploading ? 'Subiendo...' : 'Imagen'}</span>
              <span className="sr-only sm:hidden">Subir imagen</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div>
            <span className={labelClass}>Rareza</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Rareza">
              {RARITY_ORDER.map((rarity) => {
                const active = form.rarity === rarity;
                return (
                  <button
                    key={rarity}
                    type="button"
                    onClick={() => setRarity(rarity)}
                    aria-pressed={active}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-bold transition-colors ${
                      active ? `${RARITY_STYLE[rarity].tile} bg-gradient-to-b to-white text-gray-900 dark:to-gray-800 dark:text-white` : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${RARITY_STYLE[rarity].disc}`} aria-hidden="true" />
                    {RARITY_LABELS[rarity]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className={labelClass}>¿Cómo se gana?</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cómo se gana">
              {MODES.map((mode) => {
                const active = form.assignmentMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => set('assignmentMode', mode.value)}
                    aria-pressed={active}
                    className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-2 text-center transition-colors ${
                      active ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                      <mode.icon size={16} aria-hidden="true" />
                      {mode.label}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{mode.hint}</span>
                  </button>
                );
              })}
            </div>

            {needsCondition && (
              <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
                <label htmlFor="badge-condition" className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Se gana sola cuando el estudiante…</label>
                <select
                  id="badge-condition"
                  value={form.conditionType}
                  onChange={(e) => set('conditionType', e.target.value as ConditionType)}
                  className={`${fieldClass} story-select`}
                >
                  {CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <div className="flex flex-wrap items-center gap-2">
                  {form.conditionType === 'BEHAVIOR_COUNT' && (
                    <select
                      value={form.behaviorId}
                      onChange={(e) => set('behaviorId', e.target.value)}
                      aria-label="Comportamiento"
                      className={`${fieldClass} story-select min-w-0 flex-1`}
                    >
                      <option value="">Elige el comportamiento…</option>
                      {positiveBehaviors.map((b) => (
                        <option key={b.id} value={b.id}>{b.icon ? `${b.icon} ` : ''}{b.name}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    {form.conditionType === 'XP_TOTAL' ? 'XP' : form.conditionType === 'LEVEL' ? 'Nivel' : 'Veces'}
                    <input
                      type="number"
                      min={1}
                      value={form.amount}
                      onChange={(e) => set('amount', parseInt(e.target.value) || 0)}
                      onBlur={() => set('amount', Math.max(1, form.amount || 1))}
                      className="h-11 w-24 rounded-xl border border-gray-300 bg-white px-3 text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </label>
                </div>
                <p className={`text-sm ${conditionMissing ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-200'}`} role="status">
                  {conditionMissing ? 'Elige un comportamiento positivo para completar la condición.' : `Se otorgará ${conditionPreview}.`}
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Recompensa al ganarla</span>
              {(form.rewardXp !== preset.xp || form.rewardGp !== preset.gp) && (
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, rewardXp: preset.xp, rewardGp: preset.gp, rewardsTouched: true }))}
                  className="min-h-[32px] rounded-lg px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30"
                >
                  Usar la sugerida para {RARITY_LABELS[form.rarity].toLowerCase()}: +{preset.xp} XP · +{preset.gp} oro
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['rewardXp', 'rewardGp'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
                  {key === 'rewardXp' ? 'XP' : 'Oro'}
                  <input
                    type="number"
                    min={0}
                    max={MAX_REWARD}
                    value={form[key]}
                    onChange={(e) => setReward(key, e.target.valueAsNumber)}
                    onFocus={(e) => e.target.select()}
                    className="ml-auto h-9 w-20 rounded-lg border border-gray-300 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            {/* La que das tú: decir cuándo la das es lo que el alumno lee en «Mis insignias» para saber cómo ganarla. */}
            <label htmlFor="badge-description" className={labelClass}>
              {form.assignmentMode === 'AUTOMATIC' ? 'Descripción' : '¿Cuándo la das?'}{' '}
              <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, la verán los estudiantes)</span>
            </label>
            <textarea
              id="badge-description"
              rows={2}
              maxLength={255}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void submit(false);
                }
              }}
              placeholder={form.assignmentMode === 'AUTOMATIC' ? 'Qué logro reconoce' : 'Ej.: cuando explicas a un compañero cómo lo resolviste'}
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
            <input
              type="checkbox"
              checked={form.isSecret}
              onChange={(e) => set('isSecret', e.target.checked)}
              className="h-5 w-5 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                <Lock size={14} aria-hidden="true" />
                Secreta
              </span>
              <span className="block text-xs text-gray-700 dark:text-gray-300">Los estudiantes no la ven hasta ganarla</span>
            </span>
          </label>

          {classroom.useCompetencies && competencies.length > 0 && (
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                <Award size={15} className="text-violet-700 dark:text-violet-300" aria-hidden="true" />
                Competencia <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span>
              </span>
              <SingleSelectCombobox
                id="badge-competency"
                label="Competencia"
                options={competencies}
                value={form.competencyId}
                onChange={(value) => set('competencyId', value)}
                emptyOptionLabel="Sin competencia"
                searchPlaceholder="Buscar competencia..."
                noResultsLabel="No se encontraron competencias."
                openUpward
              />
              <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
                {form.competencyId
                  ? `Cuenta para la nota de esta competencia: en cada periodo suma la insignia de mayor rareza que gane el estudiante (pesa ${GRADE_WEIGHT.COMMON} si es común, ${GRADE_WEIGHT.RARE} rara, ${GRADE_WEIGHT.EPIC} épica y ${GRADE_WEIGHT.LEGENDARY} legendaria).`
                  : 'Si eliges una, la insignia cuenta para la nota de esa competencia.'}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {!canSave && !isSaving && !isUploading && (
            <p className="mb-2 text-xs text-gray-700 dark:text-gray-300" role="status">
              {!form.name.trim() ? 'Escribe un nombre para guardar.' : 'Completa la condición para guardar.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={!canSave}
                className="min-h-[44px] rounded-xl border-2 border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-500 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/30 dark:disabled:border-gray-600 dark:disabled:text-gray-400"
              >
                Guardar y crear otra
              </button>
            )}
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-[44px] rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
            >
              {isSaving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
};
