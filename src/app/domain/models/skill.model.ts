/** Mirrors RFactory.Application.Modules.HumanResources.DTOs.SkillDto / EmployeeSkillDto */

export interface SkillDto {
  id: number;
  skillCode: string;
  skillName: string;
  skillCategory?: string | null;
  description?: string | null;
}

export type SkillRequest = Omit<SkillDto, 'id'>;

export interface EmployeeSkillDto {
  id: number;
  employeeId: number;
  skillId: number;
  skillCode?: string | null;
  skillName?: string | null;
  skillCategory?: string | null;
  /** 1 = Beginner … 5 = Expert. Null = unrated. */
  proficiencyLevel?: number | null;
  acquiredDate?: string | null;
  notes?: string | null;
}

export type EmployeeSkillRequest = Omit<EmployeeSkillDto, 'id' | 'skillCode' | 'skillName' | 'skillCategory'>;

/** Display labels for proficiency levels 1–5. */
export const PROFICIENCY_LEVELS = [
  { value: 1, labelKey: 'skill.prof.beginner' },
  { value: 2, labelKey: 'skill.prof.elementary' },
  { value: 3, labelKey: 'skill.prof.intermediate' },
  { value: 4, labelKey: 'skill.prof.advanced' },
  { value: 5, labelKey: 'skill.prof.expert' },
] as const;

export function proficiencyOf(level?: number | null) {
  return PROFICIENCY_LEVELS.find(p => p.value === level);
}
