import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { avatarImageUrl, type AvatarGender, type AvatarSlot } from '../../lib/avatarApi';
import { adminAvatarItemsApi, adminAvatarItemsKey, type AvatarItemStatus } from '../../lib/adminAvatarItemsApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import {
  BODY_NAME, RARITY_CHIP, RARITY_NAME, SLOT_NAMES, SLOT_SEQUENCE, STATUS_CHIP, STATUS_NAME,
  completaPath, coverage, garmentStatuses, groupGarments, type Garment,
} from '../../components/admin/avatarItems/avatarItemsHelpers';

type StatusFilter = AvatarItemStatus | 'ALL';
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'PUBLISHED', label: 'Publicadas' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'RETIRED', label: 'Retiradas' },
  { value: 'ALL', label: 'Todas' },
];
const BODIES: AvatarGender[] = ['MALE', 'FEMALE'];

/** Prendas del avatar: una tarjeta por prenda con sus dos versiones (Chico y Chica) y los huecos a la vista. */
export default function AdminAvatarItems() {
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<StatusFilter>('PUBLISHED');
  const [slot, setSlot] = useState<AvatarSlot | ''>('');
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'ADMIN';
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: adminAvatarItemsKey,
    queryFn: adminAvatarItemsApi.list,
    enabled: isAdmin,
  });

  const garments = useMemo(() => groupGarments(items), [items]);
  const counts = useMemo(() => coverage(items), [items]);
  const drafts = items.filter((item) => item.status === 'DRAFT').length;
  const term = search.trim().toLowerCase();
  const visible = garments.filter((garment) => {
    if (slot && garment.slot !== slot) return false;
    if (status !== 'ALL' && !garmentStatuses(garment).includes(status)) return false;
    if (!term) return true;
    return Object.values(garment.versions).some((item) => item?.name.toLowerCase().includes(term));
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader
        title="Prendas del avatar"
        subtitle={isLoading ? 'Cargando…' : `${garments.length} prendas${drafts ? ` · ${drafts} ${drafts === 1 ? 'borrador' : 'borradores'}` : ''}`}
        actions={<Link to={completaPath({})} className={primaryButton}><Plus className="h-4 w-4" aria-hidden="true" /> Nueva prenda</Link>}
      />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section aria-labelledby="coverage-title" className="pg-surface p-4">
          <h2 id="coverage-title" className="text-sm font-bold">A la venta por ranura</h2>
          <p className="pg-fg2 text-xs">Chico · Chica. Un hueco es una ranura sin prendas para ese cuerpo.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {SLOT_SEQUENCE.map((key) => {
              const count = counts.get(key)!;
              const active = slot === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSlot(active ? '' : key)}
                    aria-pressed={active}
                    className={`flex w-full min-h-[2.75rem] flex-col rounded-lg border px-3 py-1.5 text-left text-sm ${active ? 'border-[var(--pg-accent)] bg-[var(--pg-select)]' : 'border-[var(--pg-line)] hover:bg-[var(--pg-hover)]'}`}
                  >
                    <span className="font-medium">{SLOT_NAMES[key]}</span>
                    <span className="flex gap-2 text-xs">
                      {BODIES.map((body) => (
                        <span key={body} className={count[body] === 0 ? 'font-bold text-amber-800 dark:text-amber-300' : 'pg-fg2'}>
                          {BODY_NAME[body]} {count[body] === 0 ? '0 ⚠' : count[body]}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Buscar prendas</span>
            <Search className="pg-fg2 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
              className="min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] pl-9 pr-3"
            />
          </label>
          <div className="pg-seg" role="group" aria-label="Estado">
            {STATUS_FILTERS.map((option) => (
              <button key={option.value} type="button" className="pg-seg-item" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          {slot && (
            <button type="button" className="pg-chip" aria-pressed="true" onClick={() => setSlot('')}>
              {SLOT_NAMES[slot]} ✕
            </button>
          )}
        </div>

        {isError ? (
          <div role="alert" className="pg-surface p-6 text-center">
            <p className="font-semibold">No se pudieron cargar las prendas.</p>
            <button type="button" className="pg-btn mt-3" onClick={() => void refetch()}>Reintentar</button>
          </div>
        ) : isLoading ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((key) => <li key={key} className="pg-surface h-64 animate-pulse" />)}
          </ul>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
            <p className="text-3xl" aria-hidden="true">👕 🧢 👟</p>
            <p className="mt-2 font-semibold">{items.length === 0 ? 'Aún no hay prendas.' : 'Ninguna prenda con estos filtros.'}</p>
            <p className="pg-fg2 mt-1 text-sm">Sube la imagen que te dio la IA y «Completa» le quita el fondo y la ajusta al cuerpo.</p>
            <Link to={completaPath(slot ? { slot } : {})} className={`${primaryButton} mt-4`}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Nueva prenda
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((garment) => <GarmentCard key={garment.key} garment={garment} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

const GarmentCard = ({ garment }: { garment: Garment }) => {
  const { main } = garment;
  const owners = Object.values(garment.versions).reduce((sum, item) => sum + (item?.owners ?? 0), 0);
  const statuses = garmentStatuses(garment).filter((value) => value !== 'PUBLISHED');
  return (
    <li className="pg-surface flex flex-col overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-[var(--pg-line)]">
        {BODIES.map((body) => {
          const version = garment.versions[body];
          return version ? (
            <Link
              key={body}
              to={`/admin/avatar-items/${version.id}`}
              className="relative flex aspect-square items-center justify-center bg-[var(--pg-surface)] p-3 hover:bg-[var(--pg-hover)]"
              aria-label={`${version.name}, versión ${BODY_NAME[body]}`}
            >
              <img src={avatarImageUrl(version.imagePath, 'thumb')} alt="" loading="lazy" decoding="async" className={`max-h-full max-w-full object-contain ${version.status === 'RETIRED' ? 'opacity-50' : ''}`} />
              <span className="pg-fg2 absolute left-2 top-1.5 text-xs font-semibold">{BODY_NAME[body]}</span>
            </Link>
          ) : (
            <Link
              key={body}
              to={completaPath({ slot: garment.slot, gender: body, pair: main.id })}
              className="flex aspect-square flex-col items-center justify-center gap-1 border-2 border-dashed border-[var(--pg-control)] bg-[var(--pg-surface)] text-sm hover:bg-[var(--pg-hover)]"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Versión {BODY_NAME[body]}</span>
            </Link>
          );
        })}
      </div>
      <Link to={`/admin/avatar-items/${main.id}`} className="flex flex-1 flex-col gap-1.5 p-3 hover:bg-[var(--pg-hover)]">
        <span className="font-semibold leading-tight">{main.name}</span>
        <span className="pg-fg2 text-xs">{SLOT_NAMES[garment.slot]}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${RARITY_CHIP[main.rarity]}`}>{RARITY_NAME[main.rarity]}</span>
          {statuses.map((value) => <span key={value} className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_CHIP[value]}`}>{value === 'DRAFT' ? '✎ ' : ''}{STATUS_NAME[value]}</span>)}
          {Object.values(garment.versions).some((item) => item?.isDefault) && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">Inicial</span>}
          {owners > 0 && <span className="pg-fg2">{owners === 1 ? '1 alumno la tiene' : `${owners} alumnos la tienen`}</span>}
        </span>
      </Link>
    </li>
  );
};
