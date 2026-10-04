import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, CalendarClock, CheckCircle2, ExternalLink, FileText, Hourglass, ImagePlus, Loader2, Lock, MessageSquareQuote, RotateCcw, School, Trash2 } from 'lucide-react';
import { SidePanel } from '../../gradebook/SidePanel';
import { primaryButton } from '../../home/homeHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { GENIALLY_SANDBOX, isGeniallyEmbed } from '../../../lib/geniallyEmbed';
import {
  assetUrl, expeditionApi, expeditionKeys,
  type ExpeditionResource, type StudentExpedition, type StudentStop,
} from '../../../lib/expeditionApi';
import { KIND_INFO, MAX_UPLOAD_BYTES, STATE_INFO, compressImage, dueLabel, isImageFile, isOverdue, resourceLabel, rewardLabel } from '../expeditionHelpers';
import { ChallengePlayer } from './ChallengePlayer';

const MAX_FILES = 3;

export const ResourceList = ({ resources }: { resources: ExpeditionResource[] }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (resources.length === 0) return null;
  return (
    <ul className="space-y-2">
      {resources.map((resource) => {
        const genially = resource.kind === 'LINK' && isGeniallyEmbed(resource.url);
        return (
          <li key={resource.url} className="rounded-xl border border-gray-200 p-2 dark:border-gray-700">
            {resource.kind === 'FILE' && isImageFile(resource.url) ? (
              <a href={assetUrl(resource.url)} target="_blank" rel="noopener noreferrer" className="block">
                <img src={assetUrl(resource.url)} alt={resource.name ?? 'Imagen de la parada'} className="max-h-64 w-full rounded-lg object-contain" loading="lazy" />
              </a>
            ) : (
              <div className="flex items-center gap-2">
                <FileText size={18} className="flex-shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{resourceLabel(resource)}</span>
                {genially && (
                  <button type="button" onClick={() => setOpen(open === resource.url ? null : resource.url)} className="pg-btn" aria-expanded={open === resource.url}>
                    {open === resource.url ? 'Ocultar' : 'Ver aquí'}
                  </button>
                )}
                <a href={assetUrl(resource.url)} target="_blank" rel="noopener noreferrer" className="pg-btn" aria-label={`Abrir ${resourceLabel(resource)} en otra pestaña`}>
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </div>
            )}
            {genially && open === resource.url && (
              <div className="mt-2 aspect-video overflow-hidden rounded-lg">
                <iframe src={resource.url} title={resourceLabel(resource)} className="h-full w-full" sandbox={GENIALLY_SANDBOX} referrerPolicy="no-referrer" allowFullScreen />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** Archivos o texto corto. Las fotos del celular se achican antes de subir (el límite es 5 MB). */
const EvidenceForm = ({ stop, onSubmitted, preview }: { stop: StudentStop; onSubmitted: (data: StudentExpedition) => void; preview: boolean }) => {
  const [files, setFiles] = useState<{ url: string; name: string | null }[]>([]);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) return toast.error(`Puedes subir hasta ${MAX_FILES} archivos`);
    setUploading(true);
    try {
      for (const raw of [...list].slice(0, room)) {
        const file = await compressImage(raw);
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`«${raw.name}» pesa más de 5 MB`);
          continue;
        }
        const uploaded = await expeditionApi.upload(file);
        setFiles((current) => [...current, uploaded]);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo subir el archivo'));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  const submit = useMutation({
    mutationFn: () => expeditionApi.submitEvidence(stop.id, { files: files.map((f) => f.url), note: note.trim() || null }),
    onSuccess: (data) => {
      toast.success(stop.reviewMode === 'ADVANCE' ? '¡Entregada! Tu profe la revisará' : '¡Entregada! Tu profe la revisará antes de seguir');
      setFiles([]);
      setNote('');
      onSubmitted(data);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo entregar')),
  });

  const ready = (files.length > 0 || note.trim().length > 0) && !uploading;
  return (
    <div className="space-y-3">
      <div>
        <input ref={input} type="file" accept="image/*,application/pdf" multiple className="sr-only" id={`evidence-${stop.id}`}
          onChange={(event) => void upload(event.target.files)} disabled={preview || uploading || files.length >= MAX_FILES} />
        <label htmlFor={`evidence-${stop.id}`}
          className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700/50 ${preview || files.length >= MAX_FILES ? 'pointer-events-none opacity-60' : ''}`}>
          {uploading ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
          {uploading ? 'Subiendo…' : 'Sube una foto o un archivo'}
          <span className="text-xs font-normal text-gray-700 dark:text-gray-300">Imagen o PDF · hasta {MAX_FILES}</span>
        </label>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={file.url} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 dark:border-gray-700">
              {isImageFile(file.url)
                ? <img src={assetUrl(file.url)} alt="" className="h-10 w-10 rounded object-cover" />
                : <FileText size={18} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{file.name ?? 'Archivo'}</span>
              <button type="button" onClick={() => setFiles((current) => current.filter((f) => f.url !== file.url))} className="pg-icon-btn" aria-label={`Quitar ${file.name ?? 'archivo'}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">O escribe tu respuesta (opcional)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} disabled={preview}
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
      </label>
      <button type="button" disabled={preview || !ready || submit.isPending} onClick={() => submit.mutate()} className={`${primaryButton} w-full`}>
        {submit.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Entregar
      </button>
    </div>
  );
};

const StateLine = ({ stop }: { stop: StudentStop }) => {
  const info = STATE_INFO[stop.state];
  const Icon = stop.state === 'LOCKED' ? Lock : stop.state === 'WAITING' ? Hourglass : stop.state === 'NEEDS_WORK' ? RotateCcw : stop.state === 'DONE' ? CheckCircle2 : ArrowRight;
  const tone = {
    locked: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
    open: 'bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-50',
    wait: 'bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-50',
    fix: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-50',
    done: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50',
  }[info.tone];
  return (
    <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${tone}`}>
      <Icon size={16} aria-hidden="true" />
      {info.label}
    </p>
  );
};

/**
 * Hoja de una parada (panel lateral en escritorio, hoja inferior en el celular): qué lograr, el relato de Jiro,
 * los recursos y la acción según el tipo. Una parada bloqueada solo muestra su título.
 */
export const StopSheet = ({ expedition, stop, number, previousTitle, preview = false, onClose }: {
  expedition: StudentExpedition;
  stop: StudentStop;
  number: number;
  previousTitle: string | null;
  preview?: boolean;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState(false);
  const [changing, setChanging] = useState(false);
  const kind = KIND_INFO[stop.kind];
  const closed = expedition.status === 'ARCHIVED';

  const applyResult = (data: StudentExpedition) => {
    queryClient.setQueryData(expeditionKeys.play(expedition.id), data);
    void queryClient.invalidateQueries({ queryKey: ['my-expeditions'] });
    // XP y oro de la barra superior (una parada o la meta pueden pagar).
    void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
  };

  const continueStory = useMutation({
    mutationFn: () => expeditionApi.continueStory(stop.id),
    onSuccess: (data) => {
      applyResult(data);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo avanzar')),
  });

  const title = `Parada ${number} · ${kind.label}`;
  const reward = rewardLabel(stop.rewardXp, stop.rewardGold);

  if (playing && stop.kind === 'CHALLENGE' && !preview) {
    return (
      <SidePanel title={stop.title} subtitle={title} onClose={onClose} wide>
        {/* El panel se dibuja en un portal: data-pg trae los colores de pg. */}
        <div data-pg=""><ChallengePlayer stop={stop} onExit={() => setPlaying(false)} /></div>
      </SidePanel>
    );
  }

  const locked = stop.state === 'LOCKED';
  const canAct = !preview && !closed && !locked;
  const footer = (() => {
    if (locked || closed) return undefined;
    if (stop.kind === 'STORY' && stop.state !== 'DONE') {
      return (
        <button type="button" disabled={!canAct || continueStory.isPending} onClick={() => continueStory.mutate()} className={primaryButton} data-autofocus>
          {continueStory.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Seguir <ArrowRight size={16} aria-hidden="true" />
        </button>
      );
    }
    if (stop.kind === 'CHALLENGE') {
      const label = stop.state === 'DONE' ? 'Ver mi resultado' : stop.state === 'STARTED' ? 'Seguir el reto' : 'Empezar el reto';
      return (
        <button type="button" disabled={preview} onClick={() => setPlaying(true)} className={primaryButton} data-autofocus>
          {label} <ArrowRight size={16} aria-hidden="true" />
        </button>
      );
    }
    return undefined;
  })();

  return (
    <SidePanel title={stop.title} subtitle={title} onClose={onClose} footer={footer} wide={stop.kind === 'EVIDENCE'}>
      <div data-pg="" className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StateLine stop={stop} />
        {stop.goldStar && <span className="pg-gold px-3 py-1 text-sm font-bold">⭐ Estrella dorada</span>}
      </div>

      {locked && (
        <p className="text-sm text-gray-800 dark:text-gray-200">
          {previousTitle ? `Se abre cuando termines «${previousTitle}».` : 'Se abre cuando termines la parada anterior.'}
          {preview && ' (Vista previa: tú ves el contenido; tu alumno, no hasta llegar.)'}
        </p>
      )}
      {(!locked || preview) && (
        <>
          {(stop.goal || stop.successCriteria) && (
            <dl className="space-y-1.5 rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-950/50">
              {stop.goal && <div><dt className="font-bold text-indigo-950 dark:text-indigo-100">Lo que vas a lograr</dt><dd className="text-indigo-950 dark:text-indigo-50">{stop.goal}</dd></div>}
              {stop.successCriteria && <div><dt className="font-bold text-indigo-950 dark:text-indigo-100">Cómo sabrás que lo lograste</dt><dd className="text-indigo-950 dark:text-indigo-50">{stop.successCriteria}</dd></div>}
            </dl>
          )}

          {stop.story && (
            <blockquote className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-base text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">Jiro cuenta</p>
              <p className="whitespace-pre-line">{stop.story}</p>
            </blockquote>
          )}

          {stop.mission && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{stop.kind === 'CLASS' ? 'En clase' : 'Tu misión'}</h3>
              <p className="mt-1 whitespace-pre-line text-base text-gray-900 dark:text-gray-100">{stop.mission}</p>
            </div>
          )}

          <ResourceList resources={stop.resources} />

          {stop.kind === 'CHALLENGE' && (
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {stop.questionCount} preguntas · se supera con {stop.passPercent} % (si no llegas, reintentas las que fallaste)
              {stop.firstScore !== null ? ` · tu primer intento: ${stop.firstScore} %` : ''}
            </p>
          )}

          {stop.kind === 'CLASS' && stop.state !== 'DONE' && (
            <p className="flex items-start gap-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100">
              <School size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Esta parada se hace en clase con tu profe. Cuando la hagan juntos, se marca sola.
            </p>
          )}

          {stop.kind === 'EVIDENCE' && (
            <div className="space-y-3">
              {stop.review === 'NEEDS_WORK' && (
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/60">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50"><MessageSquareQuote size={16} aria-hidden="true" /> Tu profe te pide mejorar</p>
                  {stop.feedback && <p className="mt-1 text-base text-slate-900 dark:text-slate-50">«{stop.feedback}»</p>}
                  <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">Vuelve a entregarla: mejorar recibe la misma recompensa.</p>
                </div>
              )}
              {stop.review === 'APPROVED' && (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50">
                  ¡Tu profe aprobó tu evidencia!{stop.feedback ? ` «${stop.feedback}»` : ''}
                </p>
              )}
              {stop.review === 'PENDING' && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-50">
                  {stop.state === 'WAITING' ? 'Entregada. Tu profe la revisa antes de que sigas.' : 'Entregada. Ya puedes seguir: tu profe la revisará.'}
                </p>
              )}
              {stop.evidence && (
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Tu última entrega</p>
                  {stop.evidence.note && <p className="mt-1 whitespace-pre-line text-sm text-gray-900 dark:text-gray-100">{stop.evidence.note}</p>}
                  {stop.evidence.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stop.evidence.files.map((file) => (
                        <a key={file} href={assetUrl(file)} target="_blank" rel="noopener noreferrer" className="block">
                          {isImageFile(file)
                            ? <img src={assetUrl(file)} alt="Tu evidencia" className="h-16 w-16 rounded-lg object-cover" />
                            : <span className="pg-btn"><FileText size={16} aria-hidden="true" /> PDF</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {stop.review !== 'APPROVED' && canAct && (
                // Ya entregó y espera revisión: el formulario queda detrás de «Cambiar mi entrega» (así no parece que no
                // se envió). Si su profe pidió mejorar, va directo.
                !stop.evidence || stop.review === 'NEEDS_WORK' || changing
                  ? <EvidenceForm stop={stop} onSubmitted={(data) => { setChanging(false); applyResult(data); }} preview={preview} />
                  : <button type="button" onClick={() => setChanging(true)} className="pg-btn">Cambiar mi entrega</button>
              )}
              {preview && <p className="text-xs text-gray-700 dark:text-gray-300">Vista previa: así lo verá tu alumno.</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 pt-3 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200">
            <span className="font-semibold">Recompensa: {reward}</span>
            {stop.dueAt && (
              <span className={`inline-flex items-center gap-1 ${isOverdue(stop.dueAt) && stop.state !== 'DONE' ? 'font-bold text-red-700 dark:text-red-300' : ''}`}>
                <CalendarClock size={15} aria-hidden="true" /> {dueLabel(stop.dueAt)}
              </span>
            )}
          </div>
        </>
      )}
      </div>
    </SidePanel>
  );
};
