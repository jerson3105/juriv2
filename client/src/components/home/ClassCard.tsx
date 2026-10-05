import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Archive, Check, ClipboardCheck, Copy, Layers, MonitorUp, RotateCcw, ShoppingBag, Trash2, Zap } from 'lucide-react';
import type { Classroom, ClassroomOverview } from '../../lib/classroomApi';
import { ActionMenu } from './ActionMenu';
import { classTheme, copyClassCode, gradeLabel, pendingOf, relativeTime } from './homeHelpers';

interface ClassCardProps {
  classroom: Classroom;
  overview?: ClassroomOverview;
  schoolName?: string | null; // se muestra solo cuando la tarjeta aparece fuera de su sección
  index: number;
  onDuplicate: (classroom: Classroom) => void;
  onArchive: (classroom: Classroom) => void;
  onRestore: (classroom: Classroom) => void;
  onDelete: (classroom: Classroom) => void;
  onProject: (classroom: Classroom) => void;
}

const chip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold';

// Iniciales para el sello de la clase cuando no tiene emoji de tema.
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Tarjeta de clase: toda la tarjeta entra a la clase (enlace estirado); código, pendientes y menú quedan encima.
export const ClassCard = ({ classroom, overview, schoolName, index, onDuplicate, onArchive, onRestore, onDelete, onProject }: ClassCardProps) => {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const theme = classTheme(classroom);
  const archived = classroom.isActive === false;
  const students = classroom.studentCount ?? 0;
  const pending = pendingOf(overview);
  const grade = gradeLabel(classroom.gradeLevel);
  // Una clase del año que el colegio prepara: aún sin estudiantes (puede llamarse igual que la de este año).
  const preparing = classroom.context?.yearStatus === 'PLANNING' ? `${classroom.context.year} · en preparación` : null;
  const last = relativeTime(overview?.lastActivityAt ?? null);

  const copy = async () => {
    if (await copyClassCode(classroom.code)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 9) * 0.04 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary-500 hover:shadow-lg dark:bg-gray-800 ${archived ? 'border-dashed border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}
    >
      <span className={`h-1.5 ${archived ? 'bg-gray-300 dark:bg-gray-600' : ''}`} style={archived ? undefined : { background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-black text-white shadow-md ${archived ? 'bg-gray-400 dark:bg-gray-600' : ''}`}
            style={archived ? undefined : { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
            aria-hidden="true"
          >
            {theme.emoji ? <span className="text-2xl">{theme.emoji}</span> : initials(classroom.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-tight text-gray-900 dark:text-white">
              <Link to={`/classroom/${classroom.id}`} className="outline-none after:absolute after:inset-0 after:content-[''] hover:underline" title={classroom.name}>
                <span className="line-clamp-2 break-words">{classroom.name}</span>
              </Link>
            </h3>
            <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
              {[grade, preparing ?? `${students} ${students === 1 ? 'estudiante' : 'estudiantes'}`].filter(Boolean).join(' · ')}
            </p>
            {schoolName !== undefined && (
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-700 dark:text-gray-300">{schoolName ? `🏫 ${schoolName}` : 'Sin escuela'}</p>
            )}
          </div>
          <ActionMenu
            label={`Más acciones de ${classroom.name}`}
            items={archived
              ? [
                  { label: 'Restaurar', icon: RotateCcw, onClick: () => onRestore(classroom) },
                  { label: 'Eliminar definitivamente', icon: Trash2, danger: true, onClick: () => onDelete(classroom) },
                ]
              : [
                  { label: 'Proyectar código', icon: MonitorUp, onClick: () => onProject(classroom) },
                  { label: 'Duplicar clase', icon: Layers, onClick: () => onDuplicate(classroom) },
                  { label: 'Archivar', icon: Archive, onClick: () => onArchive(classroom) },
                ]}
          />
        </div>

        {archived ? (
          <p className={`${chip} w-fit bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100`}>
            <Archive size={12} aria-hidden="true" />
            Archivada
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {overview && overview.xpToday > 0 && (
              <span className={`${chip} bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100`}>
                <Zap size={12} aria-hidden="true" />
                +{overview.xpToday.toLocaleString('es')} XP hoy
              </span>
            )}
            {pending > 0 && (
              <Link to={`/classroom/${classroom.id}/shop`} className={`${chip} relative z-10 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70`}>
                <ShoppingBag size={12} aria-hidden="true" />
                {pending} por atender
              </Link>
            )}
            {students > 0 && overview && (overview.attendanceToday > 0 ? (
              <span className={`${chip} bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100`}>
                <ClipboardCheck size={12} aria-hidden="true" />
                Asistencia tomada
              </span>
            ) : (
              <Link to={`/classroom/${classroom.id}/attendance`} className={`${chip} relative z-10 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600`}>
                <ClipboardCheck size={12} aria-hidden="true" />
                Pasar lista
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-700 dark:text-gray-300">
          {last ? `Última actividad: ${last}` : 'Sin actividad en los últimos 30 días'}
        </p>

        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Código de clase</p>
            <p className="font-mono text-lg font-black tracking-wider text-gray-900 dark:text-white">{classroom.code}</p>
          </div>
          <div className="flex">
            <button type="button" onClick={copy} aria-label={`Copiar código ${classroom.code}`} title="Copiar código" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              {copied ? <Check size={18} className="text-green-700 dark:text-green-300" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            </button>
            {!archived && (
              <button type="button" onClick={() => onProject(classroom)} aria-label={`Proyectar código ${classroom.code}`} title="Proyectar código" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
                <MonitorUp size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.li>
  );
};
