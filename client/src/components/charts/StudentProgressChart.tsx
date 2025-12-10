import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Sparkles, Heart, Coins, Calendar } from 'lucide-react';

interface ProgressData {
  date: string;
  xp: number;
  hp: number;
  gp: number;
  level: number;
}

interface StudentProgressChartProps {
  data: ProgressData[];
  className?: string;
}

export const StudentProgressChart = ({ data, className = '' }: StudentProgressChartProps) => {
  const formattedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      dateLabel: new Date(item.date).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      }),
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (data.length < 2) return null;
    
    const first = data[0];
    const last = data[data.length - 1];
    
    return {
      xpGain: last.xp - first.xp,
      levelGain: last.level - first.level,
      gpGain: last.gp - first.gp,
    };
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay datos de progreso disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-gray-900">Progreso del Estudiante</h3>
        </div>
        
        {stats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className={stats.xpGain >= 0 ? 'text-green-600' : 'text-red-600'}>
                {stats.xpGain >= 0 ? '+' : ''}{stats.xpGain} XP
              </span>
            </div>
            {stats.levelGain > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-amber-600">+{stats.levelGain} Nivel</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* XP Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Experiencia (XP)
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="xp"
                name="XP"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#xpGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* HP & GP Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Salud y Monedas
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                stroke="#9ca3af"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="hp"
                name="HP"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="gp"
                name="GP"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-sm text-gray-600">XP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-gray-600">HP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-gray-600">GP</span>
        </div>
      </div>
    </div>
  );
};

// Componente de estadísticas rápidas
interface QuickStatsProps {
  currentXp: number;
  currentHp: number;
  currentGp: number;
  level: number;
  xpToNextLevel: number;
  attendanceRate?: number;
}

export const QuickStats = ({ 
  currentXp, 
  currentHp, 
  currentGp, 
  level, 
  xpToNextLevel,
  attendanceRate 
}: QuickStatsProps) => {
  const xpProgress = Math.min((currentXp % 100) / 100 * 100, 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white"
      >
        <Sparkles className="w-6 h-6 mb-2 opacity-80" />
        <p className="text-3xl font-bold">{currentXp}</p>
        <p className="text-sm opacity-80">Experiencia Total</p>
        <div className="mt-2 bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="text-xs mt-1 opacity-70">{xpToNextLevel} XP para nivel {level + 1}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-red-500 to-pink-600 rounded-xl p-4 text-white"
      >
        <Heart className="w-6 h-6 mb-2 opacity-80" />
        <p className="text-3xl font-bold">{currentHp}</p>
        <p className="text-sm opacity-80">Puntos de Vida</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white"
      >
        <Coins className="w-6 h-6 mb-2 opacity-80" />
        <p className="text-3xl font-bold">{currentGp}</p>
        <p className="text-sm opacity-80">Monedas de Oro</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white"
      >
        <Calendar className="w-6 h-6 mb-2 opacity-80" />
        <p className="text-3xl font-bold">{attendanceRate ?? '--'}%</p>
        <p className="text-sm opacity-80">Asistencia</p>
      </motion.div>
    </div>
  );
};
