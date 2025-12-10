import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useClassroomOnboardingStore } from '../../store/classroomOnboardingStore';
import { CLASSROOM_ONBOARDING_STEPS } from '../../store/onboardingStore';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const ClassroomOnboardingOverlay = () => {
  const { 
    isActive, 
    currentStep, 
    nextStep, 
    prevStep, 
    skipOnboarding,
    completeOnboarding,
    isFirstStep,
    isLastStep,
  } = useClassroomOnboardingStore();

  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const step = CLASSROOM_ONBOARDING_STEPS[currentStep];
  const totalSteps = CLASSROOM_ONBOARDING_STEPS.length;

  const calculatePositions = useCallback(() => {
    if (!step?.targetSelector) {
      setSpotlightPosition(null);
      return;
    }

    const element = document.querySelector(step.targetSelector);
    if (!element) {
      setSpotlightPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    setSpotlightPosition({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calcular posición del tooltip
    const tooltipWidth = 320;
    const tooltipHeight = 280;
    let tooltipTop = 0;
    let tooltipLeft = 0;

    switch (step.placement) {
      case 'top':
        tooltipTop = rect.top - tooltipHeight - 20;
        tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        tooltipTop = rect.bottom + 20;
        tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
        tooltipLeft = rect.left - tooltipWidth - 20;
        break;
      case 'right':
        tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
        tooltipLeft = rect.right + 20;
        break;
    }

    // Ajustar si se sale de la pantalla
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));
    tooltipTop = Math.max(16, Math.min(tooltipTop, window.innerHeight - tooltipHeight - 16));

    setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
  }, [step]);

  useEffect(() => {
    if (isActive) {
      calculatePositions();
      window.addEventListener('resize', calculatePositions);
      window.addEventListener('scroll', calculatePositions);
      
      const timeout = setTimeout(calculatePositions, 100);
      
      return () => {
        window.removeEventListener('resize', calculatePositions);
        window.removeEventListener('scroll', calculatePositions);
        clearTimeout(timeout);
      };
    }
  }, [isActive, currentStep, calculatePositions]);

  if (!isActive) return null;

  const isCenteredStep = !step?.targetSelector || !spotlightPosition;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] pointer-events-none"
      >
        {/* Overlay oscuro con hueco para spotlight */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="classroom-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightPosition && (
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  x={spotlightPosition.left}
                  y={spotlightPosition.top}
                  width={spotlightPosition.width}
                  height={spotlightPosition.height}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#classroom-spotlight-mask)"
          />
        </svg>

        {/* Borde brillante alrededor del spotlight */}
        {spotlightPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: spotlightPosition.top - 2,
              left: spotlightPosition.left - 2,
              width: spotlightPosition.width + 4,
              height: spotlightPosition.height + 4,
            }}
          >
            <div className="w-full h-full rounded-xl border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
          </motion.div>
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto ${
            isCenteredStep 
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]' 
              : 'w-[320px]'
          }`}
          style={!isCenteredStep ? { top: tooltipPosition.top, left: tooltipPosition.left } : undefined}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="text-xl">{step?.icon}</span>
              <span className="text-sm font-medium">
                Paso {currentStep + 1} de {totalSteps}
              </span>
            </div>
            <button
              onClick={skipOnboarding}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Contenido */}
          <div className="p-5">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              {step?.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
              {step?.description}
            </p>

            {/* Indicador de progreso */}
            <div className="flex gap-1.5 mb-5">
              {CLASSROOM_ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full flex-1 transition-colors ${
                    index <= currentStep 
                      ? 'bg-indigo-500' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Botones de navegación */}
            <div className="flex items-center justify-between gap-3">
              {step?.requiresAction ? (
                <>
                  <div />
                  <button
                    onClick={skipOnboarding}
                    className="flex items-center gap-1 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Omitir tour
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={prevStep}
                    disabled={isFirstStep()}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isFirstStep()
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  <button
                    onClick={isLastStep() ? completeOnboarding : nextStep}
                    className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all"
                  >
                    {isLastStep() ? (
                      <>
                        <Sparkles size={16} />
                        ¡Finalizar!
                      </>
                    ) : (
                      <>
                        Siguiente
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
