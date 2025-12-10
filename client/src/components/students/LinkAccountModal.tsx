import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LinkAccountModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const [linkCode, setLinkCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkCode.trim().length < 6) {
      setError('El código debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await placeholderStudentApi.linkAccount(linkCode.trim().toUpperCase());
      setSuccess(true);
      toast.success('¡Cuenta vinculada exitosamente!');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Error al vincular cuenta';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLinkCode('');
    setError('');
    setSuccess(false);
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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Vincular mi cuenta
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ingresa el código que te dio tu profesor
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
          <form onSubmit={handleSubmit} className="p-6">
            {success ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
                >
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </motion.div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  ¡Cuenta vinculada!
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Tu progreso ha sido sincronizado correctamente
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código de vinculación
                  </label>
                  <Input
                    value={linkCode}
                    onChange={(e) => {
                      setLinkCode(e.target.value.toUpperCase());
                      setError('');
                    }}
                    placeholder="Ej: ABC123"
                    className="text-center text-2xl font-mono tracking-widest uppercase"
                    maxLength={8}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Este código está en la tarjeta que te entregó tu profesor
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || linkCode.length < 6}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Vinculando...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Vincular
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>

          {/* Info */}
          {!success && (
            <div className="px-6 pb-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  ¿Qué es esto?
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Si tu profesor te dio una tarjeta con un código, puedes vincular tu cuenta 
                  para recuperar tu progreso y puntos en la clase.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
