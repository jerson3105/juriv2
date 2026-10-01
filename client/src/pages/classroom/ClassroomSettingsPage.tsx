import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import type { Classroom, Student } from '../../lib/classroomApi';
import { tabButton } from '../../components/gradebook/gradebookHelpers';
import { ClassSection } from '../../components/settings/ClassSection';
import { GameRulesSection } from '../../components/settings/GameRulesSection';
import { ArchiveSection } from '../../components/settings/ArchiveSection';
import {
  CLASSROOM_SETTINGS_SECTIONS,
  DEFAULT_CLASSROOM_SETTINGS_SECTION,
  LEGACY_SETTINGS_REDIRECTS,
  isClassroomSettingsSection,
} from './classroomSettingsSections';

// Configuración de la clase. Cada ajuste se guarda solo: interruptores y opciones al instante
// (con Deshacer) y los grupos de números con el botón Guardar de su tarjeta.
export const ClassroomSettingsPage = () => {
  const { section } = useParams<{ section?: string }>();
  const { classroom } = useOutletContext<{ classroom: Classroom & { students?: Student[] } }>();

  if (section && LEGACY_SETTINGS_REDIRECTS[section]) {
    return <Navigate to={LEGACY_SETTINGS_REDIRECTS[section](classroom.id)} replace />;
  }
  if (!isClassroomSettingsSection(section)) {
    return <Navigate to={`/classroom/${classroom.id}/settings/${DEFAULT_CLASSROOM_SETTINGS_SECTION}`} replace />;
  }

  const current = CLASSROOM_SETTINGS_SECTIONS.find((item) => item.key === section)!;
  const students = (classroom.students ?? []).filter((s) => !s.isDemo);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <Settings size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configuración</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">{current.description}</p>
        </div>
      </div>

      <nav aria-label="Secciones de configuración" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CLASSROOM_SETTINGS_SECTIONS.map((item) => (
          <Link
            key={item.key}
            to={`/classroom/${classroom.id}/settings/${item.key}`}
            aria-current={item.key === section ? 'page' : undefined}
            className={`${tabButton(item.key === section)} inline-flex items-center`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {section === 'general' && <ClassSection classroom={classroom} />}
      {section === 'gamificacion' && <GameRulesSection classroom={classroom} students={students} />}
      {section === 'riesgo' && <ArchiveSection classroom={classroom} studentCount={students.length} />}
    </div>
  );
};
