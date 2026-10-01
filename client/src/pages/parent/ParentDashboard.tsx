import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Plus } from 'lucide-react';
import LinkChildModal from './LinkChildModal';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import ChildDetailPage from './ChildDetailPage';
import { verificationApi } from '../../lib/verificationApi';
import { primaryButton } from '../../components/home/homeHelpers';

export default function ParentDashboard() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const { children, isLoading } = useSelectedClassroom();
  const { data: pending = [] } = useQuery({ queryKey: ['parent-pending-links'], queryFn: verificationApi.getMyPendingLinks });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-40 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // Si hay hijos vinculados, mostrar el detalle del hijo seleccionado directamente
  if (children.length > 0) {
    return <ChildDetailPage />;
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/30 dark:bg-sky-400/10" aria-labelledby="pending-title">
          <h2 id="pending-title" className="flex items-center gap-2 font-bold text-sky-950 dark:text-sky-50">
            <Clock size={18} aria-hidden="true" /> Esperando aprobación del docente
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-sky-950 dark:text-sky-50">
            {pending.map((p) => (
              <li key={p.linkId}>{p.studentName ?? 'Tu hijo o hija'} · {p.classroomName}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-sky-950 dark:text-sky-50">Cuando el docente confirme, verás aquí su progreso.</p>
        </section>
      )}

      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
          <span className="text-4xl">👨‍👩‍👧</span><span className="text-5xl">🎒</span><span className="text-4xl">⭐</span>
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Vincula a tu hijo o hija</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
          Pide al docente el código familiar. Es distinto del código de la clase.
        </p>
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => setShowLinkModal(true)} className={primaryButton}>
            <Plus size={16} aria-hidden="true" /> Ingresar código familiar
          </button>
        </div>
      </div>

      {showLinkModal && <LinkChildModal onClose={() => setShowLinkModal(false)} />}
    </div>
  );
}
