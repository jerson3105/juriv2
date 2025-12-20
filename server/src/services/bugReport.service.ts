import { db } from '../db/index.js';
import { bugReports, users, type BugReportCategory, type BugReportPriority, type BugReportStatus } from '../db/schema.js';
import { eq, desc, and, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const bugReportService = {
  // Crear un nuevo reporte de bug
  async createReport(
    userId: string,
    data: {
      title: string;
      description: string;
      category?: BugReportCategory;
      priority?: BugReportPriority;
      currentUrl?: string;
      browserInfo?: string;
      screenshotUrl?: string;
    }
  ) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(bugReports).values({
      id,
      userId,
      title: data.title,
      description: data.description,
      category: data.category || 'OTHER',
      priority: data.priority || 'MEDIUM',
      status: 'PENDING',
      currentUrl: data.currentUrl || null,
      browserInfo: data.browserInfo || null,
      screenshotUrl: data.screenshotUrl || null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getReportById(id);
  },

  // Obtener reporte por ID
  async getReportById(id: string) {
    const [report] = await db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        description: bugReports.description,
        category: bugReports.category,
        priority: bugReports.priority,
        status: bugReports.status,
        currentUrl: bugReports.currentUrl,
        browserInfo: bugReports.browserInfo,
        screenshotUrl: bugReports.screenshotUrl,
        adminNotes: bugReports.adminNotes,
        resolvedAt: bugReports.resolvedAt,
        createdAt: bugReports.createdAt,
        updatedAt: bugReports.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bugReports)
      .leftJoin(users, eq(bugReports.userId, users.id))
      .where(eq(bugReports.id, id));

    return report;
  },

  // Obtener reportes de un usuario específico
  async getUserReports(userId: string) {
    return db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        category: bugReports.category,
        priority: bugReports.priority,
        status: bugReports.status,
        createdAt: bugReports.createdAt,
        updatedAt: bugReports.updatedAt,
      })
      .from(bugReports)
      .where(eq(bugReports.userId, userId))
      .orderBy(desc(bugReports.createdAt));
  },

  // Obtener todos los reportes (para admin)
  async getAllReports(filters?: {
    status?: BugReportStatus;
    priority?: BugReportPriority;
    category?: BugReportCategory;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    // Construir condiciones de filtro
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(bugReports.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(bugReports.priority, filters.priority));
    }
    if (filters?.category) {
      conditions.push(eq(bugReports.category, filters.category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const reports = await db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        description: bugReports.description,
        category: bugReports.category,
        priority: bugReports.priority,
        status: bugReports.status,
        currentUrl: bugReports.currentUrl,
        adminNotes: bugReports.adminNotes,
        createdAt: bugReports.createdAt,
        updatedAt: bugReports.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bugReports)
      .leftJoin(users, eq(bugReports.userId, users.id))
      .where(whereClause)
      .orderBy(desc(bugReports.createdAt))
      .limit(limit)
      .offset(offset);

    // Contar total
    const [{ total }] = await db
      .select({ total: count() })
      .from(bugReports)
      .where(whereClause);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Obtener estadísticas de reportes (para admin dashboard)
  async getStats() {
    const [stats] = await db
      .select({
        total: count(),
      })
      .from(bugReports);

    const [pending] = await db
      .select({ count: count() })
      .from(bugReports)
      .where(eq(bugReports.status, 'PENDING'));

    const [inProgress] = await db
      .select({ count: count() })
      .from(bugReports)
      .where(eq(bugReports.status, 'IN_PROGRESS'));

    const [resolved] = await db
      .select({ count: count() })
      .from(bugReports)
      .where(eq(bugReports.status, 'RESOLVED'));

    const [critical] = await db
      .select({ count: count() })
      .from(bugReports)
      .where(and(
        eq(bugReports.priority, 'CRITICAL'),
        eq(bugReports.status, 'PENDING')
      ));

    return {
      total: stats.total,
      pending: pending.count,
      inProgress: inProgress.count,
      resolved: resolved.count,
      criticalPending: critical.count,
    };
  },

  // Actualizar estado del reporte (admin)
  async updateStatus(
    reportId: string,
    status: BugReportStatus,
    adminId?: string
  ) {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'RESOLVED' && adminId) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = adminId;
    }

    await db
      .update(bugReports)
      .set(updateData)
      .where(eq(bugReports.id, reportId));

    return this.getReportById(reportId);
  },

  // Agregar notas de admin
  async updateAdminNotes(reportId: string, notes: string) {
    await db
      .update(bugReports)
      .set({
        adminNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, reportId));

    return this.getReportById(reportId);
  },
};
