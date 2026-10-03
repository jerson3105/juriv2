import { useRef, useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StoryAccent } from '../../../lib/storyTheme';
import { useProjectorStore } from '../../../store/projectorStore';
import { ClassSeal } from './ClassSeal';
import { useSidebarUi } from './sidebarContext';
import { SidebarFlyout } from './sidebarUi';

interface TeacherClassCardProps {
  classroomId: string;
  name: string;
  code: string;
  accent: StoryAccent | null;
  onBack: () => void;
}

/**
 * La ficha de la clase en la banda del profe: volver, sello, nombre completo y código copiable. Mientras
 * está «Proyectando», el código no se muestra. Colapsado, el sello abre la ficha al costado.
 */
export const TeacherClassCard = ({ classroomId, name, code, accent, onBack }: TeacherClassCardProps) => {
  const { rail, showTip, hideTip } = useSidebarUi();
  const projecting = useProjectorStore((state) => state.projecting);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Código copiado');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el código');
    }
  };

  if (rail) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Clase: ${name}. Ver la ficha`}
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
          <ClassSeal classroomId={classroomId} name={name} accent={accent} size={40} />
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
              <ClassSeal classroomId={classroomId} name={name} accent={accent} size={36} />
              <p className="min-w-0 flex-1 text-sm font-bold leading-5 line-clamp-2">{name}</p>
            </div>
            {!projecting && (
              <button type="button" onClick={() => void copy()} className="sb-item" aria-label={`Copiar código de la clase ${code}`}>
                <span className="sb-icon">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</span>
                <span className="flex-1">Copiar código</span>
                <span className="font-mono text-xs font-semibold">{code}</span>
              </button>
            )}
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
      <ClassSeal classroomId={classroomId} name={name} accent={accent} size={36} />
      <div className="min-w-0 flex-1">
        <p className="sb-label text-sm font-bold leading-5 line-clamp-2">{name}</p>
        {!projecting && (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={`Copiar código de la clase ${code}`}
            className="sb-focus sb-label relative mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-white/15 before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:bg-white/15"
          >
            <span className="font-mono tracking-wide">{code}</span>
            {copied ? <Check size={12} className="text-emerald-300" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
};
