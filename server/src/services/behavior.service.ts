import { db } from '../db/index.js';
import { behaviors, studentProfiles, pointLogs, classrooms, notifications } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { badgeService } from './badge.service.js';
import { clanService } from './clan.service.js';
import { missionService } from './mission.service.js';

type PointType = 'XP' | 'HP' | 'GP';

interface CreateBehaviorData {
  classroomId: string;
  name: string;
  description?: string;
  pointType: PointType; // Legacy - tipo principal
  pointValue: number; // Legacy - valor principal
  xpValue?: number;
  hpValue?: number;
  gpValue?: number;
  isPositive: boolean;
  icon?: string;
}

interface ApplyBehaviorData {
  behaviorId: string;
  studentIds: string[];
  teacherId: string;
}

export class BehaviorService {
  // Crear un nuevo comportamiento/preset
  async create(data: CreateBehaviorData) {
    const id = uuidv4();
    const now = new Date();

    // Si se proporcionan valores combinados, usarlos; sino usar legacy
    const xpValue = data.xpValue ?? (data.pointType === 'XP' ? data.pointValue : 0);
    const hpValue = data.hpValue ?? (data.pointType === 'HP' ? data.pointValue : 0);
    const gpValue = data.gpValue ?? (data.pointType === 'GP' ? data.pointValue : 0);

    await db.insert(behaviors).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      pointType: data.pointType,
      pointValue: data.pointValue,
      xpValue,
      hpValue,
      gpValue,
      isPositive: data.isPositive,
      icon: data.icon || null,
      createdAt: now,
    });

    return this.getById(id);
  }

  // Obtener comportamiento por ID
  async getById(id: string) {
    return db.query.behaviors.findFirst({
      where: eq(behaviors.id, id),
    });
  }

  // Obtener todos los comportamientos de una clase
  async getByClassroom(classroomId: string) {
    return db.query.behaviors.findMany({
      where: and(
        eq(behaviors.classroomId, classroomId),
        eq(behaviors.isActive, true)
      ),
    });
  }

  // Obtener comportamientos positivos (para agregar puntos)
  async getPositive(classroomId: string) {
    return db.query.behaviors.findMany({
      where: and(
        eq(behaviors.classroomId, classroomId),
        eq(behaviors.isPositive, true),
        eq(behaviors.isActive, true)
      ),
    });
  }

  // Obtener comportamientos negativos (para quitar puntos)
  async getNegative(classroomId: string) {
    return db.query.behaviors.findMany({
      where: and(
        eq(behaviors.classroomId, classroomId),
        eq(behaviors.isPositive, false),
        eq(behaviors.isActive, true)
      ),
    });
  }

  // Actualizar comportamiento
  async update(id: string, data: Partial<CreateBehaviorData>) {
    await db.update(behaviors)
      .set(data)
      .where(eq(behaviors.id, id));

    return this.getById(id);
  }

  // Eliminar comportamiento (soft delete)
  async delete(id: string) {
    await db.update(behaviors)
      .set({ isActive: false })
      .where(eq(behaviors.id, id));
  }

  // Aplicar comportamiento a múltiples estudiantes
  async applyToStudents(data: ApplyBehaviorData) {
    const behavior = await this.getById(data.behaviorId);
    if (!behavior) {
      throw new Error('Comportamiento no encontrado');
    }

    // Verificar que el profesor tenga acceso a esta clase
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, behavior.classroomId),
    });

    if (!classroom || classroom.teacherId !== data.teacherId) {
      throw new Error('No tienes permiso para aplicar este comportamiento');
    }

    // Obtener los perfiles de estudiantes
    const students = await db.query.studentProfiles.findMany({
      where: and(
        inArray(studentProfiles.id, data.studentIds),
        eq(studentProfiles.classroomId, behavior.classroomId)
      ),
    });

    if (students.length === 0) {
      throw new Error('No se encontraron estudiantes válidos');
    }

    const now = new Date();
    const results: { studentId: string; studentName: string; xpChange: number; hpChange: number; gpChange: number; newXp: number; newHp: number; newGp: number; leveledUp?: boolean; newLevel?: number }[] = [];
    const levelUps: { studentId: string; studentName: string; newLevel: number }[] = [];
    const xpPerLevel = classroom.xpPerLevel || 100;

    // Usar valores combinados, con fallback a legacy
    const xpChange = behavior.xpValue ?? (behavior.pointType === 'XP' ? behavior.pointValue : 0);
    const hpChange = behavior.hpValue ?? (behavior.pointType === 'HP' ? behavior.pointValue : 0);
    const gpChange = behavior.gpValue ?? (behavior.pointType === 'GP' ? behavior.pointValue : 0);

    // Preparar datos para batch inserts
    const pointLogsBatch: typeof pointLogs.$inferInsert[] = [];
    const notificationsBatch: typeof notifications.$inferInsert[] = [];

    // Calcular nuevos valores para cada estudiante
    for (const student of students) {
      let newXp = student.xp;
      let newHp = student.hp;
      let newGp = student.gp;
      let leveledUp = false;
      let newLevel = student.level;

      // Aplicar cambios según si es positivo o negativo
      if (behavior.isPositive) {
        newXp += xpChange;
        newHp = Math.min(newHp + hpChange, classroom.maxHp); // HP no puede exceder máximo
        newGp += gpChange;
      } else {
        newXp -= xpChange;
        newHp = classroom.allowNegativeHp ? newHp - hpChange : Math.max(0, newHp - hpChange);
        newGp -= gpChange;
      }

      // Verificar nivel (solo si hay cambio de XP positivo)
      if (xpChange > 0 && behavior.isPositive) {
        newLevel = this.calculateLevel(newXp, xpPerLevel);
        if (newLevel > student.level) {
          leveledUp = true;
          levelUps.push({
            studentId: student.id,
            studentName: student.characterName || 'Estudiante',
            newLevel,
          });
        }
      }

      // Actualizar perfil
      const updateData: Record<string, unknown> = { 
        updatedAt: now,
        xp: newXp,
        hp: newHp,
        gp: newGp,
      };
      if (leveledUp) updateData.level = newLevel;
      
      await db.update(studentProfiles)
        .set(updateData)
        .where(eq(studentProfiles.id, student.id));

      // Contribuir XP al clan si es comportamiento positivo con XP
      if (behavior.isPositive && xpChange > 0) {
        try {
          await clanService.contributeXpToClan(student.id, xpChange, behavior.name);
        } catch (error) {
          // Silently fail - don't break behavior application
        }
      }

      // Tracking de misiones - actualizar progreso
      if (behavior.isPositive) {
        try {
          // Tracking de XP ganado
          if (xpChange > 0) {
            await missionService.updateMissionProgress(student.id, 'EARN_XP', xpChange);
          }
          // Tracking de GP ganado
          if (gpChange > 0) {
            await missionService.updateMissionProgress(student.id, 'EARN_GP', gpChange);
          }
        } catch (error) {
          // Silently fail - don't break behavior application
          console.error('Error updating mission progress:', error);
        }
      }

      // Preparar logs para cada tipo de punto que cambió
      if (xpChange > 0) {
        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          behaviorId: behavior.id,
          pointType: 'XP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: xpChange,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }
      if (hpChange > 0) {
        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          behaviorId: behavior.id,
          pointType: 'HP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: hpChange,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }
      if (gpChange > 0) {
        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          behaviorId: behavior.id,
          pointType: 'GP',
          action: behavior.isPositive ? 'ADD' : 'REMOVE',
          amount: gpChange,
          reason: behavior.name,
          givenBy: data.teacherId,
          createdAt: now,
        });
      }

      // Preparar notificaciones para batch (solo si el estudiante tiene userId vinculado)
      if (classroom.notifyOnPoints && student.userId) {
        const actionText = behavior.isPositive ? 'recibiste' : 'perdiste';
        const parts: string[] = [];
        if (xpChange > 0) parts.push(`⚡${xpChange} XP`);
        if (hpChange > 0) parts.push(`❤️${hpChange} HP`);
        if (gpChange > 0) parts.push(`🪙${gpChange} Oro`);
        
        const pointsText = parts.join(', ');
        
        notificationsBatch.push({
          id: uuidv4(),
          userId: student.userId,
          type: 'POINTS',
          title: behavior.isPositive ? '¡Puntos recibidos!' : 'Puntos perdidos',
          message: classroom.showReasonToStudent 
            ? `${actionText} ${pointsText} por: ${behavior.name}`
            : `${actionText} ${pointsText}`,
          isRead: false,
          createdAt: now,
        });

        if (leveledUp) {
          // Notificación para el estudiante
          notificationsBatch.push({
            id: uuidv4(),
            userId: student.userId,
            type: 'LEVEL_UP',
            title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
            isRead: false,
            createdAt: now,
          });
        }
      }
      
      // Notificación de level up para el profesor (siempre, independiente del userId del estudiante)
      if (classroom.notifyOnPoints && leveledUp) {
        notificationsBatch.push({
          id: uuidv4(),
          userId: data.teacherId,
          classroomId: behavior.classroomId,
          type: 'LEVEL_UP',
          title: '🎉 ¡Estudiante subió de nivel!',
          message: `${student.characterName || 'Un estudiante'} ha alcanzado el nivel ${newLevel}`,
          isRead: false,
          createdAt: now,
        });
      }

      results.push({ 
        studentId: student.id, 
        studentName: student.characterName || 'Estudiante',
        xpChange: behavior.isPositive ? xpChange : -xpChange,
        hpChange: behavior.isPositive ? hpChange : -hpChange,
        gpChange: behavior.isPositive ? gpChange : -gpChange,
        newXp,
        newHp,
        newGp,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined,
      });
    }

    // Batch inserts - mucho más eficiente
    if (pointLogsBatch.length > 0) {
      await db.insert(pointLogs).values(pointLogsBatch);
    }
    if (notificationsBatch.length > 0) {
      await db.insert(notifications).values(notificationsBatch);
    }

    // Verificar insignias para cada estudiante
    const awardedBadges: { studentId: string; badges: string[] }[] = [];
    for (const student of students) {
      try {
        const earnedBadges = await badgeService.checkAndAwardBadges({
          type: 'BEHAVIOR_APPLIED',
          data: {
            studentProfileId: student.id,
            classroomId: behavior.classroomId,
            behaviorId: behavior.id,
            behaviorType: behavior.isPositive ? 'positive' : 'negative',
          },
        });
        if (earnedBadges.length > 0) {
          awardedBadges.push({
            studentId: student.id,
            badges: earnedBadges.map(b => b.name),
          });
        }
      } catch (error) {
        console.error('Error checking badges for student:', student.id, error);
      }
    }

    return {
      behavior,
      studentsAffected: results.length,
      results,
      levelUps,
      awardedBadges,
    };
  }

  // Calcular nivel basado en XP y xpPerLevel configurado
  // Sistema progresivo: nivel N requiere N * xpPerLevel para subir al siguiente
  private calculateLevel(xp: number, xpPerLevel: number = 100): number {
    const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / xpPerLevel)) / 2);
    return Math.max(1, level);
  }
}

export const behaviorService = new BehaviorService();
