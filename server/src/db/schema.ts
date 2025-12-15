import { 
  mysqlTable, 
  varchar, 
  text, 
  boolean, 
  int, 
  datetime, 
  mysqlEnum,
  json,
  unique,
  index
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================

export const userRoleEnum = mysqlEnum('role', ['ADMIN', 'TEACHER', 'STUDENT']);
export const authProviderEnum = mysqlEnum('provider', ['LOCAL', 'GOOGLE']);
export const characterClassEnum = mysqlEnum('character_class', ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']);
export const pointTypeEnum = mysqlEnum('point_type', ['XP', 'HP', 'GP']);
export const pointActionEnum = mysqlEnum('action', ['ADD', 'REMOVE']);
export const battleStatusEnum = mysqlEnum('status', ['DRAFT', 'ACTIVE', 'COMPLETED', 'VICTORY', 'DEFEAT']);
export const questionTypeEnum = mysqlEnum('question_type', ['TEXT', 'IMAGE']);
export const itemCategoryEnum = mysqlEnum('category', ['AVATAR', 'ACCESSORY', 'CONSUMABLE', 'SPECIAL']);
export const itemRarityEnum = mysqlEnum('rarity', ['COMMON', 'RARE', 'LEGENDARY']);
export const avatarGenderEnum = mysqlEnum('avatar_gender', ['MALE', 'FEMALE']);
export const avatarSlotEnum = mysqlEnum('avatar_slot', ['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND']);
export const purchaseTypeEnum = mysqlEnum('purchase_type', ['SELF', 'GIFT', 'TEACHER', 'REWARD']);
export const purchaseStatusEnum = mysqlEnum('purchase_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const attendanceStatusEnum = mysqlEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

// Enums para B2B (Escuelas)
export const schoolMemberRoleEnum = mysqlEnum('school_member_role', ['OWNER', 'ADMIN', 'TEACHER']);

// ==================== ESCUELAS (B2B) ====================

export const schools = mysqlTable('schools', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // URL amigable
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  
  // Contacto
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  
  // Configuración
  isActive: boolean('is_active').notNull().default(true),
  maxTeachers: int('max_teachers').notNull().default(50), // Límite de profesores
  maxStudentsPerClass: int('max_students_per_class').notNull().default(50), // Límite por clase
  
  // Timestamps
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  slugIdx: index('idx_schools_slug').on(table.slug),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  members: many(schoolMembers),
  classrooms: many(classrooms),
  behaviors: many(schoolBehaviors),
  badges: many(schoolBadges),
  grades: many(schoolGrades),
  students: many(schoolStudents),
}));

// Miembros de la escuela (admins y profesores)
export const schoolMembers = mysqlTable('school_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  role: schoolMemberRoleEnum.notNull().default('TEACHER'), // OWNER, ADMIN, TEACHER
  
  // Permisos adicionales para TEACHER
  canCreateClasses: boolean('can_create_classes').notNull().default(false),
  canManageStudents: boolean('can_manage_students').notNull().default(true),
  
  isActive: boolean('is_active').notNull().default(true),
  joinedAt: datetime('joined_at').notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_members_school').on(table.schoolId),
  userIdx: index('idx_school_members_user').on(table.userId),
  uniqueMember: unique('unique_school_member').on(table.schoolId, table.userId),
}));

export const schoolMembersRelations = relations(schoolMembers, ({ one }) => ({
  school: one(schools, {
    fields: [schoolMembers.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [schoolMembers.userId],
    references: [users.id],
  }),
}));

// Comportamientos globales de escuela
export const schoolBehaviors = mysqlTable('school_behaviors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }).notNull().default('⭐'),
  isPositive: boolean('is_positive').notNull().default(true),
  xpValue: int('xp_value').notNull().default(0),
  hpValue: int('hp_value').notNull().default(0),
  gpValue: int('gp_value').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_behaviors_school').on(table.schoolId),
}));

export const schoolBehaviorsRelations = relations(schoolBehaviors, ({ one }) => ({
  school: one(schools, {
    fields: [schoolBehaviors.schoolId],
    references: [schools.id],
  }),
}));

// Insignias globales de escuela
export const schoolBadges = mysqlTable('school_badges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  customImage: varchar('custom_image', { length: 500 }),
  category: mysqlEnum('school_badge_category', ['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SPECIAL', 'CUSTOM']).notNull(),
  rarity: mysqlEnum('school_badge_rarity', ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).notNull().default('COMMON'),
  xpReward: int('xp_reward').notNull().default(0),
  gpReward: int('gp_reward').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_badges_school').on(table.schoolId),
}));

export const schoolBadgesRelations = relations(schoolBadges, ({ one }) => ({
  school: one(schools, {
    fields: [schoolBadges.schoolId],
    references: [schools.id],
  }),
}));

// Grados de escuela (1° SEC, 2° SEC, etc.)
export const schoolGrades = mysqlTable('school_grades', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  level: int('level').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_grades_school').on(table.schoolId),
  uniqueName: unique('unique_grade_name').on(table.schoolId, table.name),
}));

export const schoolGradesRelations = relations(schoolGrades, ({ one, many }) => ({
  school: one(schools, {
    fields: [schoolGrades.schoolId],
    references: [schools.id],
  }),
  sections: many(schoolSections),
}));

// Secciones de grado (A, B, C, etc.)
export const schoolSections = mysqlTable('school_sections', {
  id: varchar('id', { length: 36 }).primaryKey(),
  gradeId: varchar('grade_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  gradeIdx: index('idx_school_sections_grade').on(table.gradeId),
  uniqueName: unique('unique_section_name').on(table.gradeId, table.name),
}));

export const schoolSectionsRelations = relations(schoolSections, ({ one, many }) => ({
  grade: one(schoolGrades, {
    fields: [schoolSections.gradeId],
    references: [schoolGrades.id],
  }),
  students: many(schoolStudents),
}));

// Estudiantes de escuela (con credenciales)
export const schoolStudents = mysqlTable('school_students', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  sectionId: varchar('section_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }), // FK a users cuando se vincula
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  dni: varchar('dni', { length: 20 }), // DNI/Documento de identidad
  tempPassword: varchar('temp_password', { length: 100 }), // Contraseña temporal para exportar
  studentCode: varchar('student_code', { length: 50 }), // Código de estudiante opcional
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_students_school').on(table.schoolId),
  sectionIdx: index('idx_school_students_section').on(table.sectionId),
  userIdx: index('idx_school_students_user').on(table.userId),
  uniqueEmail: unique('unique_student_email').on(table.schoolId, table.email),
  dniIdx: index('idx_school_students_dni').on(table.dni),
}));

export const schoolStudentsRelations = relations(schoolStudents, ({ one, many }) => ({
  school: one(schools, {
    fields: [schoolStudents.schoolId],
    references: [schools.id],
  }),
  section: one(schoolSections, {
    fields: [schoolStudents.sectionId],
    references: [schoolSections.id],
  }),
  user: one(users, {
    fields: [schoolStudents.userId],
    references: [users.id],
  }),
  profiles: many(studentProfiles),
}));

// ==================== USUARIOS ====================

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  role: userRoleEnum.notNull(),
  provider: authProviderEnum.notNull().default('LOCAL'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  // Preferencias de notificaciones
  notifyBadges: boolean('notify_badges').notNull().default(true),
  notifyLevelUp: boolean('notify_level_up').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  teacherClassrooms: many(classrooms),
  studentProfiles: many(studentProfiles),
  refreshTokens: many(refreshTokens),
  schoolMemberships: many(schoolMembers),
}));

export const refreshTokens = mysqlTable('refresh_tokens', {
  id: varchar('id', { length: 36 }).primaryKey(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  expiresAt: datetime('expires_at').notNull(),
  createdAt: datetime('created_at').notNull(),
});

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// ==================== AULAS ====================

export const classrooms = mysqlTable('classrooms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  code: varchar('code', { length: 8 }).notNull().unique(),
  teacherId: varchar('teacher_id', { length: 36 }).notNull(),
  schoolId: varchar('school_id', { length: 36 }), // NULL para B2C, ID para B2B
  gradeLevel: varchar('grade_level', { length: 20 }), // Nivel de grado: INICIAL_3, INICIAL_4, INICIAL_5, PRIMARIA_1-6, SECUNDARIA_1-5
  isActive: boolean('is_active').notNull().default(true),
  bannerUrl: varchar('banner_url', { length: 500 }),
  
  // Configuración de puntos
  defaultXp: int('default_xp').notNull().default(0),
  defaultHp: int('default_hp').notNull().default(100),
  defaultGp: int('default_gp').notNull().default(0),
  maxHp: int('max_hp').notNull().default(100),
  xpPerLevel: int('xp_per_level').notNull().default(100),
  allowNegativeHp: boolean('allow_negative_hp').notNull().default(false),
  
  // Configuración de comportamientos
  allowNegativePoints: boolean('allow_negative_points').notNull().default(true),
  showReasonToStudent: boolean('show_reason_to_student').notNull().default(true),
  notifyOnPoints: boolean('notify_on_points').notNull().default(true),
  
  // Configuración de tienda
  shopEnabled: boolean('shop_enabled').notNull().default(true),
  requirePurchaseApproval: boolean('require_purchase_approval').notNull().default(false),
  dailyPurchaseLimit: int('daily_purchase_limit'),
  
  // Configuración de visualización
  showCharacterName: boolean('show_character_name').notNull().default(true),
  
  // Configuración de equipos
  teamDamageShare: boolean('team_damage_share').notNull().default(false),
  
  // Configuración de clanes
  clansEnabled: boolean('clans_enabled').notNull().default(false), // Habilitar sistema de clanes
  clanXpPercentage: int('clan_xp_percentage').notNull().default(50), // % de XP que va al clan (0-100)
  clanBattlesEnabled: boolean('clan_battles_enabled').notNull().default(false), // Clanes vs Boss en lugar de individual
  clanGpRewardEnabled: boolean('clan_gp_reward_enabled').notNull().default(true), // GP para todos al ganar
  
  // Configuración de racha de login
  loginStreakEnabled: boolean('login_streak_enabled').notNull().default(false),
  loginStreakConfig: json('login_streak_config').$type<{
    dailyXp: number;
    milestones: Array<{
      day: number;
      xp: number;
      gp: number;
      randomItem: boolean;
    }>;
    resetOnMiss: boolean;
    graceDays: number;
  }>(),
  
  // Configuración de Pergaminos del Aula (mural social)
  scrollsEnabled: boolean('scrolls_enabled').notNull().default(false),
  scrollsOpen: boolean('scrolls_open').notNull().default(false), // Si los estudiantes pueden enviar mensajes
  scrollsMaxPerDay: int('scrolls_max_per_day').notNull().default(3), // Límite de mensajes por día por estudiante
  scrollsRequireApproval: boolean('scrolls_require_approval').notNull().default(true), // Requiere aprobación del profesor
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  teacherIdx: index('idx_classrooms_teacher').on(table.teacherId),
  schoolIdx: index('idx_classrooms_school').on(table.schoolId),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classrooms.teacherId],
    references: [users.id],
  }),
  school: one(schools, {
    fields: [classrooms.schoolId],
    references: [schools.id],
  }),
  students: many(studentProfiles),
  teams: many(teams),
  behaviors: many(behaviors),
  powers: many(powers),
  bossBattles: many(bossBattles),
  randomEvents: many(randomEvents),
  shopItems: many(shopItems),
}));

// ==================== ESTUDIANTES ====================

export const studentProfiles = mysqlTable('student_profiles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolStudentId: varchar('school_student_id', { length: 36 }), // FK a school_students para B2B
  userId: varchar('user_id', { length: 36 }), // Nullable para estudiantes placeholder
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  characterClass: characterClassEnum.notNull(),
  avatarGender: avatarGenderEnum.notNull().default('MALE'), // género del avatar
  displayName: varchar('display_name', { length: 100 }), // Nombre para estudiantes sin cuenta
  linkCode: varchar('link_code', { length: 8 }).unique(), // Código para vincular cuenta
  xp: int('xp').notNull().default(0),
  hp: int('hp').notNull().default(100),
  gp: int('gp').notNull().default(0),
  level: int('level').notNull().default(1),
  bossKills: int('boss_kills').notNull().default(0), // Victorias en Boss Battles
  characterName: varchar('character_name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  teamId: varchar('team_id', { length: 36 }),
  isActive: boolean('is_active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false), // Estudiante demo para onboarding
  needsSetup: boolean('needs_setup').notNull().default(false), // Para B2B: necesita configurar género y nombre de personaje
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_student_profiles_classroom').on(table.classroomId),
  userIdx: index('idx_student_profiles_user').on(table.userId),
  teamIdx: index('idx_student_profiles_team').on(table.teamId),
  activeIdx: index('idx_student_profiles_active').on(table.isActive),
  schoolStudentIdx: index('idx_student_profiles_school_student').on(table.schoolStudentId),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [studentProfiles.userId],
    references: [users.id],
  }),
  classroom: one(classrooms, {
    fields: [studentProfiles.classroomId],
    references: [classrooms.id],
  }),
  team: one(teams, {
    fields: [studentProfiles.teamId],
    references: [teams.id],
  }),
  schoolStudent: one(schoolStudents, {
    fields: [studentProfiles.schoolStudentId],
    references: [schoolStudents.id],
  }),
  pointLogs: many(pointLogs),
  powerUsages: many(powerUsages),
  purchases: many(purchases),
  battleResults: many(battleResults),
  loginStreaks: many(loginStreaks),
}));

// ==================== RACHA DE LOGIN ====================

export const loginStreaks = mysqlTable('login_streaks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  currentStreak: int('current_streak').notNull().default(0),
  longestStreak: int('longest_streak').notNull().default(0),
  lastLoginDate: datetime('last_login_date'), // Última fecha de login registrada
  totalLogins: int('total_logins').notNull().default(0),
  claimedMilestones: json('claimed_milestones').$type<number[]>().default([]), // Días ya reclamados
  graceDaysUsed: int('grace_days_used').notNull().default(0), // Días de gracia usados en racha actual
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  uniqueStudentClassroom: unique().on(table.studentProfileId, table.classroomId),
}));

export const loginStreaksRelations = relations(loginStreaks, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [loginStreaks.studentProfileId],
    references: [studentProfiles.id],
  }),
  classroom: one(classrooms, {
    fields: [loginStreaks.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== EQUIPOS/CLANES ====================

export const teams = mysqlTable('teams', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  maxMembers: int('max_members').notNull().default(5),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  // Campos de clan
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'), // Color hex
  emblem: varchar('emblem', { length: 50 }).notNull().default('shield'), // Icono/emblema
  motto: varchar('motto', { length: 255 }), // Lema del clan
  totalXp: int('total_xp').notNull().default(0), // XP acumulado del clan
  totalGp: int('total_gp').notNull().default(0), // GP acumulado del clan
  wins: int('wins').notNull().default(0), // Victorias en desafíos/batallas
  losses: int('losses').notNull().default(0), // Derrotas
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_teams_classroom').on(table.classroomId),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [teams.classroomId],
    references: [classrooms.id],
  }),
  members: many(studentProfiles),
  clanLogs: many(clanLogs),
}));

// ==================== HISTORIAL DE CLANES ====================

export const clanLogs = mysqlTable('clan_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  clanId: varchar('clan_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 36 }), // Puede ser null para eventos del clan
  action: varchar('action', { length: 50 }).notNull(), // XP_CONTRIBUTED, MEMBER_JOINED, MEMBER_LEFT, BATTLE_WON, etc.
  xpAmount: int('xp_amount').notNull().default(0),
  gpAmount: int('gp_amount').notNull().default(0),
  reason: text('reason'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  clanIdx: index('idx_clan_logs_clan').on(table.clanId),
  studentIdx: index('idx_clan_logs_student').on(table.studentId),
  createdIdx: index('idx_clan_logs_created').on(table.createdAt),
}));

export const clanLogsRelations = relations(clanLogs, ({ one }) => ({
  clan: one(teams, {
    fields: [clanLogs.clanId],
    references: [teams.id],
  }),
  student: one(studentProfiles, {
    fields: [clanLogs.studentId],
    references: [studentProfiles.id],
  }),
}));

// ==================== COMPORTAMIENTOS ====================

export const behaviors = mysqlTable('behaviors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  pointType: pointTypeEnum.notNull(), // Tipo principal (legacy)
  pointValue: int('point_value').notNull(), // Valor principal (legacy)
  // Nuevos campos para recompensas combinadas
  xpValue: int('xp_value').notNull().default(0),
  hpValue: int('hp_value').notNull().default(0),
  gpValue: int('gp_value').notNull().default(0),
  isPositive: boolean('is_positive').notNull(),
  icon: varchar('icon', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_behaviors_classroom').on(table.classroomId),
  classroomActiveIdx: index('idx_behaviors_classroom_active').on(table.classroomId, table.isActive),
}));

export const behaviorsRelations = relations(behaviors, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [behaviors.classroomId],
    references: [classrooms.id],
  }),
  pointLogs: many(pointLogs),
}));

// ==================== REGISTRO DE PUNTOS ====================

export const pointLogs = mysqlTable('point_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  behaviorId: varchar('behavior_id', { length: 36 }),
  pointType: pointTypeEnum.notNull(),
  action: pointActionEnum.notNull(),
  amount: int('amount').notNull(),
  reason: text('reason'),
  givenBy: varchar('given_by', { length: 36 }),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_point_logs_student').on(table.studentId),
  studentDateIdx: index('idx_point_logs_student_date').on(table.studentId, table.createdAt),
  behaviorIdx: index('idx_point_logs_behavior').on(table.behaviorId),
}));

export const pointLogsRelations = relations(pointLogs, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [pointLogs.studentId],
    references: [studentProfiles.id],
  }),
  behavior: one(behaviors, {
    fields: [pointLogs.behaviorId],
    references: [behaviors.id],
  }),
}));

// ==================== PODERES ====================

export const powers = mysqlTable('powers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  characterClass: characterClassEnum,
  levelRequired: int('level_required').notNull().default(1),
  gpCost: int('gp_cost').notNull().default(0),
  effectType: varchar('effect_type', { length: 50 }).notNull(),
  effectValue: int('effect_value').notNull(),
  cooldownDays: int('cooldown_days').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
});

export const powersRelations = relations(powers, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [powers.classroomId],
    references: [classrooms.id],
  }),
  usages: many(powerUsages),
}));

export const powerUsages = mysqlTable('power_usages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  powerId: varchar('power_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  targetId: varchar('target_id', { length: 36 }),
  usedAt: datetime('used_at').notNull(),
});

export const powerUsagesRelations = relations(powerUsages, ({ one }) => ({
  power: one(powers, {
    fields: [powerUsages.powerId],
    references: [powers.id],
  }),
  student: one(studentProfiles, {
    fields: [powerUsages.studentId],
    references: [studentProfiles.id],
  }),
}));

// ==================== BOSS BATTLES ====================

export const bossBattles = mysqlTable('boss_battles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  bossName: varchar('boss_name', { length: 255 }).notNull(),
  bossHp: int('boss_hp').notNull(),
  bossImageUrl: varchar('boss_image_url', { length: 500 }),
  xpReward: int('xp_reward').notNull().default(50),
  gpReward: int('gp_reward').notNull().default(20),
  status: battleStatusEnum.notNull().default('DRAFT'),
  currentHp: int('current_hp').notNull(),
  startedAt: datetime('started_at'),
  endedAt: datetime('ended_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const bossBattlesRelations = relations(bossBattles, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [bossBattles.classroomId],
    references: [classrooms.id],
  }),
  questions: many(battleQuestions),
  participants: many(battleParticipants),
  answers: many(battleAnswers),
  results: many(battleResults),
}));

// Enum para tipo de pregunta de batalla
export const battleQuestionTypeEnum = mysqlEnum('battle_question_type', ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']);

export const battleQuestions = mysqlTable('battle_questions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  battleId: varchar('battle_id', { length: 36 }).notNull(),
  questionType: questionTypeEnum.notNull().default('TEXT'),
  battleQuestionType: battleQuestionTypeEnum.notNull().default('SINGLE_CHOICE'), // Tipo: V/F, única, múltiple, unir
  question: text('question').notNull(),
  imageUrl: varchar('image_url', { length: 500 }), // Para preguntas con imagen
  options: json('options'), // Array de strings (puede ser null para MATCHING)
  correctIndex: int('correct_index').notNull().default(0),
  correctIndices: json('correct_indices'), // Array de índices correctos para MULTIPLE_CHOICE
  pairs: json('pairs'), // Array de {left, right} para MATCHING
  damage: int('damage').notNull().default(10),
  hpPenalty: int('hp_penalty').notNull().default(10), // HP que pierden los que fallan
  timeLimit: int('time_limit').notNull().default(30),
  orderIndex: int('order_index').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

export const battleQuestionsRelations = relations(battleQuestions, ({ one, many }) => ({
  battle: one(bossBattles, {
    fields: [battleQuestions.battleId],
    references: [bossBattles.id],
  }),
  answers: many(battleAnswers),
}));

// Participantes de la batalla
export const battleParticipants = mysqlTable('battle_participants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  battleId: varchar('battle_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  joinedAt: datetime('joined_at').notNull(),
  totalDamage: int('total_damage').notNull().default(0),
  correctAnswers: int('correct_answers').notNull().default(0),
  wrongAnswers: int('wrong_answers').notNull().default(0),
}, (table) => ({
  battleStudentUnique: unique().on(table.battleId, table.studentId),
}));

export const battleParticipantsRelations = relations(battleParticipants, ({ one, many }) => ({
  battle: one(bossBattles, {
    fields: [battleParticipants.battleId],
    references: [bossBattles.id],
  }),
  student: one(studentProfiles, {
    fields: [battleParticipants.studentId],
    references: [studentProfiles.id],
  }),
  answers: many(battleAnswers),
}));

// Respuestas individuales
export const battleAnswers = mysqlTable('battle_answers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  battleId: varchar('battle_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  participantId: varchar('participant_id', { length: 36 }).notNull(),
  selectedIndex: int('selected_index'), // null si no respondió a tiempo
  isCorrect: boolean('is_correct').notNull().default(false),
  timeSpent: int('time_spent'), // segundos que tardó en responder
  answeredAt: datetime('answered_at').notNull(),
});

export const battleAnswersRelations = relations(battleAnswers, ({ one }) => ({
  battle: one(bossBattles, {
    fields: [battleAnswers.battleId],
    references: [bossBattles.id],
  }),
  question: one(battleQuestions, {
    fields: [battleAnswers.questionId],
    references: [battleQuestions.id],
  }),
  participant: one(battleParticipants, {
    fields: [battleAnswers.participantId],
    references: [battleParticipants.id],
  }),
}));

export const battleResults = mysqlTable('battle_results', {
  id: varchar('id', { length: 36 }).primaryKey(),
  battleId: varchar('battle_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  score: int('score').notNull().default(0),
  damageDealt: int('damage_dealt').notNull().default(0),
  xpEarned: int('xp_earned').notNull().default(0),
  gpEarned: int('gp_earned').notNull().default(0),
  completedAt: datetime('completed_at').notNull(),
}, (table) => ({
  battleStudentUnique: unique().on(table.battleId, table.studentId),
}));

export const battleResultsRelations = relations(battleResults, ({ one }) => ({
  battle: one(bossBattles, {
    fields: [battleResults.battleId],
    references: [bossBattles.id],
  }),
  student: one(studentProfiles, {
    fields: [battleResults.studentId],
    references: [studentProfiles.id],
  }),
}));

// ==================== EVENTOS ALEATORIOS ====================

export const randomEvents = mysqlTable('random_events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: mysqlEnum('category', ['BONUS', 'CHALLENGE', 'ROULETTE', 'SPECIAL']).notNull().default('BONUS'),
  targetType: mysqlEnum('target_type', ['ALL', 'RANDOM_ONE', 'RANDOM_SOME', 'TOP', 'BOTTOM']).notNull().default('ALL'),
  targetCount: int('target_count').default(1), // Para RANDOM_SOME, TOP, BOTTOM
  effects: json('effects').notNull(), // Array de efectos: [{type: 'XP', action: 'ADD', value: 10}, ...]
  icon: varchar('icon', { length: 50 }).default('🎲'),
  color: varchar('color', { length: 20 }).default('violet'),
  probability: int('probability').notNull().default(100), // Para ruleta (1-100)
  // Programación
  scheduledAt: datetime('scheduled_at'), // Fecha/hora programada para activar
  repeatType: mysqlEnum('repeat_type', ['NONE', 'DAILY', 'WEEKLY']).default('NONE'),
  repeatDays: json('repeat_days'), // Para WEEKLY: [0,1,2,3,4,5,6] (dom-sab)
  repeatTime: varchar('repeat_time', { length: 5 }), // HH:MM para repetición
  // Duración del efecto
  durationType: mysqlEnum('duration_type', ['INSTANT', 'TIMED', 'SESSION']).default('INSTANT'),
  durationMinutes: int('duration_minutes').default(0), // Para TIMED
  expiresAt: datetime('expires_at'), // Cuando expira el efecto activo
  // Estado
  isGlobal: boolean('is_global').notNull().default(false), // Eventos predefinidos del sistema
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: datetime('last_triggered_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at'),
});

// Historial de eventos activados
export const eventLogs = mysqlTable('event_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  triggeredBy: varchar('triggered_by', { length: 36 }).notNull(), // Profesor que lo activó
  affectedStudents: json('affected_students'), // Array de IDs de estudiantes afectados
  appliedEffects: json('applied_effects'), // Efectos que se aplicaron
  triggeredAt: datetime('triggered_at').notNull(),
});

export const randomEventsRelations = relations(randomEvents, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [randomEvents.classroomId],
    references: [classrooms.id],
  }),
  logs: many(eventLogs),
}));

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  event: one(randomEvents, {
    fields: [eventLogs.eventId],
    references: [randomEvents.id],
  }),
  classroom: one(classrooms, {
    fields: [eventLogs.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== TIENDA ====================

export const shopItems = mysqlTable('shop_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: itemCategoryEnum.notNull(),
  rarity: itemRarityEnum.notNull().default('COMMON'),
  price: int('price').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  icon: varchar('icon', { length: 50 }),
  effectType: varchar('effect_type', { length: 50 }),
  effectValue: int('effect_value'),
  stock: int('stock'), // null = ilimitado
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_shop_items_classroom').on(table.classroomId),
  classroomActiveIdx: index('idx_shop_items_classroom_active').on(table.classroomId, table.isActive),
}));

export const shopItemsRelations = relations(shopItems, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [shopItems.classroomId],
    references: [classrooms.id],
  }),
  purchases: many(purchases),
}));

export const purchases = mysqlTable('purchases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentId: varchar('student_id', { length: 36 }).notNull(), // quien recibe el item
  itemId: varchar('item_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull().default(1),
  usedQuantity: int('used_quantity').notNull().default(0), // cuántos se han usado
  totalPrice: int('total_price').notNull(),
  purchaseType: purchaseTypeEnum.notNull().default('SELF'), // SELF, GIFT, TEACHER
  status: purchaseStatusEnum.notNull().default('APPROVED'), // PENDING, APPROVED, REJECTED
  buyerId: varchar('buyer_id', { length: 36 }), // quien paga (estudiante o null si es profesor)
  giftMessage: text('gift_message'), // mensaje si es regalo
  purchasedAt: datetime('purchased_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_purchases_student').on(table.studentId),
  itemIdx: index('idx_purchases_item').on(table.itemId),
  buyerIdx: index('idx_purchases_buyer').on(table.buyerId),
  statusIdx: index('idx_purchases_status').on(table.status),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [purchases.studentId],
    references: [studentProfiles.id],
  }),
  item: one(shopItems, {
    fields: [purchases.itemId],
    references: [shopItems.id],
  }),
  buyer: one(studentProfiles, {
    fields: [purchases.buyerId],
    references: [studentProfiles.id],
  }),
}));

// ==================== USO DE ITEMS ====================

export const itemUsages = mysqlTable('item_usages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  purchaseId: varchar('purchase_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  itemId: varchar('item_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).notNull().default('PENDING'),
  usedAt: datetime('used_at').notNull(),
  reviewedAt: datetime('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 36 }), // profesor que revisó
});

export const itemUsagesRelations = relations(itemUsages, ({ one }) => ({
  purchase: one(purchases, {
    fields: [itemUsages.purchaseId],
    references: [purchases.id],
  }),
  student: one(studentProfiles, {
    fields: [itemUsages.studentId],
    references: [studentProfiles.id],
  }),
  item: one(shopItems, {
    fields: [itemUsages.itemId],
    references: [shopItems.id],
  }),
  classroom: one(classrooms, {
    fields: [itemUsages.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== NOTIFICACIONES ====================

export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(), // a quien va dirigida
  classroomId: varchar('classroom_id', { length: 36 }),
  type: mysqlEnum('notification_type', ['ITEM_USED', 'GIFT_RECEIVED', 'BATTLE_STARTED', 'LEVEL_UP', 'POINTS', 'PURCHASE_APPROVED', 'PURCHASE_REJECTED', 'BADGE', 'MISSION_COMPLETED', 'SCROLL_RECEIVED', 'SCROLL_APPROVED', 'SCROLL_REJECTED']).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: json('data'), // datos adicionales (itemId, studentId, etc)
  isRead: boolean('is_read').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  userIdx: index('idx_notifications_user').on(table.userId),
  userReadIdx: index('idx_notifications_user_read').on(table.userId, table.isRead),
  userDateIdx: index('idx_notifications_user_date').on(table.userId, table.createdAt),
  classroomIdx: index('idx_notifications_classroom').on(table.classroomId),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  classroom: one(classrooms, {
    fields: [notifications.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== SISTEMA DE AVATARES ====================

// Items de avatar globales (creados por Juried/Admin)
export const avatarItems = mysqlTable('avatar_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  gender: avatarGenderEnum.notNull(), // MALE o FEMALE
  slot: avatarSlotEnum.notNull(), // HEAD, HAIR, EYES, TOP, etc.
  imagePath: varchar('image_path', { length: 500 }).notNull(), // ruta a la imagen PNG
  layerOrder: int('layer_order').notNull(), // orden de renderizado (mayor = más arriba)
  basePrice: int('base_price').notNull().default(100), // precio sugerido en GP
  rarity: itemRarityEnum.notNull().default('COMMON'),
  isDefault: boolean('is_default').notNull().default(false), // items por defecto al crear cuenta
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const avatarItemsRelations = relations(avatarItems, ({ many }) => ({
  classroomItems: many(classroomAvatarItems),
  equippedItems: many(studentEquippedItems),
}));

// Items de avatar disponibles en la tienda de cada clase
export const classroomAvatarItems = mysqlTable('classroom_avatar_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  avatarItemId: varchar('avatar_item_id', { length: 36 }).notNull(),
  price: int('price').notNull(), // precio en GP para esta clase
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  uniqueClassroomItem: unique().on(table.classroomId, table.avatarItemId),
}));

export const classroomAvatarItemsRelations = relations(classroomAvatarItems, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomAvatarItems.classroomId],
    references: [classrooms.id],
  }),
  avatarItem: one(avatarItems, {
    fields: [classroomAvatarItems.avatarItemId],
    references: [avatarItems.id],
  }),
}));

// Items de avatar comprados por estudiantes
export const studentAvatarPurchases = mysqlTable('student_avatar_purchases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  avatarItemId: varchar('avatar_item_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(), // en qué clase lo compró
  pricePaid: int('price_paid').notNull(),
  purchasedAt: datetime('purchased_at').notNull(),
}, (table) => ({
  studentPurchaseUnique: unique('student_purchase_unique').on(table.studentProfileId, table.avatarItemId),
}));

export const studentAvatarPurchasesRelations = relations(studentAvatarPurchases, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [studentAvatarPurchases.studentProfileId],
    references: [studentProfiles.id],
  }),
  avatarItem: one(avatarItems, {
    fields: [studentAvatarPurchases.avatarItemId],
    references: [avatarItems.id],
  }),
  classroom: one(classrooms, {
    fields: [studentAvatarPurchases.classroomId],
    references: [classrooms.id],
  }),
}));

// Items de avatar actualmente equipados por estudiantes
export const studentEquippedItems = mysqlTable('student_equipped_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  avatarItemId: varchar('avatar_item_id', { length: 36 }).notNull(),
  slot: avatarSlotEnum.notNull(), // para búsqueda rápida
  equippedAt: datetime('equipped_at').notNull(),
}, (table) => ({
  // Solo un item por slot por estudiante
  uniqueStudentSlot: unique().on(table.studentProfileId, table.slot),
}));

export const studentEquippedItemsRelations = relations(studentEquippedItems, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [studentEquippedItems.studentProfileId],
    references: [studentProfiles.id],
  }),
  avatarItem: one(avatarItems, {
    fields: [studentEquippedItems.avatarItemId],
    references: [avatarItems.id],
  }),
}));

// ==================== TIPOS EXPORTADOS ====================

// ==================== ASISTENCIAS ====================

export const attendanceRecords = mysqlTable('attendance_records', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull().references(() => classrooms.id),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull().references(() => studentProfiles.id),
  date: datetime('date').notNull(),
  status: attendanceStatusEnum.notNull().default('PRESENT'),
  notes: text('notes'),
  xpAwarded: int('xp_awarded').default(0),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  uniqueAttendance: unique().on(table.classroomId, table.studentProfileId, table.date),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [attendanceRecords.classroomId],
    references: [classrooms.id],
  }),
  studentProfile: one(studentProfiles, {
    fields: [attendanceRecords.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// ==================== INSIGNIAS ====================

export const badgeScopeEnum = mysqlEnum('badge_scope', ['SYSTEM', 'CLASSROOM']);
export const badgeCategoryEnum = mysqlEnum('badge_category', ['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']);
export const badgeRarityEnum = mysqlEnum('badge_rarity', ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
export const badgeAssignmentEnum = mysqlEnum('badge_assignment', ['AUTOMATIC', 'MANUAL', 'BOTH']);

export const badges = mysqlTable('badges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  
  // Scope: Sistema (global) o Clase (creada por profesor)
  scope: mysqlEnum('badge_scope', ['SYSTEM', 'CLASSROOM']).notNull().default('SYSTEM'),
  classroomId: varchar('classroom_id', { length: 36 }),
  createdBy: varchar('created_by', { length: 36 }),
  
  // Información básica
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  customImage: varchar('custom_image', { length: 500 }), // URL de imagen personalizada
  category: mysqlEnum('badge_category', ['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).notNull(),
  rarity: mysqlEnum('badge_rarity', ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).notNull().default('COMMON'),
  
  // Modo de asignación
  assignmentMode: mysqlEnum('badge_assignment', ['AUTOMATIC', 'MANUAL', 'BOTH']).notNull().default('AUTOMATIC'),
  
  // Condiciones de desbloqueo (JSON flexible, NULL si es solo manual)
  unlockCondition: json('unlock_condition'),
  
  // Recompensa opcional al desbloquear
  rewardXp: int('reward_xp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  
  // Límites
  maxAwards: int('max_awards').default(1),
  
  // Metadata
  isSecret: boolean('is_secret').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const badgesRelations = relations(badges, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [badges.classroomId],
    references: [classrooms.id],
  }),
  creator: one(users, {
    fields: [badges.createdBy],
    references: [users.id],
  }),
  studentBadges: many(studentBadges),
}));

export const studentBadges = mysqlTable('student_badges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  badgeId: varchar('badge_id', { length: 36 }).notNull(),
  unlockedAt: datetime('unlocked_at').notNull(),
  awardedBy: varchar('awarded_by', { length: 36 }),
  awardReason: varchar('award_reason', { length: 255 }),
  isDisplayed: boolean('is_displayed').notNull().default(false),
  // Nota: Sin restricción única para permitir insignias acumulables
});

export const studentBadgesRelations = relations(studentBadges, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [studentBadges.studentProfileId],
    references: [studentProfiles.id],
  }),
  badge: one(badges, {
    fields: [studentBadges.badgeId],
    references: [badges.id],
  }),
  awardedByUser: one(users, {
    fields: [studentBadges.awardedBy],
    references: [users.id],
  }),
}));

export const badgeProgress = mysqlTable('badge_progress', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  badgeId: varchar('badge_id', { length: 36 }).notNull(),
  currentValue: int('current_value').notNull().default(0),
  targetValue: int('target_value').notNull(),
  lastUpdated: datetime('last_updated').notNull(),
}, (table) => ({
  uniqueProgress: unique('unique_progress').on(table.studentProfileId, table.badgeId),
}));

export const badgeProgressRelations = relations(badgeProgress, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [badgeProgress.studentProfileId],
    references: [studentProfiles.id],
  }),
  badge: one(badges, {
    fields: [badgeProgress.badgeId],
    references: [badges.id],
  }),
}));

// ==================== BANCO DE PREGUNTAS ====================

export const bankQuestionTypeEnum = mysqlEnum('type', ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']);
export const questionDifficultyEnum = mysqlEnum('difficulty', ['EASY', 'MEDIUM', 'HARD']);

export const questionBanks = mysqlTable('question_banks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
  icon: varchar('icon', { length: 50 }).notNull().default('book'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const questionBanksRelations = relations(questionBanks, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [questionBanks.classroomId],
    references: [classrooms.id],
  }),
  questions: many(questions),
}));

export const questions = mysqlTable('questions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bankId: varchar('bank_id', { length: 36 }).notNull(),
  type: bankQuestionTypeEnum.notNull(),
  difficulty: questionDifficultyEnum.notNull().default('MEDIUM'),
  points: int('points').notNull().default(10),
  questionText: text('question_text').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  // Para TRUE_FALSE: correctAnswer es boolean en JSON
  // Para SINGLE_CHOICE/MULTIPLE_CHOICE: options es array de {text, isCorrect}
  // Para MATCHING: pairs es array de {left, right}
  options: json('options'), // [{text: string, isCorrect: boolean}]
  correctAnswer: json('correct_answer'), // Para TRUE_FALSE: boolean
  pairs: json('pairs'), // Para MATCHING: [{left: string, right: string}]
  explanation: text('explanation'), // Explicación opcional de la respuesta
  timeLimitSeconds: int('time_limit_seconds').default(30),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const questionsRelations = relations(questions, ({ one }) => ({
  bank: one(questionBanks, {
    fields: [questions.bankId],
    references: [questionBanks.id],
  }),
}));

// ==================== TYPES ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Classroom = typeof classrooms.$inferSelect;
export type NewClassroom = typeof classrooms.$inferInsert;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Power = typeof powers.$inferSelect;
export type BossBattle = typeof bossBattles.$inferSelect;
export type BattleQuestion = typeof battleQuestions.$inferSelect;
export type BattleParticipant = typeof battleParticipants.$inferSelect;
export type BattleAnswer = typeof battleAnswers.$inferSelect;
export type BattleResult = typeof battleResults.$inferSelect;
export type RandomEvent = typeof randomEvents.$inferSelect;
export type EventLog = typeof eventLogs.$inferSelect;
export type ShopItem = typeof shopItems.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type ItemUsage = typeof itemUsages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';
export type PurchaseType = 'SELF' | 'GIFT' | 'TEACHER';
export type PurchaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ItemUsageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type NotificationType = 'ITEM_USED' | 'GIFT_RECEIVED' | 'BATTLE_STARTED' | 'LEVEL_UP' | 'POINTS' | 'PURCHASE_APPROVED' | 'PURCHASE_REJECTED' | 'BADGE' | 'MISSION_COMPLETED';
export type BattleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'VICTORY' | 'DEFEAT';
export type QuestionType = 'TEXT' | 'IMAGE';
export type AvatarGender = 'MALE' | 'FEMALE';
export type AvatarSlot = 'HEAD' | 'HAIR' | 'EYES' | 'TOP' | 'BOTTOM' | 'LEFT_HAND' | 'RIGHT_HAND' | 'SHOES' | 'BACK' | 'FLAG' | 'BACKGROUND';
export type AvatarItem = typeof avatarItems.$inferSelect;
export type ClassroomAvatarItem = typeof classroomAvatarItems.$inferSelect;
export type StudentAvatarPurchase = typeof studentAvatarPurchases.$inferSelect;
export type StudentEquippedItem = typeof studentEquippedItems.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type StudentBadge = typeof studentBadges.$inferSelect;
export type BadgeProgress = typeof badgeProgress.$inferSelect;
export type BadgeScope = 'SYSTEM' | 'CLASSROOM';
export type BadgeCategory = 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SHOP' | 'SPECIAL' | 'SECRET' | 'CUSTOM';
export type BadgeRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type BadgeAssignment = 'AUTOMATIC' | 'MANUAL' | 'BOTH';
export type ClanLog = typeof clanLogs.$inferSelect;
export type ClanLogAction = 'XP_CONTRIBUTED' | 'GP_CONTRIBUTED' | 'MEMBER_JOINED' | 'MEMBER_LEFT' | 'BATTLE_WON' | 'BATTLE_LOST' | 'CHALLENGE_WON';
export type QuestionBank = typeof questionBanks.$inferSelect;
export type NewQuestionBank = typeof questionBanks.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type BankQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

// ==================== ACTIVIDADES DE TIEMPO ====================

export const timedActivityModeEnum = mysqlEnum('timed_activity_mode', ['STOPWATCH', 'TIMER', 'BOMB', 'BOMB_RANDOM']);
export const timedActivityStatusEnum = mysqlEnum('timed_activity_status', ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']);

export const timedActivities = mysqlTable('timed_activities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mode: timedActivityModeEnum.notNull(), // STOPWATCH, TIMER, BOMB
  status: timedActivityStatusEnum.notNull().default('DRAFT'),
  
  // Configuración de tiempo
  timeLimitSeconds: int('time_limit_seconds'), // Para TIMER y BOMB
  bombMinSeconds: int('bomb_min_seconds'), // Tiempo mínimo aleatorio para BOMB
  bombMaxSeconds: int('bomb_max_seconds'), // Tiempo máximo aleatorio para BOMB
  actualBombTime: int('actual_bomb_time'), // Tiempo real generado para BOMB (oculto)
  
  // Configuración de puntos
  behaviorId: varchar('behavior_id', { length: 36 }), // Comportamiento a aplicar
  basePoints: int('base_points').default(10), // Puntos base si no usa comportamiento
  pointType: varchar('point_type', { length: 10 }).default('XP'), // XP, HP, GP
  
  // Multiplicadores de tiempo
  useMultipliers: boolean('use_multipliers').notNull().default(false),
  multiplier50: int('multiplier_50').default(200), // % de puntos si termina antes del 50% del tiempo (200 = 2x)
  multiplier75: int('multiplier_75').default(150), // % de puntos si termina antes del 75% del tiempo (150 = 1.5x)
  
  // Para modo BOMB
  negativeBehaviorId: varchar('negative_behavior_id', { length: 36 }), // Comportamiento negativo para quien "explota"
  bombPenaltyPoints: int('bomb_penalty_points').default(10), // Puntos a quitar si no usa comportamiento
  bombPenaltyType: varchar('bomb_penalty_type', { length: 10 }).default('HP'), // Tipo de punto a quitar
  
  // Tracking de tiempo
  startedAt: datetime('started_at'),
  pausedAt: datetime('paused_at'),
  completedAt: datetime('completed_at'),
  elapsedSeconds: int('elapsed_seconds').default(0), // Tiempo transcurrido (para pausas)
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const timedActivitiesRelations = relations(timedActivities, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [timedActivities.classroomId],
    references: [classrooms.id],
  }),
  behavior: one(behaviors, {
    fields: [timedActivities.behaviorId],
    references: [behaviors.id],
  }),
  results: many(timedActivityResults),
}));

export const timedActivityResults = mysqlTable('timed_activity_results', {
  id: varchar('id', { length: 36 }).primaryKey(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Resultado
  completedAt: datetime('completed_at'), // Cuando el profesor marcó como completado
  elapsedSeconds: int('elapsed_seconds'), // Tiempo que tardó
  multiplierApplied: int('multiplier_applied').default(100), // Multiplicador aplicado (100 = 1x)
  pointsAwarded: int('points_awarded').default(0), // Puntos finales otorgados
  
  // Para modo BOMB
  wasExploded: boolean('was_exploded').default(false), // Si le explotó la bomba
  penaltyApplied: int('penalty_applied').default(0), // Penalización aplicada
  
  createdAt: datetime('created_at').notNull(),
});

export const timedActivityResultsRelations = relations(timedActivityResults, ({ one }) => ({
  activity: one(timedActivities, {
    fields: [timedActivityResults.activityId],
    references: [timedActivities.id],
  }),
  student: one(studentProfiles, {
    fields: [timedActivityResults.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// Types
export type TimedActivity = typeof timedActivities.$inferSelect;
export type NewTimedActivity = typeof timedActivities.$inferInsert;
export type TimedActivityResult = typeof timedActivityResults.$inferSelect;
export type NewTimedActivityResult = typeof timedActivityResults.$inferInsert;
export type TimedActivityMode = 'STOPWATCH' | 'TIMER' | 'BOMB' | 'BOMB_RANDOM';
export type TimedActivityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

// ==================== STUDENT BOSS BATTLES ====================

export const studentBossBattles = mysqlTable('student_boss_battles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Info del boss
  bossName: varchar('boss_name', { length: 255 }).notNull(),
  bossImageUrl: varchar('boss_image_url', { length: 500 }),
  bossMaxHp: int('boss_max_hp').notNull(),
  bossCurrentHp: int('boss_current_hp').notNull(),
  
  // Configuración de preguntas
  questionBankId: varchar('question_bank_id', { length: 36 }).notNull(),
  questionsPerAttempt: int('questions_per_attempt').notNull().default(5), // Preguntas por intento
  
  // Configuración de daño
  damagePerCorrect: int('damage_per_correct').notNull().default(10), // Daño al boss por respuesta correcta
  damageToStudentOnWrong: int('damage_to_student_on_wrong').notNull().default(5), // Daño al estudiante por respuesta incorrecta
  
  // Configuración de intentos
  maxAttempts: int('max_attempts').notNull().default(1), // Intentos permitidos por estudiante
  
  // Recompensas
  xpPerCorrectAnswer: int('xp_per_correct_answer').notNull().default(10), // XP por respuesta correcta
  gpPerCorrectAnswer: int('gp_per_correct_answer').notNull().default(5), // GP por respuesta correcta
  bonusXpOnVictory: int('bonus_xp_on_victory').notNull().default(50), // XP bonus si el boss muere
  bonusGpOnVictory: int('bonus_gp_on_victory').notNull().default(25), // GP bonus si el boss muere
  
  // Programación
  status: mysqlEnum('status', ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'VICTORY', 'DEFEAT']).notNull().default('DRAFT'),
  startDate: datetime('start_date'), // null = inicia inmediatamente
  endDate: datetime('end_date'), // null = sin fecha límite
  
  // Timestamps
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  completedAt: datetime('completed_at'), // Cuando el boss murió o terminó el tiempo
}, (table) => ({
  classroomIdx: index('idx_student_boss_battles_classroom').on(table.classroomId),
  statusIdx: index('idx_student_boss_battles_status').on(table.status),
  questionBankIdx: index('idx_student_boss_battles_question_bank').on(table.questionBankId),
}));

export const studentBossBattlesRelations = relations(studentBossBattles, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [studentBossBattles.classroomId],
    references: [classrooms.id],
  }),
  questionBank: one(questionBanks, {
    fields: [studentBossBattles.questionBankId],
    references: [questionBanks.id],
  }),
  participants: many(studentBossBattleParticipants),
}));

// Participantes en la batalla (tracking de intentos y estado)
export const studentBossBattleParticipants = mysqlTable('student_boss_battle_participants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  battleId: varchar('battle_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Estadísticas acumuladas
  totalDamageDealt: int('total_damage_dealt').notNull().default(0),
  totalCorrectAnswers: int('total_correct_answers').notNull().default(0),
  totalWrongAnswers: int('total_wrong_answers').notNull().default(0),
  attemptsUsed: int('attempts_used').notNull().default(0),
  
  // Recompensas obtenidas
  xpEarned: int('xp_earned').notNull().default(0),
  gpEarned: int('gp_earned').notNull().default(0),
  
  // Estado
  isCurrentlyBattling: boolean('is_currently_battling').notNull().default(false), // Para mostrar quién está batallando
  lastBattleAt: datetime('last_battle_at'),
  
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  battleIdx: index('idx_sbb_participants_battle').on(table.battleId),
  studentIdx: index('idx_sbb_participants_student').on(table.studentProfileId),
}));

export const studentBossBattleParticipantsRelations = relations(studentBossBattleParticipants, ({ one, many }) => ({
  battle: one(studentBossBattles, {
    fields: [studentBossBattleParticipants.battleId],
    references: [studentBossBattles.id],
  }),
  student: one(studentProfiles, {
    fields: [studentBossBattleParticipants.studentProfileId],
    references: [studentProfiles.id],
  }),
  attempts: many(studentBossBattleAttempts),
}));

// Intentos individuales (cada vez que el estudiante entra a batallar)
export const studentBossBattleAttempts = mysqlTable('student_boss_battle_attempts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  participantId: varchar('participant_id', { length: 36 }).notNull(),
  
  // Resultados del intento
  damageDealt: int('damage_dealt').notNull().default(0),
  correctAnswers: int('correct_answers').notNull().default(0),
  wrongAnswers: int('wrong_answers').notNull().default(0),
  hpLost: int('hp_lost').notNull().default(0), // HP que perdió el estudiante
  
  // Preguntas respondidas en este intento (IDs de preguntas)
  questionsAnswered: json('questions_answered'), // [{questionId, isCorrect, answeredAt}]
  
  startedAt: datetime('started_at').notNull(),
  completedAt: datetime('completed_at'),
});

export const studentBossBattleAttemptsRelations = relations(studentBossBattleAttempts, ({ one }) => ({
  participant: one(studentBossBattleParticipants, {
    fields: [studentBossBattleAttempts.participantId],
    references: [studentBossBattleParticipants.id],
  }),
}));

// Types
export type StudentBossBattle = typeof studentBossBattles.$inferSelect;
export type NewStudentBossBattle = typeof studentBossBattles.$inferInsert;
export type StudentBossBattleParticipant = typeof studentBossBattleParticipants.$inferSelect;
export type StudentBossBattleAttempt = typeof studentBossBattleAttempts.$inferSelect;
export type StudentBossBattleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'VICTORY' | 'DEFEAT';

// ==================== SISTEMA DE MISIONES ====================

export const missionTypeEnum = mysqlEnum('mission_type', ['DAILY', 'WEEKLY', 'SPECIAL']);
export const missionCategoryEnum = mysqlEnum('mission_category', ['PARTICIPATION', 'PROGRESS', 'SOCIAL', 'SHOP', 'BATTLE', 'STREAK', 'CUSTOM']);
export const missionStatusEnum = mysqlEnum('mission_status', ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CLAIMED']);

// Definiciones de misiones (plantillas)
export const missions = mysqlTable('missions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Info básica
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).notNull().default('🎯'),
  
  // Tipo y categoría
  type: missionTypeEnum.notNull().default('DAILY'),
  category: missionCategoryEnum.notNull().default('PROGRESS'),
  
  // Objetivo de la misión
  // Tipos: EARN_XP, EARN_GP, ATTEND_CLASS, COMPLETE_BATTLE, MAKE_PURCHASE, 
  //        GIVE_GIFT, REACH_LEVEL, COMPLETE_MISSIONS, MAINTAIN_STREAK, CUSTOM
  objectiveType: varchar('objective_type', { length: 50 }).notNull(),
  objectiveTarget: int('objective_target').notNull().default(1), // Cantidad a alcanzar
  objectiveConfig: json('objective_config'), // Config adicional (behaviorId, etc)
  
  // Recompensas
  rewardXp: int('reward_xp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  rewardHp: int('reward_hp').notNull().default(0),
  
  // Archivo adjunto (instrucciones, recursos)
  attachmentUrl: varchar('attachment_url', { length: 500 }),
  attachmentName: varchar('attachment_name', { length: 255 }),
  
  // Configuración
  isRepeatable: boolean('is_repeatable').notNull().default(true), // Se puede asignar múltiples veces
  maxCompletions: int('max_completions'), // null = ilimitado
  
  // Estado
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_missions_classroom').on(table.classroomId),
  typeIdx: index('idx_missions_type').on(table.type),
  activeIdx: index('idx_missions_active').on(table.isActive),
}));

export const missionsRelations = relations(missions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [missions.classroomId],
    references: [classrooms.id],
  }),
  studentMissions: many(studentMissions),
}));

// Misiones asignadas a estudiantes
export const studentMissions = mysqlTable('student_missions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  missionId: varchar('mission_id', { length: 36 }).notNull(),
  
  // Progreso
  status: missionStatusEnum.notNull().default('ACTIVE'),
  currentProgress: int('current_progress').notNull().default(0),
  targetProgress: int('target_progress').notNull(), // Copiado de mission.objectiveTarget
  
  // Fechas
  assignedAt: datetime('assigned_at').notNull(),
  expiresAt: datetime('expires_at'), // null = no expira
  completedAt: datetime('completed_at'),
  claimedAt: datetime('claimed_at'), // Cuando reclamó la recompensa
}, (table) => ({
  studentIdx: index('idx_student_missions_student').on(table.studentProfileId),
  missionIdx: index('idx_student_missions_mission').on(table.missionId),
  statusIdx: index('idx_student_missions_status').on(table.status),
}));

export const studentMissionsRelations = relations(studentMissions, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [studentMissions.studentProfileId],
    references: [studentProfiles.id],
  }),
  mission: one(missions, {
    fields: [studentMissions.missionId],
    references: [missions.id],
  }),
}));

// Rachas de estudiantes
export const studentStreaks = mysqlTable('student_streaks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Racha actual
  currentStreak: int('current_streak').notNull().default(0),
  longestStreak: int('longest_streak').notNull().default(0),
  
  // Tracking
  lastCompletedAt: datetime('last_completed_at'), // Última vez que completó al menos 1 misión
  streakStartedAt: datetime('streak_started_at'), // Cuando empezó la racha actual
  
  // Recompensas de racha reclamadas (array de días: [3, 7, 14, 30, 60])
  claimedMilestones: json('claimed_milestones'), // [3, 7] = ya reclamó 3 y 7 días
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  uniqueStudentClassroom: unique().on(table.studentProfileId, table.classroomId),
}));

export const studentStreaksRelations = relations(studentStreaks, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [studentStreaks.studentProfileId],
    references: [studentProfiles.id],
  }),
  classroom: one(classrooms, {
    fields: [studentStreaks.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== PERGAMINOS DEL AULA (Mural Social) ====================

export const scrollCategoryEnum = mysqlEnum('scroll_category', [
  'CONGRATULATION', // Felicitación
  'THANKS',         // Agradecimiento
  'MOTIVATION',     // Motivación
  'TEAMWORK',       // Trabajo en equipo
  'FRIENDSHIP',     // Amistad
  'ACHIEVEMENT',    // Logro
  'CUSTOM'          // Personalizado
]);

export const scrollStatusEnum = mysqlEnum('scroll_status', [
  'PENDING',   // Esperando aprobación
  'APPROVED',  // Aprobado y visible
  'REJECTED'   // Rechazado
]);

export const scrollRecipientTypeEnum = mysqlEnum('scroll_recipient_type', [
  'STUDENT',   // Un estudiante específico
  'MULTIPLE',  // Varios estudiantes
  'CLAN',      // Un clan completo
  'CLASS',     // Toda la clase
  'TEACHER'    // Al profesor
]);

// Pergaminos (mensajes del mural)
export const scrolls = mysqlTable('scrolls', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Autor
  authorId: varchar('author_id', { length: 36 }).notNull(), // studentProfileId del autor
  
  // Contenido
  message: text('message').notNull(),
  imageUrl: varchar('image_url', { length: 500 }), // Imagen adjunta opcional
  category: scrollCategoryEnum.notNull().default('CUSTOM'),
  
  // Destinatario
  recipientType: scrollRecipientTypeEnum.notNull(),
  recipientIds: json('recipient_ids').$type<string[]>(), // IDs de estudiantes o clan
  
  // Estado de moderación
  status: scrollStatusEnum.notNull().default('PENDING'),
  rejectionReason: text('rejection_reason'), // Razón si fue rechazado
  reviewedAt: datetime('reviewed_at'), // Cuándo fue revisado
  reviewedBy: varchar('reviewed_by', { length: 36 }), // userId del profesor que revisó
  
  // Timestamps
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_scrolls_classroom').on(table.classroomId),
  authorIdx: index('idx_scrolls_author').on(table.authorId),
  statusIdx: index('idx_scrolls_status').on(table.status),
  createdAtIdx: index('idx_scrolls_created_at').on(table.createdAt),
}));

export const scrollsRelations = relations(scrolls, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [scrolls.classroomId],
    references: [classrooms.id],
  }),
  author: one(studentProfiles, {
    fields: [scrolls.authorId],
    references: [studentProfiles.id],
  }),
  reactions: many(scrollReactions),
}));

// Reacciones a pergaminos
export const scrollReactions = mysqlTable('scroll_reactions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  scrollId: varchar('scroll_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Tipo de reacción (emoji)
  reactionType: varchar('reaction_type', { length: 20 }).notNull(), // 'heart', 'star', 'fire', 'clap', 'smile'
  
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  scrollIdx: index('idx_scroll_reactions_scroll').on(table.scrollId),
  studentIdx: index('idx_scroll_reactions_student').on(table.studentProfileId),
  uniqueReaction: unique('unique_scroll_reaction').on(table.scrollId, table.studentProfileId, table.reactionType),
}));

export const scrollReactionsRelations = relations(scrollReactions, ({ one }) => ({
  scroll: one(scrolls, {
    fields: [scrollReactions.scrollId],
    references: [scrolls.id],
  }),
  student: one(studentProfiles, {
    fields: [scrollReactions.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// Types
export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type StudentMission = typeof studentMissions.$inferSelect;
export type NewStudentMission = typeof studentMissions.$inferInsert;
export type StudentStreak = typeof studentStreaks.$inferSelect;
export type MissionType = 'DAILY' | 'WEEKLY' | 'SPECIAL';
export type MissionCategory = 'PARTICIPATION' | 'PROGRESS' | 'SOCIAL' | 'SHOP' | 'BATTLE' | 'STREAK' | 'CUSTOM';
export type MissionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CLAIMED';

// Scroll types
export type Scroll = typeof scrolls.$inferSelect;
export type NewScroll = typeof scrolls.$inferInsert;
export type ScrollReaction = typeof scrollReactions.$inferSelect;
export type NewScrollReaction = typeof scrollReactions.$inferInsert;
export type ScrollCategory = 'CONGRATULATION' | 'THANKS' | 'MOTIVATION' | 'TEAMWORK' | 'FRIENDSHIP' | 'ACHIEVEMENT' | 'CUSTOM';
export type ScrollStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ScrollRecipientType = 'STUDENT' | 'MULTIPLE' | 'CLAN' | 'CLASS' | 'TEACHER';

// ==================== MAPAS DE EXPEDICIONES (Administrador) ====================

export const expeditionMaps = mysqlTable('expedition_maps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  category: varchar('category', { length: 100 }).notNull().default('general'), // fantasy, sci-fi, nature, etc.
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  categoryIdx: index('idx_expedition_maps_category').on(table.category),
  activeIdx: index('idx_expedition_maps_active').on(table.isActive),
}));

export type ExpeditionMap = typeof expeditionMaps.$inferSelect;
export type NewExpeditionMap = typeof expeditionMaps.$inferInsert;

// ==================== EXPEDICIONES (Misiones con Mapas) ====================

// Enums para Expediciones
export const expeditionStatusEnum = mysqlEnum('expedition_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const expeditionPinTypeEnum = mysqlEnum('expedition_pin_type', ['INTRO', 'OBJECTIVE', 'FINAL']);
export const expeditionProgressStatusEnum = mysqlEnum('expedition_progress_status', ['LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'COMPLETED']);

// Expedición (la misión principal con el mapa)
export const expeditions = mysqlTable('expeditions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Info básica
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mapImageUrl: varchar('map_image_url', { length: 500 }).notNull(), // URL del mapa
  
  // Estado
  status: expeditionStatusEnum.notNull().default('DRAFT'),
  
  // Configuración global
  autoProgress: boolean('auto_progress').notNull().default(false), // Progreso a ritmo del estudiante
  
  // Timestamps
  publishedAt: datetime('published_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_expeditions_classroom').on(table.classroomId),
  statusIdx: index('idx_expeditions_status').on(table.status),
}));

export const expeditionsRelations = relations(expeditions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [expeditions.classroomId],
    references: [classrooms.id],
  }),
  pins: many(expeditionPins),
  studentProgress: many(expeditionStudentProgress),
}));

// Pines de la expedición (Intro, Objetivos, Final)
export const expeditionPins = mysqlTable('expedition_pins', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  
  // Tipo de pin
  pinType: expeditionPinTypeEnum.notNull(), // INTRO, OBJECTIVE, FINAL
  
  // Posición en el mapa (coordenadas relativas 0-100%)
  positionX: int('position_x').notNull(), // Porcentaje X
  positionY: int('position_y').notNull(), // Porcentaje Y
  
  // Info del pin
  name: varchar('name', { length: 255 }).notNull(),
  
  // Historia (narrativa del objetivo)
  storyContent: text('story_content'), // Contenido HTML/texto de la historia
  storyFiles: json('story_files').$type<string[]>(), // URLs de archivos adjuntos
  
  // Tarea (solo para OBJECTIVE)
  taskName: varchar('task_name', { length: 255 }),
  taskContent: text('task_content'), // Contenido HTML/texto de la tarea
  taskFiles: json('task_files').$type<string[]>(), // URLs de archivos adjuntos
  
  // Configuración de entrega
  requiresSubmission: boolean('requires_submission').notNull().default(false), // Si requiere subir archivo
  dueDate: datetime('due_date'), // Fecha de vencimiento
  
  // Recompensas
  rewardXp: int('reward_xp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  
  // Bonus por entrega temprana
  earlySubmissionEnabled: boolean('early_submission_enabled').notNull().default(false),
  earlySubmissionDate: datetime('early_submission_date'),
  earlyBonusXp: int('early_bonus_xp').notNull().default(0),
  earlyBonusGp: int('early_bonus_gp').notNull().default(0),
  
  // Progreso automático (override del global)
  autoProgress: boolean('auto_progress'), // null = usar config de expedición
  
  // Orden para visualización en lista
  orderIndex: int('order_index').notNull().default(0),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_expedition_pins_expedition').on(table.expeditionId),
  typeIdx: index('idx_expedition_pins_type').on(table.pinType),
}));

export const expeditionPinsRelations = relations(expeditionPins, ({ one, many }) => ({
  expedition: one(expeditions, {
    fields: [expeditionPins.expeditionId],
    references: [expeditions.id],
  }),
  connectionsFrom: many(expeditionConnections, { relationName: 'fromPin' }),
  connectionsTo: many(expeditionConnections, { relationName: 'toPin' }),
  studentProgress: many(expeditionPinProgress),
  submissions: many(expeditionSubmissions),
}));

// Conexiones entre pines (flechas)
export const expeditionConnections = mysqlTable('expedition_connections', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  
  // Pin de origen
  fromPinId: varchar('from_pin_id', { length: 36 }).notNull(),
  
  // Pin de destino
  toPinId: varchar('to_pin_id', { length: 36 }).notNull(),
  
  // Tipo de conexión: true = cuando PASA, false = cuando NO PASA, null = conexión lineal (intro)
  onSuccess: boolean('on_success'), // true = ✅, false = ❌, null = lineal
  
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_expedition_connections_expedition').on(table.expeditionId),
  fromPinIdx: index('idx_expedition_connections_from').on(table.fromPinId),
  toPinIdx: index('idx_expedition_connections_to').on(table.toPinId),
}));

export const expeditionConnectionsRelations = relations(expeditionConnections, ({ one }) => ({
  expedition: one(expeditions, {
    fields: [expeditionConnections.expeditionId],
    references: [expeditions.id],
  }),
  fromPin: one(expeditionPins, {
    fields: [expeditionConnections.fromPinId],
    references: [expeditionPins.id],
    relationName: 'fromPin',
  }),
  toPin: one(expeditionPins, {
    fields: [expeditionConnections.toPinId],
    references: [expeditionPins.id],
    relationName: 'toPin',
  }),
}));

// Progreso del estudiante en la expedición (nivel general)
export const expeditionStudentProgress = mysqlTable('expedition_student_progress', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Estado general
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: datetime('completed_at'),
  
  // Pin actual donde está el estudiante
  currentPinId: varchar('current_pin_id', { length: 36 }),
  
  startedAt: datetime('started_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_expedition_progress_expedition').on(table.expeditionId),
  studentIdx: index('idx_expedition_progress_student').on(table.studentProfileId),
  uniqueProgress: unique('unique_expedition_student').on(table.expeditionId, table.studentProfileId),
}));

export const expeditionStudentProgressRelations = relations(expeditionStudentProgress, ({ one, many }) => ({
  expedition: one(expeditions, {
    fields: [expeditionStudentProgress.expeditionId],
    references: [expeditions.id],
  }),
  student: one(studentProfiles, {
    fields: [expeditionStudentProgress.studentProfileId],
    references: [studentProfiles.id],
  }),
  currentPin: one(expeditionPins, {
    fields: [expeditionStudentProgress.currentPinId],
    references: [expeditionPins.id],
  }),
  pinProgress: many(expeditionPinProgress),
}));

// Progreso del estudiante por pin individual
export const expeditionPinProgress = mysqlTable('expedition_pin_progress', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  pinId: varchar('pin_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Estado del pin para este estudiante
  status: expeditionProgressStatusEnum.notNull().default('LOCKED'), // LOCKED, UNLOCKED, IN_PROGRESS, PASSED, FAILED, COMPLETED
  
  // Decisión del profesor (null = pendiente, true = pasó, false = no pasó)
  teacherDecision: boolean('teacher_decision'),
  teacherDecisionAt: datetime('teacher_decision_at'),
  
  // Timestamps
  unlockedAt: datetime('unlocked_at'),
  completedAt: datetime('completed_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_pin_progress_expedition').on(table.expeditionId),
  pinIdx: index('idx_pin_progress_pin').on(table.pinId),
  studentIdx: index('idx_pin_progress_student').on(table.studentProfileId),
  uniquePinProgress: unique('unique_pin_student').on(table.pinId, table.studentProfileId),
}));

export const expeditionPinProgressRelations = relations(expeditionPinProgress, ({ one }) => ({
  expedition: one(expeditions, {
    fields: [expeditionPinProgress.expeditionId],
    references: [expeditions.id],
  }),
  pin: one(expeditionPins, {
    fields: [expeditionPinProgress.pinId],
    references: [expeditionPins.id],
  }),
  student: one(studentProfiles, {
    fields: [expeditionPinProgress.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// Entregas de tareas de expedición
export const expeditionSubmissions = mysqlTable('expedition_submissions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  pinId: varchar('pin_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  // Archivos entregados
  files: json('files').$type<string[]>().notNull(),
  comment: text('comment'), // Comentario opcional del estudiante
  
  // Estado
  isEarlySubmission: boolean('is_early_submission').notNull().default(false),
  
  submittedAt: datetime('submitted_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_submissions_expedition').on(table.expeditionId),
  pinIdx: index('idx_submissions_pin').on(table.pinId),
  studentIdx: index('idx_submissions_student').on(table.studentProfileId),
}));

export const expeditionSubmissionsRelations = relations(expeditionSubmissions, ({ one }) => ({
  expedition: one(expeditions, {
    fields: [expeditionSubmissions.expeditionId],
    references: [expeditions.id],
  }),
  pin: one(expeditionPins, {
    fields: [expeditionSubmissions.pinId],
    references: [expeditionPins.id],
  }),
  student: one(studentProfiles, {
    fields: [expeditionSubmissions.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// Expedition types
export type Expedition = typeof expeditions.$inferSelect;
export type NewExpedition = typeof expeditions.$inferInsert;
export type ExpeditionPin = typeof expeditionPins.$inferSelect;
export type NewExpeditionPin = typeof expeditionPins.$inferInsert;
export type ExpeditionConnection = typeof expeditionConnections.$inferSelect;
export type NewExpeditionConnection = typeof expeditionConnections.$inferInsert;
export type ExpeditionStudentProgress = typeof expeditionStudentProgress.$inferSelect;
export type ExpeditionPinProgress = typeof expeditionPinProgress.$inferSelect;
export type ExpeditionSubmission = typeof expeditionSubmissions.$inferSelect;
export type ExpeditionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExpeditionPinType = 'INTRO' | 'OBJECTIVE' | 'FINAL';
export type ExpeditionProgressStatus = 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'COMPLETED';

// ==================== CONQUISTA DE TERRITORIOS ====================

// Enums para Conquista de Territorios
export const territoryGameStatusEnum = mysqlEnum('territory_game_status', ['DRAFT', 'ACTIVE', 'PAUSED', 'FINISHED']);
export const territoryStatusEnum = mysqlEnum('territory_status', ['NEUTRAL', 'OWNED', 'CONTESTED']);
export const territoryChallengeTypeEnum = mysqlEnum('territory_challenge_type', ['CONQUEST', 'DEFENSE']);
export const territoryChallengeResultEnum = mysqlEnum('territory_challenge_result', ['PENDING', 'CORRECT', 'INCORRECT']);

// Mapas de territorios (plantillas reutilizables)
export const territoryMaps = mysqlTable('territory_maps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  // Configuración visual del mapa
  backgroundImage: varchar('background_image', { length: 500 }), // Imagen de fondo opcional
  gridCols: int('grid_cols').notNull().default(4), // Columnas del grid
  gridRows: int('grid_rows').notNull().default(3), // Filas del grid
  // Configuración de puntos
  baseConquestPoints: int('base_conquest_points').notNull().default(100), // XP base por conquistar
  baseDefensePoints: int('base_defense_points').notNull().default(50), // XP base por defender
  bonusStreakPoints: int('bonus_streak_points').notNull().default(25), // Bonus por racha
  // Estado
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_territory_maps_classroom').on(table.classroomId),
}));

export const territoryMapsRelations = relations(territoryMaps, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [territoryMaps.classroomId],
    references: [classrooms.id],
  }),
  territories: many(territories),
  games: many(territoryGames),
}));

// Territorios individuales dentro de un mapa
export const territories = mysqlTable('territories', {
  id: varchar('id', { length: 36 }).primaryKey(),
  mapId: varchar('map_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  // Posición en el grid
  gridX: int('grid_x').notNull(), // Columna (0-indexed)
  gridY: int('grid_y').notNull(), // Fila (0-indexed)
  // Visuales
  icon: varchar('icon', { length: 50 }).notNull().default('🏰'),
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'), // Color base
  // Configuración especial
  pointMultiplier: int('point_multiplier').notNull().default(100), // 100 = 1x, 150 = 1.5x
  isStrategic: boolean('is_strategic').notNull().default(false), // Territorios clave
  // Conexiones (territorios adyacentes para futuras mecánicas)
  adjacentTerritories: json('adjacent_territories').$type<string[]>().default([]),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  mapIdx: index('idx_territories_map').on(table.mapId),
  gridIdx: index('idx_territories_grid').on(table.mapId, table.gridX, table.gridY),
}));

export const territoriesRelations = relations(territories, ({ one, many }) => ({
  map: one(territoryMaps, {
    fields: [territories.mapId],
    references: [territoryMaps.id],
  }),
  gameStates: many(territoryGameStates),
  challenges: many(territoryChallenges),
}));

// Sesiones de juego de Conquista de Territorios
export const territoryGames = mysqlTable('territory_games', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  mapId: varchar('map_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  // Bancos de preguntas asociados (JSON array de IDs)
  questionBankIds: json('question_bank_ids').$type<string[]>().notNull(),
  // Clanes participantes (JSON array de IDs)
  participatingClanIds: json('participating_clan_ids').$type<string[]>().notNull(),
  // Estado del juego
  status: territoryGameStatusEnum.notNull().default('DRAFT'),
  // Configuración de la sesión
  maxRounds: int('max_rounds'), // null = sin límite
  currentRound: int('current_round').notNull().default(0),
  timePerQuestion: int('time_per_question').notNull().default(30), // segundos
  // Estadísticas
  totalChallenges: int('total_challenges').notNull().default(0),
  // Timestamps
  startedAt: datetime('started_at'),
  finishedAt: datetime('finished_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_territory_games_classroom').on(table.classroomId),
  mapIdx: index('idx_territory_games_map').on(table.mapId),
  statusIdx: index('idx_territory_games_status').on(table.status),
}));

export const territoryGamesRelations = relations(territoryGames, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [territoryGames.classroomId],
    references: [classrooms.id],
  }),
  map: one(territoryMaps, {
    fields: [territoryGames.mapId],
    references: [territoryMaps.id],
  }),
  states: many(territoryGameStates),
  challenges: many(territoryChallenges),
  clanScores: many(territoryGameClanScores),
}));

// Estado de cada territorio en una partida específica
export const territoryGameStates = mysqlTable('territory_game_states', {
  id: varchar('id', { length: 36 }).primaryKey(),
  gameId: varchar('game_id', { length: 36 }).notNull(),
  territoryId: varchar('territory_id', { length: 36 }).notNull(),
  // Estado actual
  status: territoryStatusEnum.notNull().default('NEUTRAL'),
  ownerClanId: varchar('owner_clan_id', { length: 36 }), // null si neutral
  // Historial
  conqueredAt: datetime('conquered_at'),
  timesContested: int('times_contested').notNull().default(0),
  timesChanged: int('times_changed').notNull().default(0), // Veces que cambió de dueño
  // Último clan que intentó conquistar/retar
  lastChallengerId: varchar('last_challenger_id', { length: 36 }),
  lastChallengeAt: datetime('last_challenge_at'),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  gameIdx: index('idx_territory_game_states_game').on(table.gameId),
  territoryIdx: index('idx_territory_game_states_territory').on(table.territoryId),
  ownerIdx: index('idx_territory_game_states_owner').on(table.ownerClanId),
  uniqueGameTerritory: unique('unique_game_territory').on(table.gameId, table.territoryId),
}));

export const territoryGameStatesRelations = relations(territoryGameStates, ({ one }) => ({
  game: one(territoryGames, {
    fields: [territoryGameStates.gameId],
    references: [territoryGames.id],
  }),
  territory: one(territories, {
    fields: [territoryGameStates.territoryId],
    references: [territories.id],
  }),
  ownerClan: one(teams, {
    fields: [territoryGameStates.ownerClanId],
    references: [teams.id],
  }),
}));

// Puntajes de clanes en una partida
export const territoryGameClanScores = mysqlTable('territory_game_clan_scores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  gameId: varchar('game_id', { length: 36 }).notNull(),
  clanId: varchar('clan_id', { length: 36 }).notNull(),
  // Puntuación
  totalPoints: int('total_points').notNull().default(0),
  territoriesOwned: int('territories_owned').notNull().default(0),
  territoriesConquered: int('territories_conquered').notNull().default(0), // Total conquistados (histórico)
  territoriesLost: int('territories_lost').notNull().default(0),
  successfulDefenses: int('successful_defenses').notNull().default(0),
  failedDefenses: int('failed_defenses').notNull().default(0),
  // Rachas
  currentStreak: int('current_streak').notNull().default(0),
  bestStreak: int('best_streak').notNull().default(0),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  gameIdx: index('idx_territory_clan_scores_game').on(table.gameId),
  clanIdx: index('idx_territory_clan_scores_clan').on(table.clanId),
  uniqueGameClan: unique('unique_game_clan').on(table.gameId, table.clanId),
}));

export const territoryGameClanScoresRelations = relations(territoryGameClanScores, ({ one }) => ({
  game: one(territoryGames, {
    fields: [territoryGameClanScores.gameId],
    references: [territoryGames.id],
  }),
  clan: one(teams, {
    fields: [territoryGameClanScores.clanId],
    references: [teams.id],
  }),
}));

// Desafíos/Retos de territorios (cada intento de conquista o defensa)
export const territoryChallenges = mysqlTable('territory_challenges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  gameId: varchar('game_id', { length: 36 }).notNull(),
  territoryId: varchar('territory_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  // Tipo de desafío
  challengeType: territoryChallengeTypeEnum.notNull(), // CONQUEST (neutral) o DEFENSE (owned)
  // Clanes involucrados
  challengerClanId: varchar('challenger_clan_id', { length: 36 }).notNull(), // Clan que intenta conquistar/retar
  defenderClanId: varchar('defender_clan_id', { length: 36 }), // null si es territorio neutral
  // Estudiante que respondió (para dar puntos individuales)
  respondentStudentId: varchar('respondent_student_id', { length: 36 }),
  // Resultado
  result: territoryChallengeResultEnum.notNull().default('PENDING'),
  // Puntos otorgados
  pointsAwarded: int('points_awarded').notNull().default(0),
  xpToStudent: int('xp_to_student').notNull().default(0), // XP dado al estudiante
  xpToClan: int('xp_to_clan').notNull().default(0), // XP dado al clan
  // Tiempo
  timeSpent: int('time_spent'), // Segundos que tardó en responder
  // Timestamps
  startedAt: datetime('started_at').notNull(),
  answeredAt: datetime('answered_at'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  gameIdx: index('idx_territory_challenges_game').on(table.gameId),
  territoryIdx: index('idx_territory_challenges_territory').on(table.territoryId),
  challengerIdx: index('idx_territory_challenges_challenger').on(table.challengerClanId),
  defenderIdx: index('idx_territory_challenges_defender').on(table.defenderClanId),
}));

export const territoryChallengesRelations = relations(territoryChallenges, ({ one }) => ({
  game: one(territoryGames, {
    fields: [territoryChallenges.gameId],
    references: [territoryGames.id],
  }),
  territory: one(territories, {
    fields: [territoryChallenges.territoryId],
    references: [territories.id],
  }),
  question: one(questions, {
    fields: [territoryChallenges.questionId],
    references: [questions.id],
  }),
  challengerClan: one(teams, {
    fields: [territoryChallenges.challengerClanId],
    references: [teams.id],
  }),
  defenderClan: one(teams, {
    fields: [territoryChallenges.defenderClanId],
    references: [teams.id],
  }),
  respondentStudent: one(studentProfiles, {
    fields: [territoryChallenges.respondentStudentId],
    references: [studentProfiles.id],
  }),
}));

// Types para Conquista de Territorios
export type TerritoryMap = typeof territoryMaps.$inferSelect;
export type NewTerritoryMap = typeof territoryMaps.$inferInsert;
export type Territory = typeof territories.$inferSelect;
export type NewTerritory = typeof territories.$inferInsert;
export type TerritoryGame = typeof territoryGames.$inferSelect;
export type NewTerritoryGame = typeof territoryGames.$inferInsert;
export type TerritoryGameState = typeof territoryGameStates.$inferSelect;
export type TerritoryGameClanScore = typeof territoryGameClanScores.$inferSelect;
export type TerritoryChallenge = typeof territoryChallenges.$inferSelect;
export type TerritoryGameStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type TerritoryStatus = 'NEUTRAL' | 'OWNED' | 'CONTESTED';
export type TerritoryChallengeType = 'CONQUEST' | 'DEFENSE';
export type TerritoryChallengeResult = 'PENDING' | 'CORRECT' | 'INCORRECT';
