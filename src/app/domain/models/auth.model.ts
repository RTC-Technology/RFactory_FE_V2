export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  /** True for superadmins — bypasses permission checks everywhere (see AuthService.hasPermission). */
  isAdmin: boolean;
  /** FunctionCode values granted to this user. Empty for non-admins until UserGroup rights are wired up. */
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

/** Maps 1:1 to the backend's UserProfileDto (GET /api/auth/me). */
export interface UserProfileDto {
  id: number;
  loginName: string;
  fullName: string;
  email?: string | null;
  isAdmin: boolean;
  permissions: string[];
}
