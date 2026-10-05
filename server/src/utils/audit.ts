import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { auditEvents } from '../db/schema.js';
import { logger } from './logger.js';

/**
 * Registro de auditoría de las acciones sensibles: cuentas y roles, verificación, dominios, gestión de la
 * escuela, borrados, accesos con PIN y entradas de administradores. Se escribe después de la acción y nunca la
 * hace fallar: si el registro falla, queda en el log del servidor.
 * metadata sin datos personales: ids, estados y conteos; nunca nombres, DNI, correos, códigos ni contraseñas.
 */
export type AuditAction =
  | 'auth.admin_login'
  | 'auth.admin_login_failed'
  | 'auth.admin_totp_enabled'
  | 'auth.admin_totp_disabled'
  | 'auth.admin_totp_failed'
  | 'admin.teacher_created'
  | 'admin.role_changed'
  | 'admin.account_activated'
  | 'admin.account_deactivated'
  | 'admin.teacher_verified'
  | 'admin.teacher_rejected'
  | 'admin.domain_added'
  | 'admin.domain_removed'
  | 'admin.school_verification_reviewed'
  | 'school.join_request_reviewed'
  | 'school.teacher_removed'
  | 'school.invite_regenerated'
  | 'school.invite_disabled'
  | 'school.joined_by_invite'
  | 'school.year_created'
  | 'school.year_updated'
  | 'school.sections_created'
  | 'school.section_updated'
  | 'school.section_deleted'
  | 'classroom.deleted'
  | 'student.removed'
  | 'student.access_reset'
  | 'student.pin_locked'
  | 'student.enrolled'
  | 'student.data_updated'
  | 'student.document_revealed';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  action: AuditAction;
  /** null: el sistema o alguien sin sesión. */
  actor?: { id: string; role: string } | null;
  schoolId?: string | null;
  target?: { type: string; id: string } | null;
  metadata?: AuditMetadata;
  ip?: string | null;
}

export const recordAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await db.insert(auditEvents).values({
      id: uuidv4(),
      schoolId: entry.schoolId ?? null,
      actorUserId: entry.actor?.id ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ?? null,
      metadata: entry.metadata && Object.keys(entry.metadata).length > 0 ? entry.metadata : null,
      ip: entry.ip ? entry.ip.slice(0, 45) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error('No se pudo guardar el evento de auditoría', {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/** Desde un controlador: el actor sale de la sesión (req.user) y la IP de la conexión, nunca del cuerpo. */
export const auditRequest = (req: Request, entry: Omit<AuditEntry, 'actor' | 'ip'>): Promise<void> =>
  recordAudit({ ...entry, actor: req.user ? { id: req.user.id, role: req.user.role } : null, ip: req.ip ?? null });
