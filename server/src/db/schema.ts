import { 
  mysqlTable, tinyint, date, 
  varchar, 
  text, 
  boolean, 
  int, 
  datetime, 
  mysqlEnum,
  json,
  unique,
  index,
  decimal,
  primaryKey
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================

export const userRoleEnum = mysqlEnum('role', ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']);
// Docente sin verificar: usa su clase con la lista, pero no recibe alumnos con cuenta ni familias.
export const teacherStatusEnum = mysqlEnum('teacher_status', ['UNVERIFIED', 'PENDING', 'VERIFIED']);
export const teacherVerifiedViaEnum = mysqlEnum('teacher_verified_via', ['LEGACY', 'ADMIN', 'SCHOOL', 'DOMAIN']);
// PIN = alumno sin correo (código de clase + nombre de la lista + PIN de 4 números).
export const authProviderEnum = mysqlEnum('provider', ['LOCAL', 'GOOGLE', 'PIN']);
export const characterClassEnum = mysqlEnum('character_class', ['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']);
export const pointTypeEnum = mysqlEnum('point_type', ['XP', 'HP', 'GP']);
export const pointActionEnum = mysqlEnum('action', ['ADD', 'REMOVE']);
export const questionTypeEnum = mysqlEnum('question_type', ['TEXT', 'IMAGE']);
export const itemCategoryEnum = mysqlEnum('category', ['AVATAR', 'ACCESSORY', 'CONSUMABLE', 'SPECIAL']);
export const itemRarityEnum = mysqlEnum('rarity', ['COMMON', 'RARE', 'LEGENDARY']);
export const avatarGenderEnum = mysqlEnum('avatar_gender', ['MALE', 'FEMALE']);
export const avatarSlotEnum = mysqlEnum('avatar_slot', ['HEAD', 'HAIR', 'EYES', 'TOP', 'BOTTOM', 'LEFT_HAND', 'RIGHT_HAND', 'SHOES', 'BACK', 'FLAG', 'BACKGROUND']);
// REDEEM: el docente canjea un premio con el oro del alumno.
export const purchaseTypeEnum = mysqlEnum('purchase_type', ['SELF', 'GIFT', 'TEACHER', 'REWARD', 'REDEEM']);
export const purchaseStatusEnum = mysqlEnum('purchase_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const attendanceStatusEnum = mysqlEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

// Enums para Sistema de Calificaciones por Competencias
export interface BimesterDates { start: string; end: string }

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
  teacherStatus: teacherStatusEnum,
  teacherVerifiedVia: teacherVerifiedViaEnum,
  teacherVerifiedAt: datetime('teacher_verified_at'),
  teacherVerificationNote: varchar('teacher_verification_note', { length: 500 }),
  teacherVerificationRequestedAt: datetime('teacher_verification_requested_at'),
  provider: authProviderEnum.notNull().default('LOCAL'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  // Preferencias de notificaciones
  notifyBadges: boolean('notify_badges').notNull().default(true),
  notifyLevelUp: boolean('notify_level_up').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  /** Para retirar cuentas docentes sin verificar tras 180 días sin uso. */
  lastLoginAt: datetime('last_login_at'),
  /** Alumnos sin correo: PIN de 4 números (bcrypt). Null = sin PIN (nuevo o restablecido por el docente). */
  pinHash: varchar('pin_hash', { length: 100 }),
  pinFailedAttempts: int('pin_failed_attempts').notNull().default(0),
  pinLockedUntil: datetime('pin_locked_until'),
});

/** Dominios institucionales: un docente con ese correo queda verificado al registrarse. */
export const verifiedDomains = mysqlTable('verified_domains', {
  id: varchar('id', { length: 36 }).primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull().unique('uniq_verified_domains_domain'),
  schoolId: varchar('school_id', { length: 36 }),
  note: varchar('note', { length: 255 }),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
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
  /** Sesión a la que pertenece (null = token anterior a las sesiones). */
  sessionId: varchar('session_id', { length: 36 }),
  expiresAt: datetime('expires_at').notNull(),
  /** Rotado: se marca en vez de borrarse para detectar reusos. */
  usedAt: datetime('used_at'),
  createdAt: datetime('created_at').notNull(),
});

/** Sesión de un dispositivo: se revoca al instante (también sus sockets) y tiene una vida máxima. */
export const authSessions = mysqlTable('auth_sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  /** false = cookie de sesión (se borra al cerrar el navegador): alumnos en equipos compartidos. */
  persistent: boolean('persistent').notNull().default(true),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: datetime('created_at').notNull(),
  lastSeenAt: datetime('last_seen_at').notNull(),
  expiresAt: datetime('expires_at').notNull(),
  revokedAt: datetime('revoked_at'),
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
  isActive: boolean('is_active').notNull().default(true), // false = archivada
  acceptingStudents: boolean('accepting_students').notNull().default(true), // permite unirse con el código
  bannerUrl: varchar('banner_url', { length: 500 }),
  
  // Configuración de puntos
  defaultXp: int('default_xp').notNull().default(0),
  defaultHp: int('default_hp').notNull().default(100),
  defaultGp: int('default_gp').notNull().default(0),
  maxHp: int('max_hp').notNull().default(100),
  recoveryMissions: json('recovery_missions').$type<string[]>(), // plantillas de misiones de recuperación
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

  // Tienda de avatar (catálogo automático): precio = base × semanas por rareza × nivel. La base es el
  // oro semanal de la clase, calculada la primera vez y fija hasta que el docente la actualiza.
  avatarShopEnabled: boolean('avatar_shop_enabled').notNull().default(true),
  avatarPriceLevel: mysqlEnum('avatar_price_level', ['LOW', 'NORMAL', 'HIGH']).notNull().default('NORMAL'),
  avatarPriceBase: int('avatar_price_base'),
  avatarPricesAt: datetime('avatar_prices_at'),

  // Configuración de clases de personaje
  classAssignmentMode: varchar('class_assignment_mode', { length: 20 }).notNull().default('STUDENT_CHOICE'),
  
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
  competencyIndicatorStartPeriod: varchar('competency_indicator_start_period', { length: 20 }),
  // Peso (%) de las evaluaciones propias frente a la evidencia gamificada. NULL = 100.
  gradeEvaluationWeight: tinyint('grade_evaluation_weight', { unsigned: true }),
  // Gestión de bimestres
  currentBimester: varchar('current_bimester', { length: 20 }).default('2024-B1'),
  closedBimesters: json('closed_bimesters').$type<Array<{
    period: string;
    closedAt: string;
    closedBy: string;
  }>>(),
  // Fechas de cada bimestre (ISO, fin exclusivo). Sin entrada = rango por cierres (lógica anterior).
  bimesterDates: json('bimester_dates').$type<Record<string, BimesterDates>>(),
  
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
  characterClasses: many(classroomCharacterClasses),
}));

// ==================== CLASES DE PERSONAJE POR AULA ====================

export const classroomCharacterClasses = mysqlTable('classroom_character_classes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  key: varchar('key', { length: 50 }).notNull(),
  description: varchar('description', { length: 200 }),
  icon: varchar('icon', { length: 20 }).notNull().default('⚔️'),
  color: varchar('color', { length: 20 }).notNull().default('blue'),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_ccc_classroom').on(table.classroomId),
  uniqueKey: unique('uq_ccc_classroom_key').on(table.classroomId, table.key),
}));

export const classroomCharacterClassesRelations = relations(classroomCharacterClasses, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomCharacterClasses.classroomId],
    references: [classrooms.id],
  }),
}));

// ==================== ESTUDIANTES ====================

export const studentProfiles = mysqlTable('student_profiles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }), // Nullable para estudiantes placeholder
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  characterClass: characterClassEnum.notNull(),
  characterClassId: varchar('character_class_id', { length: 36 }),
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
  celebratedAt: datetime('celebrated_at'), // hasta dónde vio sus celebraciones (null = aún no)
  homeSeenAt: datetime('home_seen_at'), // hasta dónde vio "Lo nuevo" en su inicio (null = aún no)
  shopGoalItemId: varchar('shop_goal_item_id', { length: 36 }), // meta de ahorro: un premio o una prenda (null = sin meta)
  shopGoalKind: mysqlEnum('shop_goal_kind', ['ITEM', 'AVATAR']), // ITEM = premio de la tienda; AVATAR = prenda
  avatarGiftAt: datetime('avatar_gift_at'), // cuándo eligió su prenda de regalo (null = aún la tiene)
  restingSince: datetime('resting_since'), // HP en 0: desde cuándo descansa (null = tiene energía)
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_student_profiles_classroom').on(table.classroomId),
  userIdx: index('idx_student_profiles_user').on(table.userId),
  teamIdx: index('idx_student_profiles_team').on(table.teamId),
  activeIdx: index('idx_student_profiles_active').on(table.isActive),
  // Un perfil por alumno en cada clase (los alumnos sin cuenta tienen user_id NULL y no chocan).
  classroomUserUnique: unique('uniq_student_profiles_classroom_user').on(table.classroomId, table.userId),
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
  characterClassInfo: one(classroomCharacterClasses, {
    fields: [studentProfiles.characterClassId],
    references: [classroomCharacterClasses.id],
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
  competencyIndicatorId: varchar('competency_indicator_id', { length: 36 }),
  // Origen: si fue importado de un comportamiento de escuela
  schoolBehaviorId: varchar('school_behavior_id', { length: 36 }),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_behaviors_classroom').on(table.classroomId),
  classroomActiveIdx: index('idx_behaviors_classroom_active').on(table.classroomId, table.isActive),
  competencyIdx: index('idx_behaviors_competency').on(table.competencyId),
  competencyIndicatorIdx: index('idx_behaviors_competency_indicator').on(table.competencyIndicatorId),
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
  competencyIndicator: one(classroomCompetencyIndicators, {
    fields: [behaviors.competencyIndicatorId],
    references: [classroomCompetencyIndicators.id],
  }),
  pointLogs: many(pointLogs),
}));

// ==================== MISIONES DE RECUPERACIÓN (HP en 0) ====================

// Con HP en 0 el alumno "descansa": sale solo con una misión que el profesor valida.
export const recoveryMissions = mysqlTable('recovery_missions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  text: varchar('text', { length: 255 }).notNull(),
  status: varchar('status', { length: 12 }).notNull().default('ASSIGNED'), // ASSIGNED | COMPLETED | CANCELLED
  assignedBy: varchar('assigned_by', { length: 36 }),
  completedBy: varchar('completed_by', { length: 36 }),
  completionPointLogId: varchar('completion_point_log_id', { length: 36 }),
  createdAt: datetime('created_at').notNull(),
  completedAt: datetime('completed_at'),
}, (table) => ({
  studentStatusIdx: index('idx_recovery_missions_student_status').on(table.studentProfileId, table.status),
  classroomIdx: index('idx_recovery_missions_classroom').on(table.classroomId, table.createdAt),
}));

// ==================== REGISTRO DE SUBIDAS DE NIVEL ====================

// Toda subida de nivel, venga de donde venga (ver utils/points.ts). "Hoy subieron", filtro
// Niveles del registro y celebraciones del alumno.
export const levelUpLogs = mysqlTable('level_up_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  fromLevel: int('from_level').notNull(),
  toLevel: int('to_level').notNull(),
  source: varchar('source', { length: 20 }).notNull().default('OTHER'),
  isReverted: boolean('is_reverted').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  classroomDateIdx: index('idx_level_up_logs_classroom_date').on(table.classroomId, table.createdAt),
  studentDateIdx: index('idx_level_up_logs_student_date').on(table.studentProfileId, table.createdAt),
}));

// ==================== OBSERVATORIO DE JIRO ====================

// Partidas de las actividades del Observatorio: estado para reanudar, resumen de la Bitácora y
// recompensa (se entrega una sola vez por partida; ver activity.service).
export const activitySessions = mysqlTable('activity_sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  activityType: varchar('activity_type', { length: 20 }).notNull(), // DESCANSO | ESTRELLAS | CONQUISTA | CORREO | ERROR
  status: varchar('status', { length: 12 }).notNull().default('ACTIVE'), // ACTIVE | FINISHED | ABANDONED
  title: varchar('title', { length: 120 }),
  // Partida jugada desde una parada «en clase»: su recompensa marca la parada (sin pagarla dos veces).
  expeditionStopId: varchar('expedition_stop_id', { length: 36 }),
  state: json('state'),
  result: json('result'),
  selfAssessment: varchar('self_assessment', { length: 8 }), // GREEN | YELLOW | RED
  reward: json('reward'),
  rewardedAt: datetime('rewarded_at'),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  finishedAt: datetime('finished_at'),
}, (table) => ({
  classroomStatusIdx: index('idx_activity_sessions_classroom_status').on(table.classroomId, table.status, table.updatedAt),
  classroomTypeIdx: index('idx_activity_sessions_classroom_type').on(table.classroomId, table.activityType, table.createdAt),
}));

// Correo Estelar: cartas a la estrella secreta (privadas, sin autor para quien las recibe, moderadas).
export const activityLetters = mysqlTable('activity_letters', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sessionId: varchar('session_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  writerId: varchar('writer_id', { length: 36 }).notNull(),
  recipientId: varchar('recipient_id', { length: 36 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 10 }).notNull().default('PENDING'), // PENDING | APPROVED | REJECTED
  reviewedAt: datetime('reviewed_at'),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  writerUnique: unique('uq_activity_letters_writer').on(table.sessionId, table.writerId),
  recipientIdx: index('idx_activity_letters_recipient').on(table.recipientId, table.status, table.createdAt),
  sessionIdx: index('idx_activity_letters_session').on(table.sessionId, table.status),
}));

// ==================== REGISTRO DE PUNTOS ====================

export const pointLogs = mysqlTable('point_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentId: varchar('student_id', { length: 36 }).notNull(),
  behaviorId: varchar('behavior_id', { length: 36 }),
  competencyId: varchar('competency_id', { length: 36 }),
  competencyIndicatorId: varchar('competency_indicator_id', { length: 36 }),
  pointType: pointTypeEnum.notNull(),
  action: pointActionEnum.notNull(),
  amount: int('amount').notNull(),
  baseAmount: int('base_amount'),
  multiplier: int('multiplier').notNull().default(1000),
  xpAmount: int('xp_amount'),
  gpAmount: int('gp_amount'),
  reason: text('reason'),
  givenBy: varchar('given_by', { length: 36 }),
  isReverted: boolean('is_reverted').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_point_logs_student').on(table.studentId),
  studentDateIdx: index('idx_point_logs_student_date').on(table.studentId, table.createdAt),
  dateIdx: index('idx_point_logs_date').on(table.createdAt),
  // Resumen del registro de actividad (migración add_history_indexes.sql).
  studentTypeDateIdx: index('idx_point_logs_student_type_date').on(table.studentId, table.pointType, table.createdAt, table.action, table.amount, table.isReverted),
  behaviorIdx: index('idx_point_logs_behavior').on(table.behaviorId),
  competencyIdx: index('idx_point_logs_competency').on(table.competencyId),
  competencyIndicatorIdx: index('idx_point_logs_competency_indicator').on(table.competencyIndicatorId),
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
  competency: one(curriculumCompetencies, {
    fields: [pointLogs.competencyId],
    references: [curriculumCompetencies.id],
  }),
  competencyIndicator: one(classroomCompetencyIndicators, {
    fields: [pointLogs.competencyIndicatorId],
    references: [classroomCompetencyIndicators.id],
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
  giftAnonymous: boolean('gift_anonymous').notNull().default(false), // quien recibe no ve quién regaló (el docente sí)
  purchasedAt: datetime('purchased_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_purchases_student').on(table.studentId),
  studentDateIdx: index('idx_purchases_student_date').on(table.studentId, table.purchasedAt),
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

// Colecciones del catálogo de avatar (las arma el admin; llegan solas a todas las clases)
export const avatarCollections = mysqlTable('avatar_collections', {
  id: varchar('id', { length: 36 }).primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Items de avatar globales (creados por Juried/Admin)
export const avatarItems = mysqlTable('avatar_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  gender: avatarGenderEnum.notNull(), // MALE o FEMALE
  slot: avatarSlotEnum.notNull(), // HEAD, HAIR, EYES, TOP, etc.
  imagePath: varchar('image_path', { length: 500 }).notNull(), // ruta a la imagen PNG
  // sha256 de la imagen subida desde el panel (las sembradas no lo tienen): las dos versiones de un par
  // nunca comparten archivo.
  imageHash: varchar('image_hash', { length: 64 }),
  layerOrder: int('layer_order').notNull(), // orden de renderizado (mayor = más arriba)
  basePrice: int('base_price').notNull().default(100), // sin uso en el catálogo v2 (el precio sale de la rareza y la clase)
  rarity: itemRarityEnum.notNull().default('COMMON'),
  collectionId: varchar('collection_id', { length: 36 }),
  // La misma prenda en el otro cuerpo comparte pair_key: lo comprado pasa al cambiar de cuerpo.
  pairKey: varchar('pair_key', { length: 36 }),
  isDefault: boolean('is_default').notNull().default(false), // items por defecto al crear cuenta
  // Borrador = inactiva sin publishedAt; publicada = activa; retirada = inactiva con publishedAt.
  isActive: boolean('is_active').notNull().default(true),
  publishedAt: datetime('published_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  pairGenderUnique: unique('uniq_avatar_items_pair_gender').on(table.pairKey, table.gender),
}));

export const avatarItemsRelations = relations(avatarItems, ({ many }) => ({
  classroomItems: many(classroomAvatarItems),
  equippedItems: many(studentEquippedItems),
}));

// Items de avatar disponibles en la tienda de cada clase
// Excepciones del docente sobre el catálogo automático de su clase (sin fila = visible con el precio
// calculado): isAvailable = false → oculta en la clase; price → precio propio (null = el calculado).
export const classroomAvatarItems = mysqlTable('classroom_avatar_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  avatarItemId: varchar('avatar_item_id', { length: 36 }).notNull(),
  price: int('price'),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  uniqueClassroomItem: unique().on(table.classroomId, table.avatarItemId),
}));

// Colecciones que el docente ocultó en una clase (sin fila = visible).
export const classroomAvatarCollections = mysqlTable('classroom_avatar_collections', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  collectionId: varchar('collection_id', { length: 36 }).notNull(),
  isHidden: boolean('is_hidden').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  uniqueClassroomCollection: unique('uniq_classroom_avatar_collection').on(table.classroomId, table.collectionId),
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
  isReverted: boolean('is_reverted').notNull().default(false),
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
  // null = sin definir (por defecto); la IA la sugiere.
  difficulty: questionDifficultyEnum,
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
  // Generada con IA: queda "por revisar" (reviewedAt null) hasta que el docente la aprueba o la edita.
  aiGenerated: boolean('ai_generated').notNull().default(false),
  reviewedAt: datetime('reviewed_at'),
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

// ==================== EXPEDICIONES ====================
// Una sola «Expedición» (2026-10-03): paradas en lista (relato, reto del banco, evidencia y en clase).
// expedition_pins, _connections, _pin_progress, _student_progress, _submissions y jiro_* quedan en la base
// sin uso (migrations/expedition_unified.sql); se borrarán en una migración posterior.

export const expeditionStatusEnum = mysqlEnum('expedition_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const EXPEDITION_STOP_KINDS = ['STORY', 'CHALLENGE', 'EVIDENCE', 'CLASS'] as const;

/** Recurso de una parada: archivo subido a /api/uploads/expeditions o enlace https (Genially se incrusta). */
export interface ExpeditionResource {
  kind: 'FILE' | 'LINK';
  url: string;
  name: string | null;
}

export const expeditions = mysqlTable('expeditions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'), // lo que Jiro cuenta al empezar (también en la tarjeta)
  scenario: mysqlEnum('scenario', ['CONSTELLATION', 'MAP']).notNull().default('CONSTELLATION'),
  constellationId: varchar('constellation_id', { length: 40 }), // null = la más chica en la que caben las paradas
  mapImageUrl: varchar('map_image_url', { length: 500 }), // solo con escenario de mapa (de la biblioteca)
  groupMode: mysqlEnum('group_mode', ['INDIVIDUAL', 'CLAN']).notNull().default('INDIVIDUAL'),
  closingText: text('closing_text'), // lo que Jiro dice al llegar a la meta
  finishXp: int('finish_xp').notNull().default(0),
  finishGold: int('finish_gold').notNull().default(0),
  // Insignias que elige el docente: al llegar a la meta y por perseverancia (aprobada después de «pedir mejora»).
  finishBadgeId: varchar('finish_badge_id', { length: 36 }),
  perseveranceBadgeId: varchar('perseverance_badge_id', { length: 36 }),
  // Por clanes: XP para el clan cuando llega a la meta (una parada cuenta si la logra la mayoría del clan).
  clanXp: int('clan_xp').notNull().default(0),
  // Meta de la clase (opcional): si el % llega a la meta antes de la fecha, XP para quienes llegaron.
  goalPercent: tinyint('goal_percent', { unsigned: true }),
  goalDueAt: datetime('goal_due_at'),
  goalXp: int('goal_xp').notNull().default(0),
  goalReachedAt: datetime('goal_reached_at'),
  status: expeditionStatusEnum.notNull().default('DRAFT'),
  publishedAt: datetime('published_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomIdx: index('idx_expeditions_classroom').on(table.classroomId),
  statusIdx: index('idx_expeditions_status').on(table.status),
}));

// Paradas en orden. question_ids: las preguntas del banco que eligió el docente. map_x/map_y: % de la imagen.
export const expeditionStops = mysqlTable('expedition_stops', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  kind: mysqlEnum('kind', EXPEDITION_STOP_KINDS).notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  story: text('story'),
  goal: varchar('goal', { length: 200 }), // «Lo que vas a lograr»
  successCriteria: varchar('success_criteria', { length: 200 }), // «Cómo sabrás que lo lograste»
  mission: text('mission'),
  resources: json('resources').$type<ExpeditionResource[]>(),
  bankId: varchar('bank_id', { length: 36 }),
  questionIds: json('question_ids').$type<string[]>(),
  passPercent: int('pass_percent').notNull().default(60),
  reviewMode: mysqlEnum('review_mode', ['ADVANCE', 'WAIT']).notNull().default('ADVANCE'),
  dueAt: datetime('due_at'),
  rewardXp: int('reward_xp').notNull().default(0),
  rewardGold: int('reward_gold').notNull().default(0),
  // Nota (solo reto y evidencia): competencia de la clase y peso de 1 a 30, como una observación.
  competencyId: varchar('competency_id', { length: 36 }),
  gradeWeight: tinyint('grade_weight', { unsigned: true }).notNull().default(20),
  // «En clase»: actividad del Observatorio con la que se juega (con el banco de la parada).
  classActivity: varchar('class_activity', { length: 12 }), // ESTRELLAS | CONQUISTA | ERROR
  mapX: decimal('map_x', { precision: 5, scale: 2 }),
  mapY: decimal('map_y', { precision: 5, scale: 2 }),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  expeditionIdx: index('idx_expedition_stops_expedition').on(table.expeditionId, table.sortOrder),
  competencyIdx: index('idx_expedition_stops_competency').on(table.competencyId),
}));

export const expeditionsRelations = relations(expeditions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [expeditions.classroomId],
    references: [classrooms.id],
  }),
  stops: many(expeditionStops),
}));

export const expeditionStopsRelations = relations(expeditionStops, ({ one }) => ({
  expedition: one(expeditions, {
    fields: [expeditionStops.expeditionId],
    references: [expeditions.id],
  }),
}));

// Avance de cada alumno en cada parada: la fila nace al tocarla (sirve a quien entra tarde y a paradas nuevas).
// status: STARTED = reto en curso · WAITING = evidencia que espera revisión · DONE = superada.
// review: estado de la evidencia (con «avanza ya» el alumno sigue mientras queda PENDING).
// rewarded_at: la recompensa se paga una sola vez por fila.
export const expeditionStopProgress = mysqlTable('expedition_stop_progress', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  stopId: varchar('stop_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  status: mysqlEnum('status', ['STARTED', 'WAITING', 'DONE']).notNull().default('STARTED'),
  attempt: tinyint('attempt').notNull().default(1),
  firstScore: int('first_score'),
  finalScore: int('final_score'),
  // Nivel que eligió el docente al aprobar la evidencia (etiqueta de la escala y su %), para la nota.
  gradeScore: decimal('grade_score', { precision: 5, scale: 2 }),
  gradeLabel: varchar('grade_label', { length: 10 }),
  goldStar: boolean('gold_star').notNull().default(false),
  review: mysqlEnum('review', ['PENDING', 'APPROVED', 'NEEDS_WORK']),
  feedback: varchar('feedback', { length: 500 }),
  needsWorkCount: tinyint('needs_work_count', { unsigned: true }).notNull().default(0),
  reviewedAt: datetime('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 36 }),
  doneAt: datetime('done_at'),
  // Lograda en clase (proyectada o con una actividad del Observatorio): sin nota individual.
  doneInClass: boolean('done_in_class').notNull().default(false),
  rewardedAt: datetime('rewarded_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  stopStudentUnique: unique('uniq_expedition_stop_progress').on(table.stopId, table.studentProfileId),
  studentIdx: index('idx_expedition_stop_progress_student').on(table.expeditionId, table.studentProfileId),
  reviewIdx: index('idx_expedition_stop_progress_review').on(table.expeditionId, table.review),
}));

// Respuestas del reto: una por pregunta en cada vuelta (1 = primer intento, 2 = reintento de las falladas).
export const expeditionAnswers = mysqlTable('expedition_answers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  stopId: varchar('stop_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  attempt: tinyint('attempt').notNull(),
  answer: json('answer'),
  isCorrect: boolean('is_correct').notNull(),
  answeredAt: datetime('answered_at').notNull(),
}, (table) => ({
  answerUnique: unique('uniq_expedition_answer').on(table.stopId, table.studentProfileId, table.questionId, table.attempt),
  studentIdx: index('idx_expedition_answers_student').on(table.studentProfileId),
}));

// Evidencias: cada entrega queda guardada; la vigente es la última (milisegundos: dos entregas en el mismo
// segundo no se confunden al decidir cuál vio el docente).
export const expeditionEvidence = mysqlTable('expedition_evidence', {
  id: varchar('id', { length: 36 }).primaryKey(),
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  stopId: varchar('stop_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  files: json('files').$type<string[]>().notNull(),
  note: text('note'),
  submittedAt: datetime('submitted_at', { fsp: 3 }).notNull(),
}, (table) => ({
  stopIdx: index('idx_expedition_evidence_stop').on(table.stopId, table.studentProfileId),
  studentIdx: index('idx_expedition_evidence_student').on(table.studentProfileId),
}));

// Llegada a la meta: una fila por alumno; la recompensa final se paga una sola vez.
export const expeditionFinishes = mysqlTable('expedition_finishes', {
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  finishedAt: datetime('finished_at').notNull(),
  rewardedAt: datetime('rewarded_at'),
  // Premio de la meta de clase (una sola vez por alumno que llegó).
  goalRewardedAt: datetime('goal_rewarded_at'),
  // «¿Cómo me fue?»: GREEN | YELLOW | RED y lo más difícil (opcional). No condiciona la recompensa.
  reflection: varchar('reflection', { length: 8 }),
  reflectionNote: varchar('reflection_note', { length: 200 }),
  reflectedAt: datetime('reflected_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.expeditionId, table.studentProfileId] }),
  studentIdx: index('idx_expedition_finishes_student').on(table.studentProfileId),
}));

// Clanes que llegaron a la meta (modo por clanes): el premio del clan se paga una sola vez.
export const expeditionClanFinishes = mysqlTable('expedition_clan_finishes', {
  expeditionId: varchar('expedition_id', { length: 36 }).notNull(),
  teamId: varchar('team_id', { length: 36 }).notNull(),
  finishedAt: datetime('finished_at').notNull(),
  rewardedAt: datetime('rewarded_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.expeditionId, table.teamId] }),
  teamIdx: index('idx_expedition_clan_finishes_team').on(table.teamId),
}));

export type Expedition = typeof expeditions.$inferSelect;
export type NewExpedition = typeof expeditions.$inferInsert;
export type ExpeditionStop = typeof expeditionStops.$inferSelect;
export type ExpeditionStopProgress = typeof expeditionStopProgress.$inferSelect;
export type ExpeditionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExpeditionStopKind = typeof EXPEDITION_STOP_KINDS[number];

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


// ==================== SISTEMA DE CALIFICACIONES POR COMPETENCIAS ====================

// Áreas curriculares (precargadas por país)
export const curriculumAreas = mysqlTable('curriculum_areas', {
  id: varchar('id', { length: 36 }).primaryKey(),
  countryCode: varchar('country_code', { length: 5 }).notNull().default('PE'),
  educationLevel: varchar('education_level', { length: 20 }), // NULL = ambos, 'PRIMARIA', 'SECUNDARIA'
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
export const curriculumCompetencySourceEnum = mysqlEnum('source_type', ['OFFICIAL', 'CUSTOM_CLASSROOM']);

export const curriculumCompetencies = mysqlTable('curriculum_competencies', {
  id: varchar('id', { length: 36 }).primaryKey(),
  areaId: varchar('area_id', { length: 36 }).notNull(),
  sourceType: curriculumCompetencySourceEnum.notNull().default('OFFICIAL'),
  ownerClassroomId: varchar('owner_classroom_id', { length: 36 }),
  createdByTeacherId: varchar('created_by_teacher_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 100 }),
  description: text('description'),
  displayOrder: int('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  areaIdx: index('idx_curriculum_competencies_area').on(table.areaId),
  sourceTypeIdx: index('idx_curriculum_competencies_source_type').on(table.sourceType),
  ownerClassroomIdx: index('idx_curriculum_competencies_owner_classroom').on(table.ownerClassroomId),
  createdByTeacherIdx: index('idx_curriculum_competencies_created_by_teacher').on(table.createdByTeacherId),
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

export const classroomCompetenciesRelations = relations(classroomCompetencies, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [classroomCompetencies.classroomId],
    references: [classrooms.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [classroomCompetencies.competencyId],
    references: [curriculumCompetencies.id],
  }),
  indicators: many(classroomCompetencyIndicators),
}));

export const classroomCompetencyIndicators = mysqlTable('classroom_competency_indicators', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomCompetencyId: varchar('classroom_competency_id', { length: 36 }).notNull(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  displayOrder: int('display_order').notNull().default(0),
  weight: tinyint('weight', { unsigned: true }).notNull().default(1), // peso dentro de su competencia
  isActive: boolean('is_active').notNull().default(true),
  createdByTeacherId: varchar('created_by_teacher_id', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomCompetencyIdx: index('idx_classroom_competency_indicators_classroom_competency').on(table.classroomCompetencyId),
  classroomIdx: index('idx_classroom_competency_indicators_classroom').on(table.classroomId),
  competencyIdx: index('idx_classroom_competency_indicators_competency').on(table.competencyId),
  createdByTeacherIdx: index('idx_classroom_competency_indicators_teacher').on(table.createdByTeacherId),
  uniqueIndicatorName: unique('unique_classroom_competency_indicator_name').on(table.classroomCompetencyId, table.name),
}));

export const classroomCompetencyIndicatorsRelations = relations(classroomCompetencyIndicators, ({ one, many }) => ({
  classroomCompetency: one(classroomCompetencies, {
    fields: [classroomCompetencyIndicators.classroomCompetencyId],
    references: [classroomCompetencies.id],
  }),
  classroom: one(classrooms, {
    fields: [classroomCompetencyIndicators.classroomId],
    references: [classrooms.id],
  }),
  competency: one(curriculumCompetencies, {
    fields: [classroomCompetencyIndicators.competencyId],
    references: [curriculumCompetencies.id],
  }),
  createdByTeacher: one(users, {
    fields: [classroomCompetencyIndicators.createdByTeacherId],
    references: [users.id],
  }),
  behaviors: many(behaviors),
  pointLogs: many(pointLogs),
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

export const activityCompetencyIndicators = mysqlTable('activity_competency_indicators', {
  id: varchar('id', { length: 36 }).primaryKey(),
  activityType: activityTypeEnum.notNull(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  competencyIndicatorId: varchar('competency_indicator_id', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
}, (table) => ({
  activityIdx: index('idx_activity_competency_indicators_activity').on(table.activityType, table.activityId),
  indicatorIdx: index('idx_activity_competency_indicators_indicator').on(table.competencyIndicatorId),
  uniqueActivityCompetencyIndicator: unique('unique_activity_competency_indicator').on(table.activityType, table.activityId, table.competencyIndicatorId),
}));

export const activityCompetencyIndicatorsRelations = relations(activityCompetencyIndicators, ({ one }) => ({
  competency: one(curriculumCompetencies, {
    fields: [activityCompetencyIndicators.competencyId],
    references: [curriculumCompetencies.id],
  }),
  competencyIndicator: one(classroomCompetencyIndicators, {
    fields: [activityCompetencyIndicators.competencyIndicatorId],
    references: [classroomCompetencyIndicators.id],
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
  // Lo que calcula el sistema aunque haya ajuste manual (score/gradeLabel = nota efectiva).
  calculatedScore: decimal('calculated_score', { precision: 5, scale: 2 }),
  calculatedLabel: varchar('calculated_label', { length: 10 }),
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
  manualLabel: varchar('manual_label', { length: 10 }),
  manualNote: text('manual_note'), // comentario visible para el alumno
  privateNote: text('private_note'), // solo el docente
  conclusion: text('conclusion'), // conclusión descriptiva (libreta / SIAGIE)
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
// Evaluaciones propias del docente (examen, tarea...) con nota directa por alumno.
export const gradeEvaluationKinds = ['EXAM', 'TASK', 'PROJECT', 'ORAL', 'PRACTICE', 'OTHER'] as const;
export type GradeEvaluationKind = typeof gradeEvaluationKinds[number];

export const gradeEvaluations = mysqlTable('grade_evaluations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  competencyId: varchar('competency_id', { length: 36 }).notNull(),
  indicatorId: varchar('indicator_id', { length: 36 }),
  title: varchar('title', { length: 150 }).notNull(),
  kind: varchar('kind', { length: 20 }).notNull().default('OTHER'),
  evaluatedOn: date('evaluated_on', { mode: 'string' }),
  weight: tinyint('weight', { unsigned: true }).notNull().default(1),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  classroomPeriodIdx: index('idx_grade_evaluations_classroom_period').on(table.classroomId, table.period),
  competencyIdx: index('idx_grade_evaluations_competency').on(table.competencyId),
}));

export const gradeEvaluationScores = mysqlTable('grade_evaluation_scores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  evaluationId: varchar('evaluation_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(), // 0-100
  label: varchar('label', { length: 10 }).notNull(), // valor en la escala de la clase
  note: varchar('note', { length: 500 }),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  uniqueEvaluationStudent: unique('uniq_grade_evaluation_student').on(table.evaluationId, table.studentProfileId),
  studentIdx: index('idx_grade_evaluation_scores_student').on(table.studentProfileId),
}));

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
export type ActivityCompetencyIndicator = typeof activityCompetencyIndicators.$inferSelect;
export type NewActivityCompetencyIndicator = typeof activityCompetencyIndicators.$inferInsert;
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
// PACK: el sobre único de v2; WELCOME: el de bienvenida. SINGLE/PACK_5/PACK_10 quedan del historial (migrations/collectibles_v2.sql).
export const packTypeEnum = mysqlEnum('pack_type', ['SINGLE', 'PACK_5', 'PACK_10', 'PACK', 'WELCOME']);
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
  
  // Precios manuales de sobres (sin uso desde coleccionables v2: el precio sale del oro semanal de la clase)
  singlePackPrice: int('single_pack_price').notNull().default(10),
  fivePackPrice: int('five_pack_price').notNull().default(45),
  tenPackPrice: int('ten_pack_price').notNull().default(80),
  // Nivel de precio sobre la base semanal de la clase: LOW la mitad, NORMAL, HIGH el doble (migrations/collectibles_v2.sql)
  priceLevel: mysqlEnum('price_level', ['LOW', 'NORMAL', 'HIGH']).notNull().default('NORMAL'),
  
  // Recompensas por completar
  rewardXp: int('reward_xp').notNull().default(0),
  rewardHp: int('reward_hp').notNull().default(0),
  rewardGp: int('reward_gp').notNull().default(0),
  rewardBadgeId: varchar('reward_badge_id', { length: 36 }),
  
  // Configuración
  // Caja de la clase: las repetidas se donan y un compañero las toma (migrations/collectibles_box.sql).
  allowTrades: boolean('allow_trades').notNull().default(true),
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

// Figuritas del álbum
export const collectibleCards = mysqlTable('collectible_cards', {
  id: varchar('id', { length: 36 }).primaryKey(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }),
  icon: varchar('icon', { length: 50 }), // Emoji de la figurita cuando no hay imagen (migrations/add_collectible_card_icon.sql)
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

// Figuritas obtenidas por estudiantes
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

// Sobre de bienvenida: uno por alumno y álbum (migrations/collectibles_v2.sql).
export const collectibleWelcomePacks = mysqlTable('collectible_welcome_packs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  openedAt: datetime('opened_at').notNull(),
}, (table) => ({
  uniqueStudentAlbum: unique('uniq_collectible_welcome').on(table.studentProfileId, table.albumId),
  albumIdx: index('idx_collectible_welcome_album').on(table.albumId),
}));

// Caja de la clase: cada figurita donada queda aquí hasta que un compañero la toma (migrations/collectibles_box.sql).
export const collectibleBoxItems = mysqlTable('collectible_box_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  albumId: varchar('album_id', { length: 36 }).notNull(),
  cardId: varchar('card_id', { length: 36 }).notNull(),
  donorProfileId: varchar('donor_profile_id', { length: 36 }).notNull(),
  donatedAt: datetime('donated_at').notNull(),
  takerProfileId: varchar('taker_profile_id', { length: 36 }),
  takenAt: datetime('taken_at'),
}, (table) => ({
  availableIdx: index('idx_collectible_box_available').on(table.albumId, table.cardId, table.takerProfileId),
  takerIdx: index('idx_collectible_box_taker').on(table.takerProfileId, table.takenAt),
  donorIdx: index('idx_collectible_box_donor').on(table.donorProfileId),
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
export type PackType = 'SINGLE' | 'PACK_5' | 'PACK_10' | 'PACK' | 'WELCOME';
export type ImageStyle = 'CARTOON' | 'REALISTIC' | 'PIXEL_ART' | 'ANIME' | 'WATERCOLOR' | 'MINIMALIST';

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
  inviteCode: varchar('invite_code', { length: 16 }).unique('uniq_schools_invite_code'),
  /** La invitación caduca: antes servía para siempre y daba estado verificado. */
  inviteExpiresAt: datetime('invite_expires_at'),
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
  // Biblia de la historia: personajes, tono y reglas que la IA coautora usa como memoria.
  aiBible: text('ai_bible'),
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

export interface StoryRewardConfig {
  badgeId?: string | null;
  xp?: number;
  gp?: number;
  cardId?: string | null;
  // Premio al clan que más aportó: lo decide el profesor en cada capítulo.
  clanPrize?: { mode: 'NONE' | 'MENTION' | 'GP'; gp?: number };
}

export interface StoryRewardResult {
  participants: number;
  badge?: { id: string; name: string; icon: string; awarded: number };
  xp?: number;
  gp?: number;
  card?: { id: string; name: string; granted: number };
  winningClan?: { id: string; name: string; emblem: string; xp: number; prizeGp: number; members: number } | null;
  errors?: string[];
}

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
  // Recompensa al revelar: la reciben quienes ganaron XP durante el capítulo.
  rewardConfig: json('reward_config').$type<StoryRewardConfig>(),
  // Lo entregado al revelar (cierre celebrado y auditoría).
  rewardResult: json('reward_result').$type<StoryRewardResult>(),
  currentProgress: decimal('current_progress', { precision: 12, scale: 2 }).notNull().default('0'),
  // XP de la clase al activarse el capítulo (meta relativa). NULL = capítulo anterior a la migración (cuenta desde 0).
  progressBaseline: decimal('progress_baseline', { precision: 12, scale: 2 }),
  activatedAt: datetime('activated_at'),
  // Meta alcanzada: el capítulo sigue ACTIVE hasta que el profesor revela el final.
  goalReachedAt: datetime('goal_reached_at'),
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

export interface StoryDecisionDialogue { speaker?: string; text: string; emotion?: string }
export interface StoryDecision {
  question: string;
  options: { id: string; label: string; outcome: StoryDecisionDialogue[] }[];
  status: 'OPEN' | 'CLOSED';
  winnerOptionId?: string | null;
  closedAt?: string | null;
}

export const storyVotes = mysqlTable('story_votes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sceneId: varchar('scene_id', { length: 36 }).notNull(),
  optionId: varchar('option_id', { length: 36 }).notNull(),
  studentProfileId: varchar('student_profile_id', { length: 36 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  sceneIdx: index('idx_story_votes_scene').on(table.sceneId),
  uniqueVote: unique('uniq_story_votes_scene_student').on(table.sceneId, table.studentProfileId),
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
  // Escena de decisión: la clase vota una opción y el profesor cierra la votación.
  decision: json('decision').$type<StoryDecision>(),
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

// announcements y announcement_reads: tablas sin uso desde la sala de familias (migraciones/family_room.sql).
// Se borrarán en una migración posterior; ya no tienen definición aquí para que nadie las use.

// ==================== SALA DE FAMILIAS (DOCENTE ↔ FAMILIAS) ====================

export const chatSenderRoleEnum = mysqlEnum('sender_role', ['TEACHER', 'PARENT']);

export const classroomMessages = mysqlTable('classroom_messages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  senderId: varchar('sender_id', { length: 36 }).notNull(),
  senderRole: chatSenderRoleEnum.notNull(),
  // Un aviso es un mensaje destacado del docente (notifica a las familias y lleva «visto por»).
  kind: mysqlEnum('kind', ['MESSAGE', 'ANNOUNCEMENT']).notNull().default('MESSAGE'),
  message: text('message').notNull(),
  deletedAt: datetime('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 36 }),
  // Con milisegundos: ordena y pagina sin perder los mensajes del mismo segundo (el id desempata).
  createdAt: datetime('created_at', { fsp: 3 }).notNull(),
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

// isOpen = las familias pueden escribir. Sin fila = cerrada: la sala empieza como tablón de avisos.
export const classroomChatSettings = mysqlTable('classroom_chat_settings', {
  classroomId: varchar('classroom_id', { length: 36 }).primaryKey(),
  isOpen: boolean('is_open').notNull().default(false),
  closedAt: datetime('closed_at'),
  closedBy: varchar('closed_by', { length: 36 }),
});

// Hasta dónde leyó cada persona la sala de una clase: «visto» de los avisos y mensajes sin leer.
export const classroomRoomReads = mysqlTable('classroom_room_reads', {
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  lastReadAt: datetime('last_read_at', { fsp: 3 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.classroomId, table.userId] }),
}));

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

// ─── Notas de Clase ──────────────────────────────────────────────────
export const classNotes = mysqlTable('class_notes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  classroomId: varchar('classroom_id', { length: 36 }).notNull(),
  teacherId: varchar('teacher_id', { length: 36 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 20 }).notNull().default('other'),
  isCompleted: boolean('is_completed').notNull().default(false),
  dueDate: datetime('due_date'),
  createdAt: datetime('created_at').notNull(),
  completedAt: datetime('completed_at'),
}, (table) => ({
  classroomIdx: index('idx_class_notes_classroom').on(table.classroomId),
  classroomCompletedIdx: index('idx_class_notes_classroom_completed').on(table.classroomId, table.isCompleted),
}));

export const classNotesRelations = relations(classNotes, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classNotes.classroomId],
    references: [classrooms.id],
  }),
  teacher: one(users, {
    fields: [classNotes.teacherId],
    references: [users.id],
  }),
}));

export type ClassNote = typeof classNotes.$inferSelect;
export type NewClassNote = typeof classNotes.$inferInsert;
