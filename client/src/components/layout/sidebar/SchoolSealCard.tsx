import { useRef, useState } from 'react';
import { ArrowLeft, School } from 'lucide-react';
import { useSidebarUi } from './sidebarContext';
import { SidebarFlyout } from './sidebarUi';

interface SchoolSealCardProps {
  name: string;
  /** «Administración», «Docente» o «Por verificar». */
  roleLabel: string;
  onBack: () => void;
}

const Seal = ({ size }: { size: 36 | 40 }) => (
  <span
    aria-hidden="true"
    className={`inline-flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm ring-1 ring-white/20 ${size === 40 ? 'h-10 w-10' : 'h-9 w-9'}`}
  >
    <School size={size === 40 ? 20 : 18} />
  </span>
);

/**
 * El sello del colegio en la banda de la consola (como la ficha de la clase en el aula): volver a mis clases, nombre
 * y rol. Colapsado, el sello abre la ficha al costado.
 */
export const SchoolSealCard = ({ name, roleLabel, onBack }: SchoolSealCardProps) => {
  const { rail, showTip, hideTip } = useSidebarUi();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (rail) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Escuela: ${name}, ${roleLabel}. Ver opciones`}
          aria-expanded={open}
          className="sb-focus rounded-xl"
          onMouseEnter={(event) => !open && showTip(event.currentTarget, name)}
          onMouseLeave={hideTip}
          onFocus={(event) => !open && showTip(event.currentTarget, name, true)}
          onBlur={hideTip}
          onClick={() => {
            hideTip();
            setOpen((value) => !value);
          }}
        >
          <Seal size={40} />
        </button>
        {open && (
          <SidebarFlyout
            anchorRef={triggerRef}
            label={name}
            width={264}
            onClose={(restore) => {
              setOpen(false);
              if (restore) triggerRef.current?.focus();
            }}
          >
            <div className="flex items-center gap-3 px-2 pb-2 pt-1">
              <Seal size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5 line-clamp-2">{name}</p>
                <p className="text-xs">{roleLabel}</p>
              </div>
            </div>
            <button
              type="button"
              className="sb-item"
              onClick={() => {
                setOpen(false);
                onBack();
              }}
            >
              <span className="sb-icon"><ArrowLeft size={16} aria-hidden="true" /></span>
              <span className="flex-1">Volver a mis clases</span>
            </button>
          </SidebarFlyout>
        )}
      </>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver a mis clases"
        title="Volver a mis clases"
        className="sb-focus -ml-1.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/90 hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <Seal size={36} />
      <div className="min-w-0 flex-1">
        <p className="sb-label text-sm font-bold leading-5 line-clamp-2">{name}</p>
        <span className="sb-label mt-1 inline-flex items-center rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-white/15">
          {roleLabel}
        </span>
      </div>
    </div>
  );
};
