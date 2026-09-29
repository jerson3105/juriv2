import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { Award, BookOpen, Coins, Heart, Sparkles, X, type LucideIcon } from 'lucide-react';
import { EmojiPicker } from '../ui/EmojiPicker';
import type { Classroom } from '../../lib/classroomApi';
import type { Behavior, CreateBehaviorData, PointType } from '../../lib/behaviorApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { useClassroomCompetencies } from '../../hooks/useClassroomCompetencies';
import { SingleSelectCombobox } from './SingleSelectCombobox';

export type BehaviorFormData = Omit<CreateBehaviorData, 'classroomId'>;

export type BehaviorFormTarget =
  | { kind: 'create'; isPositive: boolean; template?: Behavior }
  | { kind: 'edit'; behavior: Behavior };

interface BehaviorFormModalProps {
  target: BehaviorFormTarget;
  classroom: Classroom;
  isSaving: boolean;
  onClose: () => void;
  // Devuelve true si se guardó; con `another` el modal queda abierto y limpio para crear otro.
  onSubmit: (data: BehaviorFormData, another: boolean) => Promise<boolean>;
}

type Values = { xp: number; hp: number; gp: number };

const PRESETS = [5, 10, 15, 20];
const MAX_POINTS = 1000;

const POINT_FIELDS: { key: keyof Values; type: PointType; label: string; icon: LucideIcon; iconClass: string; activeClass: string }[] = [
  { key: 'xp', type: 'XP', label: 'Experiencia', icon: Sparkles, iconClass: 'text-emerald-700 dark:text-emerald-300', activeClass: 'border-emerald-700 bg-emerald-700 text-white' },
  { key: 'hp', type: 'HP', label: 'Vida', icon: Heart, iconClass: 'text-red-700 dark:text-red-300', activeClass: 'border-red-600 bg-red-600 text-white' },
  { key: 'gp', type: 'GP', label: 'Oro', icon: Coins, iconClass: 'text-amber-700 dark:text-amber-300', activeClass: 'border-amber-700 bg-amber-700 text-white' },
];

// Un comportamiento nuevo arranca con valores razonables según su tipo.
const defaultsFor = (isPositive: boolean): { icon: string; values: Values } =>
  isPositive ? { icon: '⭐', values: { xp: 10, hp: 0, gp: 0 } } : { icon: '💔', values: { xp: 0, hp: 5, gp: 0 } };

const initialState = (target: BehaviorFormTarget) => {
  const source = target.kind === 'edit' ? target.behavior : target.template;
  if (source) {
    return {
      isPositive: source.isPositive,
      name: target.kind === 'edit' ? source.name : `${source.name} (copia)`,
      description: source.description || '',
      icon: source.icon || defaultsFor(source.isPositive).icon,
      values: { xp: source.xpValue || 0, hp: source.hpValue || 0, gp: source.gpValue || 0 },
      competencyId: source.competencyId || null,
      competencyIndicatorId: source.competencyIndicatorId || null,
      touched: true,
    };
  }
  const isPositive = target.kind === 'create' ? target.isPositive : true;
  return {
    isPositive,
    name: '',
    description: '',
    ...defaultsFor(isPositive),
    competencyId: null as string | null,
    competencyIndicatorId: null as string | null,
    touched: false,
  };
};

const primaryType = ({ xp, hp, gp }: Values): PointType => {
  if (xp >= hp && xp >= gp) return 'XP';
  if (hp >= gp) return 'HP';
  return 'GP';
};

export const BehaviorFormModal = ({ target, classroom, isSaving, onClose, onSubmit }: BehaviorFormModalProps) => {
  const isEdit = target.kind === 'edit';
  const [form, setForm] = useState(() => initialState(target));
  const nameRef = useRef<HTMLInputElement>(null);
  const isPresent = useIsPresent();

  const { competencies = [] } = useClassroomCompetencies(
    classroom.id,
    !!classroom.useCompetencies && !!classroom.curriculumAreaId,
  );
  const selectedCompetency = competencies.find((item) => item.id === form.competencyId);
  const indicators = selectedCompetency?.indicators || [];

  const { values } = form;
  const hasAnyValue = values.xp > 0 || values.hp > 0 || values.gp > 0;
  const canSave = form.name.trim().length > 0 && hasAnyValue && !isSaving;
  const sign = form.isPositive ? '+' : '−';

  // Esc cierra; se ignora si lo atendió otro control (buscador de competencias, selector de iconos).
  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isPresent || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('[aria-label="Selector de iconos"]')) return;
    onClose();
  }, [isPresent, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const setType = (isPositive: boolean) => {
    setForm((current) => {
      if (current.isPositive === isPositive) return current;
      // Si aún no se tocaron puntos ni icono, se cambian los valores por defecto del nuevo tipo.
      return current.touched || isEdit ? { ...current, isPositive } : { ...current, isPositive, ...defaultsFor(isPositive) };
    });
  };

  const setValue = (key: keyof Values, value: number) => {
    const clean = Math.min(MAX_POINTS, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
    setForm((current) => ({ ...current, touched: true, values: { ...current.values, [key]: clean } }));
  };

  const submit = async (another: boolean) => {
    if (!canSave) return;
    const type = primaryType(values);
    const saved = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      pointType: type,
      pointValue: type === 'XP' ? values.xp : type === 'HP' ? values.hp : values.gp,
      xpValue: values.xp,
      hpValue: values.hp,
      gpValue: values.gp,
      isPositive: form.isPositive,
      icon: form.icon,
      competencyId: form.competencyId,
      competencyIndicatorId: form.competencyIndicatorId,
    }, another);
    if (saved && another) {
      setForm({ ...initialState({ kind: 'create', isPositive: form.isPositive }) });
      nameRef.current?.focus();
    }
  };

  const typeButton = (positive: boolean) => {
    const active = form.isPositive === positive;
    const activeClass = positive ? 'border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-700/25' : 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25';
    return (
      <button
        type="button"
        onClick={() => setType(positive)}
        aria-pressed={active}
        className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition-colors ${
          active ? activeClass : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:hover:border-gray-500'
        }`}
      >
        <span aria-hidden="true">{positive ? '+' : '−'}</span>
        {positive ? 'Dar puntos' : 'Quitar puntos'}
      </button>
    );
  };

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
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="behavior-form-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 id="behavior-form-title" className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Editar comportamiento' : 'Nuevo comportamiento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex gap-2" role="group" aria-label="Tipo de comportamiento">
            {typeButton(true)}
            {typeButton(false)}
          </div>

          <div className="flex items-end gap-3">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">Icono</span>
              <EmojiPicker
                value={form.icon}
                onChange={(icon) => setForm((current) => ({ ...current, icon, touched: true }))}
                ariaLabel="Cambiar icono del comportamiento"
                triggerClassName={`flex h-12 w-14 items-center justify-center rounded-xl border-2 text-2xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  form.isPositive
                    ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50'
                    : 'border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="behavior-name" className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">
                Nombre
              </label>
              <input
                id="behavior-name"
                ref={nameRef}
                type="text"
                maxLength={255}
                autoFocus
                placeholder={form.isPositive ? 'Ej: Participación' : 'Ej: Interrumpe la clase'}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              Puntos que {form.isPositive ? 'da' : 'quita'} <span className="font-normal text-gray-600 dark:text-gray-300">(puedes combinar)</span>
            </legend>
            <div className="space-y-2">
              {POINT_FIELDS.map((field) => {
                const current = values[field.key];
                return (
                  <div key={field.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                    <span className="order-1 flex flex-1 items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 sm:w-28 sm:flex-none">
                      <field.icon size={16} className={field.iconClass} aria-hidden="true" />
                      {field.label}
                    </span>
                    <span className="order-3 grid w-full grid-cols-4 gap-1.5 sm:order-2 sm:flex sm:w-auto sm:flex-1">
                      {PRESETS.map((preset) => {
                        const active = current === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setValue(field.key, active ? 0 : preset)}
                            aria-pressed={active}
                            aria-label={`${sign}${preset} ${field.label}`}
                            className={`min-h-[36px] min-w-[44px] rounded-lg border px-2 text-sm font-bold transition-colors ${
                              active ? field.activeClass : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500'
                            }`}
                          >
                            {sign}{preset}
                          </button>
                        );
                      })}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_POINTS}
                      value={current}
                      onChange={(event) => setValue(field.key, event.target.valueAsNumber)}
                      onFocus={(event) => event.target.select()}
                      aria-label={`${field.label}: valor exacto`}
                      className="order-2 h-9 w-16 rounded-lg border border-gray-300 bg-white text-center sm:order-3 text-sm font-bold text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">Toca otra vez un valor marcado para quitarlo.</p>
          </fieldset>

          <div>
            <label htmlFor="behavior-description" className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">
              Descripción <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span>
            </label>
            <textarea
              id="behavior-description"
              rows={2}
              maxLength={500}
              placeholder="Qué acción se reconoce o se corrige"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void submit(false);
                }
              }}
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>

          {classroom.useCompetencies && competencies.length > 0 && (
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <Award size={15} className="text-violet-700 dark:text-violet-300" aria-hidden="true" />
                  Competencia <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span>
                </span>
                <SingleSelectCombobox
                  id="behavior-competency"
                  label="Competencia"
                  options={competencies}
                  value={form.competencyId}
                  onChange={(competencyId) => {
                    const keepIndicator = competencies
                      .find((competency) => competency.id === competencyId)
                      ?.indicators?.some((indicator) => indicator.id === form.competencyIndicatorId);
                    setForm((current) => ({ ...current, competencyId, competencyIndicatorId: keepIndicator ? current.competencyIndicatorId : null }));
                  }}
                  emptyOptionLabel="Sin competencia"
                  searchPlaceholder="Buscar competencia..."
                  noResultsLabel="No se encontraron competencias."
                />
              </div>
              {form.competencyId && indicators.length > 0 && (
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <BookOpen size={15} className="text-sky-700 dark:text-sky-300" aria-hidden="true" />
                    Destreza <span className="font-normal text-gray-600 dark:text-gray-300">(opcional)</span>
                  </span>
                  <SingleSelectCombobox
                    id="behavior-competency-indicator"
                    label="Destreza"
                    options={indicators}
                    value={form.competencyIndicatorId}
                    onChange={(competencyIndicatorId) => setForm((current) => ({ ...current, competencyIndicatorId }))}
                    emptyOptionLabel="Sin destreza"
                    searchPlaceholder="Buscar destreza..."
                    noResultsLabel="No se encontraron destrezas."
                    openUpward
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-gray-100">Así se verá al dar puntos</span>
            <div
              className={`flex min-h-[56px] items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 ${
                form.isPositive ? 'border-emerald-300 dark:border-emerald-700' : 'border-red-300 dark:border-red-700'
              }`}
              aria-hidden="true"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="text-2xl">{form.icon}</span>
                <span className={`truncate font-medium ${form.name.trim() ? 'text-gray-900 dark:text-white' : 'italic text-gray-600 dark:text-gray-400'}`}>
                  {form.name.trim() || 'Nombre del comportamiento'}
                </span>
              </span>
              <span className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                {POINT_FIELDS.filter((field) => values[field.key] > 0).map((field) => (
                  <span key={field.key} className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS[field.type]}`}>
                    {sign}{values[field.key]} {field.type}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          {!canSave && !isSaving && (
            <p className="mb-2 text-xs text-gray-700 dark:text-gray-300" role="status">
              {!form.name.trim() ? 'Escribe un nombre para guardar.' : 'Elige al menos un valor de puntos.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={!canSave}
                className="min-h-[44px] rounded-xl border-2 border-primary-600 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-500 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/30 dark:disabled:border-gray-600 dark:disabled:text-gray-400"
              >
                Guardar y crear otro
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
