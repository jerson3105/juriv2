import { useOutletContext } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { type Classroom } from '../../lib/classroomApi';
import { Swords } from 'lucide-react';

export const BattlesPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Boss Battles
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Crea y gestiona batallas épicas para {classroom.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords size={20} />
            Batallas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Swords className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Próximamente
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Las Boss Battles estarán disponibles pronto
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
