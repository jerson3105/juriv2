import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Album, ChevronRight, Loader2, Medal } from 'lucide-react';
import { badgeApi, RARITY_LABELS } from '../../../lib/badgeApi';
import type { StudentSummary } from '../../../lib/studentApi';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { studentBadgesKey } from './profileHelpers';

interface AchievementsTabProps {
  classroomId: string;
  studentId: string;
  summary?: StudentSummary;
  onGiveBadge: () => void;
}

export const AchievementsTab = ({ classroomId, studentId, summary, onGiveBadge }: AchievementsTabProps) => {
  const { data: badges = [], isLoading } = useQuery({
    queryKey: studentBadgesKey(studentId),
    queryFn: () => badgeApi.getStudentBadges(studentId),
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['badge-progress', classroomId, studentId],
    queryFn: () => badgeApi.getStudentProgress(studentId, classroomId),
  });
  const next = [...progress].sort((a, b) => b.percentage - a.percentage).slice(0, 5);

  return (
    <div className="space-y-4">
      <section aria-labelledby="badges-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="badges-title" className="text-base font-bold text-gray-900 dark:text-white">
            Insignias {badges.length > 0 && <span className="font-normal text-gray-700 dark:text-gray-300">({badges.length})</span>}
          </h2>
          <button type="button" onClick={onGiveBadge} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
            <Medal size={16} aria-hidden="true" /> Dar insignia
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-primary-600" aria-label="Cargando insignias" /></div>
        ) : badges.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-700 dark:text-gray-300">Todavía no tiene insignias.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {badges.map((sb) => (
              <li key={sb.id} className="flex flex-col items-center rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900/40">
                <BadgeMedallion badge={sb.badge} size="sm" animated={false} />
                <span className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{sb.badge.name}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">{RARITY_LABELS[sb.badge.rarity]} · {new Date(sb.unlockedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                {sb.awardReason && <span className="mt-1 line-clamp-2 text-xs italic text-gray-700 dark:text-gray-300">«{sb.awardReason}»</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="next-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 id="next-title" className="mb-3 text-base font-bold text-gray-900 dark:text-white">Cerca de conseguir</h2>
          {next.length === 0 ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">No hay insignias automáticas pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {next.map((p) => (
                <li key={p.badge.id} className="flex items-center gap-3">
                  <BadgeMedallion badge={p.badge} size="sm" locked animated={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-gray-900 dark:text-white">{p.badge.name}</span>
                      <span className="flex-shrink-0 tabular-nums text-gray-800 dark:text-gray-100">{p.currentValue}/{p.targetValue}</span>
                    </span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.percentage)} aria-label={`Progreso hacia ${p.badge.name}`}>
                      <span className="block h-full rounded-full bg-primary-600" style={{ width: `${Math.max(p.percentage, 2)}%` }} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="cards-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 id="cards-title" className="mb-3 text-base font-bold text-gray-900 dark:text-white">Coleccionables</h2>
          {!summary ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-label="Cargando coleccionables" />
          ) : summary.collectibles.total === 0 ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">La clase aún no tiene álbumes.</p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <Album size={18} className="text-violet-700 dark:text-violet-300" aria-hidden="true" />
                Tiene <strong>{summary.collectibles.owned}</strong> de <strong>{summary.collectibles.total}</strong> cromos de la clase.
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                <div className="h-full rounded-full bg-violet-600" style={{ width: `${(summary.collectibles.owned / summary.collectibles.total) * 100}%` }} />
              </div>
              <Link to={`/classroom/${classroomId}/collectibles`} className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-lg text-sm font-semibold text-primary-700 hover:underline dark:text-primary-300">
                Ver álbumes <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
