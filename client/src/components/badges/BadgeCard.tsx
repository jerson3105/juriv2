import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { type Badge, RARITY_COLORS, RARITY_LABELS } from '../../lib/badgeApi';

interface BadgeCardProps {
  badge: Badge;
  isUnlocked?: boolean;
  unlockedAt?: string;
  progress?: {
    currentValue: number;
    targetValue: number;
    percentage: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export const BadgeCard = ({
  badge,
  isUnlocked = false,
  unlockedAt,
  progress,
  size = 'md',
  showDetails = true,
  onClick,
}: BadgeCardProps) => {
  const colors = RARITY_COLORS[badge.rarity];
  const isSecret = badge.isSecret && !isUnlocked;
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };
  
  const iconSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center p-3 rounded-xl border-2 transition-all
        ${onClick ? 'cursor-pointer' : ''}
        ${isUnlocked 
          ? `${colors.bg} ${colors.border}` 
          : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
        }
      `}
    >
      {/* Icono de la insignia */}
      <div className={`
        ${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden
        ${isUnlocked 
          ? `bg-gradient-to-br ${colors.gradient} shadow-lg` 
          : 'bg-gray-300 dark:bg-gray-600'
        }
      `}>
        {isSecret ? (
          <Lock className="w-8 h-8 text-gray-500" />
        ) : badge.customImage ? (
          <img 
            src={`http://localhost:3001${badge.customImage}`}
            alt={badge.name}
            className={`w-full h-full object-cover ${isUnlocked ? '' : 'grayscale'}`}
          />
        ) : (
          <span className={`${iconSizes[size]} ${isUnlocked ? '' : 'grayscale'}`}>
            {badge.icon}
          </span>
        )}
      </div>
      
      {/* Check de desbloqueado */}
      {isUnlocked && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
      
      {showDetails && (
        <>
          {/* Nombre */}
          <h4 className={`
            mt-2 text-sm font-semibold text-center line-clamp-1
            ${isUnlocked ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}
          `}>
            {isSecret ? '???' : badge.name}
          </h4>
          
          {/* Rareza */}
          <span className={`
            text-xs font-medium px-2 py-0.5 rounded-full mt-1
            ${isUnlocked ? colors.text : 'text-gray-400'}
            ${isUnlocked ? colors.bg : 'bg-gray-200 dark:bg-gray-700'}
          `}>
            {RARITY_LABELS[badge.rarity]}
          </span>
          
          {/* Progreso */}
          {!isUnlocked && progress && progress.targetValue > 0 && (
            <div className="w-full mt-2">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  className={`h-full bg-gradient-to-r ${colors.gradient}`}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                {progress.currentValue}/{progress.targetValue}
              </p>
            </div>
          )}
          
          {/* Fecha de desbloqueo */}
          {isUnlocked && unlockedAt && (
            <p className="text-xs text-gray-400 mt-1">
              {new Date(unlockedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
};
