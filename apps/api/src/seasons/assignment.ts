import type { MembershipState, SeasonRole, StudentExperience } from '../database/schema/enums.js';

export interface PreviousAssignment {
  role: SeasonRole;
  studentExperience: StudentExperience | null;
  state: MembershipState;
  immediatelyPrevious: boolean;
}

export interface SeasonAssignment {
  role: SeasonRole;
  studentExperience: StudentExperience | null;
}

const newStudentAssignment: SeasonAssignment = {
  role: 'student',
  studentExperience: 'rookie',
};

export function deriveAssignment(previous: PreviousAssignment | null): SeasonAssignment {
  if (!previous || previous.state === 'removed') return { ...newStudentAssignment };

  if (previous.role === 'team_admin' || previous.role === 'mentor') {
    return { role: previous.role, studentExperience: null };
  }

  const priorExperience = previous.studentExperience ?? 'rookie';
  const studentExperience =
    previous.immediatelyPrevious && priorExperience === 'rookie' ? 'veteran' : priorExperience;

  return { role: previous.role, studentExperience };
}
