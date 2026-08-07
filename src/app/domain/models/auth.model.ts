export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  /** True for superadmins — bypasses permission checks everywhere (see AuthService.hasPermission). */
  isAdmin: boolean;
  /** FunctionCode values this user's groups grant. Admins bypass checks regardless. */
  permissions: string[];
}

/**
 * Only the access token. The refresh token lives in an httpOnly cookie the browser
 * attaches to /api/auth by itself — it is deliberately unreachable from JavaScript, so
 * there is nothing here to hold.
 */
export interface AuthTokens {
  accessToken: string;
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
