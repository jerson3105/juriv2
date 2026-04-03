import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ArrowLeft, Sparkles, Loader2, Search, PartyPopper, School, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { studentApi, CHARACTER_CLASSES, type AvatarGender } from '../../lib/studentApi';
import { characterClassApi } from '../../lib/characterClassApi';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';

type CodeType = 'classroom' | 'student' | null;

interface VerifyResult {
  type: 'classroom' | 'student';
  classroomName?: string;
  classroomCode?: string;
  isActive?: boolean;
  studentName?: string | null;
  alreadyLinked?: boolean;
}

const STEP_LABELS = [
  'Ingresa tu código',
  'Crea tu personaje',
  'Elige tu clase',
];

export const JoinClassPage = () => {
  const navigate = useNavigate();

  // Step flow: 1=code, 2=character name+avatar, 3=class selection (only for classroom mode)
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [codeType, setCodeType] = useState<CodeType>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Character creation
  const [characterName, setCharacterName] = useState('');
  const [avatarGender, setAvatarGender] = useState<AvatarGender>('MALE');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [, setAssignmentMode] = useState<string>('STUDENT_CHOICE');

  // Link mode state
  const [isLinking, setIsLinking] = useState(false);

  // Query para cargar clases de personaje del aula
  const { data: classroomClasses, refetch: fetchClasses } = useQuery({
    queryKey: ['classroom-classes-by-code', code],
    queryFn: () => characterClassApi.listByCode(code.toUpperCase()),
    enabled: false,
  });

  const dynamicClasses = classroomClasses?.classes ?? [];

  const joinMutation = useMutation({
    mutationFn: studentApi.joinClass,
    onSuccess: (data) => {
      toast.success(`¡Te has unido a ${data.classroom.name}!`);
      navigate('/dashboard');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error.message || 'Error al unirse a la clase';
      toast.error(message);
    },
  });

  // Step 1: Verify code
  const handleVerifyCode = async () => {
    if (code.length < 6) return;
    setIsVerifying(true);
    setVerifyError('');
    try {
      const result = await studentApi.verifyCode(code);
      setVerifyResult(result);
      setCodeType(result.type);

      if (result.type === 'student' && result.alreadyLinked) {
        setVerifyError('Este código ya fue usado. Contacta a tu profesor.');
        setVerifyResult(null);
        setCodeType(null);
      } else if (result.type === 'classroom' && result.isActive === false) {
        setVerifyError('Esta clase no está activa actualmente.');
        setVerifyResult(null);
        setCodeType(null);
      }
    } catch {
      setVerifyError('Código no encontrado. Revisa que esté bien escrito.');
      setVerifyResult(null);
      setCodeType(null);
    } finally {
      setIsVerifying(false);
    }
  };

  // Go to step 2
  const handleContinueToCharacter = () => {
    if (!verifyResult) return;
    setStep(2);
  };

  // Step 2 → 3 or submit (for classroom mode)
  const handleContinueToClass = async () => {
    if (codeType === 'classroom') {
      try {
        const result = await fetchClasses();
        const data = result.data;
        if (data) {
          setAssignmentMode(data.assignmentMode);
          if (data.assignmentMode === 'TEACHER_ASSIGNS') {
            const first = data.classes[0];
            if (first) {
              setSelectedClass(first.key);
              setSelectedClassId(first.id);
            }
            handleJoinClass(first?.key || 'GUARDIAN', first?.id || null);
            return;
          }
        }
      } catch {
        // Continue with default classes
      }
      setStep(3);
    }
  };

  // Final join for classroom mode
  const handleJoinClass = (classKey?: string, classId?: string | null) => {
    const finalClass = classKey || selectedClass;
    if (!finalClass) return;

    joinMutation.mutate({
      code: code.toUpperCase(),
      characterName,
      characterClass: finalClass,
      characterClassId: classId !== undefined ? classId || undefined : selectedClassId || undefined,
      avatarGender,
    });
  };

  // Final link for student mode
  const handleLinkAccount = async () => {
    setIsLinking(true);
    try {
      const result = await placeholderStudentApi.linkAccount({
        linkCode: code.toUpperCase(),
        characterName: characterName.trim() || undefined,
        avatarGender,
      });
      toast.success(`¡Te has unido a ${result.data.classroom.name}!`);
      navigate('/dashboard');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Error al vincular cuenta';
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  const totalSteps = codeType === 'classroom' ? 3 : 2;
  const isNameOptional = codeType === 'student';

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-start justify-center overflow-auto pt-8 px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Header with Jiro */}
        <div className="text-center mb-4">
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -4, 0] }}
            transition={{ scale: { type: 'spring', delay: 0.2 }, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
            src="/assets/mascot/jiro-ranking-xp.png"
            alt="Jiro"
            className="w-28 h-28 mx-auto mb-2 object-contain drop-shadow-lg"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            ¡Únete a la aventura!
          </h1>
          <p className="text-gray-500 mt-1 text-base">
            {STEP_LABELS[step - 1]}
          </p>
        </div>

        {/* Progress Steps with labels */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: s * 0.1 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  s < step
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : s === step
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {s < step ? <Check size={16} /> : s}
              </motion.div>
              {s < totalSteps && (
                <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                  s < step ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card principal */}
        <motion.div
          layout
          className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-gray-200/80 shadow-xl"
        >
          <AnimatePresence mode="wait">
            {/* ===== STEP 1: Código unificado ===== */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Jiro speech bubble */}
                <div className="relative bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/60 rounded-2xl p-4">
                  <p className="text-gray-600 text-sm text-center">
                    Escribe el código que te dio tu profe. Puede ser <span className="text-purple-600 font-semibold">el código de tu clase</span> o <span className="text-blue-600 font-semibold">tu código personal</span>. ¡Yo lo detecto automáticamente!
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Tu código
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe tu código aquí"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setVerifyError('');
                        setVerifyResult(null);
                        setCodeType(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && !isVerifying && handleVerifyCode()}
                      className={`w-full px-6 py-4 bg-gray-50 border rounded-xl text-center text-2xl font-mono tracking-widest text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                        verifyError ? 'border-red-400 focus:ring-red-500' :
                        verifyResult ? 'border-green-400 focus:ring-green-500' :
                        'border-gray-200 focus:ring-purple-500'
                      }`}
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  {verifyError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-500 text-sm mt-2 text-center"
                    >
                      {verifyError}
                    </motion.p>
                  )}
                </div>

                {/* Result card after verification */}
                <AnimatePresence>
                  {verifyResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded-2xl p-5 border ${
                        verifyResult.type === 'classroom'
                          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
                          : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          verifyResult.type === 'classroom'
                            ? 'bg-purple-100'
                            : 'bg-blue-100'
                        }`}>
                          {verifyResult.type === 'classroom'
                            ? <School className="w-6 h-6 text-purple-600" />
                            : <UserCheck className="w-6 h-6 text-blue-600" />
                          }
                        </div>
                        <div className="flex-1">
                          {verifyResult.type === 'classroom' ? (
                            <>
                              <p className="text-gray-800 font-bold text-lg flex items-center gap-2">
                                <PartyPopper size={18} className="text-yellow-500" />
                                ¡Clase encontrada!
                              </p>
                              <p className="text-gray-500 text-sm">{verifyResult.classroomName}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-gray-800 font-bold text-lg flex items-center gap-2">
                                <PartyPopper size={18} className="text-yellow-500" />
                                ¡Te estábamos esperando!
                              </p>
                              <p className="text-gray-500 text-sm">
                                {verifyResult.studentName && <span className="font-medium text-blue-600">{verifyResult.studentName}</span>}
                                {verifyResult.studentName && ' · '}
                                {verifyResult.classroomName}
                              </p>
                            </>
                          )}
                        </div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-5 h-5 text-white" />
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action button */}
                {!verifyResult ? (
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-4 text-lg"
                    size="lg"
                    onClick={handleVerifyCode}
                    disabled={code.length < 6 || isVerifying}
                  >
                    {isVerifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Buscando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Search size={20} />
                        Verificar código
                      </span>
                    )}
                  </Button>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                    <Button
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-4 text-lg"
                      size="lg"
                      onClick={handleContinueToCharacter}
                      rightIcon={<ArrowRight size={20} />}
                    >
                      ¡Continuar!
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ===== STEP 2: Character name + avatar ===== */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Nombre de tu personaje{isNameOptional ? ' (opcional)' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sir Lancelot, Luna Mágica..."
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  {isNameOptional && (
                    <p className="text-xs text-gray-400 mt-1">Si lo dejas vacío, se usará el nombre que asignó tu profesor</p>
                  )}
                </div>

                {/* Avatar gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-3">
                    Elige tu avatar
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {(['MALE', 'FEMALE'] as const).map((gender) => (
                      <motion.button
                        key={gender}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setAvatarGender(gender)}
                        className={`relative p-4 rounded-2xl transition-all ${
                          avatarGender === gender
                            ? gender === 'MALE'
                              ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400'
                              : 'bg-gradient-to-br from-pink-500/30 to-purple-500/30 border-2 border-pink-400'
                            : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {avatarGender === gender && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                        <div className="flex justify-center mb-2">
                          <img
                            src={gender === 'MALE' ? '/avatars/base/skin-initial-m.png' : '/avatars/base/skin-initial-f.png'}
                            alt={gender === 'MALE' ? 'Masculino' : 'Femenino'}
                            className="h-40 object-contain"
                          />
                        </div>
                        <p className="text-gray-800 font-medium text-center">
                          {gender === 'MALE' ? 'Masculino' : 'Femenino'}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Sparkles size={14} />
                  Podrás personalizar tu avatar con atuendos en la tienda.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0"
                    onClick={() => setStep(1)}
                    leftIcon={<ArrowLeft size={18} />}
                  >
                    Atrás
                  </Button>

                  {codeType === 'classroom' ? (
                    <Button
                      className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                      onClick={handleContinueToClass}
                      disabled={characterName.length < 2}
                      rightIcon={<ArrowRight size={20} />}
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                      onClick={handleLinkAccount}
                      disabled={isLinking}
                      isLoading={isLinking}
                    >
                      ¡Comenzar aventura!
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== STEP 3: Character class (classroom mode only) ===== */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  {(dynamicClasses.length > 0
                    ? dynamicClasses.map((cc) => ({ key: cc.key, id: cc.id, name: cc.name, icon: cc.icon, description: cc.description || '' }))
                    : Object.entries(CHARACTER_CLASSES).map(([key, val]) => ({ key, id: null as string | null, name: val.name, icon: val.icon, description: val.description }))
                  ).map((cls, index) => (
                    <motion.button
                      key={cls.key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setSelectedClass(cls.key); setSelectedClassId(cls.id); }}
                      className={`
                        relative p-5 rounded-2xl text-left transition-all duration-300
                        ${selectedClass === cls.key
                          ? 'bg-gradient-to-br from-purple-100 to-indigo-100 border-2 border-purple-400 shadow-lg shadow-purple-500/20'
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      {selectedClass === cls.key && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                      <span className="text-4xl block mb-2">{cls.icon}</span>
                      <h3 className="font-bold text-gray-800 text-lg">{cls.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cls.description}</p>
                    </motion.button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border-0"
                    onClick={() => setStep(2)}
                    leftIcon={<ArrowLeft size={18} />}
                  >
                    Atrás
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    onClick={() => handleJoinClass()}
                    disabled={!selectedClass}
                    isLoading={joinMutation.isPending}
                  >
                    ¡Comenzar aventura!
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Link para volver */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            ← Volver al dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
};
