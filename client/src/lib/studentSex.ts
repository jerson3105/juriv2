/** Sexo del estudiante en el padrón del colegio, como en el SIAGIE (Mujer / Hombre). null = sin registrar. */
export type StudentSex = 'FEMALE' | 'MALE';

export const SEX_LABEL: Record<StudentSex, string> = { FEMALE: 'Mujer', MALE: 'Hombre' };

/** «17 mujeres · 15 hombres» (y «· 2 sin registrar» si hay); null si nadie tiene el dato registrado. */
export const sexSummary = (counts: { women: number; men: number; unknown?: number }) => {
  if (counts.women + counts.men === 0) return null;
  return [
    `${counts.women} ${counts.women === 1 ? 'mujer' : 'mujeres'}`,
    `${counts.men} ${counts.men === 1 ? 'hombre' : 'hombres'}`,
    counts.unknown ? `${counts.unknown} sin registrar` : null,
  ].filter(Boolean).join(' · ');
};

/** Cuenta mujeres, hombres y sin registrar de una lista. */
export const countBySex = (items: Array<{ sex?: StudentSex | null }>) => ({
  women: items.filter((i) => i.sex === 'FEMALE').length,
  men: items.filter((i) => i.sex === 'MALE').length,
  unknown: items.filter((i) => !i.sex).length,
});
