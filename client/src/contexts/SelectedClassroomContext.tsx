import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '../lib/parentApi';
import type { ChildSummary } from '../lib/parentApi';

interface SelectedClassroom {
  studentProfileId: string;
  classroomId: string;
  classroomName: string;
  studentName: string;
  teacherName: string;
}

interface SelectedClassroomContextType {
  children: ChildSummary[];
  isLoading: boolean;
  selected: SelectedClassroom | null;
  setSelected: (child: ChildSummary) => void;
  hasMultipleChildren: boolean;
}

const SelectedClassroomContext = createContext<SelectedClassroomContextType | null>(null);

export function SelectedClassroomProvider({ children: providerChildren }: { children: ReactNode }) {
  const [selected, setSelectedState] = useState<SelectedClassroom | null>(null);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['parent-children'],
    queryFn: parentApi.getChildren,
  });

  // Auto-select when there's only one child, or restore first if none selected
  useEffect(() => {
    if (children.length === 0) return;
    if (selected) {
      // Verify selected still exists in children list
      const stillExists = children.some(
        (c: ChildSummary) => c.studentProfileId === selected.studentProfileId
      );
      if (stillExists) return;
    }
    // Auto-select first child
    const first = children[0];
    setSelectedState({
      studentProfileId: first.studentProfileId,
      classroomId: first.classroomId,
      classroomName: first.classroomName,
      studentName: first.studentName,
      teacherName: first.teacherName,
    });
  }, [children, selected]);

  const setSelected = (child: ChildSummary) => {
    setSelectedState({
      studentProfileId: child.studentProfileId,
      classroomId: child.classroomId,
      classroomName: child.classroomName,
      studentName: child.studentName,
      teacherName: child.teacherName,
    });
  };

  return (
    <SelectedClassroomContext.Provider
      value={{
        children,
        isLoading,
        selected,
        setSelected,
        hasMultipleChildren: children.length > 1,
      }}
    >
      {providerChildren}
    </SelectedClassroomContext.Provider>
  );
}

export function useSelectedClassroom() {
  const ctx = useContext(SelectedClassroomContext);
  if (!ctx) {
    throw new Error('useSelectedClassroom must be used within SelectedClassroomProvider');
  }
  return ctx;
}
