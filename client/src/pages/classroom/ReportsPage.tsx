import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ScrollText,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { HistoryPage } from './HistoryPage';
import { GradebookPage } from './GradebookPage';
import type { Classroom } from '../../lib/classroomApi';

type ReportTab = 'statistics' | 'history' | 'gradebook';

const tabs: { id: ReportTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'statistics', label: 'Estadísticas', icon: BarChart3, description: 'Métricas y análisis del aula' },
  { id: 'history', label: 'Historial', icon: ScrollText, description: 'Registro de actividades' },
  { id: 'gradebook', label: 'Calificaciones', icon: BookOpen, description: 'Libro de notas' },
];

export const ReportsPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const [activeTab, setActiveTab] = useState<ReportTab>('statistics');

  // Filtrar tabs según configuración de la clase
  const availableTabs = tabs.filter(tab => {
    if (tab.id === 'gradebook' && !classroom?.useCompetencies) {
      return false;
    }
    return true;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'statistics':
        return <DashboardPage />;
      case 'history':
        return <HistoryPage />;
      case 'gradebook':
        return classroom?.useCompetencies ? <GradebookPage /> : null;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
          <TrendingUp size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Reportes</h1>
          <p className="text-gray-500 dark:text-gray-400">Estadísticas, historial y calificaciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-1.5">
        <div className="flex gap-1">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                  font-medium text-sm transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};
