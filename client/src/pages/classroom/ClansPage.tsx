import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Shuffle,
  Trophy,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  X,
  Check,
  Shield,
  Search,
} from 'lucide-react';
import { clanApi, CLAN_EMBLEMS, type ClanWithMembers, type CreateClanData } from '../../lib/clanApi';
import toast from 'react-hot-toast';

const CLAN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

export const ClansPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClan, setEditingClan] = useState<ClanWithMembers | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);

  // Obtener clanes
  const { data: clans, isLoading } = useQuery({
    queryKey: ['clans', classroom?.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom?.id,
  });

  // Obtener estudiantes sin clan (incluyendo demo)
  const studentsWithoutClan = classroom?.students?.filter(
    (s: any) => !s.teamId && s.isActive !== false
  ) || [];

  // Crear clan
  const createMutation = useMutation({
    mutationFn: (data: CreateClanData) => clanApi.createClan(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      setShowCreateModal(false);
      toast.success('Clan creado exitosamente');
    },
    onError: () => toast.error('Error al crear clan'),
  });

  // Actualizar clan
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => clanApi.updateClan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      setEditingClan(null);
      toast.success('Clan actualizado');
    },
    onError: () => toast.error('Error al actualizar clan'),
  });

  // Eliminar clan
  const deleteMutation = useMutation({
    mutationFn: (id: string) => clanApi.deleteClan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Clan eliminado');
    },
    onError: () => toast.error('Error al eliminar clan'),
  });

  // Asignar estudiante
  const assignMutation = useMutation({
    mutationFn: ({ clanId, studentId }: { clanId: string; studentId: string }) =>
      clanApi.assignStudent(clanId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Estudiante asignado');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Error al asignar'),
  });

  // Quitar estudiante
  const removeMutation = useMutation({
    mutationFn: (studentId: string) => clanApi.removeStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success('Estudiante removido del clan');
    },
    onError: () => toast.error('Error al remover estudiante'),
  });

  // Asignar aleatoriamente
  const randomAssignMutation = useMutation({
    mutationFn: () => clanApi.assignRandomly(classroom.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clans', classroom.id] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      toast.success(`${data.assigned} estudiantes asignados a ${data.clans} clanes`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Error al asignar'),
  });

  if (!classroom?.clansEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Shield className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
          Sistema de Clanes Desactivado
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          Activa el sistema de clanes en la configuración de la clase para gestionar equipos y competencias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
            <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              Gestión de Clanes
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {clans?.length || 0} clanes • {studentsWithoutClan.length} sin asignar
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {studentsWithoutClan.length > 0 && clans && clans.length > 0 && (
            <button
              onClick={() => randomAssignMutation.mutate()}
              disabled={randomAssignMutation.isPending}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-xs sm:text-sm font-medium"
            >
              <Shuffle size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Asignar Aleatorio</span>
              <span className="sm:hidden">Aleatorio</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-xs sm:text-sm font-medium"
          >
            <Plus size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Nuevo Clan</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Ranking rápido */}
      {clans && clans.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-amber-800 dark:text-amber-200">Ranking de Clanes</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...clans].sort((a, b) => b.totalXp - a.totalXp).map((clan, index) => (
              <div
                key={clan.id}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm min-w-fit"
              >
                <span className={`text-lg font-bold ${
                  index === 0 ? 'text-amber-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : 'text-gray-500'
                }`}>
                  #{index + 1}
                </span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: clan.color }}
                >
                  {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
                </div>
                <span className="font-medium text-gray-800 dark:text-white text-sm">{clan.name}</span>
                <span className="text-xs text-gray-500">{clan.totalXp} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de clanes */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse h-48" />
          ))}
        </div>
      ) : clans && clans.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clans.map((clan) => (
            <motion.div
              key={clan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
            >
              {/* Header del clan */}
              <div
                className="p-4 text-white"
                style={{ backgroundColor: clan.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span>
                    <div>
                      <h3 className="font-bold">{clan.name}</h3>
                      {clan.motto && (
                        <p className="text-xs opacity-80 italic">"{clan.motto}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingClan(clan)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar este clan?')) {
                          deleteMutation.mutate(clan.id);
                        }
                      }}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">
                  <strong>{clan.totalXp}</strong> XP
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong>{clan.wins}</strong> victorias
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  <strong>{clan.memberCount}</strong>/{clan.maxMembers} miembros
                </span>
              </div>

              {/* Miembros */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Miembros</span>
                  <button
                    onClick={() => setShowAssignModal(clan.id)}
                    className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
                  >
                    <UserPlus size={12} />
                    Agregar
                  </button>
                </div>
                
                {clan.members.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin miembros</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {clan.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-1"
                      >
                        <span className="text-gray-700 dark:text-gray-200">
                          {member.characterName || `${member.firstName} ${member.lastName}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Nv.{member.level}</span>
                          <button
                            onClick={() => removeMutation.mutate(member.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <UserMinus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hay clanes creados</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm"
          >
            Crear primer clan
          </button>
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
            clanId={showAssignModal}
            students={studentsWithoutClan}
            onClose={() => setShowAssignModal(null)}
            onAssign={async (studentId) => {
              await assignMutation.mutateAsync({ clanId: showAssignModal, studentId });
            }}
          />
        )}
      </AnimatePresence>

      </div>
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel izquierdo - Jiro */}
        <div className="hidden md:block md:w-64 flex-shrink-0 relative overflow-hidden">
          <motion.img
            src="/assets/mascot/jiro-clanes.jpg"
            alt="Jiro"
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white text-xs font-semibold mb-2">💡 Consejos para crear clanes</p>
            <ul className="text-white/80 text-[10px] space-y-1">
              <li>• Nombres creativos: elige nombres que motiven el trabajo en equipo.</li>
              <li>• Equilibrio: distribuye estudiantes de distintos niveles.</li>
              <li>• Lemas: un buen lema refuerza la identidad del equipo.</li>
            </ul>
          </div>
        </div>

        {/* Panel derecho - Contenido */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="text-violet-500" size={24} />
              {clan ? 'Editar Clan' : 'Nuevo Clan'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Clan
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                placeholder="Ej: Los Dragones"
                required
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color del Clan
              </label>
              <div className="flex gap-3 flex-wrap">
                {CLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full transition-all shadow-md hover:scale-110 ${
                      color === c ? 'ring-4 ring-offset-2 ring-violet-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Emblema */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Emblema
              </label>
              <div className="grid grid-cols-8 gap-2">
                {Object.entries(CLAN_EMBLEMS).map(([key, emoji]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEmblem(key)}
                    className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all hover:scale-105 ${
                      emblem === key
                        ? 'bg-violet-100 dark:bg-violet-900 ring-2 ring-violet-500 shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Lema y Max miembros en fila */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lema (opcional)
                </label>
                <input
                  type="text"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                  placeholder="Ej: Unidos somos más fuertes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Máximo de miembros
                </label>
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(parseInt(e.target.value) || 10)}
                  min={2}
                  max={50}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                />
              </div>
            </div>

            {/* Preview mejorado */}
            <div className="p-4 rounded-xl shadow-lg" style={{ backgroundColor: color }}>
              <div className="flex items-center gap-3 text-white">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-3xl">{CLAN_EMBLEMS[emblem]}</span>
                </div>
                <div>
                  <p className="font-bold text-lg">{name || 'Nombre del clan'}</p>
                  {motto && <p className="text-sm opacity-80 italic">"{motto}"</p>}
                  <p className="text-xs opacity-70 mt-1">Máx. {maxMembers} miembros</p>
                </div>
              </div>
            </div>
          </form>

          {/* Footer con botones */}
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !name}
                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} />
                    {clan ? 'Guardar Cambios' : '🛡️ Crear Clan'}
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

// Modal para asignar estudiantes (mejorado con selección múltiple)
interface AssignStudentModalProps {
  clanId: string;
  students: any[];
  onClose: () => void;
  onAssign: (studentId: string) => Promise<void>;
}

const AssignStudentModal = ({ students, onClose, onAssign }: AssignStudentModalProps) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const filteredStudents = students.filter(s => 
    (s.characterName || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.user?.firstName || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const selectAll = () => {
    if (selected.size === filteredStudents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleAssignSelected = async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    for (const studentId of selected) {
      await onAssign(studentId);
    }
    setAssigning(false);
    onClose();
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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-gradient-to-r from-violet-500 to-purple-500">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus size={20} />
              Asignar Estudiantes
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg text-white">
              <X size={20} />
            </button>
          </div>
          {/* Buscador */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/90 text-gray-800 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        <div className="p-3">
          {students.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Todos los estudiantes ya están asignados
            </p>
          ) : (
            <>
              {/* Acciones rápidas */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={selectAll}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  {selected.size === filteredStudents.length ? 'Deseleccionar todo' : `Seleccionar todo (${filteredStudents.length})`}
                </button>
                {selected.size > 0 && (
                  <span className="text-sm text-gray-500">
                    {selected.size} seleccionado{selected.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Grid de estudiantes */}
              <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredStudents.map((student) => {
                  const isSelected = selected.has(student.id);
                  return (
                    <motion.button
                      key={student.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleStudent(student.id)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                        isSelected
                          ? 'bg-violet-50 border-violet-500 shadow-sm'
                          : 'bg-gray-50 border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-white font-bold text-sm mb-1 ${
                        isSelected ? 'bg-gradient-to-br from-violet-500 to-purple-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        {(student.characterName || student.user?.firstName || '?')[0].toUpperCase()}
                      </div>
                      <p className={`text-xs font-medium truncate ${isSelected ? 'text-violet-700' : 'text-gray-700'}`}>
                        {student.characterName || student.user?.firstName || 'Sin nombre'}
                      </p>
                      <p className="text-[10px] text-gray-400">Nv.{student.level}</p>
                    </motion.button>
                  );
                })}
              </div>

              {filteredStudents.length === 0 && search && (
                <p className="text-center text-gray-500 py-4 text-sm">
                  No se encontraron estudiantes
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer con botón de asignar */}
        {students.length > 0 && (
          <div className="p-3 border-t bg-gray-50 rounded-b-2xl">
            <button
              onClick={handleAssignSelected}
              disabled={selected.size === 0 || assigning}
              className={`w-full py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                selected.size > 0
                  ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-lg shadow-violet-500/30'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {assigning ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Asignando...
                </>
              ) : selected.size > 0 ? (
                <>
                  <UserPlus size={16} />
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
