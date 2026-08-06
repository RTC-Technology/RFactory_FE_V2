/** Mirrors the backend's Function/FunctionGroup DTOs (RFactory.Application.Modules.Administration.DTOs). */

export interface FunctionDto {
  id: number;
  functionCode: string;
  functionName: string;
  functionGroupId?: number | null;
}

export interface FunctionGroupDto {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  /** Groups nest: a group may sit under another group. */
  parentId?: number | null;
}

export type FunctionRequest = Omit<FunctionDto, 'id'>;
export type FunctionGroupRequest = Omit<FunctionGroupDto, 'id'>;

/** What a catalogue sync wrote. `catalogSize` is the total the app enforces, so a run
 *  that added nothing still confirms the database is complete. */
export interface PermissionSyncResult {
  groupsCreated: number;
  permissionsCreated: number;
  catalogSize: number;
}
