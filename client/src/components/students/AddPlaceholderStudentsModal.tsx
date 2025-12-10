import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UserPlus, 
  Users, 
  Plus, 
  Trash2,
  Shield,
  Wand2,
  Compass,
  FlaskConical,
  Loader2,
  CheckCircle,
  Copy,
  Download
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { placeholderStudentApi, type PlaceholderStudent } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  onStudentsCreated: () => void;
}

const CHARACTER_CLASSES = [
  { value: 'GUARDIAN', label: 'Guardián', icon: Shield, color: 'text-blue-500' },
  { value: 'ARCANE', label: 'Arcano', icon: Wand2, color: 'text-purple-500' },
  { value: 'EXPLORER', label: 'Explorador', icon: Compass, color: 'text-green-500' },
  { value: 'ALCHEMIST', label: 'Alquimista', icon: FlaskConical, color: 'text-orange-500' },
];

type CharacterClass = 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';

interface StudentInput {
  id: string;
  displayName: string;
  characterClass: CharacterClass;
}

export const AddPlaceholderStudentsModal = ({ isOpen, onClose, classroomId, onStudentsCreated }: Props) => {
  const [step, setStep] = useState<'input' | 'result'>('input');
  const [students, setStudents] = useState<StudentInput[]>([
    { id: '1', displayName: '', characterClass: 'GUARDIAN' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<PlaceholderStudent[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [inputMode, setInputMode] = useState<'individual' | 'bulk'>('individual');

  const addStudent = () => {
    const classIndex = students.length % 4;
    setStudents([...students, { 
      id: Date.now().toString(), 
      displayName: '', 
      characterClass: CHARACTER_CLASSES[classIndex].value as CharacterClass
    }]);
  };

  const removeStudent = (id: string) => {
    if (students.length > 1) {
      setStudents(students.filter(s => s.id !== id));
    }
  };

  const updateStudent = (id: string, field: keyof StudentInput, value: string) => {
    setStudents(students.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleSubmit = async () => {
    let studentsToCreate: Array<{ displayName: string; characterClass?: string }> = [];

    if (inputMode === 'bulk') {
      // Parsear nombres del textarea (uno por línea)
      const names = bulkInput.split('\n')
        .map(n => n.trim())
        .filter(n => n.length >= 2);
      
      if (names.length === 0) {
        toast.error('Ingresa al menos un nombre');
        return;
      }

      studentsToCreate = names.map((name, i) => ({
        displayName: name,
        characterClass: CHARACTER_CLASSES[i % 4].value,
      }));
    } else {
      // Modo individual
      const validStudents = students.filter(s => s.displayName.trim().length >= 2);
      if (validStudents.length === 0) {
        toast.error('Ingresa al menos un nombre válido');
        return;
      }

      studentsToCreate = validStudents.map(s => ({
        displayName: s.displayName.trim(),
        characterClass: s.characterClass,
      }));
    }

    setIsLoading(true);
    try {
      const result = await placeholderStudentApi.createBulk(classroomId, studentsToCreate);
      setCreatedStudents(result.data);
      setStep('result');
      onStudentsCreated();
      toast.success(`${result.data.length} estudiante(s) creado(s)`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al crear estudiantes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSelectedPDF = async () => {
    if (createdStudents.length === 0) return;
    try {
      await placeholderStudentApi.downloadSelectedCardsPDF(
        classroomId, 
        createdStudents.map(s => s.id)
      );
      toast.success('PDF descargado');
    } catch (error) {
      toast.error('Error al descargar PDF');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado');
  };

  const handleClose = () => {
    setStep('input');
    setStudents([{ id: '1', displayName: '', characterClass: 'GUARDIAN' }]);
    setBulkInput('');
    setCreatedStudents([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {step === 'input' ? 'Añadir Estudiantes' : 'Estudiantes Creados'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {step === 'input' 
                    ? 'Crea estudiantes sin cuenta que podrán vincular después' 
                    : 'Descarga las tarjetas con los códigos de vinculación'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {step === 'input' ? (
              <>
                {/* Tabs de modo de entrada */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setInputMode('individual')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      inputMode === 'individual'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setInputMode('bulk')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      inputMode === 'bulk'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    Lista rápida
                  </button>
                </div>

                {inputMode === 'individual' ? (
                  <div className="space-y-3">
                    {students.map((student, index) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <span className="text-sm font-medium text-gray-400 w-6">{index + 1}</span>
                        
                        <Input
                          placeholder="Nombre del estudiante"
                          value={student.displayName}
                          onChange={(e) => updateStudent(student.id, 'displayName', e.target.value)}
                          className="flex-1"
                        />

                        <select
                          value={student.characterClass}
                          onChange={(e) => updateStudent(student.id, 'characterClass', e.target.value)}
                          className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                        >
                          {CHARACTER_CLASSES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => removeStudent(student.id)}
                          disabled={students.length === 1}
                          className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}

                    <Button
                      variant="secondary"
                      onClick={addStudent}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir otro estudiante
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Escribe un nombre por línea. Las clases se asignarán automáticamente.
                    </p>
                    <textarea
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="Juan Pérez&#10;María García&#10;Carlos López&#10;..."
                      className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      {bulkInput.split('\n').filter(n => n.trim().length >= 2).length} nombres válidos
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* Lista de estudiantes creados */}
                <div className="space-y-2">
                  {createdStudents.map((student) => {
                    const classInfo = CHARACTER_CLASSES.find(c => c.value === student.characterClass);
                    const Icon = classInfo?.icon || Shield;
                    
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center ${classInfo?.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {student.displayName}
                            </p>
                            <p className="text-xs text-gray-500">{classInfo?.label}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-400 tracking-wider">
                              {student.linkCode}
                            </span>
                          </div>
                          <button
                            onClick={() => copyCode(student.linkCode)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="Copiar código"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Info box */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        ¡Estudiantes creados exitosamente!
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Descarga el PDF con las tarjetas de vinculación para entregar a tus estudiantes. 
                        Cada tarjeta incluye el código único y las instrucciones para vincular su cuenta.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {step === 'input' ? (
              <>
                <Button variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-2" />
                      Crear estudiantes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={handleClose}>
                  Cerrar
                </Button>
                <Button onClick={handleDownloadSelectedPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar tarjetas PDF
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
