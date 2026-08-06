/** Mirrors OrganizationDto (MasterData) and UserDto (Administration) on the backend. */

export interface OrganizationDto {
  id: number;
  organizationCode: string;
  organizationName: string;
  /** Organizations nest: a unit may sit under another unit. */
  parentId?: number | null;
}

export interface UserDto {
  id: number;
  code: string;
  loginName: string;
  fullName: string;
  email?: string | null;
  isAdmin: boolean;
  organizationId?: number | null;
}

export type OrganizationRequest = Omit<OrganizationDto, 'id'>;

/**
 * Create requires `password`; update treats it as optional and leaves the stored hash
 * alone when it is null — see CreateUserRequest / UpdateUserRequest on the backend.
 * The DTO never returns a password, so it only ever travels in this direction.
 */
export type UserRequest = Omit<UserDto, 'id'> & { password?: string | null };
