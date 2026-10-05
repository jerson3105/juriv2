import { useOutletContext } from 'react-router-dom';
import type { MySchool } from '../../lib/schoolApi';
import type { SchoolYearSummary } from '../../lib/schoolYearApi';

/** Lo que SchoolLayout comparte con las páginas de la consola. */
export interface SchoolConsoleContext {
  school: MySchool;
  /** Responsable o administración, verificados. */
  manager: boolean;
  /** Miembro verificado (el responsable de una escuela por verificar aún no lo es). */
  verified: boolean;
  years: SchoolYearSummary[];
  activeYear: SchoolYearSummary | null;
  yearsLoading: boolean;
}

export const useSchoolConsole = () => useOutletContext<SchoolConsoleContext>();
