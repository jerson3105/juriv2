import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Swords, Zap, Clock, ChevronRight, Users, Sparkles, Coins, Crown, Target, Check, X, Shield, Flame } from 'lucide-react';
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
  const txt = document.createElement('div');
  txt.textContent = `-${dmg}`;
  txt.style.cssText = `position:fixed;left:${cx}px;top:${cy-20}px;font-size:48px;font-weight:900;color:#ef4444;text-shadow:0 0 20px #ef4444;pointer-events:none;z-index:9999;animation:dmg-float 1s ease-out forwards;`;
  document.body.appendChild(txt);
  setTimeout(() => txt.remove(), 1000);
  const syms = ['⚔️', '💥', '✨', '🔥', '💫'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    const a = (Math.PI * 2 * i) / 8, d = 70 + Math.random() * 50;
    p.textContent = syms[Math.floor(Math.random() * syms.length)];
    p.style.cssText = `position:fixed;font-size:24px;pointer-events:none;z-index:9999;left:${cx}px;top:${cy}px;animation:particle-burst 0.6s ease-out forwards;--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 600);
  }
};

const fireStudentDamage = () => {
  const o = document.createElement('div');
  o.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9998;background:radial-gradient(circle,transparent 20%,rgba(239,68,68,0.4) 100%);animation:damage-flash 0.4s ease-out forwards;`;
  document.body.appendChild(o);
  setTimeout(() => o.remove(), 400);
};

if (typeof document !== 'undefined' && !document.getElementById('battle-styles')) {
  const s = document.createElement('style');
  s.id = 'battle-styles';
  s.textContent = `
    @keyframes dmg-float{0%{transform:translate(-50%,0)scale(.5);opacity:0}20%{transform:translate(-50%,-20px)scale(1.2);opacity:1}100%{transform:translate(-50%,-80px)scale(.8);opacity:0}}
    @keyframes particle-burst{0%{transform:translate(-50%,-50%)scale(0);opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty)))scale(1.5);opacity:0}}
    @keyframes damage-flash{0%{opacity:1}100%{opacity:0}}
    @keyframes boss-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes glow-pulse{0%,100%{box-shadow:0 0 20px rgba(239,68,68,.5)}50%{box-shadow:0 0 40px rgba(239,68,68,.8)}}
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
  const bossRef = useRef<HTMLDivElement>(null);

  const { data: bs, refetch } = useQuery({ queryKey: ['battle-state', bossId], queryFn: () => battleApi.getBattleState(bossId), refetchInterval: showQ ? 2000 : false });
  const { data: results } = useQuery({ queryKey: ['battle-results', bossId], queryFn: () => battleApi.getBattleResults(bossId), enabled: showRes });
  const endMut = useMutation({
    mutationFn: (st: 'VICTORY' | 'DEFEAT' | 'COMPLETED') => battleApi.endBattle(bossId, st),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['battle-state', bossId] }); setShowRes(true); if (d?.status === 'VICTORY') fireVictoryConfetti(); },
  });

  useEffect(() => { if (!showQ || timeLeft <= 0) return; const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [showQ, timeLeft]);

  const handleDmg = (dmg: number, hasWrong: boolean) => {
    if (dmg > 0) { setShaking(true); fireDamageParticles(bossRef.current, dmg); setTimeout(() => setShaking(false), 500); }
    if (hasWrong) fireStudentDamage();
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
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2"><Users size={14} className="text-purple-400" /><span className="text-white text-sm">{bs.participants.length}</span></div>
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
            <div className="max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-500/50">
              <div className="grid grid-cols-4 gap-1.5">
                {bs.participants.map((p, i) => (
                  <motion.div 
                    key={p.id} 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="bg-gradient-to-br from-purple-500/30 to-indigo-500/30 rounded-lg p-1.5 flex flex-col items-center border border-white/10 hover:border-purple-400/50 transition-colors"
                    title={`${p.characterName}: ${p.totalDamage} daño`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                      {p.characterName?.[0] || '?'}
                    </div>
                    <span className="text-white/90 text-[10px] font-medium mt-1 truncate w-full text-center">{p.characterName?.split(' ')[0] || '?'}</span>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      <Zap size={10} />
                      <span className="text-[10px] font-bold">{p.totalDamage}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Question Panel */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <AnimatePresence mode="wait">
            {!showQ ? (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-xl">
                <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 shadow-2xl text-center">
                  {curQ ? (
                    <>
                      <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="inline-block mb-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"><Target size={28} className="text-white" /></div>
                      </motion.div>
                      <h3 className="text-white text-lg font-bold mb-3">{curQ.question}</h3>
                      {curQ.imageUrl && <img src={curQ.imageUrl} alt="" className="max-h-28 mx-auto rounded-xl mb-3" />}
                      <div className="flex justify-center gap-4 text-sm mb-5">
                        <div className="flex items-center gap-2 bg-amber-500/20 rounded-full px-3 py-1.5"><Zap size={14} className="text-amber-400" /><span className="text-amber-300 font-bold">{curQ.damage} daño</span></div>
                        <div className="flex items-center gap-2 bg-blue-500/20 rounded-full px-3 py-1.5"><Clock size={14} className="text-blue-400" /><span className="text-blue-300 font-bold">{curQ.timeLimit}s</span></div>
                      </div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button onClick={startQ} className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-lg px-8 py-3 shadow-lg" leftIcon={<Swords size={18} />}>¡Iniciar Ataque!</Button>
                      </motion.div>
                    </>
                  ) : (
                    <div className="py-6"><div className="text-5xl mb-3">⚔️</div><p className="text-white/70 mb-3">No hay más preguntas</p><Button onClick={() => endMut.mutate('DEFEAT')} className="bg-red-500">Finalizar</Button></div>
                  )}
                </div>
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

// Render Options
const renderOpts = (q: BattleQuestion, show: boolean, sel: UserSelection, onSel: (i: number) => void, shuffled: MatchingPair[], qType: BattleQuestionType) => {
  const opts = Array.isArray(q.options) ? q.options : [];
  const ci = safeJsonParse(q.correctIndices) || [];
  const pairs = safeJsonParse(q.pairs) || [];
  const getStyle = (i: number, isC: boolean) => { const isSel = Array.isArray(sel) ? sel.includes(i) : sel === i; if (show) { if (isC) return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-2 ring-green-300'; if (isSel) return 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-300'; return 'bg-white/10 text-white/60'; } return isSel ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-300' : 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'; };
  if (qType === 'TRUE_FALSE') return <div className="grid grid-cols-2 gap-3">{['Verdadero', 'Falso'].map((o, i) => <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.03 } : {}} whileTap={!show ? { scale: 0.97 } : {}} className={`p-4 rounded-xl font-bold text-lg transition-all ${getStyle(i, q.correctIndex === i)}`}>{i === 0 ? '✓' : '✗'} {o}</motion.button>)}</div>;
  if (qType === 'MATCHING' && pairs.length > 0) return <div className="grid grid-cols-2 gap-3"><div className="space-y-2">{pairs.map((p: MatchingPair, i: number) => <div key={i} className={`p-3 rounded-xl flex items-center gap-2 ${show ? 'bg-blue-500/20 border border-blue-400/50' : 'bg-white/10'}`}><span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">{i + 1}</span><span className="text-white text-sm">{p.left}</span></div>)}</div><div className="space-y-2">{shuffled.map((p: MatchingPair, i: number) => { const oi = pairs.findIndex((x: MatchingPair) => x.right === p.right); return <div key={i} className={`p-3 rounded-xl flex items-center gap-2 ${show ? 'bg-green-500/20 border border-green-400/50' : 'bg-white/10'}`}><span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">{String.fromCharCode(97 + i)}</span><span className="text-white text-sm flex-1">{p.right}</span>{show && <span className="text-green-400 text-xs">→{oi + 1}</span>}</div>; })}</div></div>;
  if (qType === 'MULTIPLE_CHOICE') { const sa = Array.isArray(sel) ? sel : []; return <div className="grid grid-cols-2 gap-2">{opts.map((o: string, i: number) => { const isC = ci.includes(i), isSel = sa.includes(i); let st = 'bg-white/10 text-white'; if (show) { if (isC) st = 'bg-gradient-to-r from-green-500 to-emerald-500 text-white ring-2 ring-green-300'; else if (isSel) st = 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-300'; } else if (isSel) st = 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white ring-2 ring-purple-300'; else st = 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'; return <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.02 } : {}} className={`p-3 rounded-xl text-sm font-medium transition-all ${st}`}><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{o}{show && isC && ' ✓'}{show && !isC && isSel && ' ✗'}</motion.button>; })}</div>; }
  return <div className="grid grid-cols-2 gap-2">{opts.map((o: string, i: number) => <motion.button key={i} onClick={() => onSel(i)} disabled={show} whileHover={!show ? { scale: 1.02 } : {}} className={`p-3 rounded-xl text-sm font-medium transition-all ${getStyle(i, i === q.correctIndex)}`}><span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{o}{show && i === q.correctIndex && ' ✓'}{show && i !== q.correctIndex && sel === i && ' ✗'}</motion.button>)}</div>;
};

// Results View
const BattleResultsView = ({ battleState, results, onBack }: { battleState: BattleState; results: BattleResult[]; onBack: () => void }) => {
  const vic = battleState.status === 'VICTORY';
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -m-6 p-6 flex flex-col items-center justify-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }} className="text-center mb-6">
        <motion.div animate={{ rotate: vic ? [0, 10, -10, 0] : 0, y: vic ? [0, -10, 0] : 0 }} transition={{ duration: 1, repeat: Infinity }} className="text-7xl mb-3">{vic ? '🏆' : '💀'}</motion.div>
        <h1 className={`text-4xl font-black ${vic ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500' : 'text-red-400'}`}>{vic ? '¡VICTORIA!' : 'DERROTA'}</h1>
        <p className="text-white/70 mt-2">{vic ? `¡Derrotaron a ${battleState.bossName}!` : `${battleState.bossName} escapó...`}</p>
      </motion.div>
      <div className="bg-slate-800/90 backdrop-blur-md rounded-2xl p-5 border border-purple-500/30 max-w-md w-full mb-4 max-h-[400px] overflow-y-auto">
        <h2 className="text-white font-bold text-center mb-4 flex items-center justify-center gap-2"><Crown className="text-amber-400" size={20} /> Tabla de Héroes</h2>
        <div className="space-y-2">
          {results.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50' : i === 1 ? 'bg-gray-400/20 border border-gray-400/50' : i === 2 ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-white/5'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/70'}`}>{i + 1}</div>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg">{r.characterName?.[0] || '?'}</div>
              <div className="flex-1 min-w-0"><p className="text-white font-medium text-sm truncate">{r.characterName}</p><p className="text-red-400 text-xs flex items-center gap-1"><Target size={10} />{r.damageDealt}</p></div>
              <div className="text-right text-xs"><div className="text-blue-400 flex items-center gap-1 justify-end"><Sparkles size={10} />+{r.xpEarned}</div><div className="text-amber-400 flex items-center gap-1 justify-end"><Coins size={10} />+{r.gpEarned}</div></div>
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><Button onClick={onBack} className="bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg" leftIcon={<ArrowLeft size={16} />}>Volver</Button></motion.div>
    </div>
  );
};
