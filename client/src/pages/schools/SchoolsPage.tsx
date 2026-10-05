import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { InviteLanding, SchoolList, SearchStep, VerificationStep } from '../../components/schools/JoinFlows';
import { canViewSchool, mySchoolsKey } from '../../components/schools/schoolHelpers';

type View =
  | { type: 'auto' }
  | { type: 'list' }
  | { type: 'search' }
  | { type: 'verify'; school: { id: string; name: string } }
  | { type: 'panel'; schoolId: string };

// Mi escuela: si solo tienes una escuela disponible entras directo a su consola (/escuela/:id);
// si no, ves tus escuelas, puedes unirte con un enlace/código o buscarla.
export const SchoolsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const invite = params.get('invite');
  // La consola manda aquí al responsable de una escuela por verificar: ?verificar=<id> abre ese paso.
  const verifyId = params.get('verificar');
  const [view, setView] = useState<View>({ type: 'auto' });
  const { data: schools = [], isLoading, isError, refetch } = useQuery({ queryKey: mySchoolsKey, queryFn: schoolApi.getMySchools });

  const clearInvite = () => {
    params.delete('invite');
    setParams(params, { replace: true });
  };

  if (invite) {
    return (
      <InviteLanding
        code={invite.toUpperCase()}
        onCancel={() => { clearInvite(); setView({ type: 'list' }); }}
        onDone={(schoolId) => { clearInvite(); navigate(`/escuela/${schoolId}`); }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando tu escuela">
        <div className="h-16 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudieron cargar tus escuelas.</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">Reintentar</button>
      </div>
    );
  }

  const viewable = schools.filter(canViewSchool);
  const toList = () => setView({ type: 'list' });
  const verify = (s: MySchool | { id: string; name: string }) => setView({ type: 'verify', school: { id: s.id, name: s.name } });

  const toVerify = verifyId && view.type === 'auto' ? schools.find((s) => s.id === verifyId) : undefined;
  if (toVerify) {
    return <VerificationStep school={{ id: toVerify.id, name: toVerify.name }} onBack={() => navigate(`/escuela/${toVerify.id}`)} onSent={toList} />;
  }

  // Una sola escuela disponible y nada más pendiente: directo a su consola.
  const single = viewable.length === 1 && schools.length === 1 ? viewable[0] : null;
  const panelSchool = view.type === 'panel'
    ? schools.find((s) => s.id === view.schoolId)
    : view.type === 'auto' ? single : undefined;

  if (panelSchool && canViewSchool(panelSchool)) return <Navigate to={`/escuela/${panelSchool.id}`} replace />;

  switch (view.type) {
    case 'search':
      return <SearchStep mySchools={schools} onBack={toList} />;
    case 'verify':
      return <VerificationStep school={view.school} onBack={toList} onSent={toList} />;
    default:
      return (
        <SchoolList
          schools={schools}
          onOpen={(s) => setView({ type: 'panel', schoolId: s.id })}
          onSearch={() => setView({ type: 'search' })}
          onInvite={(code) => { params.set('invite', code); setParams(params); }}
          onVerify={verify}
        />
      );
  }
};
