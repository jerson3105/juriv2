import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from './landingStyles';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Escalonado entre hermanos; tope de 150 ms para no hacer esperar. */
  delay?: number;
}

/**
 * Aparece una sola vez al entrar en pantalla: opacidad y 8 px hacia arriba, 300 ms.
 * Con «reducir movimiento», MotionConfig (App) quita el desplazamiento y queda solo el fundido.
 */
export const Reveal = ({ children, className, delay = 0 }: RevealProps) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-100px' }}
    transition={{ duration: 0.3, ease: EASE_OUT, delay: Math.min(delay, 0.15) }}
  >
    {children}
  </motion.div>
);
