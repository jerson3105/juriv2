import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ConstellationArt, Starfield } from './SpaceScene';

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** "Volver" arriba del título: enlace, o acción dentro de la misma pantalla (pasos). */
  back?: { to: string; label: string } | { onClick: () => void; label: string };
  /** Debajo de la tarjeta (por ejemplo, "¿Ya tienes cuenta?"). */
  footer?: ReactNode;
  /** Ancho de la tarjeta. */
  wide?: boolean;
}

const backClass = '-ml-2 mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:text-primary-700 dark:text-gray-200 dark:hover:text-primary-300';
const footerLink = 'inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-gray-700 underline-offset-2 hover:text-primary-700 hover:underline dark:text-gray-300 dark:hover:text-primary-300';

/**
 * Armazón de las pantallas de acceso con tema espacial: panel nocturno del Observatorio (estrellas
 * que titilan, Orión que se traza y Jiro) y la tarjeta sobre constelaciones tenues. En móvil el
 * panel es una franja arriba. Las animaciones respetan "reducir movimiento".
 */
export const AuthShell = ({ title, subtitle, children, back, footer, wide = false }: AuthShellProps) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    {/* Noche del Observatorio */}
    <aside className="relative h-44 overflow-hidden bg-[#0b1026] text-white sm:h-52 lg:sticky lg:top-0 lg:h-screen">
      <Starfield />
      <ConstellationArt id="orion" draw className="absolute right-[-6%] top-[8%] hidden w-[78%] lg:block" />
      <ConstellationArt id="cruz-del-sur" draw delay={0.2} className="absolute left-[46%] top-[6%] w-28 lg:hidden" />
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-8 lg:p-10">
        <Link to="/login" className="self-start rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
          <img src="/logo.png" alt="Juried" className="h-10 w-auto sm:h-12" />
        </Link>
        <div className="mt-auto hidden max-w-sm pb-48 lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">Observatorio de Jiro</p>
          <p className="mt-2 text-3xl font-black leading-tight">Aprender es una aventura entre estrellas</p>
          <p className="mt-3 text-indigo-100">Cada clase suma XP, insignias y constelaciones nuevas.</p>
        </div>
      </div>
      <img
        src="/assets/jiro/senalando.webp"
        alt=""
        aria-hidden="true"
        className="auth-float pointer-events-none absolute bottom-0 right-3 h-32 w-auto drop-shadow-2xl sm:h-40 lg:bottom-6 lg:left-10 lg:right-auto lg:h-56"
      />
    </aside>

    {/* Tarjeta */}
    <div className="relative flex flex-col items-center px-4 pb-10 lg:min-h-screen lg:justify-center lg:py-12">
      <ConstellationArt id="casiopea" tone="faint" className="absolute left-[4%] top-[6%] hidden w-48 sm:block" />
      <ConstellationArt id="lira" tone="faint" className="absolute bottom-[8%] right-[5%] hidden w-36 sm:block" />
      <main className={`auth-rise relative -mt-8 w-full lg:mt-0 ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-indigo-950/5 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/30 sm:p-8">
          {back && ('to' in back ? (
            <Link to={back.to} className={backClass}>
              <ArrowLeft size={16} aria-hidden="true" /> {back.label}
            </Link>
          ) : (
            <button type="button" onClick={back.onClick} className={backClass}>
              <ArrowLeft size={16} aria-hidden="true" /> {back.label}
            </button>
          ))}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{subtitle}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-gray-800 dark:text-gray-100">{footer}</div>}
      </main>
      <footer className="relative mt-8 flex flex-wrap items-center justify-center gap-x-2 text-sm">
        <Link to="/about" className={footerLink}>¿Qué es Juried?</Link>
        <span aria-hidden="true" className="text-gray-600 dark:text-gray-300">·</span>
        <Link to="/privacy" className={footerLink}>Privacidad</Link>
      </footer>
    </div>
  </div>
);
