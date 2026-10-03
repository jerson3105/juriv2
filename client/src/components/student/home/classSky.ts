import { CONSTELLATIONS, type Constellation } from '../../observatorio/descanso/constellations';
import { seedOf } from './studentHomeHelpers';

const SMALL_SKIES = CONSTELLATIONS.filter((constellation) => constellation.small);

/** El cielo de una clase: el mismo en el Inicio del alumno y en la banda del menú (profe y alumnos). */
export const classSkyFor = (classroomId: string): Constellation => SMALL_SKIES[seedOf(classroomId) % SMALL_SKIES.length];

/** Estrellas encendidas según el avance del nivel; la quinta se enciende al subir de nivel. */
export const litStarsFor = (percent: number) => Math.min(4, 1 + Math.floor(percent / 25));
