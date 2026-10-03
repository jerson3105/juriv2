import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, Ellipsis, KeyRound, MessageCircle, Printer, Search, UserMinus } from 'lucide-react';
import { Popover } from '../ui/Popover';
import { ConfirmModal } from '../ui/ConfirmModal';
import { cancelButton, primaryButton } from '../home/homeHelpers';
import { errorMessage } from '../auth/authHelpers';
import { verificationApi } from '../../lib/verificationApi';
import { parentApi } from '../../lib/parentApi';
import { openParentFlyers } from '../../lib/parentFlyers';
import { familyRoomApi, familyRoomKeys, RELATIONSHIP_LABEL, type RoomFamilies, type RoomFamiliesStudent, type RoomFamilyRequest } from '../../lib/familyRoomApi';
import { familyInviteText } from './roomFormat';

type Filter = 'all' | 'without' | 'with';

interface FamiliesTabProps {
  classroomId: string;
  classroomName: string;
  data: RoomFamilies | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Pestaña «Familias»: quién falta, sus códigos, folletos, solicitudes por aprobar y quitar una familia. */
export const FamiliesTab = ({ classroomId, classroomName, data, isLoading, isError }: FamiliesTabProps) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [toRevoke, setToRevoke] = useState<{ linkId: string; name: string; studentName: string } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: familyRoomKeys.families(classroomId) });
    void queryClient.invalidateQueries({ queryKey: familyRoomKeys.room(classroomId) });
    void queryClient.invalidateQueries({ queryKey: ['family-requests'] });
  };

  const review = useMutation({
    mutationFn: ({ request, approved }: { request: RoomFamilyRequest; approved: boolean }) =>
      approved ? verificationApi.approveFamily(request.linkId) : verificationApi.rejectFamily(request.linkId),
    onSuccess: (_, { request, approved }) => {
      refresh();
      toast.success(approved ? `${request.parentName} ya está en la sala` : 'Solicitud rechazada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar la solicitud')),
  });
  const revoke = useMutation({
    mutationFn: (linkId: string) => familyRoomApi.revokeFamily(classroomId, linkId),
    onSuccess: () => {
      refresh();
      setToRevoke(null);
      toast.success('Familia quitada de la clase');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar a la familia')),
  });
  const generate = useMutation({
    mutationFn: () => parentApi.generateBulkParentLinkCodes(classroomId),
    onSuccess: () => {
      refresh();
      toast.success('Códigos listos');
    },
    onError: () => toast.error('No se pudieron generar los códigos'),
  });

  const printFlyers = async () => {
    const result = await openParentFlyers(classroomId);
    if ('error' in result) toast.error(result.error);
    refresh();
  };
  const copy = (text: string, done: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success(done)).catch(() => toast.error('No se pudo copiar'));
  };

  const students = useMemo(() => data?.students ?? [], [data]);
  const missingCodes = students.filter((s) => !s.code).length;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return students.filter((s) =>
      (filter === 'all' || (filter === 'with') === s.families.length > 0)
      && (!term || s.studentName.toLocaleLowerCase('es').includes(term) || s.families.some((f) => f.name.toLocaleLowerCase('es').includes(term))));
  }, [students, filter, search]);

  if (isLoading) return <p className="py-8 text-center text-sm pg-fg2">Cargando familias…</p>;
  if (isError || !data) return <p className="py-8 text-center text-sm pg-alert">No se pudieron cargar las familias. Vuelve a intentarlo.</p>;
  if (students.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--pg-control)] p-8 text-center text-sm pg-fg2">Primero agrega estudiantes a la clase: cada familia se une con el código de su hijo o hija.</p>;
  }

  const without = students.length - data.totals.withFamily;
  return (
    <div className="space-y-4">
      {data.pending.length > 0 && (
        <section aria-labelledby="family-pending" className="pg-surface p-4">
          <h2 id="family-pending" className="font-bold">
            {data.pending.length === 1 ? '1 familia espera tu aprobación' : `${data.pending.length} familias esperan tu aprobación`}
          </h2>
          <p className="text-sm pg-fg2">Confirma que es la familia de tu estudiante antes de que vea su progreso y los avisos.</p>
          <ul className="mt-2 divide-y divide-[var(--pg-line)]">
            {data.pending.map((request) => {
              const busy = review.isPending && review.variables?.request.linkId === request.linkId;
              return (
                <li key={request.linkId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">{request.parentName} <span className="font-normal pg-fg2">· {RELATIONSHIP_LABEL[request.relationship]}</span></p>
                    {request.parentEmail && <p className="break-all pg-fg2">{request.parentEmail}</p>}
                    <p>Quiere ver a <strong>{request.studentName}</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => review.mutate({ request, approved: false })} disabled={busy} className={cancelButton}>Rechazar</button>
                    <button type="button" onClick={() => review.mutate({ request, approved: true })} disabled={busy} className={primaryButton}>Aprobar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm pg-fg2">
          <strong className="pg-fg">{data.totals.withFamily} de {students.length}</strong> estudiantes con su familia en la sala.
          {' '}Envía a cada familia su código por privado: nunca en el grupo.
        </p>
        <div className="flex flex-wrap gap-2">
          {missingCodes > 0 && (
            <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending} className="pg-btn">
              <KeyRound size={16} aria-hidden="true" />
              {generate.isPending ? 'Generando…' : `Generar ${missingCodes} ${missingCodes === 1 ? 'código' : 'códigos'}`}
            </button>
          )}
          <button type="button" onClick={() => void printFlyers()} className="pg-btn">
            <Printer size={16} aria-hidden="true" />
            Imprimir folletos
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['all', `Todos (${students.length})`], ['without', `Sin familia (${without})`], ['with', `Con familia (${data.totals.withFamily})`]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className="pg-chip">{label}</button>
        ))}
        <label className="relative w-full sm:ml-auto sm:w-64">
          <span className="sr-only">Buscar estudiante o familia</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 pg-fg2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar estudiante o familia"
            className="pg-focus h-10 w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] pl-9 pr-3 text-sm pg-fg placeholder:text-[var(--pg-fg2)] [@media(pointer:coarse)]:h-11"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--pg-control)] p-6 text-center text-sm pg-fg2">Nadie coincide con la búsqueda.</p>
      ) : (
        <ul className="pg-surface divide-y divide-[var(--pg-line)]">
          {visible.map((student) => (
            <StudentFamilyRow
              key={student.studentId}
              student={student}
              onCopyCode={(code) => copy(code, 'Código copiado')}
              onCopyInvite={(code) => copy(familyInviteText({ studentName: student.studentName, code, classroomName }), 'Mensaje copiado: pégalo en el chat privado con esa familia')}
              onRevoke={(family) => setToRevoke({ linkId: family.linkId, name: family.name, studentName: student.studentName })}
            />
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.linkId)}
        title={`¿Quitar a ${toRevoke?.name ?? 'esta familia'}?`}
        message={`Dejará de ver los avisos y el progreso de ${toRevoke?.studentName ?? 'su hijo o hija'}. Podrá volver a pedirlo con el código, y tú decides si la apruebas.`}
        confirmText="Quitar"
        isLoading={revoke.isPending}
      />
    </div>
  );
};

const StudentFamilyRow = ({ student, onCopyCode, onCopyInvite, onRevoke }: {
  student: RoomFamiliesStudent;
  onCopyCode: (code: string) => void;
  onCopyInvite: (code: string) => void;
  onRevoke: (family: RoomFamiliesStudent['families'][number]) => void;
}) => (
  <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
    <div className="min-w-0 flex-1">
      <p className="font-semibold">{student.studentName}</p>
      {student.families.length === 0
        ? <p className="text-sm pg-fg2">Sin familia aún</p>
        : student.families.map((family) => (
          <p key={family.linkId} className="flex items-center gap-1 text-sm">
            <span className="min-w-0 truncate">{family.name} <span className="pg-fg2">· {RELATIONSHIP_LABEL[family.relationship]}</span></span>
            <FamilyMenu name={family.name} onRevoke={() => onRevoke(family)} />
          </p>
        ))}
    </div>
    {student.code ? (
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded-md bg-[var(--pg-hover)] px-2 py-1 font-mono text-sm font-bold tracking-wider" aria-label={`Código ${student.code.split('').join(' ')}`}>{student.code}</span>
        <button type="button" onClick={() => onCopyCode(student.code!)} className="pg-icon-btn" aria-label={`Copiar el código de ${student.studentName}`}>
          <Copy size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onCopyInvite(student.code!)} className="pg-btn pg-btn-ghost">
          <MessageCircle size={16} aria-hidden="true" />
          Copiar mensaje
        </button>
      </div>
    ) : (
      <p className="text-sm pg-fg2">Sin código</p>
    )}
  </li>
);

const FamilyMenu = ({ name, onRevoke }: { name: string; onRevoke: () => void }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen((value) => !value)} aria-label={`Opciones de ${name}`} aria-haspopup="dialog" aria-expanded={open} className="pg-icon-btn">
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={(restore) => { setOpen(false); if (restore) anchor.current?.focus(); }} anchorRef={anchor} label={`Opciones de ${name}`}>
        <button type="button" className="pg-menu-item pg-alert" onClick={() => { setOpen(false); onRevoke(); }}>
          <UserMinus size={16} aria-hidden="true" />
          Quitar familia
        </button>
      </Popover>
    </>
  );
};
