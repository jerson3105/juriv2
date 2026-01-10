import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Swords,
  Trash2,
  Edit2,
  Play,
  Copy,
  Heart,
  Coins,
  Sparkles,
  X,
  Image,
  Clock,
  Zap,
  HelpCircle,
  BookOpen,
  ChevronRight,
  Check,
  Trophy,
  BarChart3,
  Crown,
  Target,
  Users,
  Award,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { battleApi, type Boss, type BattleQuestion } from '../../lib/battleApi';
import { 
  questionBankApi, 
  type QuestionBank, 
  type Question,
  getBankEmoji,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
} from '../../lib/questionBankApi';
import toast from 'react-hot-toast';
import { BossBattleLive } from './BossBattleLive';
import { BossBattleBvJ } from './BossBattleBvJ';
import { ConfirmModal } from '../ui/ConfirmModal';
import { classroomApi } from '../../lib/classroomApi';

interface Props {
  classroom: any;
  onBack: () => void;
}

export const BossBattleActivity = ({ classroom, onBack }: Props) => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBoss, setEditingBoss] = useState<Boss | null>(null);
  const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [activeBattle, setActiveBattle] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; boss: Boss | null }>({ isOpen: false, boss: null });

  const { data: bosses = [], isLoading } = useQuery({
    queryKey: ['bosses', classroom.id],
    queryFn: () => battleApi.getBossesByClassroom(classroom.id),
  });

  // Obtener competencias si la clase las usa
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classroom?.useCompetencies,
  });
  
  const classroomCompetencies = curriculumAreas.find((a: any) => a.id === classroom?.curriculumAreaId)?.competencies || [];

  const createMutation = useMutation({
    mutationFn: battleApi.createBoss,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
      setShowCreateModal(false);
      toast.success('Boss creado');
    },
    onError: () => toast.error('Error al crear boss'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => battleApi.updateBoss(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
      setShowCreateModal(false);
      setEditingBoss(null);
      toast.success('Boss actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: battleApi.deleteBoss,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
      toast.success('Boss eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const duplicateMutation = useMutation({
    mutationFn: battleApi.duplicateBoss,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
      toast.success('Boss duplicado');
    },
    onError: () => toast.error('Error al duplicar'),
  });

  // Si hay una batalla activa, mostrar la vista de batalla según el modo
  if (activeBattle) {
    const activeBoss = bosses.find(b => b.id === activeBattle);
    
    // Si es modo BvJ, usar el componente BossBattleBvJ
    if (activeBoss?.battleMode === 'BVJ') {
      return (
        <BossBattleBvJ
          bossId={activeBattle}
          students={classroom.students || []}
          onBack={() => {
            setActiveBattle(null);
            queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
          }}
        />
      );
    }
    
    // Modo clásico
    return (
      <BossBattleLive
        bossId={activeBattle}
        classroom={classroom}
        onBack={() => {
          setActiveBattle(null);
          queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
        }}
      />
    );
  }

  const handleEdit = (boss: Boss) => {
    setEditingBoss(boss);
    setShowCreateModal(true);
  };

  const handleDelete = (boss: Boss) => {
    setDeleteConfirm({ isOpen: true, boss });
  };

  const handleManageQuestions = (boss: Boss) => {
    setSelectedBoss(boss);
    setShowQuestionsModal(true);
  };

  const handleStartBattle = async (boss: Boss) => {
    // Para BvJ, iniciar directamente con todos los estudiantes elegibles
    if (boss.battleMode === 'BVJ') {
      const eligibleStudents = (classroom.students || [])
        .filter((s: any) => (s.currentHp || s.hp || 100) > 0)
        .map((s: any) => s.id);
      
      if (eligibleStudents.length === 0) {
        toast.error('No hay estudiantes con HP disponible');
        return;
      }
      
      try {
        await battleApi.startBattle(boss.id, eligibleStudents);
        queryClient.invalidateQueries({ queryKey: ['bosses', classroom.id] });
        setActiveBattle(boss.id);
        toast.success('¡Batalla BvJ iniciada!');
      } catch {
        toast.error('Error al iniciar batalla');
      }
      return;
    }
    
    // Para modo clásico, mostrar modal de selección
    setSelectedBoss(boss);
    setShowStartModal(true);
  };

  const handleViewResults = (boss: Boss) => {
    setSelectedBoss(boss);
    setShowResultsModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Borrador</span>;
      case 'ACTIVE':
        return <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full animate-pulse">En batalla</span>;
      case 'VICTORY':
        return <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Derrotado</span>;
      case 'DEFEAT':
        return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Escapó</span>;
      default:
        return <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Completado</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/30">
            <Swords size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Boss Battles</h1>
            <p className="text-gray-500 text-sm">Crea batallas épicas contra jefes</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingBoss(null);
            setShowCreateModal(true);
          }}
          leftIcon={<Plus size={16} />}
          className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
        >
          Nuevo Boss
        </Button>
      </div>

      {/* Lista de bosses */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : bosses.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl flex items-center justify-center">
            <Swords className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No hay bosses creados
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Crea tu primer boss para que tus estudiantes luchen en equipo respondiendo preguntas
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus size={16} />}
            className="bg-gradient-to-r from-red-500 to-orange-500"
          >
            Crear primer Boss
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Batallas Activas */}
          {bosses.filter(b => b.status === 'ACTIVE').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-bold text-gray-800">En Batalla</h2>
                <span className="text-sm text-gray-500">({bosses.filter(b => b.status === 'ACTIVE').length})</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {bosses.filter(b => b.status === 'ACTIVE').map((boss, index) => (
                  <BossCard key={boss.id} boss={boss} index={index} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={(b) => duplicateMutation.mutate(b.id)} onManageQuestions={handleManageQuestions} onStartBattle={handleStartBattle} onContinueBattle={(b) => setActiveBattle(b.id)} onViewResults={handleViewResults} getStatusBadge={getStatusBadge} />
                ))}
              </div>
            </div>
          )}

          {/* Borradores (Sin usar) */}
          {bosses.filter(b => b.status === 'DRAFT').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full" />
                <h2 className="text-lg font-bold text-gray-800">Sin Usar</h2>
                <span className="text-sm text-gray-500">({bosses.filter(b => b.status === 'DRAFT').length})</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {bosses.filter(b => b.status === 'DRAFT').map((boss, index) => (
                  <BossCard key={boss.id} boss={boss} index={index} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={(b) => duplicateMutation.mutate(b.id)} onManageQuestions={handleManageQuestions} onStartBattle={handleStartBattle} onContinueBattle={(b) => setActiveBattle(b.id)} onViewResults={handleViewResults} getStatusBadge={getStatusBadge} />
                ))}
              </div>
            </div>
          )}

          {/* Victorias */}
          {bosses.filter(b => b.status === 'VICTORY').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={18} className="text-amber-500" />
                <h2 className="text-lg font-bold text-gray-800">Victorias</h2>
                <span className="text-sm text-gray-500">({bosses.filter(b => b.status === 'VICTORY').length})</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {bosses.filter(b => b.status === 'VICTORY').map((boss, index) => (
                  <BossCard key={boss.id} boss={boss} index={index} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={(b) => duplicateMutation.mutate(b.id)} onManageQuestions={handleManageQuestions} onStartBattle={handleStartBattle} onContinueBattle={(b) => setActiveBattle(b.id)} onViewResults={handleViewResults} getStatusBadge={getStatusBadge} />
                ))}
              </div>
            </div>
          )}

          {/* Derrotas */}
          {bosses.filter(b => b.status === 'DEFEAT' || b.status === 'COMPLETED').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <X size={18} className="text-red-500" />
                <h2 className="text-lg font-bold text-gray-800">Derrotas / Escaparon</h2>
                <span className="text-sm text-gray-500">({bosses.filter(b => b.status === 'DEFEAT' || b.status === 'COMPLETED').length})</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {bosses.filter(b => b.status === 'DEFEAT' || b.status === 'COMPLETED').map((boss, index) => (
                  <BossCard key={boss.id} boss={boss} index={index} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={(b) => duplicateMutation.mutate(b.id)} onManageQuestions={handleManageQuestions} onStartBattle={handleStartBattle} onContinueBattle={(b) => setActiveBattle(b.id)} onViewResults={handleViewResults} getStatusBadge={getStatusBadge} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar boss */}
      <CreateBossModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingBoss(null);
        }}
        boss={editingBoss}
        classroomId={classroom.id}
        competencies={classroomCompetencies}
        useCompetencies={classroom?.useCompetencies || false}
        onSave={(data) => {
          if (editingBoss) {
            updateMutation.mutate({ id: editingBoss.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Modal gestionar preguntas */}
      {selectedBoss && (
        <QuestionsModal
          isOpen={showQuestionsModal}
          onClose={() => {
            setShowQuestionsModal(false);
            setSelectedBoss(null);
          }}
          boss={selectedBoss}
          classroomId={classroom.id}
        />
      )}

      {/* Modal iniciar batalla */}
      {selectedBoss && (
        <StartBattleModal
          isOpen={showStartModal}
          onClose={() => {
            setShowStartModal(false);
            setSelectedBoss(null);
          }}
          boss={selectedBoss}
          students={classroom.students || []}
          clansEnabled={classroom.clansEnabled}
          onStart={() => {
            setShowStartModal(false);
            setActiveBattle(selectedBoss.id);
          }}
        />
      )}

      {/* Modal de resultados */}
      {showResultsModal && selectedBoss && (
        <BattleResultsModal
          isOpen={showResultsModal}
          onClose={() => {
            setShowResultsModal(false);
            setSelectedBoss(null);
          }}
          boss={selectedBoss}
        />
      )}

      {/* Modal de confirmación para eliminar boss */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, boss: null })}
        onConfirm={() => {
          if (deleteConfirm.boss) {
            deleteMutation.mutate(deleteConfirm.boss.id);
          }
          setDeleteConfirm({ isOpen: false, boss: null });
        }}
        title="¿Eliminar boss?"
        message={`¿Estás seguro de eliminar "${deleteConfirm.boss?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// Modal de resultados de batalla
const BattleResultsModal = ({
  isOpen,
  onClose,
  boss,
}: {
  isOpen: boolean;
  onClose: () => void;
  boss: Boss;
}) => {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['battle-results', boss.id],
    queryFn: () => battleApi.getBattleResults(boss.id),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const totalDamage = results.reduce((sum, r) => sum + r.damageDealt, 0);
  const totalXP = results.reduce((sum, r) => sum + r.xpEarned, 0);
  const totalGP = results.reduce((sum, r) => sum + r.gpEarned, 0);

  return (
    <AnimatePresence>
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
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Trophy size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Resultados de Batalla</h2>
                  <p className="text-white/80 text-sm">{boss.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Estadísticas generales */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Target size={20} className="mx-auto mb-1" />
                <p className="text-2xl font-bold">{totalDamage}</p>
                <p className="text-xs text-white/70">Daño total</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Sparkles size={20} className="mx-auto mb-1" />
                <p className="text-2xl font-bold">{totalXP}</p>
                <p className="text-xs text-white/70">XP otorgado</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <Coins size={20} className="mx-auto mb-1" />
                <p className="text-2xl font-bold">{totalGP}</p>
                <p className="text-xs text-white/70">GP otorgado</p>
              </div>
            </div>
          </div>

          {/* Lista de participantes */}
          <div className="p-4 overflow-y-auto max-h-[40vh]">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Cargando resultados...
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay resultados para esta batalla
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      index === 0 ? 'bg-amber-50 border-2 border-amber-200' :
                      index === 1 ? 'bg-gray-50 border-2 border-gray-200' :
                      index === 2 ? 'bg-orange-50 border-2 border-orange-200' :
                      'bg-gray-50'
                    }`}
                  >
                    {/* Posición */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-amber-400 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-400 text-white' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {index === 0 ? <Crown size={16} /> : index + 1}
                    </div>

                    {/* Avatar y nombre */}
                    <div className="flex items-center gap-2 flex-1">
                      {result.avatarUrl ? (
                        <img
                          src={result.avatarUrl}
                          alt={result.characterName || 'Avatar'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                          {result.characterName?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">
                        {result.characterName || 'Estudiante'}
                      </span>
                    </div>

                    {/* Estadísticas */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-red-500">
                        <Swords size={14} />
                        <span className="font-medium">{result.damageDealt}</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-500">
                        <Sparkles size={14} />
                        <span className="font-medium">+{result.xpEarned}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Coins size={14} />
                        <span className="font-medium">+{result.gpEarned}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4">
            <Button onClick={onClose} variant="secondary" className="w-full">
              Cerrar
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Componente de tarjeta de boss
const BossCard = ({
  boss,
  index,
  onEdit,
  onDelete,
  onDuplicate,
  onManageQuestions,
  onStartBattle,
  onContinueBattle,
  onViewResults,
  getStatusBadge,
}: {
  boss: Boss;
  index: number;
  onEdit: (boss: Boss) => void;
  onDelete: (boss: Boss) => void;
  onDuplicate: (boss: Boss) => void;
  onManageQuestions: (boss: Boss) => void;
  onStartBattle: (boss: Boss) => void;
  onContinueBattle: (boss: Boss) => void;
  onViewResults: (boss: Boss) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) => {
  const hpPercentage = Math.round((boss.currentHp / boss.bossHp) * 100);
  const isActive = boss.status === 'ACTIVE';
  const isDraft = boss.status === 'DRAFT';
  const isBvJ = boss.battleMode === 'BVJ';

  // Colores según modo de batalla
  const modeGradient = isBvJ 
    ? 'from-orange-500 via-amber-500 to-yellow-500' 
    : 'from-purple-500 via-indigo-500 to-blue-500';
  const modeRing = isBvJ ? 'ring-orange-500' : 'ring-purple-500';
  const modeButtonGradient = isBvJ
    ? 'from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
    : 'from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative group"
    >
      <div className={`
        bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100
        ${isActive ? `ring-2 ${modeRing} ring-offset-2` : ''}
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300
      `}>
        {/* Header con imagen */}
        <div className={`relative h-36 bg-gradient-to-br ${modeGradient} overflow-hidden`}>
          {boss.bossImageUrl ? (
            <img
              src={boss.bossImageUrl}
              alt={boss.bossName}
              className="w-full h-full object-cover mix-blend-overlay opacity-80"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl drop-shadow-lg">🐉</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Badge de modo arriba a la izquierda */}
          <div className="absolute top-3 left-3">
            <span className={`
              text-xs font-bold px-2.5 py-1 rounded-full shadow-lg
              ${isBvJ 
                ? 'bg-orange-500 text-white' 
                : 'bg-purple-500 text-white'
              }
            `}>
              {isBvJ ? '⚔️ 1 vs 1' : '👥 Clásico'}
            </span>
          </div>
          
          {/* Status badge arriba a la derecha */}
          <div className="absolute top-3 right-3">
            {getStatusBadge(boss.status)}
          </div>
          
          {/* Nombre del boss */}
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-bold text-xl drop-shadow-lg leading-tight">
              {boss.bossName}
            </h3>
            <p className="text-white/70 text-sm">{boss.name}</p>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-3">
          {/* Barra de HP */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500 flex items-center gap-1 font-medium">
                <Heart size={12} className="text-red-500" />
                HP
              </span>
              <span className="font-bold text-gray-700">
                {boss.currentHp.toLocaleString()} / {boss.bossHp.toLocaleString()}
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${hpPercentage}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`h-full rounded-full ${
                  hpPercentage > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  hpPercentage > 25 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                }`}
              />
            </div>
          </div>

          {/* Recompensas */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <Sparkles size={12} className="text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">{boss.xpReward} XP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                <Coins size={12} className="text-amber-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">{boss.gpReward} GP</span>
            </div>
            {isBvJ && boss.participantBonus > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                  <Target size={12} className="text-orange-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">+{boss.participantBonus}</span>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-1">
            {isActive ? (
              <Button
                onClick={() => onContinueBattle(boss)}
                className={`flex-1 bg-gradient-to-r ${modeButtonGradient}`}
                leftIcon={<Play size={16} />}
              >
                Continuar batalla
              </Button>
            ) : isDraft ? (
              <>
                <Button
                  onClick={() => onManageQuestions(boss)}
                  variant="secondary"
                  className="flex-1"
                  leftIcon={<HelpCircle size={16} />}
                >
                  Preguntas
                </Button>
                <Button
                  onClick={() => onStartBattle(boss)}
                  className={`flex-1 bg-gradient-to-r ${modeButtonGradient}`}
                  leftIcon={<Play size={16} />}
                >
                  Iniciar
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => onViewResults(boss)}
                  variant="secondary"
                  className="w-full"
                  leftIcon={<BarChart3 size={16} />}
                >
                  Ver resultados
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onDuplicate(boss)}
                    variant="secondary"
                    className="flex-1"
                    leftIcon={<Copy size={16} />}
                  >
                    Duplicar
                  </Button>
                  <button
                    onClick={() => onDelete(boss)}
                    className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Eliminar boss"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
            
            {isDraft && (
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(boss)}
                  className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(boss)}
                  className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Modal crear/editar boss
const CreateBossModal = ({
  isOpen,
  onClose,
  boss,
  classroomId,
  competencies,
  useCompetencies,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  boss: Boss | null;
  classroomId: string;
  competencies: any[];
  useCompetencies: boolean;
  onSave: (data: any) => void;
  isLoading: boolean;
}) => {
  const [battleMode, setBattleMode] = useState<'CLASSIC' | 'BVJ'>(boss?.battleMode || 'CLASSIC');
  const [name, setName] = useState(boss?.name || '');
  const [description, setDescription] = useState(boss?.description || '');
  const [bossName, setBossName] = useState(boss?.bossName || '');
  const [bossHp, setBossHp] = useState(boss?.bossHp || 1000);
  const [bossImageUrl, setBossImageUrl] = useState(boss?.bossImageUrl || '');
  const [xpReward, setXpReward] = useState(boss?.xpReward || 50);
  const [gpReward, setGpReward] = useState(boss?.gpReward || 20);
  const [participantBonus, setParticipantBonus] = useState(boss?.participantBonus || 10);
  const [competencyId, setCompetencyId] = useState(boss?.competencyId || '');

  // Sincronizar estados cuando cambia el boss (para edición)
  useEffect(() => {
    if (boss) {
      setBattleMode(boss.battleMode || 'CLASSIC');
      setName(boss.name || '');
      setDescription(boss.description || '');
      setBossName(boss.bossName || '');
      setBossHp(boss.bossHp || 1000);
      setBossImageUrl(boss.bossImageUrl || '');
      setXpReward(boss.xpReward || 50);
      setGpReward(boss.gpReward || 20);
      setParticipantBonus(boss.participantBonus || 10);
      setCompetencyId(boss.competencyId || '');
    } else {
      // Reset para nuevo boss
      setBattleMode('CLASSIC');
      setName('');
      setDescription('');
      setBossName('');
      setBossHp(1000);
      setBossImageUrl('');
      setXpReward(50);
      setGpReward(20);
      setParticipantBonus(10);
      setCompetencyId('');
    }
  }, [boss]);

  const bossEmojis = ['🐉', '👹', '🧟', '👻', '🦖', '🦑', '🕷️', '🦂', '🐺', '🦁', '🐻', '🦇'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      classroomId,
      battleMode,
      name,
      description: description || undefined,
      bossName,
      bossHp,
      bossImageUrl: bossImageUrl || undefined,
      xpReward,
      gpReward,
      participantBonus: battleMode === 'BVJ' ? participantBonus : undefined,
      competencyId: competencyId || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-500 to-orange-500">
            <h2 className="text-xl font-bold text-white">
              {boss ? '✏️ Editar Boss' : '🐉 Nuevo Boss'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
            {/* Modo de batalla */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Modo de batalla
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBattleMode('CLASSIC')}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    battleMode === 'CLASSIC'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⚔️</span>
                    <span className="font-semibold text-gray-800">Clásico</span>
                  </div>
                  <p className="text-xs text-gray-500">Toda la clase vs el Boss</p>
                </button>
                <button
                  type="button"
                  onClick={() => setBattleMode('BVJ')}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    battleMode === 'BVJ'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎯</span>
                    <span className="font-semibold text-gray-800">Boss vs Jugador</span>
                  </div>
                  <p className="text-xs text-gray-500">1 vs 1 por turnos aleatorios</p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Nombre de la actividad
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Repaso Tema 3"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Nombre del Boss
                </label>
                <input
                  type="text"
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                  placeholder="Ej: Dragón del Conocimiento"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción de la batalla..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={2}
              />
            </div>

            {/* HP del boss */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Puntos de Vida (HP)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[500, 1000, 2000, 5000].map((hp) => (
                  <button
                    key={hp}
                    type="button"
                    onClick={() => setBossHp(hp)}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      bossHp === hp
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    {hp}
                  </button>
                ))}
                <input
                  type="number"
                  value={bossHp}
                  onChange={(e) => setBossHp(parseInt(e.target.value) || 100)}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800"
                  min={100}
                  max={10000}
                />
              </div>
            </div>

            {/* Recompensas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  <Sparkles size={14} className="inline mr-1 text-blue-500" />
                  XP Recompensa {battleMode === 'BVJ' && <span className="text-xs text-gray-400">(toda la clase)</span>}
                </label>
                <input
                  type="number"
                  value={xpReward}
                  onChange={(e) => setXpReward(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  <Coins size={14} className="inline mr-1 text-amber-500" />
                  GP Recompensa {battleMode === 'BVJ' && <span className="text-xs text-gray-400">(toda la clase)</span>}
                </label>
                <input
                  type="number"
                  value={gpReward}
                  onChange={(e) => setGpReward(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800"
                />
              </div>
            </div>

            {/* Bonus para participantes (solo BvJ) */}
            {battleMode === 'BVJ' && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <label className="block text-sm font-medium mb-2 text-orange-800">
                  <Target size={14} className="inline mr-1" />
                  Bonus extra para participantes
                </label>
                <p className="text-xs text-orange-600 mb-2">
                  XP/GP adicional que ganan los estudiantes que participaron directamente
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-orange-700">+</span>
                  <input
                    type="number"
                    value={participantBonus}
                    onChange={(e) => setParticipantBonus(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-24 px-3 py-2 rounded-lg border border-orange-300 bg-white text-gray-800"
                  />
                  <span className="text-sm text-orange-700">XP/GP</span>
                </div>
              </div>
            )}

            {/* Selector de Competencia (opcional) */}
            {useCompetencies && competencies.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 flex items-center gap-2">
                  <Award size={14} className="text-emerald-500" />
                  Competencia a evaluar (opcional)
                </label>
                <select
                  value={competencyId}
                  onChange={(e) => setCompetencyId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Sin competencia (solo gamificación)</option>
                  {competencies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Si seleccionas una competencia, el desempeño contribuirá a la calificación.
                </p>
              </div>
            )}

            {/* Imagen del boss */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Imagen del Boss (URL o emoji)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {bossEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setBossImageUrl('')}
                    className="w-10 h-10 text-2xl rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-300"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={bossImageUrl}
                onChange={(e) => setBossImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/dragon.png"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              isLoading={isLoading}
              disabled={!name.trim() || !bossName.trim()}
            >
              {boss ? 'Guardar cambios' : 'Crear Boss'}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Componente de advertencia de daño vs HP (solo para BvJ)
const DamageVsHpWarning = ({
  questions,
  boss,
  onAdjustHp,
}: {
  questions: BattleQuestion[];
  boss: Boss;
  onAdjustHp: (newHp: number) => Promise<void>;
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const totalDamage = questions.reduce((sum, q) => sum + (q.damage || 0), 0);
  const bossHp = boss.bossHp;
  const isInsufficient = totalDamage < bossHp;
  const suggestedHp = Math.floor(totalDamage * 0.8);

  const handleAdjust = async () => {
    setIsAdjusting(true);
    try {
      await onAdjustHp(suggestedHp);
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className={`mb-4 p-4 rounded-xl border ${
      isInsufficient 
        ? 'bg-amber-50 border-amber-300' 
        : 'bg-green-50 border-green-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">Daño total</p>
            <p className="text-2xl font-bold text-purple-600">{totalDamage}</p>
          </div>
          <div className="text-gray-400">vs</div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">HP Boss</p>
            <p className="text-2xl font-bold text-red-600">{bossHp}</p>
          </div>
        </div>
        
        {isInsufficient ? (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                <AlertTriangle size={16} />
                Victoria imposible
              </p>
              <p className="text-xs text-amber-600">El daño no alcanza para derrotar al boss</p>
            </div>
            <Button
              onClick={handleAdjust}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              isLoading={isAdjusting}
              disabled={isAdjusting}
            >
              Ajustar a {suggestedHp} HP
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <Check size={20} />
            <span className="text-sm font-medium">Victoria posible</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Modal de preguntas
const QuestionsModal = ({
  isOpen,
  onClose,
  boss,
  classroomId,
}: {
  isOpen: boolean;
  onClose: () => void;
  boss: Boss;
  classroomId: string;
}) => {
  const queryClient = useQueryClient();
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BattleQuestion | null>(null);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [deleteQuestionConfirm, setDeleteQuestionConfirm] = useState<{ isOpen: boolean; question: BattleQuestion | null }>({ isOpen: false, question: null });

  const { data: questions = [], isLoading, error } = useQuery({
    queryKey: ['battle-questions', boss.id],
    queryFn: () => battleApi.getQuestions(boss.id),
    enabled: isOpen,
  });

  // Log error for debugging
  if (error) {
    console.error('Error loading questions:', error);
  }

  const addMutation = useMutation({
    mutationFn: (data: any) => battleApi.addQuestion(boss.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle-questions', boss.id] });
      setShowAddQuestion(false);
      toast.success('Pregunta agregada');
    },
    onError: () => toast.error('Error al agregar pregunta'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => battleApi.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle-questions', boss.id] });
      setEditingQuestion(null);
      toast.success('Pregunta actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: battleApi.deleteQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle-questions', boss.id] });
      toast.success('Pregunta eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  // Helper para parsear JSON que puede estar doblemente serializado
  const safeJsonParse = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    
    try {
      let parsed = JSON.parse(value);
      // Si sigue siendo string, intentar parsear de nuevo (doble serialización)
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed;
    } catch {
      return value;
    }
  };

  // Importar preguntas desde el banco
  const handleImportFromBank = async (bankQuestions: Question[]) => {
    toast.loading(`Importando ${bankQuestions.length} preguntas...`, { id: 'importing' });
    
    const importPromises = bankQuestions.map(async (q) => {
      try {
        // Convertir pregunta del banco al formato de batalla
        let options: string[] = [];
        let correctIndex = 0;

        let battleQuestionType: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING' = 'SINGLE_CHOICE';
        let correctIndices: number[] | undefined;
        let pairs: { left: string; right: string }[] | undefined;

        if (q.type === 'TRUE_FALSE') {
          battleQuestionType = 'TRUE_FALSE';
          options = ['Verdadero', 'Falso'];
          const answer = safeJsonParse(q.correctAnswer);
          correctIndex = answer === true || answer === 'true' ? 0 : 1;
        } else if (q.type === 'SINGLE_CHOICE') {
          battleQuestionType = 'SINGLE_CHOICE';
          const opts = safeJsonParse(q.options);
          if (Array.isArray(opts) && opts.length >= 2) {
            options = opts.map((o: any) => o.text || String(o));
            correctIndex = opts.findIndex((o: any) => o.isCorrect === true);
            if (correctIndex === -1) correctIndex = 0;
          }
        } else if (q.type === 'MULTIPLE_CHOICE') {
          battleQuestionType = 'MULTIPLE_CHOICE';
          const opts = safeJsonParse(q.options);
          if (Array.isArray(opts) && opts.length >= 2) {
            options = opts.map((o: any) => o.text || String(o));
            correctIndices = opts.map((o: any, i: number) => o.isCorrect ? i : -1).filter((i: number) => i >= 0);
            correctIndex = correctIndices[0] || 0;
          }
        } else if (q.type === 'MATCHING') {
          battleQuestionType = 'MATCHING';
          const parsedPairs = safeJsonParse(q.pairs);
          if (Array.isArray(parsedPairs) && parsedPairs.length >= 2) {
            pairs = parsedPairs;
            options = parsedPairs.map((p: any) => `${p.left} → ${p.right}`);
            correctIndex = 0;
          }
        }

        if (options.length >= 2 || (battleQuestionType === 'MATCHING' && pairs && pairs.length >= 2)) {
          await battleApi.addQuestion(boss.id, {
            questionType: q.imageUrl ? 'IMAGE' : 'TEXT',
            battleQuestionType,
            question: q.questionText,
            imageUrl: q.imageUrl || undefined,
            options: options.length > 0 ? options : undefined,
            correctIndex,
            correctIndices,
            pairs,
            damage: q.points || 10,
            timeLimit: q.timeLimitSeconds || 30,
          });
          return true;
        }
        return false;
      } catch (e) {
        console.error('Error importing question:', q.questionText, e);
        return false;
      }
    });

    const results = await Promise.all(importPromises);
    const imported = results.filter(Boolean).length;
    
    toast.dismiss('importing');
    
    if (imported > 0) {
      queryClient.invalidateQueries({ queryKey: ['battle-questions', boss.id] });
      toast.success(`${imported} pregunta(s) importada(s)`);
    } else {
      toast.error('No se pudo importar ninguna pregunta');
    }
    setShowBankSelector(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-500 to-indigo-500">
            <div>
              <h2 className="text-xl font-bold text-white">📝 Preguntas</h2>
              <p className="text-sm text-white/80">{boss.bossName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[70vh]">
            {/* Botones de acción */}
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => setShowAddQuestion(true)}
                leftIcon={<Plus size={16} />}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500"
              >
                Crear pregunta
              </Button>
              <Button
                onClick={() => setShowBankSelector(true)}
                leftIcon={<BookOpen size={16} />}
                variant="secondary"
                className="flex-1"
              >
                Importar del banco
              </Button>
            </div>

            {/* Validación de daño vs HP (solo para BvJ) */}
            {boss.battleMode === 'BVJ' && questions.length > 0 && (
              <DamageVsHpWarning 
                questions={questions} 
                boss={boss} 
                onAdjustHp={async (newHp) => {
                  try {
                    await battleApi.updateBoss(boss.id, { bossHp: newHp });
                    queryClient.invalidateQueries({ queryKey: ['bosses'] });
                    toast.success(`HP del boss ajustado a ${newHp}`);
                  } catch {
                    toast.error('Error al ajustar HP');
                  }
                }}
              />
            )}

            {/* Lista de preguntas */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HelpCircle size={48} className="mx-auto mb-2 opacity-50" />
                <p>No hay preguntas aún</p>
                <p className="text-sm">Crea preguntas o importa desde el banco</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                            #{index + 1}
                          </span>
                          {q.imageUrl && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                              <Image size={10} className="inline mr-1" />
                              Con imagen
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            <Zap size={10} className="inline mr-1 text-amber-500" />
                            {q.damage} daño
                          </span>
                          <span className="text-xs text-gray-500">
                            <Clock size={10} className="inline mr-1 text-blue-500" />
                            {q.timeLimit}s
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{q.question}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.battleQuestionType === 'MATCHING' ? (
                            // Para MATCHING, mostrar los pares
                            (() => {
                              const parsedPairs = (() => {
                                try {
                                  if (Array.isArray(q.pairs)) return q.pairs;
                                  if (typeof q.pairs === 'string') return JSON.parse(q.pairs);
                                  return [];
                                } catch { return []; }
                              })();
                              return parsedPairs.length > 0 ? (
                                <div className="flex flex-col gap-1 w-full">
                                  {parsedPairs.map((pair: { left: string; right: string }, i: number) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                      {i + 1}. {pair.left} → {pair.right}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Sin pares</span>
                              );
                            })()
                          ) : (
                            // Para otros tipos, mostrar opciones
                            (Array.isArray(q.options) ? q.options : []).map((_opt: string, i: number) => {
                              const parsedCorrectIndices = (() => {
                                try {
                                  if (Array.isArray(q.correctIndices)) return q.correctIndices;
                                  if (typeof q.correctIndices === 'string') return JSON.parse(q.correctIndices);
                                  return [];
                                } catch { return []; }
                              })();
                              const isCorrect = q.battleQuestionType === 'MULTIPLE_CHOICE' 
                                ? parsedCorrectIndices.includes(i)
                                : i === q.correctIndex;
                              return (
                                <span
                                  key={i}
                                  className={`text-xs px-2 py-1 rounded ${
                                    isCorrect
                                      ? 'bg-green-100 text-green-700 font-medium'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + i)}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteQuestionConfirm({ isOpen: true, question: q })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal agregar/editar pregunta */}
          <QuestionFormModal
            isOpen={showAddQuestion || !!editingQuestion}
            onClose={() => {
              setShowAddQuestion(false);
              setEditingQuestion(null);
            }}
            question={editingQuestion}
            onSave={(data) => {
              if (editingQuestion) {
                updateMutation.mutate({ id: editingQuestion.id, data });
              } else {
                addMutation.mutate(data);
              }
            }}
            isLoading={addMutation.isPending || updateMutation.isPending}
          />

          {/* Modal selector de banco de preguntas */}
          <BankSelectorModal
            isOpen={showBankSelector}
            onClose={() => setShowBankSelector(false)}
            classroomId={classroomId}
            onImport={handleImportFromBank}
          />

          {/* Modal de confirmación para eliminar pregunta */}
          <ConfirmModal
            isOpen={deleteQuestionConfirm.isOpen}
            onClose={() => setDeleteQuestionConfirm({ isOpen: false, question: null })}
            onConfirm={() => {
              if (deleteQuestionConfirm.question) {
                deleteMutation.mutate(deleteQuestionConfirm.question.id);
              }
              setDeleteQuestionConfirm({ isOpen: false, question: null });
            }}
            title="¿Eliminar pregunta?"
            message="Esta acción no se puede deshacer."
            confirmText="Eliminar"
            variant="danger"
            isLoading={deleteMutation.isPending}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal selector de banco de preguntas
const BankSelectorModal = ({
  isOpen,
  onClose,
  classroomId,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  onImport: (questions: Question[]) => void;
}) => {
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['questionBanks', classroomId],
    queryFn: () => questionBankApi.getBanks(classroomId),
    enabled: isOpen,
  });

  const { data: questions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions', selectedBank?.id],
    queryFn: () => questionBankApi.getQuestions(selectedBank!.id),
    enabled: !!selectedBank?.id,
  });

  const toggleQuestion = (id: string) => {
    const newSet = new Set(selectedQuestions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedQuestions(newSet);
  };

  const selectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)));
    }
  };

  const handleImport = () => {
    const toImport = questions.filter(q => selectedQuestions.has(q.id));
    onImport(toImport);
    setSelectedBank(null);
    setSelectedQuestions(new Set());
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center gap-3">
            {selectedBank && (
              <button
                onClick={() => {
                  setSelectedBank(null);
                  setSelectedQuestions(new Set());
                }}
                className="p-1.5 hover:bg-white/20 rounded-lg text-white"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen size={20} />
                {selectedBank ? selectedBank.name : 'Banco de Preguntas'}
              </h2>
              <p className="text-sm text-white/80">
                {selectedBank 
                  ? `${selectedQuestions.size} de ${questions.length} seleccionadas`
                  : 'Selecciona un banco para importar preguntas'
                }
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!selectedBank ? (
            // Lista de bancos
            loadingBanks ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : banks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                <p>No hay bancos de preguntas</p>
                <p className="text-sm">Crea bancos desde Gamificación → Banco de Preguntas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: bank.color + '30' }}
                    >
                      {getBankEmoji(bank.icon)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{bank.name}</h3>
                      <p className="text-sm text-gray-500">
                        {bank.questionCount || 0} preguntas
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                ))}
              </div>
            )
          ) : (
            // Lista de preguntas del banco
            loadingQuestions ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HelpCircle size={48} className="mx-auto mb-2 opacity-50" />
                <p>Este banco no tiene preguntas</p>
              </div>
            ) : (
              <>
                <button
                  onClick={selectAll}
                  className="mb-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {selectedQuestions.size === questions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => toggleQuestion(q.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                        selectedQuestions.has(q.id)
                          ? 'bg-indigo-50 border-indigo-500'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selectedQuestions.has(q.id)
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-200'
                      }`}>
                        {selectedQuestions.has(q.id) && <Check size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium line-clamp-2">{q.questionText}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[q.difficulty]}`}>
                            {DIFFICULTY_LABELS[q.difficulty]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {q.points} pts
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )
          )}
        </div>

        {selectedBank && selectedQuestions.size > 0 && (
          <div className="p-4 border-t">
            <Button
              onClick={handleImport}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500"
              leftIcon={<Plus size={16} />}
            >
              Importar {selectedQuestions.size} pregunta(s)
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// Helper para parsear options (fuera del componente para evitar recreación)
const parseQuestionOptions = (opts: any): string[] => {
  if (!opts) return ['', '', '', ''];
  
  try {
    // Si ya es un array, devolverlo
    if (Array.isArray(opts)) return opts;
    
    // Si es string, intentar parsear
    if (typeof opts === 'string') {
      // Intentar parsear directamente
      let parsed = JSON.parse(opts);
      
      // Si sigue siendo string, parsear de nuevo (doble serialización)
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      
      if (Array.isArray(parsed)) return parsed;
    }
    
    // Si es un objeto con propiedades numéricas (como viene de MySQL a veces)
    if (typeof opts === 'object') {
      const arr = Object.values(opts);
      if (arr.length > 0 && arr.every(v => typeof v === 'string')) {
        return arr as string[];
      }
    }
  } catch (e) {
    console.error('Error parsing options:', e, 'Original:', opts);
  }
  
  return ['', '', '', ''];
};

// Tipos de pregunta de batalla
type BattleQType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';

const BATTLE_QUESTION_TYPES = [
  { id: 'TRUE_FALSE' as BattleQType, label: 'V o F', icon: '✓✗' },
  { id: 'SINGLE_CHOICE' as BattleQType, label: 'Única', icon: '○' },
  { id: 'MULTIPLE_CHOICE' as BattleQType, label: 'Múltiple', icon: '☑' },
  { id: 'MATCHING' as BattleQType, label: 'Unir', icon: '↔' },
];

interface MatchingPairLocal {
  left: string;
  right: string;
}

// Modal formulario de pregunta
const QuestionFormModal = ({
  isOpen,
  onClose,
  question,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  question: BattleQuestion | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) => {
  const [questionType, setQuestionType] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [battleQuestionType, setBattleQuestionType] = useState<BattleQType>('SINGLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [optionsState, setOptionsState] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [correctIndices, setCorrectIndices] = useState<number[]>([0]);
  const [pairs, setPairs] = useState<MatchingPairLocal[]>([{ left: '', right: '' }, { left: '', right: '' }]);
  const [correctAnswer, setCorrectAnswer] = useState(true); // Para TRUE_FALSE
  const [damage, setDamage] = useState(10);
  const [hpPenalty, setHpPenalty] = useState(10);
  const [timeLimit, setTimeLimit] = useState(30);

  const options = Array.isArray(optionsState) ? optionsState : ['', '', '', ''];
  const setOptions = setOptionsState;

  // Helper para parsear JSON
  const safeJsonParse = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    try {
      let parsed = JSON.parse(value);
      while (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { break; }
      }
      return parsed;
    } catch { return value; }
  };

  // Limpiar/cargar datos cuando cambia question o se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    
    if (question) {
      setQuestionType(question.questionType || 'TEXT');
      setQuestionText(question.question || '');
      setImageUrl(question.imageUrl || '');
      setDamage(question.damage || 10);
      setHpPenalty(question.hpPenalty || 10);
      setTimeLimit(question.timeLimit || 30);
      
      // Detectar el tipo de pregunta
      const parsedPairs = safeJsonParse(question.pairs);
      const parsedCorrectIndices = safeJsonParse(question.correctIndices);
      const parsedOptions = parseQuestionOptions(question.options);
      
      let detectedType: BattleQType = 'SINGLE_CHOICE';
      
      // Primero verificar el campo battleQuestionType si existe
      if (question.battleQuestionType && ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING'].includes(question.battleQuestionType)) {
        detectedType = question.battleQuestionType as BattleQType;
      }
      // Si tiene pairs válidos, es MATCHING
      else if (Array.isArray(parsedPairs) && parsedPairs.length > 0) {
        detectedType = 'MATCHING';
      }
      // Si tiene correctIndices con más de un elemento, es MULTIPLE_CHOICE
      else if (Array.isArray(parsedCorrectIndices) && parsedCorrectIndices.length > 1) {
        detectedType = 'MULTIPLE_CHOICE';
      }
      // Si las opciones son exactamente ['Verdadero', 'Falso'], es TRUE_FALSE
      else if (parsedOptions.length === 2 && 
          (parsedOptions[0] === 'Verdadero' || parsedOptions[0] === 'verdadero') &&
          (parsedOptions[1] === 'Falso' || parsedOptions[1] === 'falso')) {
        detectedType = 'TRUE_FALSE';
      }
      // Detectar MATCHING por el patrón "izq → der" en las opciones
      else if (parsedOptions.length > 0 && parsedOptions.every((o: string) => o.includes(' → '))) {
        detectedType = 'MATCHING';
      }
      
      setBattleQuestionType(detectedType);
      
      // Cargar datos según el tipo detectado
      if (detectedType === 'TRUE_FALSE') {
        setCorrectAnswer(question.correctIndex === 0);
        setOptionsState(['', '', '', '']);
        setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      } else if (detectedType === 'SINGLE_CHOICE') {
        setOptionsState(parsedOptions.length > 0 ? parsedOptions : ['', '', '', '']);
        setCorrectIndex(question.correctIndex ?? 0);
        setCorrectIndices([]);
        setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      } else if (detectedType === 'MULTIPLE_CHOICE') {
        setOptionsState(parsedOptions.length > 0 ? parsedOptions : ['', '', '', '']);
        setCorrectIndices(Array.isArray(parsedCorrectIndices) && parsedCorrectIndices.length > 0 ? parsedCorrectIndices : [0]);
        setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      } else if (detectedType === 'MATCHING') {
        // Intentar usar pairs directos, si no, reconstruir desde opciones
        if (Array.isArray(parsedPairs) && parsedPairs.length > 0) {
          setPairs(parsedPairs);
        } else if (parsedOptions.length > 0 && parsedOptions.every((o: string) => o.includes(' → '))) {
          const reconstructedPairs = parsedOptions.map((o: string) => {
            const parts = o.split(' → ');
            return { left: parts[0] || '', right: parts[1] || '' };
          });
          setPairs(reconstructedPairs);
        } else {
          setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
        }
        setOptionsState(['', '', '', '']);
        setCorrectIndices([]);
      }
    } else {
      // Limpiar para nueva pregunta
      setQuestionType('TEXT');
      setBattleQuestionType('SINGLE_CHOICE');
      setQuestionText('');
      setImageUrl('');
      setOptionsState(['', '', '', '']);
      setCorrectIndex(0);
      setCorrectIndices([0]);
      setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      setCorrectAnswer(true);
      setDamage(10);
      setHpPenalty(10);
      setTimeLimit(30);
    }
  }, [question, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {
      questionType,
      battleQuestionType,
      question: questionText,
      imageUrl: imageUrl || undefined,
      damage,
      hpPenalty,
      timeLimit,
    };

    if (battleQuestionType === 'TRUE_FALSE') {
      data.options = ['Verdadero', 'Falso'];
      data.correctIndex = correctAnswer ? 0 : 1;
    } else if (battleQuestionType === 'SINGLE_CHOICE') {
      const validOptions = options.filter(o => o.trim());
      if (validOptions.length < 2) {
        toast.error('Escribe al menos 2 opciones de respuesta');
        return;
      }
      data.options = validOptions;
      data.correctIndex = correctIndex >= validOptions.length ? 0 : correctIndex;
    } else if (battleQuestionType === 'MULTIPLE_CHOICE') {
      const validOptions = options.filter(o => o.trim());
      if (validOptions.length < 2) {
        toast.error('Escribe al menos 2 opciones de respuesta');
        return;
      }
      if (correctIndices.length < 2) {
        toast.error('Selecciona al menos 2 respuestas correctas (es múltiple)');
        return;
      }
      data.options = validOptions;
      data.correctIndices = correctIndices.filter(i => i < validOptions.length);
      data.correctIndex = data.correctIndices[0] || 0;
    } else if (battleQuestionType === 'MATCHING') {
      const validPairs = pairs.filter(p => p.left.trim() && p.right.trim());
      if (validPairs.length < 2) {
        toast.error('Necesitas al menos 2 pares');
        return;
      }
      data.pairs = validPairs;
      data.options = validPairs.map(p => `${p.left} → ${p.right}`);
      data.correctIndex = 0;
    }

    onSave(data);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      if (correctIndex >= newOptions.length) setCorrectIndex(0);
      setCorrectIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    }
  };

  const toggleCorrectIndex = (index: number) => {
    if (battleQuestionType === 'MULTIPLE_CHOICE') {
      setCorrectIndices(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    } else {
      setCorrectIndex(index);
    }
  };

  const updatePair = (index: number, field: 'left' | 'right', value: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setPairs(newPairs);
  };

  const addPair = () => {
    if (pairs.length < 6) {
      setPairs([...pairs, { left: '', right: '' }]);
    }
  };

  const removePair = (index: number) => {
    if (pairs.length > 2) {
      setPairs(pairs.filter((_, i) => i !== index));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-indigo-600 to-purple-600 flex-shrink-0">
            <h2 className="text-lg font-bold text-white">
              {question ? '✏️ Editar pregunta' : '➕ Nueva pregunta'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Tipo de pregunta de batalla */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Tipo de respuesta
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BATTLE_QUESTION_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBattleQuestionType(t.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors ${
                      battleQuestionType === t.id
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-slate-600 text-gray-400 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Con imagen */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuestionType(questionType === 'IMAGE' ? 'TEXT' : 'IMAGE')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  questionType === 'IMAGE'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-slate-600 text-gray-400 hover:border-slate-500'
                }`}
              >
                <Image size={16} />
                <span className="text-sm">Con imagen</span>
              </button>
            </div>

            {/* Pregunta */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Pregunta
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Escribe la pregunta..."
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
                required
              />
            </div>

            {/* Imagen (si aplica) */}
            {questionType === 'IMAGE' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  URL de la imagen
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.png"
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400"
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="mt-2 max-h-32 rounded-lg object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
            )}

            {/* TRUE_FALSE */}
            {battleQuestionType === 'TRUE_FALSE' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Respuesta correcta
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(true)}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                      correctAnswer
                        ? 'border-green-500 bg-green-500/20 text-green-300'
                        : 'border-slate-600 text-gray-400 hover:border-slate-500'
                    }`}
                  >
                    ✓ Verdadero
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(false)}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                      !correctAnswer
                        ? 'border-red-500 bg-red-500/20 text-red-300'
                        : 'border-slate-600 text-gray-400 hover:border-slate-500'
                    }`}
                  >
                    ✗ Falso
                  </button>
                </div>
              </div>
            )}

            {/* SINGLE_CHOICE / MULTIPLE_CHOICE */}
            {(battleQuestionType === 'SINGLE_CHOICE' || battleQuestionType === 'MULTIPLE_CHOICE') && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Opciones {battleQuestionType === 'MULTIPLE_CHOICE' ? '(marca las correctas)' : '(marca la correcta)'}
                </label>
                <div className="space-y-2">
                  {options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrectIndex(index)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors ${
                          (battleQuestionType === 'MULTIPLE_CHOICE' ? correctIndices.includes(index) : correctIndex === index)
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-700 text-gray-400 hover:bg-slate-600 border border-slate-600'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Opción ${String.fromCharCode(65 + index)}`}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="p-2 text-gray-400 hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-2 text-sm text-purple-400 hover:text-purple-300"
                  >
                    + Agregar opción
                  </button>
                )}
              </div>
            )}

            {/* MATCHING */}
            {battleQuestionType === 'MATCHING' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Pares para unir
                </label>
                <div className="space-y-2">
                  {pairs.map((pair, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pair.left}
                        onChange={(e) => updatePair(index, 'left', e.target.value)}
                        placeholder="Izquierda"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400"
                      />
                      <span className="text-gray-400">↔</span>
                      <input
                        type="text"
                        value={pair.right}
                        onChange={(e) => updatePair(index, 'right', e.target.value)}
                        placeholder="Derecha"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400"
                      />
                      {pairs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePair(index)}
                          className="p-2 text-gray-400 hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pairs.length < 6 && (
                  <button
                    type="button"
                    onClick={addPair}
                    className="mt-2 text-sm text-purple-400 hover:text-purple-300"
                  >
                    + Agregar par
                  </button>
                )}
              </div>
            )}

            {/* Daño, HP penalty y tiempo */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  <Zap size={14} className="inline mr-1 text-amber-400" />
                  Daño
                </label>
                <input
                  type="number"
                  value={damage}
                  onChange={(e) => setDamage(parseInt(e.target.value) || 1)}
                  min={1}
                  max={500}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  <Heart size={14} className="inline mr-1 text-red-400" />
                  HP falla
                </label>
                <input
                  type="number"
                  value={hpPenalty}
                  onChange={(e) => setHpPenalty(parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  <Clock size={14} className="inline mr-1 text-blue-400" />
                  Tiempo
                </label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value) || 5)}
                  min={5}
                  max={120}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              isLoading={isLoading}
              disabled={!questionText.trim()}
            >
              {question ? 'Guardar cambios' : 'Agregar pregunta'}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Modal iniciar batalla
const StartBattleModal = ({
  isOpen,
  onClose,
  boss,
  students,
  clansEnabled,
  onStart,
}: {
  isOpen: boolean;
  onClose: () => void;
  boss: Boss;
  students: any[];
  clansEnabled?: boolean;
  onStart: (studentIds: string[]) => void;
}) => {
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'clans'>('all');

  const { data: questions = [] } = useQuery({
    queryKey: ['battle-questions', boss.id],
    queryFn: () => battleApi.getQuestions(boss.id),
    enabled: isOpen,
  });

  const startMutation = useMutation({
    mutationFn: () => battleApi.startBattle(boss.id, selectedStudents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bosses'] });
      onStart(selectedStudents);
      toast.success('¡Batalla iniciada!');
    },
    onError: () => toast.error('Error al iniciar batalla'),
  });

  const toggleStudent = (id: string, hp: number) => {
    if (hp <= 0) return; // No permitir seleccionar estudiantes sin HP
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    // Solo seleccionar estudiantes con HP > 0
    const eligibleStudents = students.filter(s => (s.currentHp || s.hp || 100) > 0);
    setSelectedStudents(eligibleStudents.map(s => s.id));
  };

  const selectClan = (clanId: string | null) => {
    const clanStudents = students.filter(s => 
      s.teamId === clanId && (s.currentHp || s.hp || 100) > 0
    );
    const clanStudentIds = clanStudents.map(s => s.id);
    const allSelected = clanStudentIds.every(id => selectedStudents.includes(id));
    
    if (allSelected) {
      setSelectedStudents(prev => prev.filter(id => !clanStudentIds.includes(id)));
    } else {
      setSelectedStudents(prev => [...new Set([...prev, ...clanStudentIds])]);
    }
  };

  // Agrupar estudiantes por clan
  const studentsByClan = useMemo(() => {
    const groups: Record<string, { clanName: string; clanColor: string; students: any[] }> = {};
    const noClan: any[] = [];
    
    students.forEach(s => {
      if (s.teamId && s.clanName) {
        if (!groups[s.teamId]) {
          groups[s.teamId] = { clanName: s.clanName, clanColor: s.clanColor || '#6366f1', students: [] };
        }
        groups[s.teamId].students.push(s);
      } else {
        noClan.push(s);
      }
    });
    
    return { groups, noClan };
  }, [students]);

  if (!isOpen) return null;

  const canStart = selectedStudents.length > 0 && questions.length > 0;
  const eligibleCount = students.filter(s => (s.currentHp || s.hp || 100) > 0).length;
  const hasClans = Object.keys(studentsByClan.groups).length > 0;

  return (
    <AnimatePresence>
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
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-500 to-orange-500">
            <div>
              <h2 className="text-xl font-bold text-white">⚔️ Iniciar Batalla</h2>
              <p className="text-sm text-white/80">{boss.bossName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Info de la batalla */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <HelpCircle size={14} />
                  Preguntas
                </div>
                <span className={`text-2xl font-bold ${questions.length > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {questions.length}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Heart size={14} className="text-red-500" />
                  HP del Boss
                </div>
                <span className="text-2xl font-bold text-gray-800">{boss.bossHp}</span>
              </div>
            </div>

            {questions.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                Necesitas agregar preguntas antes de iniciar la batalla
              </div>
            )}

            {/* Selección de estudiantes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users size={16} />
                  Seleccionar participantes
                </label>
                <button
                  onClick={selectAll}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Seleccionar todos ({eligibleCount})
                </button>
              </div>

              {/* Tabs: Todos / Por Clanes */}
              {clansEnabled && hasClans && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setViewMode('all')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'all'
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Users size={14} className="inline mr-1" />
                    Todos
                  </button>
                  <button
                    onClick={() => setViewMode('clans')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'clans'
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Shield size={14} className="inline mr-1" />
                    Por Clanes
                  </button>
                </div>
              )}
              
              {students.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No hay estudiantes en la clase
                </p>
              ) : viewMode === 'clans' && hasClans ? (
                /* Vista por clanes */
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {Object.entries(studentsByClan.groups).map(([clanId, clan]) => {
                    const clanEligible = clan.students.filter(s => (s.currentHp || s.hp || 100) > 0);
                    const allSelected = clanEligible.length > 0 && clanEligible.every(s => selectedStudents.includes(s.id));
                    const someSelected = clanEligible.some(s => selectedStudents.includes(s.id));
                    
                    return (
                      <div key={clanId} className="border rounded-xl overflow-hidden" style={{ borderColor: clan.clanColor + '50' }}>
                        <button
                          onClick={() => selectClan(clanId)}
                          className="w-full flex items-center gap-2 p-2 transition-all hover:bg-gray-50"
                          style={{ backgroundColor: clan.clanColor + '10' }}
                        >
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: clan.clanColor }}
                          >
                            {clan.clanName[0]}
                          </div>
                          <span className="font-medium text-gray-800 flex-1 text-left">{clan.clanName}</span>
                          <span className="text-xs text-gray-500">{clanEligible.length} disponibles</span>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            allSelected ? 'bg-purple-500 border-purple-500' : someSelected ? 'bg-purple-200 border-purple-400' : 'border-gray-300'
                          }`}>
                            {allSelected && <Check size={12} className="text-white" />}
                            {someSelected && !allSelected && <div className="w-2 h-2 bg-purple-500 rounded-sm" />}
                          </div>
                        </button>
                        <div className="grid grid-cols-2 gap-1 p-2 bg-white">
                          {clan.students.map((student) => {
                            const hp = student.currentHp ?? student.hp ?? 100;
                            const isDisabled = hp <= 0;
                            const isSelected = selectedStudents.includes(student.id);
                            
                            return (
                              <button
                                key={student.id}
                                onClick={() => toggleStudent(student.id, hp)}
                                disabled={isDisabled}
                                className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                                  isDisabled ? 'opacity-40 cursor-not-allowed' :
                                  isSelected ? 'bg-purple-100 border border-purple-400' : 'hover:bg-gray-100 border border-transparent'
                                }`}
                              >
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold ${
                                  isDisabled ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-400 to-indigo-500'
                                }`}>
                                  {student.characterName?.[0] || '?'}
                                </div>
                                <span className="truncate flex-1 text-left">{student.characterName?.split(' ')[0]}</span>
                                {isSelected && <Check size={12} className="text-purple-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {studentsByClan.noClan.length > 0 && (
                    <div className="border rounded-xl overflow-hidden border-gray-200">
                      <div className="flex items-center gap-2 p-2 bg-gray-50">
                        <div className="w-8 h-8 rounded-lg bg-gray-400 flex items-center justify-center text-white text-sm">?</div>
                        <span className="font-medium text-gray-600">Sin clan</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-2 bg-white">
                        {studentsByClan.noClan.map((student) => {
                          const hp = student.currentHp ?? student.hp ?? 100;
                          const isDisabled = hp <= 0;
                          const isSelected = selectedStudents.includes(student.id);
                          
                          return (
                            <button
                              key={student.id}
                              onClick={() => toggleStudent(student.id, hp)}
                              disabled={isDisabled}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                                isDisabled ? 'opacity-40' : isSelected ? 'bg-purple-100 border border-purple-400' : 'hover:bg-gray-100'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold ${
                                isDisabled ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-400 to-indigo-500'
                              }`}>
                                {student.characterName?.[0] || '?'}
                              </div>
                              <span className="truncate flex-1 text-left">{student.characterName?.split(' ')[0]}</span>
                              {isSelected && <Check size={12} className="text-purple-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Vista de todos */
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {students.map((student) => {
                    const hp = student.currentHp ?? student.hp ?? 100;
                    const maxHp = student.maxHp ?? 100;
                    const hpPercent = Math.round((hp / maxHp) * 100);
                    const isDisabled = hp <= 0;
                    const isSelected = selectedStudents.includes(student.id);
                    
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => toggleStudent(student.id, hp)}
                        disabled={isDisabled}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isDisabled
                            ? 'bg-gray-100 border-2 border-gray-200 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-purple-50 border-2 border-purple-500 shadow-sm'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                          isDisabled ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-400 to-indigo-500'
                        }`}>
                          {student.characterName?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`font-medium text-sm truncate ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                            {student.characterName || 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Heart size={10} className={hp > 0 ? 'text-red-500' : 'text-gray-400'} />
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${hpPercent}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                              {hp}/{maxHp}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-purple-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <Button
              onClick={() => startMutation.mutate()}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              isLoading={startMutation.isPending}
              disabled={!canStart}
              leftIcon={<Swords size={18} />}
            >
              {selectedStudents.length > 0
                ? `¡Iniciar con ${selectedStudents.length} héroe(s)!`
                : 'Selecciona participantes'
              }
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
