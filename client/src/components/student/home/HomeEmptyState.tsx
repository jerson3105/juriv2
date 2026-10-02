import { Link } from 'react-router-dom';

const primaryClass = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700';
const secondaryClass = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

/** Un botón del estado vacío: lleva a otra página o hace algo en la misma (p. ej. cambiar de bimestre). */
export type EmptyAction = { label: string; to: string } | { label: string; onClick: () => void };

interface HomeEmptyStateProps {
  emojis: [string, string, string];
  title: string;
  text: string;
  primary: EmptyAction;
  secondary?: EmptyAction;
}

const ActionButton = ({ action, className }: { action: EmptyAction; className: string }) =>
  'to' in action
    ? <Link to={action.to} className={className}>{action.label}</Link>
    : <button type="button" onClick={action.onClick} className={className}>{action.label}</button>;

/** Estado vacío del inicio: el patrón de Insignias y Tienda, en versión compacta. */
export const HomeEmptyState = ({ emojis, title, text, primary, secondary }: HomeEmptyStateProps) => (
  <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-4 py-6 text-center dark:border-gray-600 dark:bg-gray-800/60">
    <div className="mx-auto flex w-fit items-end gap-2" aria-hidden="true">
      <span className="text-2xl">{emojis[0]}</span><span className="text-3xl">{emojis[1]}</span><span className="text-2xl">{emojis[2]}</span>
    </div>
    <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">{title}</p>
    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-700 dark:text-gray-300">{text}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <ActionButton action={primary} className={primaryClass} />
      {secondary && <ActionButton action={secondary} className={secondaryClass} />}
    </div>
  </div>
);
