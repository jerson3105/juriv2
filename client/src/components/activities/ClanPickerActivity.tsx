import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  ArrowLeft, 
  Dices, 
  Users,
  Trophy,
  Zap,
  Heart,
  Coins,
  Check,
  X,
  Settings,
  History,
  Shield,
  Sparkles,
  Star,
  Crown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clanApi, CLAN_EMBLEMS, type ClanWithMembers } from '../../lib/clanApi';
import { studentApi } from '../../lib/studentApi';
import toast from 'react-hot-toast';

const NEON_COLORS = ['#00ffd5', '#00e5ff', '#76ff03', '#ffea00', '#ff9100', '#ff3d00', '#d500f9', '#651fff', '#00e676', '#18ffff', '#f50057', '#304ffe', '#00bfa5'];

interface ClanPickerActivityProps {
  classroom: {
    id: string;
    name: string;
    clansEnabled?: boolean;
  };
  onBack: () => void;
}

export const ClanPickerActivity = ({ classroom, onBack }: ClanPickerActivityProps) => {
  const queryClient = useQueryClient();
  
  // Estados
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedClan, setSelectedClan] = useState<ClanWithMembers | null>(null);
  const [pickerHistory, setPickerHistory] = useState<ClanWithMembers[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(false);
  const [excludedClans, setExcludedClans] = useState<Set<string>>(new Set());
  const [spinningClan, setSpinningClan] = useState<ClanWithMembers | null>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rewardConfig, setRewardConfig] = useState({
    xp: 10,
    hp: 0,
    gp: 5,
    xpEnabled: true,
    hpEnabled: false,
    gpEnabled: true,
  });

  const availableClans = (clans: ClanWithMembers[]) => {
    const selectedIds = new Set(pickerHistory.map(c => c.id));
    return clans.filter(c => !excludedClans.has(c.id) && !selectedIds.has(c.id));
  };

  const toggleExcludeClan = (clanId: string) => {
    setExcludedClans(prev => {
      const next = new Set(prev);
      if (next.has(clanId)) next.delete(clanId);
      else next.add(clanId);
      return next;
    });
  };

  // Query para clanes
  const { data: clans = [], isLoading } = useQuery({
    queryKey: ['clans', classroom.id],
    queryFn: () => clanApi.getClassroomClans(classroom.id),
    enabled: !!classroom?.id && classroom.clansEnabled,
  });

  // Mutation para dar puntos a miembros del clan
  const rewardMutation = useMutation({
    mutationFn: async ({ clan, rewards }: { clan: ClanWithMembers; rewards: { xp: number; hp: number; gp: number } }) => {
      const promises = clan.members?.map(member => {
        const updates: Promise<any>[] = [];
        if (rewards.xp > 0) {
          updates.push(studentApi.updatePoints(member.id, { pointType: 'XP', amount: rewards.xp, reason: `Recompensa de clan: ${clan.name}` }));
        }
        if (rewards.hp > 0) {
          updates.push(studentApi.updatePoints(member.id, { pointType: 'HP', amount: rewards.hp, reason: `Recompensa de clan: ${clan.name}` }));
        }
        if (rewards.gp > 0) {
          updates.push(studentApi.updatePoints(member.id, { pointType: 'GP', amount: rewards.gp, reason: `Recompensa de clan: ${clan.name}` }));
        }
        return Promise.all(updates);
      }) || [];
      return Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classroom'] });
      const parts: string[] = [];
      if (variables.rewards.xp > 0) parts.push(`${variables.rewards.xp} XP`);
      if (variables.rewards.hp > 0) parts.push(`${variables.rewards.hp} HP`);
      if (variables.rewards.gp > 0) parts.push(`${variables.rewards.gp} GP`);
      toast.success(`¡${variables.clan.members?.length || 0} miembros de ${variables.clan.name} recibieron ${parts.join(', ')}!`);
      setShowPointsPanel(false);
    },
    onError: () => {
      toast.error('Error al dar recompensas');
    },
  });

  // Función para seleccionar clan aleatorio
  const spinClanPicker = useCallback(() => {
    const pool = availableClans(clans);
    if (!pool || pool.length === 0) return;
    
    setIsSpinning(true);
    setSelectedClan(null);
    setShowPointsPanel(false);
    
    const maxIterations = 20 + Math.floor(Math.random() * 10);
    
    const runIteration = (iteration: number) => {
      const randomIndex = Math.floor(Math.random() * pool.length);
      setSpinningClan(pool[randomIndex]);
      
      if (iteration >= maxIterations) {
        const finalIndex = Math.floor(Math.random() * pool.length);
        const winner = pool[finalIndex];
        setSpinningClan(null);
        setSelectedClan(winner);
        setIsSpinning(false);
        setPickerHistory(prev => [winner, ...prev.slice(0, 9)]);
        
        // Confetti with clan color
        const hex = winner.color || '#10b981';
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: [hex, '#ffffff', '#fbbf24', hex],
        });
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: [hex, '#10b981', '#06b6d4'],
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: [hex, '#10b981', '#06b6d4'],
          });
        }, 250);
        return;
      }
      
      const delay = 80 + iteration * 12;
      spinTimeoutRef.current = setTimeout(() => runIteration(iteration + 1), delay);
    };
    
    runIteration(0);
  }, [clans, excludedClans, pickerHistory]);

  // Dar recompensas al clan seleccionado
  const giveRewards = () => {
    if (!selectedClan) return;
    
    const rewards = {
      xp: rewardConfig.xpEnabled ? rewardConfig.xp : 0,
      hp: rewardConfig.hpEnabled ? rewardConfig.hp : 0,
      gp: rewardConfig.gpEnabled ? rewardConfig.gp : 0,
    };
    
    if (rewards.xp === 0 && rewards.hp === 0 && rewards.gp === 0) {
      toast.error('Configura al menos una recompensa');
      return;
    }
    
    rewardMutation.mutate({ clan: selectedClan, rewards });
  };

  if (!classroom.clansEnabled) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/20">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">Sistema de Clanes Desactivado</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">Activa el sistema de clanes en la configuración de la clase para usar esta actividad.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (clans.length < 2) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/20">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">Necesitas más clanes</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">Crea al menos 2 clanes para usar la selección aleatoria.</p>
        </div>
      </div>
    );
  }

  const pool = availableClans(clans);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all border border-white/20">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-12 h-12 bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/40"
          >
            <Shield size={24} />
          </motion.div>
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              Selección de Clanes
              <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                <Star size={16} className="text-amber-500 fill-amber-500" />
              </motion.span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium">
                <Shield size={12} />{pool.length} disponibles
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                <Trophy size={12} />{pickerHistory.length} seleccionados
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2.5 rounded-xl transition-all ${showHistory ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'bg-white/80 hover:bg-white text-gray-500'}`}
          >
            <History size={18} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'bg-white/80 hover:bg-white text-gray-500'}`}
          >
            <Settings size={18} />
          </button>
        </div>
      </motion.div>

      {/* Grid layout */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main area (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Settings panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
                  <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                    <Sparkles size={16} className="text-teal-500" />Configuración de Recompensas
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {/* XP */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <button
                          onClick={() => setRewardConfig(prev => ({ ...prev, xpEnabled: !prev.xpEnabled }))}
                          className={`relative w-9 h-5 rounded-full transition-colors ${rewardConfig.xpEnabled ? 'bg-yellow-500' : 'bg-gray-300'}`}
                        >
                          <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow" animate={{ x: rewardConfig.xpEnabled ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                        </button>
                        <span className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          <Zap size={14} className="text-yellow-500" />XP
                        </span>
                      </label>
                      <input
                        type="number"
                        value={rewardConfig.xp}
                        onChange={(e) => setRewardConfig(prev => ({ ...prev, xp: parseInt(e.target.value) || 0 }))}
                        disabled={!rewardConfig.xpEnabled}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 disabled:opacity-50 text-sm"
                        min="0"
                      />
                    </div>
                    {/* HP */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <button
                          onClick={() => setRewardConfig(prev => ({ ...prev, hpEnabled: !prev.hpEnabled }))}
                          className={`relative w-9 h-5 rounded-full transition-colors ${rewardConfig.hpEnabled ? 'bg-red-500' : 'bg-gray-300'}`}
                        >
                          <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow" animate={{ x: rewardConfig.hpEnabled ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                        </button>
                        <span className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          <Heart size={14} className="text-red-500" />HP
                        </span>
                      </label>
                      <input
                        type="number"
                        value={rewardConfig.hp}
                        onChange={(e) => setRewardConfig(prev => ({ ...prev, hp: parseInt(e.target.value) || 0 }))}
                        disabled={!rewardConfig.hpEnabled}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 disabled:opacity-50 text-sm"
                        min="0"
                      />
                    </div>
                    {/* GP */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <button
                          onClick={() => setRewardConfig(prev => ({ ...prev, gpEnabled: !prev.gpEnabled }))}
                          className={`relative w-9 h-5 rounded-full transition-colors ${rewardConfig.gpEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                        >
                          <motion.div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow" animate={{ x: rewardConfig.gpEnabled ? 16 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                        </button>
                        <span className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          <Coins size={14} className="text-amber-500" />Oro
                        </span>
                      </label>
                      <input
                        type="number"
                        value={rewardConfig.gp}
                        onChange={(e) => setRewardConfig(prev => ({ ...prev, gp: parseInt(e.target.value) || 0 }))}
                        disabled={!rewardConfig.gpEnabled}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-800 disabled:opacity-50 text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main gradient area */}
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative rounded-3xl min-h-[380px] overflow-hidden shadow-2xl">
            {/* Background with particles */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{ background: NEON_COLORS[i % NEON_COLORS.length], left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                  animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3], scale: [1, 1.5, 1] }}
                  transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                />
              ))}
              <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute bottom-10 right-10 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex items-center justify-center min-h-[380px] p-6">
              <AnimatePresence mode="wait">
                {isSpinning && spinningClan ? (
                  /* Spinning state — stable key so AnimatePresence doesn't fight rapid changes */
                  <motion.div
                    key="spinning"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-center"
                  >
                    <motion.div
                      className="w-28 h-28 rounded-2xl flex items-center justify-center text-6xl mx-auto shadow-2xl border-4 border-white/30"
                      style={{ backgroundColor: spinningClan.color }}
                      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 0.95, 1] }}
                      transition={{ duration: 0.15, repeat: Infinity }}
                    >
                      {CLAN_EMBLEMS[spinningClan.emblem] || '🛡️'}
                    </motion.div>
                    <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-white text-2xl mt-6 font-black">
                      ¡Girando...!
                    </motion.p>
                  </motion.div>
                ) : selectedClan && !isSpinning ? (
                  /* Selected state */
                  <motion.div
                    key="selected"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="text-center"
                  >
                    {/* Crown */}
                    <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="flex justify-center mb-2">
                      <Crown size={32} className="text-amber-400 drop-shadow-lg" />
                    </motion.div>

                    {/* Emblem with rotating ring */}
                    <div className="relative w-36 h-36 mx-auto mb-4">
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: 'conic-gradient(from 0deg, #10b981, #06b6d4, #14b8a6, #fbbf24, #10b981)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      />
                      <div
                        className="absolute inset-1.5 rounded-xl flex items-center justify-center text-7xl shadow-inner"
                        style={{ backgroundColor: selectedClan.color }}
                      >
                        {CLAN_EMBLEMS[selectedClan.emblem] || '🛡️'}
                      </div>
                    </div>

                    <h3 className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                      {selectedClan.name}
                    </h3>
                    {selectedClan.motto && (
                      <p className="text-sm text-white/70 italic mb-3">"{selectedClan.motto}"</p>
                    )}

                    {/* Stats badges */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-3 mb-4">
                      <span className="flex items-center gap-1 text-white/90 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                        <Users size={14} />{selectedClan.members?.length || 0} miembros
                      </span>
                      <span className="flex items-center gap-1 text-white/90 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                        <Zap size={14} className="text-yellow-300" />{selectedClan.totalXp} XP
                      </span>
                      {(selectedClan.wins > 0 || selectedClan.losses > 0) && (
                        <span className="flex items-center gap-1 text-white/90 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                          <Trophy size={14} className="text-amber-300" />{selectedClan.wins}W / {selectedClan.losses}L
                        </span>
                      )}
                    </motion.div>

                    {/* Members */}
                    {selectedClan.members && selectedClan.members.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                        {selectedClan.members.map((member, idx) => (
                          <motion.div
                            key={member.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 + idx * 0.05 }}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full"
                          >
                            <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold text-white">
                              {(member.characterName || '?')[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-white font-medium">{member.characterName || 'Sin nombre'}</span>
                            <span className="text-xs text-white/60">Nv.{member.level}</span>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  /* Idle state */
                  <motion.div
                    key="idle"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="text-center text-white"
                  >
                    <motion.div
                      className="relative w-32 h-32 mx-auto mb-6"
                      animate={{ rotateY: [0, 360], rotateX: [0, 15, 0, -15, 0] }}
                      transition={{ rotateY: { duration: 8, repeat: Infinity, ease: 'linear' }, rotateX: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
                      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-200 rounded-2xl shadow-2xl flex items-center justify-center transform-gpu">
                        <span className="text-6xl">🛡️</span>
                      </div>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent rounded-2xl"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </motion.div>
                    <motion.h2 className="text-3xl font-black mb-2" animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      ¿Qué clan será el elegido?
                    </motion.h2>
                    <p className="text-white/70 text-lg">{pool.length} {pool.length === 1 ? 'clan esperando' : 'clanes esperando'}</p>
                    <motion.div className="mt-6 flex items-center justify-center gap-2 text-white/60" animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <Sparkles size={16} /><span className="text-sm">Presiona el botón para comenzar</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="absolute inset-0 rounded-3xl border-2 border-white/20 pointer-events-none" />
          </motion.div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={spinClanPicker}
              disabled={isSpinning || pool.length === 0}
              className="group relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 text-white font-bold rounded-2xl shadow-xl shadow-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <motion.div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity }} />
              <Dices size={22} className={`relative z-10 ${isSpinning ? 'animate-spin' : ''}`} />
              <span className="relative z-10 text-lg">{isSpinning ? '¡Girando...!' : selectedClan ? '¡Girar de nuevo!' : '¡Elegir Clan!'}</span>
            </motion.button>
            {selectedClan && !isSpinning && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowPointsPanel(true)}
                className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 font-bold rounded-2xl shadow-xl shadow-amber-500/30 transition-all"
              >
                <Zap size={20} />
                <span className="text-lg">Dar Recompensa</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* History panel */}
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
                <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  <History size={16} className="text-teal-500" />Historial de Ronda
                </h3>
                {pickerHistory.length === 0 ? (
                  <div className="text-center py-6">
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-4xl mb-2">🛡️</motion.div>
                    <p className="text-xs text-gray-500">Aún no hay selecciones</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pickerHistory.map((clan, index) => (
                      <motion.div
                        key={`${clan.id}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100"
                      >
                        <span className="w-6 h-6 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md">
                          {index + 1}
                        </span>
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: clan.color }}
                        >
                          {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
                        </span>
                        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{clan.name}</span>
                        <Crown size={12} className="text-amber-500" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clan list */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/50 p-4 shadow-xl">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Shield size={16} className="text-teal-500" />Clanes
              <span className="ml-auto text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{clans.length} total</span>
            </h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {clans.map((clan) => {
                const isExcluded = excludedClans.has(clan.id);
                const isSelected = pickerHistory.some(h => h.id === clan.id);
                return (
                  <motion.div
                    key={clan.id}
                    whileHover={{ scale: 1.01 }}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                      isExcluded
                        ? 'bg-red-50 border border-red-200'
                        : isSelected
                        ? 'bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${isExcluded ? 'opacity-40 grayscale' : ''}`}
                        style={{ backgroundColor: clan.color }}
                      >
                        {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
                      </span>
                      <div className="min-w-0">
                        <span className={`text-xs font-semibold block ${isExcluded ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                          {clan.name}
                        </span>
                        <span className="text-[10px] text-gray-400">{clan.members?.length || 0} miembros</span>
                      </div>
                      {isSelected && !isExcluded && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </motion.div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleExcludeClan(clan.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isExcluded
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-400 hover:bg-red-200'
                      }`}
                      title={isExcluded ? 'Incluir' : 'Excluir'}
                    >
                      {isExcluded ? <Check size={14} /> : <X size={14} />}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Reward modal */}
      <AnimatePresence>
        {showPointsPanel && selectedClan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPointsPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 p-4 text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Zap size={20} />Dar Recompensa al Clan
                </h2>
                <p className="text-sm text-teal-100">
                  {selectedClan.members?.length || 0} miembros recibirán los puntos
                </p>
              </div>
              
              <div className="p-4">
                {/* Clan info */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md"
                    style={{ backgroundColor: selectedClan.color }}
                  >
                    {CLAN_EMBLEMS[selectedClan.emblem] || '🛡️'}
                  </span>
                  <div>
                    <p className="font-bold text-gray-800">{selectedClan.name}</p>
                    <p className="text-sm text-gray-500">{selectedClan.members?.length || 0} miembros</p>
                  </div>
                </div>

                {/* Reward summary */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700">Cada miembro recibirá:</p>
                  <div className="flex flex-wrap gap-2">
                    {rewardConfig.xpEnabled && rewardConfig.xp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        <Zap size={14} />+{rewardConfig.xp} XP
                      </span>
                    )}
                    {rewardConfig.hpEnabled && rewardConfig.hp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        <Heart size={14} />+{rewardConfig.hp} HP
                      </span>
                    )}
                    {rewardConfig.gpEnabled && rewardConfig.gp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                        <Coins size={14} />+{rewardConfig.gp} Oro
                      </span>
                    )}
                  </div>
                </div>

                {/* Member chips */}
                {selectedClan.members && selectedClan.members.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Miembros:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedClan.members.map((member) => (
                        <span key={member.id} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                          {member.characterName || 'Sin nombre'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPointsPanel(false)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    <X size={18} />Cancelar
                  </button>
                  <button
                    onClick={giveRewards}
                    disabled={rewardMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium hover:from-teal-600 hover:to-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Check size={18} />{rewardMutation.isPending ? 'Dando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
