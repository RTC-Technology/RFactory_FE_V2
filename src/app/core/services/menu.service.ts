import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../domain/models/api-response.model';
import { CreateMenuRequest, MenuDto, UpdateMenuRequest } from '../../domain/models/menu-dto.model';
import { MenuItem } from '../../domain/models/menu-item.model';
import { I18nService } from './i18n.service';

/** Admin CRUD surface — returns the *whole* catalogue, unfiltered by the caller's rights. */
const MENUS_API_BASE = `${environment.apiUrl}/administration/menus`;
/** Tree endpoint that drives the sidebar, already filtered server-side by IsAdmin/FunctionId. */
const MY_MENUS_URL = `${environment.apiUrl}/auth/menus`;

/**
 * How deep the sidebar can actually render: it draws top-level items plus one
 * level of `children` and stops. Anything nested deeper exists in the database
 * but is invisible to users, so the Menu Manager refuses to create it.
 */
export const MAX_MENU_DEPTH = 2;

/** Everything a menu item needs on write. The backend maps the whole payload onto
 *  the entity, so a partial update would blank the omitted columns — always send all of it. */
export interface MenuFormValue {
  label: string;
  route?: string | null;
  icon?: string | null;
  order?: number | null;
  parentId?: string | null;
  functionId?: string | null;
}

function toMenuItem(dto: MenuDto): MenuItem {
  return {
    id: String(dto.id),
    label: dto.name,
    route: dto.url ?? undefined,
    icon: dto.icon ?? undefined,
    order: dto.order ?? undefined,
    parentId: dto.parentId != null ? String(dto.parentId) : undefined,
    functionId: dto.functionId != null ? String(dto.functionId) : undefined,
    children: dto.children?.length ? dto.children.map(toMenuItem) : undefined,
  };
}

function byOrderThenLabel(a: MenuItem, b: MenuItem): number {
  const diff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  return diff !== 0 ? diff : a.label.localeCompare(b.label);
}

/**
 * Assembles the flat admin list into the same tree shape the sidebar endpoint returns.
 * Items whose `parentId` points at something missing (parent deleted out from under
 * them) surface at the root instead of vanishing — the Menu Manager is the only place
 * an admin can spot and repair them.
 */
function buildTree(flat: MenuDto[]): MenuItem[] {
  const items = flat.map(dto => ({ ...toMenuItem(dto), children: [] as MenuItem[] }));
  const byId = new Map(items.map(item => [item.id, item]));

  const roots: MenuItem[] = [];
  for (const item of items) {
    const parent = item.parentId ? byId.get(item.parentId) : undefined;
    (parent ? parent.children! : roots).push(item);
  }

  const prune = (nodes: MenuItem[]): MenuItem[] => {
    nodes.sort(byOrderThenLabel);
    for (const node of nodes) {
      node.children = node.children?.length ? prune(node.children) : undefined;
    }
    return nodes;
  };

  return prune(roots);
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  // ─── Sidebar tree (GET /api/auth/menus) ────────────────────────────────────
  private readonly _items = signal<MenuItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Tree for the *current user*, already sorted by `order` at every level. */
  readonly menuItems = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // ─── Admin catalogue (GET /api/administration/menus) ───────────────────────
  private readonly _catalogue = signal<MenuItem[]>([]);
  private readonly _catalogueLoading = signal(false);

  /** Every menu item in the system, as a tree. Independent of the caller's rights. */
  readonly catalogue = this._catalogue.asReadonly();
  readonly catalogueLoading = this._catalogueLoading.asReadonly();

  /** Loads the tree for the current user. Call on app start and after login. */
  load(): Observable<MenuItem[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<ApiResponse<MenuDto[]>>(MY_MENUS_URL).pipe(
      map(res => (res.data ?? []).map(toMenuItem)),
      tap({
        next: items => { this._items.set(items); this._loading.set(false); },
        error: () => this._loading.set(false),
      }),
      catchError(err => {
        this._error.set(this.i18n.t('menu.err.loadFailed'));
        return throwError(() => err);
      }),
    );
  }

  /** Loads the full catalogue for the Menu Manager. */
  loadCatalogue(): Observable<MenuItem[]> {
    this._catalogueLoading.set(true);
    return this.http.get<ApiResponse<MenuDto[]>>(MENUS_API_BASE).pipe(
      map(res => buildTree(res.data ?? [])),
      tap({
        next: items => { this._catalogue.set(items); this._catalogueLoading.set(false); },
        error: () => this._catalogueLoading.set(false),
      }),
    );
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  create(value: MenuFormValue): Observable<MenuItem[]> {
    const body: CreateMenuRequest = {
      ...this._toRequest(value),
      order: value.order ?? this.nextOrder(value.parentId ?? undefined),
    };
    return this.http.post<ApiResponse<MenuDto>>(MENUS_API_BASE, body).pipe(switchMap(() => this._refresh()));
  }

  update(id: string, value: MenuFormValue): Observable<MenuItem[]> {
    const current = this.findById(id);
    const body: UpdateMenuRequest = {
      ...this._toRequest(value),
      // Moving to a new parent puts the item last among its new siblings; staying
      // put keeps whatever position it already had.
      order: value.order ?? ((value.parentId ?? null) === (current?.parentId ?? null)
        ? current?.order ?? null
        : this.nextOrder(value.parentId ?? undefined)),
    };
    return this.http.put<ApiResponse<MenuDto>>(`${MENUS_API_BASE}/${id}`, body).pipe(switchMap(() => this._refresh()));
  }

  remove(id: string): Observable<MenuItem[]> {
    return this.http.delete<ApiResponse<unknown>>(`${MENUS_API_BASE}/${id}`).pipe(switchMap(() => this._refresh()));
  }

  /** Shifts `id` one slot up (-1) or down (+1) among its siblings. */
  move(id: string, delta: -1 | 1): Observable<MenuItem[]> {
    const item = this.findById(id);
    if (!item) return throwError(() => new Error(`Không tìm thấy menu item "${id}".`));

    const siblings = this.siblingsOf(item.parentId);
    const from = siblings.findIndex(s => s.id === id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= siblings.length) return this._refresh();

    const reordered = [...siblings];
    reordered.splice(to, 0, ...reordered.splice(from, 1));

    // Renumber densely from 0 so repeated moves can't drift into gaps or ties,
    // then persist only the rows whose position actually changed.
    const writes = reordered
      .map((sibling, index) => ({ sibling, index }))
      .filter(({ sibling, index }) => sibling.order !== index)
      .map(({ sibling, index }) =>
        this.http.put<ApiResponse<MenuDto>>(`${MENUS_API_BASE}/${sibling.id}`, {
          ...this._toRequest({
            label: sibling.label,
            route: sibling.route,
            icon: sibling.icon,
            parentId: sibling.parentId,
            functionId: sibling.functionId,
          }),
          order: index,
        } satisfies UpdateMenuRequest));

    if (writes.length === 0) return this._refresh();
    return forkJoin(writes).pipe(switchMap(() => this._refresh()));
  }

  // ─── Catalogue queries ──────────────────────────────────────────────────────

  /** Looks the item up in the admin catalogue (falls back to the sidebar tree). */
  findById(id: string): MenuItem | undefined {
    return this._find(this._catalogue(), id) ?? this._find(this._items(), id);
  }

  /** Finds the sidebar entry owning `route`, so a tab opened straight from a URL can
   *  borrow the same label and icon the sidebar would have given it. */
  findByRoute(route: string): MenuItem | undefined {
    const walk = (items: MenuItem[]): MenuItem | undefined => {
      for (const item of items) {
        if (item.route === route) return item;
        const found = item.children?.length ? walk(item.children) : undefined;
        if (found) return found;
      }
      return undefined;
    };
    return walk(this._items());
  }

  /** Direct children of `parentId`, or the root level when it's absent. */
  siblingsOf(parentId?: string | null): MenuItem[] {
    if (!parentId) return this._catalogue();
    return this._find(this._catalogue(), parentId)?.children ?? [];
  }

  /** `id` plus everything beneath it — the set that can never become its own parent. */
  descendantIds(id: string): Set<string> {
    const ids = new Set<string>([id]);
    const collect = (nodes: MenuItem[]) => {
      for (const node of nodes) {
        ids.add(node.id);
        if (node.children?.length) collect(node.children);
      }
    };
    collect(this._find(this._catalogue(), id)?.children ?? []);
    return ids;
  }

  /** Next free slot at the end of a sibling list. */
  nextOrder(parentId?: string): number {
    return this.siblingsOf(parentId).reduce((max, item) => Math.max(max, item.order ?? -1), -1) + 1;
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /** Re-reads both trees so the sidebar and the Menu Manager reflect the write together. */
  private _refresh(): Observable<MenuItem[]> {
    return forkJoin({ catalogue: this.loadCatalogue(), sidebar: this.load() }).pipe(map(r => r.catalogue));
  }

  private _toRequest(value: MenuFormValue): Omit<CreateMenuRequest, 'order'> {
    const route = value.route?.trim();
    return {
      name: value.label.trim(),
      url: route ? (route.startsWith('/') ? route : `/${route}`) : null,
      icon: value.icon?.trim() || null,
      parentId: value.parentId ? Number(value.parentId) : null,
      functionId: value.functionId ? Number(value.functionId) : null,
    };
  }

  private _find(items: MenuItem[], id: string): MenuItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;
      const found = item.children?.length ? this._find(item.children, id) : undefined;
      if (found) return found;
    }
    return undefined;
  }
}
