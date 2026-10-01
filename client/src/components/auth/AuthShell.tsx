import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Enlace "Volver" arriba del título. */
  back?: { to: string; label: string };
  /** Debajo de la tarjeta (por ejemplo, "¿Ya tienes cuenta?"). */
  footer?: ReactNode;
  /** Ancho de la tarjeta. */
  wide?: boolean;
}

const footerLink = 'inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-gray-700 underline-offset-2 hover:text-primary-700 hover:underline dark:text-gray-300 dark:hover:text-primary-300';

// Armazón común de las pantallas de acceso: tarjeta plana centrada, sin desenfoques ni animaciones.
export const AuthShell = ({ title, subtitle, children, back, footer, wide = false }: AuthShellProps) => (
  <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-8 dark:bg-gray-900 sm:py-12">
    <Link to="/login" className="mb-6 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
      <img src="/logo.png" alt="Juried" className="h-12 w-auto" />
    </Link>
    <main className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
        {back && (
          <Link to={back.to} className="-ml-2 mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300">
            <ArrowLeft size={16} aria-hidden="true" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{subtitle}</div>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-gray-800 dark:text-gray-100">{footer}</div>}
    </main>
    <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-2 text-sm">
      <Link to="/about" className={footerLink}>¿Qué es Juried?</Link>
      <span aria-hidden="true" className="text-gray-600 dark:text-gray-300">·</span>
      <Link to="/privacy" className={footerLink}>Privacidad</Link>
    </footer>
  </div>
);
