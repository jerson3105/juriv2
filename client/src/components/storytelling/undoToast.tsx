import toast from 'react-hot-toast';
import { errorMessage } from './storyEditorHelpers';

// Aviso con "Deshacer" (8 s): la acción ya se hizo; el botón ejecuta la inversa.
export const showUndoToast = (message: string, undo: () => Promise<unknown>, done?: () => void) => {
  toast.success((t) => (
    <span className="flex items-center gap-3">
      <span>{message}</span>
      <button
        type="button"
        onClick={async () => {
          toast.dismiss(t.id);
          try {
            await undo();
            done?.();
            toast.success('Cambio deshecho');
          } catch (e) {
            toast.error(errorMessage(e, 'No se pudo deshacer'));
          }
        }}
        className="min-h-[36px] shrink-0 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
      >
        Deshacer
      </button>
    </span>
  ), { duration: 8000 });
};
