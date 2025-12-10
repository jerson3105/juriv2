import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Sparkles, Check, Star, Shirt } from 'lucide-react';

// Efecto de compra exitosa
interface PurchaseSuccessProps {
  show: boolean;
  itemName: string;
  itemImage?: string;
  price: number;
  onComplete?: () => void;
}

export const PurchaseSuccessAnimation = ({ 
  show, 
  itemName, 
  itemImage, 
  price, 
  onComplete 
}: PurchaseSuccessProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setIsVisible(false);
            onComplete?.();
          }}
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: -50 }}
            transition={{ type: 'spring', damping: 15 }}
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-4"
          >
            {/* Icono animado */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
            </motion.div>

            {/* Estrellas decorativas */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute top-4 right-4"
            >
              <Sparkles className="w-6 h-6 text-amber-400" />
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-center text-gray-900 mb-2"
            >
              ¡Compra Exitosa!
            </motion.h3>

            {/* Item comprado */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-50 rounded-xl p-4 mb-4"
            >
              <div className="flex items-center gap-3">
                {itemImage ? (
                  <img 
                    src={itemImage} 
                    alt={itemName} 
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-purple-500" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{itemName}</p>
                  <p className="text-sm text-amber-600 font-medium">-{price} GP</p>
                </div>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-gray-500 text-sm"
            >
              El item ha sido añadido a tu inventario
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Efecto de equipar item
interface EquipEffectProps {
  show: boolean;
  itemName: string;
  itemImage?: string;
  onComplete?: () => void;
}

export const EquipItemAnimation = ({ 
  show, 
  itemName, 
  onComplete 
}: EquipEffectProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <Shirt className="w-5 h-5" />
            </motion.div>
            <span className="font-medium">
              ¡{itemName} equipado!
            </span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3, repeat: 3 }}
            >
              <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Efecto de desequipar item
interface UnequipEffectProps {
  show: boolean;
  itemName: string;
  onComplete?: () => void;
}

export const UnequipItemAnimation = ({ 
  show, 
  itemName, 
  onComplete 
}: UnequipEffectProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
            <Shirt className="w-5 h-5 text-gray-400" />
            <span className="font-medium">
              {itemName} desequipado
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Efecto de puntos ganados/perdidos
interface PointsEffectProps {
  show: boolean;
  type: 'XP' | 'HP' | 'GP';
  amount: number;
  action: 'ADD' | 'REMOVE';
  onComplete?: () => void;
}

export const PointsAnimation = ({ 
  show, 
  type, 
  amount, 
  action, 
  onComplete 
}: PointsEffectProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const colors = {
    XP: action === 'ADD' ? 'from-indigo-500 to-purple-500' : 'from-indigo-800 to-purple-800',
    HP: action === 'ADD' ? 'from-green-500 to-emerald-500' : 'from-red-500 to-rose-500',
    GP: action === 'ADD' ? 'from-amber-500 to-yellow-500' : 'from-amber-800 to-yellow-800',
  };

  const icons = {
    XP: <Sparkles className="w-5 h-5" />,
    HP: <span className="text-lg">❤️</span>,
    GP: <span className="text-lg">🪙</span>,
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: 1, y: -30, scale: 1 }}
          exit={{ opacity: 0, y: -60 }}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className={`bg-gradient-to-r ${colors[type]} text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-xl`}>
            {icons[type]}
            <span>
              {action === 'ADD' ? '+' : '-'}{amount} {type}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook para manejar efectos de puntos
export const usePointsEffect = () => {
  const [effect, setEffect] = useState<{
    show: boolean;
    type: 'XP' | 'HP' | 'GP';
    amount: number;
    action: 'ADD' | 'REMOVE';
  }>({
    show: false,
    type: 'XP',
    amount: 0,
    action: 'ADD',
  });

  const showPointsEffect = (type: 'XP' | 'HP' | 'GP', amount: number, action: 'ADD' | 'REMOVE') => {
    setEffect({ show: true, type, amount, action });
  };

  const hidePointsEffect = () => {
    setEffect(prev => ({ ...prev, show: false }));
  };

  return { effect, showPointsEffect, hidePointsEffect };
};

// Componente para animación de múltiples tipos de puntos
interface MultiPointsEffectProps {
  show: boolean;
  xp?: number;
  hp?: number;
  gp?: number;
  isPositive: boolean;
  onComplete?: () => void;
}

export const MultiPointsAnimation = ({ 
  show, 
  xp = 0, 
  hp = 0, 
  gp = 0, 
  isPositive,
  onComplete 
}: MultiPointsEffectProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const rewards: { icon: React.ReactNode; value: number; color: string; label: string }[] = [];
  if (xp > 0) rewards.push({ icon: <Sparkles className="w-5 h-5" />, value: xp, color: 'emerald', label: 'XP' });
  if (hp > 0) rewards.push({ icon: <span className="text-lg">❤️</span>, value: hp, color: 'red', label: 'HP' });
  if (gp > 0) rewards.push({ icon: <span className="text-lg">🪙</span>, value: gp, color: 'amber', label: 'Oro' });

  if (rewards.length === 0) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div className={`
            px-8 py-6 rounded-2xl shadow-2xl
            ${isPositive 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
              : 'bg-gradient-to-br from-red-500 to-rose-600'
            }
          `}>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <p className="text-white/80 text-sm font-medium mb-2">
                {isPositive ? '¡Puntos otorgados!' : 'Puntos descontados'}
              </p>
              <div className="flex items-center justify-center gap-4">
                {rewards.map((reward, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, type: 'spring', stiffness: 200 }}
                    className="flex flex-col items-center"
                  >
                    <div className="flex items-center gap-1 text-white text-2xl font-bold">
                      {reward.icon}
                      <span>{isPositive ? '+' : '-'}{reward.value}</span>
                    </div>
                    <span className="text-white/70 text-xs">{reward.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook para manejar efectos de múltiples puntos
export const useMultiPointsEffect = () => {
  const [effect, setEffect] = useState<{
    show: boolean;
    xp: number;
    hp: number;
    gp: number;
    isPositive: boolean;
  }>({
    show: false,
    xp: 0,
    hp: 0,
    gp: 0,
    isPositive: true,
  });

  const showMultiPointsEffect = (xp: number, hp: number, gp: number, isPositive: boolean) => {
    setEffect({ show: true, xp, hp, gp, isPositive });
  };

  const hideMultiPointsEffect = () => {
    setEffect(prev => ({ ...prev, show: false }));
  };

  return { effect, showMultiPointsEffect, hideMultiPointsEffect };
};
