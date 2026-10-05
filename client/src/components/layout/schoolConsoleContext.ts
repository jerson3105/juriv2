import { useOutletContext } from 'react-router-dom';
import type { MySchool } from '../../lib/schoolApi';
import type { SchoolYearSummary } from '../../lib/schoolYearApi';
import type { MyCoordination } from '../../lib/schoolCoordinatorApi';

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
  /** Áreas que coordino en el año activo (vacío si ninguna). */
  coordinations: MyCoordination[];
}

export const useSchoolConsole = () => useOutletContext<SchoolConsoleContext>();
