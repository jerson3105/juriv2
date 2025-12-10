import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export const ThemeToggle = ({ variant = 'icon', className = '' }: ThemeToggleProps) => {
  const { theme, setTheme, resolvedTheme } = useThemeStore();

  if (variant === 'dropdown') {
    return (
      <div className={`flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ${className}`}>
        <button
          onClick={() => setTheme('light')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'light' 
              ? 'bg-white dark:bg-gray-700 shadow-sm text-amber-500' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Modo claro"
        >
          <Sun size={16} />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'dark' 
              ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-500' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Modo oscuro"
        >
          <Moon size={16} />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`p-2 rounded-md transition-colors ${
            theme === 'system' 
              ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-500' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Seguir sistema"
        >
          <Monitor size={16} />
        </button>
      </div>
    );
  }

  // Variante simple de icono
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      title={theme === 'light' ? 'Modo claro' : theme === 'dark' ? 'Modo oscuro' : 'Seguir sistema'}
    >
      {resolvedTheme === 'dark' ? (
        <Moon size={20} className="text-indigo-400" />
      ) : (
        <Sun size={20} className="text-amber-500" />
      )}
    </button>
  );
};
