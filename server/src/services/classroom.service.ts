import { db } from '../db/index.js';
import { 
  classrooms, 
  studentProfiles, 
  users, 
  teams,
  pointLogs,
  behaviors,
  powers,
  powerUsages,
  shopItems,
  purchases,
  itemUsages,
  badges,
  studentBadges,
  badgeProgress,
  studentAvatarPurchases,
  studentEquippedItems,
  attendanceRecords,
  questionBanks,
  questions,
  timedActivities,
  timedActivityResults,
  clanLogs,
  classroomCompetencies,
  curriculumCompetencies,
  activityCompetencies,
  loginStreaks,
  notifications,
  classroomAvatarItems,
  studentStreaks,
  scrolls,
  scrollReactions,
  randomEvents,
  eventLogs,
  expeditions,
  expeditionPins,
  expeditionStudentProgress,
  expeditionSubmissions,
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  studentGrades,
  studentActivityScores,
  classroomCompetencyIndicators,
  collectibleAlbums,
  collectibleCards,
  studentCollectibles,
  curriculumAreas,
  jiroExpeditions,
  jiroStudentExpeditions,
  jiroDeliveryStations,
  jiroQuestionAnswers,
  jiroDeliveries,
  jiroExpeditionCompetencies,
} from '../db/schema.js';
import { eq, and, desc, inArray, sql, count, asc, or, gt } from 'drizzle-orm';
import { generateClassCode } from '../utils/helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';
import { characterClassService } from './characterClass.service.js';
type CompetencyDeleteBlockReason = 'CONFIG_ASSOCIATED' | 'HISTORICAL_RECORDS' | 'CONFIG_AND_HISTORICAL_RECORDS';
type CompetencyUsageSummary = {
  hasConfigAssociations: boolean;
  hasHistoricalRecords: boolean;
  deleteBlockReason: CompetencyDeleteBlockReason | null;
};

type AvatarGender = 'MALE' | 'FEMALE';

interface CreateClassroomData {
  name: string;
  description?: string;
  teacherId: string;
  gradeLevel?: string;
  useCompetencies?: boolean;
  curriculumAreaId?: string | null;
  gradeScaleType?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
  schoolId?: string | null;
}

interface CreateCustomClassroomCompetencyData {
  name: string;
  shortName?: string | null;
  description?: string | null;
}

interface UpdateCustomClassroomCompetencyData {
  name?: string;
  shortName?: string | null;
  description?: string | null;
}

interface CreateClassroomCompetencyIndicatorData {
  name: string;
  description?: string | null;
}

interface UpdateClassroomCompetencyIndicatorData {
  name?: string;
  description?: string | null;
}

interface TransferCompetencyIndicatorsData {
  mode: 'IMPORT' | 'EXPORT';
  sourceClassroomId?: string;
  targetClassroomIds?: string[];
  competencyIds?: string[];
  copyMissingCustomCompetencies?: boolean;
}

type TransferableCompetencyIndicator = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
};

type TransferableCompetency = {
  classroomCompetencyId: string;
  id: string;
  sourceType: 'OFFICIAL' | 'CUSTOM_CLASSROOM';
  ownerClassroomId: string | null;
  name: string;
  shortName: string | null;
  description: string | null;
  indicators: TransferableCompetencyIndicator[];
};

type TransferCompetencyIndicatorsTargetSummary = {
  classroomId: string;
  classroomName: string;
  createdCompetencies: number;
  createdIndicators: number;
  skippedExistingIndicators: number;
  skippedUnavailableCompetencies: number;
};

type TransferCompetencyIndicatorsResult = {
  mode: 'IMPORT' | 'EXPORT';
  sourceClassroom: {
    id: string;
    name: string;
  };
  selectedCompetencyCount: number;
  selectedTargetCount: number;
  processedTargetCount: number;
  createdCompetencies: number;
  createdIndicators: number;
  skippedExistingIndicators: number;
  skippedUnavailableCompetencies: number;
  failedTargets: Array<{
    classroomId: string;
    classroomName: string;
    message: string;
  }>;
  targetSummaries: TransferCompetencyIndicatorsTargetSummary[];
};

interface UpdateClassroomData {
  name?: string;
  description?: string | null;
  bannerUrl?: string | null;
  gradeLevel?: string | null;
  isActive?: boolean;
  defaultXp?: number;
  defaultHp?: number;
  defaultGp?: number;
  maxHp?: number;
  xpPerLevel?: number;
  allowNegativeHp?: boolean;
  allowNegativePoints?: boolean;
  showReasonToStudent?: boolean;
  notifyOnPoints?: boolean;
  shopEnabled?: boolean;
  requirePurchaseApproval?: boolean;
  dailyPurchaseLimit?: number | null;
  classAssignmentMode?: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNS';
  showCharacterName?: boolean;
  // Clanes
  clansEnabled?: boolean;
  clanXpPercentage?: number;
  clanGpRewardEnabled?: boolean;
  // Racha de login
  loginStreakEnabled?: boolean;
  loginStreakConfig?: {
    dailyXp: number;
    milestones: Array<{
      day: number;
      xp: number;
      gp: number;
      randomItem: boolean;
    }>;
    resetOnMiss: boolean;
    graceDays: number;
  } | null;
  // Competencias
  useCompetencies?: boolean;
  curriculumAreaId?: string | null;
  gradeScaleType?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
}

export class ClassroomService {
  private normalizeCompetencyName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeOptionalCompetencyText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized || null;
  }

  private async ensureClassroomCompetencyNameAvailable(
    classroomId: string,
    name: string,
    excludedCompetencyId?: string,
  ): Promise<void> {
    const normalizedTarget = this.normalizeCompetencyName(name).toLowerCase();

    const rows = await db
      .select({
        competencyId: curriculumCompetencies.id,
        name: curriculumCompetencies.name,
      })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
        eq(curriculumCompetencies.isActive, true),
      ));

    const duplicate = rows.find((row) => (
      row.competencyId !== excludedCompetencyId &&
      this.normalizeCompetencyName(row.name).toLowerCase() === normalizedTarget
    ));

    if (duplicate) {
      throw new Error('Ya existe una competencia con ese nombre en el aula');
    }
  }

  private async ensureClassroomCompetencyIndicatorNameAvailable(
    classroomCompetencyId: string,
    name: string,
    excludedIndicatorId?: string,
  ): Promise<void> {
    const normalizedTarget = this.normalizeCompetencyName(name).toLowerCase();

    const rows = await db
      .select({
        indicatorId: classroomCompetencyIndicators.id,
        name: classroomCompetencyIndicators.name,
      })
      .from(classroomCompetencyIndicators)
      .where(and(
        eq(classroomCompetencyIndicators.classroomCompetencyId, classroomCompetencyId),
        eq(classroomCompetencyIndicators.isActive, true),
      ));

    const duplicate = rows.find((row) => (
      row.indicatorId !== excludedIndicatorId &&
      this.normalizeCompetencyName(row.name).toLowerCase() === normalizedTarget
    ));

    if (duplicate) {
      throw new Error('Ya existe una destreza con ese nombre en esta competencia');
    }
  }

  private async getCompetencyIndicatorUsageIds(classroomId: string, indicatorIds: string[]): Promise<Set<string>> {
    if (indicatorIds.length === 0) {
      return new Set<string>();
    }

    const [behaviorRows, pointRows] = await Promise.all([
      db.select({ indicatorId: behaviors.competencyIndicatorId })
        .from(behaviors)
        .where(and(
          eq(behaviors.classroomId, classroomId),
          inArray(behaviors.competencyIndicatorId, indicatorIds),
          eq(behaviors.isActive, true),
        )),
      db.select({ indicatorId: pointLogs.competencyIndicatorId })
        .from(pointLogs)
        .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
        .where(and(
          eq(studentProfiles.classroomId, classroomId),
          inArray(pointLogs.competencyIndicatorId, indicatorIds),
          eq(pointLogs.isReverted, false),
        )),
    ]);

    return new Set<string>([
      ...behaviorRows,
      ...pointRows,
    ].map((row) => row.indicatorId).filter((value): value is string => !!value));
  }

  private buildCompetencyUsageSummary(
    hasConfigAssociations: boolean,
    hasHistoricalRecords: boolean,
  ): CompetencyUsageSummary {
    if (hasConfigAssociations && hasHistoricalRecords) {
      return {
        hasConfigAssociations,
        hasHistoricalRecords,
        deleteBlockReason: 'CONFIG_AND_HISTORICAL_RECORDS',
      };
    }

    if (hasConfigAssociations) {
      return {
        hasConfigAssociations,
        hasHistoricalRecords,
        deleteBlockReason: 'CONFIG_ASSOCIATED',
      };
    }

    if (hasHistoricalRecords) {
      return {
        hasConfigAssociations,
        hasHistoricalRecords,
        deleteBlockReason: 'HISTORICAL_RECORDS',
      };
    }

    return {
      hasConfigAssociations,
      hasHistoricalRecords,
      deleteBlockReason: null,
    };
  }

  private buildCompetencyDeleteBlockedMessage(
    summary: CompetencyUsageSummary,
    mode: 'REMOVE' | 'DELETE',
  ) {
    const actionSuffix = mode === 'REMOVE'
      ? 'No se puede retirar del aula.'
      : 'Puedes editarla, pero no eliminarla.';

    if (summary.deleteBlockReason === 'HISTORICAL_RECORDS') {
      return `Esta competencia ya tiene calificaciones o evidencias registradas, incluso en bimestres cerrados. ${actionSuffix}`;
    }

    if (summary.deleteBlockReason === 'CONFIG_ASSOCIATED') {
      return `Esta competencia tiene comportamientos, actividades o destrezas configuradas. ${actionSuffix}`;
    }

    if (summary.deleteBlockReason === 'CONFIG_AND_HISTORICAL_RECORDS') {
      return `Esta competencia tiene configuraciones activas y tambien calificaciones o evidencias registradas. ${actionSuffix}`;
    }

    return actionSuffix;
  }

  private async getCompetencyUsageSummaryMap(classroomId: string, competencyIds: string[]): Promise<Map<string, CompetencyUsageSummary>> {
    if (competencyIds.length === 0) {
      return new Map<string, CompetencyUsageSummary>();
    }

    const [behaviorRows, badgeRows, timedActivityRows, expeditionActivityRows, tournamentActivityRows, gradeRows, pointRows, jiroRows, indicatorRows] = await Promise.all([
      db.select({ competencyId: behaviors.competencyId })
        .from(behaviors)
        .where(and(
          eq(behaviors.classroomId, classroomId),
          inArray(behaviors.competencyId, competencyIds),
          eq(behaviors.isActive, true),
        )),
      db.select({ competencyId: badges.competencyId })
        .from(badges)
        .where(and(
          eq(badges.classroomId, classroomId),
          inArray(badges.competencyId, competencyIds),
          eq(badges.isActive, true),
        )),
      db.select({ competencyId: activityCompetencies.competencyId })
        .from(activityCompetencies)
        .innerJoin(timedActivities, and(
          eq(activityCompetencies.activityId, timedActivities.id),
          eq(activityCompetencies.activityType, 'TIMED'),
        ))
        .where(and(
          inArray(activityCompetencies.competencyId, competencyIds),
          eq(timedActivities.classroomId, classroomId),
        )),
      db.select({ competencyId: activityCompetencies.competencyId })
        .from(activityCompetencies)
        .innerJoin(expeditions, and(
          eq(activityCompetencies.activityId, expeditions.id),
          eq(activityCompetencies.activityType, 'EXPEDITION'),
        ))
        .where(and(
          inArray(activityCompetencies.competencyId, competencyIds),
          eq(expeditions.classroomId, classroomId),
        )),
      db.select({ competencyId: activityCompetencies.competencyId })
        .from(activityCompetencies)
        .innerJoin(tournaments, and(
          eq(activityCompetencies.activityId, tournaments.id),
          eq(activityCompetencies.activityType, 'TOURNAMENT'),
        ))
        .where(and(
          inArray(activityCompetencies.competencyId, competencyIds),
          eq(tournaments.classroomId, classroomId),
        )),
      db.select({ competencyId: studentGrades.competencyId })
        .from(studentGrades)
        .where(and(
          eq(studentGrades.classroomId, classroomId),
          inArray(studentGrades.competencyId, competencyIds),
          or(
            gt(studentGrades.activitiesCount, 0),
            eq(studentGrades.isManualOverride, true),
          ),
        )),
      db.select({ competencyId: pointLogs.competencyId })
        .from(pointLogs)
        .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
        .where(and(
          eq(studentProfiles.classroomId, classroomId),
          inArray(pointLogs.competencyId, competencyIds),
          eq(pointLogs.isReverted, false),
        )),
      db.select({ competencyId: jiroExpeditionCompetencies.competencyId })
        .from(jiroExpeditionCompetencies)
        .innerJoin(jiroExpeditions, eq(jiroExpeditionCompetencies.expeditionId, jiroExpeditions.id))
        .where(and(
          eq(jiroExpeditions.classroomId, classroomId),
          inArray(jiroExpeditionCompetencies.competencyId, competencyIds),
        )),
      db.select({ competencyId: classroomCompetencyIndicators.competencyId })
        .from(classroomCompetencyIndicators)
        .where(and(
          eq(classroomCompetencyIndicators.classroomId, classroomId),
          inArray(classroomCompetencyIndicators.competencyId, competencyIds),
          eq(classroomCompetencyIndicators.isActive, true),
        )),
    ]);

    const configAssociatedIds = new Set<string>([
      ...behaviorRows,
      ...badgeRows,
      ...timedActivityRows,
      ...expeditionActivityRows,
      ...tournamentActivityRows,
      ...jiroRows,
      ...indicatorRows,
    ].map((row) => row.competencyId).filter((value): value is string => !!value));

    const historicalRecordIds = new Set<string>([
      ...gradeRows,
      ...pointRows,
    ].map((row) => row.competencyId).filter((value): value is string => !!value));

    return new Map(
      competencyIds.map((competencyId) => ([
        competencyId,
        this.buildCompetencyUsageSummary(
          configAssociatedIds.has(competencyId),
          historicalRecordIds.has(competencyId),
        ),
      ])),
    );
  }

  async create(data: CreateClassroomData) {
    const id = uuidv4();
    const code = generateClassCode();
    const now = new Date();
    const useCompetencies = data.schoolId ? true : (data.useCompetencies || false);
    
    await db.insert(classrooms).values({
      id,
      name: data.name,
      description: data.description || null,
      teacherId: data.teacherId,
      gradeLevel: data.gradeLevel || null,
      code,
      useCompetencies,
      curriculumAreaId: data.curriculumAreaId || null,
      gradeScaleType: data.gradeScaleType || null,
      schoolId: data.schoolId || null,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.classrooms.findFirst({
      where: eq(classrooms.id, id),
    }).then(async (classroom) => {
      if (classroom) {
        await characterClassService.seedDefaults(id);
        if (useCompetencies && classroom.curriculumAreaId) {
          await this.syncClassroomCompetencies(id, classroom.curriculumAreaId);
        }
      }
      return classroom;
    });
  }

  async getByTeacher(teacherId: string) {
    // Obtener clases con conteo de estudiantes en una sola query (evita N+1)
    const results = await db.query.classrooms.findMany({
      where: eq(classrooms.teacherId, teacherId),
      orderBy: [desc(classrooms.createdAt)],
    });

    if (results.length === 0) return [];

    // Obtener conteo de estudiantes por clase en una sola query
    const classroomIds = results.map(c => c.id);
    const studentCounts = await db
      .select({
        classroomId: studentProfiles.classroomId,
        count: count(),
      })
      .from(studentProfiles)
      .where(inArray(studentProfiles.classroomId, classroomIds))
      .groupBy(studentProfiles.classroomId);

    // Crear mapa de conteos
    const countMap = new Map(studentCounts.map(sc => [sc.classroomId, Number(sc.count)]));

    return results.map((c) => {
      // Parsear JSON si viene como string (bug de MySQL/Drizzle)
      let loginStreakConfig = c.loginStreakConfig;
      if (loginStreakConfig && typeof loginStreakConfig === 'string') {
        try {
          loginStreakConfig = JSON.parse(loginStreakConfig);
        } catch (e) {
          // Silenciar error de parsing
        }
      }
      
      return { ...c, loginStreakConfig, studentCount: countMap.get(c.id) || 0 };
    });
  }

  async getById(classroomId: string) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });
    
    if (classroom && classroom.loginStreakConfig) {
      // Parsear JSON si viene como string (bug de MySQL/Drizzle)
      if (typeof classroom.loginStreakConfig === 'string') {
        try {
          (classroom as any).loginStreakConfig = JSON.parse(classroom.loginStreakConfig);
        } catch (e) {
          console.error('Error parsing loginStreakConfig:', e);
        }
      }
    }
    
    return classroom;
  }

  async getStudents(classroomId: string) {
    return db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      avatarUrl: studentProfiles.avatarUrl,
      characterClass: studentProfiles.characterClass,
      characterClassId: studentProfiles.characterClassId,
      avatarGender: studentProfiles.avatarGender,
      displayName: studentProfiles.displayName,
      linkCode: studentProfiles.linkCode,
      level: studentProfiles.level,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      gp: studentProfiles.gp,
      teamId: studentProfiles.teamId,
      isActive: studentProfiles.isActive,
      isDemo: studentProfiles.isDemo,
      // Datos del usuario real
      linkedEmail: users.email,
      realName: users.firstName,
      realLastName: users.lastName,
      // Datos del clan
      clanName: teams.name,
      clanColor: teams.color,
      clanEmblem: teams.emblem,
      clanMotto: teams.motto,
    }).from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .leftJoin(teams, eq(studentProfiles.teamId, teams.id))
      .where(eq(studentProfiles.classroomId, classroomId));
  }

  async update(classroomId: string, teacherId: string, data: UpdateClassroomData) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    await db.update(classrooms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));

    return this.getById(classroomId);
  }

  async getEnabledCompetencies(classroomId: string) {
    const [classroom] = await db
      .select({
        curriculumAreaId: classrooms.curriculumAreaId,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    const rows = await db
      .select({
        classroomCompetencyId: classroomCompetencies.id,
        id: curriculumCompetencies.id,
        sourceType: curriculumCompetencies.sourceType,
        ownerClassroomId: curriculumCompetencies.ownerClassroomId,
        name: curriculumCompetencies.name,
        shortName: curriculumCompetencies.shortName,
        description: curriculumCompetencies.description,
        areaId: curriculumCompetencies.areaId,
        areaName: curriculumAreas.name,
        areaShortName: curriculumAreas.shortName,
        weight: classroomCompetencies.weight,
        isActive: classroomCompetencies.isActive,
        createdAt: classroomCompetencies.createdAt,
      })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .innerJoin(curriculumAreas, eq(curriculumCompetencies.areaId, curriculumAreas.id))
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
        eq(curriculumCompetencies.isActive, true),
        eq(curriculumAreas.isActive, true),
      ))
      .orderBy(
        asc(classroomCompetencies.createdAt),
        asc(curriculumAreas.displayOrder),
        asc(curriculumCompetencies.displayOrder),
      );

    const removableCompetencyIds = rows
      .filter((row) => row.sourceType === 'CUSTOM_CLASSROOM' || (row.sourceType === 'OFFICIAL' && row.areaId !== classroom.curriculumAreaId))
      .map((row) => row.id);
    const usageSummaryByCompetencyId = await this.getCompetencyUsageSummaryMap(classroomId, removableCompetencyIds);

    const indicatorRows = rows.length === 0
      ? []
      : await db
          .select({
            id: classroomCompetencyIndicators.id,
            classroomCompetencyId: classroomCompetencyIndicators.classroomCompetencyId,
            classroomId: classroomCompetencyIndicators.classroomId,
            competencyId: classroomCompetencyIndicators.competencyId,
            name: classroomCompetencyIndicators.name,
            description: classroomCompetencyIndicators.description,
            displayOrder: classroomCompetencyIndicators.displayOrder,
            isActive: classroomCompetencyIndicators.isActive,
            createdAt: classroomCompetencyIndicators.createdAt,
            updatedAt: classroomCompetencyIndicators.updatedAt,
          })
          .from(classroomCompetencyIndicators)
          .where(and(
            eq(classroomCompetencyIndicators.classroomId, classroomId),
            inArray(classroomCompetencyIndicators.classroomCompetencyId, rows.map((row) => row.classroomCompetencyId)),
            eq(classroomCompetencyIndicators.isActive, true),
          ))
          .orderBy(
            asc(classroomCompetencyIndicators.displayOrder),
            asc(classroomCompetencyIndicators.createdAt),
          );

    const usedIndicatorIds = await this.getCompetencyIndicatorUsageIds(
      classroomId,
      indicatorRows.map((indicator) => indicator.id),
    );

    const indicatorsByClassroomCompetencyId = new Map<string, Array<{
      id: string;
      classroomCompetencyId: string;
      classroomId: string;
      competencyId: string;
      name: string;
      description: string | null;
      displayOrder: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      canDelete: boolean;
    }>>();

    for (const indicator of indicatorRows) {
      const current = indicatorsByClassroomCompetencyId.get(indicator.classroomCompetencyId) || [];
      current.push({
        ...indicator,
        canDelete: !usedIndicatorIds.has(indicator.id),
      });
      indicatorsByClassroomCompetencyId.set(indicator.classroomCompetencyId, current);
    }

    return rows.map((row) => ({
      ...row,
      indicators: indicatorsByClassroomCompetencyId.get(row.classroomCompetencyId) || [],
      isBase: row.sourceType === 'OFFICIAL' && row.areaId === classroom.curriculumAreaId,
      isCustom: row.sourceType === 'CUSTOM_CLASSROOM',
      canEdit: row.sourceType === 'CUSTOM_CLASSROOM' && row.ownerClassroomId === classroomId,
      deleteBlockReason: usageSummaryByCompetencyId.get(row.id)?.deleteBlockReason || null,
      canDelete: (
        (row.sourceType === 'CUSTOM_CLASSROOM' && row.ownerClassroomId === classroomId) ||
        (row.sourceType === 'OFFICIAL' && row.areaId !== classroom.curriculumAreaId)
      ) && !(usageSummaryByCompetencyId.get(row.id)?.deleteBlockReason),
    }));
  }

  async addCompetencies(classroomId: string, competencyIds: string[]) {
    const uniqueIds = [...new Set(competencyIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return { created: 0, totalEnabled: 0 };
    }

    const [classroom] = await db
      .select({
        id: classrooms.id,
        curriculumAreaId: classrooms.curriculumAreaId,
        useCompetencies: classrooms.useCompetencies,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (!classroom.useCompetencies) {
      throw new Error('La clase no tiene competencias habilitadas');
    }

    const [baseArea] = classroom.curriculumAreaId
      ? await db
          .select({
            countryCode: curriculumAreas.countryCode,
            educationLevel: curriculumAreas.educationLevel,
          })
          .from(curriculumAreas)
          .where(eq(curriculumAreas.id, classroom.curriculumAreaId))
      : [null];

    const availableCompetencies = await db
      .select({
        id: curriculumCompetencies.id,
        areaId: curriculumCompetencies.areaId,
        areaCountryCode: curriculumAreas.countryCode,
        areaEducationLevel: curriculumAreas.educationLevel,
      })
      .from(curriculumCompetencies)
      .innerJoin(curriculumAreas, eq(curriculumCompetencies.areaId, curriculumAreas.id))
      .where(and(
        inArray(curriculumCompetencies.id, uniqueIds),
        eq(curriculumCompetencies.isActive, true),
        eq(curriculumCompetencies.sourceType, 'OFFICIAL'),
        eq(curriculumAreas.isActive, true),
      ));

    const allowedCompetencies = availableCompetencies.filter((competency) => {
      if (!baseArea) {
        return true;
      }

      if (competency.areaCountryCode !== baseArea.countryCode) {
        return false;
      }

      if (!baseArea.educationLevel || !competency.areaEducationLevel) {
        return true;
      }

      return competency.areaEducationLevel === baseArea.educationLevel;
    });

    if (allowedCompetencies.length === 0) {
      const [enabledCount] = await db
        .select({ count: count() })
        .from(classroomCompetencies)
        .where(and(
          eq(classroomCompetencies.classroomId, classroomId),
          eq(classroomCompetencies.isActive, true),
        ));

      return {
        created: 0,
        totalEnabled: Number(enabledCount?.count || 0),
      };
    }

    const existingRows = await db
      .select({ competencyId: classroomCompetencies.competencyId })
      .from(classroomCompetencies)
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        inArray(classroomCompetencies.competencyId, allowedCompetencies.map((competency) => competency.id)),
      ));

    const existingIds = new Set(existingRows.map((row) => row.competencyId));
    const now = new Date();
    const toCreate = allowedCompetencies.filter((competency) => !existingIds.has(competency.id));

    if (toCreate.length > 0) {
      await db.insert(classroomCompetencies).values(
        toCreate.map((competency) => ({
          id: uuidv4(),
          classroomId,
          competencyId: competency.id,
          weight: 100,
          isActive: true,
          createdAt: now,
        }))
      );
    }

    const [enabledCount] = await db
      .select({ count: count() })
      .from(classroomCompetencies)
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
      ));

    return {
      created: toCreate.length,
      totalEnabled: Number(enabledCount?.count || 0),
    };
  }

  async removeCompetency(classroomId: string, competencyId: string, teacherId: string) {
    const [classroom] = await db
      .select({
        id: classrooms.id,
        teacherId: classrooms.teacherId,
        curriculumAreaId: classrooms.curriculumAreaId,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    const [existing] = await db
      .select({
        id: curriculumCompetencies.id,
        areaId: curriculumCompetencies.areaId,
        sourceType: curriculumCompetencies.sourceType,
      })
      .from(curriculumCompetencies)
      .innerJoin(classroomCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(curriculumCompetencies.id, competencyId),
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
        eq(curriculumCompetencies.isActive, true),
      ));

    if (!existing) {
      throw new Error('La competencia no esta habilitada en esta clase');
    }

    if (existing.sourceType !== 'OFFICIAL') {
      throw new Error('Solo puedes quitar competencias oficiales adicionales desde esta accion');
    }

    if (existing.areaId === classroom.curriculumAreaId) {
      throw new Error('No puedes quitar una competencia base del aula');
    }

    const usageSummary = this.getUsageSummaryOrDefault(
      await this.getCompetencyUsageSummaryMap(classroomId, [competencyId]),
      competencyId,
    );
    if (usageSummary.deleteBlockReason) {
      throw new Error(this.buildCompetencyDeleteBlockedMessage(usageSummary, 'REMOVE'));
    }

    await db.delete(classroomCompetencies)
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.competencyId, competencyId),
      ));

    return { removed: true };
  }

  async createCustomCompetency(
    classroomId: string,
    teacherId: string,
    data: CreateCustomClassroomCompetencyData,
  ) {
    const [classroom] = await db
      .select({
        id: classrooms.id,
        teacherId: classrooms.teacherId,
        curriculumAreaId: classrooms.curriculumAreaId,
        useCompetencies: classrooms.useCompetencies,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    if (!classroom.useCompetencies || !classroom.curriculumAreaId) {
      throw new Error('La clase debe tener competencias y area curricular configuradas');
    }

    const name = this.normalizeCompetencyName(data.name);
    const shortName = data.shortName === undefined ? null : this.normalizeOptionalCompetencyText(data.shortName);
    const description = data.description === undefined ? null : this.normalizeOptionalCompetencyText(data.description);

    if (name.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres');
    }

    await this.ensureClassroomCompetencyNameAvailable(classroomId, name);

    const [displayOrderRow] = await db
      .select({
        maxDisplayOrder: sql<number>`COALESCE(MAX(${curriculumCompetencies.displayOrder}), 0)`,
      })
      .from(curriculumCompetencies)
      .where(eq(curriculumCompetencies.areaId, classroom.curriculumAreaId));

    const competencyId = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(curriculumCompetencies).values({
        id: competencyId,
        areaId: classroom.curriculumAreaId!,
        sourceType: 'CUSTOM_CLASSROOM',
        ownerClassroomId: classroomId,
        createdByTeacherId: teacherId,
        name,
        shortName,
        description,
        displayOrder: Number(displayOrderRow?.maxDisplayOrder || 0) + 1,
        isActive: true,
        createdAt: now,
      });

      await tx.insert(classroomCompetencies).values({
        id: uuidv4(),
        classroomId,
        competencyId,
        weight: 100,
        isActive: true,
        createdAt: now,
      });
    });

    const createdCompetency = (await this.getEnabledCompetencies(classroomId)).find((competency) => competency.id === competencyId);
    if (!createdCompetency) {
      throw new Error('No se pudo recuperar la competencia creada');
    }

    return createdCompetency;
  }

  async updateCustomCompetency(
    classroomId: string,
    competencyId: string,
    teacherId: string,
    data: UpdateCustomClassroomCompetencyData,
  ) {
    const [existing] = await db
      .select({
        id: curriculumCompetencies.id,
        ownerClassroomId: curriculumCompetencies.ownerClassroomId,
        createdByTeacherId: curriculumCompetencies.createdByTeacherId,
      })
      .from(curriculumCompetencies)
      .innerJoin(classroomCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(curriculumCompetencies.id, competencyId),
        eq(curriculumCompetencies.sourceType, 'CUSTOM_CLASSROOM'),
        eq(curriculumCompetencies.isActive, true),
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
      ));

    if (!existing || existing.ownerClassroomId !== classroomId || existing.createdByTeacherId !== teacherId) {
      throw new Error('La competencia personalizada no existe o no pertenece a esta clase');
    }

    const payload: Partial<typeof curriculumCompetencies.$inferInsert> = {};

    if (data.name !== undefined) {
      const normalizedName = this.normalizeCompetencyName(data.name);
      if (normalizedName.length < 2) {
        throw new Error('El nombre debe tener al menos 2 caracteres');
      }
      await this.ensureClassroomCompetencyNameAvailable(classroomId, normalizedName, competencyId);
      payload.name = normalizedName;
    }

    if (data.shortName !== undefined) {
      payload.shortName = this.normalizeOptionalCompetencyText(data.shortName);
    }

    if (data.description !== undefined) {
      payload.description = this.normalizeOptionalCompetencyText(data.description);
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('No hay cambios para guardar');
    }

    await db.update(curriculumCompetencies)
      .set(payload)
      .where(eq(curriculumCompetencies.id, competencyId));

    const updatedCompetency = (await this.getEnabledCompetencies(classroomId)).find((competency) => competency.id === competencyId);
    if (!updatedCompetency) {
      throw new Error('No se pudo recuperar la competencia actualizada');
    }

    return updatedCompetency;
  }

  async deleteCustomCompetency(classroomId: string, competencyId: string, teacherId: string) {
    const [existing] = await db
      .select({
        id: curriculumCompetencies.id,
        ownerClassroomId: curriculumCompetencies.ownerClassroomId,
        createdByTeacherId: curriculumCompetencies.createdByTeacherId,
      })
      .from(curriculumCompetencies)
      .innerJoin(classroomCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(curriculumCompetencies.id, competencyId),
        eq(curriculumCompetencies.sourceType, 'CUSTOM_CLASSROOM'),
        eq(curriculumCompetencies.isActive, true),
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
      ));

    if (!existing || existing.ownerClassroomId !== classroomId || existing.createdByTeacherId !== teacherId) {
      throw new Error('La competencia personalizada no existe o no pertenece a esta clase');
    }

    const usageSummary = this.getUsageSummaryOrDefault(
      await this.getCompetencyUsageSummaryMap(classroomId, [competencyId]),
      competencyId,
    );
    if (usageSummary.deleteBlockReason) {
      throw new Error(this.buildCompetencyDeleteBlockedMessage(usageSummary, 'DELETE'));
    }

    await db.transaction(async (tx) => {
      await tx.delete(classroomCompetencies)
        .where(and(
          eq(classroomCompetencies.classroomId, classroomId),
          eq(classroomCompetencies.competencyId, competencyId),
        ));

      await tx.delete(curriculumCompetencies)
        .where(eq(curriculumCompetencies.id, competencyId));
    });

    return { deleted: true };
  }

  private getUsageSummaryOrDefault(
    usageSummaryByCompetencyId: Map<string, CompetencyUsageSummary>,
    competencyId: string,
  ): CompetencyUsageSummary {
    return usageSummaryByCompetencyId.get(competencyId) || this.buildCompetencyUsageSummary(false, false);
  }

  async createCompetencyIndicator(
    classroomId: string,
    competencyId: string,
    teacherId: string,
    data: CreateClassroomCompetencyIndicatorData,
  ) {
    const [classroom] = await db
      .select({
        id: classrooms.id,
        teacherId: classrooms.teacherId,
        useCompetencies: classrooms.useCompetencies,
        currentBimester: classrooms.currentBimester,
        competencyIndicatorStartPeriod: classrooms.competencyIndicatorStartPeriod,
      })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Clase no encontrada');
    }

    if (classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    if (!classroom.useCompetencies) {
      throw new Error('La clase debe tener competencias habilitadas');
    }

    const [existingCompetency] = await db
      .select({
        classroomCompetencyId: classroomCompetencies.id,
      })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.competencyId, competencyId),
        eq(classroomCompetencies.isActive, true),
        eq(curriculumCompetencies.isActive, true),
      ));

    if (!existingCompetency) {
      throw new Error('La competencia no esta habilitada en esta clase');
    }

    const name = this.normalizeCompetencyName(data.name);
    const description = data.description === undefined ? null : this.normalizeOptionalCompetencyText(data.description);

    if (name.length < 2) {
      throw new Error('El nombre de la destreza debe tener al menos 2 caracteres');
    }

    await this.ensureClassroomCompetencyIndicatorNameAvailable(existingCompetency.classroomCompetencyId, name);

    const [displayOrderRow] = await db
      .select({
        maxDisplayOrder: sql<number>`COALESCE(MAX(${classroomCompetencyIndicators.displayOrder}), 0)`,
      })
      .from(classroomCompetencyIndicators)
      .where(eq(classroomCompetencyIndicators.classroomCompetencyId, existingCompetency.classroomCompetencyId));

    const indicatorId = uuidv4();
    const now = new Date();
    const startPeriod = classroom.competencyIndicatorStartPeriod || classroom.currentBimester || `${new Date().getFullYear()}-B1`;

    await db.transaction(async (tx) => {
      await tx.insert(classroomCompetencyIndicators).values({
        id: indicatorId,
        classroomCompetencyId: existingCompetency.classroomCompetencyId,
        classroomId,
        competencyId,
        name,
        description,
        displayOrder: Number(displayOrderRow?.maxDisplayOrder || 0) + 1,
        isActive: true,
        createdByTeacherId: teacherId,
        createdAt: now,
        updatedAt: now,
      });

      if (!classroom.competencyIndicatorStartPeriod) {
        await tx.update(classrooms)
          .set({
            competencyIndicatorStartPeriod: startPeriod,
            updatedAt: now,
          })
          .where(eq(classrooms.id, classroomId));
      }
    });

    const createdIndicator = (await this.getEnabledCompetencies(classroomId))
      .find((competency) => competency.id === competencyId)
      ?.indicators.find((indicator) => indicator.id === indicatorId);

    if (!createdIndicator) {
      throw new Error('No se pudo recuperar la destreza creada');
    }

    return createdIndicator;
  }

  async updateCompetencyIndicator(
    classroomId: string,
    competencyId: string,
    indicatorId: string,
    teacherId: string,
    data: UpdateClassroomCompetencyIndicatorData,
  ) {
    const [existingIndicator] = await db
      .select({
        id: classroomCompetencyIndicators.id,
        classroomCompetencyId: classroomCompetencyIndicators.classroomCompetencyId,
        teacherId: classrooms.teacherId,
      })
      .from(classroomCompetencyIndicators)
      .innerJoin(classrooms, eq(classroomCompetencyIndicators.classroomId, classrooms.id))
      .where(and(
        eq(classroomCompetencyIndicators.id, indicatorId),
        eq(classroomCompetencyIndicators.classroomId, classroomId),
        eq(classroomCompetencyIndicators.competencyId, competencyId),
        eq(classroomCompetencyIndicators.isActive, true),
      ));

    if (!existingIndicator) {
      throw new Error('La destreza no existe en esta competencia');
    }

    if (existingIndicator.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    const payload: Partial<typeof classroomCompetencyIndicators.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      const normalizedName = this.normalizeCompetencyName(data.name);
      if (normalizedName.length < 2) {
        throw new Error('El nombre de la destreza debe tener al menos 2 caracteres');
      }

      await this.ensureClassroomCompetencyIndicatorNameAvailable(
        existingIndicator.classroomCompetencyId,
        normalizedName,
        indicatorId,
      );
      payload.name = normalizedName;
    }

    if (data.description !== undefined) {
      payload.description = this.normalizeOptionalCompetencyText(data.description);
    }

    if (Object.keys(payload).length === 1) {
      throw new Error('No hay cambios para guardar');
    }

    await db.update(classroomCompetencyIndicators)
      .set(payload)
      .where(eq(classroomCompetencyIndicators.id, indicatorId));

    const updatedIndicator = (await this.getEnabledCompetencies(classroomId))
      .find((competency) => competency.id === competencyId)
      ?.indicators.find((indicator) => indicator.id === indicatorId);

    if (!updatedIndicator) {
      throw new Error('No se pudo recuperar la destreza actualizada');
    }

    return updatedIndicator;
  }

  async deleteCompetencyIndicator(
    classroomId: string,
    competencyId: string,
    indicatorId: string,
    teacherId: string,
  ) {
    const [existingIndicator] = await db
      .select({
        id: classroomCompetencyIndicators.id,
        teacherId: classrooms.teacherId,
      })
      .from(classroomCompetencyIndicators)
      .innerJoin(classrooms, eq(classroomCompetencyIndicators.classroomId, classrooms.id))
      .where(and(
        eq(classroomCompetencyIndicators.id, indicatorId),
        eq(classroomCompetencyIndicators.classroomId, classroomId),
        eq(classroomCompetencyIndicators.competencyId, competencyId),
        eq(classroomCompetencyIndicators.isActive, true),
      ));

    if (!existingIndicator) {
      throw new Error('La destreza no existe en esta competencia');
    }

    if (existingIndicator.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    const usedIndicatorIds = await this.getCompetencyIndicatorUsageIds(classroomId, [indicatorId]);
    if (usedIndicatorIds.has(indicatorId)) {
      throw new Error('No se puede eliminar una destreza que ya tiene evidencias o comportamientos asociados');
    }

    await db.delete(classroomCompetencyIndicators)
      .where(eq(classroomCompetencyIndicators.id, indicatorId));

    return { deleted: true };
  }

  private async getTransferableCompetencies(classroomId: string): Promise<TransferableCompetency[]> {
    const competencyRows = await db
      .select({
        classroomCompetencyId: classroomCompetencies.id,
        id: curriculumCompetencies.id,
        sourceType: curriculumCompetencies.sourceType,
        ownerClassroomId: curriculumCompetencies.ownerClassroomId,
        name: curriculumCompetencies.name,
        shortName: curriculumCompetencies.shortName,
        description: curriculumCompetencies.description,
      })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(
        eq(classroomCompetencies.classroomId, classroomId),
        eq(classroomCompetencies.isActive, true),
        eq(curriculumCompetencies.isActive, true),
      ))
      .orderBy(
        asc(classroomCompetencies.createdAt),
        asc(curriculumCompetencies.displayOrder),
      );

    if (competencyRows.length === 0) {
      return [];
    }

    const indicatorRows = await db
      .select({
        id: classroomCompetencyIndicators.id,
        classroomCompetencyId: classroomCompetencyIndicators.classroomCompetencyId,
        name: classroomCompetencyIndicators.name,
        description: classroomCompetencyIndicators.description,
        displayOrder: classroomCompetencyIndicators.displayOrder,
      })
      .from(classroomCompetencyIndicators)
      .where(and(
        eq(classroomCompetencyIndicators.classroomId, classroomId),
        inArray(classroomCompetencyIndicators.classroomCompetencyId, competencyRows.map((row) => row.classroomCompetencyId)),
        eq(classroomCompetencyIndicators.isActive, true),
      ))
      .orderBy(
        asc(classroomCompetencyIndicators.displayOrder),
        asc(classroomCompetencyIndicators.createdAt),
      );

    const indicatorsByCompetencyId = new Map<string, TransferableCompetencyIndicator[]>();

    for (const indicator of indicatorRows) {
      const current = indicatorsByCompetencyId.get(indicator.classroomCompetencyId) || [];
      current.push({
        id: indicator.id,
        name: indicator.name,
        description: indicator.description,
        displayOrder: indicator.displayOrder,
      });
      indicatorsByCompetencyId.set(indicator.classroomCompetencyId, current);
    }

    return competencyRows.map((row) => ({
      ...row,
      indicators: indicatorsByCompetencyId.get(row.classroomCompetencyId) || [],
    }));
  }

  async transferCompetencyIndicators(
    classroomId: string,
    teacherId: string,
    data: TransferCompetencyIndicatorsData,
  ): Promise<TransferCompetencyIndicatorsResult> {
    const targetIds = [...new Set((data.targetClassroomIds || []).filter(Boolean))];
    const requestedCompetencyIds = [...new Set((data.competencyIds || []).filter(Boolean))];
    const copyMissingCustomCompetencies = data.copyMissingCustomCompetencies !== false;
    const sourceClassroomId = data.mode === 'IMPORT' ? data.sourceClassroomId : classroomId;

    if (!sourceClassroomId) {
      throw new Error('Debes seleccionar una clase de origen');
    }

    if (data.mode === 'IMPORT' && sourceClassroomId === classroomId) {
      throw new Error('Debes elegir una clase distinta como origen');
    }

    if (data.mode === 'EXPORT' && targetIds.length === 0) {
      throw new Error('Selecciona al menos una clase destino');
    }

    const resolvedTargetIds = data.mode === 'IMPORT'
      ? [classroomId]
      : targetIds.filter((targetId) => targetId !== sourceClassroomId);

    if (resolvedTargetIds.length === 0) {
      throw new Error('No hay clases destino válidas para transferir destrezas');
    }

    const involvedClassroomIds = [...new Set([classroomId, sourceClassroomId, ...resolvedTargetIds])];
    const classroomRows = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        teacherId: classrooms.teacherId,
        useCompetencies: classrooms.useCompetencies,
        curriculumAreaId: classrooms.curriculumAreaId,
        currentBimester: classrooms.currentBimester,
        competencyIndicatorStartPeriod: classrooms.competencyIndicatorStartPeriod,
      })
      .from(classrooms)
      .where(inArray(classrooms.id, involvedClassroomIds));

    const classroomMap = new Map(classroomRows.map((item) => [item.id, item]));
    const currentClassroom = classroomMap.get(classroomId);
    const sourceClassroom = classroomMap.get(sourceClassroomId);

    if (!currentClassroom || currentClassroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para esta clase');
    }

    if (!sourceClassroom || sourceClassroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para la clase de origen');
    }

    if (!sourceClassroom.useCompetencies || !sourceClassroom.curriculumAreaId) {
      throw new Error('La clase de origen debe tener competencias y área curricular configuradas');
    }

    const sourceCompetencies = (await this.getTransferableCompetencies(sourceClassroomId))
      .filter((competency) => competency.indicators.length > 0);

    const sourceCompetencyIdSet = new Set(sourceCompetencies.map((competency) => competency.id));
    const selectedSourceCompetencies = (requestedCompetencyIds.length > 0
      ? sourceCompetencies.filter((competency) => sourceCompetencyIdSet.has(competency.id) && requestedCompetencyIds.includes(competency.id))
      : sourceCompetencies
    );

    if (selectedSourceCompetencies.length === 0) {
      throw new Error('No hay destrezas disponibles en las competencias seleccionadas');
    }

    const result: TransferCompetencyIndicatorsResult = {
      mode: data.mode,
      sourceClassroom: {
        id: sourceClassroom.id,
        name: sourceClassroom.name,
      },
      selectedCompetencyCount: selectedSourceCompetencies.length,
      selectedTargetCount: resolvedTargetIds.length,
      processedTargetCount: 0,
      createdCompetencies: 0,
      createdIndicators: 0,
      skippedExistingIndicators: 0,
      skippedUnavailableCompetencies: 0,
      failedTargets: [],
      targetSummaries: [],
    };

    for (const targetClassroomId of resolvedTargetIds) {
      const targetClassroom = classroomMap.get(targetClassroomId);

      if (!targetClassroom || targetClassroom.teacherId !== teacherId) {
        result.failedTargets.push({
          classroomId: targetClassroomId,
          classroomName: targetClassroom?.name || 'Clase no disponible',
          message: 'No tienes permiso para esta clase',
        });
        continue;
      }

      if (!targetClassroom.useCompetencies || !targetClassroom.curriculumAreaId) {
        result.failedTargets.push({
          classroomId: targetClassroomId,
          classroomName: targetClassroom.name,
          message: 'La clase destino debe tener competencias y área curricular configuradas',
        });
        continue;
      }

      try {
        const targetCompetencies = await this.getTransferableCompetencies(targetClassroomId);
        const normalizedTargetCompetencyNames = new Map<string, TransferableCompetency>();
        const targetCustomCompetenciesByName = new Map<string, TransferableCompetency>();
        const indicatorNamesByClassroomCompetencyId = new Map<string, Set<string>>();
        const nextIndicatorDisplayOrderByCompetencyId = new Map<string, number>();

        for (const competency of targetCompetencies) {
          const normalizedName = this.normalizeCompetencyName(competency.name).toLowerCase();
          if (!normalizedTargetCompetencyNames.has(normalizedName)) {
            normalizedTargetCompetencyNames.set(normalizedName, competency);
          }
          if (competency.sourceType === 'CUSTOM_CLASSROOM' && !targetCustomCompetenciesByName.has(normalizedName)) {
            targetCustomCompetenciesByName.set(normalizedName, competency);
          }

          const indicatorNames = new Set(
            competency.indicators.map((indicator) => this.normalizeCompetencyName(indicator.name).toLowerCase()),
          );
          indicatorNamesByClassroomCompetencyId.set(competency.classroomCompetencyId, indicatorNames);
          nextIndicatorDisplayOrderByCompetencyId.set(
            competency.classroomCompetencyId,
            competency.indicators.reduce((maxOrder, indicator) => Math.max(maxOrder, indicator.displayOrder), 0),
          );
        }

        const [maxDisplayOrderRow] = await db
          .select({
            maxDisplayOrder: sql<number>`COALESCE(MAX(${curriculumCompetencies.displayOrder}), 0)`,
          })
          .from(curriculumCompetencies)
          .where(eq(curriculumCompetencies.areaId, targetClassroom.curriculumAreaId));

        let nextCompetencyDisplayOrder = Number(maxDisplayOrderRow?.maxDisplayOrder || 0);
        let createdCompetencies = 0;
        let createdIndicators = 0;
        let skippedExistingIndicators = 0;
        let skippedUnavailableCompetencies = 0;
        let createdAnyIndicator = false;

        await db.transaction(async (tx) => {
          for (const sourceCompetency of selectedSourceCompetencies) {
            let targetCompetency: TransferableCompetency | null = null;

            if (sourceCompetency.sourceType === 'OFFICIAL') {
              targetCompetency = targetCompetencies.find((competency) => competency.id === sourceCompetency.id) || null;
              if (!targetCompetency) {
                skippedUnavailableCompetencies += 1;
                continue;
              }
            } else {
              const normalizedSourceName = this.normalizeCompetencyName(sourceCompetency.name).toLowerCase();
              const existingCustomCompetency = targetCustomCompetenciesByName.get(normalizedSourceName);

              if (existingCustomCompetency) {
                targetCompetency = existingCustomCompetency;
              } else {
                const conflictingCompetency = normalizedTargetCompetencyNames.get(normalizedSourceName);

                if (!copyMissingCustomCompetencies || conflictingCompetency) {
                  skippedUnavailableCompetencies += 1;
                  continue;
                }

                const now = new Date();
                const newCompetencyId = uuidv4();
                const newClassroomCompetencyId = uuidv4();
                nextCompetencyDisplayOrder += 1;

                await tx.insert(curriculumCompetencies).values({
                  id: newCompetencyId,
                  areaId: targetClassroom.curriculumAreaId!,
                  sourceType: 'CUSTOM_CLASSROOM',
                  ownerClassroomId: targetClassroom.id,
                  createdByTeacherId: teacherId,
                  name: sourceCompetency.name,
                  shortName: sourceCompetency.shortName,
                  description: sourceCompetency.description,
                  displayOrder: nextCompetencyDisplayOrder,
                  isActive: true,
                  createdAt: now,
                });

                await tx.insert(classroomCompetencies).values({
                  id: newClassroomCompetencyId,
                  classroomId: targetClassroom.id,
                  competencyId: newCompetencyId,
                  weight: 100,
                  isActive: true,
                  createdAt: now,
                });

                targetCompetency = {
                  classroomCompetencyId: newClassroomCompetencyId,
                  id: newCompetencyId,
                  sourceType: 'CUSTOM_CLASSROOM',
                  ownerClassroomId: targetClassroom.id,
                  name: sourceCompetency.name,
                  shortName: sourceCompetency.shortName,
                  description: sourceCompetency.description,
                  indicators: [],
                };

                targetCompetencies.push(targetCompetency);
                targetCustomCompetenciesByName.set(normalizedSourceName, targetCompetency);
                normalizedTargetCompetencyNames.set(normalizedSourceName, targetCompetency);
                indicatorNamesByClassroomCompetencyId.set(targetCompetency.classroomCompetencyId, new Set());
                nextIndicatorDisplayOrderByCompetencyId.set(targetCompetency.classroomCompetencyId, 0);
                createdCompetencies += 1;
              }
            }

            const indicatorNames = indicatorNamesByClassroomCompetencyId.get(targetCompetency.classroomCompetencyId) || new Set<string>();
            let nextIndicatorDisplayOrder = nextIndicatorDisplayOrderByCompetencyId.get(targetCompetency.classroomCompetencyId) || 0;

            for (const sourceIndicator of sourceCompetency.indicators) {
              const normalizedIndicatorName = this.normalizeCompetencyName(sourceIndicator.name).toLowerCase();

              if (indicatorNames.has(normalizedIndicatorName)) {
                skippedExistingIndicators += 1;
                continue;
              }

              nextIndicatorDisplayOrder += 1;
              const now = new Date();

              await tx.insert(classroomCompetencyIndicators).values({
                id: uuidv4(),
                classroomCompetencyId: targetCompetency.classroomCompetencyId,
                classroomId: targetClassroom.id,
                competencyId: targetCompetency.id,
                name: sourceIndicator.name,
                description: sourceIndicator.description,
                displayOrder: nextIndicatorDisplayOrder,
                isActive: true,
                createdByTeacherId: teacherId,
                createdAt: now,
                updatedAt: now,
              });

              indicatorNames.add(normalizedIndicatorName);
              createdIndicators += 1;
              createdAnyIndicator = true;
            }

            indicatorNamesByClassroomCompetencyId.set(targetCompetency.classroomCompetencyId, indicatorNames);
            nextIndicatorDisplayOrderByCompetencyId.set(targetCompetency.classroomCompetencyId, nextIndicatorDisplayOrder);
          }

          if (createdAnyIndicator && !targetClassroom.competencyIndicatorStartPeriod) {
            await tx.update(classrooms)
              .set({
                competencyIndicatorStartPeriod: targetClassroom.currentBimester || `${new Date().getFullYear()}-B1`,
                updatedAt: new Date(),
              })
              .where(eq(classrooms.id, targetClassroom.id));
          }
        });

        result.processedTargetCount += 1;
        result.createdCompetencies += createdCompetencies;
        result.createdIndicators += createdIndicators;
        result.skippedExistingIndicators += skippedExistingIndicators;
        result.skippedUnavailableCompetencies += skippedUnavailableCompetencies;
        result.targetSummaries.push({
          classroomId: targetClassroom.id,
          classroomName: targetClassroom.name,
          createdCompetencies,
          createdIndicators,
          skippedExistingIndicators,
          skippedUnavailableCompetencies,
        });
      } catch (error) {
        result.failedTargets.push({
          classroomId: targetClassroom.id,
          classroomName: targetClassroom.name,
          message: error instanceof Error ? error.message : 'No se pudo transferir destrezas a esta clase',
        });
      }
    }

    return result;
  }

  /**
   * Sincroniza las competencias del classroom con el área curricular seleccionada
   */
  async syncClassroomCompetencies(classroomId: string, curriculumAreaId: string) {
    
    // Obtener competencias del área curricular
    const areaCompetencies = await db.select()
      .from(curriculumCompetencies)
      .where(and(
        eq(curriculumCompetencies.areaId, curriculumAreaId),
        eq(curriculumCompetencies.sourceType, 'OFFICIAL'),
        eq(curriculumCompetencies.isActive, true),
      ));


    if (areaCompetencies.length === 0) return;

    const now = new Date();

    // Verificar cuáles ya existen
    const existingCompetencies = await db.select()
      .from(classroomCompetencies)
      .where(eq(classroomCompetencies.classroomId, classroomId));

    const existingIds = new Set(existingCompetencies.map(c => c.competencyId));

    // Crear las que faltan
    const toCreate = areaCompetencies.filter(c => !existingIds.has(c.id));

    if (toCreate.length > 0) {
      await db.insert(classroomCompetencies).values(
        toCreate.map(c => ({
          id: uuidv4(),
          classroomId,
          competencyId: c.id,
          weight: 100,
          isActive: true,
          createdAt: now,
        }))
      );
    }

    return { created: toCreate.length, total: areaCompetencies.length };
  }

  async delete(classroomId: string, teacherId: string) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    // Obtener IDs de estudiantes de esta clase
    const students = await db.query.studentProfiles.findMany({
      where: eq(studentProfiles.classroomId, classroomId),
      columns: { id: true }
    });
    const studentIds = students.map(s => s.id);

    // Obtener IDs de equipos/clanes de esta clase
    const classTeams = await db.query.teams.findMany({
      where: eq(teams.classroomId, classroomId),
      columns: { id: true }
    });
    const teamIds = classTeams.map(t => t.id);

    // Obtener IDs de timed activities de esta clase
    const activities = await db.query.timedActivities.findMany({
      where: eq(timedActivities.classroomId, classroomId),
      columns: { id: true }
    });
    const activityIds = activities.map(a => a.id);

    // Obtener IDs de badges de esta clase
    const classBadges = await db.query.badges.findMany({
      where: eq(badges.classroomId, classroomId),
      columns: { id: true }
    });
    const badgeIds = classBadges.map(b => b.id);

    // Obtener IDs de question banks de esta clase
    const qBanks = await db.query.questionBanks.findMany({
      where: eq(questionBanks.classroomId, classroomId),
      columns: { id: true }
    });
    const qBankIds = qBanks.map(q => q.id);

    // Obtener IDs de shop items de esta clase
    const items = await db.query.shopItems.findMany({
      where: eq(shopItems.classroomId, classroomId),
      columns: { id: true }
    });
    const itemIds = items.map(i => i.id);

    // Obtener IDs de powers de esta clase
    const classPowers = await db.query.powers.findMany({
      where: eq(powers.classroomId, classroomId),
      columns: { id: true }
    });
    const powerIds = classPowers.map(p => p.id);

    // Obtener IDs de expediciones
    const classExpeditions = await db.query.expeditions.findMany({
      where: eq(expeditions.classroomId, classroomId),
      columns: { id: true }
    });
    const expeditionIds = classExpeditions.map(e => e.id);

    // Obtener IDs de jiro expeditions
    const classJiroExpeditions = await db.query.jiroExpeditions.findMany({
      where: eq(jiroExpeditions.classroomId, classroomId),
      columns: { id: true }
    });
    const jiroExpeditionIds = classJiroExpeditions.map(e => e.id);

    // Obtener IDs de scrolls
    const classScrolls = await db.query.scrolls.findMany({
      where: eq(scrolls.classroomId, classroomId),
      columns: { id: true }
    });
    const scrollIds = classScrolls.map(s => s.id);

    // Obtener IDs de torneos
    const classTournaments = await db.query.tournaments.findMany({
      where: eq(tournaments.classroomId, classroomId),
      columns: { id: true }
    });
    const tournamentIds = classTournaments.map(t => t.id);

    // Obtener IDs de álbumes de coleccionables
    const classAlbums = await db.query.collectibleAlbums.findMany({
      where: eq(collectibleAlbums.classroomId, classroomId),
      columns: { id: true }
    });
    const albumIds = classAlbums.map(a => a.id);

    // Eliminar en orden correcto (dependencias primero)

    // 1. Eliminar datos relacionados con estudiantes
    if (studentIds.length > 0) {
      await db.delete(pointLogs).where(inArray(pointLogs.studentId, studentIds));
      await db.delete(studentAvatarPurchases).where(inArray(studentAvatarPurchases.studentProfileId, studentIds));
      await db.delete(studentEquippedItems).where(inArray(studentEquippedItems.studentProfileId, studentIds));
      await db.delete(studentGrades).where(eq(studentGrades.classroomId, classroomId));
      await db.delete(studentActivityScores).where(inArray(studentActivityScores.studentProfileId, studentIds));
    }
    await db.delete(attendanceRecords).where(eq(attendanceRecords.classroomId, classroomId));

    // 2. Eliminar coleccionables
    if (albumIds.length > 0) {
      const albumCards = await db.query.collectibleCards.findMany({
        where: inArray(collectibleCards.albumId, albumIds),
        columns: { id: true }
      });
      const cardIds = albumCards.map(c => c.id);
      if (cardIds.length > 0) {
        await db.delete(studentCollectibles).where(inArray(studentCollectibles.cardId, cardIds));
        await db.delete(collectibleCards).where(inArray(collectibleCards.id, cardIds));
      }
      await db.delete(collectibleAlbums).where(inArray(collectibleAlbums.id, albumIds));
    }

    // 3. Eliminar datos de badges
    if (badgeIds.length > 0) {
      await db.delete(badgeProgress).where(inArray(badgeProgress.badgeId, badgeIds));
      await db.delete(studentBadges).where(inArray(studentBadges.badgeId, badgeIds));
      await db.delete(badges).where(inArray(badges.id, badgeIds));
    }

    // 4. Eliminar datos de timed activities
    if (activityIds.length > 0) {
      await db.delete(timedActivityResults).where(inArray(timedActivityResults.activityId, activityIds));
      await db.delete(timedActivities).where(inArray(timedActivities.id, activityIds));
    }

    // 5. Eliminar scrolls (pergaminos)
    if (scrollIds.length > 0) {
      await db.delete(scrollReactions).where(inArray(scrollReactions.scrollId, scrollIds));
      await db.delete(scrolls).where(inArray(scrolls.id, scrollIds));
    }

    // 6. Eliminar expediciones
    if (expeditionIds.length > 0) {
      await db.delete(expeditionSubmissions).where(inArray(expeditionSubmissions.expeditionId, expeditionIds));
      await db.delete(expeditionStudentProgress).where(inArray(expeditionStudentProgress.expeditionId, expeditionIds));
      await db.delete(expeditionPins).where(inArray(expeditionPins.expeditionId, expeditionIds));
      await db.delete(expeditions).where(inArray(expeditions.id, expeditionIds));
    }

    // 7. Eliminar jiro expeditions y datos relacionados
    if (jiroExpeditionIds.length > 0) {
      // Obtener student expeditions para limpiar sus hijos
      const jiroStudentExps = await db.query.jiroStudentExpeditions.findMany({
        where: inArray(jiroStudentExpeditions.expeditionId, jiroExpeditionIds),
        columns: { id: true }
      });
      const jiroStudentExpIds = jiroStudentExps.map(e => e.id);

      if (jiroStudentExpIds.length > 0) {
        await db.delete(jiroQuestionAnswers).where(inArray(jiroQuestionAnswers.studentExpeditionId, jiroStudentExpIds));
        await db.delete(jiroDeliveries).where(inArray(jiroDeliveries.studentExpeditionId, jiroStudentExpIds));
      }
      await db.delete(jiroStudentExpeditions).where(inArray(jiroStudentExpeditions.expeditionId, jiroExpeditionIds));
      await db.delete(jiroDeliveryStations).where(inArray(jiroDeliveryStations.expeditionId, jiroExpeditionIds));
      await db.delete(jiroExpeditionCompetencies).where(inArray(jiroExpeditionCompetencies.expeditionId, jiroExpeditionIds));
      await db.delete(jiroExpeditions).where(inArray(jiroExpeditions.id, jiroExpeditionIds));
    }

    // 8. Eliminar torneos
    if (tournamentIds.length > 0) {
      await db.delete(tournamentMatches).where(inArray(tournamentMatches.tournamentId, tournamentIds));
      await db.delete(tournamentParticipants).where(inArray(tournamentParticipants.tournamentId, tournamentIds));
      await db.delete(tournaments).where(inArray(tournaments.id, tournamentIds));
    }

    // 9. Eliminar datos de tienda
    if (itemIds.length > 0) {
      const itemPurchases = await db.query.purchases.findMany({
        where: inArray(purchases.itemId, itemIds),
        columns: { id: true }
      });
      const purchaseIds = itemPurchases.map(p => p.id);
      
      if (purchaseIds.length > 0) {
        await db.delete(itemUsages).where(inArray(itemUsages.purchaseId, purchaseIds));
      }
      await db.delete(purchases).where(inArray(purchases.itemId, itemIds));
      await db.delete(shopItems).where(inArray(shopItems.id, itemIds));
    }

    // 10. Eliminar datos de poderes
    if (powerIds.length > 0) {
      await db.delete(powerUsages).where(inArray(powerUsages.powerId, powerIds));
      await db.delete(powers).where(inArray(powers.id, powerIds));
    }

    // 11. Eliminar banco de preguntas
    if (qBankIds.length > 0) {
      await db.delete(questions).where(inArray(questions.bankId, qBankIds));
      await db.delete(questionBanks).where(inArray(questionBanks.id, qBankIds));
    }

    // 12. Eliminar datos de clanes/equipos
    if (teamIds.length > 0) {
      await db.delete(clanLogs).where(inArray(clanLogs.clanId, teamIds));
      await db.delete(teams).where(inArray(teams.id, teamIds));
    }

    // 13. Eliminar eventos aleatorios
    await db.delete(eventLogs).where(eq(eventLogs.classroomId, classroomId));
    await db.delete(randomEvents).where(eq(randomEvents.classroomId, classroomId));

    // 14. Eliminar notificaciones, streaks, login streaks, avatar items
    await db.delete(notifications).where(eq(notifications.classroomId, classroomId));
    await db.delete(loginStreaks).where(eq(loginStreaks.classroomId, classroomId));
    await db.delete(studentStreaks).where(eq(studentStreaks.classroomId, classroomId));
    await db.delete(classroomAvatarItems).where(eq(classroomAvatarItems.classroomId, classroomId));

    // 15. Eliminar competencias del aula
    await db.delete(classroomCompetencies).where(eq(classroomCompetencies.classroomId, classroomId));

    // 16. Eliminar comportamientos
    await db.delete(behaviors).where(eq(behaviors.classroomId, classroomId));

    // 17. Eliminar perfiles de estudiantes
    if (studentIds.length > 0) {
      await db.delete(studentProfiles).where(inArray(studentProfiles.id, studentIds));
    }

    // 18. Finalmente eliminar la clase
    await db.delete(classrooms).where(eq(classrooms.id, classroomId));
    
    return { success: true };
  }

  async joinByCode(code: string, userId: string, characterName: string, characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST', avatarGender: AvatarGender = 'MALE') {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, code.toUpperCase()),
    });

    if (!classroom) throw new Error('Código de clase inválido');
    if (!classroom.isActive) throw new Error('Esta clase no está activa');

    const existing = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.userId, userId)
      ),
    });

    if (existing) throw new Error('Ya estás inscrito en esta clase');

    const id = uuidv4();
    const now = new Date();

    await db.insert(studentProfiles).values({
      id,
      userId,
      classroomId: classroom.id,
      characterName,
      characterClass,
      avatarGender,
      hp: classroom.defaultHp,
      xp: classroom.defaultXp,
      gp: classroom.defaultGp,
      createdAt: now,
      updatedAt: now,
    });

    // Equipar items de avatar por defecto
    await avatarService.equipDefaultItems(id, avatarGender);

    return { classroom, profileId: id };
  }

  // Resetear puntos de todos los estudiantes (legacy — llama al selectivo con solo puntos)
  async resetAllPoints(classroomId: string, teacherId: string) {
    return this.resetClassroomSelective(classroomId, teacherId, { points: true });
  }

  // Reseteo selectivo del aula
  async resetClassroomSelective(
    classroomId: string,
    teacherId: string,
    options: {
      points?: boolean;
      history?: boolean;
      purchases?: boolean;
      badges?: boolean;
      attendance?: boolean;
      streaks?: boolean;
      clans?: boolean;
      scrolls?: boolean;
      powerUsages?: boolean;
    }
  ) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    const students = await db.query.studentProfiles.findMany({
      where: eq(studentProfiles.classroomId, classroomId),
      columns: { id: true }
    });
    const studentIds = students.map(s => s.id);

    const now = new Date();
    const cleaned: string[] = [];

    // 1. Historial de puntos
    if (options.history && studentIds.length > 0) {
      await db.delete(pointLogs).where(inArray(pointLogs.studentId, studentIds));
      cleaned.push('history');
    }

    // 2. Compras e items usados
    if (options.purchases && studentIds.length > 0) {
      const items = await db.query.shopItems.findMany({
        where: eq(shopItems.classroomId, classroomId),
        columns: { id: true }
      });
      const itemIds = items.map(i => i.id);

      if (itemIds.length > 0) {
        const itemPurchases = await db.query.purchases.findMany({
          where: inArray(purchases.itemId, itemIds),
          columns: { id: true }
        });
        const purchaseIds = itemPurchases.map(p => p.id);
        if (purchaseIds.length > 0) {
          await db.delete(itemUsages).where(inArray(itemUsages.purchaseId, purchaseIds));
        }
        await db.delete(purchases).where(inArray(purchases.itemId, itemIds));
      }
      cleaned.push('purchases');
    }

    // 3. Insignias ganadas + progreso
    if (options.badges && studentIds.length > 0) {
      await db.delete(badgeProgress).where(inArray(badgeProgress.studentProfileId, studentIds));
      await db.delete(studentBadges).where(inArray(studentBadges.studentProfileId, studentIds));
      cleaned.push('badges');
    }

    // 4. Asistencia
    if (options.attendance) {
      await db.delete(attendanceRecords).where(eq(attendanceRecords.classroomId, classroomId));
      cleaned.push('attendance');
    }

    // 5. Rachas (login streaks + student streaks)
    if (options.streaks) {
      await db.delete(loginStreaks).where(eq(loginStreaks.classroomId, classroomId));
      await db.delete(studentStreaks).where(eq(studentStreaks.classroomId, classroomId));
      cleaned.push('streaks');
    }

    // 6. Clanes — resetear stats, no eliminar
    if (options.clans) {
      const classTeams = await db.query.teams.findMany({
        where: eq(teams.classroomId, classroomId),
        columns: { id: true }
      });
      const teamIds = classTeams.map(t => t.id);

      if (teamIds.length > 0) {
        await db.delete(clanLogs).where(inArray(clanLogs.clanId, teamIds));
        await db.update(teams).set({
          totalXp: 0,
          totalGp: 0,
          wins: 0,
          losses: 0,
          updatedAt: now,
        }).where(eq(teams.classroomId, classroomId));
      }
      cleaned.push('clans');
    }

    // 7. Pergaminos
    if (options.scrolls) {
      const classScrolls = await db.query.scrolls.findMany({
        where: eq(scrolls.classroomId, classroomId),
        columns: { id: true }
      });
      const scrollIds = classScrolls.map(s => s.id);
      if (scrollIds.length > 0) {
        await db.delete(scrollReactions).where(inArray(scrollReactions.scrollId, scrollIds));
        await db.delete(scrolls).where(inArray(scrolls.id, scrollIds));
      }
      cleaned.push('scrolls');
    }

    // 8. Uso de poderes
    if (options.powerUsages && studentIds.length > 0) {
      await db.delete(powerUsages).where(inArray(powerUsages.studentId, studentIds));
      cleaned.push('powerUsages');
    }

    // 9. Puntos — siempre al final para que el historial ya esté limpio
    if (options.points) {
      await db.update(studentProfiles).set({
        xp: classroom.defaultXp,
        hp: classroom.defaultHp,
        gp: classroom.defaultGp,
        level: 1,
        updatedAt: now,
      }).where(eq(studentProfiles.classroomId, classroomId));
      cleaned.push('points');
    }

    return { success: true, cleaned };
  }

  // Obtener cantidades de elementos clonables del aula
  async getCloneableCounts(classroomId: string) {
    const [behaviorsCount] = await db.select({ count: count() })
      .from(behaviors)
      .where(eq(behaviors.classroomId, classroomId));
    
    const [badgesCount] = await db.select({ count: count() })
      .from(badges)
      .where(and(
        eq(badges.classroomId, classroomId),
        eq(badges.scope, 'CLASSROOM')
      ));
    
    const [shopItemsCount] = await db.select({ count: count() })
      .from(shopItems)
      .where(eq(shopItems.classroomId, classroomId));
    
    const [questionBanksCount] = await db.select({ count: count() })
      .from(questionBanks)
      .where(eq(questionBanks.classroomId, classroomId));

    return {
      behaviors: behaviorsCount?.count || 0,
      badges: badgesCount?.count || 0,
      shopItems: shopItemsCount?.count || 0,
      questionBanks: questionBanksCount?.count || 0,
    };
  }

  // Clonar aula con opciones selectivas
  async cloneClassroom(
    sourceClassroomId: string, 
    teacherId: string,
    options: {
      name: string;
      description?: string;
      copyBehaviors: boolean;
      copyBadges: boolean;
      copyShopItems: boolean;
      copyQuestionBanks: boolean;
      schoolId?: string | null;
    }
  ) {
    // Verificar que el aula origen existe y pertenece al profesor
    const sourceClassroom = await this.getById(sourceClassroomId);
    if (!sourceClassroom || sourceClassroom.teacherId !== teacherId) {
      throw new Error('No tienes acceso a esta aula');
    }

    const now = new Date();
    const newClassroomId = uuidv4();
    const newCode = generateClassCode();

    // Crear nueva aula con la misma configuración
    await db.insert(classrooms).values({
      id: newClassroomId,
      name: options.name,
      description: options.description || sourceClassroom.description,
      teacherId,
      code: newCode,
      gradeLevel: sourceClassroom.gradeLevel,
      // Configuración de puntos
      defaultXp: sourceClassroom.defaultXp,
      defaultHp: sourceClassroom.defaultHp,
      defaultGp: sourceClassroom.defaultGp,
      maxHp: sourceClassroom.maxHp,
      xpPerLevel: sourceClassroom.xpPerLevel,
      allowNegativeHp: sourceClassroom.allowNegativeHp,
      allowNegativePoints: sourceClassroom.allowNegativePoints,
      showReasonToStudent: sourceClassroom.showReasonToStudent,
      notifyOnPoints: sourceClassroom.notifyOnPoints,
      showCharacterName: sourceClassroom.showCharacterName,
      // Tienda
      shopEnabled: sourceClassroom.shopEnabled,
      requirePurchaseApproval: sourceClassroom.requirePurchaseApproval,
      dailyPurchaseLimit: sourceClassroom.dailyPurchaseLimit,
      // Clanes
      clansEnabled: sourceClassroom.clansEnabled,
      clanXpPercentage: sourceClassroom.clanXpPercentage,
      clanGpRewardEnabled: sourceClassroom.clanGpRewardEnabled,
      // Racha login
      loginStreakEnabled: sourceClassroom.loginStreakEnabled,
      loginStreakConfig: sourceClassroom.loginStreakConfig,
      // Scrolls
      scrollsEnabled: sourceClassroom.scrollsEnabled,
      scrollsOpen: sourceClassroom.scrollsOpen,
      scrollsMaxPerDay: sourceClassroom.scrollsMaxPerDay,
      scrollsRequireApproval: sourceClassroom.scrollsRequireApproval,
      // Competencias
      useCompetencies: sourceClassroom.useCompetencies,
      curriculumAreaId: sourceClassroom.curriculumAreaId,
      gradeScaleType: sourceClassroom.gradeScaleType,
      gradeScaleConfig: sourceClassroom.gradeScaleConfig,
      currentBimester: sourceClassroom.currentBimester,
      // Escuela
      schoolId: options.schoolId !== undefined ? (options.schoolId || null) : (sourceClassroom as any).schoolId || null,
      // Timestamps
      createdAt: now,
      updatedAt: now,
    });

    // Copiar competencias del aula si usa competencias
    if (sourceClassroom.useCompetencies && sourceClassroom.curriculumAreaId) {
      const sourceCompetencies = await db.select()
        .from(classroomCompetencies)
        .where(eq(classroomCompetencies.classroomId, sourceClassroomId));
      
      if (sourceCompetencies.length > 0) {
        await db.insert(classroomCompetencies).values(
          sourceCompetencies.map(comp => ({
            id: uuidv4(),
            classroomId: newClassroomId,
            competencyId: comp.competencyId,
            weight: comp.weight,
            isActive: comp.isActive,
            createdAt: now,
          }))
        );
      }
    }

    // Mapeo de IDs antiguos a nuevos para referencias
    const behaviorIdMap: Record<string, string> = {};
    const badgeIdMap: Record<string, string> = {};
    const questionBankIdMap: Record<string, string> = {};

    // Copiar comportamientos
    if (options.copyBehaviors) {
      const sourceBehaviors = await db.select()
        .from(behaviors)
        .where(eq(behaviors.classroomId, sourceClassroomId));
      
      if (sourceBehaviors.length > 0) {
        for (const behavior of sourceBehaviors) {
          const newBehaviorId = uuidv4();
          behaviorIdMap[behavior.id] = newBehaviorId;
          
          await db.insert(behaviors).values({
            id: newBehaviorId,
            classroomId: newClassroomId,
            name: behavior.name,
            description: behavior.description,
            pointType: behavior.pointType,
            pointValue: behavior.pointValue,
            xpValue: behavior.xpValue,
            hpValue: behavior.hpValue,
            gpValue: behavior.gpValue,
            isPositive: behavior.isPositive,
            icon: behavior.icon,
            isActive: behavior.isActive,
            competencyId: behavior.competencyId,
            createdAt: now,
          });
        }
      }
    }

    // Copiar insignias (solo las del aula, no las del sistema)
    if (options.copyBadges) {
      const sourceBadges = await db.select()
        .from(badges)
        .where(and(
          eq(badges.classroomId, sourceClassroomId),
          eq(badges.scope, 'CLASSROOM')
        ));
      
      if (sourceBadges.length > 0) {
        for (const badge of sourceBadges) {
          const newBadgeId = uuidv4();
          badgeIdMap[badge.id] = newBadgeId;
          
          // Mapear IDs de comportamientos en unlockCondition
          let newUnlockCondition = badge.unlockCondition;
          if (newUnlockCondition && typeof newUnlockCondition === 'object') {
            const condition = newUnlockCondition as { type?: string; behaviorId?: string; count?: number };
            if (condition.behaviorId && behaviorIdMap[condition.behaviorId]) {
              newUnlockCondition = {
                ...condition,
                behaviorId: behaviorIdMap[condition.behaviorId]
              };
            }
          }
          
          await db.insert(badges).values({
            id: newBadgeId,
            scope: 'CLASSROOM',
            classroomId: newClassroomId,
            createdBy: teacherId,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            customImage: badge.customImage,
            category: badge.category,
            rarity: badge.rarity,
            assignmentMode: badge.assignmentMode,
            unlockCondition: newUnlockCondition,
            rewardXp: badge.rewardXp,
            rewardGp: badge.rewardGp,
            maxAwards: badge.maxAwards,
            competencyId: badge.competencyId,
            isSecret: badge.isSecret,
            isActive: badge.isActive,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Copiar items de tienda
    if (options.copyShopItems) {
      const sourceItems = await db.select()
        .from(shopItems)
        .where(eq(shopItems.classroomId, sourceClassroomId));
      
      if (sourceItems.length > 0) {
        await db.insert(shopItems).values(
          sourceItems.map(item => ({
            id: uuidv4(),
            classroomId: newClassroomId,
            name: item.name,
            description: item.description,
            category: item.category,
            rarity: item.rarity,
            price: item.price,
            imageUrl: item.imageUrl,
            icon: item.icon,
            effectType: item.effectType,
            effectValue: item.effectValue,
            stock: item.stock,
            isActive: item.isActive,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }
    }

    // Copiar bancos de preguntas con sus preguntas
    if (options.copyQuestionBanks) {
      const sourceBanks = await db.select()
        .from(questionBanks)
        .where(eq(questionBanks.classroomId, sourceClassroomId));
      
      for (const bank of sourceBanks) {
        const newBankId = uuidv4();
        questionBankIdMap[bank.id] = newBankId;
        
        await db.insert(questionBanks).values({
          id: newBankId,
          classroomId: newClassroomId,
          name: bank.name,
          description: bank.description,
          color: bank.color,
          icon: bank.icon,
          isActive: bank.isActive,
          createdAt: now,
          updatedAt: now,
        });

        // Copiar preguntas del banco
        const sourceQuestions = await db.select()
          .from(questions)
          .where(eq(questions.bankId, bank.id));
        
        if (sourceQuestions.length > 0) {
          await db.insert(questions).values(
            sourceQuestions.map(q => ({
              id: uuidv4(),
              bankId: newBankId,
              type: q.type,
              difficulty: q.difficulty,
              points: q.points,
              questionText: q.questionText,
              imageUrl: q.imageUrl,
              options: q.options,
              correctAnswer: q.correctAnswer,
              pairs: q.pairs,
              explanation: q.explanation,
              timeLimitSeconds: q.timeLimitSeconds,
              isActive: q.isActive,
              createdAt: now,
              updatedAt: now,
            }))
          );
        }
      }
    }

    // Obtener el aula creada
    const newClassroom = await this.getById(newClassroomId);

    return {
      classroom: newClassroom,
      copied: {
        behaviors: options.copyBehaviors ? Object.keys(behaviorIdMap).length : 0,
        badges: options.copyBadges ? Object.keys(badgeIdMap).length : 0,
        shopItems: options.copyShopItems,
        questionBanks: options.copyQuestionBanks ? Object.keys(questionBankIdMap).length : 0,
      }
    };
  }
}

export const classroomService = new ClassroomService();
