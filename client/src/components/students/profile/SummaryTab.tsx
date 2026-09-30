import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarCheck, Coins, HeartCrack, Loader2, ShoppingBag, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Student } from '../../../lib/classroomApi';
import type { StudentSummary, SummaryPeriod } from '../../../lib/studentApi';
import { CLAN_EMBLEMS } from '../../../lib/clanApi';
import { buildAlerts, daysSince, fillTimeline } from './profileHelpers';

interface SummaryTabProps {
  student: Student;
  summary?: StudentSummary;
  loading: boolean;
  error: boolean;
  period: SummaryPeriod;
  maxHp: number;
  onPeriodChange: (period: SummaryPeriod) => void;
}

type Metric = 'xp' | 'hp' | 'gp';
const METRICS: { id: Metric; label: string; positive: string; negative: string }[] = [
  { id: 'xp', label: 'XP', positive: '#4f46e5', negative: '#dc2626' },
  { id: 'hp', label: 'Vida', positive: '#059669', negative: '#dc2626' },
  { id: 'gp', label: 'Oro', positive: '#b45309', negative: '#dc2626' },
];

const signed = (n: number) => (n > 0 ? `+${n.toLocaleString('es')}` : n.toLocaleString('es'));

export const SummaryTab = ({ student, summary, loading, error, period, maxHp, onPeriodChange }: SummaryTabProps) => {
  const [metric, setMetric] = useState<Metric>('xp');
  const alerts = buildAlerts(student, summary, maxHp);
  const series = useMemo(() => (summary ? fillTimeline(summary) : []), [summary]);
  const meta = METRICS.find((m) => m.id === metric)!;

  return (
    <div className="space-y-4">
      {/* Periodo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {([['bimester', 'Bimestre actual'], ['all', 'Todo el curso']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => onPeriodChange(value)}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold ${period === value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {summary && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {summary.period.label}
            {summary.period.from && ` · desde el ${new Date(summary.period.from).toLocaleDateString('es', { day: 'numeric', month: 'long' })}`}
          </p>
        )}
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Alertas">
          {alerts.map((alert) => (
            <li key={alert.title} className={`flex items-start gap-3 rounded-xl border p-3 ${alert.tone === 'danger' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/25' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/25'}`}>
              {alert.tone === 'danger'
                ? <HeartCrack size={20} className="mt-0.5 flex-shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
                : <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />}
              <span>
                <span className={`block text-sm font-bold ${alert.tone === 'danger' ? 'text-red-900 dark:text-red-100' : 'text-amber-950 dark:text-amber-50'}`}>{alert.title}</span>
                <span className={`block text-sm ${alert.tone === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-amber-900 dark:text-amber-100'}`}>{alert.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" aria-label="Cargando resumen" /></div>
      ) : error || !summary ? (
        <p className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">No se pudo cargar el resumen. Intenta de nuevo.</p>
      ) : (
        <>
          {/* Indicadores del periodo */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<Sparkles size={18} aria-hidden="true" />} tone="text-primary-700 dark:text-primary-300" label="XP en el periodo" value={signed(summary.points.xpGained - summary.points.xpLost)}
              detail={`+${summary.points.xpGained} ganados · −${summary.points.xpLost} perdidos`} />
            <Kpi icon={<ThumbsUp size={18} aria-hidden="true" />} tone="text-emerald-700 dark:text-emerald-300" label="Comportamientos"
              value={`${summary.events.positive} / ${summary.events.negative}`} detail="positivos / por mejorar">
              {summary.events.positive + summary.events.negative > 0 && (
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                  <div className="bg-emerald-600" style={{ width: `${(summary.events.positive / (summary.events.positive + summary.events.negative)) * 100}%` }} />
                  <div className="bg-red-600" style={{ width: `${(summary.events.negative / (summary.events.positive + summary.events.negative)) * 100}%` }} />
                </div>
              )}
            </Kpi>
            <Kpi icon={<CalendarCheck size={18} aria-hidden="true" />} tone="text-sky-700 dark:text-sky-300" label="Asistencia"
              value={summary.attendance.total ? `${Math.round(((summary.attendance.present + summary.attendance.late) / summary.attendance.total) * 100)} %` : '—'}
              detail={summary.attendance.total ? `${summary.attendance.present} presente · ${summary.attendance.late} tarde · ${summary.attendance.absent} falta${summary.attendance.absent === 1 ? '' : 's'}` : 'Sin registros en el periodo'} />
            <Kpi icon={<Coins size={18} aria-hidden="true" />} tone="text-amber-800 dark:text-amber-300" label="Oro en el periodo" value={signed(summary.points.gpGained - summary.points.gpLost)}
              detail={`${summary.purchases.count} compra${summary.purchases.count === 1 ? '' : 's'} (${summary.purchases.spent} GP)`} />
          </div>

          {/* Gráfico */}
          <section aria-labelledby="chart-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="chart-title" className="text-base font-bold text-gray-900 dark:text-white">
                Balance {summary.timeline.bucket === 'week' ? 'por semana' : 'por día'}
              </h2>
              <div role="radiogroup" aria-label="Qué mostrar" className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700">
                {METRICS.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={metric === m.id} onClick={() => setMetric(m.id)}
                    className={`min-h-[36px] rounded-md px-3 text-sm font-semibold ${metric === m.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {series.every((p) => p[metric] === 0) ? (
              <p className="py-12 text-center text-sm text-gray-700 dark:text-gray-300">Sin movimientos de {meta.label} en el periodo.</p>
            ) : (
              <div className="h-56 text-gray-700 dark:text-gray-300" role="img" aria-label={`Balance de ${meta.label} ${summary.timeline.bucket === 'week' ? 'por semana' : 'por día'}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'currentColor' }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} content={<ChartTooltip unit={meta.label} />} />
                    <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                      {series.map((p) => <Cell key={p.date} fill={p[metric] >= 0 ? meta.positive : meta.negative} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Comportamientos frecuentes */}
            <section aria-labelledby="top-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 id="top-title" className="mb-3 text-base font-bold text-gray-900 dark:text-white">Comportamientos frecuentes</h2>
              {summary.topBehaviors.length === 0 ? (
                <p className="text-sm text-gray-700 dark:text-gray-300">Aún no hay comportamientos en el periodo.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.topBehaviors.map((b) => (
                    <li key={`${b.name}-${b.positive}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 text-gray-900 dark:text-white">
                          {b.positive ? <ThumbsUp size={14} className="flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-label="Positivo" /> : <ThumbsDown size={14} className="flex-shrink-0 text-red-700 dark:text-red-300" aria-label="Por mejorar" />}
                          <span className="truncate">{b.name}</span>
                        </span>
                        <span className="font-bold tabular-nums text-gray-900 dark:text-white">{b.times}×</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                        <div className={`h-full rounded-full ${b.positive ? 'bg-emerald-600' : 'bg-red-600'}`} style={{ width: `${(b.times / summary.topBehaviors[0].times) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Clan, compras y última actividad */}
            <section aria-labelledby="extra-title" className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 id="extra-title" className="text-base font-bold text-gray-900 dark:text-white">En la clase</h2>
              {summary.clan ? (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
                  <span className="text-3xl" aria-hidden="true">{CLAN_EMBLEMS[summary.clan.emblem] || '🛡️'}</span>
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    Clan <strong>{summary.clan.name}</strong>: aportó <strong>{summary.clan.contributedXp.toLocaleString('es')} XP</strong> en el periodo.
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">No pertenece a ningún clan.</p>
              )}
              <p className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <ShoppingBag size={16} className="text-amber-800 dark:text-amber-300" aria-hidden="true" />
                {summary.purchases.count > 0 ? `${summary.purchases.count} compra${summary.purchases.count === 1 ? '' : 's'} aprobada${summary.purchases.count === 1 ? '' : 's'} por ${summary.purchases.spent} GP.` : 'Sin compras en el periodo.'}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-100">
                Última vez que recibió puntos: <strong>{lastActivityText(summary.lastActivityAt)}</strong>
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

const lastActivityText = (iso: string | null) => {
  const days = daysSince(iso);
  if (days === null) return 'nunca';
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
};

const Kpi = ({ icon, tone, label, value, detail, children }: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>{icon}{label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums text-gray-900 dark:text-white">{value}</p>
    <p className="text-sm text-gray-700 dark:text-gray-300">{detail}</p>
    {children}
  </div>
);

// Recharts inyecta active/payload/label en el contenido del tooltip.
const ChartTooltip = ({ active, payload, label, unit }: { active?: boolean; payload?: { value?: number | string }[]; label?: string; unit: string }) => {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-900">
      <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
      <p className="text-gray-800 dark:text-gray-100">{value > 0 ? '+' : ''}{value} {unit}</p>
    </div>
  );
};
