import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
}

/** Cabecera plana de las páginas del panel (tokens [data-pg]; sin el degradado viejo). */
export const AdminPageHeader = ({ title, subtitle, back = '/admin', backLabel = 'el inicio del panel', actions }: AdminPageHeaderProps) => (
  <header className="border-b border-[var(--pg-line)] bg-[var(--pg-surface)]">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
      <Link to={back} className="pg-icon-btn" aria-label={`Volver a ${backLabel}`}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold">{title}</h1>
        {subtitle && <p className="pg-fg2 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);

