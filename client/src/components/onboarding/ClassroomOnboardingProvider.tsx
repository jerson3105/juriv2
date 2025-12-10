import { useEffect } from 'react';
import { useClassroomOnboardingStore } from '../../store/classroomOnboardingStore';
import { ClassroomWelcomeModal } from './ClassroomWelcomeModal';
import { ClassroomOnboardingOverlay } from './ClassroomOnboardingOverlay';

interface ClassroomOnboardingProviderProps {
  children: React.ReactNode;
  classroomId: string;
  studentCount: number;
}

export const ClassroomOnboardingProvider = ({ 
  children, 
  classroomId,
  studentCount 
}: ClassroomOnboardingProviderProps) => {
  const { 
    isActive, 
    showWelcome,
    hasCompletedForClassroom,
    openWelcomeModal,
    currentClassroomId,
  } = useClassroomOnboardingStore();

  // Mostrar modal automáticamente si es la primera vez en esta clase
  useEffect(() => {
    const hasCompleted = hasCompletedForClassroom(classroomId);
    
    // Solo mostrar automáticamente si:
    // 1. No está activo el tour
    // 2. No se ha completado para esta clase
    // 3. No se está mostrando ya el modal
    // 4. Es una clase diferente a la actual
    if (!isActive && !hasCompleted && !showWelcome && currentClassroomId !== classroomId) {
      const timeout = setTimeout(() => {
        openWelcomeModal(classroomId);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [classroomId, isActive, hasCompletedForClassroom, showWelcome, openWelcomeModal, currentClassroomId]);

  return (
    <>
      {children}
      
      {/* Modal de bienvenida */}
      <ClassroomWelcomeModal 
        isOpen={showWelcome && currentClassroomId === classroomId} 
        classroomId={classroomId}
        hasStudents={studentCount > 0}
      />
      
      {/* Overlay del tour */}
      <ClassroomOnboardingOverlay />
    </>
  );
};
