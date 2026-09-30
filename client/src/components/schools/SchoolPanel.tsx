import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Award, BarChart3, BookOpen, CheckCircle2, Clock, GraduationCap, LayoutDashboard, MapPin, School, UserPlus, Users } from 'lucide-react';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { useAuthStore } from '../../store/authStore';
import { TeachersTab } from './TeachersTab';
import { ClassesTab } from './ClassesTab';
import { LibraryTab } from './LibraryTab';
import { ReportsTab, SummaryTab } from './ReportsTab';
import { IDLE_DAYS, canManageSchool, isIdle, pendingRequestsKey, schoolDetailKey, schoolTeachersKey } from './schoolHelpers';

type Tab = 'summary' | 'teachers' | 'classes' | 'library' | 'reports';

const TABS: { id: Tab; label: string; icon: typeof Users; managerOnly?: boolean }[] = [
  { id: 'summary', label: 'Resumen', icon: LayoutDashboard, managerOnly: true },
  { id: 'teachers', label: 'Profesores', icon: Users },
  { id: 'classes', label: 'Clases', icon: GraduationCap },
  { id: 'library', label: 'Biblioteca', icon: Award },
  { id: 'reports', label: 'Informes', icon: BarChart3, managerOnly: true },
];

interface SchoolPanelProps {
  school: MySchool;
  onBack?: () => void; // a "Mis escuelas" (unirse a otra, estados pendientes)
  onVerify: () => void;
}

// Panel de la escuela: el responsable ve qué atender y gestiona; los profesores ven y usan la biblioteca.
export const SchoolPanel = ({ school, onBack, onVerify }: SchoolPanelProps) => {
  const { user } = useAuthStore();
  const manage = canManageSchool(school);
  const [tab, setTab] = useState<Tab>(manage ? 'summary' : 'classes');

  const { data: detail, isLoading: loadingDetail } = useQuery({ queryKey: schoolDetailKey(school.id), queryFn: () => schoolApi.getDetail(school.id) });
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({ queryKey: schoolTeachersKey(school.id), queryFn: () => schoolApi.getSchoolTeachers(school.id) });
  const { data: requests = [] } = useQuery({ queryKey: pendingRequestsKey(school.id), queryFn: () => schoolApi.getPendingRequests(school.id), enabled: manage });

  const classrooms = detail?.classrooms ?? [];
  const students = classrooms.reduce((s, c) => s + c.studentCount, 0);
  const idleClasses = classrooms.filter((c) => isIdle(c.lastActivityAt, c.studentCount));
  const teachersWithoutClasses = teachers.filter((t) => !classrooms.some((c) => c.teacherId === t.userId));
  const myClassrooms = classrooms.filter((c) => c.teacherId === user?.id);
  const tabs = TABS.filter((t) => manage || !t.managerOnly);
  const pendingAdmin = school.memberRole === 'OWNER' && school.memberStatus === 'PENDING_ADMIN';

  const attention = manage ? [
    requests.length > 0 && { icon: UserPlus, text: `${requests.length} ${requests.length === 1 ? 'solicitud para unirse' : 'solicitudes para unirse'}`, go: 'teachers' as Tab },
    teachersWithoutClasses.length > 0 && { icon: Users, text: `${teachersWithoutClasses.length} ${teachersWithoutClasses.length === 1 ? 'profesor sin clases' : 'profesores sin clases'} en la escuela`, go: 'teachers' as Tab },
    idleClasses.length > 0 && { icon: Clock, text: `${idleClasses.length} ${idleClasses.length === 1 ? 'clase' : 'clases'} sin puntos en ${IDLE_DAYS} días`, go: 'classes' as Tab },
  ].filter(Boolean) as { icon: typeof Users; text: string; go: Tab }[] : [];

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <header className="flex items-start gap-3">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Mis escuelas" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md" aria-hidden="true"><School size={24} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{school.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
            {(school.city || school.country) && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden="true" />{[school.city, school.country].filter(Boolean).join(', ')}</span>}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${school.isVerified ? 'bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'}`}>
              {school.isVerified ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}
              {school.isVerified ? 'Verificada' : 'Pendiente de verificación'}
            </span>
            {school.memberRole === 'OWNER' && <span className="text-xs font-bold text-primary-800 dark:text-primary-200">Eres el responsable</span>}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: 'Profesores', value: loadingTeachers ? '—' : teachers.length, icon: Users },
          { label: 'Clases', value: loadingDetail ? '—' : classrooms.length, icon: BookOpen },
          { label: 'Estudiantes', value: loadingDetail ? '—' : students, icon: GraduationCap },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <s.icon size={20} className="hidden flex-shrink-0 text-primary-700 dark:text-primary-300 sm:block" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{s.label}</dt>
              <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{s.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {pendingAdmin && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            <strong>Tu escuela está pendiente de verificación.</strong> Mientras tanto ves tus clases; los informes, las invitaciones y la biblioteca se activan cuando Juried la verifique.
          </p>
          <button type="button" onClick={onVerify} className="min-h-[44px] flex-shrink-0 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white hover:bg-amber-950">Enviar verificación</button>
        </div>
      )}

      {manage && (
        <section aria-label="Por atender" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
            <AlertTriangle size={16} aria-hidden="true" />
            Por atender
          </h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-200"><CheckCircle2 size={16} aria-hidden="true" />Todo al día.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {attention.map((a) => (
                <li key={a.text}>
                  <button type="button" onClick={() => setTab(a.go)} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-100 px-3 text-sm font-semibold text-amber-950 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60">
                    <a.icon size={16} aria-hidden="true" />
                    {a.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Pestañas (desplazables en móvil) */}
      <div role="tablist" aria-label="Secciones de la escuela" className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-700 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative flex min-h-[44px] flex-shrink-0 items-center gap-2 px-4 text-sm font-semibold ${active ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
              {t.id === 'teachers' && manage && requests.length > 0 && <span className="rounded-full bg-amber-700 px-1.5 text-xs font-bold text-white">{requests.length}</span>}
              {active && <motion.span layoutId="school-tab" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-600 dark:bg-primary-300" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === 'summary' && manage && <SummaryTab schoolId={school.id} onOpenReports={() => setTab('reports')} />}
        {tab === 'teachers' && (
          <TeachersTab school={school} manage={manage} currentUserId={user?.id} teachers={teachers} classrooms={classrooms} requests={requests} inviteCode={detail?.inviteCode ?? null} isLoading={loadingTeachers} />
        )}
        {tab === 'classes' && <ClassesTab schoolId={school.id} manage={manage} classrooms={classrooms} isLoading={loadingDetail} />}
        {tab === 'library' && <LibraryTab schoolId={school.id} manage={manage} myClassrooms={myClassrooms} />}
        {tab === 'reports' && manage && <ReportsTab schoolId={school.id} schoolName={school.name} classrooms={classrooms} />}
      </div>
    </div>
  );
};
