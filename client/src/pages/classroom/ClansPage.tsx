import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Shuffle,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  X,
  Check,
  Shield,
  Search,
  Zap,
  Crown,
  Activity,
  Clock,
  Medal,
  ArrowRightLeft,
  Trophy,
  Flag,
} from 'lucide-react';
import { clanApi, CLAN_EMBLEMS, type ClanWithMembers, type ClanMember, type CreateClanData } from '../../lib/clanApi';
import { classroomApi } from '../../lib/classroomApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const CLAN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

type ClassroomStudent = {
  id: string;
  characterName?: string | null;
  displayName?: string | null;
  teamId?: string | null;
  isActive?: boolean;
  level?: number;
  characterClass?: string;
  characterClassId?: string | null;
  user?: { firstName?: string };
};

// Alumno elegido para mover: de qué clan viene (null = sin clan).
type SelectedMember = { studentId: string; name: string; fromClanId: string | null };

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const ClansPage = () => {
  const { classroom } = useOutletContext<{ classroom: { id: string; clansEnabled?: boolean; students?: ClassroomStudent[] } }>();
  const queryClient = useQueryClient();
  const { classMap } = useCharacterClasses(classroom?.id);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClan, setEditingClan] = useState<ClanWithMembers | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [clanToDelete, setClanToDelete] = useState<ClanWithMembers | null>(null);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);

  // Obtener clanes
  const { data: clans, isLoading } = useQuery({
    queryKey: ['clans', classroom?.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom?.id && !!classroom?.clansEnabled,
  });

  const classroomStudents: ClassroomStudent[] = classroom?.students || [];
  // Obtener estudiantes sin clan (incluyendo demo)
  const studentsWithoutClan = classroomStudents.filter((s) => !s.teamId && s.isActive !== false);

  // Top contributors
  const { data: topContributors } = useQuery({
    queryKey: ['clans', 'top-contributors', classroom?.id],
    queryFn: () => clanApi.getTopContributors(classroom.id, 10),
    enabled: !!classroom?.id && !!classroom?.clansEnabled,
  });

  // Feed de aportes (paginado)
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['clans', 'feed', classroom?.id],
    queryFn: ({ pageParam }) => clanApi.getClanFeed(classroom.id, 15, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!classroom?.id && !!classroom?.clansEnabled,
  });

  const clanFeed = feedData?.pages.flatMap((p) => p.items) ?? [];

  const refreshClans = () => {
    queryClient.invalidateQueries({ queryKey: ['clans'] });
    queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
  };

  const classIconOf = (studentId: string, characterClass?: string) => {
    const student = classroomStudents.find((s) => s.id === studentId);
    const info = (student?.characterClassId && classMap[student.characterClassId]) || classMap[student?.characterClass || characterClass || ''];
    return info?.icon || '👤';
  };

  const memberName = (member: ClanMember) => member.characterName || `${member.firstName} ${member.lastName}`.trim();
  const studentName = (student: ClassroomStudent) => student.characterName || student.displayName || student.user?.firstName || 'Sin nombre';

  // Crear clan
  const createMutation = useMutation({
    mutationFn: (data: CreateClanData) => clanApi.createClan(classroom.id, data),
    onSuccess: () => {
      refreshClans();
      setShowCreateModal(false);
      toast.success('Clan creado');
    },
    onError: () => toast.error('Error al crear clan'),
  });

  // Actualizar clan
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClanData> }) => clanApi.updateClan(id, data),
    onSuccess: () => {
      refreshClans();
      setEditingClan(null);
      toast.success('Clan actualizado');
    },
    onError: () => toast.error('Error al actualizar clan'),
  });

  // Eliminar clan
  const deleteMutation = useMutation({
    mutationFn: (id: string) => clanApi.deleteClan(id),
    onSuccess: () => {
      refreshClans();
      setClanToDelete(null);
      toast.success('Clan eliminado');
    },
    onError: () => toast.error('Error al eliminar clan'),
  });

  // Asignar estudiante (desde el modal "Agregar")
  const assignMutation = useMutation({
    mutationFn: ({ clanId, studentId }: { clanId: string; studentId: string }) =>
      clanApi.assignStudent(clanId, studentId),
    onSuccess: () => refreshClans(),
    onError: (error: unknown) => toast.error(errorMessage(error, 'Error al asignar')),
  });

  // Vuelve a dejar al alumno donde estaba (clan anterior o sin clan).
  const restoreMember = async (studentId: string, clanId: string | null) => {
    try {
      if (clanId) await clanApi.assignStudent(clanId, studentId);
      else await clanApi.removeStudent(studentId);
      refreshClans();
      toast.success('Cambio deshecho');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo deshacer'));
    }
  };

  const undoToast = (message: string, studentId: string, previousClanId: string | null) => {
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              void restoreMember(studentId, previousClanId);
            }}
            className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
          >
            Deshacer
          </button>
        </span>
      ),
      { duration: 8000 },
    );
  };

  // Mover (o asignar) a un clan: el servidor cambia de clan en un paso y respeta el cupo.
  const moveMutation = useMutation({
    mutationFn: ({ studentId, toClanId }: { studentId: string; toClanId: string }) =>
      clanApi.assignStudent(toClanId, studentId),
    onSuccess: (_data, { studentId, toClanId }) => {
      const moved = selectedMember;
      const target = clans?.find((c) => c.id === toClanId);
      setSelectedMember(null);
      refreshClans();
      if (moved) undoToast(`${moved.name} pasó a ${target?.name || 'otro clan'}`, studentId, moved.fromClanId);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo mover')),
  });

  // Quitar del clan (con deshacer en lugar de confirmación)
  const removeMutation = useMutation({
    mutationFn: (studentId: string) => clanApi.removeStudent(studentId),
    onSuccess: (_data, studentId) => {
      const removed = selectedMember;
      setSelectedMember(null);
      refreshClans();
      if (removed) undoToast(`${removed.name} quedó sin clan`, studentId, removed.fromClanId);
    },
    onError: () => toast.error('Error al quitar del clan'),
  });

  // Asignar aleatoriamente
  const randomAssignMutation = useMutation({
    mutationFn: () => clanApi.assignRandomly(classroom.id),
    onSuccess: (data) => {
      refreshClans();
      toast.success(`${data.assigned} estudiantes asignados a ${data.clans} clanes`);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'Error al asignar')),
  });

  // Activar el sistema de clanes desde aquí (antes había que buscarlo en la configuración)
  const enableClansMutation = useMutation({
    mutationFn: () => classroomApi.update(classroom.id, { clansEnabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Clanes activados');
    },
    onError: () => toast.error('No se pudieron activar los clanes'),
  });

  const toggleMember = (member: SelectedMember) => {
    setSelectedMember((current) => (current?.studentId === member.studentId ? null : member));
  };

  if (!classroom?.clansEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Los clanes están desactivados</h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-6">
          Activa los clanes para organizar a tus estudiantes en equipos que compiten sumando XP.
        </p>
        <button
          type="button"
          onClick={() => enableClansMutation.mutate()}
          disabled={enableClansMutation.isPending}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
        >
          <Shield size={18} aria-hidden="true" />
          Activar clanes
        </button>
      </div>
    );
  }

  const ranking = [...(clans || [])].sort((a, b) => b.totalXp - a.totalXp);
  const maxClanXp = Math.max(...ranking.map((c) => c.totalXp), 1);
  const otherClans = (fromClanId: string | null) => (clans || []).filter((c) => c.id !== fromClanId);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <Shield size={20} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
            Clanes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {clans?.length || 0} clanes · {studentsWithoutClan.length} sin clan
          </p>
        </div>
        {studentsWithoutClan.length > 0 && clans && clans.length > 0 && (
          <button
            type="button"
            onClick={() => randomAssignMutation.mutate()}
            disabled={randomAssignMutation.isPending}
            className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Shuffle size={16} aria-hidden="true" />
            Repartir sin clan al azar
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
        >
          <Plus size={16} aria-hidden="true" />
          Nuevo clan
        </button>
      </div>

      {/* Podio: quién va ganando (proyectable) */}
      {ranking.length > 0 && (
        <section aria-label="Ranking de clanes" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h2 className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Trophy size={16} className="text-amber-500" aria-hidden="true" />
            Ranking de clanes
          </h2>
          <ol className="space-y-2.5">
            {ranking.map((clan, index) => (
              <li key={clan.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1">
                <span className={`w-9 text-lg font-extrabold tabular-nums ${index === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  #{index + 1}
                </span>
                <span className="flex flex-1 sm:flex-none items-center gap-2 sm:w-44 min-w-0">
                  <span className="text-xl" aria-hidden="true">{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span>
                  <span className="truncate font-semibold text-gray-900 dark:text-white">{clan.name}</span>
                </span>
                <span className="order-last sm:order-none basis-full sm:basis-auto sm:flex-1 h-3 sm:h-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
                  <motion.span
                    initial={false}
                    animate={{ width: `${(clan.totalXp / maxClanXp) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="block h-full rounded-full"
                    style={{ backgroundColor: clan.color }}
                  />
                </span>
                <span className="w-24 text-right font-bold text-gray-900 dark:text-white tabular-nums">
                  {clan.totalXp.toLocaleString()} XP
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Clanes */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse h-48" />
          ))}
        </div>
      ) : clans && clans.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clans.map((clan) => (
            <ClanCard
              key={clan.id}
              clan={clan}
              isLeader={ranking[0]?.id === clan.id && clan.totalXp > 0}
              memberName={memberName}
              classIconOf={classIconOf}
              selectedStudentId={selectedMember?.studentId ?? null}
              onSelectMember={(member) => toggleMember({ studentId: member.id, name: memberName(member), fromClanId: clan.id })}
              moveTargets={selectedMember?.fromClanId === clan.id ? otherClans(clan.id) : []}
              isBusy={moveMutation.isPending || removeMutation.isPending}
              onMove={(toClanId) => selectedMember && moveMutation.mutate({ studentId: selectedMember.studentId, toClanId })}
              onRemove={() => selectedMember && removeMutation.mutate(selectedMember.studentId)}
              onCancelSelection={() => setSelectedMember(null)}
              onEdit={() => setEditingClan(clan)}
              onDelete={() => setClanToDelete(clan)}
              onAssign={() => setShowAssignModal(clan.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600 dark:text-gray-300">Crea tu primer clan para formar equipos</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-4 min-h-[40px] px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
          >
            Crear clan
          </button>
        </div>
      )}

      {/* Sin clan */}
      {clans && clans.length > 0 && studentsWithoutClan.length > 0 && (
        <section aria-label="Estudiantes sin clan" className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 p-4">
          <h2 className="flex items-center gap-2 mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <UserPlus size={16} aria-hidden="true" />
            Sin clan ({studentsWithoutClan.length}) · toca un estudiante para asignarlo
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {studentsWithoutClan.map((student) => {
              const isSelected = selectedMember?.studentId === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggleMember({ studentId: student.id, name: studentName(student), fromClanId: null })}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-100 text-primary-900 dark:bg-primary-900/50 dark:text-primary-100'
                      : 'border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-primary-400'
                  }`}
                >
                  <span aria-hidden="true">{classIconOf(student.id, student.characterClass)}</span>
                  {studentName(student)}
                </button>
              );
            })}
          </div>
          {selectedMember && selectedMember.fromClanId === null && (
            <MoveBar
              name={selectedMember.name}
              targets={otherClans(null)}
              isBusy={moveMutation.isPending}
              onMove={(toClanId) => moveMutation.mutate({ studentId: selectedMember.studentId, toClanId })}
              onCancel={() => setSelectedMember(null)}
            />
          )}
        </section>
      )}

      {/* Top contribuyentes + historial */}
      {clans && clans.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <h2 className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-800 dark:text-white">
              <Medal size={16} className="text-amber-500" aria-hidden="true" />
              Top contribuyentes
            </h2>
            <div className="p-3 max-h-[340px] overflow-y-auto">
              {!topContributors || topContributors.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-6">Aún no hay aportes registrados</p>
              ) : (
                <ol className="space-y-1.5">
                  {topContributors.map((c, idx) => (
                    <li
                      key={c.studentId}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                        idx === 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        idx === 0 ? 'bg-amber-400 text-gray-900' : idx === 1 ? 'bg-gray-500 text-white' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-lg flex-shrink-0" aria-hidden="true">{CLAN_EMBLEMS[c.clanEmblem] || '🛡️'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {c.studentName || `${c.firstName} ${c.lastName}`}
                        </span>
                        <span className="block text-xs text-gray-600 dark:text-gray-400 truncate">
                          {c.clanName} · {c.contributions} aporte{c.contributions !== 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 flex-shrink-0">
                        <Zap size={14} aria-hidden="true" /> {c.totalContributed.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <h2 className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-800 dark:text-white">
              <Activity size={16} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
              Historial de aportes
            </h2>
            <div className="p-3 max-h-[340px] overflow-y-auto">
              {clanFeed.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-6">Sin actividad reciente</p>
              ) : (
                <ul className="space-y-1">
                  {clanFeed.map((entry) => {
                    const isXp = entry.action === 'XP_CONTRIBUTED' || entry.action === 'GP_CONTRIBUTED';
                    const isJoin = entry.action === 'MEMBER_JOINED';
                    const isLeave = entry.action === 'MEMBER_LEFT';
                    // El clan llegó a la meta de una expedición (premio del clan, sin alumno).
                    const isGoal = entry.action === 'EXPEDITION_GOAL';
                    return (
                      <li key={entry.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isXp || isGoal ? 'bg-amber-100 dark:bg-amber-900/40' : isJoin ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'
                        }`} aria-hidden="true">
                          {isGoal ? <Flag size={14} className="text-amber-600 dark:text-amber-300" /> : isXp ? <Zap size={14} className="text-amber-600 dark:text-amber-300" /> : isJoin ? <UserPlus size={14} className="text-emerald-600 dark:text-emerald-300" /> : <UserMinus size={14} className="text-red-600 dark:text-red-300" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          {isGoal ? (
                            <span className="block text-sm text-gray-800 dark:text-gray-100">
                              <span className="font-medium">{CLAN_EMBLEMS[entry.clanEmblem] || '🛡️'} {entry.clanName}</span> llegó a la meta de una expedición
                              {entry.xpAmount > 0 && <> (<span className="font-bold text-amber-700 dark:text-amber-300">+{entry.xpAmount} XP</span>)</>}
                            </span>
                          ) : (
                          <span className="block text-sm text-gray-800 dark:text-gray-100">
                            <span className="font-semibold">{entry.studentName || `${entry.firstName} ${entry.lastName}`}</span>
                            {isXp && (
                              <>
                                {' '}aportó <span className="font-bold text-amber-700 dark:text-amber-300">{entry.xpAmount} XP</span> a{' '}
                              </>
                            )}
                            {isJoin && ' se unió a '}
                            {isLeave && ' dejó '}
                            <span className="font-medium">{CLAN_EMBLEMS[entry.clanEmblem] || '🛡️'} {entry.clanName}</span>
                          </span>
                          )}
                          {entry.reason && <span className="block text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">{entry.reason}</span>}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0 flex items-center gap-1 mt-0.5">
                          <Clock size={12} aria-hidden="true" /> {getRelativeTime(entry.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                  {hasNextPage && (
                    <li>
                      <button
                        type="button"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full min-h-[40px] text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg"
                      >
                        {isFetchingNextPage ? 'Cargando...' : 'Ver más'}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Modal Crear/Editar Clan */}
      <AnimatePresence>
        {(showCreateModal || editingClan) && (
          <ClanFormModal
            clan={editingClan}
            onClose={() => {
              setShowCreateModal(false);
              setEditingClan(null);
            }}
            onSubmit={(data) => {
              if (editingClan) {
                updateMutation.mutate({ id: editingClan.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Modal Asignar Estudiante */}
      <AnimatePresence>
        {showAssignModal && (
          <AssignStudentModal
            clanName={clans?.find((c) => c.id === showAssignModal)?.name || 'el clan'}
            students={studentsWithoutClan}
            studentName={studentName}
            classIconOf={classIconOf}
            onClose={() => setShowAssignModal(null)}
            onAssign={async (studentId) => {
              await assignMutation.mutateAsync({ clanId: showAssignModal, studentId });
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!clanToDelete}
        onClose={() => setClanToDelete(null)}
        onConfirm={() => clanToDelete && deleteMutation.mutate(clanToDelete.id)}
        title="Eliminar clan"
        message={clanToDelete ? `¿Eliminar "${clanToDelete.name}"? Sus ${clanToDelete.memberCount} miembros quedarán sin clan.` : ''}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// ==================== HELPERS ====================
const getRelativeTime = (dateStr: string) => {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} d`;
  return `${Math.floor(diffD / 7)} sem`;
};

// Barra de acciones al elegir un alumno: moverlo a otro clan, quitarlo o cancelar.
interface MoveBarProps {
  name: string;
  targets: ClanWithMembers[];
  isBusy: boolean;
  onMove: (toClanId: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

const MoveBar = ({ name, targets, isBusy, onMove, onRemove, onCancel }: MoveBarProps) => (
  <div className="mt-3 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 p-2.5">
    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-900 dark:text-primary-100">
      <ArrowRightLeft size={15} aria-hidden="true" />
      {onRemove ? `Mover a ${name} a:` : `Asignar a ${name} a:`}
    </p>
    <div className="flex flex-wrap gap-1.5">
      {targets.map((clan) => {
        const full = clan.memberCount >= clan.maxMembers;
        return (
          <button
            key={clan.id}
            type="button"
            onClick={() => onMove(clan.id)}
            disabled={isBusy || full}
            title={full ? 'Clan lleno' : undefined}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100 hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: clan.color }} aria-hidden="true" />
            {CLAN_EMBLEMS[clan.emblem] || '🛡️'} {clan.name}
            {full && <span className="text-xs text-gray-600 dark:text-gray-400">(lleno)</span>}
          </button>
        );
      })}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          <UserMinus size={14} aria-hidden="true" />
          Quitar del clan
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-700"
      >
        <X size={14} aria-hidden="true" />
        Cancelar
      </button>
    </div>
  </div>
);

// ==================== CLAN CARD ====================
interface ClanCardProps {
  clan: ClanWithMembers;
  isLeader: boolean;
  memberName: (member: ClanMember) => string;
  classIconOf: (studentId: string, characterClass?: string) => string;
  selectedStudentId: string | null;
  onSelectMember: (member: ClanMember) => void;
  moveTargets: ClanWithMembers[];
  isBusy: boolean;
  onMove: (toClanId: string) => void;
  onRemove: () => void;
  onCancelSelection: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
}

// El color del clan va como acento (borde y emblema) con texto oscuro sobre blanco: legible con
// cualquier color, también el amarillo.
const ClanCard = ({
  clan,
  isLeader,
  memberName,
  classIconOf,
  selectedStudentId,
  onSelectMember,
  moveTargets,
  isBusy,
  onMove,
  onRemove,
  onCancelSelection,
  onEdit,
  onDelete,
  onAssign,
}: ClanCardProps) => {
  const members = [...clan.members].sort((a, b) => b.xp - a.xp);
  const selected = members.find((m) => m.id === selectedStudentId);
  const avgLevel = members.length > 0 ? (members.reduce((s, m) => s + m.level, 0) / members.length).toFixed(1) : '0';
  const full = clan.memberCount >= clan.maxMembers;

  return (
    <article
      aria-label={`Clan ${clan.name}`}
      className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      style={{ borderTopWidth: 6, borderTopColor: clan.color }}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${clan.color}26` }}
          aria-hidden="true"
        >
          {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-white leading-tight">
            <span className="truncate">{clan.name}</span>
            {isLeader && <Crown size={16} className="text-amber-500 flex-shrink-0" aria-label="Clan líder" />}
          </h3>
          {clan.motto && <p className="text-sm text-gray-600 dark:text-gray-300 italic truncate">"{clan.motto}"</p>}
        </div>
        <div className="flex">
          <button type="button" onClick={onEdit} aria-label={`Editar ${clan.name}`} title="Editar" className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Edit2 size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Eliminar ${clan.name}`} title="Eliminar" className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-300">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 px-4 pb-3">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-2 py-1.5 text-center">
          <dt className="text-xs text-gray-600 dark:text-gray-400">XP</dt>
          <dd className="font-bold text-gray-900 dark:text-white tabular-nums">{clan.totalXp.toLocaleString()}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-2 py-1.5 text-center">
          <dt className="text-xs text-gray-600 dark:text-gray-400">Miembros</dt>
          <dd className={`font-bold tabular-nums ${full ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{clan.memberCount}/{clan.maxMembers}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-2 py-1.5 text-center">
          <dt className="text-xs text-gray-600 dark:text-gray-400">Nivel medio</dt>
          <dd className="font-bold text-gray-900 dark:text-white tabular-nums">{avgLevel}</dd>
        </div>
      </dl>

      <div className="flex-1 px-4 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Miembros</span>
          <button
            type="button"
            onClick={onAssign}
            disabled={full}
            className="inline-flex items-center gap-1 min-h-[32px] px-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50"
          >
            <UserPlus size={15} aria-hidden="true" />
            Agregar
          </button>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">Sin miembros aún</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {members.map((member, index) => {
              const isSelected = member.id === selectedStudentId;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectMember(member)}
                  aria-pressed={isSelected}
                  title={`${memberName(member)} · ${member.xp} XP · Nv ${member.level}`}
                  className={`inline-flex items-center gap-1.5 min-h-[34px] px-2.5 rounded-full border text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-100 text-primary-900 dark:bg-primary-900/50 dark:text-primary-100'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-primary-400'
                  }`}
                >
                  <span aria-hidden="true">{classIconOf(member.id, member.characterClass)}</span>
                  <span className="max-w-[9rem] truncate">{memberName(member)}</span>
                  {index === 0 && members.length > 1 && <Crown size={12} className="text-amber-500" aria-label="Más XP del clan" />}
                </button>
              );
            })}
          </div>
        )}
        {selected && (
          <MoveBar
            name={memberName(selected)}
            targets={moveTargets}
            isBusy={isBusy}
            onMove={onMove}
            onRemove={onRemove}
            onCancel={onCancelSelection}
          />
        )}
      </div>
    </article>
  );
};

// Modal para crear/editar clan
interface ClanFormModalProps {
  clan: ClanWithMembers | null;
  onClose: () => void;
  onSubmit: (data: CreateClanData) => void;
  isLoading: boolean;
}

const ClanFormModal = ({ clan, onClose, onSubmit, isLoading }: ClanFormModalProps) => {
  const [name, setName] = useState(clan?.name || '');
  const [color, setColor] = useState(clan?.color || CLAN_COLORS[0]);
  const [emblem, setEmblem] = useState(clan?.emblem || 'shield');
  const [motto, setMotto] = useState(clan?.motto || '');
  const [maxMembers, setMaxMembers] = useState(clan?.maxMembers || 10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, color, emblem, motto: motto || undefined, maxMembers });
  };

  const inputClass = 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clan-form-title"
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel izquierdo - Jiro */}
        <div className="hidden md:block md:w-80 flex-shrink-0 relative overflow-hidden">
          <img src="/assets/jiro/clanes/nuevo-clan.webp" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white text-sm font-semibold mb-2">💡 Consejos para crear clanes</p>
            <ul className="text-white/90 text-xs space-y-1">
              <li>• Nombres creativos que motiven el trabajo en equipo.</li>
              <li>• Equilibrio: mezcla estudiantes de distintos niveles.</li>
              <li>• Un buen lema refuerza la identidad del equipo.</li>
            </ul>
          </div>
        </div>

        {/* Panel derecho - Contenido */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 id="clan-form-title" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="text-primary-600 dark:text-primary-400" size={22} aria-hidden="true" />
              {clan ? 'Editar clan' : 'Nuevo clan'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label htmlFor="clan-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre del clan</label>
              <input id="clan-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ej: Los Dragones" required />
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color del clan</span>
              <div className="flex gap-3 flex-wrap">
                {CLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                    className={`w-10 h-10 rounded-full transition-all hover:scale-110 ${
                      color === c ? 'ring-4 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Emblema</span>
              <div className="grid grid-cols-8 gap-2">
                {Object.entries(CLAN_EMBLEMS).map(([key, emoji]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEmblem(key)}
                    aria-label={`Emblema ${key}`}
                    aria-pressed={emblem === key}
                    className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all hover:scale-105 ${
                      emblem === key
                        ? 'bg-primary-100 dark:bg-primary-900/60 ring-2 ring-primary-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="clan-motto" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lema (opcional)</label>
                <input id="clan-motto" type="text" value={motto} onChange={(e) => setMotto(e.target.value)} className={inputClass} placeholder="Ej: Unidos somos más fuertes" />
              </div>
              <div>
                <label htmlFor="clan-max" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Máximo de miembros</label>
                <input id="clan-max" type="number" value={maxMembers} onChange={(e) => setMaxMembers(parseInt(e.target.value) || 10)} min={2} max={50} className={inputClass} />
              </div>
            </div>

            {/* Vista previa con el mismo estilo que la tarjeta */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4" style={{ borderTopWidth: 6, borderTopColor: color }}>
              <div className="flex items-center gap-3">
                <span className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${color}26` }} aria-hidden="true">
                  {CLAN_EMBLEMS[emblem]}
                </span>
                <div>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">{name || 'Nombre del clan'}</p>
                  {motto && <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{motto}"</p>}
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Máx. {maxMembers} miembros</p>
                </div>
              </div>
            </div>
          </form>

          <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !name}
                className="flex-1 min-h-[44px] px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Check size={18} aria-hidden="true" />
                    {clan ? 'Guardar cambios' : 'Crear clan'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Modal para asignar varios estudiantes sin clan a un clan
interface AssignStudentModalProps {
  clanName: string;
  students: ClassroomStudent[];
  studentName: (student: ClassroomStudent) => string;
  classIconOf: (studentId: string, characterClass?: string) => string;
  onClose: () => void;
  onAssign: (studentId: string) => Promise<void>;
}

const AssignStudentModal = ({ clanName, students, studentName, classIconOf, onClose, onAssign }: AssignStudentModalProps) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const filteredStudents = students.filter((s) => studentName(s).toLowerCase().includes(search.toLowerCase()));

  const toggleStudent = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(selected.size === filteredStudents.length ? new Set() : new Set(filteredStudents.map((s) => s.id)));
  };

  const handleAssignSelected = async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    try {
      for (const studentId of selected) {
        await onAssign(studentId);
      }
      toast.success(`${selected.size} estudiante${selected.size > 1 ? 's' : ''} asignado${selected.size > 1 ? 's' : ''} a ${clanName}`);
      onClose();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 id="assign-title" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserPlus size={20} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
              Agregar a {clanName}
            </h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar estudiante"
              aria-label="Buscar estudiante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="p-3">
          {students.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-300 py-8">Todos los estudiantes ya tienen clan</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={selectAll} className="min-h-[36px] px-2 rounded-lg text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30">
                  {selected.size === filteredStudents.length ? 'Quitar selección' : `Seleccionar todos (${filteredStudents.length})`}
                </button>
                {selected.size > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-300">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredStudents.map((student) => {
                  const isSelected = selected.has(student.id);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student.id)}
                      aria-pressed={isSelected}
                      className={`relative flex items-center gap-2 min-h-[44px] p-2.5 rounded-xl border-2 text-left transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 hover:border-primary-300'
                      }`}
                    >
                      <span className="text-lg" aria-hidden="true">{classIconOf(student.id, student.characterClass)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-medium truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-800 dark:text-gray-100'}`}>
                          {studentName(student)}
                        </span>
                        <span className="block text-xs text-gray-600 dark:text-gray-400">Nv {student.level ?? 1}</span>
                      </span>
                      {isSelected && <Check size={16} className="text-primary-600 dark:text-primary-300 flex-shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              {filteredStudents.length === 0 && search && (
                <p className="text-center text-gray-600 dark:text-gray-300 py-4 text-sm">No se encontraron estudiantes</p>
              )}
            </>
          )}
        </div>

        {students.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <button
              type="button"
              onClick={handleAssignSelected}
              disabled={selected.size === 0 || assigning}
              className="w-full min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {assigning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Asignando...
                </>
              ) : selected.size > 0 ? (
                <>
                  <UserPlus size={16} aria-hidden="true" />
                  Asignar {selected.size} estudiante{selected.size > 1 ? 's' : ''}
                </>
              ) : (
                'Selecciona estudiantes'
              )}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
