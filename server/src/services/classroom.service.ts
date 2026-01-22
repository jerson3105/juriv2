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
  curriculumCompetencies
} from '../db/schema.js';
import { eq, and, desc, inArray, sql, count } from 'drizzle-orm';
import { generateClassCode } from '../utils/helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';

type AvatarGender = 'MALE' | 'FEMALE';

interface CreateClassroomData {
  name: string;
  description?: string;
  teacherId: string;
  gradeLevel?: string;
  useCompetencies?: boolean;
  curriculumAreaId?: string | null;
  gradeScaleType?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
}

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
}

export class ClassroomService {
  async create(data: CreateClassroomData) {
    const id = uuidv4();
    const code = generateClassCode();
    const now = new Date();
    
    await db.insert(classrooms).values({
      id,
      name: data.name,
      description: data.description || null,
      teacherId: data.teacherId,
      gradeLevel: data.gradeLevel || null,
      code,
      useCompetencies: data.useCompetencies || false,
      curriculumAreaId: data.curriculumAreaId || null,
      gradeScaleType: data.gradeScaleType || null,
      createdAt: now,
      updatedAt: now,
    });

    return db.query.classrooms.findFirst({
      where: eq(classrooms.id, id),
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
      avatarGender: studentProfiles.avatarGender,
      level: studentProfiles.level,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      gp: studentProfiles.gp,
      teamId: studentProfiles.teamId,
      isActive: studentProfiles.isActive,
      isDemo: studentProfiles.isDemo,
      // Datos del usuario real
      realName: users.firstName,
      realLastName: users.lastName,
      // Datos del clan
      clanName: teams.name,
      clanColor: teams.color,
      clanEmblem: teams.emblem,
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

  /**
   * Sincroniza las competencias del classroom con el área curricular seleccionada
   */
  async syncClassroomCompetencies(classroomId: string, curriculumAreaId: string) {
    
    // Obtener competencias del área curricular
    const areaCompetencies = await db.select()
      .from(curriculumCompetencies)
      .where(eq(curriculumCompetencies.areaId, curriculumAreaId));


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

    // Eliminar en orden correcto (dependencias primero)
    
    // 1. Eliminar datos relacionados con estudiantes
    if (studentIds.length > 0) {
      await db.delete(pointLogs).where(inArray(pointLogs.studentId, studentIds));
      await db.delete(studentAvatarPurchases).where(inArray(studentAvatarPurchases.studentProfileId, studentIds));
      await db.delete(studentEquippedItems).where(inArray(studentEquippedItems.studentProfileId, studentIds));
      await db.delete(attendanceRecords).where(eq(attendanceRecords.classroomId, classroomId));
    }

    // 2. Eliminar datos de badges
    if (badgeIds.length > 0) {
      await db.delete(badgeProgress).where(inArray(badgeProgress.badgeId, badgeIds));
      await db.delete(studentBadges).where(inArray(studentBadges.badgeId, badgeIds));
      await db.delete(badges).where(inArray(badges.id, badgeIds));
    }

    // 3. Eliminar datos de timed activities
    if (activityIds.length > 0) {
      await db.delete(timedActivityResults).where(inArray(timedActivityResults.activityId, activityIds));
      await db.delete(timedActivities).where(inArray(timedActivities.id, activityIds));
    }

    // 6. Eliminar datos de tienda
    if (itemIds.length > 0) {
      // Obtener purchases
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

    // 7. Eliminar datos de poderes
    if (powerIds.length > 0) {
      await db.delete(powerUsages).where(inArray(powerUsages.powerId, powerIds));
      await db.delete(powers).where(inArray(powers.id, powerIds));
    }

    // 8. Eliminar banco de preguntas
    if (qBankIds.length > 0) {
      await db.delete(questions).where(inArray(questions.bankId, qBankIds));
      await db.delete(questionBanks).where(inArray(questionBanks.id, qBankIds));
    }

    // 9. Eliminar datos de clanes/equipos
    if (teamIds.length > 0) {
      await db.delete(clanLogs).where(inArray(clanLogs.clanId, teamIds));
      await db.delete(teams).where(inArray(teams.id, teamIds));
    }

    // 10. Eliminar comportamientos
    await db.delete(behaviors).where(eq(behaviors.classroomId, classroomId));

    // 11. Eliminar perfiles de estudiantes
    if (studentIds.length > 0) {
      await db.delete(studentProfiles).where(inArray(studentProfiles.id, studentIds));
    }

    // 12. Finalmente eliminar la clase
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

  // Resetear puntos de todos los estudiantes
  async resetAllPoints(classroomId: string, teacherId: string) {
    const classroom = await this.getById(classroomId);
    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No autorizado');
    }

    const now = new Date();
    
    // Resetear XP, HP y GP a los valores por defecto de la clase
    await db.update(studentProfiles).set({
      xp: classroom.defaultXp,
      hp: classroom.defaultHp,
      gp: classroom.defaultGp,
      level: 1,
      updatedAt: now,
    }).where(eq(studentProfiles.classroomId, classroomId));

    return { success: true, message: 'Puntos reseteados' };
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
