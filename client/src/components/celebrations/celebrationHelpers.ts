import type { QueryClient } from '@tanstack/react-query';
import type { ApplyResult } from '../../lib/behaviorApi';
import type { Badge } from '../../lib/badgeApi';
import type { CharacterClassData } from '../../lib/characterClassApi';
import type { Classroom, Student } from '../../lib/classroomApi';
import { studentNames } from '../students/profile/profileHelpers';
import { useCelebrationStore, type CelebrationBadge, type CelebrationLevelUp } from '../../store/celebrationStore';

export const levelUpsTodayKey = (classroomId: string) => ['level-ups-today', classroomId] as const;

/** Nombre (según la configuración de la clase) e ícono de clase de personaje, desde las cachés. */
const studentLookup = (queryClient: QueryClient, classroomId: string) => {
  const classroom = queryClient.getQueryData<Classroom & { students?: Student[] }>(['classroom', classroomId]);
  const classes = queryClient.getQueryData<CharacterClassData[]>(['character-classes', classroomId]) ?? [];
  const students = new Map((classroom?.students ?? []).map((s) => [s.id, s]));
  return (studentId: string, fallback: string) => {
    const student = students.get(studentId);
    if (!student) return { name: fallback, icon: null };
    const cls = classes.find((c) => c.id === student.characterClassId) ?? classes.find((c) => c.key === student.characterClass);
    return { name: studentNames(student, classroom?.showCharacterName).primary, icon: cls?.icon ?? null };
  };
};

const refreshToday = (queryClient: QueryClient, classroomId: string) =>
  void queryClient.invalidateQueries({ queryKey: levelUpsTodayKey(classroomId) });

/** Subidas de nivel e insignias de una acción → una sola celebración. Devuelve si hubo algo que celebrar. */
export const celebrateApplyResult = (queryClient: QueryClient, classroomId: string, result: ApplyResult) => {
  const who = studentLookup(queryClient, classroomId);
  const levelUps: CelebrationLevelUp[] = (result.levelUps ?? []).map((l) => ({
    key: l.studentId,
    ...who(l.studentId, l.studentName),
    from: l.fromLevel ?? l.newLevel - 1,
    to: l.newLevel,
  }));
  const badges = new Map<string, CelebrationBadge>();
  for (const award of result.awardedBadges ?? []) {
    const recipient = who(award.studentId, 'Estudiante').name;
    for (const b of award.badges) {
      const entry = badges.get(b.id) ?? { key: b.id, name: b.name, icon: b.icon, customImage: b.customImage, rarity: b.rarity, recipients: [] };
      entry.recipients.push(recipient);
      badges.set(b.id, entry);
    }
  }
  if (levelUps.length > 0) refreshToday(queryClient, classroomId);
  if (levelUps.length === 0 && badges.size === 0) return false;
  useCelebrationStore.getState().celebrate({ audience: 'class', levelUps, badges: [...badges.values()], context: result.behavior?.name });
  return true;
};

/** Subidas sueltas (puntos manuales). */
export const celebrateLevelUps = (
  queryClient: QueryClient,
  classroomId: string,
  items: { studentId: string; studentName: string; from: number; to: number }[],
  context?: string,
) => {
  if (items.length === 0) return false;
  const who = studentLookup(queryClient, classroomId);
  refreshToday(queryClient, classroomId);
  useCelebrationStore.getState().celebrate({
    audience: 'class',
    levelUps: items.map((i) => ({ key: i.studentId, ...who(i.studentId, i.studentName), from: i.from, to: i.to })),
    badges: [],
    context,
  });
  return true;
};

/** Insignia entregada a mano (Lista o Insignias). */
export const celebrateBadgeAward = (badge: Pick<Badge, 'id' | 'name' | 'icon' | 'customImage' | 'rarity'>, recipients: string[]) => {
  useCelebrationStore.getState().celebrate({
    audience: 'class',
    levelUps: [],
    badges: [{ key: badge.id, name: badge.name, icon: badge.icon, customImage: badge.customImage, rarity: badge.rarity, recipients }],
  });
};
