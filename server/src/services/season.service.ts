import { and, count, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attendanceRecords, badges, classrooms, collectibleAlbums, collectibleCards, completedAlbums, schools, schoolYears, studentBadges,
  studentCollectibles, studentProfiles,
} from '../db/schema.js';
import { classroomYearIds } from './schoolCalendar.service.js';

/**
 * Temporadas: lo que cada estudiante logró en una clase (su nivel, sus insignias, sus álbumes y cartas). Nunca puestos ni
 * oro. «Mis temporadas» muestra al estudiante sus clases de los años escolares cerrados; la gala de la clase, el modo
 * «Temporada» (cifras del año, reconocimientos que no compiten y el desfile de cada estudiante).
 */

type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
const RARITY_ORDER: Record<Rarity, number> = { LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3 };
// Asistencia perfecta: presente cada día que se tomó, en al menos el 80 % de los días de la clase y no menos de 5.
const PERFECT_MIN_DAYS = 5;
const PERFECT_SHARE = 0.8;
// La gala dibuja unas pocas por estudiante; el total va aparte.
const GALA_BADGES = 8;

export interface SeasonBadge { id: string; name: string; icon: string; customImage: string | null; rarity: Rarity; times: number }
export interface SeasonAlbum { id: string; name: string; coverImage: string | null; owned: number; total: number; completed: boolean }

/** Las insignias de unos perfiles; una acumulable cuenta sus veces. De la más rara a la más común y, entre iguales, la primera ganada. */
const badgesByProfile = async (profileIds: string[]) => {
  const result = new Map<string, SeasonBadge[]>();
  if (profileIds.length === 0) return result;
  const rows = await db.select({
    profileId: studentBadges.studentProfileId, id: badges.id, name: badges.name, icon: badges.icon, customImage: badges.customImage,
    rarity: badges.rarity, times: count(), first: sql<Date | string>`MIN(${studentBadges.unlockedAt})`,
  }).from(studentBadges)
    .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
    .where(inArray(studentBadges.studentProfileId, profileIds))
    .groupBy(studentBadges.studentProfileId, badges.id, badges.name, badges.icon, badges.customImage, badges.rarity);
  rows.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || new Date(a.first).getTime() - new Date(b.first).getTime());
  for (const row of rows) {
    const list = result.get(row.profileId) ?? [];
    list.push({ id: row.id, name: row.name, icon: row.icon, customImage: row.customImage, rarity: row.rarity, times: Number(row.times) });
    result.set(row.profileId, list);
  }
  return result;
};

/** Los álbumes de su clase donde cada perfil reunió alguna carta: cuántas distintas tiene y si lo completó. */
const albumsByProfile = async (profiles: Array<{ profileId: string; classroomId: string }>) => {
  const result = new Map<string, SeasonAlbum[]>();
  if (profiles.length === 0) return result;
  const profileIds = profiles.map((p) => p.profileId);
  const classOf = new Map(profiles.map((p) => [p.profileId, p.classroomId]));
  const [albums, owned, completed] = await Promise.all([
    db.select({
      id: collectibleAlbums.id, classroomId: collectibleAlbums.classroomId, name: collectibleAlbums.name, coverImage: collectibleAlbums.coverImage,
      total: count(collectibleCards.id),
    }).from(collectibleAlbums)
      .innerJoin(collectibleCards, eq(collectibleCards.albumId, collectibleAlbums.id))
      .where(inArray(collectibleAlbums.classroomId, [...new Set(classOf.values())]))
      .groupBy(collectibleAlbums.id, collectibleAlbums.classroomId, collectibleAlbums.name, collectibleAlbums.coverImage),
    db.select({
      profileId: studentCollectibles.studentProfileId, albumId: collectibleCards.albumId,
      owned: sql<number | string>`COUNT(DISTINCT ${studentCollectibles.cardId})`,
    }).from(studentCollectibles)
      .innerJoin(collectibleCards, eq(collectibleCards.id, studentCollectibles.cardId))
      .where(and(inArray(studentCollectibles.studentProfileId, profileIds), gt(studentCollectibles.quantity, 0)))
      .groupBy(studentCollectibles.studentProfileId, collectibleCards.albumId),
    db.select({ profileId: completedAlbums.studentProfileId, albumId: completedAlbums.albumId }).from(completedAlbums)
      .where(inArray(completedAlbums.studentProfileId, profileIds)),
  ]);
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const done = new Set(completed.map((row) => `${row.profileId}:${row.albumId}`));
  for (const row of owned) {
    const album = albumById.get(row.albumId);
    if (!album || album.classroomId !== classOf.get(row.profileId)) continue;
    const have = Number(row.owned);
    const total = Number(album.total);
    const list = result.get(row.profileId) ?? [];
    list.push({ id: album.id, name: album.name, coverImage: album.coverImage, owned: have, total, completed: done.has(`${row.profileId}:${album.id}`) || have >= total });
    result.set(row.profileId, list);
  }
  for (const list of result.values()) {
    list.sort((a, b) => Number(b.completed) - Number(a.completed) || b.owned / b.total - a.owned / a.total || a.name.localeCompare(b.name, 'es'));
  }
  return result;
};

export const seasonService = {
  /**
   * «Mis temporadas»: los perfiles del estudiante (el usuario sale del token) en clases archivadas de un año escolar ya
   * cerrado, agrupados por año (el más reciente primero).
   */
  async mine(userId: string) {
    const rows = await db.select({
      profileId: studentProfiles.id, level: studentProfiles.level, classroomId: classrooms.id, className: classrooms.name,
    }).from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(and(
        eq(studentProfiles.userId, userId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false),
        eq(classrooms.isActive, false), isNotNull(classrooms.schoolId),
      ));
    if (rows.length === 0) return [];
    const yearOf = await classroomYearIds(rows.map((row) => row.classroomId));
    const yearIds = [...new Set(yearOf.values())];
    if (yearIds.length === 0) return [];
    const years = await db.select({ id: schoolYears.id, name: schoolYears.name, startsOn: schoolYears.startsOn, school: schools.name })
      .from(schoolYears)
      .innerJoin(schools, eq(schools.id, schoolYears.schoolId))
      .where(and(inArray(schoolYears.id, yearIds), eq(schoolYears.status, 'CLOSED')));
    const closed = new Set(years.map((year) => year.id));
    const seasonal = rows.filter((row) => closed.has(yearOf.get(row.classroomId) ?? ''));
    if (seasonal.length === 0) return [];

    const profileIds = seasonal.map((row) => row.profileId);
    const [badgeMap, albumMap] = await Promise.all([
      badgesByProfile(profileIds),
      albumsByProfile(seasonal.map((row) => ({ profileId: row.profileId, classroomId: row.classroomId }))),
    ]);
    const classesByYear = new Map<string, Array<{ classroomId: string; name: string; level: number; badges: SeasonBadge[]; albums: SeasonAlbum[]; cards: number }>>();
    for (const row of seasonal) {
      const yearId = yearOf.get(row.classroomId)!;
      const albums = albumMap.get(row.profileId) ?? [];
      const list = classesByYear.get(yearId) ?? [];
      list.push({
        classroomId: row.classroomId, name: row.className, level: row.level,
        badges: badgeMap.get(row.profileId) ?? [],
        albums,
        cards: albums.reduce((sum, album) => sum + album.owned, 0),
      });
      classesByYear.set(yearId, list);
    }
    return years
      .filter((year) => classesByYear.has(year.id))
      .sort((a, b) => String(b.startsOn).localeCompare(String(a.startsOn)))
      .map((year) => ({
        yearId: year.id, year: year.name, school: year.school,
        classes: classesByYear.get(year.id)!.sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }));
  },

  /** La temporada de una clase para su gala: cifras del año y, por estudiante activo, su nivel, insignias, cartas y asistencia. */
  async classroom(classroomId: string) {
    const profiles = await db.select({ id: studentProfiles.id, level: studentProfiles.level, xp: studentProfiles.xp })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)));
    if (profiles.length === 0) {
      return { stats: { students: 0, xp: 0, badges: 0, cards: 0, albumsCompleted: 0, attendanceDays: 0 }, students: [] };
    }
    const ids = profiles.map((profile) => profile.id);
    const [badgeMap, albumMap, attendance, [days]] = await Promise.all([
      badgesByProfile(ids),
      albumsByProfile(ids.map((profileId) => ({ profileId, classroomId }))),
      db.select({
        profileId: attendanceRecords.studentProfileId,
        present: sql<number | string>`SUM(${attendanceRecords.status} = 'PRESENT')`,
        missed: sql<number | string>`SUM(${attendanceRecords.status} <> 'PRESENT')`,
      }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.classroomId, classroomId), eq(attendanceRecords.isReverted, false), inArray(attendanceRecords.studentProfileId, ids)))
        .groupBy(attendanceRecords.studentProfileId),
      db.select({ days: sql<number | string>`COUNT(DISTINCT DATE(${attendanceRecords.date}))` }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.classroomId, classroomId), eq(attendanceRecords.isReverted, false))),
    ]);
    const attendanceDays = Number(days?.days ?? 0);
    const minimum = Math.max(PERFECT_MIN_DAYS, Math.ceil(attendanceDays * PERFECT_SHARE));
    const attendanceOf = new Map(attendance.map((row) => [row.profileId, { present: Number(row.present ?? 0), missed: Number(row.missed ?? 0) }]));
    const students = profiles.map((profile) => {
      const earned = badgeMap.get(profile.id) ?? [];
      const albums = albumMap.get(profile.id) ?? [];
      const days = attendanceOf.get(profile.id);
      return {
        id: profile.id,
        level: profile.level,
        badgeCount: earned.reduce((sum, badge) => sum + badge.times, 0),
        badges: earned.slice(0, GALA_BADGES),
        cards: albums.reduce((sum, album) => sum + album.owned, 0),
        albumsCompleted: albums.filter((album) => album.completed).length,
        perfectAttendance: !!days && days.missed === 0 && days.present >= minimum,
      };
    });
    return {
      stats: {
        students: profiles.length,
        xp: profiles.reduce((sum, profile) => sum + Math.max(0, profile.xp), 0),
        badges: students.reduce((sum, student) => sum + student.badgeCount, 0),
        cards: students.reduce((sum, student) => sum + student.cards, 0),
        albumsCompleted: students.reduce((sum, student) => sum + student.albumsCompleted, 0),
        attendanceDays,
      },
      students,
    };
  },
};
