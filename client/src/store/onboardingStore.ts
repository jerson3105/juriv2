import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Definición de un paso del onboarding
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;      // CSS selector del elemento a destacar
  placement: 'top' | 'bottom' | 'left' | 'right';
  route?: string;              // Ruta donde debe estar el usuario
  action?: 'click' | 'input';  // Acción esperada
  nextOnAction?: boolean;      // Avanzar automáticamente al completar acción
  icon?: string;               // Emoji o icono
  requiresAction?: boolean;    // Si requiere que el usuario haga clic en el elemento
}

// Onboarding Fase 1: Crear primera clase (Dashboard principal)
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Juried!',
    description: 'Vamos a crear tu primera clase gamificada. Solo tomará unos segundos.',
    targetSelector: '',
    placement: 'bottom',
    icon: '🎉',
    requiresAction: false,
  },
  {
    id: 'go-to-classes',
    title: 'Ir a Mis Clases',
    description: 'Haz clic aquí para ir a la sección donde crearás tu primera clase.',
    targetSelector: '[data-onboarding="nav-classrooms"]',
    placement: 'bottom',
    icon: '📚',
    requiresAction: true,
  },
  {
    id: 'create-class-button',
    title: 'Crear Nueva Clase',
    description: 'Haz clic en el botón "Nueva Clase" y completa el formulario para crear tu primera clase.',
    targetSelector: '[data-onboarding="create-class-btn"]',
    placement: 'left',
    icon: '➕',
    requiresAction: true,
  },
  {
    id: 'complete',
    title: '¡Clase creada!',
    description: '¡Excelente! Esta es tu primera clase. Comparte el código con tus estudiantes para que se unan. Haz clic en ella para explorar las opciones de gamificación.',
    targetSelector: '[data-onboarding="first-class"]',
    placement: 'right',
    icon: '🎊',
    requiresAction: false,
  },
];

// Onboarding Fase 2: Tour dentro de la clase
export const CLASSROOM_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'classroom-welcome',
    title: '¡Bienvenido a tu clase!',
    description: 'Vamos a aprender cómo asignar puntos a tus estudiantes.',
    targetSelector: '',
    placement: 'bottom',
    icon: '🎓',
    requiresAction: false,
  },
  {
    id: 'students-menu',
    title: 'Menú de Estudiantes',
    description: 'Desde aquí accedes a la lista de estudiantes.',
    targetSelector: '[data-onboarding="students-menu"]',
    placement: 'right',
    icon: '👥',
    requiresAction: false,
  },
  {
    id: 'students-list',
    title: 'Lista de Estudiantes',
    description: 'Haz clic en "Lista" para ver tus estudiantes.',
    targetSelector: '[data-onboarding="students-list"]',
    placement: 'right',
    icon: '📋',
    requiresAction: true,
  },
  {
    id: 'select-student',
    title: 'Seleccionar Estudiante',
    description: 'Haz clic en la tarjeta del estudiante para seleccionarlo.',
    targetSelector: '[data-onboarding="student-card"]',
    placement: 'right',
    icon: '👆',
    requiresAction: true,
  },
  {
    id: 'give-points-btn',
    title: 'Dar Puntos',
    description: 'Ahora haz clic en "Dar Puntos" para abrir el modal de asignación.',
    targetSelector: '[data-onboarding="give-points-btn"]',
    placement: 'bottom',
    icon: '⭐',
    requiresAction: true,
  },
  {
    id: 'modal-tabs',
    title: 'Opciones de Puntos',
    description: 'Tienes dos formas de dar puntos: Comportamientos (usa acciones predefinidas) o Manual (puntos personalizados). Haz clic en "Manual" para continuar.',
    targetSelector: '[data-onboarding="manual-tab-btn"]',
    placement: 'bottom',
    icon: '📋',
    requiresAction: true,
  },
  {
    id: 'manual-form',
    title: 'Completa el Formulario',
    description: 'Ahora completa los campos: elige el tipo de punto (XP, HP o GP), la cantidad y escribe una razón. Luego haz clic en el botón verde para otorgar los puntos.',
    targetSelector: '[data-onboarding="manual-section"]',
    placement: 'left',
    icon: '✏️',
    requiresAction: false,
  },
  {
    id: 'classroom-complete',
    title: '¡Tour Completado!',
    description: '¡Excelente! Ya sabes cómo asignar puntos manualmente. Explora "Comportamientos" en el menú para crear acciones predefinidas y agilizar el proceso.',
    targetSelector: '',
    placement: 'bottom',
    icon: '🎉',
    requiresAction: false,
  },
];

interface OnboardingState {
  // Estado
  hasCompletedOnboarding: boolean;
  hasSeenWelcome: boolean;
  currentStep: number;
  isActive: boolean;
  
  // Acciones
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  dismissWelcome: () => void;
  
  // Helpers
  getCurrentStep: () => OnboardingStep;
  getTotalSteps: () => number;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      hasCompletedOnboarding: false,
      hasSeenWelcome: false,
      currentStep: 0,
      isActive: false,
      
      // Iniciar el tour
      startOnboarding: () => set({ 
        isActive: true, 
        currentStep: 0,
        hasSeenWelcome: true,
      }),
      
      // Siguiente paso
      nextStep: () => {
        const { currentStep } = get();
        const totalSteps = ONBOARDING_STEPS.length;
        
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          // Último paso, completar
          get().completeOnboarding();
        }
      },
      
      // Paso anterior
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },
      
      // Ir a un paso específico
      goToStep: (step: number) => {
        if (step >= 0 && step < ONBOARDING_STEPS.length) {
          set({ currentStep: step });
        }
      },
      
      // Saltar el onboarding
      skipOnboarding: () => set({ 
        isActive: false, 
        hasSeenWelcome: true,
        hasCompletedOnboarding: false, // No lo marcamos como completado, solo como visto
      }),
      
      // Completar el onboarding
      completeOnboarding: () => set({ 
        isActive: false, 
        hasCompletedOnboarding: true,
        hasSeenWelcome: true,
      }),
      
      // Resetear (para testing o repetir tour)
      resetOnboarding: () => set({ 
        hasCompletedOnboarding: false, 
        hasSeenWelcome: false,
        currentStep: 0, 
        isActive: false,
      }),
      
      // Marcar bienvenida como vista sin iniciar tour
      dismissWelcome: () => set({
        hasSeenWelcome: true,
      }),
      
      // Helpers
      getCurrentStep: () => ONBOARDING_STEPS[get().currentStep],
      getTotalSteps: () => ONBOARDING_STEPS.length,
      isFirstStep: () => get().currentStep === 0,
      isLastStep: () => get().currentStep === ONBOARDING_STEPS.length - 1,
    }),
    {
      name: 'juried-onboarding',
    }
  )
);
