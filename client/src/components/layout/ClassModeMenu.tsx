import { BellOff, ChevronDown, Monitor, Presentation } from 'lucide-react';
import { useProjectorStore } from '../../store/projectorStore';
import { useCelebrationStore } from '../../store/celebrationStore';
import { usePopover } from '../../hooks/usePopover';
import { Popover } from '../ui/Popover';
import { SwitchRow } from '../settings/settingsUi';

/**
 * «Modo clase» en la barra de todas las páginas del aula: Proyectando, modo silencioso y sonidos juntos.
 * Con un modo activo el botón se rellena y dice cuál («Proyectando»), así el estado se ve en cualquier página.
 */
export const ClassModeMenu = () => {
  const projecting = useProjectorStore((s) => s.projecting);
  const setProjecting = useProjectorStore((s) => s.setProjecting);
  const silent = useCelebrationStore((s) => s.silent);
  const sound = useCelebrationStore((s) => s.sound);
  const setSilent = useCelebrationStore((s) => s.setSilent);
  const setSound = useCelebrationStore((s) => s.setSound);
  const { open, anchorRef, close, toggle } = usePopover();

  const active = projecting || silent;
  const label = projecting && silent ? 'Proyectando · silencio' : projecting ? 'Proyectando' : silent ? 'Modo silencioso' : 'Modo clase';
  const Icon = projecting ? Monitor : silent ? BellOff : Presentation;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}: proyectar, modo silencioso y sonidos`}
        className={`inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors md:px-3 ${
          active
            ? 'bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-300 hover:bg-primary-100 dark:bg-primary-900/40 dark:text-primary-100 dark:ring-primary-700 dark:hover:bg-primary-900/60'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="hidden md:inline">{label}</span>
        <ChevronDown size={14} className={`hidden md:inline transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={close} anchorRef={anchorRef} label="Modo clase" className="w-80 px-3">
        <p className="pg-menu-label px-0">Modo clase</p>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <SwitchRow
            title="Proyectando"
            description="Oculta lo privado en toda el aula: energía, negativos, asistencia, quién falta reconocer y los códigos."
            checked={projecting}
            onChange={setProjecting}
          />
          <SwitchRow
            title="Modo silencioso"
            description="Para exámenes: no se anima nada y las subidas de nivel se guardan para celebrar después."
            checked={silent}
            onChange={setSilent}
          />
          <SwitchRow title="Sonidos" description="De los puntos y las celebraciones." checked={sound} onChange={setSound} />
        </div>
      </Popover>
    </>
  );
};
