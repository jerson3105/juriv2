import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { avatarApi, type AvatarGender, type AvatarPurchaseResult, type AvatarSlot, type StudentAvatarItem, type StudentAvatarView } from '../../../lib/avatarApi';
import { errorMessage } from '../../home/homeHelpers';
import { myShopKey } from '../../student/shop/shopStudentHelpers';
import { BODY_LABEL, myAvatarKey } from '../avatarHelpers';
import type { AnimatedLayer } from '../AnimatedAvatar';
import { listNames, preloadLayer, prefersReducedMotion, priceText, toSlotItem, type ClosetGroup, type SlotItem } from './closetHelpers';

interface Change { slot: AvatarSlot; item: SlotItem | null }
interface UndoEntry { changes: Change[]; label: string }

/** Momento del estreno: la cortina cierra (≈320 ms), se cambia detrás y se abre. */
const CURTAIN_SWAP_MS = 320;
const CURTAIN_MS = 950;
const UNDO_MAX = 10;

/**
 * Estado del clóset: lo que lleva puesto (guardado al instante, con una cola por ranura donde gana el último
 * toque y vuelve atrás con aviso si falla), lo que se prueba sin guardar, «Deshacer», y comprar, elegir el
 * regalo, la meta y el cuerpo con las cachés al día.
 */
export const useCloset = (profileId: string, view: StudentAvatarView) => {
  const queryClient = useQueryClient();
  const [reduced] = useState(prefersReducedMotion);
  const [overrides, setOverridesState] = useState<Map<AvatarSlot, SlotItem | null>>(() => new Map());
  const [tryOn, setTryOn] = useState<Map<AvatarSlot, StudentAvatarItem>>(() => new Map());
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [message, setMessage] = useState('');
  const [alert, setAlert] = useState('');
  const [curtain, setCurtain] = useState(0);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [bodyBusy, setBodyBusy] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const overridesRef = useRef(overrides);
  const inFlight = useRef(new Set<AvatarSlot>());
  const seq = useRef(new Map<AvatarSlot, number>());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const setOverrides = (update: (map: Map<AvatarSlot, SlotItem | null>) => void) => {
    const next = new Map(overridesRef.current);
    update(next);
    overridesRef.current = next;
    setOverridesState(next);
  };

  const saved = useMemo(() => new Map(view.equipped.map((entry) => [entry.slot, toSlotItem(entry)])), [view.equipped]);
  const wornNow = (slot: AvatarSlot): SlotItem | null => {
    if (overridesRef.current.has(slot)) return overridesRef.current.get(slot) ?? null;
    const entry = viewRef.current.equipped.find((item) => item.slot === slot);
    return entry ? toSlotItem(entry) : null;
  };
  /** Lo que lleva puesto (guardado o guardándose) en cada ranura. */
  const worn = (slot: AvatarSlot): SlotItem | null => (overrides.has(slot) ? overrides.get(slot) ?? null : saved.get(slot) ?? null);

  const layers = useMemo<AnimatedLayer[]>(() => {
    const slots = new Set<AvatarSlot>([...saved.keys(), ...overrides.keys(), ...tryOn.keys()]);
    const list: AnimatedLayer[] = [];
    for (const slot of slots) {
      const trying = tryOn.get(slot);
      const item = trying ? toSlotItem(trying) : overrides.has(slot) ? overrides.get(slot) : saved.get(slot);
      if (item) list.push({ id: item.id, slot, imagePath: item.imagePath, layerOrder: item.layerOrder });
    }
    return list;
  }, [saved, overrides, tryOn]);

  const updateView = (update: (old: StudentAvatarView) => StudentAvatarView) =>
    queryClient.setQueryData<StudentAvatarView>(myAvatarKey(profileId), (old) => (old ? update(old) : old));

  // Lo guardado pasa a la caché (y lo ve el Inicio sin pedirlo de nuevo).
  const commitSlot = (slot: AvatarSlot, item: SlotItem | null) => updateView((old) => ({
    ...old,
    equipped: [
      ...old.equipped.filter((entry) => entry.slot !== slot),
      ...(item ? [{ slot, itemId: item.id, name: item.name, imagePath: item.imagePath, layerOrder: item.layerOrder, isDefault: item.isDefault }] : []),
    ],
  }));

  // Una cola por ranura: se envía lo último que se eligió; si falla, vuelve a lo guardado y avisa.
  // `confirmed` guarda lo último que el servidor aceptó en cada ranura (el mismo objeto que el cambio local).
  const confirmed = useRef(new Map<AvatarSlot, SlotItem | null>());
  const flush = async (slot: AvatarSlot) => {
    if (inFlight.current.has(slot)) return;
    inFlight.current.add(slot);
    try {
      while (overridesRef.current.has(slot) && overridesRef.current.get(slot) !== confirmed.current.get(slot)) {
        const target = overridesRef.current.get(slot) ?? null;
        try {
          if (target) await avatarApi.equipItem(profileId, target.id);
          else await avatarApi.unequipItem(profileId, slot);
          confirmed.current.set(slot, target);
          commitSlot(slot, target);
        } catch (error) {
          confirmed.current.delete(slot);
          setOverrides((map) => map.delete(slot));
          setUndo((list) => list.filter((entry) => !entry.changes.some((change) => change.slot === slot)));
          setAlert(errorMessage(error, 'No se pudo cambiar tu ropa. Inténtalo otra vez.'));
          void queryClient.invalidateQueries({ queryKey: myAvatarKey(profileId) });
          break;
        }
      }
    } finally {
      inFlight.current.delete(slot);
      if (inFlight.current.size === 0) void queryClient.invalidateQueries({ queryKey: ['avatar-equipped', profileId] });
    }
  };

  // La caché avisa un instante después: el cambio local (y la prenda que se probaba y ya es suya) se retira
  // recién cuando lo guardado muestra lo mismo. Así no vuelve un instante la prenda anterior.
  useEffect(() => {
    const done = [...overridesRef.current].filter(([slot, item]) =>
      !inFlight.current.has(slot) && confirmed.current.get(slot) === item && (saved.get(slot)?.id ?? null) === (item?.id ?? null));
    if (done.length) {
      done.forEach(([slot]) => confirmed.current.delete(slot));
      setOverrides((map) => done.forEach(([slot]) => map.delete(slot)));
    }
    setTryOn((map) => {
      const worn = [...map].filter(([slot, item]) => saved.get(slot)?.id === item.id);
      if (worn.length === 0) return map;
      const next = new Map(map);
      worn.forEach(([slot]) => next.delete(slot));
      return next;
    });
  }, [saved]);

  const ticket = (slots: AvatarSlot[]) => {
    const mine = new Map<AvatarSlot, number>();
    for (const slot of slots) {
      const next = (seq.current.get(slot) ?? 0) + 1;
      seq.current.set(slot, next);
      mine.set(slot, next);
    }
    return () => slots.every((slot) => seq.current.get(slot) === mine.get(slot));
  };

  // Aplica cambios guardables: la capa se decodifica antes (sin instante vacío) y gana el último toque.
  const apply = async (changes: Change[], announce: string, undoEntry?: UndoEntry) => {
    const current = ticket(changes.map((change) => change.slot));
    setAlert('');
    await Promise.all(changes.map((change) => (change.item ? preloadLayer(change.item.imagePath) : Promise.resolve())));
    if (!current()) return;
    if (undoEntry) setUndo((list) => [...list.slice(-(UNDO_MAX - 1)), undoEntry]);
    setTryOn((map) => {
      if (!changes.some((change) => map.has(change.slot))) return map;
      const next = new Map(map);
      changes.forEach((change) => next.delete(change.slot));
      return next;
    });
    setOverrides((map) => changes.forEach((change) => map.set(change.slot, change.item)));
    setMessage(announce);
    changes.forEach((change) => void flush(change.slot));
  };

  const undoLabel = (previous: Change[], next: Change[]) => {
    if (previous.length === 1) {
      const before = previous[0].item;
      const after = next[0].item;
      if (before) return `Vuelve «${before.name}»`;
      if (after) return `Te quitas «${after.name}»`;
    }
    return 'Vuelve lo de antes';
  };

  const wear = (changes: Change[], announce: string) => {
    const previous = changes.map((change) => ({ slot: change.slot, item: wornNow(change.slot) }));
    if (previous.every((change, index) => change.item?.id === changes[index].item?.id)) return;
    void apply(changes, announce, { changes: previous, label: undoLabel(previous, changes) });
  };

  /** Probarse una prenda de la tienda (sin guardar). Los pequeños se prueban una a la vez. */
  const tryItem = async (item: StudentAvatarItem) => {
    const current = ticket([item.slot]);
    setAlert('');
    await preloadLayer(item.imagePath);
    if (!current()) return;
    setTryOn((map) => {
      const next = viewRef.current.young ? new Map<AvatarSlot, StudentAvatarItem>() : new Map(map);
      next.set(item.slot, item);
      return next;
    });
    setMessage(`Te estás probando «${item.name}». ${priceText(item, viewRef.current)}.`);
  };

  /** Un toque en una tarjeta: lo suyo se pone y se guarda; lo de la tienda se prueba. Tocar lo puesto no lo quita. */
  const select = (item: StudentAvatarItem) => {
    if (item.owned) {
      if (wornNow(item.slot)?.id === item.id) {
        if (tryOn.has(item.slot)) {
          setTryOn((map) => { const next = new Map(map); next.delete(item.slot); return next; });
          setMessage(`Volviste a «${item.name}».`);
        } else {
          setMessage(`Ya llevas «${item.name}».`);
        }
        return;
      }
      wear([{ slot: item.slot, item: toSlotItem(item) }], `Te pusiste «${item.name}».`);
      return;
    }
    if (tryOn.get(item.slot)?.id === item.id) return;
    void tryItem(item);
  };

  /** «Sin sombrero», «Manos libres»…: quita lo de esas ranuras (y lo que se estaba probando ahí). */
  const selectNone = (group: ClosetGroup) => {
    const changes = group.slots.filter((slot) => wornNow(slot)).map((slot) => ({ slot, item: null }));
    const names = changes.map((change) => wornNow(change.slot)!.name);
    if (changes.length > 0) {
      wear(changes, `Te quitaste ${listNames(names.map((name) => `«${name}»`))}.`);
      return;
    }
    if (group.slots.some((slot) => tryOn.has(slot))) {
      setTryOn((map) => { const next = new Map(map); group.slots.forEach((slot) => next.delete(slot)); return next; });
    }
    setMessage(`${group.none}.`);
  };

  const undoLast = () => {
    const entry = undo[undo.length - 1];
    if (!entry) return;
    setUndo((list) => list.slice(0, -1));
    void apply(entry.changes, `Deshiciste el cambio: ${entry.label.charAt(0).toLowerCase()}${entry.label.slice(1)}.`);
  };

  const clearTryOn = () => {
    setTryOn(new Map());
    setMessage('Volviste a como estabas.');
  };

  /** Dejar de probarse una prenda (la ✕ de su fila en el espejo). */
  const stopTrying = (item: StudentAvatarItem) => {
    setTryOn((map) => { const next = new Map(map); next.delete(item.slot); return next; });
    setMessage(`Ya no te pruebas «${item.name}».`);
  };

  const runCurtain = (swap: () => void) => {
    if (reduced) {
      swap();
      return;
    }
    setCurtain((key) => key + 1);
    later(swap, CURTAIN_SWAP_MS);
    later(() => setCurtain(0), CURTAIN_MS);
  };

  const refreshAfterSpend = () => {
    void queryClient.invalidateQueries({ queryKey: myAvatarKey(profileId) });
    void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    void queryClient.invalidateQueries({ queryKey: ['my-progress', profileId] });
    void queryClient.invalidateQueries({ queryKey: myShopKey(profileId) });
    void queryClient.invalidateQueries({ queryKey: ['avatar-equipped', profileId] });
  };

  /** Ya es suya (compra o regalo): si se la puso, cortina de estreno; el foco va a su tarjeta. */
  const owned = (result: AvatarPurchaseResult, item: StudentAvatarItem) => {
    const slotItem = toSlotItem(item);
    const announce = result.goalReached
      ? `¡Cumpliste tu meta! «${item.name}» es tuya.`
      : result.equipped
        ? `¡Estrenaste «${item.name}»!${result.gift ? ' Fue tu regalo.' : ''}`
        : `¡«${item.name}» es tuya!${result.gift ? ' Fue tu regalo.' : ''}`;
    const done = () => {
      // Puesta: la prueba se retira sola cuando lo guardado la muestra (sin parpadeo). Si no se la puso, ya.
      if (result.equipped) commitSlot(item.slot, slotItem);
      else setTryOn((map) => { const next = new Map(map); next.delete(item.slot); return next; });
      // Lo que tenía puesto pasa a «Deshacer»: la prenda nueva sigue siendo suya.
      updateView((old) => ({
        ...old,
        giftAvailable: result.gift ? false : old.giftAvailable,
        goal: result.goalReached ? null : old.goal,
        profile: { ...old.profile, gold: result.newBalance },
        items: old.items.map((entry) => (entry.id === item.id ? { ...entry, owned: true } : entry)),
      }));
      setMessage(announce);
      refreshAfterSpend();
    };
    if (result.equipped) {
      const previous = wornNow(item.slot);
      setUndo((list) => [...list.slice(-(UNDO_MAX - 1)), {
        changes: [{ slot: item.slot, item: previous }],
        label: previous ? `Vuelve «${previous.name}»; «${item.name}» sigue siendo tuya` : `Te quitas «${item.name}»; sigue siendo tuya`,
      }]);
      runCurtain(done);
    } else {
      done();
    }
    setFocusItem(item.id);
  };

  const isConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

  /** Comprar. Si ya era suya (otra pestaña), no es un error: se recarga y se avisa. */
  const buy = async (item: StudentAvatarItem, equip: boolean) => {
    try {
      owned(await avatarApi.purchase(profileId, item.id, equip), item);
    } catch (error) {
      if (!isConflict(error)) throw error;
      setTryOn((map) => { const next = new Map(map); next.delete(item.slot); return next; });
      setMessage(`«${item.name}» ya era tuya: está en tu clóset.`);
      void queryClient.invalidateQueries({ queryKey: myAvatarKey(profileId) });
    }
  };

  /** Elegir el regalo. Si ya lo eligió (otra pestaña), el modal lo dice y el clóset se recarga. */
  const claimGift = async (item: StudentAvatarItem, equip: boolean) => {
    try {
      owned(await avatarApi.claimGift(profileId, item.id, equip), item);
    } catch (error) {
      if (isConflict(error)) void queryClient.invalidateQueries({ queryKey: myAvatarKey(profileId) });
      throw error;
    }
  };

  /** Su meta de ahorro (la única: reemplaza a la de premios). */
  const toggleGoal = async (item: StudentAvatarItem) => {
    const isGoal = viewRef.current.goal?.kind === 'AVATAR' && viewRef.current.goal.itemId === item.id;
    try {
      await avatarApi.setGoal(profileId, isGoal ? null : item.id);
      updateView((old) => ({ ...old, goal: isGoal ? null : { kind: 'AVATAR', itemId: item.id } }));
      setMessage(isGoal ? 'Quitaste tu meta.' : `Tu meta ahora es «${item.name}».`);
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      void queryClient.invalidateQueries({ queryKey: myShopKey(profileId) });
    } catch (error) {
      setAlert(errorMessage(error, 'No se pudo guardar tu meta.'));
    }
  };

  /** Cambiar de cuerpo: se guarda, se trae el clóset del otro cuerpo y la cortina cubre el cambio. */
  const changeBody = async (gender: AvatarGender) => {
    setBodyBusy(true);
    setAlert('');
    try {
      await avatarApi.setBody(profileId, gender);
      const fresh = await avatarApi.getStudentView(profileId);
      const mine = fresh.items.filter((item) => item.owned && !item.isDefault).length;
      runCurtain(() => {
        setTryOn(new Map());
        confirmed.current.clear();
        setOverrides((map) => map.clear());
        setUndo([]);
        queryClient.setQueryData(myAvatarKey(profileId), fresh);
        setMessage(`Tu personaje ahora es ${BODY_LABEL[gender].toLowerCase()}.${mine > 0 ? ` Aquí tienes ${mine === 1 ? '1 prenda tuya' : `${mine} prendas tuyas`}.` : ''}`);
      });
      void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      void queryClient.invalidateQueries({ queryKey: ['avatar-equipped', profileId] });
      void queryClient.invalidateQueries({ queryKey: myShopKey(profileId) });
    } catch (error) {
      setAlert(errorMessage(error, 'No se pudo cambiar el cuerpo de tu personaje.'));
    } finally {
      setBodyBusy(false);
    }
  };

  const saving = overrides.size > 0;
  const clearFocus = useCallback(() => setFocusItem(null), []);

  return {
    reduced,
    layers,
    worn,
    tryOn,
    undo: undo[undo.length - 1] ?? null,
    message,
    alert,
    curtain,
    focusItem,
    clearFocus,
    saving,
    bodyBusy,
    select,
    selectNone,
    undoLast,
    clearTryOn,
    stopTrying,
    buy,
    claimGift,
    toggleGoal,
    changeBody,
  };
};

export type Closet = ReturnType<typeof useCloset>;
