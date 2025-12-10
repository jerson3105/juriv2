# 🎓 Plan de Onboarding - Juried

## Objetivo
Guiar a los nuevos profesores a través de las funcionalidades principales de Juried para que puedan comenzar a usar la plataforma de manera efectiva.

---

## 📋 Estructura del Onboarding

### Fase 1: Bienvenida (Primera vez que inicia sesión)
```
┌─────────────────────────────────────────────────────────────┐
│  🎉 ¡Bienvenido a Juried!                                   │
│                                                             │
│  Juried es tu aliado para gamificar el aula.               │
│  Te guiaremos paso a paso para que comiences.              │
│                                                             │
│  [Comenzar Tour] [Saltar por ahora]                        │
└─────────────────────────────────────────────────────────────┘
```

### Fase 2: Tour Guiado (5-7 pasos)

#### Paso 1: Crear tu primera clase
- **Elemento destacado**: Botón "Nueva Clase"
- **Mensaje**: "Comienza creando tu primera clase. Asígnale un nombre y personaliza las opciones de gamificación."
- **Acción**: El usuario crea una clase

#### Paso 2: Configurar comportamientos
- **Elemento destacado**: Menú "Gamificación > Comportamientos"
- **Mensaje**: "Define los comportamientos positivos y negativos que quieres reforzar. Cada uno otorga o resta puntos."
- **Ejemplo**: Mostrar comportamientos predefinidos

#### Paso 3: Agregar estudiantes
- **Elemento destacado**: Código de clase
- **Mensaje**: "Comparte este código con tus estudiantes para que se unan. Ellos crearán su personaje al registrarse."
- **Acción**: Copiar código

#### Paso 4: Gestionar puntos
- **Elemento destacado**: Lista de estudiantes con checkboxes
- **Mensaje**: "Selecciona uno o más estudiantes y asigna puntos positivos o negativos según su comportamiento."
- **Demo**: Animación de selección y asignación

#### Paso 5: Tienda de recompensas
- **Elemento destacado**: Menú "Gamificación > Tienda"
- **Mensaje**: "Crea recompensas que tus estudiantes pueden comprar con sus Gold Points (GP)."
- **Ejemplos**: "Tarea extra", "Asiento preferido", "Día sin uniforme"

#### Paso 6: Panel de seguimiento
- **Elemento destacado**: Dashboard de clase
- **Mensaje**: "Aquí puedes ver el progreso de tus estudiantes, alertas de HP bajo y estadísticas generales."

#### Paso 7: ¡Listo!
- **Mensaje**: "¡Felicidades! Ya conoces lo básico de Juried. Explora más funciones como actividades aleatorias, asistencia y el historial."
- **Acciones**: [Ver documentación] [Comenzar a usar]

---

## 🛠️ Implementación Técnica

### Componentes necesarios

```
src/
├── components/
│   └── onboarding/
│       ├── OnboardingProvider.tsx    # Context para estado del onboarding
│       ├── OnboardingModal.tsx       # Modal de bienvenida inicial
│       ├── OnboardingTooltip.tsx     # Tooltip que destaca elementos
│       ├── OnboardingProgress.tsx    # Indicador de progreso (1/7)
│       └── OnboardingOverlay.tsx     # Overlay oscuro con spotlight
│
├── hooks/
│   └── useOnboarding.ts              # Hook para controlar el tour
│
└── store/
    └── onboardingStore.ts            # Estado persistente (completado, paso actual)
```

### Estado del Onboarding (Zustand + persist)

```typescript
interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  isActive: boolean;
  
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void; // Para testing
}
```

### Definición de pasos

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;      // CSS selector del elemento a destacar
  placement: 'top' | 'bottom' | 'left' | 'right';
  route?: string;              // Ruta donde debe estar el usuario
  action?: 'click' | 'input';  // Acción esperada
  nextOnAction?: boolean;      // Avanzar automáticamente al completar acción
}
```

### Flujo de activación

```
1. Usuario se registra/inicia sesión
2. Verificar `hasCompletedOnboarding` en store
3. Si es false:
   a. Mostrar modal de bienvenida
   b. Si acepta → Iniciar tour
   c. Si rechaza → Marcar como visto, mostrar botón "?" para reiniciar
4. Durante el tour:
   a. Navegar a la ruta del paso actual
   b. Mostrar overlay con spotlight en elemento
   c. Mostrar tooltip con instrucciones
   d. Esperar acción o click en "Siguiente"
5. Al completar → Marcar `hasCompletedOnboarding = true`
```

---

## 🎨 Diseño Visual

### Tooltip de onboarding
```
┌────────────────────────────────────────┐
│ 📍 Paso 2 de 7                         │
├────────────────────────────────────────┤
│ Configurar Comportamientos             │
│                                        │
│ Define los comportamientos que         │
│ quieres reforzar en tu clase.          │
│ Cada uno otorga o resta puntos.        │
│                                        │
│ [← Anterior]  [Siguiente →]  [Saltar]  │
└────────────────────────────────────────┘
        ▼ (flecha apuntando al elemento)
```

### Overlay con spotlight
- Fondo oscuro semi-transparente (bg-black/60)
- Área del elemento destacado sin oscurecer (spotlight)
- Transición suave entre pasos
- Z-index alto para estar sobre todo

---

## 📱 Consideraciones Responsive

- En móvil, el tooltip se posiciona arriba o abajo (nunca a los lados)
- El spotlight se ajusta al tamaño del elemento
- Los botones de navegación son más grandes para touch
- Opción de "Ver después" más prominente en móvil

---

## 🔄 Triggers adicionales

### Mostrar ayuda contextual cuando:
1. El usuario crea su primera clase → Sugerir agregar comportamientos
2. El primer estudiante se une → Mostrar cómo asignar puntos
3. Un estudiante tiene HP bajo → Explicar el sistema de HP
4. Primera compra en tienda → Explicar flujo de aprobación

### Botón de ayuda permanente
- Icono "?" en el header
- Al hacer click: "¿Quieres repetir el tour?" o "Ver documentación"

---

## 📊 Métricas a trackear

1. % de usuarios que completan el onboarding
2. Paso donde más usuarios abandonan
3. Tiempo promedio para completar
4. Usuarios que repiten el tour

---

## 🚀 Prioridad de implementación

1. **MVP (Fase 1)**
   - Modal de bienvenida
   - Store de estado
   - 3-4 pasos básicos (crear clase, agregar estudiantes, asignar puntos)

2. **Fase 2**
   - Tour completo (7 pasos)
   - Overlay con spotlight
   - Navegación entre pasos

3. **Fase 3**
   - Ayuda contextual
   - Métricas
   - Tooltips de funciones avanzadas
