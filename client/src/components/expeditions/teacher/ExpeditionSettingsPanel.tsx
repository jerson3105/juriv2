import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { NumberField, SaveBar } from '../../settings/settingsUi';
import { inputClass, labelClass } from '../../home/homeHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { badgeApi } from '../../../lib/badgeApi';
import { expeditionMapApi } from '../../../lib/expeditionMapApi';
import { assetUrl, expeditionApi, expeditionKeys, type ExpeditionPatch, type ExpeditionScenario, type TeacherExpedition } from '../../../lib/expeditionApi';
import { ExpeditionThumb } from '../ExpeditionStage';
import { MAX_REWARD, constellationsFor, fromLocalInput, stageConstellation, toLocalInput } from '../expeditionHelpers';

interface Draft {
  name: string;
  description: string;
  closingText: string;
  finishXp: string;
  finishGold: string;
  scenario: ExpeditionScenario;
  constellationId: string;
  mapImageUrl: string | null;
  finishBadgeId: string | null;
  perseveranceBadgeId: string | null;
  groupMode: 'INDIVIDUAL' | 'CLAN';
  clanXp: string;
  goalOn: boolean;
  goalPercent: string;
  goalXp: string;
  goalDueAt: string;
}

const toDraft = (expedition: TeacherExpedition): Draft => ({
  name: expedition.name,
  description: expedition.description ?? '',
  closingText: expedition.closingText ?? '',
  finishXp: String(expedition.finishXp),
  finishGold: String(expedition.finishGold),
  scenario: expedition.scenario,
  constellationId: stageConstellation(expedition.constellationId, expedition.stops.length).id,
  mapImageUrl: expedition.mapImageUrl,
  finishBadgeId: expedition.finishBadgeId,
  perseveranceBadgeId: expedition.perseveranceBadgeId,
  groupMode: expedition.groupMode,
  clanXp: String(expedition.clanXp),
  goalOn: expedition.goalPercent !== null,
  // Sin meta todavía: arranca con lo sugerido (70 % y 10 XP).
  goalPercent: String(expedition.goalPercent ?? 70),
  goalXp: String(expedition.goalPercent !== null ? expedition.goalXp : 10),
  goalDueAt: toLocalInput(expedition.goalDueAt),
});

const numberError = (value: string) => {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n)) return 'Escribe un número entero';
  return n < 0 || n > MAX_REWARD ? `Entre 0 y ${MAX_REWARD}` : null;
};
const percentError = (value: string) => {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n)) return 'Escribe un número entero';
  return n < 10 || n > 100 ? 'Entre 10 y 100' : null;
};

/** Ajustes de la expedición. El padre lo monta con key={settingsPanelKey(expedition)}. */
export const ExpeditionSettingsPanel = ({ expedition, xpPerLevel, clansEnabled }: { expedition: TeacherExpedition; xpPerLevel: number; clansEnabled: boolean }) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(expedition));
  const maps = useQuery({ queryKey: ['expedition-maps-active'], queryFn: expeditionMapApi.getActive, enabled: draft.scenario === 'MAP' });
  const badges = useQuery({ queryKey: ['badges', expedition.classroomId], queryFn: () => badgeApi.getClassroomBadges(expedition.classroomId) });
  // Solo las insignias activas de esta clase (las del sistema no se otorgan desde aquí).
  const classBadges = (badges.data ?? []).filter((badge) => badge.classroomId === expedition.classroomId && badge.isActive);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const patch = useMemo(() => {
    const base = toDraft(expedition);
    const next: ExpeditionPatch = {};
    if (draft.name !== base.name) next.name = draft.name;
    if (draft.description !== base.description) next.description = draft.description.trim() || null;
    if (draft.closingText !== base.closingText) next.closingText = draft.closingText.trim() || null;
    if (draft.finishXp !== base.finishXp) next.finishXp = Number(draft.finishXp);
    if (draft.finishGold !== base.finishGold) next.finishGold = Number(draft.finishGold);
    if (draft.scenario !== base.scenario) next.scenario = draft.scenario;
    if (draft.constellationId !== base.constellationId) next.constellationId = draft.constellationId;
    if (draft.mapImageUrl !== base.mapImageUrl) next.mapImageUrl = draft.mapImageUrl;
    if (draft.finishBadgeId !== base.finishBadgeId) next.finishBadgeId = draft.finishBadgeId;
    if (draft.perseveranceBadgeId !== base.perseveranceBadgeId) next.perseveranceBadgeId = draft.perseveranceBadgeId;
    if (draft.groupMode !== base.groupMode) next.groupMode = draft.groupMode;
    if (draft.groupMode === 'CLAN' && draft.clanXp !== base.clanXp) next.clanXp = Number(draft.clanXp);
    // Meta de la clase: al activarla se mandan sus valores; al quitarla, sin porcentaje.
    if (!draft.goalOn && base.goalOn) next.goalPercent = null;
    if (draft.goalOn) {
      const turnedOn = !base.goalOn;
      if (turnedOn || draft.goalPercent !== base.goalPercent) next.goalPercent = Number(draft.goalPercent);
      if (turnedOn || draft.goalXp !== base.goalXp) next.goalXp = Number(draft.goalXp);
      if ((turnedOn && draft.goalDueAt) || draft.goalDueAt !== base.goalDueAt) next.goalDueAt = fromLocalInput(draft.goalDueAt);
    }
    return next;
  }, [draft, expedition]);
  const dirty = Object.keys(patch).length > 0;
  const xpError = numberError(draft.finishXp);
  const goldError = numberError(draft.finishGold);
  const clanXpError = draft.groupMode === 'CLAN' ? numberError(draft.clanXp) : null;
  const goalPercentError = draft.goalOn ? percentError(draft.goalPercent) : null;
  const goalXpError = draft.goalOn ? numberError(draft.goalXp) : null;
  const invalid = !draft.name.trim() || !!xpError || !!goldError || !!clanXpError || !!goalPercentError || !!goalXpError
    || (draft.scenario === 'MAP' && !draft.mapImageUrl);

  const save = useMutation({
    mutationFn: () => expeditionApi.update(expedition.id, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(expeditionKeys.detail(expedition.id), data);
      void queryClient.invalidateQueries({ queryKey: expeditionKeys.list(expedition.classroomId) });
      toast.success('Cambios guardados');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron guardar los cambios')),
  });

  const options = constellationsFor(expedition.stops.length);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Nombre</span>
        <input value={draft.name} onChange={(event) => set('name', event.target.value)} maxLength={120} className={`${inputClass} mt-1.5 min-h-[44px]`} />
      </label>
      <label className="block">
        <span className={labelClass}>Lo que cuenta Jiro al empezar <span className="font-normal text-gray-700 dark:text-gray-300">(también en la tarjeta)</span></span>
        <textarea value={draft.description} onChange={(event) => set('description', event.target.value)} rows={2} maxLength={1000} className={`${inputClass} mt-1.5`} />
      </label>
      <label className="block">
        <span className={labelClass}>Lo que dice Jiro al llegar a la meta</span>
        <textarea value={draft.closingText} onChange={(event) => set('closingText', event.target.value)} rows={2} maxLength={1000}
          placeholder="Ej.: ¡Lo lograron! La gota volvió al mar gracias a ustedes." className={`${inputClass} mt-1.5`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="XP al llegar a la meta" value={draft.finishXp} onChange={(value) => set('finishXp', value)} min={0} max={MAX_REWARD}
          error={xpError} hint={`Sugerido: ${Math.round(xpPerLevel * 0.2)} XP`} />
        <NumberField label="Oro al llegar a la meta" value={draft.finishGold} onChange={(value) => set('finishGold', value)} min={0} max={MAX_REWARD}
          error={goldError} hint="Sugerido: 10 de oro" />
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Insignias <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></legend>
        {badges.isSuccess && classBadges.length === 0 ? (
          <p className="text-sm text-gray-800 dark:text-gray-200">
            Esta clase aún no tiene insignias propias. <Link to={`/classroom/${expedition.classroomId}/badges`} className="font-semibold underline">Crea una</Link> para darla al llegar a la meta.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Al llegar a la meta</span>
              <select value={draft.finishBadgeId ?? ''} onChange={(event) => set('finishBadgeId', event.target.value || null)} className={`${inputClass} mt-1 min-h-[44px]`}>
                <option value="">Sin insignia</option>
                {classBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.icon} {badge.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Perseverancia</span>
              <select value={draft.perseveranceBadgeId ?? ''} onChange={(event) => set('perseveranceBadgeId', event.target.value || null)} className={`${inputClass} mt-1 min-h-[44px]`}>
                <option value="">Sin insignia</option>
                {classBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.icon} {badge.name}</option>)}
              </select>
              <span className="mt-1 block text-sm text-gray-700 dark:text-gray-300">Se gana cuando apruebas una evidencia que antes le pediste mejorar.</span>
            </label>
            <p className="text-sm text-gray-700 dark:text-gray-300">Cada alumno la recibe hasta el tope que tenga la insignia (por defecto, una vez).</p>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Cómo avanzan</legend>
        <div className="pg-seg mt-1.5" role="group" aria-label="Cómo avanzan">
          <button type="button" aria-pressed={draft.groupMode === 'INDIVIDUAL'} onClick={() => set('groupMode', 'INDIVIDUAL')} className="pg-seg-item">Individual</button>
          <button type="button" aria-pressed={draft.groupMode === 'CLAN'} disabled={!clansEnabled && draft.groupMode !== 'CLAN'}
            onClick={() => setDraft((current) => ({
              ...current,
              groupMode: 'CLAN',
              // Sin premio todavía: arranca con el sugerido.
              clanXp: current.clanXp === '0' ? String(Math.round(xpPerLevel * 0.3)) : current.clanXp,
            }))}
            className="pg-seg-item disabled:cursor-not-allowed disabled:opacity-50">Por clanes</button>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {draft.groupMode === 'CLAN'
            ? 'Cada uno avanza a su ritmo. Una parada cuenta para el clan cuando la logra más de la mitad de sus miembros; con todas, el clan llega a la meta.'
            : clansEnabled ? 'Cada uno avanza a su ritmo.' : 'Para jugar por clanes, activa los clanes de la clase.'}
        </p>
        {draft.groupMode === 'CLAN' && (
          <NumberField label="XP para el clan al llegar a la meta" value={draft.clanXp} onChange={(value) => set('clanXp', value)} min={0} max={MAX_REWARD}
            error={clanXpError} hint={`Sugerido: ${Math.round(xpPerLevel * 0.3)} XP · suma al XP del clan`} />
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Meta de la clase <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></legend>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <input type="checkbox" className="pg-check" checked={draft.goalOn} onChange={(event) => set('goalOn', event.target.checked)} />
          Poner una meta para toda la clase
        </label>
        {draft.goalOn && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="% de la clase que debe llegar" value={draft.goalPercent} onChange={(value) => set('goalPercent', value)} min={10} max={100}
              error={goalPercentError} hint="Por ejemplo, 70 %" />
            <NumberField label="XP para quienes llegaron" value={draft.goalXp} onChange={(value) => set('goalXp', value)} min={0} max={MAX_REWARD}
              error={goalXpError} hint={`Sugerido: ${Math.round(xpPerLevel * 0.1)} XP`} />
            <label className="block sm:col-span-2">
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Hasta <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></span>
              <input type="datetime-local" value={draft.goalDueAt} onChange={(event) => set('goalDueAt', event.target.value)} className={`${inputClass} mt-1 min-h-[44px] max-w-xs`} />
            </label>
            <p className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">Si la logran, el premio va a quienes llegaron a la meta (y a quien llegue antes de la fecha). Se ve en la proyección y en la vista del alumno.</p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Escenario</legend>
        <div className="pg-seg mt-1.5" role="group" aria-label="Escenario">
          <button type="button" aria-pressed={draft.scenario === 'CONSTELLATION'} onClick={() => set('scenario', 'CONSTELLATION')} className="pg-seg-item">Constelación</button>
          <button type="button" aria-pressed={draft.scenario === 'MAP'} onClick={() => set('scenario', 'MAP')} className="pg-seg-item">Mapa</button>
        </div>
      </fieldset>

      {draft.scenario === 'CONSTELLATION' ? (
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">Cada parada es una estrella. Las que sobran se encienden al llegar a la meta.</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((constellation) => (
              <li key={constellation.id}>
                <button type="button" aria-pressed={draft.constellationId === constellation.id} onClick={() => set('constellationId', constellation.id)}
                  className={`block w-full overflow-hidden rounded-xl border-2 text-left ${draft.constellationId === constellation.id ? 'border-blue-600 dark:border-blue-400' : 'border-transparent'}`}>
                  <span className="obs-sky relative block aspect-[10/7]">
                    <ExpeditionThumb scenario="CONSTELLATION" constellationId={constellation.id} mapImageUrl={null}
                      stopsCount={constellation.stars.length} doneCount={expedition.stops.length} finished={false} />
                    {draft.constellationId === constellation.id && (
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white"><Check size={12} aria-hidden="true" /> Elegida</span>
                    )}
                  </span>
                  <span className="block px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{constellation.name} <span className="font-normal text-gray-700 dark:text-gray-300">· {constellation.stars.length} estrellas</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : maps.isLoading ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">Cargando mapas…</p>
      ) : (maps.data ?? []).length === 0 ? (
        <p className="text-sm text-gray-800 dark:text-gray-200">Aún no hay mapas en la biblioteca.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(maps.data ?? []).map((map) => (
            <li key={map.id}>
              <button type="button" aria-pressed={draft.mapImageUrl === map.imageUrl} onClick={() => set('mapImageUrl', map.imageUrl)}
                className={`relative block w-full overflow-hidden rounded-xl border-2 text-left ${draft.mapImageUrl === map.imageUrl ? 'border-blue-600 dark:border-blue-400' : 'border-transparent'}`}>
                <img src={assetUrl(map.thumbnailUrl || map.imageUrl)} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{map.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SaveBar dirty={dirty} saving={save.isPending} invalid={invalid} onSave={() => save.mutate()} onDiscard={() => setDraft(toDraft(expedition))} />
    </div>
  );
};
