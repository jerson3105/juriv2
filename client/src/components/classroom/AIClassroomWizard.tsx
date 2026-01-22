import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Sparkles, X, ChevronRight, ChevronLeft, Check, GraduationCap,
  BookOpen, Award, Target, ShoppingBag, HelpCircle, Loader2,
  Edit2, Trash2, Heart, Coins,
} from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import { behaviorApi } from '../../lib/behaviorApi';
import { badgeApi } from '../../lib/badgeApi';
import { missionApi } from '../../lib/missionApi';
import { shopApi } from '../../lib/shopApi';
import { questionBankApi } from '../../lib/questionBankApi';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// Constantes
const SUBJECTS = [
  { value: 'matematicas', label: 'Matemáticas', emoji: '📐' },
  { value: 'comunicacion', label: 'Comunicación', emoji: '📝' },
  { value: 'ciencias', label: 'Ciencias', emoji: '🔬' },
  { value: 'historia', label: 'Historia', emoji: '🏛️' },
  { value: 'ingles', label: 'Inglés', emoji: '🇬🇧' },
  { value: 'arte', label: 'Arte', emoji: '🎨' },
  { value: 'educacion_fisica', label: 'Educación Física', emoji: '⚽' },
  { value: 'tecnologia', label: 'Tecnología', emoji: '💻' },
];

const GRADE_LEVELS = [
  { value: 'inicial', label: 'Inicial (3-5 años)' },
  { value: 'primaria_baja', label: 'Primaria (6-8 años)' },
  { value: 'primaria_alta', label: 'Primaria (9-11 años)' },
  { value: 'secundaria_baja', label: 'Secundaria (12-14 años)' },
  { value: 'secundaria_alta', label: 'Secundaria (15-17 años)' },
  { value: 'preparatoria', label: 'Preparatoria/Bachillerato' },
  { value: 'universidad', label: 'Universidad' },
];

const STEPS = [
  { id: 'info', title: 'Información', icon: <GraduationCap size={16} /> },
  { id: 'behaviors', title: 'Comportamientos', icon: <BookOpen size={16} /> },
  { id: 'badges', title: 'Insignias', icon: <Award size={16} /> },
  // { id: 'missions', title: 'Misiones', icon: <Target size={16} /> }, // Temporalmente oculto
  { id: 'shop', title: 'Tienda', icon: <ShoppingBag size={16} /> },
  { id: 'questions', title: 'Preguntas', icon: <HelpCircle size={16} /> },
  { id: 'review', title: 'Resumen', icon: <Check size={16} /> },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (classroomId: string) => void;
}

export const AIClassroomWizard = ({ isOpen, onClose, onSuccess }: Props) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Datos de la clase
  const [classData, setClassData] = useState({
    name: '', description: '', subject: '', gradeLevel: '', useCompetencies: false,
    curriculumAreaId: '', gradeScaleType: 'PERU_LETTERS' as 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS',
  });

  // Query para áreas curriculares
  const { data: curriculumAreas = [] } = useQuery({
    queryKey: ['curriculum-areas'],
    queryFn: () => classroomApi.getCurriculumAreas('PE'),
    enabled: classData.useCompetencies,
  });

  // Opciones de generación
  const [behaviorsDesc, setBehaviorsDesc] = useState('');
  const [behaviorsCount, setBehaviorsCount] = useState(10);
  const [pointMode, setPointMode] = useState('COMBINED');
  const [includePositive, setIncludePositive] = useState(true);
  const [includeNegative, setIncludeNegative] = useState(true);

  const [badgesDesc, setBadgesDesc] = useState('');
  const [badgesCount, setBadgesCount] = useState(8);
  const [badgeAssignmentMode, setBadgeAssignmentMode] = useState('MANUAL');

  const [missionsDesc, setMissionsDesc] = useState('');
  const [missionsCount, setMissionsCount] = useState(6);
  const [missionTypes, setMissionTypes] = useState(new Set(['DAILY', 'WEEKLY']));

  const [shopDesc, setShopDesc] = useState('');
  const [shopCount, setShopCount] = useState(8);

  const [questionBankName, setQuestionBankName] = useState('');
  const [questionsDesc, setQuestionsDesc] = useState('');
  const [questionsCount, setQuestionsCount] = useState(15);
  const [questionTypes, setQuestionTypes] = useState(new Set(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']));
  const [includeQuestionBank, setIncludeQuestionBank] = useState(false);

  // Contenido generado
  const [generated, setGenerated] = useState<any>({
    behaviors: [], badges: [], missions: [], shopItems: [], questionBank: null,
  });

  // Selección
  const [selectedBehaviors, setSelectedBehaviors] = useState<Set<number>>(new Set());
  const [selectedBadges, setSelectedBadges] = useState<Set<number>>(new Set());
  const [selectedMissions, setSelectedMissions] = useState<Set<number>>(new Set());
  const [selectedShopItems, setSelectedShopItems] = useState<Set<number>>(new Set());

  // Edición
  const [editingIdx, setEditingIdx] = useState<{ type: string; idx: number } | null>(null);

  const generateContent = async (section: string) => {
    setIsGenerating(true);
    try {
      const baseContext = `Clase: ${classData.name}\nAsignatura: ${classData.subject}\nNivel: ${classData.gradeLevel}\n${classData.description}`;
      
      // Obtener competencias si está habilitado
      const selectedCompetencies = classData.useCompetencies && classData.curriculumAreaId
        ? curriculumAreas.find((a: any) => a.id === classData.curriculumAreaId)?.competencies || []
        : [];

      // Obtener nombres de comportamientos seleccionados para el prompt de insignias
      const selectedBehaviorNames = generated.behaviors
        .filter((_: any, i: number) => selectedBehaviors.has(i))
        .map((b: any) => b.name);
      
      const result = await api.post('/classrooms/generate-ai-content', {
        section,
        context: baseContext,
        description: section === 'behaviors' ? behaviorsDesc : section === 'badges' ? badgesDesc : section === 'missions' ? missionsDesc : section === 'shop' ? shopDesc : questionsDesc,
        count: section === 'behaviors' ? behaviorsCount : section === 'badges' ? badgesCount : section === 'missions' ? missionsCount : section === 'shop' ? shopCount : questionsCount,
        pointMode, includePositive, includeNegative, assignmentMode: badgeAssignmentMode,
        types: Array.from(missionTypes), questionTypes: Array.from(questionTypes),
        // Competencias para behaviors y badges
        competencies: (section === 'behaviors' || section === 'badges') ? selectedCompetencies.map((c: any) => ({ id: c.id, name: c.name })) : undefined,
        // Comportamientos para badges
        behaviors: section === 'badges' ? selectedBehaviorNames : undefined,
      });

      if (result.data.success) {
        if (section === 'behaviors') {
          setGenerated((p: any) => ({ ...p, behaviors: result.data.data.items }));
          setSelectedBehaviors(new Set(result.data.data.items.map((_: any, i: number) => i)));
        } else if (section === 'badges') {
          setGenerated((p: any) => ({ ...p, badges: result.data.data.items }));
          setSelectedBadges(new Set(result.data.data.items.map((_: any, i: number) => i)));
        } else if (section === 'missions') {
          setGenerated((p: any) => ({ ...p, missions: result.data.data.items }));
          setSelectedMissions(new Set(result.data.data.items.map((_: any, i: number) => i)));
        } else if (section === 'shop') {
          setGenerated((p: any) => ({ ...p, shopItems: result.data.data.items }));
          setSelectedShopItems(new Set(result.data.data.items.map((_: any, i: number) => i)));
        } else if (section === 'questions') {
          setGenerated((p: any) => ({ ...p, questionBank: result.data.data }));
          setIncludeQuestionBank(true);
        }
        toast.success('Contenido generado');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al generar');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItem = (type: string, idx: number, updates: any) => {
    setGenerated((p: any) => ({
      ...p,
      [type]: p[type].map((item: any, i: number) => i === idx ? { ...item, ...updates } : item),
    }));
  };

  const deleteItem = (type: string, idx: number) => {
    setGenerated((p: any) => ({ ...p, [type]: p[type].filter((_: any, i: number) => i !== idx) }));
    const setFn = type === 'behaviors' ? setSelectedBehaviors : type === 'badges' ? setSelectedBadges : type === 'missions' ? setSelectedMissions : setSelectedShopItems;
    setFn((prev: Set<number>) => {
      const newSet = new Set<number>();
      prev.forEach(i => { if (i < idx) newSet.add(i); else if (i > idx) newSet.add(i - 1); });
      return newSet;
    });
    setEditingIdx(null);
  };

  const createClassroom = async () => {
    if (!classData.name.trim()) { toast.error('Nombre requerido'); return; }
    setIsCreating(true);
    try {
      const classroom = await classroomApi.create({
        name: classData.name, description: classData.description,
        gradeLevel: classData.gradeLevel, useCompetencies: classData.useCompetencies,
        curriculumAreaId: classData.useCompetencies ? classData.curriculumAreaId || null : null,
        gradeScaleType: classData.useCompetencies ? classData.gradeScaleType : null,
      });
      const cid = classroom.id;

      // Crear comportamientos y guardar mapeo nombre -> id para insignias
      const behaviorNameToId: Record<string, string> = {};
      for (const b of generated.behaviors.filter((_: any, i: number) => selectedBehaviors.has(i))) {
        try {
          const created = await behaviorApi.create({
            classroomId: cid, name: b.name, description: b.description || '',
            isPositive: b.isPositive, pointType: b.isPositive ? 'XP' : 'HP',
            pointValue: Math.abs(b.xpValue || b.hpValue || 10),
            xpValue: b.xpValue || 0, hpValue: b.hpValue || 0, gpValue: b.gpValue || 0, icon: b.icon || '⭐',
            competencyId: b.competencyId || null,
          });
          if (created?.id) behaviorNameToId[b.name] = created.id;
        } catch (e) { console.error(e); }
      }

      for (const b of generated.badges.filter((_: any, i: number) => selectedBadges.has(i))) {
        try {
          // Construir unlockCondition si es automática
          let unlockCondition = null;
          if (b.triggerCondition && (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH')) {
            // Buscar patrón "Obtener X veces 'NombreComportamiento'"
            const match = b.triggerCondition.match(/(\d+)\s*veces\s*['"']([^'"']+)['"']/i);
            if (match) {
              const triggerCount = parseInt(match[1]) || 5;
              const behaviorName = match[2];
              const behaviorId = behaviorNameToId[behaviorName] || null;
              if (behaviorId) {
                unlockCondition = {
                  type: 'BEHAVIOR_COUNT',
                  behaviorId: behaviorId,
                  count: triggerCount,
                };
              }
            }
          }
          
          await badgeApi.createBadge(cid, {
            name: b.name, description: b.description || '', icon: b.icon || '🏆',
            rarity: b.rarity || 'COMMON', assignmentMode: b.assignmentMode || 'MANUAL',
            rewardXp: b.rewardXp || 0, rewardGp: b.rewardGp || 0,
            competencyId: b.competencyId || null,
            unlockCondition: unlockCondition,
          });
        } catch (e) { console.error(e); }
      }

      for (const m of generated.missions.filter((_: any, i: number) => selectedMissions.has(i))) {
        try {
          await missionApi.createMission(cid, {
            name: m.name || m.title, description: m.description || '',
            type: m.type || 'SPECIAL', category: m.category || 'CUSTOM',
            objectiveType: m.objectiveType || 'CUSTOM', objectiveTarget: 1,
            rewardXp: m.xpReward || 0, rewardGp: m.gpReward || 0,
          });
        } catch (e) { console.error(e); }
      }

      for (const s of generated.shopItems.filter((_: any, i: number) => selectedShopItems.has(i))) {
        try {
          await shopApi.createItem({
            classroomId: cid, name: s.name, description: s.description || '',
            category: s.category || 'CONSUMABLE', rarity: s.rarity || 'COMMON',
            price: s.price || 50, icon: s.icon || '🎁',
          });
        } catch (e) { console.error(e); }
      }

      if (includeQuestionBank && generated.questionBank) {
        try {
          const bank = await questionBankApi.createBank(cid, {
            name: questionBankName || `Banco de ${classData.name}`,
            description: questionsDesc || generated.questionBank.description || `Banco de preguntas para ${classData.subject} - ${classData.gradeLevel}`,
          });
          for (const q of generated.questionBank.questions || []) {
            try {
              await questionBankApi.createQuestion(bank.id, {
                type: q.type || 'SINGLE_CHOICE', questionText: q.question || q.questionText,
                difficulty: q.difficulty || 'MEDIUM', points: q.points || 10,
                options: q.options?.map((o: any, i: number) => ({
                  text: typeof o === 'string' ? o : o.text,
                  isCorrect: typeof o === 'string' ? i === q.correctAnswer : o.isCorrect,
                })) || [],
              });
            } catch (e) { console.error(e); }
          }
        } catch (e) { console.error(e); }
      }

      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success('¡Clase creada!');
      onSuccess(cid);
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setClassData({ name: '', description: '', subject: '', gradeLevel: '', useCompetencies: false, curriculumAreaId: '', gradeScaleType: 'PERU_LETTERS' });
    setGenerated({ behaviors: [], badges: [], missions: [], shopItems: [], questionBank: null });
    setSelectedBehaviors(new Set()); setSelectedBadges(new Set()); setSelectedMissions(new Set()); setSelectedShopItems(new Set());
    setIncludeQuestionBank(false);
    onClose();
  };

  if (!isOpen) return null;

  const canNext = currentStep === 0 
    ? classData.name && classData.subject && classData.gradeLevel && (!classData.useCompetencies || classData.curriculumAreaId)
    : true;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] min-h-[600px] overflow-hidden flex flex-col md:flex-row">
          
          {/* Panel izquierdo - Jiro */}
          <div className="hidden md:block md:w-72 relative overflow-hidden flex-shrink-0">
            <motion.img
              src="/assets/mascot/jiro-crearclaseIA.jpg"
              alt="Jiro"
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Panel derecho - Contenido */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Crear Clase con IA</h2>
                    <p className="text-xs text-gray-500">Paso {currentStep + 1} de {STEPS.length}: {STEPS[currentStep].title}</p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <div className="flex gap-1">{STEPS.map((s, i) => (
                <div key={s.id} className={`flex-1 h-1.5 rounded-full ${i <= currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}</div>
            </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Step 0: Info */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    💡 <strong>¡Bienvenido!</strong> Completa la información básica de tu clase para que la IA genere contenido personalizado.
                  </p>
                </div>

                {/* Nombre de la clase */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📝 Nombre de la clase
                  </label>
                  <input 
                    value={classData.name} 
                    onChange={(e) => setClassData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Matemáticas 3°A - Turno mañana"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Asignatura - Grid de botones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📚 Asignatura <span className="font-normal text-gray-500">(selecciona una)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SUBJECTS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setClassData(p => ({ ...p, subject: s.value }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          classData.subject === s.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                      >
                        <div className="text-xl mb-1">{s.emoji}</div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white">{s.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nivel educativo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    🎓 Nivel educativo
                  </label>
                  <select 
                    value={classData.gradeLevel} 
                    onChange={(e) => setClassData(p => ({ ...p, gradeLevel: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Seleccionar nivel...</option>
                    {GRADE_LEVELS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>

                {/* Descripción opcional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ✏️ Descripción adicional <span className="font-normal text-gray-500">(opcional)</span>
                  </label>
                  <textarea 
                    value={classData.description} 
                    onChange={(e) => setClassData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ej: Grupo avanzado, enfocado en resolución de problemas..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                {/* Toggle de Competencias */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">¿Usar Competencias?</p>
                        <p className="text-xs text-gray-500">Habilita calificaciones por competencias curriculares</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClassData(p => ({ ...p, useCompetencies: !p.useCompetencies }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${classData.useCompetencies ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${classData.useCompetencies ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Opciones de Competencias */}
                  <AnimatePresence>
                    {classData.useCompetencies && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              📚 Área Curricular
                            </label>
                            <select
                              value={classData.curriculumAreaId}
                              onChange={(e) => setClassData(p => ({ ...p, curriculumAreaId: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Selecciona un área...</option>
                              {curriculumAreas.map((area: any) => (
                                <option key={area.id} value={area.id}>
                                  {area.name} ({area.competencies?.length || 0} competencias)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              📊 Sistema de Calificación
                            </label>
                            <select
                              value={classData.gradeScaleType}
                              onChange={(e) => setClassData(p => ({ ...p, gradeScaleType: e.target.value as any }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="PERU_LETTERS">Perú - Letras (AD, A, B, C)</option>
                              <option value="PERU_VIGESIMAL">Perú - Vigesimal (0-20)</option>
                            </select>
                          </div>

                          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg flex items-center gap-2">
                            <span>🇵🇪</span>
                            <span>Por el momento solo están disponibles las competencias del currículo de Perú.</span>
                          </div>

                          {classData.curriculumAreaId && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-lg">
                              <p className="font-medium text-emerald-600 mb-1">Competencias incluidas:</p>
                              <ul className="space-y-0.5 max-h-20 overflow-y-auto">
                                {curriculumAreas
                                  .find((a: any) => a.id === classData.curriculumAreaId)
                                  ?.competencies?.map((c: any, i: number) => (
                                    <li key={c.id} className="truncate" title={c.name}>
                                      {i + 1}. {c.name}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Step 1: Behaviors */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    💡 <strong>¿Qué son los comportamientos?</strong> Son acciones que premias o penalizas en clase.
                    Los <span className="text-emerald-600 font-bold">positivos</span> dan puntos y los <span className="text-red-500 font-bold">negativos</span> los quitan.
                  </p>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ✏️ ¿Qué comportamientos evaluar?
                  </label>
                  <textarea 
                    value={behaviorsDesc} 
                    onChange={(e) => setBehaviorsDesc(e.target.value)}
                    placeholder="Ej: Participación en clase, entrega de tareas, respeto a compañeros..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                {/* Opciones en grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🔢 ¿Cuántos generar?
                    </label>
                    <input 
                      type="number" 
                      min={5} 
                      max={20} 
                      value={behaviorsCount} 
                      onChange={(e) => setBehaviorsCount(+e.target.value || 10)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      🎮 ¿Qué puntos usar?
                    </label>
                    <select 
                      value={pointMode} 
                      onChange={(e) => setPointMode(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="COMBINED">🎮 Combinado (XP+HP+GP)</option>
                      <option value="XP_ONLY">⭐ Solo XP (Experiencia)</option>
                      <option value="HP_ONLY">❤️ Solo HP (Vida)</option>
                      <option value="GP_ONLY">🪙 Solo GP (Monedas)</option>
                    </select>
                  </div>
                </div>

                {/* Tipo de comportamientos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ✅ ¿Qué tipo de comportamientos incluir?
                  </label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      includePositive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600'
                    }`}>
                      <input type="checkbox" checked={includePositive} onChange={(e) => setIncludePositive(e.target.checked)} className="sr-only" />
                      <Sparkles size={18} className="text-emerald-500" />
                      <div>
                        <div className="text-sm font-medium">Positivos</div>
                        <div className="text-xs text-gray-500">Dan puntos</div>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      includeNegative ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                    }`}>
                      <input type="checkbox" checked={includeNegative} onChange={(e) => setIncludeNegative(e.target.checked)} className="sr-only" />
                      <Heart size={18} className="text-red-500" />
                      <div>
                        <div className="text-sm font-medium">Negativos</div>
                        <div className="text-xs text-gray-500">Quitan puntos</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Botón generar */}
                <button 
                  onClick={() => generateContent('behaviors')} 
                  disabled={isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all"
                >
                  {isGenerating ? (
                    <><Loader2 size={18} className="animate-spin" /> Generando comportamientos...</>
                  ) : (
                    <><Sparkles size={18} /> {generated.behaviors.length ? 'Regenerar comportamientos' : 'Generar con IA'}</>
                  )}
                </button>

                {/* Lista de comportamientos generados */}
                {generated.behaviors.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between text-sm text-gray-500 px-1">
                      <span>{selectedBehaviors.size} de {generated.behaviors.length} seleccionados</span>
                      <button 
                        onClick={() => setSelectedBehaviors(new Set(generated.behaviors.map((_: any, i: number) => i)))}
                        className="text-emerald-600 hover:underline"
                      >
                        Seleccionar todos
                      </button>
                    </div>
                    {generated.behaviors.map((b: any, i: number) => (
                      editingIdx?.type === 'behaviors' && editingIdx.idx === i ? (
                        <div key={i} className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Editando comportamiento</span>
                            <div className="flex gap-2">
                              <button onClick={() => deleteItem('behaviors', i)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg" title="Eliminar">
                                <Trash2 size={16} />
                              </button>
                              <button onClick={() => setEditingIdx(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex gap-1">
                              <button onClick={() => updateItem('behaviors', i, { isPositive: true })} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${b.isPositive ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Dar</button>
                              <button onClick={() => updateItem('behaviors', i, { isPositive: false })} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!b.isPositive ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Quitar</button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {['⭐', '🎯', '📚', '✅', '🏆', '💪', '🧠', '❤️', '💔', '⚡', '🔥', '❌'].map(emoji => (
                                <button key={emoji} onClick={() => updateItem('behaviors', i, { icon: emoji })} className={`w-7 h-7 rounded text-sm ${b.icon === emoji ? 'bg-blue-500 ring-2 ring-blue-400' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'}`}>{emoji}</button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={b.name} onChange={(e) => updateItem('behaviors', i, { name: e.target.value })} className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg" placeholder="Nombre" />
                            <input type="text" value={b.description || ''} onChange={(e) => updateItem('behaviors', i, { description: e.target.value })} className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg" placeholder="Descripción" />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                              <Sparkles size={12} className="text-purple-600" />
                              <input type="number" value={b.xpValue || 0} onChange={(e) => updateItem('behaviors', i, { xpValue: parseInt(e.target.value) || 0 })} className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-purple-400" min={0} />
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                              <Heart size={12} className="text-red-600" />
                              <input type="number" value={b.hpValue || 0} onChange={(e) => updateItem('behaviors', i, { hpValue: parseInt(e.target.value) || 0 })} className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-red-400" />
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                              <Coins size={12} className="text-amber-600" />
                              <input type="number" value={b.gpValue || 0} onChange={(e) => updateItem('behaviors', i, { gpValue: parseInt(e.target.value) || 0 })} className="w-12 px-1 py-0.5 text-xs text-center bg-transparent border-b border-amber-400" min={0} />
                            </div>
                          </div>
                          {classData.useCompetencies && curriculumAreas.length > 0 && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">📚 Competencia asociada</label>
                              <select
                                value={b.competencyId || ''}
                                onChange={(e) => updateItem('behaviors', i, { competencyId: e.target.value || null })}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                              >
                                <option value="">Sin competencia</option>
                                {curriculumAreas.find((a: any) => a.id === classData.curriculumAreaId)?.competencies?.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <button onClick={() => setEditingIdx(null)} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
                            <Check size={14} className="inline mr-1" /> Listo
                          </button>
                        </div>
                      ) : (
                        <div 
                          key={i} 
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            selectedBehaviors.has(i)
                              ? b.isPositive
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-600 opacity-50'
                          }`}
                        >
                          <button
                            onClick={() => { const s = new Set(selectedBehaviors); s.has(i) ? s.delete(i) : s.add(i); setSelectedBehaviors(s); }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedBehaviors.has(i) ? (b.isPositive ? 'bg-emerald-500 border-emerald-500' : 'bg-red-500 border-red-500') : 'border-gray-300'
                            }`}
                          >
                            {selectedBehaviors.has(i) && <Check size={12} className="text-white" />}
                          </button>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${b.isPositive ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {b.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-800 dark:text-white truncate">{b.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${b.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {b.isPositive ? 'Da puntos' : 'Quita puntos'}
                              </span>
                              {b.competencyId && classData.useCompetencies && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 truncate max-w-[150px]" title={curriculumAreas.find((a: any) => a.id === classData.curriculumAreaId)?.competencies?.find((c: any) => c.id === b.competencyId)?.name}>
                                  📚 {curriculumAreas.find((a: any) => a.id === classData.curriculumAreaId)?.competencies?.find((c: any) => c.id === b.competencyId)?.name?.substring(0, 25) || 'Competencia'}...
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{b.description}</p>
                            <div className="flex gap-2 mt-1">
                              {b.xpValue > 0 && <span className="text-xs text-purple-600 font-medium">+{b.xpValue} XP</span>}
                              {b.hpValue !== 0 && <span className={`text-xs font-medium ${b.hpValue > 0 ? 'text-green-600' : 'text-red-600'}`}>{b.hpValue > 0 ? '+' : ''}{b.hpValue} HP</span>}
                              {b.gpValue > 0 && <span className="text-xs text-amber-600 font-medium">+{b.gpValue} GP</span>}
                            </div>
                          </div>
                          <button onClick={() => setEditingIdx({ type: 'behaviors', idx: i })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Editar">
                            <Edit2 size={14} className="text-gray-500" />
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                )}
                
                {!generated.behaviors.length && !isGenerating && (
                  <div className="text-center py-8 text-gray-400">
                    <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Haz clic en "Generar con IA" para crear comportamientos</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Badges */}
            {currentStep === 2 && <StepBadges {...{ badgesDesc, setBadgesDesc, badgesCount, setBadgesCount, badgeAssignmentMode, setBadgeAssignmentMode, isGenerating, generateContent, generated, selectedBadges, setSelectedBadges, editingIdx, setEditingIdx, updateItem, deleteItem, useCompetencies: classData.useCompetencies, competencies: curriculumAreas.find((a: any) => a.id === classData.curriculumAreaId)?.competencies || [] }} />}
            {/* Misiones ocultas temporalmente */}
            {currentStep === 3 && <StepShop {...{ shopDesc, setShopDesc, shopCount, setShopCount, isGenerating, generateContent, generated, selectedShopItems, setSelectedShopItems, editingIdx, setEditingIdx, updateItem, deleteItem }} />}
            {currentStep === 4 && <StepQuestions {...{ questionBankName, setQuestionBankName, questionsDesc, setQuestionsDesc, questionsCount, setQuestionsCount, questionTypes, setQuestionTypes, isGenerating, generateContent, generated, includeQuestionBank, setIncludeQuestionBank }} />}
            {currentStep === 5 && <StepReview {...{ classData, generated, selectedBehaviors, selectedBadges, selectedMissions, selectedShopItems, includeQuestionBank, isCreating, createClassroom }} />}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between">
            <button onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : handleClose()}
              className="px-4 py-2 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
              <ChevronLeft size={18} /> {currentStep > 0 ? 'Anterior' : 'Cancelar'}
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canNext}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50">
                Siguiente <ChevronRight size={18} />
              </button>
            ) : (
              <button onClick={createClassroom} disabled={isCreating}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50">
                {isCreating ? <><Loader2 size={18} className="animate-spin" /> Creando...</> : <><Check size={18} /> Crear Clase</>}
              </button>
            )}
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Sub-componentes para cada paso
const StepBadges = (props: any) => {
  const rarityLabels: Record<string, string> = { COMMON: 'Común', RARE: 'Raro', EPIC: 'Épico', LEGENDARY: 'Legendario' };
  const modeLabels: Record<string, string> = { MANUAL: 'Manual', AUTOMATIC: 'Automático', BOTH: 'Ambos' };
  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          💡 <strong>¿Qué son las insignias?</strong> Son reconocimientos especiales que premian logros de tus estudiantes.
          Pueden ser <span className="font-bold">manuales</span> (tú las asignas) o <span className="font-bold">automáticas</span>.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">✏️ ¿Qué logros reconocer?</label>
        <textarea value={props.badgesDesc} onChange={(e: any) => props.setBadgesDesc(e.target.value)} placeholder="Ej: Puntualidad, mejor promedio, participación destacada..." rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-500 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🔢 ¿Cuántas generar?</label>
          <input type="number" min={3} max={15} value={props.badgesCount} onChange={(e: any) => props.setBadgesCount(+e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">⚙️ Modo de asignación</label>
          <select value={props.badgeAssignmentMode} onChange={(e: any) => props.setBadgeAssignmentMode(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-500">
            <option value="MANUAL">✋ Manual (tú asignas)</option>
            <option value="AUTOMATIC">⚡ Automático (por logros)</option>
            <option value="BOTH">🔄 Ambos modos</option>
          </select>
        </div>
      </div>

      <button onClick={() => props.generateContent('badges')} disabled={props.isGenerating} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all">
        {props.isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generando insignias...</> : <><Sparkles size={18} /> {props.generated.badges.length ? 'Regenerar insignias' : 'Generar con IA'}</>}
      </button>

      {props.generated.badges.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-gray-500 px-1">
            <span>{props.selectedBadges.size} de {props.generated.badges.length} seleccionadas</span>
            <button onClick={() => props.setSelectedBadges(new Set(props.generated.badges.map((_: any, i: number) => i)))} className="text-amber-600 hover:underline">Seleccionar todas</button>
          </div>
          {props.generated.badges.map((b: any, i: number) => (
            <div key={i} className={`rounded-xl border-2 transition-all ${
              props.selectedBadges.has(i)
                ? b.rarity === 'LEGENDARY' ? 'border-amber-500 bg-amber-50' : b.rarity === 'EPIC' ? 'border-purple-500 bg-purple-50' : b.rarity === 'RARE' ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-gray-50'
                : 'border-gray-200 dark:border-gray-600 opacity-50'
            }`}>
              {props.editingIdx?.type === 'badges' && props.editingIdx.idx === i ? (
                <div className="p-3 space-y-3">
                  <div className="flex gap-2">
                    <input value={b.icon || '🏆'} onChange={(e: any) => props.updateItem('badges', i, { icon: e.target.value })} className="w-14 text-center text-xl border border-gray-300 rounded-lg px-2 py-1" />
                    <input value={b.name || ''} onChange={(e: any) => props.updateItem('badges', i, { name: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-1" placeholder="Nombre de la insignia" />
                  </div>
                  <textarea value={b.description || ''} onChange={(e: any) => props.updateItem('badges', i, { description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Descripción" />
                  <div className="flex gap-2 items-center flex-wrap">
                    <select value={b.rarity || 'COMMON'} onChange={(e: any) => props.updateItem('badges', i, { rarity: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                      <option value="COMMON">⚪ Común</option>
                      <option value="RARE">🔵 Raro</option>
                      <option value="EPIC">🟣 Épico</option>
                      <option value="LEGENDARY">🟡 Legendario</option>
                    </select>
                    <select value={b.assignmentMode || 'MANUAL'} onChange={(e: any) => props.updateItem('badges', i, { assignmentMode: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                      <option value="MANUAL">✋ Manual</option>
                      <option value="AUTOMATIC">⚡ Automático</option>
                      <option value="BOTH">🔄 Ambos</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" value={b.rewardXp || 0} onChange={(e: any) => props.updateItem('badges', i, { rewardXp: +e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <span className="text-xs text-purple-600 font-medium">XP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={b.rewardGp || 0} onChange={(e: any) => props.updateItem('badges', i, { rewardGp: +e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <span className="text-xs text-amber-600 font-medium">GP</span>
                    </div>
                  </div>
                  {(b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">⚡ Condición de activación</label>
                      <input value={b.triggerCondition || ''} onChange={(e: any) => props.updateItem('badges', i, { triggerCondition: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Ej: Obtener 5 comportamientos de participación" />
                    </div>
                  )}
                  {props.useCompetencies && props.competencies?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">📚 Competencia asociada</label>
                      <select
                        value={b.competencyId || ''}
                        onChange={(e: any) => props.updateItem('badges', i, { competencyId: e.target.value || null })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <option value="">Sin competencia</option>
                        {props.competencies.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button onClick={() => props.setEditingIdx(null)} className="ml-auto px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600">✓ Listo</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => { const s = new Set(props.selectedBadges); s.has(i) ? s.delete(i) : s.add(i); props.setSelectedBadges(s); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${props.selectedBadges.has(i) ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                    {props.selectedBadges.has(i) && <Check size={12} className="text-white" />}
                  </button>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${b.rarity === 'LEGENDARY' ? 'bg-amber-100' : b.rarity === 'EPIC' ? 'bg-purple-100' : b.rarity === 'RARE' ? 'bg-blue-100' : 'bg-gray-100'}`}>{b.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 dark:text-white">{b.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.rarity === 'LEGENDARY' ? 'bg-amber-200 text-amber-800' : b.rarity === 'EPIC' ? 'bg-purple-200 text-purple-800' : b.rarity === 'RARE' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>{rarityLabels[b.rarity] || 'Común'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{modeLabels[b.assignmentMode] || 'Manual'}</span>
                      {b.competencyId && props.useCompetencies && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 truncate max-w-[120px]" title={props.competencies?.find((c: any) => c.id === b.competencyId)?.name}>
                          📚 {props.competencies?.find((c: any) => c.id === b.competencyId)?.name?.substring(0, 20) || 'Competencia'}...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{b.description}</p>
                    {b.triggerCondition && (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') && (
                      <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                        <span>⚡</span>
                        <span className="truncate">Se activa: {b.triggerCondition}</span>
                      </p>
                    )}
                    <div className="flex gap-2 mt-1">
                      {b.rewardXp > 0 && <span className="text-xs text-purple-600 font-medium">+{b.rewardXp} XP</span>}
                      {b.rewardGp > 0 && <span className="text-xs text-amber-600 font-medium">+{b.rewardGp} GP</span>}
                    </div>
                  </div>
                  <button onClick={() => props.setEditingIdx({ type: 'badges', idx: i })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit2 size={14} className="text-gray-500" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!props.generated.badges.length && !props.isGenerating && (
        <div className="text-center py-8 text-gray-400">
          <Award size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Haz clic en "Generar con IA" para crear insignias</p>
        </div>
      )}
    </div>
  );
};

const StepMissions = (props: any) => {
  const typeLabels: Record<string, string> = { DAILY: 'Diaria', WEEKLY: 'Semanal', SPECIAL: 'Especial' };
  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
        <p className="text-sm text-purple-700 dark:text-purple-300">
          💡 <strong>¿Qué son las misiones?</strong> Son objetivos que los estudiantes deben completar para ganar recompensas.
          Pueden ser <span className="font-bold">diarias</span>, <span className="font-bold">semanales</span> o <span className="font-bold">especiales</span>.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">✏️ ¿Qué misiones crear?</label>
        <textarea value={props.missionsDesc} onChange={(e: any) => props.setMissionsDesc(e.target.value)} placeholder="Ej: Completar tareas, participar en clase, ayudar a compañeros..." rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🔢 ¿Cuántas generar?</label>
          <input type="number" min={3} max={15} value={props.missionsCount} onChange={(e: any) => props.setMissionsCount(+e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📅 Tipos de misión</label>
          <div className="flex gap-2">
            {[
              { value: 'DAILY', label: 'Diarias', icon: '📅' },
              { value: 'WEEKLY', label: 'Semanales', icon: '📆' },
              { value: 'SPECIAL', label: 'Especiales', icon: '⭐' },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => { const s = new Set(props.missionTypes); s.has(t.value) && s.size > 1 ? s.delete(t.value) : s.add(t.value); props.setMissionTypes(s); }} className={`flex-1 px-2 py-2 text-xs rounded-xl border-2 transition-all ${props.missionTypes.has(t.value) ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-200 hover:border-purple-300'}`}>
                <div className="text-base">{t.icon}</div>
                <div className="font-medium">{t.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => props.generateContent('missions')} disabled={props.isGenerating} className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all">
        {props.isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generando misiones...</> : <><Sparkles size={18} /> {props.generated.missions.length ? 'Regenerar misiones' : 'Generar con IA'}</>}
      </button>

      {props.generated.missions.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-gray-500 px-1">
            <span>{props.selectedMissions.size} de {props.generated.missions.length} seleccionadas</span>
            <button onClick={() => props.setSelectedMissions(new Set(props.generated.missions.map((_: any, i: number) => i)))} className="text-purple-600 hover:underline">Seleccionar todas</button>
          </div>
          {props.generated.missions.map((m: any, i: number) => (
            <div key={i} className={`rounded-xl border-2 transition-all ${
              props.selectedMissions.has(i)
                ? m.type === 'DAILY' ? 'border-blue-500 bg-blue-50' : m.type === 'WEEKLY' ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'
                : 'border-gray-200 dark:border-gray-600 opacity-50'
            }`}>
              {props.editingIdx?.type === 'missions' && props.editingIdx.idx === i ? (
                <div className="p-3 space-y-3">
                  <div className="flex gap-2">
                    <input value={m.icon || '🎯'} onChange={(e: any) => props.updateItem('missions', i, { icon: e.target.value })} className="w-14 text-center text-xl border border-gray-300 rounded-lg px-2 py-1" />
                    <input value={m.name || m.title || ''} onChange={(e: any) => props.updateItem('missions', i, { name: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-1" placeholder="Nombre de la misión" />
                  </div>
                  <textarea value={m.description || ''} onChange={(e: any) => props.updateItem('missions', i, { description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Descripción" />
                  <div className="flex gap-2 items-center flex-wrap">
                    <select value={m.type || 'DAILY'} onChange={(e: any) => props.updateItem('missions', i, { type: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                      <option value="DAILY">📅 Diaria</option>
                      <option value="WEEKLY">📆 Semanal</option>
                      <option value="SPECIAL">⭐ Especial</option>
                    </select>
                    <select value={m.objectiveType || 'CUSTOM'} onChange={(e: any) => props.updateItem('missions', i, { objectiveType: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                      <option value="CUSTOM">✋ Completar manual</option>
                      <option value="COMPLETE_BEHAVIORS">📊 Completar comportamientos</option>
                      <option value="EARN_XP">⚡ Ganar XP</option>
                      <option value="EARN_GP">💰 Ganar GP</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" value={m.xpReward || 0} onChange={(e: any) => props.updateItem('missions', i, { xpReward: +e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <span className="text-xs text-purple-600 font-medium">XP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={m.gpReward || 0} onChange={(e: any) => props.updateItem('missions', i, { gpReward: +e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                      <span className="text-xs text-amber-600 font-medium">GP</span>
                    </div>
                    <button onClick={() => props.setEditingIdx(null)} className="ml-auto px-4 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600">✓ Listo</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => { const s = new Set(props.selectedMissions); s.has(i) ? s.delete(i) : s.add(i); props.setSelectedMissions(s); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${props.selectedMissions.has(i) ? 'bg-purple-500 border-purple-500' : 'border-gray-300'}`}>
                    {props.selectedMissions.has(i) && <Check size={12} className="text-white" />}
                  </button>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${m.type === 'DAILY' ? 'bg-blue-100' : m.type === 'WEEKLY' ? 'bg-green-100' : 'bg-amber-100'}`}>{m.icon || '🎯'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 dark:text-white">{m.name || m.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.type === 'DAILY' ? 'bg-blue-200 text-blue-800' : m.type === 'WEEKLY' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>{typeLabels[m.type] || 'Diaria'}</span>
                      {m.objectiveType && m.objectiveType !== 'CUSTOM' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                          {m.objectiveType === 'COMPLETE_BEHAVIORS' ? '📊 Por comportamientos' : m.objectiveType === 'EARN_XP' ? '⚡ Por XP' : '💰 Por GP'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{m.description}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-purple-600 font-medium">+{m.xpReward || 0} XP</span>
                      <span className="text-xs text-amber-600 font-medium">+{m.gpReward || 0} GP</span>
                    </div>
                  </div>
                  <button onClick={() => props.setEditingIdx({ type: 'missions', idx: i })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit2 size={14} className="text-gray-500" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!props.generated.missions.length && !props.isGenerating && (
        <div className="text-center py-8 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Haz clic en "Generar con IA" para crear misiones</p>
        </div>
      )}
    </div>
  );
};

const StepShop = (props: any) => {
  const rarityLabels: Record<string, string> = { COMMON: 'Común', RARE: 'Raro', LEGENDARY: 'Legendario' };
  return (
    <div className="space-y-4">
      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
        <p className="text-sm text-orange-700 dark:text-orange-300">
          💡 <strong>¿Qué es la tienda?</strong> Es donde los estudiantes gastan sus monedas (GP) en privilegios, 
          recompensas o poderes especiales que tú defines.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">✏️ ¿Qué artículos crear?</label>
        <textarea value={props.shopDesc} onChange={(e: any) => props.setShopDesc(e.target.value)} placeholder="Ej: Tiempo extra en exámenes, elegir asiento, día sin tarea..." rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🔢 ¿Cuántos generar?</label>
        <input type="number" min={3} max={15} value={props.shopCount} onChange={(e: any) => props.setShopCount(+e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500" />
      </div>

      <button onClick={() => props.generateContent('shop')} disabled={props.isGenerating} className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all">
        {props.isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generando artículos...</> : <><Sparkles size={18} /> {props.generated.shopItems.length ? 'Regenerar artículos' : 'Generar con IA'}</>}
      </button>

      {props.generated.shopItems.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between text-sm text-gray-500 px-1">
            <span>{props.selectedShopItems.size} de {props.generated.shopItems.length} seleccionados</span>
            <button onClick={() => props.setSelectedShopItems(new Set(props.generated.shopItems.map((_: any, i: number) => i)))} className="text-orange-600 hover:underline">Seleccionar todos</button>
          </div>
          {props.generated.shopItems.map((s: any, i: number) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              props.selectedShopItems.has(i)
                ? s.rarity === 'LEGENDARY' ? 'border-amber-500 bg-amber-50' : s.rarity === 'RARE' ? 'border-blue-500 bg-blue-50' : 'border-gray-400 bg-gray-50'
                : 'border-gray-200 dark:border-gray-600 opacity-50'
            }`}>
              <button onClick={() => { const x = new Set(props.selectedShopItems); x.has(i) ? x.delete(i) : x.add(i); props.setSelectedShopItems(x); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${props.selectedShopItems.has(i) ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                {props.selectedShopItems.has(i) && <Check size={12} className="text-white" />}
              </button>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${s.rarity === 'LEGENDARY' ? 'bg-amber-100' : s.rarity === 'RARE' ? 'bg-blue-100' : 'bg-gray-100'}`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800 dark:text-white">{s.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 font-bold">{s.price} GP</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.rarity === 'LEGENDARY' ? 'bg-amber-200 text-amber-800' : s.rarity === 'RARE' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>{rarityLabels[s.rarity] || 'Común'}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{s.description}</p>
              </div>
              <button onClick={() => props.setEditingIdx({ type: 'shopItems', idx: i })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit2 size={14} className="text-gray-500" /></button>
            </div>
          ))}
        </div>
      )}

      {!props.generated.shopItems.length && !props.isGenerating && (
        <div className="text-center py-8 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Haz clic en "Generar con IA" para crear artículos</p>
        </div>
      )}
    </div>
  );
};

const StepQuestions = (props: any) => {
  const typeLabels: Record<string, { icon: string; label: string; color: string }> = {
    TRUE_FALSE: { icon: '✓✗', label: 'Verdadero/Falso', color: 'bg-green-100 text-green-700' },
    SINGLE_CHOICE: { icon: '⭕', label: 'Opción única', color: 'bg-blue-100 text-blue-700' },
    MULTIPLE_CHOICE: { icon: '☑️', label: 'Opción múltiple', color: 'bg-purple-100 text-purple-700' },
    MATCHING: { icon: '🔗', label: 'Relacionar', color: 'bg-amber-100 text-amber-700' },
  };
  const diffLabels: Record<string, string> = { EASY: 'Fácil', MEDIUM: 'Media', HARD: 'Difícil' };
  const diffColors: Record<string, string> = { EASY: 'bg-green-200 text-green-800', MEDIUM: 'bg-yellow-200 text-yellow-800', HARD: 'bg-red-200 text-red-800' };
  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          💡 <strong>¿Qué es el banco de preguntas?</strong> Es un conjunto de preguntas que puedes usar para evaluaciones y actividades.
          Soporta varios tipos: verdadero/falso, opción única, opción múltiple y relacionar.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📝 Nombre del banco *</label>
        <input value={props.questionBankName} onChange={(e: any) => props.setQuestionBankName(e.target.value)} placeholder="Ej: Evaluación Unidad 1 - Fracciones" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">✏️ Temas a evaluar</label>
        <textarea value={props.questionsDesc} onChange={(e: any) => props.setQuestionsDesc(e.target.value)} placeholder="Ej: Suma y resta de fracciones, fracciones equivalentes, comparación de fracciones..." rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🔢 ¿Cuántas preguntas?</label>
          <input type="number" min={5} max={30} value={props.questionsCount} onChange={(e: any) => props.setQuestionsCount(+e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📋 Tipos de pregunta</label>
          <div className="flex flex-wrap gap-1">
            {[
              { v: 'TRUE_FALSE', l: '✓✗ V/F' },
              { v: 'SINGLE_CHOICE', l: '⭕ Única' },
              { v: 'MULTIPLE_CHOICE', l: '☑️ Múltiple' },
              { v: 'MATCHING', l: '🔗 Relacionar' }
            ].map(t => (
              <button key={t.v} type="button" onClick={() => { const s = new Set(props.questionTypes); s.has(t.v) && s.size > 1 ? s.delete(t.v) : s.add(t.v); props.setQuestionTypes(s); }} className={`px-3 py-1.5 text-xs rounded-xl border-2 transition-all ${props.questionTypes.has(t.v) ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>{t.l}</button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => props.generateContent('questions')} disabled={props.isGenerating || !props.questionBankName} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 transition-all">
        {props.isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generando preguntas...</> : <><Sparkles size={18} /> Generar banco de preguntas</>}
      </button>

      {props.generated.questionBank && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border-2 border-indigo-300">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-indigo-800">{props.generated.questionBank.name || props.questionBankName}</span>
            <span className="text-sm font-bold px-3 py-1 bg-indigo-200 text-indigo-800 rounded-full">{props.generated.questionBank.questions?.length || 0} preguntas</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {props.generated.questionBank.questions?.map((q: any, i: number) => (
              <div key={i} className="text-xs p-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-indigo-600 shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeLabels[q.type]?.color || 'bg-gray-100 text-gray-700'}`}>{typeLabels[q.type]?.icon} {typeLabels[q.type]?.label || q.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${diffColors[q.difficulty] || diffColors.MEDIUM}`}>{diffLabels[q.difficulty] || 'Media'}</span>
                      <span className="text-[10px] text-gray-500 font-medium">{q.points} pts</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{q.question || q.questionText}</p>
                    {q.options && q.type !== 'MATCHING' && (
                      <div className="mt-2 pl-2 border-l-2 border-indigo-200 space-y-1">
                        {q.options.slice(0, 4).map((opt: any, oi: number) => (
                          <div key={oi} className={`flex items-center gap-1 ${(typeof opt === 'object' ? opt.isCorrect : oi === q.correctAnswer) ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                            <span className="w-4">{(typeof opt === 'object' ? opt.isCorrect : oi === q.correctAnswer) ? '✓' : '○'}</span>
                            <span>{typeof opt === 'string' ? opt : opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <label className={`flex items-center gap-3 mt-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${props.includeQuestionBank ? 'bg-indigo-100 border-indigo-500' : 'bg-white border-gray-200'}`}>
            <input type="checkbox" checked={props.includeQuestionBank} onChange={(e: any) => props.setIncludeQuestionBank(e.target.checked)} className="sr-only" />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${props.includeQuestionBank ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'}`}>
              {props.includeQuestionBank && <Check size={12} className="text-white" />}
            </div>
            <span className="text-sm font-medium">Incluir este banco de preguntas al crear la clase</span>
          </label>
        </div>
      )}

      {!props.generated.questionBank && !props.isGenerating && (
        <div className="text-center py-8 text-gray-400">
          <HelpCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Ingresa un nombre y haz clic en "Generar" para crear preguntas</p>
        </div>
      )}
    </div>
  );
};

const StepReview = (props: any) => {
  const subjectLabels: Record<string, string> = {
    matematicas: 'Matemáticas', comunicacion: 'Comunicación', ciencias: 'Ciencias',
    historia: 'Historia', ingles: 'Inglés', arte: 'Arte',
    educacion_fisica: 'Educación Física', tecnologia: 'Tecnología'
  };
  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          🎉 <strong>¡Casi listo!</strong> Revisa el resumen de lo que vas a crear y haz clic en "Crear Clase" para finalizar.
        </p>
      </div>

      {/* Info de la clase */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-300">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-800 dark:text-white">{props.classData.name}</p>
            <p className="text-sm text-gray-600">{subjectLabels[props.classData.subject] || props.classData.subject} • {props.classData.gradeLevel}</p>
          </div>
        </div>
      </div>

      {/* Grid de contenido */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-emerald-600" />
            <span className="text-xs font-medium text-gray-600">Comportamientos</span>
          </div>
          <p className="font-bold text-2xl text-emerald-600">{props.selectedBehaviors.size}</p>
          <p className="text-xs text-gray-500">de {props.generated.behaviors.length} generados</p>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-amber-600" />
            <span className="text-xs font-medium text-gray-600">Insignias</span>
          </div>
          <p className="font-bold text-2xl text-amber-600">{props.selectedBadges.size}</p>
          <p className="text-xs text-gray-500">de {props.generated.badges.length} generadas</p>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-purple-600" />
            <span className="text-xs font-medium text-gray-600">Misiones</span>
          </div>
          <p className="font-bold text-2xl text-purple-600">{props.selectedMissions.size}</p>
          <p className="text-xs text-gray-500">de {props.generated.missions.length} generadas</p>
        </div>

        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={16} className="text-orange-600" />
            <span className="text-xs font-medium text-gray-600">Tienda</span>
          </div>
          <p className="font-bold text-2xl text-orange-600">{props.selectedShopItems.size}</p>
          <p className="text-xs text-gray-500">de {props.generated.shopItems.length} artículos</p>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={16} className="text-indigo-600" />
            <span className="text-xs font-medium text-gray-600">Preguntas</span>
          </div>
          <p className="font-bold text-2xl text-indigo-600">{props.includeQuestionBank ? props.generated.questionBank?.questions?.length || 0 : 0}</p>
          <p className="text-xs text-gray-500">{props.includeQuestionBank ? 'incluidas' : 'no incluidas'}</p>
        </div>
      </div>

      {props.isCreating && (
        <div className="flex flex-col items-center justify-center gap-3 py-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <span className="text-gray-600 font-medium">Creando tu clase y todo su contenido...</span>
          <span className="text-xs text-gray-500">Esto puede tomar unos segundos</span>
        </div>
      )}
    </div>
  );
};
