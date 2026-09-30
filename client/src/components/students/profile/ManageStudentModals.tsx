import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Download, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Student } from '../../../lib/classroomApi';
import { studentApi } from '../../../lib/studentApi';
import { placeholderStudentApi } from '../../../lib/placeholderStudentApi';
import { parentApi } from '../../../lib/parentApi';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton, inputClass, labelClass, primaryButton } from '../../home/homeHelpers';
import { errorMessage } from './profileHelpers';

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado`);
  } catch {
    toast.error('No se pudo copiar');
  }
};

const CodeBox = ({ code, label }: { code: string; label: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 p-4 dark:border-primary-700 dark:bg-primary-900/30">
    <span className="font-mono text-2xl font-black tracking-widest text-gray-900 dark:text-white">{code}</span>
    <button type="button" onClick={() => copy(code, label)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
      <Copy size={16} aria-hidden="true" /> Copiar
    </button>
  </div>
);

// ---------- Editar nombres ----------

export const EditNamesModal = ({ classroomId, student, onClose }: { classroomId: string; student: Student; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [realName, setRealName] = useState(student.displayName || [student.realName, student.realLastName].filter(Boolean).join(' '));
  const [characterName, setCharacterName] = useState(student.characterName || '');
  const [saving, setSaving] = useState(false);
  const valid = realName.trim().length >= 2 && characterName.trim().length >= 2;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await studentApi.updateStudent(student.id, { displayName: realName.trim(), characterName: characterName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      toast.success('Nombres actualizados');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudieron guardar los nombres'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HomeModal
      title="Editar nombres"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={save} disabled={!valid || saving} className={primaryButton}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Guardar
        </button>
      </>}
    >
      <div>
        <label htmlFor="edit-real" className={labelClass}>Nombre del alumno</label>
        <input id="edit-real" data-autofocus value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={100} className={`${inputClass} mt-1`} />
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Lo ves tú y aparece en informes.</p>
      </div>
      <div>
        <label htmlFor="edit-character" className={labelClass}>Nombre de personaje</label>
        <input id="edit-character" value={characterName} onChange={(e) => setCharacterName(e.target.value)} maxLength={100} className={`${inputClass} mt-1`} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>
      {!valid && <p className="text-sm text-red-700 dark:text-red-300">Cada nombre necesita al menos 2 caracteres.</p>}
    </HomeModal>
  );
};

// ---------- Código de acceso ----------

export const AccessCodeModal = ({ classroomId, student, name, onClose }: { classroomId: string; student: Student; name: string; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(student.linkCode ?? null);
  const [busy, setBusy] = useState<'regen' | 'pdf' | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const regenerate = async () => {
    setBusy('regen');
    try {
      const result = await placeholderStudentApi.regenerateCode(student.id);
      setCode(result.linkCode);
      setConfirmRegen(false);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      toast.success('Código nuevo generado: el anterior ya no sirve');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo generar el código'));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('pdf');
    try {
      await placeholderStudentApi.downloadSingleCardPDF(student.id, name);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo descargar la tarjeta'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <HomeModal title={student.linkedEmail ? 'Cuenta del alumno' : 'Código de acceso'} subtitle={name} onClose={onClose}
      footer={<button type="button" onClick={onClose} className={cancelButton}>Cerrar</button>}>
      {student.linkedEmail ? (
        <p className="text-sm text-gray-800 dark:text-gray-100">
          Ya entra con su cuenta <strong>{student.linkedEmail}</strong>. No necesita código.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-800 dark:text-gray-100">Con este código el alumno vincula su cuenta y conserva todo su progreso.</p>
          {code ? <CodeBox code={code} label="Código" /> : <p className="text-sm text-gray-700 dark:text-gray-300">Este alumno no tiene código todavía.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={!!busy || !code} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
              {busy === 'pdf' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Tarjeta en PDF
            </button>
            {!confirmRegen ? (
              <button type="button" onClick={() => setConfirmRegen(true)} disabled={!!busy} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                <RefreshCw size={16} aria-hidden="true" /> {code ? 'Cambiar código' : 'Generar código'}
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-50">
                El código actual dejará de funcionar.
                <button type="button" onClick={regenerate} disabled={!!busy} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-amber-700 px-3 font-semibold text-white hover:bg-amber-800">
                  {busy === 'regen' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Confirmar
                </button>
                <button type="button" onClick={() => setConfirmRegen(false)} className="min-h-[40px] rounded-lg px-2 font-semibold">Cancelar</button>
              </span>
            )}
          </div>
        </>
      )}
    </HomeModal>
  );
};

// ---------- Código para la familia ----------

export const FamilyCodeModal = ({ student, name, onClose }: { student: Student; name: string; onClose: () => void }) => {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const result = await parentApi.generateParentLinkCode(student.id);
      setCode(result.code);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo generar el código'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HomeModal title="Código para la familia" subtitle={name} onClose={onClose}
      footer={<button type="button" onClick={onClose} className={cancelButton}>Cerrar</button>}>
      <p className="text-sm text-gray-800 dark:text-gray-100">
        Con este código, madre, padre o tutor se vinculan desde su cuenta de familia y ven el progreso de {name}.
      </p>
      {code ? (
        <CodeBox code={code} label="Código para la familia" />
      ) : (
        <button type="button" onClick={generate} disabled={busy} data-autofocus className={primaryButton}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />} Generar código
        </button>
      )}
    </HomeModal>
  );
};

// ---------- Retirar de la clase ----------

export const RemoveStudentModal = ({ student, name, onRemoved, onClose }: { student: Student; name: string; onRemoved: () => void; onClose: () => void }) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es');

  const remove = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await studentApi.removeFromClass(student.id);
      toast.success(`${name} fue retirado de la clase`);
      onRemoved();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo retirar al alumno'));
      setBusy(false);
    }
  };

  return (
    <HomeModal title="Retirar de la clase" subtitle={name} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={remove} disabled={!ok || busy} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Retirar para siempre
        </button>
      </>}>
      <p className="text-sm text-gray-800 dark:text-gray-100">
        Se borran su progreso, insignias, compras, notas y asistencia en esta clase. <strong>No se puede deshacer.</strong>
      </p>
      <div>
        <label htmlFor="remove-confirm" className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Escribe «{name}» para confirmar</label>
        <input id="remove-confirm" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={`${inputClass} mt-1`} />
      </div>
    </HomeModal>
  );
};
