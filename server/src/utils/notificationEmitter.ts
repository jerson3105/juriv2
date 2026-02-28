import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';

// Lazy import to avoid circular dependency with index.ts
let _io: any = null;
export function getIO() {
  if (!_io) {
    try {
      // Dynamic import at runtime
      _io = require('../index.js').io;
    } catch {
      // Socket.io not ready yet (during startup)
    }
  }
  return _io;
}

export function setIO(io: any) {
  _io = io;
}

// ==================== TYPES ====================

// Use schema-inferred insert type to match Drizzle's enum constraints
type NotificationInsert = typeof notifications.$inferInsert;

export type NotificationEntry = Omit<NotificationInsert, 'id' | 'isRead' | 'createdAt'> & {
  id?: string;
  isRead?: boolean;
  createdAt?: Date;
};

// ==================== CORE ====================

/**
 * Create a single notification and emit unread count via WebSocket.
 * Use this OUTSIDE of transactions only.
 */
export async function createNotification(entry: NotificationEntry): Promise<void> {
  const prepared = prepareEntry(entry);
  await db.insert(notifications).values(prepared);
  await emitCountForUsers([prepared.userId]);
}

/**
 * Create multiple notifications and emit unread counts via WebSocket.
 * Use this OUTSIDE of transactions only.
 * Batches the COUNT query with GROUP BY for efficiency.
 */
export async function createNotifications(entries: NotificationEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const prepared = entries.map(prepareEntry);
  await db.insert(notifications).values(prepared);
  const userIds = [...new Set(prepared.map(e => e.userId))];
  await emitCountForUsers(userIds);
}

/**
 * Prepare notification entries for use INSIDE a transaction.
 * Returns { entries, emitAfterCommit }.
 * - Insert `entries` inside your tx block.
 * - Call `emitAfterCommit()` AFTER the transaction closes.
 */
export function prepareForTx(rawEntries: NotificationEntry | NotificationEntry[]): {
  entries: NotificationInsert[];
  emitAfterCommit: () => Promise<void>;
} {
  const arr = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
  if (arr.length === 0) {
    return { entries: [], emitAfterCommit: async () => {} };
  }
  const entries = arr.map(prepareEntry);
  const userIds = [...new Set(entries.map(e => e.userId))];
  return {
    entries,
    emitAfterCommit: () => emitCountForUsers(userIds),
  };
}

// ==================== INTERNAL ====================

function prepareEntry(entry: NotificationEntry): NotificationInsert {
  return {
    id: entry.id || uuidv4(),
    userId: entry.userId,
    classroomId: entry.classroomId ?? undefined,
    type: entry.type,
    title: entry.title,
    message: entry.message,
    data: entry.data,
    isRead: entry.isRead ?? false,
    createdAt: entry.createdAt || new Date(),
  };
}

/**
 * Emit unread count to each userId via WebSocket.
 * Single query with GROUP BY when multiple userIds.
 */
async function emitCountForUsers(userIds: string[]): Promise<void> {
  const io = getIO();
  if (!io || userIds.length === 0) return;

  try {
    if (userIds.length === 1) {
      const [result] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userIds[0]),
          eq(notifications.isRead, false)
        ));
      io.to(`user:${userIds[0]}`).emit('notification:unread_count', { count: result?.count ?? 0 });
    } else {
      // Batch: single query with GROUP BY
      const results = await db
        .select({
          userId: notifications.userId,
          count: sql<number>`COUNT(*)`,
        })
        .from(notifications)
        .where(and(
          sql`${notifications.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          eq(notifications.isRead, false)
        ))
        .groupBy(notifications.userId);

      const countMap = new Map(results.map(r => [r.userId, r.count]));
      for (const userId of userIds) {
        io.to(`user:${userId}`).emit('notification:unread_count', { count: countMap.get(userId) ?? 0 });
      }
    }
  } catch (error) {
    // Never break the caller — socket emission is best-effort
    console.error('Error emitting notification count:', error);
  }
}

/**
 * Emit updated unread count after marking notifications as read.
 * Call this after markAsRead / markAllAsRead operations.
 */
export async function emitUnreadCount(userId: string): Promise<void> {
  await emitCountForUsers([userId]);
}
