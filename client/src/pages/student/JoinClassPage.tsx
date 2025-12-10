import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gamepad2, ArrowRight, Check, ArrowLeft, Sparkles, Link2, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AvatarRenderer } from '../../components/avatar/AvatarRenderer';
import { studentApi, CHARACTER_CLASSES, type CharacterClass, type AvatarGender } from '../../lib/studentApi';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';

export const JoinClassPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [avatarGender, setAvatarGender] = useState<AvatarGender>('MALE');
  
  // Estado para modo de vinculación
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [linkStep, setLinkStep] = useState(1); // 1: código, 2: avatar
  const [linkCode, setLinkCode] = useState('');
  const [linkCharacterName, setLinkCharacterName] = useState('');
  const [linkAvatarGender, setLinkAvatarGender] = useState<AvatarGender>('MALE');
  const [isLinking, setIsLinking] = useState(false);

  const joinMutation = useMutation({
    mutationFn: studentApi.joinClass,
    onSuccess: (data) => {
      toast.success(`¡Te has unido a ${data.classroom.name}!`);
      navigate('/dashboard');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error.message || 'Error al unirse a la clase';
      if (message.includes('permiso') || message.includes('No tienes')) {
        toast.error('Solo los estudiantes pueden unirse a clases. Registra una cuenta de estudiante.');
      } else {
        toast.error(message);
      }
    },
  });

  const handleSubmit = () => {
    if (!selectedClass) return;
    
    joinMutation.mutate({
      code: code.toUpperCase(),
      characterName,
      characterClass: selectedClass,
      avatarGender,
    });
  };

  const handleLinkAccount = async () => {
    if (linkCode.length < 6) return;
    
    setIsLinking(true);
    try {
      const result = await placeholderStudentApi.linkAccount({
        linkCode: linkCode.toUpperCase(),
        characterName: linkCharacterName.trim() || undefined,
        avatarGender: linkAvatarGender,
      });
      toast.success(`¡Cuenta vinculada a ${result.data.classroom.name}!`);
      navigate('/dashboard');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Error al vincular cuenta';
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/30"
          >
            <Gamepad2 className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
            Unirse a una Clase
          </h1>
          <p className="text-purple-200/70 mt-2 text-lg">
            {step === 1 && 'Ingresa el código que te dio tu profesor'}
            {step === 2 && 'Crea tu personaje para la aventura'}
            {step === 3 && 'Elige tu clase de personaje'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <motion.div
              key={s}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: s * 0.1 }}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                s <= step 
                  ? 'bg-gradient-to-r from-purple-400 to-indigo-400 shadow-lg shadow-purple-500/50' 
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Card principal */}
        <motion.div 
          layout
          className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl"
        >
          {/* Step 1: Código */}
          {step === 1 && !isLinkMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Código de clase
                </label>
                <input
                  type="text"
                  placeholder="ABC12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-6 py-4 bg-slate-900/50 border border-white/10 rounded-xl text-center text-2xl font-mono tracking-widest text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  maxLength={8}
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-4 text-lg"
                size="lg"
                onClick={() => setStep(2)}
                disabled={code.length < 6}
                rightIcon={<ArrowRight size={20} />}
              >
                Continuar
              </Button>

              {/* Separador */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-800/50 text-purple-200/60">o</span>
                </div>
              </div>

              {/* Opción de vincular */}
              <button
                onClick={() => setIsLinkMode(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-xl text-blue-300 transition-all"
              >
                <Link2 size={18} />
                <span>Tengo un código de estudiante</span>
              </button>
              <p className="text-center text-purple-200/50 text-xs">
                Si tu profesor te dio una tarjeta con un código personal
              </p>
            </motion.div>
          )}

          {/* Modo vincular cuenta - Paso 1: Código */}
          {step === 1 && isLinkMode && linkStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-xl mb-3">
                  <Link2 className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Vincular mi cuenta</h3>
                <p className="text-purple-200/60 text-sm">Ingresa el código de la tarjeta que te dio tu profesor</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Código de estudiante
                </label>
                <input
                  type="text"
                  placeholder="ABC123"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  className="w-full px-6 py-4 bg-slate-900/50 border border-white/10 rounded-xl text-center text-2xl font-mono tracking-widest text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  maxLength={8}
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-4 text-lg"
                size="lg"
                onClick={() => setLinkStep(2)}
                disabled={linkCode.length < 6}
                rightIcon={<ArrowRight size={20} />}
              >
                Continuar
              </Button>

              <button
                onClick={() => {
                  setIsLinkMode(false);
                  setLinkCode('');
                  setLinkStep(1);
                }}
                className="w-full text-center text-purple-200/60 hover:text-purple-200 text-sm transition-colors"
              >
                ← Volver a unirse con código de clase
              </button>
            </motion.div>
          )}

          {/* Modo vincular cuenta - Paso 2: Avatar y nombre */}
          {step === 1 && isLinkMode && linkStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Personaliza tu personaje</h3>
                <p className="text-purple-200/60 text-sm">Elige cómo quieres que se vea tu avatar</p>
              </div>

              {/* Nombre de personaje */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Nombre de tu personaje (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sir Lancelot, Luna Mágica..."
                  value={linkCharacterName}
                  onChange={(e) => setLinkCharacterName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-purple-200/40 mt-1">Si lo dejas vacío, se usará el nombre que asignó tu profesor</p>
              </div>

              {/* Selección de género/avatar */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-3">
                  Elige tu avatar
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLinkAvatarGender('MALE')}
                    className={`relative p-4 rounded-2xl transition-all ${
                      linkAvatarGender === 'MALE'
                        ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400'
                        : 'bg-slate-900/50 border-2 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {linkAvatarGender === 'MALE' && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex justify-center mb-2">
                      <AvatarRenderer gender="MALE" size="lg" equippedItems={[]} />
                    </div>
                    <p className="text-white font-medium text-center">Masculino</p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLinkAvatarGender('FEMALE')}
                    className={`relative p-4 rounded-2xl transition-all ${
                      linkAvatarGender === 'FEMALE'
                        ? 'bg-gradient-to-br from-pink-500/30 to-purple-500/30 border-2 border-pink-400'
                        : 'bg-slate-900/50 border-2 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {linkAvatarGender === 'FEMALE' && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex justify-center mb-2">
                      <AvatarRenderer gender="FEMALE" size="lg" equippedItems={[]} />
                    </div>
                    <p className="text-white font-medium text-center">Femenino</p>
                  </motion.button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setLinkStep(1)}
                  leftIcon={<ArrowLeft size={18} />}
                >
                  Atrás
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
                  size="lg"
                  onClick={handleLinkAccount}
                  disabled={isLinking}
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-5 h-5 mr-2" />
                      Vincular cuenta
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Nombre y género de personaje */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Nombre de tu personaje
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sir Lancelot, Luna Mágica..."
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Selección de género/avatar */}
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-3">
                  Elige tu avatar
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAvatarGender('MALE')}
                    className={`relative p-4 rounded-2xl transition-all ${
                      avatarGender === 'MALE'
                        ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400'
                        : 'bg-slate-900/50 border-2 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {avatarGender === 'MALE' && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex justify-center mb-2">
                      <AvatarRenderer gender="MALE" size="lg" equippedItems={[]} />
                    </div>
                    <p className="text-white font-medium text-center">Masculino</p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAvatarGender('FEMALE')}
                    className={`relative p-4 rounded-2xl transition-all ${
                      avatarGender === 'FEMALE'
                        ? 'bg-gradient-to-br from-pink-500/30 to-purple-500/30 border-2 border-pink-400'
                        : 'bg-slate-900/50 border-2 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {avatarGender === 'FEMALE' && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex justify-center mb-2">
                      <AvatarRenderer gender="FEMALE" size="lg" equippedItems={[]} />
                    </div>
                    <p className="text-white font-medium text-center">Femenino</p>
                  </motion.button>
                </div>
              </div>

              <p className="text-sm text-purple-200/60 flex items-center gap-2">
                <Sparkles size={14} />
                Podrás personalizar tu avatar con atuendos en la tienda.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft size={18} />}
                >
                  Atrás
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                  onClick={() => setStep(3)}
                  disabled={characterName.length < 2}
                  rightIcon={<ArrowRight size={20} />}
                >
                  Continuar
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Clase de personaje */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(CHARACTER_CLASSES) as [CharacterClass, typeof CHARACTER_CLASSES.GUARDIAN][]).map(
                  ([key, value], index) => (
                    <motion.button
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedClass(key)}
                      className={`
                        relative p-5 rounded-2xl text-left transition-all duration-300
                        ${selectedClass === key
                          ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border-2 border-purple-400 shadow-lg shadow-purple-500/20'
                          : 'bg-slate-900/50 border-2 border-white/10 hover:border-white/20'
                        }
                      `}
                    >
                      {selectedClass === key && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                      <span className="text-4xl block mb-2">{value.icon}</span>
                      <h3 className="font-bold text-white text-lg">
                        {value.name}
                      </h3>
                      <p className="text-sm text-purple-200/60 mt-1 line-clamp-2">
                        {value.description}
                      </p>
                    </motion.button>
                  )
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                  onClick={() => setStep(2)}
                  leftIcon={<ArrowLeft size={18} />}
                >
                  Atrás
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                  onClick={handleSubmit}
                  disabled={!selectedClass}
                  isLoading={joinMutation.isPending}
                >
                  ¡Unirme a la clase!
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Link para volver */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-purple-300/60 hover:text-purple-200 transition-colors text-sm"
          >
            ← Volver al dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
};
