import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Link2, Loader2 } from 'lucide-react';
import { parentApi } from '../../lib/parentApi';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

interface LinkChildModalProps {
  onClose: () => void;
}

export default function LinkChildModal({ onClose }: LinkChildModalProps) {
  const [linkCode, setLinkCode] = useState('');
  const queryClient = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: (code: string) => parentApi.linkChild(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      toast.success('¡Hijo vinculado exitosamente!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Código inválido');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkCode.trim().length < 6) {
      toast.error('Ingresa un código válido');
      return;
    }
    linkMutation.mutate(linkCode.trim().toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Link2 className="text-indigo-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Vincular Hijo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
              ¿Cómo obtener el código?
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Solicita el <strong>código de vinculación de padre</strong> al profesor de tu hijo. 
              El profesor puede generarlo desde la lista de estudiantes de la clase.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Código de vinculación
            </label>
            <input
              type="text"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABC12345"
              maxLength={8}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={linkMutation.isPending || linkCode.trim().length < 6}
              className="flex-1"
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Vinculando...
                </>
              ) : (
                'Vincular'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
