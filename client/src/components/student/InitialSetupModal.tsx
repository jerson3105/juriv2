import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Sparkles } from 'lucide-react';
import { studentApi } from '../../lib/studentApi';
import toast from 'react-hot-toast';

interface InitialSetupModalProps {
  isOpen: boolean;
  studentId: string;
  displayName?: string;
  onComplete: () => void;
}

export const InitialSetupModal = ({ isOpen, studentId, displayName, onComplete }: InitialSetupModalProps) => {
  const queryClient = useQueryClient();
  const [characterName, setCharacterName] = useState('');
  const [avatarGender, setAvatarGender] = useState<'MALE' | 'FEMALE'>('MALE');

  const setupMutation = useMutation({
    mutationFn: () => studentApi.completeInitialSetup(studentId, { characterName, avatarGender }),
    onSuccess: () => {
      // Invalidar todas las queries relacionadas para refrescar el avatar
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      queryClient.invalidateQueries({ queryKey: ['avatar-equipped', studentId] });
      queryClient.invalidateQueries({ queryKey: ['avatar-data'] });
      toast.success('¡Configuración completada!');
      onComplete();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar configuración');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterName.trim()) {
      toast.error('Ingresa un nombre de personaje');
      return;
    }
    setupMutation.mutate();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-700"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">¡Bienvenido a tu aventura!</h2>
              <p className="text-gray-400">
                {displayName ? `Hola ${displayName}, ` : ''}Configura tu personaje para comenzar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre de personaje */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre de tu personaje
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Ej: Guerrero Valiente, Mago Sabio..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Este nombre aparecerá en el juego</p>
              </div>

              {/* Selección de género de avatar */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Elige tu avatar
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAvatarGender('MALE')}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      avatarGender === 'MALE'
                        ? 'border-violet-500 bg-violet-500/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-2">
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <span className="text-white font-medium">Masculino</span>
                    </div>
                    {avatarGender === 'MALE' && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarGender('FEMALE')}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      avatarGender === 'FEMALE'
                        ? 'border-violet-500 bg-violet-500/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center mb-2">
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <span className="text-white font-medium">Femenino</span>
                    </div>
                    {avatarGender === 'FEMALE' && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Botón de confirmar */}
              <button
                type="submit"
                disabled={setupMutation.isPending || !characterName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {setupMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    ¡Comenzar aventura!
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
