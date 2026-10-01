import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, IdCard, KeyRound, RefreshCw, Type } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, classroomsKey, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { errorMessage, secondaryButton } from '../gradebook/gradebookHelpers';
import { SaveBar, SettingsCard, SwitchRow } from './settingsUi';
import { changedFields, useClassroomSettingsSave, useDraft } from './settingsHooks';

// Configuración > Clase: identidad, código para unirse y cómo se muestran los nombres.
export const ClassSection = ({ classroom }: { classroom: Classroom }) => {
  const { save } = useClassroomSettingsSave(classroom);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <IdentityCard classroom={classroom} />
      <CodeCard classroom={classroom} onToggleAccepting={(v) => save(
        { acceptingStudents: v },
        v ? 'La clase acepta alumnos nuevos' : 'La clase ya no acepta alumnos nuevos',
        true,
      )} />
      <NameDisplayCard classroom={classroom} onChange={(v) => save(
        { showCharacterName: v },
        v ? 'Se muestra el nombre de personaje' : 'Se muestra el nombre real',
        true,
      )} />
    </div>
  );
};

const IdentityCard = ({ classroom }: { classroom: Classroom }) => {
  const { save, saving } = useClassroomSettingsSave(classroom);
  const saved = { name: classroom.name, description: classroom.description ?? '' };
  const { draft, setDraft, dirty, reset, markSaved } = useDraft(saved);
  const nameId = useId();
  const descId = useId();
  const nameError = draft.name.trim().length < 2 ? 'El nombre necesita al menos 2 letras' : null;

  const submit = async () => {
    const changes = changedFields({ name: draft.name.trim(), description: draft.description.trim() }, saved);
    if (Object.keys(changes).length === 0) return reset();
    if (await save(changes, 'Datos de la clase guardados')) markSaved();
  };

  return (
    <SettingsCard
      title="Nombre y descripción"
      icon={Type}
      footer={<SaveBar dirty={dirty} saving={saving} invalid={!!nameError} onSave={submit} onDiscard={reset} />}
    >
      <div className="space-y-3 py-2">
        <div>
          <label htmlFor={nameId} className={labelClass}>Nombre de la clase</label>
          <input id={nameId} type="text" maxLength={255} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-invalid={!!nameError} aria-describedby={nameError ? `${nameId}-e` : undefined} className={`${inputClass} mt-1.5`} />
          {nameError && <p id={`${nameId}-e`} className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">{nameError}</p>}
        </div>
        <div>
          <label htmlFor={descId} className={labelClass}>Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
          <textarea id={descId} rows={2} maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={`${inputClass} mt-1.5 resize-none`} />
        </div>
      </div>
    </SettingsCard>
  );
};

const CodeCard = ({ classroom, onToggleAccepting }: { classroom: Classroom; onToggleAccepting: (v: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const accepting = classroom.acceptingStudents !== false;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(classroom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Selecciona el código y cópialo a mano.');
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const code = await classroomApi.regenerateCode(classroom.id);
      queryClient.setQueryData<Classroom>(['classroom', classroom.id], (old) => (old ? { ...old, code } : old));
      void queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      void queryClient.invalidateQueries({ queryKey: classroomsKey });
      toast.success(`Código nuevo: ${code}`);
      setConfirming(false);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo generar el código'));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <SettingsCard title="Código para unirse" icon={KeyRound} description="Los alumnos lo escriben en su cuenta para entrar a la clase.">
      <div className="flex flex-wrap items-center gap-2 py-3">
        <span className="rounded-xl bg-gray-100 px-4 py-2 font-mono text-xl font-bold tracking-widest text-gray-900 dark:bg-gray-700 dark:text-white" aria-label={`Código de la clase: ${classroom.code.split('').join(' ')}`}>
          {classroom.code}
        </span>
        <button type="button" onClick={copy} className={secondaryButton}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>
          <RefreshCw size={16} aria-hidden="true" /> Generar otro
        </button>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700">
        <SwitchRow
          title="Aceptar alumnos nuevos"
          description={accepting ? 'Cualquiera con el código puede unirse.' : 'Nadie puede unirse con el código. Los alumnos que ya están siguen igual.'}
          checked={accepting}
          onChange={onToggleAccepting}
        />
      </div>
      {confirming && (
        <HomeModal
          title="¿Generar un código nuevo?"
          subtitle={classroom.name}
          onClose={regenerating ? () => undefined : () => setConfirming(false)}
          footer={<>
            <button type="button" onClick={() => setConfirming(false)} disabled={regenerating} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={regenerate} disabled={regenerating} className={primaryButton} data-autofocus>{regenerating ? 'Generando…' : 'Generar código nuevo'}</button>
          </>}
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">
            El código <strong className="font-mono">{classroom.code}</strong> dejará de servir para unirse. Úsalo si se compartió con quien no debía.
            Los alumnos que ya están en la clase no se ven afectados.
          </p>
        </HomeModal>
      )}
    </SettingsCard>
  );
};

const NameDisplayCard = ({ classroom, onChange }: { classroom: Classroom; onChange: (v: boolean) => void }) => {
  const groupId = useId();
  const options = [
    { value: true, title: 'Nombre de personaje', example: 'Ej.: «Gandalf el Sabio»', icon: '🧙' },
    { value: false, title: 'Nombre real', example: 'Ej.: «Juan Pérez»', icon: '🧑‍🎓' },
  ];
  const current = classroom.showCharacterName !== false;
  return (
    <SettingsCard title="Cómo se muestran los nombres" icon={IdCard} description="En la Lista, rankings y pantallas que ve la clase.">
      <div role="radiogroup" aria-labelledby={`${groupId}-l`} className="grid gap-2 py-3 sm:grid-cols-2">
        <span id={`${groupId}-l`} className="sr-only">Mostrar nombre como</span>
        {options.map((option) => {
          const selected = current === option.value;
          return (
            <label key={option.title} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${selected ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'}`}>
              <input type="radio" name={`${groupId}-name`} checked={selected} onChange={() => onChange(option.value)} className="h-4 w-4 accent-primary-600" />
              <span className="text-xl" aria-hidden="true">{option.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{option.title}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{option.example}</span>
              </span>
            </label>
          );
        })}
      </div>
    </SettingsCard>
  );
};
