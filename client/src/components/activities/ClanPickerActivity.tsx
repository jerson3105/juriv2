import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Shield
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clanApi, CLAN_EMBLEMS, type ClanWithMembers } from '../../lib/clanApi';
import { studentApi } from '../../lib/studentApi';
import toast from 'react-hot-toast';

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
  const [showPointsPanel, setShowPointsPanel] = useState(false);
  const [rewardConfig, setRewardConfig] = useState({
    xp: 10,
    hp: 0,
    gp: 5,
    xpEnabled: true,
    hpEnabled: false,
    gpEnabled: true,
  });

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
    if (!clans || clans.length === 0) return;
    
    setIsSpinning(true);
    setSelectedClan(null);
    setShowPointsPanel(false);
    
    // Animación de "girar" entre clanes
    let iterations = 0;
    const maxIterations = 20 + Math.floor(Math.random() * 10);
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * clans.length);
      setSelectedClan(clans[randomIndex]);
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        // Selección final
        const finalIndex = Math.floor(Math.random() * clans.length);
        const winner = clans[finalIndex];
        setSelectedClan(winner);
        setIsSpinning(false);
        setPickerHistory(prev => [winner, ...prev.slice(0, 9)]);
      }
    }, 100 + iterations * 10);
  }, [clans]);

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
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a actividades</span>
        </button>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
            Sistema de Clanes Desactivado
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            Activa el sistema de clanes en la configuración de la clase para usar esta actividad.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (clans.length < 2) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a actividades</span>
        </button>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
            Necesitas más clanes
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            Crea al menos 2 clanes para usar la selección aleatoria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver a actividades</span>
        </button>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings 
              ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' 
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Panel de configuración */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-lg"
          >
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <Settings size={16} />
              Configuración de Recompensas
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              {/* XP */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rewardConfig.xpEnabled}
                    onChange={(e) => setRewardConfig(prev => ({ ...prev, xpEnabled: e.target.checked }))}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Zap size={14} className="text-yellow-500" />
                    XP
                  </span>
                </label>
                <input
                  type="number"
                  value={rewardConfig.xp}
                  onChange={(e) => setRewardConfig(prev => ({ ...prev, xp: parseInt(e.target.value) || 0 }))}
                  disabled={!rewardConfig.xpEnabled}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50"
                  min="0"
                />
              </div>
              
              {/* HP */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rewardConfig.hpEnabled}
                    onChange={(e) => setRewardConfig(prev => ({ ...prev, hpEnabled: e.target.checked }))}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Heart size={14} className="text-red-500" />
                    HP
                  </span>
                </label>
                <input
                  type="number"
                  value={rewardConfig.hp}
                  onChange={(e) => setRewardConfig(prev => ({ ...prev, hp: parseInt(e.target.value) || 0 }))}
                  disabled={!rewardConfig.hpEnabled}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50"
                  min="0"
                />
              </div>
              
              {/* GP */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rewardConfig.gpEnabled}
                    onChange={(e) => setRewardConfig(prev => ({ ...prev, gpEnabled: e.target.checked }))}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Coins size={14} className="text-amber-500" />
                    Oro
                  </span>
                </label>
                <input
                  type="number"
                  value={rewardConfig.gp}
                  onChange={(e) => setRewardConfig(prev => ({ ...prev, gp: parseInt(e.target.value) || 0 }))}
                  disabled={!rewardConfig.gpEnabled}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50"
                  min="0"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Área principal */}
      <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 shadow-xl shadow-teal-500/25">
        {/* Clan seleccionado */}
        <div className="flex flex-col items-center justify-center py-8">
          {selectedClan ? (
            <motion.div
              key={selectedClan.id}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-center ${isSpinning ? 'animate-pulse' : ''}`}
            >
              <motion.div 
                className="w-32 h-32 rounded-2xl flex items-center justify-center text-6xl mb-4 mx-auto shadow-2xl"
                style={{ backgroundColor: selectedClan.color }}
                animate={isSpinning ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 0.2, repeat: isSpinning ? Infinity : 0 }}
              >
                {CLAN_EMBLEMS[selectedClan.emblem] || '🛡️'}
              </motion.div>
              <h3 className="text-3xl font-bold text-white mb-1">
                {selectedClan.name}
              </h3>
              {selectedClan.motto && (
                <p className="text-sm text-teal-100 italic">"{selectedClan.motto}"</p>
              )}
              {!isSpinning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4"
                >
                  <div className="flex items-center justify-center gap-4 text-sm mb-4">
                    <span className="flex items-center gap-1 text-white/80 bg-white/20 px-3 py-1 rounded-full">
                      <Users size={14} />
                      {selectedClan.members?.length || 0} miembros
                    </span>
                    <span className="flex items-center gap-1 text-white/80 bg-white/20 px-3 py-1 rounded-full">
                      <Trophy size={14} />
                      {selectedClan.totalXp} XP
                    </span>
                  </div>
                  
                  {/* Miembros del clan */}
                  {selectedClan.members && selectedClan.members.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex flex-wrap justify-center gap-2 max-w-md mx-auto"
                    >
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
                          <span className="text-sm text-white font-medium">
                            {member.characterName || 'Sin nombre'}
                          </span>
                          <span className="text-xs text-white/60">
                            Nv.{member.level}
                          </span>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="text-center text-white/80">
              <Dices size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">Presiona el botón para elegir un clan</p>
              <p className="text-sm text-white/60 mt-1">{clans.length} clanes disponibles</p>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={spinClanPicker}
            disabled={isSpinning}
            className="flex items-center gap-2 px-6 py-3 bg-white text-teal-600 rounded-xl font-bold hover:bg-teal-50 transition-colors disabled:opacity-50 shadow-lg"
          >
            <Dices size={20} className={isSpinning ? 'animate-spin' : ''} />
            {isSpinning ? 'Girando...' : selectedClan ? 'Girar de nuevo' : 'Elegir Clan'}
          </button>
          
          {selectedClan && !isSpinning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setShowPointsPanel(true)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-400 text-amber-900 rounded-xl font-bold hover:bg-amber-300 transition-colors shadow-lg"
            >
              <Zap size={20} />
              Dar Recompensa
            </motion.button>
          )}
        </div>
      </div>

      {/* Historial */}
      {pickerHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <History size={16} />
            Historial de selecciones
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pickerHistory.map((clan, index) => (
              <div
                key={`${clan.id}-${index}`}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg whitespace-nowrap"
              >
                <span 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: clan.color }}
                >
                  {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {clan.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de clanes participantes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <Users size={16} />
          Clanes participantes ({clans.length})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {clans.map((clan) => (
            <div
              key={clan.id}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                selectedClan?.id === clan.id
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <span 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: clan.color }}
              >
                {CLAN_EMBLEMS[clan.emblem] || '🛡️'}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-800 dark:text-white truncate">
                  {clan.name}
                </p>
                <p className="text-xs text-gray-500">
                  {clan.members?.length || 0} miembros
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de confirmación de recompensa */}
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-4 text-white">
                <h2 className="text-lg font-bold">Dar Recompensa al Clan</h2>
                <p className="text-sm text-teal-100">
                  {selectedClan.members?.length || 0} miembros recibirán los puntos
                </p>
              </div>
              
              <div className="p-4">
                {/* Clan info */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: selectedClan.color }}
                  >
                    {CLAN_EMBLEMS[selectedClan.emblem] || '🛡️'}
                  </span>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white">{selectedClan.name}</p>
                    <p className="text-sm text-gray-500">{selectedClan.members?.length || 0} miembros</p>
                  </div>
                </div>

                {/* Resumen de recompensas */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Cada miembro recibirá:</p>
                  <div className="flex flex-wrap gap-2">
                    {rewardConfig.xpEnabled && rewardConfig.xp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
                        <Zap size={14} />
                        +{rewardConfig.xp} XP
                      </span>
                    )}
                    {rewardConfig.hpEnabled && rewardConfig.hp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-medium">
                        <Heart size={14} />
                        +{rewardConfig.hp} HP
                      </span>
                    )}
                    {rewardConfig.gpEnabled && rewardConfig.gp > 0 && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                        <Coins size={14} />
                        +{rewardConfig.gp} Oro
                      </span>
                    )}
                  </div>
                </div>

                {/* Miembros */}
                {selectedClan.members && selectedClan.members.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Miembros:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedClan.members.map((member) => (
                        <span
                          key={member.id}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          {member.characterName || 'Sin nombre'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPointsPanel(false)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <X size={18} />
                    Cancelar
                  </button>
                  <button
                    onClick={giveRewards}
                    disabled={rewardMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium hover:from-teal-600 hover:to-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Check size={18} />
                    {rewardMutation.isPending ? 'Dando...' : 'Confirmar'}
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
