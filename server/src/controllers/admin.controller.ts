import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { 
  users, classrooms, avatarItems, studentProfiles, schools, schoolMembers,
  questionBanks, questions, timedActivities, tournaments, expeditions
} from '../db/schema.js';
import { eq, desc, count, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta base al directorio de avatars
const AVATARS_DIR = path.resolve(__dirname, '..', '..', '..', 'client', 'public', 'avatars');

const SLOT_FOLDERS: Record<string, string> = {
  HEAD: 'Cabeza',
  HAIR: 'Pelo',
  EYES: 'Ojos',
  TOP: 'Superior',
  BOTTOM: 'Inferior',
  LEFT_HAND: 'Mano izquierda',
  RIGHT_HAND: 'Mano derecha',
  SHOES: 'Zapatos',
  BACK: 'Espalda',
  FLAG: 'Bandera',
};

const LAYER_ORDER: Record<string, number> = {
  FLAG: -2,     // Detrás del personaje
  BACK: -1,     // Detrás del personaje
  SHOES: 1,
  BOTTOM: 2,
  TOP: 3,
  LEFT_HAND: 4,
  RIGHT_HAND: 5,
  EYES: 6,
  HEAD: 7,
  HAIR: 8,
};

export const adminController = {
  // ==================== DASHBOARD ====================
  async getStats(req: Request, res: Response) {
    try {
      const [userStats] = await db
        .select({
          totalUsers: count(),
          teachers: sql<number>`SUM(CASE WHEN role = 'TEACHER' THEN 1 ELSE 0 END)`,
          students: sql<number>`SUM(CASE WHEN role = 'STUDENT' THEN 1 ELSE 0 END)`,
          admins: sql<number>`SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END)`,
        })
        .from(users);

      const [classroomStats] = await db
        .select({ total: count() })
        .from(classrooms);

      const [avatarStats] = await db
        .select({ total: count() })
        .from(avatarItems);

      const [studentStats] = await db
        .select({ total: count() })
        .from(studentProfiles);

      res.json({
        success: true,
        data: {
          users: {
            total: userStats.totalUsers,
            teachers: Number(userStats.teachers) || 0,
            students: Number(userStats.students) || 0,
            admins: Number(userStats.admins) || 0,
          },
          classrooms: classroomStats.total,
          avatarItems: avatarStats.total,
          studentProfiles: studentStats.total,
        },
      });
    } catch (error) {
      console.error('Error getting admin stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  },

  // ==================== GESTIÓN DE USUARIOS ====================
  async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          provider: users.provider,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db.select({ total: count() }).from(users);

      res.json({
        success: true,
        data: {
          users: allUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
  },

  async updateUserRole(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['ADMIN', 'TEACHER', 'STUDENT'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rol inválido' });
      }

      await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, userId));

      res.json({ success: true, message: 'Rol actualizado' });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar rol' });
    }
  },

  async createTeacher(req: Request, res: Response) {
    try {
      const { email, firstName, lastName, password } = req.body;

      if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email, nombre, apellido y contraseña son requeridos' 
        });
      }

      // Verificar si el email ya existe
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un usuario con este email' 
        });
      }

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();

      // Crear usuario
      const newUser = {
        id: uuidv4(),
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role: 'TEACHER' as const,
        provider: 'LOCAL' as const,
        isActive: true,
        notifyBadges: true,
        notifyLevelUp: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(users).values(newUser);

      res.status(201).json({
        success: true,
        message: 'Profesor creado correctamente',
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error('Error creating teacher:', error);
      res.status(500).json({ success: false, message: 'Error al crear profesor' });
    }
  },

  // ==================== GESTIÓN DE ITEMS DE AVATAR ====================
  async getAvatarItems(req: Request, res: Response) {
    try {
      const gender = req.query.gender as string | undefined;
      const slot = req.query.slot as string | undefined;
      
      // Solo mostrar items activos
      const items = await db
        .select()
        .from(avatarItems)
        .where(eq(avatarItems.isActive, true))
        .orderBy(desc(avatarItems.createdAt));

      // Filtrar en memoria si hay filtros adicionales
      let filteredItems = items;
      if (gender) {
        filteredItems = filteredItems.filter(item => item.gender === gender);
      }
      if (slot) {
        filteredItems = filteredItems.filter(item => item.slot === slot);
      }

      res.json({
        success: true,
        data: filteredItems,
      });
    } catch (error) {
      console.error('Error getting avatar items:', error);
      res.status(500).json({ success: false, message: 'Error al obtener items' });
    }
  },

  async createAvatarItem(req: Request, res: Response) {
    try {
      const { name, description, gender, slot, rarity, basePrice, isDefault } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, message: 'Se requiere una imagen PNG' });
      }

      if (!name || !gender || !slot) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
      }

      const folder = SLOT_FOLDERS[slot] || 'Cabeza';
      const destDir = path.join(AVATARS_DIR, gender.toLowerCase(), folder);
      
      // Crear directorio si no existe
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Mover archivo del directorio temporal al destino final
      const destPath = path.join(destDir, file.filename);
      fs.renameSync(file.path, destPath);
      

      const id = uuidv4();
      const now = new Date();
      const imagePath = `/avatars/${gender.toLowerCase()}/${folder}/${file.filename}`;

      await db.insert(avatarItems).values({
        id,
        name,
        description: description || null,
        gender,
        slot,
        imagePath,
        layerOrder: LAYER_ORDER[slot] || 0,
        basePrice: parseInt(basePrice) || 100,
        rarity: rarity || 'COMMON',
        isDefault: isDefault === 'true' || isDefault === true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const [newItem] = await db.select().from(avatarItems).where(eq(avatarItems.id, id));

      res.status(201).json({
        success: true,
        message: 'Item creado exitosamente',
        data: newItem,
      });
    } catch (error) {
      console.error('Error creating avatar item:', error);
      // Limpiar archivo temporal si existe
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: 'Error al crear item' });
    }
  },

  async updateAvatarItem(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const { name, description, basePrice, rarity, isActive, isDefault } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (basePrice !== undefined) updateData.basePrice = parseInt(basePrice);
      if (rarity !== undefined) updateData.rarity = rarity;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      await db
        .update(avatarItems)
        .set(updateData)
        .where(eq(avatarItems.id, itemId));

      const [updatedItem] = await db.select().from(avatarItems).where(eq(avatarItems.id, itemId));

      res.json({
        success: true,
        message: 'Item actualizado',
        data: updatedItem,
      });
    } catch (error) {
      console.error('Error updating avatar item:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar item' });
    }
  },

  async deleteAvatarItem(req: Request, res: Response) {
    try {
      const { itemId } = req.params;

      // Soft delete - solo desactivar
      await db
        .update(avatarItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(avatarItems.id, itemId));

      res.json({ success: true, message: 'Item eliminado' });
    } catch (error) {
      console.error('Error deleting avatar item:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar item' });
    }
  },

  // ==================== GESTIÓN DE CLASES ====================
  async getClassrooms(req: Request, res: Response) {
    try {
      const allClassrooms = await db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          code: classrooms.code,
          isActive: classrooms.isActive,
          createdAt: classrooms.createdAt,
          teacher: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(classrooms)
        .innerJoin(users, eq(classrooms.teacherId, users.id))
        .orderBy(desc(classrooms.createdAt));

      res.json({
        success: true,
        data: allClassrooms,
      });
    } catch (error) {
      console.error('Error getting classrooms:', error);
      res.status(500).json({ success: false, message: 'Error al obtener clases' });
    }
  },

  async getClassroomDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Obtener información básica de la clase
      const [classroom] = await db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          code: classrooms.code,
          isActive: classrooms.isActive,
          createdAt: classrooms.createdAt,
          updatedAt: classrooms.updatedAt,
          teacher: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            createdAt: users.createdAt,
          },
        })
        .from(classrooms)
        .innerJoin(users, eq(classrooms.teacherId, users.id))
        .where(eq(classrooms.id, id));

      if (!classroom) {
        return res.status(404).json({ success: false, message: 'Clase no encontrada' });
      }

      // Contar clases del profesor
      const [teacherClassrooms] = await db
        .select({ count: count() })
        .from(classrooms)
        .where(eq(classrooms.teacherId, classroom.teacher.id));

      // Estadísticas de estudiantes
      const [studentStats] = await db
        .select({
          total: count(),
          active: sql<number>`SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)`,
          inactive: sql<number>`SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END)`,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.classroomId, id));

      // Contar bancos de preguntas
      const [questionBanksCount] = await db
        .select({ count: count() })
        .from(questionBanks)
        .where(eq(questionBanks.classroomId, id));

      // Contar actividades por tipo
      const [timedActivitiesCount] = await db
        .select({ count: count() })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id));

      const [tournamentsCount] = await db
        .select({ count: count() })
        .from(tournaments)
        .where(eq(tournaments.classroomId, id));

      const [expeditionsCount] = await db
        .select({ count: count() })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id));

      // Actividades completadas
      const [timedCompleted] = await db
        .select({ count: count() })
        .from(timedActivities)
        .where(sql`${timedActivities.classroomId} = ${id} AND ${timedActivities.status} = 'COMPLETED'`);

      const [tournamentsCompleted] = await db
        .select({ count: count() })
        .from(tournaments)
        .where(sql`${tournaments.classroomId} = ${id} AND ${tournaments.status} = 'FINISHED'`);

      const [expeditionsCompleted] = await db
        .select({ count: count() })
        .from(expeditions)
        .where(sql`${expeditions.classroomId} = ${id} AND ${expeditions.status} = 'ARCHIVED'`);

      const totalActivities = timedActivitiesCount.count + tournamentsCount.count + expeditionsCount.count;
      const completedActivities = timedCompleted.count + tournamentsCompleted.count + expeditionsCompleted.count;

      // Última actividad (más reciente entre todas las tablas)
      const lastTimedActivity = await db
        .select({ updatedAt: timedActivities.updatedAt })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id))
        .orderBy(desc(timedActivities.updatedAt))
        .limit(1);

      const lastTournament = await db
        .select({ updatedAt: tournaments.updatedAt })
        .from(tournaments)
        .where(eq(tournaments.classroomId, id))
        .orderBy(desc(tournaments.updatedAt))
        .limit(1);

      const lastExpedition = await db
        .select({ updatedAt: expeditions.updatedAt })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id))
        .orderBy(desc(expeditions.updatedAt))
        .limit(1);

      const allLastActivities = [
        lastTimedActivity[0]?.updatedAt,
        lastTournament[0]?.updatedAt,
        lastExpedition[0]?.updatedAt,
      ].filter(Boolean);

      const lastActivity = allLastActivities.length > 0
        ? new Date(Math.max(...allLastActivities.map(d => new Date(d).getTime())))
        : null;

      // Obtener lista de estudiantes
      const studentsList = await db
        .select({
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
          level: studentProfiles.level,
          xp: studentProfiles.xp,
          gp: studentProfiles.gp,
          hp: studentProfiles.hp,
          avatarGender: studentProfiles.avatarGender,
          isActive: studentProfiles.isActive,
          createdAt: studentProfiles.createdAt,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.classroomId, id))
        .orderBy(desc(studentProfiles.level));

      // Obtener lista de actividades
      const timedActivitiesList = await db
        .select({
          id: timedActivities.id,
          name: timedActivities.name,
          mode: timedActivities.mode,
          status: timedActivities.status,
          createdAt: timedActivities.createdAt,
        })
        .from(timedActivities)
        .where(eq(timedActivities.classroomId, id))
        .orderBy(desc(timedActivities.createdAt));

      const tournamentsList = await db
        .select({
          id: tournaments.id,
          name: tournaments.name,
          type: tournaments.type,
          status: tournaments.status,
          createdAt: tournaments.createdAt,
        })
        .from(tournaments)
        .where(eq(tournaments.classroomId, id))
        .orderBy(desc(tournaments.createdAt));

      const expeditionsList = await db
        .select({
          id: expeditions.id,
          name: expeditions.name,
          status: expeditions.status,
          createdAt: expeditions.createdAt,
        })
        .from(expeditions)
        .where(eq(expeditions.classroomId, id))
        .orderBy(desc(expeditions.createdAt));

      // Obtener lista de bancos de preguntas con conteo de preguntas
      const questionBanksList = await db
        .select({
          id: questionBanks.id,
          name: questionBanks.name,
          description: questionBanks.description,
          createdAt: questionBanks.createdAt,
        })
        .from(questionBanks)
        .where(eq(questionBanks.classroomId, id))
        .orderBy(desc(questionBanks.createdAt));

      // Contar preguntas por banco
      const questionBanksWithCount = await Promise.all(
        questionBanksList.map(async (bank) => {
          const [countResult] = await db
            .select({ count: count() })
            .from(questions)
            .where(eq(questions.bankId, bank.id));
          return {
            ...bank,
            questionCount: countResult.count,
          };
        })
      );

      res.json({
        success: true,
        data: {
          classroom,
          teacherClassroomsCount: teacherClassrooms.count,
          stats: {
            students: {
              total: studentStats.total,
              active: Number(studentStats.active) || 0,
              inactive: Number(studentStats.inactive) || 0,
            },
            questionBanks: questionBanksCount.count,
            activities: {
              total: totalActivities,
              byType: {
                timer: timedActivitiesCount.count,
                tournament: tournamentsCount.count,
                expedition: expeditionsCount.count,
              },
              completed: completedActivities,
            },
            lastActivity,
          },
          students: studentsList,
          activities: {
            timed: timedActivitiesList,
            tournaments: tournamentsList,
            expeditions: expeditionsList,
          },
          questionBanks: questionBanksWithCount,
        },
      });
    } catch (error) {
      console.error('Error getting classroom details:', error);
      res.status(500).json({ success: false, message: 'Error al obtener detalles de la clase' });
    }
  },

  // ==================== GESTIÓN DE ESCUELAS ====================
  async getSchools(req: Request, res: Response) {
    try {
      const allSchools = await db.query.schools.findMany({
        orderBy: [desc(schools.createdAt)],
      });

      // Obtener estadísticas para cada escuela
      const schoolsWithStats = await Promise.all(
        allSchools.map(async (school) => {
          // Contar miembros
          const [memberCount] = await db
            .select({ count: count() })
            .from(schoolMembers)
            .where(eq(schoolMembers.schoolId, school.id));

          // Contar clases
          const [classCount] = await db
            .select({ count: count() })
            .from(classrooms)
            .where(eq(classrooms.schoolId, school.id));

          // Contar estudiantes
          const schoolClassrooms = await db.query.classrooms.findMany({
            where: eq(classrooms.schoolId, school.id),
          });
          
          let studentCount = 0;
          if (schoolClassrooms.length > 0) {
            const classroomIds = schoolClassrooms.map(c => c.id);
            const [result] = await db
              .select({ count: count() })
              .from(studentProfiles)
              .where(inArray(studentProfiles.classroomId, classroomIds));
            studentCount = Number(result?.count || 0);
          }

          return {
            ...school,
            stats: {
              members: Number(memberCount?.count || 0),
              classrooms: Number(classCount?.count || 0),
              students: studentCount,
            },
          };
        })
      );

      res.json(schoolsWithStats);
    } catch (error) {
      console.error('Error getting schools:', error);
      res.status(500).json({ success: false, message: 'Error al obtener escuelas' });
    }
  },
};
