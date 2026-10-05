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
  /** El año en curso (null antes del primero o entre el cierre de uno y el inicio del siguiente). */
  activeYear: SchoolYearSummary | null;
  /** El año que se mira en la consola (selector de la barra): el activo, el que se prepara o uno archivado. */
  selectedYear: SchoolYearSummary | null;
  selectYear: (yearId: string) => void;
  yearsLoading: boolean;
  /** Áreas que coordino en el año activo (vacío si ninguna). */
  coordinations: MyCoordination[];
}

export const useSchoolConsole = () => useOutletContext<SchoolConsoleContext>();
