import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Search, UserCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { shopApi, type GiveBulkResult, type ShopItem } from '../../lib/shopApi';
import { classroomApi } from '../../lib/classroomApi';
import { attendanceApi, type AttendanceRecord } from '../../lib/attendanceApi';
import { studentLabel } from '../badges/badgeHelpers';
import { PriceTag, ShopDisplay } from './ShopDisplay';
import { SHOP_RARITY_STYLE, shopInventoryKey } from './shopHelpers';

interface GiveItemModalProps {
  item: ShopItem;
  classroomId: string;
  showCharacterName: boolean;
  onClose: () => void;
}

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Regalar un artículo (gratis) a uno o varios estudiantes, con Deshacer mientras no lo usen.
export const GiveItemModal = ({ item, classroomId, showCharacterName, onClose }: GiveItemModalProps) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isGiving, setIsGiving] = useState(false);
  const isPresent = useIsPresent();
  const today = localToday();

  const { data: classroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId),
  });
  const { data: inventory } = useQuery({
    queryKey: shopInventoryKey(classroomId),
    queryFn: () => shopApi.getInventory(classroomId),
  });
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-today', classroomId, today],
    queryFn: () => attendanceApi.getAttendanceByDate(classroomId, today),
  });

  const students = useMemo(
    () => [...(classroom?.students ?? [])].sort((a, b) => studentLabel(a, showCharacterName).localeCompare(studentLabel(b, showCharacterName), 'es')),
    [classroom, showCharacterName],
  );
  // Unidades de este artículo que cada estudiante tiene sin usar.
  const owned = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory?.owned ?? []) {
      if (row.item.id !== item.id) continue;
      map.set(row.student.id, (map.get(row.student.id) ?? 0) + row.quantity - (row.usedQuantity || 0));
    }
    return map;
  }, [inventory, item.id]);
  const presentIds = useMemo(() => {
    if (todayAttendance.length === 0) return null;
    return new Set(todayAttendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').map((r) => r.studentProfileId));
  }, [todayAttendance]);

  const term = search.trim().toLocaleLowerCase('es');
  const visible = term
    ? students.filter((s) => `${s.characterName ?? ''} ${s.realName ?? ''} ${s.realLastName ?? ''}`.toLocaleLowerCase('es').includes(term))
    : students;
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
  const nameOf = (id: string) => {
    const student = students.find((s) => s.id === id);
    return student ? studentLabel(student, showCharacterName) : 'Estudiante';
  };
  const stockLeft = item.stock;
  const overStock = stockLeft !== null && selected.size > stockLeft;

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: shopInventoryKey(classroomId) });
    queryClient.invalidateQueries({ queryKey: ['shop-items', classroomId] });
  };

  const undo = async (result: GiveBulkResult) => {
    const toastId = toast.loading('Deshaciendo...');
    const outcomes = await Promise.allSettled(result.given.map((g) => shopApi.undoGive(g.purchaseId)));
    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    refresh();
    if (failed === 0) toast.success(`Deshecho: ${item.name}`, { id: toastId });
    else toast.error(`No se pudo deshacer en ${failed} de ${result.given.length} (ya lo usaron)`, { id: toastId });
  };

  const give = async () => {
    if (selected.size === 0 || isGiving) return;
    setIsGiving(true);
    try {
      const result = await shopApi.giveBulk(item.id, Array.from(selected));
      refresh();
      if (result.given.length === 0) {
        toast.error(result.failed[0]?.message || 'No se pudo dar el artículo');
        return;
      }
      const who = result.given.length === 1 ? nameOf(result.given[0].studentId) : `${result.given.length} estudiantes`;
      const skipped = result.failed.length > 0 ? ` · ${result.failed.length} sin recibir (${result.failed[0].message})` : '';
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>{item.icon} {item.name} para {who}{skipped}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                void undo(result);
              }}
              className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              Deshacer
            </button>
          </span>
        ),
        { duration: 8000 },
      );
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo dar el artículo'));
    } finally {
      setIsGiving(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const secondary = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="give-item-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center gap-4 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="w-28 flex-shrink-0">
            <ShopDisplay item={item} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dar gratis a estudiantes</p>
            <h2 id="give-item-title" className="truncate text-xl font-black text-gray-900 dark:text-white">{item.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PriceTag price={item.price} />
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SHOP_RARITY_STYLE[item.rarity].chip}`}>{SHOP_RARITY_STYLE[item.rarity].label}</span>
              {stockLeft !== null && <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Quedan {stockLeft}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center self-start rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar estudiante"
              aria-label="Buscar estudiante"
              className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelected((prev) => {
              const next = new Set(prev);
              visible.forEach((s) => (allVisibleSelected ? next.delete(s.id) : next.add(s.id)));
              return next;
            })}
            aria-pressed={allVisibleSelected}
            className={secondary}
          >
            <Users size={16} aria-hidden="true" />
            {allVisibleSelected ? 'Ninguno' : 'Todos'}
          </button>
          {presentIds && (
            <button type="button" onClick={() => setSelected(new Set(students.filter((s) => presentIds.has(s.id)).map((s) => s.id)))} className={secondary}>
              <UserCheck size={16} aria-hidden="true" />
              Solo presentes
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!classroom ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">Cargando estudiantes...</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">No hay estudiantes que coincidan.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visible.map((student) => {
                const isSelected = selected.has(student.id);
                const has = owned.get(student.id) ?? 0;
                const name = studentLabel(student, showCharacterName);
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => toggle(student.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
                          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`} aria-hidden="true">
                        {isSelected ? <Check size={18} /> : name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
                        <span className="block text-xs text-gray-700 dark:text-gray-300">{student.gp} GP</span>
                      </span>
                      {has > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                          Tiene {has}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
          <p className={`text-sm ${overStock ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`} role="status">
            {overStock ? `Solo quedan ${stockLeft}: algunos no lo recibirán` : 'No les cuesta oro.'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void give()}
              disabled={selected.size === 0 || isGiving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
            >
              <Gift size={16} aria-hidden="true" />
              {isGiving ? 'Dando...' : selected.size === 0 ? 'Elige estudiantes' : `Dar a ${selected.size}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
