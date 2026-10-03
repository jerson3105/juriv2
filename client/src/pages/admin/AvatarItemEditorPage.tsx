import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import type { AvatarGender, AvatarSlot } from '../../lib/avatarApi';
import { adminAvatarItemKey, adminAvatarItemsApi, adminAvatarItemsKey } from '../../lib/adminAvatarItemsApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { CompletaEditor, type CompletaSaveInput } from '../../components/admin/completa/CompletaEditor';
import { BODY_NAME, SLOT_NAMES, SLOT_SEQUENCE, errorMessage, otherBody } from '../../components/admin/avatarItems/avatarItemsHelpers';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

/** Imagen original de una capa (PNG del panel en el API; las antiguas, en el sitio). */
const fetchLayer = async (imagePath: string): Promise<Blob> => {
  const url = imagePath.startsWith('/api/') ? `${API_ORIGIN}${imagePath}` : imagePath;
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error('No se pudo traer la imagen actual');
  return response.blob();
};

const isSlot = (value: string | null): value is AvatarSlot => !!value && (SLOT_SEQUENCE as string[]).includes(value);
const isBody = (value: string | null): value is AvatarGender => value === 'MALE' || value === 'FEMALE';

/** «Completa» a página completa: nueva prenda, la versión del otro cuerpo, retocar o cambiar la imagen. */
export default function AvatarItemEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const pairId = params.get('par');
  const editMode = params.get('modo') === 'retocar' ? 'retouch' : 'replace';
  const mode = id ? editMode : 'new';
  const contextId = id ?? pairId;

  const { data: items = [] } = useQuery({ queryKey: adminAvatarItemsKey, queryFn: adminAvatarItemsApi.list, enabled: isAdmin });
  const { data: context, isLoading: contextLoading, isError: contextError } = useQuery({
    queryKey: adminAvatarItemKey(contextId ?? ''),
    queryFn: () => adminAvatarItemsApi.get(contextId!),
    enabled: isAdmin && !!contextId,
  });
  const [initialSource, setInitialSource] = useState<Blob | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Retocar: la imagen actual entra como punto de partida.
  const retouchPath = mode === 'retouch' ? context?.item.imagePath : undefined;
  useEffect(() => {
    if (!retouchPath) return undefined;
    let cancelled = false;
    fetchLayer(retouchPath)
      .then((blob) => { if (!cancelled) setInitialSource(blob); })
      .catch(() => { if (!cancelled) setSourceError('No se pudo traer la imagen actual. Sube la imagen de nuevo.'); });
    return () => { cancelled = true; };
  }, [retouchPath]);

  const save = useMutation({
    mutationFn: async (input: CompletaSaveInput) => {
      if (mode === 'new') {
        const created = await adminAvatarItemsApi.create({
          name: input.name,
          description: input.description || undefined,
          gender: input.gender,
          slot: input.slot,
          rarity: input.rarity,
          pairWith: pairId ?? undefined,
        }, input.png);
        return input.publish ? adminAvatarItemsApi.publish(created.item.id) : created;
      }
      return adminAvatarItemsApi.replaceImage(id!, input.png);
    },
    onSuccess: (detail, input) => {
      queryClient.setQueryData(adminAvatarItemKey(detail.item.id), detail);
      void queryClient.invalidateQueries({ queryKey: adminAvatarItemsKey });
      void queryClient.invalidateQueries({ queryKey: ['admin-avatar-item'] });
      toast.success(mode !== 'new' ? 'Imagen guardada.' : input.publish ? 'Prenda publicada.' : 'Borrador guardado.');
      navigate(`/admin/avatar-items/${detail.item.id}`, { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la prenda.')),
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  const partner = mode === 'new' && pairId ? context?.item : undefined;
  const editing = mode !== 'new' ? context?.item : undefined;
  const waiting = !!contextId && (contextLoading || (mode === 'retouch' && !initialSource && !sourceError));
  const defaults = items.filter((item) => item.isDefault && item.status === 'PUBLISHED');

  const presetSlot = params.get('ranura');
  const presetBody = params.get('cuerpo');
  const initial = editing
    ? { slot: editing.slot, gender: editing.gender, rarity: editing.rarity, name: editing.name, description: editing.description ?? '' }
    : partner
      ? { slot: partner.slot, gender: otherBody(partner.gender), rarity: partner.rarity, name: partner.name, description: partner.description ?? '' }
      : { slot: isSlot(presetSlot) ? presetSlot : 'TOP' as AvatarSlot, gender: isBody(presetBody) ? presetBody : 'MALE' as AvatarGender, rarity: 'COMMON' as const, name: '', description: '' };

  const title = editing
    ? `${mode === 'retouch' ? 'Retocar' : 'Cambiar imagen de'} «${editing.name}» (${BODY_NAME[editing.gender]})`
    : partner
      ? `Versión ${BODY_NAME[otherBody(partner.gender)]} de «${partner.name}»`
      : 'Nueva prenda';
  const back = editing ? `/admin/avatar-items/${editing.id}` : partner ? `/admin/avatar-items/${partner.id}` : '/admin/avatar-items';

  return (
    <div data-pg="" className="min-h-screen bg-gray-50 text-[var(--pg-fg)] dark:bg-gray-900">
      <AdminPageHeader
        title={title}
        subtitle={`Completa: quita el fondo, ajusta al cuerpo y revisa · ${SLOT_NAMES[initial.slot]} · ${BODY_NAME[initial.gender]}`}
        back={back}
        backLabel={editing || partner ? 'la prenda' : 'las prendas'}
      />
      {contextError ? (
        <div role="alert" className="pg-surface mx-auto mt-8 max-w-md p-6 text-center">No se encontró la prenda.</div>
      ) : waiting ? (
        <div className="pg-fg2 p-10 text-center" aria-busy="true">Preparando…</div>
      ) : (
        <>
          {sourceError && <p role="alert" className="pg-alert mx-auto mt-4 max-w-xl text-center text-sm font-medium">{sourceError}</p>}
          <CompletaEditor
            key={`${mode}:${contextId ?? 'new'}`}
            mode={mode}
            initial={initial}
            lockSlot={mode !== 'new' || !!partner}
            lockGender={mode !== 'new' || !!partner}
            lockRarity={!!partner}
            initialSource={initialSource}
            defaults={defaults}
            saving={save.isPending}
            onSave={(input) => save.mutate(input)}
          />
        </>
      )}
    </div>
  );
}
