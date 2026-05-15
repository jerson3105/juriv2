import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, Eye, Link2, RotateCcw, Shield, Wrench, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Student } from '../../lib/classroomApi';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import { studentApi } from '../../lib/studentApi';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type StudentAccountStatus = 'LINKED' | 'PENDING_LINK' | 'DEMO';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  student: Student | null;
  onViewProfile?: () => void;
}

const getStudentAccountStatus = (student: Student): StudentAccountStatus => {
  if (student.isDemo) return 'DEMO';
  if (student.linkCode) return 'PENDING_LINK';
  return 'LINKED';
};

const getStatusMeta = (status: StudentAccountStatus) => {
  if (status === 'LINKED') {
    return {
      label: 'Vinculado',
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      description: 'El estudiante ya registró y vinculó su cuenta.',
    };
  }

  if (status === 'DEMO') {
    return {
      label: 'Demo',
      tone: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
      description: 'Perfil de demostración para onboarding del aula.',
    };
  }

  return {
    label: 'Pendiente',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    description: 'El estudiante aún no ha vinculado su cuenta.',
  };
};

export const StudentManagementModal = ({
  isOpen,
  onClose,
  classroomId,
  student,
  onViewProfile,
}: Props) => {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);

  const status = student ? getStudentAccountStatus(student) : null;
  const statusMeta = status ? getStatusMeta(status) : null;
  const realName = useMemo(() => {
    if (!student) return '';
    return [student.realName, student.realLastName].filter(Boolean).join(' ').trim();
  }, [student]);

  useEffect(() => {
    if (!isOpen || !student) return;

    setDisplayName(student.displayName || '');
    setCharacterName(student.characterName || '');
  }, [isOpen, student]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!student || !status) {
        throw new Error('No se encontró el estudiante');
      }

      const payload: { displayName?: string; characterName?: string } = {};
      const nextDisplayName = displayName.trim();
      const nextCharacterName = characterName.trim();
      const currentDisplayName = (student.displayName || '').trim();
      const currentCharacterName = (student.characterName || '').trim();

      if (status !== 'LINKED' && nextDisplayName.length >= 2 && nextDisplayName !== currentDisplayName) {
        payload.displayName = nextDisplayName;
      }

      if (nextCharacterName.length >= 2 && nextCharacterName !== currentCharacterName) {
        payload.characterName = nextCharacterName;
      }

      if (Object.keys(payload).length === 0) {
        throw new Error('No hay cambios válidos para guardar');
      }

      return studentApi.updateStudent(student.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroomId] });
      toast.success('Información del estudiante actualizada');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar el estudiante');
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: async () => {
      if (!student) {
        throw new Error('No se encontró el estudiante');
      }

      return placeholderStudentApi.regenerateCode(student.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['placeholder-students', classroomId] });
      toast.success(`Código regenerado: ${result.linkCode}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Error al regenerar el código');
    },
  });

  if (!isOpen || !student || !statusMeta) return null;

  const nextDisplayName = displayName.trim();
  const nextCharacterName = characterName.trim();
  const currentDisplayName = (student.displayName || '').trim();
  const currentCharacterName = (student.characterName || '').trim();
  const canEditDisplayName = status !== 'LINKED';
  const hasValidDisplayNameChange = canEditDisplayName && nextDisplayName.length >= 2 && nextDisplayName !== currentDisplayName;
  const hasValidCharacterNameChange = nextCharacterName.length >= 2 && nextCharacterName !== currentCharacterName;
  const canSave = hasValidDisplayNameChange || hasValidCharacterNameChange;

  const handleCopyCode = () => {
    if (!student.linkCode) return;
    navigator.clipboard.writeText(student.linkCode);
    toast.success('Código copiado');
  };

  const handleDownloadCard = async () => {
    if (!student.linkCode) return;

    setIsDownloadingCard(true);
    try {
      await placeholderStudentApi.downloadSingleCardPDF(
        student.id,
        (student.displayName || student.characterName || 'estudiante').replace(/\s+/g, '-').toLowerCase()
      );
      toast.success('Tarjeta descargada');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al descargar la tarjeta');
    } finally {
      setIsDownloadingCard(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Wrench size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar estudiante</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statusMeta.description}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Shield size={16} />
                Cuenta del estudiante
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Estado</p>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                    {status === 'LINKED' ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} className="text-amber-500" />}
                    {statusMeta.label}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nombre real</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{realName || 'Sin cuenta vinculada todavía'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Correo</p>
                  <p className="mt-1 break-all text-sm text-gray-700 dark:text-gray-200">{student.linkedEmail || 'No disponible'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Código de vínculo</p>
                  {student.linkCode ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-semibold text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-100">
                        {student.linkCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">No aplica</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Wrench size={16} />
                Perfil del aula
              </div>

              <div className="space-y-4">
                {canEditDisplayName && (
                  <Input
                    label="Nombre del estudiante"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Nombre para registrar o invitar"
                    helperText="Se usa antes de que el estudiante vincule su cuenta."
                  />
                )}

                <Input
                  label="Nombre del personaje"
                  value={characterName}
                  onChange={(event) => setCharacterName(event.target.value)}
                  placeholder="Nombre visible dentro del aula"
                  helperText="Puedes ajustarlo sin tocar los datos reales de la cuenta."
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {student.linkCode && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyCode}
                    className="!border !border-gray-300 dark:!border-gray-600"
                  >
                    <Copy size={14} className="mr-1" />
                    Copiar código
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => regenerateCodeMutation.mutate()}
                    disabled={regenerateCodeMutation.isPending}
                    className="!border !border-gray-300 dark:!border-gray-600"
                  >
                    <RotateCcw size={14} className="mr-1" />
                    Regenerar código
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownloadCard}
                    disabled={isDownloadingCard}
                    className="!border !border-gray-300 dark:!border-gray-600"
                  >
                    <Download size={14} className="mr-1" />
                    Descargar tarjeta
                  </Button>
                </>
              )}

              {onViewProfile && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onViewProfile}
                  className="!border !border-gray-300 dark:!border-gray-600"
                >
                  <Eye size={14} className="mr-1" />
                  Ver perfil
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end dark:border-gray-700 dark:bg-gray-900/40">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
            >
              Guardar cambios
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};