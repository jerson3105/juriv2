import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CLASSROOM_ONBOARDING_STEPS, type OnboardingStep } from './onboardingStore';

interface ClassroomOnboardingState {
  // Estado
  completedClassrooms: string[]; // IDs de clases donde ya se completó el tour
  currentStep: number;
  isActive: boolean;
  showWelcome: boolean; // Mostrar modal de bienvenida
  currentClassroomId: string | null;
  hasDemoStudent: boolean;
  
  // Acciones
  openWelcomeModal: (classroomId: string) => void;
  startClassroomOnboarding: (classroomId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  setHasDemoStudent: (has: boolean) => void;
  hasCompletedForClassroom: (classroomId: string) => boolean;
  resetForClassroom: (classroomId: string) => void;
  
  // Helpers
  getCurrentStep: () => OnboardingStep;
  getTotalSteps: () => number;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
}

export const useClassroomOnboardingStore = create<ClassroomOnboardingState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      completedClassrooms: [],
      currentStep: 0,
      isActive: false,
      showWelcome: false,
      currentClassroomId: null,
      hasDemoStudent: false,
      
      // Abrir modal de bienvenida (desde botón ?)
      openWelcomeModal: (classroomId: string) => set({
        showWelcome: true,
        currentClassroomId: classroomId,
        isActive: false,
      }),
      
      // Iniciar el tour de clase (desde el modal)
      startClassroomOnboarding: (classroomId: string) => set({ 
        isActive: true, 
        showWelcome: false,
        currentStep: 0,
        currentClassroomId: classroomId,
      }),
      
      // Siguiente paso
      nextStep: () => {
        const { currentStep } = get();
        const totalSteps = CLASSROOM_ONBOARDING_STEPS.length;
        
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
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
      
      // Saltar el onboarding
      skipOnboarding: () => {
        const { currentClassroomId, completedClassrooms } = get();
        set({ 
          isActive: false,
          showWelcome: false,
          currentStep: 0,
          // Marcar como completado para no volver a mostrar
          completedClassrooms: currentClassroomId 
            ? [...completedClassrooms, currentClassroomId]
            : completedClassrooms,
        });
      },
      
      // Completar el onboarding
      completeOnboarding: () => {
        const { currentClassroomId, completedClassrooms } = get();
        set({ 
          isActive: false,
          showWelcome: false,
          currentStep: 0,
          completedClassrooms: currentClassroomId 
            ? [...completedClassrooms, currentClassroomId]
            : completedClassrooms,
        });
      },
      
      // Establecer si hay estudiante demo
      setHasDemoStudent: (has: boolean) => set({ hasDemoStudent: has }),
      
      // Verificar si ya se completó para una clase
      hasCompletedForClassroom: (classroomId: string) => {
        return get().completedClassrooms.includes(classroomId);
      },
      
      // Resetear para una clase específica (para volver a mostrar el modal)
      resetForClassroom: (classroomId: string) => {
        const { completedClassrooms } = get();
        set({
          completedClassrooms: completedClassrooms.filter(id => id !== classroomId),
          showWelcome: true,
          isActive: false,
          currentStep: 0,
          currentClassroomId: classroomId,
        });
      },
      
      // Helpers
      getCurrentStep: () => CLASSROOM_ONBOARDING_STEPS[get().currentStep],
      getTotalSteps: () => CLASSROOM_ONBOARDING_STEPS.length,
      isFirstStep: () => get().currentStep === 0,
      isLastStep: () => get().currentStep === CLASSROOM_ONBOARDING_STEPS.length - 1,
    }),
    {
      name: 'juried-classroom-onboarding',
    }
  )
);
