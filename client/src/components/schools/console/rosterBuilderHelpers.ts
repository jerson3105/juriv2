import type { BuilderDecision, BuilderGroup, NameSplit, NameStrings } from '../../../lib/schoolRosterBuilderApi';

export const splitToStrings = (split: NameSplit): NameStrings => ({ lastNames: split.lastNames.join(' '), firstNames: split.firstNames.join(' ') });
export const stringsToSplit = (names: NameStrings): NameSplit => ({
  lastNames: names.lastNames.split(/\s+/).filter(Boolean),
  firstNames: names.firstNames.split(/\s+/).filter(Boolean),
});

/** Letra de cada persona posible en un grupo «Revisar». */
export const personLetter = (index: number) => String.fromCharCode(65 + index);

/** Decidida: Segura y Probable con su decisión; Revisar con todos sus perfiles sueltos asignados. */
export const isDecided = (group: BuilderGroup, decision: BuilderDecision | undefined) => {
  if (!decision) return false;
  if (group.kind === 'REVIEW') return decision.kind === 'REVIEW' && (group.loose ?? []).every((id) => decision.assignments[id] !== undefined);
  return decision.kind === group.kind;
};

/** Lo que dejará el armado (el mismo cálculo del servidor): estudiantes nuevos y perfiles vinculados. */
export const summarize = (groups: BuilderGroup[], decisions: Record<string, BuilderDecision>) => {
  let created = 0;
  let linked = 0;
  let undecidedProbable = 0;
  let pendingReview = 0;
  for (const group of groups) {
    const decision = decisions[group.key];
    linked += group.profiles.length;
    if (group.kind === 'SAFE') {
      created += group.anchor ? 0 : 1;
    } else if (group.kind === 'PROBABLE') {
      if (decision?.kind === 'PROBABLE' && decision.action === 'split') {
        created += (group.parts ?? []).filter((part) => part.profileIds.length > 0 && !part.anchorStudentId).length;
      } else {
        created += group.anchor ? 0 : 1;
        if (!decision) undecidedProbable++;
      }
    } else {
      created += (group.people ?? []).filter((person) => !person.anchorStudentId).length;
      if (decision?.kind === 'REVIEW') created += (group.loose ?? []).filter((id) => decision.assignments[id] === 'new').length;
      if (!isDecided(group, decision)) pendingReview++;
    }
  }
  return { created, linked, undecidedProbable, pendingReview };
};

/** «Matemática 3.° C · MP»: clase con las iniciales de su docente. */
export const classWithTeacher = (profile: { classroomName: string; teacher: string | null }) => {
  const initials = (profile.teacher ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return initials ? `${profile.classroomName} · ${initials}` : profile.classroomName;
};
