import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Building2, 
  ChevronRight,
  Users,
  BookOpen,
  GraduationCap,
  Shield,
  ShieldCheck,
  User
} from 'lucide-react';
import { getMySchools } from '../../api/schoolApi';

export default function MySchoolsPage() {
  const navigate = useNavigate();

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['my-schools'],
    queryFn: getMySchools,
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return <ShieldCheck className="w-4 h-4" />;
      case 'ADMIN': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Propietario';
      case 'ADMIN': return 'Administrador';
      default: return 'Profesor';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'text-amber-700 bg-amber-100';
      case 'ADMIN': return 'text-purple-700 bg-purple-100';
      default: return 'text-blue-700 bg-blue-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Mis Escuelas
          </h1>
          <p className="text-gray-600 mt-1">
            Escuelas donde estás asignado como profesor o administrador
          </p>
        </div>
      </div>

      {/* Schools List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : schools.length > 0 ? (
        <div className="space-y-4">
          {schools.map((school, index) => (
            <motion.button
              key={school.schoolId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/school/${school.schoolId}`)}
              className="w-full bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                {school.schoolLogo ? (
                  <img 
                    src={school.schoolLogo} 
                    alt={school.schoolName}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {school.schoolName}
                    </h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(school.role)}`}>
                      {getRoleIcon(school.role)}
                      {getRoleName(school.role)}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">/{school.schoolSlug}</p>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-xl border border-gray-200"
        >
          <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No perteneces a ninguna escuela
          </h3>
          <p className="text-gray-500">
            Espera a que un administrador de Juried te asigne a una escuela
          </p>
        </motion.div>
      )}

      {/* Info Cards */}
      {schools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="text-gray-900 font-medium mb-1">Profesores</h4>
            <p className="text-gray-500 text-sm">
              Colabora con otros profesores de tu institución
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="text-gray-900 font-medium mb-1">Clases Asignadas</h4>
            <p className="text-gray-500 text-sm">
              Gestiona las clases que te han sido asignadas
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="text-gray-900 font-medium mb-1">Recursos Compartidos</h4>
            <p className="text-gray-500 text-sm">
              Accede a comportamientos e insignias de la escuela
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
