import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboardingStore } from '../store/onboardingStore';
import { useClassroomOnboardingStore } from '../store/classroomOnboardingStore';

/**
 * Hook que detecta cambios de navegación y avanza el tour automáticamente
 * cuando el usuario realiza las acciones esperadas.
 */
export const useOnboardingNavigation = () => {
  const location = useLocation();
  const { isActive, currentStep, nextStep } = useOnboardingStore();
  const { 
    isActive: isClassroomOnboardingActive, 
    currentStep: classroomStep, 
    nextStep: classroomNextStep 
  } = useClassroomOnboardingStore();

  // Tour principal (crear clase)
  useEffect(() => {
    if (!isActive) return;

    const path = location.pathname;

    // Paso 1 (go-to-classes): Si el usuario va a /classrooms, avanzar al paso 2
    if (currentStep === 1 && path === '/classrooms') {
      setTimeout(() => {
        nextStep();
      }, 300);
    }
  }, [location.pathname, isActive, currentStep, nextStep]);

  // Tour de clase (dentro de la clase)
  // Pasos: 0=welcome, 1=students-menu, 2=students-list, 3=select-student, 4=give-points-btn, 5=modal-tabs, 6=manual-tab, 7=complete
  useEffect(() => {
    if (!isClassroomOnboardingActive) return;

    const path = location.pathname;

    // Paso 2 (students-list): Si el usuario va a /students, avanzar al paso 3 (select-student)
    if (classroomStep === 2 && path.includes('/students')) {
      setTimeout(() => {
        classroomNextStep();
      }, 500);
    }
  }, [location.pathname, isClassroomOnboardingActive, classroomStep, classroomNextStep]);

  // Detectar cuando se selecciona un estudiante (paso 3 -> 4)
  useEffect(() => {
    if (!isClassroomOnboardingActive || classroomStep !== 3) return;

    const checkSelection = () => {
      // Buscar si hay algún estudiante seleccionado (tiene el ring de selección)
      const selectedCard = document.querySelector('[data-onboarding="student-card"].ring-2');
      // O verificar si el contador muestra seleccionados
      const selectionText = document.body.innerText;
      if (selectedCard || selectionText.includes('1 seleccionado')) {
        classroomNextStep();
      }
    };

    const interval = setInterval(checkSelection, 300);
    return () => clearInterval(interval);
  }, [isClassroomOnboardingActive, classroomStep, classroomNextStep]);

  // Detectar cuando se abre el modal de puntos (paso 4 -> 5)
  useEffect(() => {
    if (!isClassroomOnboardingActive || classroomStep !== 4) return;

    const checkModal = () => {
      const modal = document.querySelector('[data-onboarding="manual-tab-btn"]');
      if (modal) {
        classroomNextStep();
      }
    };

    const interval = setInterval(checkModal, 300);
    return () => clearInterval(interval);
  }, [isClassroomOnboardingActive, classroomStep, classroomNextStep]);

  // Detectar cuando se selecciona la pestaña Manual (paso 5 -> 6)
  useEffect(() => {
    if (!isClassroomOnboardingActive || classroomStep !== 5) return;

    const checkManualTab = () => {
      const manualSection = document.querySelector('[data-onboarding="manual-section"]');
      if (manualSection) {
        classroomNextStep();
      }
    };

    const interval = setInterval(checkManualTab, 300);
    return () => clearInterval(interval);
  }, [isClassroomOnboardingActive, classroomStep, classroomNextStep]);
};
