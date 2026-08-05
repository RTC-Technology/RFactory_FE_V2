/** Mirrors the backend's MenuDto (RFactory.Application.Modules.Administration.DTOs). */
export interface MenuDto {
  id: number;
  name: string;
  url?: string | null;
  icon?: string | null;
  order?: number | null;
  parentId?: number | null;
  functionId?: number | null;
  /** Populated only by GET /api/auth/menus (tree endpoint). */
  children?: MenuDto[] | null;
}

export interface CreateMenuRequest {
  name: string;
  url?: string | null;
  icon?: string | null;
  order?: number | null;
  parentId?: number | null;
  functionId?: number | null;
}

export interface UpdateMenuRequest {
  name: string;
  url?: string | null;
  icon?: string | null;
  order?: number | null;
  parentId?: number | null;
  functionId?: number | null;
}
