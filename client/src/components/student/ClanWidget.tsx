import { useQuery } from '@tanstack/react-query';
import { Users, Trophy, ChevronRight } from 'lucide-react';
import { clanApi, CLAN_EMBLEMS } from '../../lib/clanApi';

interface ClanWidgetProps {
  studentId: string;
  onViewRanking?: () => void;
}

export const ClanWidget = ({ studentId, onViewRanking }: ClanWidgetProps) => {
  const { data: clanInfo, isLoading } = useQuery({
    queryKey: ['student-clan', studentId],
    queryFn: () => clanApi.getStudentClanInfo(studentId),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-4 animate-pulse shadow-lg">
        <div className="h-24 bg-white/20 rounded-lg" />
      </div>
    );
  }

  if (!clanInfo) {
    return (
      <div className="bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5" />
          <h3 className="font-bold text-sm">Mi Clan</h3>
        </div>
        <p className="text-gray-100 mb-3 text-xs">Sin clan asignado aún</p>
        <div className="py-2 bg-white/20 rounded-lg text-xs text-center">
          Esperando asignación...
        </div>
      </div>
    );
  }

  const { clan, members, myContribution } = clanInfo;

  return (
    <div 
      className="rounded-xl p-4 text-white shadow-lg"
      style={{ 
        background: `linear-gradient(135deg, ${clan.color} 0%, ${adjustColor(clan.color, -30)} 100%)`
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{CLAN_EMBLEMS[clan.emblem] || '🛡️'}</span>
          <h3 className="font-bold text-sm truncate">{clan.name}</h3>
        </div>
        <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
          <Trophy size={12} />
          <span>#{clan.rank}</span>
        </div>
      </div>

      {/* Stats compactos */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-1.5 bg-white/20 rounded-lg">
          <p className="text-sm font-bold">{clan.totalXp.toLocaleString()}</p>
          <p className="text-[10px] opacity-80">XP</p>
        </div>
        <div className="text-center p-1.5 bg-white/20 rounded-lg">
          <p className="text-sm font-bold">+{myContribution}</p>
          <p className="text-[10px] opacity-80">Mi aporte</p>
        </div>
        <div className="text-center p-1.5 bg-white/20 rounded-lg">
          <p className="text-sm font-bold">{members.length}</p>
          <p className="text-[10px] opacity-80">Miembros</p>
        </div>
      </div>

      {/* Botón para ver ranking */}
      {onViewRanking && (
        <button 
          onClick={onViewRanking}
          className="w-full py-2 bg-white text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
          style={{ color: clan.color }}
        >
          Ver ranking
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

// Función helper para oscurecer/aclarar colores
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}
