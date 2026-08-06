/** Mirrors the backend DTOs in RFactory.Application.Modules.Equipment.DTOs. */

export interface MachineTypeDto {
  id: number;
  machineTypeCode: string;
  machineTypeName: string;
}

export interface MachineDto {
  id: number;
  /** Where the machine physically sits. Independent of `machineTypeId`. */
  lineId?: number | null;
  /** What kind of machine it is. Independent of `lineId`. */
  machineTypeId?: number | null;
  machineCode: string;
  machineName: string;
  status?: number | null;
}

export type MachineTypeRequest = Omit<MachineTypeDto, 'id'>;
export type MachineRequest = Omit<MachineDto, 'id'>;

/**
 * `Machine.Status` is a nullable int with no enum or lookup table behind it, exactly
 * like `Line.Status`. These labels mirror the assumption made there — if the two tables
 * turn out to code status differently, they can diverge here without touching Line.
 */
export const MACHINE_STATUSES = [
  { labelKey: 'plant.status.running', value: 1, severity: 'success' as const },
  { labelKey: 'plant.status.stopped', value: 0, severity: 'danger' as const },
];

export function machineStatusOf(status?: number | null) {
  return MACHINE_STATUSES.find(s => s.value === status);
}
