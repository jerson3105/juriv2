import { useOnboardingStore } from '../../store/onboardingStore';
import { useOnboardingNavigation } from '../../hooks/useOnboardingNavigation';
import { WelcomeModal } from './WelcomeModal';
import { OnboardingOverlay } from './OnboardingOverlay';

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const { hasSeenWelcome, isActive } = useOnboardingStore();
  
  // Hook para detectar navegación y avanzar el tour automáticamente
  useOnboardingNavigation();

  // Mostrar modal de bienvenida si es la primera vez
  const showWelcome = !hasSeenWelcome && !isActive;

  return (
    <>
      {children}
      
      {/* Modal de bienvenida (primera vez) */}
      <WelcomeModal isOpen={showWelcome} />
      
      {/* Overlay del tour guiado */}
      <OnboardingOverlay />
    </>
  );
};
