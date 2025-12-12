import { db } from '../db/index.js';
import { studentProfiles, classrooms, users, pointLogs, notifications, behaviors } from '../db/schema.js';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';
import { clanService } from './clan.service.js';
import { missionService } from './mission.service.js';
import { badgeService } from './badge.service.js';

type CharacterClass = 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
type PointType = 'XP' | 'HP' | 'GP';
type AvatarGender = 'MALE' | 'FEMALE';

interface JoinClassData {
  userId: string;
  code: string;
  characterName: string;
  characterClass: CharacterClass;
  avatarGender?: AvatarGender;
}

interface UpdatePointsData {
  studentId: string;
  pointType: PointType;
  amount: number;
  reason: string;
  teacherId: string;
}

export class StudentService {
  // Unirse a una clase con código
  async joinClass(data: JoinClassData) {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, data.code.toUpperCase()),
    });

    if (!classroom) {
      throw new Error('Código de clase inválido');
    }

    if (!classroom.isActive) {
      throw new Error('Esta clase no está activa');
    }

    // Verificar si ya está inscrito
    const existing = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.userId, data.userId)
      ),
    });

    if (existing) {
      throw new Error('Ya estás inscrito en esta clase');
    }

    const id = uuidv4();
    const now = new Date();

    const gender = data.avatarGender || 'MALE';
    
    await db.insert(studentProfiles).values({
      id,
      userId: data.userId,
      classroomId: classroom.id,
      characterName: data.characterName,
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
    const classroomIds = profiles.map(p => p.classroomId);
    const classroomsData = await db.query.classrooms.findMany({
      where: inArray(classrooms.id, classroomIds),
    });

    // Crear mapa de clases
    const classroomMap = new Map(classroomsData.map(c => [c.id, c]));

    // Combinar perfiles con clases y limpiar huérfanos
    const results = [];
    for (const profile of profiles) {
      const classroom = classroomMap.get(profile.classroomId);
      if (!classroom) {
        // Eliminar perfil huérfano de forma asíncrona (no bloquea)
        db.delete(studentProfiles).where(eq(studentProfiles.id, profile.id)).catch(() => {});
        continue;
      }
      results.push({ ...profile, classroom });
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

    // Calcular nuevo valor
    let newValue: number;
    const currentValue = profile[data.pointType.toLowerCase() as 'xp' | 'hp' | 'gp'];
    let leveledUp = false;
    let newLevel = profile.level;

    if (data.amount >= 0) {
      newValue = currentValue + data.amount;
    } else {
      // Verificar si se permite HP negativo
      if (data.pointType === 'HP' && !classroom.allowNegativeHp) {
        newValue = Math.max(0, currentValue + data.amount);
      } else {
        newValue = currentValue + data.amount;
      }
    }

    // Para HP, no puede exceder maxHp
    if (data.pointType === 'HP' && data.amount > 0) {
      newValue = Math.min(newValue, classroom.maxHp);
    }

    // Actualizar perfil
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    updateData[data.pointType.toLowerCase()] = newValue;

    // Si es XP, verificar si sube de nivel usando xpPerLevel de la clase
    if (data.pointType === 'XP' && data.amount > 0) {
      const xpPerLevel = classroom.xpPerLevel || 100;
      newLevel = this.calculateLevel(newValue, xpPerLevel);
      if (newLevel > profile.level) {
        updateData.level = newLevel;
        leveledUp = true;
      }
    }

    await db.update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, data.studentId));

    // Registrar en el log
    await db.insert(pointLogs).values({
      id: uuidv4(),
      studentId: data.studentId,
      pointType: data.pointType,
      action: data.amount >= 0 ? 'ADD' : 'REMOVE',
      amount: Math.abs(data.amount),
      reason: data.reason,
      givenBy: data.teacherId,
      createdAt: new Date(),
    });

    // Contribuir XP al clan si está habilitado
    if (data.pointType === 'XP' && data.amount > 0) {
      try {
        await clanService.contributeXpToClan(data.studentId, data.amount, data.reason || 'XP ganado');
      } catch (error) {
        // Silently fail - don't break point update
      }
    }

    // Tracking de misiones - puntos manuales
    if (data.amount > 0) {
      try {
        if (data.pointType === 'XP') {
          await missionService.updateMissionProgress(data.studentId, 'EARN_XP', data.amount);
        } else if (data.pointType === 'GP') {
          await missionService.updateMissionProgress(data.studentId, 'EARN_GP', data.amount);
        }
      } catch (error) {
        console.error('Error updating mission progress:', error);
      }
    }

    // Crear notificación de puntos (solo si tiene cuenta vinculada y la clase lo permite)
    if (profile.userId && classroom.notifyOnPoints) {
      const actionText = data.amount >= 0 ? 'recibiste' : 'perdiste';
      const pointTypeEmoji = data.pointType === 'XP' ? '⚡' : data.pointType === 'HP' ? '❤️' : '🪙';
      const pointTypeName = data.pointType === 'XP' ? 'XP' : data.pointType === 'HP' ? 'HP' : 'Oro';
      
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: profile.userId,
        type: 'POINTS',
        title: data.amount >= 0 ? '¡Puntos recibidos!' : 'Puntos perdidos',
        message: classroom.showReasonToStudent && data.reason
          ? `${actionText} ${pointTypeEmoji}${Math.abs(data.amount)} ${pointTypeName} por: ${data.reason}`
          : `${actionText} ${pointTypeEmoji}${Math.abs(data.amount)} ${pointTypeName}`,
        isRead: false,
        createdAt: new Date(),
      });
    }

    // Crear notificación de subida de nivel (solo si tiene cuenta vinculada)
    if (leveledUp && profile.userId) {
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: profile.userId,
        type: 'LEVEL_UP',
        title: '🎉 ¡Subiste de nivel!',
        message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
        isRead: false,
        createdAt: new Date(),
      });
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
      studentName: profile.characterName || 'Estudiante',
      awardedBadges,
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

  // Obtener estadísticas detalladas del estudiante
  async getStudentStats(studentId: string) {
    const student = await this.getStudentById(studentId);
    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    // Fechas para filtros
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Obtener todos los logs de puntos
    const allLogs = await db
      .select({
        id: pointLogs.id,
        pointType: pointLogs.pointType,
        action: pointLogs.action,
        amount: pointLogs.amount,
        reason: pointLogs.reason,
        behaviorId: pointLogs.behaviorId,
        createdAt: pointLogs.createdAt,
      })
      .from(pointLogs)
      .where(eq(pointLogs.studentId, studentId))
      .orderBy(desc(pointLogs.createdAt));

    // Calcular totales por tipo
    const xpGained = allLogs
      .filter(l => l.pointType === 'XP' && l.action === 'ADD')
      .reduce((sum, l) => sum + l.amount, 0);
    const xpLost = allLogs
      .filter(l => l.pointType === 'XP' && l.action === 'REMOVE')
      .reduce((sum, l) => sum + l.amount, 0);
    const gpGained = allLogs
      .filter(l => l.pointType === 'GP' && l.action === 'ADD')
      .reduce((sum, l) => sum + l.amount, 0);
    const gpSpent = allLogs
      .filter(l => l.pointType === 'GP' && l.action === 'REMOVE')
      .reduce((sum, l) => sum + l.amount, 0);
    const hpLost = allLogs
      .filter(l => l.pointType === 'HP' && l.action === 'REMOVE')
      .reduce((sum, l) => sum + l.amount, 0);
    const hpRecovered = allLogs
      .filter(l => l.pointType === 'HP' && l.action === 'ADD')
      .reduce((sum, l) => sum + l.amount, 0);

    // XP esta semana
    const weekLogs = allLogs.filter(l => new Date(l.createdAt) >= startOfWeek);
    const xpThisWeek = weekLogs
      .filter(l => l.pointType === 'XP' && l.action === 'ADD')
      .reduce((sum, l) => sum + l.amount, 0);

    // XP este mes
    const monthLogs = allLogs.filter(l => new Date(l.createdAt) >= startOfMonth);
    const xpThisMonth = monthLogs
      .filter(l => l.pointType === 'XP' && l.action === 'ADD')
      .reduce((sum, l) => sum + l.amount, 0);

    // Obtener comportamientos más frecuentes (positivos y negativos)
    const behaviorCounts: Record<string, { count: number; isPositive: boolean; name: string }> = {};
    
    for (const log of allLogs) {
      if (log.behaviorId) {
        if (!behaviorCounts[log.behaviorId]) {
          behaviorCounts[log.behaviorId] = { count: 0, isPositive: log.action === 'ADD', name: '' };
        }
        behaviorCounts[log.behaviorId].count++;
      }
    }

    // Obtener nombres de comportamientos
    const behaviorIds = Object.keys(behaviorCounts);
    if (behaviorIds.length > 0) {
      const behaviorData = await db
        .select({ id: behaviors.id, name: behaviors.name, isPositive: behaviors.isPositive })
        .from(behaviors)
        .where(sql`${behaviors.id} IN (${sql.join(behaviorIds.map(id => sql`${id}`), sql`, `)})`);
      
      for (const b of behaviorData) {
        if (behaviorCounts[b.id]) {
          behaviorCounts[b.id].name = b.name;
          behaviorCounts[b.id].isPositive = b.isPositive;
        }
      }
    }

    // Separar en fortalezas y áreas de mejora
    const sortedBehaviors = Object.entries(behaviorCounts)
      .map(([id, data]) => ({ id, ...data }))
      .filter(b => b.name)
      .sort((a, b) => b.count - a.count);

    const strengths = sortedBehaviors.filter(b => b.isPositive).slice(0, 5);
    const areasToImprove = sortedBehaviors.filter(b => !b.isPositive).slice(0, 5);

    // XP ganado por día de la semana actual (solo esta semana)
    const activityByDay = [0, 0, 0, 0, 0, 0, 0]; // Dom-Sab
    for (const log of weekLogs) {
      // Solo contar XP ganado (positivo)
      if (log.pointType === 'XP' && log.action === 'ADD') {
        const day = new Date(log.createdAt).getDay();
        activityByDay[day] += log.amount;
      }
    }

    // Historial reciente (últimos 100 para paginación en cliente)
    const recentHistory = allLogs.slice(0, 100).map(log => ({
      id: log.id,
      type: log.pointType,
      action: log.action,
      amount: log.amount,
      reason: log.reason,
      date: log.createdAt,
    }));

    // Calcular racha (días consecutivos con actividad)
    const uniqueDays = new Set(
      allLogs.map(l => new Date(l.createdAt).toDateString())
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      if (uniqueDays.has(checkDate.toDateString())) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      summary: {
        totalXpGained: xpGained,
        totalXpLost: xpLost,
        netXp: xpGained - xpLost,
        totalGpGained: gpGained,
        totalGpSpent: gpSpent,
        totalHpLost: hpLost,
        totalHpRecovered: hpRecovered,
        xpThisWeek,
        xpThisMonth,
        totalActions: allLogs.length,
        streak,
      },
      strengths,
      areasToImprove,
      activityByDay,
      recentHistory,
    };
  }

  // ==================== ESTUDIANTES PLACEHOLDER ====================

  // Generar código de vinculación único
  private generateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

    await db.update(studentProfiles)
      .set(updateData)
      .where(eq(studentProfiles.id, profile.id));

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

  // Completar configuración inicial para estudiantes B2B
  async completeInitialSetup(studentId: string, data: {
    characterName: string;
    avatarGender: 'MALE' | 'FEMALE';
  }) {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });

    if (!profile) {
      throw new Error('Perfil de estudiante no encontrado');
    }

    if (!profile.needsSetup) {
      throw new Error('Este perfil ya ha sido configurado');
    }

    // Actualizar el perfil con el género y nombre de personaje
    await db.update(studentProfiles)
      .set({
        characterName: data.characterName,
        avatarGender: data.avatarGender,
        needsSetup: false,
        updatedAt: new Date(),
      })
      .where(eq(studentProfiles.id, studentId));

    // Asignar items de avatar por defecto según el género
    await avatarService.assignDefaultItems(studentId, data.avatarGender);

    return db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentId),
    });
  }
}

export const studentService = new StudentService();
