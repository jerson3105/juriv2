import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classrooms, schoolMembers, schools, studentProfiles, users, verifiedDomains } from '../db/schema.js';
import { cache, CACHE_KEYS } from '../utils/cache.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { revokeAllUserTokens } from '../utils/jwt.js';

type TeacherStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
type VerifiedVia = 'LEGACY' | 'ADMIN' | 'SCHOOL' | 'DOMAIN';

const STALE_DAYS = 180;

export const UNVERIFIED_CLASS_MESSAGE =
  'Tu profe aún está verificando su cuenta de docente. Mientras tanto, la clase funciona con la lista: avísale para que la verifique.';

const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';
const normalizeDomain = (value: string) => value.trim().toLowerCase().replace(/^@/, '');

// Correos personales: cualquiera puede tener uno, no sirven para verificar (con los de PE/GT/EC/MX).
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx',
  'msn.com', 'yahoo.com', 'yahoo.es', 'yahoo.com.mx', 'ymail.com', 'icloud.com', 'me.com', 'aol.com',
  'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com', 'prodigy.net.mx',
]);

/**
 * Por dominio solo se verifican cuentas de Google: Google comprobó que la persona es dueña del correo. Una
 * cuenta con contraseña nunca confirmó su correo (cualquiera pudo escribir profe@colegio.edu.pe), así que
 * espera sin verificar hasta entrar con Google o pedir revisión.
 */
type Provider = 'LOCAL' | 'GOOGLE' | 'PIN';

class TeacherVerificationService {
  private async isListedDomain(email: string): Promise<boolean> {
    const domain = domainOf(email);
    if (!domain) return false;
    const [match] = await db.select({ id: verifiedDomains.id }).from(verifiedDomains).where(eq(verifiedDomains.domain, domain)).limit(1);
    return !!match;
  }

  /** Estado con el que nace una cuenta docente: verificada si entra con Google con un correo institucional. */
  async initialStatusFor(email: string, provider: Provider): Promise<{ teacherStatus: TeacherStatus; teacherVerifiedVia: VerifiedVia | null; teacherVerifiedAt: Date | null }> {
    if (provider === 'GOOGLE' && (await this.isListedDomain(email))) {
      return { teacherStatus: 'VERIFIED', teacherVerifiedVia: 'DOMAIN', teacherVerifiedAt: new Date() };
    }
    return { teacherStatus: 'UNVERIFIED', teacherVerifiedVia: null, teacherVerifiedAt: null };
  }

  /** Un docente con contraseña que ahora entra con Google: si su dominio está en la lista, queda verificado. */
  async verifyByGoogleDomain(userId: string, email: string): Promise<void> {
    if (await this.isListedDomain(email)) await this.markVerified(userId, 'DOMAIN');
  }

  /** ¿Puede este docente recibir alumnos con cuenta y familias? (el admin siempre). */
  async isVerified(teacherId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({ where: eq(users.id, teacherId), columns: { role: true, teacherStatus: true } });
    return !!user && (user.role === 'ADMIN' || user.teacherStatus === 'VERIFIED');
  }

  /** Cuentas de alumnos y de familias solo entran a clases de docentes verificados. */
  async assertClassroomAcceptsAccounts(classroomId: string): Promise<void> {
    const [row] = await db.select({ teacherId: classrooms.teacherId }).from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
    if (!row) throw new NotFoundError('Clase no encontrada');
    if (!(await this.isVerified(row.teacherId))) throw new ForbiddenError(UNVERIFIED_CLASS_MESSAGE);
  }

  async markVerified(userId: string, via: VerifiedVia): Promise<void> {
    await db.update(users)
      .set({ teacherStatus: 'VERIFIED', teacherVerifiedVia: via, teacherVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.role, 'TEACHER'), or(isNull(users.teacherStatus), sql`${users.teacherStatus} <> 'VERIFIED'`)));
    cache.delete(CACHE_KEYS.user(userId));
  }

  async getStatus(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true, teacherStatus: true, teacherVerifiedVia: true, teacherVerificationNote: true, teacherVerificationRequestedAt: true },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return {
      status: (user.role === 'ADMIN' ? 'VERIFIED' : user.teacherStatus ?? 'UNVERIFIED') as TeacherStatus,
      via: user.teacherVerifiedVia,
      note: user.teacherVerificationNote,
      requestedAt: user.teacherVerificationRequestedAt,
    };
  }

  /** El docente pide revisión al equipo de Juried (colegio y cómo comprobarlo). */
  async requestReview(userId: string, note: string) {
    const clean = note.trim();
    if (clean.length < 10) throw new ValidationError('Cuéntanos tu colegio y tu curso para poder revisarte');
    const current = await this.getStatus(userId);
    if (current.status === 'VERIFIED') throw new ConflictError('Tu cuenta ya está verificada');
    await db.update(users)
      .set({ teacherStatus: 'PENDING', teacherVerificationNote: clean.slice(0, 500), teacherVerificationRequestedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.role, 'TEACHER')));
    cache.delete(CACHE_KEYS.user(userId));
    return this.getStatus(userId);
  }

  // ==================== Administración ====================

  /** Cola del admin: pendientes primero; también los sin verificar que ya tienen alumnos en lista. */
  async listForAdmin(filter: 'PENDING' | 'UNVERIFIED') {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        provider: users.provider,
        status: users.teacherStatus,
        note: users.teacherVerificationNote,
        requestedAt: users.teacherVerificationRequestedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(and(eq(users.role, 'TEACHER'), eq(users.isActive, true), eq(users.teacherStatus, filter)))
      .orderBy(desc(filter === 'PENDING' ? users.teacherVerificationRequestedAt : users.createdAt))
      .limit(200);
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const counts = await db
      .select({
        teacherId: classrooms.teacherId,
        classes: sql<number>`COUNT(DISTINCT ${classrooms.id})`,
        students: sql<number>`COUNT(DISTINCT CASE WHEN ${studentProfiles.isDemo} = 0 THEN ${studentProfiles.id} END)`,
      })
      .from(classrooms)
      .leftJoin(studentProfiles, eq(studentProfiles.classroomId, classrooms.id))
      .where(inArray(classrooms.teacherId, ids))
      .groupBy(classrooms.teacherId);
    const byTeacher = new Map(counts.map((c) => [c.teacherId, c]));
    return rows.map((r) => ({
      ...r,
      classes: Number(byTeacher.get(r.id)?.classes ?? 0),
      students: Number(byTeacher.get(r.id)?.students ?? 0),
    }));
  }

  async approve(userId: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
    if (!user || user.role !== 'TEACHER') throw new NotFoundError('Docente no encontrado');
    await this.markVerified(userId, 'ADMIN');
  }

  async reject(userId: string, reason?: string) {
    await db.update(users)
      .set({ teacherStatus: 'UNVERIFIED', teacherVerificationNote: reason ? `Rechazado: ${reason.trim().slice(0, 480)}` : null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.role, 'TEACHER'), eq(users.teacherStatus, 'PENDING')));
    cache.delete(CACHE_KEYS.user(userId));
  }

  async listDomains() {
    return db
      .select({ id: verifiedDomains.id, domain: verifiedDomains.domain, note: verifiedDomains.note, schoolId: verifiedDomains.schoolId, schoolName: schools.name, createdAt: verifiedDomains.createdAt })
      .from(verifiedDomains)
      .leftJoin(schools, eq(schools.id, verifiedDomains.schoolId))
      .orderBy(verifiedDomains.domain);
  }

  private validDomain(input: string): string {
    const domain = normalizeDomain(input);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new ValidationError('Escribe un dominio válido, por ejemplo colegio.edu.pe');
    if (PERSONAL_DOMAINS.has(domain)) throw new ValidationError('Ese dominio es de correo personal: no sirve para verificar docentes');
    return domain;
  }

  /** Docentes sin verificar con correo de ese dominio, por cómo entran (solo los de Google se verificarían). */
  private async waitingFor(domain: string) {
    const rows = await db.select({ id: users.id, provider: users.provider }).from(users).where(and(
      eq(users.role, 'TEACHER'),
      eq(users.isActive, true),
      sql`LOWER(SUBSTRING_INDEX(${users.email}, '@', -1)) = ${domain}`,
      or(isNull(users.teacherStatus), sql`${users.teacherStatus} <> 'VERIFIED'`),
    ));
    return { google: rows.filter((row) => row.provider === 'GOOGLE'), local: rows.filter((row) => row.provider !== 'GOOGLE') };
  }

  /** Antes de agregar un dominio: a cuántos verificaría ahora mismo. */
  async previewDomain(input: string) {
    const domain = this.validDomain(input);
    const [taken] = await db.select({ id: verifiedDomains.id }).from(verifiedDomains).where(eq(verifiedDomains.domain, domain)).limit(1);
    const waiting = await this.waitingFor(domain);
    return { domain, alreadyListed: !!taken, google: waiting.google.length, local: waiting.local.length };
  }

  async addDomain(adminId: string, input: { domain: string; note?: string; schoolId?: string | null }) {
    const domain = this.validDomain(input.domain);
    const [taken] = await db.select({ id: verifiedDomains.id }).from(verifiedDomains).where(eq(verifiedDomains.domain, domain)).limit(1);
    if (taken) throw new ConflictError('Ese dominio ya está en la lista');
    await db.insert(verifiedDomains).values({
      id: uuidv4(), domain, note: input.note?.trim().slice(0, 255) || null, schoolId: input.schoolId || null, createdBy: adminId, createdAt: new Date(),
    });
    // Los que ya esperaban con ese correo: quedan verificados solo los que entran con Google.
    const waiting = await this.waitingFor(domain);
    for (const teacher of waiting.google) await this.markVerified(teacher.id, 'DOMAIN');
    return { verified: waiting.google.length, localWaiting: waiting.local.length };
  }

  async removeDomain(id: string) {
    await db.delete(verifiedDomains).where(eq(verifiedDomains.id, id));
  }

  // ==================== Retiro de cuentas sin uso ====================

  /**
   * Cuentas docentes sin verificar, sin clases ni escuela y sin entrar en 180 días: se anonimizan
   * (no se borran, por si había registros asociados). Corre una vez al día.
   */
  async anonymizeStaleTeachers(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const stale = await db.select({ id: users.id }).from(users).where(and(
      eq(users.role, 'TEACHER'),
      eq(users.isActive, true),
      sql`${users.teacherStatus} <> 'VERIFIED'`,
      or(lt(users.lastLoginAt, cutoff), and(isNull(users.lastLoginAt), lt(users.createdAt, cutoff))),
      sql`NOT EXISTS (SELECT 1 FROM ${classrooms} c WHERE c.teacher_id = ${users.id})`,
      sql`NOT EXISTS (SELECT 1 FROM ${schoolMembers} m WHERE m.user_id = ${users.id})`,
      sql`NOT EXISTS (SELECT 1 FROM ${schools} s WHERE s.created_by = ${users.id})`,
    )).limit(500);
    for (const { id } of stale) {
      await db.update(users).set({
        email: `retirada-${id}@cuentas.juried.invalid`,
        firstName: 'Cuenta',
        lastName: 'retirada',
        password: null,
        googleId: null,
        avatarUrl: null,
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(users.id, id));
      cache.delete(CACHE_KEYS.user(id));
      await revokeAllUserTokens(id);
    }
    return stale.length;
  }
}

export const teacherVerificationService = new TeacherVerificationService();
