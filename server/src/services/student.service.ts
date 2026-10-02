import { db } from '../db/index.js';
import { 
  studentProfiles, classrooms, users, pointLogs, notifications, classroomCompetencyIndicators, shopItems,
  studentAvatarPurchases, studentEquippedItems, studentGrades, studentActivityScores,
  badgeProgress, studentBadges, loginStreaks, studentStreaks, attendanceRecords,
  purchases, itemUsages, powerUsages, expeditionSubmissions, expeditionStudentProgress,
  jiroStudentExpeditions, jiroQuestionAnswers, jiroDeliveries,
  studentCollectibles, scrolls, scrollReactions,
  collectibleCards, collectibleAlbums, classroomCharacterClasses,
  stories,
  levelUpLogs,
} from '../db/schema.js';
import { eq, and, desc, sql, gte, inArray, or, isNull, gt, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';
import { clanService } from './clan.service.js';
import { badgeService } from './badge.service.js';
import { studentBadgesService } from './studentBadges.service.js';
import { storyService } from './story.service.js';
import { prepareForTx } from '../utils/notificationEmitter.js';
import { generateRandomCode, maskPersonName } from '../utils/helpers.js';
import { teacherVerificationService } from './teacherVerification.service.js';
import { applyPointDeltas } from '../utils/points.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';

export const ROSTER_REQUIRED_MESSAGE = 'Esta clase tiene lista: busca tu nombre en ella.';

type CharacterClass = 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
type PointType = 'XP' | 'HP' | 'GP';
type AvatarGender = 'MALE' | 'FEMALE';

interface JoinClassData {
  userId: string;
  code: string;
  characterName: string;
  characterClass: string;
  characterClassId?: string;
  avatarGender?: AvatarGender;
}

interface UpdatePointsData {
  studentId: string;
  pointType: PointType;
  amount: number;
  reason: string;
  teacherId: string;
  competencyId?: string;
  competencyIndicatorId?: string;
}

interface UpdateTeacherStudentProfileData {
  studentId: string;
  teacherId: string;
  displayName?: string;
  characterName?: string;
}

const LEGACY_CHARACTER_CLASSES = ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST'] as const;

export class StudentService {
  // Verificar código (detecta si es código de clase o de estudiante)
  async verifyCode(code: string) {
    const upperCode = code.toUpperCase();

    // Primero buscar como código de clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, upperCode),
    });

    if (classroom) {
      return {
        type: 'classroom' as const,
        classroomName: classroom.name,
        classroomCode: classroom.code,
        isActive: classroom.isActive,
        acceptingStudents: classroom.acceptingStudents,
        teacherVerified: await teacherVerificationService.isVerified(classroom.teacherId),
      };
    }

    // Luego buscar como código de estudiante (linkCode)
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.linkCode, upperCode),
    });

    if (profile) {
      const profileClassroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, profile.classroomId),
      });

      return {
        type: 'student' as const,
        studentName: maskPersonName(profile.displayName || profile.characterName),
        classroomName: profileClassroom?.name || null,
        alreadyLinked: !!profile.userId,
        teacherVerified: profileClassroom ? await teacherVerificationService.isVerified(profileClassroom.teacherId) : false,
      };
    }

    return null;
  }

  // Unirse a una clase con código
  async joinClass(data: JoinClassData) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, data.code.toUpperCase()),
    });

    if (!classroom) {
      throw new Error('Código de clase inválido');
    }

    if (!classroom.isActive) {
      throw new Error('Esta clase está archivada');
    }

    if (!classroom.acceptingStudents) {
      throw new Error('Esta clase no está aceptando alumnos nuevos. Pídele a tu profesor que lo active.');
    }

    await teacherVerificationService.assertClassroomAcceptsAccounts(classroom.id);

    // Lista cerrada: si el docente tiene nombres sin reclamar, el alumno toca el suyo en vez de crear
    // un perfil repetido (antes cada alumno con correo duplicaba su entrada de la lista).
    if (await this.hasUnclaimedRoster(classroom.id)) {
      throw new ConflictError(ROSTER_REQUIRED_MESSAGE);
    }

    const id = uuidv4();
    const now = new Date();

    const gender = data.avatarGender || 'MALE';

    // La clase de personaje debe ser de ESTA clase (antes se guardaba cualquier id que mandara el cliente).
    let characterClassId: string | null = null;
    if (data.characterClassId || data.characterClass) {
      const charClass = await db.query.classroomCharacterClasses.findFirst({
        where: and(
          eq(classroomCharacterClasses.classroomId, classroom.id),
          data.characterClassId
            ? eq(classroomCharacterClasses.id, data.characterClassId)
            : eq(classroomCharacterClasses.key, data.characterClass!),
        ),
      });
      characterClassId = charClass?.id ?? null;
    }
    const legacyClass = LEGACY_CHARACTER_CLASSES.find((key) => key === data.characterClass) ?? 'GUARDIAN';

    // Comprobar e insertar con la fila de la clase bloqueada: varios toques seguidos con la red lenta
    // del colegio creaban perfiles repetidos del mismo alumno.
    await db.transaction(async (tx) => {
      await tx.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.id, classroom.id)).for('update');
      const existing = await tx.query.studentProfiles.findFirst({
        where: and(
          eq(studentProfiles.classroomId, classroom.id),
          eq(studentProfiles.userId, data.userId)
        ),
        columns: { id: true },
      });
      if (existing) {
        throw new Error('Ya estás inscrito en esta clase');
      }
      await tx.insert(studentProfiles).values({
        id,
        userId: data.userId,
        classroomId: classroom.id,
        characterName: data.characterName,
        characterClass: legacyClass,
        characterClassId,
        avatarGender: gender,
        hp: classroom.defaultHp,
        xp: classroom.defaultXp,
        gp: classroom.defaultGp,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Equipar items de avatar por defecto
    await avatarService.equipDefaultItems(id, gender);

    return {
      profileId: id,
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
      },
    };
  }

  // Obtener perfil del estudiante en una clase
  async getProfile(userId: string, classroomId?: string) {
    if (classroomId) {
      return db.query.studentProfiles.findFirst({
        where: and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId)
        ),
      });
    }

    // Obtener todos los perfiles del estudiante
    return db.query.studentProfiles.findMany({
      where: eq(studentProfiles.userId, userId),
    });
  }

  // Obtener mis clases como estudiante (optimizado para evitar N+1)
  async getMyClasses(userId: string) {
    const profiles = await db.query.studentProfiles.findMany({
      where: eq(studentProfiles.userId, userId),
    });

    if (profiles.length === 0) return [];

    // Obtener todas las clases en una sola query
    const classroomIds = Array.from(new Set(profiles.map(p => p.classroomId)));
    const classroomsData = await db.query.classrooms.findMany({
      where: inArray(classrooms.id, classroomIds),
    });

    const classroomStudents = await db.query.studentProfiles.findMany({
      where: inArray(studentProfiles.classroomId, classroomIds),
      columns: {
        id: true,
        classroomId: true,
        xp: true,
        isActive: true,
      },
    });

    const classroomRankingMap = new Map<string, { studentCount: number; rankByStudentId: Map<string, number> }>();

    for (const classroomId of classroomIds) {
      const activeStudents = classroomStudents
        .filter((student) => student.classroomId === classroomId && student.isActive !== false)
        .sort((a, b) => b.xp - a.xp);

      classroomRankingMap.set(classroomId, {
        studentCount: activeStudents.length,
        rankByStudentId: new Map(activeStudents.map((student, index) => [student.id, index + 1])),
      });
    }

    // Clases con historia en curso (el menú "Mi Historia" no depende de que la historia tenga tema).
    const storyRows = await db.select({ classroomId: stories.classroomId })
      .from(stories)
      .where(and(inArray(stories.classroomId, classroomIds), eq(stories.isActive, true)));
    const withStory = new Set(storyRows.map((row) => row.classroomId));

    // Tienda: premios a la venta por clase y premios propios (o pedidos pendientes) por perfil. El menú
    // muestra "Tienda" solo si hay qué comprar o algo tuyo que ver o usar.
    const profileIds = profiles.map((profile) => profile.id);
    const [itemRows, ownedRows] = await Promise.all([
      db.select({ classroomId: shopItems.classroomId, count: sql<string>`COUNT(*)` })
        .from(shopItems)
        .where(and(inArray(shopItems.classroomId, classroomIds), eq(shopItems.isActive, true), or(isNull(shopItems.stock), gt(shopItems.stock, 0))))
        .groupBy(shopItems.classroomId),
      db.select({ studentId: purchases.studentId, count: sql<string>`COUNT(*)` })
        .from(purchases)
        .innerJoin(shopItems, eq(shopItems.id, purchases.itemId))
        .where(and(
          inArray(purchases.studentId, profileIds),
          or(
            eq(purchases.status, 'PENDING'),
            and(eq(purchases.status, 'APPROVED'), or(ne(shopItems.category, 'CONSUMABLE'), sql`${purchases.quantity} > ${purchases.usedQuantity}`)),
            // Un uso pedido aún es suyo: lo ve «Esperando a tu profe» en la tienda.
            sql`EXISTS (SELECT 1 FROM ${itemUsages} WHERE ${itemUsages.purchaseId} = ${purchases.id} AND ${itemUsages.status} = 'PENDING')`,
          ),
        ))
        .groupBy(purchases.studentId),
    ]);
    const itemsByClass = new Map(itemRows.map((row) => [row.classroomId, Number(row.count)]));
    const ownedByProfile = new Map(ownedRows.map((row) => [row.studentId, Number(row.count)]));
    // Insignias: el menú muestra «Mis insignias» si la clase tiene alguna que se pueda ganar o el alumno tiene alguna.
    const badgeSummaries = await studentBadgesService.getSummaries(profiles.map((profile) => ({ id: profile.id, classroomId: profile.classroomId })));

    // Crear mapa de clases
    const classroomMap = new Map(classroomsData.map(c => [c.id, { ...c, hasActiveStory: withStory.has(c.id) }]));

    // Combinar perfiles con clases y limpiar huérfanos
    const results = [];
    for (const profile of profiles) {
      const classroom = classroomMap.get(profile.classroomId);
      if (!classroom) {
        // Eliminar perfil huérfano de forma asíncrona (no bloquea)
        db.delete(studentProfiles).where(eq(studentProfiles.id, profile.id)).catch(() => {});
        continue;
      }

      const classroomRanking = classroomRankingMap.get(profile.classroomId);

      results.push({
        ...profile,
        classroom,
        classroomRank: classroomRanking?.rankByStudentId.get(profile.id) ?? null,
        classroomStudentCount: classroomRanking?.studentCount ?? 0,
        shopSummary: { items: itemsByClass.get(profile.classroomId) ?? 0, owned: ownedByProfile.get(profile.id) ?? 0 },
        badgeSummary: badgeSummaries.get(profile.id) ?? { available: 0, owned: 0 },
      });
    }

    return results;
  }

  // Obtener estudiante por ID (para profesores)
  async getStudentById(studentId: string) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!profile) return null;

    let user = null;
    if (profile.userId) {
      user = await db.query.users.findFirst({
        where: eq(users.id, profile.userId),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });
    }

    return { ...profile, user };
  }

  async updateStudentByTeacher(data: UpdateTeacherStudentProfileData) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, data.studentId),
    });

    if (!profile) {
      throw new Error('Estudiante no encontrado');
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, profile.classroomId),
    });

    if (!classroom || classroom.teacherId !== data.teacherId) {
      throw new Error('No tienes permiso para modificar este estudiante');
    }

    if (profile.userId && data.displayName !== undefined) {
      throw new Error('No puedes editar el nombre base de un estudiante ya vinculado');
    }

    const updateData: Partial<typeof studentProfiles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
    }

    if (data.characterName !== undefined) {
      updateData.characterName = data.characterName;
    }

    await db.update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, data.studentId));

    return this.getStudentById(data.studentId);
  }

  // Modificar puntos (XP, HP, GP)
  async updatePoints(data: UpdatePointsData) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, data.studentId),
    });

    if (!profile) {
      throw new Error('Estudiante no encontrado');
    }

    // Verificar que el profesor tenga acceso a esta clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, profile.classroomId),
    });

    if (!classroom || classroom.teacherId !== data.teacherId) {
      throw new Error('No tienes permiso para modificar este estudiante');
    }

    if (data.competencyIndicatorId) {
      const [indicator] = await db.select({
        competencyId: classroomCompetencyIndicators.competencyId,
      })
        .from(classroomCompetencyIndicators)
        .where(and(
          eq(classroomCompetencyIndicators.id, data.competencyIndicatorId),
          eq(classroomCompetencyIndicators.classroomId, profile.classroomId),
          eq(classroomCompetencyIndicators.isActive, true),
        ));

      if (!indicator || (data.competencyId && indicator.competencyId !== data.competencyId)) {
        throw new Error('La destreza seleccionada no pertenece a la competencia de esta clase');
      }

      data.competencyId = indicator.competencyId;
    }

    // Los límites de PV se aplican en SQL sobre el valor real (sin leer antes el saldo),
    // así un cambio simultáneo de otro origen no se pierde ni se pisa.
    const deltaField = data.pointType.toLowerCase() as 'xp' | 'hp' | 'gp';
    // Con 0 HP el alumno descansa: sumar HP no lo levanta (solo su misión de recuperación).
    if (data.pointType === 'HP' && data.amount > 0 && profile.hp <= 0) {
      return {
        student: await this.getStudentById(data.studentId),
        leveledUp: false,
        newLevel: undefined,
        fromLevel: undefined,
        studentName: profile.characterName || 'Estudiante',
        awardedBadges: [],
        restingIgnored: true,
      };
    }
    const rules = {
      xpPerLevel: classroom.xpPerLevel || 100,
      hpMin: 0,
      hpMax: classroom.maxHp,
      source: 'POINTS' as const,
    };
    let leveledUp = false;
    let newLevel = profile.level;
    let fromLevel = profile.level;

    const now = new Date();

    const pointLogEntry: typeof pointLogs.$inferInsert = {
      id: uuidv4(),
      studentId: data.studentId,
      competencyId: data.competencyId || undefined,
      competencyIndicatorId: data.competencyIndicatorId || undefined,
      pointType: data.pointType,
      action: data.amount >= 0 ? 'ADD' : 'REMOVE',
      amount: Math.abs(data.amount),
      reason: data.reason,
      givenBy: data.teacherId,
      createdAt: now,
    };

    const notificationsBatch: typeof notifications.$inferInsert[] = [];

    // Crear notificación de puntos (solo si tiene cuenta vinculada y la clase lo permite)
    if (profile.userId && classroom.notifyOnPoints) {
      const actionText = data.amount >= 0 ? 'recibiste' : 'perdiste';
      const pointTypeEmoji = data.pointType === 'XP' ? '⚡' : data.pointType === 'HP' ? '❤️' : '🪙';
      const pointTypeName = data.pointType === 'XP' ? 'XP' : data.pointType === 'HP' ? 'HP' : 'Oro';
      
      notificationsBatch.push({
        id: uuidv4(),
        userId: profile.userId,
        type: 'POINTS',
        title: data.amount >= 0 ? '¡Puntos recibidos!' : 'Puntos perdidos',
        message: classroom.showReasonToStudent && data.reason
          ? `${actionText} ${pointTypeEmoji}${Math.abs(data.amount)} ${pointTypeName} por: ${data.reason}`
          : `${actionText} ${pointTypeEmoji}${Math.abs(data.amount)} ${pointTypeName}`,
        isRead: false,
        createdAt: now,
      });
    }

    let notifTx = prepareForTx(notificationsBatch);

    await db.transaction(async (tx) => {
      const updated = await applyPointDeltas(tx, data.studentId, { [deltaField]: data.amount }, rules);
      if (!updated) throw new Error('Estudiante no encontrado');

      // Subida de nivel decidida con el XP real resultante
      if (updated.level > updated.previousLevel) {
        leveledUp = true;
        newLevel = updated.level;
        fromLevel = updated.previousLevel;
        if (profile.userId && classroom.notifyOnPoints) {
          notificationsBatch.push({
            id: uuidv4(),
            userId: profile.userId,
            type: 'LEVEL_UP',
            title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
            classroomId: profile.classroomId,
            data: { studentProfileId: data.studentId, fromLevel: updated.previousLevel, toLevel: updated.level },
            isRead: false,
            createdAt: now,
          });
          notifTx = prepareForTx(notificationsBatch);
        }
      }

      await tx.insert(pointLogs).values(pointLogEntry);

      if (notifTx.entries.length > 0) {
        await tx.insert(notifications).values(notifTx.entries);
      }
    });

    await notifTx.emitAfterCommit();

    // Contribuir XP al clan si está habilitado
    if (data.pointType === 'XP' && data.amount > 0) {
      try {
        await clanService.contributeXpToClan(data.studentId, data.amount, data.reason || 'XP ganado');
      } catch (error) {
        // Silently fail - don't break point update
      }
      // Storytelling: procesar donaciones virtuales
      try {
        await storyService.onXpAwarded(profile.classroomId, data.studentId, data.amount);
      } catch (error) {
        // Silently fail
      }
    }

    // Verificar insignias
    let awardedBadges: string[] = [];
    try {
      const earnedBadges = await badgeService.checkAndAwardBadges({
        type: 'POINTS_ADDED',
        data: {
          studentProfileId: data.studentId,
          classroomId: profile.classroomId,
          totalXp: data.pointType === 'XP' ? data.amount : undefined,
        },
      });
      if (earnedBadges.length > 0) {
        awardedBadges = earnedBadges.map(b => b.name);
      }
    } catch (error) {
      console.error('Error checking badges:', error);
    }

    const updatedStudent = await this.getStudentById(data.studentId);
    
    return {
      student: updatedStudent,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      fromLevel: leveledUp ? fromLevel : undefined,
      studentName: profile.characterName || 'Estudiante',
      awardedBadges,
      restingIgnored: false,
    };
  }

  // Calcular nivel basado en XP y xpPerLevel configurado
  // Sistema progresivo: nivel N requiere N * xpPerLevel para subir al siguiente
  // XP total para nivel N = xpPerLevel * N * (N-1) / 2
  // Nivel 1→2: 100 XP, Nivel 2→3: 200 XP, Nivel 3→4: 300 XP, etc.
  private calculateLevel(xp: number, xpPerLevel: number = 100): number {
    // Fórmula inversa: nivel = floor((1 + sqrt(1 + 8*xp/xpPerLevel)) / 2)
    const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / xpPerLevel)) / 2);
    return Math.max(1, level);
  }

  // Obtener historial de puntos
  async getPointHistory(studentId: string, limit = 20) {
    return db.query.pointLogs.findMany({
      where: eq(pointLogs.studentId, studentId),
      orderBy: [desc(pointLogs.createdAt)],
      limit,
    });
  }

  // Actualizar perfil del estudiante
  async updateProfile(userId: string, classroomId: string, data: { characterName?: string; avatarUrl?: string }) {
    const profile = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId)
      ),
    });

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    await db.update(studentProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentProfiles.id, profile.id));

    return this.getStudentById(profile.id);
  }

  // Crear estudiante demo para onboarding
  async createDemoStudent(classroomId: string, teacherId: string) {
    // Verificar que el profesor sea dueño de la clase
    const classroom = await db.query.classrooms.findFirst({
      where: and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ),
    });

    if (!classroom) {
      throw new Error('Clase no encontrada o no tienes permisos');
    }

    // Verificar si ya existe un estudiante demo en esta clase
    const existingDemo = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isDemo, true)
      ),
    });

    if (existingDemo) {
      return existingDemo;
    }

    const id = uuidv4();
    const now = new Date();
    const demoNames = ['Alex Demo', 'Demo Student', 'Estudiante Prueba'];
    const demoClasses: CharacterClass[] = ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST'];
    
    const randomName = demoNames[Math.floor(Math.random() * demoNames.length)];
    const randomClass = demoClasses[Math.floor(Math.random() * demoClasses.length)];

    await db.insert(studentProfiles).values({
      id,
      userId: teacherId, // El demo pertenece al profesor
      classroomId,
      characterName: randomName,
      characterClass: randomClass,
      avatarGender: 'MALE',
      hp: classroom.defaultHp,
      xp: classroom.defaultXp,
      gp: classroom.defaultGp,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });

    // Equipar items de avatar por defecto
    await avatarService.equipDefaultItems(id, 'MALE');

    return this.getStudentById(id);
  }

  // Eliminar estudiante demo
  async deleteDemoStudent(classroomId: string, teacherId: string) {
    // Verificar que el profesor sea dueño de la clase
    const classroom = await db.query.classrooms.findFirst({
      where: and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ),
    });

    if (!classroom) {
      throw new Error('Clase no encontrada o no tienes permisos');
    }

    // Buscar y eliminar el estudiante demo
    const demoStudent = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isDemo, true)
      ),
    });

    if (!demoStudent) {
      throw new Error('No hay estudiante demo en esta clase');
    }

    // Eliminar logs de puntos del demo
    await db.delete(pointLogs).where(eq(pointLogs.studentId, demoStudent.id));
    await db.delete(levelUpLogs).where(eq(levelUpLogs.studentProfileId, demoStudent.id));
    
    // Eliminar el perfil demo
    await db.delete(studentProfiles).where(eq(studentProfiles.id, demoStudent.id));

    return { success: true, message: 'Estudiante demo eliminado' };
  }

  // Verificar si existe estudiante demo en una clase
  async hasDemoStudent(classroomId: string) {
    const demoStudent = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isDemo, true)
      ),
    });

    return !!demoStudent;
  }

  // ==================== ESTUDIANTES PLACEHOLDER ====================

  // Generar código de vinculación único
  private generateLinkCode(): string {
    return generateRandomCode(6);
  }

  // Crear estudiante placeholder (sin cuenta)
  async createPlaceholderStudent(data: {
    classroomId: string;
    displayName: string;
    characterClass: CharacterClass;
    avatarGender?: AvatarGender;
    teacherId: string;
  }) {
    // Verificar que el profesor tenga acceso a esta clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, data.classroomId),
    });

    if (!classroom || classroom.teacherId !== data.teacherId) {
      throw new Error('No tienes permiso para crear estudiantes en esta clase');
    }

    // Generar código único
    let linkCode = this.generateLinkCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.linkCode, linkCode),
      });
      if (!existing) break;
      linkCode = this.generateLinkCode();
      attempts++;
    }

    const id = uuidv4();
    const now = new Date();
    const gender = data.avatarGender || 'MALE';

    await db.insert(studentProfiles).values({
      id,
      userId: null, // Sin usuario vinculado
      classroomId: data.classroomId,
      displayName: data.displayName,
      linkCode,
      characterName: data.displayName,
      characterClass: data.characterClass,
      avatarGender: gender,
      hp: classroom.defaultHp,
      xp: classroom.defaultXp,
      gp: classroom.defaultGp,
      createdAt: now,
      updatedAt: now,
    });

    // Equipar items de avatar por defecto
    await avatarService.equipDefaultItems(id, gender);

    return {
      id,
      displayName: data.displayName,
      linkCode,
      characterClass: data.characterClass,
      avatarGender: gender,
      classroom: {
        id: classroom.id,
        name: classroom.name,
      },
    };
  }

  // Crear múltiples estudiantes placeholder
  async createBulkPlaceholderStudents(data: {
    classroomId: string;
    students: Array<{
      displayName: string;
      characterClass?: CharacterClass;
      avatarGender?: AvatarGender;
    }>;
    teacherId: string;
  }) {
    const results = [];
    const defaultClasses: CharacterClass[] = ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST'];

    for (let i = 0; i < data.students.length; i++) {
      const student = data.students[i];
      const result = await this.createPlaceholderStudent({
        classroomId: data.classroomId,
        displayName: student.displayName,
        characterClass: student.characterClass || defaultClasses[i % 4],
        avatarGender: student.avatarGender,
        teacherId: data.teacherId,
      });
      results.push(result);
    }

    return results;
  }

  // Vincular cuenta de estudiante con código
  async linkStudentAccount(data: {
    userId: string;
    linkCode: string;
    characterName?: string;
    avatarGender?: 'MALE' | 'FEMALE';
  }) {
    // Buscar perfil con ese código
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.linkCode, data.linkCode.toUpperCase()),
    });

    if (!profile) {
      throw new Error('Código de vinculación inválido');
    }

    if (profile.userId) {
      throw new Error('Este perfil ya está vinculado a una cuenta');
    }

    return this.linkProfileToUser(profile, data);
  }

  /** ¿El docente tiene nombres en la lista que nadie ha reclamado? (alumnos demo y retirados no cuentan) */
  async hasUnclaimedRoster(classroomId: string): Promise<boolean> {
    const [row] = await db.select({ id: studentProfiles.id }).from(studentProfiles).where(and(
      eq(studentProfiles.classroomId, classroomId),
      sql`${studentProfiles.userId} IS NULL`,
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
    )).limit(1);
    return !!row;
  }

  /**
   * Alumno con cuenta (correo o Google) que toca su nombre en la lista de la clase. Igual que con el
   * código de clase: solo mientras el docente recibe alumnos (si no, con su código personal).
   */
  async linkRosterProfile(data: {
    userId: string;
    classCode: string;
    studentId: string;
    characterName?: string;
    avatarGender?: 'MALE' | 'FEMALE';
  }) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, data.classCode.toUpperCase()),
      columns: { id: true, isActive: true, acceptingStudents: true },
    });
    if (!classroom || !classroom.isActive) throw new NotFoundError('No encontramos esa clase.');
    if (!classroom.acceptingStudents) {
      throw new ForbiddenError('Esta clase no está recibiendo estudiantes ahora. Pídele tu código personal a tu profe.');
    }
    const profile = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.id, data.studentId),
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.isActive, true),
      ),
    });
    if (!profile || profile.isDemo) throw new NotFoundError('No encontramos tu nombre en esta clase.');
    if (profile.userId) throw new ConflictError('Ese nombre ya tiene acceso. Si es tuyo, pídele ayuda a tu profe.');
    return this.linkProfileToUser(profile, data);
  }

  /** Vincula un perfil de la lista (sin cuenta) a la cuenta del alumno: tarjeta o nombre de la lista. */
  private async linkProfileToUser(
    profile: typeof studentProfiles.$inferSelect,
    data: { userId: string; characterName?: string; avatarGender?: 'MALE' | 'FEMALE' },
  ) {
    await teacherVerificationService.assertClassroomAcceptsAccounts(profile.classroomId);

    // Verificar que el usuario no esté ya en esta clase con otro perfil
    const existingProfile = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, profile.classroomId),
        eq(studentProfiles.userId, data.userId),
        eq(studentProfiles.isActive, true)
      ),
    });

    if (existingProfile && existingProfile.id !== profile.id) {
      // El usuario ya tiene un perfil diferente en esta clase
      // Obtener nombre de la clase para el mensaje
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, profile.classroomId),
      });
      throw new Error(`Ya tienes un perfil en "${classroom?.name || 'esta clase'}". Si necesitas usar este código, contacta a tu profesor.`);
    }

    // Vincular cuenta y actualizar datos del personaje
    const updateData: any = {
      userId: data.userId,
      linkCode: null, // Eliminar código después de vincular
      updatedAt: new Date(),
    };

    // Actualizar nombre si se proporciona
    if (data.characterName && data.characterName.trim()) {
      updateData.characterName = data.characterName.trim();
    }

    // Actualizar género de avatar si se proporciona
    if (data.avatarGender) {
      updateData.avatarGender = data.avatarGender;
    }

    const updateResult = await db.update(studentProfiles)
      .set(updateData)
      .where(and(
        eq(studentProfiles.id, profile.id),
        eq(studentProfiles.isActive, true),
        sql`${studentProfiles.userId} IS NULL`,
      ));
    const header = Array.isArray(updateResult) ? updateResult[0] : updateResult;
    if (Number((header as { affectedRows?: number }).affectedRows ?? 0) !== 1) {
      throw new Error('Este código ya fue usado');
    }

    // Asignar items por defecto según el género seleccionado
    // Esto reemplaza cualquier item equipado anteriormente con los del género correcto
    const finalGender = data.avatarGender || profile.avatarGender || 'MALE';
    await avatarService.assignDefaultItems(profile.id, finalGender as AvatarGender);

    // Obtener datos de la clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, profile.classroomId),
    });

    return {
      profileId: profile.id,
      classroom: {
        id: classroom?.id,
        name: classroom?.name,
      },
      characterName: data.characterName || profile.characterName,
      characterClass: profile.characterClass,
      displayName: profile.displayName,
    };
  }

  // Obtener estudiantes placeholder de una clase
  async getPlaceholderStudents(classroomId: string, teacherId: string) {
    // Verificar acceso
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No tienes acceso a esta clase');
    }

    const students = await db
      .select()
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        sql`${studentProfiles.linkCode} IS NOT NULL`
      ));

    return students.map(s => ({
      id: s.id,
      displayName: s.displayName,
      linkCode: s.linkCode,
      characterClass: s.characterClass,
      avatarGender: s.avatarGender,
      xp: s.xp,
      hp: s.hp,
      gp: s.gp,
      level: s.level,
    }));
  }

  // Regenerar código de vinculación
  async regenerateLinkCode(studentId: string, teacherId: string) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!profile) {
      throw new Error('Estudiante no encontrado');
    }

    // Verificar acceso
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, profile.classroomId),
    });

    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para modificar este estudiante');
    }

    if (profile.userId) {
      throw new Error('Este estudiante ya tiene cuenta vinculada');
    }

    // Generar nuevo código
    let linkCode = this.generateLinkCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.linkCode, linkCode),
      });
      if (!existing) break;
      linkCode = this.generateLinkCode();
      attempts++;
    }

    await db.update(studentProfiles)
      .set({ linkCode, updatedAt: new Date() })
      .where(eq(studentProfiles.id, studentId));

    return { linkCode };
  }

  // Retirar estudiante de una clase (eliminar perfil y todos sus datos)
  async removeStudentFromClass(studentId: string, teacherId: string) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!profile) {
      throw new Error('Estudiante no encontrado');
    }

    // Verificar que el profesor sea dueño de la clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, profile.classroomId),
    });

    if (!classroom || classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para retirar este estudiante');
    }

    // No permitir eliminar estudiantes demo desde aquí
    if (profile.isDemo) {
      throw new Error('No se puede retirar un estudiante demo desde esta opción');
    }

    const classroomId = profile.classroomId;

    // Todo o nada: si un borrado falla, el alumno no queda a medio retirar.
    await db.transaction(async (tx) => {
      // 1. Point logs
      await tx.delete(pointLogs).where(eq(pointLogs.studentId, studentId));
      await tx.delete(levelUpLogs).where(eq(levelUpLogs.studentProfileId, studentId));

      // 2. Avatar purchases & equipped items
      await tx.delete(studentAvatarPurchases).where(eq(studentAvatarPurchases.studentProfileId, studentId));
      await tx.delete(studentEquippedItems).where(eq(studentEquippedItems.studentProfileId, studentId));

      // 3. Grades & activity scores
      await tx.delete(studentGrades).where(eq(studentGrades.studentProfileId, studentId));
      await tx.delete(studentActivityScores).where(eq(studentActivityScores.studentProfileId, studentId));

      // 4. Badges
      await tx.delete(badgeProgress).where(eq(badgeProgress.studentProfileId, studentId));
      await tx.delete(studentBadges).where(eq(studentBadges.studentProfileId, studentId));

      // 5. Login streaks & student streaks
      await tx.delete(loginStreaks).where(eq(loginStreaks.studentProfileId, studentId));
      await tx.delete(studentStreaks).where(eq(studentStreaks.studentProfileId, studentId));

      // 6. Attendance
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.studentProfileId, studentId));

      // 7. Purchases & item usages
      const studentPurchases = await tx.query.purchases.findMany({
        where: eq(purchases.studentId, studentId),
        columns: { id: true },
      });
      const purchaseIds = studentPurchases.map(p => p.id);
      if (purchaseIds.length > 0) {
        await tx.delete(itemUsages).where(inArray(itemUsages.purchaseId, purchaseIds));
      }
      await tx.delete(purchases).where(eq(purchases.studentId, studentId));

      // 8. Power usages
      await tx.delete(powerUsages).where(eq(powerUsages.studentId, studentId));

      // 9. Expeditions
      await tx.delete(expeditionSubmissions).where(eq(expeditionSubmissions.studentProfileId, studentId));
      await tx.delete(expeditionStudentProgress).where(eq(expeditionStudentProgress.studentProfileId, studentId));

      // 10. Jiro expeditions
      const jiroStudentExps = await tx.query.jiroStudentExpeditions.findMany({
        where: eq(jiroStudentExpeditions.studentProfileId, studentId),
        columns: { id: true },
      });
      const jiroStudentExpIds = jiroStudentExps.map(e => e.id);
      if (jiroStudentExpIds.length > 0) {
        await tx.delete(jiroQuestionAnswers).where(inArray(jiroQuestionAnswers.studentExpeditionId, jiroStudentExpIds));
        await tx.delete(jiroDeliveries).where(inArray(jiroDeliveries.studentExpeditionId, jiroStudentExpIds));
      }
      await tx.delete(jiroStudentExpeditions).where(eq(jiroStudentExpeditions.studentProfileId, studentId));

      // 12. Collectibles
      await tx.delete(studentCollectibles).where(eq(studentCollectibles.studentProfileId, studentId));

      // 13. Scrolls
      const studentScrolls = await tx.query.scrolls.findMany({
        where: eq(scrolls.authorId, studentId),
        columns: { id: true },
      });
      const scrollIds = studentScrolls.map(s => s.id);
      if (scrollIds.length > 0) {
        await tx.delete(scrollReactions).where(inArray(scrollReactions.scrollId, scrollIds));
        await tx.delete(scrolls).where(inArray(scrolls.id, scrollIds));
      }

      // 14. Notifications (if user linked)
      if (profile.userId) {
        await tx.delete(notifications).where(
          and(
            eq(notifications.userId, profile.userId),
            eq(notifications.classroomId, classroomId),
          )
        );
      }

      // 15. Finally delete the student profile
      await tx.delete(studentProfiles).where(eq(studentProfiles.id, studentId));
    });

    return {
      success: true,
      studentName: profile.characterName || profile.displayName || 'Estudiante',
    };
  }
}

export const studentService = new StudentService();
