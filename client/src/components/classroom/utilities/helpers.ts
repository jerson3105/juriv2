import { useEffect } from 'react';

export interface StudentData {
  id: string;
  characterName: string | null;
  realName: string | null;
  realLastName: string | null;
  avatarGender: 'MALE' | 'FEMALE';
  characterClass: string;
  characterClassId?: string | null;
  level: number;
  xp: number;
  hp: number;
  gp: number;
  teamId?: string | null;
  clanName?: string | null;
  clanColor?: string | null;
  clanEmblem?: string | null;
  clanMotto?: string | null;
}

export const getDisplayName = (student: StudentData, showCharacterName: boolean) => {
  if (!showCharacterName) {
    if (student.realName && student.realLastName) return `${student.realLastName}, ${student.realName}`;
    return student.realName || student.characterName || 'Sin nombre';
  }
  return student.characterName || 'Sin nombre';
};

// Barajado uniforme (Fisher–Yates). `sort(() => Math.random() - 0.5)` no lo es.
export const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Escape cierra; opcionalmente Espacio/Enter ejecuta la acción principal (si el foco no está en un campo).
export const useToolKeys = (onEscape: () => void, onPrimary?: () => void) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
      } else if (onPrimary && !typing && event.key === ' ') {
        event.preventDefault();
        onPrimary();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape, onPrimary]);
};

