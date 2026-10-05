import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type ClassroomCompetency } from '../../lib/classroomApi';
import { gradeApi, type ClassroomGradebookResponse, type GradeScaleType } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { CopyConfigModal } from './CopyConfigModal';
import { card, errorMessage, SCALE_LABEL, secondaryButton } from './gradebookHelpers';

interface CompetenciesTabProps {
  book: ClassroomGradebookResponse;
  classroom: {
    id: string;
    curriculumAreaId?: string | null;
    gradeScaleType?: GradeScaleType | null;
    gradeScaleConfig?: { ranges?: Array<{ label: string; minPercent: number }> } | null;
    /** En una clase del colegio, la escala la fija su nivel. */
    context?: { gradeScale?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | null } | null;
  };
}

const SCALES: GradeScaleType[] = ['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS', 'CUSTOM'];
const EVALUATION_WEIGHTS = [
  { value: 100, label: 'Solo evaluaciones', hint: 'Si una competencia tiene evaluaciones, su nota sale de ellas. Si no, de la evidencia de clase.' },
  { value: 70, label: '70 % evaluaciones', hint: 'Las evaluaciones pesan 70 % y la evidencia de clase (comportamientos, actividades) 30 %.' },
  { value: 50, label: 'Mitad y mitad', hint: 'Evaluaciones y evidencia de clase pesan lo mismo.' },
  { value: 30, label: '30 % evaluaciones', hint: 'Manda la evidencia de clase; las evaluaciones pesan 30 %.' },
];
const COMPETENCY_WEIGHTS = [{ value: 100, label: 'Normal' }, { value: 150, label: 'Mayor' }, { value: 200, label: 'Doble' }];
const SKILL_WEIGHTS = [{ value: 1, label: 'Normal' }, { value: 2, label: 'Doble' }, { value: 3, label: 'Triple' }];
const DEFAULT_CUSTOM = [{ label: 'AD', minPercent: 90 }, { label: 'A', minPercent: 70 }, { label: 'B', minPercent: 50 }, { label: 'C', minPercent: 0 }];

const blockReason = (c: ClassroomCompetency) =>
  c.deleteBlockReason === 'HISTORICAL_RECORDS' ? 'Tiene notas o evidencias guardadas: no se puede quitar.'
    : c.deleteBlockReason === 'CONFIG_ASSOCIATED' ? 'Hay comportamientos, insignias o actividades vinculados: desvincúlalos primero.'
      : c.deleteBlockReason ? 'Está en uso: no se puede quitar.' : null;

// Escala, peso de evaluaciones, competencias con su peso y destrezas; copiar todo a otras clases.
export const CompetenciesTab = ({ book, classroom }: CompetenciesTabProps) => {
  const queryClient = useQueryClient();
  const classroomId = book.classroomId;
  const { data: competencies = [], isLoading } = useQuery({ queryKey: ['classroom-competencies', classroomId], queryFn: () => classroomApi.getCompetencies(classroomId) });
  const { data: areas = [] } = useQuery({ queryKey: ['curriculum-areas'], queryFn: () => classroomApi.getCurriculumAreas('PE') });

  const [scaleType, setScaleType] = useState<GradeScaleType>(classroom.gradeScaleType ?? 'PERU_LETTERS');
  const fixedScale = classroom.context?.gradeScale ?? null;
  const [ranges, setRanges] = useState(classroom.gradeScaleConfig?.ranges?.map((r) => ({ label: r.label, minPercent: r.minPercent })) ?? DEFAULT_CUSTOM);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { kind: 'copy' } | { kind: 'custom'; competency?: ClassroomCompetency } | { kind: 'remove'; competency: ClassroomCompetency } | { kind: 'add' }>(null);
  const [newSkill, setNewSkill] = useState<Record<string, string>>({});
  const [editingSkill, setEditingSkill] = useState<{ id: string; name: string } | null>(null);

  const area = areas.find((a) => a.id === classroom.curriculumAreaId);
  const activeIds = useMemo(() => new Set(competencies.map((c) => c.id)), [competencies]);
  const addable = (area?.competencies ?? []).filter((c) => !activeIds.has(c.id));
  const codeOf = (id: string) => book.competencies.find((c) => c.id === id)?.code ?? '';

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['classroom-competencies', classroomId] }),
    queryClient.invalidateQueries({ queryKey: ['classroom-grades', classroomId] }),
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] }),
  ]);
  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      await refresh();
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const scaleChanged = scaleType !== (classroom.gradeScaleType ?? 'PERU_LETTERS')
    || (scaleType === 'CUSTOM' && JSON.stringify(ranges) !== JSON.stringify(classroom.gradeScaleConfig?.ranges?.map((r) => ({ label: r.label, minPercent: r.minPercent })) ?? DEFAULT_CUSTOM));

  return (
    <div className="space-y-4">
      {/* Escala */}
      <section aria-labelledby="scale-title" className={card}>
        <h2 id="scale-title" className="text-base font-bold text-gray-900 dark:text-white">Escala de notas</h2>
        {fixedScale ? (
          <p className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100">
            {area ? `Área: ${area.name}. ` : ''}<strong>{SCALE_LABEL[fixedScale]}</strong>: la define tu colegio para este nivel en «Año escolar», así las libretas no mezclan letras y números.
          </p>
        ) : (<>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {area ? `Área: ${area.name}. ` : ''}Cambiarla afecta al bimestre en curso; los bimestres cerrados conservan sus notas.
        </p>
        <div role="radiogroup" aria-labelledby="scale-title" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCALES.map((type) => (
            <label key={type} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm font-semibold ${scaleType === type ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-900 dark:border-gray-700 dark:text-white'}`}>
              <input type="radio" name="scale-type" checked={scaleType === type} onChange={() => setScaleType(type)} className="accent-primary-600" />
              {SCALE_LABEL[type]}
            </label>
          ))}
        </div>
        {scaleType === 'CUSTOM' && (
          <fieldset className="mt-3 space-y-2">
            <legend className={labelClass}>Niveles (del más alto al más bajo)</legend>
            {ranges.map((range, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`range-label-${index}`}>Nombre del nivel {index + 1}</label>
                <input id={`range-label-${index}`} value={range.label} maxLength={10} onChange={(e) => setRanges((r) => r.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))} className={`${inputClass} w-24`} />
                <label htmlFor={`range-min-${index}`} className="text-sm text-gray-800 dark:text-gray-100">desde</label>
                <input id={`range-min-${index}`} type="number" min={0} max={100} value={range.minPercent} onChange={(e) => setRanges((r) => r.map((x, i) => (i === index ? { ...x, minPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} className={`${inputClass} w-24`} />
                <span className="text-sm text-gray-800 dark:text-gray-100">%</span>
                {ranges.length > 2 && (
                  <button type="button" onClick={() => setRanges((r) => r.filter((_, i) => i !== index))} aria-label={`Quitar nivel ${range.label || index + 1}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {ranges.length < 10 && (
              <button type="button" onClick={() => setRanges((r) => [...r, { label: '', minPercent: 0 }])} className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-primary-800 dark:text-primary-200">
                <Plus size={16} aria-hidden="true" /> Agregar nivel
              </button>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300">El nivel más bajo debe empezar en 0 %.</p>
          </fieldset>
        )}
        <button type="button" className={`${primaryButton} mt-3`} disabled={!scaleChanged || busy !== null}
          onClick={() => run('scale', () => gradeApi.updateGradeSettings(classroomId, {
            gradeScaleType: scaleType,
            ...(scaleType === 'CUSTOM' ? { customRanges: [...ranges].sort((a, b) => b.minPercent - a.minPercent) } : {}),
          }), 'Escala guardada')}>
          {busy === 'scale' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar escala
        </button>
        </>)}
      </section>

      {/* Peso de las evaluaciones */}
      <section aria-labelledby="blend-title" className={card}>
        <h2 id="blend-title" className="text-base font-bold text-gray-900 dark:text-white">¿Cuánto pesan tus evaluaciones?</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Cuando una competencia tiene evaluaciones (exámenes, tareas) y también evidencia de clase.</p>
        <div role="radiogroup" aria-labelledby="blend-title" className="mt-3 grid gap-2 sm:grid-cols-2">
          {EVALUATION_WEIGHTS.map((w) => (
            <label key={w.value} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${book.evaluationWeight === w.value ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" name="eval-blend" checked={book.evaluationWeight === w.value} disabled={busy !== null}
                onChange={() => run('blend', () => gradeApi.updateGradeSettings(classroomId, { evaluationWeight: w.value }), 'Peso de las evaluaciones guardado')}
                className="mt-0.5 accent-primary-600" />
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{w.label}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{w.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Competencias y destrezas */}
      <section aria-labelledby="comps-title" className={card}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="comps-title" className="text-base font-bold text-gray-900 dark:text-white">Competencias y destrezas</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">Las destrezas desglosan una competencia; puedes darles más peso.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {addable.length > 0 && <button type="button" onClick={() => setModal({ kind: 'add' })} className={secondaryButton}><Plus size={16} aria-hidden="true" /> Competencia oficial</button>}
            <button type="button" onClick={() => setModal({ kind: 'custom' })} className={secondaryButton}><Plus size={16} aria-hidden="true" /> Competencia propia</button>
            <button type="button" onClick={() => setModal({ kind: 'copy' })} className={secondaryButton}><Copy size={16} aria-hidden="true" /> Copiar a otras clases</button>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-label="Cargando competencias" />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {competencies.map((c) => {
              const open = expanded === c.id;
              const weight = c.weight ?? 100;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setExpanded(open ? null : c.id)} aria-expanded={open} aria-controls={`skills-${c.id}`}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl text-left">
                      <ChevronDown size={18} className={`flex-shrink-0 text-gray-700 transition-transform dark:text-gray-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-gray-900 dark:text-white">{codeOf(c.id) && `${codeOf(c.id)} · `}{c.shortName || c.name}</span>
                        <span className="block text-sm text-gray-700 dark:text-gray-300">
                          {c.isCustom ? 'Propia' : 'Oficial'} · {c.indicators.length} {c.indicators.length === 1 ? 'destreza' : 'destrezas'}
                        </span>
                      </span>
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                      Peso
                      <select value={weight} disabled={busy !== null} aria-label={`Peso de ${c.shortName || c.name} en el promedio`}
                        onChange={(e) => run(`w-${c.id}`, () => gradeApi.updateGradeSettings(classroomId, { competencyWeights: [{ competencyId: c.id, weight: Number(e.target.value) }] }), 'Peso guardado')}
                        className={`${inputClass} w-28`}>
                        {COMPETENCY_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                        {!COMPETENCY_WEIGHTS.some((w) => w.value === weight) && <option value={weight}>{weight} %</option>}
                      </select>
                    </label>
                    {c.canEdit && (
                      <button type="button" onClick={() => setModal({ kind: 'custom', competency: c })} aria-label={`Editar ${c.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    )}
                    {!c.isBase && (
                      <button type="button" onClick={() => setModal({ kind: 'remove', competency: c })} aria-label={`Quitar ${c.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {open && (
                    <div id={`skills-${c.id}`} className="ml-7 mt-2 space-y-2 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                      <p className="text-sm text-gray-800 dark:text-gray-100">{c.name}</p>
                      {c.indicators.length === 0 && <p className="text-sm text-gray-700 dark:text-gray-300">Sin destrezas: la competencia se evalúa completa.</p>}
                      <ul className="space-y-1.5">
                        {c.indicators.map((skill) => (
                          <li key={skill.id} className="flex flex-wrap items-center gap-2">
                            {editingSkill?.id === skill.id ? (
                              <>
                                <label htmlFor={`skill-edit-${skill.id}`} className="sr-only">Nombre de la destreza</label>
                                <input id={`skill-edit-${skill.id}`} value={editingSkill.name} autoFocus maxLength={255} onChange={(e) => setEditingSkill({ id: skill.id, name: e.target.value })} className={`${inputClass} min-w-0 flex-1`} />
                                <button type="button" className={primaryButton} disabled={editingSkill.name.trim().length < 2 || busy !== null}
                                  onClick={async () => { if (await run(`s-${skill.id}`, () => classroomApi.updateCompetencyIndicator(classroomId, c.id, skill.id, { name: editingSkill.name.trim() }), 'Destreza actualizada')) setEditingSkill(null); }}>
                                  Guardar
                                </button>
                                <button type="button" className={cancelButton} onClick={() => setEditingSkill(null)}>Cancelar</button>
                              </>
                            ) : (
                              <>
                                <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{skill.name}</span>
                                <select value={skill.weight ?? 1} disabled={busy !== null} aria-label={`Peso de la destreza ${skill.name}`}
                                  onChange={(e) => run(`s-${skill.id}`, () => classroomApi.updateCompetencyIndicator(classroomId, c.id, skill.id, { weight: Number(e.target.value) }), 'Peso de la destreza guardado')}
                                  className={`${inputClass} w-28`}>
                                  {SKILL_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                                </select>
                                <button type="button" onClick={() => setEditingSkill({ id: skill.id, name: skill.name })} aria-label={`Renombrar ${skill.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                                  <Pencil size={16} aria-hidden="true" />
                                </button>
                                {skill.canDelete && (
                                  <button type="button" disabled={busy !== null} aria-label={`Eliminar ${skill.name}`}
                                    onClick={() => run(`s-${skill.id}`, () => classroomApi.deleteCompetencyIndicator(classroomId, c.id, skill.id), 'Destreza eliminada')}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                )}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                      <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
                        e.preventDefault();
                        const name = (newSkill[c.id] ?? '').trim();
                        if (name.length < 2) return;
                        if (await run(`n-${c.id}`, () => classroomApi.createCompetencyIndicator(classroomId, c.id, { name }), 'Destreza agregada')) setNewSkill((n) => ({ ...n, [c.id]: '' }));
                      }}>
                        <label htmlFor={`skill-new-${c.id}`} className="sr-only">Nueva destreza para {c.name}</label>
                        <input id={`skill-new-${c.id}`} value={newSkill[c.id] ?? ''} maxLength={255} placeholder="Nueva destreza" onChange={(e) => setNewSkill((n) => ({ ...n, [c.id]: e.target.value }))} className={`${inputClass} min-w-0 flex-1`} />
                        <button type="submit" className={secondaryButton} disabled={(newSkill[c.id] ?? '').trim().length < 2 || busy !== null}><Plus size={16} aria-hidden="true" /> Agregar</button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal?.kind === 'copy' && <CopyConfigModal classroomId={classroomId} onClose={() => setModal(null)} />}
      {modal?.kind === 'custom' && <CustomCompetencyModal classroomId={classroomId} competency={modal.competency} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await refresh(); }} />}
      {modal?.kind === 'add' && (
        <HomeModal title="Agregar competencia oficial" subtitle={area?.name} onClose={() => setModal(null)}>
          <ul className="space-y-2">
            {addable.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{c.name}</span>
                <button type="button" className={secondaryButton} disabled={busy !== null}
                  onClick={async () => { if (await run(`a-${c.id}`, () => classroomApi.addCompetencies(classroomId, [c.id]), 'Competencia agregada')) setModal(null); }}>
                  Agregar
                </button>
              </li>
            ))}
          </ul>
        </HomeModal>
      )}
      {modal?.kind === 'remove' && (
        <HomeModal title="¿Quitar la competencia?" subtitle={modal.competency.name} onClose={() => setModal(null)}
          footer={<>
            <button type="button" onClick={() => setModal(null)} className={cancelButton}>Cancelar</button>
            {!blockReason(modal.competency) && (
              <button type="button" disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
                onClick={async () => {
                  const c = modal.competency;
                  if (await run(`r-${c.id}`, () => (c.canEdit ? classroomApi.deleteCustomCompetency(classroomId, c.id) : classroomApi.removeCompetency(classroomId, c.id)), 'Competencia quitada')) setModal(null);
                }}>
                <Trash2 size={16} aria-hidden="true" /> Quitar
              </button>
            )}
          </>}>
          <p className="text-sm text-gray-800 dark:text-gray-100">{blockReason(modal.competency) ?? 'Deja de aparecer en el libro de calificaciones de esta clase.'}</p>
        </HomeModal>
      )}
    </div>
  );
};

// Crear o editar una competencia propia de la clase.
const CustomCompetencyModal = ({ classroomId, competency, onClose, onSaved }: { classroomId: string; competency?: ClassroomCompetency; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState({ name: competency?.name ?? '', shortName: competency?.shortName ?? '', description: competency?.description ?? '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (form.name.trim().length < 2) return;
    setSaving(true);
    const data = { name: form.name.trim(), shortName: form.shortName.trim() || null, description: form.description.trim() || null };
    try {
      if (competency) await classroomApi.updateCustomCompetency(classroomId, competency.id, data);
      else await classroomApi.createCustomCompetency(classroomId, data);
      toast.success(competency ? 'Competencia actualizada' : 'Competencia creada');
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar'));
      setSaving(false);
    }
  };
  return (
    <HomeModal title={competency ? 'Editar competencia propia' : 'Nueva competencia propia'} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={save} disabled={form.name.trim().length < 2 || saving} className={primaryButton}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar
        </button>
      </>}>
      <div>
        <label htmlFor="cc-name" className={labelClass}>Nombre</label>
        <input id="cc-name" data-autofocus value={form.name} maxLength={255} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={`${inputClass} mt-1`} />
      </div>
      <div>
        <label htmlFor="cc-short" className={labelClass}>Nombre corto (encabezado de la tabla)</label>
        <input id="cc-short" value={form.shortName} maxLength={100} placeholder="Ej.: Oralidad" onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} className={`${inputClass} mt-1`} />
      </div>
      <div>
        <label htmlFor="cc-desc" className={labelClass}>Descripción (opcional)</label>
        <textarea id="cc-desc" rows={3} value={form.description} maxLength={1000} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClass} mt-1`} />
      </div>
    </HomeModal>
  );
};
