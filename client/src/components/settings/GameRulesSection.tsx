import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, Flame, Moon, Plus, Shield, TrendingUp, Trash2, Zap } from 'lucide-react';
import { isInitialLevel, restingKey, useRestingStudents } from '../energy/energyHelpers';
import type { Classroom, Student } from '../../lib/classroomApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, primaryButton } from '../home/homeHelpers';
import { secondaryButton } from '../gradebook/gradebookHelpers';
import { CharacterClassesCard } from './CharacterClassesCard';
import { NumberField, SaveBar, SettingsCard, SwitchRow } from './settingsUi';
import { changedFields, parseIntField, useClassroomSettingsSave, useDraft } from './settingsHooks';

type StreakConfig = NonNullable<Classroom['loginStreakConfig']>;

const DEFAULT_STREAK: StreakConfig = {
  dailyXp: 5,
  milestones: [
    { day: 3, xp: 10, gp: 0, randomItem: false },
    { day: 7, xp: 25, gp: 10, randomItem: false },
    { day: 14, xp: 50, gp: 25, randomItem: false },
    { day: 30, xp: 100, gp: 50, randomItem: true },
  ],
  resetOnMiss: true,
  graceDays: 0,
};

// Misma fórmula que el servidor (utils/helpers.calculateLevel): el nivel N empieza en paso·N·(N−1)/2.
const levelFor = (xp: number, step: number) => Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / step)) / 2));
const xpToReach = (level: number, step: number) => (step * level * (level - 1)) / 2;

// Configuración > Reglas del juego.
export const GameRulesSection = ({ classroom, students }: { classroom: Classroom; students: Student[] }) => {
  const { save } = useClassroomSettingsSave(classroom);
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <StartingPointsCard classroom={classroom} />
        <NoticesCard classroom={classroom} />
        <EnergyCard classroom={classroom} />
        <CharacterClassesCard
          classroom={classroom}
          students={students}
          onModeChange={(mode) => save({ classAssignmentMode: mode }, mode === 'STUDENT_CHOICE' ? 'Cada alumno elige su clase' : 'Tú asignas las clases', true)}
        />
        <ClansCard classroom={classroom} />
      </div>
      <details className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <summary className="flex min-h-[52px] cursor-pointer items-center gap-2 px-4 text-base font-bold text-gray-900 dark:text-white">
          <ChevronRight size={18} className="transition-transform group-open:rotate-90" aria-hidden="true" />
          Opciones avanzadas
          <span className="text-sm font-normal text-gray-700 dark:text-gray-300">XP por nivel y racha de conexión</span>
        </summary>
        <div className="grid items-start gap-4 border-t border-gray-200 p-4 dark:border-gray-700 xl:grid-cols-2">
          <LevelsCard classroom={classroom} students={students} />
          <StreakCard classroom={classroom} />
        </div>
      </details>
    </div>
  );
};

const StartingPointsCard = ({ classroom }: { classroom: Classroom }) => {
  const { save, saving } = useClassroomSettingsSave(classroom);
  const saved = {
    defaultXp: String(classroom.defaultXp),
    defaultHp: String(classroom.defaultHp),
    defaultGp: String(classroom.defaultGp),
    maxHp: String(classroom.maxHp),
  };
  const { draft, setDraft, dirty, reset, markSaved } = useDraft(saved);
  const fields = {
    defaultXp: parseIntField(draft.defaultXp, 0, 100000),
    defaultHp: parseIntField(draft.defaultHp, 0, 10000),
    defaultGp: parseIntField(draft.defaultGp, 0, 100000),
    maxHp: parseIntField(draft.maxHp, 1, 10000),
  };
  const hpOverMax = fields.defaultHp.value !== null && fields.maxHp.value !== null && fields.defaultHp.value > fields.maxHp.value
    ? `No puede ser mayor que el HP máximo (${fields.maxHp.value})` : null;
  const invalid = Object.values(fields).some((f) => f.error) || !!hpOverMax;

  const submit = async () => {
    const next = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value]));
    const savedNums = Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, Number(v)]));
    const changes = changedFields(next, savedNums);
    if (Object.keys(changes).length === 0) return reset();
    if (await save(changes, 'Puntos iniciales guardados')) markSaved();
  };

  return (
    <SettingsCard
      title="Puntos iniciales"
      icon={Zap}
      description="Con lo que empieza cada alumno nuevo. No cambia a los que ya están en la clase."
      footer={<SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={reset} />}
    >
      <div className="grid grid-cols-2 gap-3 py-3">
        <NumberField label="XP inicial" unit="XP" min={0} max={100000} value={draft.defaultXp} onChange={(v) => setDraft({ ...draft, defaultXp: v })} error={fields.defaultXp.error} />
        <NumberField label="Oro inicial" unit="GP" min={0} max={100000} value={draft.defaultGp} onChange={(v) => setDraft({ ...draft, defaultGp: v })} error={fields.defaultGp.error} />
        <NumberField label="HP inicial" unit="HP" min={0} max={10000} value={draft.defaultHp} onChange={(v) => setDraft({ ...draft, defaultHp: v })} error={fields.defaultHp.error ?? hpOverMax} />
        <NumberField label="HP máximo" unit="HP" min={1} max={10000} value={draft.maxHp} onChange={(v) => setDraft({ ...draft, maxHp: v })} error={fields.maxHp.error} />
      </div>
    </SettingsCard>
  );
};

// Energía (HP): qué mide, qué pasa en 0 y las misiones de recuperación de la clase.
const EnergyCard = ({ classroom }: { classroom: Classroom }) => {
  const queryClient = useQueryClient();
  const { save, saving } = useClassroomSettingsSave(classroom);
  const { templates } = useRestingStudents(classroom.id);
  const { draft, setDraft, dirty, reset, markSaved } = useDraft({ missions: templates });
  const initial = isInitialLevel(classroom.gradeLevel);
  const cleaned = draft.missions.map((m) => m.trim());
  const invalid = cleaned.length === 0 || cleaned.some((m) => m.length < 3);

  const submit = async () => {
    if (invalid) return;
    if (await save({ recoveryMissions: cleaned }, 'Misiones de recuperación guardadas')) {
      markSaved();
      void queryClient.invalidateQueries({ queryKey: restingKey(classroom.id) });
    }
  };

  return (
    <SettingsCard
      title="Energía y misiones de recuperación"
      icon={Moon}
      description="La energía (HP) mide la convivencia, nunca las notas."
      footer={initial ? null : <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={reset} note={invalid ? 'Cada misión necesita al menos 3 letras' : undefined} />}
    >
      <ul className="mt-2 space-y-1.5 text-sm text-gray-800 dark:text-gray-100">
        <li>🌙 Con 0 HP el alumno <strong>descansa</strong>: {initial ? 'lo recuperas en cuanto esté listo.' : 'sus compras con oro (premios, ropa del avatar y sobres de figuritas) se pausan y sigue ganando XP y oro.'}</li>
        {!initial && <li>✅ Vuelve con la mitad de su energía al cumplir una <strong>misión de recuperación</strong> que tú validas.</li>}
        <li>📖 Al empezar un capítulo de la Historia, todos vuelven a su energía máxima.</li>
        {initial && <li>❤️ En inicial la energía se ve con corazones, sin números.</li>}
      </ul>
      {!initial && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Misiones para elegir</p>
          <ul className="mt-2 space-y-2">
            {draft.missions.map((mission, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="text" value={mission} maxLength={140} aria-label={`Misión ${i + 1}`}
                  onChange={(e) => setDraft({ missions: draft.missions.map((m, j) => (j === i ? e.target.value : m)) })}
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                <button type="button" onClick={() => setDraft({ missions: draft.missions.filter((_, j) => j !== i) })}
                  disabled={draft.missions.length <= 1} aria-label={`Quitar misión ${i + 1}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-900/30">
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {draft.missions.length < 6 && (
            <button type="button" onClick={() => setDraft({ missions: [...draft.missions, ''] })} className={`${secondaryButton} mt-2`}>
              <Plus size={16} aria-hidden="true" /> Añadir misión
            </button>
          )}
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Al asignar una misión también puedes escribir otra distinta.</p>
        </div>
      )}
    </SettingsCard>
  );
};

const NoticesCard = ({ classroom }: { classroom: Classroom }) => {
  const { save } = useClassroomSettingsSave(classroom);
  const notify = classroom.notifyOnPoints ?? true;
  return (
    <SettingsCard title="Avisos al alumno" icon={Bell} description="Lo que ve el alumno en sus notificaciones. Tu aviso de subida de nivel no cambia.">
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <SwitchRow
          title="Avisar cuando recibe o pierde puntos"
          checked={notify}
          onChange={(v) => save({ notifyOnPoints: v }, v ? 'Los alumnos reciben avisos de puntos' : 'Los alumnos ya no reciben avisos de puntos', true)}
        />
        <SwitchRow
          title="Incluir el motivo"
          description={notify ? 'Ej.: «Recibiste ⚡10 XP por: Participación».' : 'Activa los avisos para usarlo.'}
          checked={classroom.showReasonToStudent ?? true}
          disabled={!notify}
          onChange={(v) => save({ showReasonToStudent: v }, v ? 'El aviso incluye el motivo' : 'El aviso ya no incluye el motivo', true)}
        />
      </div>
    </SettingsCard>
  );
};

const ClansCard = ({ classroom }: { classroom: Classroom }) => {
  const { save, saving } = useClassroomSettingsSave(classroom);
  const saved = { clanXpPercentage: classroom.clanXpPercentage ?? 50 };
  const { draft, setDraft, dirty, reset, markSaved } = useDraft(saved);
  const rangeId = useId();
  const enabled = classroom.clansEnabled ?? false;
  return (
    <SettingsCard
      title="Clanes"
      icon={Shield}
      description="Equipos que suman XP juntos."
      footer={enabled ? <SaveBar dirty={dirty} saving={saving} onSave={async () => { if (await save({ clanXpPercentage: draft.clanXpPercentage }, 'Porcentaje del clan guardado')) markSaved(); }} onDiscard={reset} /> : null}
    >
      <SwitchRow title="Usar clanes" checked={enabled} onChange={(v) => save({ clansEnabled: v }, v ? 'Clanes activados' : 'Clanes desactivados', true)} />
      {enabled && (
        <div className="space-y-3 border-t border-gray-100 py-3 dark:border-gray-700">
          <div>
            <label htmlFor={rangeId} className="text-sm font-semibold text-gray-900 dark:text-white">
              XP que suma al clan: <span className="tabular-nums">{draft.clanXpPercentage} %</span>
            </label>
            <p className="text-sm text-gray-700 dark:text-gray-300">De cada XP que gana un alumno, este porcentaje se suma también a su clan.</p>
            <input id={rangeId} type="range" min={0} max={100} step={10} value={draft.clanXpPercentage}
              onChange={(e) => setDraft({ clanXpPercentage: Number(e.target.value) })}
              className="mt-2 h-11 w-full cursor-pointer accent-primary-600" />
          </div>
          <Link to={`/classroom/${classroom.id}/clans`} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary-800 hover:underline dark:text-primary-200">
            Organizar clanes <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </SettingsCard>
  );
};

const LevelsCard = ({ classroom, students }: { classroom: Classroom; students: Student[] }) => {
  const { save, saving } = useClassroomSettingsSave(classroom);
  const current = classroom.xpPerLevel ?? 100;
  const { draft, setDraft, dirty, reset, markSaved } = useDraft({ xpPerLevel: String(current) });
  const [confirming, setConfirming] = useState(false);
  const parsed = parseIntField(draft.xpPerLevel, 10, 100000);
  const step = parsed.value ?? current;

  // Qué pasaría con los alumnos de la clase si se guarda este valor.
  const impact = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of students) {
      if (s.isDemo) continue;
      const next = levelFor(s.xp, step);
      if (next > s.level) up += 1;
      else if (next < s.level) down += 1;
    }
    return { up, down };
  }, [students, step]);

  const commit = async () => {
    if (parsed.value === null) return;
    const ok = await save({ xpPerLevel: parsed.value }, 'XP por nivel guardada; niveles recalculados');
    if (ok) {
      setConfirming(false);
      markSaved();
    }
  };

  const onSave = () => {
    if (parsed.value === null || parsed.value === current) return reset();
    if (impact.up + impact.down > 0) setConfirming(true);
    else void commit();
  };

  const impactText = impact.up + impact.down === 0
    ? 'Ningún alumno cambia de nivel.'
    : [impact.up ? `${impact.up} ${impact.up === 1 ? 'alumno sube' : 'alumnos suben'}` : '', impact.down ? `${impact.down} ${impact.down === 1 ? 'alumno baja' : 'alumnos bajan'}` : ''].filter(Boolean).join(' y ') + ' de nivel.';

  return (
    <SettingsCard
      title="XP por nivel"
      icon={TrendingUp}
      description="Cada nivel pide un poco más que el anterior."
      footer={<SaveBar dirty={dirty} saving={saving} invalid={!!parsed.error} onSave={onSave} onDiscard={reset} note={dirty && !parsed.error ? `Al guardar: ${impactText}` : undefined} />}
    >
      <div className="py-3">
        <NumberField label="XP para pasar del nivel 1 al 2" unit="XP" min={10} max={100000} value={draft.xpPerLevel} onChange={(v) => setDraft({ xpPerLevel: v })} error={parsed.error} />
      </div>
      <table className="w-full text-left text-sm">
        <caption className="mb-1 text-left text-sm text-gray-700 dark:text-gray-300">XP total para llegar a cada nivel</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th scope="col" className="py-1.5 font-semibold text-gray-900 dark:text-white">Nivel</th>
            {[2, 3, 5, 10].map((n) => <th key={n} scope="col" className="py-1.5 text-right font-semibold text-gray-900 dark:text-white">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="py-1.5 font-normal text-gray-800 dark:text-gray-100">XP</th>
            {[2, 3, 5, 10].map((n) => <td key={n} className="py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{xpToReach(n, step).toLocaleString('es')}</td>)}
          </tr>
        </tbody>
      </table>
      {confirming && (
        <HomeModal
          title="¿Recalcular los niveles?"
          onClose={saving ? () => undefined : () => setConfirming(false)}
          footer={<>
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={commit} disabled={saving} className={primaryButton} data-autofocus>{saving ? 'Guardando…' : 'Guardar y recalcular'}</button>
          </>}
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">
            Con {step.toLocaleString('es')} XP por nivel, <strong>{impactText}</strong> Nadie pierde XP: solo cambia el nivel que se muestra.
          </p>
        </HomeModal>
      )}
    </SettingsCard>
  );
};

type MilestoneDraft = { uid: string; day: string; xp: string; gp: string; randomItem: boolean };

const StreakCard = ({ classroom }: { classroom: Classroom }) => {
  const { save, saving } = useClassroomSettingsSave(classroom);
  const enabled = classroom.loginStreakEnabled ?? false;
  const config = classroom.loginStreakConfig ?? DEFAULT_STREAK;
  const { draft, setDraft, dirty, reset, markSaved } = useDraft({
    dailyXp: String(config.dailyXp),
    graceDays: String(config.graceDays),
    milestones: config.milestones.map((m, i): MilestoneDraft => ({ uid: `m${i}`, day: String(m.day), xp: String(m.xp), gp: String(m.gp), randomItem: m.randomItem })),
  });

  const dailyXp = parseIntField(draft.dailyXp, 0, 50);
  const graceDays = parseIntField(draft.graceDays, 0, 7);
  const rows = draft.milestones.map((m) => ({ uid: m.uid, day: parseIntField(m.day, 1, 365), xp: parseIntField(m.xp, 0, 10000), gp: parseIntField(m.gp, 0, 10000) }));
  const days = rows.map((r) => r.day.value).filter((d): d is number => d !== null);
  const duplicateDay = new Set(days).size !== days.length;
  const invalid = !!dailyXp.error || !!graceDays.error || duplicateDay || rows.some((r) => r.day.error || r.xp.error || r.gp.error);

  const setMilestone = (uid: string, patch: Partial<MilestoneDraft>) =>
    setDraft({ ...draft, milestones: draft.milestones.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) });

  const addMilestone = () => {
    const last = days.length ? Math.max(...days) : 0;
    setDraft({ ...draft, milestones: [...draft.milestones, { uid: `n${Date.now()}`, day: String(last + 7), xp: '50', gp: '25', randomItem: false }] });
  };

  const submit = async () => {
    if (invalid) return;
    const next: StreakConfig = {
      dailyXp: dailyXp.value!,
      graceDays: graceDays.value!,
      resetOnMiss: config.resetOnMiss,
      milestones: draft.milestones
        .map((m) => ({ day: Number(m.day), xp: Number(m.xp), gp: Number(m.gp), randomItem: m.randomItem }))
        .sort((a, b) => a.day - b.day),
    };
    if (await save({ loginStreakConfig: next }, 'Racha guardada')) markSaved();
  };

  const cell = 'w-full min-w-[3rem] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <SettingsCard
      title="Racha de conexión"
      icon={Flame}
      description="Premia a los alumnos que entran a la plataforma varios días seguidos."
      footer={enabled ? <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={reset} note={duplicateDay ? 'Hay dos premios para el mismo día' : undefined} /> : null}
    >
      <SwitchRow
        title="Premiar la conexión diaria"
        checked={enabled}
        onChange={(v) => save(
          { loginStreakEnabled: v, ...(v && !classroom.loginStreakConfig ? { loginStreakConfig: DEFAULT_STREAK } : {}) },
          v ? 'Racha activada' : 'Racha desactivada',
          true,
        )}
      />
      {enabled && (
        <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="XP por día" unit="XP" min={0} max={50} value={draft.dailyXp} onChange={(v) => setDraft({ ...draft, dailyXp: v })} error={dailyXp.error} />
            <NumberField label="Días de gracia" unit="días" min={0} max={7} value={draft.graceDays} onChange={(v) => setDraft({ ...draft, graceDays: v })} error={graceDays.error} hint="Días que puede faltar sin perder la racha." />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700">
            <SwitchRow
              title="Reiniciar si falta"
              description={config.resetOnMiss ? 'Al pasar los días de gracia, la racha vuelve a empezar.' : 'La racha nunca se pierde; solo se pausa.'}
              checked={config.resetOnMiss}
              onChange={(v) => save({ loginStreakConfig: { ...config, resetOnMiss: v } }, v ? 'La racha se reinicia si falta' : 'La racha ya no se reinicia', true)}
            />
          </div>
          <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Premios por días seguidos</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">«Objeto» suma un objeto sorpresa al premio.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-900 dark:text-white">
                    <th scope="col" className="pb-1 pr-2 font-semibold">Día</th>
                    <th scope="col" className="pb-1 pr-2 font-semibold">XP</th>
                    <th scope="col" className="pb-1 pr-2 font-semibold">GP</th>
                    <th scope="col" className="pb-1 pr-2 font-semibold">Objeto</th>
                    <th scope="col" className="pb-1"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.milestones.map((m, i) => {
                    const row = rows[i];
                    const label = `premio ${i + 1}`;
                    return (
                      <tr key={m.uid}>
                        <td className="py-1 pr-2"><input type="number" min={1} max={365} aria-label={`Día del ${label}`} aria-invalid={!!row.day.error} value={m.day} onChange={(e) => setMilestone(m.uid, { day: e.target.value })} className={cell} /></td>
                        <td className="py-1 pr-2"><input type="number" min={0} aria-label={`XP del ${label}`} aria-invalid={!!row.xp.error} value={m.xp} onChange={(e) => setMilestone(m.uid, { xp: e.target.value })} className={cell} /></td>
                        <td className="py-1 pr-2"><input type="number" min={0} aria-label={`GP del ${label}`} aria-invalid={!!row.gp.error} value={m.gp} onChange={(e) => setMilestone(m.uid, { gp: e.target.value })} className={cell} /></td>
                        <td className="py-1 pr-2">
                          <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                            <input type="checkbox" checked={m.randomItem} onChange={(e) => setMilestone(m.uid, { randomItem: e.target.checked })} aria-label={`Objeto sorpresa en el ${label}`} className="h-5 w-5 accent-primary-600" />
                          </label>
                        </td>
                        <td className="py-1">
                          <button type="button" onClick={() => setDraft({ ...draft, milestones: draft.milestones.filter((x) => x.uid !== m.uid) })} aria-label={`Quitar ${label}`}
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {draft.milestones.length < 20 && (
              <button type="button" onClick={addMilestone} className={`${secondaryButton} mt-2`}>
                <Plus size={16} aria-hidden="true" /> Añadir premio
              </button>
            )}
          </div>
        </div>
      )}
    </SettingsCard>
  );
};
