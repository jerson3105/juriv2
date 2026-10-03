import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ArrowLeft, Sparkles, Loader2, Search, PartyPopper, School, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { studentApi, CHARACTER_CLASSES, type AvatarGender } from '../../lib/studentApi';
import { characterClassApi } from '../../lib/characterClassApi';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { StudentSwitchPanel } from '../../components/auth/StudentSwitch';
import { useStudentSwitch } from '../../components/auth/useStudentSwitch';
import { RosterPicker } from '../../components/auth/RosterPicker';
import { authApi, type ClassRoster } from '../../lib/api';

type RosterStudent = ClassRoster['students'][number];
const ROSTER_STEP = 4;

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
  'Busca tu nombre',
];

export const JoinClassPage = () => {
  const role = useAuthStore((state) => state.user?.role);
  if (role === 'TEACHER') return <TeacherAccountNotice />;
  return <JoinClassFlow />;
};

const TeacherAccountNotice = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useStudentSwitch();
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Esta es una cuenta de docente</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300">Las cuentas de docente no pueden unirse a una clase como estudiante.</p>
      {isLoading ? null : data?.eligible ? (
        <StudentSwitchPanel onCancel={() => navigate('/dashboard')} />
      ) : (
        <button type="button" onClick={() => navigate('/dashboard')} className="inline-flex min-h-[44px] items-center rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700">Ir a mis clases</button>
      )}
    </div>
  );
};

const JoinClassFlow = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectProfile } = useCurrentStudentProfile();

  // Step flow: 1=code, 2=character name+avatar, 3=class selection (only for classroom mode)
  const [step, setStep] = useState(1);
  const [searchParams] = useSearchParams();
  // Llega desde /unirse con el código ya escrito.
  const [code, setCode] = useState(() => (searchParams.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
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

  // Lista cerrada: si el docente tiene nombres sin reclamar, el alumno toca el suyo (no se duplica).
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [rosterPick, setRosterPick] = useState<RosterStudent | null>(null);
  const [rosterNote, setRosterNote] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const rosterMode = !!rosterPick;

  // Query para cargar clases de personaje del aula
  const { data: classroomClasses, refetch: fetchClasses } = useQuery({
    queryKey: ['classroom-classes-by-code', code],
    queryFn: () => characterClassApi.listByCode(code.toUpperCase()),
    enabled: false,
  });

  const dynamicClasses = classroomClasses?.classes ?? [];

  const joinMutation = useMutation({
    mutationFn: studentApi.joinClass,
    onSuccess: async (data) => {
      // Primero la lista nueva y después elegirla: entra directo a la clase a la que se unió.
      await queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      selectProfile(data.profileId);
      toast.success(`¡Te has unido a ${data.classroom.name}!`);
      navigate('/my-class');
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
        setVerifyError('Esta clase está archivada.');
        setVerifyResult(null);
        setCodeType(null);
      } else if (result.teacherVerified === false) {
        setVerifyError('Tu profe aún está verificando su cuenta de docente. Mientras tanto, la clase funciona con la lista: avísale para que la verifique.');
        setVerifyResult(null);
        setCodeType(null);
      } else if (result.type === 'classroom' && result.acceptingStudents === false) {
        setVerifyError('Esta clase no está aceptando alumnos nuevos. Pídele a tu profesor que lo active.');
        setVerifyResult(null);
        setCodeType(null);
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setVerifyError(
        status === 429 ? 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
          : status === 403 ? 'Esta es una cuenta de docente: no puede unirse a una clase como estudiante.'
            : 'No encontramos ese código. Revísalo letra por letra con tu profe.',
      );
      setVerifyResult(null);
      setCodeType(null);
    } finally {
      setIsVerifying(false);
    }
  };

  // Código que llega en la URL (desde /unirse): se revisa una vez al abrir.
  const autoVerified = useRef(false);
  useEffect(() => {
    if (autoVerified.current || code.length < 6) return;
    autoVerified.current = true;
    void handleVerifyCode();
    // Solo al abrir con el código ya escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Go to step 2 (o a la lista, si la clase tiene nombres sin reclamar)
  const handleContinueToCharacter = async () => {
    if (!verifyResult) return;
    setRosterPick(null);
    setRosterNote(null);
    if (codeType === 'classroom') {
      setLoadingRoster(true);
      try {
        const list = (await authApi.classRoster(code)).data.data!;
        if (list.students.some((s) => s.state === 'new')) {
          setRoster(list);
          setStep(ROSTER_STEP);
          return;
        }
      } catch {
        // Sin lista: se sigue con el personaje nuevo (el servidor vuelve a comprobarlo al unirse).
      } finally {
        setLoadingRoster(false);
      }
    }
    setStep(2);
  };

  const pickRosterStudent = (student: RosterStudent) => {
    if (student.state !== 'new') {
      setRosterNote(`${student.name} ya tiene acceso. Si es tu nombre, pídele ayuda a tu profe.`);
      return;
    }
    setRosterNote(null);
    setRosterPick(student);
    setStep(2);
  };

  // Final link for roster mode
  const handleJoinRoster = async () => {
    if (!rosterPick) return;
    setIsLinking(true);
    try {
      const result = await studentApi.joinRoster({
        code: code.toUpperCase(),
        studentId: rosterPick.id,
        characterName: characterName.trim() || undefined,
        avatarGender,
      });
      await queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      selectProfile(result.profileId);
      toast.success(`¡Te has unido a ${result.classroom.name}!`);
      navigate('/my-class');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'No se pudo unir a la clase');
    } finally {
      setIsLinking(false);
    }
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
      await queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      selectProfile(result.data.profileId);
      toast.success(`¡Te has unido a ${result.data.classroom.name}!`);
      navigate('/my-class');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Error al vincular cuenta';
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  const totalSteps = codeType === 'classroom' && !rosterMode && step !== ROSTER_STEP ? 3 : 2;
  const isNameOptional = codeType === 'student' || rosterMode;
  // La lista se muestra como parte del paso 1 en la barra de progreso.
  const shownStep = step === ROSTER_STEP ? 1 : step;
  const joinTargetName = verifyResult?.classroomName;
  const joinTargetCode = verifyResult?.classroomCode || code.toUpperCase();

  const renderClassroomContext = () => {
    if (!joinTargetName || step === 1) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 dark:border-indigo-800/70 dark:from-indigo-950/40 dark:to-purple-950/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
            <School className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">
              Clase a la que te unirás
            </p>
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {joinTargetName}
            </p>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Código {joinTargetCode}
            </p>
            {rosterPick && step === 2 && (
              <p className="text-sm text-slate-700 dark:text-gray-200">
                Te unes como <strong>{rosterPick.name}</strong>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-start justify-center overflow-auto pt-8 px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl dark:bg-purple-900/20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl dark:bg-indigo-900/20" />
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
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-base">
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
                  s < shownStep
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : s === shownStep
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                {s < shownStep ? <Check size={16} /> : s}
              </motion.div>
              {s < totalSteps && (
                <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                  s < shownStep ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card principal */}
        <motion.div
          layout
          className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-xl rounded-3xl p-6 border border-gray-200/80 dark:border-gray-700/80 shadow-xl"
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
                <div className="relative bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200/60 dark:border-purple-800/60 rounded-2xl p-4">
                  <p className="text-gray-600 dark:text-gray-300 text-sm text-center">
                    Escribe el código que te dio tu profe. Puede ser <span className="text-purple-600 font-semibold">el código de tu clase</span> o <span className="text-blue-600 font-semibold">tu código personal</span>. ¡Yo lo detecto automáticamente!
                  </p>
                </div>

                <div>
                  <label htmlFor="join-code" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Tu código
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe tu código aquí"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                        setVerifyError('');
                        setVerifyResult(null);
                        setCodeType(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && !isVerifying && handleVerifyCode()}
                      className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border rounded-xl text-center text-2xl font-mono tracking-widest text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                        verifyError ? 'border-red-400 focus:ring-red-500' :
                        verifyResult ? 'border-green-400 focus:ring-green-500' :
                        'border-gray-200 dark:border-gray-700 focus:ring-purple-500'
                      }`}
                      id="join-code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
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
                          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border-purple-200 dark:border-purple-800'
                          : 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800'
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
                              <p className="text-gray-500 dark:text-gray-400 text-sm">{verifyResult.classroomName}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-gray-800 font-bold text-lg flex items-center gap-2">
                                <PartyPopper size={18} className="text-yellow-500" />
                                ¡Te estábamos esperando!
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
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
                      onClick={() => void handleContinueToCharacter()}
                      isLoading={loadingRoster}
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
                {renderClassroomContext()}

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    Nombre de tu personaje{isNameOptional ? ' (opcional)' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sir Lancelot, Luna Mágica..."
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  {isNameOptional && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Si lo dejas vacío, se usará el nombre que asignó tu profesor</p>
                  )}
                </div>

                {/* Avatar gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">
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
                            : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
                        <p className="text-gray-800 dark:text-white font-medium text-center">
                          {gender === 'MALE' ? 'Masculino' : 'Femenino'}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Sparkles size={14} />
                  Podrás personalizar tu avatar con atuendos en la tienda.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-0"
                    onClick={() => setStep(rosterMode ? ROSTER_STEP : 1)}
                    leftIcon={<ArrowLeft size={18} />}
                  >
                    Atrás
                  </Button>

                  {codeType === 'classroom' && !rosterMode ? (
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
                      onClick={rosterMode ? handleJoinRoster : handleLinkAccount}
                      disabled={isLinking}
                      isLoading={isLinking}
                    >
                      ¡Comenzar aventura!
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== Lista de la clase: el alumno toca su nombre ===== */}
            {step === ROSTER_STEP && roster && (
              <motion.div
                key="roster"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {renderClassroomContext()}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Tu profe ya tiene la lista de esta clase. Toca tu nombre para unirte con todo lo que ya ganaste.
                </p>
                <RosterPicker students={roster.students} onPick={pickRosterStudent} />
                {rosterNote && (
                  <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{rosterNote}</p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  ¿No estás en la lista? Pídele a tu profe que te agregue o que te dé tu código personal.
                </p>
                <Button
                  variant="secondary"
                  className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-0"
                  onClick={() => { setStep(1); setRosterNote(null); }}
                  leftIcon={<ArrowLeft size={18} />}
                >
                  Atrás
                </Button>
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
                {renderClassroomContext()}

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
                          : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
                      <h3 className="font-bold text-gray-800 dark:text-white text-lg">{cls.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{cls.description}</p>
                    </motion.button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-0"
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
            onClick={() => navigate('/my-classes')}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm"
          >
            ← Volver a mis clases
          </button>
        </div>
      </motion.div>
    </div>
  );
};
