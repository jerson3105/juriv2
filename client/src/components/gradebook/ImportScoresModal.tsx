import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { gradeApi, type GradeEvaluationDetail, type ImportPreviewRow } from '../../lib/gradeApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { errorMessage, secondaryButton } from './gradebookHelpers';

interface ImportScoresModalProps {
  evaluation: GradeEvaluationDetail;
  onClose: () => void;
  onImported: (evaluation: GradeEvaluationDetail) => void;
}

const STATUS_TEXT: Record<ImportPreviewRow['status'], { label: string; style: string }> = {
  OK: { label: 'Lista', style: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' },
  EMPTY: { label: 'Sin nota', style: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100' },
  UNKNOWN_STUDENT: { label: 'Alumno no encontrado', style: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100' },
  INVALID_VALUE: { label: 'Nota inválida', style: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100' },
  DUPLICATE: { label: 'Repetido', style: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100' },
};

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

// Importar notas: plantilla Excel con los alumnos → subir o pegar → revisar → guardar solo las válidas.
export const ImportScoresModal = ({ evaluation, onClose, onImported }: ImportScoresModalProps) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null);
  const [busy, setBusy] = useState<null | 'template' | 'preview' | 'save'>(null);

  const preview = async (input: { fileBase64?: string; text?: string }) => {
    setBusy('preview');
    try {
      setRows((await gradeApi.previewImport(evaluation.id, input)).rows);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron leer las notas'));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      toast.error('Sube un archivo de Excel (.xlsx) o pega las notas');
      return;
    }
    await preview({ fileBase64: await toBase64(file) });
  };

  const ready = rows?.filter((r) => r.status === 'OK') ?? [];
  const problems = rows?.filter((r) => r.status === 'UNKNOWN_STUDENT' || r.status === 'INVALID_VALUE' || r.status === 'DUPLICATE') ?? [];

  const save = async () => {
    if (ready.length === 0) return;
    setBusy('save');
    try {
      const updated = await gradeApi.saveEvaluationScores(evaluation.id, ready.map((r) => ({ studentProfileId: r.studentProfileId!, value: r.value, note: r.note })));
      await queryClient.invalidateQueries({ queryKey: ['classroom-grades', evaluation.classroomId] });
      await queryClient.invalidateQueries({ queryKey: ['grade-evaluations', evaluation.classroomId] });
      toast.success(`${ready.length} ${ready.length === 1 ? 'nota importada' : 'notas importadas'}`);
      onImported(updated);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar las notas'));
      setBusy(null);
    }
  };

  return (
    <HomeModal
      title="Importar notas"
      subtitle={evaluation.title}
      size="lg"
      onClose={onClose}
      footer={rows ? <>
        <button type="button" onClick={() => setRows(null)} className={cancelButton}>Volver</button>
        <button type="button" onClick={save} disabled={ready.length === 0 || busy !== null} className={primaryButton}>
          {busy === 'save' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar {ready.length} {ready.length === 1 ? 'nota' : 'notas'}
        </button>
      </> : <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>}
    >
      {!rows ? (
        <>
          <ol className="space-y-4">
            <li>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">1. Descarga la plantilla con tus alumnos</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">Ya trae los nombres; solo escribe la nota en la columna «Nota».</p>
              <button type="button" disabled={busy !== null} className={`${secondaryButton} mt-2`}
                onClick={async () => {
                  setBusy('template');
                  try { await gradeApi.downloadEvaluationTemplate(evaluation.id, evaluation.title); } catch (error) { toast.error(errorMessage(error, 'No se pudo descargar la plantilla')); } finally { setBusy(null); }
                }}>
                {busy === 'template' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Descargar plantilla (.xlsx)
              </button>
            </li>
            <li>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">2. Súbela cuando la llenes</p>
              <label className={`${secondaryButton} mt-2 cursor-pointer`}>
                {busy === 'preview' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />} Elegir archivo
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            </li>
          </ol>
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <label htmlFor="import-paste" className={labelClass}>O pega desde tu hoja de cálculo</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">Copia dos columnas: nombre del alumno y nota (una fila por alumno).</p>
            <textarea id="import-paste" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ana Pérez\tA\nBruno Díaz\tAD'} className={`${inputClass} mt-1 font-mono`} />
            <button type="button" className={`${primaryButton} mt-2`} disabled={!text.trim() || busy !== null} onClick={() => preview({ text })}>
              {busy === 'preview' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Revisar notas
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <CheckCircle2 size={18} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <span><strong>{ready.length}</strong> {ready.length === 1 ? 'lista' : 'listas'} para guardar{problems.length > 0 && <> · <strong>{problems.length}</strong> con problemas (no se guardan)</>}.</span>
          </p>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-bold text-gray-900 dark:text-white">En el archivo</th>
                  <th scope="col" className="px-3 py-2 text-left font-bold text-gray-900 dark:text-white">Alumno</th>
                  <th scope="col" className="px-3 py-2 text-left font-bold text-gray-900 dark:text-white">Nota</th>
                  <th scope="col" className="px-3 py-2 text-left font-bold text-gray-900 dark:text-white">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[...problems, ...ready, ...(rows.filter((r) => r.status === 'EMPTY'))].map((row) => (
                  <tr key={`${row.line}-${row.name}`}>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{row.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{row.studentName ?? '—'}</td>
                    <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">{row.label ?? row.value ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TEXT[row.status].style}`}>{STATUS_TEXT[row.status].label}</span>
                      {row.message && row.status !== 'EMPTY' && <span className="mt-1 block text-sm text-gray-700 dark:text-gray-300">{row.message}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </HomeModal>
  );
};
