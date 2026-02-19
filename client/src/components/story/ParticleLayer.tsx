import { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ThemeConfig } from '../../lib/storyApi';

interface ParticleLayerProps {
  particles: ThemeConfig['particles'];
}

const SPEED_MAP: Record<string, number> = {
  slow: 14,
  medium: 9,
  fast: 5,
};

const DENSITY_MAP: Record<string, number> = {
  low: 20,
  medium: 35,
  high: 50,
};

// Floating emojis per particle type for extra flair
const EMOJI_MAP: Record<string, string[]> = {
  petals: ['🌸', '🌺', '💮', '🌷'],
  snow: ['❄️', '❅', '❆', '✦'],
  sparkles: ['✨', '💫', '⭐', '✦'],
  stars: ['⭐', '✨', '💫', '🌟'],
  fireflies: ['✨', '🌿', '🍃', '🌲'],
  bubbles: ['🫧', '💧', '🌊', '🐚'],
  leaves: ['🍂', '🍁', '🌿', '🍃'],
  smoke: ['💨', '🌫️', '☁️'],
  embers: ['🔥', '✨', '💥'],
  ash: ['🌑', '💨', '🌫️'],
  dust: ['💨', '✦', '☁️'],
  lava: ['🔥', '🌋', '💥', '🧡'],
  hearts: ['❤️', '💕', '💖', '💗'],
  confetti: ['🎉', '🎊', '✨', '🎈'],
  rain: ['💧', '🌧️'],
  swords: ['⚔️', '🗡️', '🛡️', '🏰'],
  math: ['➕', '➗', '🔢', '📐', '📏'],
  computing: ['💻', '🤖', '⚙️', '🔌'],
  science: ['🔬', '🧪', '⚗️', '🧬'],
  religion: ['✝️', '🕊️', '⛪', '📖'],
};

export const ParticleLayer = ({ particles }: ParticleLayerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const { particleElements, emojiElements } = useMemo(() => {
    if (!particles?.type) return { particleElements: [], emojiElements: [] };

    const count = isMobile
      ? Math.min(DENSITY_MAP[particles.density || 'low'] || 20, 15)
      : DENSITY_MAP[particles.density || 'low'] || 20;

    const duration = SPEED_MAP[particles.speed || 'slow'] || 14;
    const color = particles.color || '#FFFFFF';
    const type = particles.type;

    const pElements = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * duration,
      duration: duration + Math.random() * 6,
      size: 8 + Math.random() * 14,
      opacity: 0.5 + Math.random() * 0.4,
      drift: -30 + Math.random() * 60,
      color,
      type,
    }));

    // Floating emoji decorations (fewer, bigger, slower)
    const emojis = EMOJI_MAP[type] || [];
    const emojiCount = isMobile ? 4 : 8;
    const eElements = emojis.length > 0
      ? Array.from({ length: emojiCount }, (_, i) => ({
          id: i,
          emoji: emojis[i % emojis.length],
          left: 5 + Math.random() * 90,
          delay: Math.random() * 20,
          duration: 18 + Math.random() * 12,
          size: 16 + Math.random() * 14,
          opacity: 0.15 + Math.random() * 0.2,
        }))
      : [];

    return { particleElements: pElements, emojiElements: eElements };
  }, [particles, isMobile]);

  if (!particles?.type || !isVisible || particleElements.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 100000 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes particle-fall {
          0% { transform: translateY(-30px) translateX(0px) rotate(0deg); opacity: 0; }
          8% { opacity: var(--p-opacity); }
          92% { opacity: var(--p-opacity); }
          100% { transform: translateY(calc(100vh + 30px)) translateX(var(--p-drift)) rotate(var(--p-rotation)); opacity: 0; }
        }
        @keyframes particle-rise {
          0% { transform: translateY(calc(100vh + 30px)) translateX(0px); opacity: 0; }
          8% { opacity: var(--p-opacity); }
          92% { opacity: var(--p-opacity); }
          100% { transform: translateY(-30px) translateX(var(--p-drift)); opacity: 0; }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0; }
          15% { opacity: var(--p-opacity); }
          50% { transform: translateY(-50px) translateX(var(--p-drift)) scale(1.4); opacity: var(--p-opacity); }
          85% { opacity: var(--p-opacity); }
        }
        @keyframes particle-rain {
          0% { transform: translateY(-20px); opacity: 0; }
          5% { opacity: var(--p-opacity); }
          95% { opacity: var(--p-opacity); }
          100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
        }
        @keyframes emoji-drift {
          0% { transform: translateY(0px) translateX(0px) rotate(0deg) scale(1); opacity: 0; }
          10% { opacity: var(--e-opacity); }
          50% { transform: translateY(calc(-50vh)) translateX(var(--e-drift)) rotate(180deg) scale(1.1); opacity: var(--e-opacity); }
          90% { opacity: var(--e-opacity); }
          100% { transform: translateY(calc(-100vh)) translateX(calc(var(--e-drift) * 2)) rotate(360deg) scale(0.8); opacity: 0; }
        }
        @keyframes emoji-fall {
          0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          10% { opacity: var(--e-opacity); }
          90% { opacity: var(--e-opacity); }
          100% { transform: translateY(calc(100vh + 40px)) rotate(360deg); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .particle {
          position: absolute;
          will-change: transform, opacity;
        }
        .emoji-particle {
          position: absolute;
          will-change: transform, opacity;
          filter: drop-shadow(0 0 4px rgba(255,255,255,0.3));
        }
      `}</style>

      {/* Ambient glow orbs */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '5%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${particles.color}30, transparent 70%)`,
          animation: 'glow-pulse 6s ease-in-out infinite',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          left: '10%',
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${particles.color}25, transparent 70%)`,
          animation: 'glow-pulse 8s ease-in-out infinite 3s',
          filter: 'blur(50px)',
        }}
      />

      {/* Main particles */}
      {particleElements.map((p) => {
        const animName =
          p.type === 'bubbles' ? 'particle-rise' :
          p.type === 'fireflies' || p.type === 'sparkles' ? 'particle-float' :
          p.type === 'smoke' || p.type === 'embers' || p.type === 'lava' ? 'particle-rise' :
          p.type === 'rain' ? 'particle-rain' :
          'particle-fall';

        const rotation = p.type === 'leaves' || p.type === 'petals' || p.type === 'confetti' || p.type === 'ash' || p.type === 'swords'
          ? `${180 + Math.random() * 360}deg`
          : p.type === 'math' || p.type === 'computing' || p.type === 'science' || p.type === 'religion'
          ? `${-15 + Math.random() * 30}deg` : '0deg';

        return (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.left}%`,
              top: animName === 'particle-rise' ? 'auto' : '-30px',
              bottom: animName === 'particle-rise' ? '-30px' : 'auto',
              width: p.type === 'rain' ? '2px' : `${p.size}px`,
              height: p.type === 'rain' ? `${p.size * 3}px` : `${p.size}px`,
              animation: `${animName} ${p.duration}s ${p.delay}s infinite ease-in-out`,
              ['--p-opacity' as any]: p.opacity,
              ['--p-drift' as any]: `${p.drift}px`,
              ['--p-rotation' as any]: rotation,
            }}
          >
            {renderParticleShape(p.type, p.color, p.size)}
          </div>
        );
      })}

      {/* Floating emoji decorations */}
      {emojiElements.map((e) => {
        const useFall = particles?.type === 'snow' || particles?.type === 'petals' || particles?.type === 'leaves' || particles?.type === 'ash' || particles?.type === 'dust' || particles?.type === 'confetti' || particles?.type === 'rain';
        return (
          <div
            key={`emoji-${e.id}`}
            className="emoji-particle"
            style={{
              left: `${e.left}%`,
              bottom: useFall ? 'auto' : '-40px',
              top: useFall ? '-40px' : 'auto',
              fontSize: `${e.size}px`,
              animation: `${useFall ? 'emoji-fall' : 'emoji-drift'} ${e.duration}s ${e.delay}s infinite ease-in-out`,
              ['--e-opacity' as any]: e.opacity,
              ['--e-drift' as any]: `${-30 + Math.random() * 60}px`,
            }}
          >
            {e.emoji}
          </div>
        );
      })}
    </div>,
    document.body
  );
};

function renderParticleShape(type: string, color: string, size: number) {
  switch (type) {
    case 'snow':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${size * 0.5}px ${color}40`,
          }}
        />
      );
    case 'bubbles':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: `1.5px solid ${color}`,
            boxShadow: `inset 0 0 ${size * 0.3}px ${color}30, 0 0 ${size * 0.5}px ${color}20`,
          }}
        />
      );
    case 'leaves':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <path d="M10 2 C5 5, 2 10, 10 18 C18 10, 15 5, 10 2Z" fill={color} opacity="0.85" />
        </svg>
      );
    case 'petals':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <ellipse cx="10" cy="10" rx="5" ry="9" fill={color} opacity="0.8" />
        </svg>
      );
    case 'stars':
    case 'sparkles':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <polygon
            points="10,1 12.5,7.5 19,7.5 13.5,12 15.5,19 10,14.5 4.5,19 6.5,12 1,7.5 7.5,7.5"
            fill={color}
            opacity="0.9"
          />
          <circle cx="10" cy="10" r="3" fill={color} opacity="0.4" />
        </svg>
      );
    case 'fireflies':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${size * 1.5}px ${size * 0.8}px ${color}, 0 0 ${size * 3}px ${size}px ${color}60`,
          }}
        />
      );
    case 'rain':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: color,
            borderRadius: '1px',
            opacity: 0.5,
          }}
        />
      );
    case 'confetti':
      return (
        <div
          style={{
            width: '100%',
            height: `${size * 0.4}px`,
            backgroundColor: color,
            borderRadius: '2px',
          }}
        />
      );
    case 'smoke':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.25,
            filter: `blur(${size * 0.4}px)`,
            boxShadow: `0 0 ${size * 2}px ${size}px ${color}30`,
          }}
        />
      );
    case 'embers':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${size * 1.2}px ${size * 0.5}px ${color}, 0 0 ${size * 2.5}px ${size * 0.8}px ${color}50`,
          }}
        />
      );
    case 'ash':
      return (
        <div
          style={{
            width: '100%',
            height: `${size * 0.5}px`,
            backgroundColor: color,
            borderRadius: '50%',
            opacity: 0.5,
            filter: `blur(${size * 0.1}px)`,
          }}
        />
      );
    case 'dust':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.3,
            filter: `blur(${size * 0.25}px)`,
          }}
        />
      );
    case 'lava':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '40%',
            backgroundColor: color,
            boxShadow: `0 0 ${size * 1.5}px ${size * 0.6}px ${color}, 0 0 ${size * 3}px ${size}px ${color}40`,
            filter: `blur(${size * 0.08}px)`,
          }}
        />
      );
    case 'hearts':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <path d="M10 18 C5 13, 0 9, 3 5 C5 2, 8 3, 10 6 C12 3, 15 2, 17 5 C20 9, 15 13, 10 18Z" fill={color} opacity="0.85" />
        </svg>
      );
    case 'swords':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <rect x="9" y="1" width="2" height="14" rx="0.5" fill={color} opacity="0.9" />
          <rect x="6" y="13" width="8" height="2" rx="1" fill={color} opacity="0.8" />
          <rect x="8.5" y="15" width="3" height="4" rx="0.5" fill={color} opacity="0.7" />
        </svg>
      );
    case 'math': {
      const symbols = ['+', '−', '×', '÷', '=', 'π', '∑', '√', 'Δ', '∞'];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <text x="10" y="15" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold" opacity="0.85">{sym}</text>
        </svg>
      );
    }
    case 'computing': {
      const bits = ['0', '1', '</', '{}', '#'];
      const bit = bits[Math.floor(Math.random() * bits.length)];
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <text x="10" y="15" textAnchor="middle" fill={color} fontSize="12" fontFamily="monospace" fontWeight="bold" opacity="0.85">{bit}</text>
        </svg>
      );
    }
    case 'science':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <circle cx="10" cy="10" r="3" fill="none" stroke={color} strokeWidth="1.5" opacity="0.85" />
          <circle cx="10" cy="10" r="1.5" fill={color} opacity="0.9" />
          <ellipse cx="10" cy="10" rx="8" ry="3" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" transform="rotate(45 10 10)" />
          <ellipse cx="10" cy="10" rx="8" ry="3" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" transform="rotate(-45 10 10)" />
        </svg>
      );
    case 'religion':
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <rect x="9" y="2" width="2" height="16" rx="0.5" fill={color} opacity="0.85" />
          <rect x="5" y="6" width="10" height="2" rx="0.5" fill={color} opacity="0.85" />
        </svg>
      );
    default:
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${size}px ${color}50`,
          }}
        />
      );
  }
}

export default ParticleLayer;
