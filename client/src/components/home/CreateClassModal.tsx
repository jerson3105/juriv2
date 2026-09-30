import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, PenLine, School, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import type { MySchool } from '../../lib/schoolApi';
import { HomeModal } from './HomeModal';
import { GRADE_LEVELS, cancelButton, classroomsKey, errorMessage, inputClass, labelClass, primaryButton } from './homeHelpers';

// Elegir cómo crear la clase: guiado por Jiro o a mano.
export const NewClassChooser = ({ onClose, onJiro, onManual }: { onClose: () => void; onJiro: () => void; onManual: () => void }) => {
  const option = 'flex w-full items-start gap-4 rounded-2xl border-2 border-gray-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/50 focus-visible:border-primary-500 dark:border-gray-600 dark:hover:border-primary-400 dark:hover:bg-primary-900/20';
  return (
    <HomeModal title="Nueva clase" subtitle="¿Cómo quieres crearla?" onClose={onClose}>
      <button type="button" onClick={onJiro} className={option} data-autofocus>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200" aria-hidden="true">
          <Sparkles size={22} />
        </span>
        <span>
          <span className="block font-bold text-gray-900 dark:text-white">Con Jiro <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800 dark:bg-primary-900/50 dark:text-primary-100">Beta</span></span>
          <span className="mt-0.5 block text-sm text-gray-700 dark:text-gray-300">Cuéntale de qué trata tu clase y te propone comportamientos, insignias y tienda para revisar antes de crearla.</span>
        </span>
      </button>
      <button type="button" onClick={onManual} className={option}>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100" aria-hidden="true">
          <PenLine size={22} />
        </span>
        <span>
          <span className="block font-bold text-gray-900 dark:text-white">A mano</span>
          <span className="mt-0.5 block text-sm text-gray-700 dark:text-gray-300">Nombre, grado y escuela en un minuto. Luego la configuras a tu ritmo.</span>
        </span>
      </button>
    </HomeModal>
  );
};

interface CreateClassModalProps {
  schools: MySchool[]; // escuelas donde puede crear clases
  onClose: () => void;
  onCreated: (classroom: Classroom) => void;
}

// Crear clase a mano. Se monta de nuevo en cada apertura, así el formulario siempre empieza vacío.
export const CreateClassModal = ({ schools, onClose, onCreated }: CreateClassModalProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [competenciesOn, setCompetenciesOn] = useState(false);
  const [educationLevel, setEducationLevel] = useState<'PRIMARIA' | 'SECUNDARIA' | ''>('');
  const [areaId, setAreaId] = useState('');
  const [gradeScaleType, setGradeScaleType] = useState<'PERU_LETTERS' | 'PERU_VIGESIMAL'>('PERU_LETTERS');

  // Las clases de escuela siempre califican por competencias (así lo guarda el servidor).
  const useCompetencies = competenciesOn || !!schoolId;

  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['curriculum-areas', educationLevel],
    queryFn: () => classroomApi.getCurriculumAreas('PE', educationLevel || undefined),
    enabled: useCompetencies && !!educationLevel,
  });
  const selectedArea = areas.find((a) => a.id === areaId);

  const create = useMutation({
    mutationFn: classroomApi.create,
    onSuccess: (classroom) => {
      queryClient.invalidateQueries({ queryKey: classroomsKey });
      toast.success(`¡Clase "${classroom.name}" creada!`);
      onCreated(classroom);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear la clase')),
  });

  const canSubmit = name.trim().length >= 2 && !create.isPending && (!useCompetencies || (!!educationLevel && !!areaId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gradeLevel: gradeLevel || undefined,
      useCompetencies,
      curriculumAreaId: useCompetencies ? areaId || null : null,
      gradeScaleType: useCompetencies ? gradeScaleType : null,
      schoolId,
    });
  };

  const header = (
    <div className="relative h-28 flex-shrink-0 overflow-hidden">
      <img src="/assets/mascot/jiro-crearclase.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg bg-black/40 text-white hover:bg-black/60">
        <X size={18} aria-hidden="true" />
      </button>
      <div className="absolute bottom-3 left-5">
        <h2 className="text-xl font-bold text-white">Nueva clase</h2>
        <p className="text-sm text-white">Lo esencial ahora; el resto, cuando quieras</p>
      </div>
    </div>
  );

  return (
    <HomeModal
      title="Nueva clase"
      onClose={onClose}
      header={header}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="submit" form="create-class-form" disabled={!canSubmit} className={primaryButton}>
            {create.isPending ? 'Creando...' : 'Crear y entrar'}
          </button>
        </>
      )}
    >
      <form id="create-class-form" onSubmit={submit} className="space-y-4">
        <label className={labelClass}>
          Nombre de la clase
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Matemáticas 3.° A" maxLength={255} required data-autofocus className={`${inputClass} mt-1.5`} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Grado <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span>
            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className={`${inputClass} mt-1.5`}>
              <option value="">Sin grado</option>
              {GRADE_LEVELS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Turno mañana" maxLength={1000} className={`${inputClass} mt-1.5`} />
          </label>
        </div>

        {schools.length > 0 && (
          <fieldset className="space-y-2">
            <legend className={`${labelClass} mb-1.5 flex items-center gap-2`}>
              <School size={16} className="text-primary-700 dark:text-primary-300" aria-hidden="true" />
              Escuela
            </legend>
            {[{ id: null as string | null, name: 'Sin escuela (clase personal)' }, ...schools.map((s) => ({ id: s.id as string | null, name: s.name }))].map((opt) => (
              <label key={opt.id ?? 'none'} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${schoolId === opt.id ? 'border-primary-500 bg-primary-50 text-gray-900 dark:bg-primary-900/30 dark:text-white' : 'border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700'}`}>
                <input type="radio" name="create-school" checked={schoolId === opt.id} onChange={() => setSchoolId(opt.id)} className="h-4 w-4 accent-primary-600" />
                <span className="truncate">{opt.id ? `🏫 ${opt.name}` : opt.name}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <BookOpen size={18} className="mt-0.5 flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
              <div>
                <p id="competencies-label" className="text-sm font-semibold text-gray-900 dark:text-white">Calificar por competencias</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  {schoolId ? 'Obligatorio en las clases de escuela.' : 'Registra notas por competencias del currículo.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useCompetencies}
              aria-labelledby="competencies-label"
              disabled={!!schoolId}
              onClick={() => setCompetenciesOn((v) => !v)}
              className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${useCompetencies ? 'bg-primary-600' : 'bg-gray-400 dark:bg-gray-600'}`}
            >
              <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${useCompetencies ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {useCompetencies && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Nivel
                  <select value={educationLevel} onChange={(e) => { setEducationLevel(e.target.value as 'PRIMARIA' | 'SECUNDARIA' | ''); setAreaId(''); }} className={`${inputClass} mt-1.5`}>
                    <option value="">Elige un nivel</option>
                    <option value="PRIMARIA">Primaria</option>
                    <option value="SECUNDARIA">Secundaria</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Área curricular
                  <select value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!educationLevel || loadingAreas} className={`${inputClass} mt-1.5 disabled:opacity-60`}>
                    <option value="">{loadingAreas ? 'Cargando...' : 'Elige un área'}</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.competencies.length})</option>)}
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Sistema de calificación
                <select value={gradeScaleType} onChange={(e) => setGradeScaleType(e.target.value as 'PERU_LETTERS' | 'PERU_VIGESIMAL')} className={`${inputClass} mt-1.5`}>
                  <option value="PERU_LETTERS">Letras (AD, A, B, C)</option>
                  <option value="PERU_VIGESIMAL">Vigesimal (0 a 20)</option>
                </select>
              </label>
              {selectedArea && (
                <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-800 dark:bg-gray-900/50 dark:text-gray-200">
                  <p className="mb-1 font-bold">Competencias incluidas</p>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {selectedArea.competencies.map((c) => <li key={c.id}>{c.name}</li>)}
                  </ol>
                </div>
              )}
              <p className="text-xs text-gray-700 dark:text-gray-300">🇵🇪 Por ahora solo está disponible el currículo de Perú.</p>
            </div>
          )}
        </div>
      </form>
    </HomeModal>
  );
};
