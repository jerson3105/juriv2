import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Backpack, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi, shopImageUrl, type ClassroomInventory } from '../../lib/shopApi';
import { shopInventoryKey } from './shopHelpers';

interface InventoryPanelProps {
  classroomId: string;
  nameOf: (studentId: string, fallback: string | null) => string;
  onClose: () => void;
}

type Owned = ClassroomInventory['owned'][number];

const formatDate = (iso: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(iso));

const USAGE_STATUS = {
  PENDING: { label: 'Por revisar', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  APPROVED: { label: 'Canjeado', chip: 'bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100' },
  REJECTED: { label: 'Rechazado (lo conserva)', chip: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100' },
} as const;

const Icon = ({ icon, imageUrl }: { icon: string | null; imageUrl: string | null }) =>
  imageUrl ? <img src={shopImageUrl(imageUrl)} alt="" className="h-5 w-5 rounded object-cover" /> : <span aria-hidden="true">{icon || '🎁'}</span>;

// Quién tiene qué, cuánto le queda por usar y qué se ha canjeado.
export const InventoryPanel = ({ classroomId, nameOf, onClose }: InventoryPanelProps) => {
  const queryClient = useQueryClient();
  const isPresent = useIsPresent();
  const [tab, setTab] = useState<'students' | 'usages'>('students');
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: shopInventoryKey(classroomId),
    queryFn: () => shopApi.getInventory(classroomId),
  });

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    if (!confirmId) return;
    const timer = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  const term = search.trim().toLocaleLowerCase('es');
  const byStudent = useMemo(() => {
    const map = new Map<string, { name: string; rows: Owned[] }>();
    for (const row of data?.owned ?? []) {
      const name = nameOf(row.student.id, row.student.characterName);
      if (!map.has(row.student.id)) map.set(row.student.id, { name, rows: [] });
      map.get(row.student.id)!.rows.push(row);
    }
    return [...map.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .filter((s) => !term || s.name.toLocaleLowerCase('es').includes(term) || s.rows.some((r) => r.item.name.toLocaleLowerCase('es').includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data, nameOf, term]);

  const usages = (data?.usages ?? []).filter((u) =>
    !term || nameOf(u.student.id, u.student.characterName).toLocaleLowerCase('es').includes(term) || u.item.name.toLocaleLowerCase('es').includes(term));

  const takeBack = async (row: Owned, studentName: string) => {
    if (confirmId !== row.purchaseId) {
      setConfirmId(row.purchaseId);
      return;
    }
    setConfirmId(null);
    try {
      await shopApi.undoGive(row.purchaseId);
      toast.success(`Quitado: ${row.item.name} a ${studentName}`);
      queryClient.invalidateQueries({ queryKey: shopInventoryKey(classroomId) });
      queryClient.invalidateQueries({ queryKey: ['shop-items', classroomId] });
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo quitar');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-title"
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 md:max-w-2xl"
      >
        <div className="border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white" aria-hidden="true">
                <Backpack size={18} />
              </span>
              <div>
                <h2 id="inventory-title" className="text-lg font-bold text-gray-900 dark:text-white">Inventario de la clase</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300">Qué tiene cada estudiante y qué ha canjeado</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar estudiante o artículo"
                aria-label="Buscar estudiante o artículo"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist" aria-label="Ver inventario">
              {([['students', 'Por estudiante'], ['usages', 'Canjes']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${tab === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {isLoading && [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
          {isError && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">No se pudo cargar el inventario.</p>}

          {data && tab === 'students' && (
            byStudent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Nadie tiene artículos todavía.</p>
            ) : byStudent.map((student) => (
              <div key={student.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="font-bold text-gray-900 dark:text-white">{student.name}</p>
                <ul className="mt-2 space-y-1.5">
                  {student.rows.map((row) => {
                    const left = row.quantity - (row.usedQuantity || 0);
                    const canTakeBack = row.purchaseType === 'TEACHER' && (row.usedQuantity || 0) === 0;
                    return (
                      <li key={row.purchaseId} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm dark:bg-gray-900/40">
                        <Icon icon={row.item.icon} imageUrl={row.item.imageUrl} />
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{row.item.name}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {row.item.category === 'CONSUMABLE' ? `${left} de ${row.quantity} por usar` : 'Permanente'}
                          {' · '}
                          {row.purchaseType === 'TEACHER' ? 'regalo tuyo' : row.purchaseType === 'GIFT' ? 'regalo' : 'comprado'} {formatDate(row.purchasedAt)}
                        </span>
                        {canTakeBack && (
                          <button
                            type="button"
                            onClick={() => void takeBack(row, student.name)}
                            aria-label={confirmId === row.purchaseId ? `Confirmar: quitar ${row.item.name} a ${student.name}` : `Quitar ${row.item.name} a ${student.name}`}
                            className={`min-h-[32px] rounded-lg px-2.5 text-xs font-bold ${confirmId === row.purchaseId ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'}`}
                          >
                            {confirmId === row.purchaseId ? '¿Quitar? Toca otra vez' : 'Quitar'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          {data && tab === 'usages' && (
            usages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">Todavía no hay canjes.</p>
            ) : (
              <ul className="space-y-2">
                {usages.map((usage) => (
                  <li key={usage.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
                    <Icon icon={usage.item.icon} imageUrl={usage.item.imageUrl} />
                    <span className="min-w-0 flex-1 text-gray-900 dark:text-white">
                      <span className="font-bold">{nameOf(usage.student.id, usage.student.characterName)}</span> · {usage.item.name}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${USAGE_STATUS[usage.status].chip}`}>{USAGE_STATUS[usage.status].label}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{formatDate(usage.usedAt)}</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
};
