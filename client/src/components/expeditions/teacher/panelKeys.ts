import type { TeacherExpedition, TeacherStop } from '../../../lib/expeditionApi';

/**
 * Claves para montar de nuevo los paneles cuando cambia lo guardado (al cambiar de parada o al guardar), sin
 * perder lo que el docente está escribiendo cuando solo cambian los conteos de avance.
 */
export const stopPanelKey = (stop: TeacherStop) => JSON.stringify({ ...stop, stats: null });

export const settingsPanelKey = (expedition: TeacherExpedition) => JSON.stringify([
  expedition.id, expedition.name, expedition.description, expedition.closingText, expedition.finishXp, expedition.finishGold,
  expedition.scenario, expedition.constellationId, expedition.mapImageUrl, expedition.stops.length,
]);
