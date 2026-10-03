import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Brush, ImageUp, Link2, Plus, Unlink } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { avatarImageUrl, type AvatarGender, type ItemRarity } from '../../lib/avatarApi';
import {
  adminAvatarItemKey, adminAvatarItemsApi, adminAvatarItemsKey,
  type AdminAvatarItem, type AdminAvatarItemDetail,
} from '../../lib/adminAvatarItemsApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { LAYER_ORDER } from '../../components/avatar/avatarLayers';
import {
  BODY_NAME, RARITY_NAME, RARITY_SEQUENCE, SLOT_NAMES, STATUS_CHIP, STATUS_NAME,
  completaPath, errorMessage, otherBody,
} from '../../components/admin/avatarItems/avatarItemsHelpers';

type Pending = 'publish' | 'retire' | 'restore' | 'default-on' | 'default-off' | 'unpair' | null;

/** Ficha de una prenda: sus dos versiones (cada una con su imagen), sus datos y su estado. */
export default function AdminAvatarItemPage() {
  const { id = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: adminAvatarItemKey(id),
    queryFn: () => adminAvatarItemsApi.get(id),
    enabled: isAdmin && !!id,
  });

  const refresh = (detail?: AdminAvatarItemDetail) => {
    if (detail) queryClient.setQueryData(adminAvatarItemKey(id), detail);
    void queryClient.invalidateQueries({ queryKey: adminAvatarItemsKey });
    void queryClient.invalidateQueries({ queryKey: ['admin-avatar-item'] });
  };

  const action = useMutation({
    mutationFn: async (kind: Exclude<Pending, null>) => {
      const item = data!.item;
      const partner = data!.partner;
      if (kind === 'publish') return adminAvatarItemsApi.publish(item.id);
      if (kind === 'retire') return adminAvatarItemsApi.retire(item.id, true);
      if (kind === 'restore') return adminAvatarItemsApi.restore(item.id, true);
      if (kind === 'unpair') return adminAvatarItemsApi.unpair(item.id);
      // Las dos versiones de un par son iniciales o ninguna.
      const isDefault = kind === 'default-on';
      if (partner && partner.status === 'PUBLISHED') await adminAvatarItemsApi.update(partner.id, { isDefault });
      return adminAvatarItemsApi.update(item.id, { isDefault });
    },
    onSuccess: (detail, kind) => {
      refresh(detail);
      setPending(null);
      const messages: Record<Exclude<Pending, null>, string> = {
        publish: 'Publicada: ya está en el catálogo de todas las clases.',
        retire: 'Retirada: ya no se vende. Quien la tiene la conserva.',
        restore: 'Reactivada: vuelve a venderse.',
        'default-on': 'Ahora es prenda inicial.',
        'default-off': 'Ya no es prenda inicial.',
        unpair: 'Versiones separadas.',
      };
      toast.success(messages[kind]);
    },
    onError: (error) => {
      setPending(null);
      toast.error(errorMessage(error, 'No se pudo completar la acción.'));
    },
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  if (isError || (!isLoading && !data)) {
    return (
      <div data-pg="" className="min-h-screen bg-gray-50 text-[var(--pg-fg)] dark:bg-gray-900">
        <AdminPageHeader title="Prenda" back="/admin/avatar-items" backLabel="las prendas" />
        <div role="alert" className="pg-surface mx-auto mt-8 max-w-md p-6 text-center">
          <p className="font-semibold">No se pudo cargar la prenda.</p>
          <button type="button" className="pg-btn mt-3" onClick={() => void refetch()}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div data-pg="" className="min-h-screen bg-gray-50 dark:bg-gray-900" aria-busy="true" />;
  }

  const { item, partner, goals } = data;
  const versions: Partial<Record<AvatarGender, AdminAvatarItem>> = { [item.gender]: item, ...(partner ? { [partner.gender]: partner } : {}) };
  const anyDraft = [item, partner].some((row) => row?.status === 'DRAFT');
  const owners = item.owners + (partner?.owners ?? 0);
  const equipped = item.equipped + (partner?.equipped ?? 0);

  const confirmTexts: Record<Exclude<Pending, null>, { title: string; message: string; confirm: string; variant: 'danger' | 'warning' | 'info' }> = {
    publish: { title: '¿Publicar la prenda?', message: `Llegará al catálogo de todas las clases${partner ? ' con sus dos versiones' : ''}. Revisa antes que se vea bien en los dos cuerpos.`, confirm: 'Publicar', variant: 'info' },
    retire: { title: '¿Retirar la prenda?', message: `Dejará de venderse en todas las clases${partner ? ' (las dos versiones)' : ''}. ${owners ? `${owners} ${owners === 1 ? 'alumno la tiene' : 'alumnos la tienen'} y la conservan` : 'Nadie la tiene todavía'}${goals ? `; ${goals} ${goals === 1 ? 'ahorra' : 'ahorran'} para ella` : ''}. Puedes reactivarla cuando quieras.`, confirm: 'Retirar', variant: 'danger' },
    restore: { title: '¿Reactivar la prenda?', message: 'Volverá a venderse en todas las clases.', confirm: 'Reactivar', variant: 'info' },
    'default-on': { title: '¿Hacerla prenda inicial?', message: `Todos los alumnos la tendrán gratis en ${SLOT_NAMES[item.slot]}${owners ? `, también los ${owners} que la compraron` : ''}. Úsalo para la ropa básica, no para prendas que se venden.`, confirm: 'Hacer inicial', variant: 'warning' },
    'default-off': { title: '¿Quitarla de las iniciales?', message: 'Los alumnos nuevos ya no la recibirán gratis.', confirm: 'Quitar', variant: 'warning' },
    unpair: { title: '¿Separar las dos versiones?', message: 'Quedarán como prendas distintas: si un alumno cambia de cuerpo, lo que compró ya no pasa al otro. Lo ya comprado no se quita.', confirm: 'Separar', variant: 'warning' },
  };
  const confirm = pending ? confirmTexts[pending] : null;

  return (
    <div data-pg="" className="min-h-screen bg-gray-50 text-[var(--pg-fg)] dark:bg-gray-900">
      <AdminPageHeader
        title={item.name}
        subtitle={`${SLOT_NAMES[item.slot]} · ${RARITY_NAME[item.rarity]}${owners ? ` · ${owners} la tienen, ${equipped} la llevan puesta` : ''}`}
        back="/admin/avatar-items"
        backLabel="las prendas"
        actions={anyDraft
          ? <button type="button" className={primaryButton} onClick={() => setPending('publish')}>Publicar</button>
          : item.status === 'PUBLISHED'
            ? <button type="button" className="pg-btn" onClick={() => setPending('retire')}>Retirar</button>
            : <button type="button" className="pg-btn" onClick={() => setPending('restore')}>Reactivar</button>}
      />

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Versiones" className="grid gap-4 sm:grid-cols-2">
          {(['MALE', 'FEMALE'] as AvatarGender[]).map((body) => {
            const version = versions[body];
            return version
              ? <VersionPanel key={body} version={version} />
              : <MissingVersion key={body} item={item} body={body} onLinked={refresh} />;
          })}
        </section>

        <aside className="space-y-4">
          <DetailsForm key={`${item.id}:${item.updatedAt}`} item={item} partner={partner} onSaved={refresh} />
          <section className="pg-surface space-y-2 p-4">
            <h2 className="text-sm font-bold">Más opciones</h2>
            {item.status === 'PUBLISHED' && (
              <button type="button" className="pg-btn w-full justify-start" onClick={() => setPending(item.isDefault ? 'default-off' : 'default-on')}>
                {item.isDefault ? 'Quitar de las prendas iniciales' : 'Hacer prenda inicial'}
              </button>
            )}
            {partner && (
              <button type="button" className="pg-btn w-full justify-start" onClick={() => setPending('unpair')}>
                <Unlink className="h-4 w-4" aria-hidden="true" /> Separar las dos versiones
              </button>
            )}
            <p className="pg-fg2 text-xs">Retirar no borra nada: quien la compró la conserva y puedes reactivarla.</p>
          </section>
        </aside>
      </main>

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => !action.isPending && setPending(null)}
        onConfirm={() => pending && action.mutate(pending)}
        isLoading={action.isPending}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirm}
        variant={confirm?.variant}
      />
    </div>
  );
}

/** La versión sobre su cuerpo, con su estado y los accesos a «Completa». */
const VersionPanel = ({ version }: { version: AdminAvatarItem }) => {
  const behind = (LAYER_ORDER[version.slot] ?? 0) < 0;
  const base = avatarImageUrl(`/avatars/base/${version.gender === 'MALE' ? 'male' : 'female'}.png`, 'md');
  const layer = avatarImageUrl(version.imagePath, 'md');
  return (
    <article className="pg-surface flex flex-col overflow-hidden" aria-label={`Versión ${BODY_NAME[version.gender]}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--pg-line)] px-4 py-2">
        <h2 className="font-bold">{BODY_NAME[version.gender]}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CHIP[version.status]}`}>{version.status === 'DRAFT' ? '✎ ' : ''}{STATUS_NAME[version.status]}</span>
      </div>
      <div className="relative mx-auto my-3 aspect-[395/959] w-full max-w-[13rem] overflow-hidden rounded-lg bg-[#eceff6] dark:bg-slate-800">
        {version.slot === 'BACKGROUND' ? (
          <img src={layer} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            {behind && <img src={layer} alt="" className="absolute inset-0 h-full w-full object-contain" />}
            <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" />
            {!behind && <img src={layer} alt="" className="absolute inset-0 h-full w-full object-contain" />}
          </>
        )}
        {version.slot === 'BACKGROUND' && <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" />}
      </div>
      <p className="pg-fg2 px-4 text-center text-xs">
        {version.owners ? `${version.owners} la tienen · ${version.equipped} la llevan puesta` : 'Nadie la tiene todavía'}
        {version.isDefault ? ' · Inicial' : ''}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2 p-4">
        <Link to={`/admin/avatar-items/${version.id}/editar?modo=retocar`} className="pg-btn">
          <Brush className="h-4 w-4" aria-hidden="true" /> Retocar
        </Link>
        <Link to={`/admin/avatar-items/${version.id}/editar?modo=reemplazar`} className="pg-btn">
          <ImageUp className="h-4 w-4" aria-hidden="true" /> Cambiar imagen
        </Link>
      </div>
    </article>
  );
};

/** Falta la versión de un cuerpo: crearla con «Completa» o vincular una prenda que ya existe. */
const MissingVersion = ({ item, body, onLinked }: { item: AdminAvatarItem; body: AvatarGender; onLinked: (detail: AdminAvatarItemDetail) => void }) => {
  const [choice, setChoice] = useState('');
  const { data: items = [] } = useQuery({ queryKey: adminAvatarItemsKey, queryFn: adminAvatarItemsApi.list });
  const candidates = items.filter((other) => other.gender === body && other.slot === item.slot && !other.pairKey && other.id !== item.id);
  const link = useMutation({
    mutationFn: () => adminAvatarItemsApi.pair(item.id, choice),
    onSuccess: (detail) => { onLinked(detail); toast.success('Versiones vinculadas: lo comprado pasa al otro cuerpo.'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron vincular.')),
  });
  return (
    <article className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--pg-control)] p-5 text-center" aria-label={`Falta la versión ${BODY_NAME[body]}`}>
      <p className="text-2xl" aria-hidden="true">{body === 'MALE' ? '🧒' : '👧'}</p>
      <h2 className="font-bold">Falta la versión {BODY_NAME[body]}</h2>
      <p className="pg-fg2 text-sm">Cada cuerpo necesita su propia imagen. Vinculadas, lo comprado pasa al otro cuerpo.</p>
      <Link to={completaPath({ slot: item.slot, gender: body, pair: item.id })} className={primaryButton}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Crear con Completa
      </Link>
      {candidates.length > 0 && (
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <label className="sr-only" htmlFor={`link-${body}`}>Prenda de {BODY_NAME[body]} para vincular</label>
          <select id={`link-${body}`} value={choice} onChange={(e) => setChoice(e.target.value)} className="min-h-[2.5rem] max-w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-2 text-sm">
            <option value="">Vincular una que ya existe…</option>
            {candidates.map((other) => <option key={other.id} value={other.id}>{other.name} ({RARITY_NAME[other.rarity]})</option>)}
          </select>
          <button type="button" className="pg-btn" disabled={!choice || link.isPending} onClick={() => link.mutate()}>
            <Link2 className="h-4 w-4" aria-hidden="true" /> Vincular
          </button>
        </div>
      )}
    </article>
  );
};

/** Nombre y descripción de esta versión; la rareza vale para las dos. */
const DetailsForm = ({ item, partner, onSaved }: { item: AdminAvatarItem; partner: AdminAvatarItem | null; onSaved: (detail: AdminAvatarItemDetail) => void }) => {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [rarity, setRarity] = useState<ItemRarity>(item.rarity);
  const dirty = name.trim() !== item.name || description.trim() !== (item.description ?? '') || rarity !== item.rarity;
  const save = useMutation({
    mutationFn: () => adminAvatarItemsApi.update(item.id, {
      ...(name.trim() !== item.name ? { name: name.trim() } : {}),
      ...(description.trim() !== (item.description ?? '') ? { description: description.trim() || null } : {}),
      ...(rarity !== item.rarity ? { rarity } : {}),
    }),
    onSuccess: (detail) => { onSaved(detail); toast.success('Datos guardados'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron guardar los datos.')),
  });
  return (
    <form className="pg-surface space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (dirty && name.trim()) save.mutate(); }}>
      <h2 className="text-sm font-bold">Datos de la versión {BODY_NAME[item.gender]}</h2>
      <label className="block text-sm font-medium">
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="mt-1 min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3" />
      </label>
      <label className="block text-sm font-medium">
        Descripción <span className="pg-fg2 font-normal">(opcional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Rareza {partner && <span className="pg-fg2 font-normal">(la misma en las dos versiones)</span>}
        <select value={rarity} onChange={(e) => setRarity(e.target.value as ItemRarity)} className="mt-1 min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-2">
          {RARITY_SEQUENCE.map((value) => <option key={value} value={value}>{RARITY_NAME[value]}</option>)}
        </select>
      </label>
      <p className="pg-fg2 text-xs">El precio en cada clase sale de la rareza y del oro semanal de la clase.{partner ? ` La versión ${BODY_NAME[otherBody(item.gender)]} tiene su propio nombre.` : ''}</p>
      <button type="submit" className={primaryButton} disabled={!dirty || !name.trim() || save.isPending}>
        {save.isPending ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  );
};
