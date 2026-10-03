import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { avatarItems, bugReports, classrooms, expeditionMaps, schoolVerifications, schools, users } from '../db/schema.js';

const SLOTS = ['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND'] as const;
const n = (value: unknown) => Number(value ?? 0);

/**
 * Lo que el inicio y el menú del panel necesitan, en una sola petición y con cada cifra separada por lo
 * que cuenta (antes /admin/stats sumaba familias y admin en «usuarios» y contaba todas las clases como activas).
 */
export const adminOverviewService = {
  async get() {
    const [roleRows, teacherRows, unverifiedWithClasses, classRows, itemRows, publishedRows, schoolRows, pendingSchools, reportRows, mapRows] = await Promise.all([
      db.select({ role: users.role, active: users.isActive, total: count() }).from(users).groupBy(users.role, users.isActive),
      db.select({ status: users.teacherStatus, total: count() }).from(users)
        .where(and(eq(users.role, 'TEACHER'), eq(users.isActive, true))).groupBy(users.teacherStatus),
      db.select({ total: sql<number>`COUNT(DISTINCT ${classrooms.teacherId})` }).from(classrooms)
        .innerJoin(users, eq(users.id, classrooms.teacherId))
        .where(and(eq(users.role, 'TEACHER'), eq(users.teacherStatus, 'UNVERIFIED'), eq(classrooms.isActive, true))),
      db.select({ active: classrooms.isActive, total: count() }).from(classrooms).groupBy(classrooms.isActive),
      db.select({
        published: sql<number>`SUM(${avatarItems.isActive} = 1)`,
        drafts: sql<number>`SUM(${avatarItems.isActive} = 0 AND ${avatarItems.publishedAt} IS NULL)`,
        retired: sql<number>`SUM(${avatarItems.isActive} = 0 AND ${avatarItems.publishedAt} IS NOT NULL)`,
      }).from(avatarItems),
      db.select({ slot: avatarItems.slot, gender: avatarItems.gender, total: count() }).from(avatarItems)
        .where(eq(avatarItems.isActive, true)).groupBy(avatarItems.slot, avatarItems.gender),
      db.select({ verified: schools.isVerified, total: count() }).from(schools).where(eq(schools.isActive, true)).groupBy(schools.isVerified),
      db.select({ total: count() }).from(schoolVerifications).where(eq(schoolVerifications.status, 'PENDING')),
      db.select({ status: bugReports.status, priority: bugReports.priority, total: count() }).from(bugReports).groupBy(bugReports.status, bugReports.priority),
      db.select({ active: expeditionMaps.isActive, total: count() }).from(expeditionMaps).groupBy(expeditionMaps.isActive),
    ]);

    const byRole = (role: string) => roleRows.filter((row) => row.role === role).reduce((sum, row) => sum + n(row.total), 0);
    const teacherStatus = (status: string | null) => n(teacherRows.find((row) => row.status === status)?.total);
    const published = new Set(publishedRows.map((row) => `${row.slot}:${row.gender}`));
    const holes = SLOTS.flatMap((slot) => (['MALE', 'FEMALE'] as const)
      .filter((gender) => !published.has(`${slot}:${gender}`))
      .map((gender) => ({ slot, gender })));
    const reports = (status: string) => reportRows.filter((row) => row.status === status).reduce((sum, row) => sum + n(row.total), 0);

    return {
      users: {
        total: roleRows.reduce((sum, row) => sum + n(row.total), 0),
        admins: byRole('ADMIN'),
        teachers: byRole('TEACHER'),
        students: byRole('STUDENT'),
        parents: byRole('PARENT'),
        inactive: roleRows.filter((row) => !row.active).reduce((sum, row) => sum + n(row.total), 0),
      },
      teachers: {
        verified: teacherStatus('VERIFIED'),
        // Sin verificar: UNVERIFIED o sin estado (cuentas anteriores a la verificación).
        unverified: teacherStatus('UNVERIFIED') + teacherStatus(null),
        pendingRequests: teacherStatus('PENDING'),
        unverifiedWithClasses: n(unverifiedWithClasses[0]?.total),
      },
      classrooms: {
        active: n(classRows.find((row) => row.active)?.total),
        archived: n(classRows.find((row) => !row.active)?.total),
      },
      avatarItems: {
        published: n(itemRows[0]?.published),
        drafts: n(itemRows[0]?.drafts),
        retired: n(itemRows[0]?.retired),
        holes,
      },
      schools: {
        verified: n(schoolRows.find((row) => row.verified)?.total),
        unverified: n(schoolRows.find((row) => !row.verified)?.total),
        pendingVerifications: n(pendingSchools[0]?.total),
      },
      bugReports: {
        pending: reports('PENDING'),
        inProgress: reports('IN_PROGRESS'),
        criticalPending: n(reportRows.find((row) => row.status === 'PENDING' && row.priority === 'CRITICAL')?.total),
      },
      expeditionMaps: {
        active: n(mapRows.find((row) => row.active)?.total),
        hidden: n(mapRows.find((row) => !row.active)?.total),
      },
    };
  },
};
