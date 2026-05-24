import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  BookOpen,
  Award,
  ShoppingBag,
  HelpCircle,
  Loader2,
  Lock,
  Wand2,
  Users,
  Trophy,
  Settings2,
  CalendarCheck,
  Gem,
  ScrollText,
  Map,
  Gamepad2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  classroomApi,
  type AIClassroomBlueprint,
  type AIClassroomBlueprintModule,
  type AIClassroomFeatureKey,
} from '../../lib/classroomApi';
import { behaviorApi } from '../../lib/behaviorApi';
import { badgeApi } from '../../lib/badgeApi';
import { shopApi } from '../../lib/shopApi';
import { storyApi, type ThemeConfig } from '../../lib/storyApi';
import toast from 'react-hot-toast';

const SUBJECT_OPTIONS = [
  { value: '', label: 'Seleccionar asignatura...' },
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'comunicacion', label: 'Comunicación' },
  { value: 'ciencias', label: 'Ciencias' },
  { value: 'historia', label: 'Historia' },
  { value: 'ingles', label: 'Inglés' },
  { value: 'arte', label: 'Arte' },
  { value: 'educacion_fisica', label: 'Educación Física' },
  { value: 'tecnologia', label: 'Tecnología' },
] as const;

const GRADE_LEVEL_OPTIONS = [
  { value: '', label: 'Seleccionar nivel...' },
  { value: 'inicial', label: 'Inicial (3-5 años)' },
  { value: 'primaria_baja', label: 'Primaria (6-8 años)' },
  { value: 'primaria_alta', label: 'Primaria (9-11 años)' },
  { value: 'secundaria_baja', label: 'Secundaria (12-14 años)' },
  { value: 'secundaria_alta', label: 'Secundaria (15-17 años)' },
  { value: 'preparatoria', label: 'Preparatoria/Bachillerato' },
  { value: 'universidad', label: 'Universidad' },
] as const;

const GRADE_SCALE_OPTIONS = [
  { value: 'PERU_LETTERS', label: 'Perú - Letras (AD, A, B, C)' },
  { value: 'PERU_VIGESIMAL', label: 'Perú - Vigesimal (0-20)' },
] as const;

type EditablePreviewModuleKey = 'behaviors' | 'badges' | 'shop' | 'storytelling';

type PreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
};

type BehaviorDraft = {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPositive: boolean;
  pointType: 'XP' | 'HP' | 'GP';
  pointValue: number;
  competencyId: string;
};

type BadgeDraft = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  assignmentMode: 'MANUAL' | 'AUTOMATIC' | 'BOTH';
  rewardXp: number;
  rewardGp: number;
  competencyId: string;
  triggerCondition: string;
};

type ShopDraft = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  price: number;
};

type ThemeDraft = {
  name: string;
  themeConfig: ThemeConfig;
};

const SELECTABLE_MODULES: AIClassroomFeatureKey[] = ['behaviors', 'badges', 'shop', 'clans', 'storytelling'];
const HIDDEN_WIZARD_MODULES: AIClassroomFeatureKey[] = ['question_bank'];
const EDITABLE_PREVIEW_MODULES: EditablePreviewModuleKey[] = ['behaviors', 'badges', 'shop', 'storytelling'];

const FEATURE_ICONS: Record<AIClassroomFeatureKey, LucideIcon> = {
  students: Users,
  behaviors: Award,
  rankings: Trophy,
  grades: BookOpen,
  settings: Settings2,
  badges: ShieldCheck,
  shop: ShoppingBag,
  clans: Users,
  attendance: CalendarCheck,
  collectibles: Gem,
  storytelling: ScrollText,
  expedition: Map,
  question_bank: HelpCircle,
  activities: Gamepad2,
};

type DraftClassroom = {
  name: string;
  description: string;
  subject: string;
  gradeLevel: string;
  educationLevel: '' | 'PRIMARIA' | 'SECUNDARIA';
  useCompetencies: boolean;
  curriculumAreaId: string;
  gradeScaleType: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM';
};

type ReviewSectionKey = 'classroom' | 'competencies' | AIClassroomFeatureKey;

type ReviewSection = {
  key: ReviewSectionKey;
  title: string;
  subtitle: string;
  loaderMessage: string;
  module?: AIClassroomBlueprintModule;
};

const buildEmptySelections = (): Record<AIClassroomFeatureKey, boolean> => ({
  students: false,
  behaviors: false,
  rankings: false,
  grades: false,
  settings: false,
  badges: false,
  shop: false,
  clans: false,
  attendance: false,
  collectibles: false,
  storytelling: false,
  expedition: false,
  question_bank: false,
  activities: false,
});

const buildPreviewStates = (): Record<EditablePreviewModuleKey, PreviewState> => ({
  behaviors: { status: 'idle', error: null },
  badges: { status: 'idle', error: null },
  shop: { status: 'idle', error: null },
  storytelling: { status: 'idle', error: null },
});

const emptyDraft: DraftClassroom = {
  name: '',
  description: '',
  subject: '',
  gradeLevel: '',
  educationLevel: '',
  useCompetencies: false,
  curriculumAreaId: '',
  gradeScaleType: 'PERU_LETTERS',
};

const normalizeForMatch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const buildDraftId = (prefix: string, index: number) => `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`;

const getSubjectLabel = (value: string) => SUBJECT_OPTIONS.find((option) => option.value === value)?.label || 'Sin definir';
const getGradeLabel = (value: string) => GRADE_LEVEL_OPTIONS.find((option) => option.value === value)?.label || 'Sin definir';
const isSelectableModule = (featureKey: AIClassroomFeatureKey) => SELECTABLE_MODULES.includes(featureKey);
const isHiddenWizardModule = (featureKey: AIClassroomFeatureKey) => HIDDEN_WIZARD_MODULES.includes(featureKey);
const isEditablePreviewModule = (featureKey: AIClassroomFeatureKey): featureKey is EditablePreviewModuleKey => (
  EDITABLE_PREVIEW_MODULES.includes(featureKey as EditablePreviewModuleKey)
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (classroomId: string) => void;
}

export const AIClassroomWizard = ({ isOpen, onClose, onSuccess }: Props) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [blueprint, setBlueprint] = useState<AIClassroomBlueprint | null>(null);
  const [classDraft, setClassDraft] = useState<DraftClassroom>(emptyDraft);
  const [moduleSelections, setModuleSelections] = useState<Record<AIClassroomFeatureKey, boolean>>(buildEmptySelections());
  const [curriculumAreaHint, setCurriculumAreaHint] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isStepThinking, setIsStepThinking] = useState(false);
  const [editingReviewStep, setEditingReviewStep] = useState<ReviewSectionKey | null>(null);
  const [creationStatus, setCreationStatus] = useState('');
  const [behaviorDrafts, setBehaviorDrafts] = useState<BehaviorDraft[]>([]);
  const [badgeDrafts, setBadgeDrafts] = useState<BadgeDraft[]>([]);
  const [shopDrafts, setShopDrafts] = useState<ShopDraft[]>([]);
  const [storyThemeDraft, setStoryThemeDraft] = useState<ThemeDraft | null>(null);
  const [storyThemePrompt, setStoryThemePrompt] = useState('');
  const [previewStates, setPreviewStates] = useState<Record<EditablePreviewModuleKey, PreviewState>>(buildPreviewStates());
  const reviewTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas', classDraft.educationLevel],
    queryFn: () => classroomApi.getCurriculumAreas('PE', classDraft.educationLevel || undefined),
    enabled: classDraft.useCompetencies && !!classDraft.educationLevel,
  });

  const selectedCurriculumArea = curriculumAreas.find((area) => area.id === classDraft.curriculumAreaId) || null;
  const suggestedCurriculumArea = !selectedCurriculumArea && classDraft.useCompetencies && curriculumAreaHint && curriculumAreas.length
    ? curriculumAreas.find((area) => {
      const areaName = normalizeForMatch(area.name);
      const shortName = normalizeForMatch(area.shortName || '');
      const hint = normalizeForMatch(curriculumAreaHint);
      return areaName === hint || shortName === hint || areaName.includes(hint) || hint.includes(areaName);
    }) || null
    : null;
  const resolvedCurriculumArea = selectedCurriculumArea || suggestedCurriculumArea;
  const selectedCompetencies = resolvedCurriculumArea?.competencies || [];
  const competenciesPayload = classDraft.useCompetencies
    ? selectedCompetencies.map((competency) => ({ id: competency.id, name: competency.name }))
    : undefined;

  useEffect(() => {
    if (!classDraft.useCompetencies || !curriculumAreaHint || !curriculumAreas.length || classDraft.curriculumAreaId) {
      return;
    }

    const hint = normalizeForMatch(curriculumAreaHint);
    const matchedArea = curriculumAreas.find((area) => {
      const areaName = normalizeForMatch(area.name);
      const shortName = normalizeForMatch(area.shortName || '');
      return areaName === hint || shortName === hint || areaName.includes(hint) || hint.includes(areaName);
    });

    if (matchedArea) {
      setClassDraft((prev) => ({ ...prev, curriculumAreaId: matchedArea.id }));
    }
  }, [classDraft.curriculumAreaId, classDraft.useCompetencies, curriculumAreaHint, curriculumAreas]);

  useEffect(() => () => {
    if (reviewTransitionTimeoutRef.current) {
      clearTimeout(reviewTransitionTimeoutRef.current);
    }
  }, []);

  if (!isOpen) return null;

  const visibleModules = blueprint?.modules.filter((module) => !isHiddenWizardModule(module.featureKey)) || [];
  const availableModules = visibleModules.filter((module) => module.state === 'AVAILABLE');
  const lockedModules = visibleModules.filter((module) => module.state === 'LOCKED');
  const storytellingModule = availableModules.find((module) => module.featureKey === 'storytelling') || null;
  const createNowModules = availableModules.filter((module) => isSelectableModule(module.featureKey) && moduleSelections[module.featureKey]);
  const readyAfterCreateModules = availableModules.filter((module) => !isSelectableModule(module.featureKey));
  const configurableModules = availableModules.filter((module) => module.configurable && module.featureKey !== 'storytelling');
  const reviewableModules = configurableModules.filter((module) => module.state === 'AVAILABLE');
  const reviewSections: ReviewSection[] = blueprint ? [
    {
      key: 'classroom',
      title: 'Jiro ha pensado en esta info para tu clase. ¿Qué opinas?',
      subtitle: 'Revisa primero la base del aula y ajusta solo lo necesario.',
      loaderMessage: 'Estoy afinando la base de tu clase para que tenga sentido desde el inicio.',
    },
    ...reviewableModules.map((module) => ({
      key: module.featureKey,
      title: `Jiro te propone esto para ${module.title.toLowerCase()}`,
      subtitle: module.shortDescription,
      loaderMessage: `Estoy preparando ${module.title.toLowerCase()} para que lo revises con calma.`,
      module,
    })),
    {
      key: 'competencies',
      title: '¿Usaremos calificaciones por competencias?',
      subtitle: 'Déjalo listo al final del recorrido, cuando ya hayas visto el resto de la propuesta.',
      loaderMessage: 'Estoy revisando la forma de evaluar mejor esta clase.',
    },
    ...(storytellingModule ? [{
      key: 'storytelling' as const,
      title: 'Jiro te propone un tema visual para la historia de tu clase',
      subtitle: 'Si te gusta, la clase nacerá con una ambientación inicial ya preparada en storytelling.',
      loaderMessage: 'Estoy imaginando un tema visual que acompañe la historia de tu aula.',
      module: storytellingModule,
    }] : []),
  ] : [];
  const activeReviewSection = reviewSections[activeReviewIndex] || null;
  const canContinueClassroomReview = Boolean(classDraft.name.trim() && classDraft.subject && classDraft.gradeLevel);
  const canContinueCompetenciesReview = !classDraft.useCompetencies || (classDraft.educationLevel && classDraft.curriculumAreaId);
  const canContinueCurrentReview = !activeReviewSection
    ? false
    : activeReviewSection.key === 'classroom'
      ? canContinueClassroomReview
      : activeReviewSection.key === 'competencies'
        ? canContinueCompetenciesReview
        : true;
  const defaultFlowSteps = ['Idea', 'Base del aula', 'Propuestas', 'Competencias', 'Crear'];
  const flowSteps = blueprint
    ? ['Idea', ...reviewSections.map((section) => (
      section.key === 'classroom'
        ? 'Base del aula'
        : section.key === 'competencies'
          ? 'Competencias'
          : section.module?.title || 'Paso'
    )), 'Crear']
    : defaultFlowSteps;
  const activeFlowIndex = currentStep === 0
    ? (isPlanning ? 1 : 0)
    : currentStep === 1
      ? Math.min(isStepThinking ? activeReviewIndex + 2 : activeReviewIndex + 1, Math.max(flowSteps.length - 2, 0))
      : flowSteps.length - 1;
  const isEditingCurrentReview = Boolean(activeReviewSection && editingReviewStep === activeReviewSection.key);
  const canContinuePlan = Boolean(
    classDraft.name.trim() &&
    classDraft.subject &&
    classDraft.gradeLevel &&
    (!classDraft.useCompetencies || (classDraft.educationLevel && classDraft.curriculumAreaId))
  );

  const buildBaseContext = () => [
    `Clase: ${classDraft.name}`,
    `Asignatura: ${getSubjectLabel(classDraft.subject)}`,
    `Nivel: ${getGradeLabel(classDraft.gradeLevel)}`,
    classDraft.description || blueprint?.classroom.objective || '',
  ].filter(Boolean).join('\n');

  const buildStoryThemePrompt = () => [
    `Tema visual para ${classDraft.name || blueprint?.classroom.name || 'una nueva clase'}.`,
    `Asignatura: ${getSubjectLabel(classDraft.subject || blueprint?.classroom.subject || '')}.`,
    `Nivel: ${getGradeLabel(classDraft.gradeLevel || blueprint?.classroom.gradeLevel || '')}.`,
    `Objetivo central: ${blueprint?.classroom.objective || classDraft.description || 'motivar el aprendizaje con una historia coherente'}.`,
    teacherPrompt.trim() ? `Contexto del docente: ${teacherPrompt.trim()}` : '',
  ].filter(Boolean).join(' ');

  const resetPreviewDrafts = () => {
    setBehaviorDrafts([]);
    setBadgeDrafts([]);
    setShopDrafts([]);
    setStoryThemeDraft(null);
    setPreviewStates(buildPreviewStates());
  };

  const clearDependentBadgePreview = () => {
    setBadgeDrafts([]);
    setPreviewStates((prev) => ({
      ...prev,
      badges: { status: 'idle', error: null },
    }));
  };

  const getCompetencyName = (competencyId: string) => selectedCompetencies.find((competency) => competency.id === competencyId)?.name || '';

  const loadModulePreview = async (featureKey: EditablePreviewModuleKey, force = false) => {
    if (!blueprint) {
      return;
    }

    const currentState = previewStates[featureKey].status;
    const hasDrafts = featureKey === 'behaviors'
      ? behaviorDrafts.length > 0
      : featureKey === 'badges'
        ? badgeDrafts.length > 0
        : featureKey === 'shop'
          ? shopDrafts.length > 0
          : Boolean(storyThemeDraft);

    if (!force && (currentState === 'loading' || (currentState === 'ready' && hasDrafts))) {
      return;
    }

    setPreviewStates((prev) => ({
      ...prev,
      [featureKey]: { status: 'loading', error: null },
    }));

    try {
      const context = buildBaseContext();

      if (featureKey === 'behaviors') {
        const generatedBehaviors = await classroomApi.generateAIContent({
          section: 'behaviors',
          context,
          description: blueprint.generationPlan.behaviors.description,
          count: blueprint.generationPlan.behaviors.count,
          pointMode: blueprint.generationPlan.behaviors.pointMode,
          includePositive: blueprint.generationPlan.behaviors.includePositive,
          includeNegative: blueprint.generationPlan.behaviors.includeNegative,
          competencies: competenciesPayload,
        });

        const nextBehaviorDrafts: BehaviorDraft[] = (Array.isArray(generatedBehaviors?.items) ? generatedBehaviors.items : []).map((behavior: any, index: number) => {
          const pointType: BehaviorDraft['pointType'] = behavior.xpValue
            ? 'XP'
            : behavior.hpValue
              ? 'HP'
              : behavior.gpValue
                ? 'GP'
                : behavior.isPositive
                  ? 'XP'
                  : 'HP';

          const pointValue = Math.abs(
            pointType === 'XP'
              ? behavior.xpValue || 10
              : pointType === 'HP'
                ? behavior.hpValue || 10
                : behavior.gpValue || 10
          );

          return {
            id: buildDraftId('behavior', index),
            name: behavior.name || `Comportamiento ${index + 1}`,
            description: behavior.description || '',
            icon: behavior.icon || '⭐',
            isPositive: typeof behavior.isPositive === 'boolean' ? behavior.isPositive : pointType !== 'HP',
            pointType,
            pointValue,
            competencyId: behavior.competencyId || '',
          };
        });

        setBehaviorDrafts(nextBehaviorDrafts);
      }

      if (featureKey === 'badges') {
        const generatedBadges = await classroomApi.generateAIContent({
          section: 'badges',
          context,
          description: blueprint.generationPlan.badges.description,
          count: blueprint.generationPlan.badges.count,
          assignmentMode: blueprint.generationPlan.badges.assignmentMode,
          competencies: competenciesPayload,
          behaviors: behaviorDrafts.map((behavior) => behavior.name.trim()).filter(Boolean),
        });

        const nextBadgeDrafts: BadgeDraft[] = (Array.isArray(generatedBadges?.items) ? generatedBadges.items : []).map((badge: any, index: number) => ({
          id: buildDraftId('badge', index),
          name: badge.name || `Insignia ${index + 1}`,
          description: badge.description || '',
          icon: badge.icon || '🏆',
          rarity: badge.rarity || 'COMMON',
          assignmentMode: badge.assignmentMode || blueprint.generationPlan.badges.assignmentMode,
          rewardXp: badge.rewardXp || 0,
          rewardGp: badge.rewardGp || 0,
          competencyId: badge.competencyId || '',
          triggerCondition: badge.triggerCondition || '',
        }));

        setBadgeDrafts(nextBadgeDrafts);
      }

      if (featureKey === 'shop') {
        const generatedShop = await classroomApi.generateAIContent({
          section: 'shop',
          context,
          description: blueprint.generationPlan.shop.description,
          count: blueprint.generationPlan.shop.count,
        });

        const nextShopDrafts: ShopDraft[] = (Array.isArray(generatedShop?.items) ? generatedShop.items : []).map((item: any, index: number) => ({
          id: buildDraftId('shop', index),
          name: item.name || `Artículo ${index + 1}`,
          description: item.description || '',
          icon: item.icon || '🎁',
          category: item.category || 'CONSUMABLE',
          rarity: item.rarity || 'COMMON',
          price: item.price || 50,
        }));

        setShopDrafts(nextShopDrafts);
      }

      if (featureKey === 'storytelling') {
        const generatedTheme = await storyApi.generateAIThemePreview(storyThemePrompt.trim() || buildStoryThemePrompt());
        setStoryThemeDraft(generatedTheme);
      }

      setPreviewStates((prev) => ({
        ...prev,
        [featureKey]: { status: 'ready', error: null },
      }));
    } catch (error: any) {
      console.error(`Error loading ${featureKey} preview:`, error);
      setPreviewStates((prev) => ({
        ...prev,
        [featureKey]: {
          status: 'error',
          error: error?.response?.data?.message || 'No se pudo preparar esta propuesta.',
        },
      }));
    }
  };

  const updateBehaviorDraft = (draftId: string, changes: Partial<BehaviorDraft>) => {
    setBehaviorDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, ...changes } : draft)));
    clearDependentBadgePreview();
  };

  const updateBadgeDraft = (draftId: string, changes: Partial<BadgeDraft>) => {
    setBadgeDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, ...changes } : draft)));
  };

  const updateShopDraft = (draftId: string, changes: Partial<ShopDraft>) => {
    setShopDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, ...changes } : draft)));
  };

  useEffect(() => {
    if (currentStep !== 1 || isStepThinking || !activeReviewSection?.module) {
      return;
    }

    const featureKey = activeReviewSection.module.featureKey;
    if (!isEditablePreviewModule(featureKey)) {
      return;
    }

    const previewState = previewStates[featureKey];
    const hasDrafts = featureKey === 'behaviors'
      ? behaviorDrafts.length > 0
      : featureKey === 'badges'
        ? badgeDrafts.length > 0
        : shopDrafts.length > 0;

    if (previewState.status === 'idle' || (previewState.status === 'ready' && !hasDrafts)) {
      void loadModulePreview(featureKey);
    }
  }, [
    activeReviewSection,
    badgeDrafts.length,
    behaviorDrafts.length,
    currentStep,
    isStepThinking,
    previewStates,
    storyThemeDraft,
    shopDrafts.length,
  ]);

  const handleClose = () => {
    if (reviewTransitionTimeoutRef.current) {
      clearTimeout(reviewTransitionTimeoutRef.current);
    }
    setCurrentStep(0);
    setActiveReviewIndex(0);
    setTeacherPrompt('');
    setBlueprint(null);
    setClassDraft(emptyDraft);
    setModuleSelections(buildEmptySelections());
    setCurriculumAreaHint('');
    setIsPlanning(false);
    setIsCreating(false);
    setIsStepThinking(false);
    setEditingReviewStep(null);
    setCreationStatus('');
    setStoryThemePrompt('');
    resetPreviewDrafts();
    onClose();
  };

  const applyBlueprint = (nextBlueprint: AIClassroomBlueprint) => {
    const nextSelections = buildEmptySelections();
    nextBlueprint.modules.forEach((module) => {
      if (!isHiddenWizardModule(module.featureKey) && module.state === 'AVAILABLE' && module.configurable) {
        nextSelections[module.featureKey] = module.recommended;
      }
    });

    setBlueprint(nextBlueprint);
    setClassDraft({
      name: nextBlueprint.classroom.name,
      description: nextBlueprint.classroom.description,
      subject: nextBlueprint.classroom.subject,
      gradeLevel: nextBlueprint.classroom.gradeLevel,
      educationLevel: nextBlueprint.classroom.educationLevel,
      useCompetencies: nextBlueprint.classroom.useCompetencies,
      curriculumAreaId: '',
      gradeScaleType: nextBlueprint.classroom.gradeScaleType,
    });
    setCurriculumAreaHint(nextBlueprint.classroom.curriculumAreaName);
    setModuleSelections(nextSelections);
    setActiveReviewIndex(0);
    setIsStepThinking(false);
    setEditingReviewStep(null);
    setStoryThemePrompt('');
    resetPreviewDrafts();
    setCurrentStep(1);
  };

  const handleGenerateBlueprint = async () => {
    if (teacherPrompt.trim().length < 10) {
      toast.error('Cuéntale un poco más a Jiro sobre tu clase.');
      return;
    }

    setIsPlanning(true);
    try {
      const nextBlueprint = await classroomApi.generateAIClassroomBlueprint(teacherPrompt.trim());
      applyBlueprint(nextBlueprint);
      toast.success('Jiro ya preparó una propuesta para tu clase.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo generar la propuesta con IA');
    } finally {
      setIsPlanning(false);
    }
  };

  const startReviewThinking = (onComplete: () => void) => {
    if (reviewTransitionTimeoutRef.current) {
      clearTimeout(reviewTransitionTimeoutRef.current);
    }

    setIsStepThinking(true);
    setEditingReviewStep(null);

    reviewTransitionTimeoutRef.current = setTimeout(() => {
      setIsStepThinking(false);
      onComplete();
    }, 950);
  };

  const handleBackAction = () => {
    if (currentStep === 0) {
      handleClose();
      return;
    }

    if (currentStep === 1) {
      if (isStepThinking) {
        return;
      }

      if (activeReviewIndex === 0) {
        setCurrentStep(0);
        setEditingReviewStep(null);
        return;
      }

      setActiveReviewIndex((prev) => Math.max(0, prev - 1));
      setEditingReviewStep(null);
      return;
    }

    setCurrentStep(1);
    setActiveReviewIndex(Math.max(reviewSections.length - 1, 0));
    setEditingReviewStep(null);
  };

  const handleContinueReview = () => {
    if (!activeReviewSection) {
      return;
    }

    if (activeReviewSection.key === 'classroom' && !canContinueClassroomReview) {
      toast.error('Revisa el nombre, la asignatura y el nivel antes de seguir.');
      return;
    }

    if (activeReviewSection.key === 'competencies' && !canContinueCompetenciesReview) {
      toast.error('Selecciona el nivel curricular y el área antes de seguir con competencias.');
      return;
    }

    if (activeReviewIndex >= reviewSections.length - 1) {
      setCurrentStep(2);
      setEditingReviewStep(null);
      return;
    }

    startReviewThinking(() => {
      setActiveReviewIndex((prev) => prev + 1);
    });
  };

  const handleToggleModule = (featureKey: AIClassroomFeatureKey) => {
    const module = blueprint?.modules.find((item) => item.featureKey === featureKey);
    if (!module || module.state !== 'AVAILABLE' || (!module.configurable && featureKey !== 'storytelling')) {
      return;
    }

    setModuleSelections((prev) => ({
      ...prev,
      [featureKey]: !prev[featureKey],
    }));
  };

  const handleCreateClassroom = async () => {
    if (!blueprint || !canContinuePlan) {
      toast.error('Completa la información principal antes de crear la clase.');
      return;
    }

    setIsCreating(true);
    setCreationStatus('Jiro está creando la base de tu aula...');

    try {
      const createdClassroom = await classroomApi.create({
        name: classDraft.name.trim(),
        description: classDraft.description.trim(),
        gradeLevel: classDraft.gradeLevel,
        useCompetencies: classDraft.useCompetencies,
        curriculumAreaId: classDraft.useCompetencies ? classDraft.curriculumAreaId : null,
        gradeScaleType: classDraft.useCompetencies ? classDraft.gradeScaleType : null,
      });

      setCreationStatus('Jiro está ajustando la configuración inicial...');
      await classroomApi.update(createdClassroom.id, {
        allowNegativePoints: blueprint.settings.allowNegativePoints,
        showReasonToStudent: blueprint.settings.showReasonToStudent,
        notifyOnPoints: blueprint.settings.notifyOnPoints,
        classAssignmentMode: blueprint.settings.classAssignmentMode,
        showCharacterName: blueprint.settings.showCharacterName,
        shopEnabled: moduleSelections.shop,
        requirePurchaseApproval: moduleSelections.shop ? blueprint.settings.requirePurchaseApproval : false,
        clansEnabled: moduleSelections.clans,
      });

      const baseContext = buildBaseContext();

      const behaviorNameToId: Record<string, string> = {};
      const createdBehaviorNames: string[] = [];
      const moduleWarnings: string[] = [];

      if (moduleSelections.behaviors) {
        setCreationStatus('Jiro está preparando los comportamientos de tu clase...');
        try {
          const generatedBehaviors = behaviorDrafts.length > 0
            ? null
            : await classroomApi.generateAIContent({
              section: 'behaviors',
              context: baseContext,
              description: blueprint.generationPlan.behaviors.description,
              count: blueprint.generationPlan.behaviors.count,
              pointMode: blueprint.generationPlan.behaviors.pointMode,
              includePositive: blueprint.generationPlan.behaviors.includePositive,
              includeNegative: blueprint.generationPlan.behaviors.includeNegative,
              competencies: competenciesPayload,
            });

          const behaviorItems = behaviorDrafts.length > 0
            ? behaviorDrafts.map((behavior) => ({
              name: behavior.name,
              description: behavior.description,
              isPositive: behavior.isPositive,
              pointType: behavior.pointType,
              xpValue: behavior.pointType === 'XP' ? behavior.pointValue : 0,
              hpValue: behavior.pointType === 'HP' ? behavior.pointValue : 0,
              gpValue: behavior.pointType === 'GP' ? behavior.pointValue : 0,
              icon: behavior.icon,
              competencyId: behavior.competencyId || undefined,
            }))
            : Array.isArray(generatedBehaviors?.items)
              ? generatedBehaviors.items
              : [];

          for (const behavior of behaviorItems) {
            const createdBehavior = await behaviorApi.create({
              classroomId: createdClassroom.id,
              name: behavior.name,
              description: behavior.description || '',
              isPositive: !!behavior.isPositive,
              pointType: behavior.pointType || (behavior.isPositive ? 'XP' : 'HP'),
              pointValue: Math.abs(behavior.xpValue || behavior.hpValue || behavior.gpValue || 10),
              xpValue: behavior.xpValue || 0,
              hpValue: behavior.hpValue || 0,
              gpValue: behavior.gpValue || 0,
              icon: behavior.icon || '⭐',
              competencyId: behavior.competencyId || undefined,
            });

            createdBehaviorNames.push(createdBehavior.name);
            behaviorNameToId[createdBehavior.name] = createdBehavior.id;
          }
        } catch (error) {
          console.error('Error creating AI behaviors:', error);
          moduleWarnings.push('comportamientos');
        }
      }

      if (moduleSelections.badges) {
        setCreationStatus('Jiro está armando las insignias de tu clase...');
        try {
          const generatedBadges = badgeDrafts.length > 0
            ? null
            : await classroomApi.generateAIContent({
              section: 'badges',
              context: baseContext,
              description: blueprint.generationPlan.badges.description,
              count: blueprint.generationPlan.badges.count,
              assignmentMode: blueprint.generationPlan.badges.assignmentMode,
              competencies: competenciesPayload,
              behaviors: createdBehaviorNames,
            });

          const badgeItems = badgeDrafts.length > 0
            ? badgeDrafts.map((badge) => ({
              name: badge.name,
              description: badge.description,
              icon: badge.icon,
              rarity: badge.rarity,
              assignmentMode: badge.assignmentMode,
              rewardXp: badge.rewardXp,
              rewardGp: badge.rewardGp,
              competencyId: badge.competencyId || null,
              triggerCondition: badge.triggerCondition,
            }))
            : Array.isArray(generatedBadges?.items)
              ? generatedBadges.items
              : [];

          for (const badge of badgeItems) {
            let unlockCondition = null;
            const requestedAssignmentMode = badge.assignmentMode || blueprint.generationPlan.badges.assignmentMode;

            if (typeof badge.triggerCondition === 'string' && (requestedAssignmentMode === 'AUTOMATIC' || requestedAssignmentMode === 'BOTH')) {
              const match = badge.triggerCondition.match(/(\d+)\s*veces\s*['\"]([^'\"]+)['\"]/i);
              if (match) {
                const triggerCount = parseInt(match[1], 10) || 5;
                const behaviorName = match[2];
                const behaviorId = behaviorNameToId[behaviorName] || null;

                if (behaviorId) {
                  unlockCondition = {
                    type: 'BEHAVIOR_COUNT',
                    behaviorId,
                    count: triggerCount,
                  };
                }
              }
            }

            const finalAssignmentMode = unlockCondition
              ? requestedAssignmentMode
              : requestedAssignmentMode === 'AUTOMATIC' || requestedAssignmentMode === 'BOTH'
                ? 'MANUAL'
                : requestedAssignmentMode;

            await badgeApi.createBadge(createdClassroom.id, {
              name: badge.name,
              description: badge.description || '',
              icon: badge.icon || '🏆',
              rarity: badge.rarity || 'COMMON',
              assignmentMode: finalAssignmentMode,
              rewardXp: badge.rewardXp || 0,
              rewardGp: badge.rewardGp || 0,
              competencyId: badge.competencyId || null,
              unlockCondition,
            });
          }
        } catch (error) {
          console.error('Error creating AI badges:', error);
          moduleWarnings.push('insignias');
        }
      }

      if (moduleSelections.shop) {
        setCreationStatus('Jiro está llenando la tienda de tu clase...');
        try {
          const generatedShop = shopDrafts.length > 0
            ? null
            : await classroomApi.generateAIContent({
              section: 'shop',
              context: baseContext,
              description: blueprint.generationPlan.shop.description,
              count: blueprint.generationPlan.shop.count,
            });

          const shopItems = shopDrafts.length > 0
            ? shopDrafts.map((item) => ({
              name: item.name,
              description: item.description,
              category: item.category,
              rarity: item.rarity,
              price: item.price,
              icon: item.icon,
            }))
            : Array.isArray(generatedShop?.items)
              ? generatedShop.items
              : [];

          for (const item of shopItems) {
            await shopApi.createItem({
              classroomId: createdClassroom.id,
              name: item.name,
              description: item.description || '',
              category: item.category || 'CONSUMABLE',
              rarity: item.rarity || 'COMMON',
              price: item.price || 50,
              icon: item.icon || '🎁',
            });
          }
        } catch (error) {
          console.error('Error creating AI shop items:', error);
          moduleWarnings.push('tienda');
        }
      }

      if (moduleSelections.storytelling) {
        setCreationStatus('Jiro está aplicando el tema visual de tu clase...');
        try {
          if (storyThemeDraft?.themeConfig) {
            await storyApi.updateClassroomTheme(createdClassroom.id, storyThemeDraft.themeConfig, 'AI');
          } else {
            await storyApi.generateAITheme(createdClassroom.id, storyThemePrompt.trim() || buildStoryThemePrompt());
          }
        } catch (error) {
          console.error('Error applying storytelling theme:', error);
          moduleWarnings.push('tema visual');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['classrooms'] });

      if (moduleWarnings.length > 0) {
        toast(`La clase se creó, pero Jiro no pudo completar: ${moduleWarnings.join(', ')}.`);
      } else {
        toast.success('Tu clase ya quedó lista con la ayuda de Jiro.');
      }

      onSuccess(createdClassroom.id);
      handleClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo crear la clase con IA');
    } finally {
      setIsCreating(false);
      setCreationStatus('');
    }
  };

  const primaryAction = () => {
    if (currentStep === 0) {
      void handleGenerateBlueprint();
      return;
    }

    if (currentStep === 1) {
      handleContinueReview();
      return;
    }

    void handleCreateClassroom();
  };

  const isPrimaryDisabled = currentStep === 0
    ? isPlanning || teacherPrompt.trim().length < 10
    : currentStep === 1
      ? isPlanning || isStepThinking || !canContinueCurrentReview
      : isCreating || !canContinuePlan;

  const renderModuleCard = (featureKey: AIClassroomFeatureKey) => {
    const module = blueprint?.modules.find((item) => item.featureKey === featureKey);
    if (!module) return null;

    const Icon = FEATURE_ICONS[featureKey];
    const isSelected = moduleSelections[featureKey];
    const isLocked = module.state === 'LOCKED';
    const selectable = (module.configurable || featureKey === 'storytelling') && !isLocked;

    return (
      <button
        key={module.featureKey}
        type="button"
        onClick={() => selectable && handleToggleModule(module.featureKey)}
        className={`group rounded-2xl border p-3.5 text-left transition-all ${
          isLocked
            ? 'border-gray-200 bg-gray-50/80 opacity-75 dark:border-gray-700 dark:bg-gray-900/50'
            : isSelected
              ? 'border-emerald-300 bg-emerald-50 shadow-sm shadow-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20'
              : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/10'
        } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isLocked
                ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                : isSelected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            }`}>
              <Icon size={18} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                {module.recommended && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Recomendado por Jiro
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{module.shortDescription}</p>
            </div>
          </div>

          {isLocked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-600 dark:text-gray-300">
              <Lock size={12} /> Bloqueado
            </span>
          ) : selectable ? (
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
              isSelected
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800'
            }`}>
              <Check size={14} />
            </span>
          ) : (
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              {module.actionType === 'ENABLE_ON_CREATE' ? 'Se habilita al crear' : 'Disponible al entrar'}
            </span>
          )}
        </div>

        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-900/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Por qué lo propone Jiro</p>
          <p className="mt-1 text-xs leading-5 text-gray-700 dark:text-gray-200">{module.reason}</p>
        </div>

        {!isLocked && module.autoCreateSupported && blueprint && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            {featureKey === 'behaviors' && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{blueprint.generationPlan.behaviors.count} comportamientos</span>}
            {featureKey === 'badges' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{blueprint.generationPlan.badges.count} insignias</span>}
            {featureKey === 'shop' && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{blueprint.generationPlan.shop.count} artículos</span>}
            {featureKey === 'storytelling' && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Tema visual con IA</span>}
          </div>
        )}

        {isLocked && (
          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
            Jiro lo deja contemplado en el plan, pero esta cuenta aún no puede activarlo desde el primer día.
          </p>
        )}
      </button>
    );
  };

  const renderFeaturePill = (featureKey: AIClassroomFeatureKey, tone: 'ready' | 'locked' = 'ready') => {
    const module = visibleModules.find((item) => item.featureKey === featureKey);
    if (!module) return null;

    const Icon = FEATURE_ICONS[featureKey];
    const toneClasses = tone === 'locked'
      ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300'
      : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';

    return (
      <div
        key={module.featureKey}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${toneClasses}`}
      >
        <Icon size={14} />
        <span>{module.title}</span>
      </div>
    );
  };

  const currentFlowLabel = flowSteps[Math.min(activeFlowIndex, flowSteps.length - 1)] || 'Idea';
  const currentThinkingMessage = currentStep === 0
    ? 'Estoy organizando la primera propuesta de tu clase.'
    : activeReviewSection?.loaderMessage || 'Estoy preparando el siguiente paso para tu clase.';
  const backActionLabel = currentStep === 0
    ? 'Cancelar'
    : currentStep === 1 && activeReviewIndex === 0
      ? 'Volver a idea'
      : 'Anterior';
  const primaryActionLabel = currentStep === 0
    ? (isPlanning ? 'Jiro está pensando...' : 'Jiro, piensa mi propuesta')
    : currentStep === 1
      ? (activeReviewIndex >= reviewSections.length - 1 ? 'Ir al resumen' : 'Sí, adelante')
      : (isCreating ? 'Creando clase...' : 'Crear clase con Jiro');

  const renderJiroImage = ({
    imageSrc,
    imageAlt,
    frameClassName,
    imageClassName,
  }: {
    imageSrc: string;
    imageAlt: string;
    frameClassName: string;
    imageClassName?: string;
  }) => (
    <div className={frameClassName}>
      <img
        src={imageSrc}
        alt={imageAlt}
        className={`block h-full w-full object-cover object-center ${imageClassName || ''}`}
      />
    </div>
  );

  const renderSmallJiroPanel = () => (
    <div className="flex justify-center lg:sticky lg:top-24 lg:justify-end">
      {renderJiroImage({
        imageSrc: '/assets/mascot/jiro-ranking-xp.png',
        imageAlt: 'Jiro lateral',
        frameClassName: 'aspect-square w-full max-w-[220px]',
      })}
    </div>
  );

  const getFriendlyPreviewError = (featureKey: EditablePreviewModuleKey, label: string) => {
    const rawError = previewStates[featureKey].error || '';
    let extractedMessage = rawError;
    let extractedStatus = '';
    let extractedCode = '';

    if (rawError.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawError);
        const details = parsed.error || parsed;
        extractedMessage = details.message || rawError;
        extractedStatus = String(details.status || parsed.status || '');
        extractedCode = String(details.code || parsed.code || '');
      } catch {
        extractedMessage = rawError;
      }
    }

    const normalized = extractedMessage.toLowerCase();

    if (
      extractedCode === '503'
      || extractedStatus.toUpperCase() === 'UNAVAILABLE'
      || normalized.includes('high demand')
      || normalized.includes('temporar')
    ) {
      return {
        title: `Jiro no pudo preparar ${label} en este momento`,
        message: 'El servicio de IA está con mucha demanda temporal. Intenta de nuevo en unos segundos.',
      };
    }

    if (normalized.includes('api key')) {
      return {
        title: `No pude preparar ${label}`,
        message: 'La configuración de IA no está disponible ahora mismo. Puedes continuar con la clase y probar más tarde.',
      };
    }

    if (normalized.includes('quota') || normalized.includes('rate limit')) {
      return {
        title: `Jiro alcanzó un límite temporal`,
        message: `No pude terminar ${label} por ahora. Espera un momento y vuelve a intentarlo.`,
      };
    }

    return {
      title: `Jiro no pudo preparar ${label}`,
      message: 'Hubo un problema temporal al consultar la IA. Puedes intentar de nuevo sin perder el resto de la propuesta.',
    };
  };

  const renderPreviewLoading = (label: string) => (
    <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-300">
      <div className="flex items-center gap-2 font-medium">
        <Loader2 size={16} className="animate-spin" />
        Jiro está detallando {label}...
      </div>
    </div>
  );

  const renderPreviewError = (featureKey: EditablePreviewModuleKey, label: string) => {
    const errorSummary = getFriendlyPreviewError(featureKey, label);

    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-900/10 dark:text-rose-300">
        <p className="font-semibold">{errorSummary.title}</p>
        <p className="mt-1 leading-6">{errorSummary.message}</p>
      <button
        type="button"
        onClick={() => void loadModulePreview(featureKey, true)}
        className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-900/20"
      >
        <Wand2 size={14} />
        Intentar de nuevo
      </button>
      </div>
    );
  };

  const renderBehaviorDrafts = () => {
    const previewState = previewStates.behaviors;

    if (previewState.status === 'loading') {
      return renderPreviewLoading('los comportamientos');
    }

    if (previewState.status === 'error') {
      return renderPreviewError('behaviors', 'comportamientos');
    }

    if (!behaviorDrafts.length) {
      return null;
    }

    return (
      <div className="space-y-3">
        {behaviorDrafts.map((behavior, index) => (
          <div key={behavior.id} className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{behavior.icon}</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{behavior.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${behavior.isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'}`}>
                    {behavior.isPositive ? 'Positivo' : 'Correctivo'}
                  </span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                    {behavior.pointType} {behavior.pointValue}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{behavior.description || 'Sin descripción adicional.'}</p>
                {classDraft.useCompetencies && behavior.competencyId && (
                  <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Competencia: {getCompetencyName(behavior.competencyId)}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                #{index + 1}
              </span>
            </div>

            {isEditingCurrentReview && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={behavior.name}
                  onChange={(event) => updateBehaviorDraft(behavior.id, { name: event.target.value })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Nombre del comportamiento"
                />
                <input
                  value={behavior.icon}
                  onChange={(event) => updateBehaviorDraft(behavior.id, { icon: event.target.value.slice(0, 2) || '⭐' })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Icono"
                />
                <textarea
                  value={behavior.description}
                  onChange={(event) => updateBehaviorDraft(behavior.id, { description: event.target.value })}
                  rows={3}
                  className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Descripción del comportamiento"
                />
                <select
                  value={behavior.isPositive ? 'positive' : 'negative'}
                  onChange={(event) => updateBehaviorDraft(behavior.id, {
                    isPositive: event.target.value === 'positive',
                    pointType: event.target.value === 'positive' && behavior.pointType === 'HP'
                      ? 'XP'
                      : event.target.value === 'negative' && behavior.pointType === 'XP'
                        ? 'HP'
                        : behavior.pointType,
                  })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="positive">Positivo</option>
                  <option value="negative">Correctivo</option>
                </select>
                <select
                  value={behavior.pointType}
                  onChange={(event) => updateBehaviorDraft(behavior.id, { pointType: event.target.value as BehaviorDraft['pointType'] })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="XP">XP</option>
                  <option value="HP">HP</option>
                  <option value="GP">GP</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={behavior.pointValue}
                  onChange={(event) => updateBehaviorDraft(behavior.id, { pointValue: Math.max(1, Number(event.target.value) || 1) })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Puntaje"
                />
                {classDraft.useCompetencies && selectedCompetencies.length > 0 && (
                  <select
                    value={behavior.competencyId}
                    onChange={(event) => updateBehaviorDraft(behavior.id, { competencyId: event.target.value })}
                    className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Sin competencia asociada</option>
                    {selectedCompetencies.map((competency) => (
                      <option key={competency.id} value={competency.id}>{competency.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderBadgeDrafts = () => {
    const previewState = previewStates.badges;

    if (previewState.status === 'loading') {
      return renderPreviewLoading('las insignias');
    }

    if (previewState.status === 'error') {
      return renderPreviewError('badges', 'insignias');
    }

    if (!badgeDrafts.length) {
      return null;
    }

    return (
      <div className="space-y-3">
        {badgeDrafts.map((badge, index) => (
          <div key={badge.id} className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{badge.icon}</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{badge.name}</p>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{badge.rarity}</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">{badge.assignmentMode}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{badge.description || 'Sin descripción adicional.'}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                  {badge.rewardXp > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">XP {badge.rewardXp}</span>}
                  {badge.rewardGp > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">GP {badge.rewardGp}</span>}
                  {classDraft.useCompetencies && badge.competencyId && <span className="rounded-full bg-white px-2.5 py-1 text-emerald-700 dark:bg-gray-950 dark:text-emerald-300">{getCompetencyName(badge.competencyId)}</span>}
                </div>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                #{index + 1}
              </span>
            </div>

            {isEditingCurrentReview && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={badge.name}
                  onChange={(event) => updateBadgeDraft(badge.id, { name: event.target.value })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Nombre de la insignia"
                />
                <input
                  value={badge.icon}
                  onChange={(event) => updateBadgeDraft(badge.id, { icon: event.target.value.slice(0, 2) || '🏆' })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Icono"
                />
                <textarea
                  value={badge.description}
                  onChange={(event) => updateBadgeDraft(badge.id, { description: event.target.value })}
                  rows={3}
                  className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Descripción de la insignia"
                />
                <select
                  value={badge.rarity}
                  onChange={(event) => updateBadgeDraft(badge.id, { rarity: event.target.value })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="COMMON">COMMON</option>
                  <option value="UNCOMMON">UNCOMMON</option>
                  <option value="RARE">RARE</option>
                  <option value="EPIC">EPIC</option>
                  <option value="LEGENDARY">LEGENDARY</option>
                </select>
                <select
                  value={badge.assignmentMode}
                  onChange={(event) => updateBadgeDraft(badge.id, { assignmentMode: event.target.value as BadgeDraft['assignmentMode'] })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="AUTOMATIC">AUTOMATIC</option>
                  <option value="BOTH">BOTH</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={badge.rewardXp}
                  onChange={(event) => updateBadgeDraft(badge.id, { rewardXp: Math.max(0, Number(event.target.value) || 0) })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="XP de recompensa"
                />
                <input
                  type="number"
                  min={0}
                  value={badge.rewardGp}
                  onChange={(event) => updateBadgeDraft(badge.id, { rewardGp: Math.max(0, Number(event.target.value) || 0) })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="GP de recompensa"
                />
                <input
                  value={badge.triggerCondition}
                  onChange={(event) => updateBadgeDraft(badge.id, { triggerCondition: event.target.value })}
                  className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Condición de desbloqueo (opcional)"
                />
                {classDraft.useCompetencies && selectedCompetencies.length > 0 && (
                  <select
                    value={badge.competencyId}
                    onChange={(event) => updateBadgeDraft(badge.id, { competencyId: event.target.value })}
                    className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Sin competencia asociada</option>
                    {selectedCompetencies.map((competency) => (
                      <option key={competency.id} value={competency.id}>{competency.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderShopDrafts = () => {
    const previewState = previewStates.shop;

    if (previewState.status === 'loading') {
      return renderPreviewLoading('la tienda');
    }

    if (previewState.status === 'error') {
      return renderPreviewError('shop', 'la tienda');
    }

    if (!shopDrafts.length) {
      return null;
    }

    return (
      <div className="space-y-3">
        {shopDrafts.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">{item.price} GP</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">{item.category}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{item.rarity}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.description || 'Sin descripción adicional.'}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                #{index + 1}
              </span>
            </div>

            {isEditingCurrentReview && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={item.name}
                  onChange={(event) => updateShopDraft(item.id, { name: event.target.value })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Nombre del artículo"
                />
                <input
                  value={item.icon}
                  onChange={(event) => updateShopDraft(item.id, { icon: event.target.value.slice(0, 2) || '🎁' })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Icono"
                />
                <textarea
                  value={item.description}
                  onChange={(event) => updateShopDraft(item.id, { description: event.target.value })}
                  rows={3}
                  className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Descripción del artículo"
                />
                <input
                  type="number"
                  min={0}
                  value={item.price}
                  onChange={(event) => updateShopDraft(item.id, { price: Math.max(0, Number(event.target.value) || 0) })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Precio"
                />
                <input
                  value={item.category}
                  onChange={(event) => updateShopDraft(item.id, { category: event.target.value })}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Categoría"
                />
                <input
                  value={item.rarity}
                  onChange={(event) => updateShopDraft(item.id, { rarity: event.target.value })}
                  className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Rareza"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStoryThemeDraft = () => {
    const previewState = previewStates.storytelling;

    if (previewState.status === 'loading') {
      return renderPreviewLoading('el tema visual');
    }

    if (previewState.status === 'error') {
      return renderPreviewError('storytelling', 'el tema visual');
    }

    if (!storyThemeDraft) {
      return null;
    }

    const colors = storyThemeDraft.themeConfig.colors || {};
    const particles = storyThemeDraft.themeConfig.particles;
    const banner = storyThemeDraft.themeConfig.banner;

    return (
      <div className="space-y-4">
        <div
          className="overflow-hidden rounded-3xl border border-gray-200 shadow-lg dark:border-gray-700"
          style={{
            background: `linear-gradient(135deg, ${colors.primary || '#6d28d9'} 0%, ${colors.secondary || '#0f766e'} 100%)`,
          }}
        >
          <div className="bg-black/10 p-5 text-white backdrop-blur-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                  <span>{banner?.emoji || '✨'}</span>
                  <span>{storyThemeDraft.name}</span>
                </div>
                <h3 className="mt-4 text-2xl font-bold">{banner?.title || storyThemeDraft.name}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  Este sería el tono visual inicial de storytelling para tu clase.
                </p>
              </div>

              {particles?.type && (
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90">
                  Partículas: {particles.type}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {[colors.primary, colors.secondary, colors.accent, colors.background, colors.sidebar].filter(Boolean).map((color) => (
                <div key={color} className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-medium text-white/90">
                  <span className="h-4 w-4 rounded-full border border-white/40" style={{ backgroundColor: color }} />
                  <span>{color}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isEditingCurrentReview && (
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/70">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">Describe el tema que quieres para storytelling</label>
            <textarea
              value={storyThemePrompt}
              onChange={(event) => setStoryThemePrompt(event.target.value)}
              rows={3}
              placeholder={buildStoryThemePrompt()}
              className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Si quieres otro estilo, cambia la idea y vuelve a generar la propuesta.
              </p>
              <button
                type="button"
                onClick={() => void loadModulePreview('storytelling', true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Wand2 size={14} />
                Probar otra ambientación
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderModulePreviewSection = (module: AIClassroomBlueprintModule) => {
    if (!isEditablePreviewModule(module.featureKey)) {
      return null;
    }

    const featureKey = module.featureKey;

    return (
      <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {module.featureKey === 'behaviors' && 'Estos son los comportamientos que Jiro prepararía'}
              {module.featureKey === 'badges' && 'Estas son las insignias que Jiro dejaría listas'}
              {module.featureKey === 'shop' && 'Estos son los artículos que Jiro llevaría a la tienda'}
              {module.featureKey === 'storytelling' && 'Este es el tema visual que Jiro propone para storytelling'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Puedes revisar el detalle ahora y, si lo necesitas, editarlo antes de crear la clase.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadModulePreview(featureKey, true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Wand2 size={14} />
            Generar otra propuesta
          </button>
        </div>

        <div className="mt-4">
          {featureKey === 'behaviors' && renderBehaviorDrafts()}
          {featureKey === 'badges' && renderBadgeDrafts()}
          {featureKey === 'shop' && renderShopDrafts()}
          {featureKey === 'storytelling' && renderStoryThemeDraft()}
        </div>
      </section>
    );
  };

  const renderCompetencyList = () => {
    if (!classDraft.useCompetencies || !selectedCompetencies.length) {
      return (
        <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-600 shadow-sm dark:bg-gray-900/60 dark:text-gray-300">
          Aún no hay competencias confirmadas para esta clase. Usa Seleccionar competencias para revisarlas o ajustar el área.
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white/80 px-4 py-4 shadow-sm dark:bg-gray-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedCurriculumArea ? 'Competencias que se activarán' : 'Competencias sugeridas por Jiro'}</p>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            {selectedCompetencies.length} competencias
          </span>
        </div>
        {!selectedCurriculumArea && resolvedCurriculumArea && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Jiro detectó el área {resolvedCurriculumArea.name}. Confírmala con el selector para dejarla fija antes de crear la clase.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCompetencies.map((competency) => (
            <span key={competency.id} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {competency.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderThinkingState = (message: string) => (
    <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900/50 md:p-8 lg:text-left">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Jiro está pensando, un momento</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{message}</p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
              animate={{ width: ['28%', '74%', '52%', '82%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          {renderJiroImage({
            imageSrc: '/assets/mascot/jiro-ranking-boss.png',
            imageAlt: 'Jiro en carga',
            frameClassName: 'aspect-square w-full max-w-[200px]',
          })}
        </div>
      </div>
    </section>
  );

  const renderPromptStep = () => (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
      <div className="space-y-3 md:space-y-4">
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Conversación inicial</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">¿De qué trata tu clase?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-700 dark:text-gray-300">
            Cuéntale a Jiro la materia, el nivel, qué te preocupa y qué quieres lograr. Después irá mostrándote sus propuestas paso a paso para que decidas si las mantienes o las ajustas.
          </p>
        </section>

        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
            Tu briefing para Jiro
          </label>
          <textarea
            value={teacherPrompt}
            onChange={(event) => setTeacherPrompt(event.target.value)}
            placeholder="Ejemplo: 5to de primaria en Ciencia y Tecnología. Quiero más participación, trabajo en equipo y evidencias claras de aprendizaje."
            rows={4}
            className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-800 outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-emerald-600"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Mientras más concreta sea tu explicación, mejor afinará Jiro el aula.</span>
            <span>{teacherPrompt.trim().length} caracteres</span>
          </div>
        </section>
      </div>

      <div>
        {renderJiroImage({
          imageSrc: '/assets/mascot/jiro-crearclase.jpg',
          imageAlt: 'Jiro creando clase',
          frameClassName: 'aspect-[3/4] w-full',
          imageClassName: 'object-top',
        })}
      </div>
    </div>
  );

  const renderClassroomReviewStep = () => (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
      <div className="space-y-4">
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Paso guiado</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{activeReviewSection?.title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{activeReviewSection?.subtitle}</p>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-[linear-gradient(135deg,_rgba(236,253,245,1)_0%,_rgba(240,249,255,1)_100%)] p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Nombre</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{classDraft.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Asignatura</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{getSubjectLabel(classDraft.subject)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Nivel</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{getGradeLabel(classDraft.gradeLevel)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3 shadow-sm dark:bg-gray-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Lo que Jiro detectó</p>
              <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-200">{blueprint?.classroom.objective}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{classDraft.description || blueprint?.classroom.description}</p>
            </div>
          </div>
        </section>

        {isEditingCurrentReview && (
          <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Ajusta la base del aula</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la clase</label>
                <input
                  value={classDraft.name}
                  onChange={(event) => setClassDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asignatura</label>
                <select
                  value={classDraft.subject}
                  onChange={(event) => setClassDraft((prev) => ({ ...prev, subject: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {SUBJECT_OPTIONS.map((subject) => (
                    <option key={subject.value || 'empty'} value={subject.value}>{subject.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nivel educativo</label>
                <select
                  value={classDraft.gradeLevel}
                  onChange={(event) => setClassDraft((prev) => ({ ...prev, gradeLevel: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {GRADE_LEVEL_OPTIONS.map((gradeLevel) => (
                    <option key={gradeLevel.value || 'empty'} value={gradeLevel.value}>{gradeLevel.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción inicial</label>
              <textarea
                value={classDraft.description}
                onChange={(event) => setClassDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </section>
        )}
      </div>

      {renderSmallJiroPanel()}
    </div>
  );

  const renderModuleReviewStep = (module: AIClassroomBlueprintModule) => {
    const isSelected = moduleSelections[module.featureKey];

    return (
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div className="space-y-4">
          <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Paso guiado</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{activeReviewSection?.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{module.reason}</p>
              </div>

              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                isSelected
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {isSelected ? 'Jiro lo preparará' : 'No se aplicará por ahora'}
              </span>
            </div>

            <div className="mt-4">
              {renderModuleCard(module.featureKey)}
            </div>
          </section>

          {renderModulePreviewSection(module)}

          {isEditingCurrentReview && (
            <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Decide si quieres mantener esta propuesta</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModuleSelections((prev) => ({ ...prev, [module.featureKey]: true }))}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  <p className="text-sm font-semibold">Sí, quiero que Jiro lo prepare</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">Se tomará en cuenta cuando se cree tu clase.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setModuleSelections((prev) => ({ ...prev, [module.featureKey]: false }))}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    !isSelected
                      ? 'border-gray-900 bg-gray-50 text-gray-900 dark:border-gray-500 dark:bg-gray-900/70 dark:text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  <p className="text-sm font-semibold">No por ahora</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">Podrás activarlo o configurarlo después desde la clase.</p>
                </button>
              </div>
            </section>
          )}
        </div>

        {renderSmallJiroPanel()}
      </div>
    );
  };

  const renderCompetenciesReviewStep = () => (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
      <div className="space-y-4">
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Paso guiado</p>
              <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{activeReviewSection?.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{activeReviewSection?.subtitle}</p>
            </div>

            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              classDraft.useCompetencies
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {classDraft.useCompetencies ? 'Se usarán competencias' : 'Clase sin competencias'}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-[linear-gradient(135deg,_rgba(236,253,245,1)_0%,_rgba(240,249,255,1)_100%)] p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
              {classDraft.useCompetencies
                ? 'Jiro recomienda dejar la clase lista para evaluar por competencias desde el inicio.'
                : 'Jiro considera que puedes empezar con una estructura más simple y decidir las competencias más adelante.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {classDraft.useCompetencies && (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-300">
                  {resolvedCurriculumArea?.name || curriculumAreaHint || 'Área curricular por definir'}
                </span>
              )}
              {classDraft.useCompetencies && (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm dark:bg-gray-900 dark:text-sky-300">
                  {GRADE_SCALE_OPTIONS.find((scale) => scale.value === classDraft.gradeScaleType)?.label || classDraft.gradeScaleType}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingReviewStep((prev) => (prev === 'competencies' ? null : 'competencies'))}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <BookOpen size={14} />
                {isEditingCurrentReview ? 'Ocultar selector' : classDraft.useCompetencies ? 'Seleccionar competencias' : 'Configurar competencias'}
              </button>
            </div>

            <div className="mt-4">
              {renderCompetencyList()}
            </div>
          </div>
        </section>

        {isEditingCurrentReview && (
          <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-emerald-500" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Calificaciones por competencias</h3>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Actívalo solo si quieres dejar la clase lista para evidencias y escalas curriculares.</p>
              </div>

              <button
                type="button"
                onClick={() => setClassDraft((prev) => ({
                  ...prev,
                  useCompetencies: !prev.useCompetencies,
                  curriculumAreaId: !prev.useCompetencies ? prev.curriculumAreaId : '',
                }))}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${classDraft.useCompetencies ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <span className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${classDraft.useCompetencies ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {classDraft.useCompetencies && (
              <div className="mt-4 space-y-4 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/15">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nivel curricular</label>
                  <select
                    value={classDraft.educationLevel}
                    onChange={(event) => setClassDraft((prev) => ({
                      ...prev,
                      educationLevel: event.target.value as DraftClassroom['educationLevel'],
                      curriculumAreaId: '',
                    }))}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Seleccionar nivel curricular...</option>
                    <option value="PRIMARIA">Primaria</option>
                    <option value="SECUNDARIA">Secundaria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Área curricular</label>
                  <select
                    value={classDraft.curriculumAreaId}
                    onChange={(event) => setClassDraft((prev) => ({ ...prev, curriculumAreaId: event.target.value }))}
                    disabled={!classDraft.educationLevel}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Seleccionar área...</option>
                    {curriculumAreas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                  {curriculumAreaHint && !classDraft.curriculumAreaId && (
                    <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      Jiro sugirió: {curriculumAreaHint}. Si no coincide, elige la opción más cercana.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Escala de calificación</label>
                  <select
                    value={classDraft.gradeScaleType}
                    onChange={(event) => setClassDraft((prev) => ({ ...prev, gradeScaleType: event.target.value as DraftClassroom['gradeScaleType'] }))}
                    className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {GRADE_SCALE_OPTIONS.map((scale) => (
                      <option key={scale.value} value={scale.value}>{scale.label}</option>
                    ))}
                  </select>
                </div>

                {resolvedCurriculumArea && (
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                    <p className="font-semibold text-gray-900 dark:text-white">Competencias base incluidas</p>
                    <p className="mt-1">{resolvedCurriculumArea.competencies.length} competencias oficiales quedarán disponibles desde el inicio.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resolvedCurriculumArea.competencies.map((competency) => (
                        <span key={competency.id} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                          {competency.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {renderSmallJiroPanel()}
    </div>
  );

  const renderSummaryStep = () => (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Resumen final</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Jiro ya tiene lista tu propuesta</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
          Vas a crear una clase centrada en <span className="font-semibold text-gray-900 dark:text-white">{blueprint?.classroom.objective}</span>.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Base del aula</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-950">
              <p className="font-semibold text-gray-900 dark:text-white">{classDraft.name}</p>
              <p className="mt-1">{getSubjectLabel(classDraft.subject)} • {getGradeLabel(classDraft.gradeLevel)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-950">
              <p className="font-medium text-gray-900 dark:text-white">Descripción</p>
              <p className="mt-1 leading-6">{classDraft.description || 'Sin descripción adicional.'}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-950">
              <p className="font-medium text-gray-900 dark:text-white">Competencias</p>
              <p className="mt-1 leading-6">
                {classDraft.useCompetencies
                  ? `${selectedCurriculumArea?.name || curriculumAreaHint || 'Área pendiente'} • ${classDraft.gradeScaleType}`
                  : 'La clase se creará sin sistema de competencias.'}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Lo que Jiro hará ahora</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            {createNowModules.length > 0 ? createNowModules.map((module) => (
              <div key={module.featureKey} className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/15">
                <p className="font-semibold text-gray-900 dark:text-white">{module.title}</p>
                <p className="mt-1 leading-6">{module.reason}</p>
              </div>
            )) : (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-950">
                <p>No hay módulos automáticos seleccionados. Se creará la base del aula y podrás configurarla después.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Quedará disponible al entrar</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {readyAfterCreateModules.length > 0
              ? readyAfterCreateModules.map((module) => renderFeaturePill(module.featureKey, 'ready'))
              : <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">No hay módulos adicionales en espera.</span>}
          </div>
        </section>

        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Módulos que aún esperan desbloqueo</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {lockedModules.length > 0
              ? lockedModules.map((module) => renderFeaturePill(module.featureKey, 'locked'))
              : <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Esta cuenta ya ve todo Juried desbloqueado.</span>}
          </div>
        </section>
      </div>

      {isCreating && (
        <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-lg p-5 text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-emerald-500" />
          <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">Jiro está creando tu clase</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{creationStatus || 'Organizando todo para que empieces con una base sólida.'}</p>
        </section>
      )}
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {flowSteps.map((label, index) => (
            <div key={label} className="flex items-center gap-2 md:gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                index < activeFlowIndex
                  ? 'bg-emerald-500 text-white'
                  : index === activeFlowIndex
                    ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-900/60'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {index < activeFlowIndex ? <Check size={16} /> : index + 1}
              </div>
              {index < flowSteps.length - 1 && <div className={`h-px w-5 md:w-10 ${index < activeFlowIndex ? 'bg-emerald-300' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Paso {Math.min(activeFlowIndex + 1, flowSteps.length)} de {flowSteps.length}: {currentFlowLabel}</p>
      </section>

      {isPlanning
        ? renderThinkingState(currentThinkingMessage)
        : currentStep === 0
          ? renderPromptStep()
          : currentStep === 1
            ? (isStepThinking
              ? renderThinkingState(currentThinkingMessage)
              : activeReviewSection?.key === 'classroom'
                ? renderClassroomReviewStep()
                : activeReviewSection?.key === 'competencies'
                  ? renderCompetenciesReviewStep()
                  : activeReviewSection?.module
                    ? renderModuleReviewStep(activeReviewSection.module)
                    : null)
            : renderSummaryStep()}

      <section className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 shadow-lg p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBackAction}
            disabled={isPlanning || isCreating || isStepThinking}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ChevronLeft size={16} />
            {backActionLabel}
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {currentStep === 1 && activeReviewSection && !isStepThinking && (
              <button
                type="button"
                onClick={() => setEditingReviewStep((prev) => (prev === activeReviewSection.key ? null : activeReviewSection.key))}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {isEditingCurrentReview ? 'Ocultar cambios' : 'Quiero cambiar algo'}
              </button>
            )}

            {currentStep === 1 && !isStepThinking && (
              <button
                type="button"
                onClick={() => void handleGenerateBlueprint()}
                disabled={isPlanning}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {isPlanning ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                Replantear con Jiro
              </button>
            )}

            <button
              type="button"
              onClick={primaryAction}
              disabled={isPrimaryDisabled}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {currentStep === 0 && (isPlanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />)}
              {currentStep === 1 && <ChevronRight size={16} />}
              {currentStep === 2 && (isCreating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />)}
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </section>
    </motion.section>
  );
};