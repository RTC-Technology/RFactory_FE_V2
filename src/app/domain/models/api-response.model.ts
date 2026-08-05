/** Mirrors the backend's ApiResponse<T> envelope (RFactory.Shared.Api.ApiResponse). */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message?: string | null;
  data: T;
  errors?: unknown;
}
