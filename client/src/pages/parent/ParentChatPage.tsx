import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, Megaphone, ChevronRight, GraduationCap } from 'lucide-react';
import { parentApi } from '../../lib/parentApi';
import type { ChildSummary } from '../../lib/parentApi';
import { Card } from '../../components/ui/Card';

export default function ParentChatPage() {
  const { data: children, isLoading } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren(),
  });

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

  // Dedupe classrooms (multiple children may share the same classroom)
  const uniqueClassrooms = new Map<string, ChildSummary>();
  children?.forEach(c => {
    if (!uniqueClassrooms.has(c.classroomId)) uniqueClassrooms.set(c.classroomId, c);
  });
  const classroomList = Array.from(uniqueClassrooms.values());

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Comunicación</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Avisos y chat grupal con los profesores
          </p>
        </div>
      </div>

      {classroomList.length === 0 ? (
        <Card className="p-8 text-center">
          <GraduationCap className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400">
            Aún no tienes clases vinculadas. Ingresa un código de clase desde el inicio para ver avisos.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {classroomList.map((child, index) => (
            <motion.div
              key={child.classroomId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="mb-2">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">{child.classroomName}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{child.teacherName}</p>
              </div>
              <div className="space-y-2">
                <Link to={`/parent/chat/announcements/${child.classroomId}`}>
                  <Card hover className="p-4 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                          <Megaphone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Avisos</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Mensajes del profesor</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </Card>
                </Link>
                <Link to={`/parent/chat/group/${child.classroomId}`}>
                  <Card hover className="p-4 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Chat grupal</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Conversación con el profesor y otros padres</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </Card>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
