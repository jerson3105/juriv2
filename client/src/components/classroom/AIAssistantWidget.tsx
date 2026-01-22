import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, X, Send, Loader2, Check, AlertCircle, 
  User, Zap, Heart, Coins
} from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAssistantApi, type AIInterpretation, type StudentMatch } from '../../lib/aiAssistantApi';

interface AIAssistantWidgetProps {
  classroomId: string;
}

type WidgetState = 'closed' | 'input' | 'processing' | 'preview' | 'success' | 'error';

export function AIAssistantWidget({ classroomId }: AIAssistantWidgetProps) {
  const [state, setState] = useState<WidgetState>('closed');
  const [command, setCommand] = useState('');
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state]);

  const handleOpen = () => {
    setState('input');
    setCommand('');
    setInterpretation(null);
    setSelectedStudents({});
  };

  const handleClose = () => {
    setState('closed');
    setCommand('');
    setInterpretation(null);
    setSelectedStudents({});
  };

  const handleSubmit = async () => {
    if (!command.trim()) return;

    setState('processing');
    try {
      const result = await aiAssistantApi.processCommand(classroomId, command);
      
      if (result.success && result.interpretation) {
        setInterpretation(result.interpretation);
        
        // Pre-seleccionar estudiantes encontrados
        const preSelected: Record<string, string> = {};
        result.interpretation.students.forEach((s, idx) => {
          if (s.status === 'FOUND' && s.selectedId) {
            preSelected[idx.toString()] = s.selectedId;
          }
        });
        setSelectedStudents(preSelected);
        
        setState('preview');
      } else {
        setInterpretation(result.interpretation);
        setState('error');
      }
    } catch (error: any) {
      console.error('Error processing command:', error);
      toast.error('Error al procesar el comando');
      setState('error');
    }
  };

  const handleSelectStudent = (studentIndex: number, studentId: string) => {
    setSelectedStudents(prev => ({
      ...prev,
      [studentIndex.toString()]: studentId,
    }));
  };

  const getSelectedStudentIds = (): string[] => {
    if (!interpretation) return [];
    
    return interpretation.students
      .map((s, idx) => {
        if (s.status === 'FOUND' && s.selectedId) return s.selectedId;
        if (s.status === 'MULTIPLE') return selectedStudents[idx.toString()];
        return null;
      })
      .filter((id): id is string => id !== null && id !== undefined);
  };

  const canExecute = (): boolean => {
    if (!interpretation) return false;
    if (interpretation.actions.length === 0) return false;
    if (!interpretation.behavior && !interpretation.badge) return false;
    
    const selectedIds = getSelectedStudentIds();
    return selectedIds.length > 0;
  };

  const handleExecute = async () => {
    if (!interpretation || !canExecute()) return;

    setIsExecuting(true);
    try {
      const studentIds = getSelectedStudentIds();

      if (studentIds.length === 0) {
        toast.error('Faltan datos para ejecutar');
        return;
      }

      const results: string[] = [];
      let hasError = false;

      // Ejecutar comportamiento si está en las acciones
      if (interpretation.actions.includes('APPLY_BEHAVIOR') && interpretation.behavior) {
        const behaviorResult = await aiAssistantApi.executeAction(
          classroomId,
          'APPLY_BEHAVIOR',
          interpretation.behavior.id,
          studentIds
        );
        if (behaviorResult.success) {
          results.push(behaviorResult.message);
        } else {
          hasError = true;
          toast.error(behaviorResult.message);
        }
      }

      // Ejecutar insignia si está en las acciones
      if (interpretation.actions.includes('AWARD_BADGE') && interpretation.badge) {
        const badgeResult = await aiAssistantApi.executeAction(
          classroomId,
          'AWARD_BADGE',
          interpretation.badge.id,
          studentIds
        );
        if (badgeResult.success) {
          results.push(badgeResult.message);
        } else {
          hasError = true;
          toast.error(badgeResult.message);
        }
      }

      if (results.length > 0) {
        setState('success');
        toast.success(results.join(' | '));
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else if (!hasError) {
        toast.error('No se ejecutó ninguna acción');
      }
    } catch (error: any) {
      console.error('Error executing action:', error);
      toast.error('Error al ejecutar la acción');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderStudentStatus = (student: StudentMatch, index: number) => {
    if (student.status === 'FOUND') {
      return (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check size={16} />
          <span>{student.selectedName || student.name}</span>
        </div>
      );
    }

    if (student.status === 'MULTIPLE' && student.matches) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertCircle size={16} />
            <span>"{student.name}" - Selecciona:</span>
          </div>
          <div className="ml-6 space-y-1">
            {student.matches.map((match) => (
              <label key={match.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`student-${index}`}
                  checked={selectedStudents[index.toString()] === match.id}
                  onChange={() => handleSelectStudent(index, match.id)}
                  className="text-emerald-500"
                />
                <span className="text-sm">{match.fullName}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <X size={16} />
        <span>"{student.name}" - No encontrado</span>
      </div>
    );
  };

  return (
    <>
      {/* Botón flotante con animación IA */}
      <AnimatePresence>
        {state === 'closed' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/40 flex items-center justify-center overflow-hidden"
          >
            {/* Anillo de pulso exterior */}
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-400/30"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-teal-400/30"
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.5, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.5,
              }}
            />
            
            {/* Brillo giratorio */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent)',
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            
            {/* Icono con animación */}
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-10"
            >
              <Sparkles size={24} />
            </motion.div>
            
            {/* Partículas decorativas */}
            <motion.div
              className="absolute w-1.5 h-1.5 bg-white rounded-full"
              animate={{
                x: [0, -8, 0],
                y: [0, -12, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0,
              }}
            />
            <motion.div
              className="absolute w-1 h-1 bg-white rounded-full"
              animate={{
                x: [0, 10, 0],
                y: [0, -8, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.5,
              }}
            />
            <motion.div
              className="absolute w-1 h-1 bg-white rounded-full"
              animate={{
                x: [0, -5, 0],
                y: [0, 10, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 1,
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel del asistente */}
      <AnimatePresence>
        {state !== 'closed' && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} />
                <span className="font-semibold">Asistente IA</span>
              </div>
              <button onClick={handleClose} className="hover:bg-white/20 rounded-lg p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {/* Estado: Input */}
              {state === 'input' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Escribe un comando natural, por ejemplo:
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                    "Kevin, María y Juan presentaron su cuaderno"
                  </p>
                  <textarea
                    ref={inputRef}
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Escribe aquí..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!command.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
                  >
                    <Send size={18} />
                    Procesar
                  </button>
                </div>
              )}

              {/* Estado: Processing */}
              {state === 'processing' && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-emerald-500" />
                  <p className="text-gray-600 dark:text-gray-400">Analizando comando...</p>
                </div>
              )}

              {/* Estado: Preview */}
              {state === 'preview' && interpretation && (
                <div className="space-y-4">
                  {/* Acciones detectadas */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {interpretation.actions.length > 1 ? 'Acciones detectadas:' : 'Acción detectada:'}
                    </p>
                    {interpretation.behavior && (
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-600 rounded-lg">
                        <span className="text-2xl">{interpretation.behavior.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{interpretation.behavior.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {interpretation.behavior.xpValue > 0 && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <Zap size={12} /> +{interpretation.behavior.xpValue} XP
                              </span>
                            )}
                            {interpretation.behavior.hpValue > 0 && (
                              <span className="flex items-center gap-1 text-red-600">
                                <Heart size={12} /> -{interpretation.behavior.hpValue} HP
                              </span>
                            )}
                            {interpretation.behavior.gpValue > 0 && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Coins size={12} /> +{interpretation.behavior.gpValue} GP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {interpretation.badge && (
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-600 rounded-lg">
                        <span className="text-2xl">{interpretation.badge.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{interpretation.badge.name}</p>
                          <p className="text-xs text-gray-500">🏅 Insignia</p>
                        </div>
                      </div>
                    )}
                    {interpretation.actions.length === 0 && (
                      <p className="text-amber-600">No se pudo determinar la acción</p>
                    )}
                  </div>

                  {/* Estudiantes */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                      <User size={14} /> Estudiantes:
                    </p>
                    <div className="space-y-2">
                      {interpretation.students.map((student, idx) => (
                        <div key={idx} className="text-sm">
                          {renderStudentStatus(student, idx)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clarificación */}
                  {interpretation.clarificationNeeded && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                      {interpretation.clarificationNeeded}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setState('input')}
                      className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Modificar
                    </button>
                    <button
                      onClick={handleExecute}
                      disabled={!canExecute() || isExecuting}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Check size={18} />
                      )}
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              {/* Estado: Success */}
              {state === 'success' && interpretation && (
                <div className="py-4 space-y-4">
                  {/* Animación de comportamiento */}
                  {interpretation.behavior && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-4 rounded-xl text-white text-center ${
                        interpretation.behavior.isPositive 
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                          : 'bg-gradient-to-br from-red-500 to-rose-600'
                      }`}
                    >
                      <p className="text-white/80 text-sm mb-2">
                        {interpretation.behavior.isPositive ? '¡Puntos otorgados!' : 'Puntos descontados'}
                      </p>
                      <div className="flex items-center justify-center gap-4">
                        {interpretation.behavior.xpValue > 0 && (
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-2xl font-bold">
                              <Zap size={20} />
                              <span>+{interpretation.behavior.xpValue}</span>
                            </div>
                            <span className="text-white/70 text-xs">XP</span>
                          </div>
                        )}
                        {interpretation.behavior.gpValue > 0 && (
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-2xl font-bold">
                              <Coins size={20} />
                              <span>+{interpretation.behavior.gpValue}</span>
                            </div>
                            <span className="text-white/70 text-xs">Oro</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Animación de insignia */}
                  {interpretation.badge && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: interpretation.behavior ? 0.3 : 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-center"
                    >
                      <p className="text-white/80 text-sm mb-2">🏅 ¡Insignia otorgada!</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl">{interpretation.badge.icon}</span>
                        <span className="text-lg font-bold">{interpretation.badge.name}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Check final */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Check size={24} className="text-green-600" />
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Estado: Error */}
              {state === 'error' && (
                <div className="space-y-4">
                  <div className="py-6 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle size={32} className="text-red-600" />
                    </div>
                    <p className="text-red-600 font-medium text-center">
                      {interpretation?.clarificationNeeded || 'No pude entender el comando'}
                    </p>
                  </div>
                  <button
                    onClick={() => setState('input')}
                    className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
