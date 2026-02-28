import { 
  GraduationCap, 
  Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useState } from 'react';
import LinkChildModal from './LinkChildModal';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import ChildDetailPage from './ChildDetailPage';

export default function ParentDashboard() {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const { children, isLoading } = useSelectedClassroom();

  if (isLoading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Si hay hijos vinculados, mostrar el detalle del hijo seleccionado directamente
  if (children.length > 0) {
    return <ChildDetailPage />;
  }

  // Estado vacío — sin hijos vinculados
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="p-8 text-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
            <GraduationCap className="text-indigo-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
            Sin hijos vinculados
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Solicita el código de vinculación al profesor de tu hijo para comenzar a ver su progreso académico.
          </p>
          <Button onClick={() => setShowLinkModal(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
            <Plus size={18} />
            Ingresar código de clase
          </Button>
        </Card>
      </motion.div>

      {/* Modal para vincular hijo */}
      {showLinkModal && (
        <LinkChildModal onClose={() => setShowLinkModal(false)} />
      )}
    </div>
  );
}
