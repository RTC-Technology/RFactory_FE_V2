/** Mirrors the backend DTOs in RFactory.Application.Modules.HumanResources.DTOs. */

export interface EmployeeDto {
  id: number;
  employeeCode: string;
  fullName: string;
  nickName?: string | null;
  organizationId?: number | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  status: number;
  remark?: string | null;
}

/** Create/Update share one shape per entity on the backend, so one type covers both. */
export type EmployeeRequest = Omit<EmployeeDto, 'id'>;

/** Same coding as the other master-data statuses: 0 inactive, 1 active, 2 pending. */
export const EMPLOYEE_STATUS = [
  {
    labelKey: 'employee.status.inactive',
    value: 0,
    severity: 'danger' as const,
  },
  {
    labelKey: 'employee.status.active',
    value: 1,
    severity: 'success' as const,
  },
  {
    labelKey: 'employee.status.pending',
    value: 2,
    severity: 'warn' as const,
  },
];

export const EMPLOYEE_GENDERS = [
  { labelKey: 'employee.gender.male', value: 'M' },
  { labelKey: 'employee.gender.female', value: 'F' },
  { labelKey: 'employee.gender.other', value: 'O' },
];

export function employeeStatusOf(status?: number | null) {
  return EMPLOYEE_STATUS.find(s => s.value === status);
}