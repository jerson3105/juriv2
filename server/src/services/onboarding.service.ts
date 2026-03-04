import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { teacherOnboarding, classrooms, users } from '../db/schema.js';
import type { TeacherOnboarding } from '../db/schema.js';

// ── Feature constants ──

export const ALL_FEATURES = [
  'students',
  'behaviors',
  'rankings',
  'grades',
  'settings',
  'badges',
  'shop',
  'clans',
  'attendance',
  'collectibles',
  'storytelling',
  'expedition',
  'question_bank',
  'activities',
] as const;

export type Feature = (typeof ALL_FEATURES)[number];

const DAY_0_FEATURES: Feature[] = ['students', 'behaviors', 'rankings', 'grades', 'settings'];

// Unlock schedule: [days after completedAt, features[]]
const UNLOCK_SCHEDULE: Array<{ daysAfter: number; features: Feature[] }> = [
  { daysAfter: 14, features: ['badges', 'shop'] },
  { daysAfter: 21, features: ['clans', 'attendance'] },
  { daysAfter: 28, features: ['collectibles', 'storytelling', 'expedition', 'question_bank', 'activities'] },
];

// ── Helpers ──

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/** Compute which features should be offered as pending unlocks based on elapsed time. */
function computePendingBySchedule(completedAt: Date, alreadyUnlocked: string[]): string[] {
  const elapsed = daysSince(completedAt);
  const pending: string[] = [];

  for (const tier of UNLOCK_SCHEDULE) {
    if (elapsed >= tier.daysAfter) {
      for (const f of tier.features) {
        if (!alreadyUnlocked.includes(f) && !pending.includes(f)) {
          pending.push(f);
        }
      }
    }
  }

  return pending;
}

function getLevelLabel(completedAt: Date | null): string {
  if (!completedAt) return 'Principiante';
  const days = daysSince(completedAt);
  if (days < 14) return 'Principiante';
  if (days < 28) return 'Intermedio';
  return 'Avanzado';
}

/** Safely coerce a JSON column to string[]. MySQL may return a raw JSON string. */
function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

/** Normalize all JSON array fields on a raw DB record. */
function normalizeRecord<T extends { unlockedFeatures: unknown; pendingUnlocks: unknown; newFeatures: unknown }>(r: T) {
  return {
    ...r,
    unlockedFeatures: safeArray(r.unlockedFeatures),
    pendingUnlocks: safeArray(r.pendingUnlocks),
    newFeatures: safeArray(r.newFeatures),
  };
}

// ── Service ──

class OnboardingService {

  /** Get onboarding record for a teacher. Returns null if none exists (pre-onboarding). */
  async get(teacherId: string): Promise<(TeacherOnboarding & { level: string }) | null> {
    const raw = await db.query.teacherOnboarding.findFirst({
      where: eq(teacherOnboarding.teacherId, teacherId),
    });

    if (!raw) return null;

    const record = normalizeRecord(raw);

    // If experienced, everything is unlocked — no schedule logic needed
    if (record.isExperienced) {
      return { ...record, level: 'Avanzado' };
    }

    // For progressive users, check if new pending unlocks are available
    if (record.completedAt) {
      const newPending = computePendingBySchedule(
        record.completedAt,
        [...record.unlockedFeatures, ...record.pendingUnlocks],
      );

      if (newPending.length > 0) {
        const updatedPending = [...record.pendingUnlocks, ...newPending];
        await db.update(teacherOnboarding)
          .set({ pendingUnlocks: updatedPending, updatedAt: new Date() })
          .where(eq(teacherOnboarding.id, record.id));

        return {
          ...record,
          pendingUnlocks: updatedPending,
          level: getLevelLabel(record.completedAt),
        };
      }

      return { ...record, level: getLevelLabel(record.completedAt) };
    }

    return { ...record, level: 'Principiante' };
  }

  /** Create the initial onboarding record (called on first teacher login / registration). */
  async create(teacherId: string): Promise<TeacherOnboarding> {
    const now = new Date();
    const id = uuidv4();

    // Teachers registered before this feature's deploy are pre-existing → skip onboarding
    const FEATURE_DEPLOY_DATE = new Date('2026-03-02T00:00:00Z');

    const [teacher] = await db.select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, teacherId))
      .limit(1);

    const registeredBeforeDeploy = teacher && teacher.createdAt < FEATURE_DEPLOY_DATE;

    // Also check if teacher already has classrooms
    const existingClassrooms = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacherId))
      .limit(1);

    const isExisting = registeredBeforeDeploy || existingClassrooms.length > 0;

    const values = {
      id,
      teacherId,
      isExperienced: isExisting,
      objective: 'unknown' as const,
      onboardingCompleted: isExisting,
      completedAt: isExisting ? now : null,
      unlockedFeatures: isExisting ? [...ALL_FEATURES] as string[] : [] as string[],
      pendingUnlocks: [] as string[],
      newFeatures: [] as string[],
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(teacherOnboarding).values(values);

    return values;
  }

  /** Mark the teacher as experienced — unlock everything immediately. */
  async markExperienced(teacherId: string): Promise<void> {
    const now = new Date();
    await db.update(teacherOnboarding)
      .set({
        isExperienced: true,
        onboardingCompleted: true,
        completedAt: now,
        unlockedFeatures: [...ALL_FEATURES],
        pendingUnlocks: [],
        newFeatures: [],
        updatedAt: now,
      })
      .where(eq(teacherOnboarding.teacherId, teacherId));
  }

  /** Save the teacher's objective selection. */
  async setObjective(teacherId: string, objective: 'participation' | 'behavior' | 'learning' | 'unknown'): Promise<void> {
    await db.update(teacherOnboarding)
      .set({ objective, updatedAt: new Date() })
      .where(eq(teacherOnboarding.teacherId, teacherId));
  }

  /** Complete the onboarding — enable Day 0 features and set completedAt. */
  async completeOnboarding(teacherId: string): Promise<void> {
    const now = new Date();
    await db.update(teacherOnboarding)
      .set({
        onboardingCompleted: true,
        completedAt: now,
        unlockedFeatures: [...DAY_0_FEATURES],
        pendingUnlocks: [],
        newFeatures: [],
        updatedAt: now,
      })
      .where(eq(teacherOnboarding.teacherId, teacherId));
  }

  /**
   * Activate pending features — move from pendingUnlocks to unlockedFeatures.
   * Also marks them as newFeatures so the sidebar can show "¡Nuevo!" badges.
   */
  async activateFeatures(teacherId: string, features: string[]): Promise<string[]> {
    const raw = await db.query.teacherOnboarding.findFirst({
      where: eq(teacherOnboarding.teacherId, teacherId),
    });
    if (!raw) throw new Error('Onboarding record not found');

    const record = normalizeRecord(raw);
    const validFeatures = features.filter(f => record.pendingUnlocks.includes(f));
    if (validFeatures.length === 0) return record.unlockedFeatures;

    const updatedUnlocked = [...record.unlockedFeatures, ...validFeatures];
    const updatedPending = record.pendingUnlocks.filter(f => !validFeatures.includes(f));
    const updatedNew = [...record.newFeatures, ...validFeatures];

    await db.update(teacherOnboarding)
      .set({
        unlockedFeatures: updatedUnlocked,
        pendingUnlocks: updatedPending,
        newFeatures: updatedNew,
        updatedAt: new Date(),
      })
      .where(eq(teacherOnboarding.id, record.id));

    return updatedUnlocked;
  }

  /**
   * Early unlock — teacher manually unlocks features before the schedule.
   * Moves directly to unlockedFeatures with "¡Nuevo!" badge.
   */
  async earlyUnlock(teacherId: string, features: string[]): Promise<string[]> {
    const raw = await db.query.teacherOnboarding.findFirst({
      where: eq(teacherOnboarding.teacherId, teacherId),
    });
    if (!raw) throw new Error('Onboarding record not found');

    const record = normalizeRecord(raw);
    const validFeatures = features.filter(
      f => ALL_FEATURES.includes(f as Feature) && !record.unlockedFeatures.includes(f),
    );
    if (validFeatures.length === 0) return record.unlockedFeatures;

    const updatedUnlocked = [...record.unlockedFeatures, ...validFeatures];
    const updatedPending = record.pendingUnlocks.filter(f => !validFeatures.includes(f));
    const updatedNew = [...record.newFeatures, ...validFeatures];

    await db.update(teacherOnboarding)
      .set({
        unlockedFeatures: updatedUnlocked,
        pendingUnlocks: updatedPending,
        newFeatures: updatedNew,
        updatedAt: new Date(),
      })
      .where(eq(teacherOnboarding.id, record.id));

    return updatedUnlocked;
  }

  /** Clear the "¡Nuevo!" badge for a specific feature after the teacher clicks on it. */
  async dismissNewBadge(teacherId: string, feature: string): Promise<void> {
    const raw = await db.query.teacherOnboarding.findFirst({
      where: eq(teacherOnboarding.teacherId, teacherId),
    });
    if (!raw) return;

    const record = normalizeRecord(raw);
    const updatedNew = record.newFeatures.filter(f => f !== feature);

    await db.update(teacherOnboarding)
      .set({ newFeatures: updatedNew, updatedAt: new Date() })
      .where(eq(teacherOnboarding.id, record.id));
  }

  /** Get features that are still locked and available for early unlock. */
  getLockedFeatures(unlockedFeatures: string[]): string[] {
    return ALL_FEATURES.filter(f => !unlockedFeatures.includes(f));
  }

  /** Get the unlock schedule with availability info for the unlock modal. */
  getUnlockScheduleInfo(completedAt: Date | null, unlockedFeatures: string[]) {
    const elapsed = completedAt ? daysSince(completedAt) : 0;

    return UNLOCK_SCHEDULE.map(tier => ({
      daysAfter: tier.daysAfter,
      features: tier.features,
      available: elapsed >= tier.daysAfter,
      daysRemaining: Math.max(0, tier.daysAfter - elapsed),
      allUnlocked: tier.features.every(f => unlockedFeatures.includes(f)),
    }));
  }
}

export const onboardingService = new OnboardingService();
