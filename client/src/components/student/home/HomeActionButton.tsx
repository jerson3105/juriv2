import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { HomeAction } from './nextGoal';

export type HomeModalKind = Exclude<HomeAction['kind'], 'link'>;

interface HomeActionButtonProps {
  action: HomeAction;
  className: string;
  onOpen: (kind: HomeModalKind) => void;
  arrow?: boolean;
}

/** Un botón del inicio: enlace a otra página o apertura de un modal del propio inicio. */
export const HomeActionButton = ({ action, className, onOpen, arrow = false }: HomeActionButtonProps) => {
  const content = (
    <>
      {action.label}
      {arrow && <ArrowRight size={16} aria-hidden="true" />}
    </>
  );
  if (action.kind === 'link') return <Link to={action.to} className={className}>{content}</Link>;
  const kind = action.kind;
  return (
    <button type="button" onClick={() => onOpen(kind)} aria-haspopup="dialog" className={className}>
      {content}
    </button>
  );
};
