/** Mirrors the backend's FunctionDto (RFactory.Application.Modules.Administration.DTOs). */
export interface FunctionDto {
  id: number;
  functionCode: string;
  functionName: string;
  functionGroupId?: number | null;
}
