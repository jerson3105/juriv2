import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import { cardText, homeCard, rowButton } from './home/studentHomeHelpers';

const backLink = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white';

interface StudentPageHeaderProps {
  title: string;
  subtitle: string;
  emoji: string;
  storyAccent: StoryAccent | null;
}

/** Cabecera de las páginas del alumno: "Volver al inicio", sello con el tema de la clase, título y subtítulo. */
export const StudentPageHeader = ({ title, subtitle, emoji, storyAccent }: StudentPageHeaderProps) => (
  <div>
    <Link to="/my-class" className={backLink}>
      <ArrowLeft size={16} aria-hidden="true" />
      Volver al inicio
    </Link>
    <header className="mt-2 flex items-center gap-3">
      <span
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
        style={{ background: storyAccent ? accentGradient(storyAccent) : 'linear-gradient(135deg, #4338ca, #6d28d9)' }}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">{title}</h1>
        <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
      </div>
    </header>
  </div>
);

/** Error de carga: nunca se muestra como si no hubiera datos. */
export const ErrorCard = ({ text, onRetry }: { text: string; onRetry: () => void }) => (
  <section className={`${homeCard} flex flex-wrap items-center justify-between gap-3`} role="alert">
    <p className={cardText}>{text}</p>
    <button type="button" onClick={onRetry} className={rowButton}>Reintentar</button>
  </section>
);
