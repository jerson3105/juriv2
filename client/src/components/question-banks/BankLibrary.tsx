import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Copy, Library, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type { Classroom } from '../../lib/classroomApi';
import { getBankEmoji, questionBankApi, type TeacherBank } from '../../lib/questionBankApi';
import { inputClass, primaryButton } from '../home/homeHelpers';
import { secondaryButton } from '../gradebook/gradebookHelpers';
import { ActionMenu } from '../home/ActionMenu';
import { showUndoToast } from '../storytelling/undoToast';
import { ACTIVITY_NAMES, bankActivities, bankRoute, errorMessage } from './bankHelpers';
import { BankFormDialog } from './BankFormDialog';
import { CreateQuestionsDialog } from './CreateQuestionsDialog';
import { DuplicateBankDialog } from './DuplicateBankDialog';

type Scope = 'class' | 'all';
const SCOPE_KEY = 'question-banks-scope';

const readScope = (): Scope => {
  try {
    return localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'class';
  } catch {
    return 'class';
  }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Biblioteca: bancos de esta clase o de todas las clases del docente. */
export const BankLibrary = ({ classroom }: { classroom: Classroom }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scope, setScopeState] = useState<Scope>(readScope);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [bankForm, setBankForm] = useState<TeacherBank | 'new' | null>(null);
  const [duplicating, setDuplicating] = useState<TeacherBank | null>(null);

  const { data: banks = [], isLoading, isError, refetch } = useQuery({ queryKey: ['question-banks-mine'], queryFn: questionBankApi.getMyBanks });

  const setScope = (value: Scope) => {
    setScopeState(value);
    try {
      localStorage.setItem(SCOPE_KEY, value);
    } catch { /* sin almacenamiento: solo esta visita */ }
  };

  const classBanks = useMemo(() => banks.filter((b) => b.classroomId === classroom.id), [banks, classroom.id]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = scope === 'class' ? classBanks : banks;
    return term ? list.filter((b) => `${b.name} ${b.description ?? ''} ${b.classroomName}`.toLowerCase().includes(term)) : list;
  }, [banks, classBanks, scope, search]);
  const otherCount = banks.length - classBanks.length;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
  const remove = useMutation({
    mutationFn: (bank: TeacherBank) => questionBankApi.deleteBank(bank.id),
    onSuccess: (_, bank) => {
      refresh();
      showUndoToast(`Banco eliminado: ${bank.name}`, () => questionBankApi.restoreBank(bank.id), refresh);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el banco')),
  });

  const scopeButton = (value: Scope, label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      aria-pressed={scope === value}
      className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${scope === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Library size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Banco de preguntas</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Preguntas para jugar en el Observatorio de Jiro y en Expediciones</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setBankForm('new')} className={secondaryButton}>
            <Plus size={16} aria-hidden="true" /> Nuevo banco
          </button>
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
            <Sparkles size={16} aria-hidden="true" /> Crear preguntas
          </button>
        </div>
      </div>

      {banks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Qué bancos ver">
            {scopeButton('class', 'Esta clase')}
            {scopeButton('all', 'Todas mis clases')}
          </div>
          <div className="relative min-w-0 flex-1 basis-full sm:max-w-xs sm:basis-auto">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
            <label htmlFor="bank-search" className="sr-only">Buscar banco</label>
            <input id="bank-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar banco" className={`${inputClass} pl-9`} />
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300" role="status">Cargando bancos…</p>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
          No se pudieron cargar los bancos. <button type="button" onClick={() => void refetch()} className="inline-block py-1.5 font-bold underline">Reintentar</button>
        </div>
      ) : banks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">📚</span><span className="text-5xl">❓</span><span className="text-4xl">⭐</span>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Crea tu primer banco de preguntas</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
            Créalas con IA a partir de un tema o un PDF, o escríbelas tú. Luego las juegas en clase en el Observatorio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
              <Sparkles size={16} aria-hidden="true" /> Crear preguntas
            </button>
            <button type="button" onClick={() => setBankForm('new')} className={secondaryButton}>
              <Plus size={16} aria-hidden="true" /> Nuevo banco
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-800 dark:border-gray-600 dark:text-gray-100">
          {search.trim() ? (
            <p>Ningún banco coincide con «{search.trim()}».</p>
          ) : (
            <>
              <p>{classroom.name} aún no tiene bancos.</p>
              {otherCount > 0 && (
                <p className="mt-2">
                  Tienes {plural(otherCount, 'banco', 'bancos')} en otras clases.{' '}
                  <button type="button" onClick={() => setScope('all')} className="inline-block py-1.5 font-bold text-primary-700 underline dark:text-primary-300">Verlos y duplicar</button>
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((bank) => {
            const activities = bankActivities(bank);
            const otherClass = bank.classroomId !== classroom.id;
            return (
              <li key={bank.id} className="relative flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white hover:border-primary-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-400">
                <Link to={bankRoute(classroom.id, bank.id)} className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl p-4 pr-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${bank.color}26` }} aria-hidden="true">
                      {getBankEmoji(bank.icon)}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 break-words font-bold text-gray-900 dark:text-white">{bank.name}</span>
                      {(scope === 'all' || otherClass) && (
                        <span className="block truncate text-xs text-gray-700 dark:text-gray-300">
                          {bank.classroomName}{bank.classroomArchived ? ' (archivada)' : ''}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {bank.questionCount === 0 ? (
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Vacío</span>
                    ) : (
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{plural(bank.questionCount, 'pregunta', 'preguntas')}</span>
                    )}
                    {bank.stats.unreviewed > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">{bank.stats.unreviewed} por revisar</span>
                    )}
                  </span>
                  {bank.questionCount > 0 && (
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {activities.length > 0
                        ? `Sirve para: ${activities.map((a) => ACTIVITY_NAMES[a.key]).join(' · ')}`
                        : 'Ninguna se proyecta: solo Sorteo y Expediciones'}
                    </span>
                  )}
                </Link>
                <div className="absolute right-2 top-2">
                  <ActionMenu
                    label={`Más acciones de ${bank.name}`}
                    items={[
                      { label: 'Editar banco', icon: Pencil, onClick: () => setBankForm(bank) },
                      { label: otherClass ? 'Duplicar en una clase' : 'Duplicar', icon: Copy, onClick: () => setDuplicating(bank) },
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => remove.mutate(bank) },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateQuestionsDialog
          classroomId={classroom.id}
          onClose={() => setCreating(false)}
          onSaved={(bankId) => navigate(bankRoute(classroom.id, bankId))}
          onWrite={(bankId) => navigate(`${bankRoute(classroom.id, bankId)}?nueva=1`)}
        />
      )}
      {bankForm && (
        <BankFormDialog
          classroomId={classroom.id}
          bank={bankForm === 'new' ? null : bankForm}
          onClose={() => setBankForm(null)}
          onSaved={(saved) => { if (bankForm === 'new') navigate(bankRoute(classroom.id, saved.id)); }}
        />
      )}
      {duplicating && (
        <DuplicateBankDialog bank={duplicating} currentClassroomId={classroom.id} onClose={() => setDuplicating(null)} />
      )}
    </div>
  );
};
