import { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  Bug,
  X,
  Send,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import {
  bugReportApi,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type BugReportCategory,
  type BugReportPriority,
} from '../lib/bugReportApi';
import toast from 'react-hot-toast';

interface BugReportButtonProps {
  variant?: 'floating' | 'icon';
}

export const BugReportButton = ({ variant = 'floating' }: BugReportButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const location = useLocation();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReportCategory>('OTHER');
  const [priority, setPriority] = useState<BugReportPriority>('MEDIUM');

  const createMutation = useMutation({
    mutationFn: () =>
      bugReportApi.createReport({
        title,
        description,
        category,
        priority,
        currentUrl: window.location.href,
        browserInfo: bugReportApi.getBrowserInfo(),
      }),
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
        resetForm();
      }, 2000);
      toast.success('Reporte enviado correctamente');
    },
    onError: () => {
      toast.error('Error al enviar el reporte');
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('OTHER');
    setPriority('MEDIUM');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    createMutation.mutate();
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      setIsOpen(false);
      resetForm();
    }
  };

  return (
    <>
      {/* Botón - Flotante o Icono según variant */}
      {variant === 'floating' ? (
        <motion.button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Bug size={20} />
          <span className="hidden sm:inline font-medium">Reportar Bug</span>
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </motion.button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Reportar Bug"
        >
          <Bug size={20} />
        </button>
      )}

      {/* Modal - Usando portal para asegurar que esté al frente */}
      {isOpen && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 99999 }}
          >
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-red-500">
                <div className="flex items-center gap-3 text-white">
                  <Bug size={24} />
                  <div>
                    <h2 className="text-lg font-bold">Reportar un Bug</h2>
                    <p className="text-sm text-white/80">Ayúdanos a mejorar Juried</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={createMutation.isPending}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Success State */}
              {showSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4"
                  >
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    ¡Reporte Enviado!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Gracias por ayudarnos a mejorar Juried
                  </p>
                </motion.div>
              ) : (
                /* Form */
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Título */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Título del problema *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: El botón de guardar no funciona"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      disabled={createMutation.isPending}
                      maxLength={255}
                    />
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción detallada *
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe el problema con el mayor detalle posible. ¿Qué estabas haciendo? ¿Qué esperabas que pasara? ¿Qué pasó en su lugar?"
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                      disabled={createMutation.isPending}
                    />
                  </div>

                  {/* Categoría y Prioridad */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Categoría
                      </label>
                      <div className="relative">
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as BugReportCategory)}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                          disabled={createMutation.isPending}
                        >
                          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Prioridad
                      </label>
                      <div className="relative">
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as BugReportPriority)}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                          disabled={createMutation.isPending}
                        >
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Info adicional */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm">
                    <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-700 dark:text-blue-300">
                      Se incluirá automáticamente la URL actual y la información de tu navegador para ayudar a diagnosticar el problema.
                    </p>
                  </div>

                  {/* URL actual (solo lectura) */}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Página actual:</span> {location.pathname}
                  </div>
                </form>
              )}

              {/* Footer */}
              {!showSuccess && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={createMutation.isPending}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={createMutation.isPending || !title.trim() || !description.trim()}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Reporte
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
