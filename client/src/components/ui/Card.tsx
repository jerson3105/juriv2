import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  hover?: boolean;
  glass?: boolean;
}

export const Card = ({
  children,
  hover = false,
  glass = false,
  className = '',
  ...props
}: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' } : undefined}
      className={`
        rounded-xl p-6 transition-all duration-200
        ${glass 
          ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50' 
          : 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg shadow-blue-500/5 dark:shadow-gray-900/20 border border-white/50 dark:border-gray-700/50'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const CardHeader = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <h3 className={`text-lg font-bold text-gray-800 dark:text-white ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p className={`text-gray-500 dark:text-gray-400 mt-1 text-sm ${className}`}>
    {children}
  </p>
);

export const CardContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    {children}
  </div>
);

export const CardFooter = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);
