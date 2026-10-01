import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, CircleCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { historyApi } from '../../lib/historyApi';
import type { ClassStatsOverview } from '../../lib/statsApi';
import { useThemeStore } from '../../store/themeStore';
import { describeEntry, timeLabel, TONE_TEXT } from '../history/historyHelpers';
import { card } from '../gradebook/gradebookHelpers';
import { changeLabel, REASON_STYLE, shortDate } from './statsHelpers';

type NameOf = (student: { studentProfileId: string; studentName: string; characterName: string | null }) => { primary: string; secondary: string | null };

// ---------- Necesitan atención ----------

export const AttentionList = ({ classroomId, data, nameOf }: { classroomId: string; data: ClassStatsOverview; nameOf: NameOf }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? data.attention : data.attention.slice(0, 6);
  return (
    <section aria-labelledby="attention-title" className={card}>
      <h2 id="attention-title" className="text-base font-bold text-gray-900 dark:text-white">Necesitan atención</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Vida baja, días sin puntos, faltas seguidas, conductas a mejorar o «en inicio» en alguna competencia. Toca un alumno para ver su perfil.
      </p>
      {data.attention.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          <CircleCheck size={18} aria-hidden="true" /> Nadie necesita atención especial ahora.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
            {visible.map((student) => {
              const names = nameOf(student);
              return (
                <li key={student.studentProfileId}>
                  <Link to={`/classroom/${classroomId}/student/${student.studentProfileId}${student.reasons.some((r) => r.kind === 'GRADE_C') && student.reasons.length === 1 ? '?tab=aprendizaje' : ''}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900 dark:text-white">{names.primary}</span>
                      {names.secondary && <span className="block text-sm text-gray-700 dark:text-gray-300">{names.secondary}</span>}
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {student.reasons.map((reason, i) => (
                          <span key={`${reason.kind}-${i}`} className={`rounded-full px-2 py-0.5 text-xs font-bold ${REASON_STYLE[reason.kind]}`}>{reason.label}</span>
                        ))}
                      </span>
                    </span>
                    <ChevronRight size={18} className="flex-shrink-0 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.attention.length > 6 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
              className="mt-2 min-h-[44px] rounded-xl px-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">
              {showAll ? 'Ver menos' : `Ver todos (${data.attention.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
};

// ---------- Clima de la clase ----------

export const ClimateSection = ({ data }: { data: ClassStatsOverview }) => {
  const dark = useThemeStore((s) => s.resolvedTheme) === 'dark';
  const { climate } = data;
  const positiveColor = dark ? '#34d399' : '#047857';
  const negativeColor = dark ? '#f87171' : '#b91c1c';
  const series = climate.series.map((p) => ({ ...p, label: shortDate(p.date) }));
  const total = climate.current.positive + climate.current.negative;
  const ratio = total > 0 ? Math.round((climate.current.positive / total) * 100) : null;
  const unit = climate.bucket === 'week' ? 'semana' : 'día';
  return (
    <section aria-labelledby="climate-title" className={`${card} space-y-4`}>
      <div>
        <h2 id="climate-title" className="text-base font-bold text-gray-900 dark:text-white">Clima de la clase</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Reconocimientos (puntos dados) frente a conductas a mejorar (puntos quitados). Sin contar lo revertido.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-gray-700 dark:text-gray-300">Reconocimientos</dt>
          <dd className="text-xl font-black tabular-nums text-emerald-800 dark:text-emerald-300">{climate.current.positive}</dd>
          <dd className="text-sm text-gray-700 dark:text-gray-300">{changeLabel(climate.current.positive, climate.previous?.positive)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-700 dark:text-gray-300">A mejorar</dt>
          <dd className="text-xl font-black tabular-nums text-red-800 dark:text-red-300">{climate.current.negative}</dd>
          <dd className="text-sm text-gray-700 dark:text-gray-300">{changeLabel(climate.current.negative, climate.previous?.negative)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-700 dark:text-gray-300">Positivo</dt>
          <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{ratio === null ? '—' : `${ratio} %`}</dd>
          <dd className="text-sm text-gray-700 dark:text-gray-300">de todo lo registrado</dd>
        </div>
      </dl>

      {series.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">Sin puntos en este periodo.</p>
      ) : (
        <figure className="space-y-2">
          <div className="h-60 text-gray-700 dark:text-gray-300" role="img"
            aria-label={`Reconocimientos y conductas a mejorar por ${unit}: ${climate.current.positive} reconocimientos y ${climate.current.negative} a mejorar en ${data.period.label.toLowerCase()}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: 'currentColor' }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 13, fill: 'currentColor' }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.08 }}
                  contentStyle={{ background: dark ? '#1f2937' : '#ffffff', border: '1px solid #9ca3af', borderRadius: 12, color: dark ? '#f9fafb' : '#111827' }} />
                <Legend wrapperStyle={{ fontSize: 14 }} formatter={(value) => <span className="text-gray-900 dark:text-white">{value}</span>} />
                <Bar dataKey="positive" name="Reconocimientos" fill={positiveColor} radius={[4, 4, 0, 0]} />
                <Bar dataKey="negative" name="A mejorar" fill={negativeColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="text-sm">
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-primary-800 dark:text-primary-200">Ver como tabla</summary>
            <div className="max-w-md overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th scope="col" className="py-2 font-bold text-gray-900 dark:text-white">{climate.bucket === 'week' ? 'Semana del' : 'Día'}</th>
                    <th scope="col" className="py-2 text-right font-bold text-gray-900 dark:text-white">Reconocimientos</th>
                    <th scope="col" className="py-2 text-right font-bold text-gray-900 dark:text-white">A mejorar</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((p) => (
                    <tr key={p.date} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-1.5 text-gray-900 dark:text-white">{p.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{p.positive}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{p.negative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </figure>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <BehaviorBars title="Más reconocido" icon={<ThumbsUp size={16} aria-hidden="true" />} items={climate.topPositive} tone="positive" empty="Aún no hay reconocimientos en el periodo." />
        <BehaviorBars title="Más corregido" icon={<ThumbsDown size={16} aria-hidden="true" />} items={climate.topNegative} tone="negative" empty="Ninguna conducta a mejorar en el periodo." />
      </div>
    </section>
  );
};

const BehaviorBars = ({ title, icon, items, tone, empty }: {
  title: string; icon: React.ReactNode; items: Array<{ name: string; icon: string | null; events: number }>; tone: 'positive' | 'negative'; empty: string;
}) => {
  const top = Math.max(1, ...items.map((i) => i.events));
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">{icon} {title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.name}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-gray-900 dark:text-white">{item.icon ? `${item.icon} ` : ''}{item.name}</span>
                <span className="flex-shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">{item.events} {item.events === 1 ? 'vez' : 'veces'}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                <div className={`h-2 rounded-full ${tone === 'positive' ? 'bg-emerald-700 dark:bg-emerald-400' : 'bg-red-700 dark:bg-red-400'}`} style={{ width: `${(item.events / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------- Gamificación en detalle (plegada) ----------

export const GamificationDetails = ({ classroomId, data, classLabel }: { classroomId: string; data: ClassStatsOverview; classLabel: (key: string) => string }) => {
  const { gamification, badges, studentCount } = data;
  const topLevel = Math.max(1, ...gamification.levels.map((l) => l.total));
  const topClass = Math.max(1, ...gamification.classes.map((c) => c.total));
  const avgGp = studentCount ? Math.round(gamification.gpTotal / studentCount) : 0;
  return (
    <details className={`${card} group`}>
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 text-base font-bold text-gray-900 dark:text-white">
        Gamificación en detalle
        <ChevronRight size={18} className="transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="mt-3 space-y-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Con al menos una insignia</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{badges.studentsWithBadge} <span className="text-base font-semibold">de {studentCount}</span></dd>
          </div>
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Insignias en el periodo</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{badges.awardedInPeriod}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Sin reconocimientos en el periodo</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{gamification.withoutRecognition}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-700 dark:text-gray-300">Oro por alumno</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{avgGp} GP</dd>
            {gamification.shopPrices && (
              <dd className="text-sm text-gray-700 dark:text-gray-300">La tienda va de {gamification.shopPrices.min} a {gamification.shopPrices.max} GP (mitad hasta {gamification.shopPrices.median})</dd>
            )}
          </div>
        </dl>
        <p className="text-sm">
          <Link to={`/classroom/${classroomId}/badges`} className="inline-flex min-h-[44px] items-center font-semibold text-primary-800 underline-offset-2 hover:underline dark:text-primary-200">Ver insignias</Link>
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Alumnos por nivel</h3>
            <ul className="space-y-1.5">
              {gamification.levels.map((l) => (
                <li key={l.level} className="flex items-center gap-2 text-sm">
                  <span className="w-16 flex-shrink-0 text-gray-900 dark:text-white">Nivel {l.level}</span>
                  <span className="h-2.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                    <span className="block h-2.5 rounded-full bg-primary-700 dark:bg-primary-400" style={{ width: `${(l.total / topLevel) * 100}%` }} />
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{l.total} {l.total === 1 ? 'alumno' : 'alumnos'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Clases de personaje</h3>
            <ul className="space-y-1.5">
              {gamification.classes.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-sm">
                  <span className="w-28 flex-shrink-0 truncate text-gray-900 dark:text-white">{classLabel(c.key)}</span>
                  <span className="h-2.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                    <span className="block h-2.5 rounded-full bg-violet-700 dark:bg-violet-400" style={{ width: `${(c.total / topClass) * 100}%` }} />
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{c.total} ({Math.round((c.total / Math.max(1, studentCount)) * 100)} %)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </details>
  );
};

// ---------- Actividad reciente ----------

export const RecentActivity = ({ classroomId, nameById }: { classroomId: string; nameById: Map<string, string> }) => {
  const { data } = useQuery({
    queryKey: ['history-feed', classroomId, 'recent-5'],
    queryFn: () => historyApi.getFeed(classroomId, { limit: 5 }),
  });
  const entries = data?.entries ?? [];
  return (
    <section aria-labelledby="recent-title" className={card}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-title" className="text-base font-bold text-gray-900 dark:text-white">Actividad reciente</h2>
        <Link to={`/classroom/${classroomId}/history`} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary-800 hover:underline dark:text-primary-200">
          Ver registro completo <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">Todavía no hay actividad.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {entries.map((entry) => {
            const info = describeEntry(entry);
            return (
              <li key={entry.key + entry.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-gray-900 dark:text-white">
                  <span className="font-semibold">{nameById.get(entry.studentId) ?? entry.studentName ?? 'Estudiante'}</span> · {info.title}
                </span>
                {info.amount && <span className={`flex-shrink-0 font-bold tabular-nums ${TONE_TEXT[info.tone]}`}>{info.amount}</span>}
                <span className="flex-shrink-0 text-gray-700 dark:text-gray-300">{timeLabel(entry.timestamp)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
