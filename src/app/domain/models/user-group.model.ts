/** Mirrors UserGroupDto (RFactory.Application.Modules.Administration.DTOs). */

export interface UserGroupDto {
  id: number;
  code: string;
  name: string;
}

export type UserGroupRequest = Omit<UserGroupDto, 'id'>;
