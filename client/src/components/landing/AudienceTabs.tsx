import { useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { btnPrimary } from './landingStyles';
import { AUDIENCES, type AudienceId } from './audiences';

interface AudienceTabsProps {
  value: AudienceId;
  onChange: (id: AudienceId) => void;
}

/**
 * Pestañas Docentes · Estudiantes · Directivos (patrón tabs de WAI-ARIA: flechas, Inicio y Fin).
 * Los tres paneles comparten celda: la altura no salta y el oculto no recibe foco (visibility).
 */
export const AudienceTabs = ({ value, onChange }: AudienceTabsProps) => {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = AUDIENCES.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
        : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
          : event.key === 'Home' ? 0
            : event.key === 'End' ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(AUDIENCES[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="¿Para quién?" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {AUDIENCES.map((audience, index) => {
          const active = audience.id === value;
          return (
            <button
              key={audience.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${audience.id}`}
              aria-selected={active}
              aria-controls={`panel-${audience.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(audience.id)}
              onKeyDown={(event) => move(event, index)}
              className={`relative min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${active ? 'text-indigo-700' : 'text-slate-600 [@media(hover:hover)]:hover:text-slate-900'}`}
            >
              {active && (
                <motion.span
                  layoutId="audience-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-indigo-600"
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                />
              )}
              <span className="relative">{audience.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid">
        {AUDIENCES.map((audience) => {
          const active = audience.id === value;
          return (
            <div
              key={audience.id}
              id={`panel-${audience.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${audience.id}`}
              className={`grid items-center gap-8 transition-[opacity,visibility] duration-200 [grid-area:1/1] lg:grid-cols-12 lg:gap-12 ${active ? 'visible opacity-100' : 'invisible opacity-0'}`}
            >
              <div className="flex justify-center lg:col-span-5">
                <img src={audience.art.src} alt="" width={audience.art.width} height={audience.art.height} loading="lazy" className="h-48 w-auto sm:h-64 lg:h-80" />
              </div>
              <div className="lg:col-span-7">
                <h3 className="text-2xl font-semibold leading-8 text-slate-900">{audience.title}</h3>
                <ul className="mt-6 space-y-4">
                  {audience.points.map((point) => (
                    <li key={point} className="flex gap-3 text-base leading-relaxed text-slate-600">
                      <Check size={20} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link to={audience.cta.to} className={btnPrimary}>
                    {audience.cta.label}
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                  {audience.note && <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">{audience.note}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
