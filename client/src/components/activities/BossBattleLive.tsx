import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Swords, Zap, Clock, ChevronRight, Users, Sparkles, Coins, Crown, Check, X, Shield, Flame, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/Button';
import { battleApi, type BattleState, type BattleQuestion, type BattleResult, type BattleQuestionType, type MatchingPair } from '../../lib/battleApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// ===== EFFECTS =====
const fireVictoryConfetti = () => {
  const end = Date.now() + 3000;
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const fireDamageParticles = (el: HTMLElement | null, dmg: number) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  
  // Flash rojo en toda la pantalla - más largo
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9997;background:radial-gradient(circle at ${cx}px ${cy}px, rgba(239,68,68,0.7) 0%, rgba(239,68,68,0.4) 30%, transparent 70%);animation:boss-damage-flash 0.8s ease-out forwards;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
  
  // Número de daño grande y dramático - más largo
  const txt = document.createElement('div');
  txt.textContent = `-${dmg}`;
  txt.style.cssText = `position:fixed;left:${cx}px;top:${cy-40}px;font-size:80px;font-weight:900;color:#fff;text-shadow:0 0 10px #ef4444, 0 0 20px #ef4444, 0 0 40px #ef4444, 0 4px 0 #b91c1c;pointer-events:none;z-index:9999;animation:dmg-float 2s ease-out forwards;font-family:system-ui,-apple-system,sans-serif;`;
  document.body.appendChild(txt);
  setTimeout(() => txt.remove(), 2000);
  
  // Texto "¡DAÑO CRÍTICO!" arriba del número - más largo
  const label = document.createElement('div');
  label.textContent = '⚔️ ¡DAÑO! ⚔️';
  label.style.cssText = `position:fixed;left:${cx}px;top:${cy-110}px;font-size:28px;font-weight:900;color:#fbbf24;text-shadow:0 0 10px #f59e0b, 0 0 20px #f59e0b;pointer-events:none;z-index:9999;animation:dmg-label 1.5s ease-out forwards;transform:translateX(-50%);letter-spacing:3px;`;
  document.body.appendChild(label);
  setTimeout(() => label.remove(), 1500);
  
  // Más partículas y más grandes - más largas
  const syms = ['⚔️', '💥', '✨', '🔥', '💫', '⭐', '💢', '🗡️'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    const a = (Math.PI * 2 * i) / 16, d = 120 + Math.random() * 100;
    p.textContent = syms[Math.floor(Math.random() * syms.length)];
    p.style.cssText = `position:fixed;font-size:${36 + Math.random() * 20}px;pointer-events:none;z-index:9999;left:${cx}px;top:${cy}px;animation:particle-burst 1.2s ease-out forwards;--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
  
  // Ondas de impacto - más largas
  for (let i = 0; i < 4; i++) {
    const wave = document.createElement('div');
    wave.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:50px;height:50px;border:5px solid rgba(239,68,68,0.9);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);animation:impact-wave 1.2s ease-out forwards;animation-delay:${i * 0.15}s;`;
    document.body.appendChild(wave);
    setTimeout(() => wave.remove(), 1500);
  }
};

const fireStudentDamage = () => {
  // Flash rojo de pantalla completa
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9998;background:radial-gradient(circle,rgba(239,68,68,0.6) 0%,rgba(239,68,68,0.8) 100%);animation:student-damage-flash 0.8s ease-out forwards;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
  
  // Texto de daño en el centro
  const txt = document.createElement('div');
  txt.innerHTML = '💔 ¡DAÑO RECIBIDO! 💔';
  txt.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:48px;font-weight:900;color:#fff;text-shadow:0 0 20px #ef4444, 0 0 40px #ef4444;pointer-events:none;z-index:9999;animation:student-damage-text 1.5s ease-out forwards;white-space:nowrap;`;
  document.body.appendChild(txt);
  setTimeout(() => txt.remove(), 1500);
  
  // Corazones rotos cayendo
  const hearts = ['💔', '❤️‍🩹', '🩸', '😵', '⚡'];
  for (let i = 0; i < 12; i++) {
    const h = document.createElement('div');
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    const startX = Math.random() * window.innerWidth;
    h.style.cssText = `position:fixed;left:${startX}px;top:-50px;font-size:${40 + Math.random() * 30}px;pointer-events:none;z-index:9999;animation:heart-fall 2s ease-in forwards;--endX:${startX + (Math.random() - 0.5) * 200}px;`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 2000);
  }
  
  // Borde rojo pulsante
  const border = document.createElement('div');
  border.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9997;border:8px solid transparent;animation:damage-border 1s ease-out forwards;`;
  document.body.appendChild(border);
  setTimeout(() => border.remove(), 1000);
};

if (typeof document !== 'undefined' && !document.getElementById('battle-styles')) {
  const s = document.createElement('style');
  s.id = 'battle-styles';
  s.textContent = `
    @keyframes dmg-float{0%{transform:translate(-50%,0)scale(0.3);opacity:0}10%{transform:translate(-50%,-30px)scale(1.4);opacity:1}25%{transform:translate(-50%,-50px)scale(1.1);opacity:1}50%{transform:translate(-50%,-60px)scale(1);opacity:1}100%{transform:translate(-50%,-150px)scale(0.5);opacity:0}}
    @keyframes dmg-label{0%{transform:translateX(-50%) scale(0);opacity:0}15%{transform:translateX(-50%) scale(1.3);opacity:1}35%{transform:translateX(-50%) scale(1);opacity:1}70%{transform:translateX(-50%) scale(1);opacity:1}100%{transform:translateX(-50%) translateY(-40px);opacity:0}}
    @keyframes particle-burst{0%{transform:translate(-50%,-50%)scale(0);opacity:1}50%{opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty)))scale(2);opacity:0}}
    @keyframes damage-flash{0%{opacity:1}100%{opacity:0}}
    @keyframes boss-damage-flash{0%{opacity:1}50%{opacity:0.8}100%{opacity:0}}
    @keyframes impact-wave{0%{width:50px;height:50px;opacity:1;border-width:5px}50%{opacity:0.8}100%{width:400px;height:400px;opacity:0;border-width:2px}}
    @keyframes boss-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes glow-pulse{0%,100%{box-shadow:0 0 20px rgba(239,68,68,.5)}50%{box-shadow:0 0 40px rgba(239,68,68,.8)}}
    @keyframes student-damage-flash{0%{opacity:0}10%{opacity:1}30%{opacity:0.7}50%{opacity:1}100%{opacity:0}}
    @keyframes student-damage-text{0%{transform:translate(-50%,-50%) scale(0);opacity:0}15%{transform:translate(-50%,-50%) scale(1.3);opacity:1}30%{transform:translate(-50%,-50%) scale(1);opacity:1}70%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(0.8);opacity:0}}
    @keyframes heart-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(${window.innerHeight + 100}px) rotate(720deg);opacity:0}}
    @keyframes damage-border{0%{border-color:rgba(239,68,68,0)}20%{border-color:rgba(239,68,68,1)}40%{border-color:rgba(239,68,68,0.5)}60%{border-color:rgba(239,68,68,1)}100%{border-color:rgba(239,68,68,0)}}
  `;
  document.head.appendChild(s);
}

const safeJsonParse = (v: any): any => {
  if (v == null || typeof v !== 'string') return v ?? null;
  try { let p = JSON.parse(v); while (typeof p === 'string') try { p = JSON.parse(p); } catch { break; } return p; } catch { return v; }
};

type UserSelection = number | number[] | null;
interface Props { bossId: string; classroom: any; onBack: () => void; }

export const BossBattleLive = ({ bossId, onBack }: Props) => {
  const qc = useQueryClient();
  const [qIdx, setQIdx] = useState(0);
  const [showQ, setShowQ] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRes, setShowRes] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const bossRef = useRef<HTMLDivElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const damageBoss1Ref = useRef<HTMLAudioElement | null>(null);
  const damageBoss2Ref = useRef<HTMLAudioElement | null>(null);
  const damageStudentRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar audio
  useEffect(() => {
    bgMusicRef.current = new Audio('/sounds/boss_music1.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.4;
    damageBoss1Ref.current = new Audio('/sounds/damage_boss1.mp3');
    damageBoss1Ref.current.volume = 0.7;
    damageBoss2Ref.current = new Audio('/sounds/damage_boss2.mp3');
    damageBoss2Ref.current.volume = 0.7;
    damageStudentRef.current = new Audio('/sounds/damage_student.mp3');
    damageStudentRef.current.volume = 0.7;

    // Iniciar música de fondo
    bgMusicRef.current.play().catch(() => {});

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  // Manejar mute/unmute
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // Función para reproducir SFX de daño al boss (random)
  const playBossDamageSfx = useCallback(() => {
    if (isMuted) return;
    const sfx = Math.random() < 0.5 ? damageBoss1Ref.current : damageBoss2Ref.current;
    if (sfx) {
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }
  }, [isMuted]);

  // Función para reproducir SFX de daño al estudiante
  const playStudentDamageSfx = useCallback(() => {
    if (isMuted) return;
    if (damageStudentRef.current) {
      damageStudentRef.current.currentTime = 0;
      damageStudentRef.current.play().catch(() => {});
    }
  }, [isMuted]);

  const { data: bs, refetch } = useQuery({ queryKey: ['battle-state', bossId], queryFn: () => battleApi.getBattleState(bossId), refetchInterval: showQ ? 2000 : false });
  const { data: results } = useQuery({ queryKey: ['battle-results', bossId], queryFn: () => battleApi.getBattleResults(bossId), enabled: showRes });
  const endMut = useMutation({
    mutationFn: (st: 'VICTORY' | 'DEFEAT' | 'COMPLETED') => battleApi.endBattle(bossId, st),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['battle-state', bossId] }); setShowRes(true); if (d?.status === 'VICTORY') fireVictoryConfetti(); },
  });

  useEffect(() => { if (!showQ || timeLeft <= 0) return; const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [showQ, timeLeft]);

  const handleDmg = (dmg: number, hasWrong: boolean) => {
    if (dmg > 0) { 
      setShaking(true); 
      fireDamageParticles(bossRef.current, dmg); 
      playBossDamageSfx();
      setTimeout(() => setShaking(false), 500); 
    }
    if (hasWrong) {
      fireStudentDamage();
      playStudentDamageSfx();
    }
    refetch().then(() => { if (bs && bs.currentHp - dmg <= 0) { setShowRes(true); fireVictoryConfetti(); } });
  };

  const startQ = () => { if (!bs?.questions[qIdx]) return; setTimeLeft(bs.questions[qIdx].timeLimit); setShowQ(true); };
  const nextQ = () => { if (qIdx < (bs?.questions.length || 0) - 1) { setQIdx(p => p + 1); setShowQ(false); } else if (bs && bs.currentHp > 0) endMut.mutate('DEFEAT'); };

  if (!bs) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full" /></div>;
  if (showRes) return <BattleResultsView battleState={bs} results={results || []} onBack={onBack} />;

  const curQ = bs.questions[qIdx];
  const hpPct = Math.round((bs.currentHp / bs.bossHp) * 100);
  const critical = hpPct <= 25;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -m-6 p-4 overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-3">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white"><ArrowLeft size={18} /><span className="text-sm">Salir</span></button>
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <Swords size={16} className="text-amber-400" /><span className="text-white font-bold">Pregunta {qIdx + 1}/{bs.questions.length}</span>
        </motion.div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2"><Users size={14} className="text-purple-400" /><span className="text-white text-sm">{bs.participants.length}</span></div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-full backdrop-blur-sm transition-all ${
              isMuted 
                ? 'bg-red-500/30 text-red-300' 
                : 'bg-emerald-500/30 text-emerald-300'
            }`}
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </motion.button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="relative z-10 flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)]">
        {/* Left: Boss Panel */}
        <div className="lg:w-[450px] flex-shrink-0 bg-slate-900/60 rounded-2xl p-6 flex flex-col">
          {/* Boss - Centered and Large */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div ref={bossRef} animate={shaking ? { x: [-15, 15, -15, 15, 0] } : {}} transition={{ duration: 0.4 }} className="relative" style={{ animation: !shaking ? 'boss-idle 3s ease-in-out infinite' : 'none' }}>
              <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className={`absolute inset-0 -m-16 rounded-full blur-3xl ${critical ? 'bg-red-500/50' : 'bg-orange-500/40'}`} />
              <div className="relative w-64 h-64 lg:w-80 lg:h-80 rounded-full overflow-hidden shadow-2xl" style={{ animation: 'glow-pulse 2s ease-in-out infinite' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-600" />
                {bs.bossImageUrl ? <img src={bs.bossImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-110" /> : <div className="absolute inset-0 flex items-center justify-center"><span className="text-[120px] lg:text-[160px]">🐉</span></div>}
                {critical && <motion.div animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="absolute inset-0 bg-red-500" />}
              </div>
              {critical && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-3 -right-3 bg-red-500 rounded-full p-2 shadow-lg"><Flame size={20} className="text-white" /></motion.div>}
            </motion.div>
            <h2 className="text-white font-black text-2xl lg:text-3xl mt-4 drop-shadow-lg text-center">{bs.bossName}</h2>
            {/* HP Bar */}
            <div className="w-full max-w-[300px] mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70 flex items-center gap-1"><Heart size={14} className={critical ? 'text-red-400 animate-pulse' : 'text-red-400'} /> HP</span>
                <span className={`font-bold text-lg ${critical ? 'text-red-400' : 'text-white'}`}>{bs.currentHp}/{bs.bossHp}</span>
              </div>
              <div className="h-5 bg-black/50 rounded-full overflow-hidden border-2 border-white/20">
                <motion.div animate={{ width: `${hpPct}%` }} transition={{ duration: 0.5 }} className={`h-full rounded-full ${hpPct > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : hpPct > 25 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`} />
              </div>
            </div>
          </div>
          
          {/* Heroes Section - Bottom of left panel, scrollable for many students */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-purple-400" />
              <span className="text-white font-medium text-sm">Héroes en batalla ({bs.participants.length})</span>
            </div>
            <div className="max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-500/50">
              <div className="grid grid-cols-3 gap-2">
                {bs.participants.map((p: any, i: number) => {
                  const hpPercent = p.maxHp > 0 ? Math.round((p.currentHp / p.maxHp) * 100) : 100;
                  const isKO = p.currentHp <= 0;
                  const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';
                  
                  return (
                    <motion.div 
                      key={p.id} 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      className={`relative rounded-xl p-2 flex flex-col items-center border transition-all ${
                        isKO 
                          ? 'bg-gray-800/50 border-gray-600/50 opacity-60' 
                          : 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border-white/10 hover:border-purple-400/50'
                      }`}
                      title={`${p.characterName}: ${p.totalDamage} daño | HP: ${p.currentHp}/${p.maxHp}`}
                    >
                      {isKO && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl z-10">
                          <span className="text-red-400 text-xs font-bold">💀 K.O.</span>
                        </div>
                      )}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                        isKO ? 'bg-gray-600' : 'bg-gradient-to-br from-purple-400 to-indigo-500'
                      }`}>
                        {p.characterName?.[0] || '?'}
                      </div>
                      <span className="text-white/90 text-[11px] font-medium mt-1 truncate w-full text-center">
                        {p.characterName?.split(' ')[0] || '?'}
                      </span>
                      
                      {/* HP Bar */}
                      <div className="w-full mt-1.5">
                        <div className="flex items-center justify-between text-[9px] mb-0.5">
                          <span className="text-red-400 flex items-center gap-0.5">
                            <Heart size={8} />
                            HP
                          </span>
                          <span className={isKO ? 'text-red-400' : 'text-white/70'}>
                            {p.currentHp}/{p.maxHp}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${hpColor} rounded-full`}
                            initial={{ width: '100%' }}
                            animate={{ width: `${hpPercent}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                      
                      {/* Damage dealt */}
                      <div className="flex items-center gap-1 mt-1 text-amber-400">
                        <Zap size={10} />
                        <span className="text-[10px] font-bold">{p.totalDamage}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Question Panel */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <AnimatePresence mode="wait">
            {!showQ ? (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-2xl px-4">
                {curQ ? (
                  <div className="relative">
                    {/* Fondo decorativo */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-orange-600/20 rounded-3xl blur-xl" />
                    
                    <div className="relative bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/40 shadow-2xl">
                      {/* Header con número de pregunta */}
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <motion.div 
                          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} 
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-500/30"
                        >
                          <Swords size={32} className="text-white" />
                        </motion.div>
                      </div>
                      
                      {/* Título de la pregunta */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-center mb-6"
                      >
                        <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Pregunta {qIdx + 1}</span>
                        <h3 className="text-white text-2xl font-bold mt-2 leading-relaxed">{curQ.question}</h3>
                      </motion.div>
                      
                      {/* Imagen si existe */}
                      {curQ.imageUrl && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mb-6"
                        >
                          <img src={curQ.imageUrl} alt="" className="max-h-40 mx-auto rounded-2xl shadow-lg border border-white/10" />
                        </motion.div>
                      )}
                      
                      {/* Stats de la pregunta */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex justify-center gap-4 mb-8"
                      >
                        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl px-5 py-3 border border-amber-500/30">
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                            <Zap size={20} className="text-amber-400" />
                          </motion.div>
                          <div className="text-left">
                            <span className="text-amber-300 font-black text-lg">{curQ.damage}</span>
                            <span className="text-amber-400/70 text-sm ml-1">daño</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl px-5 py-3 border border-blue-500/30">
                          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                            <Clock size={20} className="text-blue-400" />
                          </motion.div>
                          <div className="text-left">
                            <span className="text-blue-300 font-black text-lg">{curQ.timeLimit}</span>
                            <span className="text-blue-400/70 text-sm ml-1">segundos</span>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Botón de iniciar */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-center"
                      >
                        <motion.button
                          onClick={startQ}
                          whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(168, 85, 247, 0.4)' }}
                          whileTap={{ scale: 0.97 }}
                          className="relative overflow-hidden bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white text-xl font-bold px-10 py-4 rounded-2xl shadow-xl shadow-purple-500/30 flex items-center gap-3 mx-auto"
                        >
                          <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Swords size={24} />
                          </motion.div>
                          ¡Iniciar Ataque!
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        </motion.button>
                        <p className="text-white/40 text-sm mt-3">Los estudiantes verán la pregunta cuando inicies</p>
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl p-8 border border-purple-500/30 shadow-2xl text-center">
                    <motion.div 
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-6xl mb-4"
                    >
                      ⚔️
                    </motion.div>
                    <h3 className="text-white text-xl font-bold mb-2">¡Batalla completada!</h3>
                    <p className="text-white/60 mb-6">No hay más preguntas disponibles</p>
                    <Button onClick={() => endMut.mutate('DEFEAT')} className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-3 shadow-lg">
                      Finalizar Batalla
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="question" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-2xl">
                <QuestionDisplay question={curQ!} timeLeft={timeLeft} participants={bs.participants} bossId={bossId} onDamageDealt={handleDmg} onNextQuestion={() => { setShowQ(false); nextQ(); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Question Display Component
const QuestionDisplay = ({ question, timeLeft, participants, bossId, onDamageDealt, onNextQuestion }: { question: BattleQuestion; timeLeft: number; participants: any[]; bossId: string; onDamageDealt: (d: number, w: boolean) => void; onNextQuestion: () => void; }) => {
  const qc = useQueryClient();
  const [showAns, setShowAns] = useState(false);
  const [correct, setCorrect] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);
  const [sel, setSel] = useState<UserSelection>(null);
  const [expired, setExpired] = useState(false);
  const [shuffled] = useState<MatchingPair[]>(() => ([...(safeJsonParse(question.pairs) || [])].sort(() => Math.random() - 0.5)));

  const pct = (timeLeft / question.timeLimit) * 100;
  const qType = (question.battleQuestionType || 'SINGLE_CHOICE') as BattleQuestionType;
  const penalty = question.hpPenalty || 0;
  const wrong = participants.filter(p => !correct.has(p.studentId));
  const urgent = timeLeft <= 5;

  useEffect(() => { if (timeLeft === 0 && !showAns && !expired) { setExpired(true); setShowAns(true); toast.error('¡Tiempo agotado!', { icon: '⏰' }); } }, [timeLeft, showAns, expired]);

  const handleSel = (i: number) => { if (showAns) return; if (qType === 'MULTIPLE_CHOICE') setSel(p => { const c = Array.isArray(p) ? p : []; return c.includes(i) ? c.filter(x => x !== i) : [...c, i]; }); else setSel(i); };

  const applyMut = useMutation({
    mutationFn: async (d: { c: string[]; w: string[]; bd: number; hd: number }) => { const t = d.c.length * d.bd; await battleApi.applyManualDamage(bossId, t, d.c, { wrongStudentIds: d.w, hpDamage: d.hd }); return { t, wc: d.w.length, hd: d.hd }; },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['battle-state', bossId] }); onDamageDealt(r.t, r.wc > 0 && r.hd > 0); setApplied(true); if (r.t > 0) toast.success(`¡${r.t} de daño!`, { icon: '⚔️' }); },
    onError: () => toast.error('Error'),
  });

  const toggle = (id: string) => { if (applied) return; setCorrect(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); };
  const apply = () => applyMut.mutate({ c: Array.from(correct), w: wrong.map(p => p.studentId), bd: question.damage, hd: penalty });
  const getCorrectTxt = () => { if (qType === 'TRUE_FALSE') return question.correctIndex === 0 ? 'Verdadero' : 'Falso'; if (qType === 'MULTIPLE_CHOICE') return (safeJsonParse(question.correctIndices) || []).map((i: number) => String.fromCharCode(65 + i)).join(', '); if (qType === 'MATCHING') return 'Ver arriba'; return String.fromCharCode(65 + question.correctIndex); };

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-5 border border-purple-500/30 shadow-2xl">
      {/* Timer */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/70 flex items-center gap-2 text-sm"><Clock size={14} className={urgent ? 'text-red-400 animate-pulse' : 'text-blue-400'} /> Tiempo</span>
          <motion.span animate={urgent ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }} className={`font-black text-2xl ${urgent ? 'text-red-400' : 'text-white'}`}>{timeLeft}s</motion.span>
        </div>
        <div className="h-3 bg-black/50 rounded-full overflow-hidden border border-white/20">
          <motion.div animate={{ width: `${pct}%` }} className={`h-full rounded-full ${pct > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : pct > 25 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`} />
        </div>
      </div>
      {/* Question */}
      <div className="text-center mb-4"><h3 className="text-white font-bold">{question.question}</h3>{question.imageUrl && <img src={question.imageUrl} alt="" className="max-h-24 mx-auto rounded-xl mt-2" />}</div>
      {/* Options */}
      <div className="mb-4">{renderOpts(question, showAns, sel, handleSel, shuffled, qType)}</div>
      {/* Actions */}
      {!showAns ? (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}><Button onClick={() => setShowAns(true)} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 py-3 shadow-lg"><Sparkles size={16} className="mr-2" />Revelar Respuesta</Button></motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {expired && <div className="text-center py-2 bg-red-500/20 rounded-lg border border-red-500/30"><span className="text-red-400 font-bold">⏰ Tiempo agotado</span></div>}
          {qType !== 'MATCHING' && <div className="text-center py-2 bg-green-500/20 rounded-lg border border-green-500/30"><span className="text-green-400 font-bold">✓ Correcta: {getCorrectTxt()}</span></div>}
          {!applied && (
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2"><span className="text-green-400 text-sm font-bold flex items-center gap-1"><Check size={12} /> Acertaron</span><div className="flex gap-2 text-xs"><button onClick={() => setCorrect(new Set(participants.map(p => p.studentId)))} className="text-green-400">Todos</button><span className="text-white/30">|</span><button onClick={() => setCorrect(new Set())} className="text-red-400">Ninguno</button></div></div>
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">{participants.map(p => (<motion.button key={p.id} whileTap={{ scale: 0.95 }} onClick={() => toggle(p.studentId)} className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${correct.has(p.studentId) ? 'bg-green-500 text-white' : 'bg-white/10 text-white/70'}`}>{correct.has(p.studentId) ? <Check size={10} /> : <X size={10} />}{p.characterName?.split(' ')[0]}</motion.button>))}</div>
                {correct.size > 0 && <div className="mt-2 text-green-400 text-sm flex items-center gap-1"><Swords size={12} /> {correct.size} × {question.damage} = <span className="font-bold">{correct.size * question.damage}</span> daño</div>}
              </div>
              {wrong.length > 0 && penalty > 0 && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3"><div className="text-red-400 text-sm font-bold mb-1 flex items-center gap-1"><Heart size={12} /> Fallaron: -{penalty} HP</div><div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto">{wrong.map(p => <span key={p.id} className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-xs">{p.characterName?.split(' ')[0]}</span>)}</div></div>}
              <div className="flex gap-3"><motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Button onClick={apply} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-3 shadow-lg" isLoading={applyMut.isPending} leftIcon={<Zap size={14} />}>¡Aplicar Daño!</Button></motion.div><Button onClick={onNextQuestion} variant="secondary" className="px-4" rightIcon={<ChevronRight size={14} />}>Saltar</Button></div>
            </>
          )}
          {applied && <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} whileHover={{ scale: 1.02 }}><Button onClick={onNextQuestion} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-3 shadow-lg" rightIcon={<ChevronRight size={16} />}>Siguiente Pregunta</Button></motion.div>}
        </motion.div>
      )}
    </div>
  );
};

// Matching Question Component - Con líneas interactivas
const MatchingQuestion = ({ pairs, shuffled, showAnswer }: { pairs: MatchingPair[]; shuffled: MatchingPair[]; showAnswer: boolean }) => {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleLeftClick = (index: number) => {
    if (showAnswer) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  };
  
  const handleRightClick = (rightIndex: number) => {
    if (showAnswer || selectedLeft === null) return;
    
    // Crear conexión
    const newConnections = new Map(connections);
    // Remover conexión previa de este lado izquierdo si existe
    newConnections.set(selectedLeft, rightIndex);
    setConnections(newConnections);
    setSelectedLeft(null);
  };
  
  const removeConnection = (leftIndex: number) => {
    if (showAnswer) return;
    const newConnections = new Map(connections);
    newConnections.delete(leftIndex);
    setConnections(newConnections);
  };
  
  // Verificar si una conexión es correcta
  const isConnectionCorrect = (leftIndex: number, rightIndex: number) => {
    const leftItem = pairs[leftIndex];
    const rightItem = shuffled[rightIndex];
    return leftItem && rightItem && leftItem.right === rightItem.right;
  };
  
  // Obtener el índice correcto del lado derecho para un lado izquierdo
  const getCorrectRightIndex = (leftIndex: number) => {
    const leftItem = pairs[leftIndex];
    return shuffled.findIndex(s => s.right === leftItem.right);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="grid grid-cols-2 gap-8">
        {/* Columna izquierda */}
        <div className="space-y-3">
          {pairs.map((p, i) => {
            const isSelected = selectedLeft === i;
            const hasConnection = connections.has(i);
            const connectedTo = connections.get(i);
            
            return (
              <motion.div
                key={i}
                whileHover={!showAnswer ? { scale: 1.02 } : {}}
                whileTap={!showAnswer ? { scale: 0.98 } : {}}
                onClick={() => hasConnection ? removeConnection(i) : handleLeftClick(i)}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                  showAnswer 
                    ? 'bg-blue-500/30 border-2 border-blue-400'
                    : isSelected 
                      ? 'bg-purple-500/40 border-2 border-purple-400 ring-2 ring-purple-400/50' 
                      : hasConnection
                        ? 'bg-green-500/20 border-2 border-green-400'
                        : 'bg-white/10 border-2 border-transparent hover:border-purple-400/50'
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                  {i + 1}
                </span>
                <span className="text-white text-sm flex-1">{p.left}</span>
                {hasConnection && !showAnswer && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-400 text-xs font-bold"
                  >
                    → {String.fromCharCode(97 + connectedTo!)}
                  </motion.span>
                )}
                {showAnswer && (
                  <span className="text-blue-300 text-xs font-bold">
                    → {String.fromCharCode(97 + getCorrectRightIndex(i))}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
        
        {/* Columna derecha */}
        <div className="space-y-3">
          {shuffled.map((p, i) => {
            const isConnectedFrom = Array.from(connections.entries()).find(([_, v]) => v === i);
            const isCorrectConnection = isConnectedFrom && isConnectionCorrect(isConnectedFrom[0], i);
            
            return (
              <motion.div
                key={i}
                whileHover={!showAnswer && selectedLeft !== null ? { scale: 1.02 } : {}}
                whileTap={!showAnswer && selectedLeft !== null ? { scale: 0.98 } : {}}
                onClick={() => handleRightClick(i)}
                className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                  showAnswer
                    ? 'bg-green-500/30 border-2 border-green-400'
                    : selectedLeft !== null
                      ? 'bg-white/10 border-2 border-transparent hover:border-orange-400 cursor-pointer'
                      : isConnectedFrom
                        ? isCorrectConnection 
                          ? 'bg-green-500/20 border-2 border-green-400'
                          : 'bg-orange-500/20 border-2 border-orange-400'
                        : 'bg-white/10 border-2 border-transparent'
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                  {String.fromCharCode(97 + i)}
                </span>
                <span className="text-white text-sm flex-1">{p.right}</span>
                {isConnectedFrom && !showAnswer && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-400 text-xs font-bold"
                  >
                    ← {isConnectedFrom[0] + 1}
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Instrucciones */}
      {!showAnswer && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center"
        >
          {selectedLeft !== null ? (
            <p className="text-purple-300 text-sm animate-pulse">
              👆 Ahora selecciona la opción correcta de la derecha
            </p>
          ) : connections.size < pairs.length ? (
            <p className="text-white/50 text-sm">
              👈 Selecciona un elemento de la izquierda para unir
            </p>
          ) : (
            <p className="text-green-400 text-sm font-medium">
              ✓ Todas las conexiones realizadas
            </p>
          )}
        </motion.div>
      )}
      
      {/* Mostrar respuestas correctas */}
      {showAnswer && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-green-500/20 rounded-xl border border-green-500/30"
        >
          <p className="text-green-400 text-sm font-bold text-center mb-2">✓ Respuestas correctas:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {pairs.map((_p, i) => (
              <span key={i} className="text-white/80 text-xs bg-white/10 px-2 py-1 rounded">
                {i + 1} → {String.fromCharCode(97 + getCorrectRightIndex(i))}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Render Options
const renderOpts = (q: BattleQuestion, show: boolean, sel: UserSelection, onSel: (i: number) => void, shuffled: MatchingPair[], qType: BattleQuestionType) => {
  const opts = Array.isArray(q.options) ? q.options : [];
  const ci = safeJsonParse(q.correctIndices) || [];
  const pairs = safeJsonParse(q.pairs) || [];
  const getStyle = (i: number, isC: boolean) => { const isSel = Array.isArray(sel) ? sel.includes(i) : sel === i; if (show) { if (isC) return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-2 ring-green-300'; if (isSel) return 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-300'; return 'bg-white/10 text-white/60'; } return isSel ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-300' : 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'; };
  if (qType === 'TRUE_FALSE') return <div className="grid grid-cols-2 gap-3">{['Verdadero', 'Falso'].map((o, i) => <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.03 } : {}} whileTap={!show ? { scale: 0.97 } : {}} className={`p-4 rounded-xl font-bold text-lg transition-all ${getStyle(i, q.correctIndex === i)}`}>{i === 0 ? '✓' : '✗'} {o}</motion.button>)}</div>;
  if (qType === 'MATCHING' && pairs.length > 0) return <MatchingQuestion pairs={pairs} shuffled={shuffled} showAnswer={show} />;
  if (qType === 'MULTIPLE_CHOICE') { const sa = Array.isArray(sel) ? sel : []; return <div className="grid grid-cols-2 gap-2">{opts.map((o: string, i: number) => { const isC = ci.includes(i), isSel = sa.includes(i); let st = 'bg-white/10 text-white'; if (show) { if (isC) st = 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-2 ring-green-300'; else if (isSel) st = 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-300'; } else if (isSel) st = 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-300'; else st = 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'; return <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.02 } : {}} className={`p-3 rounded-xl text-sm font-medium transition-all ${st}`}><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{o}{show && isC && ' ✓'}{show && !isC && isSel && ' ✗'}</motion.button>; })}</div>; }
  return <div className="grid grid-cols-2 gap-2">{opts.map((o: string, i: number) => <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.02 } : {}} className={`p-3 rounded-xl text-sm font-medium transition-all ${getStyle(i, i === q.correctIndex)}`}><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{o}{show && i === q.correctIndex && ' ✓'}{show && i !== q.correctIndex && sel === i && ' ✗'}</motion.button>)}</div>;
};

// Results View - Animación tipo Kahoot
const BattleResultsView = ({ battleState, results, onBack }: { battleState: BattleState; results: BattleResult[]; onBack: () => void }) => {
  const [phase, setPhase] = useState<'intro' | 'podium' | 'table'>('intro');
  const [revealedPlaces, setRevealedPlaces] = useState<number[]>([]);
  const vic = battleState.status === 'VICTORY';
  
  // Obtener top 3
  const top3 = results.slice(0, 3);
  const hasTop3 = top3.length >= 3;
  
  // Secuencia de animación tipo Kahoot
  useEffect(() => {
    if (phase === 'intro') {
      // Mostrar intro por 2 segundos, luego ir al podio
      const timer = setTimeout(() => {
        if (hasTop3) {
          setPhase('podium');
        } else {
          setPhase('table');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, hasTop3]);
  
  useEffect(() => {
    if (phase === 'podium' && hasTop3) {
      // Revelar 3°, luego 2°, luego 1° con delays
      const timers: ReturnType<typeof setTimeout>[] = [];
      timers.push(setTimeout(() => setRevealedPlaces([3]), 800));
      timers.push(setTimeout(() => setRevealedPlaces([3, 2]), 2300));
      timers.push(setTimeout(() => {
        setRevealedPlaces([3, 2, 1]);
        fireVictoryConfetti();
      }, 3800));
      timers.push(setTimeout(() => setPhase('table'), 6000));
      return () => timers.forEach(clearTimeout);
    }
  }, [phase, hasTop3]);

  // Fase de introducción
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -m-6 p-6 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0, rotate: -180 }} 
          animate={{ scale: 1, rotate: 0 }} 
          transition={{ type: 'spring', damping: 12, duration: 0.8 }}
          className="text-center"
        >
          <motion.div 
            animate={{ 
              rotate: vic ? [0, 10, -10, 0] : [0, 5, -5, 0], 
              y: [0, -15, 0],
              scale: [1, 1.1, 1]
            }} 
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[120px] mb-4"
          >
            {vic ? '🏆' : '💀'}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-6xl font-black mb-3 ${vic ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500' : 'text-red-400'}`}
          >
            {vic ? '¡VICTORIA!' : 'DERROTA'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/70 text-xl"
          >
            {vic ? `¡Derrotaron a ${battleState.bossName}!` : `${battleState.bossName} escapó...`}
          </motion.p>
          {hasTop3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1] }}
              transition={{ delay: 1.5, duration: 1 }}
              className="text-purple-400 mt-6 text-lg font-medium"
            >
              Preparando el podio...
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  // Fase del podio (tipo Kahoot)
  if (phase === 'podium' && hasTop3) {
    const podiumConfig = [
      { place: 2, height: 'h-32', color: 'from-gray-400 to-gray-500', bgColor: 'bg-gray-500/20', delay: 1, emoji: '🥈' },
      { place: 1, height: 'h-44', color: 'from-amber-400 to-yellow-500', bgColor: 'bg-amber-500/20', delay: 2, emoji: '🥇' },
      { place: 3, height: 'h-24', color: 'from-orange-500 to-orange-600', bgColor: 'bg-orange-500/20', delay: 0, emoji: '🥉' },
    ];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -m-6 p-6 flex flex-col items-center justify-center overflow-hidden">
        {/* Título */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-black text-white mb-2">🏆 Top 3 Héroes 🏆</h1>
          <p className="text-white/60">Los mejores guerreros de la batalla</p>
        </motion.div>
        
        {/* Podio */}
        <div className="flex items-end justify-center gap-4 mb-8">
          {podiumConfig.map((config, idx) => {
            const result = top3[config.place - 1];
            const isRevealed = revealedPlaces.includes(config.place);
            const order = idx === 0 ? 'order-1' : idx === 1 ? 'order-2' : 'order-3';
            
            return (
              <div key={config.place} className={`flex flex-col items-center ${order}`}>
                {/* Avatar y nombre */}
                <AnimatePresence>
                  {isRevealed && result && (
                    <motion.div
                      initial={{ opacity: 0, y: -100, scale: 0 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                      className="text-center mb-3"
                    >
                      <motion.div
                        animate={config.place === 1 ? { 
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative"
                      >
                        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-white text-3xl font-black shadow-2xl border-4 border-white/30`}>
                          {result.characterName?.[0] || '?'}
                        </div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5, type: 'spring' }}
                          className="absolute -top-2 -right-2 text-3xl"
                        >
                          {config.emoji}
                        </motion.div>
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-white font-bold mt-2 text-lg max-w-[120px] truncate"
                      >
                        {result.characterName}
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center justify-center gap-1 text-amber-400"
                      >
                        <Zap size={14} />
                        <span className="font-bold">{result.damageDealt}</span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Pedestal */}
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={isRevealed ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={`w-28 ${config.height} bg-gradient-to-t ${config.color} rounded-t-xl flex items-center justify-center shadow-2xl border-2 border-white/20`}
                >
                  <span className="text-white text-5xl font-black drop-shadow-lg">{config.place}</span>
                </motion.div>
              </div>
            );
          })}
        </div>
        
        {/* Mensaje de espera */}
        {revealedPlaces.length < 3 && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-white/60 text-lg"
          >
            {revealedPlaces.length === 0 ? 'Y en tercer lugar...' : 
             revealedPlaces.length === 1 ? 'En segundo lugar...' : 
             '¡Y el primer lugar es...!'}
          </motion.p>
        )}
      </div>
    );
  }

  // Fase de tabla completa - Estadísticas de batalla
  const totalDamage = results.reduce((sum, r) => sum + r.damageDealt, 0);
  const totalXpEarned = results.reduce((sum, r) => sum + r.xpEarned, 0);
  const totalGpEarned = results.reduce((sum, r) => sum + r.gpEarned, 0);
  const topDamager = results[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -m-6 p-6 flex flex-col items-center justify-center overflow-y-auto">
      {/* Header con resultado épico */}
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="text-center mb-6"
      >
        <motion.div 
          animate={{ 
            rotate: vic ? [0, 5, -5, 0] : 0,
            scale: vic ? [1, 1.1, 1] : 1,
          }} 
          transition={{ duration: 2, repeat: Infinity }}
          className="text-8xl mb-4"
        >
          {vic ? '🏆' : '💀'}
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-5xl font-black mb-2 ${vic ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 drop-shadow-lg' : 'text-red-400'}`}
        >
          {vic ? '¡VICTORIA ÉPICA!' : 'DERROTA'}
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/80 text-lg"
        >
          {vic ? `¡Los héroes derrotaron a ${battleState.bossName}!` : `${battleState.bossName} escapó...`}
        </motion.p>
      </motion.div>

      {/* Stats de la batalla */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-2xl w-full"
      >
        <div className="bg-gradient-to-br from-purple-500/30 to-indigo-500/30 rounded-xl p-4 border border-purple-500/30 text-center">
          <Users className="mx-auto text-purple-400 mb-1" size={24} />
          <p className="text-2xl font-bold text-white">{results.length}</p>
          <p className="text-xs text-white/60">Héroes</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl p-4 border border-amber-500/30 text-center">
          <Zap className="mx-auto text-amber-400 mb-1" size={24} />
          <p className="text-2xl font-bold text-white">{totalDamage.toLocaleString()}</p>
          <p className="text-xs text-white/60">Daño Total</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl p-4 border border-blue-500/30 text-center">
          <Sparkles className="mx-auto text-blue-400 mb-1" size={24} />
          <p className="text-2xl font-bold text-white">{totalXpEarned.toLocaleString()}</p>
          <p className="text-xs text-white/60">XP Ganado</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/30 to-amber-500/30 rounded-xl p-4 border border-yellow-500/30 text-center">
          <Coins className="mx-auto text-yellow-400 mb-1" size={24} />
          <p className="text-2xl font-bold text-white">{totalGpEarned.toLocaleString()}</p>
          <p className="text-xs text-white/60">GP Ganado</p>
        </div>
      </motion.div>

      {/* MVP Card */}
      {topDamager && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-amber-500/20 via-yellow-500/20 to-orange-500/20 rounded-2xl p-5 border-2 border-amber-500/50 max-w-md w-full mb-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-dashed border-amber-400/50 rounded-full"
                />
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-amber-500/30">
                  {topDamager.characterName?.[0] || '?'}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center text-xs shadow-lg">
                  👑
                </div>
              </div>
              <div className="flex-1">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">⭐ MVP de la Batalla ⭐</p>
                <p className="text-white text-xl font-bold">{topDamager.characterName}</p>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-amber-400 flex items-center gap-1"><Zap size={14} />{topDamager.damageDealt}</span>
                  <span className="text-blue-400 flex items-center gap-1"><Sparkles size={14} />+{topDamager.xpEarned}</span>
                  <span className="text-yellow-400 flex items-center gap-1"><Coins size={14} />+{topDamager.gpEarned}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Tabla de resultados completa */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-5 border border-purple-500/30 max-w-lg w-full mb-4 max-h-[350px] overflow-y-auto"
      >
        <h2 className="text-white font-bold text-center mb-4 flex items-center justify-center gap-2">
          <Crown className="text-amber-400" size={20} /> Tabla de Héroes
        </h2>
        <div className="space-y-2">
          {results.map((r, i) => {
            const damagePercent = totalDamage > 0 ? Math.round((r.damageDealt / totalDamage) * 100) : 0;
            return (
              <motion.div 
                key={r.id} 
                initial={{ opacity: 0, x: -30 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.6 + i * 0.05 }}
                className={`relative p-3 rounded-xl transition-all overflow-hidden ${
                  i === 0 ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50' : 
                  i === 1 ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border border-gray-400/50' : 
                  i === 2 ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/50' : 
                  'bg-white/5 border border-white/10'
                }`}
              >
                {/* Progress bar background */}
                <div 
                  className={`absolute inset-0 opacity-20 ${
                    i === 0 ? 'bg-gradient-to-r from-amber-400 to-transparent' :
                    i === 1 ? 'bg-gradient-to-r from-gray-400 to-transparent' :
                    i === 2 ? 'bg-gradient-to-r from-orange-400 to-transparent' :
                    'bg-gradient-to-r from-purple-400 to-transparent'
                  }`}
                  style={{ width: `${damagePercent}%` }}
                />
                
                <div className="relative flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-500/30' : 
                    i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' : 
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' : 
                    'bg-white/20 text-white/70'
                  }`}>
                    {i + 1}
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                    i === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                    'bg-gradient-to-br from-purple-400 to-indigo-500'
                  }`}>
                    {r.characterName?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{r.characterName}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-amber-400 flex items-center gap-1">
                        <Zap size={10} /> {r.damageDealt}
                      </span>
                      <span className="text-white/40">|</span>
                      <span className="text-white/60">{damagePercent}% del daño</span>
                    </div>
                  </div>
                  <div className="text-right text-xs space-y-0.5">
                    <div className="text-blue-400 flex items-center gap-1 justify-end">
                      <Sparkles size={10} />+{r.xpEarned}
                    </div>
                    <div className="text-amber-400 flex items-center gap-1 justify-end">
                      <Coins size={10} />+{r.gpEarned}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {results.length === 0 && (
            <div className="text-center py-8 text-white/50">
              <Users size={40} className="mx-auto mb-2 opacity-50" />
              <p>No hay participantes</p>
            </div>
          )}
        </div>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }} 
        whileTap={{ scale: 0.95 }}
      >
        <Button onClick={onBack} className="bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg" leftIcon={<ArrowLeft size={16} />}>
          Volver
        </Button>
      </motion.div>
    </div>
  );
};
