import { db } from '../db/index.js';
import { 
  randomEvents, 
  eventLogs, 
  studentProfiles,
  pointLogs,
  classrooms,
} from '../db/schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface EventEffect {
  type: 'XP' | 'HP' | 'GP';
  action: 'ADD' | 'REMOVE';
  value: number;
}

interface CreateEventData {
  classroomId: string;
  name: string;
  description: string;
  category: 'BONUS' | 'CHALLENGE' | 'ROULETTE' | 'SPECIAL';
  targetType: 'ALL' | 'RANDOM_ONE' | 'RANDOM_SOME' | 'TOP' | 'BOTTOM';
  targetCount?: number;
  effects: EventEffect[];
  icon?: string;
  color?: string;
  probability?: number;
  // Programación
  scheduledAt?: Date;
  repeatType?: 'NONE' | 'DAILY' | 'WEEKLY';
  repeatDays?: number[];
  repeatTime?: string;
  // Duración
  durationType?: 'INSTANT' | 'TIMED' | 'SESSION';
  durationMinutes?: number;
}

interface UpdateEventData extends Partial<Omit<CreateEventData, 'classroomId'>> {
  isActive?: boolean;
}

interface TriggerResult {
  success: boolean;
  message: string;
  affectedStudents?: {
    id: string;
    name: string;
    changes?: any;
  }[];
  event?: {
    name: string;
    description: string;
    icon: string;
    effects: EventEffect[];
  };
  eventLog?: any;
  isChallenge?: boolean;
  challengeData?: any;
}

type PointStatField = 'xp' | 'hp' | 'gp';
type EventTargetType = CreateEventData['targetType'];
type StudentProfileRow = typeof studentProfiles.$inferSelect;

// Eventos predefinidos del sistema
const SYSTEM_EVENTS: CreateEventData[] = [
  {
    classroomId: '', // Se asigna al crear
    name: 'Lluvia de Oro',
    description: '¡Todos los estudiantes reciben monedas de oro!',
    category: 'BONUS',
    targetType: 'ALL',
    effects: [{ type: 'GP', action: 'ADD', value: 5 }],
    icon: '💰',
    color: 'amber',
  },
  {
    classroomId: '',
    name: 'Bendición del Sanador',
    description: 'Todos recuperan puntos de vida',
    category: 'BONUS',
    targetType: 'ALL',
    effects: [{ type: 'HP', action: 'ADD', value: 10 }],
    icon: '💚',
    color: 'green',
  },
  {
    classroomId: '',
    name: 'Explosión de XP',
    description: '¡Experiencia extra para todos!',
    category: 'BONUS',
    targetType: 'ALL',
    effects: [{ type: 'XP', action: 'ADD', value: 15 }],
    icon: '⚡',
    color: 'emerald',
  },
  {
    classroomId: '',
    name: 'El Elegido',
    description: 'Un estudiante aleatorio recibe una gran recompensa',
    category: 'SPECIAL',
    targetType: 'RANDOM_ONE',
    effects: [
      { type: 'XP', action: 'ADD', value: 25 },
      { type: 'GP', action: 'ADD', value: 10 },
    ],
    icon: '👑',
    color: 'yellow',
  },
  {
    classroomId: '',
    name: 'Tormenta Oscura',
    description: 'Todos pierden un poco de vida... ¡cuidado!',
    category: 'CHALLENGE',
    targetType: 'ALL',
    effects: [{ type: 'HP', action: 'REMOVE', value: 5 }],
    icon: '🌩️',
    color: 'gray',
  },
  {
    classroomId: '',
    name: 'Impuesto Real',
    description: 'El rey cobra impuestos a todos',
    category: 'CHALLENGE',
    targetType: 'ALL',
    effects: [{ type: 'GP', action: 'REMOVE', value: 3 }],
    icon: '👑',
    color: 'red',
  },
  {
    classroomId: '',
    name: 'Héroe del Día',
    description: 'El estudiante con más XP recibe un bonus',
    category: 'SPECIAL',
    targetType: 'TOP',
    targetCount: 1,
    effects: [{ type: 'GP', action: 'ADD', value: 15 }],
    icon: '🦸',
    color: 'violet',
  },
  {
    classroomId: '',
    name: 'Apoyo al Rezagado',
    description: 'El estudiante con menos XP recibe ayuda',
    category: 'SPECIAL',
    targetType: 'BOTTOM',
    targetCount: 1,
    effects: [
      { type: 'XP', action: 'ADD', value: 20 },
      { type: 'HP', action: 'ADD', value: 15 },
    ],
    icon: '🤝',
    color: 'blue',
  },
  {
    classroomId: '',
    name: 'Lotería Mágica',
    description: '3 estudiantes aleatorios ganan premios',
    category: 'ROULETTE',
    targetType: 'RANDOM_SOME',
    targetCount: 3,
    effects: [{ type: 'GP', action: 'ADD', value: 8 }],
    icon: '🎰',
    color: 'pink',
  },
  {
    classroomId: '',
    name: 'Sacrificio Heroico',
    description: 'Pierdes vida pero ganas experiencia',
    category: 'CHALLENGE',
    targetType: 'ALL',
    effects: [
      { type: 'HP', action: 'REMOVE', value: 10 },
      { type: 'XP', action: 'ADD', value: 20 },
    ],
    icon: '⚔️',
    color: 'orange',
  },
];

class EventsService {
  /**
   * Obtener eventos de una clase (incluye globales)
   */
  async getClassroomEvents(classroomId: string) {
    const events = await db
      .select()
      .from(randomEvents)
      .where(
        sql`${randomEvents.classroomId} = ${classroomId} OR ${randomEvents.isGlobal} = true`
      )
      .orderBy(desc(randomEvents.createdAt));

    return events;
  }

  /**
   * Obtener eventos predefinidos del sistema
   */
  getSystemEvents() {
    return SYSTEM_EVENTS;
  }

  /**
   * Crear un evento personalizado
   */
  async createEvent(data: CreateEventData) {
    try {
      const id = uuidv4();
      const now = new Date();
      
      await db.insert(randomEvents).values({
        id,
        classroomId: data.classroomId,
        name: data.name,
        description: data.description,
        category: data.category,
        targetType: data.targetType,
        targetCount: data.targetCount || 1,
        effects: data.effects,
        icon: data.icon || '🎲',
        color: data.color || 'violet',
        probability: data.probability || 100,
        // Programación
        scheduledAt: data.scheduledAt || null,
        repeatType: data.repeatType || 'NONE',
        repeatDays: data.repeatDays || null,
        repeatTime: data.repeatTime || null,
        // Duración
        durationType: data.durationType || 'INSTANT',
        durationMinutes: data.durationMinutes || 0,
        // Estado
        isGlobal: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const [event] = await db
        .select()
        .from(randomEvents)
        .where(eq(randomEvents.id, id));

      return event;
    } catch (error: any) {
      console.error('Error in createEvent:', error?.message, error?.stack);
      throw error;
    }
  }

  /**
   * Actualizar un evento personalizado
   */
  async updateEvent(eventId: string, classroomId: string, data: UpdateEventData) {
    // Verificar que el evento existe y pertenece a la clase
    const [existing] = await db
      .select()
      .from(randomEvents)
      .where(and(
        eq(randomEvents.id, eventId),
        eq(randomEvents.classroomId, classroomId)
      ));

    if (!existing) {
      return { success: false, message: 'Evento no encontrado' };
    }

    if (existing.isGlobal) {
      return { success: false, message: 'No se pueden editar eventos globales' };
    }

    // Construir objeto de actualización
    const updateData: any = { updatedAt: new Date() };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.targetType !== undefined) updateData.targetType = data.targetType;
    if (data.targetCount !== undefined) updateData.targetCount = data.targetCount;
    if (data.effects !== undefined) updateData.effects = data.effects;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;
    if (data.repeatType !== undefined) updateData.repeatType = data.repeatType;
    if (data.repeatDays !== undefined) updateData.repeatDays = data.repeatDays;
    if (data.repeatTime !== undefined) updateData.repeatTime = data.repeatTime;
    if (data.durationType !== undefined) updateData.durationType = data.durationType;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db
      .update(randomEvents)
      .set(updateData)
      .where(eq(randomEvents.id, eventId));

    const [updated] = await db
      .select()
      .from(randomEvents)
      .where(eq(randomEvents.id, eventId));

    return { success: true, event: updated };
  }

  /**
   * Obtener un evento por ID
   */
  async getEventById(eventId: string) {
    const [event] = await db
      .select()
      .from(randomEvents)
      .where(eq(randomEvents.id, eventId));
    return event;
  }

  /**
   * Obtener solo eventos personalizados de una clase (sin globales)
   */
  async getCustomEvents(classroomId: string) {
    const events = await db
      .select()
      .from(randomEvents)
      .where(and(
        eq(randomEvents.classroomId, classroomId),
        eq(randomEvents.isGlobal, false)
      ))
      .orderBy(desc(randomEvents.createdAt));

    return events;
  }

  /**
   * Activar ruleta de eventos (selección aleatoria de TODOS los eventos)
   */
  async spinEventRoulette(classroomId: string, triggeredBy: string): Promise<TriggerResult & { isChallenge?: boolean; challengeData?: any }> {
    // Obtener TODOS los eventos activos (sistema + personalizados)
    const allEvents = await db
      .select()
      .from(randomEvents)
      .where(and(
        sql`(${randomEvents.classroomId} = ${classroomId} OR ${randomEvents.isGlobal} = true)`,
        eq(randomEvents.isActive, true)
      ));

    // Si no hay eventos en DB, usar los del sistema
    if (allEvents.length === 0) {
      // Seleccionar un evento aleatorio del sistema
      const randomIndex = Math.floor(Math.random() * SYSTEM_EVENTS.length);
      return this.triggerSystemEvent(randomIndex, classroomId, triggeredBy);
    }

    // Calcular probabilidades totales
    const totalProbability = allEvents.reduce((sum, e) => sum + (e.probability || 100), 0);
    const random = Math.random() * totalProbability;
    
    // Seleccionar evento basado en probabilidad
    let cumulative = 0;
    let selectedEvent = allEvents[0];
    
    for (const event of allEvents) {
      cumulative += event.probability || 100;
      if (random <= cumulative) {
        selectedEvent = event;
        break;
      }
    }

    // Si es un CHALLENGE o tiene temporizador, devolver datos para que el frontend maneje
    if (selectedEvent.category === 'CHALLENGE' || selectedEvent.durationType === 'TIMED') {
      const challengeResult = await this.startChallenge(selectedEvent.id, classroomId);
      return {
        success: true,
        message: `Evento seleccionado: ${selectedEvent.name}`,
        isChallenge: true,
        challengeData: {
          ...challengeResult.challengeData,
          // Agregar info del temporizador
          durationType: selectedEvent.durationType,
          durationMinutes: selectedEvent.durationMinutes,
        },
      };
    }

    // Activar el evento seleccionado (no es desafío ni tiene temporizador)
    return this.triggerEvent(selectedEvent.id, classroomId, triggeredBy);
  }

  /**
   * Activar/disparar un evento
   */
  async triggerEvent(
    eventId: string, 
    classroomId: string, 
    triggeredBy: string
  ): Promise<TriggerResult> {
    // Obtener el evento
    const [event] = await db
      .select()
      .from(randomEvents)
      .where(eq(randomEvents.id, eventId));

    if (!event) {
      return { success: false, message: 'Evento no encontrado' };
    }

    if (!event.isGlobal && event.classroomId !== classroomId) {
      return { success: false, message: 'El evento no pertenece a esta clase' };
    }

    // Obtener estudiantes de la clase
    const students = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    if (students.length === 0) {
      return { success: false, message: 'No hay estudiantes en la clase' };
    }

    const effects = this.parseEventEffects(event.effects);
    const targetStudents = this.selectTargetStudents(
      students,
      event.targetType,
      event.targetCount,
      1
    );

    // Aplicar efectos a cada estudiante
    const affectedStudents: TriggerResult['affectedStudents'] = targetStudents.map((student) => ({
      id: student.id,
      name: student.characterName || 'Estudiante',
      changes: effects,
    }));
    const now = new Date();
    const pointLogsBatch: typeof pointLogs.$inferInsert[] = [];
    const studentUpdates: { studentId: string; updates: Partial<Record<PointStatField, number>> }[] = [];

    for (const student of targetStudents) {
      const nextValues: Record<PointStatField, number> = {
        xp: student.xp,
        hp: student.hp,
        gp: student.gp,
      };

      for (const effect of effects) {
        const field = this.effectTypeToField(effect.type);
        const currentValue = nextValues[field];
        nextValues[field] = effect.action === 'ADD'
          ? currentValue + effect.value
          : Math.max(0, currentValue - effect.value);

        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          pointType: effect.type,
          action: effect.action,
          amount: effect.value,
          reason: `Evento: ${event.name}`,
          givenBy: triggeredBy,
          createdAt: now,
        });
      }

      const updates: Partial<Record<PointStatField, number>> = {};
      if (nextValues.xp !== student.xp) updates.xp = nextValues.xp;
      if (nextValues.hp !== student.hp) updates.hp = nextValues.hp;
      if (nextValues.gp !== student.gp) updates.gp = nextValues.gp;

      if (Object.keys(updates).length > 0) {
        studentUpdates.push({ studentId: student.id, updates });
      }
    }

    // Registrar en event_logs
    const logId = uuidv4();

    await db.transaction(async (tx) => {
      for (const update of studentUpdates) {
        await tx
          .update(studentProfiles)
          .set(update.updates)
          .where(eq(studentProfiles.id, update.studentId));
      }

      if (pointLogsBatch.length > 0) {
        await tx.insert(pointLogs).values(pointLogsBatch);
      }

      await tx.insert(eventLogs).values({
        id: logId,
        eventId,
        classroomId,
        triggeredBy,
        affectedStudents: affectedStudents.map(s => s.id),
        appliedEffects: effects,
        triggeredAt: now,
      });
    });

    return {
      success: true,
      message: `Evento "${event.name}" activado`,
      affectedStudents,
      event: {
        name: event.name,
        description: event.description,
        icon: event.icon || '🎲',
        effects,
      },
      eventLog: { id: logId },
    };
  }

  /**
   * Activar un evento del sistema (sin guardar en DB)
   */
  async triggerSystemEvent(
    eventIndex: number,
    classroomId: string,
    triggeredBy: string
  ): Promise<TriggerResult> {
    try {
      const systemEvent = SYSTEM_EVENTS[eventIndex];
      if (!systemEvent) {
        return { success: false, message: 'Evento del sistema no encontrado' };
      }

      // Ejecutar el evento directamente sin guardarlo en DB
      return this.executeEventLogic(
        `system-${eventIndex}`, // ID virtual para el log
        {
          name: systemEvent.name,
          description: systemEvent.description,
          targetType: systemEvent.targetType,
          targetCount: systemEvent.targetCount,
          effects: systemEvent.effects,
          icon: systemEvent.icon || '🎁',
          color: systemEvent.color || 'violet',
        },
        classroomId,
        triggeredBy
      );
    } catch (error: any) {
      console.error('Error in triggerSystemEvent:', error?.message, error?.stack);
      throw error;
    }
  }

  /**
   * Lógica común para ejecutar un evento (sin importar si es de sistema o personalizado)
   */
  private async executeEventLogic(
    eventId: string,
    eventData: {
      name: string;
      description: string;
      targetType: EventTargetType;
      targetCount?: number;
      effects: EventEffect[];
      icon: string;
      color: string;
    },
    classroomId: string,
    triggeredBy: string
  ): Promise<TriggerResult> {
    // Obtener estudiantes de la clase
    const students = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    if (students.length === 0) {
      return { success: false, message: 'No hay estudiantes en la clase' };
    }

    const selectedStudents = this.selectTargetStudents(
      students,
      eventData.targetType,
      eventData.targetCount,
      3
    );

    const now = new Date();
    const effects = this.parseEventEffects(eventData.effects);
    const affectedStudents: { id: string; name: string; changes: any }[] = [];
    const pointLogsBatch: typeof pointLogs.$inferInsert[] = [];
    const studentUpdates: { studentId: string; updates: Partial<Record<PointStatField, number>> }[] = [];

    // Aplicar efectos a cada estudiante seleccionado
    for (const student of selectedStudents) {
      const changes: any = {};
      const nextValues: Record<PointStatField, number> = {
        xp: student.xp,
        hp: student.hp,
        gp: student.gp,
      };
      
      for (const effect of effects) {
        const field = this.effectTypeToField(effect.type);
        const currentValue = nextValues[field];
        const newValue = effect.action === 'ADD' 
          ? currentValue + effect.value 
          : Math.max(0, currentValue - effect.value);

        nextValues[field] = newValue;
        
        if (changes[field]) {
          changes[field].to = newValue;
        } else {
          changes[field] = { from: currentValue, to: newValue };
        }

        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          pointType: effect.type,
          action: effect.action,
          amount: effect.value,
          reason: `Evento: ${eventData.name}`,
          givenBy: triggeredBy,
          createdAt: now,
        });
      }

      const updates: Partial<Record<PointStatField, number>> = {};
      if (nextValues.xp !== student.xp) updates.xp = nextValues.xp;
      if (nextValues.hp !== student.hp) updates.hp = nextValues.hp;
      if (nextValues.gp !== student.gp) updates.gp = nextValues.gp;

      if (Object.keys(updates).length > 0) {
        studentUpdates.push({ studentId: student.id, updates });
      }

      affectedStudents.push({
        id: student.id,
        name: student.characterName || 'Estudiante',
        changes,
      });
    }

    await db.transaction(async (tx) => {
      for (const update of studentUpdates) {
        await tx
          .update(studentProfiles)
          .set(update.updates)
          .where(eq(studentProfiles.id, update.studentId));
      }

      if (pointLogsBatch.length > 0) {
        await tx.insert(pointLogs).values(pointLogsBatch);
      }

      // Solo registrar en event_logs si es un evento de DB (no sistema)
      if (!eventId.startsWith('system-')) {
        const logId = uuidv4();
        await tx.insert(eventLogs).values({
          id: logId,
          eventId,
          classroomId,
          triggeredBy,
          affectedStudents: affectedStudents.map(s => s.id),
          appliedEffects: effects,
          triggeredAt: now,
        });
      }
    });

    return {
      success: true,
      message: `Evento "${eventData.name}" activado`,
      affectedStudents,
      event: {
        name: eventData.name,
        description: eventData.description,
        icon: eventData.icon || '🎲',
        effects,
      },
    };
  }

  /**
   * Obtener historial de eventos de una clase
   */
  async getEventLogs(classroomId: string, limit = 20) {
    const logs = await db
      .select({
        id: eventLogs.id,
        eventId: eventLogs.eventId,
        triggeredAt: eventLogs.triggeredAt,
        affectedStudents: eventLogs.affectedStudents,
        appliedEffects: eventLogs.appliedEffects,
        eventName: randomEvents.name,
        eventIcon: randomEvents.icon,
        eventColor: randomEvents.color,
      })
      .from(eventLogs)
      .innerJoin(randomEvents, eq(eventLogs.eventId, randomEvents.id))
      .where(eq(eventLogs.classroomId, classroomId))
      .orderBy(desc(eventLogs.triggeredAt))
      .limit(limit);

    return logs;
  }

  /**
   * Eliminar un evento personalizado
   */
  async deleteEvent(eventId: string, classroomId: string) {
    const [event] = await db
      .select()
      .from(randomEvents)
      .where(and(
        eq(randomEvents.id, eventId),
        eq(randomEvents.classroomId, classroomId)
      ));

    if (!event) {
      return { success: false, message: 'Evento no encontrado' };
    }

    if (event.isGlobal) {
      return { success: false, message: 'No se pueden eliminar eventos globales' };
    }

    await db.delete(randomEvents).where(eq(randomEvents.id, eventId));

    return { success: true, message: 'Evento eliminado' };
  }

  /**
   * Iniciar un desafío (selecciona estudiantes pero NO aplica efectos)
   */
  async startChallenge(
    eventId: string,
    classroomId: string
  ): Promise<{
    success: boolean;
    message: string;
    challengeData?: {
      eventId: string;
      eventName: string;
      eventIcon: string;
      eventColor: string;
      effects: EventEffect[];
      selectedStudents: { id: string; name: string }[];
    };
  }> {
    // Obtener el evento
    const [event] = await db
      .select()
      .from(randomEvents)
      .where(eq(randomEvents.id, eventId));

    if (!event) {
      return { success: false, message: 'Evento no encontrado' };
    }

    if (!event.isGlobal && event.classroomId !== classroomId) {
      return { success: false, message: 'El evento no pertenece a esta clase' };
    }

    // Obtener estudiantes de la clase
    const students = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    if (students.length === 0) {
      return { success: false, message: 'No hay estudiantes en la clase' };
    }

    const effects = this.parseEventEffects(event.effects);
    const selectedStudents = this.selectTargetStudents(
      students,
      event.targetType,
      event.targetCount,
      3
    );

    return {
      success: true,
      message: 'Desafío iniciado',
      challengeData: {
        eventId: event.id,
        eventName: event.name,
        eventIcon: event.icon || '⚡',
        eventColor: event.color || 'red',
        effects,
        selectedStudents: selectedStudents.map(s => ({
          id: s.id,
          name: s.characterName || 'Estudiante',
        })),
      },
    };
  }

  /**
   * Resolver un desafío (aplicar o no los efectos según el resultado)
   */
  async resolveChallenge(
    classroomId: string,
    triggeredBy: string,
    studentIds: string[],
    effects: EventEffect[],
    completed: boolean, // true = cumplió, false = no cumplió
    eventName: string
  ): Promise<TriggerResult> {
    if (studentIds.length === 0) {
      return {
        success: false,
        message: 'No se seleccionaron estudiantes para resolver el desafío',
      };
    }

    const now = new Date();
    const affectedStudents: { id: string; name: string; changes?: any }[] = [];
    const pointLogsBatch: typeof pointLogs.$inferInsert[] = [];
    const studentUpdates: { studentId: string; updates: Partial<Record<PointStatField, number>> }[] = [];
    const effectsToApply = effects.filter(
      (effect) =>
        (effect.action === 'REMOVE' && !completed) ||
        (effect.action === 'ADD' && completed)
    );

    // Obtener los estudiantes
    const students = await db
      .select()
      .from(studentProfiles)
      .where(and(
        inArray(studentProfiles.id, studentIds),
        eq(studentProfiles.classroomId, classroomId)
      ));

    if (students.length === 0) {
      return {
        success: false,
        message: 'No se encontraron estudiantes válidos para este desafío',
      };
    }

    for (const student of students) {
      const changes: any = {};
      const nextValues: Record<PointStatField, number> = {
        xp: student.xp,
        hp: student.hp,
        gp: student.gp,
      };
      
      for (const effect of effectsToApply) {
        const field = this.effectTypeToField(effect.type);
        const currentValue = nextValues[field];
        const newValue = effect.action === 'ADD'
          ? currentValue + effect.value
          : Math.max(0, currentValue - effect.value);

        nextValues[field] = newValue;

        if (changes[field]) {
          changes[field].to = newValue;
        } else {
          changes[field] = { from: currentValue, to: newValue };
        }

        pointLogsBatch.push({
          id: uuidv4(),
          studentId: student.id,
          pointType: effect.type,
          action: effect.action,
          amount: effect.value,
          reason: `Desafío ${completed ? 'completado' : 'fallido'}: ${eventName}`,
          givenBy: triggeredBy,
          createdAt: now,
        });
      }

      const updates: Partial<Record<PointStatField, number>> = {};
      if (nextValues.xp !== student.xp) updates.xp = nextValues.xp;
      if (nextValues.hp !== student.hp) updates.hp = nextValues.hp;
      if (nextValues.gp !== student.gp) updates.gp = nextValues.gp;

      if (Object.keys(updates).length > 0) {
        studentUpdates.push({ studentId: student.id, updates });
      }

      affectedStudents.push({
        id: student.id,
        name: student.characterName || 'Estudiante',
        changes,
      });
    }

    await db.transaction(async (tx) => {
      for (const update of studentUpdates) {
        await tx
          .update(studentProfiles)
          .set(update.updates)
          .where(eq(studentProfiles.id, update.studentId));
      }

      if (pointLogsBatch.length > 0) {
        await tx.insert(pointLogs).values(pointLogsBatch);
      }
    });

    const resultMessage = completed 
      ? `¡Desafío completado! ${affectedStudents.length} estudiante(s) recompensado(s)`
      : `Desafío fallido. ${affectedStudents.length} estudiante(s) penalizado(s)`;

    return {
      success: true,
      message: resultMessage,
      affectedStudents,
    };
  }

  /**
   * Mezclar array aleatoriamente
   */
  private effectTypeToField(effectType: EventEffect['type']): PointStatField {
    switch (effectType) {
      case 'XP':
        return 'xp';
      case 'HP':
        return 'hp';
      case 'GP':
        return 'gp';
    }
  }

  private parseEventEffects(rawEffects: unknown): EventEffect[] {
    const parsed = typeof rawEffects === 'string'
      ? (() => {
          try {
            return JSON.parse(rawEffects);
          } catch {
            return [];
          }
        })()
      : rawEffects;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((effect): effect is EventEffect => {
      if (!effect || typeof effect !== 'object') {
        return false;
      }

      const candidate = effect as Partial<EventEffect>;
      const isValidType = candidate.type === 'XP' || candidate.type === 'HP' || candidate.type === 'GP';
      const isValidAction = candidate.action === 'ADD' || candidate.action === 'REMOVE';
      const isValidValue = typeof candidate.value === 'number' && Number.isFinite(candidate.value) && candidate.value >= 0;

      return isValidType && isValidAction && isValidValue;
    });
  }

  private selectTargetStudents(
    students: StudentProfileRow[],
    targetType: EventTargetType,
    targetCount?: number | null,
    randomSomeDefaultCount = 1
  ): StudentProfileRow[] {
    if (students.length === 0) {
      return [];
    }

    const defaultCount = targetCount && targetCount > 0 ? targetCount : 1;

    switch (targetType) {
      case 'RANDOM_ONE':
        return [students[Math.floor(Math.random() * students.length)]];

      case 'RANDOM_SOME': {
        const someCount = targetCount && targetCount > 0 ? targetCount : randomSomeDefaultCount;
        const count = Math.min(someCount, students.length);
        return this.shuffleArray([...students]).slice(0, count);
      }

      case 'TOP':
        return [...students]
          .sort((a, b) => b.xp - a.xp)
          .slice(0, defaultCount);

      case 'BOTTOM':
        return [...students]
          .sort((a, b) => a.xp - b.xp)
          .slice(0, defaultCount);

      case 'ALL':
      default:
        return [...students];
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  }
}

export const eventsService = new EventsService();
