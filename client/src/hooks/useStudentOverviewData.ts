import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { classNoteApi, type ClassNote } from '../lib/classNoteApi';
import { gradeApi } from '../lib/gradeApi';
import { studentApi } from '../lib/studentApi';

export type StudentGradeAverage = Awaited<ReturnType<typeof gradeApi.getStudentGrades>>['average'];

export type ClassroomNotesSummary = {
  classroomId: string;
  classroomName: string;
  notes: ClassNote[];
};

export const useStudentOverviewData = () => {
  const { data: myClasses = [], isLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
  });

  const noteQueries = useQueries({
    queries: myClasses.map((profile) => ({
      queryKey: ['class-notes', profile.classroomId],
      queryFn: () => classNoteApi.list(profile.classroomId),
      enabled: !!profile.classroomId,
    })),
  });

  const gradeSummaryQueries = useQueries({
    queries: myClasses
      .filter((profile) => profile.classroom?.useCompetencies)
      .map((profile) => ({
        queryKey: ['student-grade-summary', profile.id],
        queryFn: async () => {
          try {
            const gradebook = await gradeApi.getStudentGrades(profile.id, 'CURRENT');
            return {
              studentId: profile.id,
              average: gradebook.average,
            };
          } catch {
            return {
              studentId: profile.id,
              average: null as StudentGradeAverage | null,
            };
          }
        },
        enabled: !!profile.id,
      })),
  });

  const classroomNotes = useMemo<ClassroomNotesSummary[]>(() => (
    myClasses.map((profile, index) => ({
      classroomId: profile.classroomId,
      classroomName: profile.classroom?.name || 'Clase',
      notes: (noteQueries[index]?.data ?? []) as ClassNote[],
    }))
  ), [myClasses, noteQueries]);

  const gradeSummaryByStudentId = useMemo(() => {
    const map = new Map<string, StudentGradeAverage | null>();

    gradeSummaryQueries.forEach((query) => {
      if (query.data?.studentId) {
        map.set(query.data.studentId, query.data.average);
      }
    });

    return map;
  }, [gradeSummaryQueries]);

  const totalPendingNotes = useMemo(() => (
    classroomNotes.reduce(
      (sum, classroom) => sum + classroom.notes.filter((note) => !note.isCompleted).length,
      0
    )
  ), [classroomNotes]);

  const competencyClassesCount = useMemo(() => (
    myClasses.filter((profile) => profile.classroom?.useCompetencies).length
  ), [myClasses]);

  return {
    myClasses,
    isLoading,
    classroomNotes,
    gradeSummaryByStudentId,
    totalPendingNotes,
    competencyClassesCount,
  };
};