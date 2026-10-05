import { motion, useReducedMotion } from 'framer-motion';
import type { Student } from '../../../lib/classroomApi';
import type { ClassSeasonStudent } from '../../../lib/seasonApi';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { ActTitle } from './CeremonyActs';

// Modo «Temporada» de la gala: reconocimientos que no compiten y el desfile de cada estudiante (nivel e insignias).
// Nunca un puesto ni un podio de XP.

export interface ParadeRow {
  student: Student;
  name: string;
  season: ClassSeasonStudent;
}

export interface SeasonRecognition {
  key: string;
  icon: string;
  title: string;
  detail: string;
  people: ParadeRow[];
}

// Con pocos, se ven sus personajes; con muchos, sus nombres (hasta este tope y «y N más»).
const AVATARS_UP_TO = 3;
const NAMES_UP_TO = 10;
const PARADE_BADGES = 4;

const Avatar = ({ row, box }: { row: ParadeRow; box: string }) => (
  <span className={`flex flex-shrink-0 items-end justify-center ${box}`} aria-hidden="true">
    <StudentAvatarMini studentProfileId={row.student.id} gender={row.student.avatarGender} size="sm" />
  </span>
);

export const RecognitionsAct = ({ items }: { items: SeasonRecognition[] }) => {
  const reduce = useReducedMotion();
  return (
    <div className="w-full">
      <ActTitle kicker="La temporada" title="Reconocimientos" />
      <ul className={`mx-auto grid gap-4 ${items.length === 3 ? 'max-w-6xl lg:grid-cols-3' : items.length === 2 ? 'max-w-4xl md:grid-cols-2' : 'max-w-xl'}`} style={{ perspective: 1000 }}>
        {items.map((item, i) => {
          const few = item.people.length <= AVATARS_UP_TO;
          const named = item.people.slice(0, NAMES_UP_TO);
          const more = item.people.length - named.length;
          return (
            <motion.li
              key={item.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ delay: 0.4 + i * 0.7, duration: 0.6, ease: 'easeOut' }}
              className="rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-indigo-900/90 to-slate-900/90 p-4 shadow-[0_0_30px_rgba(252,211,77,0.15)]"
            >
              <p className="text-sm font-bold uppercase tracking-wide text-amber-300"><span aria-hidden="true">{item.icon} </span>{item.title}</p>
              <p className="text-sm text-indigo-100">{item.detail}</p>
              {few ? (
                <ul className="mt-3 flex flex-wrap justify-center gap-4">
                  {item.people.map((row) => (
                    <li key={row.student.id} className="flex w-28 flex-col items-center text-center">
                      <Avatar row={row} box="h-28 w-16" />
                      <span className="mt-1 w-full truncate text-lg font-black text-white" title={row.name}>{row.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {named.map((row) => (
                    <li key={row.student.id} className="max-w-full truncate rounded-full bg-white/10 px-3 py-1 text-base font-bold text-white" title={row.name}>{row.name}</li>
                  ))}
                  {more > 0 && <li className="rounded-full px-2 py-1 text-base font-bold text-indigo-100">y {more} más</li>}
                </ul>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
};

/** El desfile: cada estudiante (por orden alfabético) con su personaje, su nivel y sus insignias; página a página. */
export const ParadeAct = ({ rows, page, pages }: { rows: ParadeRow[]; page: number; pages: number }) => {
  const reduce = useReducedMotion();
  return (
    <div className="w-full">
      <ActTitle kicker={pages > 1 ? `Desfile · ${page + 1} de ${pages}` : 'Desfile'} title="¡Toda la clase!" />
      <ul key={page} className="mx-auto grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((row, i) => {
          const shown = row.season.badges.slice(0, PARADE_BADGES);
          const more = row.season.badgeCount - shown.reduce((sum, badge) => sum + badge.times, 0);
          return (
            <motion.li
              key={row.student.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center rounded-3xl border border-white/15 bg-white/10 p-3 text-center backdrop-blur"
            >
              <Avatar row={row} box="h-28 w-16" />
              <p className="mt-1 w-full truncate text-lg font-black text-white" title={row.name}>{row.name}</p>
              <p className="mt-1 rounded-full bg-amber-300/20 px-3 py-0.5 text-sm font-black text-amber-200">Nivel {row.season.level}</p>
              {row.season.badgeCount > 0 ? (
                <ul className="mt-2 flex flex-wrap items-center justify-center gap-1" aria-label={`${row.season.badgeCount} ${row.season.badgeCount === 1 ? 'insignia' : 'insignias'}`}>
                  {shown.map((badge) => (
                    <li key={badge.id} title={badge.name}>
                      <BadgeMedallion badge={badge} size="sm" animated={false} />
                      <span className="sr-only">{badge.name}</span>
                    </li>
                  ))}
                  {more > 0 && <li className="px-1 text-sm font-bold text-indigo-100">+{more}</li>}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-indigo-100">¡Por más en la próxima temporada!</p>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
};
