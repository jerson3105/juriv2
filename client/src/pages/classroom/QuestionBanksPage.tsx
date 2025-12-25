import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronRight,
  HelpCircle,
  CheckCircle,
  ArrowLeftRight,
  Sparkles,
  Copy,
  ListChecks,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  questionBankApi,
  type QuestionBank,
  type Question,
  type CreateBankData,
  type CreateQuestionData,
  type BankQuestionType,
  type QuestionDifficulty,
  type QuestionOption,
  type MatchingPair,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  BANK_ICONS,
  BANK_COLORS,
  getBankEmoji,
  parseQuestionData,
} from '../../lib/questionBankApi';

type ViewMode = 'banks' | 'questions';

export const QuestionBanksPage = () => {
  const { classroom } = useOutletContext<{ classroom: any }>();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<ViewMode>('banks');
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showBankModal, setShowBankModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'bank' | 'question'; id: string } | null>(null);
  const [importingCSV, setImportingCSV] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ questions: CreateQuestionData[]; errors: string[] } | null>(null);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [csvTextInput, setCsvTextInput] = useState('');

  // Fetch banks
  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['questionBanks', classroom?.id],
    queryFn: () => questionBankApi.getBanks(classroom.id),
    enabled: !!classroom?.id,
  });

  // Fetch questions when a bank is selected
  const { data: questions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions', selectedBank?.id],
    queryFn: () => questionBankApi.getQuestions(selectedBank!.id),
    enabled: !!selectedBank?.id && viewMode === 'questions',
  });

  // Mutations
  const createBankMutation = useMutation({
    mutationFn: (data: CreateBankData) => questionBankApi.createBank(classroom.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
      toast.success('Banco creado exitosamente');
      setShowBankModal(false);
    },
    onError: () => toast.error('Error al crear el banco'),
  });

  const updateBankMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => questionBankApi.updateBank(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
      toast.success('Banco actualizado');
      setShowBankModal(false);
      setEditingBank(null);
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (id: string) => questionBankApi.deleteBank(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
      toast.success('Banco eliminado');
      setShowDeleteConfirm(null);
      if (selectedBank) {
        setSelectedBank(null);
        setViewMode('banks');
      }
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const createQuestionMutation = useMutation({
    mutationFn: (data: CreateQuestionData) => questionBankApi.createQuestion(selectedBank!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', selectedBank?.id] });
      queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
      toast.success('Pregunta creada');
      setShowQuestionModal(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Error al crear pregunta'),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => questionBankApi.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', selectedBank?.id] });
      toast.success('Pregunta actualizada');
      setShowQuestionModal(false);
      setEditingQuestion(null);
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => questionBankApi.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', selectedBank?.id] });
      queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
      toast.success('Pregunta eliminada');
      setShowDeleteConfirm(null);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const handleSelectBank = (bank: QuestionBank) => {
    setSelectedBank(bank);
    setViewMode('questions');
  };

  const handleBackToBanks = () => {
    setViewMode('banks');
    setSelectedBank(null);
  };

  // Confirm and import questions
  const handleConfirmImport = async () => {
    if (!csvPreview || !selectedBank) return;
    
    setImportingCSV(true);
    let successCount = 0;
    let errorCount = 0;

    for (const questionData of csvPreview.questions) {
      try {
        await questionBankApi.createQuestion(selectedBank.id, questionData);
        successCount++;
      } catch (err) {
        errorCount++;
        console.error('Error al crear pregunta:', err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['questions', selectedBank.id] });
    queryClient.invalidateQueries({ queryKey: ['questionBanks', classroom.id] });
    
    if (successCount > 0) {
      toast.success(`${successCount} preguntas importadas correctamente`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} preguntas con errores`);
    }

    setCsvPreview(null);
    setImportingCSV(false);
  };

  // Process pasted CSV text from AI
  const handleProcessCSVText = () => {
    if (!csvTextInput.trim() || !selectedBank) return;
    
    const text = csvTextInput;
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      toast.error('El texto CSV está vacío o no tiene datos');
      return;
    }

    // Detect delimiter
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    // Parse header
    const rawHeaders = parseCSVLine(lines[0], delimiter);
    const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/[^a-z]/g, ''));
    
    const requiredHeaders = ['type', 'questiontext'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      toast.error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`);
      return;
    }

    // Parse rows for preview
    const parsedQuestions: CreateQuestionData[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const questionData: CreateQuestionData = {
          type: (row.type?.toUpperCase() || 'SINGLE_CHOICE') as BankQuestionType,
          difficulty: (row.difficulty?.toUpperCase() || 'MEDIUM') as QuestionDifficulty,
          points: parseInt(row.points) || 10,
          questionText: row.questiontext || '',
          timeLimitSeconds: parseInt(row.timelimitseconds) || 30,
          explanation: row.explanation || undefined,
        };

        // Parse type-specific fields
        if (questionData.type === 'TRUE_FALSE') {
          questionData.correctAnswer = row.correctanswer?.toLowerCase() === 'true';
        } else if (questionData.type === 'SINGLE_CHOICE' || questionData.type === 'MULTIPLE_CHOICE') {
          if (row.options) {
            try {
              questionData.options = JSON.parse(row.options);
            } catch {
              errors.push(`Línea ${i + 1}: Error al parsear opciones JSON`);
              questionData.options = [];
            }
          }
        } else if (questionData.type === 'MATCHING') {
          if (row.pairs) {
            try {
              questionData.pairs = JSON.parse(row.pairs);
            } catch {
              errors.push(`Línea ${i + 1}: Error al parsear pares JSON`);
              questionData.pairs = [];
            }
          }
        }

        // Validate question
        if (!questionData.questionText) {
          errors.push(`Línea ${i + 1}: Falta el texto de la pregunta`);
        } else if (!['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING'].includes(questionData.type)) {
          errors.push(`Línea ${i + 1}: Tipo de pregunta inválido "${questionData.type}"`);
        } else {
          parsedQuestions.push(questionData);
        }
      } catch (err) {
        errors.push(`Línea ${i + 1}: Error de formato`);
      }
    }

    // Show preview modal
    setCsvPreview({ questions: parsedQuestions, errors });
    setShowAIImportModal(false);
    setCsvTextInput('');
  };

  // Helper to parse CSV line - handles Excel format with quoted fields containing JSON
  const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    // Remove BOM if present
    if (line.charCodeAt(0) === 0xFEFF) {
      line = line.substring(1);
    }
    
    // Remove trailing carriage return if present
    line = line.replace(/\r$/, '');
    
    // Fix Excel bug: if entire line is wrapped in quotes, unwrap it
    if (line.startsWith('"') && line.endsWith('"') && !line.startsWith('""')) {
      // Check if this looks like a fully-quoted line (Excel sometimes does this)
      const testUnwrap = line.slice(1, -1).replace(/""/g, '"');
      // If unwrapped version has the expected number of delimiters, use it
      const delimCount = (testUnwrap.match(new RegExp(delimiter, 'g')) || []).length;
      if (delimCount >= 3) {
        line = testUnwrap;
        console.log('Unwrapped Excel-quoted line');
      }
    }
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      // Only toggle quotes if it's at start of field or after delimiter
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote ("") - add single quote and skip next
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator - only when not in quotes
        result.push(cleanCSVValue(current));
        current = '';
      } else {
        current += char;
      }
    }
    // Don't forget last field
    result.push(cleanCSVValue(current));
    
    // Debug: if only 1 field, something went wrong
    if (result.length === 1 && line.includes(delimiter)) {
      console.warn('CSV Parse warning: Line has delimiter but parsed as 1 field');
      console.warn('inQuotes ended as:', inQuotes);
      console.warn('Line preview:', line.substring(0, 100));
    }
    
    console.log('Parsed line into', result.length, 'fields:', result.map(r => r.substring(0, 30)));
    return result;
  };

  // Clean CSV value - remove surrounding quotes and unescape
  const cleanCSVValue = (value: string): string => {
    let cleaned = value.trim();
    // Remove surrounding quotes if present
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    // Replace escaped quotes (Excel format)
    cleaned = cleaned.replace(/""/g, '"');
    return cleaned;
  };

  const filteredBanks = banks.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredQuestions = questions.filter(q =>
    q.questionText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {viewMode === 'questions' && (
            <button
              onClick={handleBackToBanks}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180 text-gray-500" />
            </button>
          )}
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              {viewMode === 'banks' ? 'Banco de Preguntas' : selectedBank?.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {viewMode === 'banks' 
                ? `${banks.length} bancos creados`
                : `${questions.length} preguntas`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'questions' && (
            <button
              onClick={() => setShowAIImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg"
            >
              <Sparkles size={18} />
              Generar con IA
            </button>
          )}
          <button
            onClick={() => viewMode === 'banks' ? setShowBankModal(true) : setShowQuestionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-colors shadow-lg"
          >
            <Plus size={18} />
            {viewMode === 'banks' ? 'Nuevo Banco' : 'Nueva Pregunta'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={viewMode === 'banks' ? 'Buscar bancos...' : 'Buscar preguntas...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'banks' ? (
          <motion.div
            key="banks"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {loadingBanks ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))
            ) : filteredBanks.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No se encontraron bancos' : 'No hay bancos de preguntas aún'}
                </p>
                <button
                  onClick={() => setShowBankModal(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Crear el primero
                </button>
              </div>
            ) : (
              filteredBanks.map((bank) => (
                <motion.div
                  key={bank.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group border-l-4"
                  style={{ borderLeftColor: bank.color }}
                  onClick={() => handleSelectBank(bank)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: bank.color + '30' }}
                    >
                      {getBankEmoji(bank.icon)}
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBank(bank);
                          setShowBankModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical size={16} className="text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-1">{bank.name}</h3>
                  {bank.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {bank.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {bank.questionCount || 0} preguntas
                    </span>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="questions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            {loadingQuestions ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
              ))
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No se encontraron preguntas' : 'No hay preguntas en este banco'}
                </p>
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Agregar la primera
                </button>
              </div>
            ) : (
              filteredQuestions.map((question, index) => {
                parseQuestionData(question);
                return (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 dark:text-white font-medium mb-2 line-clamp-2">
                          {question.questionText}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                            {QUESTION_TYPE_LABELS[question.type]}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${DIFFICULTY_COLORS[question.difficulty]}`}>
                            {DIFFICULTY_LABELS[question.difficulty]}
                          </span>
                          <span className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 rounded text-xs text-violet-600 dark:text-violet-400">
                            {question.points} pts
                          </span>
                          {question.imageUrl && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs text-blue-600 dark:text-blue-400">
                              📷 Imagen
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingQuestion(question);
                            setShowQuestionModal(true);
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <Edit2 size={16} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm({ type: 'question', id: question.id })}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank Modal */}
      <BankModal
        isOpen={showBankModal}
        onClose={() => {
          setShowBankModal(false);
          setEditingBank(null);
        }}
        onSubmit={(data) => {
          if (editingBank) {
            updateBankMutation.mutate({ id: editingBank.id, data });
          } else {
            createBankMutation.mutate(data);
          }
        }}
        onDelete={editingBank ? () => setShowDeleteConfirm({ type: 'bank', id: editingBank.id }) : undefined}
        initialData={editingBank}
        isLoading={createBankMutation.isPending || updateBankMutation.isPending}
      />

      {/* Question Modal */}
      <QuestionModal
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setEditingQuestion(null);
        }}
        onSubmit={(data) => {
          if (editingQuestion) {
            updateQuestionMutation.mutate({ id: editingQuestion.id, data });
          } else {
            createQuestionMutation.mutate(data);
          }
        }}
        initialData={editingQuestion}
        isLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                  ¿Eliminar {showDeleteConfirm.type === 'bank' ? 'banco' : 'pregunta'}?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {showDeleteConfirm.type === 'bank' 
                    ? 'Se eliminarán todas las preguntas del banco.'
                    : 'Esta acción no se puede deshacer.'
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (showDeleteConfirm.type === 'bank') {
                        deleteBankMutation.mutate(showDeleteConfirm.id);
                      } else {
                        deleteQuestionMutation.mutate(showDeleteConfirm.id);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSV Import Preview Modal */}
      <AnimatePresence>
        {csvPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setCsvPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Vista Previa de Importación</h2>
                      <p className="text-sm text-gray-500">
                        {csvPreview.questions.length} preguntas listas para importar
                        {csvPreview.errors.length > 0 && ` • ${csvPreview.errors.length} errores`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCsvPreview(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Errors */}
              {csvPreview.errors.length > 0 && (
                <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">⚠️ Errores encontrados:</p>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5 max-h-20 overflow-y-auto">
                    {csvPreview.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions Preview */}
              <div className="flex-1 overflow-y-auto p-6">
                {csvPreview.questions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No se encontraron preguntas válidas en el archivo</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {csvPreview.questions.map((q, i) => (
                      <div
                        key={i}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                            q.type === 'TRUE_FALSE' ? 'bg-blue-500' :
                            q.type === 'SINGLE_CHOICE' ? 'bg-green-500' :
                            q.type === 'MULTIPLE_CHOICE' ? 'bg-purple-500' :
                            'bg-orange-500'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                q.type === 'TRUE_FALSE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                q.type === 'SINGLE_CHOICE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                q.type === 'MULTIPLE_CHOICE' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}>
                                {QUESTION_TYPE_LABELS[q.type]}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[q.difficulty || 'MEDIUM']}`}>
                                {DIFFICULTY_LABELS[q.difficulty || 'MEDIUM']}
                              </span>
                              <span className="text-xs text-gray-500">{q.points} pts • {q.timeLimitSeconds}s</span>
                            </div>
                            <p className="text-gray-800 dark:text-white font-medium">{q.questionText}</p>
                            
                            {/* Options preview */}
                            {q.type === 'TRUE_FALSE' && (
                              <p className="text-sm text-gray-500 mt-1">
                                Respuesta: <span className={q.correctAnswer ? 'text-green-600' : 'text-red-600'}>
                                  {q.correctAnswer ? 'Verdadero' : 'Falso'}
                                </span>
                              </p>
                            )}
                            {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && q.options && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(q.options as any[]).map((opt: any, j: number) => (
                                  <span
                                    key={j}
                                    className={`text-xs px-2 py-1 rounded ${
                                      opt.isCorrect 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    {opt.isCorrect && '✓ '}{opt.text}
                                  </span>
                                ))}
                              </div>
                            )}
                            {q.type === 'MATCHING' && q.pairs && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(q.pairs as any[]).map((pair: any, j: number) => (
                                  <span key={j} className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    {pair.left} ↔ {pair.right}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Las preguntas se agregarán al banco <strong>{selectedBank?.name}</strong>
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCsvPreview(null)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={csvPreview.questions.length === 0 || importingCSV}
                      className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {importingCSV ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Importar {csvPreview.questions.length} preguntas
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Import Modal */}
      <AnimatePresence>
        {showAIImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAIImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Generar Preguntas con IA</h2>
                      <p className="text-sm text-gray-500">Usa ChatGPT, Gemini o Claude para crear preguntas</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAIImportModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step 1: Prompt */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Copia este prompt y pégalo en tu IA favorita</h3>
                  </div>
                  <div className="relative">
                    <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
{`Genera [CANTIDAD] preguntas sobre [TEMA] para estudiantes de [NIVEL]. 

Usa EXACTAMENTE este formato CSV (no agregues explicaciones, solo el CSV):

type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds
TRUE_FALSE,EASY,10,"[Pregunta de verdadero/falso]",,true,,"[Explicación]",20
SINGLE_CHOICE,MEDIUM,15,"[Pregunta de opción única]","[{""text"":""Opción 1"",""isCorrect"":false},{""text"":""Opción 2"",""isCorrect"":true},{""text"":""Opción 3"",""isCorrect"":false}]",,,"[Explicación]",30
MULTIPLE_CHOICE,HARD,20,"[Pregunta de múltiples respuestas correctas]","[{""text"":""Opción 1"",""isCorrect"":true},{""text"":""Opción 2"",""isCorrect"":false},{""text"":""Opción 3"",""isCorrect"":true}]",,,"[Explicación]",45
MATCHING,MEDIUM,25,"[Pregunta de relacionar]",,,"[{""left"":""Elemento 1"",""right"":""Pareja 1""},{""left"":""Elemento 2"",""right"":""Pareja 2""}]","[Explicación]",40

IMPORTANTE:
- Tipos válidos: TRUE_FALSE, SINGLE_CHOICE, MULTIPLE_CHOICE, MATCHING
- Dificultades: EASY, MEDIUM, HARD
- Las comillas dentro del JSON deben ser dobles ("")
- Varía los tipos de preguntas
- Incluye explicaciones educativas`}
                    </pre>
                    <button
                      onClick={() => {
                        const prompt = `Genera [CANTIDAD] preguntas sobre [TEMA] para estudiantes de [NIVEL]. 

Usa EXACTAMENTE este formato CSV (no agregues explicaciones, solo el CSV):

type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds
TRUE_FALSE,EASY,10,"[Pregunta de verdadero/falso]",,true,,"[Explicación]",20
SINGLE_CHOICE,MEDIUM,15,"[Pregunta de opción única]","[{""text"":""Opción 1"",""isCorrect"":false},{""text"":""Opción 2"",""isCorrect"":true},{""text"":""Opción 3"",""isCorrect"":false}]",,,"[Explicación]",30
MULTIPLE_CHOICE,HARD,20,"[Pregunta de múltiples respuestas correctas]","[{""text"":""Opción 1"",""isCorrect"":true},{""text"":""Opción 2"",""isCorrect"":false},{""text"":""Opción 3"",""isCorrect"":true}]",,,"[Explicación]",45
MATCHING,MEDIUM,25,"[Pregunta de relacionar]",,,"[{""left"":""Elemento 1"",""right"":""Pareja 1""},{""left"":""Elemento 2"",""right"":""Pareja 2""}]","[Explicación]",40

IMPORTANTE:
- Tipos válidos: TRUE_FALSE, SINGLE_CHOICE, MULTIPLE_CHOICE, MATCHING
- Dificultades: EASY, MEDIUM, HARD
- Las comillas dentro del JSON deben ser dobles ("")
- Varía los tipos de preguntas
- Incluye explicaciones educativas`;
                        navigator.clipboard.writeText(prompt);
                        toast.success('Prompt copiado al portapapeles');
                      }}
                      className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Step 2: Paste result */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">Pega aquí el resultado de la IA</h3>
                  </div>
                  <textarea
                    value={csvTextInput}
                    onChange={(e) => setCsvTextInput(e.target.value)}
                    placeholder="Pega aquí el CSV generado por la IA..."
                    rows={10}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none font-mono text-sm"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Las preguntas se agregarán al banco <strong>{selectedBank?.name}</strong>
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAIImportModal(false);
                        setCsvTextInput('');
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleProcessCSVText}
                      disabled={!csvTextInput.trim()}
                      className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Procesar CSV
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== BANK MODAL ====================

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBankData) => void;
  onDelete?: () => void;
  initialData?: QuestionBank | null;
  isLoading: boolean;
}

const BankModal = ({ isOpen, onClose, onSubmit, onDelete, initialData, isLoading }: BankModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(BANK_COLORS[0]);
  const [icon, setIcon] = useState('book');

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setColor(initialData?.color || BANK_COLORS[0]);
      setIcon(initialData?.icon || 'book');
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined, color, icon });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {initialData ? 'Editar Banco' : 'Nuevo Banco'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: color + '30' }}
            >
              {getBankEmoji(icon)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">
                {name || 'Nombre del banco'}
              </p>
              <p className="text-sm text-gray-500">{description || 'Descripción opcional'}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Matemáticas - Fracciones"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional del banco..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icono
            </label>
            <div className="grid grid-cols-6 gap-2">
              {BANK_ICONS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setIcon(i.id)}
                  className={`p-2 rounded-lg text-xl transition-all ${
                    icon === i.id 
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={i.label}
                >
                  {i.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {BANK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
              >
                Eliminar
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : initialData ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ==================== QUESTION MODAL ====================

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateQuestionData) => void;
  initialData?: Question | null;
  isLoading: boolean;
}

const QuestionModal = ({ isOpen, onClose, onSubmit, initialData, isLoading }: QuestionModalProps) => {
  const [type, setType] = useState<BankQuestionType>('SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('MEDIUM');
  const [points, setPoints] = useState(10);
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [explanation, setExplanation] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  
  // For TRUE_FALSE
  const [correctAnswer, setCorrectAnswer] = useState<boolean>(true);
  
  // For SINGLE_CHOICE / MULTIPLE_CHOICE
  const [options, setOptions] = useState<QuestionOption[]>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ]);
  
  // For MATCHING
  const [pairs, setPairs] = useState<MatchingPair[]>([
    { left: '', right: '' },
    { left: '', right: '' },
  ]);

  // Reinicializar estados cuando cambia initialData o se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    
    if (initialData) {
      const parsed = parseQuestionData(initialData);
      
      // Siempre establecer el tipo primero
      setType(parsed.type);
      setDifficulty(parsed.difficulty);
      setPoints(parsed.points);
      setQuestionText(parsed.questionText);
      setImageUrl(parsed.imageUrl || '');
      setExplanation(parsed.explanation || '');
      setTimeLimitSeconds(parsed.timeLimitSeconds || 30);
      
      // Inicializar según el tipo
      if (parsed.type === 'TRUE_FALSE') {
        setCorrectAnswer(parsed.correctAnswer === true);
        // Limpiar otros estados
        setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
        setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      } else if (parsed.type === 'SINGLE_CHOICE' || parsed.type === 'MULTIPLE_CHOICE') {
        if (Array.isArray(parsed.options) && parsed.options.length > 0) {
          setOptions(parsed.options);
        } else {
          setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
        }
        // Limpiar otros estados
        setCorrectAnswer(true);
        setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
      } else if (parsed.type === 'MATCHING') {
        if (Array.isArray(parsed.pairs) && parsed.pairs.length > 0) {
          setPairs(parsed.pairs);
        } else {
          setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
        }
        // Limpiar otros estados
        setCorrectAnswer(true);
        setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
      }
    } else {
      // Reset para nueva pregunta
      setType('SINGLE_CHOICE');
      setDifficulty('MEDIUM');
      setPoints(10);
      setQuestionText('');
      setImageUrl('');
      setExplanation('');
      setTimeLimitSeconds(30);
      setCorrectAnswer(true);
      setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
      setPairs([{ left: '', right: '' }, { left: '', right: '' }]);
    }
  }, [isOpen, initialData]);

  // Reset when type changes (solo para nuevas preguntas)
  const handleTypeChange = (newType: BankQuestionType) => {
    setType(newType);
    // Solo resetear si no hay datos iniciales o si el tipo cambió
    if (!initialData || initialData.type !== newType) {
      if (newType === 'SINGLE_CHOICE' || newType === 'MULTIPLE_CHOICE') {
        setOptions([
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
        ]);
      } else if (newType === 'MATCHING') {
        setPairs([
          { left: '', right: '' },
          { left: '', right: '' },
        ]);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const data: CreateQuestionData = {
      type,
      difficulty,
      points,
      questionText: questionText.trim(),
      imageUrl: imageUrl.trim() || undefined,
      explanation: explanation.trim() || undefined,
      timeLimitSeconds,
    };

    if (type === 'TRUE_FALSE') {
      data.correctAnswer = correctAnswer;
    } else if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
      data.options = options.filter(o => o.text.trim());
    } else if (type === 'MATCHING') {
      data.pairs = pairs.filter(p => p.left.trim() && p.right.trim());
    }

    onSubmit(data);
  };

  const addOption = () => {
    setOptions([...options, { text: '', isCorrect: false }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: 'text' | 'isCorrect', value: any) => {
    const newOptions = [...options];
    if (field === 'isCorrect' && type === 'SINGLE_CHOICE') {
      // Solo una correcta
      newOptions.forEach((o, i) => o.isCorrect = i === index);
    } else {
      newOptions[index] = { ...newOptions[index], [field]: value };
    }
    setOptions(newOptions);
  };

  const addPair = () => {
    setPairs([...pairs, { left: '', right: '' }]);
  };

  const removePair = (index: number) => {
    if (pairs.length <= 2) return;
    setPairs(pairs.filter((_, i) => i !== index));
  };

  const updatePair = (index: number, field: 'left' | 'right', value: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setPairs(newPairs);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {initialData ? 'Editar Pregunta' : 'Nueva Pregunta'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de pregunta
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'TRUE_FALSE', icon: CheckCircle, label: 'V o F' },
                { id: 'SINGLE_CHOICE', icon: HelpCircle, label: 'Única' },
                { id: 'MULTIPLE_CHOICE', icon: ListChecks, label: 'Múltiple' },
                { id: 'MATCHING', icon: ArrowLeftRight, label: 'Unir' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id as BankQuestionType)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    type === t.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <t.icon size={20} className={type === t.id ? 'text-indigo-600' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${type === t.id ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pregunta *
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Escribe la pregunta aquí..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 resize-none"
              required
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL de imagen (opcional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Type-specific fields */}
          {type === 'TRUE_FALSE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Respuesta correcta
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(true)}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                    correctAnswer
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  ✓ Verdadero
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(false)}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${
                    !correctAnswer
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  ✗ Falso
                </button>
              </div>
            </div>
          )}

          {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Opciones {type === 'SINGLE_CHOICE' ? '(marca la correcta)' : '(marca las correctas)'}
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateOption(index, 'isCorrect', !option.isCorrect)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        option.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                      }`}
                    >
                      {option.isCorrect && <CheckCircle size={16} />}
                    </button>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  + Agregar opción
                </button>
              </div>
            </div>
          )}

          {type === 'MATCHING' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Pares para unir
              </label>
              <div className="space-y-2">
                {pairs.map((pair, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pair.left}
                      onChange={(e) => updatePair(index, 'left', e.target.value)}
                      placeholder="Izquierda"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                    <ArrowLeftRight size={20} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={pair.right}
                      onChange={(e) => updatePair(index, 'right', e.target.value)}
                      placeholder="Derecha"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                    />
                    {pairs.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePair(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPair}
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  + Agregar par
                </button>
              </div>
            </div>
          )}

          {/* Settings row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dificultad
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="EASY">Fácil</option>
                <option value="MEDIUM">Media</option>
                <option value="HARD">Difícil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Puntos
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tiempo (seg)
              </label>
              <input
                type="number"
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
                min={5}
                max={300}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Explicación (opcional)
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explicación que se mostrará después de responder..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !questionText.trim()}
              className="flex-1 px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : initialData ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
