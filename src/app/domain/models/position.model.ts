/** Mirrors RFactory.Application.Modules.HumanResources.DTOs.PositionDto */

export interface PositionDto {
  id: number;
  positionCode: string;
  positionName: string;
  department?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}

export type PositionRequest = Omit<PositionDto, 'id'>;
