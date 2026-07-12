import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useMyStudents } from '../hooks/useParent';
import type { ParentStudentView } from '../types/parent.types';

// A parent account can be linked to more than one student (see
// ParentController#link — school_admin can attach the same parent to
// several children). Every parent-portal page (dashboard/tuition/
// installments/payments) needs to know which child is currently
// selected, so this is lifted into one context shared by all of them
// instead of each page re-fetching /parent/students and managing its
// own selection state.

interface ParentStudentContextValue {
  students: ParentStudentView[];
  selectedStudent: ParentStudentView | null;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}

const ParentStudentContext = createContext<ParentStudentContextValue | null>(null);

export function ParentStudentProvider({ children }: { children: ReactNode }) {
  const studentsQuery = useMyStudents();
  const students = studentsQuery.data ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Default to the first linked child once the list arrives, and keep the
  // selection valid if it ever stops matching (e.g. a school_admin unlinks
  // the currently-selected child while the parent is on the page).
  useEffect(() => {
    if (students.length === 0) return;
    const stillValid = students.some((s) => s.id === selectedStudentId);
    if (!selectedStudentId || !stillValid) {
      setSelectedStudentId(students[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null;

  return (
    <ParentStudentContext.Provider
      value={{
        students,
        selectedStudent,
        selectedStudentId,
        setSelectedStudentId,
        isLoading: studentsQuery.isLoading,
        isError: studentsQuery.isError,
      }}
    >
      {children}
    </ParentStudentContext.Provider>
  );
}

export function useParentStudent(): ParentStudentContextValue {
  const ctx = useContext(ParentStudentContext);
  if (!ctx) throw new Error('useParentStudent must be used within ParentStudentProvider');
  return ctx;
}
