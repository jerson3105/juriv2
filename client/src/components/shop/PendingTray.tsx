import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Coins, ShoppingCart, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi, shopImageUrl, type ItemUsage, type PendingPurchase } from '../../lib/shopApi';
import { shopInventoryKey } from './shopHelpers';

interface PendingTrayProps {
  classroomId: string;
  nameOf: (studentId: string, fallback: string | null) => string;
}

type Entry =
  | { kind: 'purchase'; id: string; at: string; data: PendingPurchase }
  | { kind: 'usage'; id: string; at: string; data: ItemUsage };

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
};

const ItemIcon = ({ icon, imageUrl }: { icon: string | null; imageUrl?: string | null }) =>
  imageUrl ? (
    <img src={shopImageUrl(imageUrl)} alt="" className="h-11 w-11 rounded-xl object-cover" />
  ) : (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-2xl dark:bg-amber-900/40" aria-hidden="true">{icon || '🎁'}</span>
  );

// Todo lo que espera al profesor en la tienda: compras por aprobar y usos por canjear.
export const PendingTray = ({ classroomId, nameOf }: PendingTrayProps) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data: pendingPurchases = [] } = useQuery({
    queryKey: ['pending-purchases', classroomId],
    queryFn: () => shopApi.getPendingPurchases(classroomId),
  });
  const { data: pendingUsages = [] } = useQuery({
    queryKey: ['pending-usages', classroomId],
    queryFn: () => shopApi.getPendingUsages(classroomId),
  });

  const entries: Entry[] = useMemo(() => [
    ...pendingPurchases.map((p): Entry => ({ kind: 'purchase', id: p.id, at: p.purchasedAt, data: p })),
    ...pendingUsages.map((u): Entry => ({ kind: 'usage', id: u.id, at: u.usedAt, data: u })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [pendingPurchases, pendingUsages]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-purchases', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['pending-usages', classroomId] });
    queryClient.invalidateQueries({ queryKey: shopInventoryKey(classroomId) });
    queryClient.invalidateQueries({ queryKey: ['shop-items', classroomId] });
    queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
  };

  const run = (entry: Entry, approve: boolean) => {
    if (entry.kind === 'purchase') return approve ? shopApi.approvePurchase(entry.id) : shopApi.rejectPurchase(entry.id);
    return shopApi.reviewUsage(entry.id, approve ? 'APPROVED' : 'REJECTED');
  };

  const act = async (entry: Entry, approve: boolean) => {
    setBusy((prev) => new Set(prev).add(entry.id));
    try {
      await run(entry, approve);
      const name = nameOf(entry.data.student.id, entry.data.student.characterName);
      if (entry.kind === 'purchase') toast.success(approve ? `Compra aprobada: ${entry.data.item.name} para ${name}` : `Compra rechazada: ${entry.data.item.name}`);
      else toast.success(approve ? `Uso aprobado: ${entry.data.item.name}` : `Uso rechazado: ${name} conserva ${entry.data.item.name}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo completar'));
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      refresh();
    }
  };

  const approveAll = async () => {
    setBulkBusy(true);
    const outcomes = await Promise.allSettled(entries.map((entry) => run(entry, true)));
    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    const done = entries.length - failed;
    refresh();
    setBulkBusy(false);
    if (failed === 0) toast.success(`Aprobado todo (${done})`);
    else toast.error(`Aprobados ${done} de ${entries.length}; ${failed} no se pudieron (p. ej. sin oro suficiente)`);
  };

  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="pending-tray-title" className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-800">
        <h2 id="pending-tray-title" className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white" aria-hidden="true">
            <ShoppingCart size={16} />
          </span>
          Por atender
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-black text-white">{entries.length}</span>
        </h2>
        {entries.length > 1 && (
          <button
            type="button"
            onClick={() => void approveAll()}
            disabled={bulkBusy}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-green-700 px-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"
          >
            <CheckCheck size={16} aria-hidden="true" />
            {bulkBusy ? 'Aprobando...' : 'Aprobar todo'}
          </button>
        )}
      </div>
      <ul className="divide-y divide-amber-200 dark:divide-amber-900">
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            const name = nameOf(entry.data.student.id, entry.data.student.characterName);
            const isBusy = busy.has(entry.id) || bulkBusy;
            const purchase = entry.kind === 'purchase' ? entry.data : null;
            const shortOfGold = purchase && purchase.student.gp !== undefined && purchase.student.gp < purchase.totalPrice;
            return (
              <motion.li
                key={`${entry.kind}-${entry.id}`}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="flex flex-wrap items-center gap-3 bg-white/70 px-4 py-3 dark:bg-gray-900/40"
              >
                <ItemIcon icon={entry.data.item.icon} imageUrl={entry.data.item.imageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-bold">{name}</span>{' '}
                    {entry.kind === 'purchase' ? 'quiere comprar' : 'quiere usar'}{' '}
                    <span className="font-bold">{entry.data.item.name}</span>
                    {purchase && purchase.quantity > 1 && <span className="font-semibold"> ×{purchase.quantity}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${entry.kind === 'purchase' ? 'bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50' : 'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100'}`}>
                      {entry.kind === 'purchase' ? <Coins size={12} aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                      {entry.kind === 'purchase' ? `Compra · ${purchase!.totalPrice} GP` : 'Uso'}
                    </span>
                    <span>{timeAgo(entry.at)}</span>
                    {shortOfGold && <span className="font-semibold text-red-700 dark:text-red-300">Ya no tiene oro suficiente ({purchase!.student.gp} GP)</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void act(entry, false)}
                    disabled={isBusy}
                    aria-label={`Rechazar: ${name}, ${entry.data.item.name}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-red-300 px-3 text-sm font-bold text-red-800 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/30"
                  >
                    <X size={16} aria-hidden="true" />
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(entry, true)}
                    disabled={isBusy}
                    aria-label={`Aprobar: ${name}, ${entry.data.item.name}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-green-700 px-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    <Check size={16} aria-hidden="true" />
                    Aprobar
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
};
