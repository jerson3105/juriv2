import type { CSSProperties } from 'react';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import { ConstellationSky } from '../observatorio/descanso/ConstellationSky';
import { classSkyFor, litStarsFor } from '../student/home/classSky';
import { useEquippedAvatar } from '../../hooks/useEquippedAvatar';
import { avatarImageUrl } from '../../lib/avatarApi';
import type { Student } from '../../lib/classroomApi';
import { withAlpha } from '../../lib/storyTheme';

// Luz de la noche sin clan: la misma del Inicio del alumno (índigo).
const NIGHT_LIGHT = '#e0e7ff';
const NIGHT_FLOOR = '#c7d2fe';
const NIGHT_GLOW = '#a5b4fc';

interface AvatarStageProps {
  student: Student;
  classroomId: string;
  /** Color del clan (null sin clan o si la clase no usa clanes). */
  clanColor: string | null;
  /** Avance del nivel (0–100): enciende la constelación de la clase. */
  percent: number;
  lively: boolean;
}

/**
 * Escenario del personaje en la ficha: la noche del Observatorio (como su Inicio y el menú) con la luz de su
 * clan en el halo y la tarima, la franja del clan arriba y la constelación de la clase encendida con su
 * nivel. Si el alumno equipó un fondo, su fondo reemplaza al cielo.
 */
export const AvatarStage = ({ student, classroomId, clanColor, percent, lively }: AvatarStageProps) => {
  const { data: equipped = [] } = useEquippedAvatar(student.id);
  const background = equipped.find((item) => item.slot === 'BACKGROUND');
  const light = clanColor ?? NIGHT_LIGHT;
  const halo: CSSProperties = {
    background: `radial-gradient(closest-side, ${withAlpha(light, clanColor ? 0.38 : 0.42)}, ${withAlpha(light, 0.12)} 62%, transparent)`,
  };
  const floor: CSSProperties = {
    backgroundColor: withAlpha(clanColor ?? NIGHT_FLOOR, clanColor ? 0.4 : 0.3),
    boxShadow: `0 0 24px ${withAlpha(clanColor ?? NIGHT_GLOW, clanColor ? 0.55 : 0.45)}`,
  };

  return (
    <div className={`pg-stage relative isolate overflow-hidden rounded-2xl ${background ? 'bg-gray-900' : 'obs-sky'}`}>
      {background ? (
        <img src={avatarImageUrl(background.avatarItem.imagePath, 'md')} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span className="absolute -inset-x-6 bottom-[7%] top-[3%] rounded-full" style={halo} aria-hidden="true" />
          <span className="absolute inset-x-[12%] bottom-1.5 h-5 rounded-[50%]" style={floor} aria-hidden="true" />
        </>
      )}
      <StudentAvatarMini
        studentProfileId={student.id}
        gender={student.avatarGender || 'MALE'}
        size="xl"
        hideBackground
        className="pg-stage-avatar z-[1]"
      />
      {clanColor && <span className="absolute inset-x-0 top-0 z-[2] h-1" style={{ backgroundColor: clanColor }} aria-hidden="true" />}
      <div className={`absolute right-2 top-3 z-[2] w-14 lg:w-[72px] ${background ? 'rounded-lg bg-[#0b1026]/70 p-1' : ''}`} aria-hidden="true">
        <ConstellationSky constellation={classSkyFor(classroomId)} lit={litStarsFor(percent)} still={!lively} />
      </div>
    </div>
  );
};
