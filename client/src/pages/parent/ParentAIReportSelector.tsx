import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, GraduationCap, ChevronRight, Search } from 'lucide-react';
import { parentApi } from '../../lib/parentApi';
import type { ChildSummary } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';

export default function ParentAIReportSelector() {
  const [search, setSearch] = useState('');

  const { data: children, isLoading } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren(),
  });

  const filtered = useMemo(() => {
    if (!children) return [];
    if (!search.trim()) return children;
    const q = search.toLowerCase();
    return children.filter((c: ChildSummary) =>
      c.classroomName.toLowerCase().includes(q) ||
      c.studentName.toLowerCase().includes(q) ||
      c.teacherName.toLowerCase().includes(q)
    );
  }, [children, search]);

  if (isLoading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // If only one child, redirect directly
  if (children && children.length === 1) {
    return <Navigate to={`/parent/ai-report/${children[0].studentProfileId}`} replace />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informe inteligente</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecciona una clase para generar un informe con IA
          </p>
        </div>
      </div>

      {(!children || children.length === 0) ? (
        <Card className="p-8 text-center">
          <GraduationCap className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400">
            Aún no tienes clases vinculadas. Ingresa un código de clase desde el inicio para ver informes.
          </p>
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por clase, estudiante o profesor..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
              No se encontraron resultados para "{search}"
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((child: ChildSummary, index: number) => (
                <motion.div
                  key={child.studentProfileId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/parent/ai-report/${child.studentProfileId}`}>
                    <Card hover className="p-4 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{child.classroomName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {child.studentName} · {child.teacherName}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
