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
  index,
  decimal
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================

export const userRoleEnum = mysqlEnum('role', ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']);
export const authProviderEnum = mysqlEnum('provider', ['LOCAL', 'GOOGLE']);
export const characterClassEnum = mysqlEnum('character_class', ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']);
export const pointTypeEnum = mysqlEnum('point_type', ['XP', 'HP', 'GP']);
export const pointActionEnum = mysqlEnum('action', ['ADD', 'REMOVE']);
export const questionTypeEnum = mysqlEnum('question_type', ['TEXT', 'IMAGE']);
export const itemCategoryEnum = mysqlEnum('category', ['AVATAR', 'ACCESSORY', 'CONSUMABLE', 'SPECIAL']);
export const itemRarityEnum = mysqlEnum('rarity', ['COMMON', 'RARE', 'LEGENDARY']);
export const avatarGenderEnum = mysqlEnum('avatar_gender', ['MALE', 'FEMALE']);
export const avatarSlotEnum = mysqlEnum('avatar_slot', ['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND']);
export const purchaseTypeEnum = mysqlEnum('purchase_type', ['SELF', 'GIFT', 'TEACHER', 'REWARD']);
export const purchaseStatusEnum = mysqlEnum('purchase_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const attendanceStatusEnum = mysqlEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

// Enums para Sistema de Calificaciones por Competencias
export const gradeScaleTypeEnum = mysqlEnum('grade_scale_type', ['PERU_LETTERS', 'PERU_VIGESIMAL', 'CENTESIMAL', 'USA_LETTERS', 'CUSTOM']);

// Enums para Sistema de Padres de Familia
export const parentRelationshipEnum = mysqlEnum('relationship', ['FATHER', 'MOTHER', 'TUTOR', 'GUARDIAN']);
export const parentLinkStatusEnum = mysqlEnum('status', ['PENDING', 'ACTIVE', 'REVOKED']);

// Enums para Sistema de Escuelas
export const schoolMemberRoleEnum = mysqlEnum('school_member_role', ['OWNER', 'TEACHER']);
export const schoolMemberStatusEnum = mysqlEnum('school_member_status', ['PENDING_ADMIN', 'PENDING_OWNER', 'VERIFIED', 'REJECTED']);
export const schoolVerificationStatusEnum = mysqlEnum('school_verification_status', ['PENDING', 'APPROVED', 'REJECTED']);

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

export const usersRelations = relations(users, ({ many, one }) => ({
  teacherClassrooms: many(classrooms),
  studentProfiles: many(studentProfiles),
  refreshTokens: many(refreshTokens),
  parentProfile: one(parentProfiles),
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

// ==================== PADRES DE FAMILIA ====================

export const parentProfiles = mysqlTable('parent_profiles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  relationship: parentRelationshipEnum.notNull().default('GUARDIAN'),
  
  // Preferencias de notificación
  notifyByEmail: boolean('notify_by_email').notNull().default(true),
  notifyWeeklySummary: boolean('notify_weekly_summary').notNull().default(true),
  notifyAlerts: boolean('notify_alerts').notNull().default(true),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  userIdx: index('idx_parent_profiles_user').on(table.userId),
}));

export const parentProfilesRelations = relations(parentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [parentProfiles.userId],
    references: [users.id],
  }),
  studentLinks: many(parentStudentLinks),
}));

export const parentStudentLinks = mysqlTable('parent_student_links', {
  id: varchar('id', { length: 36 }).primaryKey(),
  parentProfileId: varchar('parent_profile_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  status: parentLinkStatusEnum.notNull().default('PENDING'),
  linkCode: varchar('link_code', { length: 8 }).notNull(), // Código generado por profesor
  
  linkedAt: datetime('linked_at'), // Cuando se activó el vínculo
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  parentIdx: index('idx_parent_student_links_parent').on(table.parentProfileId),
  studentIdx: index('idx_parent_student_links_student').on(table.studentProfileId),
  linkCodeIdx: index('idx_parent_student_links_code').on(table.linkCode),
  uniqueLink: unique('unique_parent_student').on(table.parentProfileId, table.studentProfileId),
}));

export const parentStudentLinksRelations = relations(parentStudentLinks, ({ one }) => ({
  parentProfile: one(parentProfiles, {
    fields: [parentStudentLinks.parentProfileId],
    references: [parentProfiles.id],
  }),
  studentProfile: one(studentProfiles, {
    fields: [parentStudentLinks.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// ==================== CACHE DE INFORMES IA ====================

export const parentAiReports = mysqlTable('parent_ai_reports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  parentProfileId: varchar('parent_profile_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  reportJson: json('report_json').notNull(), // Cached AI report data
  generatedAt: datetime('generated_at').notNull(),
  expiresAt: datetime('expires_at').notNull(), // generatedAt + 24h
}, (table) => ({
  parentStudentIdx: index('idx_parent_ai_reports_ps').on(table.parentProfileId, table.studentProfileId),
}));

// ==================== AULAS ====================

export const classrooms = mysqlTable('classrooms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  code: varchar('code', { length: 8 }).notNull().unique(),
  teacherId: varchar('teacher_id', { length: 36 }).notNull(),
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
  
  // Configuración de Sistema de Calificaciones por Competencias
  useCompetencies: boolean('use_competencies').notNull().default(false), // Si usa sistema de competencias
  curriculumAreaId: varchar('curriculum_area_id', { length: 36 }), // FK a curriculum_areas
  gradeScaleType: gradeScaleTypeEnum, // Tipo de escala de calificación
  gradeScaleConfig: json('grade_scale_config').$type<{
    ranges: Array<{
      label: string;
      minPercent: number;
      maxPercent: number;
      xpReward: number;
      gpReward: number;
    }>;
  }>(),
  // Gestión de bimestres
  currentBimester: varchar('current_bimester', { length: 20 }).default('2024-B1'),
  closedBimesters: json('closed_bimesters').$type<Array<{
    period: string;
    closedAt: string;
    closedBy: string;
  }>>(),
  
  // Escuela asociada (opcional)
  schoolId: varchar('school_id', { length: 36 }),
  
  // Tema visual del aula (independiente de storytelling)
  themeConfig: json('theme_config').$type<{
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      sidebar?: string;
    };
    particles?: {
      type?: string;
      color?: string;
      speed?: string;
      density?: string;
    };
    decorations?: Array<{
      type: string;
      position: string;
      asset: string;
    }>;
    banner?: {
      emoji?: string;
      title?: string;
    };
  }>(),
  themeSource: varchar('theme_source', { length: 20 }).default('DEFAULT'),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  teacherIdx: index('idx_classrooms_teacher').on(table.teacherId),
  curriculumAreaIdx: index('idx_classrooms_curriculum_area').on(table.curriculumAreaId),
  schoolIdx: index('idx_classrooms_school').on(table.schoolId),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classrooms.teacherId],
    references: [users.id],
  }),
  curriculumArea: one(curriculumAreas, {
    fields: [classrooms.curriculumAreaId],
    references: [curriculumAreas.id],
  }),
  school: one(schools, {
    fields: [classrooms.schoolId],
    references: [schools.id],
  }),
  students: many(studentProfiles),
  teams: many(teams),
  behaviors: many(behaviors),
  powers: many(powers),
  randomEvents: many(randomEvents),
  shopItems: many(shopItems),
  classroomCompetencies: many(classroomCompetencies),
}));

// ==================== ESTUDIANTES ====================

export const studentProfiles = mysqlTable('student_profiles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }), // Nullable para estudiantes placeholder
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  characterClass: characterClassEnum.notNull(),
  avatarGender: avatarGenderEnum.notNull().default('MALE'), // género del avatar
  displayName: varchar('display_name', { length: 100 }), // Nombre para estudiantes sin cuenta
  linkCode: varchar('link_code', { length: 8 }).unique(), // Código para vincular cuenta
  parentLinkCode: varchar('parent_link_code', { length: 8 }).unique(), // Código para vincular padre
  xp: int('xp').notNull().default(0),
  hp: int('hp').notNull().default(100),
  gp: int('gp').notNull().default(0),
  level: int('level').notNull().default(1),
  characterName: varchar('character_name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  teamId: varchar('team_id', { length: 36 }),
  isActive: boolean('is_active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false), // Estudiante demo para onboarding
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_student_profiles_classroom').on(table.classroomId),
  userIdx: index('idx_student_profiles_user').on(table.userId),
  teamIdx: index('idx_student_profiles_team').on(table.teamId),
  activeIdx: index('idx_student_profiles_active').on(table.isActive),
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
  pointLogs: many(pointLogs),
  powerUsages: many(powerUsages),
  purchases: many(purchases),
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
  // Competencia asociada (para calificación por competencias)
  competencyId: varchar('competency_id', { length: 36 }),
  // Origen: si fue importado de un comportamiento de escuela
  schoolBehaviorId: varchar('school_behavior_id', { length: 36 }),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_behaviors_classroom').on(table.classroomId),
  classroomActiveIdx: index('idx_behaviors_classroom_active').on(table.classroomId, table.isActive),
  competencyIdx: index('idx_behaviors_competency').on(table.competencyId),
}));

export const behaviorsRelations = relations(behaviors, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [behaviors.classroomId],
    references: [classrooms.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [behaviors.competencyId],
    references: [curriculumCompetencies.id],
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
  xpAmount: int('xp_amount'),
  gpAmount: int('gp_amount'),
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
  type: mysqlEnum('notification_type', ['ITEM_USED', 'GIFT_RECEIVED', 'BATTLE_STARTED', 'LEVEL_UP', 'POINTS', 'PURCHASE_APPROVED', 'PURCHASE_REJECTED', 'BADGE', 'SCROLL_RECEIVED', 'SCROLL_APPROVED', 'SCROLL_REJECTED', 'ANNOUNCEMENT']).notNull(),
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
  
  // Competencia asociada (para calificación por competencias)
  competencyId: varchar('competency_id', { length: 36 }),
  
  // Origen: si fue importado de una insignia de escuela
  schoolBadgeId: varchar('school_badge_id', { length: 36 }),
  
  // Metadata
  isSecret: boolean('is_secret').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_badges_classroom').on(table.classroomId),
  competencyIdx: index('idx_badges_competency').on(table.competencyId),
}));

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
export type ParentProfile = typeof parentProfiles.$inferSelect;
export type NewParentProfile = typeof parentProfiles.$inferInsert;
export type ParentStudentLink = typeof parentStudentLinks.$inferSelect;
export type NewParentStudentLink = typeof parentStudentLinks.$inferInsert;
export type ParentRelationship = 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
export type ParentLinkStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';
export type Classroom = typeof classrooms.$inferSelect;
export type NewClassroom = typeof classrooms.$inferInsert;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Power = typeof powers.$inferSelect;
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
export type NotificationType = 'ITEM_USED' | 'GIFT_RECEIVED' | 'LEVEL_UP' | 'POINTS' | 'PURCHASE_APPROVED' | 'PURCHASE_REJECTED' | 'BADGE' | 'SCROLL_RECEIVED' | 'SCROLL_APPROVED' | 'SCROLL_REJECTED';
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
export type StudentStreak = typeof studentStreaks.$inferSelect;

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

// ==================== REPORTES DE BUGS ====================

export const bugReports = mysqlTable('bug_reports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: mysqlEnum('category', ['UI', 'FUNCTIONALITY', 'PERFORMANCE', 'DATA', 'OTHER']).notNull().default('OTHER'),
  priority: mysqlEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).notNull().default('MEDIUM'),
  status: mysqlEnum('status', ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).notNull().default('PENDING'),
  currentUrl: varchar('current_url', { length: 500 }),
  browserInfo: text('browser_info'),
  screenshotUrl: varchar('screenshot_url', { length: 500 }),
  adminNotes: text('admin_notes'),
  resolvedAt: datetime('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 36 }).references(() => users.id),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [bugReports.resolvedBy],
    references: [users.id],
  }),
}));

// Types para Bug Reports
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type BugReportCategory = 'UI' | 'FUNCTIONALITY' | 'PERFORMANCE' | 'DATA' | 'OTHER';
export type BugReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BugReportStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

// ==================== SISTEMA DE TORNEOS ====================

// Enums para Torneos
export const tournamentTypeEnum = mysqlEnum('tournament_type', ['BRACKET', 'LEAGUE', 'QUICKFIRE']);
export const tournamentStatusEnum = mysqlEnum('tournament_status', ['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'FINISHED']);
export const tournamentParticipantTypeEnum = mysqlEnum('tournament_participant_type', ['INDIVIDUAL', 'CLAN']);
export const tournamentMatchStatusEnum = mysqlEnum('tournament_match_status', ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BYE']);

// Definición del torneo
export const tournaments = mysqlTable('tournaments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  
  // Info básica
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }).notNull().default('🏆'),
  
  // Tipo y configuración
  type: tournamentTypeEnum.notNull().default('BRACKET'),
  participantType: tournamentParticipantTypeEnum.notNull().default('INDIVIDUAL'),
  
  // Bancos de preguntas (JSON array de IDs)
  questionBankIds: json('question_bank_ids').$type<string[]>().notNull(),
  
  // Configuración del torneo
  maxParticipants: int('max_participants').notNull().default(16), // 4, 8, 16, 32
  timePerQuestion: int('time_per_question').notNull().default(30), // segundos
  questionsPerMatch: int('questions_per_match').notNull().default(3), // preguntas por enfrentamiento
  pointsPerCorrect: int('points_per_correct').notNull().default(1), // puntos por respuesta correcta
  bonusTimePoints: int('bonus_time_points').notNull().default(0), // bonus por responder rápido
  
  // Recompensas (XP y GP)
  rewardXpFirst: int('reward_xp_first').notNull().default(100),
  rewardXpSecond: int('reward_xp_second').notNull().default(50),
  rewardXpThird: int('reward_xp_third').notNull().default(25),
  rewardGpFirst: int('reward_gp_first').notNull().default(50),
  rewardGpSecond: int('reward_gp_second').notNull().default(25),
  rewardGpThird: int('reward_gp_third').notNull().default(10),
  rewardXpParticipation: int('reward_xp_participation').notNull().default(10), // XP por participar
  
  // Estado
  status: tournamentStatusEnum.notNull().default('DRAFT'),
  currentRound: int('current_round').notNull().default(0),
  totalRounds: int('total_rounds').notNull().default(0), // Calculado al iniciar
  
  // Ganadores (se llenan al finalizar)
  firstPlaceId: varchar('first_place_id', { length: 36 }),
  secondPlaceId: varchar('second_place_id', { length: 36 }),
  thirdPlaceId: varchar('third_place_id', { length: 36 }),
  
  // Timestamps
  startedAt: datetime('started_at'),
  finishedAt: datetime('finished_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_tournaments_classroom').on(table.classroomId),
  statusIdx: index('idx_tournaments_status').on(table.status),
  typeIdx: index('idx_tournaments_type').on(table.type),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [tournaments.classroomId],
    references: [classrooms.id],
  }),
  participants: many(tournamentParticipants),
  matches: many(tournamentMatches),
}));

// Participantes del torneo
export const tournamentParticipants = mysqlTable('tournament_participants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tournamentId: varchar('tournament_id', { length: 36 }).notNull(),
  
  // Participante (estudiante o clan según el tipo de torneo)
  studentProfileId: varchar('student_profile_id', { length: 36 }), // null si es torneo de clanes
  clanId: varchar('clan_id', { length: 36 }), // null si es torneo individual
  
  // Posición en el bracket (seed)
  seed: int('seed').notNull().default(0),
  
  // Estadísticas
  totalPoints: int('total_points').notNull().default(0),
  matchesWon: int('matches_won').notNull().default(0),
  matchesLost: int('matches_lost').notNull().default(0),
  matchesDrawn: int('matches_drawn').notNull().default(0),
  questionsCorrect: int('questions_correct').notNull().default(0),
  questionsTotal: int('questions_total').notNull().default(0),
  
  // Estado en el torneo
  isEliminated: boolean('is_eliminated').notNull().default(false),
  eliminatedInRound: int('eliminated_in_round'),
  finalPosition: int('final_position'), // 1, 2, 3, etc. (se llena al finalizar)
  
  // Timestamps
  joinedAt: datetime('joined_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  tournamentIdx: index('idx_tournament_participants_tournament').on(table.tournamentId),
  studentIdx: index('idx_tournament_participants_student').on(table.studentProfileId),
  clanIdx: index('idx_tournament_participants_clan').on(table.clanId),
  uniqueTournamentStudent: unique('unique_tournament_student').on(table.tournamentId, table.studentProfileId),
  uniqueTournamentClan: unique('unique_tournament_clan').on(table.tournamentId, table.clanId),
}));

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [tournamentParticipants.tournamentId],
    references: [tournaments.id],
  }),
  student: one(studentProfiles, {
    fields: [tournamentParticipants.studentProfileId],
    references: [studentProfiles.id],
  }),
  clan: one(teams, {
    fields: [tournamentParticipants.clanId],
    references: [teams.id],
  }),
  matchesAsParticipant1: many(tournamentMatches, { relationName: 'participant1' }),
  matchesAsParticipant2: many(tournamentMatches, { relationName: 'participant2' }),
  answers: many(tournamentAnswers),
}));

// Enfrentamientos del torneo
export const tournamentMatches = mysqlTable('tournament_matches', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tournamentId: varchar('tournament_id', { length: 36 }).notNull(),
  
  // Posición en el bracket
  round: int('round').notNull(), // 1 = primera ronda, 2 = cuartos, etc.
  matchNumber: int('match_number').notNull(), // Número del match en la ronda
  bracketPosition: varchar('bracket_position', { length: 20 }), // Ej: "R1M1", "QF1", "SF1", "FINAL"
  
  // Participantes
  participant1Id: varchar('participant_1_id', { length: 36 }), // null si es BYE o aún no definido
  participant2Id: varchar('participant_2_id', { length: 36 }), // null si es BYE o aún no definido
  
  // Puntuaciones
  participant1Score: int('participant_1_score').notNull().default(0),
  participant2Score: int('participant_2_score').notNull().default(0),
  
  // Preguntas usadas en este match (JSON array de IDs)
  questionIds: json('question_ids').$type<string[]>(),
  currentQuestionIndex: int('current_question_index').notNull().default(0),
  
  // Resultado
  winnerId: varchar('winner_id', { length: 36 }), // ID del participante ganador
  status: tournamentMatchStatusEnum.notNull().default('PENDING'),
  
  // Timestamps
  startedAt: datetime('started_at'),
  completedAt: datetime('completed_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  tournamentIdx: index('idx_tournament_matches_tournament').on(table.tournamentId),
  roundIdx: index('idx_tournament_matches_round').on(table.round),
  statusIdx: index('idx_tournament_matches_status').on(table.status),
  participant1Idx: index('idx_tournament_matches_p1').on(table.participant1Id),
  participant2Idx: index('idx_tournament_matches_p2').on(table.participant2Id),
}));

export const tournamentMatchesRelations = relations(tournamentMatches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [tournamentMatches.tournamentId],
    references: [tournaments.id],
  }),
  participant1: one(tournamentParticipants, {
    fields: [tournamentMatches.participant1Id],
    references: [tournamentParticipants.id],
    relationName: 'participant1',
  }),
  participant2: one(tournamentParticipants, {
    fields: [tournamentMatches.participant2Id],
    references: [tournamentParticipants.id],
    relationName: 'participant2',
  }),
  winner: one(tournamentParticipants, {
    fields: [tournamentMatches.winnerId],
    references: [tournamentParticipants.id],
  }),
  answers: many(tournamentAnswers),
}));

// Respuestas en el torneo
export const tournamentAnswers = mysqlTable('tournament_answers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  matchId: varchar('match_id', { length: 36 }).notNull(),
  participantId: varchar('participant_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  
  // Respuesta
  answer: text('answer'), // La respuesta dada
  isCorrect: boolean('is_correct').notNull().default(false),
  
  // Puntuación
  pointsEarned: int('points_earned').notNull().default(0),
  timeSpent: int('time_spent'), // Segundos que tardó en responder
  
  // Timestamp
  answeredAt: datetime('answered_at').notNull(),
}, (table) => ({
  matchIdx: index('idx_tournament_answers_match').on(table.matchId),
  participantIdx: index('idx_tournament_answers_participant').on(table.participantId),
  questionIdx: index('idx_tournament_answers_question').on(table.questionId),
}));

export const tournamentAnswersRelations = relations(tournamentAnswers, ({ one }) => ({
  match: one(tournamentMatches, {
    fields: [tournamentAnswers.matchId],
    references: [tournamentMatches.id],
  }),
  participant: one(tournamentParticipants, {
    fields: [tournamentAnswers.participantId],
    references: [tournamentParticipants.id],
  }),
  question: one(questions, {
    fields: [tournamentAnswers.questionId],
    references: [questions.id],
  }),
}));

// Types para Torneos
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type NewTournamentParticipant = typeof tournamentParticipants.$inferInsert;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type NewTournamentMatch = typeof tournamentMatches.$inferInsert;
export type TournamentAnswer = typeof tournamentAnswers.$inferSelect;
export type NewTournamentAnswer = typeof tournamentAnswers.$inferInsert;
export type TournamentType = 'BRACKET' | 'LEAGUE' | 'QUICKFIRE';
export type TournamentStatus = 'DRAFT' | 'READY' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type TournamentParticipantType = 'INDIVIDUAL' | 'CLAN';
export type TournamentMatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE';

// ==================== SISTEMA DE CALIFICACIONES POR COMPETENCIAS ====================

// Áreas curriculares (precargadas por país)
export const curriculumAreas = mysqlTable('curriculum_areas', {
  id: varchar('id', { length: 36 }).primaryKey(),
  countryCode: varchar('country_code', { length: 5 }).notNull().default('PE'),
  name: varchar('name', { length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 50 }),
  displayOrder: int('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  countryIdx: index('idx_curriculum_areas_country').on(table.countryCode),
}));

export const curriculumAreasRelations = relations(curriculumAreas, ({ many }) => ({
  competencies: many(curriculumCompetencies),
  classrooms: many(classrooms),
}));

// Competencias por área curricular
export const curriculumCompetencies = mysqlTable('curriculum_competencies', {
  id: varchar('id', { length: 36 }).primaryKey(),
  areaId: varchar('area_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 100 }),
  description: text('description'),
  displayOrder: int('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  areaIdx: index('idx_curriculum_competencies_area').on(table.areaId),
}));

export const curriculumCompetenciesRelations = relations(curriculumCompetencies, ({ one, many }) => ({
  area: one(curriculumAreas, {
    fields: [curriculumCompetencies.areaId],
    references: [curriculumAreas.id],
  }),
  classroomCompetencies: many(classroomCompetencies),
}));

// Competencias habilitadas por clase
export const classroomCompetencies = mysqlTable('classroom_competencies', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  weight: int('weight').notNull().default(100), // Peso en porcentaje (100 = 1x)
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_classroom_competencies_classroom').on(table.classroomId),
  competencyIdx: index('idx_classroom_competencies_competency').on(table.competencyId),
  uniqueClassroomCompetency: unique('unique_classroom_competency').on(table.classroomId, table.competencyId),
}));

export const classroomCompetenciesRelations = relations(classroomCompetencies, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomCompetencies.classroomId],
    references: [classrooms.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [classroomCompetencies.competencyId],
    references: [curriculumCompetencies.id],
  }),
}));

// Actividades vinculadas a competencias
export const activityTypeEnum = mysqlEnum('activity_type', ['TOURNAMENT', 'EXPEDITION', 'TIMED', 'MISSION']);

export const activityCompetencies = mysqlTable('activity_competencies', {
  id: varchar('id', { length: 36 }).primaryKey(),
  activityType: activityTypeEnum.notNull(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  weight: int('weight').notNull().default(100),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  activityIdx: index('idx_activity_competencies_activity').on(table.activityType, table.activityId),
  competencyIdx: index('idx_activity_competencies_competency').on(table.competencyId),
  uniqueActivityCompetency: unique('unique_activity_competency').on(table.activityType, table.activityId, table.competencyId),
}));

export const activityCompetenciesRelations = relations(activityCompetencies, ({ one }) => ({
  competency: one(curriculumCompetencies, {
    fields: [activityCompetencies.competencyId],
    references: [curriculumCompetencies.id],
  }),
}));

// ==================== CALIFICACIONES POR COMPETENCIAS ====================

// Tipo de actividad extendido para incluir comportamientos e insignias
export const scoreActivityTypeEnum = mysqlEnum('score_activity_type', ['TOURNAMENT', 'EXPEDITION', 'TIMED', 'MISSION', 'BEHAVIOR', 'BADGE']);

// Calificaciones calculadas por estudiante/competencia/periodo
export const studentGrades = mysqlTable('student_grades', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  period: varchar('period', { length: 20 }).notNull().default('CURRENT'),
  score: decimal('score', { precision: 5, scale: 2 }).notNull().default('0'),
  gradeLabel: varchar('grade_label', { length: 10 }),
  calculationDetails: json('calculation_details').$type<{
    activities: Array<{
      type: string;
      id: string;
      name: string;
      score: number;
      weight: number;
    }>;
    totalWeight: number;
    rawScore: number;
  }>(),
  activitiesCount: int('activities_count').notNull().default(0),
  isManualOverride: boolean('is_manual_override').notNull().default(false),
  manualScore: decimal('manual_score', { precision: 5, scale: 2 }),
  manualNote: text('manual_note'),
  calculatedAt: datetime('calculated_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_student_grades_classroom').on(table.classroomId),
  studentIdx: index('idx_student_grades_student').on(table.studentProfileId),
  competencyIdx: index('idx_student_grades_competency').on(table.competencyId),
  periodIdx: index('idx_student_grades_period').on(table.period),
  uniqueStudentCompetencyPeriod: unique('unique_student_competency_period').on(table.studentProfileId, table.competencyId, table.period),
}));

export const studentGradesRelations = relations(studentGrades, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [studentGrades.classroomId],
    references: [classrooms.id],
  }),
  studentProfile: one(studentProfiles, {
    fields: [studentGrades.studentProfileId],
    references: [studentProfiles.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [studentGrades.competencyId],
    references: [curriculumCompetencies.id],
  }),
}));

// Puntajes individuales por actividad completada
export const studentActivityScores = mysqlTable('student_activity_scores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  activityType: scoreActivityTypeEnum.notNull(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }).notNull().default('0'),
  weight: int('weight').notNull().default(100),
  details: json('details').$type<{
    activityName?: string;
    maxScore?: number;
    earnedScore?: number;
    completedAt?: string;
  }>(),
  scoredAt: datetime('scored_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_activity_scores_student').on(table.studentProfileId),
  competencyIdx: index('idx_activity_scores_competency').on(table.competencyId),
  activityIdx: index('idx_activity_scores_activity').on(table.activityType, table.activityId),
  uniqueStudentActivityScore: unique('unique_student_activity_score').on(table.studentProfileId, table.activityType, table.activityId, table.competencyId),
}));

export const studentActivityScoresRelations = relations(studentActivityScores, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [studentActivityScores.studentProfileId],
    references: [studentProfiles.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [studentActivityScores.competencyId],
    references: [curriculumCompetencies.id],
  }),
}));

// Types para Sistema de Competencias
export type CurriculumArea = typeof curriculumAreas.$inferSelect;
export type NewCurriculumArea = typeof curriculumAreas.$inferInsert;
export type CurriculumCompetency = typeof curriculumCompetencies.$inferSelect;
export type NewCurriculumCompetency = typeof curriculumCompetencies.$inferInsert;
export type ClassroomCompetency = typeof classroomCompetencies.$inferSelect;
export type NewClassroomCompetency = typeof classroomCompetencies.$inferInsert;
export type ActivityCompetency = typeof activityCompetencies.$inferSelect;
export type NewActivityCompetency = typeof activityCompetencies.$inferInsert;
export type StudentGrade = typeof studentGrades.$inferSelect;
export type NewStudentGrade = typeof studentGrades.$inferInsert;
export type StudentActivityScore = typeof studentActivityScores.$inferSelect;
export type NewStudentActivityScore = typeof studentActivityScores.$inferInsert;
export type GradeScaleType = 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM';
export type ActivityType = 'TOURNAMENT' | 'EXPEDITION' | 'TIMED' | 'MISSION';
export type ScoreActivityType = 'TOURNAMENT' | 'EXPEDITION' | 'TIMED' | 'MISSION' | 'BEHAVIOR' | 'BADGE';

// ==================== SISTEMA DE COLECCIONABLES ====================

// Enums para Coleccionables
export const cardRarityEnum = mysqlEnum('card_rarity', ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);
export const packTypeEnum = mysqlEnum('pack_type', ['SINGLE', 'PACK_5', 'PACK_10']);
export const imageStyleEnum = mysqlEnum('image_style', ['CARTOON', 'REALISTIC', 'PIXEL_ART', 'ANIME', 'WATERCOLOR', 'MINIMALIST']);

// Álbumes de coleccionables
export const collectibleAlbums = mysqlTable('collectible_albums', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImage: varchar('cover_image', { length: 500 }),
  theme: varchar('theme', { length: 255 }), // Temática para generación IA
  imageStyle: imageStyleEnum.default('CARTOON'),
  
  // Precios de sobres (en GP)
  singlePackPrice: int('single_pack_price').notNull().default(10),
  fivePackPrice: int('five_pack_price').notNull().default(45),
  tenPackPrice: int('ten_pack_price').notNull().default(80),
  
  // Recompensas por completar
  rewardXp: int('reward_xp').notNull().default(0),
  rewardHp: int('reward_hp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  rewardBadgeId: varchar('reward_badge_id', { length: 36 }),
  
  // Configuración
  allowTrades: boolean('allow_trades').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_collectible_albums_classroom').on(table.classroomId),
}));

export const collectibleAlbumsRelations = relations(collectibleAlbums, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [collectibleAlbums.classroomId],
    references: [classrooms.id],
  }),
  rewardBadge: one(badges, {
    fields: [collectibleAlbums.rewardBadgeId],
    references: [badges.id],
  }),
  cards: many(collectibleCards),
}));

// Cromos/cartas del álbum
export const collectibleCards = mysqlTable('collectible_cards', {
  id: varchar('id', { length: 36 }).primaryKey(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }),
  rarity: cardRarityEnum.notNull().default('COMMON'),
  slotNumber: int('slot_number').notNull(), // Posición en el álbum
  isShiny: boolean('is_shiny').notNull().default(false), // Versión brillante
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  albumIdx: index('idx_collectible_cards_album').on(table.albumId),
  slotIdx: index('idx_collectible_cards_slot').on(table.albumId, table.slotNumber),
}));

export const collectibleCardsRelations = relations(collectibleCards, ({ one, many }) => ({
  album: one(collectibleAlbums, {
    fields: [collectibleCards.albumId],
    references: [collectibleAlbums.id],
  }),
  studentCollectibles: many(studentCollectibles),
}));

// Cromos obtenidos por estudiantes
export const studentCollectibles = mysqlTable('student_collectibles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  cardId: varchar('card_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull().default(1), // Pueden tener duplicados
  isShiny: boolean('is_shiny').notNull().default(false), // Si obtuvieron versión brillante
  
  obtainedAt: datetime('obtained_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_student_collectibles_student').on(table.studentProfileId),
  cardIdx: index('idx_student_collectibles_card').on(table.cardId),
  uniqueStudentCard: unique('unique_student_card').on(table.studentProfileId, table.cardId, table.isShiny),
}));

export const studentCollectiblesRelations = relations(studentCollectibles, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [studentCollectibles.studentProfileId],
    references: [studentProfiles.id],
  }),
  card: one(collectibleCards, {
    fields: [studentCollectibles.cardId],
    references: [collectibleCards.id],
  }),
}));

// Historial de compras de sobres
export const collectiblePurchases = mysqlTable('collectible_purchases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  packType: packTypeEnum.notNull(),
  gpSpent: int('gp_spent').notNull(),
  cardsObtained: json('cards_obtained').$type<Array<{
    cardId: string;
    cardName: string;
    rarity: string;
    isShiny: boolean;
    isNew: boolean; // Si era nuevo o duplicado
  }>>().notNull(),
  
  purchasedAt: datetime('purchased_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_collectible_purchases_student').on(table.studentProfileId),
  albumIdx: index('idx_collectible_purchases_album').on(table.albumId),
}));

export const collectiblePurchasesRelations = relations(collectiblePurchases, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [collectiblePurchases.studentProfileId],
    references: [studentProfiles.id],
  }),
  album: one(collectibleAlbums, {
    fields: [collectiblePurchases.albumId],
    references: [collectibleAlbums.id],
  }),
}));

// Registro de álbumes completados
export const completedAlbums = mysqlTable('completed_albums', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  rewardsGiven: boolean('rewards_given').notNull().default(false),
  
  completedAt: datetime('completed_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_completed_albums_student').on(table.studentProfileId),
  albumIdx: index('idx_completed_albums_album').on(table.albumId),
  uniqueStudentAlbum: unique('unique_student_album').on(table.studentProfileId, table.albumId),
}));

export const completedAlbumsRelations = relations(completedAlbums, ({ one }) => ({
  studentProfile: one(studentProfiles, {
    fields: [completedAlbums.studentProfileId],
    references: [studentProfiles.id],
  }),
  album: one(collectibleAlbums, {
    fields: [completedAlbums.albumId],
    references: [collectibleAlbums.id],
  }),
}));

// Types para Sistema de Coleccionables
export type CollectibleAlbum = typeof collectibleAlbums.$inferSelect;
export type NewCollectibleAlbum = typeof collectibleAlbums.$inferInsert;
export type CollectibleCard = typeof collectibleCards.$inferSelect;
export type NewCollectibleCard = typeof collectibleCards.$inferInsert;
export type StudentCollectible = typeof studentCollectibles.$inferSelect;
export type NewStudentCollectible = typeof studentCollectibles.$inferInsert;
export type CollectiblePurchase = typeof collectiblePurchases.$inferSelect;
export type NewCollectiblePurchase = typeof collectiblePurchases.$inferInsert;
export type CompletedAlbum = typeof completedAlbums.$inferSelect;
export type NewCompletedAlbum = typeof completedAlbums.$inferInsert;
export type CardRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type PackType = 'SINGLE' | 'PACK_5' | 'PACK_10';
export type ImageStyle = 'CARTOON' | 'REALISTIC' | 'PIXEL_ART' | 'ANIME' | 'WATERCOLOR' | 'MINIMALIST';

// ==================== EXPEDICIONES DE JIRO ====================

export const jiroExpeditionModeEnum = mysqlEnum('jiro_expedition_mode', ['ASYNC', 'EXAM']);
export const jiroExpeditionStatusEnum = mysqlEnum('jiro_expedition_status', ['DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED']);
export const jiroDeliveryFileTypeEnum = mysqlEnum('jiro_delivery_file_type', ['PDF', 'IMAGE', 'WORD', 'EXCEL']);
export const jiroStudentStatusEnum = mysqlEnum('jiro_student_status', ['NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED']);
export const jiroDeliveryStatusEnum = mysqlEnum('jiro_delivery_status', ['PENDING', 'APPROVED', 'REJECTED']);

// Expediciones (actividad principal)
export const jiroExpeditions = mysqlTable('jiro_expeditions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  questionBankId: varchar('question_bank_id', { length: 36 }).notNull(),
  
  // Info básica
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImageUrl: varchar('cover_image_url', { length: 500 }),
  
  // Modo y estado
  mode: mysqlEnum('mode', ['ASYNC', 'EXAM']).notNull().default('ASYNC'),
  status: mysqlEnum('status', ['DRAFT', 'OPEN', 'IN_PROGRESS', 'CLOSED']).notNull().default('DRAFT'),
  
  // Configuración de tiempo (solo EXAM)
  timeLimitMinutes: int('time_limit_minutes'),
  
  // Configuración de energía
  initialEnergy: int('initial_energy').notNull().default(5),
  energyRegenMinutes: int('energy_regen_minutes').notNull().default(30),
  energyPurchasePrice: int('energy_purchase_price').notNull().default(5),
  
  // Recompensas
  rewardXpPerCorrect: int('reward_xp_per_correct').notNull().default(10),
  rewardGpPerCorrect: int('reward_gp_per_correct').notNull().default(2),
  
  // Integración con calificaciones
  gradeWeight: decimal('grade_weight', { precision: 5, scale: 2 }),
  competencyId: varchar('competency_id', { length: 36 }),
  
  // Control
  requiresReview: boolean('requires_review').notNull().default(false),
  startedAt: datetime('started_at'),
  endsAt: datetime('ends_at'),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_jiro_expeditions_classroom').on(table.classroomId),
  questionBankIdx: index('idx_jiro_expeditions_bank').on(table.questionBankId),
  statusIdx: index('idx_jiro_expeditions_status').on(table.status),
}));

export const jiroExpeditionsRelations = relations(jiroExpeditions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [jiroExpeditions.classroomId],
    references: [classrooms.id],
  }),
  questionBank: one(questionBanks, {
    fields: [jiroExpeditions.questionBankId],
    references: [questionBanks.id],
  }),
  deliveryStations: many(jiroDeliveryStations),
  studentExpeditions: many(jiroStudentExpeditions),
  competencies: many(jiroExpeditionCompetencies),
}));

// Estaciones de entrega
export const jiroDeliveryStations = mysqlTable('jiro_delivery_stations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  orderIndex: int('order_index').notNull().default(0),
  
  // Tipos de archivo permitidos
  allowedFileTypes: json('allowed_file_types').$type<string[]>().notNull().default(['PDF', 'IMAGE']),
  maxFileSizeMb: int('max_file_size_mb').notNull().default(10),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_jiro_delivery_stations_expedition').on(table.expeditionId),
}));

export const jiroDeliveryStationsRelations = relations(jiroDeliveryStations, ({ one, many }) => ({
  expedition: one(jiroExpeditions, {
    fields: [jiroDeliveryStations.expeditionId],
    references: [jiroExpeditions.id],
  }),
  deliveries: many(jiroDeliveries),
}));

// Progreso del estudiante en expedición
export const jiroStudentExpeditions = mysqlTable('jiro_student_expeditions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  
  status: mysqlEnum('status', ['NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED']).notNull().default('NOT_STARTED'),
  
  // Energía
  currentEnergy: int('current_energy').notNull(),
  lastEnergyRegenAt: datetime('last_energy_regen_at'),
  
  // Progreso
  correctAnswers: int('correct_answers').notNull().default(0),
  wrongAnswers: int('wrong_answers').notNull().default(0),
  completedStations: json('completed_stations').$type<string[]>().notNull().default([]),
  
  // Recompensas finales
  earnedXp: int('earned_xp').notNull().default(0),
  earnedGp: int('earned_gp').notNull().default(0),
  finalScore: decimal('final_score', { precision: 5, scale: 2 }),
  
  // Tracking
  startedAt: datetime('started_at'),
  completedAt: datetime('completed_at'),
  reviewedAt: datetime('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 36 }),
  
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_jiro_student_expeditions_expedition').on(table.expeditionId),
  studentIdx: index('idx_jiro_student_expeditions_student').on(table.studentProfileId),
  statusIdx: index('idx_jiro_student_expeditions_status').on(table.status),
  uniqueStudentExpedition: unique('unique_jiro_student_expedition').on(table.expeditionId, table.studentProfileId),
}));

export const jiroStudentExpeditionsRelations = relations(jiroStudentExpeditions, ({ one, many }) => ({
  expedition: one(jiroExpeditions, {
    fields: [jiroStudentExpeditions.expeditionId],
    references: [jiroExpeditions.id],
  }),
  studentProfile: one(studentProfiles, {
    fields: [jiroStudentExpeditions.studentProfileId],
    references: [studentProfiles.id],
  }),
  reviewer: one(users, {
    fields: [jiroStudentExpeditions.reviewedBy],
    references: [users.id],
  }),
  questionAnswers: many(jiroQuestionAnswers),
  deliveries: many(jiroDeliveries),
}));

// Respuestas a preguntas
export const jiroQuestionAnswers = mysqlTable('jiro_question_answers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentExpeditionId: varchar('student_expedition_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  
  answer: json('answer'),
  isCorrect: boolean('is_correct').notNull(),
  energyLost: int('energy_lost').notNull().default(0),
  
  answeredAt: datetime('answered_at').notNull(),
}, (table) => ({
  studentExpeditionIdx: index('idx_jiro_answers_student_expedition').on(table.studentExpeditionId),
  questionIdx: index('idx_jiro_answers_question').on(table.questionId),
  uniqueAnswer: unique('unique_jiro_answer').on(table.studentExpeditionId, table.questionId),
}));

export const jiroQuestionAnswersRelations = relations(jiroQuestionAnswers, ({ one }) => ({
  studentExpedition: one(jiroStudentExpeditions, {
    fields: [jiroQuestionAnswers.studentExpeditionId],
    references: [jiroStudentExpeditions.id],
  }),
  question: one(questions, {
    fields: [jiroQuestionAnswers.questionId],
    references: [questions.id],
  }),
}));

// Entregas de archivos
export const jiroDeliveries = mysqlTable('jiro_deliveries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentExpeditionId: varchar('student_expedition_id', { length: 36 }).notNull(),
  deliveryStationId: varchar('delivery_station_id', { length: 36 }).notNull(),
  
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: mysqlEnum('file_type', ['PDF', 'IMAGE', 'WORD', 'EXCEL']).notNull(),
  fileSizeBytes: int('file_size_bytes').notNull(),
  
  status: mysqlEnum('status', ['PENDING', 'APPROVED', 'REJECTED']).notNull().default('PENDING'),
  feedback: text('feedback'),
  
  submittedAt: datetime('submitted_at').notNull(),
  reviewedAt: datetime('reviewed_at'),
}, (table) => ({
  studentExpeditionIdx: index('idx_jiro_deliveries_student_expedition').on(table.studentExpeditionId),
  deliveryStationIdx: index('idx_jiro_deliveries_station').on(table.deliveryStationId),
  statusIdx: index('idx_jiro_deliveries_status').on(table.status),
  uniqueDelivery: unique('unique_jiro_delivery').on(table.studentExpeditionId, table.deliveryStationId),
}));

export const jiroDeliveriesRelations = relations(jiroDeliveries, ({ one }) => ({
  studentExpedition: one(jiroStudentExpeditions, {
    fields: [jiroDeliveries.studentExpeditionId],
    references: [jiroStudentExpeditions.id],
  }),
  deliveryStation: one(jiroDeliveryStations, {
    fields: [jiroDeliveries.deliveryStationId],
    references: [jiroDeliveryStations.id],
  }),
}));

// Competencias de expedición (relación muchos-a-muchos)
export const jiroExpeditionCompetencies = mysqlTable('jiro_expedition_competencies', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_jiro_exp_comp_expedition').on(table.expeditionId),
  competencyIdx: index('idx_jiro_exp_comp_competency').on(table.competencyId),
  uniqueExpComp: unique('unique_jiro_exp_competency').on(table.expeditionId, table.competencyId),
}));

export const jiroExpeditionCompetenciesRelations = relations(jiroExpeditionCompetencies, ({ one }) => ({
  expedition: one(jiroExpeditions, {
    fields: [jiroExpeditionCompetencies.expeditionId],
    references: [jiroExpeditions.id],
  }),
}));

// Types para Expediciones de Jiro
export type JiroExpedition = typeof jiroExpeditions.$inferSelect;
export type NewJiroExpedition = typeof jiroExpeditions.$inferInsert;
export type JiroExpeditionCompetency = typeof jiroExpeditionCompetencies.$inferSelect;
export type NewJiroExpeditionCompetency = typeof jiroExpeditionCompetencies.$inferInsert;
export type JiroDeliveryStation = typeof jiroDeliveryStations.$inferSelect;
export type NewJiroDeliveryStation = typeof jiroDeliveryStations.$inferInsert;
export type JiroStudentExpedition = typeof jiroStudentExpeditions.$inferSelect;
export type NewJiroStudentExpedition = typeof jiroStudentExpeditions.$inferInsert;
export type JiroQuestionAnswer = typeof jiroQuestionAnswers.$inferSelect;
export type NewJiroQuestionAnswer = typeof jiroQuestionAnswers.$inferInsert;
export type JiroDelivery = typeof jiroDeliveries.$inferSelect;
export type NewJiroDelivery = typeof jiroDeliveries.$inferInsert;
export type JiroExpeditionMode = 'ASYNC' | 'EXAM';
export type JiroExpeditionStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type JiroStudentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED';
export type JiroDeliveryFileType = 'PDF' | 'IMAGE' | 'WORD' | 'EXCEL';
export type JiroDeliveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ==================== SISTEMA DE ESCUELAS ====================

export const schools = mysqlTable('schools', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 100 }),
  country: varchar('country', { length: 100 }).notNull().default('Perú'),
  googlePlaceId: varchar('google_place_id', { length: 255 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  nameIdx: index('idx_schools_name').on(table.name),
  googlePlaceIdx: index('idx_schools_google_place').on(table.googlePlaceId),
  createdByIdx: index('idx_schools_created_by').on(table.createdBy),
}));

export const schoolsRelations = relations(schools, ({ one, many }) => ({
  creator: one(users, {
    fields: [schools.createdBy],
    references: [users.id],
  }),
  members: many(schoolMembers),
  verifications: many(schoolVerifications),
  classrooms: many(classrooms),
}));

export const schoolMembers = mysqlTable('school_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  role: schoolMemberRoleEnum.notNull().default('TEACHER'),
  status: schoolMemberStatusEnum.notNull(),
  rejectionReason: text('rejection_reason'),
  joinedAt: datetime('joined_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_members_school').on(table.schoolId),
  userIdx: index('idx_school_members_user').on(table.userId),
  uniqueSchoolMember: unique('unique_school_member').on(table.schoolId, table.userId),
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

export const schoolVerifications = mysqlTable('school_verifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  position: varchar('position', { length: 100 }).notNull(),
  documentUrls: json('document_urls').$type<string[]>(),
  details: text('details'),
  status: schoolVerificationStatusEnum.notNull().default('PENDING'),
  reviewedBy: varchar('reviewed_by', { length: 36 }),
  reviewNote: text('review_note'),
  reviewedAt: datetime('reviewed_at'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_verifications_school').on(table.schoolId),
  userIdx: index('idx_school_verifications_user').on(table.userId),
  statusIdx: index('idx_school_verifications_status').on(table.status),
}));

export const schoolVerificationsRelations = relations(schoolVerifications, ({ one }) => ({
  school: one(schools, {
    fields: [schoolVerifications.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [schoolVerifications.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [schoolVerifications.reviewedBy],
    references: [users.id],
  }),
}));

// Comportamientos de escuela (creados por OWNER, importables por profesores)
export const schoolBehaviors = mysqlTable('school_behaviors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  pointType: pointTypeEnum.notNull(),
  pointValue: int('point_value').notNull(),
  xpValue: int('xp_value').notNull().default(0),
  hpValue: int('hp_value').notNull().default(0),
  gpValue: int('gp_value').notNull().default(0),
  icon: varchar('icon', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_behaviors_school').on(table.schoolId),
  schoolActiveIdx: index('idx_school_behaviors_school_active').on(table.schoolId, table.isActive),
}));

export const schoolBehaviorsRelations = relations(schoolBehaviors, ({ one }) => ({
  school: one(schools, {
    fields: [schoolBehaviors.schoolId],
    references: [schools.id],
  }),
  creator: one(users, {
    fields: [schoolBehaviors.createdBy],
    references: [users.id],
  }),
}));

// Insignias de escuela (creadas por OWNER, importables por profesores)
export const schoolBadges = mysqlTable('school_badges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  schoolId: varchar('school_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  customImage: varchar('custom_image', { length: 500 }),
  category: mysqlEnum('school_badge_category', ['PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM']).notNull().default('CUSTOM'),
  rarity: mysqlEnum('school_badge_rarity', ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).notNull().default('COMMON'),
  assignmentMode: mysqlEnum('school_badge_assignment', ['AUTOMATIC', 'MANUAL', 'BOTH']).notNull().default('MANUAL'),
  unlockCondition: json('unlock_condition'),
  rewardXp: int('reward_xp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  isSecret: boolean('is_secret').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  schoolIdx: index('idx_school_badges_school').on(table.schoolId),
  schoolActiveIdx: index('idx_school_badges_school_active').on(table.schoolId, table.isActive),
}));

export const schoolBadgesRelations = relations(schoolBadges, ({ one }) => ({
  school: one(schools, {
    fields: [schoolBadges.schoolId],
    references: [schools.id],
  }),
  creator: one(users, {
    fields: [schoolBadges.createdBy],
    references: [users.id],
  }),
}));

// Types para Sistema de Escuelas
export type School = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;
export type SchoolMember = typeof schoolMembers.$inferSelect;
export type NewSchoolMember = typeof schoolMembers.$inferInsert;
export type SchoolVerification = typeof schoolVerifications.$inferSelect;
export type NewSchoolVerification = typeof schoolVerifications.$inferInsert;
export type SchoolBehavior = typeof schoolBehaviors.$inferSelect;
export type NewSchoolBehavior = typeof schoolBehaviors.$inferInsert;
export type SchoolBadge = typeof schoolBadges.$inferSelect;
export type NewSchoolBadge = typeof schoolBadges.$inferInsert;

// ==================== STORYTELLING ====================

export const stories = mysqlTable('stories', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(false),
  themeConfig: json('theme_config').$type<{
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      sidebar?: string;
    };
    particles?: {
      type?: string;
      color?: string;
      speed?: string;
      density?: string;
    };
    decorations?: Array<{
      type: string;
      position: string;
      asset: string;
    }>;
    banner?: {
      emoji?: string;
      title?: string;
    };
  }>(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_stories_classroom').on(table.classroomId),
  classroomActiveIdx: index('idx_stories_classroom_active').on(table.classroomId, table.isActive),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [stories.classroomId],
    references: [classrooms.id],
  }),
  chapters: many(storyChapters),
}));

export const storyChapters = mysqlTable('story_chapters', {
  id: varchar('id', { length: 36 }).primaryKey(),
  storyId: varchar('story_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  orderIndex: int('order_index').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('LOCKED'),
  completionType: varchar('completion_type', { length: 20 }).notNull().default('BIMESTER'),
  completionConfig: json('completion_config').$type<{
    targetXp?: number;
    donationPercent?: number;
  }>(),
  currentProgress: decimal('current_progress', { precision: 12, scale: 2 }).notNull().default('0'),
  themeOverride: json('theme_override').$type<{
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      sidebar?: string;
    };
    particles?: {
      type?: string;
      color?: string;
      speed?: string;
      density?: string;
    };
    decorations?: Array<{
      type: string;
      position: string;
      asset: string;
    }>;
    banner?: {
      emoji?: string;
      title?: string;
    };
  }>(),
  completedAt: datetime('completed_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  storyIdx: index('idx_story_chapters_story').on(table.storyId),
  storyOrderIdx: index('idx_story_chapters_story_order').on(table.storyId, table.orderIndex),
}));

export const storyChaptersRelations = relations(storyChapters, ({ one, many }) => ({
  story: one(stories, {
    fields: [storyChapters.storyId],
    references: [stories.id],
  }),
  scenes: many(storyScenes),
  donations: many(storyDonations),
}));

export const storyScenes = mysqlTable('story_scenes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  chapterId: varchar('chapter_id', { length: 36 }).notNull(),
  orderIndex: int('order_index').notNull().default(0),
  type: varchar('type', { length: 20 }).notNull().default('INTRO'),
  mediaType: varchar('media_type', { length: 20 }),
  mediaUrl: varchar('media_url', { length: 500 }),
  backgroundColor: varchar('background_color', { length: 7 }),
  triggerConfig: json('trigger_config'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  chapterIdx: index('idx_story_scenes_chapter').on(table.chapterId),
  chapterOrderIdx: index('idx_story_scenes_chapter_order').on(table.chapterId, table.orderIndex),
}));

export const storyScenesRelations = relations(storyScenes, ({ one, many }) => ({
  chapter: one(storyChapters, {
    fields: [storyScenes.chapterId],
    references: [storyChapters.id],
  }),
  dialogues: many(sceneDialogues),
  views: many(studentSceneViews),
}));

export const sceneDialogues = mysqlTable('scene_dialogues', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sceneId: varchar('scene_id', { length: 36 }).notNull(),
  orderIndex: int('order_index').notNull().default(0),
  text: text('text').notNull(),
  speaker: varchar('speaker', { length: 100 }),
  emotion: varchar('emotion', { length: 20 }).default('neutral'),
}, (table) => ({
  sceneIdx: index('idx_scene_dialogues_scene').on(table.sceneId),
  sceneOrderIdx: index('idx_scene_dialogues_scene_order').on(table.sceneId, table.orderIndex),
}));

export const sceneDialoguesRelations = relations(sceneDialogues, ({ one }) => ({
  scene: one(storyScenes, {
    fields: [sceneDialogues.sceneId],
    references: [storyScenes.id],
  }),
}));

export const studentSceneViews = mysqlTable('student_scene_views', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  sceneId: varchar('scene_id', { length: 36 }).notNull(),
  viewedAt: datetime('viewed_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_student_scene_views_student').on(table.studentProfileId),
  uniqueView: unique('idx_student_scene_views_unique').on(table.studentProfileId, table.sceneId),
}));

export const studentSceneViewsRelations = relations(studentSceneViews, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [studentSceneViews.studentProfileId],
    references: [studentProfiles.id],
  }),
  scene: one(storyScenes, {
    fields: [studentSceneViews.sceneId],
    references: [storyScenes.id],
  }),
}));

export const storyDonations = mysqlTable('story_donations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  chapterId: varchar('chapter_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  xpAmount: decimal('xp_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  chapterIdx: index('idx_story_donations_chapter').on(table.chapterId),
  studentIdx: index('idx_story_donations_student').on(table.studentProfileId),
  chapterCreatedIdx: index('idx_story_donations_chapter_created').on(table.chapterId, table.createdAt),
}));

export const storyDonationsRelations = relations(storyDonations, ({ one }) => ({
  chapter: one(storyChapters, {
    fields: [storyDonations.chapterId],
    references: [storyChapters.id],
  }),
  student: one(studentProfiles, {
    fields: [storyDonations.studentProfileId],
    references: [studentProfiles.id],
  }),
}));

// Types para Storytelling
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryChapter = typeof storyChapters.$inferSelect;
export type NewStoryChapter = typeof storyChapters.$inferInsert;
export type StoryScene = typeof storyScenes.$inferSelect;
export type NewStoryScene = typeof storyScenes.$inferInsert;
export type SceneDialogue = typeof sceneDialogues.$inferSelect;
export type NewSceneDialogue = typeof sceneDialogues.$inferInsert;
export type StudentSceneView = typeof studentSceneViews.$inferSelect;
export type StoryDonation = typeof storyDonations.$inferSelect;

// ==================== AVISOS (PROFESOR → PADRES) ====================

export const announcements = mysqlTable('announcements', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  teacherId: varchar('teacher_id', { length: 36 }).notNull(),
  message: text('message').notNull(),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_announcements_classroom').on(table.classroomId),
  classroomDateIdx: index('idx_announcements_classroom_date').on(table.classroomId, table.createdAt),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [announcements.classroomId],
    references: [classrooms.id],
  }),
  teacher: one(users, {
    fields: [announcements.teacherId],
    references: [users.id],
  }),
  reads: many(announcementReads),
}));

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

// ==================== ANNOUNCEMENT READS ====================

export const announcementReads = mysqlTable('announcement_reads', {
  id: varchar('id', { length: 36 }).primaryKey(),
  announcementId: varchar('announcement_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  readAt: datetime('read_at').notNull(),
}, (table) => ({
  announcementIdx: index('idx_announcement_reads_announcement').on(table.announcementId),
  userIdx: index('idx_announcement_reads_user').on(table.userId),
  uniqueRead: unique('unique_announcement_user_read').on(table.announcementId, table.userId),
}));

export const announcementReadsRelations = relations(announcementReads, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementReads.announcementId],
    references: [announcements.id],
  }),
  user: one(users, {
    fields: [announcementReads.userId],
    references: [users.id],
  }),
}));

export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type NewAnnouncementRead = typeof announcementReads.$inferInsert;

// ==================== CHAT GRUPAL (PROFESOR ↔ PADRES) ====================

export const chatSenderRoleEnum = mysqlEnum('sender_role', ['TEACHER', 'PARENT']);

export const classroomMessages = mysqlTable('classroom_messages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  senderId: varchar('sender_id', { length: 36 }).notNull(),
  senderRole: chatSenderRoleEnum.notNull(),
  message: text('message').notNull(),
  deletedAt: datetime('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 36 }),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_classroom_messages_classroom').on(table.classroomId),
  classroomDateIdx: index('idx_classroom_messages_classroom_date').on(table.classroomId, table.createdAt),
  senderIdx: index('idx_classroom_messages_sender').on(table.senderId),
}));

export const classroomMessagesRelations = relations(classroomMessages, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomMessages.classroomId],
    references: [classrooms.id],
  }),
  sender: one(users, {
    fields: [classroomMessages.senderId],
    references: [users.id],
  }),
}));

export type ClassroomMessage = typeof classroomMessages.$inferSelect;
export type NewClassroomMessage = typeof classroomMessages.$inferInsert;

export const classroomChatSettings = mysqlTable('classroom_chat_settings', {
  classroomId: varchar('classroom_id', { length: 36 }).primaryKey(),
  isOpen: boolean('is_open').notNull().default(true),
  closedAt: datetime('closed_at'),
  closedBy: varchar('closed_by', { length: 36 }),
});

export const classroomChatSettingsRelations = relations(classroomChatSettings, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomChatSettings.classroomId],
    references: [classrooms.id],
  }),
}));

export type ClassroomChatSettings = typeof classroomChatSettings.$inferSelect;

// ==================== ONBOARDING PROGRESIVO (PROFESORES) ====================

export const teacherObjectiveEnum = mysqlEnum('objective', ['participation', 'behavior', 'learning', 'unknown']);

export const teacherOnboarding = mysqlTable('teacher_onboarding', {
  id: varchar('id', { length: 36 }).primaryKey(),
  teacherId: varchar('teacher_id', { length: 36 }).notNull().unique(),
  isExperienced: boolean('is_experienced').notNull().default(false),
  objective: teacherObjectiveEnum.default('unknown'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  completedAt: datetime('completed_at'),
  unlockedFeatures: json('unlocked_features').$type<string[]>().notNull().default([]),
  pendingUnlocks: json('pending_unlocks').$type<string[]>().notNull().default([]),
  newFeatures: json('new_features').$type<string[]>().notNull().default([]),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  teacherIdx: index('idx_teacher_onboarding_teacher').on(table.teacherId),
}));

export const teacherOnboardingRelations = relations(teacherOnboarding, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherOnboarding.teacherId],
    references: [users.id],
  }),
}));

export type TeacherOnboarding = typeof teacherOnboarding.$inferSelect;
export type NewTeacherOnboarding = typeof teacherOnboarding.$inferInsert;
