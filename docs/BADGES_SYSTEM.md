# 🏆 Sistema de Insignias (Badges) - Juried

## Visión General

Las insignias son logros desbloqueables que premian comportamientos positivos, hitos y participación. Aumentan el engagement y dan objetivos claros a los estudiantes.

---

## 1. Tipos de Insignias

### Por Categoría

| Categoría | Descripción | Ejemplos |
|-----------|-------------|----------|
| **Progreso** | Hitos de XP y niveles | "Primer nivel", "Centurión (100 XP)" |
| **Participación** | Actividad constante | "Racha de 5 días", "Madrugador" |
| **Social** | Interacción con compañeros | "Buen compañero", "Mentor" |
| **Tienda** | Uso de la tienda | "Primera compra", "Coleccionista" |
| **Especiales** | Eventos y temporadas | "Fundador", "Halloween 2024" |
| **Secretas** | Ocultas hasta desbloquear | "???" → "Leyenda" |

### Por Rareza

| Rareza | Color | Dificultad |
|--------|-------|------------|
| **Común** | Gris | Fácil de obtener |
| **Raro** | Azul | Requiere esfuerzo |
| **Épico** | Púrpura | Difícil |
| **Legendario** | Dorado | Muy difícil |

---

## 2. Estructura de Base de Datos

### Tabla: `badges` (Definición de insignias)

```sql
CREATE TABLE badges (
  id VARCHAR(36) PRIMARY KEY,
  
  -- Scope: Sistema (global) o Clase (creada por profesor)
  scope ENUM('SYSTEM', 'CLASSROOM') NOT NULL DEFAULT 'SYSTEM',
  classroom_id VARCHAR(36) NULL,       -- NULL si es del sistema
  created_by VARCHAR(36) NULL,         -- ID del profesor que la creó
  
  -- Información básica
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL,           -- Emoji o nombre de icono
  category ENUM('PROGRESS', 'PARTICIPATION', 'SOCIAL', 'SHOP', 'SPECIAL', 'SECRET', 'CUSTOM') NOT NULL,
  rarity ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') DEFAULT 'COMMON',
  
  -- Modo de asignación
  assignment_mode ENUM('AUTOMATIC', 'MANUAL', 'BOTH') DEFAULT 'AUTOMATIC',
  /*
    AUTOMATIC: Se otorga automáticamente al cumplir condición
    MANUAL: Solo el profesor puede otorgarla
    BOTH: Automática pero profesor también puede darla manualmente
  */
  
  -- Condiciones de desbloqueo (NULL si es solo manual)
  unlock_condition JSON NULL,
  /*
    Ejemplos de condiciones:
    
    -- Basadas en XP/Nivel
    { "type": "XP_TOTAL", "value": 100 }
    { "type": "LEVEL", "value": 5 }
    
    -- Basadas en comportamientos del profesor
    { "type": "BEHAVIOR_COUNT", "behaviorId": "uuid-123", "count": 5 }
    { "type": "BEHAVIOR_CATEGORY", "category": "positive", "count": 10 }
    { "type": "ANY_BEHAVIOR", "count": 20 }
    
    -- Basadas en tiempo/racha
    { "type": "STREAK_DAYS", "value": 7 }
    { "type": "TIME_RANGE", "start": "06:00", "end": "08:00" }
    
    -- Basadas en tienda
    { "type": "PURCHASES", "value": 1 }
    { "type": "GP_SPENT", "value": 500 }
    
    -- Condiciones compuestas (AND)
    { 
      "type": "COMPOUND", 
      "operator": "AND",
      "conditions": [
        { "type": "LEVEL", "value": 5 },
        { "type": "BEHAVIOR_COUNT", "behaviorId": "uuid", "count": 3 }
      ]
    }
  */
  
  -- Recompensa opcional al desbloquear
  reward_xp INT DEFAULT 0,
  reward_gp INT DEFAULT 0,
  
  -- Límites
  max_awards INT NULL,                 -- NULL = ilimitado, 1 = solo una vez
  
  -- Metadata
  is_secret BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_scope (scope),
  INDEX idx_classroom (classroom_id),
  INDEX idx_category (category)
);
```

### Tabla: `student_badges` (Insignias desbloqueadas)

```sql
CREATE TABLE student_badges (
  id VARCHAR(36) PRIMARY KEY,
  student_profile_id VARCHAR(36) NOT NULL,
  badge_id VARCHAR(36) NOT NULL,
  unlocked_at DATETIME NOT NULL,
  awarded_by VARCHAR(36) NULL,         -- NULL si fue automática, ID del profesor si fue manual
  award_reason VARCHAR(255) NULL,      -- Razón opcional cuando es manual
  is_displayed BOOLEAN DEFAULT FALSE,  -- Mostrar en perfil
  
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_student_badge (student_profile_id, badge_id)
);
```

### Tabla: `badge_progress` (Progreso hacia insignias)

```sql
CREATE TABLE badge_progress (
  id VARCHAR(36) PRIMARY KEY,
  student_profile_id VARCHAR(36) NOT NULL,
  badge_id VARCHAR(36) NOT NULL,
  current_value INT DEFAULT 0,
  target_value INT NOT NULL,
  last_updated DATETIME NOT NULL,
  
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE KEY unique_progress (student_profile_id, badge_id)
);
```

---

## 3. Insignias del Profesor (Custom)

### Flujo de Creación

El profesor puede crear insignias personalizadas para su clase:

```
┌─────────────────────────────────────────────────────────────┐
│  Crear Nueva Insignia                                    ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Icono: [🏆 ▼]     Nombre: [Lector del Mes________]        │
│                                                             │
│  Descripción: [Completar 5 libros en el mes_______]        │
│                                                             │
│  Rareza: ○ Común  ● Raro  ○ Épico  ○ Legendario            │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Modo de asignación:                                        │
│                                                             │
│  ○ Solo manual (yo decido cuándo darla)                    │
│  ● Automática (se da al cumplir condición)                 │
│  ○ Ambas (automática + puedo darla manualmente)            │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Condición de desbloqueo:                                   │
│                                                             │
│  Tipo: [Comportamiento específico ▼]                        │
│                                                             │
│  Comportamiento: [📚 Lectura completada ▼]                  │
│  Cantidad requerida: [5]                                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Recompensa al desbloquear (opcional):                      │
│                                                             │
│  XP: [50]    GP: [25]                                       │
│                                                             │
│              [Cancelar]  [Crear Insignia]                   │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Condiciones Disponibles para el Profesor

| Tipo | Descripción | Ejemplo UI |
|------|-------------|------------|
| **Sin condición** | Solo manual | "Darla cuando yo quiera" |
| **Comportamiento específico** | X veces un comportamiento | "5 veces 'Tarea entregada'" |
| **Cualquier comportamiento positivo** | X comportamientos positivos | "10 comportamientos positivos" |
| **Cualquier comportamiento negativo** | X comportamientos negativos | "0 negativos en 1 semana" |
| **Nivel alcanzado** | Llegar a nivel X | "Alcanzar nivel 10" |
| **XP acumulado** | Acumular X XP | "Acumular 500 XP" |
| **Compras realizadas** | X compras en tienda | "Realizar 3 compras" |
| **Racha de días** | X días consecutivos activo | "7 días seguidos" |
| **Combinación** | Varias condiciones AND | "Nivel 5 + 3 tareas" |

### Ejemplos de Insignias Personalizadas

```typescript
// Insignia solo manual
{
  name: "Estudiante del Mes",
  scope: "CLASSROOM",
  assignment_mode: "MANUAL",
  unlock_condition: null,  // Sin condición automática
  rarity: "EPIC"
}

// Insignia automática basada en comportamiento
{
  name: "Lector Ávido",
  scope: "CLASSROOM", 
  assignment_mode: "AUTOMATIC",
  unlock_condition: {
    type: "BEHAVIOR_COUNT",
    behaviorId: "uuid-lectura-completada",
    count: 10
  },
  reward_xp: 50,
  rarity: "RARE"
}

// Insignia con condición compuesta
{
  name: "Estudiante Ejemplar",
  scope: "CLASSROOM",
  assignment_mode: "AUTOMATIC",
  unlock_condition: {
    type: "COMPOUND",
    operator: "AND",
    conditions: [
      { type: "LEVEL", value: 5 },
      { type: "BEHAVIOR_CATEGORY", category: "positive", count: 20 },
      { type: "BEHAVIOR_CATEGORY", category: "negative", count: 0, period: "30d" }
    ]
  },
  rarity: "LEGENDARY"
}
```

### UI para Otorgar Insignia Manualmente

```
┌─────────────────────────────────────────────────────────────┐
│  Otorgar Insignia a Juan Pérez                           ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Selecciona una insignia:                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏆 Estudiante del Mes          [ÉPICO]    [Otorgar] │   │
│  │    Solo puede darse manualmente                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⭐ Participación Destacada     [RARO]     [Otorgar] │   │
│  │    También se puede ganar automáticamente           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📚 Lector Ávido                [RARO]     ✓ Tiene   │   │
│  │    Ya desbloqueada el 15/11/2024                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Razón (opcional): [Por su excelente presentación___]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Insignias Predefinidas

### Progreso
| ID | Nombre | Condición | Rareza |
|----|--------|-----------|--------|
| `first_xp` | Primer Paso | Ganar 1 XP | Común |
| `centurion` | Centurión | Acumular 100 XP | Común |
| `xp_500` | Aventurero | Acumular 500 XP | Raro |
| `xp_1000` | Héroe | Acumular 1000 XP | Épico |
| `xp_5000` | Leyenda | Acumular 5000 XP | Legendario |
| `level_5` | Aprendiz | Alcanzar nivel 5 | Común |
| `level_10` | Experto | Alcanzar nivel 10 | Raro |
| `level_20` | Maestro | Alcanzar nivel 20 | Épico |

### Participación
| ID | Nombre | Condición | Rareza |
|----|--------|-----------|--------|
| `streak_3` | Constante | Racha de 3 días | Común |
| `streak_7` | Dedicado | Racha de 7 días | Raro |
| `streak_30` | Imparable | Racha de 30 días | Legendario |
| `early_bird` | Madrugador | Actividad antes de 8am | Raro |
| `night_owl` | Noctámbulo | Actividad después de 10pm | Raro |

### Tienda
| ID | Nombre | Condición | Rareza |
|----|--------|-----------|--------|
| `first_purchase` | Comprador | Primera compra | Común |
| `big_spender` | Derrochador | Gastar 500 GP | Raro |
| `collector` | Coleccionista | 10 compras diferentes | Épico |

### Social
| ID | Nombre | Condición | Rareza |
|----|--------|-----------|--------|
| `team_player` | Jugador de Equipo | Participar en batalla grupal | Común |
| `helper` | Ayudante | Usar poder de clase 5 veces | Raro |

### Especiales
| ID | Nombre | Condición | Rareza |
|----|--------|-----------|--------|
| `founder` | Fundador | Unirse en el primer mes | Legendario |
| `perfect_hp` | Intocable | Mantener HP al 100% por 7 días | Épico |

---

## 5. Arquitectura Backend

### Servicio de Insignias

```typescript
// server/src/services/badge.service.ts

class BadgeService {
  
  // ═══════════════════════════════════════════════════════════
  // CRUD de Insignias (para profesores)
  // ═══════════════════════════════════════════════════════════
  
  async createBadge(data: CreateBadgeDto, teacherId: string): Promise<Badge> {
    return await db.insert(badges).values({
      id: uuid(),
      scope: 'CLASSROOM',
      classroomId: data.classroomId,
      createdBy: teacherId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      category: 'CUSTOM',
      rarity: data.rarity,
      assignmentMode: data.assignmentMode,
      unlockCondition: data.condition || null,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      maxAwards: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  
  async getClassroomBadges(classroomId: string): Promise<Badge[]> {
    // Retorna insignias del sistema + insignias de la clase
    return await db.select().from(badges).where(
      or(
        eq(badges.scope, 'SYSTEM'),
        eq(badges.classroomId, classroomId)
      )
    );
  }
  
  // ═══════════════════════════════════════════════════════════
  // Otorgar Insignias
  // ═══════════════════════════════════════════════════════════
  
  // Otorgar manualmente (profesor)
  async awardBadgeManually(
    studentId: string, 
    badgeId: string, 
    teacherId: string,
    reason?: string
  ): Promise<StudentBadge> {
    const badge = await this.getBadgeById(badgeId);
    
    // Verificar que permite asignación manual
    if (badge.assignmentMode === 'AUTOMATIC') {
      throw new Error('Esta insignia solo se puede obtener automáticamente');
    }
    
    // Verificar si ya la tiene
    const existing = await this.getStudentBadge(studentId, badgeId);
    if (existing) {
      throw new Error('El estudiante ya tiene esta insignia');
    }
    
    // Otorgar
    const awarded = await db.insert(studentBadges).values({
      id: uuid(),
      studentProfileId: studentId,
      badgeId: badgeId,
      unlockedAt: new Date(),
      awardedBy: teacherId,
      awardReason: reason,
    });
    
    // Dar recompensa si tiene
    if (badge.rewardXp > 0 || badge.rewardGp > 0) {
      await this.giveReward(studentId, badge.rewardXp, badge.rewardGp);
    }
    
    return awarded;
  }
  
  // Verificar y otorgar automáticamente
  async checkAndAwardBadges(studentId: string, event: BadgeEvent): Promise<Badge[]> {
    const unlockedBadges: Badge[] = [];
    
    // Obtener insignias automáticas no desbloqueadas
    const pendingBadges = await this.getPendingAutomaticBadges(studentId);
    
    for (const badge of pendingBadges) {
      if (await this.checkCondition(studentId, badge, event)) {
        await this.awardBadgeAutomatic(studentId, badge.id);
        unlockedBadges.push(badge);
      }
    }
    
    return unlockedBadges;
  }
  
  // ═══════════════════════════════════════════════════════════
  // Verificación de Condiciones
  // ═══════════════════════════════════════════════════════════
  
  private async checkCondition(
    studentId: string, 
    badge: Badge, 
    event: BadgeEvent
  ): Promise<boolean> {
    const condition = badge.unlockCondition;
    if (!condition) return false;
    
    switch (condition.type) {
      case 'XP_TOTAL':
        return event.data.totalXp >= condition.value;
        
      case 'LEVEL':
        return event.data.level >= condition.value;
        
      case 'BEHAVIOR_COUNT':
        // Contar veces que recibió ese comportamiento específico
        const behaviorCount = await this.countBehaviorApplications(
          studentId, 
          condition.behaviorId
        );
        return behaviorCount >= condition.count;
        
      case 'BEHAVIOR_CATEGORY':
        // Contar comportamientos positivos o negativos
        const categoryCount = await this.countBehaviorsByCategory(
          studentId,
          condition.category,
          condition.period // opcional: "7d", "30d", etc.
        );
        return categoryCount >= condition.count;
        
      case 'ANY_BEHAVIOR':
        const totalBehaviors = await this.countAllBehaviors(studentId);
        return totalBehaviors >= condition.count;
        
      case 'PURCHASES':
        return event.data.totalPurchases >= condition.value;
        
      case 'STREAK_DAYS':
        const streak = await this.getLoginStreak(studentId);
        return streak >= condition.value;
        
      case 'COMPOUND':
        // Verificar todas las condiciones (AND)
        for (const subCondition of condition.conditions) {
          const subBadge = { ...badge, unlockCondition: subCondition };
          if (!await this.checkCondition(studentId, subBadge, event)) {
            return false;
          }
        }
        return true;
        
      default:
        return false;
    }
  }
}
```

### Eventos que Disparan Verificación

```typescript
// Después de dar puntos
await badgeService.checkAndAwardBadges(studentId, {
  type: 'POINTS_ADDED',
  data: { pointType: 'XP', amount: 10, totalXp: 150 }
});

// Después de subir de nivel
await badgeService.checkAndAwardBadges(studentId, {
  type: 'LEVEL_UP',
  data: { newLevel: 5 }
});

// Después de comprar
await badgeService.checkAndAwardBadges(studentId, {
  type: 'PURCHASE_MADE',
  data: { itemId: '...', totalPurchases: 3 }
});
```

---

## 5. Arquitectura Frontend

### Componentes

```
components/badges/
├── BadgeCard.tsx          # Tarjeta individual de insignia
├── BadgeGrid.tsx          # Grid de insignias
├── BadgeUnlockModal.tsx   # Modal de celebración al desbloquear
├── BadgeProgress.tsx      # Barra de progreso hacia insignia
└── BadgeShowcase.tsx      # Insignias destacadas en perfil
```

### Store (Zustand)

```typescript
// store/badgeStore.ts
interface BadgeState {
  unlockedBadges: Badge[];
  pendingBadges: Badge[];  // Con progreso
  newlyUnlocked: Badge[];  // Para mostrar animación
  
  fetchBadges: (studentId: string) => Promise<void>;
  showUnlockAnimation: (badge: Badge) => void;
  dismissUnlockAnimation: () => void;
}
```

---

## 6. Flujo de Usuario

### Estudiante
1. Ve sus insignias en su perfil/dashboard
2. Ve progreso hacia insignias no desbloqueadas
3. Recibe notificación animada al desbloquear
4. Puede elegir 3 insignias para mostrar en su perfil

### Profesor
1. Ve insignias de cada estudiante
2. Puede otorgar insignias especiales manualmente
3. Ve estadísticas de insignias de la clase

---

## 7. Notificaciones

### Al Desbloquear
- Modal con animación de celebración
- Sonido opcional
- Confetti para insignias épicas/legendarias
- Notificación push (si está habilitado)

### Progreso
- Toast cuando está cerca de desbloquear (80%+)
- "¡Solo te faltan 20 XP para 'Centurión'!"

---

## 8. Plan de Implementación

### Fase 1: Base (2-3 días) ✅
- [x] Crear tablas en BD (`badges`, `student_badges`, `badge_progress`)
- [x] Crear schema Drizzle
- [x] Servicio básico de insignias (`badge.service.ts`)
- [x] Rutas API CRUD (`badge.routes.ts`)

### Fase 2: Lógica (2-3 días) ✅
- [x] Sistema de verificación de condiciones (XP, nivel, comportamientos)
- [x] Integrar con eventos existentes (puntos, compras, etc.)
- [ ] Insignias predefinidas del sistema

### Fase 3: Frontend (3-4 días) ✅
- [x] Componentes de UI (`BadgeCard.tsx`)
- [x] Modal de desbloqueo con animación y confetti (`BadgeUnlockModal.tsx`)
- [x] Sección en perfil del estudiante (`StudentDashboard.tsx`)
- [x] Vista para profesor (`BadgesPage.tsx`)
- [x] Menú lateral actualizado
- [x] Botón "Dar insignia" en lista de estudiantes (`StudentsPage.tsx`)

### Fase 4: Pulido (1-2 días)
- [ ] Notificaciones en tiempo real
- [ ] Sonidos y efectos
- [ ] Testing

---

## 9. Consideraciones

### Rendimiento
- Cachear insignias desbloqueadas
- Verificar solo insignias relevantes al evento
- Batch updates para progreso

### Escalabilidad
- Condiciones en JSON permiten agregar tipos sin migrar
- Insignias por clase/temporada

### Gamificación
- Balance: No muy fáciles ni imposibles
- Variedad: Diferentes formas de obtenerlas
- Sorpresa: Insignias secretas mantienen interés
