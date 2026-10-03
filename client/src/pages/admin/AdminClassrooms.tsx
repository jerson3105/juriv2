import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, Eye, Search } from 'lucide-react';
import { adminApi, type AdminClassroom, type AdminClassroomDetails } from '../../lib/adminApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminClassroomDetailsModal } from '../../components/admin/AdminClassroomDetailsModal';

type StatusFilter = 'active' | 'archived' | 'all';
type Sort = 'recent' | 'activity';

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const activityLabel = (iso: string | null) => {
  if (!iso) return 'Sin puntos en 90 días';
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days > -1 ? 'Puntos hoy' : `Último punto ${relative.format(days, 'day')}`;
};
const gradeLabel = (grade: string | null) => {
  if (!grade) return null;
  const [level, number] = grade.split('_');
  const names: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };
  return `${names[level] ?? level}${number ? ` ${number}${level === 'INICIAL' ? ' años' : '.º'}` : ''}`;
};

/** Clases: docente, escuela, alumnos y actividad real (puntos); el código de unión, oculto hasta pedirlo. */
export default function AdminClassrooms() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [sort, setSort] = useState<Sort>('recent');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ id: string; data: AdminClassroomDetails | null } | null>(null);
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin-classrooms'], queryFn: adminApi.getClassrooms });

  const term = search.trim().toLowerCase();
  const visible = useMemo(() => data
    .filter((room) => (status === 'all' ? true : status === 'active' ? room.isActive : !room.isActive))
    .filter((room) => !term
      || room.name.toLowerCase().includes(term)
      || room.code.toLowerCase() === term
      || `${room.teacher.firstName} ${room.teacher.lastName}`.toLowerCase().includes(term)
      || (room.schoolName ?? '').toLowerCase().includes(term))
    .sort((a, b) => (sort === 'activity'
      ? new Date(b.lastPointAt ?? 0).getTime() - new Date(a.lastPointAt ?? 0).getTime()
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())), [data, status, term, sort]);
  const active = data.filter((room) => room.isActive).length;
  const quiet = data.filter((room) => room.isActive && !room.lastPointAt).length;

  const openDetail = async (id: string) => {
    setDetail({ id, data: null });
    try {
      const details = await adminApi.getClassroomDetails(id);
      setDetail((current) => (current?.id === id ? { id, data: details } : current));
    } catch {
      toast.error('No se pudo cargar el detalle de la clase');
      setDetail(null);
    }
  };
  const closeDetail = useCallback(() => setDetail(null), []);
  const reveal = (id: string) => setRevealed((current) => new Set(current).add(id));

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader
        title="Clases"
        subtitle={isLoading ? 'Cargando…' : `${active} activas${data.length > active ? ` · ${data.length - active} archivadas` : ''}${quiet ? ` · ${quiet} sin puntos en 90 días` : ''}`}
      />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Buscar clases</span>
            <Search className="pg-fg2 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Clase, docente, escuela o código exacto…"
              className="min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] pl-9 pr-3"
            />
          </label>
          <div className="pg-seg" role="group" aria-label="Estado">
            {([['active', 'Activas'], ['archived', 'Archivadas'], ['all', 'Todas']] as const).map(([value, label]) => (
              <button key={value} type="button" className="pg-seg-item" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
          <div className="pg-seg" role="group" aria-label="Orden">
            <button type="button" className="pg-seg-item" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>Recientes</button>
            <button type="button" className="pg-seg-item" aria-pressed={sort === 'activity'} onClick={() => setSort('activity')}>Con actividad</button>
          </div>
        </div>

        {isError ? (
          <div role="alert" className="pg-surface p-6 text-center">
            <p className="font-semibold">No se pudieron cargar las clases.</p>
            <button type="button" className="pg-btn mt-3" onClick={() => void refetch()}>Reintentar</button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((key) => <div key={key} className="pg-surface h-40 animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
            <p className="text-3xl" aria-hidden="true">🏫 🔍</p>
            <p className="mt-2 font-semibold">Ninguna clase con estos filtros.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((room) => <ClassroomCard key={room.id} room={room} showCode={revealed.has(room.id)} onReveal={() => reveal(room.id)} onOpen={() => void openDetail(room.id)} />)}
          </ul>
        )}
      </main>

      <AdminClassroomDetailsModal isOpen={!!detail} onClose={closeDetail} details={detail?.data ?? null} loading={!detail?.data} />
    </div>
  );
}

const ClassroomCard = ({ room, showCode, onReveal, onOpen }: { room: AdminClassroom; showCode: boolean; onReveal: () => void; onOpen: () => void }) => {
  const copy = () => {
    void navigator.clipboard.writeText(room.code);
    toast.success('Código copiado');
  };
  return (
    <li className="pg-surface flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{room.name}</h2>
          <p className="pg-fg2 text-xs">{[gradeLabel(room.gradeLevel), room.schoolName].filter(Boolean).join(' · ') || 'Sin escuela'}</p>
        </div>
        {!room.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100">Archivada</span>}
      </div>
      <p className="text-sm">{room.teacher.firstName} {room.teacher.lastName}</p>
      <p className="pg-fg2 text-sm">
        {room.students === 1 ? '1 alumno' : `${room.students} alumnos`} · {activityLabel(room.lastPointAt)}
        {room.pointsThisWeek > 0 && ` · ${room.pointsThisWeek} esta semana`}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {showCode ? (
          <button type="button" className="pg-btn font-mono" onClick={copy} aria-label={`Copiar el código ${room.code}`}>
            <Copy className="h-4 w-4" aria-hidden="true" /> {room.code}
          </button>
        ) : (
          <button type="button" className="pg-btn" onClick={onReveal}>Mostrar código</button>
        )}
        <button type="button" className="pg-btn" onClick={onOpen}>
          <Eye className="h-4 w-4" aria-hidden="true" /> Ver detalle
        </button>
      </div>
    </li>
  );
};
