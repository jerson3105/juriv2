import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { schoolApi, type SchoolClassroom, type StudentAtRisk } from '../../lib/schoolApi';
import { gradeLabel } from '../home/homeHelpers';
import { PERIOD_PRESETS, downloadCsv, formatDay, localDay, presetRange, slug, type PeriodPreset } from './schoolHelpers';

const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';
const csvButton = 'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700';
const tick = { fontSize: 12, fill: 'currentColor' };

const RISK_LABEL: Record<string, (s: StudentAtRisk) => string> = {
  HP_LOW: (s) => `HP ${s.hpPercentage}%`,
  NEGATIVE_BEHAVIOR: (s) => `${s.negativeCount} faltas`,
  LOW_ATTENDANCE: (s) => `Asistencia ${s.attendanceRate}%`,
};

// Con un año escolar, solo sus clases (las de un año cerrado también, archivadas); sin año, todas las del colegio.
const useSchoolReports = (schoolId: string, start: string, end: string, enabled = true, yearId: string | null = null) => {
  const k = (name: string) => ['school-report', name, schoolId, start, end, yearId];
  return {
    summary: useQuery({ queryKey: k('summary'), queryFn: () => schoolApi.getReportSummary(schoolId, start, end, yearId), enabled }),
    trends: useQuery({ queryKey: k('trends'), queryFn: () => schoolApi.getBehaviorTrends(schoolId, start, end, undefined, yearId), enabled }),
    ranking: useQuery({ queryKey: k('ranking'), queryFn: () => schoolApi.getClassRanking(schoolId, start, end, yearId), enabled }),
    top: useQuery({ queryKey: k('top'), queryFn: () => schoolApi.getTopBehaviors(schoolId, start, end, yearId), enabled }),
    risk: useQuery({ queryKey: k('risk'), queryFn: () => schoolApi.getStudentsAtRisk(schoolId, start, end, yearId), enabled }),
    attendance: useQuery({ queryKey: k('attendance'), queryFn: () => schoolApi.getAttendanceReport(schoolId, start, end, yearId), enabled }),
  };
};

const Kpis = ({ data }: { data?: { totalStudents: number; totalClasses: number; attendanceRate: number; totalPositivePoints: number; totalNegativePoints: number } }) => {
  const items = [
    { label: 'Estudiantes', value: data ? data.totalStudents.toLocaleString('es') : '—', hint: data ? `en ${data.totalClasses} clases` : '' },
    { label: 'Asistencia', value: data ? `${data.attendanceRate}%` : '—', hint: 'del periodo' },
    { label: 'Puntos positivos', value: data ? `+${data.totalPositivePoints.toLocaleString('es')}` : '—', hint: 'reconocimientos' },
    { label: 'Puntos a mejorar', value: data ? `−${data.totalNegativePoints.toLocaleString('es')}` : '—', hint: 'correcciones' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={card}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{i.label}</dt>
          <dd className="mt-1 text-2xl font-black tabular-nums text-gray-900 dark:text-white">{i.value}</dd>
          <dd className="text-xs text-gray-700 dark:text-gray-300">{i.hint}</dd>
        </div>
      ))}
    </dl>
  );
};

const TrendChart = ({ points }: { points: { date: string; positive: number; negative: number }[] }) => (
  <div className="text-gray-700 dark:text-gray-300">
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
        <XAxis dataKey="date" tick={tick} tickFormatter={(v) => formatDay(v)} />
        <YAxis tick={tick} />
        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10 }} labelFormatter={(v) => formatDay(String(v), { weekday: 'short', day: 'numeric', month: 'short' })} />
        <Area type="monotone" dataKey="positive" name="Positivos" stroke="#15803d" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
        <Area type="monotone" dataKey="negative" name="A mejorar" stroke="#b91c1c" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
    <p className="mt-1 flex gap-4 text-xs"><span className="text-green-800 dark:text-green-300">■ Positivos</span><span className="text-red-800 dark:text-red-300">■ A mejorar</span></p>
  </div>
);

const RiskList = ({ items, limit }: { items: StudentAtRisk[]; limit?: number }) => (
  items.length === 0 ? (
    <p className="py-4 text-center text-sm text-gray-700 dark:text-gray-300">Ningún estudiante en riesgo en este periodo.</p>
  ) : (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {items.slice(0, limit).map((s) => (
        <li key={s.studentId} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-gray-900 dark:text-white">{s.displayName}</span>
            <span className="block text-sm text-gray-700 dark:text-gray-300">{s.classroomName} · Nivel {s.level}</span>
          </span>
          <span className="flex flex-wrap gap-1">
            {s.risks.map((r) => (
              <span key={r} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{RISK_LABEL[r]?.(s) ?? r}</span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
);

// ── Resumen: últimos 30 días ────────────────────────────────────────────────
export const SummaryTab = ({ schoolId, yearId = null, onOpenReports }: { schoolId: string; yearId?: string | null; onOpenReports: () => void }) => {
  const [range] = useState(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { start: localDay(from), end: localDay() };
  });
  const r = useSchoolReports(schoolId, range.start, range.end, true, yearId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700 dark:text-gray-300">Últimos 30 días</p>
      <Kpis data={r.summary.data} />
      <div className="grid gap-4 lg:grid-cols-5">
        <section className={`${card} lg:col-span-3`} aria-labelledby="sum-trend">
          <h3 id="sum-trend" className="mb-2 font-bold text-gray-900 dark:text-white">Clima de la escuela</h3>
          {r.trends.isLoading ? <div className="h-52 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" /> : (r.trends.data?.length ?? 0) === 0
            ? <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">Aún no hay puntos registrados en este periodo.</p>
            : <TrendChart points={r.trends.data!} />}
        </section>
        <section className={`${card} lg:col-span-2`} aria-labelledby="sum-risk">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 id="sum-risk" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><AlertTriangle size={18} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />Necesitan atención</h3>
            <button type="button" onClick={onOpenReports} className="text-sm font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Ver informes</button>
          </div>
          {r.risk.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" /> : <RiskList items={r.risk.data ?? []} limit={5} />}
        </section>
      </div>
    </div>
  );
};

// ── Informes con periodo y CSV ──────────────────────────────────────────────
export const ReportsTab = ({ schoolId, schoolName, classrooms, yearId = null }: { schoolId: string; schoolName: string; classrooms: SchoolClassroom[]; yearId?: string | null }) => {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [custom, setCustom] = useState(() => presetRange('month'));
  const range = preset === 'custom' ? custom : presetRange(preset);
  const validCustom = custom.start <= custom.end;
  const r = useSchoolReports(schoolId, range.start, range.end, preset !== 'custom' || validCustom, yearId);
  const gradeById = useMemo(() => new Map(classrooms.map((c) => [c.id, gradeLabel(c.gradeLevel)])), [classrooms]);
  const file = (what: string) => `${slug(schoolName)}-${what}-${range.start}_${range.end}.csv`;

  const exportRanking = () => downloadCsv(file('clases'), [
    ['Puesto', 'Clase', 'Grado', 'Área', 'Estudiantes', 'XP promedio', 'Puntos positivos', 'Puntos a mejorar', 'Asistencia %'],
    ...(r.ranking.data ?? []).map((c, i) => [i + 1, c.name, gradeById.get(c.classroomId) ?? '', c.curriculumAreaName ?? '', c.studentCount, c.avgXp, c.positivePoints, c.negativePoints, c.attendanceRate]),
  ]);
  const exportAttendance = () => downloadCsv(file('asistencia'), [
    ['Clase', 'Registros', 'Presentes', 'Tardanzas', 'Ausentes', 'Justificados', 'Asistencia %'],
    ...(r.attendance.data?.byClass ?? []).map((c) => [c.name, c.total, c.present, c.late, c.absent, c.excused, c.rate]),
  ]);
  const exportRisk = () => downloadCsv(file('estudiantes-atencion'), [
    ['Estudiante', 'Clase', 'Nivel', 'HP %', 'Faltas', 'Asistencia %'],
    ...(r.risk.data ?? []).map((s) => [s.displayName, s.classroomName, s.level, s.hpPercentage, s.negativeCount, s.attendanceRate]),
  ]);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div role="group" aria-label="Periodo" className="flex flex-wrap gap-1 rounded-xl border border-gray-300 p-0.5 dark:border-gray-600">
          {[...PERIOD_PRESETS, { id: 'custom' as const, label: 'Personalizado' }].map((p) => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold ${preset === p.id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <label className="flex items-center gap-2">Desde <input type="date" value={custom.start} max={custom.end} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="h-10 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label>
            <label className="flex items-center gap-2">Hasta <input type="date" value={custom.end} min={custom.start} max={localDay()} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="h-10 rounded-lg border border-gray-300 bg-white px-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label>
            {!validCustom && <span className="font-semibold text-red-700 dark:text-red-300">"Desde" debe ser antes de "Hasta"</span>}
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">{formatDay(range.start, { day: 'numeric', month: 'long' })} – {formatDay(range.end, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
      </div>

      <Kpis data={r.summary.data} />

      <section className={card} aria-labelledby="rep-trend">
        <h3 id="rep-trend" className="mb-2 font-bold text-gray-900 dark:text-white">Tendencia de comportamiento</h3>
        {r.trends.isLoading ? <div className="h-52 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" /> : (r.trends.data?.length ?? 0) === 0
          ? <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">Sin puntos en este periodo.</p>
          : <TrendChart points={r.trends.data!} />}
      </section>

      <section className={card} aria-labelledby="rep-rank">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="rep-rank" className="font-bold text-gray-900 dark:text-white">Clases</h3>
          <button type="button" onClick={exportRanking} disabled={!r.ranking.data?.length} className={csvButton}><Download size={14} aria-hidden="true" />CSV</button>
        </div>
        {r.ranking.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-2 font-semibold">Clase</th>
                  <th className="py-2 pr-2 text-right font-semibold">Estudiantes</th>
                  <th className="py-2 pr-2 text-right font-semibold">XP prom.</th>
                  <th className="py-2 pr-2 text-right font-semibold">Positivos</th>
                  <th className="py-2 pr-2 text-right font-semibold">A mejorar</th>
                  <th className="py-2 text-right font-semibold">Asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(r.ranking.data ?? []).map((c, i) => (
                  <tr key={c.classroomId} className="text-gray-900 dark:text-gray-100">
                    <td className="py-2.5 pr-2 font-bold">{i + 1}</td>
                    <td className="py-2.5 pr-2">
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-xs text-gray-700 dark:text-gray-300">{[gradeById.get(c.classroomId), c.curriculumAreaName].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{c.studentCount}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{c.avgXp}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-green-800 dark:text-green-300">+{c.positivePoints}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-red-800 dark:text-red-300">−{c.negativePoints}</td>
                    <td className="py-2.5 text-right tabular-nums">{c.studentCount > 0 ? `${c.attendanceRate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: 'Lo que más se reconoce', icon: TrendingUp, items: r.top.data?.positive ?? [], color: 'text-green-800 dark:text-green-300' },
          { title: 'Lo que más se corrige', icon: TrendingDown, items: r.top.data?.negative ?? [], color: 'text-red-800 dark:text-red-300' },
        ].map((g) => (
          <section key={g.title} className={card}>
            <h3 className={`mb-2 flex items-center gap-2 font-bold ${g.color}`}><g.icon size={18} aria-hidden="true" />{g.title}</h3>
            {g.items.length === 0 ? <p className="py-3 text-sm text-gray-700 dark:text-gray-300">Sin datos en este periodo.</p> : (
              <ol className="space-y-1.5">
                {g.items.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                    <span className="w-5 text-center font-bold text-gray-700 dark:text-gray-300">{i + 1}</span>
                    <span aria-hidden="true">{b.icon || '•'}</span>
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <span className="font-bold tabular-nums">{b.usageCount}×</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <section className={card} aria-labelledby="rep-risk">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 id="rep-risk" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><AlertTriangle size={18} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />Estudiantes que necesitan atención ({r.risk.data?.length ?? 0})</h3>
          <button type="button" onClick={exportRisk} disabled={!r.risk.data?.length} className={csvButton}><Download size={14} aria-hidden="true" />CSV</button>
        </div>
        {r.risk.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" /> : <RiskList items={r.risk.data ?? []} />}
      </section>

      <section className={card} aria-labelledby="rep-att">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="rep-att" className="font-bold text-gray-900 dark:text-white">Asistencia por clase</h3>
          <button type="button" onClick={exportAttendance} disabled={!r.attendance.data?.byClass.length} className={csvButton}><Download size={14} aria-hidden="true" />CSV</button>
        </div>
        {(r.attendance.data?.byClass.length ?? 0) === 0 ? <p className="py-3 text-sm text-gray-700 dark:text-gray-300">Sin registros de asistencia en este periodo.</p> : (
          <ul className="space-y-2">
            {[...r.attendance.data!.byClass].sort((a, b) => b.rate - a.rate).map((c) => (
              <li key={c.classroomId} className="flex items-center gap-3 text-sm">
                <span className="w-36 flex-shrink-0 truncate text-gray-900 dark:text-gray-100 sm:w-52" title={c.name}>{c.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                  <span className={`block h-full rounded-full ${c.rate >= 80 ? 'bg-green-600' : c.rate >= 60 ? 'bg-amber-500' : 'bg-red-600'}`} style={{ width: `${c.rate}%` }} />
                </span>
                <span className="w-12 text-right font-bold tabular-nums text-gray-900 dark:text-white">{c.total > 0 ? `${c.rate}%` : '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
