import { describe, expect, it } from 'vitest';
import { deriveAssignment } from './assignment.js';

describe('season assignment carry-forward', () => {
  it('starts a new member as Student/Rookie', () => {
    expect(deriveAssignment(null)).toEqual({ role: 'student', studentExperience: 'rookie' });
  });

  it('carries a Student Leader and promotes a rookie in the immediately previous season', () => {
    expect(
      deriveAssignment({
        role: 'student_leader',
        studentExperience: 'rookie',
        state: 'active',
        immediatelyPrevious: true,
      }),
    ).toEqual({ role: 'student_leader', studentExperience: 'veteran' });
  });

  it('keeps veterans as veterans', () => {
    expect(
      deriveAssignment({
        role: 'student',
        studentExperience: 'veteran',
        state: 'active',
        immediatelyPrevious: true,
      }),
    ).toEqual({ role: 'student', studentExperience: 'veteran' });
  });

  it('does not promote a rookie after a skipped season', () => {
    expect(
      deriveAssignment({
        role: 'student',
        studentExperience: 'rookie',
        state: 'active',
        immediatelyPrevious: false,
      }),
    ).toEqual({ role: 'student', studentExperience: 'rookie' });
  });

  it('does not restore the role or experience from a removed membership', () => {
    expect(
      deriveAssignment({
        role: 'team_admin',
        studentExperience: null,
        state: 'removed',
        immediatelyPrevious: true,
      }),
    ).toEqual({ role: 'student', studentExperience: 'rookie' });
  });

  it('carries a mentor without student experience', () => {
    expect(
      deriveAssignment({
        role: 'mentor',
        studentExperience: null,
        state: 'active',
        immediatelyPrevious: true,
      }),
    ).toEqual({ role: 'mentor', studentExperience: null });
  });
});
